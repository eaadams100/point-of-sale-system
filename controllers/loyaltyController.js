const db = require('../config/db');
const { get: getSetting } = require('./settingsController');

// Called after a completed sale — earn points
exports.earnPoints = async (client, customerId, saleId, totalAmount) => {
  try {
    const settings = await getSetting();
    if (settings.loyalty_enabled !== 'true') return;
    const rate = parseFloat(settings.loyalty_rate || 1); // points per GHS
    const points = Math.floor(parseFloat(totalAmount) * rate);
    if (points <= 0) return;

    const { rows } = await client.query('SELECT loyalty_points FROM customers WHERE id=$1', [customerId]);
    if (!rows[0]) return;
    const newBalance = rows[0].loyalty_points + points;

    await client.query('UPDATE customers SET loyalty_points=$1, updated_at=NOW() WHERE id=$2', [newBalance, customerId]);
    await client.query(`
      INSERT INTO loyalty_log (customer_id, sale_id, change_type, points, balance_after, note)
      VALUES ($1,$2,'earn',$3,$4,'Points earned on sale')`,
      [customerId, saleId, points, newBalance]
    );
  } catch(err) { console.error('Loyalty earn error:', err.message); }
};

// Validate and return redemption value in GHS
exports.validateRedeem = async (req, res) => {
  const { customer_id, points_to_redeem } = req.body;
  if (!customer_id || !points_to_redeem)
    return res.status(400).json({ error: 'customer_id and points_to_redeem required.' });
  try {
    const settings = await getSetting();
    if (settings.loyalty_enabled !== 'true')
      return res.status(400).json({ error: 'Loyalty programme is not enabled.' });

    const { rows } = await db.query('SELECT loyalty_points FROM customers WHERE id=$1', [customer_id]);
    if (!rows[0]) return res.status(404).json({ error: 'Customer not found.' });

    const available = rows[0].loyalty_points;
    const needed    = parseInt(points_to_redeem);
    if (needed > available)
      return res.status(400).json({ error: `Customer only has ${available} points.` });

    const redeemRate = parseFloat(settings.loyalty_redeem || 100); // points per GHS
    const ghsValue   = parseFloat((needed / redeemRate).toFixed(2));
    res.json({ valid: true, points: needed, ghs_value: ghsValue, balance: available });
  } catch(err) { res.status(500).json({ error: err.message }); }
};

// Manual adjustment by admin/manager
exports.adjust = async (req, res) => {
  const { customer_id, points, note } = req.body;
  if (!customer_id || points === undefined)
    return res.status(400).json({ error: 'customer_id and points required.' });
  try {
    const { rows } = await db.query('SELECT loyalty_points FROM customers WHERE id=$1', [customer_id]);
    if (!rows[0]) return res.status(404).json({ error: 'Customer not found.' });

    const newBalance = Math.max(0, rows[0].loyalty_points + parseInt(points));
    await db.query('UPDATE customers SET loyalty_points=$1, updated_at=NOW() WHERE id=$2', [newBalance, customer_id]);
    await db.query(`
      INSERT INTO loyalty_log (customer_id, change_type, points, balance_after, note, created_by)
      VALUES ($1,'adjust',$2,$3,$4,$5)`,
      [customer_id, parseInt(points), newBalance, note || 'Manual adjustment', req.user.id]
    );
    res.json({ message: 'Points adjusted.', new_balance: newBalance });
  } catch(err) { res.status(500).json({ error: err.message }); }
};

exports.getLog = async (req, res) => {
  const { customer_id } = req.params;
  try {
    const { rows } = await db.query(`
      SELECT ll.*, s.reference AS sale_reference, u.full_name AS adjusted_by
      FROM loyalty_log ll
      LEFT JOIN sales s ON s.id = ll.sale_id
      LEFT JOIN users u ON u.id = ll.created_by
      WHERE ll.customer_id = $1
      ORDER BY ll.created_at DESC LIMIT 50`, [customer_id]);
    res.json(rows);
  } catch(err) { res.status(500).json({ error: err.message }); }
};
