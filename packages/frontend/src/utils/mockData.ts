// ============================================================
// SmartERP Mock Data - Full demo dataset
// ============================================================

const uuid = () => crypto.randomUUID?.() || Math.random().toString(36).substring(2) + Date.now().toString(36);
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

// --- Organization ---
export const mockOrganization = {
  id: uuid(),
  name: 'SmartERP Demo Company',
  code: 'DEMO-001',
  address: '123 Business Road, Bangkok 10110',
  phone: '02-123-4567',
  email: 'info@smarterp-demo.com',
  taxId: '1234567890123',
  currency: 'THB',
  timezone: 'Asia/Bangkok',
  locale: 'th',
  logo: null,
};

// --- Users ---
export const mockUsers = [
  { id: 'u1', email: 'admin@smarterp.com', firstName: 'Admin', lastName: 'SmartERP', role: 'ADMIN', phone: '081-234-5678', avatar: null, isActive: true, lastLoginAt: daysAgo(0), createdAt: daysAgo(90), organizationId: mockOrganization.id, organization: mockOrganization },
  { id: 'u2', email: 'manager@smarterp.com', firstName: 'Somchai', lastName: 'Manager', role: 'MANAGER', phone: '082-111-2222', avatar: null, isActive: true, lastLoginAt: daysAgo(1), createdAt: daysAgo(80), organizationId: mockOrganization.id, organization: mockOrganization },
  { id: 'u3', email: 'accountant@smarterp.com', firstName: 'Suda', lastName: 'Accountant', role: 'ACCOUNTANT', phone: '083-333-4444', avatar: null, isActive: true, lastLoginAt: daysAgo(0), createdAt: daysAgo(75), organizationId: mockOrganization.id, organization: mockOrganization },
  { id: 'u4', email: 'sales@smarterp.com', firstName: 'Prasert', lastName: 'Sales', role: 'SALES', phone: '084-555-6666', avatar: null, isActive: true, lastLoginAt: daysAgo(2), createdAt: daysAgo(60), organizationId: mockOrganization.id, organization: mockOrganization },
  { id: 'u5', email: 'warehouse@smarterp.com', firstName: 'Nida', lastName: 'Warehouse', role: 'WAREHOUSE', phone: '085-777-8888', avatar: null, isActive: true, lastLoginAt: daysAgo(0), createdAt: daysAgo(50), organizationId: mockOrganization.id, organization: mockOrganization },
];

// --- Categories ---
export const mockCategories = [
  { id: 'cat1', name: 'Electronics', code: 'ELEC', isActive: true, organizationId: mockOrganization.id },
  { id: 'cat2', name: 'Office Supplies', code: 'OFFC', isActive: true, organizationId: mockOrganization.id },
  { id: 'cat3', name: 'Food & Beverage', code: 'FOOD', isActive: true, organizationId: mockOrganization.id },
  { id: 'cat4', name: 'Accessories', code: 'ACCS', isActive: true, organizationId: mockOrganization.id },
  { id: 'cat5', name: 'Services', code: 'SRVC', isActive: true, organizationId: mockOrganization.id },
];

