const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roles = require('../middleware/roles');
const c = require('../controllers/reportController');

router.get('/sales-summary', auth, roles('admin', 'manager'), c.salesSummary);
router.get('/top-products',  auth, roles('admin', 'manager'), c.topProducts);
router.get('/inventory',     auth, roles('admin', 'manager'), c.inventoryReport);

module.exports = router;
