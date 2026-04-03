const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roles = require('../middleware/roles');
const c = require('../controllers/customerController');

router.get('/',    auth, c.getAll);
router.get('/:id', auth, c.getOne);
router.post('/',   auth, c.create);
router.put('/:id', auth, c.update);

module.exports = router;
