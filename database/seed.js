/**
 * Run this after schema.sql to create the default admin user.
 * Usage: node database/seed.js
 */
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function seed() {
  const client = await pool.connect();
  try {
    // Admin user
    const adminHash = await bcrypt.hash('admin123', 10);
    await client.query(`
      INSERT INTO users (username, full_name, email, password_hash, role)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash
    `, ['admin', 'System Administrator', 'admin@store.com', adminHash, 'admin']);
    console.log('✅ Admin user created  →  username: admin  /  password: admin123');

    // Sample categories
    const categories = ['Electronics', 'Beverages', 'Food', 'Clothing', 'Stationery'];
    for (const name of categories) {
      await client.query(
        'INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [name]
      );
    }
    console.log('✅ Sample categories inserted');

    console.log('\nDone! You can now log in at http://localhost:3000');
  } catch (err) {
    console.error('❌ Seed error:', err.message);
  } finally {
    client.release();
    pool.end();
  }
}

seed();