// --- Products ---
export const mockProducts = [
  { id: 'p1', name: 'Laptop Computer', code: 'ELEC-001', barcode: '8851234001', unit: 'piece', costPrice: 25000, sellingPrice: 32000, minStock: 5, maxStock: 50, imageUrl: null, isActive: true, trackInventory: true, categoryId: 'cat1', category: mockCategories[0], organizationId: mockOrganization.id, createdAt: daysAgo(60), updatedAt: daysAgo(2) },
  { id: 'p2', name: 'Wireless Mouse', code: 'ELEC-002', barcode: '8851234002', unit: 'piece', costPrice: 350, sellingPrice: 590, minStock: 20, maxStock: 200, imageUrl: null, isActive: true, trackInventory: true, categoryId: 'cat1', category: mockCategories[0], organizationId: mockOrganization.id, createdAt: daysAgo(55), updatedAt: daysAgo(1) },
  { id: 'p3', name: 'USB-C Hub 7-in-1', code: 'ELEC-003', barcode: '8851234003', unit: 'piece', costPrice: 800, sellingPrice: 1290, minStock: 10, maxStock: 100, imageUrl: null, isActive: true, trackInventory: true, categoryId: 'cat1', category: mockCategories[0], organizationId: mockOrganization.id, createdAt: daysAgo(50), updatedAt: daysAgo(3) },
  { id: 'p4', name: 'Monitor 27" 4K', code: 'ELEC-004', barcode: '8851234004', unit: 'piece', costPrice: 7500, sellingPrice: 9900, minStock: 3, maxStock: 30, imageUrl: null, isActive: true, trackInventory: true, categoryId: 'cat1', category: mockCategories[0], organizationId: mockOrganization.id, createdAt: daysAgo(45), updatedAt: daysAgo(5) },
  { id: 'p5', name: 'A4 Paper (Ream)', code: 'OFFC-001', barcode: '8851234005', unit: 'ream', costPrice: 85, sellingPrice: 120, minStock: 50, maxStock: 500, imageUrl: null, isActive: true, trackInventory: true, categoryId: 'cat2', category: mockCategories[1], organizationId: mockOrganization.id, createdAt: daysAgo(40), updatedAt: daysAgo(0) },
  { id: 'p6', name: 'Ballpoint Pen Box (12)', code: 'OFFC-002', barcode: '8851234006', unit: 'box', costPrice: 45, sellingPrice: 75, minStock: 30, maxStock: 300, imageUrl: null, isActive: true, trackInventory: true, categoryId: 'cat2', category: mockCategories[1], organizationId: mockOrganization.id, createdAt: daysAgo(38), updatedAt: daysAgo(1) },
  { id: 'p7', name: 'Green Tea (Case 24)', code: 'FOOD-001', barcode: '8851234007', unit: 'case', costPrice: 180, sellingPrice: 250, minStock: 20, maxStock: 200, imageUrl: null, isActive: true, trackInventory: true, categoryId: 'cat3', category: mockCategories[2], organizationId: mockOrganization.id, createdAt: daysAgo(35), updatedAt: daysAgo(2) },
  { id: 'p8', name: 'Coffee Beans 1kg Premium', code: 'FOOD-002', barcode: '8851234008', unit: 'kg', costPrice: 450, sellingPrice: 650, minStock: 10, maxStock: 100, imageUrl: null, isActive: true, trackInventory: true, categoryId: 'cat3', category: mockCategories[2], organizationId: mockOrganization.id, createdAt: daysAgo(30), updatedAt: daysAgo(0) },
  { id: 'p9', name: 'Phone Case Premium', code: 'ACCS-001', barcode: '8851234009', unit: 'piece', costPrice: 120, sellingPrice: 290, minStock: 30, maxStock: 300, imageUrl: null, isActive: true, trackInventory: true, categoryId: 'cat4', category: mockCategories[3], organizationId: mockOrganization.id, createdAt: daysAgo(25), updatedAt: daysAgo(1) },
  { id: 'p10', name: 'Screen Protector 9H', code: 'ACCS-002', barcode: '8851234010', unit: 'piece', costPrice: 50, sellingPrice: 150, minStock: 50, maxStock: 500, imageUrl: null, isActive: true, trackInventory: true, categoryId: 'cat4', category: mockCategories[3], organizationId: mockOrganization.id, createdAt: daysAgo(20), updatedAt: daysAgo(0) },
];

// --- Warehouses ---
export const mockWarehouses = [
  { id: 'wh1', name: 'Main Warehouse', code: 'WH-MAIN', address: 'Bangkok', contactPerson: 'Somchai', phone: '02-111-2222', isDefault: true, isActive: true, organizationId: mockOrganization.id, createdAt: daysAgo(90), updatedAt: daysAgo(0) },
  { id: 'wh2', name: 'Branch Warehouse', code: 'WH-BRN1', address: 'Chiang Mai', contactPerson: 'Nida', phone: '053-333-4444', isDefault: false, isActive: true, organizationId: mockOrganization.id, createdAt: daysAgo(60), updatedAt: daysAgo(0) },
];

// --- Stock Items ---
export const mockStockItems = mockProducts.flatMap((p, i) => [
  { id: `si${i * 2 + 1}`, productId: p.id, product: p, warehouseId: 'wh1', warehouse: mockWarehouses[0], quantity: Math.floor(Math.random() * 80) + 15, reservedQty: 0 },
  { id: `si${i * 2 + 2}`, productId: p.id, product: p, warehouseId: 'wh2', warehouse: mockWarehouses[1], quantity: Math.floor(Math.random() * 40) + 5, reservedQty: 0 },
]);

