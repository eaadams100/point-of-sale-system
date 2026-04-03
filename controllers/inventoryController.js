const db = require('../config/db');

exports.getLog = async (req, res) => {
  const { product_id, limit = 100 } = req.query;
  try {
    let query = `
      SELECT il.*, p.name AS product_name, u.full_name AS user_name
      FROM inventory_log il
      LEFT JOIN products p ON p.id = il.product_id
      LEFT JOIN users u ON u.id = il.user_id
      WHERE 1=1
    `;
    const params = [];
    if (product_id) { params.push(product_id); query += ` AND il.product_id = $${params.length}`; }
    params.push(limit);
    query += ` ORDER BY il.created_at DESC LIMIT $${params.length}`;
    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.restock = async (req, res) => {
  const { product_id, quantity, note } = req.body;
  if (!product_id || !quantity || quantity <= 0)
    return res.status(400).json({ error: 'Valid product_id and quantity required.' });

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'UPDATE products SET quantity = quantity + $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [quantity, product_id]
    );
    if (!rows[0]) throw new Error('Product not found.');

    await client.query(`
      INSERT INTO inventory_log (product_id, user_id, change_type, quantity_change, note)
      VALUES ($1,$2,'restock',$3,$4)
    `, [product_id, req.user.id, quantity, note || 'Manual restock']);

    await client.query('COMMIT');
    res.json({ message: 'Stock updated.', product: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
};

exports.adjust = async (req, res) => {
  const { product_id, new_quantity, note } = req.body;
  if (product_id === undefined || new_quantity === undefined)
    return res.status(400).json({ error: 'product_id and new_quantity required.' });

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows: current } = await client.query('SELECT quantity FROM products WHERE id=$1', [product_id]);
    if (!current[0]) throw new Error('Product not found.');

    const diff = new_quantity - current[0].quantity;
    await client.query(
      'UPDATE products SET quantity = $1, updated_at = NOW() WHERE id = $2',
      [new_quantity, product_id]
    );
    await client.query(`
      INSERT INTO inventory_log (product_id, user_id, change_type, quantity_change, note)
      VALUES ($1,$2,'adjustment',$3,$4)
    `, [product_id, req.user.id, diff, note || 'Manual adjustment']);

    await client.query('COMMIT');
    res.json({ message: 'Inventory adjusted.', new_quantity });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
};
