-- Web POS System - PostgreSQL Schema
-- Run: psql -U postgres -d pos_db -f database/schema.sql

-- Create database (run separately if needed):
-- CREATE DATABASE pos_db;

-- ─── USERS ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(50) UNIQUE NOT NULL,
  full_name     VARCHAR(100) NOT NULL,
  email         VARCHAR(100) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'manager', 'cashier')),
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- ─── CATEGORIES ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ─── PRODUCTS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id          SERIAL PRIMARY KEY,
  barcode     VARCHAR(100) UNIQUE,
  name        VARCHAR(200) NOT NULL,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  price       NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  cost_price  NUMERIC(10, 2) DEFAULT 0,
  quantity    INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  low_stock_threshold INTEGER DEFAULT 10,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

-- ─── CUSTOMERS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  phone         VARCHAR(20),
  email         VARCHAR(100),
  address       TEXT,
  loyalty_points INTEGER DEFAULT 0,
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- ─── SALES ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales (
  id             SERIAL PRIMARY KEY,
  reference      VARCHAR(50) UNIQUE NOT NULL, -- e.g. TXN-20241201-0001
  user_id        INTEGER REFERENCES users(id),
  customer_id    INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  subtotal       NUMERIC(10, 2) NOT NULL,
  discount       NUMERIC(10, 2) DEFAULT 0,
  tax            NUMERIC(10, 2) DEFAULT 0,
  total_amount   NUMERIC(10, 2) NOT NULL,
  payment_method VARCHAR(30) CHECK (payment_method IN ('cash', 'mobile_money', 'card', 'split')),
  payment_status VARCHAR(20) DEFAULT 'completed' CHECK (payment_status IN ('completed', 'refunded', 'voided')),
  notes          TEXT,
  created_at     TIMESTAMP DEFAULT NOW()
);

-- ─── SALE ITEMS ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sale_items (
  id          SERIAL PRIMARY KEY,
  sale_id     INTEGER REFERENCES sales(id) ON DELETE CASCADE,
  product_id  INTEGER REFERENCES products(id),
  product_name VARCHAR(200) NOT NULL, -- snapshot at time of sale
  quantity    INTEGER NOT NULL CHECK (quantity > 0),
  unit_price  NUMERIC(10, 2) NOT NULL,
  discount    NUMERIC(10, 2) DEFAULT 0,
  total_price NUMERIC(10, 2) NOT NULL
);

-- ─── PAYMENTS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id             SERIAL PRIMARY KEY,
  sale_id        INTEGER REFERENCES sales(id) ON DELETE CASCADE,
  method         VARCHAR(30) NOT NULL,
  amount         NUMERIC(10, 2) NOT NULL,
  reference_code VARCHAR(100), -- mobile money / card ref
  created_at     TIMESTAMP DEFAULT NOW()
);

