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

export interface CreateSupplierDto {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  taxId?: string;
  contactPerson?: string;
  paymentTerms?: string;
  organizationId: string;
}

export interface UpdateSupplierDto {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  taxId?: string;
  contactPerson?: string;
  paymentTerms?: string;
  isActive?: boolean;
}

export interface PurchaseOrderLineDto {
  productId: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxRate?: number;
}

export interface CreatePurchaseOrderDto {
  supplierId: string;
  orderDate?: Date;
  expectedDate?: Date;
  notes?: string;
  lines: PurchaseOrderLineDto[];
  organizationId: string;
  userId: string;
}

export interface UpdatePurchaseOrderDto {
  supplierId?: string;
  expectedDate?: Date;
  notes?: string;
  status?: string;
  lines?: PurchaseOrderLineDto[];
}

@Injectable()
export class PurchasesService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Supplier Management ─────────────────────────────────────────────

  async createSupplier(dto: CreateSupplierDto) {
    return this.prisma.supplier.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
        city: dto.city,
        country: dto.country,
        taxId: dto.taxId,
        contactPerson: dto.contactPerson,
        paymentTerms: dto.paymentTerms,
        organizationId: dto.organizationId,
      },
    });
  }

  async findAllSuppliers(
    organizationId: string,
    pagination: PaginationDto,
    search?: string,
  ): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const where: Prisma.SupplierWhereInput = {
      organizationId,
      isActive: true,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { contactPerson: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.supplier.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findSupplier(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier with ID ${id} not found`);
    }

    return supplier;
  }

  async updateSupplier(id: string, dto: UpdateSupplierDto) {
    await this.findSupplier(id);

    return this.prisma.supplier.update({
      where: { id },
      data: dto,
    });
  }

  async deleteSupplier(id: string) {
    await this.findSupplier(id);

    const orderCount = await this.prisma.purchaseOrder.count({
      where: { supplierId: id, status: { in: ['PENDING', 'CONFIRMED', 'ORDERED'] } },
    });

    if (orderCount > 0) {
      throw new BadRequestException(
        'Cannot delete supplier with active purchase orders',
      );
    }

    await this.prisma.supplier.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: `Supplier ${id} has been deactivated` };
  }

  // ── Purchase Orders ─────────────────────────────────────────────────

  private generateOrderNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `PO-${timestamp}-${random}`;
  }

  async createPurchaseOrder(dto: CreatePurchaseOrderDto) {
    if (!dto.lines || dto.lines.length === 0) {
      throw new BadRequestException(
        'Purchase order must have at least one line item',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const lines = dto.lines.map((line) => {
        const lineTotal = line.quantity * line.unitPrice;
        const discountAmount = lineTotal * ((line.discount ?? 0) / 100);
        const taxableAmount = lineTotal - discountAmount;
        const taxAmount = taxableAmount * ((line.taxRate ?? 0) / 100);
        const total = taxableAmount + taxAmount;

        return {
          productId: line.productId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          discount: line.discount ?? 0,
          taxRate: line.taxRate ?? 0,
          taxAmount,
          lineTotal: total,
        };
      });

      const subtotal = lines.reduce(
        (sum, l) =>
          sum + l.quantity * l.unitPrice - l.quantity * l.unitPrice * (l.discount / 100),
        0,
      );
      const totalTax = lines.reduce((sum, l) => sum + l.taxAmount, 0);
      const totalAmount = lines.reduce((sum, l) => sum + l.lineTotal, 0);

      const order = await tx.purchaseOrder.create({
        data: {
          orderNumber: this.generateOrderNumber(),
          supplierId: dto.supplierId,
          orderDate: dto.orderDate ?? new Date(),
          expectedDate: dto.expectedDate,
          notes: dto.notes,
          subtotal,
          taxAmount: totalTax,
          totalAmount,
          status: 'DRAFT',
          organizationId: dto.organizationId,
          userId: dto.userId,
          lines: {
            create: lines,
          },
        },
        include: {
          lines: {
            include: {
              product: { select: { id: true, name: true, sku: true } },
            },
          },
          supplier: true,
        },
      });

      return order;
    });
  }

  async findAllPurchaseOrders(
    organizationId: string,
    pagination: PaginationDto,
    filters?: {
      status?: string;
      supplierId?: string;
      startDate?: string;
      endDate?: string;
    },
  ): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const where: Prisma.PurchaseOrderWhereInput = {
      organizationId,
      ...(filters?.status && { status: filters.status }),
      ...(filters?.supplierId && { supplierId: filters.supplierId }),
      ...(filters?.startDate || filters?.endDate
        ? {
            orderDate: {
              ...(filters.startDate && { gte: new Date(filters.startDate) }),
              ...(filters.endDate && { lte: new Date(filters.endDate) }),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          supplier: { select: { id: true, name: true } },
          _count: { select: { lines: true } },
        },
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findPurchaseOrder(id: string) {
    const order = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        lines: {
          include: {
            product: { select: { id: true, name: true, sku: true, unit: true } },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Purchase order with ID ${id} not found`);
    }

    return order;
  }

  async updatePurchaseOrder(id: string, dto: UpdatePurchaseOrderDto) {
    const existing = await this.findPurchaseOrder(id);

    if (['RECEIVED', 'CANCELLED'].includes(existing.status)) {
      throw new BadRequestException(
        `Cannot update a ${existing.status.toLowerCase()} order`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.lines) {
        await tx.purchaseOrderLine.deleteMany({
          where: { purchaseOrderId: id },
        });

        const lines = dto.lines.map((line) => {
          const lineTotal = line.quantity * line.unitPrice;
          const discountAmount = lineTotal * ((line.discount ?? 0) / 100);
          const taxableAmount = lineTotal - discountAmount;
          const taxAmount = taxableAmount * ((line.taxRate ?? 0) / 100);
          const total = taxableAmount + taxAmount;

          return {
            purchaseOrderId: id,
            productId: line.productId,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            discount: line.discount ?? 0,
            taxRate: line.taxRate ?? 0,
            taxAmount,
            lineTotal: total,
          };
        });

        await tx.purchaseOrderLine.createMany({ data: lines });

        const subtotal = lines.reduce(
          (sum, l) =>
            sum + l.quantity * l.unitPrice - l.quantity * l.unitPrice * (l.discount / 100),
          0,
        );
        const totalTax = lines.reduce((sum, l) => sum + l.taxAmount, 0);
        const totalAmount = lines.reduce((sum, l) => sum + l.lineTotal, 0);

        return tx.purchaseOrder.update({
          where: { id },
          data: {
            supplierId: dto.supplierId,
            expectedDate: dto.expectedDate,
            notes: dto.notes,
            status: dto.status,
            subtotal,
            taxAmount: totalTax,
            totalAmount,
          },
          include: {
            lines: {
              include: {
                product: { select: { id: true, name: true, sku: true } },
              },
            },
            supplier: true,
          },
        });
      }

      return tx.purchaseOrder.update({
        where: { id },
        data: {
          supplierId: dto.supplierId,
          expectedDate: dto.expectedDate,
          notes: dto.notes,
          status: dto.status,
        },
        include: {
          lines: {
            include: {
              product: { select: { id: true, name: true, sku: true } },
            },
          },
          supplier: true,
        },
      });
    });
  }

  async confirmPurchaseOrder(id: string) {
    const order = await this.findPurchaseOrder(id);

    if (order.status !== 'DRAFT') {
      throw new BadRequestException('Only draft orders can be confirmed');
    }

    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'CONFIRMED' },
    });
  }

  async cancelPurchaseOrder(id: string) {
    const order = await this.findPurchaseOrder(id);

    if (order.status === 'CANCELLED') {
      throw new BadRequestException('Order is already cancelled');
    }

    if (order.status === 'RECEIVED') {
      throw new BadRequestException('Cannot cancel a received order');
    }

    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  async receivePurchaseOrder(id: string) {
    const order = await this.findPurchaseOrder(id);

    if (order.status !== 'CONFIRMED' && order.status !== 'ORDERED') {
      throw new BadRequestException(
        'Only confirmed or ordered purchase orders can be received',
      );
    }

    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'RECEIVED', receivedDate: new Date() },
    });
  }

  // ── Payables ────────────────────────────────────────────────────────

  async getPayables(
    organizationId: string,
    pagination: PaginationDto,
    filters?: { supplierId?: string; overdue?: boolean },
  ): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const now = new Date();
    const where: Prisma.PurchaseOrderWhereInput = {
      organizationId,
      status: { in: ['CONFIRMED', 'ORDERED', 'RECEIVED'] },
      paidAmount: { lt: this.prisma.purchaseOrder.fields?.totalAmount ?? 0 },
      ...(filters?.supplierId && { supplierId: filters.supplierId }),
      ...(filters?.overdue && { expectedDate: { lt: now } }),
    };

    const [data, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { expectedDate: 'asc' },
        include: {
          supplier: { select: { id: true, name: true } },
        },
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);

    const payables = data.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      supplier: order.supplier,
      totalAmount: order.totalAmount,
      paidAmount: order.paidAmount,
      balanceDue: Number(order.totalAmount) - Number(order.paidAmount),
      expectedDate: order.expectedDate,
      isOverdue: order.expectedDate ? order.expectedDate < now : false,
      daysOverdue: order.expectedDate
        ? Math.max(
            0,
            Math.floor(
              (now.getTime() - order.expectedDate.getTime()) / 86400000,
            ),
          )
        : 0,
    }));

    return {
      data: payables,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async recordPayment(
    orderId: string,
    amount: number,
    paymentMethod: string,
    reference?: string,
  ) {
    const order = await this.findPurchaseOrder(orderId);
    const balanceDue = Number(order.totalAmount) - Number(order.paidAmount);

    if (amount > balanceDue) {
      throw new BadRequestException(
        `Payment amount (${amount}) exceeds balance due (${balanceDue})`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          purchaseOrderId: orderId,
          amount,
          paymentMethod,
          reference,
          paymentDate: new Date(),
          organizationId: order.organizationId,
        },
      });

      const newPaidAmount = Number(order.paidAmount) + amount;

      await tx.purchaseOrder.update({
        where: { id: orderId },
        data: { paidAmount: newPaidAmount },
      });

      return payment;
    });
  }
}
