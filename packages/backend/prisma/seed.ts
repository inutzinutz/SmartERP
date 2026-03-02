import { PrismaClient, UserRole, AccountType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create Organization
  const org = await prisma.organization.create({
    data: {
      name: 'SmartERP Demo Company',
      code: 'DEMO-001',
      address: '123 Business Road, Bangkok',
      phone: '02-123-4567',
      email: 'info@smarterp-demo.com',
      taxId: '1234567890123',
      currency: 'THB',
      timezone: 'Asia/Bangkok',
      locale: 'th',
    },
  });
  console.log('✅ Organization created');

  // Create Users
  const hashedPassword = await bcrypt.hash('Password123!', 12);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@smarterp.com',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'SmartERP',
      role: UserRole.ADMIN,
      phone: '081-234-5678',
      organizationId: org.id,
    },
  });

  const manager = await prisma.user.create({
    data: {
      email: 'manager@smarterp.com',
      password: hashedPassword,
      firstName: 'Manager',
      lastName: 'Demo',
      role: UserRole.MANAGER,
      organizationId: org.id,
    },
  });

  const accountant = await prisma.user.create({
    data: {
      email: 'accountant@smarterp.com',
      password: hashedPassword,
      firstName: 'Accountant',
      lastName: 'Demo',
      role: UserRole.ACCOUNTANT,
      organizationId: org.id,
    },
  });

  const salesperson = await prisma.user.create({
    data: {
      email: 'sales@smarterp.com',
      password: hashedPassword,
      firstName: 'Sales',
      lastName: 'Demo',
      role: UserRole.SALES,
      organizationId: org.id,
    },
  });

  console.log('✅ Users created (admin/manager/accountant/sales)');

  // Create Categories
  const categories = await Promise.all([
    prisma.category.create({ data: { name: 'Electronics', code: 'ELEC', organizationId: org.id } }),
    prisma.category.create({ data: { name: 'Office Supplies', code: 'OFFC', organizationId: org.id } }),
    prisma.category.create({ data: { name: 'Food & Beverage', code: 'FOOD', organizationId: org.id } }),
    prisma.category.create({ data: { name: 'Accessories', code: 'ACCS', organizationId: org.id } }),
    prisma.category.create({ data: { name: 'Services', code: 'SRVC', organizationId: org.id } }),
  ]);
  console.log('✅ Categories created');

  // Create Products
  const products = await Promise.all([
    prisma.product.create({ data: { name: 'Laptop Computer', code: 'ELEC-001', unit: 'piece', costPrice: 25000, sellingPrice: 32000, minStock: 5, categoryId: categories[0].id, organizationId: org.id } }),
    prisma.product.create({ data: { name: 'Wireless Mouse', code: 'ELEC-002', unit: 'piece', costPrice: 350, sellingPrice: 590, minStock: 20, categoryId: categories[0].id, organizationId: org.id } }),
    prisma.product.create({ data: { name: 'USB-C Hub', code: 'ELEC-003', unit: 'piece', costPrice: 800, sellingPrice: 1290, minStock: 10, categoryId: categories[0].id, organizationId: org.id } }),
    prisma.product.create({ data: { name: 'Monitor 27"', code: 'ELEC-004', unit: 'piece', costPrice: 7500, sellingPrice: 9900, minStock: 3, categoryId: categories[0].id, organizationId: org.id } }),
    prisma.product.create({ data: { name: 'A4 Paper (Ream)', code: 'OFFC-001', unit: 'ream', costPrice: 85, sellingPrice: 120, minStock: 50, categoryId: categories[1].id, organizationId: org.id } }),
    prisma.product.create({ data: { name: 'Ballpoint Pen Box', code: 'OFFC-002', unit: 'box', costPrice: 45, sellingPrice: 75, minStock: 30, categoryId: categories[1].id, organizationId: org.id } }),
    prisma.product.create({ data: { name: 'Green Tea (Case)', code: 'FOOD-001', unit: 'case', costPrice: 180, sellingPrice: 250, minStock: 20, categoryId: categories[2].id, organizationId: org.id } }),
    prisma.product.create({ data: { name: 'Coffee Beans 1kg', code: 'FOOD-002', unit: 'kg', costPrice: 450, sellingPrice: 650, minStock: 10, categoryId: categories[2].id, organizationId: org.id } }),
    prisma.product.create({ data: { name: 'Phone Case', code: 'ACCS-001', unit: 'piece', costPrice: 120, sellingPrice: 290, minStock: 30, categoryId: categories[3].id, organizationId: org.id } }),
    prisma.product.create({ data: { name: 'Screen Protector', code: 'ACCS-002', unit: 'piece', costPrice: 50, sellingPrice: 150, minStock: 50, categoryId: categories[3].id, organizationId: org.id } }),
  ]);
  console.log('✅ Products created');

  // Create Warehouses
  const warehouses = await Promise.all([
    prisma.warehouse.create({ data: { name: 'Main Warehouse', code: 'WH-MAIN', address: 'Bangkok', isDefault: true, organizationId: org.id } }),
    prisma.warehouse.create({ data: { name: 'Branch Warehouse', code: 'WH-BRN1', address: 'Chiang Mai', organizationId: org.id } }),
  ]);
  console.log('✅ Warehouses created');

  // Create Stock Items
  for (const product of products) {
    await prisma.stockItem.create({
      data: {
        productId: product.id,
        warehouseId: warehouses[0].id,
        quantity: Math.floor(Math.random() * 100) + 10,
      },
    });
    await prisma.stockItem.create({
      data: {
        productId: product.id,
        warehouseId: warehouses[1].id,
        quantity: Math.floor(Math.random() * 50) + 5,
      },
    });
  }
  console.log('✅ Stock items created');

  // Create Customers
  const customers = await Promise.all([
    prisma.customer.create({ data: { name: 'ABC Company Ltd.', code: 'CUST-001', contactPerson: 'Mr. Somchai', email: 'somchai@abc.co.th', phone: '081-111-1111', address: 'Bangkok', creditLimit: 500000, tier: 'VIP', organizationId: org.id } }),
    prisma.customer.create({ data: { name: 'XYZ Trading Co.', code: 'CUST-002', contactPerson: 'Ms. Suda', email: 'suda@xyz.co.th', phone: '082-222-2222', address: 'Nonthaburi', creditLimit: 200000, tier: 'PREMIUM', organizationId: org.id } }),
    prisma.customer.create({ data: { name: 'Star Shop', code: 'CUST-003', contactPerson: 'Mr. Prasert', email: 'prasert@star.com', phone: '083-333-3333', address: 'Chiang Mai', tier: 'STANDARD', organizationId: org.id } }),
    prisma.customer.create({ data: { name: 'Quick Mart', code: 'CUST-004', contactPerson: 'Ms. Nida', email: 'nida@quickmart.com', phone: '084-444-4444', address: 'Phuket', tier: 'NEW', organizationId: org.id } }),
  ]);
  console.log('✅ Customers created');

  // Create Suppliers
  const suppliers = await Promise.all([
    prisma.supplier.create({ data: { name: 'Tech Supply Co.', code: 'SUP-001', contactPerson: 'Mr. John', email: 'john@techsupply.com', phone: '085-555-5555', address: 'Shenzhen, China', organizationId: org.id } }),
    prisma.supplier.create({ data: { name: 'Paper World Ltd.', code: 'SUP-002', contactPerson: 'Ms. Lisa', email: 'lisa@paperworld.com', phone: '086-666-6666', address: 'Bangkok', organizationId: org.id } }),
    prisma.supplier.create({ data: { name: 'Fresh Foods Inc.', code: 'SUP-003', contactPerson: 'Mr. Chai', email: 'chai@freshfoods.com', phone: '087-777-7777', address: 'Nakhon Ratchasima', organizationId: org.id } }),
  ]);
  console.log('✅ Suppliers created');

  // Create Chart of Accounts
  const accounts = {
    // Assets
    assets: await prisma.account.create({ data: { code: '1000', name: 'Assets', type: AccountType.ASSET, organizationId: org.id, isSystem: true } }),
    cash: null as any,
    bank: null as any,
    ar: null as any,
    inventory: null as any,
    // Liabilities
    liabilities: await prisma.account.create({ data: { code: '2000', name: 'Liabilities', type: AccountType.LIABILITY, organizationId: org.id, isSystem: true } }),
    ap: null as any,
    // Equity
    equity: await prisma.account.create({ data: { code: '3000', name: 'Equity', type: AccountType.EQUITY, organizationId: org.id, isSystem: true } }),
    // Revenue
    revenue: await prisma.account.create({ data: { code: '4000', name: 'Revenue', type: AccountType.REVENUE, organizationId: org.id, isSystem: true } }),
    // Expense
    expense: await prisma.account.create({ data: { code: '5000', name: 'Expenses', type: AccountType.EXPENSE, organizationId: org.id, isSystem: true } }),
  };

  // Sub-accounts
  accounts.cash = await prisma.account.create({ data: { code: '1100', name: 'Cash', type: AccountType.ASSET, parentId: accounts.assets.id, organizationId: org.id, balance: 1500000 } });
  accounts.bank = await prisma.account.create({ data: { code: '1200', name: 'Bank Account', type: AccountType.ASSET, parentId: accounts.assets.id, organizationId: org.id, balance: 5000000 } });
  accounts.ar = await prisma.account.create({ data: { code: '1300', name: 'Accounts Receivable', type: AccountType.ASSET, parentId: accounts.assets.id, organizationId: org.id, balance: 850000 } });
  accounts.inventory = await prisma.account.create({ data: { code: '1400', name: 'Inventory', type: AccountType.ASSET, parentId: accounts.assets.id, organizationId: org.id, balance: 2000000 } });
  accounts.ap = await prisma.account.create({ data: { code: '2100', name: 'Accounts Payable', type: AccountType.LIABILITY, parentId: accounts.liabilities.id, organizationId: org.id, balance: 650000 } });

  await prisma.account.create({ data: { code: '3100', name: 'Retained Earnings', type: AccountType.EQUITY, parentId: accounts.equity.id, organizationId: org.id, balance: 8100000 } });
  await prisma.account.create({ data: { code: '4100', name: 'Sales Revenue', type: AccountType.REVENUE, parentId: accounts.revenue.id, organizationId: org.id } });
  await prisma.account.create({ data: { code: '4200', name: 'Service Revenue', type: AccountType.REVENUE, parentId: accounts.revenue.id, organizationId: org.id } });
  await prisma.account.create({ data: { code: '5100', name: 'Cost of Goods Sold', type: AccountType.EXPENSE, parentId: accounts.expense.id, organizationId: org.id } });
  await prisma.account.create({ data: { code: '5200', name: 'Salary Expense', type: AccountType.EXPENSE, parentId: accounts.expense.id, organizationId: org.id } });
  await prisma.account.create({ data: { code: '5300', name: 'Rent Expense', type: AccountType.EXPENSE, parentId: accounts.expense.id, organizationId: org.id } });
  await prisma.account.create({ data: { code: '5400', name: 'Utilities Expense', type: AccountType.EXPENSE, parentId: accounts.expense.id, organizationId: org.id } });

  console.log('✅ Chart of Accounts created');

  // Create Sample Sales Orders
  for (let i = 0; i < 5; i++) {
    const customer = customers[i % customers.length];
    const product = products[i % products.length];
    const qty = Math.floor(Math.random() * 10) + 1;
    const subtotal = Number(product.sellingPrice) * qty;
    const tax = subtotal * 0.07;

    await prisma.salesOrder.create({
      data: {
        orderNumber: `SO-${String(i + 1).padStart(5, '0')}`,
        status: i < 2 ? 'DRAFT' : i < 4 ? 'CONFIRMED' : 'COMPLETED',
        orderDate: new Date(Date.now() - i * 86400000 * 3),
        subtotal,
        taxAmount: tax,
        totalAmount: subtotal + tax,
        customerId: customer.id,
        userId: salesperson.id,
        items: {
          create: {
            productId: product.id,
            quantity: qty,
            unitPrice: Number(product.sellingPrice),
            taxRate: 7,
            totalAmount: subtotal + tax,
          },
        },
      },
    });
  }
  console.log('✅ Sample Sales Orders created');

  // Create Store
  await prisma.store.create({
    data: {
      name: 'Main Store',
      code: 'STORE-001',
      address: 'Ground Floor, Business Building',
      phone: '02-999-8888',
      organizationId: org.id,
    },
  });
  console.log('✅ Store created');

  console.log('');
  console.log('🎉 Database seeded successfully!');
  console.log('');
  console.log('📋 Demo Accounts:');
  console.log('   Admin:      admin@smarterp.com / Password123!');
  console.log('   Manager:    manager@smarterp.com / Password123!');
  console.log('   Accountant: accountant@smarterp.com / Password123!');
  console.log('   Sales:      sales@smarterp.com / Password123!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
