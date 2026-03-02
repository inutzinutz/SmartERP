import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { DashboardService } from './dashboard.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('kpis')
  @ApiOperation({ summary: 'Get key performance indicators' })
  @ApiResponse({ status: 200, description: 'KPI summary for the organization' })
  getKpis(@CurrentUser() user: any) {
    return this.dashboardService.getKpis(user.organizationId);
  }

  @Get('sales-analytics')
  @ApiOperation({ summary: 'Get sales analytics with trends and top performers' })
  @ApiResponse({ status: 200, description: 'Sales analytics data' })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['daily', 'weekly', 'monthly'],
    description: 'Aggregation period',
  })
  @ApiQuery({
    name: 'months',
    required: false,
    type: Number,
    description: 'Number of months to look back (default: 12)',
  })
  getSalesAnalytics(
    @Query('period') period: 'daily' | 'weekly' | 'monthly',
    @Query('months') months: string,
    @CurrentUser() user: any,
  ) {
    return this.dashboardService.getSalesAnalytics(
      user.organizationId,
      period || 'monthly',
      months ? parseInt(months, 10) : 12,
    );
  }

  @Get('inventory-summary')
  @ApiOperation({ summary: 'Get inventory summary with warehouse breakdown' })
  @ApiResponse({ status: 200, description: 'Inventory summary data' })
  getInventorySummary(@CurrentUser() user: any) {
    return this.dashboardService.getInventorySummary(user.organizationId);
  }

  @Get('financial-overview')
  @ApiOperation({ summary: 'Get financial overview with monthly breakdown' })
  @ApiResponse({ status: 200, description: 'Financial overview data' })
  @ApiQuery({
    name: 'year',
    required: false,
    type: Number,
    description: 'Fiscal year (default: current year)',
  })
  getFinancialOverview(
    @Query('year') year: string,
    @CurrentUser() user: any,
  ) {
    return this.dashboardService.getFinancialOverview(
      user.organizationId,
      year ? parseInt(year, 10) : undefined,
    );
  }
}
