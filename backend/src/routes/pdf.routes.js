/**
 * PDF Routes
 * ===========
 * Route: POST /api/pdf
 * Requires JWT authentication.
 * Generates a PDF for the specified certificate via Playwright Chromium.
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { generatePdf } = require('../controllers/pdf.controller');

// All PDF routes require authentication
router.use(authenticateToken);

// POST /api/pdf — Generate and download certificate PDF
router.post('/', generatePdf);

module.exports = router;
