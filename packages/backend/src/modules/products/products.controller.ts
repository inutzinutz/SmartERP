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
  IsBoolean,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProductsService } from './products.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

class CreateProductBodyDto {
  @IsString()
  name: string;

  @IsString()
  sku: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  unitPrice: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  costPrice?: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  taxRate?: number;
}

class UpdateProductBodyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  unitPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  costPrice?: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  taxRate?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@ApiTags('Products')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @Roles('ADMIN', 'OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Create a new product' })
  @ApiResponse({ status: 201, description: 'Product created successfully' })
  create(@Body() dto: CreateProductBodyDto, @CurrentUser() user: any) {
    return this.productsService.create({
      ...dto,
      organizationId: user.organizationId,
    });
  }

  @Get()
  @ApiOperation({ summary: 'List all products with optional filters' })
  @ApiResponse({ status: 200, description: 'Paginated list of products' })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  findAll(
    @Query() pagination: PaginationDto,
    @Query('categoryId') categoryId: string,
    @Query('isActive') isActive: string,
    @CurrentUser() user: any,
  ) {
    const filters = {
      ...(categoryId && { categoryId }),
      ...(isActive !== undefined && { isActive: isActive === 'true' }),
    };
    return this.productsService.findAll(pagination, user.organizationId, filters);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search products by name, SKU, or description' })
  @ApiResponse({ status: 200, description: 'Search results' })
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  search(
    @Query('q') query: string,
    @Query() pagination: PaginationDto,
    @CurrentUser() user: any,
  ) {
    return this.productsService.search(query || '', user.organizationId, pagination);
  }

  @Get('category/:categoryId')
  @ApiOperation({ summary: 'List products by category' })
  @ApiResponse({ status: 200, description: 'Products in the specified category' })
  findByCategory(
    @Param('categoryId') categoryId: string,
    @Query() pagination: PaginationDto,
    @CurrentUser() user: any,
  ) {
    return this.productsService.findByCategory(
      categoryId,
      user.organizationId,
      pagination,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get product by ID' })
  @ApiResponse({ status: 200, description: 'Product details' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Put(':id')
  @Roles('ADMIN', 'OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Update a product' })
  @ApiResponse({ status: 200, description: 'Product updated successfully' })
  update(@Param('id') id: string, @Body() dto: UpdateProductBodyDto) {
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'OWNER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate a product (soft delete)' })
  @ApiResponse({ status: 200, description: 'Product deactivated' })
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}
