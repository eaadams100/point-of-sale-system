const db     = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');

// Helper: fire-and-forget audit write — NEVER throws, NEVER awaited
function logAudit(userId, username, action, description, ip) {
  db.query(
    `INSERT INTO audit_log (user_id, username, action, resource, description, ip_address)
     VALUES ($1,$2,$3,'auth',$4,$5)`,
    [userId || null, username || null, action, description, ip || null]
  ).catch(() => {}); // silently ignore if table doesn't exist yet
}

exports.login = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Username and password required.' });

  try {
    const { rows } = await db.query(
      'SELECT * FROM users WHERE username = $1 AND is_active = TRUE',
      [username]
    );
    const user = rows[0];

    if (!user) {
      logAudit(null, username, 'LOGIN_FAIL', 'User not found', req.ip);
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      logAudit(user.id, user.username, 'LOGIN_FAIL', 'Wrong password', req.ip);
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    logAudit(user.id, user.username, 'LOGIN', 'Logged in successfully', req.ip);

    return res.json({
      token,
      user: {
        id:        user.id,
        username:  user.username,
        full_name: user.full_name,
        role:      user.role,
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, username, full_name, email, role FROM users WHERE id = $1',
      [req.user.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.changePassword = async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password)
    return res.status(400).json({ error: 'Both current and new passwords are required.' });
  try {
    const { rows } = await db.query(
      'SELECT * FROM users WHERE id = $1', [req.user.id]
    );
    const user = rows[0];
    const valid = await bcrypt.compare(current_password, user.password_hash);
    if (!valid)
      return res.status(401).json({ error: 'Current password is incorrect.' });

    const hash = await bcrypt.hash(new_password, 10);
    await db.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [hash, req.user.id]
    );
    logAudit(req.user.id, req.user.username, 'UPDATE', 'Password changed', req.ip);
    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};