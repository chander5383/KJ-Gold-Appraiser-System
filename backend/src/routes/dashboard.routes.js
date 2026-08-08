const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { getStats } = require('../controllers/dashboard.controller');

router.use(authenticateToken);
router.get('/stats', getStats);

module.exports = router;
