import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Table,
  Card,
  Button,
  Tag,
  Space,
  Typography,
  Modal,
  Form,
  Select,
  InputNumber,
  Input,
  DatePicker,
  Drawer,
  Divider,
  Row,
  Col,
  Popconfirm,
  message,
  Descriptions,
} from 'antd';
import {
  PlusOutlined,
  EyeOutlined,
  CheckOutlined,
  CloseOutlined,
  MinusCircleOutlined,
  ShoppingCartOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { api, formatCurrency, formatDate } from '@/utils/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

interface PurchaseOrder {
  id: string;
  orderNumber: string;
  supplierId: string;
  supplierName: string;
  orderDate: string;
  expectedDate?: string;
  status: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  notes?: string;
  items: PurchaseItem[];
}

interface PurchaseItem {
  id?: string;
  productId: string;
  productName?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
}

interface Supplier {
  id: string;
  name: string;
  code: string;
}

interface Product {
  id: string;
  code: string;
  name: string;
  costPrice: number;
}

interface OrderFormValues {
  supplierId: string;
  orderDate: dayjs.Dayjs;
  expectedDate?: dayjs.Dayjs;
  notes?: string;
  items: {
    productId: string;
    quantity: number;
    unitPrice: number;
    discount: number;
  }[];
}

const statusConfig: Record<string, { color: string; label: string }> = {
  DRAFT: { color: 'blue', label: 'Draft' },
  CONFIRMED: { color: 'green', label: 'Confirmed' },
  RECEIVED: { color: 'cyan', label: 'Received' },
  PARTIALLY_RECEIVED: { color: 'orange', label: 'Partially Received' },
  INVOICED: { color: 'purple', label: 'Invoiced' },
  CANCELLED: { color: 'red', label: 'Cancelled' },
};

const PurchaseOrdersPage: React.FC = () => {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<OrderFormValues>();

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/purchase-orders', {
        params: {
          page,
          limit: pageSize,
          status: statusFilter || undefined,
          startDate: dateRange?.[0]?.format('YYYY-MM-DD'),
          endDate: dateRange?.[1]?.format('YYYY-MM-DD'),
        },
      });
      setOrders(data.data || data);
      setTotal(data.total || 0);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, dateRange]);

  const fetchSuppliers = async () => {
    try {
      const { data } = await api.get('/suppliers', { params: { limit: 500 } });
      setSuppliers(data.data || data);
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

  useEffect(() => {
    fetchSuppliers();
    fetchProducts();
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleCreate = async (values: OrderFormValues) => {
    setSubmitting(true);
    try {
      const payload = {
        supplierId: values.supplierId,
        orderDate: values.orderDate.format('YYYY-MM-DD'),
        expectedDate: values.expectedDate?.format('YYYY-MM-DD'),
        notes: values.notes,
        items: values.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount || 0,
        })),
      };
      await api.post('/purchase-orders', payload);
      message.success(t('purchases.createSuccess', 'Purchase order created'));
      setDrawerOpen(false);
      form.resetFields();
      fetchOrders();
    } catch {
      // handled
    } finally {
      setSubmitting(false);
    }
  };

  const handleAction = async (id: string, action: string) => {
    try {
      await api.post(`/purchase-orders/${id}/${action}`);
      message.success(t(`purchases.${action}Success`, `Order ${action} successful`));
      fetchOrders();
    } catch {
      // handled
    }
  };

  const handleViewDetails = async (order: PurchaseOrder) => {
    try {
      const { data } = await api.get(`/purchase-orders/${order.id}`);
      setSelectedOrder(data);
    } catch {
      setSelectedOrder(order);
    }
    setDetailModalOpen(true);
  };

  const handleProductChange = (productId: string, fieldIndex: number) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      const items = form.getFieldValue('items') || [];
      items[fieldIndex] = {
        ...items[fieldIndex],
        unitPrice: product.costPrice,
      };
      form.setFieldsValue({ items });
    }
  };

  const calculateTotal = (): number => {
    const items = form.getFieldValue('items') || [];
    return items.reduce((sum: number, item: { quantity?: number; unitPrice?: number; discount?: number }) => {
      if (!item) return sum;
      const qty = item.quantity || 0;
      const price = item.unitPrice || 0;
      const discount = item.discount || 0;
      return sum + qty * price * (1 - discount / 100);
    }, 0);
  };

  const columns: ColumnsType<PurchaseOrder> = [
    {
      title: t('purchases.orderNumber', 'PO #'),
      dataIndex: 'orderNumber',
      key: 'orderNumber',
      width: 140,
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: t('purchases.supplier', 'Supplier'),
      dataIndex: 'supplierName',
      key: 'supplierName',
      ellipsis: true,
    },
    {
      title: t('purchases.orderDate', 'Order Date'),
      dataIndex: 'orderDate',
      key: 'orderDate',
      width: 130,
      render: (date: string) => formatDate(date),
    },
    {
      title: t('purchases.expectedDate', 'Expected'),
      dataIndex: 'expectedDate',
      key: 'expectedDate',
      width: 130,
      render: (date: string) => (date ? formatDate(date) : '-'),
    },
    {
      title: t('purchases.total', 'Total'),
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      width: 150,
      align: 'right',
      render: (amount: number) => <Text strong>{formatCurrency(amount)}</Text>,
    },
    {
      title: t('purchases.status', 'Status'),
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status: string) => {
        const cfg = statusConfig[status] || { color: 'default', label: status };
        return <Tag color={cfg.color}>{t(`purchases.status_${status}`, cfg.label)}</Tag>;
      },
    },
    {
      title: t('common.actions', 'Actions'),
      key: 'actions',
      width: 200,
      render: (_: unknown, record: PurchaseOrder) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetails(record)}
          />
          {record.status === 'DRAFT' && (
            <Popconfirm
              title={t('purchases.confirmOrder', 'Confirm this PO?')}
              onConfirm={() => handleAction(record.id, 'confirm')}
            >
              <Button type="link" size="small" icon={<CheckOutlined />} style={{ color: '#52c41a' }} />
            </Popconfirm>
          )}
          {record.status === 'CONFIRMED' && (
            <Popconfirm
              title={t('purchases.receiveOrder', 'Mark as received?')}
              onConfirm={() => handleAction(record.id, 'receive')}
            >
              <Button type="link" size="small" icon={<InboxOutlined />} style={{ color: '#1890ff' }} />
            </Popconfirm>
          )}
          {(record.status === 'DRAFT' || record.status === 'CONFIRMED') && (
            <Popconfirm
              title={t('purchases.cancelOrder', 'Cancel this PO?')}
              onConfirm={() => handleAction(record.id, 'cancel')}
            >
              <Button type="link" size="small" danger icon={<CloseOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            {t('purchases.ordersTitle', 'Purchase Orders')}
          </Title>
        </Col>
        <Col>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              form.resetFields();
              form.setFieldsValue({ orderDate: dayjs(), items: [{}] });
              setDrawerOpen(true);
            }}
          >
            {t('purchases.newOrder', 'New Purchase Order')}
          </Button>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            placeholder={t('purchases.filterStatus', 'Filter by status')}
            style={{ width: 200 }}
            allowClear
            value={statusFilter}
            onChange={(val) => {
              setStatusFilter(val);
              setPage(1);
            }}
            options={Object.entries(statusConfig).map(([key, cfg]) => ({
              value: key,
              label: t(`purchases.status_${key}`, cfg.label),
            }))}
          />
          <RangePicker
            value={dateRange}
            onChange={(dates) => {
              setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null);
              setPage(1);
            }}
          />
        </Space>
      </Card>

      <Card>
        <Table
          dataSource={orders}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (total) => t('common.totalItems', 'Total {{total}} items', { total }),
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
          scroll={{ x: 1000 }}
        />
      </Card>

      {/* Create PO Drawer */}
      <Drawer
        title={
          <Space>
            <ShoppingCartOutlined />
            {t('purchases.newOrder', 'New Purchase Order')}
          </Space>
        }
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={720}
        footer={
          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setDrawerOpen(false)}>{t('common.cancel', 'Cancel')}</Button>
              <Button type="primary" loading={submitting} onClick={() => form.submit()}>
                {t('common.create', 'Create')}
              </Button>
            </Space>
          </div>
        }
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="supplierId"
                label={t('purchases.supplier', 'Supplier')}
                rules={[{ required: true, message: t('purchases.supplierRequired', 'Required') }]}
              >
                <Select
                  showSearch
                  placeholder={t('purchases.selectSupplier', 'Select supplier')}
                  optionFilterProp="label"
                  options={suppliers.map((s) => ({
                    value: s.id,
                    label: `${s.code} - ${s.name}`,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="orderDate"
                label={t('purchases.orderDate', 'Order Date')}
                rules={[{ required: true }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="expectedDate" label={t('purchases.expectedDate', 'Expected Date')}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="notes" label={t('purchases.notes', 'Notes')}>
                <Input.TextArea rows={1} />
              </Form.Item>
            </Col>
          </Row>

          <Divider>{t('purchases.orderItems', 'Order Items')}</Divider>

          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Row gutter={8} key={key} align="middle" style={{ marginBottom: 8 }}>
                    <Col span={8}>
                      <Form.Item
                        {...restField}
                        name={[name, 'productId']}
                        rules={[{ required: true, message: t('purchases.productRequired', 'Required') }]}
                        style={{ marginBottom: 0 }}
                      >
                        <Select
                          showSearch
                          placeholder={t('purchases.product', 'Product')}
                          optionFilterProp="label"
                          onChange={(val) => handleProductChange(val, name)}
                          options={products.map((p) => ({
                            value: p.id,
                            label: `${p.code} - ${p.name}`,
                          }))}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={4}>
                      <Form.Item
                        {...restField}
                        name={[name, 'quantity']}
                        rules={[{ required: true }]}
                        style={{ marginBottom: 0 }}
                      >
                        <InputNumber placeholder={t('purchases.qty', 'Qty')} min={1} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={5}>
                      <Form.Item
                        {...restField}
                        name={[name, 'unitPrice']}
                        rules={[{ required: true }]}
                        style={{ marginBottom: 0 }}
                      >
                        <InputNumber placeholder={t('purchases.price', 'Price')} min={0} precision={2} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={4}>
                      <Form.Item
                        {...restField}
                        name={[name, 'discount']}
                        initialValue={0}
                        style={{ marginBottom: 0 }}
                      >
                        <InputNumber placeholder="Disc %" min={0} max={100} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={3}>
                      <Button
                        type="text"
                        danger
                        icon={<MinusCircleOutlined />}
                        onClick={() => remove(name)}
                        disabled={fields.length <= 1}
                      />
                    </Col>
                  </Row>
                ))}
                <Button type="dashed" onClick={() => add()} icon={<PlusOutlined />} block style={{ marginBottom: 16 }}>
                  {t('purchases.addItem', 'Add Item')}
                </Button>
              </>
            )}
          </Form.List>

          <Form.Item noStyle shouldUpdate>
            {() => (
              <div style={{ textAlign: 'right', marginTop: 8 }}>
                <Text strong style={{ fontSize: 16 }}>
                  {t('purchases.estimatedTotal', 'Estimated Total')}: {formatCurrency(calculateTotal())}
                </Text>
              </div>
            )}
          </Form.Item>
        </Form>
      </Drawer>

      {/* Detail Modal */}
      <Modal
        title={`${t('purchases.orderDetails', 'PO Details')} - ${selectedOrder?.orderNumber || ''}`}
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={null}
        width={700}
      >
        {selectedOrder && (
          <>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label={t('purchases.orderNumber', 'PO #')}>
                {selectedOrder.orderNumber}
              </Descriptions.Item>
              <Descriptions.Item label={t('purchases.status', 'Status')}>
                <Tag color={statusConfig[selectedOrder.status]?.color || 'default'}>
                  {selectedOrder.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('purchases.supplier', 'Supplier')}>
                {selectedOrder.supplierName}
              </Descriptions.Item>
              <Descriptions.Item label={t('purchases.orderDate', 'Order Date')}>
                {formatDate(selectedOrder.orderDate)}
              </Descriptions.Item>
              <Descriptions.Item label={t('purchases.subtotal', 'Subtotal')}>
                {formatCurrency(selectedOrder.subtotal)}
              </Descriptions.Item>
              <Descriptions.Item label={t('purchases.tax', 'Tax')}>
                {formatCurrency(selectedOrder.taxAmount)}
              </Descriptions.Item>
              <Descriptions.Item label={t('purchases.total', 'Total')} span={2}>
                <Text strong style={{ fontSize: 16 }}>
                  {formatCurrency(selectedOrder.totalAmount)}
                </Text>
              </Descriptions.Item>
            </Descriptions>
            <Table
              dataSource={selectedOrder.items}
              rowKey={(_, idx) => String(idx)}
              pagination={false}
              size="small"
              columns={[
                { title: t('purchases.product', 'Product'), dataIndex: 'productName', key: 'productName' },
                { title: t('purchases.qty', 'Qty'), dataIndex: 'quantity', key: 'quantity', width: 70, align: 'right' as const },
                { title: t('purchases.unitPrice', 'Unit Price'), dataIndex: 'unitPrice', key: 'unitPrice', width: 120, align: 'right' as const, render: (v: number) => formatCurrency(v) },
                { title: t('purchases.discount', 'Discount'), dataIndex: 'discount', key: 'discount', width: 90, align: 'right' as const, render: (v: number) => `${v || 0}%` },
                { title: t('purchases.lineTotal', 'Total'), dataIndex: 'total', key: 'total', width: 120, align: 'right' as const, render: (v: number) => <Text strong>{formatCurrency(v)}</Text> },
              ]}
            />
          </>
        )}
      </Modal>
    </div>
  );
};

export default PurchaseOrdersPage;
