import { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client';
import { useCertificate } from '../hooks/useCertificate';
import { generatePdf } from '../pdf/pdfGenerator';
import { printTwoCopies } from '../pdf/printGenerator';
import { formatVal, formatCurrency } from '../utils/calculations';

// ===== BANK LIST (same as original) =====
const BANKS = [
  'UNION BANK OF INDIA', 'PUNJAB NATIONAL BANK', 'STATE BANK OF INDIA',
  'PUNJAB & SIND BANK', 'HDFC BANK', 'ICICI BANK', 'AXIS BANK',
  'BANK OF BARODA', 'CANARA BANK', 'BANK OF INDIA', 'CENTRAL BANK OF INDIA',
  'INDIAN BANK', 'INDIAN OVERSEAS BANK', 'UCO BANK', 'BANK OF MAHARASHTRA',
  'YES BANK', 'PUNJAB GRAMIN BANK', 'INDUSIND BANK', 'KOTAK MAHINDRA BANK', 'IDFC FIRST BANK'
];

// ===== STATES LIST (same as original) =====
const STATES = [
  'ANDHRA PRADESH', 'ARUNACHAL PRADESH', 'ASSAM', 'BIHAR', 'CHHATTISGARH',
  'GOA', 'GUJARAT', 'HARYANA', 'HIMACHAL PRADESH', 'JHARKHAND', 'KARNATAKA',
  'KERALA', 'MADHYA PRADESH', 'MAHARASHTRA', 'MANIPUR', 'MEGHALAYA', 'MIZORAM',
  'NAGALAND', 'ODISHA', 'PUNJAB', 'RAJASTHAN', 'SIKKIM', 'TAMIL NADU',
  'TELANGANA', 'TRIPURA', 'UTTAR PRADESH', 'UTTARAKHAND', 'WEST BENGAL',
  'ANDAMAN AND NICOBAR ISLANDS', 'CHANDIGARH',
  'DADRA AND NAGAR HAVELI AND DAMAN AND DIU', 'DELHI',
  'JAMMU AND KASHMIR', 'LADAKH', 'LAKSHADWEEP', 'PUDUCHERRY'
];

// A4 portrait sheet width, 210mm at 96dpi. Used only to compute the on-screen
// fit-to-width scale; the canvas is deliberately NOT made fluid. When printing,
// index.css narrows the frame to the 200mm printable box (210mm minus the 2 x
// 5mm @page margin) so the outer border is not clipped.
const A4_WIDTH_PX = 793.7;

export default function CertificatePage() {
  const certRef = useRef(null);
  const viewportRef = useRef(null);

  // Fit-to-width is a purely visual CSS transform on a wrapper. The transform is
  // forced to none in @media print and .pdf-mode, so print and PDF output are
  // unaffected regardless of this toggle.
  const [fitToWidth, setFitToWidth] = useState(false);
  const [scale, setScale] = useState(1);
  const [canvasHeight, setCanvasHeight] = useState(0);

  const measure = useCallback(() => {
    if (!fitToWidth) {
      setScale(1);
      return;
    }
    const available = viewportRef.current?.clientWidth ?? 0;
    setScale(available > 0 ? Math.min(1, available / A4_WIDTH_PX) : 1);
    // transform:scale does not affect layout, so the wrapper would otherwise
    // still reserve the full unscaled height and leave a large gap below.
    setCanvasHeight(certRef.current?.offsetHeight ?? 0);
  }, [fitToWidth]);

  useEffect(() => {
    measure();
    if (!fitToWidth) return undefined;

    // Observe both: the viewport for width changes (rotation, resize) and the
    // canvas for height changes (adding/removing item rows).
    const ro = new ResizeObserver(measure);
    if (viewportRef.current) ro.observe(viewportRef.current);
    if (certRef.current) ro.observe(certRef.current);
    return () => ro.disconnect();
  }, [fitToWidth, measure]);

  // All state and business logic from the custom hook
  const {
    certNo, date, shopName, shopAddress, shop,
    bankName, branch, state, hasAccountNo, accountNo,
    borrowerPrefix, borrowerName, relationType, fatherName,
    address, appraiserPrefix, appraiserName, goldPrice,
    saving, recalculatedItems, totals, currentDocId,
    setBankName, setBranch, setState, setHasAccountNo, setAccountNo,
    setBorrowerPrefix, setBorrowerName, setRelationType, setFatherName,
    setAddress, setAppraiserPrefix, setAppraiserName, setGoldPrice,
    handleItemChange, addRow, removeRow, handleDateChange,
    saveCertificate, loadCertificate, startNew, toTitleCase
  } = useCertificate();

  // ===== BUTTON EVENT HANDLERS =====
  const handlePrint = () => printTwoCopies(certRef.current, saveCertificate);
  const handleDownloadPdf = () => generatePdf(certRef.current, certNo, saveCertificate, currentDocId);

  // ===== RESIZE INPUT HELPER =====
  const getInputWidth = (value, placeholder, minCh = 2) => {
    const len = value ? value.length : 0;
    const phLen = placeholder ? placeholder.length : 10;
    if (len === 0) return `${phLen}ch`;
    return `${Math.max(len, minCh) + 1.5}ch`;
  };

  return (
    <div className="page-enter print:p-0 print:m-0">
      {/* Controls Bar (EXACT same layout as original) */}
      <div className="max-w-5xl mx-auto mb-4 sm:mb-6 bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-3 sm:p-4 flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 items-stretch sm:items-center justify-center no-print">
        {/* Search */}
        <SearchBar onResult={loadCertificate} />

        {/* New Record */}
        <button type="button" onClick={startNew} className="flex items-center justify-center gap-2 bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-200 px-4 py-2.5 sm:py-2 rounded-lg font-medium transition-colors text-sm w-full sm:w-auto">
          <i className="ph ph-arrows-clockwise text-lg sm:text-base"></i> New Record
        </button>

        {/* Save & Print 2 Copies */}
        <button type="button" onClick={handlePrint} disabled={saving} className="flex items-center justify-center gap-2 bg-slate-800 dark:bg-primary-600 hover:bg-slate-900 dark:hover:bg-primary-700 text-white px-5 py-2.5 sm:py-2 rounded-lg shadow-sm font-medium transition-colors text-sm w-full sm:w-auto disabled:opacity-50">
          <i className={`ph ${saving ? 'ph-spinner animate-spin' : 'ph-printer'} text-lg sm:text-base`}></i>
          {saving ? 'Saving...' : 'Save & Print (2 Copies)'}
        </button>

        {/* Download PDF */}
        <button type="button" onClick={handleDownloadPdf} disabled={saving} className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 sm:py-2 rounded-lg shadow-sm font-medium transition-colors text-sm w-full sm:w-auto disabled:opacity-50">
          <i className="ph ph-file-pdf text-lg sm:text-base"></i> PDF
        </button>
      </div>

      {/* Viewport controls — the A4 canvas cannot shrink, so offer a choice
          between panning it and scaling it down to fit. */}
      <div className="flex items-center justify-center gap-2 mb-2 lg:hidden no-print">
        <button
          type="button"
          onClick={() => setFitToWidth((v) => !v)}
          aria-pressed={fitToWidth}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-gray-700 transition-colors"
        >
          <i className={`ph ${fitToWidth ? 'ph-arrows-out' : 'ph-arrows-in-simple'} text-base`} aria-hidden="true" />
          {fitToWidth ? 'Actual size' : 'Fit to width'}
        </button>
        {fitToWidth && scale < 1 && (
          <span className="text-xs text-slate-400 tabular-nums">{Math.round(scale * 100)}%</span>
        )}
      </div>

      {!fitToWidth && (
        <p className="text-center text-xs text-slate-500 mb-2 lg:hidden flex items-center justify-center gap-1 font-medium no-print">
          <i className="ph ph-arrows-left-right text-base" aria-hidden="true" /> Scroll sideways to view full certificate
        </p>
      )}

      {/* ===== A4 CERTIFICATE CANVAS (EXACT REPLICA) ===== */}
      <div
        ref={viewportRef}
        className={`cert-viewport w-full pb-4 print:pb-0 print:overflow-visible relative ${fitToWidth ? 'overflow-x-hidden' : 'overflow-x-auto'}`}
        style={{ WebkitOverflowScrolling: 'touch', scrollBehavior: 'smooth' }}
      >
        {/* .cert-zoom applies transform:scale(var(--cert-scale)); both are reset
            inside @media print and .pdf-mode so output geometry is untouched. */}
        <div
          className={fitToWidth ? 'cert-zoom' : ''}
          style={fitToWidth ? { '--cert-scale': scale } : undefined}
        >
          <div
            ref={certRef}
            className="cert-container mx-auto bg-white p-[8mm] shadow-xl relative flex flex-col"
            style={{ minWidth: '210mm', maxWidth: '210mm' }}
            id="certificate-canvas"
          >
            {/* Full Page Watermark Logo — URL comes from the Watermark URL
                shop setting. Omitted entirely when unset so the PDF never
                renders a broken-image box. */}
            {shop.watermark_url && (
              <div className="absolute inset-0 m-auto flex items-center justify-center pointer-events-none z-0 hidden print:flex opacity-[0.15]">
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
                    Mob. <input type="text" value={shop.phone} readOnly aria-label="Shop mobile number" className="bg-transparent border-none outline-none w-[100px] text-right font-black cursor-default pointer-events-none" />
                  </div>
                </div>

                <input
                  type="text"
                  value={shopName}
                  readOnly
                  aria-label="Shop name"
                  style={{ fontFamily: "'Cinzel', serif" }}
                  className="w-full text-center text-[28px] sm:text-[34px] font-extrabold text-blue-900 bg-transparent border-none outline-none uppercase tracking-[0.1em] mt-6 leading-tight cursor-default pointer-events-none"
                />
                <input
                  type="text"
                  value={shopAddress}
                  readOnly
                  aria-label="Shop address"
                  className="w-full text-center text-slate-800 bg-transparent border-none outline-none text-[12px] font-bold mt-1 cursor-default pointer-events-none"
                />
              </div>

              {/* ===== CERT NO + DATE (EXACT) ===== */}
              <div className="flex justify-between items-center px-1 py-1 mb-1 shrink-0">
                <div className="text-[13px] font-bold text-slate-800 flex items-center gap-2">
                  CERT NO: <input type="text" value={certNo} readOnly aria-label="Certificate number" className="bg-transparent border-none outline-none w-32 font-bold text-left cursor-default text-indigo-700" />
                </div>
                <div className="text-[13px] font-bold text-slate-800 flex items-center gap-2">
                  DATE: <input type="date" value={date} onChange={(e) => handleDateChange(e.target.value)} aria-label="Certificate date" className="font-bold text-[13px] w-[115px] outline-none bg-transparent" />
                </div>
              </div>

              {/* ===== TITLE BAR (EXACT) ===== */}
              <div className="text-center bg-slate-200 px-3 py-1 font-black text-[17px] mb-3 border-y-[2px] border-slate-800 uppercase tracking-widest shrink-0">
                Appraiser Certificate
              </div>

              {/* ===== TOP DETAILS GRID (EXACT) ===== */}
              <div className="grid grid-cols-2 gap-3 mb-2 shrink-0">
                <div className="p-1 flex flex-col justify-start relative bg-white/80 print:bg-transparent">
                  <div className="font-extrabold text-slate-800 tracking-wider uppercase text-[13px] leading-none mb-2">TO</div>
                  <div className="ml-[20px] flex flex-col gap-1.5">
                    <div className="leading-none font-bold text-[13px]">The Branch Manager,</div>
                    <select value={bankName} onChange={(e) => setBankName(e.target.value)} aria-label="Bank name" className="font-bold w-[95%] bg-transparent outline-none text-blue-900 appearance-none cursor-pointer text-[13px] leading-none border-none">
                      {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                    <div className="flex items-center leading-none">
                      <span className="font-bold text-[12px] uppercase w-[60px]">BRANCH:</span>
                      <input type="text" value={branch} onChange={(e) => setBranch(e.target.value.toUpperCase())} aria-label="Bank branch" className="font-bold flex-1 text-[13px] bg-transparent outline-none border-none leading-none" placeholder="Enter Branch" />
                    </div>
                    <div className="flex items-center leading-none">
                      <span className="font-bold text-[12px] uppercase w-[60px]">STATE:</span>
                      <select value={state} onChange={(e) => setState(e.target.value)} aria-label="State" className="font-bold text-[13px] uppercase bg-transparent outline-none border-none appearance-none cursor-pointer flex-1">
                        {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="p-1 flex flex-col justify-center gap-2 bg-white/80 print:bg-transparent">
                  <div className={`flex items-center gap-2 transition-opacity print:hidden ${!hasAccountNo ? 'opacity-40' : ''}`}>
                    <input type="checkbox" checked={hasAccountNo} onChange={(e) => { setHasAccountNo(e.target.checked); if (!e.target.checked) setAccountNo(''); }} aria-label="Show account number on the printed certificate" className="no-print w-4 h-4 text-blue-600 rounded cursor-pointer border-slate-300 focus:ring-blue-500" />
                    <span className="font-bold text-[12px] uppercase w-[55px] text-slate-700">A/C No:</span>
                    <input type="number" value={accountNo} onChange={(e) => setAccountNo(e.target.value)} disabled={!hasAccountNo} aria-label="Account number" className="font-mono font-bold tracking-wider text-[13px] flex-1 bg-transparent outline-none border-none" placeholder="Account Number" />
                  </div>
                  <div className="text-[11px] text-slate-400 print:hidden italic mt-2 ml-6">
                    * Tick checkbox to show Account No in print
                  </div>
                </div>
              </div>

              {/* ===== DECLARATION (EXACT TEXT) ===== */}
              <div className="mb-2 text-justify leading-relaxed text-[12px] font-semibold text-slate-800 bg-slate-50/80 print:bg-transparent p-2 print:p-0 rounded-sm shadow-inner print-shadow-none shrink-0 border border-slate-200 print:border-none">
                <span className="font-extrabold text-[12px]">Dear Sir/Madam,</span><br />
                I hereby certified that{' '}

                <select value={borrowerPrefix} onChange={(e) => setBorrowerPrefix(e.target.value)} aria-label="Borrower title" className="editable-input border-b-input font-extrabold text-blue-900 bg-transparent outline-none">
                  <option value="Mr.">Mr.</option>
                  <option value="Mrs.">Mrs.</option>
                  <option value="Ms.">Ms.</option>
                </select>{' '}

                <input type="text" value={borrowerName} onChange={(e) => setBorrowerName(e.target.value)} onBlur={(e) => setBorrowerName(toTitleCase(e.target.value))} style={{ width: getInputWidth(borrowerName, 'Borrower Name') }} className="editable-input border-b-input font-extrabold text-center text-blue-900 mx-1" placeholder="Borrower Name" />{' '}

                <select value={relationType} onChange={(e) => setRelationType(e.target.value)} aria-label="Relation to the named relative" className="editable-input border-b-input font-extrabold mx-1 bg-transparent outline-none">
                  <option value="S/O">S/O</option>
                  <option value="D/O">D/O</option>
                  <option value="W/O">W/O</option>
                  <option value="C/O">C/O</option>
                </select>

                <input type="text" value={fatherName} onChange={(e) => setFatherName(e.target.value)} onBlur={(e) => setFatherName(toTitleCase(e.target.value))} style={{ width: getInputWidth(fatherName, "Relative's Name") }} className="editable-input border-b-input font-extrabold text-center mx-1" placeholder="Relative's Name" />{' '}

                resident of{' '}
                <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} onBlur={(e) => setAddress(toTitleCase(e.target.value))} style={{ width: getInputWidth(address, 'Village / City Address', 2) }} className="editable-input border-b-input mx-1 font-extrabold text-center" placeholder="Village / City Address" />,{' '}
                who has sought gold loan from the bank is not my relative and the gold against which the loan is sought is not purchased from me. The ornaments/coin have been weighed and appraised by me on today in the presence of Appraiser{' '}

                <select value={appraiserPrefix} onChange={(e) => setAppraiserPrefix(e.target.value)} aria-label="Appraiser title" className="editable-input border-b-input font-extrabold text-blue-900 bg-transparent outline-none ml-1">
                  <option value="Mr.">Mr.</option>
                  <option value="Mrs.">Mrs.</option>
                  <option value="Ms.">Ms.</option>
                </select>{' '}

                <input type="text" value={appraiserName} onChange={(e) => setAppraiserName(e.target.value)} onBlur={(e) => setAppraiserName(toTitleCase(e.target.value))} style={{ width: getInputWidth(appraiserName, 'Appraiser Name') }} className="editable-input border-b-input mx-1 font-extrabold text-center" placeholder="Appraiser Name" />,{' '}
                the exact weight, purity of the metal and market value of the each item as on date are indicated below:
              </div>

              {/* ===== GOLD PRICE BOX (EXACT) ===== */}
              <div className="flex items-stretch mb-2 border border-slate-800 shadow-sm print-shadow-none rounded-sm overflow-hidden shrink-0 bg-white/90 print:bg-transparent">
                <div className="p-1 border-r border-slate-800 font-extrabold bg-slate-200 w-1/3 flex items-center justify-center text-center uppercase text-[11px] tracking-wide">
                  Gold Rate (per 1gm 22ct)
                </div>
                <div className="p-1 font-bold w-1/3 border-r border-slate-800 flex items-center justify-center">
                  <span className="text-sm mr-1 text-slate-800">₹</span>
                  <input
                    type="number"
                    value={goldPrice}
                    onChange={(e) => setGoldPrice(e.target.value === '' ? '' : Number(e.target.value))}
                    onBlur={(e) => { if (e.target.value !== '') setGoldPrice(Number(e.target.value)); }}
                    placeholder="0"
                    aria-label="Gold rate per 1 gram 22 carat"
                    className="w-24 outline-none text-center bg-transparent font-bold text-base text-emerald-700 border-b border-dashed border-emerald-300 print:border-none focus:border-emerald-600"
                  />
                </div>
                <div className="p-1 w-1/3 flex items-center justify-center font-extrabold bg-slate-50 text-[12px]">
                  Total Value: <span className="text-emerald-700 ml-2 text-base">₹ {totals.value.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* ===== TABLE (EXACT) ===== */}
              <div className="mb-2 w-full flex-1 shrink bg-white/90 print:bg-transparent">
                <table className="w-full text-center border-collapse border border-slate-800 text-[11px] font-medium shadow-sm print-shadow-none" id="itemsTable">
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
                      <th className="border border-slate-800 py-0.5 px-0.5 w-6 no-print"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {recalculatedItems.map((item, index) => (
                      <tr key={index} className="hover:bg-slate-50 print:hover:bg-transparent transition-colors group">
                        <td className="border border-slate-800 py-0.5 px-0.5 font-bold text-slate-600">{index + 1}</td>
                        <td className="border border-slate-800 py-0.5 px-0.5">
                          <input value={item.name} onChange={(e) => handleItemChange(index, 'name', e.target.value)} aria-label={`Ornament name, row ${index + 1}`} className="w-full text-center py-0.5 px-1 outline-none bg-transparent focus:bg-white font-bold text-slate-800" placeholder="Item" />
                        </td>
                        <td className="border border-slate-800 py-0.5 px-0.5">
                          <input type="number" value={item.pieces} onChange={(e) => handleItemChange(index, 'pieces', e.target.value)} onBlur={(e) => { if (e.target.value !== '') handleItemChange(index, 'pieces', Number(e.target.value)); }} aria-label={`Quantity, row ${index + 1}`} className="w-full text-center py-0.5 outline-none bg-transparent focus:bg-white font-semibold print:hidden" />
                          <span className="hidden print:inline-block font-semibold">{formatVal(item.pieces)}</span>
                        </td>
                        <td className="border border-slate-800 py-0.5 px-0.5">
                          <input type="number" step="0.01" value={item.gross} onChange={(e) => handleItemChange(index, 'gross', e.target.value)} onBlur={(e) => { if (e.target.value !== '') handleItemChange(index, 'gross', Number(e.target.value)); }} aria-label={`Gross weight in grams, row ${index + 1}`} className="w-full text-center py-0.5 outline-none bg-transparent focus:bg-white font-semibold print:hidden" />
                          <span className="hidden print:inline-block font-semibold">{formatVal(item.gross, true)}</span>
                        </td>
                        <td className="border border-slate-800 py-0.5 px-0.5">
                          <input type="number" step="0.01" value={item.stone} onChange={(e) => handleItemChange(index, 'stone', e.target.value)} onBlur={(e) => { if (e.target.value !== '') handleItemChange(index, 'stone', Number(e.target.value)); }} aria-label={`Stone weight in grams, row ${index + 1}`} className="w-full text-center py-0.5 outline-none bg-transparent focus:bg-white font-semibold print:hidden" />
                          <span className="hidden print:inline-block font-semibold">{formatVal(item.stone, true)}</span>
                        </td>
                        <td className="border border-slate-800 py-0.5 px-0.5 bg-slate-100 font-extrabold text-slate-900">
                          {formatVal(item.net, true)}
                        </td>
                        <td className="border border-slate-800 py-0.5 px-0.5">
                          <input type="number" value={item.carat} onChange={(e) => handleItemChange(index, 'carat', e.target.value)} onBlur={(e) => { if (e.target.value !== '') handleItemChange(index, 'carat', Number(e.target.value)); }} aria-label={`Carat, row ${index + 1}`} className="w-full text-center py-0.5 outline-none bg-transparent focus:bg-white text-blue-900 font-bold print:hidden" />
                          <span className="hidden print:inline-block font-bold text-blue-900">{formatVal(item.carat)}</span>
                        </td>
                        <td className="border border-slate-800 py-0.5 px-0.5 font-semibold">
                          {formatVal(item.wt24, true)}
                        </td>
                        <td className="border border-slate-800 py-0.5 px-0.5 bg-indigo-50 font-extrabold text-indigo-900">
                          {formatVal(item.wt22, true)}
                        </td>
                        <td className="border border-slate-800 py-0.5 px-1 bg-emerald-50 font-extrabold text-emerald-900">
                          {formatCurrency(item.value)}
                        </td>
                        <td className="border border-slate-800 py-0.5 px-0.5 no-print text-center">
                          <button
                            type="button"
                            onClick={() => removeRow(index)}
                            aria-label={`Remove item row ${index + 1}`}
                            className="text-slate-400 hover:text-red-600 transition-colors"
                          >
                            <i className="ph ph-trash" aria-hidden="true"></i>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-extrabold bg-slate-800 text-white uppercase text-[11px] tracking-wider">
                      <td className="border border-slate-800 py-1 px-2 text-right pr-4" colSpan="2">Grand Total</td>
                      <td className="border border-slate-800 py-1">{formatVal(totals.pieces)}</td>
                      <td className="border border-slate-800 py-1">{formatVal(totals.gross, true)}</td>
                      <td className="border border-slate-800 py-1">{formatVal(totals.stone, true)}</td>
                      <td className="border border-slate-800 py-1 text-yellow-300">{formatVal(totals.net, true)}</td>
                      <td className="border border-slate-800 py-1">-</td>
                      <td className="border border-slate-800 py-1">{formatVal(totals.wt24, true)}</td>
                      <td className="border border-slate-800 py-1">{formatVal(totals.wt22, true)}</td>
                      <td className="border border-slate-800 py-1 px-1 text-emerald-300">₹{formatCurrency(totals.value) === '-' ? '0' : formatCurrency(totals.value)}</td>
                      <td className="border border-slate-800 no-print"></td>
                    </tr>
                  </tfoot>
                </table>

                <div className="mt-2 no-print flex justify-end">
                  <button type="button" onClick={addRow} className="flex items-center gap-1 bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1.5 rounded-md text-[11px] font-bold transition-colors border border-blue-200 shadow-sm">
                    <i className="ph ph-plus" aria-hidden="true"></i> Add Row
                  </button>
                </div>
              </div>

              {/* ===== BOTTOM SECTION (EXACT) ===== */}
              <div className="mt-auto shrink-0 bg-white/90 print:bg-transparent pt-1">
                <div className="mb-4 text-[10px] p-2 border border-slate-400 rounded-sm font-bold text-slate-800 text-justify italic bg-slate-50/50 tracking-tight">
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
          {/* /.cert-zoom */}
        </div>
      </div>
    </div>
  );
}

// ===== SEARCH BAR COMPONENT =====
// Universal search: if the found certificate belongs to Simple Certificate,
// show a confirmation dialog then navigate to /certificate-simple/:id.
function SearchBar({ onResult }) {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [crossPage, setCrossPage] = useState(null); // { path, label } when cert is wrong type
  const navigate = useNavigate();

  const handleSearch = async () => {
    if (!query.trim()) {
      toast.error('Please enter a Certificate No (e.g. 1, 001 or KJ/2026-27/001)');
      return;
    }

    setSearching(true);
    try {
      const res = await api.get('/certificates/search', { params: { query: query.trim() } });
      const results = res.data.results;

      if (results && results.length > 0) {
        const cert = results[0];
        if (cert.certificate_type === 'simple') {
          // Found cert belongs to the Simple Certificate editor — ask user to switch
          setCrossPage({ path: `/certificate-simple/${cert.id}`, label: 'Simple Certificate' });
        } else {
          onResult(cert.id);
        }
      } else {
        toast.error('Record not found! Ensure number is correct.');
      }
    } catch (err) {
      toast.error('Search failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setSearching(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-1 bg-white dark:bg-gray-800 border-2 border-indigo-200 dark:border-indigo-800 rounded-lg px-2 py-1.5 focus-within:border-indigo-500 transition-colors shadow-sm w-full sm:w-auto flex-1 sm:flex-none">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
          placeholder="No. (e.g. 008)"
          aria-label="Certificate number to search"
          className="outline-none text-sm flex-1 sm:w-40 font-bold text-slate-800 dark:text-gray-200 uppercase tracking-wide bg-transparent"
        />
        <button type="button" onClick={handleSearch} aria-label="Search certificate by number" className="text-indigo-600 hover:text-indigo-800 bg-indigo-50 dark:bg-indigo-900/50 hover:bg-indigo-100 p-1.5 rounded transition-colors" title="Search Record">
          <i className={`ph ${searching ? 'ph-spinner animate-spin' : 'ph-magnifying-glass'} text-lg font-bold`}></i>
        </button>
      </div>

      {/* Cross-page confirmation dialog */}
      {crossPage && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setCrossPage(null)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl p-5 sm:p-6 max-w-sm w-full shadow-2xl animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-slate-700 dark:text-gray-300 leading-relaxed">
              This certificate belongs to
            </p>
            <p className="text-base font-bold text-primary-600 dark:text-primary-400 mt-1">
              {crossPage.label}.
            </p>
            <p className="text-sm font-semibold text-slate-700 dark:text-gray-300 mt-1">
              Open it?
            </p>
            <div className="flex gap-2 mt-5">
              <button
                type="button"
                onClick={() => setCrossPage(null)}
                className="glass-btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { setCrossPage(null); navigate(crossPage.path); }}
                className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
              >
                Open Certificate
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
