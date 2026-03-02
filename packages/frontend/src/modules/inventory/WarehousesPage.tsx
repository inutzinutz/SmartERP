import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Table,
  Card,
  Button,
  Modal,
  Form,
  Input,
  Space,
  Typography,
  Popconfirm,
  Tag,
  message,
  Row,
  Col,
  Switch,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  HomeOutlined,
  EnvironmentOutlined,
  PhoneOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { api } from '@/utils/api';

const { Title, Text } = Typography;

interface Warehouse {
  id: string;
  name: string;
  code: string;
  address?: string;
  city?: string;
  phone?: string;
  isActive: boolean;
  manager?: string;
  capacity?: number;
  currentOccupancy?: number;
}

interface WarehouseFormValues {
  name: string;
  code: string;
  address?: string;
  city?: string;
  phone?: string;
  isActive: boolean;
  manager?: string;
  capacity?: number;
}

const WarehousesPage: React.FC = () => {
  const { t } = useTranslation();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<WarehouseFormValues>();

  const fetchWarehouses = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/warehouses');
      setWarehouses(data.data || data);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWarehouses();
  }, [fetchWarehouses]);

  const handleOpenCreate = () => {
    setEditingWarehouse(null);
    form.resetFields();
    form.setFieldValue('isActive', true);
    setModalOpen(true);
  };

  const handleOpenEdit = (warehouse: Warehouse) => {
    setEditingWarehouse(warehouse);
    form.setFieldsValue({
      name: warehouse.name,
      code: warehouse.code,
      address: warehouse.address,
      city: warehouse.city,
      phone: warehouse.phone,
      isActive: warehouse.isActive,
      manager: warehouse.manager,
      capacity: warehouse.capacity,
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/warehouses/${id}`);
      message.success(t('warehouses.deleteSuccess', 'Warehouse deleted'));
      fetchWarehouses();
    } catch {
      // handled
    }
  };

  const handleSubmit = async (values: WarehouseFormValues) => {
    setSubmitting(true);
    try {
      if (editingWarehouse) {
        await api.put(`/warehouses/${editingWarehouse.id}`, values);
        message.success(t('warehouses.updateSuccess', 'Warehouse updated'));
      } else {
        await api.post('/warehouses', values);
        message.success(t('warehouses.createSuccess', 'Warehouse created'));
      }
      setModalOpen(false);
      form.resetFields();
      fetchWarehouses();
    } catch {
      // handled
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnsType<Warehouse> = [
    {
      title: t('warehouses.code', 'Code'),
      dataIndex: 'code',
      key: 'code',
      width: 100,
      render: (text: string) => <Text code>{text}</Text>,
    },
    {
      title: t('warehouses.name', 'Name'),
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => (
        <Space>
          <HomeOutlined />
          <Text strong>{text}</Text>
        </Space>
      ),
    },
    {
      title: t('warehouses.address', 'Address'),
      dataIndex: 'address',
      key: 'address',
      ellipsis: true,
      render: (text: string) =>
        text ? (
          <Space>
            <EnvironmentOutlined />
            {text}
          </Space>
        ) : (
          '-'
        ),
    },
    {
      title: t('warehouses.city', 'City'),
      dataIndex: 'city',
      key: 'city',
      width: 120,
    },
    {
      title: t('warehouses.phone', 'Phone'),
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
      title: t('warehouses.manager', 'Manager'),
      dataIndex: 'manager',
      key: 'manager',
      width: 130,
    },
    {
      title: t('warehouses.status', 'Status'),
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
      render: (_: unknown, record: Warehouse) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenEdit(record)}
          />
          <Popconfirm
            title={t('warehouses.deleteConfirm', 'Delete this warehouse?')}
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
            {t('warehouses.title', 'Warehouses')}
          </Title>
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
            {t('warehouses.addWarehouse', 'Add Warehouse')}
          </Button>
        </Col>
      </Row>

      <Card>
        <Table
          dataSource={warehouses}
          columns={columns}
          rowKey="id"
          loading={loading}
          scroll={{ x: 900 }}
        />
      </Card>

      <Modal
        title={
          editingWarehouse
            ? t('warehouses.editWarehouse', 'Edit Warehouse')
            : t('warehouses.addWarehouse', 'Add Warehouse')
        }
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          form.resetFields();
        }}
        footer={null}
        width={560}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          style={{ marginTop: 16 }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="code"
                label={t('warehouses.code', 'Code')}
                rules={[{ required: true, message: t('warehouses.codeRequired', 'Code is required') }]}
              >
                <Input placeholder="WH-001" disabled={!!editingWarehouse} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="name"
                label={t('warehouses.name', 'Name')}
                rules={[{ required: true, message: t('warehouses.nameRequired', 'Name is required') }]}
              >
                <Input placeholder={t('warehouses.namePlaceholder', 'Warehouse name')} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="address"
            label={t('warehouses.address', 'Address')}
          >
            <Input.TextArea rows={2} placeholder={t('warehouses.addressPlaceholder', 'Full address')} />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="city" label={t('warehouses.city', 'City')}>
                <Input placeholder={t('warehouses.cityPlaceholder', 'City')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phone" label={t('warehouses.phone', 'Phone')}>
                <Input placeholder={t('warehouses.phonePlaceholder', 'Phone number')} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="manager" label={t('warehouses.manager', 'Manager')}>
                <Input placeholder={t('warehouses.managerPlaceholder', 'Manager name')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="capacity" label={t('warehouses.capacity', 'Capacity')}>
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="isActive"
            label={t('warehouses.active', 'Active')}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalOpen(false)}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button type="primary" htmlType="submit" loading={submitting}>
                {editingWarehouse ? t('common.update', 'Update') : t('common.create', 'Create')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default WarehousesPage;
