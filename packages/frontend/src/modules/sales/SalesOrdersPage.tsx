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
  DeleteOutlined,
  MinusCircleOutlined,
  ShoppingCartOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { api, formatCurrency, formatDate } from '@/utils/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

interface SalesOrder {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  orderDate: string;
  deliveryDate?: string;
  status: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  notes?: string;
  items: OrderItem[];
}

interface OrderItem {
  id?: string;
  productId: string;
  productName?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
}

interface Customer {
  id: string;
  name: string;
  code: string;
}

interface Product {
  id: string;
  code: string;
  name: string;
  sellingPrice: number;
}

interface OrderFormValues {
  customerId: string;
  orderDate: dayjs.Dayjs;
  deliveryDate?: dayjs.Dayjs;
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
  SHIPPED: { color: 'orange', label: 'Shipped' },
  DELIVERED: { color: 'cyan', label: 'Delivered' },
  INVOICED: { color: 'purple', label: 'Invoiced' },
  CANCELLED: { color: 'red', label: 'Cancelled' },
};

const SalesOrdersPage: React.FC = () => {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<OrderFormValues>();

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/sales/orders', {
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

  const fetchCustomers = async () => {
    try {
      const { data } = await api.get('/sales/customers', { params: { limit: 500 } });
      setCustomers(data.data || data);
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
    fetchCustomers();
    fetchProducts();
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleCreate = async (values: OrderFormValues) => {
    setSubmitting(true);
    try {
      const payload = {
        customerId: values.customerId,
        orderDate: values.orderDate.format('YYYY-MM-DD'),
        deliveryDate: values.deliveryDate?.format('YYYY-MM-DD'),
        notes: values.notes,
        items: values.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount || 0,
        })),
      };
      await api.post('/sales/orders', payload);
      message.success(t('sales.createSuccess', 'Sales order created'));
      setDrawerOpen(false);
      form.resetFields();
      fetchOrders();
    } catch {
      // handled
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirm = async (id: string) => {
    try {
      await api.patch(`/sales/orders/${id}`, { action: 'confirm' });
      message.success(t('sales.confirmSuccess', 'Order confirmed'));
      fetchOrders();
    } catch {
      // handled
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await api.patch(`/sales/orders/${id}`, { action: 'cancel' });
      message.success(t('sales.cancelSuccess', 'Order cancelled'));
      fetchOrders();
    } catch {
      // handled
    }
  };

  const handleViewDetails = async (order: SalesOrder) => {
    try {
      const { data } = await api.get(`/sales/orders/${order.id}`);
      setSelectedOrder(data);
      setDetailModalOpen(true);
    } catch {
      setSelectedOrder(order);
      setDetailModalOpen(true);
    }
  };

  const handleProductChange = (productId: string, fieldIndex: number) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      const items = form.getFieldValue('items') || [];
      items[fieldIndex] = {
        ...items[fieldIndex],
        unitPrice: product.sellingPrice,
      };
      form.setFieldsValue({ items });
    }
  };

  const calculateItemTotal = (): number => {
    const items = form.getFieldValue('items') || [];
    return items.reduce((sum: number, item: { quantity?: number; unitPrice?: number; discount?: number }) => {
      if (!item) return sum;
      const qty = item.quantity || 0;
      const price = item.unitPrice || 0;
      const discount = item.discount || 0;
      return sum + qty * price * (1 - discount / 100);
    }, 0);
  };

  const columns: ColumnsType<SalesOrder> = [
    {
      title: t('sales.orderNumber', 'Order #'),
      dataIndex: 'orderNumber',
      key: 'orderNumber',
      width: 140,
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: t('sales.customer', 'Customer'),
      dataIndex: 'customerName',
      key: 'customerName',
      ellipsis: true,
    },
    {
      title: t('sales.orderDate', 'Order Date'),
      dataIndex: 'orderDate',
      key: 'orderDate',
      width: 130,
      render: (date: string) => formatDate(date),
    },
    {
      title: t('sales.total', 'Total'),
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      width: 150,
      align: 'right',
      render: (amount: number) => <Text strong>{formatCurrency(amount)}</Text>,
    },
    {
      title: t('sales.status', 'Status'),
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => {
        const cfg = statusConfig[status] || { color: 'default', label: status };
        return <Tag color={cfg.color}>{t(`sales.status_${status}`, cfg.label)}</Tag>;
      },
    },
    {
      title: t('common.actions', 'Actions'),
      key: 'actions',
      width: 180,
      render: (_: unknown, record: SalesOrder) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetails(record)}
          />
          {record.status === 'DRAFT' && (
            <Popconfirm
              title={t('sales.confirmOrder', 'Confirm this order?')}
              onConfirm={() => handleConfirm(record.id)}
            >
              <Button type="link" size="small" icon={<CheckOutlined />} style={{ color: '#52c41a' }} />
            </Popconfirm>
          )}
          {(record.status === 'DRAFT' || record.status === 'CONFIRMED') && (
            <Popconfirm
              title={t('sales.cancelOrder', 'Cancel this order?')}
              onConfirm={() => handleCancel(record.id)}
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
            {t('sales.ordersTitle', 'Sales Orders')}
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
            {t('sales.newOrder', 'New Order')}
          </Button>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            placeholder={t('sales.filterStatus', 'Filter by status')}
            style={{ width: 180 }}
            allowClear
            value={statusFilter}
            onChange={(val) => {
              setStatusFilter(val);
              setPage(1);
            }}
            options={Object.entries(statusConfig).map(([key, cfg]) => ({
              value: key,
              label: t(`sales.status_${key}`, cfg.label),
            }))}
          />
          <RangePicker
            value={dateRange}
            onChange={(dates) => {
              setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null);
              setPage(1);
            }}
            placeholder={[
              t('common.startDate', 'Start date'),
              t('common.endDate', 'End date'),
            ]}
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
          scroll={{ x: 900 }}
        />
      </Card>

      {/* Create Order Drawer */}
      <Drawer
        title={
          <Space>
            <ShoppingCartOutlined />
            {t('sales.newOrder', 'New Sales Order')}
          </Space>
        }
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={720}
        footer={
          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setDrawerOpen(false)}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button type="primary" loading={submitting} onClick={() => form.submit()}>
                {t('common.create', 'Create Order')}
              </Button>
            </Space>
          </div>
        }
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="customerId"
                label={t('sales.customer', 'Customer')}
                rules={[{ required: true, message: t('sales.customerRequired', 'Please select a customer') }]}
              >
                <Select
                  showSearch
                  placeholder={t('sales.selectCustomer', 'Select customer')}
                  optionFilterProp="label"
                  options={customers.map((c) => ({
                    value: c.id,
                    label: `${c.code} - ${c.name}`,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="orderDate"
                label={t('sales.orderDate', 'Order Date')}
                rules={[{ required: true, message: t('sales.dateRequired', 'Please select date') }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="deliveryDate" label={t('sales.deliveryDate', 'Delivery Date')}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="notes" label={t('sales.notes', 'Notes')}>
                <Input.TextArea rows={1} />
              </Form.Item>
            </Col>
          </Row>

          <Divider>{t('sales.orderItems', 'Order Items')}</Divider>

          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Row gutter={8} key={key} align="middle" style={{ marginBottom: 8 }}>
                    <Col span={8}>
                      <Form.Item
                        {...restField}
                        name={[name, 'productId']}
                        rules={[{ required: true, message: t('sales.productRequired', 'Required') }]}
                        style={{ marginBottom: 0 }}
                      >
                        <Select
                          showSearch
                          placeholder={t('sales.selectProduct', 'Product')}
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
                        rules={[{ required: true, message: t('sales.qtyRequired', 'Req') }]}
                        style={{ marginBottom: 0 }}
                      >
                        <InputNumber
                          placeholder={t('sales.qty', 'Qty')}
                          min={1}
                          style={{ width: '100%' }}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={5}>
                      <Form.Item
                        {...restField}
                        name={[name, 'unitPrice']}
                        rules={[{ required: true, message: t('sales.priceRequired', 'Req') }]}
                        style={{ marginBottom: 0 }}
                      >
                        <InputNumber
                          placeholder={t('sales.price', 'Price')}
                          min={0}
                          precision={2}
                          style={{ width: '100%' }}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={4}>
                      <Form.Item
                        {...restField}
                        name={[name, 'discount']}
                        initialValue={0}
                        style={{ marginBottom: 0 }}
                      >
                        <InputNumber
                          placeholder={t('sales.discount', 'Disc %')}
                          min={0}
                          max={100}
                          style={{ width: '100%' }}
                        />
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
                <Button
                  type="dashed"
                  onClick={() => add()}
                  icon={<PlusOutlined />}
                  block
                  style={{ marginBottom: 16 }}
                >
                  {t('sales.addItem', 'Add Item')}
                </Button>
              </>
            )}
          </Form.List>

          <Form.Item noStyle shouldUpdate>
            {() => (
              <div style={{ textAlign: 'right', marginTop: 8 }}>
                <Text strong style={{ fontSize: 16 }}>
                  {t('sales.estimatedTotal', 'Estimated Total')}: {formatCurrency(calculateItemTotal())}
                </Text>
              </div>
            )}
          </Form.Item>
        </Form>
      </Drawer>

      {/* Order Detail Modal */}
      <Modal
        title={`${t('sales.orderDetails', 'Order Details')} - ${selectedOrder?.orderNumber || ''}`}
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={null}
        width={700}
      >
        {selectedOrder && (
          <>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label={t('sales.orderNumber', 'Order #')}>
                {selectedOrder.orderNumber}
              </Descriptions.Item>
              <Descriptions.Item label={t('sales.status', 'Status')}>
                <Tag color={statusConfig[selectedOrder.status]?.color || 'default'}>
                  {selectedOrder.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('sales.customer', 'Customer')}>
                {selectedOrder.customerName}
              </Descriptions.Item>
              <Descriptions.Item label={t('sales.orderDate', 'Order Date')}>
                {formatDate(selectedOrder.orderDate)}
              </Descriptions.Item>
              <Descriptions.Item label={t('sales.subtotal', 'Subtotal')}>
                {formatCurrency(selectedOrder.subtotal)}
              </Descriptions.Item>
              <Descriptions.Item label={t('sales.tax', 'Tax')}>
                {formatCurrency(selectedOrder.taxAmount)}
              </Descriptions.Item>
              <Descriptions.Item label={t('sales.total', 'Total')} span={2}>
                <Text strong style={{ fontSize: 16 }}>
                  {formatCurrency(selectedOrder.totalAmount)}
                </Text>
              </Descriptions.Item>
              {selectedOrder.notes && (
                <Descriptions.Item label={t('sales.notes', 'Notes')} span={2}>
                  {selectedOrder.notes}
                </Descriptions.Item>
              )}
            </Descriptions>

            <Table
              dataSource={selectedOrder.items}
              rowKey={(_, idx) => String(idx)}
              pagination={false}
              size="small"
              columns={[
                {
                  title: t('sales.product', 'Product'),
                  dataIndex: 'productName',
                  key: 'productName',
                },
                {
                  title: t('sales.qty', 'Qty'),
                  dataIndex: 'quantity',
                  key: 'quantity',
                  width: 70,
                  align: 'right',
                },
                {
                  title: t('sales.unitPrice', 'Unit Price'),
                  dataIndex: 'unitPrice',
                  key: 'unitPrice',
                  width: 120,
                  align: 'right',
                  render: (v: number) => formatCurrency(v),
                },
                {
                  title: t('sales.discount', 'Discount'),
                  dataIndex: 'discount',
                  key: 'discount',
                  width: 90,
                  align: 'right',
                  render: (v: number) => `${v || 0}%`,
                },
                {
                  title: t('sales.lineTotal', 'Total'),
                  dataIndex: 'total',
                  key: 'total',
                  width: 120,
                  align: 'right',
                  render: (v: number) => <Text strong>{formatCurrency(v)}</Text>,
                },
              ]}
            />
          </>
        )}
      </Modal>
    </div>
  );
};

export default SalesOrdersPage;
