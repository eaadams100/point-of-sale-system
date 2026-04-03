const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const roles   = require('../middleware/roles');
const c       = require('../controllers/couponController');

router.get('/',          auth, roles('admin','manager'), c.getAll);
router.post('/',         auth, roles('admin','manager'), c.create);
router.put('/:id',       auth, roles('admin','manager'), c.update);
router.delete('/:id',    auth, roles('admin','manager'), c.remove);
router.post('/validate', auth, c.validate);   // cashiers can validate

module.exports = router;
