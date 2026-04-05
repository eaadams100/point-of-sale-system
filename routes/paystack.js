const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const c       = require('../controllers/paystackController');

// Webhook must be raw body — registered BEFORE express.json() parses it
// (handled in server.js with rawBody middleware)
router.post('/webhook',          c.webhook);
router.post('/mobile-money',     auth, c.initiateMobileMoney);
router.get('/verify/:reference', auth, c.verifyCharge);
router.get('/transactions',      auth, c.getTransactions);

module.exports = router;