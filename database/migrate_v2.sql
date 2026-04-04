-- Migration: Add loyalty, suppliers, purchase orders, and settings
-- Run this if you already have an existing database from a previous version
-- psql -U postgres -d pos_db -f database/migrate_v2.sql

-- ─── LOYALTY LOG ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS loyalty_log (
  id           SERIAL PRIMARY KEY,
  customer_id  INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  sale_id      INTEGER REFERENCES sales(id) ON DELETE SET NULL,
  change_type  VARCHAR(20) NOT NULL CHECK (change_type IN ('earn', 'redeem', 'adjust', 'expire')),
  points       INTEGER NOT NULL,
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
  reference    VARCHAR(50) UNIQUE NOT NULL,
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

-- ─── SETTINGS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  key        VARCHAR(100) PRIMARY KEY,
  value      TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO settings (key, value) VALUES
  ('store_name',       'My Store'),
  ('store_address',    '123 Main Street'),
  ('store_phone',      '+233 XX XXX XXXX'),
  ('store_email',      ''),
  ('store_currency',   'GHS'),
  ('receipt_footer',   'Thank you for your purchase!'),
  ('tax_rate',         '0'),
  ('loyalty_enabled',  'true'),
  ('loyalty_rate',     '1'),
  ('loyalty_redeem',   '100'),
  ('low_stock_alert',  'true')
ON CONFLICT (key) DO NOTHING;
