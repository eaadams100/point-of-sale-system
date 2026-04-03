const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");

// Payments are created as part of a sale (POST /api/sales)
// This route is for querying payment records
router.get("/", auth, async (req, res) => {
  const db = require("../config/db");
  try {
    const { rows } = await db.query(
      `SELECT p.*, s.reference FROM payments p
       JOIN sales s ON s.id = p.sale_id
       ORDER BY p.created_at DESC LIMIT 100`,
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
