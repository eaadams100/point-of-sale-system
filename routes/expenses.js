const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const roles   = require('../middleware/roles');
const c       = require('../controllers/expenseController');

router.get('/categories', auth, c.getCategories);
router.get('/summary',    auth, roles('admin','manager'), c.getSummary);
router.get('/',           auth, c.getAll);
router.post('/',          auth, c.create);
router.put('/:id',        auth, roles('admin','manager'), c.update);
router.delete('/:id',     auth, roles('admin'), c.remove);

module.exports = router;
