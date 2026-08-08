/**
 * Print Generator — Native Browser Printing
 * ============================================
 * Responsible for:
 * - Printing two copies of the certificate
 * - Native browser print dialog
 * - No PDF library dependencies
 *
 * EXACT logic from CertificatePage.jsx printTwoCopies() (lines 221–257).
 */

import { prepareInputsForCapture, createPrintClone, cleanupClone } from './certificateRenderer.js';

/**
 * Print two copies of the certificate using native browser print.
 * Saves the certificate first, then prepares DOM, clones for 2nd copy,
 * triggers window.print(), and cleans up.
 *
 * @param {HTMLElement} certElement - The certificate DOM element (ref.current)
 * @param {Function} saveFn - Async function that saves the certificate; returns data or null
 * @returns {Promise<void>}
 */
export async function printTwoCopies(certElement, saveFn) {
  // Save first
  const saved = await saveFn();
  if (!saved) return;

  if (!certElement) return;

  // Prepare inputs for capture
  prepareInputsForCapture(certElement);

  // Clone for 2nd copy
  const clone = createPrintClone(certElement);

  setTimeout(() => {
    window.print();
    cleanupClone(clone);
  }, 100);
}
