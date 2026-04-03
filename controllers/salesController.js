const db = require('../config/db');

// Generate a unique transaction reference e.g. TXN-20241201-0042
async function generateReference() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const { rows } = await db.query(
    "SELECT COUNT(*) FROM sales WHERE created_at::date = CURRENT_DATE"
  );
  const count = parseInt(rows[0].count) + 1;
  return `TXN-${date}-${String(count).padStart(4, '0')}`;
}

exports.getAll = async (req, res) => {
  const { from, to, limit = 50, offset = 0 } = req.query;
  try {
    let query = `
      SELECT s.*, u.full_name AS cashier_name, c.name AS customer_name
      FROM sales s
      LEFT JOIN users u ON u.id = s.user_id
      LEFT JOIN customers c ON c.id = s.customer_id
      WHERE 1=1
    `;
    const params = [];
    if (from) { params.push(from); query += ` AND s.created_at >= $${params.length}`; }
    if (to)   { params.push(to);   query += ` AND s.created_at <= $${params.length}`; }
    params.push(limit, offset);
    query += ` ORDER BY s.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;
    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getOne = async (req, res) => {
  try {
    const { rows: saleRows } = await db.query(`
      SELECT s.*, u.full_name AS cashier_name, c.name AS customer_name
      FROM sales s
      LEFT JOIN users u ON u.id = s.user_id
      LEFT JOIN customers c ON c.id = s.customer_id
      WHERE s.id = $1
    `, [req.params.id]);
    if (!saleRows[0]) return res.status(404).json({ error: 'Sale not found.' });

    const { rows: items } = await db.query(
      'SELECT * FROM sale_items WHERE sale_id = $1', [req.params.id]
    );
    const { rows: payments } = await db.query(
      'SELECT * FROM payments WHERE sale_id = $1', [req.params.id]
    );
    res.json({ ...saleRows[0], items, payments });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.create = async (req, res) => {
  const { customer_id, items, discount = 0, tax = 0, payment_method, payments: paymentsList, notes, coupon_code } = req.body;

  if (!items || !items.length)
    return res.status(400).json({ error: 'Sale must have at least one item.' });
  if (!payment_method)
    return res.status(400).json({ error: 'Payment method is required.' });

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Validate stock and fetch product prices
    for (const item of items) {
      const { rows } = await client.query(
        'SELECT id, name, price, quantity FROM products WHERE id = $1 AND is_active = TRUE',
        [item.product_id]
      );
      if (!rows[0]) throw new Error(`Product ID ${item.product_id} not found.`);
      if (rows[0].quantity < item.quantity)
        throw new Error(`Insufficient stock for "${rows[0].name}". Available: ${rows[0].quantity}`);
      item._product = rows[0];
    }

    // Calculate totals
    let subtotal = 0;
    for (const item of items) {
      const unit_price = item.unit_price || item._product.price;
      item._unit_price = parseFloat(unit_price);
      item._item_discount = parseFloat(item.discount || 0);
      item._total = (item._unit_price * item.quantity) - item._item_discount;
      subtotal += item._total;
    }
    const total_amount = subtotal - parseFloat(discount) + parseFloat(tax);

    // Insert sale
    const reference = await generateReference();
    const { rows: saleRows } = await client.query(`
      INSERT INTO sales (reference, user_id, customer_id, subtotal, discount, tax, total_amount, payment_method, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
    `, [reference, req.user.id, customer_id || null, subtotal, discount, tax, total_amount, payment_method, notes]);
    const sale = saleRows[0];

    // Insert sale items & deduct stock
    for (const item of items) {
      await client.query(`
        INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, discount, total_price)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [sale.id, item.product_id, item._product.name, item.quantity, item._unit_price, item._item_discount, item._total]);

      await client.query(
        'UPDATE products SET quantity = quantity - $1, updated_at = NOW() WHERE id = $2',
        [item.quantity, item.product_id]
      );

      await client.query(`
        INSERT INTO inventory_log (product_id, user_id, change_type, quantity_change, note)
        VALUES ($1,$2,'sale',$3,$4)
      `, [item.product_id, req.user.id, -item.quantity, `Sale ${reference}`]);
    }

    // Insert payment record(s)
    const pmts = paymentsList && paymentsList.length ? paymentsList : [{ method: payment_method, amount: total_amount }];
    for (const pmt of pmts) {
      await client.query(
        'INSERT INTO payments (sale_id, method, amount, reference_code) VALUES ($1,$2,$3,$4)',
        [sale.id, pmt.method, pmt.amount, pmt.reference_code || null]
      );
    }

    await client.query('COMMIT');

    // Increment coupon usage if one was applied
    if (coupon_code) {
      const { redeem } = require('./couponController');
      await redeem(coupon_code);
    }

    // Earn loyalty points for the customer
    if (customer_id) {
      const { earnPoints } = require('./loyaltyController');
      const earnClient = await db.connect();
      try { await earnPoints(earnClient, customer_id, sale.id, total_amount); }
      finally { earnClient.release(); }
    }

    res.status(201).json({ ...sale, reference });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
};

exports.voidSale = async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM sales WHERE id = $1', [req.params.id]);
    if (!rows[0]) throw new Error('Sale not found.');
    if (rows[0].payment_status === 'voided') throw new Error('Sale already voided.');

    // Restore stock
    const { rows: items } = await client.query('SELECT * FROM sale_items WHERE sale_id = $1', [req.params.id]);
    for (const item of items) {
      await client.query('UPDATE products SET quantity = quantity + $1 WHERE id = $2', [item.quantity, item.product_id]);
      await client.query(`
        INSERT INTO inventory_log (product_id, user_id, change_type, quantity_change, note)
        VALUES ($1,$2,'return',$3,$4)
      `, [item.product_id, req.user.id, item.quantity, `Void of sale ${rows[0].reference}`]);
    }

    await client.query("UPDATE sales SET payment_status='voided' WHERE id=$1", [req.params.id]);
    await client.query('COMMIT');
    res.json({ message: 'Sale voided and stock restored.' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
};