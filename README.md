# Web POS System
Node.js + PostgreSQL Point of Sale System

## Tech Stack
- **Backend**: Node.js + Express
- **Database**: PostgreSQL
- **Frontend**: HTML / CSS / Vanilla JS
- **Auth**: JWT (JSON Web Tokens)

## Project Structure
```
pos-system/
├── server.js              # Entry point
├── config/db.js           # DB connection pool
├── middleware/            # auth + role guards
├── routes/                # 8 API route files
├── controllers/           # Business logic
├── database/schema.sql    # Full DB schema
└── public/                # Frontend pages
    ├── index.html         # Login
    ├── dashboard.html     # Overview & stats
    ├── pos.html           # Cashier screen
    ├── products.html      # Product management
    ├── inventory.html     # Stock management
    ├── customers.html     # Customer database
    └── reports.html       # Analytics
```

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your PostgreSQL credentials
```

### 3. Create database and run schema
```bash
createdb pos_db
psql -U postgres -d pos_db -f database/schema.sql
```

### 4. Start the server
```bash
npm run dev     # Development (nodemon)
npm start       # Production
```

Open **http://localhost:3000**

## Default Login
| Username | Password | Role  |
|----------|----------|-------|
| admin    | admin123 | Admin |

**Change the admin password immediately in production.**

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/login | Login |
| GET  | /api/auth/me | Current user |
| GET  | /api/products | List products |
| POST | /api/products | Add product |
| GET  | /api/products/barcode/:code | Lookup by barcode |
| POST | /api/sales | Create sale (checkout) |
| GET  | /api/sales | Sales history |
| POST | /api/inventory/restock | Add stock |
| POST | /api/inventory/adjust | Set exact qty |
| GET  | /api/reports/sales-summary | Revenue report |
| GET  | /api/reports/top-products | Best sellers |
| GET  | /api/customers | Customer list |
| GET  | /api/users | User management (admin only) |

## Roles
- **Admin** — Full access
- **Manager** — All except user management
- **Cashier** — POS screen and product browsing only
# point-of-sale-system
