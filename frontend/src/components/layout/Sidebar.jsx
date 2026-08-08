import { useState, useEffect, useCallback, useId } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useShop } from '../../contexts/SettingsContext';
import { useDialog } from '../../hooks/useDialog';

const navItems = [
  { path: '/',                    label: 'Dashboard',          icon: 'ph-squares-four' },
  { path: '/certificate',         label: 'Standard Certificate', icon: 'ph-certificate' },
  { path: '/certificate-simple',  label: 'Simple Certificate',   icon: 'ph-file-text' },
  { path: '/history',             label: 'Certificate History',  icon: 'ph-clock-counter-clockwise' },
  { path: '/admin',               label: 'Admin Panel',        icon: 'ph-shield-check', adminOnly: true },
  { path: '/settings',            label: 'Settings',           icon: 'ph-gear-six' },
];

/**
 * Three responsive tiers, per the brief:
 *   < md   (mobile)  — off-canvas drawer behind a toggle + scrim
 *   md–lg  (tablet)  — permanent collapsed icon rail (5rem), expands over the
 *                      content on demand
 *   ≥ lg   (desktop) — permanent full sidebar (16rem)
 *
 * On tablet the expanded state overlays rather than reflows, so the main
 * content never has to re-layout mid-interaction.
 */
export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const { user, logout, isAdmin } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const shop = useShop();
  const navigate = useNavigate();
  const location = useLocation();
  const navId = useId();

  const close = useCallback(() => setIsOpen(false), []);
  const dialogRef = useDialog(isOpen, close);

  // Close on navigation — including browser back/forward, which the previous
  // onClick-only approach missed, leaving the drawer stranded open.
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const filteredItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <>
      {/* Floating drawer toggle — MOBILE ONLY. On tablet the rail is already
          visible, so a floating button here would sit on top of it. */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={isOpen}
        aria-controls={navId}
        className="fixed top-4 left-4 z-[60] md:hidden no-print bg-slate-800 text-white w-11 h-11 flex items-center justify-center rounded-xl shadow-lg hover:bg-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
      >
        <i className={`ph ${isOpen ? 'ph-x' : 'ph-list'} text-xl`} aria-hidden="true" />
      </button>

      {/* Scrim */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden no-print motion-safe:animate-fade-in"
          onClick={close}
          aria-hidden="true"
        />
      )}

      <aside
        ref={dialogRef}
        id={navId}
        aria-label="Main navigation"
        tabIndex={-1}
        className={`
          fixed top-0 left-0 h-full z-50 no-print glass-sidebar
          w-64 md:w-20 lg:w-64
          ${isOpen ? 'md:w-64' : ''}
          transform transition-[transform,width] duration-300 ease-in-out motion-reduce:transition-none
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
          focus:outline-none
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 md:p-4 lg:p-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 shrink-0 bg-gradient-to-br from-amber-400 to-yellow-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/30">
                <i className="ph ph-diamond text-xl text-white" aria-hidden="true" />
              </div>
              <div className={`min-w-0 ${isOpen ? '' : 'md:hidden'} lg:block`}>
                {/* Live shop name from the Settings store — renames propagate
                    here the moment they are saved. */}
                <h1 className="text-lg font-bold text-white tracking-wide truncate" title={shop.shop_name}>
                  {shop.shop_name ? shop.shop_name.split(' ').filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase() : '...'}
                </h1>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-medium truncate">
                  Appraiser System
                </p>
              </div>
            </div>

            {/* Rail expand/collapse — TABLET ONLY (md–lg). Mobile uses the
                floating toggle; desktop is permanently expanded. */}
            <button
              type="button"
              onClick={() => setIsOpen((v) => !v)}
              aria-label={isOpen ? 'Collapse navigation' : 'Expand navigation'}
              aria-expanded={isOpen}
              aria-controls={navId}
              className="hidden md:flex lg:hidden mt-3 w-full h-9 items-center justify-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              <i
                className={`ph ${isOpen ? 'ph-caret-double-left' : 'ph-caret-double-right'} text-lg`}
                aria-hidden="true"
              />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto overscroll-contain">
            {filteredItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                onClick={close}
                title={item.label}
                className={({ isActive }) => `
                  flex items-center gap-3 px-4 md:px-3 lg:px-4 py-3 rounded-xl text-sm font-medium
                  transition-all duration-200 motion-reduce:transition-none
                  ${isOpen ? '' : 'md:justify-center lg:justify-start'}
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70
                  ${isActive
                    ? 'bg-white/15 text-white shadow-lg shadow-white/5'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }
                `}
              >
                <i className={`ph ${item.icon} text-lg shrink-0`} aria-hidden="true" />
                <span className={`truncate ${isOpen ? '' : 'md:hidden'} lg:inline`}>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-white/10 space-y-3">
            <button
              type="button"
              onClick={toggleTheme}
              aria-pressed={isDark}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className={`w-full flex items-center gap-3 px-4 md:px-2 lg:px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-white transition-all motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${isOpen ? '' : 'md:justify-center lg:justify-start'}`}
            >
              <i className={`ph ${isDark ? 'ph-sun' : 'ph-moon'} text-lg shrink-0`} aria-hidden="true" />
              <span className={`truncate ${isOpen ? '' : 'md:hidden'} lg:inline`}>
                {isDark ? 'Light Mode' : 'Dark Mode'}
              </span>
            </button>

            <div className={`flex items-center gap-3 px-4 md:px-2 lg:px-4 py-3 bg-white/5 rounded-xl ${isOpen ? '' : 'md:justify-center lg:justify-start'}`}>
              <div className="w-9 h-9 shrink-0 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center text-white text-sm font-bold">
                {user?.full_name?.charAt(0) || 'U'}
              </div>
              <div className={`flex-1 min-w-0 ${isOpen ? '' : 'md:hidden'} lg:block`}>
                <p className="text-sm font-semibold text-white truncate">{user?.full_name || 'User'}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider truncate">
                  {user?.role || 'user'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Log out"
                title="Logout"
                className={`text-slate-400 hover:text-red-400 transition-colors w-11 h-11 -my-1 flex items-center justify-center rounded-lg shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 ${isOpen ? '' : 'md:hidden'} lg:flex`}
              >
                <i className="ph ph-sign-out text-lg" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
