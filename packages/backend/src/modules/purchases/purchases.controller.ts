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
import { PurchasesService } from './purchases.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

class CreateSupplierBodyDto {
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

  @IsOptional()
  @IsString()
  contactPerson?: string;

  @IsOptional()
  @IsString()
  paymentTerms?: string;
}

class UpdateSupplierBodyDto {
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

  @IsOptional()
  @IsString()
  contactPerson?: string;

  @IsOptional()
  @IsString()
  paymentTerms?: string;
}

class PurchaseOrderLineBodyDto {
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

class CreatePurchaseOrderBodyDto {
  @IsString()
  supplierId: string;

  @IsOptional()
  @IsDateString()
  orderDate?: string;

  @IsOptional()
  @IsDateString()
  expectedDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderLineBodyDto)
  lines: PurchaseOrderLineBodyDto[];
}

class UpdatePurchaseOrderBodyDto {
  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsDateString()
  expectedDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderLineBodyDto)
  lines?: PurchaseOrderLineBodyDto[];
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

@ApiTags('Purchases')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  // ── Suppliers ─────────────────────────────────────────────────────

  @Post('suppliers')
  @Roles('ADMIN', 'OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Create a new supplier' })
  @ApiResponse({ status: 201, description: 'Supplier created' })
  createSupplier(
    @Body() dto: CreateSupplierBodyDto,
    @CurrentUser() user: any,
  ) {
    return this.purchasesService.createSupplier({
      ...dto,
      organizationId: user.organizationId,
    });
  }

  @Get('suppliers')
  @ApiOperation({ summary: 'List suppliers' })
  @ApiResponse({ status: 200, description: 'Paginated supplier list' })
  @ApiQuery({ name: 'search', required: false })
  findAllSuppliers(
    @Query() pagination: PaginationDto,
    @Query('search') search: string,
    @CurrentUser() user: any,
  ) {
    return this.purchasesService.findAllSuppliers(
      user.organizationId,
      pagination,
      search,
    );
  }

  @Get('suppliers/:id')
  @ApiOperation({ summary: 'Get supplier by ID' })
  @ApiResponse({ status: 200, description: 'Supplier details' })
  findSupplier(@Param('id') id: string) {
    return this.purchasesService.findSupplier(id);
  }

  @Put('suppliers/:id')
  @Roles('ADMIN', 'OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Update a supplier' })
  @ApiResponse({ status: 200, description: 'Supplier updated' })
  updateSupplier(
    @Param('id') id: string,
    @Body() dto: UpdateSupplierBodyDto,
  ) {
    return this.purchasesService.updateSupplier(id, dto);
  }

  @Delete('suppliers/:id')
  @Roles('ADMIN', 'OWNER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate a supplier' })
  @ApiResponse({ status: 200, description: 'Supplier deactivated' })
  deleteSupplier(@Param('id') id: string) {
    return this.purchasesService.deleteSupplier(id);
  }

  // ── Purchase Orders ───────────────────────────────────────────────

  @Post('orders')
  @Roles('ADMIN', 'OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Create a new purchase order' })
  @ApiResponse({ status: 201, description: 'Purchase order created' })
  createPurchaseOrder(
    @Body() dto: CreatePurchaseOrderBodyDto,
    @CurrentUser() user: any,
  ) {
    return this.purchasesService.createPurchaseOrder({
      ...dto,
      orderDate: dto.orderDate ? new Date(dto.orderDate) : undefined,
      expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : undefined,
      organizationId: user.organizationId,
      userId: user.id,
    });
  }

  @Get('orders')
  @ApiOperation({ summary: 'List purchase orders' })
  @ApiResponse({ status: 200, description: 'Paginated purchase orders' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'supplierId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  findAllPurchaseOrders(
    @Query() pagination: PaginationDto,
    @Query('status') status: string,
    @Query('supplierId') supplierId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @CurrentUser() user: any,
  ) {
    const filters = {
      ...(status && { status }),
      ...(supplierId && { supplierId }),
      ...(startDate && { startDate }),
      ...(endDate && { endDate }),
    };
    return this.purchasesService.findAllPurchaseOrders(
      user.organizationId,
      pagination,
      filters,
    );
  }

  @Get('orders/:id')
  @ApiOperation({ summary: 'Get purchase order by ID' })
  @ApiResponse({ status: 200, description: 'Purchase order details' })
  findPurchaseOrder(@Param('id') id: string) {
    return this.purchasesService.findPurchaseOrder(id);
  }

  @Put('orders/:id')
  @Roles('ADMIN', 'OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Update a purchase order' })
  @ApiResponse({ status: 200, description: 'Purchase order updated' })
  updatePurchaseOrder(
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseOrderBodyDto,
  ) {
    return this.purchasesService.updatePurchaseOrder(id, {
      ...dto,
      expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : undefined,
    });
  }

  @Patch('orders/:id/confirm')
  @Roles('ADMIN', 'OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Confirm a draft purchase order' })
  @ApiResponse({ status: 200, description: 'Order confirmed' })
  confirmPurchaseOrder(@Param('id') id: string) {
    return this.purchasesService.confirmPurchaseOrder(id);
  }

  @Patch('orders/:id/receive')
  @Roles('ADMIN', 'OWNER', 'MANAGER', 'WAREHOUSE_STAFF')
  @ApiOperation({ summary: 'Mark a purchase order as received' })
  @ApiResponse({ status: 200, description: 'Order marked as received' })
  receivePurchaseOrder(@Param('id') id: string) {
    return this.purchasesService.receivePurchaseOrder(id);
  }

  @Patch('orders/:id/cancel')
  @Roles('ADMIN', 'OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Cancel a purchase order' })
  @ApiResponse({ status: 200, description: 'Order cancelled' })
  cancelPurchaseOrder(@Param('id') id: string) {
    return this.purchasesService.cancelPurchaseOrder(id);
  }

  // ── Payables ──────────────────────────────────────────────────────

  @Get('payables')
  @ApiOperation({ summary: 'List accounts payable' })
  @ApiResponse({ status: 200, description: 'Paginated payables' })
  @ApiQuery({ name: 'supplierId', required: false })
  @ApiQuery({ name: 'overdue', required: false, type: Boolean })
  getPayables(
    @Query() pagination: PaginationDto,
    @Query('supplierId') supplierId: string,
    @Query('overdue') overdue: string,
    @CurrentUser() user: any,
  ) {
    const filters = {
      ...(supplierId && { supplierId }),
      ...(overdue && { overdue: overdue === 'true' }),
    };
    return this.purchasesService.getPayables(
      user.organizationId,
      pagination,
      filters,
    );
  }

  @Post('orders/:id/payments')
  @Roles('ADMIN', 'OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Record a payment for a purchase order' })
  @ApiResponse({ status: 201, description: 'Payment recorded' })
  recordPayment(
    @Param('id') id: string,
    @Body() dto: RecordPaymentBodyDto,
  ) {
    return this.purchasesService.recordPayment(
      id,
      dto.amount,
      dto.paymentMethod,
      dto.reference,
    );
  }
}
