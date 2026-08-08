/**
 * Gold Calculation Utilities
 * ===========================
 * EXACT replication of all business logic from Index.html
 * These functions must produce IDENTICAL results.
 */

/**
 * Calculate a single item's derived values
 * EXACT same as Index.html calculateItem()
 *
 * net = gross - stone
 * wt24 = (net * carat) / 24
 * wt22 = (net * carat) / 22
 * value = round(wt22 * goldPrice)
 */
export function calculateItem(item, goldPrice) {
  const gross = parseFloat(item.gross) || 0;
  const stone = parseFloat(item.stone) || 0;
  const carat = parseFloat(item.carat) || 0;
  const gp = parseFloat(goldPrice) || 0;

  const net = Math.max(0, gross - stone);
  const wt24 = (net * carat) / 24;
  const wt22 = (net * carat) / 22;
  const value = Math.round(wt22 * gp);

  return {
    ...item,
    net,
    wt24,
    wt22,
    value
  };
}

/**
 * Get totals from items array
 * EXACT same as Index.html getTotals()
 */
export function getTotals(items) {
  return items.reduce((acc, curr) => ({
    pieces: acc.pieces + (Number(curr.pieces) || 0),
    gross: acc.gross + (Number(curr.gross) || 0),
    stone: acc.stone + (Number(curr.stone) || 0),
    net: acc.net + (Number(curr.net) || 0),
    wt24: acc.wt24 + (Number(curr.wt24) || 0),
    wt22: acc.wt22 + (Number(curr.wt22) || 0),
    value: acc.value + (Number(curr.value) || 0),
  }), { pieces: 0, gross: 0, stone: 0, net: 0, wt24: 0, wt22: 0, value: 0 });
}

/**
 * Format value for display
 * EXACT same as Index.html formatVal()
 * Returns '-' for zero/empty/NaN
 */
export function formatVal(val, isFloat = false) {
  if (val === 0 || val === '0' || val === '' || isNaN(val)) return '-';
  return isFloat ? Number(val).toFixed(2) : val;
}

/**
 * Format currency in Indian locale
 * EXACT same as Index.html formatCurrency()
 */
export function formatCurrency(val) {
  if (val === 0 || val === '0' || val === '' || isNaN(val)) return '-';
  return Number(val).toLocaleString('en-IN');
}

/**
 * Get financial year from date string
 * EXACT same as Code.gs getFinancialYear() and Index.html getFinancialYear()
 *
 * Canonical implementation now lives in utils/certificateNumber.js.
 * Re-exported here for backward compatibility with all existing imports.
 */
export { getFinancialYear } from './certificateNumber';

/**
 * Convert string to Title Case
 * EXACT same as Index.html toTitleCase()
 */
export function toTitleCase(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/\b\w/g, s => s.toUpperCase());
}

/**
 * Parse various date formats into yyyy-MM-dd for input[type="date"]
 * EXACT same as Index.html parseDateForInput()
 */
export function parseDateForInput(rawDate) {
  if (!rawDate) return new Date().toISOString().split('T')[0];
  try {
    if (typeof rawDate === 'string') {
      if (rawDate.includes('T')) return rawDate.split('T')[0];
      const parts = rawDate.split(/[-/]/);
      if (parts.length === 3) {
        if (parts[0].length === 2 && parts[2].length === 4) {
          return `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        if (parts[0].length === 4) {
          return `${parts[0]}-${parts[1]}-${parts[2]}`;
        }
      }
    }
    const d = new Date(rawDate);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
  } catch (e) { /* fallback */ }
  return new Date().toISOString().split('T')[0];
}

/**
 * Get today's date as yyyy-MM-dd
 */
export function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Create a default empty item row
 */
export function createEmptyItem() {
  return { name: '', pieces: 0, gross: 0, stone: 0, net: 0, carat: 0, wt24: 0, wt22: 0, value: 0 };
}
