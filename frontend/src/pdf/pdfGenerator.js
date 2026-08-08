/**
 * PDF Generator — Playwright Backend PDF Service
 * ================================================
 * Responsible for:
 * - Calling backend POST /api/pdf endpoint
 * - Receiving PDF blob response
 * - Triggering browser download with correct filename
 * - Handling loading states and errors
 *
 * ARCHITECTURE:
 * This is the ONLY file that handles PDF download.
 * The backend (Playwright Chromium) generates the PDF.
 * Frontend simply downloads it as a blob.
 *
 * NO html2pdf.js. NO html2canvas. NO jsPDF. NO canvas rendering.
 * NO DOM cloning. NO screenshot-based rendering.
 */

import toast from 'react-hot-toast';
import api from '../api/client.js';
import { getPdfFilename } from './pdfConstants.js';

/**
 * Generate and download a PDF of the certificate via backend Playwright service.
 *
 * Flow:
 * 1. Save certificate first
 * 2. Call POST /api/pdf with certificateId
 * 3. Receive PDF blob from backend
 * 4. Trigger browser download
 *
 * @param {HTMLElement} _certElement - Unused (kept for API compatibility with printGenerator)
 * @param {string} certNo - Current certificate number (for filename)
 * @param {Function} saveFn - Async function that saves the certificate; returns data or null
 * @param {string} certificateId - The certificate database ID
 * @returns {Promise<void>}
 */
export async function generatePdf(_certElement, certNo, saveFn, certificateId) {
  // Save first
  const saved = await saveFn();
  if (!saved) return;

  const certId = certificateId || saved?.id;
  if (!certId) {
    toast.error('Certificate must be saved before downloading PDF.');
    return;
  }

  toast.loading('Generating PDF...', { id: 'pdf' });

  try {
    // Call backend Playwright PDF service
    const response = await api.post('/pdf', 
      { certificateId: certId },
      { responseType: 'blob', timeout: 60000 }
    );

    // Create blob URL and trigger download
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const filename = getPdfFilename(certNo);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();

    // Cleanup
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast.success('PDF downloaded!', { id: 'pdf' });
  } catch (err) {
    console.error('[PDF Generator] PDF download failed:', err);

    // Extract error message from blob response if available
    let errorMsg = 'PDF generation failed';
    if (err.response?.data instanceof Blob) {
      try {
        const text = await err.response.data.text();
        const json = JSON.parse(text);
        errorMsg = json.error || errorMsg;
      } catch {
        // Ignore parse errors
      }
    } else if (err.response?.data?.error) {
      errorMsg = err.response.data.error;
    }

    toast.error(errorMsg, { id: 'pdf' });
  }
}
