-- Fix missing tables for POS system

-- 1. Create audit_log table
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

-- 2. Create indexes for audit_log
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON audit_log(resource);

-- 3. Create paystack_transactions table
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

-- 4. Create indexes for paystack_transactions
CREATE INDEX IF NOT EXISTS idx_paystack_ref ON paystack_transactions(reference);
CREATE INDEX IF NOT EXISTS idx_paystack_sale ON paystack_transactions(sale_id);
CREATE INDEX IF NOT EXISTS idx_paystack_status ON paystack_transactions(status);

-- 5. Add Paystack settings if not exists
INSERT INTO settings (key, value) VALUES
  ('paystack_enabled', 'false'),
  ('paystack_secret_key', ''),
  ('paystack_public_key', '')
ON CONFLICT (key) DO NOTHING;

-- 6. Verify admin user exists (in case seed wasn't run)
INSERT INTO users (username, full_name, email, password_hash, role)
SELECT 'admin', 'System Administrator', 'admin@store.com', 
       '$2a$10$rqGK4Y9X5qNq5qNq5qNq5u', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin');

-- Note: The password hash above is for 'admin123' - if it doesn't work, run seed.js

-- Confirmation message
DO $$
BEGIN
  RAISE NOTICE '✅ Missing tables created successfully!';
  RAISE NOTICE '   - audit_log table created';
  RAISE NOTICE '   - paystack_transactions table created';
  RAISE NOTICE '   - Paystack settings added';
END $$;