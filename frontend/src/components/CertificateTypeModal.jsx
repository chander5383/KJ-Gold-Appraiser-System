import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * CertificateTypeModal
 * Shown when the user clicks "New Certificate" from the Dashboard or History page.
 * Lets them choose between Standard and Simple before navigating.
 *
 * Props:
 *   onClose — called when the modal should close (Escape, backdrop, Cancel, or after selection)
 */
export default function CertificateTypeModal({ onClose }) {
  const navigate = useNavigate();
  const panelRef = useRef(null);

  // Focus the panel on mount so Escape is captured immediately
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const select = (path) => {
    onClose();
    navigate(path);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cert-type-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="bg-slate-900 backdrop-blur-xl border border-white/20 shadow-xl rounded-2xl w-full max-w-md p-6 sm:p-8 relative focus:outline-none"
      >
        {/* Close × */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <i className="ph ph-x text-lg" aria-hidden="true" />
        </button>

        {/* Header */}
        <div className="mb-6 pr-8">
          <h2 id="cert-type-title" className="text-xl font-bold text-white">
            Choose Certificate Type
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Select the type of certificate you want to create.
          </p>
        </div>

        {/* Options */}
        <div className="space-y-3 mb-5">
          {/* Standard Certificate */}
          <button
            type="button"
            onClick={() => select('/certificate')}
            className="w-full flex items-center gap-4 p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-primary-500/50 transition-all group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <div className="w-12 h-12 shrink-0 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/20 group-hover:shadow-primary-500/40 transition-shadow">
              <i className="ph ph-certificate text-2xl text-white" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white">Standard Certificate</p>
              <p className="text-xs text-slate-400 mt-0.5">Create a detailed gold appraisal certificate</p>
            </div>
            <i className="ph ph-arrow-right text-lg text-slate-500 group-hover:text-primary-400 shrink-0 transition-colors" aria-hidden="true" />
          </button>

          {/* Simple Certificate */}
          <button
            type="button"
            onClick={() => select('/certificate-simple')}
            className="w-full flex items-center gap-4 p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-amber-500/50 transition-all group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          >
            <div className="w-12 h-12 shrink-0 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:shadow-amber-500/40 transition-shadow">
              <i className="ph ph-file-text text-2xl text-white" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white">Simple Certificate</p>
              <p className="text-xs text-slate-400 mt-0.5">Create a simple gold appraisal certificate</p>
            </div>
            <i className="ph ph-arrow-right text-lg text-slate-500 group-hover:text-amber-400 shrink-0 transition-colors" aria-hidden="true" />
          </button>
        </div>

        {/* Cancel */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
