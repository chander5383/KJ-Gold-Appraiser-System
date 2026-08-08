/**
 * CertificatePrintPage — Playwright PDF Render Target
 * =====================================================
 * A standalone, render-only page that:
 * - Fetches certificate data by ID from API
 * - Renders the EXACT same certificate HTML as CertificatePage.jsx
 * - Applies pdf-mode CSS class (print-ready styling)
 * - Replaces inputs/selects with plain text spans for clean PDF output
 * - Shows watermark
 * - Removes all no-print elements
 * - Signals readiness via window.__PDF_READY = true
 *
 * NO sidebar, NO controls, NO interactivity — pure render target for Playwright.
 *
 * IMPORTANT: This page renders the EXACT same certificate layout as CertificatePage.jsx.
 * Any layout change in CertificatePage must be mirrored here.
 *
 * SHOP DETAILS: read live from the global Settings store, which fetches
 * /api/settings on mount in this fresh browser context on every single PDF
 * request. Nothing about the shop comes from the certificate record or from a
 * literal in this file, and __PDF_READY is withheld until that fetch resolves —
 * so a PDF can never be rendered with stale or hardcoded shop information.
 */

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';
import { useSettings } from '../contexts/SettingsContext';
import { calculateItem, getTotals, formatVal, formatCurrency, parseDateForInput } from '../utils/calculations';