// --- Stock Movements ---
export const mockStockMovements = [
  { id: 'sm1', type: 'IN', quantity: 50, reference: 'PO-00001', notes: 'Initial stock', productId: 'p1', product: mockProducts[0], warehouseId: 'wh1', warehouse: mockWarehouses[0], createdAt: daysAgo(30) },
  { id: 'sm2', type: 'OUT', quantity: 5, reference: 'SO-00001', notes: 'Sales order', productId: 'p1', product: mockProducts[0], warehouseId: 'wh1', warehouse: mockWarehouses[0], createdAt: daysAgo(25) },
  { id: 'sm3', type: 'IN', quantity: 100, reference: 'PO-00002', notes: 'Restock', productId: 'p2', product: mockProducts[1], warehouseId: 'wh1', warehouse: mockWarehouses[0], createdAt: daysAgo(20) },
  { id: 'sm4', type: 'TRANSFER', quantity: 20, reference: 'TF-00001', notes: 'Transfer to branch', productId: 'p2', product: mockProducts[1], warehouseId: 'wh2', warehouse: mockWarehouses[1], createdAt: daysAgo(18) },
  { id: 'sm5', type: 'OUT', quantity: 10, reference: 'SO-00002', notes: 'Sales order', productId: 'p5', product: mockProducts[4], warehouseId: 'wh1', warehouse: mockWarehouses[0], createdAt: daysAgo(15) },
  { id: 'sm6', type: 'ADJUSTMENT', quantity: -3, reference: 'ADJ-00001', notes: 'Damaged items', productId: 'p9', product: mockProducts[8], warehouseId: 'wh1', warehouse: mockWarehouses[0], createdAt: daysAgo(10) },
];

// --- Customers ---
export const mockCustomers = [
  { id: 'c1', name: 'ABC Company Ltd.', code: 'CUST-001', contactPerson: 'Mr. Somchai', email: 'somchai@abc.co.th', phone: '081-111-1111', address: '456 Sukhumvit Rd, Bangkok', taxId: '1234567890001', creditLimit: 500000, creditDays: 30, tier: 'VIP', isActive: true, organizationId: mockOrganization.id, createdAt: daysAgo(80), updatedAt: daysAgo(1) },
  { id: 'c2', name: 'XYZ Trading Co.', code: 'CUST-002', contactPerson: 'Ms. Suda', email: 'suda@xyz.co.th', phone: '082-222-2222', address: '789 Ratchada Rd, Nonthaburi', taxId: '1234567890002', creditLimit: 200000, creditDays: 30, tier: 'PREMIUM', isActive: true, organizationId: mockOrganization.id, createdAt: daysAgo(70), updatedAt: daysAgo(3) },
  { id: 'c3', name: 'Star Electronics Shop', code: 'CUST-003', contactPerson: 'Mr. Prasert', email: 'prasert@star.com', phone: '083-333-3333', address: '321 Nimman Rd, Chiang Mai', taxId: '1234567890003', creditLimit: 100000, creditDays: 15, tier: 'STANDARD', isActive: true, organizationId: mockOrganization.id, createdAt: daysAgo(60), updatedAt: daysAgo(5) },
  { id: 'c4', name: 'Quick Mart', code: 'CUST-004', contactPerson: 'Ms. Nida', email: 'nida@quickmart.com', phone: '084-444-4444', address: '555 Patong Rd, Phuket', taxId: '1234567890004', creditLimit: 50000, creditDays: 7, tier: 'NEW', isActive: true, organizationId: mockOrganization.id, createdAt: daysAgo(30), updatedAt: daysAgo(0) },
  { id: 'c5', name: 'Tech Solutions Co.', code: 'CUST-005', contactPerson: 'Mr. Chai', email: 'chai@techsol.co.th', phone: '085-555-5555', address: '99 Phahonyothin Rd, Bangkok', taxId: '1234567890005', creditLimit: 300000, creditDays: 45, tier: 'PREMIUM', isActive: true, organizationId: mockOrganization.id, createdAt: daysAgo(50), updatedAt: daysAgo(2) },
];

