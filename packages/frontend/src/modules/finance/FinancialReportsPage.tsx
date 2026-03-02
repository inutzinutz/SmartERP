import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Tabs,
  Table,
  Button,
  DatePicker,
  Space,
  Typography,
  Row,
  Col,
  Spin,
  Tag,
} from 'antd';
import {
  FileTextOutlined,
  BarChartOutlined,
  BankOutlined,
  PrinterOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { api, formatCurrency } from '@/utils/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

interface TrialBalanceRow {
  id: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  debit: number;
  credit: number;
}

interface IncomeStatementRow {
  id: string;
  accountCode: string;
  accountName: string;
  category: string;
  amount: number;
}

interface BalanceSheetRow {
  id: string;
  accountCode: string;
  accountName: string;
  category: string;
  amount: number;
  children?: BalanceSheetRow[];
}

interface ReportSummary {
  totalRevenue?: number;
  totalExpenses?: number;
  netIncome?: number;
  totalAssets?: number;
  totalLiabilities?: number;
  totalEquity?: number;
}

const FinancialReportsPage: React.FC = () => {
  const { t } = useTranslation();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ]);
  const [trialBalance, setTrialBalance] = useState<TrialBalanceRow[]>([]);
  const [incomeStatement, setIncomeStatement] = useState<IncomeStatementRow[]>([]);
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetRow[]>([]);
  const [summary, setSummary] = useState<ReportSummary>({});
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('trialBalance');

  const fetchReport = useCallback(async (reportType: string) => {
    setLoading(true);
    try {
      const params = {
        startDate: dateRange[0].format('YYYY-MM-DD'),
        endDate: dateRange[1].format('YYYY-MM-DD'),
      };

      if (reportType === 'trialBalance') {
        const { data } = await api.get('/finance/reports/trial-balance', { params });
        setTrialBalance(data.rows || data.data || []);
      } else if (reportType === 'incomeStatement') {
        const { data } = await api.get('/finance/reports/income-statement', { params });
        setIncomeStatement(data.rows || data.data || []);
        setSummary({
          totalRevenue: data.totalRevenue,
          totalExpenses: data.totalExpenses,
          netIncome: data.netIncome,
        });
      } else if (reportType === 'balanceSheet') {
        const { data } = await api.get('/finance/reports/balance-sheet', { params });
        setBalanceSheet(data.rows || data.data || []);
        setSummary({
          totalAssets: data.totalAssets,
          totalLiabilities: data.totalLiabilities,
          totalEquity: data.totalEquity,
        });
      }
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    fetchReport(key);
  };

  const handleGenerate = () => {
    fetchReport(activeTab);
  };

  const trialBalanceColumns: ColumnsType<TrialBalanceRow> = [
    {
      title: t('reports.accountCode', 'Code'),
      dataIndex: 'accountCode',
      key: 'accountCode',
      width: 100,
      render: (text: string) => <Text code>{text}</Text>,
    },
    {
      title: t('reports.accountName', 'Account Name'),
      dataIndex: 'accountName',
      key: 'accountName',
    },
    {
      title: t('reports.type', 'Type'),
      dataIndex: 'accountType',
      key: 'accountType',
      width: 110,
      render: (type: string) => {
        const colors: Record<string, string> = {
          ASSET: 'blue',
          LIABILITY: 'red',
          EQUITY: 'purple',
          REVENUE: 'green',
          EXPENSE: 'orange',
        };
        return <Tag color={colors[type] || 'default'}>{type}</Tag>;
      },
    },
    {
      title: t('reports.debit', 'Debit'),
      dataIndex: 'debit',
      key: 'debit',
      width: 150,
      align: 'right',
      render: (amount: number) => (amount > 0 ? formatCurrency(amount) : '-'),
    },
    {
      title: t('reports.credit', 'Credit'),
      dataIndex: 'credit',
      key: 'credit',
      width: 150,
      align: 'right',
      render: (amount: number) => (amount > 0 ? formatCurrency(amount) : '-'),
    },
  ];

  const incomeStatementColumns: ColumnsType<IncomeStatementRow> = [
    {
      title: t('reports.accountCode', 'Code'),
      dataIndex: 'accountCode',
      key: 'accountCode',
      width: 100,
      render: (text: string) => <Text code>{text}</Text>,
    },
    {
      title: t('reports.accountName', 'Account Name'),
      dataIndex: 'accountName',
      key: 'accountName',
    },
    {
      title: t('reports.category', 'Category'),
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (cat: string) => (
        <Tag color={cat === 'REVENUE' ? 'green' : 'orange'}>{cat}</Tag>
      ),
    },
    {
      title: t('reports.amount', 'Amount'),
      dataIndex: 'amount',
      key: 'amount',
      width: 160,
      align: 'right',
      render: (amount: number) => (
        <Text type={amount < 0 ? 'danger' : undefined}>
          {formatCurrency(Math.abs(amount))}
        </Text>
      ),
    },
  ];

  const balanceSheetColumns: ColumnsType<BalanceSheetRow> = [
    {
      title: t('reports.accountCode', 'Code'),
      dataIndex: 'accountCode',
      key: 'accountCode',
      width: 100,
      render: (text: string) => <Text code>{text}</Text>,
    },
    {
      title: t('reports.accountName', 'Account Name'),
      dataIndex: 'accountName',
      key: 'accountName',
    },
    {
      title: t('reports.category', 'Category'),
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (cat: string) => {
        const colors: Record<string, string> = {
          ASSET: 'blue',
          LIABILITY: 'red',
          EQUITY: 'purple',
        };
        return <Tag color={colors[cat] || 'default'}>{cat}</Tag>;
      },
    },
    {
      title: t('reports.amount', 'Amount'),
      dataIndex: 'amount',
      key: 'amount',
      width: 160,
      align: 'right',
      render: (amount: number) => (
        <Text strong>{formatCurrency(amount)}</Text>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'trialBalance',
      label: (
        <Space>
          <FileTextOutlined />
          {t('reports.trialBalance', 'Trial Balance')}
        </Space>
      ),
      children: (
        <Spin spinning={loading}>
          <Table
            dataSource={trialBalance}
            columns={trialBalanceColumns}
            rowKey="id"
            pagination={false}
            size="small"
            scroll={{ x: 700 }}
            summary={(pageData) => {
              let totalDebit = 0;
              let totalCredit = 0;
              pageData.forEach(({ debit, credit }) => {
                totalDebit += debit || 0;
                totalCredit += credit || 0;
              });
              return (
                <Table.Summary fixed>
                  <Table.Summary.Row style={{ background: '#fafafa' }}>
                    <Table.Summary.Cell index={0} colSpan={3}>
                      <Text strong>{t('reports.totals', 'Totals')}</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={3} align="right">
                      <Text strong>{formatCurrency(totalDebit)}</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={4} align="right">
                      <Text strong>{formatCurrency(totalCredit)}</Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              );
            }}
          />
        </Spin>
      ),
    },
    {
      key: 'incomeStatement',
      label: (
        <Space>
          <BarChartOutlined />
          {t('reports.incomeStatement', 'Income Statement')}
        </Space>
      ),
      children: (
        <Spin spinning={loading}>
          <Table
            dataSource={incomeStatement}
            columns={incomeStatementColumns}
            rowKey="id"
            pagination={false}
            size="small"
            scroll={{ x: 600 }}
          />
          {(summary.totalRevenue !== undefined || summary.totalExpenses !== undefined) && (
            <Card size="small" style={{ marginTop: 16 }}>
              <Row gutter={24}>
                <Col span={8}>
                  <Text type="secondary">{t('reports.totalRevenue', 'Total Revenue')}</Text>
                  <br />
                  <Text strong style={{ fontSize: 18, color: '#52c41a' }}>
                    {formatCurrency(summary.totalRevenue || 0)}
                  </Text>
                </Col>
                <Col span={8}>
                  <Text type="secondary">{t('reports.totalExpenses', 'Total Expenses')}</Text>
                  <br />
                  <Text strong style={{ fontSize: 18, color: '#ff4d4f' }}>
                    {formatCurrency(summary.totalExpenses || 0)}
                  </Text>
                </Col>
                <Col span={8}>
                  <Text type="secondary">{t('reports.netIncome', 'Net Income')}</Text>
                  <br />
                  <Text
                    strong
                    style={{
                      fontSize: 18,
                      color: (summary.netIncome || 0) >= 0 ? '#52c41a' : '#ff4d4f',
                    }}
                  >
                    {formatCurrency(summary.netIncome || 0)}
                  </Text>
                </Col>
              </Row>
            </Card>
          )}
        </Spin>
      ),
    },
    {
      key: 'balanceSheet',
      label: (
        <Space>
          <BankOutlined />
          {t('reports.balanceSheet', 'Balance Sheet')}
        </Space>
      ),
      children: (
        <Spin spinning={loading}>
          <Table
            dataSource={balanceSheet}
            columns={balanceSheetColumns}
            rowKey="id"
            pagination={false}
            size="small"
            scroll={{ x: 600 }}
            expandable={{ defaultExpandAllRows: true }}
          />
          {(summary.totalAssets !== undefined) && (
            <Card size="small" style={{ marginTop: 16 }}>
              <Row gutter={24}>
                <Col span={8}>
                  <Text type="secondary">{t('reports.totalAssets', 'Total Assets')}</Text>
                  <br />
                  <Text strong style={{ fontSize: 18, color: '#1890ff' }}>
                    {formatCurrency(summary.totalAssets || 0)}
                  </Text>
                </Col>
                <Col span={8}>
                  <Text type="secondary">{t('reports.totalLiabilities', 'Total Liabilities')}</Text>
                  <br />
                  <Text strong style={{ fontSize: 18, color: '#ff4d4f' }}>
                    {formatCurrency(summary.totalLiabilities || 0)}
                  </Text>
                </Col>
                <Col span={8}>
                  <Text type="secondary">{t('reports.totalEquity', 'Total Equity')}</Text>
                  <br />
                  <Text strong style={{ fontSize: 18, color: '#722ed1' }}>
                    {formatCurrency(summary.totalEquity || 0)}
                  </Text>
                </Col>
              </Row>
            </Card>
          )}
        </Spin>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            {t('reports.title', 'Financial Reports')}
          </Title>
        </Col>
        <Col>
          <Space>
            <Button icon={<PrinterOutlined />}>{t('reports.print', 'Print')}</Button>
            <Button icon={<DownloadOutlined />}>{t('reports.export', 'Export')}</Button>
          </Space>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Space>
          <RangePicker
            value={dateRange}
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                setDateRange([dates[0], dates[1]]);
              }
            }}
          />
          <Button type="primary" onClick={handleGenerate}>
            {t('reports.generate', 'Generate Report')}
          </Button>
        </Space>
      </Card>

      <Card>
        <Tabs
          items={tabItems}
          activeKey={activeTab}
          onChange={handleTabChange}
        />
      </Card>
    </div>
  );
};

export default FinancialReportsPage;
