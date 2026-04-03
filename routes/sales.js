const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roles = require('../middleware/roles');
const c = require('../controllers/salesController');

router.get('/',        auth, c.getAll);
router.get('/:id',     auth, c.getOne);
router.post('/',       auth, c.create);         // Any logged-in user can make a sale
router.put('/:id/void', auth, roles('admin', 'manager'), c.voidSale);

module.exports = router;
