# SmartERP

Full-featured ERP system for SME businesses, inspired by Kingdee JDY.

## Tech Stack

- **Frontend**: React 18 + Vite + Ant Design 5 + i18n
- **Backend**: NestJS + Prisma + PostgreSQL
- **Auth**: JWT + RBAC (Role-Based Access Control)
- **Architecture**: Monorepo with npm workspaces

## Modules

| Module | Description |
|--------|-------------|
| Dashboard | Executive dashboard with KPIs, charts, AI insights |
| Inventory (进销存) | Purchase, Sales, Stock management |
| Finance (财务管理) | Accounting, Ledger, Tax management |
| Retail (零售管理) | POS, Store management, Membership |
| Expense (费用报销) | Expense claims, Approval workflow |
| Ordering (订货商城) | B2B Online ordering portal |
| Manufacturing (生产管理) | Production, BOM, Material planning |
| E-Commerce (电商管理) | Multi-platform e-commerce integration |

## Getting Started

```bash
# Install dependencies
npm install

# Setup database
cd packages/backend
cp .env.example .env
npx prisma migrate dev

# Run development
npm run dev
```

## Project Structure

```
SmartERP/
├── packages/
│   ├── backend/          # NestJS API server
│   │   ├── src/
│   │   │   ├── modules/  # Feature modules
│   │   │   ├── common/   # Shared utilities
│   │   │   └── config/   # Configuration
│   │   └── prisma/       # Database schema
│   ├── frontend/         # React SPA
│   │   ├── src/
│   │   │   ├── modules/  # Feature modules
│   │   │   ├── components/ # Shared components
│   │   │   ├── layouts/  # App layouts
│   │   │   ├── hooks/    # Custom hooks
│   │   │   ├── i18n/     # Internationalization
│   │   │   ├── store/    # State management
│   │   │   └── utils/    # Utilities
│   │   └── public/
│   └── shared/           # Shared types & constants
└── package.json
```
