/**
 * CertificateSimplePrintPage — Playwright PDF Render Target (Simple)
 * ===================================================================
 * Standalone render-only page for the Simple Certificate module.
 * Table: SR | ORNAMENT | QTY | GROSS | STONE | NET WT | CARAT | RATE/GM | VALUE
 * No 24ct / 22ct columns.
 *
 * IMPORTANT: The original CertificatePrintPage.jsx is NOT modified.
 */

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';
import { useSettings } from '../contexts/SettingsContext';
import {
  getTotalsSimple,
  formatVal, formatCurrency, parseDateForInput
} from '../utils/simpleCalculations';
// calculateItemSimple is intentionally NOT imported here.
// ratePerGm is UI-state only and is never persisted to the database.
// The browser calculates and saves item.value before the PDF request.
// Recalculating on the print page with ratePerGm=0 (from a missing DB field)
// would overwrite the correct stored value with 0.

export default function CertificateSimplePrintPage() {
  // ── DIAGNOSTIC LOG ── confirm this version of the file is executing
  console.log('[CertificateSimplePrintPage] v2 MOUNTED — ratePerGm fix applied, RATE BOX removed');

  const { id } = useParams();
  const { shop, loading: settingsLoading, error: settingsError } = useSettings();
  const [cert, setCert]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    console.log('[CertificateSimplePrintPage] useEffect — cert id:', id);
    if (!id) { setError('No certificate ID provided'); setLoading(false); return undefined; }
    const controller = new AbortController();
    loadCertificate(id, controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Signal Playwright only when both cert AND settings are ready
  useEffect(() => {
    if (!cert || settingsLoading) return undefined;
    if (settingsError) {
      console.error('[PDF Simple] Settings unavailable — refusing to signal readiness.', settingsError);
      return undefined;
    }
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        console.log('[CertificateSimplePrintPage] window.__PDF_READY = true — signalling Playwright');
        window.__PDF_READY = true;
      });
    });
    return () => { cancelAnimationFrame(outer); if (inner) cancelAnimationFrame(inner); };
  }, [cert, settingsLoading, settingsError]);

  const loadCertificate = async (certId, signal) => {
    try {
      const res       = await api.get(`/certificates/${certId}`, { signal });
      const data      = res.data;
      const goldPrice = data.gold_price || 0;
      console.log('[CertificateSimplePrintPage] loadCertificate — goldPrice:', goldPrice, '| cert_no:', data.cert_no);

      console.log('[CertificateSimplePrintPage] raw API items:', JSON.stringify(data.items));

      // ratePerGm is UI-state only — it has no column in certificate_items.
      // The browser calculated value = Math.round(net × ratePerGm) before saving,
      // so item.value in the API response is already correct and authoritative.
      //
      // We derive ratePerGm back for display only by reversing the formula:
      //   value = Math.round(net × rate)  →  rate = Math.round(value / net)
      //
      // DO NOT call calculateItemSimple here — doing so would recalculate value
      // using ratePerGm=0 (absent from DB) and overwrite the correct stored value.
      const loadedItems = (data.items || []).map(item => {
        const net   = parseFloat(item.net)   || 0;
        const value = parseFloat(item.value) || 0;
        // Reverse: value = round(net × rate) → rate = round(value / net)
        const ratePerGm = net > 0 ? Math.round(value / net) : 0;

        console.log('[CertificateSimplePrintPage] item:', item.name,
          '| net:', net, '| stored value:', value, '| derived ratePerGm:', ratePerGm);

        return {
          name:      item.name   || '',
          pieces:    item.pieces || 0,
          gross:     item.gross  || 0,
          stone:     item.stone  || 0,
          net,
          carat:     item.carat  || 0,
          ratePerGm, // derived for display — NOT recalculated
          wt24:      0,
          wt22:      0,
          value,     // ← stored value from DB, NOT recalculated
        };
      });

      // Sum the stored values directly — no recalculation
      const totals = getTotalsSimple(loadedItems);
      console.log('[CertificateSimplePrintPage] loadedItems:', JSON.stringify(loadedItems));
      console.log('[CertificateSimplePrintPage] totals:', JSON.stringify(totals));

      setCert({
        ...data,
        date: parseDateForInput(data.cert_date),
        goldPrice,
        items: loadedItems,
        totals,
        borrowerPrefix:  data.borrower_prefix  || 'Mr.',
        borrowerName:    data.borrower_name    || '',
        relationType:    data.relation_type    || 'S/O',
        fatherName:      data.father_name      || '',
        address:         data.address          || '',
        appraiserPrefix: data.appraiser_prefix || 'Ms.',
        appraiserName:   data.appraiser_name   || '',
        bankName:        data.bank_name        || '',
        branch:          data.branch           || '',
        state:           data.state            || '',
        accountNo:       data.account_no       || '',
        certNo:          data.cert_no          || ''
      });
      setLoading(false);
    } catch (err) {
      if (signal?.aborted || err?.code === 'ERR_CANCELED') return;
      console.error('Failed to load simple certificate for print:', err);
      setError('Failed to load certificate');
      setLoading(false);
    }
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>Loading certificate...</div>;
  if (error || !cert) return <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'Inter, sans-serif', color: 'red' }}>{error || 'Certificate not found'}</div>;

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3 && parts[0].length === 4) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return dateStr;
  };

  return (
    <div style={{ background: '#fff', margin: 0, padding: 0 }}>
      <div
        className="cert-container pdf-mode mx-auto bg-white p-[8mm] relative flex flex-col"
        style={{ minWidth: '210mm', maxWidth: '210mm' }}
        id="certificate-canvas"
      >
        {shop.watermark_url && (
          <div className="absolute inset-0 m-auto flex items-center justify-center pointer-events-none z-0" style={{ opacity: 0.15 }}>
            <img src={shop.watermark_url} alt="" />
          </div>
        )}

        <div className="relative z-10 flex flex-col h-full">
          {/* ===== HEADER ===== */}
          <div className="relative text-center border-b-[3px] border-slate-800 pb-3 mb-2 shrink-0">
            <div className="w-full flex justify-between items-start absolute top-[-4px] left-[-4px] right-[-4px]">
              <div className="text-[13px] font-black text-slate-900 tracking-wide text-left leading-tight">
                GSTIN : {shop.gstin}<br />PAN : {shop.pan}
              </div>
              <div className="text-[14px] font-black text-slate-900 tracking-wide text-right leading-tight">
                {shop.owner_name}<br />Mob. <span className="font-black">{shop.phone}</span>
              </div>
            </div>
            <span style={{ fontFamily: "'Cinzel', serif" }} className="block w-full text-center text-[28px] sm:text-[34px] font-extrabold text-blue-900 uppercase tracking-[0.1em] mt-6 leading-tight">
              {shop.shop_name}
            </span>
            <span className="block w-full text-center text-slate-800 text-[12px] font-bold mt-1">{shop.shop_address}</span>
          </div>

          {/* ===== CERT NO + DATE ===== */}
          <div className="flex justify-between items-center px-1 py-1 mb-1 shrink-0">
            <div className="text-[13px] font-bold text-slate-800 flex items-center gap-2">
              CERT NO: <span className="font-bold text-indigo-700">{cert.certNo}</span>
            </div>
            <div className="text-[13px] font-bold text-slate-800 flex items-center gap-2">
              DATE: <span className="font-bold">{formatDate(cert.date)}</span>
            </div>
          </div>

          {/* ===== TITLE BAR ===== */}
          <div className="text-center bg-slate-200 px-3 py-1 font-black text-[17px] mb-3 border-y-[2px] border-slate-800 uppercase tracking-widest shrink-0">
            Appraiser Certificate
          </div>

          {/* ===== TOP DETAILS GRID ===== */}
          <div className="grid grid-cols-2 gap-3 mb-2 shrink-0">
            <div className="p-1 flex flex-col justify-start relative">
              <div className="font-extrabold text-slate-800 tracking-wider uppercase text-[13px] leading-none mb-2">TO</div>
              <div className="ml-[20px] flex flex-col gap-1.5">
                <div className="leading-none font-bold text-[13px]">The Branch Manager,</div>
                <span className="font-bold text-blue-900 text-[13px] leading-none">{cert.bankName}</span>
                <div className="flex items-center leading-none">
                  <span className="font-bold text-[12px] uppercase w-[60px]">BRANCH:</span>
                  <span className="font-bold text-[13px]">{cert.branch}</span>
                </div>
                <div className="flex items-center leading-none">
                  <span className="font-bold text-[12px] uppercase w-[60px]">STATE:</span>
                  <span className="font-bold text-[13px] uppercase">{cert.state}</span>
                </div>
              </div>
            </div>
            <div className="p-1 flex flex-col justify-center gap-2">
              {cert.accountNo && (
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[12px] uppercase w-[55px] text-slate-700">A/C No:</span>
                  <span className="font-mono font-bold tracking-wider text-[13px]">{cert.accountNo}</span>
                </div>
              )}
            </div>
          </div>

          {/* ===== DECLARATION ===== */}
          <div className="mb-2 text-justify leading-relaxed text-[12px] font-semibold text-slate-800 p-2 rounded-sm shrink-0">
            <span className="font-extrabold text-[12px]">Dear Sir/Madam,</span><br />
            I hereby certified that{' '}
            <span className="font-extrabold text-blue-900">{cert.borrowerPrefix}</span>{' '}
            <span className="font-extrabold text-blue-900 border-b border-black">{cert.borrowerName}</span>{' '}
            <span className="font-extrabold">{cert.relationType}</span>{' '}
            <span className="font-extrabold border-b border-black">{cert.fatherName}</span>{' '}
            resident of{' '}
            <span className="font-extrabold border-b border-black">{cert.address}</span>,{' '}
            who has sought gold loan from the bank is not my relative and the gold against which the loan is sought is not purchased from me. The ornaments/coin have been weighed and appraised by me on today in the presence of Appraiser{' '}
            <span className="font-extrabold text-blue-900">{cert.appraiserPrefix}</span>{' '}
            <span className="font-extrabold border-b border-black">{cert.appraiserName}</span>,{' '}
            the exact weight, purity of the metal and market value of the each item as on date are indicated below:
          </div>

          {/* ===== TABLE: SR | ORNAMENT | QTY | GROSS | STONE | NET WT | CARAT | RATE/GM | VALUE ===== */}
          <div className="mb-2 w-full flex-1 shrink">
            <table className="w-full text-center border-collapse border border-slate-800 text-[11px] font-medium" id="itemsTable">
              <thead>
                <tr className="bg-slate-200 text-slate-800 uppercase tracking-tight">
                  <th className="border border-slate-800 py-0.5 px-0.5 w-8">Sr.</th>
                  <th className="border border-slate-800 py-0.5 px-1">Ornaments Name</th>
                  <th className="border border-slate-800 py-0.5 px-0.5 w-10">Qty</th>
                  <th className="border border-slate-800 py-0.5 px-0.5 w-[55px]">Gross<br /><span className="lowercase text-[9px] font-normal">(gms)</span></th>
                  <th className="border border-slate-800 py-0.5 px-0.5 w-[55px]">Stone<br /><span className="lowercase text-[9px] font-normal">(gms)</span></th>
                  <th className="border border-slate-800 py-0.5 px-0.5 w-[55px] bg-slate-300">Net Wt<br /><span className="lowercase text-[9px] font-normal">(gms)</span></th>
                  <th className="border border-slate-800 py-0.5 px-0.5 w-10">Carat</th>
                  <th className="border border-slate-800 py-0.5 px-0.5 w-[65px]">Rate/GM<br /><span className="lowercase text-[9px] font-normal">(₹)</span></th>
                  <th className="border border-slate-800 py-0.5 px-1 w-[70px]">Value<br /><span className="lowercase text-[9px] font-normal">(₹)</span></th>
                </tr>
              </thead>
              <tbody>
                {cert.items.map((item, index) => (
                  <tr key={index}>
                    <td className="border border-slate-800 py-0.5 px-0.5 font-bold text-slate-600">{index + 1}</td>
                    <td className="border border-slate-800 py-0.5 px-0.5 font-bold text-slate-800">{item.name}</td>
                    <td className="border border-slate-800 py-0.5 px-0.5 font-semibold">{formatVal(item.pieces)}</td>
                    <td className="border border-slate-800 py-0.5 px-0.5 font-semibold">{formatVal(item.gross, true)}</td>
                    <td className="border border-slate-800 py-0.5 px-0.5 font-semibold">{formatVal(item.stone, true)}</td>
                    <td className="border border-slate-800 py-0.5 px-0.5 bg-slate-100 font-extrabold text-slate-900">{formatVal(item.net, true)}</td>
                    <td className="border border-slate-800 py-0.5 px-0.5 font-bold text-blue-900">{formatVal(item.carat)}</td>
                    <td className="border border-slate-800 py-0.5 px-0.5 font-semibold text-emerald-700">{item.ratePerGm || '-'}</td>
                    <td className="border border-slate-800 py-0.5 px-1 bg-emerald-50 font-extrabold text-emerald-900">{formatCurrency(item.value)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-extrabold bg-slate-800 text-white uppercase text-[11px] tracking-wider">
                  <td className="border border-slate-800 py-1 px-2 text-right pr-4" colSpan="2">Grand Total</td>
                  <td className="border border-slate-800 py-1">{formatVal(cert.totals.pieces)}</td>
                  <td className="border border-slate-800 py-1">{formatVal(cert.totals.gross, true)}</td>
                  <td className="border border-slate-800 py-1">{formatVal(cert.totals.stone, true)}</td>
                  <td className="border border-slate-800 py-1 text-yellow-300">{formatVal(cert.totals.net, true)}</td>
                  <td className="border border-slate-800 py-1">-</td>
                  <td className="border border-slate-800 py-1">-</td>
                  <td className="border border-slate-800 py-1 px-1 text-emerald-300">₹{formatCurrency(cert.totals.value) === '-' ? '0' : formatCurrency(cert.totals.value)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* ===== BOTTOM SECTION ===== */}
          <div className="mt-auto shrink-0 pt-1">
            <div className="mb-4 text-[10px] p-2 border border-slate-400 rounded-sm font-bold text-slate-800 text-justify italic tracking-tight">
              I solemnly declare that weight, purity of the gold ornaments/precious stones indicated above are correct and I undertake to indemnify the bank against any loss it may sustain on account of any inaccuracy in the above appraisal.
            </div>
            <div className="grid grid-cols-4 gap-4 mt-14 text-center text-[11px] font-extrabold items-end uppercase tracking-tight pb-1">
              <div className="border-t-[2px] border-slate-800 pt-2 mx-1 relative">Cash Officer</div>
              <div className="border-t-[2px] border-slate-800 pt-2 mx-1 relative">Branch Manager</div>
              <div className="border-t-[2px] border-slate-800 pt-2 mx-1">Borrower</div>
              <div className="border-t-[2px] border-slate-800 pt-2 mx-1 relative">Appraiser</div>
            </div>
          </div>

        </div>{/* /relative z-10 */}
      </div>{/* /cert-container */}
    </div>
  );
}
