import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
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

export interface ExpenseLineDto {
  description: string;
  amount: number;
  categoryId?: string;
  accountId?: string;
  receiptUrl?: string;
}

export interface CreateExpenseClaimDto {
  title: string;
  description?: string;
  expenseDate: Date;
  currency?: string;
  lines: ExpenseLineDto[];
  organizationId: string;
  userId: string;
}

export interface UpdateExpenseClaimDto {
  title?: string;
  description?: string;
  expenseDate?: Date;
  currency?: string;
  lines?: ExpenseLineDto[];
}

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  private generateClaimNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `EXP-${timestamp}-${random}`;
  }

  async create(dto: CreateExpenseClaimDto) {
    if (!dto.lines || dto.lines.length === 0) {
      throw new BadRequestException(
        'Expense claim must have at least one line item',
      );
    }

    const totalAmount = dto.lines.reduce((sum, l) => sum + l.amount, 0);

    return this.prisma.expenseClaim.create({
      data: {
        claimNumber: this.generateClaimNumber(),
        title: dto.title,
        description: dto.description,
        expenseDate: dto.expenseDate,
        currency: dto.currency ?? 'USD',
        totalAmount,
        status: 'DRAFT',
        organizationId: dto.organizationId,
        userId: dto.userId,
        lines: {
          create: dto.lines.map((line) => ({
            description: line.description,
            amount: line.amount,
            categoryId: line.categoryId,
            accountId: line.accountId,
            receiptUrl: line.receiptUrl,
          })),
        },
      },
      include: {
        lines: {
          include: {
            category: { select: { id: true, name: true } },
          },
        },
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async findAll(
    organizationId: string,
    pagination: PaginationDto,
    filters?: {
      status?: string;
      userId?: string;
      startDate?: string;
      endDate?: string;
    },
  ): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const where: Prisma.ExpenseClaimWhereInput = {
      organizationId,
      ...(filters?.status && { status: filters.status }),
      ...(filters?.userId && { userId: filters.userId }),
      ...(filters?.startDate || filters?.endDate
        ? {
            expenseDate: {
              ...(filters.startDate && { gte: new Date(filters.startDate) }),
              ...(filters.endDate && { lte: new Date(filters.endDate) }),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.expenseClaim.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true },
          },
          _count: { select: { lines: true } },
        },
      }),
      this.prisma.expenseClaim.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findMyExpenses(
    userId: string,
    organizationId: string,
    pagination: PaginationDto,
    status?: string,
  ): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const where: Prisma.ExpenseClaimWhereInput = {
      userId,
      organizationId,
      ...(status && { status }),
    };

    const [data, total] = await Promise.all([
      this.prisma.expenseClaim.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          lines: {
            include: {
              category: { select: { id: true, name: true } },
            },
          },
          approver: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      }),
      this.prisma.expenseClaim.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const claim = await this.prisma.expenseClaim.findUnique({
      where: { id },
      include: {
        lines: {
          include: {
            category: { select: { id: true, name: true } },
          },
        },
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        approver: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    if (!claim) {
      throw new NotFoundException(`Expense claim with ID ${id} not found`);
    }

    return claim;
  }

  async update(id: string, dto: UpdateExpenseClaimDto, userId: string) {
    const existing = await this.findOne(id);

    if (existing.userId !== userId) {
      throw new ForbiddenException('You can only edit your own expense claims');
    }

    if (existing.status !== 'DRAFT') {
      throw new BadRequestException(
        'Only draft expense claims can be edited',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.lines) {
        await tx.expenseClaimLine.deleteMany({
          where: { expenseClaimId: id },
        });

        const totalAmount = dto.lines.reduce((sum, l) => sum + l.amount, 0);

        return tx.expenseClaim.update({
          where: { id },
          data: {
            title: dto.title,
            description: dto.description,
            expenseDate: dto.expenseDate,
            currency: dto.currency,
            totalAmount,
            lines: {
              create: dto.lines.map((line) => ({
                description: line.description,
                amount: line.amount,
                categoryId: line.categoryId,
                accountId: line.accountId,
                receiptUrl: line.receiptUrl,
              })),
            },
          },
          include: {
            lines: {
              include: {
                category: { select: { id: true, name: true } },
              },
            },
          },
        });
      }

      return tx.expenseClaim.update({
        where: { id },
        data: {
          title: dto.title,
          description: dto.description,
          expenseDate: dto.expenseDate,
          currency: dto.currency,
        },
        include: {
          lines: {
            include: {
              category: { select: { id: true, name: true } },
            },
          },
        },
      });
    });
  }

  async delete(id: string, userId: string) {
    const existing = await this.findOne(id);

    if (existing.userId !== userId) {
      throw new ForbiddenException(
        'You can only delete your own expense claims',
      );
    }

    if (existing.status !== 'DRAFT') {
      throw new BadRequestException('Only draft expense claims can be deleted');
    }

    await this.prisma.expenseClaimLine.deleteMany({
      where: { expenseClaimId: id },
    });

    await this.prisma.expenseClaim.delete({ where: { id } });

    return { message: `Expense claim ${id} has been deleted` };
  }

  // ── Approval Workflow ───────────────────────────────────────────────

  async submit(id: string, userId: string) {
    const claim = await this.findOne(id);

    if (claim.userId !== userId) {
      throw new ForbiddenException(
        'You can only submit your own expense claims',
      );
    }

    if (claim.status !== 'DRAFT') {
      throw new BadRequestException('Only draft claims can be submitted');
    }

    return this.prisma.expenseClaim.update({
      where: { id },
      data: { status: 'SUBMITTED', submittedAt: new Date() },
    });
  }

  async approve(id: string, approverId: string, notes?: string) {
    const claim = await this.findOne(id);

    if (claim.status !== 'SUBMITTED') {
      throw new BadRequestException('Only submitted claims can be approved');
    }

    if (claim.userId === approverId) {
      throw new ForbiddenException('You cannot approve your own expense claim');
    }

    return this.prisma.expenseClaim.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approverId,
        approvedAt: new Date(),
        approvalNotes: notes,
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        approver: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async reject(id: string, approverId: string, reason: string) {
    const claim = await this.findOne(id);

    if (claim.status !== 'SUBMITTED') {
      throw new BadRequestException('Only submitted claims can be rejected');
    }

    if (!reason) {
      throw new BadRequestException('Rejection reason is required');
    }

    return this.prisma.expenseClaim.update({
      where: { id },
      data: {
        status: 'REJECTED',
        approverId,
        approvedAt: new Date(),
        approvalNotes: reason,
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        approver: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async markAsPaid(id: string) {
    const claim = await this.findOne(id);

    if (claim.status !== 'APPROVED') {
      throw new BadRequestException('Only approved claims can be marked as paid');
    }

    return this.prisma.expenseClaim.update({
      where: { id },
      data: { status: 'PAID', paidAt: new Date() },
    });
  }

  async getPendingApprovals(
    organizationId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const where: Prisma.ExpenseClaimWhereInput = {
      organizationId,
      status: 'SUBMITTED',
    };

    const [data, total] = await Promise.all([
      this.prisma.expenseClaim.findMany({
        where,
        skip,
        take: limit,
        orderBy: { submittedAt: 'asc' },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          _count: { select: { lines: true } },
        },
      }),
      this.prisma.expenseClaim.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
