const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { login, getMe, changePassword } = require('../controllers/authController');
const { audit } = require('../controllers/auditController');

router.post('/login', login);
router.get('/me', auth, getMe);
router.put('/change-password', auth, changePassword);
router.post('/logout', auth, async (req, res) => {
  audit(req, 'LOGOUT', 'auth', req.user.id, 'Logged out');
  res.json({ message: 'Logged out.' });
});

module.exports = router;