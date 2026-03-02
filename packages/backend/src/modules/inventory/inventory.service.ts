import {
  Injectable,
  NotFoundException,
  BadRequestException,
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

export interface CreateWarehouseDto {
  name: string;
  code: string;
  address?: string;
  city?: string;
  country?: string;
  isActive?: boolean;
  organizationId: string;
}

export interface UpdateWarehouseDto {
  name?: string;
  code?: string;
  address?: string;
  city?: string;
  country?: string;
  isActive?: boolean;
}

export interface StockMovementDto {
  productId: string;
  warehouseId: string;
  quantity: number;
  type: 'IN' | 'OUT' | 'TRANSFER';
  referenceType?: string;
  referenceId?: string;
  notes?: string;
  destinationWarehouseId?: string;
  organizationId: string;
  userId: string;
}

export interface StockAdjustmentDto {
  productId: string;
  warehouseId: string;
  newQuantity: number;
  reason: string;
  organizationId: string;
  userId: string;
}

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Warehouse Management ────────────────────────────────────────────

  async createWarehouse(dto: CreateWarehouseDto) {
    const existing = await this.prisma.warehouse.findFirst({
      where: { code: dto.code, organizationId: dto.organizationId },
    });

    if (existing) {
      throw new BadRequestException(`Warehouse with code '${dto.code}' already exists`);
    }

    return this.prisma.warehouse.create({
      data: {
        name: dto.name,
        code: dto.code,
        address: dto.address,
        city: dto.city,
        country: dto.country,
        isActive: dto.isActive ?? true,
        organizationId: dto.organizationId,
      },
    });
  }

  async findAllWarehouses(
    organizationId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const where: Prisma.WarehouseWhereInput = { organizationId };

    const [data, total] = await Promise.all([
      this.prisma.warehouse.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.warehouse.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findWarehouse(id: string) {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id },
    });

    if (!warehouse) {
      throw new NotFoundException(`Warehouse with ID ${id} not found`);
    }

    return warehouse;
  }

  async updateWarehouse(id: string, dto: UpdateWarehouseDto) {
    await this.findWarehouse(id);

    return this.prisma.warehouse.update({
      where: { id },
      data: dto,
    });
  }

  async deleteWarehouse(id: string) {
    await this.findWarehouse(id);

    const stockCount = await this.prisma.stock.count({
      where: { warehouseId: id, quantity: { gt: 0 } },
    });

    if (stockCount > 0) {
      throw new BadRequestException(
        'Cannot delete warehouse with existing stock. Transfer or adjust stock first.',
      );
    }

    await this.prisma.warehouse.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: `Warehouse ${id} has been deactivated` };
  }

  // ── Stock Management ────────────────────────────────────────────────

  async getStockLevels(
    organizationId: string,
    pagination: PaginationDto,
    filters?: { warehouseId?: string; productId?: string; lowStock?: boolean },
  ): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const where: Prisma.StockWhereInput = {
      organizationId,
      ...(filters?.warehouseId && { warehouseId: filters.warehouseId }),
      ...(filters?.productId && { productId: filters.productId }),
      ...(filters?.lowStock && {
        quantity: { lte: this.prisma.stock.fields?.reorderLevel ?? 0 },
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.stock.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          product: { select: { id: true, name: true, sku: true, unit: true } },
          warehouse: { select: { id: true, name: true, code: true } },
        },
      }),
      this.prisma.stock.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getProductStock(productId: string, organizationId: string) {
    const stocks = await this.prisma.stock.findMany({
      where: { productId, organizationId },
      include: {
        warehouse: { select: { id: true, name: true, code: true } },
      },
    });

    const totalQuantity = stocks.reduce((sum, s) => sum + s.quantity, 0);

    return {
      productId,
      totalQuantity,
      warehouses: stocks.map((s) => ({
        warehouseId: s.warehouseId,
        warehouseName: s.warehouse.name,
        warehouseCode: s.warehouse.code,
        quantity: s.quantity,
        reorderLevel: s.reorderLevel,
      })),
    };
  }

  // ── Stock Movements ─────────────────────────────────────────────────

  async createStockMovement(dto: StockMovementDto) {
    return this.prisma.$transaction(async (tx) => {
      if (dto.type === 'OUT' || dto.type === 'TRANSFER') {
        const stock = await tx.stock.findFirst({
          where: {
            productId: dto.productId,
            warehouseId: dto.warehouseId,
            organizationId: dto.organizationId,
          },
        });

        if (!stock || stock.quantity < dto.quantity) {
          throw new BadRequestException(
            `Insufficient stock. Available: ${stock?.quantity ?? 0}, Requested: ${dto.quantity}`,
          );
        }
      }

      const movement = await tx.stockMovement.create({
        data: {
          productId: dto.productId,
          warehouseId: dto.warehouseId,
          quantity: dto.quantity,
          type: dto.type,
          referenceType: dto.referenceType,
          referenceId: dto.referenceId,
          notes: dto.notes,
          destinationWarehouseId: dto.destinationWarehouseId,
          organizationId: dto.organizationId,
          userId: dto.userId,
        },
      });

      if (dto.type === 'IN') {
        await tx.stock.upsert({
          where: {
            productId_warehouseId: {
              productId: dto.productId,
              warehouseId: dto.warehouseId,
            },
          },
          create: {
            productId: dto.productId,
            warehouseId: dto.warehouseId,
            quantity: dto.quantity,
            organizationId: dto.organizationId,
          },
          update: {
            quantity: { increment: dto.quantity },
          },
        });
      } else if (dto.type === 'OUT') {
        await tx.stock.update({
          where: {
            productId_warehouseId: {
              productId: dto.productId,
              warehouseId: dto.warehouseId,
            },
          },
          data: {
            quantity: { decrement: dto.quantity },
          },
        });
      } else if (dto.type === 'TRANSFER') {
        if (!dto.destinationWarehouseId) {
          throw new BadRequestException(
            'destinationWarehouseId is required for transfer movements',
          );
        }

        await tx.stock.update({
          where: {
            productId_warehouseId: {
              productId: dto.productId,
              warehouseId: dto.warehouseId,
            },
          },
          data: {
            quantity: { decrement: dto.quantity },
          },
        });

        await tx.stock.upsert({
          where: {
            productId_warehouseId: {
              productId: dto.productId,
              warehouseId: dto.destinationWarehouseId,
            },
          },
          create: {
            productId: dto.productId,
            warehouseId: dto.destinationWarehouseId,
            quantity: dto.quantity,
            organizationId: dto.organizationId,
          },
          update: {
            quantity: { increment: dto.quantity },
          },
        });
      }

      return movement;
    });
  }

  async getStockMovements(
    organizationId: string,
    pagination: PaginationDto,
    filters?: {
      productId?: string;
      warehouseId?: string;
      type?: string;
      startDate?: string;
      endDate?: string;
    },
  ): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const where: Prisma.StockMovementWhereInput = {
      organizationId,
      ...(filters?.productId && { productId: filters.productId }),
      ...(filters?.warehouseId && { warehouseId: filters.warehouseId }),
      ...(filters?.type && { type: filters.type }),
      ...(filters?.startDate || filters?.endDate
        ? {
            createdAt: {
              ...(filters.startDate && { gte: new Date(filters.startDate) }),
              ...(filters.endDate && { lte: new Date(filters.endDate) }),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          product: { select: { id: true, name: true, sku: true } },
          warehouse: { select: { id: true, name: true, code: true } },
        },
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ── Stock Adjustments ───────────────────────────────────────────────

  async adjustStock(dto: StockAdjustmentDto) {
    return this.prisma.$transaction(async (tx) => {
      const currentStock = await tx.stock.findFirst({
        where: {
          productId: dto.productId,
          warehouseId: dto.warehouseId,
          organizationId: dto.organizationId,
        },
      });

      const currentQuantity = currentStock?.quantity ?? 0;
      const difference = dto.newQuantity - currentQuantity;

      const adjustment = await tx.stockAdjustment.create({
        data: {
          productId: dto.productId,
          warehouseId: dto.warehouseId,
          previousQuantity: currentQuantity,
          newQuantity: dto.newQuantity,
          difference,
          reason: dto.reason,
          organizationId: dto.organizationId,
          userId: dto.userId,
        },
      });

      await tx.stock.upsert({
        where: {
          productId_warehouseId: {
            productId: dto.productId,
            warehouseId: dto.warehouseId,
          },
        },
        create: {
          productId: dto.productId,
          warehouseId: dto.warehouseId,
          quantity: dto.newQuantity,
          organizationId: dto.organizationId,
        },
        update: {
          quantity: dto.newQuantity,
        },
      });

      await tx.stockMovement.create({
        data: {
          productId: dto.productId,
          warehouseId: dto.warehouseId,
          quantity: Math.abs(difference),
          type: difference >= 0 ? 'IN' : 'OUT',
          referenceType: 'ADJUSTMENT',
          referenceId: adjustment.id,
          notes: `Stock adjustment: ${dto.reason}`,
          organizationId: dto.organizationId,
          userId: dto.userId,
        },
      });

      return adjustment;
    });
  }

  async getStockAdjustments(
    organizationId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const where: Prisma.StockAdjustmentWhereInput = { organizationId };

    const [data, total] = await Promise.all([
      this.prisma.stockAdjustment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          product: { select: { id: true, name: true, sku: true } },
          warehouse: { select: { id: true, name: true, code: true } },
        },
      }),
      this.prisma.stockAdjustment.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ── Utility ─────────────────────────────────────────────────────────

  async getLowStockAlerts(organizationId: string) {
    const lowStockItems = await this.prisma.$queryRaw`
      SELECT s."productId", p.name, p.sku, s."warehouseId", w.name as "warehouseName",
             s.quantity, s."reorderLevel"
      FROM "Stock" s
      JOIN "Product" p ON p.id = s."productId"
      JOIN "Warehouse" w ON w.id = s."warehouseId"
      WHERE s."organizationId" = ${organizationId}
        AND s.quantity <= s."reorderLevel"
        AND s."reorderLevel" > 0
      ORDER BY (s.quantity::float / NULLIF(s."reorderLevel", 0)) ASC
    `;

    return lowStockItems;
  }
}
