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
} from '@ant-design/icons';
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

const DashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KpiData | null>(null);
  const [recentOrders, setRecentOrders] = useState<SalesOrder[]>([]);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [kpiRes, salesRes, inventoryRes] = await Promise.all([
        api.get('/dashboard/kpis'),
        api.get('/dashboard/sales-analytics'),
        api.get('/dashboard/inventory-summary'),
      ]);
      setKpis(kpiRes.data);
      setRecentOrders(salesRes.data.recentOrders || []);
      setTopProducts(salesRes.data.topProducts || []);
      setLowStockItems(inventoryRes.data.lowStockItems || []);
    } catch {
      // Error handled by interceptor
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
    },
    {
      title: t('dashboard.warehouse', 'Warehouse'),
      dataIndex: 'warehouseName',
      key: 'warehouseName',
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
      title: t('dashboard.reorderLevel', 'Reorder Level'),
      dataIndex: 'reorderLevel',
      key: 'reorderLevel',
      align: 'right',
    },
    {
      title: t('dashboard.stockLevel', 'Level'),
      key: 'level',
      width: 120,
      render: (_: unknown, record: LowStockItem) => {
        const percent = Math.min(
          Math.round((record.currentStock / record.reorderLevel) * 100),
          100
        );
        return (
          <Progress
            percent={percent}
            size="small"
            status={percent < 50 ? 'exception' : percent < 80 ? 'active' : 'success'}
          />
        );
      },
    },
  ];

  const topProductColumns: ColumnsType<TopProduct> = [
    {
      title: t('dashboard.product', 'Product'),
      dataIndex: 'productName',
      key: 'productName',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: t('dashboard.totalSold', 'Qty Sold'),
      dataIndex: 'totalSold',
      key: 'totalSold',
      align: 'right',
    },
    {
      title: t('dashboard.revenue', 'Revenue'),
      dataIndex: 'revenue',
      key: 'revenue',
      align: 'right',
      render: (amount: number) => formatCurrency(amount),
    },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <Title level={3} style={{ marginBottom: 24 }}>
        {t('dashboard.title', 'Dashboard')}
      </Title>

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
                kpis?.salesGrowth !== undefined && (
                  <Text
                    type={kpis.salesGrowth >= 0 ? 'success' : 'danger'}
                    style={{ fontSize: 14 }}
                  >
                    {kpis.salesGrowth >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                    {Math.abs(kpis.salesGrowth)}%
                  </Text>
                )
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
                kpis?.purchasesGrowth !== undefined && (
                  <Text
                    type={kpis.purchasesGrowth >= 0 ? 'success' : 'danger'}
                    style={{ fontSize: 14 }}
                  >
                    {kpis.purchasesGrowth >= 0 ? <RiseOutlined /> : <FallOutlined />}
                    {Math.abs(kpis.purchasesGrowth)}%
                  </Text>
                )
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

      {/* Revenue/Expense Chart Placeholder + Top Products */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={14}>
          <Card
            title={t('dashboard.revenueExpense', 'Revenue vs Expense')}
            style={{ height: '100%' }}
          >
            <div
              style={{
                height: 300,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                background: '#fafafa',
                borderRadius: 8,
              }}
            >
              <Space direction="vertical" align="center">
                <RiseOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
                <Text type="secondary">
                  {t('dashboard.chartComingSoon', 'Revenue & Expense chart — integrate with your preferred chart library')}
                </Text>
              </Space>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card
            title={t('dashboard.topProducts', 'Top Products')}
            style={{ height: '100%' }}
          >
            <Table
              dataSource={topProducts}
              columns={topProductColumns}
              rowKey="id"
              pagination={false}
              size="small"
            />
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
            />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card
            title={
              <Space>
                <WarningOutlined style={{ color: '#faad14' }} />
                {t('dashboard.lowStockAlerts', 'Low Stock Alerts')}
              </Space>
            }
          >
            <Table
              dataSource={lowStockItems}
              columns={lowStockColumns}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default DashboardPage;
