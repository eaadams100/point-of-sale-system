const db = require('../config/db');
const bcrypt = require('bcryptjs');

exports.getAll = async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, username, full_name, email, role, is_active, created_at FROM users ORDER BY full_name'
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.create = async (req, res) => {
  const { username, full_name, email, password, role } = req.body;
  if (!username || !password || !role)
    return res.status(400).json({ error: 'Username, password, and role are required.' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      'INSERT INTO users (username, full_name, email, password_hash, role) VALUES ($1,$2,$3,$4,$5) RETURNING id, username, full_name, role',
      [username, full_name, email, hash, role]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Username already exists.' });
    res.status(500).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  const { full_name, email, role, is_active, password } = req.body;
  try {
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      await db.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, req.params.id]);
    }
    const { rows } = await db.query(
      'UPDATE users SET full_name=$1, email=$2, role=$3, is_active=$4, updated_at=NOW() WHERE id=$5 RETURNING id, username, full_name, role, is_active',
      [full_name, email, role, is_active, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found.' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.remove = async (req, res) => {
  if (parseInt(req.params.id) === req.user.id)
    return res.status(400).json({ error: 'You cannot deactivate your own account.' });
  try {
    await db.query('UPDATE users SET is_active = FALSE WHERE id = $1', [req.params.id]);
    res.json({ message: 'User deactivated.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
