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
  Space,
  Typography,
  Popconfirm,
  Row,
  Col,
  message,
  InputNumber,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  AccountBookOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { api, formatCurrency } from '@/utils/api';

const { Title, Text } = Typography;

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
  parentId?: string;
  parentName?: string;
  balance: number;
  isActive: boolean;
  description?: string;
  children?: Account[];
}

interface AccountFormValues {
  code: string;
  name: string;
  type: string;
  parentId?: string;
  description?: string;
}

const accountTypeConfig: Record<string, { color: string; label: string }> = {
  ASSET: { color: 'blue', label: 'Asset' },
  LIABILITY: { color: 'red', label: 'Liability' },
  EQUITY: { color: 'purple', label: 'Equity' },
  REVENUE: { color: 'green', label: 'Revenue' },
  EXPENSE: { color: 'orange', label: 'Expense' },
};

const AccountsPage: React.FC = () => {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [flatAccounts, setFlatAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<AccountFormValues>();

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/finance/accounts');
      const accountList = data.data || data;
      setFlatAccounts(accountList);

      // Build tree structure
      const map = new Map<string, Account>();
      const roots: Account[] = [];
      accountList.forEach((acc: Account) => {
        map.set(acc.id, { ...acc, children: [] });
      });
      accountList.forEach((acc: Account) => {
        const node = map.get(acc.id)!;
        if (acc.parentId && map.has(acc.parentId)) {
          map.get(acc.parentId)!.children!.push(node);
        } else {
          roots.push(node);
        }
      });
      // Remove empty children arrays
      const cleanTree = (items: Account[]): Account[] =>
        items.map((item) => ({
          ...item,
          children: item.children && item.children.length > 0 ? cleanTree(item.children) : undefined,
        }));
      setAccounts(cleanTree(roots));
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleOpenCreate = () => {
    setEditingAccount(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleOpenEdit = (account: Account) => {
    setEditingAccount(account);
    form.setFieldsValue({
      code: account.code,
      name: account.name,
      type: account.type,
      parentId: account.parentId,
      description: account.description,
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/finance/accounts/${id}`);
      message.success(t('accounts.deleteSuccess', 'Account deleted'));
      fetchAccounts();
    } catch {
      // handled
    }
  };

  const handleSubmit = async (values: AccountFormValues) => {
    setSubmitting(true);
    try {
      if (editingAccount) {
        await api.put(`/finance/accounts/${editingAccount.id}`, values);
        message.success(t('accounts.updateSuccess', 'Account updated'));
      } else {
        await api.post('/finance/accounts', values);
        message.success(t('accounts.createSuccess', 'Account created'));
      }
      setModalOpen(false);
      form.resetFields();
      fetchAccounts();
    } catch {
      // handled
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnsType<Account> = [
    {
      title: t('accounts.code', 'Code'),
      dataIndex: 'code',
      key: 'code',
      width: 120,
      render: (text: string) => <Text code>{text}</Text>,
    },
    {
      title: t('accounts.name', 'Account Name'),
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: t('accounts.type', 'Type'),
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type: string) => {
        const cfg = accountTypeConfig[type] || { color: 'default', label: type };
        return <Tag color={cfg.color}>{t(`accounts.type_${type}`, cfg.label)}</Tag>;
      },
    },
    {
      title: t('accounts.balance', 'Balance'),
      dataIndex: 'balance',
      key: 'balance',
      width: 160,
      align: 'right',
      render: (balance: number) => (
        <Text strong type={balance < 0 ? 'danger' : undefined}>
          {formatCurrency(balance)}
        </Text>
      ),
    },
    {
      title: t('accounts.status', 'Status'),
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? t('common.active', 'Active') : t('common.inactive', 'Inactive')}
        </Tag>
      ),
    },
    {
      title: t('common.actions', 'Actions'),
      key: 'actions',
      width: 120,
      render: (_: unknown, record: Account) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenEdit(record)}
          />
          <Popconfirm
            title={t('accounts.deleteConfirm', 'Delete this account?')}
            onConfirm={() => handleDelete(record.id)}
            okText={t('common.yes', 'Yes')}
            cancelText={t('common.no', 'No')}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
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
              <AccountBookOutlined />
              {t('accounts.title', 'Chart of Accounts')}
            </Space>
          </Title>
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
            {t('accounts.addAccount', 'Add Account')}
          </Button>
        </Col>
      </Row>

      <Card>
        <Table
          dataSource={accounts}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={false}
          scroll={{ x: 800 }}
          expandable={{
            defaultExpandAllRows: true,
          }}
        />
      </Card>

      <Modal
        title={
          editingAccount
            ? t('accounts.editAccount', 'Edit Account')
            : t('accounts.addAccount', 'Add Account')
        }
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          form.resetFields();
        }}
        footer={null}
        width={520}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={10}>
              <Form.Item
                name="code"
                label={t('accounts.code', 'Code')}
                rules={[{ required: true, message: t('accounts.codeRequired', 'Required') }]}
              >
                <Input placeholder="1000" disabled={!!editingAccount} />
              </Form.Item>
            </Col>
            <Col span={14}>
              <Form.Item
                name="name"
                label={t('accounts.name', 'Account Name')}
                rules={[{ required: true, message: t('accounts.nameRequired', 'Required') }]}
              >
                <Input placeholder={t('accounts.namePlaceholder', 'Account name')} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="type"
                label={t('accounts.type', 'Type')}
                rules={[{ required: true, message: t('accounts.typeRequired', 'Required') }]}
              >
                <Select
                  placeholder={t('accounts.selectType', 'Select type')}
                  options={Object.entries(accountTypeConfig).map(([key, cfg]) => ({
                    value: key,
                    label: t(`accounts.type_${key}`, cfg.label),
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="parentId" label={t('accounts.parent', 'Parent Account')}>
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder={t('accounts.noParent', 'None (Top Level)')}
                  options={flatAccounts
                    .filter((a) => a.id !== editingAccount?.id)
                    .map((a) => ({
                      value: a.id,
                      label: `${a.code} - ${a.name}`,
                    }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label={t('accounts.description', 'Description')}>
            <Input.TextArea rows={2} />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalOpen(false)}>{t('common.cancel', 'Cancel')}</Button>
              <Button type="primary" htmlType="submit" loading={submitting}>
                {editingAccount ? t('common.update', 'Update') : t('common.create', 'Create')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AccountsPage;
