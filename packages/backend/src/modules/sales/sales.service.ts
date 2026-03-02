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

export interface CreateCustomerDto {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  taxId?: string;
  organizationId: string;
}

export interface UpdateCustomerDto {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  taxId?: string;
  isActive?: boolean;
}

export interface SalesOrderLineDto {
  productId: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxRate?: number;
}

export interface CreateSalesOrderDto {
  customerId: string;
  orderDate?: Date;
  dueDate?: Date;
  notes?: string;
  lines: SalesOrderLineDto[];
  organizationId: string;
  userId: string;
}

export interface UpdateSalesOrderDto {
  customerId?: string;
  dueDate?: Date;
  notes?: string;
  status?: string;
  lines?: SalesOrderLineDto[];
}

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Customer Management ─────────────────────────────────────────────

  async createCustomer(dto: CreateCustomerDto) {
    return this.prisma.customer.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
        city: dto.city,
        country: dto.country,
        taxId: dto.taxId,
        organizationId: dto.organizationId,
      },
    });
  }

  async findAllCustomers(
    organizationId: string,
    pagination: PaginationDto,
    search?: string,
  ): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const where: Prisma.CustomerWhereInput = {
      organizationId,
      isActive: true,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findCustomer(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }

    return customer;
  }

  async updateCustomer(id: string, dto: UpdateCustomerDto) {
    await this.findCustomer(id);

    return this.prisma.customer.update({
      where: { id },
      data: dto,
    });
  }

  async deleteCustomer(id: string) {
    await this.findCustomer(id);

    const orderCount = await this.prisma.salesOrder.count({
      where: { customerId: id, status: { in: ['PENDING', 'CONFIRMED'] } },
    });

    if (orderCount > 0) {
      throw new BadRequestException(
        'Cannot delete customer with active orders. Cancel or complete orders first.',
      );
    }

    await this.prisma.customer.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: `Customer ${id} has been deactivated` };
  }

  // ── Sales Orders ────────────────────────────────────────────────────

  private generateOrderNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `SO-${timestamp}-${random}`;
  }

  async createSalesOrder(dto: CreateSalesOrderDto) {
    if (!dto.lines || dto.lines.length === 0) {
      throw new BadRequestException('Sales order must have at least one line item');
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
        (sum, l) => sum + l.quantity * l.unitPrice - l.quantity * l.unitPrice * (l.discount / 100),
        0,
      );
      const totalTax = lines.reduce((sum, l) => sum + l.taxAmount, 0);
      const totalAmount = lines.reduce((sum, l) => sum + l.lineTotal, 0);

      const order = await tx.salesOrder.create({
        data: {
          orderNumber: this.generateOrderNumber(),
          customerId: dto.customerId,
          orderDate: dto.orderDate ?? new Date(),
          dueDate: dto.dueDate,
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
          customer: true,
        },
      });

      return order;
    });
  }

  async findAllSalesOrders(
    organizationId: string,
    pagination: PaginationDto,
    filters?: {
      status?: string;
      customerId?: string;
      startDate?: string;
      endDate?: string;
    },
  ): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const where: Prisma.SalesOrderWhereInput = {
      organizationId,
      ...(filters?.status && { status: filters.status }),
      ...(filters?.customerId && { customerId: filters.customerId }),
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
      this.prisma.salesOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, name: true } },
          _count: { select: { lines: true } },
        },
      }),
      this.prisma.salesOrder.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findSalesOrder(id: string) {
    const order = await this.prisma.salesOrder.findUnique({
      where: { id },
      include: {
        customer: true,
        lines: {
          include: {
            product: { select: { id: true, name: true, sku: true, unit: true } },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Sales order with ID ${id} not found`);
    }

    return order;
  }

  async updateSalesOrder(id: string, dto: UpdateSalesOrderDto) {
    const existing = await this.findSalesOrder(id);

    if (['COMPLETED', 'CANCELLED'].includes(existing.status)) {
      throw new BadRequestException(
        `Cannot update a ${existing.status.toLowerCase()} order`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.lines) {
        await tx.salesOrderLine.deleteMany({
          where: { salesOrderId: id },
        });

        const lines = dto.lines.map((line) => {
          const lineTotal = line.quantity * line.unitPrice;
          const discountAmount = lineTotal * ((line.discount ?? 0) / 100);
          const taxableAmount = lineTotal - discountAmount;
          const taxAmount = taxableAmount * ((line.taxRate ?? 0) / 100);
          const total = taxableAmount + taxAmount;

          return {
            salesOrderId: id,
            productId: line.productId,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            discount: line.discount ?? 0,
            taxRate: line.taxRate ?? 0,
            taxAmount,
            lineTotal: total,
          };
        });

        await tx.salesOrderLine.createMany({ data: lines });

        const subtotal = lines.reduce(
          (sum, l) =>
            sum + l.quantity * l.unitPrice - l.quantity * l.unitPrice * (l.discount / 100),
          0,
        );
        const totalTax = lines.reduce((sum, l) => sum + l.taxAmount, 0);
        const totalAmount = lines.reduce((sum, l) => sum + l.lineTotal, 0);

        return tx.salesOrder.update({
          where: { id },
          data: {
            customerId: dto.customerId,
            dueDate: dto.dueDate,
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
            customer: true,
          },
        });
      }

      return tx.salesOrder.update({
        where: { id },
        data: {
          customerId: dto.customerId,
          dueDate: dto.dueDate,
          notes: dto.notes,
          status: dto.status,
        },
        include: {
          lines: {
            include: {
              product: { select: { id: true, name: true, sku: true } },
            },
          },
          customer: true,
        },
      });
    });
  }

  async cancelSalesOrder(id: string) {
    const order = await this.findSalesOrder(id);

    if (order.status === 'CANCELLED') {
      throw new BadRequestException('Order is already cancelled');
    }

    if (order.status === 'COMPLETED') {
      throw new BadRequestException('Cannot cancel a completed order');
    }

    return this.prisma.salesOrder.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  async confirmSalesOrder(id: string) {
    const order = await this.findSalesOrder(id);

    if (order.status !== 'DRAFT') {
      throw new BadRequestException('Only draft orders can be confirmed');
    }

    return this.prisma.salesOrder.update({
      where: { id },
      data: { status: 'CONFIRMED' },
    });
  }

  // ── Receivables ─────────────────────────────────────────────────────

  async getReceivables(
    organizationId: string,
    pagination: PaginationDto,
    filters?: { customerId?: string; overdue?: boolean },
  ): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const now = new Date();
    const where: Prisma.SalesOrderWhereInput = {
      organizationId,
      status: { in: ['CONFIRMED', 'INVOICED'] },
      paidAmount: { lt: this.prisma.salesOrder.fields?.totalAmount ?? 0 },
      ...(filters?.customerId && { customerId: filters.customerId }),
      ...(filters?.overdue && { dueDate: { lt: now } }),
    };

    const [data, total] = await Promise.all([
      this.prisma.salesOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dueDate: 'asc' },
        include: {
          customer: { select: { id: true, name: true } },
        },
      }),
      this.prisma.salesOrder.count({ where }),
    ]);

    const receivables = data.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customer: order.customer,
      totalAmount: order.totalAmount,
      paidAmount: order.paidAmount,
      balanceDue: Number(order.totalAmount) - Number(order.paidAmount),
      dueDate: order.dueDate,
      isOverdue: order.dueDate ? order.dueDate < now : false,
      daysOverdue: order.dueDate
        ? Math.max(0, Math.floor((now.getTime() - order.dueDate.getTime()) / 86400000))
        : 0,
    }));

    return {
      data: receivables,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async recordPayment(
    orderId: string,
    amount: number,
    paymentMethod: string,
    reference?: string,
  ) {
    const order = await this.findSalesOrder(orderId);
    const balanceDue = Number(order.totalAmount) - Number(order.paidAmount);

    if (amount > balanceDue) {
      throw new BadRequestException(
        `Payment amount (${amount}) exceeds balance due (${balanceDue})`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          salesOrderId: orderId,
          amount,
          paymentMethod,
          reference,
          paymentDate: new Date(),
          organizationId: order.organizationId,
        },
      });

      const newPaidAmount = Number(order.paidAmount) + amount;
      const newStatus =
        newPaidAmount >= Number(order.totalAmount) ? 'COMPLETED' : order.status;

      await tx.salesOrder.update({
        where: { id: orderId },
        data: {
          paidAmount: newPaidAmount,
          status: newStatus,
        },
      });

      return payment;
    });
  }
}
