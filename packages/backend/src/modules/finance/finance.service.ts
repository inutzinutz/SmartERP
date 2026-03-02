import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { Prisma } from '@prisma/client';

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CreateAccountDto {
  code: string;
  name: string;
  type: string;
  parentId?: string;
  description?: string;
  isActive?: boolean;
  organizationId: string;
}

export interface UpdateAccountDto {
  code?: string;
  name?: string;
  type?: string;
  parentId?: string;
  description?: string;
  isActive?: boolean;
}

export interface JournalEntryLineDto {
  accountId: string;
  debit: number;
  credit: number;
  description?: string;
}

export interface CreateJournalEntryDto {
  entryDate: Date;
  reference?: string;
  description: string;
  lines: JournalEntryLineDto[];
  organizationId: string;
  userId: string;
}

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Chart of Accounts ───────────────────────────────────────────────

  async createAccount(dto: CreateAccountDto) {
    const existing = await this.prisma.account.findFirst({
      where: { code: dto.code, organizationId: dto.organizationId },
    });

    if (existing) {
      throw new ConflictException(`Account with code '${dto.code}' already exists`);
    }

    if (dto.parentId) {
      const parent = await this.prisma.account.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new NotFoundException(`Parent account with ID ${dto.parentId} not found`);
      }
    }

    return this.prisma.account.create({
      data: {
        code: dto.code,
        name: dto.name,
        type: dto.type,
        parentId: dto.parentId,
        description: dto.description,
        isActive: dto.isActive ?? true,
        organizationId: dto.organizationId,
      },
      include: {
        parent: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async findAllAccounts(
    organizationId: string,
    filters?: { type?: string; isActive?: boolean; parentId?: string },
  ) {
    const where: Prisma.AccountWhereInput = {
      organizationId,
      ...(filters?.type && { type: filters.type }),
      ...(filters?.isActive !== undefined && { isActive: filters.isActive }),
      ...(filters?.parentId !== undefined && { parentId: filters.parentId }),
    };

    const accounts = await this.prisma.account.findMany({
      where,
      orderBy: { code: 'asc' },
      include: {
        parent: { select: { id: true, code: true, name: true } },
        children: {
          select: { id: true, code: true, name: true, type: true },
          orderBy: { code: 'asc' },
        },
      },
    });

    return accounts;
  }

  async getChartOfAccountsTree(organizationId: string) {
    const accounts = await this.prisma.account.findMany({
      where: { organizationId, parentId: null, isActive: true },
      orderBy: { code: 'asc' },
      include: {
        children: {
          where: { isActive: true },
          orderBy: { code: 'asc' },
          include: {
            children: {
              where: { isActive: true },
              orderBy: { code: 'asc' },
            },
          },
        },
      },
    });

    return accounts;
  }

  async findAccount(id: string) {
    const account = await this.prisma.account.findUnique({
      where: { id },
      include: {
        parent: { select: { id: true, code: true, name: true } },
        children: {
          select: { id: true, code: true, name: true, type: true },
          orderBy: { code: 'asc' },
        },
      },
    });

    if (!account) {
      throw new NotFoundException(`Account with ID ${id} not found`);
    }

    return account;
  }

  async updateAccount(id: string, dto: UpdateAccountDto) {
    await this.findAccount(id);

    return this.prisma.account.update({
      where: { id },
      data: dto,
      include: {
        parent: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async deleteAccount(id: string) {
    const account = await this.findAccount(id);

    if (account.children && account.children.length > 0) {
      throw new BadRequestException(
        'Cannot delete account with child accounts. Delete or reassign children first.',
      );
    }

    const entryCount = await this.prisma.journalEntryLine.count({
      where: { accountId: id },
    });

    if (entryCount > 0) {
      throw new BadRequestException(
        'Cannot delete account with existing journal entries. Deactivate instead.',
      );
    }

    await this.prisma.account.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: `Account ${id} has been deactivated` };
  }

  // ── Journal Entries ─────────────────────────────────────────────────

  private generateEntryNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `JE-${timestamp}-${random}`;
  }

  async createJournalEntry(dto: CreateJournalEntryDto) {
    if (!dto.lines || dto.lines.length < 2) {
      throw new BadRequestException(
        'Journal entry must have at least two lines',
      );
    }

    const totalDebits = dto.lines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredits = dto.lines.reduce((sum, l) => sum + l.credit, 0);

    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      throw new BadRequestException(
        `Debits (${totalDebits.toFixed(2)}) must equal credits (${totalCredits.toFixed(2)})`,
      );
    }

    for (const line of dto.lines) {
      if (line.debit > 0 && line.credit > 0) {
        throw new BadRequestException(
          'A journal entry line cannot have both debit and credit amounts',
        );
      }
      if (line.debit === 0 && line.credit === 0) {
        throw new BadRequestException(
          'A journal entry line must have either a debit or credit amount',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.create({
        data: {
          entryNumber: this.generateEntryNumber(),
          entryDate: dto.entryDate,
          reference: dto.reference,
          description: dto.description,
          totalAmount: totalDebits,
          status: 'DRAFT',
          organizationId: dto.organizationId,
          userId: dto.userId,
          lines: {
            create: dto.lines.map((line) => ({
              accountId: line.accountId,
              debit: line.debit,
              credit: line.credit,
              description: line.description,
            })),
          },
        },
        include: {
          lines: {
            include: {
              account: { select: { id: true, code: true, name: true, type: true } },
            },
          },
        },
      });

      return entry;
    });
  }

  async findAllJournalEntries(
    organizationId: string,
    pagination: PaginationDto,
    filters?: {
      status?: string;
      startDate?: string;
      endDate?: string;
      accountId?: string;
    },
  ): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const where: Prisma.JournalEntryWhereInput = {
      organizationId,
      ...(filters?.status && { status: filters.status }),
      ...(filters?.startDate || filters?.endDate
        ? {
            entryDate: {
              ...(filters.startDate && { gte: new Date(filters.startDate) }),
              ...(filters.endDate && { lte: new Date(filters.endDate) }),
            },
          }
        : {}),
      ...(filters?.accountId && {
        lines: { some: { accountId: filters.accountId } },
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.journalEntry.findMany({
        where,
        skip,
        take: limit,
        orderBy: { entryDate: 'desc' },
        include: {
          lines: {
            include: {
              account: { select: { id: true, code: true, name: true } },
            },
          },
        },
      }),
      this.prisma.journalEntry.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findJournalEntry(id: string) {
    const entry = await this.prisma.journalEntry.findUnique({
      where: { id },
      include: {
        lines: {
          include: {
            account: { select: { id: true, code: true, name: true, type: true } },
          },
        },
      },
    });

    if (!entry) {
      throw new NotFoundException(`Journal entry with ID ${id} not found`);
    }

    return entry;
  }

  async postJournalEntry(id: string) {
    const entry = await this.findJournalEntry(id);

    if (entry.status !== 'DRAFT') {
      throw new BadRequestException('Only draft entries can be posted');
    }

    return this.prisma.journalEntry.update({
      where: { id },
      data: { status: 'POSTED', postedAt: new Date() },
      include: {
        lines: {
          include: {
            account: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });
  }

  async voidJournalEntry(id: string, reason: string) {
    const entry = await this.findJournalEntry(id);

    if (entry.status === 'VOIDED') {
      throw new BadRequestException('Entry is already voided');
    }

    return this.prisma.$transaction(async (tx) => {
      const voidedEntry = await tx.journalEntry.update({
        where: { id },
        data: { status: 'VOIDED', voidReason: reason },
      });

      const reversalEntry = await tx.journalEntry.create({
        data: {
          entryNumber: `${entry.entryNumber}-REV`,
          entryDate: new Date(),
          reference: `Reversal of ${entry.entryNumber}`,
          description: `Reversal: ${reason}`,
          totalAmount: entry.totalAmount,
          status: 'POSTED',
          postedAt: new Date(),
          organizationId: entry.organizationId,
          userId: entry.userId,
          lines: {
            create: entry.lines.map((line) => ({
              accountId: line.accountId,
              debit: Number(line.credit),
              credit: Number(line.debit),
              description: `Reversal: ${line.description || ''}`,
            })),
          },
        },
        include: {
          lines: {
            include: {
              account: { select: { id: true, code: true, name: true } },
            },
          },
        },
      });

      return { voidedEntry, reversalEntry };
    });
  }

  // ── Financial Reports ───────────────────────────────────────────────

  async getTrialBalance(organizationId: string, asOfDate?: string) {
    const dateFilter = asOfDate ? new Date(asOfDate) : new Date();

    const balances = await this.prisma.$queryRaw`
      SELECT
        a.id,
        a.code,
        a.name,
        a.type,
        COALESCE(SUM(jel.debit), 0) as "totalDebits",
        COALESCE(SUM(jel.credit), 0) as "totalCredits",
        COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0) as "balance"
      FROM "Account" a
      LEFT JOIN "JournalEntryLine" jel ON jel."accountId" = a.id
      LEFT JOIN "JournalEntry" je ON je.id = jel."journalEntryId"
        AND je.status = 'POSTED'
        AND je."entryDate" <= ${dateFilter}
      WHERE a."organizationId" = ${organizationId}
        AND a."isActive" = true
      GROUP BY a.id, a.code, a.name, a.type
      HAVING COALESCE(SUM(jel.debit), 0) != 0 OR COALESCE(SUM(jel.credit), 0) != 0
      ORDER BY a.code
    `;

    const rows = balances as any[];
    const totalDebits = rows.reduce((sum, r) => sum + Number(r.totalDebits), 0);
    const totalCredits = rows.reduce((sum, r) => sum + Number(r.totalCredits), 0);

    return {
      asOfDate: dateFilter,
      accounts: rows,
      totals: {
        totalDebits,
        totalCredits,
        difference: totalDebits - totalCredits,
        isBalanced: Math.abs(totalDebits - totalCredits) < 0.01,
      },
    };
  }

  async getIncomeStatement(
    organizationId: string,
    startDate: string,
    endDate: string,
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const results = await this.prisma.$queryRaw`
      SELECT
        a.type,
        a.code,
        a.name,
        COALESCE(SUM(jel.credit), 0) - COALESCE(SUM(jel.debit), 0) as "balance"
      FROM "Account" a
      LEFT JOIN "JournalEntryLine" jel ON jel."accountId" = a.id
      LEFT JOIN "JournalEntry" je ON je.id = jel."journalEntryId"
        AND je.status = 'POSTED'
        AND je."entryDate" >= ${start}
        AND je."entryDate" <= ${end}
      WHERE a."organizationId" = ${organizationId}
        AND a.type IN ('REVENUE', 'EXPENSE')
        AND a."isActive" = true
      GROUP BY a.type, a.code, a.name
      HAVING COALESCE(SUM(jel.debit), 0) != 0 OR COALESCE(SUM(jel.credit), 0) != 0
      ORDER BY a.type DESC, a.code
    `;

    const rows = results as any[];
    const revenue = rows
      .filter((r) => r.type === 'REVENUE')
      .map((r) => ({ ...r, balance: Number(r.balance) }));
    const expenses = rows
      .filter((r) => r.type === 'EXPENSE')
      .map((r) => ({ ...r, balance: Math.abs(Number(r.balance)) }));

    const totalRevenue = revenue.reduce((sum, r) => sum + r.balance, 0);
    const totalExpenses = expenses.reduce((sum, r) => sum + r.balance, 0);
    const netIncome = totalRevenue - totalExpenses;

    return {
      period: { startDate: start, endDate: end },
      revenue,
      totalRevenue,
      expenses,
      totalExpenses,
      netIncome,
      profitMargin: totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0,
    };
  }

  async getBalanceSheet(organizationId: string, asOfDate?: string) {
    const dateFilter = asOfDate ? new Date(asOfDate) : new Date();

    const results = await this.prisma.$queryRaw`
      SELECT
        a.type,
        a.code,
        a.name,
        CASE
          WHEN a.type IN ('ASSET') THEN COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0)
          ELSE COALESCE(SUM(jel.credit), 0) - COALESCE(SUM(jel.debit), 0)
        END as "balance"
      FROM "Account" a
      LEFT JOIN "JournalEntryLine" jel ON jel."accountId" = a.id
      LEFT JOIN "JournalEntry" je ON je.id = jel."journalEntryId"
        AND je.status = 'POSTED'
        AND je."entryDate" <= ${dateFilter}
      WHERE a."organizationId" = ${organizationId}
        AND a.type IN ('ASSET', 'LIABILITY', 'EQUITY')
        AND a."isActive" = true
      GROUP BY a.type, a.code, a.name
      HAVING COALESCE(SUM(jel.debit), 0) != 0 OR COALESCE(SUM(jel.credit), 0) != 0
      ORDER BY a.type, a.code
    `;

    const rows = results as any[];
    const assets = rows
      .filter((r) => r.type === 'ASSET')
      .map((r) => ({ ...r, balance: Number(r.balance) }));
    const liabilities = rows
      .filter((r) => r.type === 'LIABILITY')
      .map((r) => ({ ...r, balance: Number(r.balance) }));
    const equity = rows
      .filter((r) => r.type === 'EQUITY')
      .map((r) => ({ ...r, balance: Number(r.balance) }));

    const totalAssets = assets.reduce((sum, r) => sum + r.balance, 0);
    const totalLiabilities = liabilities.reduce((sum, r) => sum + r.balance, 0);
    const totalEquity = equity.reduce((sum, r) => sum + r.balance, 0);

    return {
      asOfDate: dateFilter,
      assets,
      totalAssets,
      liabilities,
      totalLiabilities,
      equity,
      totalEquity,
      totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
      isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
    };
  }

  async getAccountLedger(
    accountId: string,
    organizationId: string,
    pagination: PaginationDto,
    filters?: { startDate?: string; endDate?: string },
  ): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 50 } = pagination;
    const skip = (page - 1) * limit;

    await this.findAccount(accountId);

    const where: Prisma.JournalEntryLineWhereInput = {
      accountId,
      journalEntry: {
        organizationId,
        status: 'POSTED',
        ...(filters?.startDate || filters?.endDate
          ? {
              entryDate: {
                ...(filters.startDate && { gte: new Date(filters.startDate) }),
                ...(filters.endDate && { lte: new Date(filters.endDate) }),
              },
            }
          : {}),
      },
    };

    const [data, total] = await Promise.all([
      this.prisma.journalEntryLine.findMany({
        where,
        skip,
        take: limit,
        orderBy: { journalEntry: { entryDate: 'asc' } },
        include: {
          journalEntry: {
            select: {
              id: true,
              entryNumber: true,
              entryDate: true,
              description: true,
            },
          },
        },
      }),
      this.prisma.journalEntryLine.count({ where }),
    ]);

    let runningBalance = 0;
    const ledgerEntries = data.map((line) => {
      runningBalance += Number(line.debit) - Number(line.credit);
      return {
        ...line,
        runningBalance,
      };
    });

    return {
      data: ledgerEntries,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
