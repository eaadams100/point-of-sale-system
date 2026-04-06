const db = require('../config/db');
const crypto = require('crypto');

// Generate unique reference
function generateReference() {
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString('hex');
  return `CUST-${timestamp}-${random}`;
}

// Simulate OTP (for testing)
const TEST_OTP = '123456';

// Initiate mobile money payment (simulated)
exports.initiateMobileMoney = async (req, res) => {
  const { amount, phone, provider, sale_id } = req.body;
  
  if (!amount || !phone || !provider) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Validate test phone numbers
  const validTestNumbers = ['0240000000', '0270000000', '0260000000'];
  if (!validTestNumbers.includes(phone.replace(/\s/g, ''))) {
    return res.status(400).json({ 
      error: 'Invalid test phone number. Use: 0240000000 (MTN), 0270000000 (Vodafone), or 0260000000 (AirtelTigo)' 
    });
  }

  const reference = generateReference();
  const amountValue = parseFloat(amount);

  try {
    // Save pending transaction
    await db.query(
      `INSERT INTO custom_payments (reference, amount, phone, provider, status, sale_id)
       VALUES ($1, $2, $3, $4, 'pending', $5)`,
      [reference, amountValue, phone, provider, sale_id || null]
    );

    // Simulate Paystack-like response
    res.json({
      status: true,
      message: 'Charge initiated',
      data: {
        reference,
        amount: amountValue,
        currency: 'GHS',
        phone,
        provider,
        status: 'pending',
        display_text: `A payment request has been sent to ${phone}. Enter OTP: ${TEST_OTP} to complete payment.`,
        requires_otp: true
      }
    });
  } catch (err) {
    console.error('Custom payment error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Submit OTP for verification
exports.submitOtp = async (req, res) => {
  const { reference, otp } = req.body;
  
  if (!reference || !otp) {
    return res.status(400).json({ error: 'Reference and OTP required' });
  }

  // Check if OTP matches test OTP
  if (otp !== TEST_OTP) {
    return res.status(400).json({ error: 'Invalid OTP. Test OTP is: ' + TEST_OTP });
  }

  try {
    // Update transaction status to success
    await db.query(
      `UPDATE custom_payments 
       SET status = 'success', updated_at = NOW(), gateway_response = $1
       WHERE reference = $2`,
      [JSON.stringify({ verified: true, otp }), reference]
    );

    // Fetch the updated transaction
    const { rows } = await db.query('SELECT * FROM custom_payments WHERE reference = $1', [reference]);
    
    res.json({
      status: true,
      message: 'Payment verified successfully',
      data: {
        reference,
        status: 'success',
        amount: rows[0]?.amount,
        phone: rows[0]?.phone
      }
    });
  } catch (err) {
    console.error('OTP verification error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Verify payment status
exports.verifyPayment = async (req, res) => {
  const { reference } = req.params;
  
  try {
    const { rows } = await db.query('SELECT * FROM custom_payments WHERE reference = $1', [reference]);
    
    if (!rows.length) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    const payment = rows[0];
    res.json({
      status: payment.status === 'success',
      reference: payment.reference,
      amount: payment.amount,
      phone: payment.phone,
      provider: payment.provider,
      status_text: payment.status
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get transaction history
exports.getTransactions = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT cp.*, s.reference AS sale_reference 
       FROM custom_payments cp
       LEFT JOIN sales s ON s.id = cp.sale_id
       ORDER BY cp.created_at DESC LIMIT 100`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Webhook simulation (optional)
exports.webhook = (req, res) => {
  console.log('Custom payment webhook received:', req.body);
  res.json({ received: true });
};