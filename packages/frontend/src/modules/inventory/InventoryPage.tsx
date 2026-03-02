import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Table,
  Card,
  Select,
  Tag,
  Modal,
  Form,
  InputNumber,
  Input,
  Button,
  Space,
  Typography,
  Row,
  Col,
  message,
  Tabs,
  Alert,
} from 'antd';
import {
  WarningOutlined,
  PlusOutlined,
  SwapOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { api, formatDateTime } from '@/utils/api';

const { Title, Text } = Typography;

interface StockItem {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  warehouseId: string;
  warehouseName: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  reorderLevel: number;
}

interface StockMovement {
  id: string;
  type: string;
  productCode: string;
  productName: string;
  quantity: number;
  reference: string;
  warehouseName: string;
  notes?: string;
  createdAt: string;
  createdBy: string;
}

interface Warehouse {
  id: string;
  name: string;
}

interface AdjustmentFormValues {
  productId: string;
  warehouseId: string;
  adjustmentType: 'ADD' | 'SUBTRACT' | 'SET';
  quantity: number;
  reason: string;
}

interface ProductOption {
  id: string;
  code: string;
  name: string;
}

const InventoryPage: React.FC = () => {
  const { t } = useTranslation();
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string | undefined>();
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stockTotal, setStockTotal] = useState(0);
  const [stockPage, setStockPage] = useState(1);
  const [movementTotal, setMovementTotal] = useState(0);
  const [movementPage, setMovementPage] = useState(1);
  const [form] = Form.useForm<AdjustmentFormValues>();

  const fetchWarehouses = async () => {
    try {
      const { data } = await api.get('/warehouses');
      setWarehouses(data.data || data);
    } catch {
      // handled
    }
  };

  const fetchProducts = async () => {
    try {
      const { data } = await api.get('/products', { params: { limit: 500 } });
      setProducts(data.data || data);
    } catch {
      // handled
    }
  };

  const fetchStockItems = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/inventory/stock', {
        params: {
          page: stockPage,
          limit: 10,
          warehouseId: selectedWarehouse || undefined,
        },
      });
      setStockItems(data.data || data);
      setStockTotal(data.total || 0);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, [stockPage, selectedWarehouse]);

  const fetchMovements = useCallback(async () => {
    setMovementsLoading(true);
    try {
      const { data } = await api.get('/inventory/movements', {
        params: { page: movementPage, limit: 10 },
      });
      setMovements(data.data || data);
      setMovementTotal(data.total || 0);
    } catch {
      // handled
    } finally {
      setMovementsLoading(false);
    }
  }, [movementPage]);

  useEffect(() => {
    fetchWarehouses();
    fetchProducts();
  }, []);

  useEffect(() => {
    fetchStockItems();
  }, [fetchStockItems]);

  useEffect(() => {
    fetchMovements();
  }, [fetchMovements]);

  const handleAdjustment = async (values: AdjustmentFormValues) => {
    setSubmitting(true);
    try {
      await api.post('/inventory/adjustments', values);
      message.success(t('inventory.adjustmentSuccess', 'Stock adjustment recorded'));
      setAdjustModalOpen(false);
      form.resetFields();
      fetchStockItems();
      fetchMovements();
    } catch {
      // handled
    } finally {
      setSubmitting(false);
    }
  };

  const movementTypeColor: Record<string, string> = {
    IN: 'green',
    OUT: 'red',
    ADJUSTMENT: 'blue',
    TRANSFER: 'orange',
    RETURN: 'purple',
  };

  const stockColumns: ColumnsType<StockItem> = [
    {
      title: t('inventory.productCode', 'Code'),
      dataIndex: 'productCode',
      key: 'productCode',
      width: 120,
      render: (text: string) => <Text code>{text}</Text>,
    },
    {
      title: t('inventory.productName', 'Product'),
      dataIndex: 'productName',
      key: 'productName',
      ellipsis: true,
    },
    {
      title: t('inventory.warehouse', 'Warehouse'),
      dataIndex: 'warehouseName',
      key: 'warehouseName',
      width: 150,
    },
    {
      title: t('inventory.quantity', 'Quantity'),
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
      align: 'right',
    },
    {
      title: t('inventory.reserved', 'Reserved'),
      dataIndex: 'reservedQuantity',
      key: 'reservedQuantity',
      width: 100,
      align: 'right',
      render: (qty: number) => <Text type={qty > 0 ? 'warning' : undefined}>{qty}</Text>,
    },
    {
      title: t('inventory.available', 'Available'),
      dataIndex: 'availableQuantity',
      key: 'availableQuantity',
      width: 100,
      align: 'right',
      render: (qty: number) => <Text strong>{qty}</Text>,
    },
    {
      title: t('inventory.status', 'Status'),
      key: 'status',
      width: 120,
      render: (_: unknown, record: StockItem) => {
        if (record.quantity <= 0) return <Tag color="red">{t('inventory.outOfStock', 'Out of Stock')}</Tag>;
        if (record.quantity <= record.reorderLevel) return <Tag color="orange">{t('inventory.lowStock', 'Low Stock')}</Tag>;
        return <Tag color="green">{t('inventory.inStock', 'In Stock')}</Tag>;
      },
    },
  ];

  const movementColumns: ColumnsType<StockMovement> = [
    {
      title: t('inventory.type', 'Type'),
      dataIndex: 'type',
      key: 'type',
      width: 110,
      render: (type: string) => <Tag color={movementTypeColor[type] || 'default'}>{type}</Tag>,
    },
    {
      title: t('inventory.product', 'Product'),
      key: 'product',
      render: (_: unknown, record: StockMovement) => (
        <Space>
          <Text code>{record.productCode}</Text>
          <Text>{record.productName}</Text>
        </Space>
      ),
    },
    {
      title: t('inventory.qty', 'Qty'),
      dataIndex: 'quantity',
      key: 'quantity',
      width: 80,
      align: 'right',
      render: (qty: number, record: StockMovement) => (
        <Text type={record.type === 'OUT' ? 'danger' : 'success'}>
          {record.type === 'OUT' ? `-${qty}` : `+${qty}`}
        </Text>
      ),
    },
    {
      title: t('inventory.reference', 'Reference'),
      dataIndex: 'reference',
      key: 'reference',
      width: 150,
      render: (text: string) => <Text code>{text}</Text>,
    },
    {
      title: t('inventory.warehouse', 'Warehouse'),
      dataIndex: 'warehouseName',
      key: 'warehouseName',
      width: 130,
    },
    {
      title: t('inventory.notes', 'Notes'),
      dataIndex: 'notes',
      key: 'notes',
      ellipsis: true,
    },
    {
      title: t('inventory.date', 'Date'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (date: string) => formatDateTime(date),
    },
  ];

  const lowStockItems = stockItems.filter(
    (item) => item.quantity > 0 && item.quantity <= item.reorderLevel
  );

  const tabItems = [
    {
      key: 'stock',
      label: (
        <Space>
          <InboxOutlined />
          {t('inventory.stockLevels', 'Stock Levels')}
        </Space>
      ),
      children: (
        <>
          <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
            <Col>
              <Select
                placeholder={t('inventory.filterByWarehouse', 'Filter by warehouse')}
                style={{ width: 240 }}
                allowClear
                value={selectedWarehouse}
                onChange={(val) => {
                  setSelectedWarehouse(val);
                  setStockPage(1);
                }}
                options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
              />
            </Col>
            <Col>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  form.resetFields();
                  setAdjustModalOpen(true);
                }}
              >
                {t('inventory.adjustStock', 'Adjust Stock')}
              </Button>
            </Col>
          </Row>
          <Table
            dataSource={stockItems}
            columns={stockColumns}
            rowKey="id"
            loading={loading}
            pagination={{
              current: stockPage,
              pageSize: 10,
              total: stockTotal,
              showTotal: (total) => t('common.totalItems', 'Total {{total}} items', { total }),
              onChange: (p) => setStockPage(p),
            }}
            scroll={{ x: 900 }}
          />
        </>
      ),
    },
    {
      key: 'movements',
      label: (
        <Space>
          <SwapOutlined />
          {t('inventory.movements', 'Stock Movements')}
        </Space>
      ),
      children: (
        <Table
          dataSource={movements}
          columns={movementColumns}
          rowKey="id"
          loading={movementsLoading}
          pagination={{
            current: movementPage,
            pageSize: 10,
            total: movementTotal,
            showTotal: (total) => t('common.totalItems', 'Total {{total}} items', { total }),
            onChange: (p) => setMovementPage(p),
          }}
          scroll={{ x: 900 }}
        />
      ),
    },
    {
      key: 'alerts',
      label: (
        <Space>
          <WarningOutlined />
          {t('inventory.lowStockAlerts', 'Low Stock Alerts')}
          {lowStockItems.length > 0 && (
            <Tag color="orange">{lowStockItems.length}</Tag>
          )}
        </Space>
      ),
      children: (
        <>
          {lowStockItems.length === 0 ? (
            <Alert
              type="success"
              message={t('inventory.noLowStock', 'All stock levels are healthy')}
              showIcon
            />
          ) : (
            <Table
              dataSource={lowStockItems}
              columns={stockColumns}
              rowKey="id"
              pagination={false}
              size="small"
            />
          )}
        </>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={3} style={{ marginBottom: 24 }}>
        {t('inventory.title', 'Inventory')}
      </Title>

      <Card>
        <Tabs items={tabItems} />
      </Card>

      <Modal
        title={t('inventory.stockAdjustment', 'Stock Adjustment')}
        open={adjustModalOpen}
        onCancel={() => {
          setAdjustModalOpen(false);
          form.resetFields();
        }}
        footer={null}
        width={520}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleAdjustment}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="productId"
            label={t('inventory.product', 'Product')}
            rules={[{ required: true, message: t('inventory.productRequired', 'Please select a product') }]}
          >
            <Select
              showSearch
              placeholder={t('inventory.selectProduct', 'Select product')}
              optionFilterProp="label"
              options={products.map((p) => ({
                value: p.id,
                label: `${p.code} - ${p.name}`,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="warehouseId"
            label={t('inventory.warehouse', 'Warehouse')}
            rules={[{ required: true, message: t('inventory.warehouseRequired', 'Please select a warehouse') }]}
          >
            <Select
              placeholder={t('inventory.selectWarehouse', 'Select warehouse')}
              options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
            />
          </Form.Item>

          <Form.Item
            name="adjustmentType"
            label={t('inventory.adjustmentType', 'Adjustment Type')}
            rules={[{ required: true, message: t('inventory.typeRequired', 'Please select type') }]}
          >
            <Select
              placeholder={t('inventory.selectType', 'Select type')}
              options={[
                { value: 'ADD', label: t('inventory.add', 'Add Stock') },
                { value: 'SUBTRACT', label: t('inventory.subtract', 'Subtract Stock') },
                { value: 'SET', label: t('inventory.set', 'Set Quantity') },
              ]}
            />
          </Form.Item>

          <Form.Item
            name="quantity"
            label={t('inventory.quantity', 'Quantity')}
            rules={[{ required: true, message: t('inventory.quantityRequired', 'Please enter quantity') }]}
          >
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>

          <Form.Item
            name="reason"
            label={t('inventory.reason', 'Reason')}
            rules={[{ required: true, message: t('inventory.reasonRequired', 'Please enter a reason') }]}
          >
            <Input.TextArea rows={3} placeholder={t('inventory.reasonPlaceholder', 'Reason for adjustment')} />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setAdjustModalOpen(false)}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button type="primary" htmlType="submit" loading={submitting}>
                {t('inventory.submitAdjustment', 'Submit Adjustment')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default InventoryPage;