// --- Suppliers ---
export const mockSuppliers = [
  { id: 's1', name: 'Tech Supply Co.', code: 'SUP-001', contactPerson: 'Mr. John Chen', email: 'john@techsupply.com', phone: '085-555-5555', address: 'Shenzhen, China', taxId: 'CN123456', paymentTerms: 30, isActive: true, organizationId: mockOrganization.id, createdAt: daysAgo(85), updatedAt: daysAgo(0) },
  { id: 's2', name: 'Paper World Ltd.', code: 'SUP-002', contactPerson: 'Ms. Lisa', email: 'lisa@paperworld.com', phone: '086-666-6666', address: '88 Charoenkrung Rd, Bangkok', taxId: '9876543210001', paymentTerms: 15, isActive: true, organizationId: mockOrganization.id, createdAt: daysAgo(80), updatedAt: daysAgo(1) },
  { id: 's3', name: 'Fresh Foods Inc.', code: 'SUP-003', contactPerson: 'Mr. Chai Kittisak', email: 'chai@freshfoods.com', phone: '087-777-7777', address: '123 Market Rd, Nakhon Ratchasima', taxId: '9876543210002', paymentTerms: 7, isActive: true, organizationId: mockOrganization.id, createdAt: daysAgo(75), updatedAt: daysAgo(3) },
];

// --- Sales Orders ---
export const mockSalesOrders = [
  { id: 'so1', orderNumber: 'SO-00001', status: 'COMPLETED', orderDate: daysAgo(15), deliveryDate: daysAgo(12), subtotal: 160000, taxAmount: 11200, discountAmount: 0, totalAmount: 171200, notes: null, customerId: 'c1', customer: mockCustomers[0], userId: 'u4', user: mockUsers[3], items: [{ id: 'soi1', quantity: 5, unitPrice: 32000, discount: 0, taxRate: 7, totalAmount: 171200, productId: 'p1', product: mockProducts[0] }], createdAt: daysAgo(15), updatedAt: daysAgo(12) },
  { id: 'so2', orderNumber: 'SO-00002', status: 'CONFIRMED', orderDate: daysAgo(10), deliveryDate: daysAgo(5), subtotal: 11800, taxAmount: 826, discountAmount: 0, totalAmount: 12626, notes: 'Urgent delivery', customerId: 'c2', customer: mockCustomers[1], userId: 'u4', user: mockUsers[3], items: [{ id: 'soi2', quantity: 20, unitPrice: 590, discount: 0, taxRate: 7, totalAmount: 12626, productId: 'p2', product: mockProducts[1] }], createdAt: daysAgo(10), updatedAt: daysAgo(8) },
  { id: 'so3', orderNumber: 'SO-00003', status: 'PROCESSING', orderDate: daysAgo(7), deliveryDate: null, subtotal: 19800, taxAmount: 1386, discountAmount: 500, totalAmount: 20686, notes: null, customerId: 'c3', customer: mockCustomers[2], userId: 'u4', user: mockUsers[3], items: [{ id: 'soi3', quantity: 2, unitPrice: 9900, discount: 500, taxRate: 7, totalAmount: 20686, productId: 'p4', product: mockProducts[3] }], createdAt: daysAgo(7), updatedAt: daysAgo(6) },
  { id: 'so4', orderNumber: 'SO-00004', status: 'DRAFT', orderDate: daysAgo(3), deliveryDate: null, subtotal: 6500, taxAmount: 455, discountAmount: 0, totalAmount: 6955, notes: 'Awaiting confirmation', customerId: 'c5', customer: mockCustomers[4], userId: 'u4', user: mockUsers[3], items: [{ id: 'soi4', quantity: 10, unitPrice: 650, discount: 0, taxRate: 7, totalAmount: 6955, productId: 'p8', product: mockProducts[7] }], createdAt: daysAgo(3), updatedAt: daysAgo(3) },
  { id: 'so5', orderNumber: 'SO-00005', status: 'DRAFT', orderDate: daysAgo(1), deliveryDate: null, subtotal: 14500, taxAmount: 1015, discountAmount: 0, totalAmount: 15515, notes: null, customerId: 'c4', customer: mockCustomers[3], userId: 'u4', user: mockUsers[3], items: [{ id: 'soi5a', quantity: 50, unitPrice: 290, discount: 0, taxRate: 7, totalAmount: 15515, productId: 'p9', product: mockProducts[8] }], createdAt: daysAgo(1), updatedAt: daysAgo(1) },
];

