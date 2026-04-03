CREATE TABLE IF NOT EXISTS coupons (
  id SERIAL PRIMARY KEY, 
  code VARCHAR(50) UNIQUE NOT NULL,
  description VARCHAR(200), 
  type VARCHAR(20) NOT NULL CHECK (type IN ('percent','fixed')),
  value NUMERIC(10,2) NOT NULL CHECK (value > 0), 
  min_order NUMERIC(10,2) DEFAULT 0,
  max_uses INTEGER, 
  uses_count INTEGER DEFAULT 0,
  valid_from DATE, 
  valid_until DATE, 
  is_active BOOLEAN DEFAULT TRUE,
  created_by INTEGER REFERENCES users(id), 
  created_at TIMESTAMP DEFAULT NOW()
);