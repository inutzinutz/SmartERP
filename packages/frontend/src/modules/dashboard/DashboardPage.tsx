import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Row,
  Col,
  Card,
  Statistic,
  Table,
  Tag,
  Typography,
  Spin,
  Space,
  Progress,
  Alert,
  Button,
} from 'antd';
import {
  DollarOutlined,
  ShoppingCartOutlined,
  TeamOutlined,
  ShoppingOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  WarningOutlined,
  RiseOutlined,
  FallOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import type { ColumnsType } from 'antd/es/table';
import { api, formatCurrency, formatDate } from '@/utils/api';

const { Title, Text } = Typography;

interface KpiData {
  totalSales: number;
  totalPurchases: number;
  totalCustomers: number;
  totalProducts: number;
  salesGrowth: number;
  purchasesGrowth: number;
  receivables: number;
  payables: number;
}

interface SalesOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  totalAmount: number;
  status: string;
  orderDate: string;
}

interface LowStockItem {
  id: string;
  productCode: string;
  productName: string;
  currentStock: number;
  reorderLevel: number;
  warehouseName: string;
}

interface TopProduct {
  id: string;
  productName: string;
  totalSold: number;
  revenue: number;
}

const CHART_COLORS = ['#2563eb', '#52c41a', '#fa8c16', '#722ed1', '#eb2f96', '#13c2c2'];

const DashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kpis, setKpis] = useState<KpiData | null>(null);
  const [recentOrders, setRecentOrders] = useState<SalesOrder[]>([]);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch independently so partial failures don't block everything
      const results = await Promise.allSettled([
        api.get('/dashboard/kpis'),
        api.get('/dashboard/sales-analytics'),
        api.get('/dashboard/inventory-summary'),
      ]);

      if (results[0].status === 'fulfilled') {
        setKpis(results[0].value.data);
      }
      if (results[1].status === 'fulfilled') {
        setRecentOrders(results[1].value.data.recentOrders || []);
        setTopProducts(results[1].value.data.topProducts || []);
      }
      if (results[2].status === 'fulfilled') {
        setLowStockItems(results[2].value.data.lowStockItems || []);
      }

      // Show error only if all failed
      const allFailed = results.every((r) => r.status === 'rejected');
      if (allFailed) {
        setError('Failed to load dashboard data. Please check your connection.');
      }
    } catch {
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const statusColor: Record<string, string> = {
    DRAFT: 'blue',
    CONFIRMED: 'green',
    SHIPPED: 'orange',
    DELIVERED: 'cyan',
    CANCELLED: 'red',
    INVOICED: 'purple',
  };

  const recentOrderColumns: ColumnsType<SalesOrder> = [
    {
      title: t('dashboard.orderNumber', 'Order #'),
      dataIndex: 'orderNumber',
      key: 'orderNumber',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: t('dashboard.customer', 'Customer'),
      dataIndex: 'customerName',
      key: 'customerName',
      ellipsis: true,
    },
    {
      title: t('dashboard.amount', 'Amount'),
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      align: 'right',
      render: (amount: number) => formatCurrency(amount),
    },
    {
      title: t('dashboard.status', 'Status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={statusColor[status] || 'default'}>{status}</Tag>
      ),
    },
    {
      title: t('dashboard.date', 'Date'),
      dataIndex: 'orderDate',
      key: 'orderDate',
      render: (date: string) => formatDate(date),
    },
  ];

  const lowStockColumns: ColumnsType<LowStockItem> = [
    {
      title: t('dashboard.productCode', 'Code'),
      dataIndex: 'productCode',
      key: 'productCode',
      render: (text: string) => <Text code>{text}</Text>,
    },
    {
      title: t('dashboard.productName', 'Product'),
      dataIndex: 'productName',
      key: 'productName',
      ellipsis: true,
    },
    {
      title: t('dashboard.warehouse', 'Warehouse'),
      dataIndex: 'warehouseName',
      key: 'warehouseName',
      ellipsis: true,
    },
    {
      title: t('dashboard.currentStock', 'Current'),
      dataIndex: 'currentStock',
      key: 'currentStock',
      align: 'right',
      render: (stock: number, record: LowStockItem) => (
        <Text type={stock <= record.reorderLevel ? 'danger' : undefined} strong>
          {stock}
        </Text>
      ),
    },
    {
      title: t('dashboard.reorderLevel', 'Min'),
      dataIndex: 'reorderLevel',
      key: 'reorderLevel',
      align: 'right',
    },
    {
      title: t('dashboard.stockLevel', 'Level'),
      key: 'level',
      width: 100,
      render: (_: unknown, record: LowStockItem) => {
        const percent = record.reorderLevel > 0
          ? Math.min(Math.round((record.currentStock / record.reorderLevel) * 100), 100)
          : 100;
        return (
          <Progress
            percent={percent}
            size="small"
            status={percent < 50 ? 'exception' : percent < 80 ? 'active' : 'success'}
            showInfo={false}
          />
        );
      },
    },
  ];

  // Generate mock monthly data from KPIs for the area chart
  const generateMonthlyChartData = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const baseSales = (kpis?.totalSales || 0) / 6;
    const basePurchases = (kpis?.totalPurchases || 0) / 6;
    return months.map((month, i) => ({
      month,
      revenue: Math.round(baseSales * (0.7 + Math.random() * 0.6) * (1 + i * 0.05)),
      expenses: Math.round(basePurchases * (0.7 + Math.random() * 0.6) * (1 + i * 0.03)),
    }));
  };

  // Pie chart data from top products
  const topProductsPieData = topProducts.slice(0, 5).map((p) => ({
    name: p.productName?.length > 15 ? p.productName.substring(0, 15) + '...' : p.productName,
    value: p.revenue || p.totalSold || 0,
  }));

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          type="error"
          message="Dashboard Error"
          description={error}
          showIcon
          action={
            <Button size="small" icon={<ReloadOutlined />} onClick={fetchDashboardData}>
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  const monthlyData = generateMonthlyChartData();

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            {t('dashboard.title', 'Dashboard')}
          </Title>
        </Col>
        <Col>
          <Button icon={<ReloadOutlined />} onClick={fetchDashboardData}>
            {t('common.refresh', 'Refresh')}
          </Button>
        </Col>
      </Row>

      {/* KPI Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable>
            <Statistic
              title={t('dashboard.totalSales', 'Total Sales')}
              value={kpis?.totalSales || 0}
              prefix={<DollarOutlined style={{ color: '#52c41a' }} />}
              formatter={(value) => formatCurrency(value as number)}
              suffix={
                kpis?.salesGrowth !== undefined && kpis.salesGrowth !== 0 ? (
                  <Text
                    type={kpis.salesGrowth >= 0 ? 'success' : 'danger'}
                    style={{ fontSize: 14 }}
                  >
                    {kpis.salesGrowth >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                    {Math.abs(kpis.salesGrowth)}%
                  </Text>
                ) : null
              }
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable>
            <Statistic
              title={t('dashboard.totalPurchases', 'Total Purchases')}
              value={kpis?.totalPurchases || 0}
              prefix={<ShoppingCartOutlined style={{ color: '#1890ff' }} />}
              formatter={(value) => formatCurrency(value as number)}
              suffix={
                kpis?.purchasesGrowth !== undefined && kpis.purchasesGrowth !== 0 ? (
                  <Text
                    type={kpis.purchasesGrowth >= 0 ? 'success' : 'danger'}
                    style={{ fontSize: 14 }}
                  >
                    {kpis.purchasesGrowth >= 0 ? <RiseOutlined /> : <FallOutlined />}
                    {Math.abs(kpis.purchasesGrowth)}%
                  </Text>
                ) : null
              }
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable>
            <Statistic
              title={t('dashboard.totalCustomers', 'Total Customers')}
              value={kpis?.totalCustomers || 0}
              prefix={<TeamOutlined style={{ color: '#722ed1' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable>
            <Statistic
              title={t('dashboard.totalProducts', 'Total Products')}
              value={kpis?.totalProducts || 0}
              prefix={<ShoppingOutlined style={{ color: '#fa8c16' }} />}
            />
          </Card>
        </Col>
      </Row>

      {/* Financial Overview */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12}>
          <Card>
            <Statistic
              title={t('dashboard.receivables', 'Accounts Receivable')}
              value={kpis?.receivables || 0}
              prefix={<ArrowUpOutlined style={{ color: '#52c41a' }} />}
              formatter={(value) => formatCurrency(value as number)}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card>
            <Statistic
              title={t('dashboard.payables', 'Accounts Payable')}
              value={kpis?.payables || 0}
              prefix={<ArrowDownOutlined style={{ color: '#ff4d4f' }} />}
              formatter={(value) => formatCurrency(value as number)}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Charts Row */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {/* Revenue vs Expense Area Chart */}
        <Col xs={24} lg={14}>
          <Card title={t('dashboard.revenueExpense', 'Revenue vs Expense')} style={{ height: '100%' }}>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#52c41a" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#52c41a" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff4d4f" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ff4d4f" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value: number | undefined) => formatCurrency(value ?? 0)}
                  contentStyle={{ borderRadius: 8, border: '1px solid #f0f0f0' }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#52c41a"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                  name={t('dashboard.revenue', 'Revenue')}
                />
                <Area
                  type="monotone"
                  dataKey="expenses"
                  stroke="#ff4d4f"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorExpenses)"
                  name={t('dashboard.expenses', 'Expenses')}
                />
                <Legend />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* Top Products Pie/Bar Chart */}
        <Col xs={24} lg={10}>
          <Card title={t('dashboard.topProducts', 'Top Products')} style={{ height: '100%' }}>
            {topProductsPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topProductsPieData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: number | undefined) => formatCurrency(value ?? 0)}
                    contentStyle={{ borderRadius: 8, border: '1px solid #f0f0f0' }}
                  />
                  <Bar dataKey="value" name={t('dashboard.revenue', 'Revenue')} radius={[0, 4, 4, 0]}>
                    {topProductsPieData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Text type="secondary">{t('common.noData', 'No data available')}</Text>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Recent Orders + Low Stock */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card title={t('dashboard.recentSalesOrders', 'Recent Sales Orders')}>
            <Table
              dataSource={recentOrders}
              columns={recentOrderColumns}
              rowKey="id"
              pagination={false}
              size="small"
              locale={{ emptyText: t('common.noData', 'No data available') }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card
            title={
              <Space>
                <WarningOutlined style={{ color: '#faad14' }} />
                {t('dashboard.lowStockAlerts', 'Low Stock Alerts')}
                {lowStockItems.length > 0 && (
                  <Tag color="warning">{lowStockItems.length}</Tag>
                )}
              </Space>
            }
          >
            {lowStockItems.length === 0 ? (
              <Alert
                type="success"
                message={t('dashboard.allStockHealthy', 'All stock levels are healthy')}
                showIcon
              />
            ) : (
              <Table
                dataSource={lowStockItems}
                columns={lowStockColumns}
                rowKey="id"
                pagination={false}
                size="small"
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default DashboardPage;