// --- Purchase Orders ---
export const mockPurchaseOrders = [
  { id: 'po1', orderNumber: 'PO-00001', status: 'COMPLETED', orderDate: daysAgo(30), expectedDate: daysAgo(25), subtotal: 250000, taxAmount: 17500, discountAmount: 0, totalAmount: 267500, notes: null, supplierId: 's1', supplier: mockSuppliers[0], userId: 'u2', user: mockUsers[1], items: [{ id: 'poi1', quantity: 10, unitPrice: 25000, discount: 0, taxRate: 7, totalAmount: 267500, receivedQty: 10, productId: 'p1', product: mockProducts[0] }], createdAt: daysAgo(30), updatedAt: daysAgo(25) },
  { id: 'po2', orderNumber: 'PO-00002', status: 'CONFIRMED', orderDate: daysAgo(12), expectedDate: daysAgo(2), subtotal: 8500, taxAmount: 595, discountAmount: 0, totalAmount: 9095, notes: null, supplierId: 's2', supplier: mockSuppliers[1], userId: 'u2', user: mockUsers[1], items: [{ id: 'poi2', quantity: 100, unitPrice: 85, discount: 0, taxRate: 7, totalAmount: 9095, receivedQty: 0, productId: 'p5', product: mockProducts[4] }], createdAt: daysAgo(12), updatedAt: daysAgo(10) },
  { id: 'po3', orderNumber: 'PO-00003', status: 'DRAFT', orderDate: daysAgo(2), expectedDate: null, subtotal: 45000, taxAmount: 3150, discountAmount: 0, totalAmount: 48150, notes: 'New batch', supplierId: 's3', supplier: mockSuppliers[2], userId: 'u2', user: mockUsers[1], items: [{ id: 'poi3', quantity: 100, unitPrice: 450, discount: 0, taxRate: 7, totalAmount: 48150, receivedQty: 0, productId: 'p8', product: mockProducts[7] }], createdAt: daysAgo(2), updatedAt: daysAgo(2) },
];

// --- Accounts (Chart of Accounts) ---
export const mockAccounts = [
  { id: 'a1', code: '1000', name: 'Assets', type: 'ASSET', parentId: null, balance: 0, isActive: true, isSystem: true, children: [] as typeof mockAccounts },
  { id: 'a1a', code: '1100', name: 'Cash', type: 'ASSET', parentId: 'a1', balance: 1500000, isActive: true, isSystem: false },
  { id: 'a1b', code: '1200', name: 'Bank Account', type: 'ASSET', parentId: 'a1', balance: 5000000, isActive: true, isSystem: false },
  { id: 'a1c', code: '1300', name: 'Accounts Receivable', type: 'ASSET', parentId: 'a1', balance: 850000, isActive: true, isSystem: false },
  { id: 'a1d', code: '1400', name: 'Inventory', type: 'ASSET', parentId: 'a1', balance: 2000000, isActive: true, isSystem: false },
  { id: 'a2', code: '2000', name: 'Liabilities', type: 'LIABILITY', parentId: null, balance: 0, isActive: true, isSystem: true },
  { id: 'a2a', code: '2100', name: 'Accounts Payable', type: 'LIABILITY', parentId: 'a2', balance: 650000, isActive: true, isSystem: false },
  { id: 'a3', code: '3000', name: 'Equity', type: 'EQUITY', parentId: null, balance: 0, isActive: true, isSystem: true },
  { id: 'a3a', code: '3100', name: 'Retained Earnings', type: 'EQUITY', parentId: 'a3', balance: 8100000, isActive: true, isSystem: false },
  { id: 'a4', code: '4000', name: 'Revenue', type: 'REVENUE', parentId: null, balance: 0, isActive: true, isSystem: true },
  { id: 'a4a', code: '4100', name: 'Sales Revenue', type: 'REVENUE', parentId: 'a4', balance: 1250000, isActive: true, isSystem: false },
  { id: 'a4b', code: '4200', name: 'Service Revenue', type: 'REVENUE', parentId: 'a4', balance: 180000, isActive: true, isSystem: false },
  { id: 'a5', code: '5000', name: 'Expenses', type: 'EXPENSE', parentId: null, balance: 0, isActive: true, isSystem: true },
  { id: 'a5a', code: '5100', name: 'Cost of Goods Sold', type: 'EXPENSE', parentId: 'a5', balance: 520000, isActive: true, isSystem: false },
  { id: 'a5b', code: '5200', name: 'Salary Expense', type: 'EXPENSE', parentId: 'a5', balance: 350000, isActive: true, isSystem: false },
  { id: 'a5c', code: '5300', name: 'Rent Expense', type: 'EXPENSE', parentId: 'a5', balance: 120000, isActive: true, isSystem: false },
  { id: 'a5d', code: '5400', name: 'Utilities Expense', type: 'EXPENSE', parentId: 'a5', balance: 45000, isActive: true, isSystem: false },
];

