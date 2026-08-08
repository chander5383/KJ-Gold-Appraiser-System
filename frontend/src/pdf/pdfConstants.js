/**
 * PDF Constants — Filename Generation
 * =====================================
 * PDF filename generation utility.
 *
 * NOTE: html2canvas-specific constants (IMAGE_TYPE, IMAGE_QUALITY, USE_CORS)
 * have been REMOVED. PDF generation is now handled server-side by Playwright Chromium.
 */

/**
 * Generate a safe PDF filename from a certificate number.
 * Replaces forward slashes with hyphens for filesystem compatibility.
 *
 * @param {string} certNo - Certificate number (e.g. "KJ/2026-27/001")
 * @returns {string} Safe filename (e.g. "Certificate_KJ-2026-27-001.pdf")
 */
export function getPdfFilename(certNo) {
  const certNoSafe = certNo.replace(/\//g, '-');
  return `Certificate_${certNoSafe}.pdf`;
}
