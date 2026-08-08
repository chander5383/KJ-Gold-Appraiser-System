/**
 * PDF Controller — Certificate PDF Generation
 * =============================================
 * Responsible for:
 * - Validating certificate ID exists in database
 * - Extracting JWT auth token from request
 * - Calling pdf.service to generate PDF buffer
 * - Setting correct response headers (Content-Type, Content-Disposition)
 * - Returning PDF binary stream
 * - Error handling
 */

const supabase = require('../config/database');
const { generatePdfBuffer, generatePdfBufferSimple } = require('../services/pdf.service');

/**
 * Generate a safe PDF filename from a certificate number.
 * Replaces forward slashes with hyphens for filesystem compatibility.
 *
 * @param {string} certNo - Certificate number (e.g. "KJ/2026-27/001")
 * @returns {string} Safe filename (e.g. "Certificate_KJ-2026-27-001.pdf")
 */
function getPdfFilename(certNo) {
  const certNoSafe = String(certNo).replace(/\//g, '-');
  return `Certificate_${certNoSafe}.pdf`;
}

/**
 * POST /api/pdf
 *
 * Request body: { certificateId: string }
 * Response: application/pdf binary stream
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function generatePdf(req, res) {
  try {
    const { certificateId } = req.body;

    // Validate input
    if (!certificateId) {
      return res.status(400).json({ error: 'certificateId is required.' });
    }

    // Verify certificate exists in database
    const { data: cert, error: certError } = await supabase
      .from('certificates')
      .select('id, cert_no')
      .eq('id', certificateId)
      .eq('is_deleted', false)
      .single();

    if (certError || !cert) {
      return res.status(404).json({ error: 'Certificate not found.' });
    }

    // Extract JWT token from request header (to pass to Playwright browser context)
    const authHeader = req.headers['authorization'];
    const authToken = authHeader && authHeader.split(' ')[1];

    if (!authToken) {
      return res.status(401).json({ error: 'Authentication token required for PDF generation.' });
    }

    // Generate PDF via Playwright
    const pdfBuffer = await generatePdfBuffer(certificateId, authToken);

    // Set response headers
    const filename = getPdfFilename(cert.cert_no);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length,
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });

    // Send PDF binary
    res.send(pdfBuffer);
  } catch (err) {
    console.error('[PDF Controller] PDF generation failed:', err);
    res.status(500).json({
      error: 'PDF generation failed. Please try again.',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
}

/**
 * POST /api/pdf-simple
 *
 * Identical flow to generatePdf but navigates to /certificate-simple/:id/print.
 * No 24ct/22ct columns — value = net × rate/gm.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function generatePdfSimple(req, res) {
  try {
    const { certificateId } = req.body;

    if (!certificateId) {
      return res.status(400).json({ error: 'certificateId is required.' });
    }

    const { data: cert, error: certError } = await supabase
      .from('certificates')
      .select('id, cert_no')
      .eq('id', certificateId)
      .eq('is_deleted', false)
      .single();

    if (certError || !cert) {
      return res.status(404).json({ error: 'Certificate not found.' });
    }

    const authHeader = req.headers['authorization'];
    const authToken  = authHeader && authHeader.split(' ')[1];

    if (!authToken) {
      return res.status(401).json({ error: 'Authentication token required for PDF generation.' });
    }

    const pdfBuffer = await generatePdfBufferSimple(certificateId, authToken);

    const filename = getPdfFilename(cert.cert_no);
    res.set({
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length':       pdfBuffer.length,
      'Cache-Control':        'no-cache, no-store, must-revalidate'
    });

    res.send(pdfBuffer);
  } catch (err) {
    console.error('[PDF Controller] Simple PDF generation failed:', err);
    res.status(500).json({
      error:   'PDF generation failed. Please try again.',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
}

module.exports = {
  generatePdf,
  generatePdfSimple
};
