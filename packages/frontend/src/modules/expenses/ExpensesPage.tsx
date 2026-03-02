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
  Input,
  InputNumber,
  Select,
  DatePicker,
  Divider,
  Row,
  Col,
  Popconfirm,
  Tabs,
  message,
  Descriptions,
  Badge,
} from 'antd';
import {
  PlusOutlined,
  EyeOutlined,
  SendOutlined,
  CheckOutlined,
  CloseOutlined,
  MinusCircleOutlined,
  WalletOutlined,
  AuditOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { api, formatCurrency, formatDate } from '@/utils/api';
import { useAuthStore } from '@/store/authStore';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

interface ExpenseClaim {
  id: string;
  claimNumber: string;
  title: string;
  date: string;
  status: string;
  totalAmount: number;
  submittedBy: string;
  submittedByName?: string;
  approvedBy?: string;
  approvedByName?: string;
  notes?: string;
  items: ExpenseItem[];
}

interface ExpenseItem {
  id?: string;
  description: string;
  category: string;
  amount: number;
  receipt?: string;
}

interface ClaimFormValues {
  title: string;
  date: dayjs.Dayjs;
  notes?: string;
  items: {
    description: string;
    category: string;
    amount: number;
  }[];
}

const statusConfig: Record<string, { color: string; label: string }> = {
  DRAFT: { color: 'default', label: 'Draft' },
  SUBMITTED: { color: 'blue', label: 'Submitted' },
  APPROVED: { color: 'green', label: 'Approved' },
  REJECTED: { color: 'red', label: 'Rejected' },
  PAID: { color: 'cyan', label: 'Paid' },
};

const categoryOptions = [
  { value: 'TRAVEL', label: 'Travel' },
  { value: 'MEALS', label: 'Meals & Entertainment' },
  { value: 'SUPPLIES', label: 'Office Supplies' },
  { value: 'TRANSPORT', label: 'Transportation' },
  { value: 'ACCOMMODATION', label: 'Accommodation' },
  { value: 'UTILITIES', label: 'Utilities' },
  { value: 'COMMUNICATION', label: 'Communication' },
  { value: 'OTHER', label: 'Other' },
];

const ExpensesPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [myExpenses, setMyExpenses] = useState<ExpenseClaim[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<ExpenseClaim[]>([]);
  const [loading, setLoading] = useState(false);
  const [approvalsLoading, setApprovalsLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<ExpenseClaim | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<ClaimFormValues>();

  const isManager = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const fetchMyExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/expenses', { params: { page, limit: 10 } });
      setMyExpenses(data.data || data);
      setTotal(data.total || 0);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, [page]);

  const fetchPendingApprovals = useCallback(async () => {
    if (!isManager) return;
    setApprovalsLoading(true);
    try {
      const { data } = await api.get('/expenses/pending-approvals');
      setPendingApprovals(data.data || data);
    } catch {
      // handled
    } finally {
      setApprovalsLoading(false);
    }
  }, [isManager]);

  useEffect(() => {
    fetchMyExpenses();
  }, [fetchMyExpenses]);

  useEffect(() => {
    fetchPendingApprovals();
  }, [fetchPendingApprovals]);

  const handleCreate = async (values: ClaimFormValues) => {
    setSubmitting(true);
    try {
      await api.post('/expenses', {
        title: values.title,
        date: values.date.format('YYYY-MM-DD'),
        notes: values.notes,
        items: values.items,
      });
      message.success(t('expenses.createSuccess', 'Expense claim created'));
      setCreateModalOpen(false);
      form.resetFields();
      fetchMyExpenses();
    } catch {
      // handled
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitClaim = async (id: string) => {
    try {
      await api.post(`/expenses/${id}/submit`);
      message.success(t('expenses.submitSuccess', 'Expense claim submitted'));
      fetchMyExpenses();
    } catch {
      // handled
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await api.post(`/expenses/${id}/approve`);
      message.success(t('expenses.approveSuccess', 'Expense claim approved'));
      fetchPendingApprovals();
      fetchMyExpenses();
    } catch {
      // handled
    }
  };

  const handleReject = async (id: string) => {
    try {
      await api.post(`/expenses/${id}/reject`);
      message.success(t('expenses.rejectSuccess', 'Expense claim rejected'));
      fetchPendingApprovals();
      fetchMyExpenses();
    } catch {
      // handled
    }
  };

  const handleViewDetails = async (claim: ExpenseClaim) => {
    try {
      const { data } = await api.get(`/expenses/${claim.id}`);
      setSelectedClaim(data);
    } catch {
      setSelectedClaim(claim);
    }
    setDetailModalOpen(true);
  };

  const calculateTotal = (): number => {
    const items = form.getFieldValue('items') || [];
    return items.reduce((sum: number, item: { amount?: number }) => {
      return sum + (item?.amount || 0);
    }, 0);
  };

  const baseColumns: ColumnsType<ExpenseClaim> = [
    {
      title: t('expenses.claimNumber', 'Claim #'),
      dataIndex: 'claimNumber',
      key: 'claimNumber',
      width: 130,
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: t('expenses.expenseTitle', 'Title'),
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: t('expenses.date', 'Date'),
      dataIndex: 'date',
      key: 'date',
      width: 120,
      render: (date: string) => formatDate(date),
    },
    {
      title: t('expenses.amount', 'Amount'),
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      width: 140,
      align: 'right',
      render: (amount: number) => <Text strong>{formatCurrency(amount)}</Text>,
    },
    {
      title: t('expenses.status', 'Status'),
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status: string) => {
        const cfg = statusConfig[status] || { color: 'default', label: status };
        return <Tag color={cfg.color}>{t(`expenses.status_${status}`, cfg.label)}</Tag>;
      },
    },
  ];

  const myExpenseColumns: ColumnsType<ExpenseClaim> = [
    ...baseColumns,
    {
      title: t('common.actions', 'Actions'),
      key: 'actions',
      width: 150,
      render: (_: unknown, record: ExpenseClaim) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetails(record)}
          />
          {record.status === 'DRAFT' && (
            <Popconfirm
              title={t('expenses.submitConfirm', 'Submit this claim for approval?')}
              onConfirm={() => handleSubmitClaim(record.id)}
            >
              <Button type="link" size="small" icon={<SendOutlined />} style={{ color: '#1890ff' }} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const approvalColumns: ColumnsType<ExpenseClaim> = [
    ...baseColumns,
    {
      title: t('expenses.submittedBy', 'Submitted By'),
      dataIndex: 'submittedByName',
      key: 'submittedByName',
      width: 140,
    },
    {
      title: t('common.actions', 'Actions'),
      key: 'actions',
      width: 160,
      render: (_: unknown, record: ExpenseClaim) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetails(record)}
          />
          <Popconfirm
            title={t('expenses.approveConfirm', 'Approve this claim?')}
            onConfirm={() => handleApprove(record.id)}
          >
            <Button type="link" size="small" icon={<CheckOutlined />} style={{ color: '#52c41a' }} />
          </Popconfirm>
          <Popconfirm
            title={t('expenses.rejectConfirm', 'Reject this claim?')}
            onConfirm={() => handleReject(record.id)}
          >
            <Button type="link" size="small" danger icon={<CloseOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'my',
      label: (
        <Space>
          <WalletOutlined />
          {t('expenses.myExpenses', 'My Expenses')}
        </Space>
      ),
      children: (
        <>
          <Row justify="end" style={{ marginBottom: 16 }}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                form.resetFields();
                form.setFieldsValue({ date: dayjs(), items: [{}] });
                setCreateModalOpen(true);
              }}
            >
              {t('expenses.newClaim', 'New Expense Claim')}
            </Button>
          </Row>
          <Table
            dataSource={myExpenses}
            columns={myExpenseColumns}
            rowKey="id"
            loading={loading}
            pagination={{
              current: page,
              pageSize: 10,
              total,
              showTotal: (total) => t('common.totalItems', 'Total {{total}} items', { total }),
              onChange: (p) => setPage(p),
            }}
            scroll={{ x: 800 }}
          />
        </>
      ),
    },
    ...(isManager
      ? [
          {
            key: 'approvals',
            label: (
              <Badge count={pendingApprovals.length} offset={[10, 0]}>
                <Space>
                  <AuditOutlined />
                  {t('expenses.pendingApprovals', 'Pending Approvals')}
                </Space>
              </Badge>
            ),
            children: (
              <Table
                dataSource={pendingApprovals}
                columns={approvalColumns}
                rowKey="id"
                loading={approvalsLoading}
                pagination={false}
                scroll={{ x: 900 }}
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={3} style={{ marginBottom: 24 }}>
        {t('expenses.title', 'Expenses')}
      </Title>

      <Card>
        <Tabs items={tabItems} />
      </Card>

      {/* Create Expense Claim Modal */}
      <Modal
        title={t('expenses.newClaim', 'New Expense Claim')}
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false);
          form.resetFields();
        }}
        footer={null}
        width={700}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleCreate} style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="title"
                label={t('expenses.claimTitle', 'Title')}
                rules={[{ required: true, message: t('expenses.titleRequired', 'Required') }]}
              >
                <Input placeholder={t('expenses.titlePlaceholder', 'e.g., Business Trip to Bangkok')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="date"
                label={t('expenses.date', 'Date')}
                rules={[{ required: true }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="notes" label={t('expenses.notes', 'Notes')}>
            <Input.TextArea rows={2} />
          </Form.Item>

          <Divider>{t('expenses.expenseItems', 'Expense Items')}</Divider>

          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Row gutter={8} key={key} align="middle" style={{ marginBottom: 8 }}>
                    <Col span={9}>
                      <Form.Item
                        {...restField}
                        name={[name, 'description']}
                        rules={[{ required: true, message: t('expenses.descRequired', 'Required') }]}
                        style={{ marginBottom: 0 }}
                      >
                        <Input placeholder={t('expenses.itemDescription', 'Description')} />
                      </Form.Item>
                    </Col>
                    <Col span={7}>
                      <Form.Item
                        {...restField}
                        name={[name, 'category']}
                        rules={[{ required: true, message: t('expenses.catRequired', 'Required') }]}
                        style={{ marginBottom: 0 }}
                      >
                        <Select
                          placeholder={t('expenses.selectCategory', 'Category')}
                          options={categoryOptions.map((opt) => ({
                            ...opt,
                            label: t(`expenses.cat_${opt.value}`, opt.label),
                          }))}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={5}>
                      <Form.Item
                        {...restField}
                        name={[name, 'amount']}
                        rules={[{ required: true, message: t('expenses.amountRequired', 'Required') }]}
                        style={{ marginBottom: 0 }}
                      >
                        <InputNumber
                          placeholder={t('expenses.amount', 'Amount')}
                          min={0}
                          precision={2}
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
                  {t('expenses.addItem', 'Add Item')}
                </Button>
              </>
            )}
          </Form.List>

          <Form.Item noStyle shouldUpdate>
            {() => (
              <div style={{ textAlign: 'right', marginBottom: 16 }}>
                <Text strong style={{ fontSize: 16 }}>
                  {t('expenses.totalAmount', 'Total')}: {formatCurrency(calculateTotal())}
                </Text>
              </div>
            )}
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setCreateModalOpen(false)}>{t('common.cancel', 'Cancel')}</Button>
              <Button type="primary" htmlType="submit" loading={submitting}>
                {t('expenses.saveDraft', 'Save as Draft')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail Modal */}
      <Modal
        title={`${t('expenses.claimDetails', 'Expense Claim')} - ${selectedClaim?.claimNumber || ''}`}
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={null}
        width={650}
      >
        {selectedClaim && (
          <>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label={t('expenses.claimNumber', 'Claim #')}>
                {selectedClaim.claimNumber}
              </Descriptions.Item>
              <Descriptions.Item label={t('expenses.status', 'Status')}>
                <Tag color={statusConfig[selectedClaim.status]?.color || 'default'}>
                  {selectedClaim.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('expenses.expenseTitle', 'Title')}>
                {selectedClaim.title}
              </Descriptions.Item>
              <Descriptions.Item label={t('expenses.date', 'Date')}>
                {formatDate(selectedClaim.date)}
              </Descriptions.Item>
              <Descriptions.Item label={t('expenses.totalAmount', 'Total')} span={2}>
                <Text strong style={{ fontSize: 16 }}>{formatCurrency(selectedClaim.totalAmount)}</Text>
              </Descriptions.Item>
              {selectedClaim.notes && (
                <Descriptions.Item label={t('expenses.notes', 'Notes')} span={2}>
                  {selectedClaim.notes}
                </Descriptions.Item>
              )}
            </Descriptions>
            <Table
              dataSource={selectedClaim.items}
              rowKey={(_, idx) => String(idx)}
              pagination={false}
              size="small"
              columns={[
                {
                  title: t('expenses.itemDescription', 'Description'),
                  dataIndex: 'description',
                  key: 'description',
                },
                {
                  title: t('expenses.category', 'Category'),
                  dataIndex: 'category',
                  key: 'category',
                  width: 140,
                  render: (cat: string) => <Tag>{cat}</Tag>,
                },
                {
                  title: t('expenses.amount', 'Amount'),
                  dataIndex: 'amount',
                  key: 'amount',
                  width: 130,
                  align: 'right' as const,
                  render: (v: number) => formatCurrency(v),
                },
              ]}
              summary={(pageData) => {
                const total = pageData.reduce((sum, item) => sum + (item.amount || 0), 0);
                return (
                  <Table.Summary fixed>
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0} colSpan={2}>
                        <Text strong>{t('expenses.totalAmount', 'Total')}</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={2} align="right">
                        <Text strong>{formatCurrency(total)}</Text>
                      </Table.Summary.Cell>
                    </Table.Summary.Row>
                  </Table.Summary>
                );
              }}
            />
          </>
        )}
      </Modal>
    </div>
  );
};

export default ExpensesPage;
