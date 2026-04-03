const db = require('../config/db');

exports.getAll = async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT c.*, u.full_name AS created_by_name
      FROM coupons c LEFT JOIN users u ON u.id = c.created_by
      ORDER BY c.created_at DESC
    `);
    res.json(rows);
  } catch(err) { res.status(500).json({ error: err.message }); }
};

exports.create = async (req, res) => {
  const { code, description, type, value, min_order, max_uses, valid_from, valid_until } = req.body;
  if (!code || !type || !value)
    return res.status(400).json({ error: 'code, type, and value are required.' });
  try {
    const { rows } = await db.query(`
      INSERT INTO coupons (code, description, type, value, min_order, max_uses, valid_from, valid_until, created_by)
      VALUES (UPPER($1),$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
    `, [code, description, type, value, min_order||0, max_uses||null, valid_from||null, valid_until||null, req.user.id]);
    res.status(201).json(rows[0]);
  } catch(err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Coupon code already exists.' });
    res.status(500).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  const { description, type, value, min_order, max_uses, valid_from, valid_until, is_active } = req.body;
  try {
    const { rows } = await db.query(`
      UPDATE coupons SET description=$1, type=$2, value=$3, min_order=$4,
        max_uses=$5, valid_from=$6, valid_until=$7, is_active=$8
      WHERE id=$9 RETURNING *
    `, [description, type, value, min_order||0, max_uses||null, valid_from||null, valid_until||null, is_active, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Coupon not found.' });
    res.json(rows[0]);
  } catch(err) { res.status(500).json({ error: err.message }); }
};

exports.remove = async (req, res) => {
  try {
    await db.query('UPDATE coupons SET is_active = FALSE WHERE id = $1', [req.params.id]);
    res.json({ message: 'Coupon deactivated.' });
  } catch(err) { res.status(500).json({ error: err.message }); }
};

// Called from POS — validates and returns discount amount
exports.validate = async (req, res) => {
  const { code, order_total } = req.body;
  if (!code) return res.status(400).json({ error: 'Coupon code is required.' });

  try {
    const { rows } = await db.query(
      'SELECT * FROM coupons WHERE code = UPPER($1)', [code]
    );
    const coupon = rows[0];
    if (!coupon)          return res.status(404).json({ error: 'Coupon code not found.' });
    if (!coupon.is_active) return res.status(400).json({ error: 'This coupon is no longer active.' });

    const today = new Date().toISOString().slice(0,10);
    if (coupon.valid_from  && today < coupon.valid_from)  return res.status(400).json({ error: `Coupon is not valid until ${coupon.valid_from}.` });
    if (coupon.valid_until && today > coupon.valid_until) return res.status(400).json({ error: 'This coupon has expired.' });
    if (coupon.max_uses !== null && coupon.uses_count >= coupon.max_uses)
      return res.status(400).json({ error: 'Coupon usage limit has been reached.' });
    if (order_total !== undefined && parseFloat(order_total) < parseFloat(coupon.min_order))
      return res.status(400).json({ error: `Minimum order of GHS ${coupon.min_order} required.` });

    const discount = coupon.type === 'percent'
      ? Math.min(parseFloat(order_total||0) * (coupon.value / 100), parseFloat(order_total||0))
      : Math.min(parseFloat(coupon.value), parseFloat(order_total||0));

    res.json({
      valid: true,
      coupon_id: coupon.id,
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      description: coupon.description,
      discount_amount: parseFloat(discount.toFixed(2)),
    });
  } catch(err) { res.status(500).json({ error: err.message }); }
};

// Called after a sale is completed — increments usage counter
exports.redeem = async (code) => {
  try {
    await db.query('UPDATE coupons SET uses_count = uses_count + 1 WHERE code = UPPER($1)', [code]);
  } catch(_) {}
};
