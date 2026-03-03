import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useDebounce } from '@/hooks/useDebounce';
import {
  Table,
  Card,
  Button,
  Tag,
  Space,
  Typography,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Divider,
  Row,
  Col,
  Popconfirm,
  message,
  Descriptions,
  Alert,
} from 'antd';
import {
  PlusOutlined,
  EyeOutlined,
  SendOutlined,
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  MinusCircleOutlined,
  SwapOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { api, formatCurrency, formatDate } from '@/utils/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

interface Quotation {
  id: string;
  quoteNumber: string;
  status: string;
  quoteDate: string;
  validUntil?: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  notes?: string;
  terms?: string;
  customer: { id: string; name: string; email?: string };
  items: QuotationItem[];
  _count?: { items: number };
}

interface QuotationItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  totalAmount: number;
  product: { id: string; name: string; code: string; unit?: string };
}

interface Customer {
  id: string;
  name: string;
  code: string;
}

interface Product {
  id: string;
  name: string;
  code: string;
  sellingPrice: number;
  unit: string;
}

interface QuoteFormValues {
  customerId: string;
  quoteDate: dayjs.Dayjs;
  validUntil?: dayjs.Dayjs;
  notes?: string;
  terms?: string;
  items: {
    productId: string;
    quantity: number;
    unitPrice: number;
    discount: number;
  }[];
}

const statusConfig: Record<string, { color: string; label: string }> = {
  DRAFT: { color: 'default', label: 'Draft' },
  SENT: { color: 'blue', label: 'Sent' },
  ACCEPTED: { color: 'green', label: 'Accepted' },
  REJECTED: { color: 'red', label: 'Rejected' },
  EXPIRED: { color: 'orange', label: 'Expired' },
  CONVERTED: { color: 'purple', label: 'Converted to SO' },
};

