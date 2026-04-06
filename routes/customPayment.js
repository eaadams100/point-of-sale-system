const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const c = require('../controllers/customPaymentController');

router.post('/mobile-money', auth, c.initiateMobileMoney);
router.post('/submit-otp', auth, c.submitOtp);
router.get('/verify/:reference', auth, c.verifyPayment);
router.get('/transactions', auth, c.getTransactions);
router.post('/webhook', c.webhook);

module.exports = router;