export default function CertificatePrintPage() {
  const { id } = useParams();
  const { shop, loading: settingsLoading, error: settingsError } = useSettings();
  const [cert, setCert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // AbortController: React 18 StrictMode double-invokes effects, which fired two
  // /certificates/:id requests and therefore doubled the work of every
  // server-side PDF render. It also stops a late response writing to unmounted
  // state. __PDF_READY is only ever set by the surviving request.
  useEffect(() => {
    if (!id) {
      setError('No certificate ID provided');
      setLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    loadCertificate(id, controller.signal);

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  /**
   * Playwright readiness gate.
   *
   * Signalling on the certificate alone used to be enough because the shop
   * details were literals in this file. Now they are fetched, so the signal
   * must also wait on the settings store — otherwise page.pdf() could race the
   * /api/settings response and capture an empty header.
   *
   * If settings failed to load we deliberately never signal: pdf.service times
   * out and POST /api/pdf returns an error. A failed PDF is the right outcome;
   * a PDF with a blank or stale shop header is not.
   */
  useEffect(() => {
    if (!cert || settingsLoading) return undefined;

    if (settingsError) {
      console.error('[PDF] Shop settings unavailable — refusing to signal readiness.', settingsError);
      return undefined;
    }

    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        window.__PDF_READY = true;
      });
    });

    return () => {
      cancelAnimationFrame(outer);
      if (inner) cancelAnimationFrame(inner);
    };
  }, [cert, settingsLoading, settingsError]);

  const loadCertificate = async (certId, signal) => {
    try {
      const res = await api.get(`/certificates/${certId}`, { signal });
      const data = res.data;

      // Process items with recalculation (EXACT same as useCertificate.js)
      const goldPrice = data.gold_price || 0;
      const loadedItems = (data.items || []).map(item => ({
        name: item.name || '',
        pieces: item.pieces || 0,
        gross: item.gross || 0,
        stone: item.stone || 0,
        net: item.net || 0,
        carat: item.carat || 0,
        wt24: item.wt_24ct || item.wt24 || 0,
        wt22: item.wt_22ct || item.wt22 || 0,
        value: item.value || 0
      }));

      const recalculatedItems = loadedItems.map(item => calculateItem(item, goldPrice));
      const totals = getTotals(recalculatedItems);

      setCert({
        ...data,
        date: parseDateForInput(data.cert_date),
        goldPrice,
        items: recalculatedItems,
        totals,
        borrowerPrefix: data.borrower_prefix || 'Mr.',
        borrowerName: data.borrower_name || '',
        relationType: data.relation_type || 'S/O',
        fatherName: data.father_name || '',
        address: data.address || '',
        appraiserPrefix: data.appraiser_prefix || 'Ms.',
        appraiserName: data.appraiser_name || '',
        bankName: data.bank_name || '',
        branch: data.branch || '',
        state: data.state || '',
        accountNo: data.account_no || '',
        certNo: data.cert_no || ''
      });

      setLoading(false);
    } catch (err) {
      // An aborted request is a normal StrictMode/unmount cleanup, not a
      // failure — surfacing it would make Playwright screenshot an error page.
      if (signal?.aborted || err?.code === 'ERR_CANCELED') return;
      console.error('Failed to load certificate for print:', err);
      setError('Failed to load certificate');
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>Loading certificate...</div>;
  }
  if (error || !cert) {
    return <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'Inter, sans-serif', color: 'red' }}>{error || 'Certificate not found'}</div>;
  }

  // Format date for display (dd-mm-yyyy from yyyy-mm-dd)
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
  };

  return (
    <div style={{ background: '#fff', margin: 0, padding: 0 }}>
      {/* ===== A4 CERTIFICATE CANVAS (EXACT REPLICA from CertificatePage.jsx) ===== */}
      <div
        className="cert-container pdf-mode mx-auto bg-white p-[8mm] relative flex flex-col"
        style={{ minWidth: '210mm', maxWidth: '210mm' }}
        id="certificate-canvas"
      >
        {/* Full Page Watermark Logo — always visible in PDF. Source is the
            Watermark URL shop setting; omitted when unset so Chromium never
            paints a broken-image placeholder into the PDF. */}
        {shop.watermark_url && (
          <div className="absolute inset-0 m-auto flex items-center justify-center pointer-events-none z-0" style={{ opacity: 0.15 }}>
            <img src={shop.watermark_url} alt="" />
          </div>
        )}

        <div className="relative z-10 flex flex-col h-full">
          {/* ===== HEADER (EXACT) ===== */}
          <div className="relative text-center border-b-[3px] border-slate-800 pb-3 mb-2 shrink-0">
            <div className="w-full flex justify-between items-start absolute top-[-4px] left-[-4px] right-[-4px]">
              <div className="text-[13px] font-black text-slate-900 tracking-wide text-left leading-tight">
                GSTIN : {shop.gstin}<br />
                PAN : {shop.pan}
              </div>
              <div className="text-[14px] font-black text-slate-900 tracking-wide text-right leading-tight">
                {shop.owner_name}<br />
                Mob. <span className="font-black">{shop.phone}</span>
              </div>
            </div>

            <span
              style={{ fontFamily: "'Cinzel', serif" }}
              className="block w-full text-center text-[28px] sm:text-[34px] font-extrabold text-blue-900 uppercase tracking-[0.1em] mt-6 leading-tight"
            >
              {shop.shop_name}
            </span>
            <span className="block w-full text-center text-slate-800 text-[12px] font-bold mt-1">
              {shop.shop_address}
            </span>
          </div>

          {/* ===== CERT NO + DATE (EXACT) ===== */}
          <div className="flex justify-between items-center px-1 py-1 mb-1 shrink-0">
            <div className="text-[13px] font-bold text-slate-800 flex items-center gap-2">
              CERT NO: <span className="font-bold text-indigo-700">{cert.certNo}</span>
            </div>
            <div className="text-[13px] font-bold text-slate-800 flex items-center gap-2">
              DATE: <span className="font-bold">{formatDate(cert.date)}</span>
            </div>
          </div>

          {/* ===== TITLE BAR (EXACT) ===== */}
          <div className="text-center bg-slate-200 px-3 py-1 font-black text-[17px] mb-3 border-y-[2px] border-slate-800 uppercase tracking-widest shrink-0">
            Appraiser Certificate
          </div>

          {/* ===== TOP DETAILS GRID (EXACT) ===== */}
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

          {/* ===== DECLARATION (EXACT TEXT) ===== */}
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

          {/* ===== GOLD PRICE BOX (EXACT) ===== */}
          <div className="flex items-stretch mb-2 border border-slate-800 rounded-sm overflow-hidden shrink-0">
            <div className="p-1 border-r border-slate-800 font-extrabold bg-slate-200 w-1/3 flex items-center justify-center text-center uppercase text-[11px] tracking-wide">
              Gold Rate (per 1gm 22ct)
            </div>
            <div className="p-1 font-bold w-1/3 border-r border-slate-800 flex items-center justify-center">
              <span className="text-sm mr-1 text-slate-800">₹</span>
              <span className="font-bold text-base text-emerald-700">{cert.goldPrice}</span>
            </div>
            <div className="p-1 w-1/3 flex items-center justify-center font-extrabold bg-slate-50 text-[12px]">
              Total Value: <span className="text-emerald-700 ml-2 text-base">₹ {cert.totals.value.toLocaleString('en-IN')}</span>
            </div>
          </div>

          {/* ===== TABLE (EXACT) ===== */}
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
                  <th className="border border-slate-800 py-0.5 px-0.5 w-[55px]">24ct<br /><span className="lowercase text-[9px] font-normal">Eq.</span></th>
                  <th className="border border-slate-800 py-0.5 px-0.5 w-[55px]">22ct<br /><span className="lowercase text-[9px] font-normal">Eq.</span></th>
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
                    <td className="border border-slate-800 py-0.5 px-0.5 font-semibold">{formatVal(item.wt24, true)}</td>
                    <td className="border border-slate-800 py-0.5 px-0.5 bg-indigo-50 font-extrabold text-indigo-900">{formatVal(item.wt22, true)}</td>
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
                  <td className="border border-slate-800 py-1">{formatVal(cert.totals.wt24, true)}</td>
                  <td className="border border-slate-800 py-1">{formatVal(cert.totals.wt22, true)}</td>
                  <td className="border border-slate-800 py-1 px-1 text-emerald-300">₹{formatCurrency(cert.totals.value) === '-' ? '0' : formatCurrency(cert.totals.value)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* ===== BOTTOM SECTION (EXACT) ===== */}
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
        </div>
      </div>
    </div>
  );
}
