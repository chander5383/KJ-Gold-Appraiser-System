/**
 * PDF Service — Playwright Chromium PDF Engine
 * ==============================================
 * Responsible for:
 * - Launching Chromium (headless) via Playwright
 * - Navigating to the frontend certificate print route
 * - Waiting for fonts, images, and readiness signal
 * - Generating A4 PDF via page.pdf()
 * - Returning PDF buffer
 * - Managing browser lifecycle (singleton for performance)
 *
 * ARCHITECTURE:
 * - Uses singleton browser instance to avoid re-launching Chromium per request
 * - Each PDF request creates a new browser context + page (isolated, no cross-contamination)
 * - Navigates to FRONTEND_URL/certificate/:id/print (same React app, print-only route)
 * - Waits for window.__PDF_READY === true (set by CertificatePrintPage after full render)
 * - Calls page.pdf() with exact Chrome print settings
 */

const { chromium } = require('playwright');

// ===== CONFIGURATION =====

/** Frontend base URL (from .env or default dev server) */
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

/**
 * Playwright PDF page settings — matches Chrome Ctrl+P → Save as PDF.
 *
 * preferCSSPageSize: true means `@page { size: A4 portrait; margin: 5mm }` in
 * frontend/src/index.css is authoritative. The margins below are declared to the
 * SAME 5mm so the output is identical whichever value Chromium honours; the
 * certificate frame is sized to the resulting 200mm x 287mm printable box, so
 * changing one without the other clips the outer border.
 *
 * scale must stay 1 — the certificate is authored at true A4 size and any
 * scaling would shift the border off the imageable area.
 */
const PDF_OPTIONS = {
  format: 'A4',
  printBackground: true,
  preferCSSPageSize: true,
  displayHeaderFooter: false,
  landscape: false,
  margin: {
    top: '5mm',
    bottom: '5mm',
    left: '5mm',
    right: '5mm'
  },
  scale: 1
};

/** Maximum time to wait for page readiness (ms) */
const PAGE_TIMEOUT = 30000;

/** Maximum time to wait for __PDF_READY signal (ms) */
const READY_SIGNAL_TIMEOUT = 15000;

// ===== SINGLETON BROWSER MANAGEMENT =====

let browserInstance = null;

/**
 * Get or create the singleton Chromium browser instance.
 * Reuses the same browser across requests for performance.
 *
 * @returns {Promise<import('playwright').Browser>}
 */
async function getBrowser() {
  if (browserInstance && browserInstance.isConnected()) {
    return browserInstance;
  }

  browserInstance = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--font-render-hinting=none'
    ]
  });

  // Handle unexpected disconnection
  browserInstance.on('disconnected', () => {
    browserInstance = null;
    console.warn('[PDF Service] Browser disconnected. Will re-launch on next request.');
  });

  console.log('[PDF Service] Chromium browser launched.');
  return browserInstance;
}

/**
 * Generate a PDF buffer for a given certificate.
 *
 * Flow:
 * 1. Launch/reuse Chromium browser
 * 2. Create isolated browser context
 * 3. Inject JWT token into localStorage (for authenticated API calls from the print page)
 * 4. Navigate to /certificate/:id/print
 * 5. Wait for networkidle
 * 6. Wait for document.fonts.ready
 * 7. Wait for all images loaded
 * 8. Wait for window.__PDF_READY === true
 * 9. Call page.pdf() with A4 settings
 * 10. Close context
 * 11. Return PDF buffer
 *
 * @param {string} certificateId - The certificate ID to render
 * @param {string} authToken - JWT token for authenticated API calls
 * @returns {Promise<Buffer>} PDF file as a Buffer
 */
async function generatePdfBuffer(certificateId, authToken) {
  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: { width: 1200, height: 1600 },
    deviceScaleFactor: 1
  });

  const page = await context.newPage();

  try {
    // Step 1: Set up localStorage with auth token BEFORE navigation
    // Navigate to base URL first to set localStorage on the correct origin
    const baseUrl = FRONTEND_URL.replace(/\/$/, '');
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT });

    // Inject JWT token so the print page can make authenticated API calls
    await page.evaluate((token) => {
      localStorage.setItem('kj_token', token);
    }, authToken);

    // Step 2: Navigate to the certificate print route
    const printUrl = `${baseUrl}/certificate/${certificateId}/print`;
    await page.goto(printUrl, {
      waitUntil: 'networkidle',
      timeout: PAGE_TIMEOUT
    });

    // Step 3: Wait for document.fonts.ready
    await page.evaluate(() => document.fonts.ready);

    // Step 4: Wait for all images to be loaded
    await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));
      return Promise.all(
        images.map(img => {
          if (img.complete && img.naturalHeight > 0) return Promise.resolve();
          return new Promise((resolve) => {
            img.addEventListener('load', resolve, { once: true });
            img.addEventListener('error', resolve, { once: true });
          });
        })
      );
    });

    // Step 5: Wait for the readiness signal from CertificatePrintPage
    await page.waitForFunction(
      () => window.__PDF_READY === true,
      { timeout: READY_SIGNAL_TIMEOUT }
    );

    // Step 6: Small delay for any final CSS transitions/reflows
    await page.waitForTimeout(200);

    // Step 7: Generate PDF
    const pdfBuffer = await page.pdf(PDF_OPTIONS);

    return pdfBuffer;
  } finally {
    // Always clean up the context (page is closed with it)
    await context.close();
  }
}

/**
 * Gracefully shut down the browser instance.
 * Call this on server shutdown for clean exit.
 */
async function closeBrowser() {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
    console.log('[PDF Service] Chromium browser closed.');
  }
}

// Cleanup on process exit
process.on('SIGINT', closeBrowser);
process.on('SIGTERM', closeBrowser);

/**
 * Generate a PDF buffer for a Simple Certificate (no 24ct/22ct columns).
 * Navigates to /certificate-simple/:id/print instead of the standard route.
 *
 * @param {string} certificateId - The certificate ID to render
 * @param {string} authToken - JWT token for authenticated API calls
 * @returns {Promise<Buffer>} PDF file as a Buffer
 */
async function generatePdfBufferSimple(certificateId, authToken) {
  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: { width: 1200, height: 1600 },
    deviceScaleFactor: 1
  });

  const page = await context.newPage();

  try {
    const baseUrl = FRONTEND_URL.replace(/\/$/, '');
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT });

    await page.evaluate((token) => {
      localStorage.setItem('kj_token', token);
    }, authToken);

    // Navigate to the SIMPLE certificate print route
    const printUrl = `${baseUrl}/certificate-simple/${certificateId}/print`;
    console.log('[pdf.service] generatePdfBufferSimple — Playwright navigating to:', printUrl);
    await page.goto(printUrl, { waitUntil: 'networkidle', timeout: PAGE_TIMEOUT });

    await page.evaluate(() => document.fonts.ready);

    await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));
      return Promise.all(
        images.map(img => {
          if (img.complete && img.naturalHeight > 0) return Promise.resolve();
          return new Promise((resolve) => {
            img.addEventListener('load', resolve, { once: true });
            img.addEventListener('error', resolve, { once: true });
          });
        })
      );
    });

    await page.waitForFunction(
      () => window.__PDF_READY === true,
      { timeout: READY_SIGNAL_TIMEOUT }
    );

    await page.waitForTimeout(200);

    const pdfBuffer = await page.pdf(PDF_OPTIONS);
    return pdfBuffer;
  } finally {
    await context.close();
  }
}

module.exports = {
  generatePdfBuffer,
  generatePdfBufferSimple,
  closeBrowser
};
