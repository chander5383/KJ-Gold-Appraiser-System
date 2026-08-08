import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { readCachedShopName } from '../contexts/SettingsContext';
import toast from 'react-hot-toast';

export default function LoginPage() {
  // /api/settings is authenticated, so a logged-out visitor cannot read the
  // live shop name. Use the value cached on the last successful session rather
  // than a hardcoded one; it refreshes on every login.
  const [shopName] = useState(() => readCachedShopName());
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error('Please enter username and password');
      return;
    }

    setLoading(true);
    try {
      await login(username.trim(), password);
      toast.success('Welcome back!');
      navigate('/');
    } catch (err) {
      const msg = err.response?.data?.error || 'Login failed. Please try again.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-primary-950 to-slate-900 p-4 sm:p-6 relative overflow-hidden">
      {/* Decorative background elements — purely presentational */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-40 -right-40 w-64 h-64 sm:w-96 sm:h-96 bg-primary-500/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-64 h-64 sm:w-96 sm:h-96 bg-amber-500/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(600px,150vw)] h-[min(600px,150vw)] bg-primary-600/5 rounded-full blur-3xl"></div>
      </div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 opacity-[0.02]" aria-hidden="true" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
        backgroundSize: '50px 50px'
      }}></div>

      <div className="relative w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-amber-400 to-yellow-600 rounded-2xl shadow-2xl shadow-amber-500/30 mb-4 rotate-3 hover:rotate-0 transition-transform duration-500">
            <i className="ph ph-diamond text-3xl sm:text-4xl text-white" aria-hidden="true"></i>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-wide">KJ Gold Appraiser</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-2 font-medium">Professional Certificate Management System</p>
        </div>

        {/* Login Card */}
        <div className="bg-white/10 backdrop-blur-2xl border border-white/10 rounded-3xl p-5 sm:p-8 shadow-2xl">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 bg-primary-500/20 rounded-2xl mb-3">
              <i className="ph ph-shield-check text-2xl sm:text-3xl text-primary-400" aria-hidden="true"></i>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white">Secure Access</h2>
            <p className="text-xs text-slate-400 mt-1">Enter your credentials to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username */}
            <div>
              <label htmlFor="login-username" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Username</label>
              <div className="relative">
                <i className="ph ph-user absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-lg" aria-hidden="true"></i>
                <input
                  id="login-username"
                  name="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  className="w-full pl-11 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 outline-none focus:bg-white/10 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-medium"
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="login-password" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Password</label>
              <div className="relative">
                <i className="ph ph-lock-key absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-lg" aria-hidden="true"></i>
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full pl-11 pr-14 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 outline-none focus:bg-white/10 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-medium"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  aria-controls="login-password"
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <i className={`ph ${showPassword ? 'ph-eye-slash' : 'ph-eye'} text-lg`} aria-hidden="true"></i>
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-primary-500/30 transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Authenticating...
                </>
              ) : (
                <>
                  Unlock System <i className="ph ph-arrow-right font-bold"></i>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-500 font-medium flex items-center justify-center gap-2">
            <i className="ph ph-lock-simple text-sm"></i>
            Protected by End-to-End Encryption
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-xs text-slate-600">
          {shopName ? <>{shopName} &bull; </> : null}Gold Appraiser System v2.0
        </div>
      </div>
    </div>
  );
}
