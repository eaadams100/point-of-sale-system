const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roles = require('../middleware/roles');
const c = require('../controllers/productController');

router.get('/',           auth, c.getAll);
router.get('/search',     auth, c.search);
router.get('/low-stock',  auth, c.getLowStock);
router.get('/barcode/:barcode', auth, c.getByBarcode);
router.get('/:id',        auth, c.getOne);
router.post('/',          auth, roles('admin', 'manager'), c.create);
router.put('/:id',        auth, roles('admin', 'manager'), c.update);
router.delete('/:id',     auth, roles('admin'), c.remove);

module.exports = router;
