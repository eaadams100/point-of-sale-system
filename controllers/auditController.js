const db = require('../config/db');

/**
 * Fire-and-forget audit writer.
 * NEVER throws. NEVER awaited in calling code.
 * Safe to call even before migrate_v2.sql has been run.
 */
async function audit(req, action, resource, resourceId, description, oldValue, newValue) {
  try {
    await db.query(
      `INSERT INTO audit_log
         (user_id, username, action, resource, resource_id, description, old_value, new_value, ip_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        req?.user?.id   || null,
        req?.user?.username || 'system',
        action,
        resource,
        resourceId ? String(resourceId) : null,
        description || null,
        oldValue   ? JSON.stringify(oldValue)  : null,
        newValue   ? JSON.stringify(newValue)  : null,
        req?.ip || req?.headers?.['x-forwarded-for'] || null,
      ]
    );
  } catch (_) {
    // Intentionally swallowed — audit must never break anything
  }
}

/**
 * Express middleware that auto-logs all mutating API calls.
 * Wraps res.json so it can see the outgoing response status.
 * Never blocks, never throws.
 */
function auditMiddleware(req, res, next) {
  const MUTATING = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (!MUTATING.includes(req.method)) return next();

  const originalJson = res.json.bind(res);

  res.json = function (body) {
    // Run the original response first — audit is secondary
    const result = originalJson(body);

    // Fire-and-forget only when authenticated and successful
    if (req.user && res.statusCode < 400) {
      try {
        const parts    = req.path.split('/').filter(Boolean);
        const resource = parts[0] || 'unknown';
        const resId    = parts[1] || (body?.id ? String(body.id) : null);
        const actionMap = { POST: 'CREATE', PUT: 'UPDATE', PATCH: 'UPDATE', DELETE: 'DELETE' };
        const action    = actionMap[req.method] || req.method;
        audit(req, action, resource, resId,
              `${action} ${resource}${resId ? ' #' + resId : ''} via ${req.method} ${req.path}`,
              null, null);
      } catch (_) {}
    }

    return result;
  };

  next();
}

/** Query the audit log — used by the /api/audit route */
async function getLogs(req, res) {
  const { resource, user_id, action, from, to, limit = 100, offset = 0 } = req.query;
  try {
    let q = `
      SELECT al.*, u.full_name
      FROM audit_log al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE 1=1`;
    const params = [];
    if (resource) { params.push(resource); q += ` AND al.resource = $${params.length}`; }
    if (user_id)  { params.push(user_id);  q += ` AND al.user_id  = $${params.length}`; }
    if (action)   { params.push(action);   q += ` AND al.action   = $${params.length}`; }
    if (from)     { params.push(from);     q += ` AND al.created_at >= $${params.length}`; }
    if (to)       { params.push(to);       q += ` AND al.created_at <= $${params.length}`; }
    params.push(limit, offset);
    q += ` ORDER BY al.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;
    const { rows } = await db.query(q, params);
    res.json(rows);
  } catch (err) {
    // Table not yet migrated — return empty array so the page renders cleanly
    if (err.message.includes('does not exist')) {
      return res.json([]);
    }
    res.status(500).json({ error: err.message });
  }
}

module.exports = { audit, auditMiddleware, getLogs };