// --- Journal Entries ---
export const mockJournalEntries = [
  { id: 'je1', entryNumber: 'JE-00001', date: daysAgo(20), description: 'Sales revenue recognition', reference: 'SO-00001', isPosted: true, createdAt: daysAgo(20), lines: [
    { id: 'jl1', debit: 171200, credit: 0, description: 'Cash received', accountId: 'a1a', account: { code: '1100', name: 'Cash' } },
    { id: 'jl2', debit: 0, credit: 171200, description: 'Sales revenue', accountId: 'a4a', account: { code: '4100', name: 'Sales Revenue' } },
  ]},
  { id: 'je2', entryNumber: 'JE-00002', date: daysAgo(15), description: 'Monthly salary payment', reference: null, isPosted: true, createdAt: daysAgo(15), lines: [
    { id: 'jl3', debit: 350000, credit: 0, description: 'Salary expense', accountId: 'a5b', account: { code: '5200', name: 'Salary Expense' } },
    { id: 'jl4', debit: 0, credit: 350000, description: 'Bank payment', accountId: 'a1b', account: { code: '1200', name: 'Bank Account' } },
  ]},
  { id: 'je3', entryNumber: 'JE-00003', date: daysAgo(5), description: 'Rent payment', reference: 'INV-RENT-001', isPosted: false, createdAt: daysAgo(5), lines: [
    { id: 'jl5', debit: 120000, credit: 0, description: 'Monthly rent', accountId: 'a5c', account: { code: '5300', name: 'Rent Expense' } },
    { id: 'jl6', debit: 0, credit: 120000, description: 'Bank transfer', accountId: 'a1b', account: { code: '1200', name: 'Bank Account' } },
  ]},
];

// --- Expense Claims ---
export const mockExpenses = [
  { id: 'ec1', claimNumber: 'EXP-00001', title: 'Business Trip - Chiang Mai', description: 'Client meeting and site visit', totalAmount: 15800, status: 'APPROVED', submittedAt: daysAgo(20), approvedAt: daysAgo(18), userId: 'u4', user: mockUsers[3], items: [
    { id: 'ei1', description: 'Flight tickets', amount: 5200, category: 'Travel', receiptUrl: null, expenseDate: daysAgo(22) },
    { id: 'ei2', description: 'Hotel (2 nights)', amount: 6400, category: 'Accommodation', receiptUrl: null, expenseDate: daysAgo(21) },
    { id: 'ei3', description: 'Meals & transport', amount: 4200, category: 'Meals', receiptUrl: null, expenseDate: daysAgo(20) },
  ], createdAt: daysAgo(20) },
  { id: 'ec2', claimNumber: 'EXP-00002', title: 'Office Supplies Purchase', description: 'Monthly office supplies', totalAmount: 3500, status: 'PENDING', submittedAt: daysAgo(5), approvedAt: null, userId: 'u3', user: mockUsers[2], items: [
    { id: 'ei4', description: 'Printer toner', amount: 2200, category: 'Office Supplies', receiptUrl: null, expenseDate: daysAgo(6) },
    { id: 'ei5', description: 'Stationery', amount: 1300, category: 'Office Supplies', receiptUrl: null, expenseDate: daysAgo(6) },
  ], createdAt: daysAgo(5) },
  { id: 'ec3', claimNumber: 'EXP-00003', title: 'Client Entertainment', description: 'Dinner with VIP client', totalAmount: 8500, status: 'PENDING', submittedAt: daysAgo(2), approvedAt: null, userId: 'u4', user: mockUsers[3], items: [
    { id: 'ei6', description: 'Restaurant dinner', amount: 8500, category: 'Entertainment', receiptUrl: null, expenseDate: daysAgo(3) },
  ], createdAt: daysAgo(2) },
];

