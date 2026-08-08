const express = require('express');
const router = express.Router();
const { login, changePassword, getMe } = require('../controllers/auth.controller');
const { authenticateToken } = require('../middleware/auth');

// Public
router.post('/login', login);

// Protected
router.post('/change-password', authenticateToken, changePassword);
router.get('/me', authenticateToken, getMe);

module.exports = router;
