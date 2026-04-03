const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roles = require('../middleware/roles');
const c = require('../controllers/userController');

router.get('/',    auth, roles('admin'), c.getAll);
router.post('/',   auth, roles('admin'), c.create);
router.put('/:id', auth, roles('admin'), c.update);
router.delete('/:id', auth, roles('admin'), c.remove);

module.exports = router;
