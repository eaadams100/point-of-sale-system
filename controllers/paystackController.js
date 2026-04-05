const db = require('../config/db');
const https = require('https');

async function getSecretKey() {
  if (process.env.PAYSTACK_SECRET_KEY) return process.env.PAYSTACK_SECRET_KEY;
  const { rows } = await db.query("SELECT value FROM settings WHERE key = 'paystack_secret_key'");
  return rows[0]?.value;
}

function paystackRequest(method, path, body) {
  return new Promise(async (resolve, reject) => {
    const secret = await getSecretKey();
    if (!secret) return reject(new Error('Paystack secret key missing'));

    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.paystack.co',
      path: path,
      method: method,
      headers: {
        'Authorization': `Bearer ${secret}`,
        'Content-Type': 'application/json',
      }
    };
    if (data) options.headers['Content-Length'] = Buffer.byteLength(data);

    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(raw));
        } catch(e) {
          reject(new Error('Invalid Paystack response: ' + raw.substring(0, 100)));
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

exports.initiateMobileMoney = async (req, res) => {
  const { amount, phone, provider, email, sale_id } = req.body;
  if (!amount || !phone || !provider) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  let formattedPhone = phone.replace(/\s/g, '');
  if (formattedPhone.startsWith('0')) formattedPhone = '+233' + formattedPhone.slice(1);
  if (!formattedPhone.startsWith('+')) formattedPhone = '+233' + formattedPhone;

  const reference = `POS-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const amountKobo = Math.round(parseFloat(amount) * 100);

  try {
    const result = await paystackRequest('POST', '/charge', {
      email: email || 'test@example.com',
      amount: amountKobo,
      currency: 'GHS',
      mobile_money: { phone: formattedPhone, provider: provider.toLowerCase() },
      reference,
      metadata: { sale_id }
    });

    // Log the full response to server console
    console.log('Paystack full response:', JSON.stringify(result, null, 2));

    if (!result.status) throw new Error(result.message);

    // Save transaction
    await db.query(
      `INSERT INTO paystack_transactions (sale_id, reference, amount, phone, status, gateway_resp)
       VALUES ($1, $2, $3, $4, 'pending', $5)`,
      [sale_id || null, reference, amount, formattedPhone, JSON.stringify(result.data)]
    );

    // Return the exact status from Paystack
    res.json({
      reference,
      status: result.data?.status,
      display_text: result.data?.display_text || result.data?.message || 'Check your phone to approve payment',
      requires_approval: result.data?.status !== 'success',
      gateway_response: result.data
    });
  } catch (err) {
    console.error('Paystack error:', err);
    res.status(400).json({ error: err.message });
  }
};

exports.verifyCharge = async (req, res) => {
  const { reference } = req.params;
  try {
    const result = await paystackRequest('GET', `/transaction/verify/${reference}`);
    if (!result.status) throw new Error(result.message);

    await db.query(`UPDATE paystack_transactions SET status=$1 WHERE reference=$2`,
      [result.data.status, reference]);

    res.json({
      reference,
      success: result.data.status === 'success',
      status: result.data.status,
      amount: result.data.amount / 100
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.webhook = (req, res) => {
  // For now, just acknowledge
  res.json({ received: true });
};

exports.getTransactions = async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM paystack_transactions ORDER BY created_at DESC LIMIT 100'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};