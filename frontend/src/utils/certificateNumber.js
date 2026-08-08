/**
 * Certificate Number Utilities
 * =============================
 * Financial year logic and certificate number formatting.
 * EXACT replication of existing logic from calculations.js / Code.gs.
 */

/**
 * Get financial year from date string.
 * EXACT same as Code.gs getFinancialYear() and calculations.js getFinancialYear().
 *
 * Month >= 3 (April, 0-indexed) → current year pair
 * Month < 3 (Jan-Mar) → previous year pair
 *
 * @param {string} dateString - Date in any parseable format
 * @returns {string} Financial year (e.g. "2026-27")
 */
export function getFinancialYear(dateString) {
  const d = new Date(dateString);
  const year = d.getFullYear();
  const month = d.getMonth();

  return month >= 3
    ? `${year}-${(year + 1).toString().slice(2)}`
    : `${year - 1}-${year.toString().slice(2)}`;
}

/** Prefix of last resort, used only if the settings store has not hydrated. */
export const DEFAULT_CERT_PREFIX = 'KJ';

/**
 * Generate a fallback certificate number placeholder for when the API is
 * unavailable. Never saved — the trailing `---` marks it as un-numbered.
 *
 * The prefix is a parameter so callers can pass the `cert_prefix` shop setting;
 * this keeps the placeholder consistent with the numbers the backend issues.
 * The sequence/financial-year logic itself is unchanged.
 *
 * @param {string} dateStr - Date string for financial year calculation
 * @param {string} [prefix] - Certificate prefix from shop settings
 * @returns {string} Fallback cert number (e.g. "KJ/2026-27/---")
 */
export function generateFallbackCertNo(dateStr, prefix) {
  return `${prefix || DEFAULT_CERT_PREFIX}/${getFinancialYear(dateStr)}/---`;
}
