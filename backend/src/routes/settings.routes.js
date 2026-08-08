const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { getSettings, updateSettings } = require('../controllers/settings.controller');

router.use(authenticateToken);

router.get('/', getSettings);
router.put('/', requireAdmin, updateSettings);

module.exports = router;
