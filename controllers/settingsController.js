const db = require('../config/db');

// In-memory cache so every request doesn't hit the DB
let _cache = null;
let _cacheTime = 0;
const CACHE_TTL = 60000; // 1 minute

async function getAll() {
  if (_cache && Date.now() - _cacheTime < CACHE_TTL) return _cache;
  const { rows } = await db.query('SELECT key, value FROM settings ORDER BY key');
  _cache = {};
  rows.forEach(r => _cache[r.key] = r.value);
  _cacheTime = Date.now();
  return _cache;
}

function bust() { _cache = null; }

exports.getAll = async (req, res) => {
  try { res.json(await getAll()); }
  catch(err) { res.status(500).json({ error: err.message }); }
};

exports.update = async (req, res) => {
  const updates = req.body; // { key: value, ... }
  if (!updates || typeof updates !== 'object')
    return res.status(400).json({ error: 'Body must be a key-value object.' });
  try {
    for (const [key, value] of Object.entries(updates)) {
      await db.query(
        `INSERT INTO settings (key, value, updated_at) VALUES ($1,$2,NOW())
         ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()`,
        [key, String(value)]
      );
    }
    bust();
    res.json({ message: 'Settings saved.', settings: await getAll() });
  } catch(err) { res.status(500).json({ error: err.message }); }
};

// Exported helper for other controllers to read settings
exports.get = getAll;
