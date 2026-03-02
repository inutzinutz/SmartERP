import {
  Injectable,
  NotFoundException,
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

export interface CreateProductDto {
  name: string;
  sku: string;
  description?: string;
  categoryId?: string;
  unitPrice: number;
  costPrice?: number;
  unit?: string;
  taxRate?: number;
  isActive?: boolean;
  organizationId: string;
}

export interface UpdateProductDto {
  name?: string;
  sku?: string;
  description?: string;
  categoryId?: string;
  unitPrice?: number;
  costPrice?: number;
  unit?: string;
  taxRate?: number;
  isActive?: boolean;
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProductDto) {
    const existingSku = await this.prisma.product.findFirst({
      where: {
        sku: dto.sku,
        organizationId: dto.organizationId,
      },
    });

    if (existingSku) {
      throw new ConflictException(`Product with SKU '${dto.sku}' already exists`);
    }

    return this.prisma.product.create({
      data: {
        name: dto.name,
        sku: dto.sku,
        description: dto.description,
        categoryId: dto.categoryId,
        unitPrice: dto.unitPrice,
        costPrice: dto.costPrice ?? 0,
        unit: dto.unit ?? 'pcs',
        taxRate: dto.taxRate ?? 0,
        isActive: dto.isActive ?? true,
        organizationId: dto.organizationId,
      },
      include: {
        category: true,
      },
    });
  }

  async findAll(
    pagination: PaginationDto,
    organizationId: string,
    filters?: { categoryId?: string; isActive?: boolean },
  ): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {
      organizationId,
      ...(filters?.categoryId && { categoryId: filters.categoryId }),
      ...(filters?.isActive !== undefined && { isActive: filters.isActive }),
    };

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          category: true,
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async search(
    query: string,
    organizationId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {
      organizationId,
      isActive: true,
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { sku: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
      ],
    };

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          category: true,
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findByCategory(
    categoryId: string,
    organizationId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {
      organizationId,
      categoryId,
      isActive: true,
    };

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: { category: true },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    return product;
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id);

    return this.prisma.product.update({
      where: { id },
      data: dto,
      include: {
        category: true,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    await this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: `Product ${id} has been deactivated` };
  }
}
