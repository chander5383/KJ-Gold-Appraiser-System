/**
 * Certificate Renderer — DOM Cloning & Preparation
 * ==================================================
 * Responsible for:
 * - Preparing inputs for capture (setting value attributes)
 * - Cloning the certificate DOM for print (2-copy layout)
 * - Cleaning up clones after use
 *
 * NOTE: createPdfClone() has been REMOVED.
 * PDF generation is now handled server-side by Playwright Chromium.
 * The functions below are used ONLY for native browser printing.
 */

/**
 * Prepare all inputs and selects inside a certificate element for capture.
 * Sets value attributes so cloneNode captures current values.
 *
 * EXACT logic from CertificatePage lines 229–238 and 270–278.
 *
 * @param {HTMLElement} certElement - The certificate DOM element
 */
export function prepareInputsForCapture(certElement) {
  certElement.querySelectorAll('input, select').forEach(el => {
    if (el.tagName.toLowerCase() === 'select') {
      Array.from(el.options).forEach(opt => {
        if (opt.value === el.value) opt.setAttribute('selected', 'selected');
        else opt.removeAttribute('selected');
      });
    } else if (el.type !== 'checkbox') {
      el.setAttribute('value', el.value);
    }
  });
}

/**
 * Create a clone of the certificate for printing (2-copy layout).
 * Appends clone to document.body with print-only class.
 *
 * EXACT logic from CertificatePage lines 241–256.
 *
 * @param {HTMLElement} certElement - The certificate DOM element
 * @returns {HTMLElement} The cloned element (already appended to body)
 */
export function createPrintClone(certElement) {
  const clone = certElement.cloneNode(true);
  clone.id = 'certificate-canvas-clone';
  clone.classList.add('print-only-clone');

  // Sync select values from original to clone
  const originalSelects = certElement.querySelectorAll('select');
  const cloneSelects = clone.querySelectorAll('select');
  originalSelects.forEach((sel, i) => {
    if (cloneSelects[i]) cloneSelects[i].value = sel.value;
  });

  document.body.appendChild(clone);
  return clone;
}

/**
 * Remove a clone element from the DOM.
 *
 * @param {HTMLElement} clone - The clone element to remove
 */
export function cleanupClone(clone) {
  if (clone && clone.parentNode) {
    clone.remove();
  }
}
