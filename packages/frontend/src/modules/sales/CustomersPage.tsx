import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Table,
  Card,
  Button,
  Input,
  Tag,
  Modal,
  Form,
  Select,
  Space,
  Typography,
  Popconfirm,
  Row,
  Col,
  message,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { api } from '@/utils/api';

const { Title, Text } = Typography;

interface Customer {
  id: string;
  code: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  tier: string;
  taxId?: string;
  contactPerson?: string;
  isActive: boolean;
}

interface CustomerFormValues {
  code: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  tier: string;
  taxId?: string;
  contactPerson?: string;
}

const tierConfig: Record<string, { color: string; label: string }> = {
  VIP: { color: 'gold', label: 'VIP' },
  PREMIUM: { color: 'purple', label: 'Premium' },
  STANDARD: { color: 'blue', label: 'Standard' },
  NEW: { color: 'green', label: 'New' },
};

const CustomersPage: React.FC = () => {
  const { t } = useTranslation();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<CustomerFormValues>();

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/customers', {
        params: { page, limit: pageSize, search: search || undefined },
      });
      setCustomers(data.data || data);
      setTotal(data.total || 0);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleOpenCreate = () => {
    setEditingCustomer(null);
    form.resetFields();
    form.setFieldValue('tier', 'NEW');
    setModalOpen(true);
  };

  const handleOpenEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    form.setFieldsValue({
      code: customer.code,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      city: customer.city,
      tier: customer.tier,
      taxId: customer.taxId,
      contactPerson: customer.contactPerson,
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/customers/${id}`);
      message.success(t('customers.deleteSuccess', 'Customer deleted'));
      fetchCustomers();
    } catch {
      // handled
    }
  };

  const handleSubmit = async (values: CustomerFormValues) => {
    setSubmitting(true);
    try {
      if (editingCustomer) {
        await api.put(`/customers/${editingCustomer.id}`, values);
        message.success(t('customers.updateSuccess', 'Customer updated'));
      } else {
        await api.post('/customers', values);
        message.success(t('customers.createSuccess', 'Customer created'));
      }
      setModalOpen(false);
      form.resetFields();
      fetchCustomers();
    } catch {
      // handled
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnsType<Customer> = [
    {
      title: t('customers.code', 'Code'),
      dataIndex: 'code',
      key: 'code',
      width: 100,
      render: (text: string) => <Text code>{text}</Text>,
    },
    {
      title: t('customers.name', 'Name'),
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => (
        <Space>
          <UserOutlined />
          <Text strong>{text}</Text>
        </Space>
      ),
    },
    {
      title: t('customers.email', 'Email'),
      dataIndex: 'email',
      key: 'email',
      ellipsis: true,
      render: (text: string) =>
        text ? (
          <Space>
            <MailOutlined />
            {text}
          </Space>
        ) : (
          '-'
        ),
    },
    {
      title: t('customers.phone', 'Phone'),
      dataIndex: 'phone',
      key: 'phone',
      width: 140,
      render: (text: string) =>
        text ? (
          <Space>
            <PhoneOutlined />
            {text}
          </Space>
        ) : (
          '-'
        ),
    },
    {
      title: t('customers.city', 'City'),
      dataIndex: 'city',
      key: 'city',
      width: 120,
    },
    {
      title: t('customers.tier', 'Tier'),
      dataIndex: 'tier',
      key: 'tier',
      width: 110,
      render: (tier: string) => {
        const cfg = tierConfig[tier] || { color: 'default', label: tier };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: t('customers.contactPerson', 'Contact'),
      dataIndex: 'contactPerson',
      key: 'contactPerson',
      width: 130,
      ellipsis: true,
    },
    {
      title: t('common.actions', 'Actions'),
      key: 'actions',
      width: 120,
      render: (_: unknown, record: Customer) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenEdit(record)}
          />
          <Popconfirm
            title={t('customers.deleteConfirm', 'Delete this customer?')}
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
            {t('customers.title', 'Customers')}
          </Title>
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
            {t('customers.addCustomer', 'Add Customer')}
          </Button>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Input
          placeholder={t('customers.searchPlaceholder', 'Search by name, code, or email...')}
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          allowClear
          style={{ maxWidth: 400 }}
        />
      </Card>

      <Card>
        <Table
          dataSource={customers}
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

      <Modal
        title={
          editingCustomer
            ? t('customers.editCustomer', 'Edit Customer')
            : t('customers.addCustomer', 'Add Customer')
        }
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          form.resetFields();
        }}
        footer={null}
        width={640}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="code"
                label={t('customers.code', 'Code')}
                rules={[{ required: true, message: t('customers.codeRequired', 'Required') }]}
              >
                <Input placeholder="CUS-001" disabled={!!editingCustomer} />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item
                name="name"
                label={t('customers.name', 'Name')}
                rules={[{ required: true, message: t('customers.nameRequired', 'Required') }]}
              >
                <Input placeholder={t('customers.namePlaceholder', 'Customer name')} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="email"
                label={t('customers.email', 'Email')}
                rules={[{ type: 'email', message: t('customers.emailInvalid', 'Invalid email') }]}
              >
                <Input prefix={<MailOutlined />} placeholder="email@example.com" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phone" label={t('customers.phone', 'Phone')}>
                <Input prefix={<PhoneOutlined />} placeholder="0xx-xxx-xxxx" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="address" label={t('customers.address', 'Address')}>
            <Input.TextArea rows={2} placeholder={t('customers.addressPlaceholder', 'Full address')} />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="city" label={t('customers.city', 'City')}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="taxId" label={t('customers.taxId', 'Tax ID')}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="tier"
                label={t('customers.tier', 'Tier')}
                rules={[{ required: true }]}
              >
                <Select
                  options={Object.entries(tierConfig).map(([key, cfg]) => ({
                    value: key,
                    label: cfg.label,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="contactPerson" label={t('customers.contactPerson', 'Contact Person')}>
            <Input placeholder={t('customers.contactPlaceholder', 'Contact person name')} />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalOpen(false)}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button type="primary" htmlType="submit" loading={submitting}>
                {editingCustomer ? t('common.update', 'Update') : t('common.create', 'Create')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CustomersPage;
