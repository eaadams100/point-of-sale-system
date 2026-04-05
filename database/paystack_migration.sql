-- =====================================================
-- Paystack Mobile Money Integration Migration
-- Run: psql -U postgres -d pos_db -f database/paystack_migration.sql
-- =====================================================

-- 1. Create paystack_transactions table
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_paystack_ref ON paystack_transactions(reference);
CREATE INDEX IF NOT EXISTS idx_paystack_sale ON paystack_transactions(sale_id);
CREATE INDEX IF NOT EXISTS idx_paystack_status ON paystack_transactions(status);
CREATE INDEX IF NOT EXISTS idx_paystack_created ON paystack_transactions(created_at);

-- 2. Add Paystack settings
INSERT INTO settings (key, value, updated_at) VALUES
  ('paystack_enabled', 'false', NOW()),
  ('paystack_secret_key', '', NOW()),
  ('paystack_public_key', '', NOW())
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = NOW();

-- 3. Create audit_log table if missing
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  username VARCHAR(50),
  action VARCHAR(50) NOT NULL,
  resource VARCHAR(100),
  resource_id VARCHAR(50),
  description TEXT,
  old_value JSONB,
  new_value JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON audit_log(resource);

-- 4. Create update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 5. Add trigger
DROP TRIGGER IF EXISTS update_paystack_transactions_updated_at ON paystack_transactions;
CREATE TRIGGER update_paystack_transactions_updated_at
  BEFORE UPDATE ON paystack_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 6. Create view for easy monitoring
CREATE OR REPLACE VIEW paystack_transactions_view AS
SELECT 
  pt.*,
  s.reference AS sale_reference,
  s.total_amount AS sale_total,
  s.payment_status AS sale_status,
  u.username AS cashier_username
FROM paystack_transactions pt
LEFT JOIN sales s ON s.id = pt.sale_id
LEFT JOIN users u ON u.id = s.user_id
ORDER BY pt.created_at DESC;

-- 7. Confirmation
DO $$
BEGIN
  RAISE NOTICE '✅ Paystack migration completed successfully!';
END $$;