/**
 * PDF Simple Routes
 * ==================
 * Route: POST /api/pdf-simple
 * Generates a PDF for the Simple Certificate (no 24ct/22ct columns).
 * Requires JWT authentication.
 */

const express = require('express');
const router  = express.Router();
const { authenticateToken }  = require('../middleware/auth');
const { generatePdfSimple }  = require('../controllers/pdf.controller');

router.use(authenticateToken);

// POST /api/pdf-simple — Generate and download simple certificate PDF
router.post('/', generatePdfSimple);

module.exports = router;
