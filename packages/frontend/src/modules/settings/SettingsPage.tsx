import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Tabs,
  Form,
  Input,
  Button,
  Select,
  Switch,
  Typography,
  Space,
  Row,
  Col,
  Upload,
  Avatar,
  Divider,
  message,
} from 'antd';
import {
  BankOutlined,
  UserOutlined,
  SettingOutlined,
  UploadOutlined,
  SaveOutlined,
  GlobalOutlined,
  BgColorsOutlined,
  MailOutlined,
  PhoneOutlined,
} from '@ant-design/icons';
import { api } from '@/utils/api';
import { useAuthStore } from '@/store/authStore';
import { useAppStore } from '@/store/appStore';

const { Title, Text } = Typography;

interface OrganizationFormValues {
  name: string;
  code: string;
  address?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  taxId?: string;
  currency: string;
  fiscalYearStart: string;
}

interface ProfileFormValues {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

const SettingsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user, fetchProfile } = useAuthStore();
  const { language, theme, setLanguage, setTheme } = useAppStore();
  const [orgForm] = Form.useForm<OrganizationFormValues>();
  const [profileForm] = Form.useForm<ProfileFormValues>();
  const [orgLoading, setOrgLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [orgSubmitting, setOrgSubmitting] = useState(false);
  const [profileSubmitting, setProfileSubmitting] = useState(false);

  useEffect(() => {
    fetchOrganization();
    if (user) {
      profileForm.setFieldsValue({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
      });
    }
  }, [user]);

  const fetchOrganization = async () => {
    setOrgLoading(true);
    try {
      const { data } = await api.get('/settings/organization');
      orgForm.setFieldsValue(data);
    } catch {
      // handled
    } finally {
      setOrgLoading(false);
    }
  };

  const handleSaveOrganization = async (values: OrganizationFormValues) => {
    setOrgSubmitting(true);
    try {
      await api.put('/settings/organization', values);
      message.success(t('settings.orgSaveSuccess', 'Organization settings saved'));
    } catch {
      // handled
    } finally {
      setOrgSubmitting(false);
    }
  };

  const handleSaveProfile = async (values: ProfileFormValues) => {
    setProfileSubmitting(true);
    try {
      const payload: Record<string, string | undefined> = {
        firstName: values.firstName,
        lastName: values.lastName,
        phone: values.phone,
      };
      if (values.newPassword) {
        payload.currentPassword = values.currentPassword;
        payload.newPassword = values.newPassword;
      }
      await api.put('/settings/profile', payload);
      message.success(t('settings.profileSaveSuccess', 'Profile updated'));
      fetchProfile();
    } catch {
      // handled
    } finally {
      setProfileSubmitting(false);
    }
  };

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    i18n.changeLanguage(lang);
  };

  const handleThemeChange = (checked: boolean) => {
    setTheme(checked ? 'dark' : 'light');
  };

  const languageOptions = [
    { value: 'th', label: 'Thai' },
    { value: 'en', label: 'English' },
    { value: 'zh', label: 'Chinese' },
    { value: 'ja', label: 'Japanese' },
  ];

  const currencyOptions = [
    { value: 'THB', label: 'THB - Thai Baht' },
    { value: 'USD', label: 'USD - US Dollar' },
    { value: 'EUR', label: 'EUR - Euro' },
    { value: 'GBP', label: 'GBP - British Pound' },
    { value: 'JPY', label: 'JPY - Japanese Yen' },
    { value: 'CNY', label: 'CNY - Chinese Yuan' },
  ];

  const fiscalYearOptions = [
    { value: '01', label: t('settings.january', 'January') },
    { value: '02', label: t('settings.february', 'February') },
    { value: '03', label: t('settings.march', 'March') },
    { value: '04', label: t('settings.april', 'April') },
    { value: '05', label: t('settings.may', 'May') },
    { value: '06', label: t('settings.june', 'June') },
    { value: '07', label: t('settings.july', 'July') },
    { value: '08', label: t('settings.august', 'August') },
    { value: '09', label: t('settings.september', 'September') },
    { value: '10', label: t('settings.october', 'October') },
    { value: '11', label: t('settings.november', 'November') },
    { value: '12', label: t('settings.december', 'December') },
  ];

  const tabItems = [
    {
      key: 'organization',
      label: (
        <Space>
          <BankOutlined />
          {t('settings.organization', 'Organization')}
        </Space>
      ),
      children: (
        <Form
          form={orgForm}
          layout="vertical"
          onFinish={handleSaveOrganization}
          style={{ maxWidth: 700 }}
        >
          <Row gutter={16}>
            <Col span={16}>
              <Form.Item
                name="name"
                label={t('settings.orgName', 'Organization Name')}
                rules={[{ required: true, message: t('settings.orgNameRequired', 'Required') }]}
              >
                <Input prefix={<BankOutlined />} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="code"
                label={t('settings.orgCode', 'Organization Code')}
              >
                <Input disabled />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="address" label={t('settings.address', 'Address')}>
            <Input.TextArea rows={2} />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="city" label={t('settings.city', 'City')}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="country" label={t('settings.country', 'Country')}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="taxId" label={t('settings.taxId', 'Tax ID')}>
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="phone" label={t('settings.phone', 'Phone')}>
                <Input prefix={<PhoneOutlined />} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="email"
                label={t('settings.email', 'Email')}
                rules={[{ type: 'email', message: t('settings.emailInvalid', 'Invalid email') }]}
              >
                <Input prefix={<MailOutlined />} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="website" label={t('settings.website', 'Website')}>
                <Input prefix={<GlobalOutlined />} />
              </Form.Item>
            </Col>
          </Row>

          <Divider>{t('settings.financialSettings', 'Financial Settings')}</Divider>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="currency"
                label={t('settings.currency', 'Default Currency')}
                rules={[{ required: true }]}
              >
                <Select options={currencyOptions} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="fiscalYearStart"
                label={t('settings.fiscalYearStart', 'Fiscal Year Start')}
              >
                <Select options={fiscalYearOptions} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={orgSubmitting} icon={<SaveOutlined />}>
              {t('settings.save', 'Save')}
            </Button>
          </Form.Item>
        </Form>
      ),
    },
    {
      key: 'profile',
      label: (
        <Space>
          <UserOutlined />
          {t('settings.profile', 'Profile')}
        </Space>
      ),
      children: (
        <Form
          form={profileForm}
          layout="vertical"
          onFinish={handleSaveProfile}
          style={{ maxWidth: 600 }}
        >
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <Avatar
              size={80}
              src={user?.avatar}
              icon={!user?.avatar ? <UserOutlined /> : undefined}
              style={{ backgroundColor: '#1890ff', marginBottom: 12 }}
            />
            <br />
            <Upload
              showUploadList={false}
              action="/api/settings/profile/avatar"
              headers={{
                Authorization: `Bearer ${useAuthStore.getState().token}`,
              }}
              onChange={(info) => {
                if (info.file.status === 'done') {
                  message.success(t('settings.avatarUploadSuccess', 'Avatar updated'));
                  fetchProfile();
                }
              }}
            >
              <Button icon={<UploadOutlined />} size="small">
                {t('settings.changeAvatar', 'Change Avatar')}
              </Button>
            </Upload>
          </div>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="firstName"
                label={t('settings.firstName', 'First Name')}
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="lastName"
                label={t('settings.lastName', 'Last Name')}
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="email" label={t('settings.email', 'Email')}>
            <Input disabled prefix={<MailOutlined />} />
          </Form.Item>

          <Form.Item name="phone" label={t('settings.phone', 'Phone')}>
            <Input prefix={<PhoneOutlined />} />
          </Form.Item>

          <Divider>{t('settings.changePassword', 'Change Password')}</Divider>

          <Form.Item
            name="currentPassword"
            label={t('settings.currentPassword', 'Current Password')}
          >
            <Input.Password />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="newPassword"
                label={t('settings.newPassword', 'New Password')}
                rules={[{ min: 8, message: t('settings.passwordMin', 'Min 8 characters') }]}
              >
                <Input.Password />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="confirmPassword"
                label={t('settings.confirmPassword', 'Confirm Password')}
                dependencies={['newPassword']}
                rules={[
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('newPassword') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(
                        new Error(t('settings.passwordMismatch', 'Passwords do not match'))
                      );
                    },
                  }),
                ]}
              >
                <Input.Password />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={profileSubmitting} icon={<SaveOutlined />}>
              {t('settings.saveProfile', 'Save Profile')}
            </Button>
          </Form.Item>
        </Form>
      ),
    },
    {
      key: 'preferences',
      label: (
        <Space>
          <SettingOutlined />
          {t('settings.preferences', 'Preferences')}
        </Space>
      ),
      children: (
        <div style={{ maxWidth: 500 }}>
          <Card style={{ marginBottom: 16 }}>
            <Row justify="space-between" align="middle">
              <Col>
                <Space>
                  <GlobalOutlined style={{ fontSize: 20, color: '#1890ff' }} />
                  <div>
                    <Text strong>{t('settings.language', 'Language')}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {t('settings.languageDesc', 'Select your preferred language')}
                    </Text>
                  </div>
                </Space>
              </Col>
              <Col>
                <Select
                  value={language}
                  onChange={handleLanguageChange}
                  style={{ width: 160 }}
                  options={languageOptions}
                />
              </Col>
            </Row>
          </Card>

          <Card style={{ marginBottom: 16 }}>
            <Row justify="space-between" align="middle">
              <Col>
                <Space>
                  <BgColorsOutlined style={{ fontSize: 20, color: '#722ed1' }} />
                  <div>
                    <Text strong>{t('settings.theme', 'Theme')}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {t('settings.themeDesc', 'Toggle between light and dark mode')}
                    </Text>
                  </div>
                </Space>
              </Col>
              <Col>
                <Space>
                  <Text type="secondary">
                    {theme === 'dark'
                      ? t('settings.darkMode', 'Dark')
                      : t('settings.lightMode', 'Light')}
                  </Text>
                  <Switch
                    checked={theme === 'dark'}
                    onChange={handleThemeChange}
                    checkedChildren={t('settings.dark', 'Dark')}
                    unCheckedChildren={t('settings.light', 'Light')}
                  />
                </Space>
              </Col>
            </Row>
          </Card>
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={3} style={{ marginBottom: 24 }}>
        <Space>
          <SettingOutlined />
          {t('settings.title', 'Settings')}
        </Space>
      </Title>

      <Card>
        <Tabs items={tabItems} tabPosition="left" style={{ minHeight: 500 }} />
      </Card>
    </div>
  );
};

export default SettingsPage;
