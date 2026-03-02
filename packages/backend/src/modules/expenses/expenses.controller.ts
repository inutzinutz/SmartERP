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
  IsArray,
  IsDateString,
  ValidateNested,
  Min,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ExpensesService } from './expenses.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

class ExpenseLineBodyDto {
  @IsString()
  description: string;

  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  amount: number;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  accountId?: string;

  @IsOptional()
  @IsString()
  receiptUrl?: string;
}

class CreateExpenseClaimBodyDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  expenseDate: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ExpenseLineBodyDto)
  lines: ExpenseLineBodyDto[];
}

class UpdateExpenseClaimBodyDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  expenseDate?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExpenseLineBodyDto)
  lines?: ExpenseLineBodyDto[];
}

class ApprovalBodyDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

class RejectBodyDto {
  @IsString()
  reason: string;
}

@ApiTags('Expenses')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new expense claim' })
  @ApiResponse({ status: 201, description: 'Expense claim created' })
  create(
    @Body() dto: CreateExpenseClaimBodyDto,
    @CurrentUser() user: any,
  ) {
    return this.expensesService.create({
      ...dto,
      expenseDate: new Date(dto.expenseDate),
      organizationId: user.organizationId,
      userId: user.id,
    });
  }

  @Get()
  @Roles('ADMIN', 'OWNER', 'MANAGER', 'ACCOUNTANT')
  @ApiOperation({ summary: 'List all expense claims (admin/manager view)' })
  @ApiResponse({ status: 200, description: 'Paginated expense claims' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  findAll(
    @Query() pagination: PaginationDto,
    @Query('status') status: string,
    @Query('userId') userId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @CurrentUser() user: any,
  ) {
    const filters = {
      ...(status && { status }),
      ...(userId && { userId }),
      ...(startDate && { startDate }),
      ...(endDate && { endDate }),
    };
    return this.expensesService.findAll(
      user.organizationId,
      pagination,
      filters,
    );
  }

  @Get('my')
  @ApiOperation({ summary: 'List my expense claims' })
  @ApiResponse({ status: 200, description: 'My expense claims' })
  @ApiQuery({ name: 'status', required: false })
  findMyExpenses(
    @Query() pagination: PaginationDto,
    @Query('status') status: string,
    @CurrentUser() user: any,
  ) {
    return this.expensesService.findMyExpenses(
      user.id,
      user.organizationId,
      pagination,
      status,
    );
  }

  @Get('pending-approvals')
  @Roles('ADMIN', 'OWNER', 'MANAGER')
  @ApiOperation({ summary: 'List expense claims pending approval' })
  @ApiResponse({ status: 200, description: 'Pending expense claims' })
  getPendingApprovals(
    @Query() pagination: PaginationDto,
    @CurrentUser() user: any,
  ) {
    return this.expensesService.getPendingApprovals(
      user.organizationId,
      pagination,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get expense claim by ID' })
  @ApiResponse({ status: 200, description: 'Expense claim details' })
  findOne(@Param('id') id: string) {
    return this.expensesService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an expense claim (draft only)' })
  @ApiResponse({ status: 200, description: 'Expense claim updated' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateExpenseClaimBodyDto,
    @CurrentUser() user: any,
  ) {
    return this.expensesService.update(
      id,
      {
        ...dto,
        expenseDate: dto.expenseDate ? new Date(dto.expenseDate) : undefined,
      },
      user.id,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete an expense claim (draft only)' })
  @ApiResponse({ status: 200, description: 'Expense claim deleted' })
  delete(@Param('id') id: string, @CurrentUser() user: any) {
    return this.expensesService.delete(id, user.id);
  }

  @Patch(':id/submit')
  @ApiOperation({ summary: 'Submit expense claim for approval' })
  @ApiResponse({ status: 200, description: 'Expense claim submitted' })
  submit(@Param('id') id: string, @CurrentUser() user: any) {
    return this.expensesService.submit(id, user.id);
  }

  @Patch(':id/approve')
  @Roles('ADMIN', 'OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Approve an expense claim' })
  @ApiResponse({ status: 200, description: 'Expense claim approved' })
  approve(
    @Param('id') id: string,
    @Body() dto: ApprovalBodyDto,
    @CurrentUser() user: any,
  ) {
    return this.expensesService.approve(id, user.id, dto.notes);
  }

  @Patch(':id/reject')
  @Roles('ADMIN', 'OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Reject an expense claim' })
  @ApiResponse({ status: 200, description: 'Expense claim rejected' })
  reject(
    @Param('id') id: string,
    @Body() dto: RejectBodyDto,
    @CurrentUser() user: any,
  ) {
    return this.expensesService.reject(id, user.id, dto.reason);
  }

  @Patch(':id/mark-paid')
  @Roles('ADMIN', 'OWNER', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Mark an approved expense claim as paid' })
  @ApiResponse({ status: 200, description: 'Expense claim marked as paid' })
  markAsPaid(@Param('id') id: string) {
    return this.expensesService.markAsPaid(id);
  }
}
