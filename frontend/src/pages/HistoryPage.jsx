import { useState, useEffect, useCallback, useId, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client';
import { useDialog } from '../hooks/useDialog';
import { formatCurrency } from '../utils/calculations';
import CertificateTypeModal from '../components/CertificateTypeModal';

const LIMIT = 15;

// Full class names, not interpolated fragments — Tailwind's JIT scanner only
// sees complete strings, so `text-${align}` would silently produce no CSS.
const SORTABLE = [
  { field: 'cert_no', label: 'Cert No', align: 'text-left', rtl: false },
  { field: 'cert_date', label: 'Date', align: 'text-left', rtl: false },
  { field: 'borrower_name', label: 'Borrower', align: 'text-left', rtl: false },
  { field: null, label: 'Bank', align: 'text-left', rtl: false },
  { field: 'grand_total', label: 'Value', align: 'text-right', rtl: true },
];

export default function HistoryPage() {
  const navigate = useNavigate();

  // Route each certificate to the correct editor based on type.
  // Backend derives certificate_type from total_wt_24ct/22ct (simple = both 0).
  const certRoute = (cert) =>
    cert.certificate_type === 'simple'
      ? `/certificate-simple/${cert.id}`
      : `/certificate/${cert.id}`;

  const [certificates, setCertificates] = useState([]);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  // Draft filter inputs (what the user is typing) are kept separate from the
  // committed filters that actually drive fetching. Previously handleSearch
  // called setPage(1) AND fetchCertificates(), so whenever page !== 1 the state
  // update fired the effect too and the same search went out twice.
  const [draft, setDraft] = useState({ search: '', dateFrom: '', dateTo: '' });
  const [filters, setFilters] = useState({ search: '', dateFrom: '', dateTo: '' });

  // Delete confirmation. `deleteTarget` holds the certificate awaiting
  // confirmation; `deleting` blocks a double-submit while the request is out.
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const deleteTitleId = useId();

  // Mirrored in a ref so closeDelete keeps a stable identity — useDialog keys
  // its effect on it, and re-running that effect mid-dialog would re-trap focus.
  const deletingRef = useRef(false);

  const closeDelete = useCallback(() => {
    // Ignore Escape/backdrop while the DELETE is in flight — closing the dialog
    // mid-request would leave the user with no feedback about the outcome.
    if (deletingRef.current) return;
    setDeleteTarget(null);
  }, []);

  const deleteDialogRef = useDialog(Boolean(deleteTarget), closeDelete);

  // Single owner of data fetching. Every input it depends on is in the dep array,
  // so exactly one request goes out per meaningful change.
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    (async () => {
      try {
        const params = { page, limit: LIMIT, sortBy, sortOrder };
        if (filters.search) params.search = filters.search;
        if (filters.dateFrom) params.dateFrom = filters.dateFrom;
        if (filters.dateTo) params.dateTo = filters.dateTo;

        const res = await api.get('/certificates', { params, signal: controller.signal });
        setCertificates(res.data.certificates || []);
        setTotalPages(res.data.pagination.totalPages);
        setTotal(res.data.pagination.total);
      } catch (err) {
        if (controller.signal.aborted || err.code === 'ERR_CANCELED') return;
        toast.error('Failed to fetch certificates');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [page, sortBy, sortOrder, filters]);

  // Bump to force a refetch after a mutation, without duplicating fetch logic.
  const refetch = useCallback(() => setFilters((f) => ({ ...f })), []);

  const applyFilters = () => {
    setPage(1);
    setFilters({ ...draft });
  };

  const clearFilters = () => {
    setPage(1);
    setDraft({ search: '', dateFrom: '', dateTo: '' });
    setFilters({ search: '', dateFrom: '', dateTo: '' });
  };

  const hasActiveFilters = Boolean(filters.search || filters.dateFrom || filters.dateTo);

  // Opens the confirmation dialog. The request itself only goes out from
  // confirmDelete, once the user has explicitly agreed.
  const handleDelete = (cert) => setDeleteTarget(cert);

  const confirmDelete = async () => {
    if (!deleteTarget || deletingRef.current) return;

    deletingRef.current = true;
    setDeleting(true);

    try {
      // Resolves only after the backend has committed the delete and verified
      // the row is gone — a 2xx here means it is really out of the database.
      await api.delete(`/certificates/${deleteTarget.id}`);

      toast.success(`${deleteTarget.cert_no} permanently deleted`);
      setDeleteTarget(null);

      // Deleting the only row of a later page would otherwise strand the user
      // on an empty page; stepping back also refetches.
      if (certificates.length === 1 && page > 1) setPage((p) => p - 1);
      else refetch();
    } catch (err) {
      // Surface the real backend error rather than a generic string.
      toast.error(
        err.response?.data?.error || err.message || 'Failed to delete certificate'
      );
    } finally {
      deletingRef.current = false;
      setDeleting(false);
    }
  };

  const handleDuplicate = async (cert) => {
    try {
      const res = await api.post(`/certificates/${cert.id}/duplicate`);
      toast.success(`Duplicated as ${res.data.cert_no}`);
      refetch();
    } catch {
      toast.error('Failed to duplicate');
    }
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPage(1);
  };

  const ariaSort = (field) =>
    sortBy === field ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none';

  const SortIcon = ({ field }) => {
    if (sortBy !== field) return <i className="ph ph-arrows-down-up text-xs text-slate-400" aria-hidden="true" />;
    return (
      <i
        className={`ph ${sortOrder === 'asc' ? 'ph-sort-ascending' : 'ph-sort-descending'} text-xs text-primary-500`}
        aria-hidden="true"
      />
    );
  };

  const RowActions = ({ cert, className = '' }) => (
    <div className={`flex items-center gap-1 ${className}`}>
      <button
        type="button"
        onClick={() => navigate(certRoute(cert))}
        aria-label={`Edit certificate ${cert.cert_no}`}
        title="Edit"
        className="icon-btn text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30"
      >
        <i className="ph ph-pencil-simple text-base" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => handleDuplicate(cert)}
        aria-label={`Duplicate certificate ${cert.cert_no}`}
        title="Duplicate"
        className="icon-btn text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/30"
      >
        <i className="ph ph-copy text-base" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => handleDelete(cert)}
        aria-label={`Delete certificate ${cert.cert_no}`}
        title="Delete"
        className="icon-btn text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30"
      >
        <i className="ph ph-trash text-base" aria-hidden="true" />
      </button>
    </div>
  );

  const Spinner = ({ label }) => (
    <div className="flex items-center justify-center gap-3 py-12">
      <div
        className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin motion-reduce:animate-none"
        role="status"
        aria-label={label}
      />
      <span className="text-slate-500 dark:text-gray-400">Loading...</span>
    </div>
  );

  const EmptyState = () => (
    <div className="text-center py-12 text-slate-400 dark:text-gray-500">
      <i className="ph ph-folder-open text-4xl mb-2 block" aria-hidden="true" />
      No certificates found
      {hasActiveFilters && (
        <button type="button" onClick={clearFilters} className="block mx-auto mt-3 text-xs text-primary-600 dark:text-primary-400 hover:underline font-medium">
          Clear filters
        </button>
      )}
    </div>
  );

  return (
    <div className="page-enter max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <i className="ph ph-clock-counter-clockwise text-primary-500 shrink-0" aria-hidden="true" />
            <span className="truncate">Certificate History</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-gray-400 mt-1 tabular-nums">{total} total records</p>
        </div>
        <button
          type="button"
          onClick={() => setShowTypeModal(true)}
          className="glass-btn-primary w-full sm:w-auto shrink-0"
        >
          <i className="ph ph-plus" aria-hidden="true" /> New Certificate
        </button>
      </div>

      {/* Search & Filters — the date inputs were hardcoded w-36 (144px each),
          which alone overflowed a 320px viewport. Now a fluid grid. */}
      <div className="glass-card p-3 sm:p-4 mb-6">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3">
          <div className="flex gap-2 min-w-0">
            <label htmlFor="history-search" className="sr-only">Search certificates</label>
            <input
              id="history-search"
              type="search"
              value={draft.search}
              onChange={(e) => setDraft((d) => ({ ...d, search: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') applyFilters(); }}
              placeholder="Search cert no, borrower, account..."
              className="glass-input flex-1 min-w-0"
            />
            <button
              type="button"
              onClick={applyFilters}
              aria-label="Search certificates"
              className="glass-btn-primary px-4 shrink-0"
            >
              <i className="ph ph-magnifying-glass" aria-hidden="true" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_auto_auto] gap-2 min-w-0">
            <div className="min-w-0">
              <label htmlFor="history-from" className="sr-only">From date</label>
              <input
                id="history-from"
                type="date"
                value={draft.dateFrom}
                onChange={(e) => setDraft((d) => ({ ...d, dateFrom: e.target.value }))}
                className="glass-input w-full min-w-0 text-sm"
              />
            </div>
            <div className="min-w-0">
              <label htmlFor="history-to" className="sr-only">To date</label>
              <input
                id="history-to"
                type="date"
                value={draft.dateTo}
                onChange={(e) => setDraft((d) => ({ ...d, dateTo: e.target.value }))}
                className="glass-input w-full min-w-0 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={applyFilters}
              className="glass-btn-secondary col-span-2 sm:col-span-1 px-4 text-xs shrink-0"
            >
              Filter
            </button>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="glass-btn-secondary col-span-2 sm:col-span-1 px-4 text-xs shrink-0"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        {/* ===== MOBILE: card list (no horizontal scrolling) ===== */}
        <div className="md:hidden">
          {loading ? (
            <Spinner label="Loading certificates" />
          ) : certificates.length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-gray-800">
              {certificates.map((cert) => (
                <li key={cert.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => navigate(certRoute(cert))}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="text-sm font-bold text-primary-600 dark:text-primary-400 truncate">
                        {cert.cert_no}
                      </p>
                      <p className="text-sm font-semibold text-slate-800 dark:text-white truncate mt-0.5">
                        {cert.borrower_name}
                      </p>
                      {cert.father_name && (
                        <p className="text-[11px] text-slate-400 truncate">
                          {cert.relation_type} {cert.father_name}
                        </p>
                      )}
                    </button>
                    <p className="text-sm font-bold text-emerald-600 tabular-nums shrink-0">
                      ₹{formatCurrency(cert.grand_total)}
                    </p>
                  </div>

                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <div className="min-w-0">
                      <dt className="text-slate-400 uppercase text-[10px] tracking-wider">Date</dt>
                      <dd className="text-slate-600 dark:text-gray-300 tabular-nums truncate">{cert.cert_date}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-slate-400 uppercase text-[10px] tracking-wider">Bank</dt>
                      <dd className="text-slate-600 dark:text-gray-300 truncate">{cert.bank_name}</dd>
                    </div>
                  </dl>

                  <RowActions cert={cert} className="mt-2 -ml-2" />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ===== TABLET / DESKTOP: table with sticky header ===== */}
        <div className="hidden md:block overflow-x-auto max-h-[70vh] overflow-y-auto">
          <table className="w-full table-sticky-head">
            <thead>
              <tr className="border-b border-slate-200 dark:border-gray-700">
                {SORTABLE.map(({ field, label, align, rtl }) => (
                  <th
                    key={label}
                    scope="col"
                    aria-sort={field ? ariaSort(field) : undefined}
                    className={`px-4 py-3 ${align} text-xs font-bold text-slate-600 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap`}
                  >
                    {field ? (
                      // Was <th onClick> — unreachable by keyboard and invisible
                      // to assistive tech. Now a real button with aria-sort above.
                      <button
                        type="button"
                        onClick={() => handleSort(field)}
                        className={`inline-flex items-center gap-1 hover:text-primary-600 rounded ${rtl ? 'flex-row-reverse' : ''}`}
                      >
                        {label} <SortIcon field={field} />
                      </button>
                    ) : (
                      label
                    )}
                  </th>
                ))}
                <th scope="col" className="px-4 py-3 text-center text-xs font-bold text-slate-600 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
              {loading ? (
                <tr><td colSpan="6"><Spinner label="Loading certificates" /></td></tr>
              ) : certificates.length === 0 ? (
                <tr><td colSpan="6"><EmptyState /></td></tr>
              ) : certificates.map((cert) => (
                <tr key={cert.id} className="hover:bg-slate-50 dark:hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-sm font-bold text-primary-600 dark:text-primary-400">{cert.cert_no}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-gray-300 tabular-nums whitespace-nowrap">{cert.cert_date}</td>
                  <td className="px-4 py-3 max-w-[220px]">
                    <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{cert.borrower_name}</p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {cert.father_name ? `${cert.relation_type} ${cert.father_name}` : ''}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 dark:text-gray-400 max-w-[180px]">
                    <span className="block truncate">{cert.bank_name}</span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <span className="text-sm font-bold text-emerald-600 tabular-nums">₹{formatCurrency(cert.grand_total)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <RowActions cert={cert} className="justify-center" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <nav
            aria-label="Certificate pages"
            className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 dark:border-gray-700"
          >
            <p className="text-xs text-slate-500 dark:text-gray-400 tabular-nums order-2 sm:order-1">
              Page {page} of {totalPages} ({total} records)
            </p>
            <div className="flex flex-wrap items-center justify-center gap-1 order-1 sm:order-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-2 text-xs font-medium rounded-lg bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-gray-300 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <i className="ph ph-caret-left" aria-hidden="true" /> Prev
              </button>

              {/* Page numbers are noise on the narrowest screens where Prev/Next
                  already do the job — hidden below xs rather than wrapped. */}
              <span className="hidden xs:flex gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                  const p = start + i;
                  if (p > totalPages) return null;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPage(p)}
                      aria-current={p === page ? 'page' : undefined}
                      aria-label={`Page ${p}`}
                      className={`px-3 py-2 text-xs font-medium rounded-lg tabular-nums transition-colors ${
                        p === page
                          ? 'bg-primary-600 text-white'
                          : 'bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-gray-300 hover:bg-slate-200'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </span>

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-2 text-xs font-medium rounded-lg bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-gray-300 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next <i className="ph ph-caret-right" aria-hidden="true" />
              </button>
            </div>
          </nav>
        )}
      </div>

      {/* ===== Permanent-delete confirmation ===== */}
      {deleteTarget && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={closeDelete}
        >
          <div
            ref={deleteDialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={deleteTitleId}
            tabIndex={-1}
            className="bg-white dark:bg-gray-900 rounded-2xl p-5 sm:p-6 max-w-sm w-full shadow-2xl animate-fade-in focus:outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id={deleteTitleId}
              className="text-base sm:text-lg font-bold text-slate-800 dark:text-white mb-1 flex items-center gap-2"
            >
              <i className="ph ph-warning-circle text-red-500 shrink-0" aria-hidden="true" />
              Delete certificate?
            </h3>

            <p className="text-sm text-slate-600 dark:text-gray-300 mt-3">
              <span className="font-bold text-primary-600 dark:text-primary-400">
                {deleteTarget.cert_no}
              </span>{' '}
              — {deleteTarget.borrower_name}
            </p>

            <p className="text-xs text-red-600 dark:text-red-400 mt-3 font-medium">
              This action will permanently delete the certificate and cannot be undone.
            </p>
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
              The certificate and all of its items will be erased from the database.
            </p>

            <div className="flex gap-2 mt-5">
              <button
                type="button"
                onClick={closeDelete}
                disabled={deleting}
                className="glass-btn-secondary flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <>
                    <span
                      className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                    Deleting...
                  </>
                ) : (
                  <>
                    <i className="ph ph-trash" aria-hidden="true" /> Delete permanently
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTypeModal && (
        <CertificateTypeModal onClose={() => setShowTypeModal(false)} />
      )}
    </div>
  );
}
