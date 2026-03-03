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
  Select,
  Space,
  Typography,
  Popconfirm,
  Row,
  Col,
  message,
  Avatar,
  Switch,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  UserOutlined,
  MailOutlined,
  LockOutlined,
  CheckCircleOutlined,
  StopOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { api, formatDate } from '@/utils/api';

const { Title, Text } = Typography;

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  phone?: string;
  avatar?: string;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
}

interface UserFormValues {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  phone?: string;
  password?: string;
}

const roleConfig: Record<string, { color: string; label: string }> = {
  ADMIN: { color: 'red', label: 'Admin' },
  MANAGER: { color: 'purple', label: 'Manager' },
  ACCOUNTANT: { color: 'blue', label: 'Accountant' },
  SALES: { color: 'green', label: 'Sales' },
  PURCHASE: { color: 'orange', label: 'Purchase' },
  WAREHOUSE: { color: 'cyan', label: 'Warehouse' },
  USER: { color: 'default', label: 'User' },
};

const UsersPage: React.FC = () => {
  const { t } = useTranslation();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<UserFormValues>();
  const debouncedSearch = useDebounce(search, 400);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/users', {
        params: { page, limit: pageSize, search: debouncedSearch || undefined },
      });
      setUsers(data.data || data);
      setTotal(data.total || 0);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleOpenCreate = () => {
    setEditingUser(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleOpenEdit = (user: User) => {
    setEditingUser(user);
    form.setFieldsValue({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      phone: user.phone,
    });
    setModalOpen(true);
  };

  const handleToggleActive = async (user: User) => {
    try {
      await api.put(`/users/${user.id}`, { isActive: !user.isActive });
      message.success(
        user.isActive
          ? t('users.deactivateSuccess', 'User deactivated')
          : t('users.activateSuccess', 'User activated')
      );
      fetchUsers();
    } catch {
      // handled
    }
  };

  const handleSubmit = async (values: UserFormValues) => {
    setSubmitting(true);
    try {
      if (editingUser) {
        const payload: Partial<UserFormValues> = {
          firstName: values.firstName,
          lastName: values.lastName,
          role: values.role,
          phone: values.phone,
        };
        if (values.password) {
          payload.password = values.password;
        }
        await api.put(`/users/${editingUser.id}`, payload);
        message.success(t('users.updateSuccess', 'User updated'));
      } else {
        await api.post('/users', values);
        message.success(t('users.createSuccess', 'User created'));
      }
      setModalOpen(false);
      form.resetFields();
      fetchUsers();
    } catch {
      // handled
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnsType<User> = [
    {
      title: t('users.user', 'User'),
      key: 'user',
      render: (_: unknown, record: User) => (
        <Space>
          <Avatar
            size="small"
            src={record.avatar}
            icon={!record.avatar ? <UserOutlined /> : undefined}
            style={{ backgroundColor: record.avatar ? undefined : '#1890ff' }}
          />
          <div>
            <Text strong>
              {record.firstName} {record.lastName}
            </Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.email}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: t('users.role', 'Role'),
      dataIndex: 'role',
      key: 'role',
      width: 120,
      render: (role: string) => {
        const cfg = roleConfig[role] || { color: 'default', label: role };
        return <Tag color={cfg.color}>{t(`users.role_${role}`, cfg.label)}</Tag>;
      },
    },
    {
      title: t('users.phone', 'Phone'),
      dataIndex: 'phone',
      key: 'phone',
      width: 140,
      render: (text: string) => text || '-',
    },
    {
      title: t('users.status', 'Status'),
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'red'} icon={isActive ? <CheckCircleOutlined /> : <StopOutlined />}>
          {isActive ? t('common.active', 'Active') : t('common.inactive', 'Inactive')}
        </Tag>
      ),
    },
    {
      title: t('users.lastLogin', 'Last Login'),
      dataIndex: 'lastLogin',
      key: 'lastLogin',
      width: 130,
      render: (date: string) => (date ? formatDate(date) : t('users.never', 'Never')),
    },
    {
      title: t('users.createdAt', 'Created'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (date: string) => formatDate(date),
    },
    {
      title: t('common.actions', 'Actions'),
      key: 'actions',
      width: 150,
      render: (_: unknown, record: User) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenEdit(record)}
          />
          <Popconfirm
            title={
              record.isActive
                ? t('users.deactivateConfirm', 'Deactivate this user?')
                : t('users.activateConfirm', 'Activate this user?')
            }
            onConfirm={() => handleToggleActive(record)}
            okText={t('common.yes', 'Yes')}
            cancelText={t('common.no', 'No')}
          >
            <Button
              type="link"
              size="small"
              icon={record.isActive ? <StopOutlined /> : <CheckCircleOutlined />}
              style={{ color: record.isActive ? '#ff4d4f' : '#52c41a' }}
            />
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
            {t('users.title', 'Users')}
          </Title>
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
            {t('users.addUser', 'Add User')}
          </Button>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Input
          placeholder={t('users.searchPlaceholder', 'Search by name or email...')}
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
          dataSource={users}
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

      <Modal
        title={
          editingUser
            ? t('users.editUser', 'Edit User')
            : t('users.addUser', 'Add User')
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
            <Col span={12}>
              <Form.Item
                name="firstName"
                label={t('users.firstName', 'First Name')}
                rules={[{ required: true, message: t('users.firstNameRequired', 'Required') }]}
              >
                <Input prefix={<UserOutlined />} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="lastName"
                label={t('users.lastName', 'Last Name')}
                rules={[{ required: true, message: t('users.lastNameRequired', 'Required') }]}
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="email"
            label={t('users.email', 'Email')}
            rules={[
              { required: true, message: t('users.emailRequired', 'Required') },
              { type: 'email', message: t('users.emailInvalid', 'Invalid email') },
            ]}
          >
            <Input prefix={<MailOutlined />} disabled={!!editingUser} />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="role"
                label={t('users.role', 'Role')}
                rules={[{ required: true, message: t('users.roleRequired', 'Required') }]}
              >
                <Select
                  placeholder={t('users.selectRole', 'Select role')}
                  options={Object.entries(roleConfig).map(([key, cfg]) => ({
                    value: key,
                    label: t(`users.role_${key}`, cfg.label),
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phone" label={t('users.phone', 'Phone')}>
                <Input placeholder="0xx-xxx-xxxx" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="password"
            label={
              editingUser
                ? t('users.newPassword', 'New Password (leave blank to keep)')
                : t('users.password', 'Password')
            }
            rules={
              editingUser
                ? [{ min: 8, message: t('users.passwordMin', 'Min 8 characters') }]
                : [
                    { required: true, message: t('users.passwordRequired', 'Required') },
                    { min: 8, message: t('users.passwordMin', 'Min 8 characters') },
                  ]
            }
          >
            <Input.Password prefix={<LockOutlined />} />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalOpen(false)}>{t('common.cancel', 'Cancel')}</Button>
              <Button type="primary" htmlType="submit" loading={submitting}>
                {editingUser ? t('common.update', 'Update') : t('common.create', 'Create')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UsersPage;
