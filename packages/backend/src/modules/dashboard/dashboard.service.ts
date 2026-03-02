import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getKpis(organizationId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const [
      totalCustomers,
      totalSuppliers,
      totalProducts,
      activeUsers,
      currentMonthSales,
      lastMonthSales,
      currentMonthPurchases,
      lastMonthPurchases,
      pendingReceivables,
      pendingPayables,
      pendingExpenses,
    ] = await Promise.all([
      this.prisma.customer.count({
        where: { organizationId, isActive: true },
      }),
      this.prisma.supplier.count({
        where: { organizationId, isActive: true },
      }),
      this.prisma.product.count({
        where: { organizationId, isActive: true },
      }),
      this.prisma.user.count({
        where: { organizationId, isActive: true },
      }),
      this.prisma.salesOrder.aggregate({
        where: {
          organizationId,
          status: { notIn: ['CANCELLED', 'DRAFT'] },
          orderDate: { gte: startOfMonth },
        },
        _sum: { totalAmount: true },
        _count: true,
      }),
      this.prisma.salesOrder.aggregate({
        where: {
          organizationId,
          status: { notIn: ['CANCELLED', 'DRAFT'] },
          orderDate: { gte: startOfLastMonth, lte: endOfLastMonth },
        },
        _sum: { totalAmount: true },
        _count: true,
      }),
      this.prisma.purchaseOrder.aggregate({
        where: {
          organizationId,
          status: { notIn: ['CANCELLED', 'DRAFT'] },
          orderDate: { gte: startOfMonth },
        },
        _sum: { totalAmount: true },
        _count: true,
      }),
      this.prisma.purchaseOrder.aggregate({
        where: {
          organizationId,
          status: { notIn: ['CANCELLED', 'DRAFT'] },
          orderDate: { gte: startOfLastMonth, lte: endOfLastMonth },
        },
        _sum: { totalAmount: true },
        _count: true,
      }),
      this.prisma.salesOrder.aggregate({
        where: {
          organizationId,
          status: { in: ['CONFIRMED', 'INVOICED'] },
        },
        _sum: { totalAmount: true },
        _count: true,
      }),
      this.prisma.purchaseOrder.aggregate({
        where: {
          organizationId,
          status: { in: ['CONFIRMED', 'ORDERED', 'RECEIVED'] },
        },
        _sum: { totalAmount: true },
        _count: true,
      }),
      this.prisma.expenseClaim.aggregate({
        where: {
          organizationId,
          status: 'SUBMITTED',
        },
        _sum: { totalAmount: true },
        _count: true,
      }),
    ]);

    const currentSalesTotal = Number(currentMonthSales._sum.totalAmount ?? 0);
    const lastSalesTotal = Number(lastMonthSales._sum.totalAmount ?? 0);
    const salesGrowth =
      lastSalesTotal > 0
        ? ((currentSalesTotal - lastSalesTotal) / lastSalesTotal) * 100
        : currentSalesTotal > 0
          ? 100
          : 0;

    const currentPurchasesTotal = Number(currentMonthPurchases._sum.totalAmount ?? 0);
    const lastPurchasesTotal = Number(lastMonthPurchases._sum.totalAmount ?? 0);
    const purchasesGrowth =
      lastPurchasesTotal > 0
        ? ((currentPurchasesTotal - lastPurchasesTotal) / lastPurchasesTotal) * 100
        : currentPurchasesTotal > 0
          ? 100
          : 0;

    return {
      overview: {
        totalCustomers,
        totalSuppliers,
        totalProducts,
        activeUsers,
      },
      sales: {
        currentMonth: {
          total: currentSalesTotal,
          count: currentMonthSales._count,
        },
        lastMonth: {
          total: lastSalesTotal,
          count: lastMonthSales._count,
        },
        growthPercentage: Math.round(salesGrowth * 100) / 100,
      },
      purchases: {
        currentMonth: {
          total: currentPurchasesTotal,
          count: currentMonthPurchases._count,
        },
        lastMonth: {
          total: lastPurchasesTotal,
          count: lastMonthPurchases._count,
        },
        growthPercentage: Math.round(purchasesGrowth * 100) / 100,
      },
      receivables: {
        total: Number(pendingReceivables._sum.totalAmount ?? 0),
        count: pendingReceivables._count,
      },
      payables: {
        total: Number(pendingPayables._sum.totalAmount ?? 0),
        count: pendingPayables._count,
      },
      expenses: {
        pendingApproval: {
          total: Number(pendingExpenses._sum.totalAmount ?? 0),
          count: pendingExpenses._count,
        },
      },
    };
  }

  async getSalesAnalytics(
    organizationId: string,
    period: 'daily' | 'weekly' | 'monthly' = 'monthly',
    months: number = 12,
  ) {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    let dateFormat: string;
    switch (period) {
      case 'daily':
        dateFormat = 'YYYY-MM-DD';
        break;
      case 'weekly':
        dateFormat = 'IYYY-IW';
        break;
      case 'monthly':
      default:
        dateFormat = 'YYYY-MM';
        break;
    }

    const salesByPeriod = await this.prisma.$queryRaw`
      SELECT
        TO_CHAR("orderDate", ${dateFormat}) as period,
        COUNT(*)::int as "orderCount",
        COALESCE(SUM("totalAmount"), 0) as "totalRevenue",
        COALESCE(AVG("totalAmount"), 0) as "averageOrderValue"
      FROM "SalesOrder"
      WHERE "organizationId" = ${organizationId}
        AND status NOT IN ('CANCELLED', 'DRAFT')
        AND "orderDate" >= ${startDate}
      GROUP BY TO_CHAR("orderDate", ${dateFormat})
      ORDER BY period ASC
    `;

    const topCustomers = await this.prisma.$queryRaw`
      SELECT
        c.id,
        c.name,
        COUNT(so.id)::int as "orderCount",
        COALESCE(SUM(so."totalAmount"), 0) as "totalRevenue"
      FROM "Customer" c
      JOIN "SalesOrder" so ON so."customerId" = c.id
      WHERE so."organizationId" = ${organizationId}
        AND so.status NOT IN ('CANCELLED', 'DRAFT')
        AND so."orderDate" >= ${startDate}
      GROUP BY c.id, c.name
      ORDER BY "totalRevenue" DESC
      LIMIT 10
    `;

    const topProducts = await this.prisma.$queryRaw`
      SELECT
        p.id,
        p.name,
        p.sku,
        SUM(sol.quantity)::int as "totalQuantity",
        COALESCE(SUM(sol."lineTotal"), 0) as "totalRevenue"
      FROM "Product" p
      JOIN "SalesOrderLine" sol ON sol."productId" = p.id
      JOIN "SalesOrder" so ON so.id = sol."salesOrderId"
      WHERE so."organizationId" = ${organizationId}
        AND so.status NOT IN ('CANCELLED', 'DRAFT')
        AND so."orderDate" >= ${startDate}
      GROUP BY p.id, p.name, p.sku
      ORDER BY "totalRevenue" DESC
      LIMIT 10
    `;

    const statusBreakdown = await this.prisma.salesOrder.groupBy({
      by: ['status'],
      where: {
        organizationId,
        orderDate: { gte: startDate },
      },
      _count: true,
      _sum: { totalAmount: true },
    });

    return {
      period,
      dateRange: {
        start: startDate,
        end: new Date(),
      },
      salesByPeriod,
      topCustomers,
      topProducts,
      statusBreakdown: statusBreakdown.map((s) => ({
        status: s.status,
        count: s._count,
        total: Number(s._sum.totalAmount ?? 0),
      })),
    };
  }

  async getInventorySummary(organizationId: string) {
    const [
      totalProducts,
      totalStockValue,
      lowStockItems,
      outOfStockItems,
      warehouseSummary,
      recentMovements,
    ] = await Promise.all([
      this.prisma.product.count({
        where: { organizationId, isActive: true },
      }),
      this.prisma.$queryRaw`
        SELECT
          COALESCE(SUM(s.quantity * p."costPrice"), 0) as "totalValue",
          COALESCE(SUM(s.quantity), 0) as "totalUnits"
        FROM "Stock" s
        JOIN "Product" p ON p.id = s."productId"
        WHERE s."organizationId" = ${organizationId}
      ` as Promise<any[]>,
      this.prisma.$queryRaw`
        SELECT COUNT(*)::int as count
        FROM "Stock" s
        WHERE s."organizationId" = ${organizationId}
          AND s.quantity > 0
          AND s.quantity <= s."reorderLevel"
          AND s."reorderLevel" > 0
      ` as Promise<any[]>,
      this.prisma.stock.count({
        where: { organizationId, quantity: { lte: 0 } },
      }),
      this.prisma.$queryRaw`
        SELECT
          w.id,
          w.name,
          w.code,
          COUNT(DISTINCT s."productId")::int as "productCount",
          COALESCE(SUM(s.quantity), 0) as "totalUnits",
          COALESCE(SUM(s.quantity * p."costPrice"), 0) as "totalValue"
        FROM "Warehouse" w
        LEFT JOIN "Stock" s ON s."warehouseId" = w.id
        LEFT JOIN "Product" p ON p.id = s."productId"
        WHERE w."organizationId" = ${organizationId}
          AND w."isActive" = true
        GROUP BY w.id, w.name, w.code
        ORDER BY "totalValue" DESC
      ` as Promise<any[]>,
      this.prisma.stockMovement.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          product: { select: { id: true, name: true, sku: true } },
          warehouse: { select: { id: true, name: true } },
        },
      }),
    ]);

    const stockValue = totalStockValue[0] ?? { totalValue: 0, totalUnits: 0 };
    const lowStock = lowStockItems[0] ?? { count: 0 };

    return {
      overview: {
        totalProducts,
        totalStockValue: Number(stockValue.totalValue),
        totalUnits: Number(stockValue.totalUnits),
        lowStockCount: lowStock.count,
        outOfStockCount: outOfStockItems,
      },
      warehouses: warehouseSummary,
      recentMovements,
    };
  }

  async getFinancialOverview(
    organizationId: string,
    year?: number,
  ) {
    const targetYear = year ?? new Date().getFullYear();
    const startOfYear = new Date(targetYear, 0, 1);
    const endOfYear = new Date(targetYear, 11, 31, 23, 59, 59);

    const [
      monthlyRevenue,
      monthlyExpenses,
      overdueReceivables,
      overduePayables,
      cashFlow,
    ] = await Promise.all([
      this.prisma.$queryRaw`
        SELECT
          TO_CHAR("orderDate", 'YYYY-MM') as month,
          COALESCE(SUM("totalAmount"), 0) as total
        FROM "SalesOrder"
        WHERE "organizationId" = ${organizationId}
          AND status NOT IN ('CANCELLED', 'DRAFT')
          AND "orderDate" >= ${startOfYear}
          AND "orderDate" <= ${endOfYear}
        GROUP BY TO_CHAR("orderDate", 'YYYY-MM')
        ORDER BY month ASC
      ` as Promise<any[]>,
      this.prisma.$queryRaw`
        SELECT
          TO_CHAR("orderDate", 'YYYY-MM') as month,
          COALESCE(SUM("totalAmount"), 0) as total
        FROM "PurchaseOrder"
        WHERE "organizationId" = ${organizationId}
          AND status NOT IN ('CANCELLED', 'DRAFT')
          AND "orderDate" >= ${startOfYear}
          AND "orderDate" <= ${endOfYear}
        GROUP BY TO_CHAR("orderDate", 'YYYY-MM')
        ORDER BY month ASC
      ` as Promise<any[]>,
      this.prisma.$queryRaw`
        SELECT
          COUNT(*)::int as count,
          COALESCE(SUM("totalAmount" - "paidAmount"), 0) as "totalOverdue"
        FROM "SalesOrder"
        WHERE "organizationId" = ${organizationId}
          AND status IN ('CONFIRMED', 'INVOICED')
          AND "dueDate" < NOW()
          AND "paidAmount" < "totalAmount"
      ` as Promise<any[]>,
      this.prisma.$queryRaw`
        SELECT
          COUNT(*)::int as count,
          COALESCE(SUM("totalAmount" - "paidAmount"), 0) as "totalOverdue"
        FROM "PurchaseOrder"
        WHERE "organizationId" = ${organizationId}
          AND status IN ('CONFIRMED', 'ORDERED', 'RECEIVED')
          AND "expectedDate" < NOW()
          AND "paidAmount" < "totalAmount"
      ` as Promise<any[]>,
      this.prisma.$queryRaw`
        SELECT
          TO_CHAR(p."paymentDate", 'YYYY-MM') as month,
          COALESCE(SUM(CASE WHEN p."salesOrderId" IS NOT NULL THEN p.amount ELSE 0 END), 0) as "cashIn",
          COALESCE(SUM(CASE WHEN p."purchaseOrderId" IS NOT NULL THEN p.amount ELSE 0 END), 0) as "cashOut"
        FROM "Payment" p
        WHERE p."organizationId" = ${organizationId}
          AND p."paymentDate" >= ${startOfYear}
          AND p."paymentDate" <= ${endOfYear}
        GROUP BY TO_CHAR(p."paymentDate", 'YYYY-MM')
        ORDER BY month ASC
      ` as Promise<any[]>,
    ]);

    const allMonths = Array.from({ length: 12 }, (_, i) => {
      const month = (i + 1).toString().padStart(2, '0');
      return `${targetYear}-${month}`;
    });

    const revenueMap = new Map(monthlyRevenue.map((r) => [r.month, Number(r.total)]));
    const expensesMap = new Map(monthlyExpenses.map((e) => [e.month, Number(e.total)]));
    const cashFlowMap = new Map(
      cashFlow.map((c) => [c.month, { cashIn: Number(c.cashIn), cashOut: Number(c.cashOut) }]),
    );

    const monthlyBreakdown = allMonths.map((month) => {
      const revenue = revenueMap.get(month) ?? 0;
      const expenses = expensesMap.get(month) ?? 0;
      const cf = cashFlowMap.get(month) ?? { cashIn: 0, cashOut: 0 };

      return {
        month,
        revenue,
        expenses,
        profit: revenue - expenses,
        cashIn: cf.cashIn,
        cashOut: cf.cashOut,
        netCashFlow: cf.cashIn - cf.cashOut,
      };
    });

    const totalRevenue = monthlyBreakdown.reduce((s, m) => s + m.revenue, 0);
    const totalExpenses = monthlyBreakdown.reduce((s, m) => s + m.expenses, 0);
    const overdueRec = overdueReceivables[0] ?? { count: 0, totalOverdue: 0 };
    const overduePay = overduePayables[0] ?? { count: 0, totalOverdue: 0 };

    return {
      year: targetYear,
      summary: {
        totalRevenue,
        totalExpenses,
        netProfit: totalRevenue - totalExpenses,
        profitMargin: totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue) * 100 : 0,
      },
      overdueReceivables: {
        count: overdueRec.count,
        total: Number(overdueRec.totalOverdue),
      },
      overduePayables: {
        count: overduePay.count,
        total: Number(overduePay.totalOverdue),
      },
      monthlyBreakdown,
    };
  }
}
