import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, AlertCircle, ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.login({ username: username.trim(), password });
      if (res.success && res.token && res.user) {
        login(res.token, res.user);
        navigate('/');
      } else {
        setError(res.message || 'Login failed. Please check your credentials.');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#120e0b] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-950/20 via-[#120e0b] to-[#0c0907] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#1c1612] border border-amber-900/40 rounded-3xl shadow-2xl shadow-black/80 p-8 space-y-6 relative overflow-hidden backdrop-blur-xs">
        {/* Subtle decorative glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Header with Logo */}
        <div className="text-center space-y-3 relative z-10">
          <div className="inline-flex p-3.5 rounded-2xl bg-[#261d17]/80 border border-amber-700/30 shadow-xl shadow-amber-950/40 mx-auto">
            <img src="/logo.png" alt="Athiveera Logo" className="h-16 w-auto object-contain drop-shadow" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-amber-50 tracking-tight">Athiveera Microfinance</h1>
            <p className="text-xs text-amber-200/60 mt-1 font-medium tracking-wide">
              Integrated Core Banking & Financial Management
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-xs font-medium relative z-10">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
          <div>
            <label className="block text-xs font-semibold text-amber-100/80 uppercase tracking-wider mb-1.5">
              Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-amber-400/60 absolute left-3.5 top-3.5" />
              <input
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className="w-full bg-[#140f0c] border border-amber-900/50 rounded-xl pl-10 pr-4 py-2.5 text-sm text-amber-50 placeholder-stone-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-amber-100/80 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-amber-400/60 absolute left-3.5 top-3.5" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full bg-[#140f0c] border border-amber-900/50 rounded-xl pl-10 pr-10 py-2.5 text-sm text-amber-50 placeholder-stone-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3.5 text-stone-400 hover:text-amber-300 transition cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-stone-950 font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-600/20 transition disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>Sign In to System</span>
                <ArrowRight className="w-4 h-4 text-stone-950 font-bold" />
              </>
            )}
          </button>
        </form>

        <div className="pt-2 text-center relative z-10 border-t border-amber-900/30">
          <p className="text-[11px] text-amber-200/40">
            Athiveera MFI Core Banking • Authorized Access Only
          </p>
        </div>
      </div>
    </div>
  );
};
