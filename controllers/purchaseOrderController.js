const db = require('../config/db');

// ── Reference generator ───────────────────────
async function generateRef() {
  const date = new Date().toISOString().slice(0,10).replace(/-/g,'');
  const { rows } = await db.query("SELECT COUNT(*) FROM purchase_orders WHERE created_at::date = CURRENT_DATE");
  return `PO-${date}-${String(parseInt(rows[0].count)+1).padStart(4,'0')}`;
}

// ── Suppliers ─────────────────────────────────
exports.getSuppliers = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM suppliers WHERE is_active=TRUE ORDER BY name');
    res.json(rows);
  } catch(err) { res.status(500).json({ error: err.message }); }
};

exports.createSupplier = async (req, res) => {
  const { name, contact_name, phone, email, address } = req.body;
  if (!name) return res.status(400).json({ error: 'Supplier name is required.' });
  try {
    const { rows } = await db.query(
      'INSERT INTO suppliers (name,contact_name,phone,email,address) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [name, contact_name, phone, email, address]
    );
    res.status(201).json(rows[0]);
  } catch(err) { res.status(500).json({ error: err.message }); }
};

exports.updateSupplier = async (req, res) => {
  const { name, contact_name, phone, email, address, is_active } = req.body;
  try {
    const { rows } = await db.query(
      'UPDATE suppliers SET name=$1,contact_name=$2,phone=$3,email=$4,address=$5,is_active=$6 WHERE id=$7 RETURNING *',
      [name, contact_name, phone, email, address, is_active, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Supplier not found.' });
    res.json(rows[0]);
  } catch(err) { res.status(500).json({ error: err.message }); }
};

// ── Purchase Orders ───────────────────────────
exports.getAll = async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT po.*, s.name AS supplier_name, u.full_name AS created_by_name,
             COUNT(poi.id) AS item_count,
             SUM(poi.qty_ordered * poi.unit_cost) AS total_cost
      FROM purchase_orders po
      LEFT JOIN suppliers s ON s.id = po.supplier_id
      LEFT JOIN users u ON u.id = po.created_by
      LEFT JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
      GROUP BY po.id, s.name, u.full_name
      ORDER BY po.created_at DESC`);
    res.json(rows);
  } catch(err) { res.status(500).json({ error: err.message }); }
};

exports.getOne = async (req, res) => {
  try {
    const { rows: po } = await db.query(`
      SELECT po.*, s.name AS supplier_name, s.phone AS supplier_phone, s.email AS supplier_email,
             u.full_name AS created_by_name
      FROM purchase_orders po
      LEFT JOIN suppliers s ON s.id = po.supplier_id
      LEFT JOIN users u ON u.id = po.created_by
      WHERE po.id = $1`, [req.params.id]);
    if (!po[0]) return res.status(404).json({ error: 'Purchase order not found.' });

    const { rows: items } = await db.query(
      'SELECT * FROM purchase_order_items WHERE purchase_order_id=$1', [req.params.id]);
    res.json({ ...po[0], items });
  } catch(err) { res.status(500).json({ error: err.message }); }
};

exports.create = async (req, res) => {
  const { supplier_id, items, notes } = req.body;
  if (!items || !items.length)
    return res.status(400).json({ error: 'At least one item is required.' });

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const reference = await generateRef();
    const { rows: po } = await client.query(`
      INSERT INTO purchase_orders (reference, supplier_id, notes, created_by)
      VALUES ($1,$2,$3,$4) RETURNING *`,
      [reference, supplier_id || null, notes, req.user.id]
    );
    for (const item of items) {
      // Fetch product name snapshot
      const { rows: p } = await client.query('SELECT name FROM products WHERE id=$1', [item.product_id]);
      const productName = p[0]?.name || item.product_name || 'Unknown';
      await client.query(`
        INSERT INTO purchase_order_items (purchase_order_id, product_id, product_name, qty_ordered, unit_cost)
        VALUES ($1,$2,$3,$4,$5)`,
        [po[0].id, item.product_id, productName, item.qty_ordered, item.unit_cost || 0]
      );
    }
    await client.query('COMMIT');
    res.status(201).json(po[0]);
  } catch(err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
};

exports.updateStatus = async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['draft','ordered','partial','received','cancelled'];
  if (!validStatuses.includes(status))
    return res.status(400).json({ error: 'Invalid status.' });
  try {
    const extra = status === 'ordered'  ? ', ordered_at=NOW()' :
                  status === 'received' ? ', received_at=NOW()' : '';
    const { rows } = await db.query(
      `UPDATE purchase_orders SET status=$1, updated_at=NOW()${extra} WHERE id=$2 RETURNING *`,
      [status, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Purchase order not found.' });
    res.json(rows[0]);
  } catch(err) { res.status(500).json({ error: err.message }); }
};

// Receive items — updates received qty and restocks products
exports.receive = async (req, res) => {
  const { items } = req.body; // [{ item_id, qty_received }]
  if (!items?.length) return res.status(400).json({ error: 'Items required.' });

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows: po } = await client.query('SELECT * FROM purchase_orders WHERE id=$1', [req.params.id]);
    if (!po[0]) throw new Error('Purchase order not found.');
    if (po[0].status === 'cancelled') throw new Error('Cannot receive a cancelled order.');

    for (const item of items) {
      const { rows: poi } = await client.query(
        'SELECT * FROM purchase_order_items WHERE id=$1 AND purchase_order_id=$2',
        [item.item_id, req.params.id]
      );
      if (!poi[0]) continue;
      const newReceived = Math.min(poi[0].qty_ordered, poi[0].qty_received + item.qty_received);
      const delta = newReceived - poi[0].qty_received;
      if (delta <= 0) continue;

      await client.query('UPDATE purchase_order_items SET qty_received=$1 WHERE id=$2', [newReceived, item.item_id]);

      if (poi[0].product_id) {
        await client.query('UPDATE products SET quantity=quantity+$1, updated_at=NOW() WHERE id=$2', [delta, poi[0].product_id]);
        await client.query(`
          INSERT INTO inventory_log (product_id, user_id, change_type, quantity_change, note)
          VALUES ($1,$2,'restock',$3,$4)`,
          [poi[0].product_id, req.user.id, delta, `PO received: ${po[0].reference}`]
        );
      }
    }

    // Auto-update order status
    const { rows: allItems } = await client.query(
      'SELECT qty_ordered, qty_received FROM purchase_order_items WHERE purchase_order_id=$1', [req.params.id]);
    const allReceived = allItems.every(i => i.qty_received >= i.qty_ordered);
    const anyReceived = allItems.some(i => i.qty_received > 0);
    const newStatus   = allReceived ? 'received' : anyReceived ? 'partial' : po[0].status;
    await client.query(
      `UPDATE purchase_orders SET status=$1, updated_at=NOW() ${allReceived?', received_at=NOW()':''} WHERE id=$2`,
      [newStatus, req.params.id]
    );

    await client.query('COMMIT');
    res.json({ message: 'Items received and stock updated.', status: newStatus });
  } catch(err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally { client.release(); }
};
