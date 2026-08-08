import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../utils/calculations';
import CertificateTypeModal from '../components/CertificateTypeModal';

// Hoisted to module scope — these are constant, but were being rebuilt on every
// render (and the two lookup maps re-allocated once per activity row).
const ACTION_ICONS = {
  CREATE: 'ph-plus-circle',
  UPDATE: 'ph-pencil-simple',
  DELETE: 'ph-trash',
  LOGIN: 'ph-sign-in',
  CHANGE_PASSWORD: 'ph-key',
  CREATE_USER: 'ph-user-plus',
  RESET_PASSWORD: 'ph-lock-key-open',
  UPDATE_SETTINGS: 'ph-gear-six',
};

const ACTION_COLORS = {
  CREATE: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/30',
  UPDATE: 'text-blue-500 bg-blue-50 dark:bg-blue-900/30',
  DELETE: 'text-red-500 bg-red-50 dark:bg-red-900/30',
  LOGIN: 'text-primary-500 bg-primary-50 dark:bg-primary-900/30',
};

const getActionIcon = (action) => ACTION_ICONS[action] || 'ph-info';
const getActionColor = (action) =>
  ACTION_COLORS[action] || 'text-slate-500 bg-slate-50 dark:bg-slate-800';

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [stats, setStats] = useState({
    todayCertificates: 0,
    totalCertificates: 0,
    todayGoldValue: 0,
    monthlyCertificates: 0
  });
  const [recentCerts, setRecentCerts] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // AbortController: React 18 StrictMode double-invokes effects, which fired two
  // identical /dashboard/stats requests on every mount. It also prevents a
  // late response from writing state after unmount.
  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        const res = await api.get('/dashboard/stats', { signal: controller.signal });
        setStats(res.data.stats);
        setRecentCerts(res.data.recentCertificates || []);
        setRecentActivity(res.data.recentActivity || []);
        setLoadError(null);
      } catch (err) {
        if (controller.signal.aborted || err.code === 'ERR_CANCELED') return;
        setLoadError('Could not load dashboard data.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, []);

  const statCards = useMemo(() => [
    {
      label: "Today's Certificates",
      value: stats.todayCertificates,
      icon: 'ph-certificate',
      gradient: 'from-blue-500 to-blue-600',
      bgGlow: 'bg-blue-500',
    },
    {
      label: 'Total Certificates',
      value: stats.totalCertificates,
      icon: 'ph-stack',
      gradient: 'from-primary-500 to-primary-600',
      bgGlow: 'bg-primary-500',
    },
    {
      label: "Today's Gold Value",
      value: `₹${formatCurrency(stats.todayGoldValue) === '-' ? '0' : formatCurrency(stats.todayGoldValue)}`,
      icon: 'ph-currency-inr',
      gradient: 'from-amber-500 to-yellow-500',
      bgGlow: 'bg-amber-500',
    },
    {
      label: 'Monthly Certificates',
      value: stats.monthlyCertificates,
      icon: 'ph-calendar-check',
      gradient: 'from-emerald-500 to-teal-500',
      bgGlow: 'bg-emerald-500',
    },
  ], [stats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div
          className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin motion-reduce:animate-none"
          role="status"
          aria-label="Loading dashboard"
        />
      </div>
    );
  }

  return (
    <div className="page-enter max-w-7xl mx-auto">
      {/* Welcome Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-800 dark:text-white">
          Welcome back, <span className="text-primary-600 dark:text-primary-400">{user?.full_name || 'User'}</span>
        </h1>
        <p className="text-slate-500 dark:text-gray-400 mt-1 text-xs sm:text-sm">Here's your business overview for today</p>
      </div>

      {loadError && (
        <div role="alert" className="mb-6 glass-card p-4 border-l-4 border-l-red-500 flex items-start gap-3">
          <i className="ph ph-warning-circle text-xl text-red-500 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 dark:text-white">{loadError}</p>
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
              Showing zeros. Reload the page to try again.
            </p>
          </div>
        </div>
      )}

      {/* Stat Cards — 1 col mobile, 2 tablet, 4 desktop */}
      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6 sm:mb-8">
        {statCards.map((card, i) => (
          <div
            key={card.label}
            className={`glass-card p-4 sm:p-5 relative overflow-hidden animate-slide-up stagger-${i + 1} group hover:scale-[1.02] transition-all duration-300 motion-reduce:transition-none cursor-default`}
          >
            <div className={`absolute -top-6 -right-6 w-24 h-24 ${card.bgGlow} rounded-full opacity-10 group-hover:opacity-20 transition-opacity`} aria-hidden="true"></div>
            <div className="relative z-10 min-w-0">
              <div className={`w-10 h-10 sm:w-11 sm:h-11 bg-gradient-to-br ${card.gradient} rounded-xl flex items-center justify-center shadow-lg mb-3`}>
                <i className={`ph ${card.icon} text-lg sm:text-xl text-white`} aria-hidden="true"></i>
              </div>
              {/* Large currency values (e.g. ₹1,23,45,678) previously overflowed
                  the card at 320px. Scales down and wraps instead. */}
              <p className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white tabular-nums break-words leading-tight">
                {card.value}
              </p>
              <p className="text-[10px] sm:text-xs font-medium text-slate-500 dark:text-gray-400 mt-1 uppercase tracking-wider">{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions — 1 col mobile, 2 tablet, 3 desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 sm:mb-8">
        {[
          { key: 'new',      icon: 'ph-plus',                    grad: 'from-primary-500 to-primary-600', title: 'New Certificate', sub: 'Create a new appraisal',   onClick: () => setShowTypeModal(true) },
          { key: 'history',  icon: 'ph-clock-counter-clockwise', grad: 'from-amber-500 to-yellow-500',   title: 'View History',     sub: 'Browse all records',       onClick: () => navigate('/history') },
          { key: 'settings', icon: 'ph-gear-six',                grad: 'from-slate-600 to-slate-700',    title: 'Settings',         sub: 'Configure your shop',      onClick: () => navigate('/settings') },
        ].map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={a.onClick}
            className="glass-card p-4 sm:p-5 hover:scale-[1.02] transition-all duration-300 motion-reduce:transition-none flex items-center gap-4 group text-left"
          >
            <div className={`w-11 h-11 sm:w-12 sm:h-12 shrink-0 bg-gradient-to-br ${a.grad} rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow`}>
              <i className={`ph ${a.icon} text-xl sm:text-2xl text-white`} aria-hidden="true"></i>
            </div>
            <div className="min-w-0">
              <p className="font-bold text-slate-800 dark:text-white truncate">{a.title}</p>
              <p className="text-xs text-slate-500 dark:text-gray-400 truncate">{a.sub}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Recent Certificates */}
        <div className="glass-card p-4 sm:p-6 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2 min-w-0">
              <i className="ph ph-certificate text-primary-500 shrink-0" aria-hidden="true"></i>
              <span className="truncate">Recent Certificates</span>
            </h2>
            <button
              type="button"
              onClick={() => navigate('/history')}
              className="text-xs text-primary-600 dark:text-primary-400 hover:underline font-medium shrink-0 min-h-[44px] sm:min-h-0 px-2 -mr-2 rounded-lg"
            >
              View All →
            </button>
          </div>

          {recentCerts.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-gray-500 text-center py-8">No certificates yet</p>
          ) : (
            <ul className="space-y-3">
              {recentCerts.map(cert => (
                <li key={cert.id}>
                  {/* Was a clickable <div> — keyboard users could not reach it. */}
                  <button
                    type="button"
                    onClick={() => navigate(`/certificate/${cert.id}`)}
                    className="w-full flex items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-gray-800/50 rounded-xl hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors text-left"
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <span className="w-9 h-9 shrink-0 bg-primary-100 dark:bg-primary-900/40 rounded-lg flex items-center justify-center">
                        <i className="ph ph-file-text text-primary-600 dark:text-primary-400" aria-hidden="true"></i>
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-slate-800 dark:text-white truncate">{cert.cert_no}</span>
                        <span className="block text-xs text-slate-500 dark:text-gray-400 truncate">{cert.borrower_name}</span>
                      </span>
                    </span>
                    <span className="text-right shrink-0">
                      <span className="block text-sm font-bold text-emerald-600 tabular-nums">₹{formatCurrency(cert.grand_total)}</span>
                      <span className="block text-[10px] text-slate-400 tabular-nums">{cert.cert_date}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent Activity */}
        <div className="glass-card p-4 sm:p-6 min-w-0">
          <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
            <i className="ph ph-clock text-amber-500 shrink-0" aria-hidden="true"></i>
            <span className="truncate">Recent Activity</span>
          </h2>

          {recentActivity.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-gray-500 text-center py-8">No activity yet</p>
          ) : (
            <ul className="space-y-3">
              {recentActivity.slice(0, 8).map(log => (
                <li key={log.id} className="flex items-start gap-3 p-2">
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${getActionColor(log.action)}`}>
                    <i className={`ph ${getActionIcon(log.action)} text-base`} aria-hidden="true"></i>
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-medium text-slate-700 dark:text-gray-200">
                      <span className="font-bold">{log.users?.full_name || 'System'}</span>
                      {' '}{log.action.toLowerCase().replace(/_/g, ' ')}
                      {log.entity_type === 'certificate' && log.details?.cert_no && (
                        <span className="text-primary-600 dark:text-primary-400 font-bold"> {log.details.cert_no}</span>
                      )}
                    </span>
                    <time
                      dateTime={log.created_at}
                      className="block text-[10px] text-slate-400 mt-0.5 tabular-nums"
                    >
                      {new Date(log.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                    </time>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {showTypeModal && (
        <CertificateTypeModal onClose={() => setShowTypeModal(false)} />
      )}
    </div>
  );
}
