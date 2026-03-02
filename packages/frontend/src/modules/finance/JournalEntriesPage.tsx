import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Table,
  Card,
  Button,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Space,
  Typography,
  Row,
  Col,
  Popconfirm,
  DatePicker,
  Divider,
  Alert,
  message,
} from 'antd';
import {
  PlusOutlined,
  EyeOutlined,
  CheckOutlined,
  StopOutlined,
  MinusCircleOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { api, formatCurrency, formatDate } from '@/utils/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

interface JournalEntry {
  id: string;
  entryNumber: string;
  date: string;
  description: string;
  status: string;
  totalDebit: number;
  totalCredit: number;
  reference?: string;
  lines: JournalLine[];
  createdBy?: string;
}

interface JournalLine {
  id?: string;
  accountId: string;
  accountName?: string;
  accountCode?: string;
  description?: string;
  debit: number;
  credit: number;
}

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface EntryFormValues {
  date: dayjs.Dayjs;
  description: string;
  reference?: string;
  lines: {
    accountId: string;
    description?: string;
    debit: number;
    credit: number;
  }[];
}

const statusConfig: Record<string, { color: string; label: string }> = {
  DRAFT: { color: 'blue', label: 'Draft' },
  POSTED: { color: 'green', label: 'Posted' },
  VOIDED: { color: 'red', label: 'Voided' },
};

const JournalEntriesPage: React.FC = () => {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [balanceError, setBalanceError] = useState(false);
  const [form] = Form.useForm<EntryFormValues>();

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/finance/journal-entries', {
        params: { page, limit: pageSize },
      });
      setEntries(data.data || data);
      setTotal(data.total || 0);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  const fetchAccounts = async () => {
    try {
      const { data } = await api.get('/finance/accounts');
      setAccounts(data.data || data);
    } catch {
      // handled
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const calculateTotals = (): { totalDebit: number; totalCredit: number } => {
    const lines = form.getFieldValue('lines') || [];
    let totalDebit = 0;
    let totalCredit = 0;
    lines.forEach((line: { debit?: number; credit?: number }) => {
      if (line) {
        totalDebit += line.debit || 0;
        totalCredit += line.credit || 0;
      }
    });
    return { totalDebit, totalCredit };
  };

  const handleCreate = async (values: EntryFormValues) => {
    const { totalDebit, totalCredit } = calculateTotals();
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      setBalanceError(true);
      message.error(t('journal.debitCreditMismatch', 'Total debits must equal total credits'));
      return;
    }
    setBalanceError(false);
    setSubmitting(true);
    try {
      await api.post('/finance/journal-entries', {
        date: values.date.format('YYYY-MM-DD'),
        description: values.description,
        reference: values.reference,
        lines: values.lines.map((line) => ({
          accountId: line.accountId,
          description: line.description,
          debit: line.debit || 0,
          credit: line.credit || 0,
        })),
      });
      message.success(t('journal.createSuccess', 'Journal entry created'));
      setCreateModalOpen(false);
      form.resetFields();
      fetchEntries();
    } catch {
      // handled
    } finally {
      setSubmitting(false);
    }
  };

  const handlePost = async (id: string) => {
    try {
      await api.post(`/finance/journal-entries/${id}/post`);
      message.success(t('journal.postSuccess', 'Journal entry posted'));
      fetchEntries();
    } catch {
      // handled
    }
  };

  const handleVoid = async (id: string) => {
    try {
      await api.post(`/finance/journal-entries/${id}/void`);
      message.success(t('journal.voidSuccess', 'Journal entry voided'));
      fetchEntries();
    } catch {
      // handled
    }
  };

  const handleViewDetails = async (entry: JournalEntry) => {
    try {
      const { data } = await api.get(`/finance/journal-entries/${entry.id}`);
      setSelectedEntry(data);
    } catch {
      setSelectedEntry(entry);
    }
    setDetailModalOpen(true);
  };

  const columns: ColumnsType<JournalEntry> = [
    {
      title: t('journal.entryNumber', 'Entry #'),
      dataIndex: 'entryNumber',
      key: 'entryNumber',
      width: 130,
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: t('journal.date', 'Date'),
      dataIndex: 'date',
      key: 'date',
      width: 120,
      render: (date: string) => formatDate(date),
    },
    {
      title: t('journal.description', 'Description'),
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: t('journal.reference', 'Reference'),
      dataIndex: 'reference',
      key: 'reference',
      width: 130,
      render: (text: string) => (text ? <Text code>{text}</Text> : '-'),
    },
    {
      title: t('journal.debit', 'Debit'),
      dataIndex: 'totalDebit',
      key: 'totalDebit',
      width: 140,
      align: 'right',
      render: (amount: number) => formatCurrency(amount),
    },
    {
      title: t('journal.credit', 'Credit'),
      dataIndex: 'totalCredit',
      key: 'totalCredit',
      width: 140,
      align: 'right',
      render: (amount: number) => formatCurrency(amount),
    },
    {
      title: t('journal.status', 'Status'),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const cfg = statusConfig[status] || { color: 'default', label: status };
        return <Tag color={cfg.color}>{t(`journal.status_${status}`, cfg.label)}</Tag>;
      },
    },
    {
      title: t('common.actions', 'Actions'),
      key: 'actions',
      width: 150,
      render: (_: unknown, record: JournalEntry) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetails(record)}
          />
          {record.status === 'DRAFT' && (
            <Popconfirm
              title={t('journal.postConfirm', 'Post this entry?')}
              onConfirm={() => handlePost(record.id)}
            >
              <Button type="link" size="small" icon={<CheckOutlined />} style={{ color: '#52c41a' }} />
            </Popconfirm>
          )}
          {record.status === 'POSTED' && (
            <Popconfirm
              title={t('journal.voidConfirm', 'Void this entry?')}
              onConfirm={() => handleVoid(record.id)}
            >
              <Button type="link" size="small" danger icon={<StopOutlined />} />
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
            <Space>
              <FileTextOutlined />
              {t('journal.title', 'Journal Entries')}
            </Space>
          </Title>
        </Col>
        <Col>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              form.resetFields();
              form.setFieldsValue({
                date: dayjs(),
                lines: [{ debit: 0, credit: 0 }, { debit: 0, credit: 0 }],
              });
              setBalanceError(false);
              setCreateModalOpen(true);
            }}
          >
            {t('journal.newEntry', 'New Journal Entry')}
          </Button>
        </Col>
      </Row>

      <Card>
        <Table
          dataSource={entries}
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

      {/* Create Journal Entry Modal */}
      <Modal
        title={t('journal.newEntry', 'New Journal Entry')}
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false);
          form.resetFields();
          setBalanceError(false);
        }}
        footer={null}
        width={800}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleCreate} style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="date"
                label={t('journal.date', 'Date')}
                rules={[{ required: true, message: t('journal.dateRequired', 'Required') }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="description"
                label={t('journal.description', 'Description')}
                rules={[{ required: true, message: t('journal.descRequired', 'Required') }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="reference" label={t('journal.reference', 'Reference')}>
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Divider>{t('journal.lines', 'Journal Lines')}</Divider>

          {balanceError && (
            <Alert
              type="error"
              message={t('journal.debitCreditMismatch', 'Total debits must equal total credits')}
              style={{ marginBottom: 16 }}
              showIcon
            />
          )}

          <Row gutter={8} style={{ marginBottom: 8, fontWeight: 'bold' }}>
            <Col span={8}>{t('journal.account', 'Account')}</Col>
            <Col span={6}>{t('journal.lineDescription', 'Description')}</Col>
            <Col span={4}>{t('journal.debit', 'Debit')}</Col>
            <Col span={4}>{t('journal.credit', 'Credit')}</Col>
            <Col span={2} />
          </Row>

          <Form.List name="lines">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Row gutter={8} key={key} align="middle" style={{ marginBottom: 8 }}>
                    <Col span={8}>
                      <Form.Item
                        {...restField}
                        name={[name, 'accountId']}
                        rules={[{ required: true, message: t('journal.accountRequired', 'Required') }]}
                        style={{ marginBottom: 0 }}
                      >
                        <Select
                          showSearch
                          optionFilterProp="label"
                          placeholder={t('journal.selectAccount', 'Account')}
                          options={accounts.map((a) => ({
                            value: a.id,
                            label: `${a.code} - ${a.name}`,
                          }))}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item
                        {...restField}
                        name={[name, 'description']}
                        style={{ marginBottom: 0 }}
                      >
                        <Input placeholder={t('journal.lineNote', 'Note')} />
                      </Form.Item>
                    </Col>
                    <Col span={4}>
                      <Form.Item
                        {...restField}
                        name={[name, 'debit']}
                        style={{ marginBottom: 0 }}
                      >
                        <InputNumber
                          min={0}
                          precision={2}
                          style={{ width: '100%' }}
                          placeholder="0.00"
                          onChange={() => {
                            const lines = form.getFieldValue('lines');
                            if (lines[name]?.debit > 0) {
                              lines[name].credit = 0;
                              form.setFieldsValue({ lines });
                            }
                          }}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={4}>
                      <Form.Item
                        {...restField}
                        name={[name, 'credit']}
                        style={{ marginBottom: 0 }}
                      >
                        <InputNumber
                          min={0}
                          precision={2}
                          style={{ width: '100%' }}
                          placeholder="0.00"
                          onChange={() => {
                            const lines = form.getFieldValue('lines');
                            if (lines[name]?.credit > 0) {
                              lines[name].debit = 0;
                              form.setFieldsValue({ lines });
                            }
                          }}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={2}>
                      <Button
                        type="text"
                        danger
                        icon={<MinusCircleOutlined />}
                        onClick={() => remove(name)}
                        disabled={fields.length <= 2}
                      />
                    </Col>
                  </Row>
                ))}
                <Button
                  type="dashed"
                  onClick={() => add({ debit: 0, credit: 0 })}
                  icon={<PlusOutlined />}
                  block
                  style={{ marginBottom: 16 }}
                >
                  {t('journal.addLine', 'Add Line')}
                </Button>
              </>
            )}
          </Form.List>

          <Form.Item noStyle shouldUpdate>
            {() => {
              const { totalDebit, totalCredit } = calculateTotals();
              const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;
              return (
                <Row gutter={16} style={{ marginBottom: 16 }}>
                  <Col span={12}>
                    <Card size="small">
                      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Text strong>{t('journal.totalDebit', 'Total Debit')}:</Text>
                        <Text strong>{formatCurrency(totalDebit)}</Text>
                      </Space>
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card size="small">
                      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Text strong>{t('journal.totalCredit', 'Total Credit')}:</Text>
                        <Text strong>{formatCurrency(totalCredit)}</Text>
                      </Space>
                    </Card>
                  </Col>
                  <Col span={24} style={{ marginTop: 8 }}>
                    <Tag color={isBalanced ? 'green' : 'red'} style={{ fontSize: 14, padding: '4px 12px' }}>
                      {isBalanced
                        ? t('journal.balanced', 'Balanced')
                        : t('journal.unbalanced', `Difference: ${formatCurrency(Math.abs(totalDebit - totalCredit))}`)}
                    </Tag>
                  </Col>
                </Row>
              );
            }}
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setCreateModalOpen(false)}>{t('common.cancel', 'Cancel')}</Button>
              <Button type="primary" htmlType="submit" loading={submitting}>
                {t('journal.save', 'Save Entry')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail Modal */}
      <Modal
        title={`${t('journal.entryDetails', 'Journal Entry')} - ${selectedEntry?.entryNumber || ''}`}
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={null}
        width={700}
      >
        {selectedEntry && (
          <>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={8}>
                <Text type="secondary">{t('journal.date', 'Date')}</Text>
                <br />
                <Text strong>{formatDate(selectedEntry.date)}</Text>
              </Col>
              <Col span={8}>
                <Text type="secondary">{t('journal.status', 'Status')}</Text>
                <br />
                <Tag color={statusConfig[selectedEntry.status]?.color || 'default'}>
                  {selectedEntry.status}
                </Tag>
              </Col>
              <Col span={8}>
                <Text type="secondary">{t('journal.reference', 'Reference')}</Text>
                <br />
                <Text>{selectedEntry.reference || '-'}</Text>
              </Col>
            </Row>
            <div style={{ marginBottom: 16 }}>
              <Text type="secondary">{t('journal.description', 'Description')}</Text>
              <br />
              <Text>{selectedEntry.description}</Text>
            </div>
            <Table
              dataSource={selectedEntry.lines}
              rowKey={(_, idx) => String(idx)}
              pagination={false}
              size="small"
              columns={[
                {
                  title: t('journal.account', 'Account'),
                  key: 'account',
                  render: (_: unknown, record: JournalLine) => (
                    <Space>
                      <Text code>{record.accountCode}</Text>
                      <Text>{record.accountName}</Text>
                    </Space>
                  ),
                },
                {
                  title: t('journal.lineDescription', 'Description'),
                  dataIndex: 'description',
                  key: 'description',
                  ellipsis: true,
                },
                {
                  title: t('journal.debit', 'Debit'),
                  dataIndex: 'debit',
                  key: 'debit',
                  width: 130,
                  align: 'right' as const,
                  render: (v: number) => (v > 0 ? formatCurrency(v) : '-'),
                },
                {
                  title: t('journal.credit', 'Credit'),
                  dataIndex: 'credit',
                  key: 'credit',
                  width: 130,
                  align: 'right' as const,
                  render: (v: number) => (v > 0 ? formatCurrency(v) : '-'),
                },
              ]}
              summary={() => (
                <Table.Summary fixed>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={2}>
                      <Text strong>{t('journal.totals', 'Totals')}</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2} align="right">
                      <Text strong>{formatCurrency(selectedEntry.totalDebit)}</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={3} align="right">
                      <Text strong>{formatCurrency(selectedEntry.totalCredit)}</Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              )}
            />
          </>
        )}
      </Modal>
    </div>
  );
};

export default JournalEntriesPage;
