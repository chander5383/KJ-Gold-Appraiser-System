/**
 * useCertificateSimple Hook — Certificate State & Business Logic
 * ==============================================================
 * Dedicated to the Simple Certificate module (CertificateSimplePage).
 *
 * IDENTICAL to useCertificate.js EXCEPT:
 *   - Uses calculateItemSimple / getTotalsSimple / createEmptyItemSimple
 *     from simpleCalculations.js
 *   - value = net × goldPrice  (no 22ct/24ct conversion)
 *   - wt24 / wt22 are always saved as 0  (schema-compatible, never displayed)
 *
 * The original useCertificate.js is NOT modified.
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  calculateItemSimple,
  getTotalsSimple,
  createEmptyItemSimple,
  toTitleCase,
  parseDateForInput,
  getTodayDate
} from '../utils/simpleCalculations';
import { generateFallbackCertNo } from '../utils/certificateNumber';
import { useSettings } from '../contexts/SettingsContext';
import * as certificateApi from '../services/certificateApi';

/**
 * Custom hook for Simple Certificate state management.
 * Returns all state values, computed values, and action handlers.
 *
 * @returns {Object} Certificate state and actions
 */
export function useCertificateSimple() {
  const { id } = useParams();

  const { shop, defaultGoldRate, loading: settingsLoading } = useSettings();
  const shopName    = shop.shop_name;
  const shopAddress = shop.shop_address;

  // ===== Form State =====
  const [certNo,          setCertNo]          = useState('');
  const [date,            setDate]            = useState(getTodayDate());
  const [bankName,        setBankName]        = useState('UNION BANK OF INDIA');
  const [branch,          setBranch]          = useState('Abohar');
  const [state,           setState]           = useState('PUNJAB');
  const [hasAccountNo,    setHasAccountNo]    = useState(false);
  const [accountNo,       setAccountNo]       = useState('');
  const [borrowerPrefix,  setBorrowerPrefix]  = useState('Mr.');
  const [borrowerName,    setBorrowerName]    = useState('');
  const [relationType,    setRelationType]    = useState('S/O');
  const [fatherName,      setFatherName]      = useState('');
  const [address,         setAddress]         = useState('');
  const [appraiserPrefix, setAppraiserPrefix] = useState('Ms.');
  const [appraiserName,   setAppraiserName]   = useState('');
  const [goldPrice,       setGoldPrice]       = useState(0);  // kept for save-payload compat
  const [items,           setItems]           = useState([createEmptyItemSimple(0)]);
  const [currentDocId,    setCurrentDocId]    = useState(null);
  const [saving,          setSaving]          = useState(false);

  // Seed the gold rate from settings once on a blank certificate
  const goldRateSeeded = useRef(false);

  useEffect(() => {
    if (id || currentDocId) return;
    if (settingsLoading || goldRateSeeded.current) return;
    if (!defaultGoldRate) return;

    goldRateSeeded.current = true;
    setGoldPrice((current) => (current ? current : defaultGoldRate));
    // Also seed ratePerGm on every existing item that has no rate yet
    setItems(prev => prev.map(item =>
      item.ratePerGm ? item : { ...item, ratePerGm: defaultGoldRate }
    ));
  }, [id, currentDocId, settingsLoading, defaultGoldRate]);

  // Load on mount
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

  // ===== Fetch next cert number =====
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

  // ===== Load certificate =====
  const loadCertificate = async (certId, signal) => {
    try {
      const r = await certificateApi.loadCertificateById(certId, signal);

      setCurrentDocId(r.id);
      setCertNo(r.cert_no);
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

      const savedRate = r.gold_price || 0;
      const loadedItems = (r.items || []).map(item => ({
        name:      item.name   || '',
        pieces:    item.pieces || 0,
        gross:     item.gross  || 0,
        stone:     item.stone  || 0,
        net:       item.net    || 0,
        carat:     item.carat  || 0,
        // Reconstruct per-item rate from saved value ÷ net so that
        // calculateItemSimple reproduces the exact stored value.
        // Falls back to the certificate's gold_price when net is zero.
        ratePerGm: item.net > 0
          ? Math.round(item.value / item.net)
          : savedRate,
        wt24:      0,          // Always 0 for simple certificate
        wt22:      0,          // Always 0 for simple certificate
        value:     item.value  || 0
      }));

      setItems(loadedItems.length > 0 ? loadedItems : [createEmptyItemSimple()]);
      toast.success(`Record ${r.cert_no} loaded`);
    } catch (err) {
      if (signal?.aborted || err?.code === 'ERR_CANCELED') return;
      toast.error('Failed to load certificate');
    }
  };

  // ===== Computed values (per-row rate — no carat conversion) =====
  const recalculatedItems = useMemo(
    () => items.map(item => calculateItemSimple(item)),
    [items]
  );
  const totals = useMemo(() => getTotalsSimple(recalculatedItems), [recalculatedItems]);

  // ===== Item handlers =====
  const handleItemChange = (index, field, value) => {
    setItems(prev => {
      const updated = [...prev];
      if (field === 'name') {
        updated[index] = { ...updated[index], [field]: value };
      } else {
        updated[index] = { ...updated[index], [field]: value === '' ? '' : (parseFloat(value) || 0) };
      }
      updated[index] = calculateItemSimple(updated[index]);
      return updated;
    });
  };

  const addRow = () => {
    // Seed the new row's rate from the last row, or fall back to goldPrice
    setItems(prev => {
      const lastRate = prev.length > 0 ? (prev[prev.length - 1].ratePerGm || goldPrice) : goldPrice;
      return [...prev, createEmptyItemSimple(lastRate)];
    });
  };

  const removeRow = (index) => {
    setItems(prev => {
      const updated = prev.filter((_, i) => i !== index);
      return updated.length === 0 ? [createEmptyItemSimple()] : updated;
    });
  };

  // ===== Date change =====
  const handleDateChange = (newDate) => {
    setDate(newDate);
    if (!currentDocId) {
      fetchNextCertNo(newDate);
    }
  };

  // ===== Save =====
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
        shop_name:       shopName,
        shop_address:    shopAddress,
        bank_name:       bankName,
        branch,
        state,
        account_no:      hasAccountNo ? accountNo : '',
        borrower_prefix: borrowerPrefix,
        borrower_name:   borrowerName,
        relation_type:   relationType,
        father_name:     fatherName,
        address,
        appraiser_prefix: appraiserPrefix,
        appraiser_name:  appraiserName,
        gold_price:      goldPrice,
        cert_date:       date,
        items: recalculatedItems.map(item => ({
          name:   item.name,
          pieces: item.pieces,
          gross:  item.gross,
          stone:  item.stone,
          net:    item.net,
          carat:  item.carat,
          wt24:   0,   // schema-compatible placeholder
          wt22:   0,   // schema-compatible placeholder
          value:  item.value
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

  // ===== New Record =====
  const startNew = () => {
    setCurrentDocId(null);
    setBorrowerName('');
    setFatherName('');
    setAddress('');
    setAppraiserName('');
    setAccountNo('');
    setHasAccountNo(false);
    setGoldPrice(defaultGoldRate);
    setDate(getTodayDate());
    setBranch('Abohar');
    setItems([createEmptyItemSimple(defaultGoldRate)]);
    fetchNextCertNo(getTodayDate());
    toast.success('Started new record');
  };

  return {
    // State
    certNo,
    date,
    shopName,
    shopAddress,
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

    // Computed (simple: no wt24/wt22)
    recalculatedItems,
    totals,

    // Setters
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

    // Helper
    toTitleCase
  };
}
