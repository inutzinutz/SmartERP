import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
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
  IsEnum,
  IsBoolean,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { InventoryService } from './inventory.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

class CreateWarehouseBodyDto {
  @IsString()
  name: string;

  @IsString()
  code: string;

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
  @IsBoolean()
  isActive?: boolean;
}

class UpdateWarehouseBodyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  code?: string;

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
  @IsBoolean()
  isActive?: boolean;
}

enum MovementType {
  IN = 'IN',
  OUT = 'OUT',
  TRANSFER = 'TRANSFER',
}

class StockMovementBodyDto {
  @IsString()
  productId: string;

  @IsString()
  warehouseId: string;

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  quantity: number;

  @IsEnum(MovementType)
  type: MovementType;

  @IsOptional()
  @IsString()
  referenceType?: string;

  @IsOptional()
  @IsString()
  referenceId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  destinationWarehouseId?: string;
}

class StockAdjustmentBodyDto {
  @IsString()
  productId: string;

  @IsString()
  warehouseId: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  newQuantity: number;

  @IsString()
  reason: string;
}

@ApiTags('Inventory')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  // ── Warehouses ────────────────────────────────────────────────────

  @Post('warehouses')
  @Roles('ADMIN', 'OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Create a new warehouse' })
  @ApiResponse({ status: 201, description: 'Warehouse created successfully' })
  createWarehouse(
    @Body() dto: CreateWarehouseBodyDto,
    @CurrentUser() user: any,
  ) {
    return this.inventoryService.createWarehouse({
      ...dto,
      organizationId: user.organizationId,
    });
  }

  @Get('warehouses')
  @ApiOperation({ summary: 'List all warehouses' })
  @ApiResponse({ status: 200, description: 'Paginated list of warehouses' })
  findAllWarehouses(
    @Query() pagination: PaginationDto,
    @CurrentUser() user: any,
  ) {
    return this.inventoryService.findAllWarehouses(
      user.organizationId,
      pagination,
    );
  }

  @Get('warehouses/:id')
  @ApiOperation({ summary: 'Get warehouse by ID' })
  @ApiResponse({ status: 200, description: 'Warehouse details' })
  findWarehouse(@Param('id') id: string) {
    return this.inventoryService.findWarehouse(id);
  }

  @Put('warehouses/:id')
  @Roles('ADMIN', 'OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Update a warehouse' })
  @ApiResponse({ status: 200, description: 'Warehouse updated' })
  updateWarehouse(
    @Param('id') id: string,
    @Body() dto: UpdateWarehouseBodyDto,
  ) {
    return this.inventoryService.updateWarehouse(id, dto);
  }

  @Delete('warehouses/:id')
  @Roles('ADMIN', 'OWNER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate a warehouse' })
  @ApiResponse({ status: 200, description: 'Warehouse deactivated' })
  deleteWarehouse(@Param('id') id: string) {
    return this.inventoryService.deleteWarehouse(id);
  }

  // ── Stock Levels ──────────────────────────────────────────────────

  @Get('stock')
  @ApiOperation({ summary: 'Get stock levels with optional filters' })
  @ApiResponse({ status: 200, description: 'Paginated stock levels' })
  @ApiQuery({ name: 'warehouseId', required: false })
  @ApiQuery({ name: 'productId', required: false })
  @ApiQuery({ name: 'lowStock', required: false, type: Boolean })
  getStockLevels(
    @Query() pagination: PaginationDto,
    @Query('warehouseId') warehouseId: string,
    @Query('productId') productId: string,
    @Query('lowStock') lowStock: string,
    @CurrentUser() user: any,
  ) {
    const filters = {
      ...(warehouseId && { warehouseId }),
      ...(productId && { productId }),
      ...(lowStock && { lowStock: lowStock === 'true' }),
    };
    return this.inventoryService.getStockLevels(
      user.organizationId,
      pagination,
      filters,
    );
  }

  @Get('stock/product/:productId')
  @ApiOperation({ summary: 'Get stock levels for a specific product across warehouses' })
  @ApiResponse({ status: 200, description: 'Product stock details per warehouse' })
  getProductStock(
    @Param('productId') productId: string,
    @CurrentUser() user: any,
  ) {
    return this.inventoryService.getProductStock(productId, user.organizationId);
  }

  @Get('stock/alerts')
  @ApiOperation({ summary: 'Get low stock alerts' })
  @ApiResponse({ status: 200, description: 'List of products below reorder level' })
  getLowStockAlerts(@CurrentUser() user: any) {
    return this.inventoryService.getLowStockAlerts(user.organizationId);
  }

  // ── Stock Movements ───────────────────────────────────────────────

  @Post('movements')
  @Roles('ADMIN', 'OWNER', 'MANAGER', 'WAREHOUSE_STAFF')
  @ApiOperation({ summary: 'Create a stock movement (IN, OUT, TRANSFER)' })
  @ApiResponse({ status: 201, description: 'Stock movement recorded' })
  createStockMovement(
    @Body() dto: StockMovementBodyDto,
    @CurrentUser() user: any,
  ) {
    return this.inventoryService.createStockMovement({
      ...dto,
      organizationId: user.organizationId,
      userId: user.id,
    });
  }

  @Get('movements')
  @ApiOperation({ summary: 'List stock movements with filters' })
  @ApiResponse({ status: 200, description: 'Paginated stock movements' })
  @ApiQuery({ name: 'productId', required: false })
  @ApiQuery({ name: 'warehouseId', required: false })
  @ApiQuery({ name: 'type', required: false, enum: ['IN', 'OUT', 'TRANSFER'] })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getStockMovements(
    @Query() pagination: PaginationDto,
    @Query('productId') productId: string,
    @Query('warehouseId') warehouseId: string,
    @Query('type') type: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @CurrentUser() user: any,
  ) {
    const filters = {
      ...(productId && { productId }),
      ...(warehouseId && { warehouseId }),
      ...(type && { type }),
      ...(startDate && { startDate }),
      ...(endDate && { endDate }),
    };
    return this.inventoryService.getStockMovements(
      user.organizationId,
      pagination,
      filters,
    );
  }

  // ── Stock Adjustments ─────────────────────────────────────────────

  @Post('adjustments')
  @Roles('ADMIN', 'OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Adjust stock quantity for a product in a warehouse' })
  @ApiResponse({ status: 201, description: 'Stock adjustment recorded' })
  adjustStock(@Body() dto: StockAdjustmentBodyDto, @CurrentUser() user: any) {
    return this.inventoryService.adjustStock({
      ...dto,
      organizationId: user.organizationId,
      userId: user.id,
    });
  }

  @Get('adjustments')
  @ApiOperation({ summary: 'List stock adjustments' })
  @ApiResponse({ status: 200, description: 'Paginated stock adjustments' })
  getStockAdjustments(
    @Query() pagination: PaginationDto,
    @CurrentUser() user: any,
  ) {
    return this.inventoryService.getStockAdjustments(
      user.organizationId,
      pagination,
    );
  }
}
