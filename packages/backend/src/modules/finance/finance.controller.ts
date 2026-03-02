import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  IsDateString,
  ValidateNested,
  Min,
  ArrayMinSize,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FinanceService } from './finance.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

enum AccountType {
  ASSET = 'ASSET',
  LIABILITY = 'LIABILITY',
  EQUITY = 'EQUITY',
  REVENUE = 'REVENUE',
  EXPENSE = 'EXPENSE',
}

class CreateAccountBodyDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsEnum(AccountType)
  type: AccountType;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class UpdateAccountBodyDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(AccountType)
  type?: AccountType;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class JournalEntryLineBodyDto {
  @IsString()
  accountId: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  debit: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  credit: number;

  @IsOptional()
  @IsString()
  description?: string;
}

class CreateJournalEntryBodyDto {
  @IsDateString()
  entryDate: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsString()
  description: string;

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => JournalEntryLineBodyDto)
  lines: JournalEntryLineBodyDto[];
}

class VoidJournalEntryBodyDto {
  @IsString()
  reason: string;
}

@ApiTags('Finance')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  // ── Chart of Accounts ─────────────────────────────────────────────

  @Post('accounts')
  @Roles('ADMIN', 'OWNER', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Create a new account in the chart of accounts' })
  @ApiResponse({ status: 201, description: 'Account created' })
  createAccount(
    @Body() dto: CreateAccountBodyDto,
    @CurrentUser() user: any,
  ) {
    return this.financeService.createAccount({
      ...dto,
      organizationId: user.organizationId,
    });
  }

  @Get('accounts')
  @ApiOperation({ summary: 'List all accounts' })
  @ApiResponse({ status: 200, description: 'List of accounts' })
  @ApiQuery({ name: 'type', required: false, enum: AccountType })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'parentId', required: false })
  findAllAccounts(
    @Query('type') type: string,
    @Query('isActive') isActive: string,
    @Query('parentId') parentId: string,
    @CurrentUser() user: any,
  ) {
    const filters = {
      ...(type && { type }),
      ...(isActive !== undefined && { isActive: isActive === 'true' }),
      ...(parentId !== undefined && { parentId: parentId || null }),
    };
    return this.financeService.findAllAccounts(user.organizationId, filters);
  }

  @Get('accounts/tree')
  @ApiOperation({ summary: 'Get chart of accounts as hierarchical tree' })
  @ApiResponse({ status: 200, description: 'Hierarchical chart of accounts' })
  getChartOfAccountsTree(@CurrentUser() user: any) {
    return this.financeService.getChartOfAccountsTree(user.organizationId);
  }

  @Get('accounts/:id')
  @ApiOperation({ summary: 'Get account by ID' })
  @ApiResponse({ status: 200, description: 'Account details' })
  findAccount(@Param('id') id: string) {
    return this.financeService.findAccount(id);
  }

  @Get('accounts/:id/ledger')
  @ApiOperation({ summary: 'Get account ledger with running balance' })
  @ApiResponse({ status: 200, description: 'Account ledger entries' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getAccountLedger(
    @Param('id') id: string,
    @Query() pagination: PaginationDto,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @CurrentUser() user: any,
  ) {
    const filters = {
      ...(startDate && { startDate }),
      ...(endDate && { endDate }),
    };
    return this.financeService.getAccountLedger(
      id,
      user.organizationId,
      pagination,
      filters,
    );
  }

  @Put('accounts/:id')
  @Roles('ADMIN', 'OWNER', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Update an account' })
  @ApiResponse({ status: 200, description: 'Account updated' })
  updateAccount(
    @Param('id') id: string,
    @Body() dto: UpdateAccountBodyDto,
  ) {
    return this.financeService.updateAccount(id, dto);
  }

  @Delete('accounts/:id')
  @Roles('ADMIN', 'OWNER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate an account' })
  @ApiResponse({ status: 200, description: 'Account deactivated' })
  deleteAccount(@Param('id') id: string) {
    return this.financeService.deleteAccount(id);
  }

  // ── Journal Entries ───────────────────────────────────────────────

  @Post('journal-entries')
  @Roles('ADMIN', 'OWNER', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Create a new journal entry' })
  @ApiResponse({ status: 201, description: 'Journal entry created' })
  createJournalEntry(
    @Body() dto: CreateJournalEntryBodyDto,
    @CurrentUser() user: any,
  ) {
    return this.financeService.createJournalEntry({
      ...dto,
      entryDate: new Date(dto.entryDate),
      organizationId: user.organizationId,
      userId: user.id,
    });
  }

  @Get('journal-entries')
  @ApiOperation({ summary: 'List journal entries' })
  @ApiResponse({ status: 200, description: 'Paginated journal entries' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'accountId', required: false })
  findAllJournalEntries(
    @Query() pagination: PaginationDto,
    @Query('status') status: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('accountId') accountId: string,
    @CurrentUser() user: any,
  ) {
    const filters = {
      ...(status && { status }),
      ...(startDate && { startDate }),
      ...(endDate && { endDate }),
      ...(accountId && { accountId }),
    };
    return this.financeService.findAllJournalEntries(
      user.organizationId,
      pagination,
      filters,
    );
  }

  @Get('journal-entries/:id')
  @ApiOperation({ summary: 'Get journal entry by ID' })
  @ApiResponse({ status: 200, description: 'Journal entry details' })
  findJournalEntry(@Param('id') id: string) {
    return this.financeService.findJournalEntry(id);
  }

  @Patch('journal-entries/:id/post')
  @Roles('ADMIN', 'OWNER', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Post a draft journal entry' })
  @ApiResponse({ status: 200, description: 'Journal entry posted' })
  postJournalEntry(@Param('id') id: string) {
    return this.financeService.postJournalEntry(id);
  }

  @Patch('journal-entries/:id/void')
  @Roles('ADMIN', 'OWNER')
  @ApiOperation({ summary: 'Void a journal entry and create reversal' })
  @ApiResponse({ status: 200, description: 'Journal entry voided with reversal created' })
  voidJournalEntry(
    @Param('id') id: string,
    @Body() dto: VoidJournalEntryBodyDto,
  ) {
    return this.financeService.voidJournalEntry(id, dto.reason);
  }

  // ── Financial Reports ─────────────────────────────────────────────

  @Get('reports/trial-balance')
  @ApiOperation({ summary: 'Generate trial balance report' })
  @ApiResponse({ status: 200, description: 'Trial balance report' })
  @ApiQuery({ name: 'asOfDate', required: false })
  getTrialBalance(
    @Query('asOfDate') asOfDate: string,
    @CurrentUser() user: any,
  ) {
    return this.financeService.getTrialBalance(user.organizationId, asOfDate);
  }

  @Get('reports/income-statement')
  @ApiOperation({ summary: 'Generate income statement (profit & loss)' })
  @ApiResponse({ status: 200, description: 'Income statement report' })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  getIncomeStatement(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @CurrentUser() user: any,
  ) {
    return this.financeService.getIncomeStatement(
      user.organizationId,
      startDate,
      endDate,
    );
  }

  @Get('reports/balance-sheet')
  @ApiOperation({ summary: 'Generate balance sheet report' })
  @ApiResponse({ status: 200, description: 'Balance sheet report' })
  @ApiQuery({ name: 'asOfDate', required: false })
  getBalanceSheet(
    @Query('asOfDate') asOfDate: string,
    @CurrentUser() user: any,
  ) {
    return this.financeService.getBalanceSheet(user.organizationId, asOfDate);
  }
}