-- ─── INVENTORY LOG ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_log (
  id          SERIAL PRIMARY KEY,
  product_id  INTEGER REFERENCES products(id),
  user_id     INTEGER REFERENCES users(id),
  change_type VARCHAR(30) CHECK (change_type IN ('sale', 'restock', 'adjustment', 'return')),
  quantity_change INTEGER NOT NULL, -- negative = stock removed
  note        TEXT,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- ─── INDEXES ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_products_barcode    ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_category   ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at    ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_user          ON sales(user_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale     ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_inventory_log_prod  ON inventory_log(product_id);

-- ─── NOTE ─────────────────────────────────────────────────────────────────────
-- Run `node database/seed.js` after this schema to create the admin user.
-- The seed script generates a correct bcrypt hash at runtime.

-- ─── COUPONS ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coupons (
  id            SERIAL PRIMARY KEY,
  code          VARCHAR(50) UNIQUE NOT NULL,
  description   VARCHAR(200),
  type          VARCHAR(20) NOT NULL CHECK (type IN ('percent', 'fixed')),
  value         NUMERIC(10,2) NOT NULL CHECK (value > 0),
  min_order     NUMERIC(10,2) DEFAULT 0,
  max_uses      INTEGER,             -- NULL = unlimited
  uses_count    INTEGER DEFAULT 0,
  valid_from    DATE,
  valid_until   DATE,
  is_active     BOOLEAN DEFAULT TRUE,
  created_by    INTEGER REFERENCES users(id),
  created_at    TIMESTAMP DEFAULT NOW()
);

-- ─── LOYALTY TRANSACTIONS LOG ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS loyalty_log (
  id           SERIAL PRIMARY KEY,
  customer_id  INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  sale_id      INTEGER REFERENCES sales(id) ON DELETE SET NULL,
  change_type  VARCHAR(20) NOT NULL CHECK (change_type IN ('earn', 'redeem', 'adjust', 'expire')),
  points       INTEGER NOT NULL,          -- positive = earned, negative = redeemed/expired
  balance_after INTEGER NOT NULL,
  note         TEXT,
  created_by   INTEGER REFERENCES users(id),
  created_at   TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_loyalty_customer ON loyalty_log(customer_id);

-- ─── SUPPLIERS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(150) NOT NULL,
  contact_name VARCHAR(100),
  phone        VARCHAR(30),
  email        VARCHAR(100),
  address      TEXT,
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMP DEFAULT NOW()
);

-- ─── PURCHASE ORDERS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_orders (
  id           SERIAL PRIMARY KEY,
  reference    VARCHAR(50) UNIQUE NOT NULL,  -- e.g. PO-20241201-0001
  supplier_id  INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  status       VARCHAR(20) DEFAULT 'draft'
               CHECK (status IN ('draft','ordered','partial','received','cancelled')),
  notes        TEXT,
  ordered_at   TIMESTAMP,
  received_at  TIMESTAMP,
  created_by   INTEGER REFERENCES users(id),
  created_at   TIMESTAMP DEFAULT NOW(),
  updated_at   TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id                SERIAL PRIMARY KEY,
  purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id        INTEGER REFERENCES products(id) ON DELETE SET NULL,
  product_name      VARCHAR(200) NOT NULL,
  qty_ordered       INTEGER NOT NULL CHECK (qty_ordered > 0),
  qty_received      INTEGER DEFAULT 0,
  unit_cost         NUMERIC(10,2) DEFAULT 0,
  created_at        TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_poi_po      ON purchase_order_items(purchase_order_id);

-- ─── SYSTEM SETTINGS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  key        VARCHAR(100) PRIMARY KEY,
  value      TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Default settings
INSERT INTO settings (key, value) VALUES
  ('store_name',       'My Store'),
  ('store_address',    '123 Main Street'),
  ('store_phone',      '+233 XX XXX XXXX'),
  ('store_email',      ''),
  ('store_currency',   'GHS'),
  ('receipt_footer',   'Thank you for your purchase!'),
  ('tax_rate',         '0'),
  ('loyalty_enabled',  'true'),
  ('loyalty_rate',     '1'),     -- points earned per 1 GHS spent
  ('loyalty_redeem',   '100'),   -- points needed to redeem 1 GHS
  ('low_stock_alert',  'true')
ON CONFLICT (key) DO NOTHING;

-- Add to your database/schema.sql or run separately
CREATE TABLE IF NOT EXISTS paystack_transactions (
  id SERIAL PRIMARY KEY,
  sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL,
  reference VARCHAR(100) UNIQUE NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  channel VARCHAR(50),
  phone VARCHAR(20),
  status VARCHAR(50) DEFAULT 'pending',
  gateway_resp JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_paystack_ref ON paystack_transactions(reference);
CREATE INDEX IF NOT EXISTS idx_paystack_sale ON paystack_transactions(sale_id);


-- Custom payment transactions table
CREATE TABLE IF NOT EXISTS custom_payments (
  id SERIAL PRIMARY KEY,
  reference VARCHAR(50) UNIQUE NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  provider VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, success, failed
  gateway_response JSONB,
  sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_custom_payments_reference ON custom_payments(reference);
CREATE INDEX IF NOT EXISTS idx_custom_payments_status ON custom_payments(status);