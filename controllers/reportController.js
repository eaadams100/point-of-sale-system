const db = require('../config/db');

exports.salesSummary = async (req, res) => {
  const { period = 'today' } = req.query;
  const intervals = {
    today:   "CURRENT_DATE",
    week:    "CURRENT_DATE - INTERVAL '7 days'",
    month:   "CURRENT_DATE - INTERVAL '30 days'",
  };
  const from = intervals[period] || intervals.today;
  try {
    const { rows } = await db.query(`
      SELECT
        COUNT(*) AS total_transactions,
        SUM(total_amount) AS total_revenue,
        SUM(discount) AS total_discounts,
        AVG(total_amount) AS avg_sale_value,
        COUNT(DISTINCT user_id) AS active_cashiers
      FROM sales
      WHERE payment_status = 'completed' AND created_at >= ${from}
    `);

    const { rows: byMethod } = await db.query(`
      SELECT payment_method, COUNT(*) AS count, SUM(total_amount) AS total
      FROM sales
      WHERE payment_status = 'completed' AND created_at >= ${from}
      GROUP BY payment_method
    `);

    const { rows: hourly } = await db.query(`
      SELECT EXTRACT(HOUR FROM created_at) AS hour, SUM(total_amount) AS total
      FROM sales
      WHERE payment_status = 'completed' AND created_at >= ${from}
      GROUP BY hour ORDER BY hour
    `);

    res.json({ summary: rows[0], by_payment_method: byMethod, hourly_breakdown: hourly });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.topProducts = async (req, res) => {
  const { period = 'month', limit = 10 } = req.query;
  const intervals = { today: "CURRENT_DATE", week: "CURRENT_DATE - INTERVAL '7 days'", month: "CURRENT_DATE - INTERVAL '30 days'" };
  const from = intervals[period] || intervals.month;
  try {
    const { rows } = await db.query(`
      SELECT
        si.product_id, si.product_name,
        SUM(si.quantity) AS units_sold,
        SUM(si.total_price) AS revenue
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE s.payment_status = 'completed' AND s.created_at >= ${from}
      GROUP BY si.product_id, si.product_name
      ORDER BY units_sold DESC
      LIMIT $1
    `, [limit]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.inventoryReport = async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT p.id, p.name, p.quantity, p.low_stock_threshold, p.price,
             c.name AS category,
             (p.quantity <= p.low_stock_threshold) AS is_low_stock
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.is_active = TRUE
      ORDER BY is_low_stock DESC, p.quantity ASC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
};