// --- Dashboard KPIs ---
export const mockDashboardKpis = {
  totalCustomers: { value: mockCustomers.length, growth: 12.5 },
  totalSuppliers: { value: mockSuppliers.length, growth: 0 },
  totalProducts: { value: mockProducts.length, growth: 5.2 },
  totalUsers: { value: mockUsers.length, growth: 0 },
  totalSalesAmount: { value: 226982, growth: 18.3 },
  totalPurchaseAmount: { value: 324745, growth: -5.1 },
  totalReceivables: { value: 850000, growth: 8.7 },
  totalPayables: { value: 650000, growth: -3.2 },
  totalExpenses: { value: 27800, growth: 15.0 },
};

export const mockSalesAnalytics = {
  monthlySales: [
    { month: '2025-07', amount: 185000 },
    { month: '2025-08', amount: 210000 },
    { month: '2025-09', amount: 195000 },
    { month: '2025-10', amount: 245000 },
    { month: '2025-11', amount: 280000 },
    { month: '2025-12', amount: 320000 },
    { month: '2026-01', amount: 295000 },
    { month: '2026-02', amount: 340000 },
  ],
  topCustomers: mockCustomers.slice(0, 3).map((c, i) => ({ ...c, totalAmount: [171200, 95000, 68000][i] })),
  topProducts: mockProducts.slice(0, 5).map((p, i) => ({ ...p, totalSold: [45, 120, 80, 15, 200][i], totalRevenue: [1440000, 70800, 103200, 148500, 24000][i] })),
};

export const mockInventorySummary = {
  totalStockValue: 3250000,
  totalItems: mockStockItems.length,
  lowStockItems: mockProducts.filter((_, i) => i % 3 === 0).map(p => ({ ...p, currentStock: p.minStock - 2, warehouseName: 'Main Warehouse' })),
  outOfStockItems: [],
  warehouseSummary: mockWarehouses.map((w, i) => ({ ...w, totalItems: [10, 10][i], totalValue: [2100000, 1150000][i] })),
  recentMovements: mockStockMovements.slice(0, 5),
};

export const mockFinancialOverview = {
  monthlyData: [
    { month: '2026-01', revenue: 295000, expenses: 185000, profit: 110000 },
    { month: '2026-02', revenue: 340000, expenses: 210000, profit: 130000 },
  ],
  overdueReceivables: 125000,
  overduePayables: 48000,
  cashFlow: 1500000,
};

// --- Receivables ---
export const mockReceivables = [
  { id: 'r1', amount: 171200, paidAmount: 171200, dueDate: daysAgo(5), status: 'PAID', customerId: 'c1', customer: mockCustomers[0], salesOrderId: 'so1', createdAt: daysAgo(15) },
  { id: 'r2', amount: 12626, paidAmount: 0, dueDate: daysAgo(-10), status: 'PENDING', customerId: 'c2', customer: mockCustomers[1], salesOrderId: 'so2', createdAt: daysAgo(10) },
  { id: 'r3', amount: 20686, paidAmount: 0, dueDate: daysAgo(-20), status: 'OVERDUE', customerId: 'c3', customer: mockCustomers[2], salesOrderId: 'so3', createdAt: daysAgo(7) },
];

// --- Payables ---
export const mockPayables = [
  { id: 'pay1', amount: 267500, paidAmount: 267500, dueDate: daysAgo(5), status: 'PAID', supplierId: 's1', supplier: mockSuppliers[0], purchaseOrderId: 'po1', createdAt: daysAgo(30) },
  { id: 'pay2', amount: 9095, paidAmount: 0, dueDate: daysAgo(-5), status: 'PENDING', supplierId: 's2', supplier: mockSuppliers[1], purchaseOrderId: 'po2', createdAt: daysAgo(12) },
];
