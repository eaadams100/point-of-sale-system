const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const roles   = require('../middleware/roles');
const c       = require('../controllers/loyaltyController');

router.post('/validate-redeem', auth, c.validateRedeem);
router.post('/adjust',          auth, roles('admin','manager'), c.adjust);
router.get('/log/:customer_id', auth, c.getLog);

module.exports = router;
