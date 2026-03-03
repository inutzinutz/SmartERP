import React from 'react';
import { useTranslation } from 'react-i18next';
import { Form, Input, Button, Typography, Space, Divider, message } from 'antd';
import {
  MailOutlined,
  LockOutlined,
  UserOutlined,
  BankOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

const { Title, Text } = Typography;

interface RegisterFormValues {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  organizationName: string;
}

const RegisterPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { register, isLoading } = useAuthStore();
  const [form] = Form.useForm<RegisterFormValues>();

  const handleSubmit = async (values: RegisterFormValues) => {
    try {
      await register({
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        password: values.password,
        organizationName: values.organizationName,
      });
      message.success(t('auth.registerSuccess', 'Account created successfully'));
      navigate('/dashboard');
    } catch {
      message.error(t('auth.registerError', 'Registration failed. Please try again.'));
    }
  };

  return (
    <div style={{ width: '100%' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ textAlign: 'center' }}>
          <Title level={2} style={{ marginBottom: 4, color: '#1e40af' }}>
            SmartERP
          </Title>
          <Text type="secondary">
            {t('auth.registerSubtitle', 'Create your account')}
          </Text>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          autoComplete="off"
          size="large"
        >
          <Space style={{ width: '100%' }} size={12}>
            <Form.Item
              name="firstName"
              label={t('auth.firstName', 'First Name')}
              rules={[
                { required: true, message: t('auth.firstNameRequired', 'Required') },
              ]}
              style={{ flex: 1 }}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder={t('auth.firstNamePlaceholder', 'First name')}
              />
            </Form.Item>

            <Form.Item
              name="lastName"
              label={t('auth.lastName', 'Last Name')}
              rules={[
                { required: true, message: t('auth.lastNameRequired', 'Required') },
              ]}
              style={{ flex: 1 }}
            >
              <Input placeholder={t('auth.lastNamePlaceholder', 'Last name')} />
            </Form.Item>
          </Space>

          <Form.Item
            name="email"
            label={t('auth.email', 'Email')}
            rules={[
              { required: true, message: t('auth.emailRequired', 'Please enter your email') },
              { type: 'email', message: t('auth.emailInvalid', 'Please enter a valid email') },
            ]}
          >
            <Input
              prefix={<MailOutlined />}
              placeholder={t('auth.emailPlaceholder', 'Enter your email')}
            />
          </Form.Item>

          <Form.Item
            name="organizationName"
            label={t('auth.organizationName', 'Organization Name')}
            rules={[
              {
                required: true,
                message: t('auth.organizationRequired', 'Please enter organization name'),
              },
            ]}
          >
            <Input
              prefix={<BankOutlined />}
              placeholder={t('auth.organizationPlaceholder', 'Your company name')}
            />
          </Form.Item>

          <Form.Item
            name="password"
            label={t('auth.password', 'Password')}
            rules={[
              { required: true, message: t('auth.passwordRequired', 'Please enter a password') },
              { min: 8, message: t('auth.passwordMin', 'Password must be at least 8 characters') },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder={t('auth.passwordPlaceholder', 'Create a password')}
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label={t('auth.confirmPassword', 'Confirm Password')}
            dependencies={['password']}
            rules={[
              { required: true, message: t('auth.confirmPasswordRequired', 'Please confirm password') },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(
                    new Error(t('auth.passwordMismatch', 'Passwords do not match'))
                  );
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder={t('auth.confirmPasswordPlaceholder', 'Confirm your password')}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 12 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={isLoading}
              icon={<UserAddOutlined />}
              block
            >
              {t('auth.register', 'Create Account')}
            </Button>
          </Form.Item>
        </Form>

        <Divider style={{ margin: 0 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('auth.or', 'OR')}
          </Text>
        </Divider>

        <div style={{ textAlign: 'center' }}>
          <Text type="secondary">
            {t('auth.hasAccount', 'Already have an account?')}{' '}
            <Link to="/login">
              {t('auth.loginLink', 'Sign in')}
            </Link>
          </Text>
        </div>
      </Space>
    </div>
  );
};

export default RegisterPage;
