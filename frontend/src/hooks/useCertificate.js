/**
 * useCertificate Hook — Certificate State & Business Logic
 * ==========================================================
 * Encapsulates ALL certificate state management, validation,
 * and data operations. CertificatePage consumes this hook
 * and renders UI only.
 *
 * All logic extracted EXACTLY from CertificatePage.jsx.
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  calculateItem, getTotals, toTitleCase,
  parseDateForInput, getTodayDate, createEmptyItem
} from '../utils/calculations';
import { generateFallbackCertNo } from '../utils/certificateNumber';
import { useSettings } from '../contexts/SettingsContext';
import * as certificateApi from '../services/certificateApi';

/**
 * Custom hook for certificate state management.
 * Returns all state values, computed values, and action handlers.
 *
 * @returns {Object} Certificate state and actions
 */
export function useCertificate() {
  const { id } = useParams();

  // Shop identity is NOT certificate state. It is owned by the Settings page
  // and read live from the global store, so a saved change to the shop name,
  // address or prefix is reflected here on the next render — no reload, no
  // re-login. Previously these were useState seeded with hardcoded literals,
  // which is why the certificate kept showing the old shop details.
  const { shop, defaultGoldRate, loading: settingsLoading } = useSettings();
  const shopName = shop.shop_name;
  const shopAddress = shop.shop_address;

  // ===== Form State (EXACT same as CertificatePage) =====
  const [certNo, setCertNo] = useState('');
  const [date, setDate] = useState(getTodayDate());
  const [bankName, setBankName] = useState('UNION BANK OF INDIA');
  const [branch, setBranch] = useState('Abohar');
  const [state, setState] = useState('PUNJAB');
  const [hasAccountNo, setHasAccountNo] = useState(false);
  const [accountNo, setAccountNo] = useState('');
  const [borrowerPrefix, setBorrowerPrefix] = useState('Mr.');
  const [borrowerName, setBorrowerName] = useState('');
  const [relationType, setRelationType] = useState('S/O');
  const [fatherName, setFatherName] = useState('');
  const [address, setAddress] = useState('');
  const [appraiserPrefix, setAppraiserPrefix] = useState('Ms.');
  const [appraiserName, setAppraiserName] = useState('');
  const [goldPrice, setGoldPrice] = useState(0);
  const [items, setItems] = useState([createEmptyItem()]);
  const [currentDocId, setCurrentDocId] = useState(null);
  const [saving, setSaving] = useState(false);

  // ===== Seed the gold rate from the Default Gold Rate setting =====
  // Only for a blank certificate, and only once: a loaded record carries its
  // own historical rate, and once the user has typed a rate we must not stomp
  // on it when the settings request resolves.
  const goldRateSeeded = useRef(false);

  useEffect(() => {
    if (id || currentDocId) return;
    if (settingsLoading || goldRateSeeded.current) return;
    if (!defaultGoldRate) return;

    goldRateSeeded.current = true;
    setGoldPrice((current) => (current ? current : defaultGoldRate));
  }, [id, currentDocId, settingsLoading, defaultGoldRate]);

  // ===== Load on mount =====
  // AbortController added because React 18 StrictMode double-invokes this
  // effect, which previously fired two /certificates/:id requests and showed
  // the "Record loaded" toast twice on every open.
  useEffect(() => {
    const controller = new AbortController();

    if (id) {
      loadCertificate(id, controller.signal);
    } else {
      fetchNextCertNo(date, controller.signal);
    }

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ===== Fetch next cert number (EXACT same logic) =====
  const fetchNextCertNo = async (dateStr, signal) => {
    if (currentDocId) return;
    try {
      setCertNo('Fetching...');
      const nextCertNo = await certificateApi.fetchNextCertNo(dateStr, signal);
      setCertNo(nextCertNo);
    } catch (err) {
      if (signal?.aborted || err?.code === 'ERR_CANCELED') return;
      setCertNo(generateFallbackCertNo(dateStr, shop.cert_prefix));
    }
  };

  // ===== Load certificate (EXACT same logic) =====
  const loadCertificate = async (certId, signal) => {
    try {
      const r = await certificateApi.loadCertificateById(certId, signal);

      setCurrentDocId(r.id);
      setCertNo(r.cert_no);
      // shop_name / shop_address are deliberately NOT restored from the record.
      // Shop identity is global and comes from Settings; the stored columns are
      // a historical snapshot and would otherwise re-display the old details.
      setBankName(r.bank_name);
      setBranch(r.branch);
      setState(r.state);
      setAccountNo(r.account_no || '');
      setHasAccountNo(!!r.account_no);
      setBorrowerPrefix(r.borrower_prefix || 'Mr.');
      setBorrowerName(r.borrower_name);
      setRelationType(r.relation_type || 'S/O');
      setFatherName(r.father_name);
      setAddress(r.address);
      setAppraiserPrefix(r.appraiser_prefix || 'Ms.');
      setAppraiserName(r.appraiser_name);
      setGoldPrice(r.gold_price || 0);
      setDate(parseDateForInput(r.cert_date));

      // Load items and recalculate
      const loadedItems = (r.items || []).map(item => ({
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

      setItems(loadedItems.length > 0 ? loadedItems : [createEmptyItem()]);
      toast.success(`Record ${r.cert_no} loaded`);
    } catch (err) {
      // An aborted request is a normal unmount/StrictMode cleanup, not a failure.
      if (signal?.aborted || err?.code === 'ERR_CANCELED') return;
      toast.error('Failed to load certificate');
    }
  };

  // ===== Computed values (EXACT same logic, now memoised) =====
  // Unchanged maths — calculateItem/getTotals are called with the same inputs
  // and produce the same output. Previously both ran on *every* render (so on
  // every keystroke in any of the ~15 form fields, not just item edits), and
  // handleItemChange had already run calculateItem for the edited row.
  const recalculatedItems = useMemo(
    () => items.map(item => calculateItem(item, goldPrice)),
    [items, goldPrice]
  );
  const totals = useMemo(() => getTotals(recalculatedItems), [recalculatedItems]);

  // ===== Item handlers (EXACT same logic) =====
  const handleItemChange = (index, field, value) => {
    setItems(prev => {
      const updated = [...prev];
      if (field === 'name') {
        updated[index] = { ...updated[index], [field]: value };
      } else {
        updated[index] = { ...updated[index], [field]: value === '' ? '' : (parseFloat(value) || 0) };
      }
      // Recalculate this item
      updated[index] = calculateItem(updated[index], goldPrice);
      return updated;
    });
  };

  const addRow = () => {
    setItems(prev => [...prev, createEmptyItem()]);
  };

  const removeRow = (index) => {
    setItems(prev => {
      const updated = prev.filter((_, i) => i !== index);
      return updated.length === 0 ? [createEmptyItem()] : updated;
    });
  };

  // ===== Date change (EXACT same logic) =====
  const handleDateChange = (newDate) => {
    setDate(newDate);
    if (!currentDocId) {
      fetchNextCertNo(newDate);
    }
  };

  // ===== Save (EXACT same logic) =====
  const saveCertificate = async () => {
    if (!borrowerName.trim()) {
      toast.error('Borrower Name is required!');
      return null;
    }
    if (hasAccountNo && !accountNo.trim()) {
      toast.error('Account Number is mandatory if checkbox is ticked.');
      return null;
    }

    setSaving(true);
    try {
      const payload = {
        shop_name: shopName,
        shop_address: shopAddress,
        bank_name: bankName,
        branch,
        state,
        account_no: hasAccountNo ? accountNo : '',
        borrower_prefix: borrowerPrefix,
        borrower_name: borrowerName,
        relation_type: relationType,
        father_name: fatherName,
        address,
        appraiser_prefix: appraiserPrefix,
        appraiser_name: appraiserName,
        gold_price: goldPrice,
        cert_date: date,
        items: recalculatedItems.map(item => ({
          name: item.name,
          pieces: item.pieces,
          gross: item.gross,
          stone: item.stone,
          net: item.net,
          carat: item.carat,
          wt24: item.wt24,
          wt22: item.wt22,
          value: item.value
        }))
      };

      let res;
      if (currentDocId) {
        res = await certificateApi.updateCertificate(currentDocId, payload);
        toast.success('Certificate updated!');
      } else {
        res = await certificateApi.createCertificate(payload);
        setCurrentDocId(res.id);
        setCertNo(res.cert_no);
        toast.success('Certificate saved!');
      }
      return res;
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
      return null;
    } finally {
      setSaving(false);
    }
  };

  // ===== New Record (EXACT same logic) =====
  const startNew = () => {
    setCurrentDocId(null);
    setBorrowerName('');
    setFatherName('');
    setAddress('');
    setAppraiserName('');
    setAccountNo('');
    setHasAccountNo(false);
    // Seeded from the Default Gold Rate setting rather than a literal 0, so a
    // change on the Settings page takes effect on the very next new record.
    setGoldPrice(defaultGoldRate);
    setDate(getTodayDate());
    setBranch('Abohar');
    setItems([createEmptyItem()]);
    fetchNextCertNo(getTodayDate());
    toast.success('Started new record');
  };

  return {
    // State values
    certNo,
    date,
    shopName,
    shopAddress,
    // Full shop record from the global Settings store — GSTIN, PAN, owner,
    // phone, watermark, prefix. Consumed by the certificate header.
    shop,
    settingsLoading,
    bankName,
    branch,
    state,
    hasAccountNo,
    accountNo,
    borrowerPrefix,
    borrowerName,
    relationType,
    fatherName,
    address,
    appraiserPrefix,
    appraiserName,
    goldPrice,
    items,
    saving,
    currentDocId,

    // Computed
    recalculatedItems,
    totals,

    // Setters (for form binding)
    setBankName,
    setBranch,
    setState,
    setHasAccountNo,
    setAccountNo,
    setBorrowerPrefix,
    setBorrowerName,
    setRelationType,
    setFatherName,
    setAddress,
    setAppraiserPrefix,
    setAppraiserName,
    setGoldPrice,

    // Actions
    handleItemChange,
    addRow,
    removeRow,
    handleDateChange,
    saveCertificate,
    loadCertificate,
    startNew,

    // Title case helper (re-exported for convenience in JSX onBlur)
    toTitleCase
  };
}
