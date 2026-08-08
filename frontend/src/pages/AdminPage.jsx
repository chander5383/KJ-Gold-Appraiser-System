import { useState, useEffect, useCallback, useId } from 'react';
import toast from 'react-hot-toast';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useDialog } from '../hooks/useDialog';

const TABS = [
  { id: 'users', label: 'Users', icon: 'ph-users' },
  { id: 'logs', label: 'Activity Logs', icon: 'ph-list-bullets' },
];

export default function AdminPage() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [logPage, setLogPage] = useState(1);
  const [logTotalPages, setLogTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  // New user form
  const [showNewUser, setShowNewUser] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', full_name: '', role: 'user' });

  // Reset password modal
  const [resetUser, setResetUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  const modalTitleId = useId();
  const closeReset = useCallback(() => {
    setResetUser(null);
    setNewPassword('');
  }, []);
  const modalRef = useDialog(Boolean(resetUser), closeReset);

  const refetch = useCallback(() => setReloadKey((k) => k + 1), []);

  // Split per tab. The previous single effect was keyed [tab, logPage], so
  // paging the activity log also refetched the entire user list.
  useEffect(() => {
    if (!isAdmin || tab !== 'users') return undefined;
    const controller = new AbortController();
    setLoading(true);

    (async () => {
      try {
        const res = await api.get('/admin/users', { signal: controller.signal });
        setUsers(res.data.users || []);
      } catch (err) {
        if (controller.signal.aborted || err.code === 'ERR_CANCELED') return;
        toast.error('Failed to fetch users');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [isAdmin, tab, reloadKey]);

  useEffect(() => {
    if (!isAdmin || tab !== 'logs') return undefined;
    const controller = new AbortController();
    setLoading(true);

    (async () => {
      try {
        const res = await api.get('/admin/activity-logs', {
          params: { page: logPage, limit: 30 },
          signal: controller.signal,
        });
        setLogs(res.data.logs || []);
        setLogTotalPages(res.data.pagination.totalPages);
      } catch (err) {
        if (controller.signal.aborted || err.code === 'ERR_CANCELED') return;
        toast.error('Failed to fetch logs');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [isAdmin, tab, logPage]);

  const handleCreateUser = async () => {
    if (!newUser.username || !newUser.password || !newUser.full_name) {
      toast.error('All fields are required');
      return;
    }
    try {
      await api.post('/admin/users', newUser);
      toast.success('User created');
      setShowNewUser(false);
      setNewUser({ username: '', password: '', full_name: '', role: 'user' });
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create user');
    }
  };

  const handleToggleActive = async (user) => {
    try {
      await api.put(`/admin/users/${user.id}`, { is_active: !user.is_active });
      toast.success(`${user.username} ${user.is_active ? 'deactivated' : 'activated'}`);
      refetch();
    } catch { toast.error('Failed to update user'); }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    try {
      await api.post(`/admin/users/${resetUser.id}/reset-password`, { newPassword });
      toast.success('Password reset successfully');
      closeReset();
    } catch { toast.error('Failed to reset password'); }
  };

  if (!isAdmin) {
    return (
      <div className="page-enter flex items-center justify-center h-64">
        <div className="text-center px-4">
          <i className="ph ph-shield-warning text-5xl text-red-400 mb-3 block" aria-hidden="true" />
          <h2 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-white">Access Denied</h2>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">Admin privileges required</p>
        </div>
      </div>
    );
  }

  const UserActions = ({ u, className = '' }) => (
    <div className={`flex items-center gap-1 ${className}`}>
      <button
        type="button"
        onClick={() => handleToggleActive(u)}
        aria-label={`${u.is_active ? 'Deactivate' : 'Activate'} ${u.username}`}
        title={u.is_active ? 'Deactivate' : 'Activate'}
        className={`icon-btn ${u.is_active
          ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30'
          : 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/30'}`}
      >
        <i className={`ph ${u.is_active ? 'ph-user-minus' : 'ph-user-plus'} text-base`} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => { setResetUser(u); setNewPassword(''); }}
        aria-label={`Reset password for ${u.username}`}
        title="Reset Password"
        className="icon-btn text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/30"
      >
        <i className="ph ph-key text-base" aria-hidden="true" />
      </button>
    </div>
  );

  const Avatar = ({ u }) => (
    <span className="w-9 h-9 shrink-0 bg-gradient-to-br from-primary-400 to-primary-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
      {u.full_name?.charAt(0) || 'U'}
    </span>
  );

  const RoleBadge = ({ role }) => (
    <span className={`inline-block text-xs font-bold uppercase px-2 py-1 rounded-md ${
      role === 'admin'
        ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
        : 'bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-gray-400'}`}>
      {role}
    </span>
  );

  const StatusBadge = ({ active }) => (
    <span className={`inline-block text-xs font-bold px-2 py-1 rounded-md ${
      active
        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>
      {active ? 'Active' : 'Inactive'}
    </span>
  );

  return (
    <div className="page-enter max-w-6xl mx-auto">
      <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
        <i className="ph ph-shield-check text-primary-500 shrink-0" aria-hidden="true" />
        <span className="truncate">Admin Panel</span>
      </h1>

      {/* Tabs */}
      <div role="tablist" aria-label="Admin sections" className="flex gap-1 mb-6 bg-slate-100 dark:bg-gray-800 rounded-xl p-1 w-full sm:w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`flex-1 sm:flex-none px-3 sm:px-4 py-2.5 rounded-lg text-xs sm:text-sm font-medium flex items-center justify-center gap-2 transition-all
              ${tab === t.id
                ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm'
                : 'text-slate-500 dark:text-gray-400 hover:text-slate-700'}`}
          >
            <i className={`ph ${t.icon}`} aria-hidden="true" /> {t.label}
          </button>
        ))}
      </div>

      {/* ===== USERS TAB ===== */}
      {tab === 'users' && (
        <div role="tabpanel" id="panel-users" aria-labelledby="tab-users" className="glass-card p-4 sm:p-6">
          <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-3 mb-4">
            <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white">Manage Users</h2>
            <button
              type="button"
              onClick={() => setShowNewUser((v) => !v)}
              aria-expanded={showNewUser}
              className="glass-btn-primary text-xs w-full xs:w-auto shrink-0"
            >
              <i className="ph ph-user-plus" aria-hidden="true" /> Add User
            </button>
          </div>

          {/* New User Form */}
          {showNewUser && (
            <div className="bg-slate-50 dark:bg-gray-800/50 rounded-xl p-4 mb-4 border border-slate-200 dark:border-gray-700 animate-slide-up">
              <h3 className="text-sm font-bold text-slate-700 dark:text-gray-200 mb-3">Create New User</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="nu-username" className="sr-only">Username</label>
                  <input id="nu-username" type="text" autoComplete="off" placeholder="Username" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} className="glass-input text-sm" />
                </div>
                <div>
                  <label htmlFor="nu-password" className="sr-only">Password</label>
                  <input id="nu-password" type="password" autoComplete="new-password" placeholder="Password (min 6 chars)" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} className="glass-input text-sm" />
                </div>
                <div>
                  <label htmlFor="nu-fullname" className="sr-only">Full name</label>
                  <input id="nu-fullname" type="text" autoComplete="off" placeholder="Full Name" value={newUser.full_name} onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })} className="glass-input text-sm" />
                </div>
                <div>
                  <label htmlFor="nu-role" className="sr-only">Role</label>
                  <select id="nu-role" value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })} className="glass-input text-sm">
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-col xs:flex-row gap-2 mt-3">
                <button type="button" onClick={handleCreateUser} className="glass-btn-success text-xs">Create</button>
                <button type="button" onClick={() => setShowNewUser(false)} className="glass-btn-secondary text-xs">Cancel</button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin motion-reduce:animate-none" role="status" aria-label="Loading users" />
            </div>
          ) : (
            <>
              {/* MOBILE: cards */}
              <ul className="md:hidden divide-y divide-slate-100 dark:divide-gray-800">
                {users.map((u) => (
                  <li key={u.id} className="py-3 flex items-start gap-3">
                    <Avatar u={u} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{u.full_name}</p>
                      <p className="text-xs text-slate-400 truncate">@{u.username}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <RoleBadge role={u.role} />
                        <StatusBadge active={u.is_active} />
                      </div>
                    </div>
                    <UserActions u={u} className="shrink-0" />
                  </li>
                ))}
              </ul>

              {/* TABLET / DESKTOP: table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-gray-700">
                      <th scope="col" className="text-left text-xs font-bold text-slate-500 dark:text-gray-400 uppercase py-2 px-3">User</th>
                      <th scope="col" className="text-left text-xs font-bold text-slate-500 dark:text-gray-400 uppercase py-2 px-3">Role</th>
                      <th scope="col" className="text-center text-xs font-bold text-slate-500 dark:text-gray-400 uppercase py-2 px-3">Status</th>
                      <th scope="col" className="text-center text-xs font-bold text-slate-500 dark:text-gray-400 uppercase py-2 px-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-gray-800/30">
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar u={u} />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{u.full_name}</p>
                              <p className="text-xs text-slate-400 truncate">@{u.username}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3"><RoleBadge role={u.role} /></td>
                        <td className="px-3 py-3 text-center"><StatusBadge active={u.is_active} /></td>
                        <td className="px-3 py-3"><UserActions u={u} className="justify-center" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Reset Password Modal */}
          {resetUser && (
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={closeReset}
            >
              <div
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={modalTitleId}
                tabIndex={-1}
                className="bg-white dark:bg-gray-900 rounded-2xl p-5 sm:p-6 max-w-sm w-full shadow-2xl animate-fade-in focus:outline-none"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 id={modalTitleId} className="text-base sm:text-lg font-bold text-slate-800 dark:text-white mb-1 flex items-center gap-2">
                  <i className="ph ph-key text-amber-500" aria-hidden="true" /> Reset Password
                </h3>
                <p className="text-xs text-slate-500 dark:text-gray-400 mb-4 truncate">
                  for <span className="font-semibold">@{resetUser.username}</span>
                </p>

                <label htmlFor="reset-password" className="sr-only">New password</label>
                <input
                  id="reset-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="New Password (min 6 chars)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleResetPassword(); }}
                  className="glass-input mb-4"
                />
                <div className="flex flex-col xs:flex-row gap-2">
                  <button type="button" onClick={handleResetPassword} className="glass-btn-primary flex-1">Reset</button>
                  <button type="button" onClick={closeReset} className="glass-btn-secondary flex-1">Cancel</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== ACTIVITY LOGS TAB ===== */}
      {tab === 'logs' && (
        <div role="tabpanel" id="panel-logs" aria-labelledby="tab-logs" className="glass-card p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white mb-4">Activity Logs</h2>

          <div className="space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin motion-reduce:animate-none" role="status" aria-label="Loading activity logs" />
              </div>
            ) : logs.length === 0 ? (
              <p className="text-center text-slate-400 dark:text-gray-500 py-8">No activity logs</p>
            ) : logs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-gray-800/50 rounded-xl">
                <span className="w-9 h-9 shrink-0 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
                  <i className="ph ph-info text-primary-600 dark:text-primary-400" aria-hidden="true" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-slate-700 dark:text-gray-200">
                    <span className="font-bold">{log.users?.full_name || 'System'}</span> — {log.action}
                    {log.entity_type && <span className="text-slate-400"> ({log.entity_type})</span>}
                    {log.details?.cert_no && <span className="text-primary-600 dark:text-primary-400 font-bold ml-1">{log.details.cert_no}</span>}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5 tabular-nums break-words">
                    {new Date(log.created_at).toLocaleString('en-IN')}{log.ip_address && ` • ${log.ip_address}`}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {logTotalPages > 1 && (
            <nav aria-label="Activity log pages" className="flex items-center justify-center gap-2 mt-4 flex-wrap">
              <button type="button" onClick={() => setLogPage((p) => Math.max(1, p - 1))} disabled={logPage === 1} className="glass-btn-secondary text-xs px-3 disabled:opacity-40 disabled:cursor-not-allowed">Prev</button>
              <span className="text-xs text-slate-500 tabular-nums">Page {logPage} of {logTotalPages}</span>
              <button type="button" onClick={() => setLogPage((p) => Math.min(logTotalPages, p + 1))} disabled={logPage === logTotalPages} className="glass-btn-secondary text-xs px-3 disabled:opacity-40 disabled:cursor-not-allowed">Next</button>
            </nav>
          )}
        </div>
      )}
    </div>
  );
}
