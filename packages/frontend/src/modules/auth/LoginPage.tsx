import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Form, Input, Button, Card, Typography, Space, Divider, message } from 'antd';
import { MailOutlined, LockOutlined, LoginOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

const { Title, Text } = Typography;

interface LoginFormValues {
  email: string;
  password: string;
}

const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login, isLoading } = useAuthStore();
  const [form] = Form.useForm<LoginFormValues>();

  const handleSubmit = async (values: LoginFormValues) => {
    try {
      await login(values.email, values.password);
      message.success(t('auth.loginSuccess', 'Login successful'));
      navigate('/dashboard');
    } catch {
      message.error(t('auth.loginError', 'Invalid email or password'));
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: 24,
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: 420,
          borderRadius: 12,
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        }}
        bodyStyle={{ padding: 40 }}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div style={{ textAlign: 'center' }}>
            <Title level={2} style={{ marginBottom: 4 }}>
              SmartERP
            </Title>
            <Text type="secondary">
              {t('auth.loginSubtitle', 'Sign in to your account')}
            </Text>
          </div>

          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            autoComplete="off"
            size="large"
          >
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
              name="password"
              label={t('auth.password', 'Password')}
              rules={[
                { required: true, message: t('auth.passwordRequired', 'Please enter your password') },
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder={t('auth.passwordPlaceholder', 'Enter your password')}
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 12 }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={isLoading}
                icon={<LoginOutlined />}
                block
              >
                {t('auth.login', 'Sign In')}
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
              {t('auth.noAccount', "Don't have an account?")}{' '}
              <Link to="/register">
                {t('auth.registerLink', 'Create one now')}
              </Link>
            </Text>
          </div>
        </Space>
      </Card>
    </div>
  );
};

export default LoginPage;
