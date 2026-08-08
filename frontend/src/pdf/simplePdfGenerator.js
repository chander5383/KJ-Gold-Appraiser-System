/**
 * Simple PDF Generator — Playwright Backend PDF Service
 * =======================================================
 * Dedicated to the Simple Certificate module (CertificateSimplePage).
 *
 * IDENTICAL to pdfGenerator.js EXCEPT:
 *   - Calls POST /api/pdf-simple (renders /certificate-simple/:id/print)
 *   - The Simple Certificate print page has no 24ct/22ct columns
 *
 * The original pdfGenerator.js is NOT modified.
 */

import toast from 'react-hot-toast';
import api from '../api/client.js';
import { getPdfFilename } from './pdfConstants.js';

/**
 * Generate and download a Simple Certificate PDF via backend Playwright service.
 *
 * Flow:
 * 1. Save certificate first
 * 2. Call POST /api/pdf-simple with certificateId
 * 3. Receive PDF blob from backend
 * 4. Trigger browser download
 *
 * @param {HTMLElement} _certElement  - Unused (kept for API parity with printGenerator)
 * @param {string}      certNo        - Certificate number (for filename)
 * @param {Function}    saveFn        - Async save function; returns data or null
 * @param {string}      certificateId - Certificate database ID
 * @returns {Promise<void>}
 */
export async function generatePdfSimple(_certElement, certNo, saveFn, certificateId) {
  console.log('[generatePdfSimple] called — certNo:', certNo, '| certificateId:', certificateId);
  const saved = await saveFn();
  if (!saved) return;

  const certId = certificateId || saved?.id;
  if (!certId) {
    toast.error('Certificate must be saved before downloading PDF.');
    return;
  }
  console.log('[generatePdfSimple] calling POST /api/pdf-simple with certId:', certId);

  toast.loading('Generating PDF...', { id: 'pdf-simple' });

  try {
    const response = await api.post(
      '/pdf-simple',
      { certificateId: certId },
      { responseType: 'blob', timeout: 60000 }
    );

    const blob     = new Blob([response.data], { type: 'application/pdf' });
    const url      = window.URL.createObjectURL(blob);
    const filename = getPdfFilename(certNo);

    const link = document.createElement('a');
    link.href     = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();

    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast.success('PDF downloaded!', { id: 'pdf-simple' });
  } catch (err) {
    console.error('[Simple PDF Generator] PDF download failed:', err);

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

    toast.error(errorMsg, { id: 'pdf-simple' });
  }
}
