const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const roles   = require('../middleware/roles');
const c       = require('../controllers/purchaseOrderController');

// Suppliers
router.get('/suppliers',        auth, c.getSuppliers);
router.post('/suppliers',       auth, roles('admin','manager'), c.createSupplier);
router.put('/suppliers/:id',    auth, roles('admin','manager'), c.updateSupplier);

// Purchase Orders
router.get('/',                  auth, c.getAll);
router.get('/:id',               auth, c.getOne);
router.post('/',                 auth, roles('admin','manager'), c.create);
router.put('/:id/status',        auth, roles('admin','manager'), c.updateStatus);
router.post('/:id/receive',      auth, roles('admin','manager'), c.receive);

module.exports = router;
