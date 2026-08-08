/**
 * Certificate Number Generator
 * =============================
 * EXACT replication of Code.gs logic from Google Apps Script
 * 
 * Format: KJ/{FINANCIAL_YEAR}/{SEQUENCE}
 * Example: KJ/2026-27/001
 * 
 * Financial Year: April (month index 3) to March
 * Sequence resets to 001 each financial year
 */

const supabase = require('../config/database');

/**
 * Get Financial Year from date string
 * EXACT same logic as Code.gs getFinancialYear()
 * 
 * Month >= 3 (April onwards, 0-indexed) → current year
 * Month < 3 (Jan-Mar) → previous year
 */
function getFinancialYear(dateString) {
  const d = new Date(dateString);
  const year = d.getFullYear();
  const month = d.getMonth(); // 0-indexed: 0=Jan, 3=Apr

  return month >= 3
    ? `${year}-${(year + 1).toString().slice(2)}`
    : `${year - 1}-${year.toString().slice(2)}`;
}

/**
 * Generate next certificate number
 * EXACT same logic as Code.gs generateCertNoServer()
 * 
 * 1. Determine financial year from date
 * 2. Query all cert numbers for that FY
 * 3. Find maximum sequence number
 * 4. Increment by 1 and pad to 3 digits
 * 
 * Uses DB query instead of Sheet scan, but identical algorithm
 */
async function generateCertNo(dateString, prefix = 'KJ') {
  const currentFY = getFinancialYear(dateString);

  // Query all certificates for this financial year (non-deleted)
  const { data: certs, error } = await supabase
    .from('certificates')
    .select('cert_no')
    .eq('financial_year', currentFY)
    .eq('is_deleted', false);

  if (error) {
    throw new Error('Failed to query certificates: ' + error.message);
  }

  let maxNum = 0;

  // EXACT same iteration logic as Code.gs
  if (certs && certs.length > 0) {
    for (let i = 0; i < certs.length; i++) {
      const certNo = certs[i].cert_no;
      if (!certNo) continue;

      const parts = String(certNo).trim().split('/');
      if (parts.length < 3) continue;

      const fy = parts[1];

      if (fy === currentFY) {
        const num = parseInt(parts[2], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
  }

  const nextNum = maxNum + 1;

  return `${prefix}/${currentFY}/${String(nextNum).padStart(3, '0')}`;
}

/**
 * Preview next cert number without saving
 * EXACT same as Code.gs getNextCertNo()
 */
async function getNextCertNo(dateString, prefix = 'KJ') {
  return await generateCertNo(dateString, prefix);
}

module.exports = { getFinancialYear, generateCertNo, getNextCertNo };
