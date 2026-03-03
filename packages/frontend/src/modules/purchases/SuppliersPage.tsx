import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useDebounce } from '@/hooks/useDebounce';
import {
  Table,
  Card,
  Button,
  Input,
  Tag,
  Modal,
  Form,
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
  ShopOutlined,
  MailOutlined,
  PhoneOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { api } from '@/utils/api';

const { Title, Text } = Typography;

interface Supplier {
  id: string;
  code: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  website?: string;
  taxId?: string;
  contactPerson?: string;
  paymentTerms?: string;
  isActive: boolean;
}

interface SupplierFormValues {
  code: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  website?: string;
  taxId?: string;
  contactPerson?: string;
  paymentTerms?: string;
}

const SuppliersPage: React.FC = () => {
  const { t } = useTranslation();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<SupplierFormValues>();
  const debouncedSearch = useDebounce(search, 400);

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/purchases/suppliers', {
        params: { page, limit: pageSize, search: debouncedSearch || undefined },
      });
      setSuppliers(data.data || data);
      setTotal(data.total || 0);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const handleOpenCreate = () => {
    setEditingSupplier(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleOpenEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    form.setFieldsValue({
      code: supplier.code,
      name: supplier.name,
      email: supplier.email,
      phone: supplier.phone,
      address: supplier.address,
      city: supplier.city,
      country: supplier.country,
      website: supplier.website,
      taxId: supplier.taxId,
      contactPerson: supplier.contactPerson,
      paymentTerms: supplier.paymentTerms,
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/purchases/suppliers/${id}`);
      message.success(t('suppliers.deleteSuccess', 'Supplier deleted'));
      fetchSuppliers();
    } catch {
      // handled
    }
  };

  const handleSubmit = async (values: SupplierFormValues) => {
    setSubmitting(true);
    try {
      if (editingSupplier) {
        await api.put(`/purchases/suppliers/${editingSupplier.id}`, values);
        message.success(t('suppliers.updateSuccess', 'Supplier updated'));
      } else {
        await api.post('/purchases/suppliers', values);
        message.success(t('suppliers.createSuccess', 'Supplier created'));
      }
      setModalOpen(false);
      form.resetFields();
      fetchSuppliers();
    } catch {
      // handled
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnsType<Supplier> = [
    {
      title: t('suppliers.code', 'Code'),
      dataIndex: 'code',
      key: 'code',
      width: 100,
      render: (text: string) => <Text code>{text}</Text>,
    },
    {
      title: t('suppliers.name', 'Name'),
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => (
        <Space>
          <ShopOutlined />
          <Text strong>{text}</Text>
        </Space>
      ),
    },
    {
      title: t('suppliers.email', 'Email'),
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
      title: t('suppliers.phone', 'Phone'),
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
      title: t('suppliers.city', 'City'),
      dataIndex: 'city',
      key: 'city',
      width: 120,
    },
    {
      title: t('suppliers.contactPerson', 'Contact'),
      dataIndex: 'contactPerson',
      key: 'contactPerson',
      width: 130,
      ellipsis: true,
    },
    {
      title: t('suppliers.status', 'Status'),
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
      render: (_: unknown, record: Supplier) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenEdit(record)}
          />
          <Popconfirm
            title={t('suppliers.deleteConfirm', 'Delete this supplier?')}
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
            {t('suppliers.title', 'Suppliers')}
          </Title>
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
            {t('suppliers.addSupplier', 'Add Supplier')}
          </Button>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Input
          placeholder={t('suppliers.searchPlaceholder', 'Search by name, code, or email...')}
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
          dataSource={suppliers}
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
          editingSupplier
            ? t('suppliers.editSupplier', 'Edit Supplier')
            : t('suppliers.addSupplier', 'Add Supplier')
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
                label={t('suppliers.code', 'Code')}
                rules={[{ required: true, message: t('suppliers.codeRequired', 'Required') }]}
              >
                <Input placeholder="SUP-001" disabled={!!editingSupplier} />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item
                name="name"
                label={t('suppliers.name', 'Name')}
                rules={[{ required: true, message: t('suppliers.nameRequired', 'Required') }]}
              >
                <Input placeholder={t('suppliers.namePlaceholder', 'Supplier name')} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="email"
                label={t('suppliers.email', 'Email')}
                rules={[{ type: 'email', message: t('suppliers.emailInvalid', 'Invalid email') }]}
              >
                <Input prefix={<MailOutlined />} placeholder="email@supplier.com" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phone" label={t('suppliers.phone', 'Phone')}>
                <Input prefix={<PhoneOutlined />} placeholder="0xx-xxx-xxxx" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="address" label={t('suppliers.address', 'Address')}>
            <Input.TextArea rows={2} />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="city" label={t('suppliers.city', 'City')}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="country" label={t('suppliers.country', 'Country')}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="taxId" label={t('suppliers.taxId', 'Tax ID')}>
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="website" label={t('suppliers.website', 'Website')}>
                <Input prefix={<GlobalOutlined />} placeholder="https://" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="contactPerson" label={t('suppliers.contactPerson', 'Contact Person')}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="paymentTerms" label={t('suppliers.paymentTerms', 'Payment Terms')}>
                <Input placeholder="Net 30" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalOpen(false)}>{t('common.cancel', 'Cancel')}</Button>
              <Button type="primary" htmlType="submit" loading={submitting}>
                {editingSupplier ? t('common.update', 'Update') : t('common.create', 'Create')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SuppliersPage;
