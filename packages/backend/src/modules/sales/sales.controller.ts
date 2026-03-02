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
  IsEmail,
  IsArray,
  IsDateString,
  ValidateNested,
  Min,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SalesService } from './sales.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

class CreateCustomerBodyDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  taxId?: string;
}

class UpdateCustomerBodyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  taxId?: string;
}

class SalesOrderLineBodyDto {
  @IsString()
  productId: string;

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  quantity: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  unitPrice: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  discount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  taxRate?: number;
}

class CreateSalesOrderBodyDto {
  @IsString()
  customerId: string;

  @IsOptional()
  @IsDateString()
  orderDate?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SalesOrderLineBodyDto)
  lines: SalesOrderLineBodyDto[];
}

class UpdateSalesOrderBodyDto {
  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SalesOrderLineBodyDto)
  lines?: SalesOrderLineBodyDto[];
}

class RecordPaymentBodyDto {
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  amount: number;

  @IsString()
  paymentMethod: string;

  @IsOptional()
  @IsString()
  reference?: string;
}

@ApiTags('Sales')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  // ── Customers ─────────────────────────────────────────────────────

  @Post('customers')
  @ApiOperation({ summary: 'Create a new customer' })
  @ApiResponse({ status: 201, description: 'Customer created' })
  createCustomer(
    @Body() dto: CreateCustomerBodyDto,
    @CurrentUser() user: any,
  ) {
    return this.salesService.createCustomer({
      ...dto,
      organizationId: user.organizationId,
    });
  }

  @Get('customers')
  @ApiOperation({ summary: 'List customers' })
  @ApiResponse({ status: 200, description: 'Paginated customer list' })
  @ApiQuery({ name: 'search', required: false })
  findAllCustomers(
    @Query() pagination: PaginationDto,
    @Query('search') search: string,
    @CurrentUser() user: any,
  ) {
    return this.salesService.findAllCustomers(
      user.organizationId,
      pagination,
      search,
    );
  }

  @Get('customers/:id')
  @ApiOperation({ summary: 'Get customer by ID' })
  @ApiResponse({ status: 200, description: 'Customer details' })
  findCustomer(@Param('id') id: string) {
    return this.salesService.findCustomer(id);
  }

  @Put('customers/:id')
  @ApiOperation({ summary: 'Update a customer' })
  @ApiResponse({ status: 200, description: 'Customer updated' })
  updateCustomer(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerBodyDto,
  ) {
    return this.salesService.updateCustomer(id, dto);
  }

  @Delete('customers/:id')
  @Roles('ADMIN', 'OWNER', 'MANAGER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate a customer' })
  @ApiResponse({ status: 200, description: 'Customer deactivated' })
  deleteCustomer(@Param('id') id: string) {
    return this.salesService.deleteCustomer(id);
  }

  // ── Sales Orders ──────────────────────────────────────────────────

  @Post('orders')
  @ApiOperation({ summary: 'Create a new sales order' })
  @ApiResponse({ status: 201, description: 'Sales order created' })
  createSalesOrder(
    @Body() dto: CreateSalesOrderBodyDto,
    @CurrentUser() user: any,
  ) {
    return this.salesService.createSalesOrder({
      ...dto,
      orderDate: dto.orderDate ? new Date(dto.orderDate) : undefined,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      organizationId: user.organizationId,
      userId: user.id,
    });
  }

  @Get('orders')
  @ApiOperation({ summary: 'List sales orders' })
  @ApiResponse({ status: 200, description: 'Paginated sales orders' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'customerId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  findAllSalesOrders(
    @Query() pagination: PaginationDto,
    @Query('status') status: string,
    @Query('customerId') customerId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @CurrentUser() user: any,
  ) {
    const filters = {
      ...(status && { status }),
      ...(customerId && { customerId }),
      ...(startDate && { startDate }),
      ...(endDate && { endDate }),
    };
    return this.salesService.findAllSalesOrders(
      user.organizationId,
      pagination,
      filters,
    );
  }

  @Get('orders/:id')
  @ApiOperation({ summary: 'Get sales order by ID' })
  @ApiResponse({ status: 200, description: 'Sales order details' })
  findSalesOrder(@Param('id') id: string) {
    return this.salesService.findSalesOrder(id);
  }

  @Put('orders/:id')
  @ApiOperation({ summary: 'Update a sales order' })
  @ApiResponse({ status: 200, description: 'Sales order updated' })
  updateSalesOrder(
    @Param('id') id: string,
    @Body() dto: UpdateSalesOrderBodyDto,
  ) {
    return this.salesService.updateSalesOrder(id, {
      ...dto,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
    });
  }

  @Patch('orders/:id/confirm')
  @Roles('ADMIN', 'OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Confirm a draft sales order' })
  @ApiResponse({ status: 200, description: 'Order confirmed' })
  confirmSalesOrder(@Param('id') id: string) {
    return this.salesService.confirmSalesOrder(id);
  }

  @Patch('orders/:id/cancel')
  @Roles('ADMIN', 'OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Cancel a sales order' })
  @ApiResponse({ status: 200, description: 'Order cancelled' })
  cancelSalesOrder(@Param('id') id: string) {
    return this.salesService.cancelSalesOrder(id);
  }

  // ── Receivables ───────────────────────────────────────────────────

  @Get('receivables')
  @ApiOperation({ summary: 'List accounts receivable' })
  @ApiResponse({ status: 200, description: 'Paginated receivables' })
  @ApiQuery({ name: 'customerId', required: false })
  @ApiQuery({ name: 'overdue', required: false, type: Boolean })
  getReceivables(
    @Query() pagination: PaginationDto,
    @Query('customerId') customerId: string,
    @Query('overdue') overdue: string,
    @CurrentUser() user: any,
  ) {
    const filters = {
      ...(customerId && { customerId }),
      ...(overdue && { overdue: overdue === 'true' }),
    };
    return this.salesService.getReceivables(
      user.organizationId,
      pagination,
      filters,
    );
  }

  @Post('orders/:id/payments')
  @ApiOperation({ summary: 'Record a payment for a sales order' })
  @ApiResponse({ status: 201, description: 'Payment recorded' })
  recordPayment(
    @Param('id') id: string,
    @Body() dto: RecordPaymentBodyDto,
  ) {
    return this.salesService.recordPayment(
      id,
      dto.amount,
      dto.paymentMethod,
      dto.reference,
    );
  }
}
