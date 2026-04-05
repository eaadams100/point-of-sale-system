require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/products',  require('./routes/products'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/sales',     require('./routes/sales'));
app.use('/api/payments',  require('./routes/payments'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/reports',   require('./routes/reports'));
app.use('/api/coupons',   require('./routes/coupons'));
app.use('/api/loyalty',   require('./routes/loyalty'));
app.use('/api/orders',    require('./routes/purchaseOrders'));
app.use('/api/settings',  require('./routes/settings'));
app.use('/api/users',     require('./routes/users'));

// ⭐ ADD THIS LINE – Paystack routes
app.use('/api/paystack',  require('./routes/paystack'));

// Catch-all: serve frontend for any non-API route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`POS Server running on http://localhost:${PORT}`);
});