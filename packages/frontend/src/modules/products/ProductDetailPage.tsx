import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Descriptions,
  Table,
  Tag,
  Button,
  Space,
  Typography,
  Spin,
  Row,
  Col,
  Divider,
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  InboxOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useParams, useNavigate } from 'react-router-dom';
import { api, formatCurrency, formatDate, formatDateTime } from '@/utils/api';

const { Title, Text } = Typography;

interface Product {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  costPrice: number;
  sellingPrice: number;
  currentStock: number;
  status: string;
  description?: string;
  reorderLevel?: number;
  createdAt: string;
  updatedAt: string;
}

interface StockByWarehouse {
  id: string;
  warehouseId: string;
  warehouseName: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
}

interface StockMovement {
  id: string;
  type: string;
  quantity: number;
  reference: string;
  warehouseName: string;
  notes?: string;
  createdAt: string;
  createdBy: string;
}

const ProductDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<Product | null>(null);
  const [stockByWarehouse, setStockByWarehouse] = useState<StockByWarehouse[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);

  useEffect(() => {
    if (id) {
      fetchProductData(id);
    }
  }, [id]);

  const fetchProductData = async (productId: string) => {
    setLoading(true);
    try {
      const [productRes, stockRes, movementsRes] = await Promise.all([
        api.get(`/products/${productId}`),
        api.get(`/products/${productId}/stock`),
        api.get(`/products/${productId}/movements`, { params: { limit: 20 } }),
      ]);
      setProduct(productRes.data);
      setStockByWarehouse(stockRes.data || []);
      setMovements(movementsRes.data?.data || movementsRes.data || []);
    } catch {
      // handled by interceptor
    } finally {
      setLoading(false);
    }
  };

  const statusColor: Record<string, string> = {
    ACTIVE: 'green',
    INACTIVE: 'red',
    DISCONTINUED: 'default',
  };

  const movementTypeColor: Record<string, string> = {
    IN: 'green',
    OUT: 'red',
    ADJUSTMENT: 'blue',
    TRANSFER: 'orange',
    RETURN: 'purple',
  };

  const warehouseColumns: ColumnsType<StockByWarehouse> = [
    {
      title: t('products.warehouse', 'Warehouse'),
      dataIndex: 'warehouseName',
      key: 'warehouseName',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: t('products.quantity', 'Quantity'),
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'right',
    },
    {
      title: t('products.reserved', 'Reserved'),
      dataIndex: 'reservedQuantity',
      key: 'reservedQuantity',
      align: 'right',
      render: (qty: number) => (
        <Text type={qty > 0 ? 'warning' : undefined}>{qty}</Text>
      ),
    },
    {
      title: t('products.available', 'Available'),
      dataIndex: 'availableQuantity',
      key: 'availableQuantity',
      align: 'right',
      render: (qty: number) => <Text strong>{qty}</Text>,
    },
  ];

  const movementColumns: ColumnsType<StockMovement> = [
    {
      title: t('products.movementType', 'Type'),
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type: string) => (
        <Tag color={movementTypeColor[type] || 'default'}>{type}</Tag>
      ),
    },
    {
      title: t('products.movementQty', 'Quantity'),
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
      align: 'right',
      render: (qty: number, record: StockMovement) => (
        <Text type={record.type === 'OUT' ? 'danger' : 'success'}>
          {record.type === 'OUT' ? `-${qty}` : `+${qty}`}
        </Text>
      ),
    },
    {
      title: t('products.reference', 'Reference'),
      dataIndex: 'reference',
      key: 'reference',
      render: (text: string) => <Text code>{text}</Text>,
    },
    {
      title: t('products.warehouse', 'Warehouse'),
      dataIndex: 'warehouseName',
      key: 'warehouseName',
    },
    {
      title: t('products.notes', 'Notes'),
      dataIndex: 'notes',
      key: 'notes',
      ellipsis: true,
    },
    {
      title: t('products.date', 'Date'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => formatDateTime(date),
    },
    {
      title: t('products.createdBy', 'By'),
      dataIndex: 'createdBy',
      key: 'createdBy',
      width: 120,
    },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!product) {
    return (
      <div style={{ padding: 24 }}>
        <Text type="secondary">{t('products.notFound', 'Product not found')}</Text>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/products')}>
          {t('common.back', 'Back')}
        </Button>
      </Space>

      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            {product.name}
          </Title>
        </Col>
        <Col>
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={() => navigate(`/products?edit=${product.id}`)}
          >
            {t('common.edit', 'Edit')}
          </Button>
        </Col>
      </Row>

      <Card style={{ marginBottom: 24 }}>
        <Descriptions
          bordered
          column={{ xs: 1, sm: 2, lg: 3 }}
          size="middle"
        >
          <Descriptions.Item label={t('products.code', 'Code')}>
            <Text code>{product.code}</Text>
          </Descriptions.Item>
          <Descriptions.Item label={t('products.name', 'Name')}>
            {product.name}
          </Descriptions.Item>
          <Descriptions.Item label={t('products.status', 'Status')}>
            <Tag color={statusColor[product.status] || 'default'}>{product.status}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label={t('products.category', 'Category')}>
            <Tag>{product.category}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label={t('products.unit', 'Unit')}>
            {product.unit}
          </Descriptions.Item>
          <Descriptions.Item label={t('products.currentStock', 'Current Stock')}>
            <Text strong type={product.currentStock <= 0 ? 'danger' : undefined}>
              {product.currentStock}
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label={t('products.costPrice', 'Cost Price')}>
            {formatCurrency(product.costPrice)}
          </Descriptions.Item>
          <Descriptions.Item label={t('products.sellingPrice', 'Selling Price')}>
            {formatCurrency(product.sellingPrice)}
          </Descriptions.Item>
          <Descriptions.Item label={t('products.reorderLevel', 'Reorder Level')}>
            {product.reorderLevel ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label={t('products.description', 'Description')} span={3}>
            {product.description || '-'}
          </Descriptions.Item>
          <Descriptions.Item label={t('common.createdAt', 'Created')}>
            {formatDate(product.createdAt)}
          </Descriptions.Item>
          <Descriptions.Item label={t('common.updatedAt', 'Updated')}>
            {formatDate(product.updatedAt)}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <InboxOutlined />
                {t('products.stockByWarehouse', 'Stock by Warehouse')}
              </Space>
            }
          >
            <Table
              dataSource={stockByWarehouse}
              columns={warehouseColumns}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <SwapOutlined />
                {t('products.recentMovements', 'Recent Stock Movements')}
              </Space>
            }
          >
            <Table
              dataSource={movements}
              columns={movementColumns}
              rowKey="id"
              pagination={{ pageSize: 10, size: 'small' }}
              size="small"
              scroll={{ x: 700 }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ProductDetailPage;
