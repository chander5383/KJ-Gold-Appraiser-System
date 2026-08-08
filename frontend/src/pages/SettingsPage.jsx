import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';

// Declared once at module scope; each entry drives a properly <label>-associated
// field. Previously every label was an orphan (no htmlFor / no input id), so the
// inputs had no accessible name at all.
const SHOP_FIELDS = [
  { key: 'shop_name', label: 'Shop Name', autoComplete: 'organization' },
  { key: 'owner_name', label: 'Owner Name', autoComplete: 'name' },
  { key: 'shop_address', label: 'Address', wide: true, autoComplete: 'street-address' },
  { key: 'gstin', label: 'GSTIN' },
  { key: 'pan', label: 'PAN' },
  { key: 'phone', label: 'Phone', type: 'tel', inputMode: 'tel', autoComplete: 'tel' },
  { key: 'cert_prefix', label: 'Certificate Prefix' },
];

export default function SettingsPage() {
  const { isAdmin } = useAuth();

  // The global store owns the persisted values; this page owns only the draft
  // the admin is currently editing. Saving hands the draft to the store, which
  // writes the database and then swaps its state — that single state change is
  // what makes the Certificate page, print view and PDF pick up the new details
  // with no reload, no re-login and no manual refetch.
  const {
    settings: globalSettings,
    loading: settingsLoading,
    error: settingsError,
    save: saveSettings
  } = useSettings();

  const [settings, setSettings] = useState(globalSettings);
  const [saving, setSaving] = useState(false);

  // Change password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPasswordVal, setNewPasswordVal] = useState('');
  const [changingPwd, setChangingPwd] = useState(false);

  // Re-seed the draft whenever the store changes — initial hydration, an
  // explicit refresh, or a save made in another browser tab.
  useEffect(() => {
    setSettings(globalSettings);
  }, [globalSettings]);

  useEffect(() => {
    if (settingsError) toast.error('Failed to load settings');
  }, [settingsError]);

  const handleSave = async () => {
    if (!isAdmin) {
      toast.error('Admin privileges required');
      return;
    }
    setSaving(true);
    try {
      await saveSettings(settings);
      toast.success('Settings saved — applied across the app');
    } catch { toast.error('Failed to save settings'); }
    finally { setSaving(false); }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPasswordVal) {
      toast.error('Both fields are required');
      return;
    }
    if (newPasswordVal.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setChangingPwd(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword,
        newPassword: newPasswordVal
      });
      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPasswordVal('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to change password');
    } finally {
      setChangingPwd(false);
    }
  };

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (settingsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="page-enter max-w-4xl mx-auto">
      <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
        <i className="ph ph-gear-six text-primary-500 shrink-0" aria-hidden="true"></i>
        <span className="truncate">Settings</span>
      </h1>

      {!isAdmin && (
        <div role="status" className="glass-card p-4 mb-6 flex items-start gap-3 border-l-4 border-l-amber-500">
          <i className="ph ph-info text-xl text-amber-500 shrink-0" aria-hidden="true" />
          <p className="text-sm text-slate-600 dark:text-gray-300 min-w-0">
            Shop settings are read-only for your account. Admin privileges are required to change them.
            You can still change your own password below.
          </p>
        </div>
      )}

      <div className="space-y-4 sm:space-y-6">
        {/* Shop Details */}
        <div className="glass-card p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
            <i className="ph ph-storefront text-amber-500 shrink-0" aria-hidden="true"></i> Shop Details
          </h2>

          {/* 1 col mobile → 2 tablet → 3 desktop */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {SHOP_FIELDS.map((f) => (
              <div key={f.key} className={f.wide ? 'sm:col-span-2 lg:col-span-3' : ''}>
                <label htmlFor={`set-${f.key}`} className="block text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                  {f.label}
                </label>
                <input
                  id={`set-${f.key}`}
                  name={f.key}
                  type={f.type || 'text'}
                  inputMode={f.inputMode}
                  autoComplete={f.autoComplete || 'off'}
                  value={settings[f.key] || ''}
                  onChange={(e) => updateSetting(f.key, e.target.value)}
                  className="glass-input"
                  disabled={!isAdmin}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Defaults */}
        <div className="glass-card p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
            <i className="ph ph-sliders text-emerald-500 shrink-0" aria-hidden="true"></i> Defaults
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="set-gold_rate_default" className="block text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Default Gold Rate (per 1gm 22ct)</label>
              <input id="set-gold_rate_default" name="gold_rate_default" type="number" inputMode="decimal" value={settings.gold_rate_default || ''} onChange={(e) => updateSetting('gold_rate_default', e.target.value)} className="glass-input" disabled={!isAdmin} />
            </div>
            <div className="min-w-0">
              <label htmlFor="set-watermark_url" className="block text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Watermark URL</label>
              <input id="set-watermark_url" name="watermark_url" type="url" inputMode="url" value={settings.watermark_url || ''} onChange={(e) => updateSetting('watermark_url', e.target.value)} className="glass-input text-xs" disabled={!isAdmin} />
            </div>
          </div>
        </div>

        {/* Save Button */}
        {isAdmin && (
          <div className="flex justify-end">
            <button type="button" onClick={handleSave} disabled={saving} className="glass-btn-primary px-8 w-full sm:w-auto">
              <i className={`ph ${saving ? 'ph-spinner animate-spin' : 'ph-floppy-disk'}`}></i>
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        )}

        {/* Change Password */}
        <div className="glass-card p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
            <i className="ph ph-lock text-red-500 shrink-0" aria-hidden="true"></i> Change Password
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
            <div>
              <label htmlFor="current-password" className="block text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Current Password</label>
              <input id="current-password" name="currentPassword" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="glass-input" />
            </div>
            <div>
              <label htmlFor="new-password" className="block text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">New Password</label>
              <input id="new-password" name="newPassword" type="password" autoComplete="new-password" value={newPasswordVal} onChange={(e) => setNewPasswordVal(e.target.value)} className="glass-input" />
            </div>
          </div>

          <button type="button" onClick={handleChangePassword} disabled={changingPwd} className="glass-btn-danger mt-4 text-xs w-full sm:w-auto">
            <i className={`ph ${changingPwd ? 'ph-spinner animate-spin motion-reduce:animate-none' : 'ph-key'}`} aria-hidden="true"></i>
            {changingPwd ? 'Changing...' : 'Change Password'}
          </button>
        </div>
      </div>
    </div>
  );
}
