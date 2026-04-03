const db = require('../config/db');

exports.getAll = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM customers ORDER BY name ASC');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getOne = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM customers WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Customer not found.' });
    const { rows: history } = await db.query(
      'SELECT * FROM sales WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 20', [req.params.id]
    );
    res.json({ ...rows[0], purchase_history: history });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.create = async (req, res) => {
  const { name, phone, email, address } = req.body;
  if (!name) return res.status(400).json({ error: 'Customer name is required.' });
  try {
    const { rows } = await db.query(
      'INSERT INTO customers (name, phone, email, address) VALUES ($1,$2,$3,$4) RETURNING *',
      [name, phone, email, address]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.update = async (req, res) => {
  const { name, phone, email, address } = req.body;
  try {
    const { rows } = await db.query(
      'UPDATE customers SET name=$1, phone=$2, email=$3, address=$4, updated_at=NOW() WHERE id=$5 RETURNING *',
      [name, phone, email, address, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Customer not found.' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
};
