const db = require('../config/db');
const { audit } = require('./auditController');

const CATEGORIES = [
  'Rent', 'Utilities', 'Salaries', 'Supplies', 'Equipment',
  'Marketing', 'Transport', 'Maintenance', 'Taxes', 'Other'
];

exports.getCategories = (req, res) => res.json(CATEGORIES);

exports.getAll = async (req, res) => {
  const { from, to, category, limit = 100, offset = 0 } = req.query;
  try {
    let q = `SELECT e.*, u.full_name AS recorded_by_name
             FROM expenses e LEFT JOIN users u ON u.id = e.recorded_by WHERE 1=1`;
    const params = [];
    if (from)     { params.push(from);     q += ` AND e.date >= $${params.length}`; }
    if (to)       { params.push(to);       q += ` AND e.date <= $${params.length}`; }
    if (category) { params.push(category); q += ` AND e.category = $${params.length}`; }
    params.push(limit, offset);
    q += ` ORDER BY e.date DESC, e.created_at DESC LIMIT $${params.length-1} OFFSET $${params.length}`;
    const { rows } = await db.query(q, params);
    res.json(rows);
  } catch(err) { res.status(500).json({ error: err.message }); }
};

exports.getSummary = async (req, res) => {
  const { from, to } = req.query;
  try {
    let q = `SELECT category, COUNT(*) AS count, SUM(amount) AS total
             FROM expenses WHERE 1=1`;
    const params = [];
    if (from) { params.push(from); q += ` AND date >= $${params.length}`; }
    if (to)   { params.push(to);   q += ` AND date <= $${params.length}`; }
    q += ` GROUP BY category ORDER BY total DESC`;
    const { rows: byCategory } = await db.query(q, params);

    // Daily totals for chart
    let q2 = `SELECT date, SUM(amount) AS total FROM expenses WHERE 1=1`;
    const p2 = [];
    if (from) { p2.push(from); q2 += ` AND date >= $${p2.length}`; }
    if (to)   { p2.push(to);   q2 += ` AND date <= $${p2.length}`; }
    q2 += ` GROUP BY date ORDER BY date ASC`;
    const { rows: daily } = await db.query(q2, p2);

    const total = byCategory.reduce((s, r) => s + parseFloat(r.total), 0);
    res.json({ total, by_category: byCategory, daily });
  } catch(err) { res.status(500).json({ error: err.message }); }
};

exports.create = async (req, res) => {
  const { date, category, description, amount, payment_method, reference } = req.body;
  if (!category || !description || !amount)
    return res.status(400).json({ error: 'category, description, and amount are required.' });
  try {
    const { rows } = await db.query(`
      INSERT INTO expenses (date, category, description, amount, payment_method, reference, recorded_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [date || new Date().toISOString().slice(0,10), category, description,
       amount, payment_method || 'cash', reference || null, req.user.id]
    );
    audit(req, 'CREATE', 'expenses', rows[0].id, `Recorded expense: ${category} — GHS ${amount}`);
    res.status(201).json(rows[0]);
  } catch(err) { res.status(500).json({ error: err.message }); }
};

exports.update = async (req, res) => {
  const { date, category, description, amount, payment_method, reference } = req.body;
  try {
    const { rows: old } = await db.query('SELECT * FROM expenses WHERE id=$1', [req.params.id]);
    const { rows } = await db.query(`
      UPDATE expenses SET date=$1,category=$2,description=$3,amount=$4,payment_method=$5,reference=$6
      WHERE id=$7 RETURNING *`,
      [date, category, description, amount, payment_method, reference, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Expense not found.' });
    audit(req, 'UPDATE', 'expenses', rows[0].id, `Updated expense`, old[0], rows[0]);
    res.json(rows[0]);
  } catch(err) { res.status(500).json({ error: err.message }); }
};

exports.remove = async (req, res) => {
  try {
    const { rows } = await db.query('DELETE FROM expenses WHERE id=$1 RETURNING *', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Expense not found.' });
    audit(req, 'DELETE', 'expenses', req.params.id, `Deleted expense: ${rows[0].description}`);
    res.json({ message: 'Expense deleted.' });
  } catch(err) { res.status(500).json({ error: err.message }); }
};
