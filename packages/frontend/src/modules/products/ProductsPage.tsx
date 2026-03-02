import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Table,
  Button,
  Input,
  Space,
  Tag,
  Modal,
  Form,
  InputNumber,
  Select,
  message,
  Typography,
  Popconfirm,
  Row,
  Col,
  Card,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import { api, formatCurrency } from '@/utils/api';

const { Title } = Typography;

interface Product {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  costPrice: number;
  sellingPrice: number;
  currentStock: number;
  status: string;
  description?: string;
  reorderLevel?: number;
}

interface ProductFormValues {
  code: string;
  name: string;
  category: string;
  unit: string;
  costPrice: number;
  sellingPrice: number;
  description?: string;
  reorderLevel?: number;
}

interface PaginatedResponse {
  data: Product[];
  total: number;
  page: number;
  limit: number;
}

const ProductsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<ProductFormValues>();

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<PaginatedResponse>('/products', {
        params: { page, limit: pageSize, search: search || undefined },
      });
      setProducts(data.data);
      setTotal(data.total);
    } catch {
      // handled by interceptor
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleOpenCreate = () => {
    setEditingProduct(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleOpenEdit = (product: Product) => {
    setEditingProduct(product);
    form.setFieldsValue({
      code: product.code,
      name: product.name,
      category: product.category,
      unit: product.unit,
      costPrice: product.costPrice,
      sellingPrice: product.sellingPrice,
      description: product.description,
      reorderLevel: product.reorderLevel,
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/products/${id}`);
      message.success(t('products.deleteSuccess', 'Product deleted successfully'));
      fetchProducts();
    } catch {
      // handled by interceptor
    }
  };

  const handleSubmit = async (values: ProductFormValues) => {
    setSubmitting(true);
    try {
      if (editingProduct) {
        await api.put(`/products/${editingProduct.id}`, values);
        message.success(t('products.updateSuccess', 'Product updated successfully'));
      } else {
        await api.post('/products', values);
        message.success(t('products.createSuccess', 'Product created successfully'));
      }
      setModalOpen(false);
      form.resetFields();
      fetchProducts();
    } catch {
      // handled by interceptor
    } finally {
      setSubmitting(false);
    }
  };

  const statusColor: Record<string, string> = {
    ACTIVE: 'green',
    INACTIVE: 'red',
    DISCONTINUED: 'default',
  };

  const columns: ColumnsType<Product> = [
    {
      title: t('products.code', 'Code'),
      dataIndex: 'code',
      key: 'code',
      width: 120,
      render: (text: string) => <Typography.Text code>{text}</Typography.Text>,
    },
    {
      title: t('products.name', 'Name'),
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      render: (text: string) => <Typography.Text strong>{text}</Typography.Text>,
    },
    {
      title: t('products.category', 'Category'),
      dataIndex: 'category',
      key: 'category',
      width: 130,
      render: (cat: string) => <Tag>{cat}</Tag>,
    },
    {
      title: t('products.unit', 'Unit'),
      dataIndex: 'unit',
      key: 'unit',
      width: 80,
    },
    {
      title: t('products.costPrice', 'Cost Price'),
      dataIndex: 'costPrice',
      key: 'costPrice',
      width: 130,
      align: 'right',
      render: (price: number) => formatCurrency(price),
    },
    {
      title: t('products.sellingPrice', 'Selling Price'),
      dataIndex: 'sellingPrice',
      key: 'sellingPrice',
      width: 130,
      align: 'right',
      render: (price: number) => formatCurrency(price),
    },
    {
      title: t('products.stock', 'Stock'),
      dataIndex: 'currentStock',
      key: 'currentStock',
      width: 90,
      align: 'right',
      render: (stock: number) => (
        <Typography.Text type={stock <= 0 ? 'danger' : stock < 10 ? 'warning' : undefined}>
          {stock}
        </Typography.Text>
      ),
    },
    {
      title: t('products.status', 'Status'),
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status: string) => (
        <Tag color={statusColor[status] || 'default'}>{status}</Tag>
      ),
    },
    {
      title: t('common.actions', 'Actions'),
      key: 'actions',
      width: 150,
      render: (_: unknown, record: Product) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/products/${record.id}`)}
          />
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenEdit(record)}
          />
          <Popconfirm
            title={t('products.deleteConfirm', 'Delete this product?')}
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

  const categoryOptions = [
    { value: 'ELECTRONICS', label: t('products.catElectronics', 'Electronics') },
    { value: 'FURNITURE', label: t('products.catFurniture', 'Furniture') },
    { value: 'CLOTHING', label: t('products.catClothing', 'Clothing') },
    { value: 'FOOD', label: t('products.catFood', 'Food & Beverage') },
    { value: 'RAW_MATERIAL', label: t('products.catRawMaterial', 'Raw Material') },
    { value: 'OTHER', label: t('products.catOther', 'Other') },
  ];

  const unitOptions = [
    { value: 'PCS', label: t('products.unitPcs', 'Pieces') },
    { value: 'KG', label: t('products.unitKg', 'Kilogram') },
    { value: 'M', label: t('products.unitM', 'Meter') },
    { value: 'L', label: t('products.unitL', 'Liter') },
    { value: 'BOX', label: t('products.unitBox', 'Box') },
    { value: 'SET', label: t('products.unitSet', 'Set') },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            {t('products.title', 'Products')}
          </Title>
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
            {t('products.addProduct', 'Add Product')}
          </Button>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Input
          placeholder={t('products.searchPlaceholder', 'Search by name or code...')}
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
          dataSource={products}
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
          scroll={{ x: 1100 }}
        />
      </Card>

      <Modal
        title={
          editingProduct
            ? t('products.editProduct', 'Edit Product')
            : t('products.addProduct', 'Add Product')
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
                label={t('products.code', 'Code')}
                rules={[{ required: true, message: t('products.codeRequired', 'Product code is required') }]}
              >
                <Input placeholder="PRD-001" disabled={!!editingProduct} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="name"
                label={t('products.name', 'Name')}
                rules={[{ required: true, message: t('products.nameRequired', 'Product name is required') }]}
              >
                <Input placeholder={t('products.namePlaceholder', 'Product name')} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="category"
                label={t('products.category', 'Category')}
                rules={[{ required: true, message: t('products.categoryRequired', 'Category is required') }]}
              >
                <Select options={categoryOptions} placeholder={t('products.selectCategory', 'Select category')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="unit"
                label={t('products.unit', 'Unit')}
                rules={[{ required: true, message: t('products.unitRequired', 'Unit is required') }]}
              >
                <Select options={unitOptions} placeholder={t('products.selectUnit', 'Select unit')} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="costPrice"
                label={t('products.costPrice', 'Cost Price')}
                rules={[{ required: true, message: t('products.costPriceRequired', 'Cost price is required') }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={2}
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="sellingPrice"
                label={t('products.sellingPrice', 'Selling Price')}
                rules={[{ required: true, message: t('products.sellingPriceRequired', 'Selling price is required') }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={2}
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="reorderLevel"
            label={t('products.reorderLevel', 'Reorder Level')}
          >
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>

          <Form.Item
            name="description"
            label={t('products.description', 'Description')}
          >
            <Input.TextArea rows={3} placeholder={t('products.descriptionPlaceholder', 'Product description')} />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalOpen(false)}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button type="primary" htmlType="submit" loading={submitting}>
                {editingProduct ? t('common.update', 'Update') : t('common.create', 'Create')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ProductsPage;
