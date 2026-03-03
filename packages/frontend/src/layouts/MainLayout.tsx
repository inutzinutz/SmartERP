import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Layout,
  Menu,
  Avatar,
  Dropdown,
  Badge,
  Input,
  Space,
  Button,
  Typography,
} from 'antd';
import {
  DashboardOutlined,
  ShoppingCartOutlined,
  ShopOutlined,
  DollarOutlined,
  WalletOutlined,
  BarChartOutlined,
  UserOutlined,
  SettingOutlined,
  BellOutlined,
  SearchOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  GlobalOutlined,
  InboxOutlined,
  TeamOutlined,
  ShoppingOutlined,
  BankOutlined,
  FileTextOutlined,
  AccountBookOutlined,
  AuditOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '@/store/authStore';
import { useAppStore } from '@/store/appStore';
import type { MenuProps } from 'antd';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

type MenuItem = Required<MenuProps>['items'][number];

// Compute which submenu group a pathname belongs to
function getOpenKeysForPath(path: string): string[] {
  if (path.startsWith('/products') || path.startsWith('/inventory') || path.startsWith('/warehouses')) {
    return ['inventory-group'];
  }
  if (path.startsWith('/sales')) return ['sales-group'];
  if (path.startsWith('/purchases')) return ['purchases-group'];
  if (path.startsWith('/finance')) return ['finance-group'];
  return [];
}

export default function MainLayout() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { sidebarCollapsed, toggleSidebar } = useAppStore();
  const [searchVisible, setSearchVisible] = useState(false);
  const [openKeys, setOpenKeys] = useState<string[]>(getOpenKeysForPath(location.pathname));

  // Auto-expand the correct submenu group when route changes
  useEffect(() => {
    const keysForPath = getOpenKeysForPath(location.pathname);
    setOpenKeys((prev) => {
      const merged = new Set([...prev, ...keysForPath]);
      return Array.from(merged);
    });
  }, [location.pathname]);

  const menuItems: MenuItem[] = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: t('nav.dashboard', 'Dashboard'),
    },
    {
      key: 'inventory-group',
      icon: <InboxOutlined />,
      label: t('nav.inventory', 'Inventory'),
      children: [
        { key: '/products', icon: <ShoppingOutlined />, label: t('nav.products', 'Products') },
        { key: '/inventory', icon: <InboxOutlined />, label: t('nav.stockMovements', 'Stock & Movements') },
        { key: '/warehouses', icon: <ShopOutlined />, label: t('nav.warehouses', 'Warehouses') },
      ],
    },
    {
      key: 'sales-group',
      icon: <ShoppingCartOutlined />,
      label: t('nav.sales', 'Sales'),
      children: [
        { key: '/sales/quotations', icon: <FileTextOutlined />, label: t('nav.quotations', 'Quotations') },
        { key: '/sales/orders', icon: <FileTextOutlined />, label: t('nav.salesOrders', 'Sales Orders') },
        { key: '/sales/customers', icon: <TeamOutlined />, label: t('nav.customers', 'Customers') },
      ],
    },
    {
      key: 'purchases-group',
      icon: <ShopOutlined />,
      label: t('nav.purchases', 'Purchases'),
      children: [
        { key: '/purchases/orders', icon: <FileTextOutlined />, label: t('nav.purchaseOrders', 'Purchase Orders') },
        { key: '/purchases/suppliers', icon: <TeamOutlined />, label: t('nav.suppliers', 'Suppliers') },
      ],
    },
    {
      key: 'finance-group',
      icon: <DollarOutlined />,
      label: t('nav.finance', 'Finance'),
      children: [
        { key: '/finance/accounts', icon: <AccountBookOutlined />, label: t('nav.accounts', 'Chart of Accounts') },
        { key: '/finance/journal', icon: <AuditOutlined />, label: t('nav.journalEntries', 'Journal Entries') },
        { key: '/finance/reports', icon: <BarChartOutlined />, label: t('nav.reports', 'Reports') },
      ],
    },
    {
      key: '/expenses',
      icon: <WalletOutlined />,
      label: t('nav.expenses', 'Expenses'),
    },
    { type: 'divider' },
    {
      key: '/users',
      icon: <UserOutlined />,
      label: t('nav.users', 'Users'),
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: t('nav.settings', 'Settings'),
    },
  ];

  const handleMenuClick = ({ key }: { key: string }) => {
    if (key.startsWith('/')) {
      navigate(key);
    }
  };

  const handleOpenChange = (keys: string[]) => {
    setOpenKeys(keys);
  };

  const getSelectedKeys = () => {
    const path = location.pathname;
    // Match exact or prefix for nested routes like /products/:id
    const allKeys = [
      '/dashboard', '/products', '/inventory', '/warehouses',
      '/sales/quotations', '/sales/orders', '/sales/customers',
      '/purchases/orders', '/purchases/suppliers',
      '/finance/accounts', '/finance/journal', '/finance/reports',
      '/expenses', '/users', '/settings',
    ];
    const match = allKeys.find((k) => path === k || path.startsWith(k + '/'));
    return match ? [match] : [path];
  };

  const languageMenu: MenuProps['items'] = [
    { key: 'th', label: 'TH Thai' },
    { key: 'en', label: 'EN English' },
    { key: 'zh', label: 'ZH Chinese' },
  ];

  const userMenu: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
      disabled: true,
    },
    {
      key: 'org',
      icon: <BankOutlined />,
      label: user?.organization?.name || 'Organization',
      disabled: true,
    },
    { type: 'divider' },
    { key: 'settings', icon: <SettingOutlined />, label: t('nav.settings', 'Settings') },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: t('auth.logout', 'Logout'),
      danger: true,
    },
  ];

  const handleUserMenuClick = ({ key }: { key: string }) => {
    if (key === 'logout') {
      logout();
      navigate('/login');
    } else if (key === 'settings') {
      navigate('/settings');
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* Sidebar */}
      <Sider
        trigger={null}
        collapsible
        collapsed={sidebarCollapsed}
        width={256}
        collapsedWidth={80}
        style={{
          background: '#fff',
          borderRight: '1px solid #f0f0f0',
          position: 'fixed',
          height: '100vh',
          left: 0,
          top: 0,
          zIndex: 100,
          overflow: 'auto',
        }}
      >
        {/* Logo */}
        <div
          style={{
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
            padding: sidebarCollapsed ? '0' : '0 20px',
            borderBottom: '1px solid #f0f0f0',
            cursor: 'pointer',
          }}
          onClick={() => navigate('/dashboard')}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>S</span>
          </div>
          {!sidebarCollapsed && (
            <div style={{ marginLeft: 12 }}>
              <Text strong style={{ fontSize: 16, color: '#1e40af' }}>
                SmartERP
              </Text>
            </div>
          )}
        </div>

        {/* Menu */}
        <Menu
          mode="inline"
          selectedKeys={getSelectedKeys()}
          openKeys={sidebarCollapsed ? [] : openKeys}
          onOpenChange={handleOpenChange}
          items={menuItems}
          onClick={handleMenuClick}
          style={{
            border: 'none',
            padding: '8px 0',
          }}
        />
      </Sider>

      {/* Main Content */}
      <Layout
        style={{
          marginLeft: sidebarCollapsed ? 80 : 256,
          transition: 'margin-left 0.2s',
        }}
      >
        {/* Header */}
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            height: 56,
            lineHeight: '56px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #f0f0f0',
            position: 'sticky',
            top: 0,
            zIndex: 99,
          }}
        >
          <Space>
            <Button
              type="text"
              icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={toggleSidebar}
              style={{ fontSize: 16 }}
            />
            {searchVisible ? (
              <Input
                placeholder={t('common.search', 'Search') + '...'}
                prefix={<SearchOutlined />}
                style={{ width: 300 }}
                autoFocus
                onBlur={() => setSearchVisible(false)}
                onPressEnter={() => {
                  setSearchVisible(false);
                }}
              />
            ) : (
              <Button
                type="text"
                icon={<SearchOutlined />}
                onClick={() => setSearchVisible(true)}
              />
            )}
          </Space>

          <Space size="middle">
            {/* Language Switcher */}
            <Dropdown
              menu={{
                items: languageMenu,
                onClick: ({ key }) => i18n.changeLanguage(key),
                selectedKeys: [i18n.language],
              }}
              trigger={['click']}
            >
              <Button type="text" icon={<GlobalOutlined />} />
            </Dropdown>

            {/* Notifications */}
            <Badge count={0} size="small">
              <Button type="text" icon={<BellOutlined style={{ fontSize: 16 }} />} />
            </Badge>

            {/* User Avatar */}
            <Dropdown
              menu={{ items: userMenu, onClick: handleUserMenuClick }}
              trigger={['click']}
              placement="bottomRight"
            >
              <Space style={{ cursor: 'pointer' }}>
                <Avatar
                  style={{ backgroundColor: '#2563eb' }}
                  icon={<UserOutlined />}
                  src={user?.avatar}
                />
                {!sidebarCollapsed && (
                  <Text strong style={{ fontSize: 13 }}>
                    {user?.firstName}
                  </Text>
                )}
              </Space>
            </Dropdown>
          </Space>
        </Header>

        {/* Page Content */}
        <Content
          style={{
            padding: 24,
            minHeight: 'calc(100vh - 56px)',
            background: '#f5f5f5',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
