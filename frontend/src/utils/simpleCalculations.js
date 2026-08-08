/**
 * Simple Gold Calculation Utilities
 * ====================================
 * Dedicated to the Simple Certificate module (CertificateSimplePage).
 *
 * KEY DIFFERENCE from calculations.js:
 *   Value = Net Weight × Rate/GM  (direct multiplication — no carat conversion)
 *   Carat is stored and displayed only; it does NOT affect the value.
 *   24ct and 22ct equivalents are NOT calculated.
 *
 * The helper functions (formatVal, formatCurrency, etc.) are pure utilities
 * with no dependency on the conversion logic — they are re-exported from
 * calculations.js so there is a single source of truth for formatting.
 */

// ── Re-export pure helpers that are shared with the original module ──────────
export {
  formatVal,
  formatCurrency,
  toTitleCase,
  parseDateForInput,
  getTodayDate,
  getFinancialYear
} from './calculations';

/**
 * Calculate a single item's derived values.
 *
 * net   = gross - stone
 * value = round(net × ratePerGm)     ← direct, NO carat conversion
 *
 * wt24 and wt22 are intentionally kept as 0 for database schema compatibility.
 * They are never displayed in the Simple Certificate.
 *
 * @param {Object} item - Item with gross, stone, carat (display-only), pieces, name, ratePerGm
 * @returns {Object} Item with net and value computed
 */
export function calculateItemSimple(item) {
  const gross = parseFloat(item.gross) || 0;
  const stone = parseFloat(item.stone) || 0;
  const rate  = parseFloat(item.ratePerGm) || 0;

  const net   = Math.max(0, gross - stone);
  const value = Math.round(net * rate);

  return {
    ...item,
    net,
    wt24: 0,  // Not calculated — stored as 0 for schema compatibility
    wt22: 0,  // Not calculated — stored as 0 for schema compatibility
    value
  };
}

/**
 * Aggregate totals from a simple-certificate items array.
 * Excludes wt24 / wt22 since they are never used in the Simple Certificate.
 *
 * @param {Object[]} items - Array of items processed by calculateItemSimple
 * @returns {Object} { pieces, gross, stone, net, value }
 */
export function getTotalsSimple(items) {
  return items.reduce(
    (acc, curr) => ({
      pieces: acc.pieces + (Number(curr.pieces) || 0),
      gross:  acc.gross  + (Number(curr.gross)  || 0),
      stone:  acc.stone  + (Number(curr.stone)  || 0),
      net:    acc.net    + (Number(curr.net)    || 0),
      value:  acc.value  + (Number(curr.value)  || 0),
    }),
    { pieces: 0, gross: 0, stone: 0, net: 0, value: 0 }
  );
}

/**
 * Create a default empty item row for the Simple Certificate table.
 * ratePerGm is per-row (UI state only — not persisted to DB).
 * wt24 / wt22 are kept in the shape so the database save payload is compatible.
 *
 * @param {number} [defaultRate=0] - Rate to seed the row with (from settings or last-used)
 * @returns {Object} Empty item
 */
export function createEmptyItemSimple(defaultRate = 0) {
  return { name: '', pieces: 0, gross: 0, stone: 0, net: 0, carat: 0, ratePerGm: defaultRate, wt24: 0, wt22: 0, value: 0 };
}
