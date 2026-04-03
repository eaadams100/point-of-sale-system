const db = require('../config/db');

exports.getAll = async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT p.*, c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.is_active = TRUE
      ORDER BY p.name ASC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getOne = async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT p.*, c.name AS category_name
      FROM products p LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.id = $1
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Product not found.' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getByBarcode = async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM products WHERE barcode = $1 AND is_active = TRUE',
      [req.params.barcode]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Product not found.' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.search = async (req, res) => {
  const q = `%${req.query.q || ''}%`;
  try {
    const { rows } = await db.query(`
      SELECT p.*, c.name AS category_name FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.is_active = TRUE AND (p.name ILIKE $1 OR p.barcode ILIKE $1)
      LIMIT 20
    `, [q]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getLowStock = async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT * FROM products
      WHERE is_active = TRUE AND quantity <= low_stock_threshold
      ORDER BY quantity ASC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.create = async (req, res) => {
  const { barcode, name, category_id, price, cost_price, quantity, low_stock_threshold } = req.body;
  if (!name || price === undefined) return res.status(400).json({ error: 'Name and price required.' });
  try {
    const { rows } = await db.query(`
      INSERT INTO products (barcode, name, category_id, price, cost_price, quantity, low_stock_threshold)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
    `, [barcode, name, category_id, price, cost_price || 0, quantity || 0, low_stock_threshold || 10]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.update = async (req, res) => {
  const { barcode, name, category_id, price, cost_price, quantity, low_stock_threshold, is_active } = req.body;
  try {
    const { rows } = await db.query(`
      UPDATE products SET barcode=$1, name=$2, category_id=$3, price=$4,
        cost_price=$5, quantity=$6, low_stock_threshold=$7, is_active=$8, updated_at=NOW()
      WHERE id=$9 RETURNING *
    `, [barcode, name, category_id, price, cost_price, quantity, low_stock_threshold, is_active, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Product not found.' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.remove = async (req, res) => {
  try {
    await db.query('UPDATE products SET is_active = FALSE WHERE id = $1', [req.params.id]);
    res.json({ message: 'Product deactivated.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
