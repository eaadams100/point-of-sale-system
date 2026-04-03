const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const roles   = require('../middleware/roles');
const c       = require('../controllers/settingsController');

router.get('/',  auth, c.getAll);
router.put('/',  auth, roles('admin'), c.update);

module.exports = router;
