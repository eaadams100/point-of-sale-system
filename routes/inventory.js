const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roles = require('../middleware/roles');
const c = require('../controllers/inventoryController');

router.get('/log',          auth, c.getLog);
router.post('/restock',     auth, roles('admin', 'manager'), c.restock);
router.post('/adjust',      auth, roles('admin', 'manager'), c.adjust);

module.exports = router;
