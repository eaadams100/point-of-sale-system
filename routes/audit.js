const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const roles   = require('../middleware/roles');
const { getLogs } = require('../controllers/auditController');

router.get('/', auth, roles('admin'), getLogs);

module.exports = router;
