const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const {
  getUsers,
  createUser,
  updateUser,
  resetPassword,
  getActivityLogs
} = require('../controllers/admin.controller');

// All admin routes require authentication + admin role
router.use(authenticateToken);
router.use(requireAdmin);

router.get('/users', getUsers);
router.post('/users', createUser);
router.put('/users/:id', updateUser);
router.post('/users/:id/reset-password', resetPassword);
router.get('/activity-logs', getActivityLogs);

module.exports = router;