const QuotationsPage: React.FC = () => {
  const { t } = useTranslation();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [form] = Form.useForm<QuoteFormValues>();

  const fetchQuotations = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/sales/quotations', {
        params: {
          page,
          limit: pageSize,
          search: debouncedSearch || undefined,
          status: statusFilter || undefined,
        },
      });
      setQuotations(data.data || data);
      setTotal(data.total || 0);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, statusFilter]);

  const fetchDropdownData = useCallback(async () => {
    try {
      const [customersRes, productsRes] = await Promise.all([
        api.get('/sales/customers', { params: { limit: 500 } }),
        api.get('/products', { params: { limit: 500 } }),
      ]);
      setCustomers(customersRes.data.data || customersRes.data || []);
      setProducts(productsRes.data.data || productsRes.data || []);
    } catch {
      // handled
    }
  }, []);

  useEffect(() => {
    fetchQuotations();
  }, [fetchQuotations]);

  useEffect(() => {
    fetchDropdownData();
  }, [fetchDropdownData]);

  const handleCreate = async (values: QuoteFormValues) => {
    setSubmitting(true);
    try {
      await api.post('/sales/quotations', {
        customerId: values.customerId,
        quoteDate: values.quoteDate.toISOString(),
        validUntil: values.validUntil?.toISOString(),
        notes: values.notes,
        terms: values.terms,
        items: values.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount || 0,
        })),
      });
      message.success(t('quotations.createSuccess', 'Quotation created successfully'));
      setCreateModalOpen(false);
      form.resetFields();
      fetchQuotations();
    } catch {
      // handled
    } finally {
      setSubmitting(false);
    }
  };

  const handleAction = async (id: string, action: string) => {
    try {
      const { data } = await api.patch(`/sales/quotations/${id}`, { action });
      if (action === 'convert') {
        message.success(t('quotations.convertSuccess', `Converted to ${data.salesOrder?.orderNumber || 'Sales Order'}`));
      } else {
        message.success(t(`quotations.${action}Success`, `Quotation ${action} successfully`));
      }
      fetchQuotations();
      setDetailModalOpen(false);
    } catch {
      // handled
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/sales/quotations/${id}`);
      message.success(t('quotations.deleteSuccess', 'Quotation deleted'));
      fetchQuotations();
    } catch {
      // handled
    }
  };

  const handleViewDetails = async (quotation: Quotation) => {
    try {
      const { data } = await api.get(`/sales/quotations/${quotation.id}`);
      setSelectedQuotation(data);
    } catch {
      setSelectedQuotation(quotation);
    }
    setDetailModalOpen(true);
  };

  const calculateItemTotal = () => {
    const items = form.getFieldValue('items') || [];
    return items.reduce((sum: number, item: any) => {
      if (!item) return sum;
      const qty = Number(item.quantity || 0);
      const price = Number(item.unitPrice || 0);
      const disc = Number(item.discount || 0);
      return sum + (qty * price - disc);
    }, 0);
  };

  const columns: ColumnsType<Quotation> = [
    {
      title: t('quotations.quoteNumber', 'Quote #'),
      dataIndex: 'quoteNumber',
      key: 'quoteNumber',
      width: 140,
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: t('quotations.customer', 'Customer'),
      key: 'customer',
      ellipsis: true,
      render: (_: unknown, record: Quotation) => record.customer?.name || '-',
    },
    {
      title: t('quotations.date', 'Date'),
      dataIndex: 'quoteDate',
      key: 'quoteDate',
      width: 110,
      render: (date: string) => formatDate(date),
    },
    {
      title: t('quotations.validUntil', 'Valid Until'),
      dataIndex: 'validUntil',
      key: 'validUntil',
      width: 110,
      render: (date: string) => date ? formatDate(date) : '-',
    },
    {
      title: t('quotations.amount', 'Amount'),
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      width: 140,
      align: 'right',
      render: (amount: number) => <Text strong>{formatCurrency(amount)}</Text>,
    },
    {
      title: t('quotations.items', 'Items'),
      key: 'items',
      width: 70,
      align: 'center',
      render: (_: unknown, record: Quotation) => record._count?.items || record.items?.length || 0,
    },
    {
      title: t('quotations.status', 'Status'),
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (status: string) => {
        const config = statusConfig[status] || { color: 'default', label: status };
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: t('common.actions', 'Actions'),
      key: 'actions',
      width: 200,
      render: (_: unknown, record: Quotation) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetails(record)} />
          {record.status === 'DRAFT' && (
            <Button type="link" size="small" icon={<SendOutlined />} onClick={() => handleAction(record.id, 'send')}>
              Send
            </Button>
          )}
          {record.status === 'ACCEPTED' && (
            <Button type="link" size="small" icon={<SwapOutlined />} onClick={() => handleAction(record.id, 'convert')}>
              Convert
            </Button>
          )}
          {record.status === 'DRAFT' && (
            <Popconfirm title="Delete this quotation?" onConfirm={() => handleDelete(record.id)}>
              <Button type="link" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            <Space>
              <FileTextOutlined />
              {t('quotations.title', 'Quotations')}
            </Space>
          </Title>
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => {
            form.resetFields();
            form.setFieldsValue({ quoteDate: dayjs(), items: [{}] });
            setCreateModalOpen(true);
          }}>
            {t('quotations.createQuotation', 'New Quotation')}
          </Button>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder={t('quotations.searchPlaceholder', 'Search quotations...')}
            prefix={<FileTextOutlined />}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            allowClear
            style={{ width: 280 }}
          />
          <Select
            placeholder={t('quotations.filterStatus', 'Filter by status')}
            value={statusFilter || undefined}
            onChange={(v) => { setStatusFilter(v || ''); setPage(1); }}
            allowClear
            style={{ width: 160 }}
            options={Object.entries(statusConfig).map(([value, config]) => ({
              value,
              label: config.label,
            }))}
          />
        </Space>
      </Card>

      <Card>
        <Table
          dataSource={quotations}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (t) => `Total ${t} quotations`,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
          }}
          scroll={{ x: 1000 }}
        />
      </Card>

      {/* Create Quotation Modal */}
      <Modal
        title={t('quotations.createQuotation', 'New Quotation')}
        open={createModalOpen}
        onCancel={() => { setCreateModalOpen(false); form.resetFields(); }}
        footer={null}
        width={800}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleCreate} style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="customerId"
                label={t('quotations.customer', 'Customer')}
                rules={[{ required: true, message: 'Customer is required' }]}
              >
                <Select
                  showSearch
                  placeholder="Select customer"
                  filterOption={(input, option) =>
                    (option?.label as string || '').toLowerCase().includes(input.toLowerCase())
                  }
                  options={customers.map((c) => ({ value: c.id, label: `${c.code} - ${c.name}` }))}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="quoteDate"
                label={t('quotations.date', 'Quote Date')}
                rules={[{ required: true }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="validUntil" label={t('quotations.validUntil', 'Valid Until')}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Divider>{t('quotations.items', 'Items')}</Divider>

          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Row key={key} gutter={8} align="middle">
                    <Col span={8}>
                      <Form.Item
                        {...restField}
                        name={[name, 'productId']}
                        rules={[{ required: true, message: 'Required' }]}
                      >
                        <Select
                          showSearch
                          placeholder="Product"
                          filterOption={(input, option) =>
                            (option?.label as string || '').toLowerCase().includes(input.toLowerCase())
                          }
                          options={products.map((p) => ({
                            value: p.id,
                            label: `${p.code} - ${p.name}`,
                          }))}
                          onChange={(productId) => {
                            const product = products.find((p) => p.id === productId);
                            if (product) {
                              const items = form.getFieldValue('items');
                              items[name] = {
                                ...items[name],
                                unitPrice: Number(product.sellingPrice),
                                quantity: 1,
                                discount: 0,
                              };
                              form.setFieldsValue({ items });
                            }
                          }}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={4}>
                      <Form.Item
                        {...restField}
                        name={[name, 'quantity']}
                        rules={[{ required: true, message: 'Required' }]}
                      >
                        <InputNumber placeholder="Qty" min={1} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={5}>
                      <Form.Item
                        {...restField}
                        name={[name, 'unitPrice']}
                        rules={[{ required: true, message: 'Required' }]}
                      >
                        <InputNumber placeholder="Unit Price" min={0} precision={2} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={4}>
                      <Form.Item {...restField} name={[name, 'discount']}>
                        <InputNumber placeholder="Discount" min={0} precision={2} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={3}>
                      <Button
                        danger
                        icon={<MinusCircleOutlined />}
                        onClick={() => remove(name)}
                        disabled={fields.length <= 1}
                        style={{ marginBottom: 24 }}
                      />
                    </Col>
                  </Row>
                ))}
                <Form.Item>
                  <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                    {t('quotations.addItem', 'Add Item')}
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>

          <Form.Item shouldUpdate>
            {() => (
              <Alert
                type="info"
                message={
                  <Space>
                    <Text>{t('quotations.estimatedTotal', 'Estimated Total')}:</Text>
                    <Text strong style={{ fontSize: 16 }}>{formatCurrency(calculateItemTotal())}</Text>
                  </Space>
                }
              />
            )}
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="notes" label={t('quotations.notes', 'Notes')}>
                <Input.TextArea rows={2} placeholder="Internal notes..." />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="terms" label={t('quotations.terms', 'Terms & Conditions')}>
                <Input.TextArea rows={2} placeholder="Payment terms, delivery terms..." />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => setCreateModalOpen(false)}>{t('common.cancel', 'Cancel')}</Button>
              <Button type="primary" htmlType="submit" loading={submitting}>
                {t('quotations.create', 'Create Quotation')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail Modal */}
      <Modal
        title={
          <Space>
            <FileTextOutlined />
            {selectedQuotation?.quoteNumber || 'Quotation Details'}
          </Space>
        }
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        width={700}
        footer={
          selectedQuotation ? (
            <Space>
              {selectedQuotation.status === 'DRAFT' && (
                <Button type="primary" icon={<SendOutlined />} onClick={() => handleAction(selectedQuotation.id, 'send')}>
                  Send to Customer
                </Button>
              )}
              {['DRAFT', 'SENT'].includes(selectedQuotation.status) && (
                <>
                  <Button type="primary" icon={<CheckOutlined />} style={{ background: '#52c41a' }}
                    onClick={() => handleAction(selectedQuotation.id, 'accept')}>
                    Accept
                  </Button>
                  <Popconfirm title="Reject this quotation?" onConfirm={() => handleAction(selectedQuotation.id, 'reject')}>
                    <Button danger icon={<CloseOutlined />}>Reject</Button>
                  </Popconfirm>
                </>
              )}
              {selectedQuotation.status === 'ACCEPTED' && (
                <Button type="primary" icon={<SwapOutlined />} onClick={() => handleAction(selectedQuotation.id, 'convert')}>
                  Convert to Sales Order
                </Button>
              )}
            </Space>
          ) : null
        }
      >
        {selectedQuotation && (
          <>
            <Descriptions bordered column={2} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Quote #">
                <Text strong>{selectedQuotation.quoteNumber}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={statusConfig[selectedQuotation.status]?.color || 'default'}>
                  {statusConfig[selectedQuotation.status]?.label || selectedQuotation.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Customer">{selectedQuotation.customer?.name}</Descriptions.Item>
              <Descriptions.Item label="Date">{formatDate(selectedQuotation.quoteDate)}</Descriptions.Item>
              <Descriptions.Item label="Valid Until">
                {selectedQuotation.validUntil ? formatDate(selectedQuotation.validUntil) : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Total">
                <Text strong style={{ fontSize: 16 }}>{formatCurrency(selectedQuotation.totalAmount)}</Text>
              </Descriptions.Item>
            </Descriptions>

            <Title level={5}>Items</Title>
            <Table
              dataSource={selectedQuotation.items || []}
              rowKey="id"
              pagination={false}
              size="small"
              columns={[
                {
                  title: 'Product',
                  key: 'product',
                  render: (_: unknown, item: QuotationItem) => (
                    <Space direction="vertical" size={0}>
                      <Text strong>{item.product?.name}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>{item.product?.code}</Text>
                    </Space>
                  ),
                },
                { title: 'Qty', dataIndex: 'quantity', align: 'right' as const, width: 80 },
                {
                  title: 'Unit Price',
                  dataIndex: 'unitPrice',
                  align: 'right' as const,
                  width: 120,
                  render: (v: number) => formatCurrency(v),
                },
                {
                  title: 'Discount',
                  dataIndex: 'discount',
                  align: 'right' as const,
                  width: 100,
                  render: (v: number) => v > 0 ? formatCurrency(v) : '-',
                },
                {
                  title: 'Total',
                  dataIndex: 'totalAmount',
                  align: 'right' as const,
                  width: 120,
                  render: (v: number) => <Text strong>{formatCurrency(v)}</Text>,
                },
              ]}
            />

            {selectedQuotation.notes && (
              <div style={{ marginTop: 16 }}>
                <Text type="secondary">Notes: </Text>
                <Text>{selectedQuotation.notes}</Text>
              </div>
            )}
            {selectedQuotation.terms && (
              <div style={{ marginTop: 8 }}>
                <Text type="secondary">Terms: </Text>
                <Text>{selectedQuotation.terms}</Text>
              </div>
            )}
          </>
        )}
      </Modal>
    </div>
  );
};

export default QuotationsPage;
