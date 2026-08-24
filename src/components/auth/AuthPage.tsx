import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { MessageSquare, Check, X, ShieldCheck, Sparkles, User, Lock, Mail, ArrowRight, Gamepad2, Coffee, Zap, ShieldAlert, AlertCircle, Smartphone, FileCheck } from 'lucide-react';
import { apiUrl } from '../../config/api';

export const AuthPage: React.FC = () => {
  const { login, register, guestLogin, verify2FA } = useAuth();

  const [isRegister, setIsRegister] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [guestName, setGuestName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 2FA Challenge state
  const [twoFactorChallenge, setTwoFactorChallenge] = useState<{ challengeId: string; maskedEmail: string; twoFactorType?: 'google' | 'file' | 'email' } | null>(null);
  const [twoFactorMode, setTwoFactorMode] = useState<'code' | 'file'>('code');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [keyFileName, setKeyFileName] = useState('');
  const [keyFileContent, setKeyFileContent] = useState('');
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);

  // Duplicate checks
  const [isUsernameTaken, setIsUsernameTaken] = useState<boolean | null>(null);
  const [isEmailTaken, setIsEmailTaken] = useState<boolean | null>(null);

  // Real-time password criteria
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  const criteriaCount = [hasMinLength, hasUppercase, hasLowercase, hasNumber, hasSpecial].filter(Boolean).length;

  const getStrengthLabel = () => {
    if (criteriaCount <= 2) return { text: 'Lemah', color: 'bg-rose-500', width: '25%' };
    if (criteriaCount === 3 || criteriaCount === 4) return { text: 'Sedang', color: 'bg-amber-500', width: '65%' };
    return { text: 'Sangat Kuat', color: 'bg-emerald-500', width: '100%' };
  };

  const strength = getStrengthLabel();

  // Debounced duplicate availability check
  useEffect(() => {
    if (!isRegister) return;
    const timer = setTimeout(async () => {
      if (username.trim().length >= 2) {
        try {
          const res = await fetch(apiUrl(`/api/auth/check?username=${encodeURIComponent(username.trim())}`));
          if (res.ok) {
            const data = await res.json();
            setIsUsernameTaken(!data.usernameAvailable);
          }
        } catch {
          // ignore
        }
      } else {
        setIsUsernameTaken(null);
      }

      if (email.trim().includes('@')) {
        try {
          const res = await fetch(apiUrl(`/api/auth/check?email=${encodeURIComponent(email.trim().toLowerCase())}`));
          if (res.ok) {
            const data = await res.json();
            setIsEmailTaken(!data.emailAvailable);
          }
        } catch {
          // ignore
        }
      } else {
        setIsEmailTaken(null);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [username, email, isRegister]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isRegister) {
      if (isUsernameTaken) {
        setError('Username sudah digunakan oleh akun lain. Silakan pilih username lain.');
        return;
      }
      if (isEmailTaken) {
        setError('Email sudah terdaftar. Silakan gunakan email lain atau masuk ke akun Anda.');
        return;
      }
      if (!hasMinLength || !hasUppercase || !hasLowercase || !hasNumber || !hasSpecial) {
        setError('Pastikan password memenuhi semua syarat keamanan (8+ karakter, huruf besar, huruf kecil, angka, dan simbol).');
        return;
      }
      setLoading(true);
      const res = await register(username, email, password);
      if (!res.success) setError(res.error || 'Pendaftaran gagal');
      setLoading(false);
    } else {
      setLoading(true);
      const res = await login(identifier, password);
      if (res.twoFactorRequired && res.challengeId) {
        setTwoFactorChallenge({
          challengeId: res.challengeId,
          maskedEmail: res.maskedEmail || 'email Anda',
          twoFactorType: res.twoFactorType
        });
        setTwoFactorMode(res.twoFactorType === 'file' ? 'file' : 'code');
        setLoading(false);
        return;
      }
      if (!res.success) setError(res.error || 'Email/Username atau password salah');
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!twoFactorChallenge) return;
    setError('');
    setTwoFactorLoading(true);

    const res = twoFactorMode === 'file'
      ? await verify2FA(twoFactorChallenge.challengeId, undefined, keyFileContent)
      : await verify2FA(twoFactorChallenge.challengeId, twoFactorCode.trim());

    if (!res.success) {
      setError(res.error || 'Kode verifikasi 2FA atau file kunci tidak valid');
    }
    setTwoFactorLoading(false);
  };

  const handleKeyFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setKeyFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setKeyFileContent(content);
    };
    reader.readAsText(file);
  };

  const handleQuickLogin = async (guestId?: string, customName?: string) => {
    setError('');
    setLoading(true);
    const res = await guestLogin(guestId, customName);
    if (!res.success) setError(res.error || 'Gagal masuk akun demo');
    setLoading(false);
  };

  return (
    <div className="min-h-screen w-full bg-[#0b0c10] flex items-center justify-center p-4 sm:p-6 py-8 md:py-12 relative overflow-y-auto select-none">
      {/* Ambient background aura */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-4xl my-auto grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 z-10">
        {/* Main Card: Auth Form */}
        <div className="md:col-span-7 bg-[#13161f]/90 backdrop-blur-xl rounded-3xl p-8 border border-white/10 shadow-2xl flex flex-col justify-between">
          <div>
            {/* Minimal Logo */}
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25">
                <MessageSquare size={20} />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight text-white flex items-center space-x-2">
                  <span>AeroCord</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">
                    Minimalist
                  </span>
                </h1>
                <p className="text-xs text-slate-400">Next-Gen Realtime Voice & Chat Platform</p>
              </div>
            </div>

            <div className="mb-6">
              <h2 className="text-xl font-bold text-white mb-1">
                {isRegister ? 'Buat Akun Baru' : 'Selamat Datang Kembali'}
              </h2>
              <p className="text-xs text-slate-400">
                {isRegister
                  ? 'Daftar untuk menikmati obrolan aman & panggilan suara jernih.'
                  : 'Masuk ke akun Anda untuk mulai berkomunikasi.'}
              </p>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="mb-4 p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300 flex items-start space-x-2 animate-in fade-in">
                <ShieldAlert size={16} className="text-rose-400 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {isRegister && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300">
                      Nama Pengguna <span className="text-rose-400">*</span>
                    </label>
                    {isUsernameTaken === true && (
                      <span className="text-[10px] text-rose-400 font-semibold flex items-center space-x-1">
                        <X size={12} />
                        <span>Username sudah digunakan</span>
                      </span>
                    )}
                    {isUsernameTaken === false && username.trim().length >= 2 && (
                      <span className="text-[10px] text-emerald-400 font-semibold flex items-center space-x-1">
                        <Check size={12} />
                        <span>Username tersedia</span>
                      </span>
                    )}
                  </div>
                  <div className="relative flex items-center">
                    <span className="absolute left-3.5 text-slate-400"><User size={16} /></span>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Display Name"
                      required
                      className={`w-full pl-10 pr-3.5 py-2.5 bg-[#0c0e14] text-sm text-slate-100 rounded-xl border focus:outline-none transition-colors ${
                        isUsernameTaken === true ? 'border-rose-500 focus:border-rose-500' : isUsernameTaken === false ? 'border-emerald-500 focus:border-emerald-500' : 'border-white/10 focus:border-indigo-500'
                      }`}
                    />
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300">
                    {isRegister ? 'Alamat Email' : 'Email atau Username'} <span className="text-rose-400">*</span>
                  </label>
                  {isRegister && isEmailTaken === true && (
                    <span className="text-[10px] text-rose-400 font-semibold flex items-center space-x-1">
                      <X size={12} />
                      <span>Email sudah terdaftar</span>
                    </span>
                  )}
                  {isRegister && isEmailTaken === false && email.includes('@') && (
                    <span className="text-[10px] text-emerald-400 font-semibold flex items-center space-x-1">
                      <Check size={12} />
                      <span>Email tersedia</span>
                    </span>
                  )}
                </div>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-slate-400"><Mail size={16} /></span>
                  <input
                    type={isRegister ? 'email' : 'text'}
                    value={isRegister ? email : identifier}
                    onChange={(e) => isRegister ? setEmail(e.target.value) : setIdentifier(e.target.value)}
                    placeholder={isRegister ? 'nama@domain.com' : 'alice@aerocord.app atau Alice'}
                    required
                    className={`w-full pl-10 pr-3.5 py-2.5 bg-[#0c0e14] text-sm text-slate-100 rounded-xl border focus:outline-none transition-colors ${
                      isRegister && isEmailTaken === true ? 'border-rose-500 focus:border-rose-500' : isRegister && isEmailTaken === false ? 'border-emerald-500 focus:border-emerald-500' : 'border-white/10 focus:border-indigo-500'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Kata Sandi <span className="text-rose-400">*</span>
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-slate-400"><Lock size={16} /></span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-10 pr-3.5 py-2.5 bg-[#0c0e14] text-sm text-slate-100 rounded-xl border border-white/10 focus:border-indigo-500 focus:outline-none transition-colors"
                  />
                </div>

                {/* Password Strength Checklist (when registering) */}
                {isRegister && password.length > 0 && (
                  <div className="mt-3 p-3.5 rounded-2xl bg-[#0c0e14] border border-white/5 space-y-2 text-xs">
                    {/* Strength Bar */}
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-slate-400">Kekuatan Sandi:</span>
                      <span className={`font-bold ${criteriaCount >= 5 ? 'text-emerald-400' : criteriaCount >= 3 ? 'text-amber-400' : 'text-rose-400'}`}>
                        {strength.text}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${strength.color} transition-all duration-300`}
                        style={{ width: strength.width }}
                      />
                    </div>

                    {/* Criteria items */}
                    <div className="grid grid-cols-2 gap-1.5 pt-2 text-[11px]">
                      <div className={`flex items-center space-x-1.5 ${hasMinLength ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {hasMinLength ? <Check size={13} /> : <X size={13} />}
                        <span>Min. 8 Karakter</span>
                      </div>
                      <div className={`flex items-center space-x-1.5 ${hasUppercase ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {hasUppercase ? <Check size={13} /> : <X size={13} />}
                        <span>Huruf Besar (A-Z)</span>
                      </div>
                      <div className={`flex items-center space-x-1.5 ${hasLowercase ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {hasLowercase ? <Check size={13} /> : <X size={13} />}
                        <span>Huruf Kecil (a-z)</span>
                      </div>
                      <div className={`flex items-center space-x-1.5 ${hasNumber ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {hasNumber ? <Check size={13} /> : <X size={13} />}
                        <span>Angka (0-9)</span>
                      </div>
                      <div className={`flex items-center space-x-1.5 col-span-2 ${hasSpecial ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {hasSpecial ? <Check size={13} /> : <X size={13} />}
                        <span>Simbol Khusus (!@#$%^&*...)</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all cursor-pointer flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <span>{isRegister ? 'Buat Akun Sekarang' : 'Masuk ke AeroCord'}</span>
                )}
              </button>
            </form>
          </div>

          {/* Toggle Switch */}
          <div className="mt-6 text-center text-xs text-slate-400">
            {isRegister ? (
              <span>
                Sudah punya akun?{' '}
                <button
                  type="button"
                  onClick={() => { setIsRegister(false); setError(''); }}
                  className="text-indigo-400 hover:underline font-semibold cursor-pointer"
                >
                  Masuk di sini
                </button>
              </span>
            ) : (
              <span>
                Belum memiliki akun?{' '}
                <button
                  type="button"
                  onClick={() => { setIsRegister(true); setError(''); }}
                  className="text-indigo-400 hover:underline font-semibold cursor-pointer"
                >
                  Daftar akun baru
                </button>
              </span>
            )}
          </div>
        </div>

        {/* Right Card: Feature Showcase & Guest Access */}
        <div className="md:col-span-5 bg-[#13161f]/90 backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-2">
              <Sparkles size={14} />
              <span>Modern & Aman</span>
            </div>
            <h3 className="text-lg font-bold text-white mb-1.5">Fitur Unggulan</h3>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Platform komunikasi real-time dengan standar keamanan tingkat tinggi:
            </p>

            <div className="space-y-3">
              <div className="p-3 bg-[#0c0e14] border border-white/5 rounded-2xl flex items-start space-x-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 flex-shrink-0 mt-0.5">
                  <ShieldCheck size={16} />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Keamanan 4-Lapis</div>
                  <div className="text-[11px] text-slate-400 leading-tight mt-0.5">Enkripsi AES-256-GCM, HMAC Integrity Seal, dan Sanitasi SQLi.</div>
                </div>
              </div>

              <div className="p-3 bg-[#0c0e14] border border-white/5 rounded-2xl flex items-start space-x-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0 mt-0.5">
                  <Gamepad2 size={16} />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Voice & Video WebRTC</div>
                  <div className="text-[11px] text-slate-400 leading-tight mt-0.5">Voice channel rendah latensi, screen sharing, dan panggilan langsung.</div>
                </div>
              </div>

              <div className="p-3 bg-[#0c0e14] border border-white/5 rounded-2xl flex items-start space-x-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 flex-shrink-0 mt-0.5">
                  <Smartphone size={16} />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Autentikasi 2FA</div>
                  <div className="text-[11px] text-slate-400 leading-tight mt-0.5">Mendukung Google Authenticator (QR) dan File Kunci Keamanan.</div>
                </div>
              </div>
            </div>
          </div>

          {/* Guest Access Box */}
          <div className="mt-4 pt-4 border-t border-white/5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Masuk Cepat Sebagai Tamu
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                placeholder="Ketik Nama Panggilan"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && guestName.trim() && handleQuickLogin(undefined, guestName)}
                className="flex-1 px-3.5 py-2.5 bg-[#0c0e14] text-xs text-slate-200 rounded-xl border border-white/10 focus:border-indigo-500 focus:outline-none"
              />
              <button
                onClick={() => handleQuickLogin(undefined, guestName)}
                disabled={!guestName.trim() || loading}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-lg shadow-indigo-600/20 whitespace-nowrap"
              >
                Masuk Tamu
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Two-Factor Authentication (2FA) Modal */}
      {twoFactorChallenge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200 select-none">
          <div className="w-full max-w-sm bg-[#13161f] rounded-3xl shadow-2xl overflow-hidden border border-white/10 text-white animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <ShieldCheck size={24} />
                </div>
                <button
                  type="button"
                  onClick={() => setTwoFactorChallenge(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <h3 className="text-lg font-bold text-white mb-1">Verifikasi Dua Langkah (2FA)</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Akun ini dilindungi dengan Autentikasi 2FA. Pilih metode verifikasi untuk melanjutkan.
              </p>

              {/* Mode Switcher */}
              <div className="grid grid-cols-2 gap-2 mt-4 p-1 rounded-2xl bg-[#0c0e14] border border-white/5">
                <button
                  type="button"
                  onClick={() => { setTwoFactorMode('code'); setError(''); }}
                  className={`py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                    twoFactorMode === 'code'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Smartphone size={14} />
                  <span>Kode OTP</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setTwoFactorMode('file'); setError(''); }}
                  className={`py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                    twoFactorMode === 'file'
                      ? 'bg-amber-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <FileCheck size={14} />
                  <span>File Kunci</span>
                </button>
              </div>

              {error && (
                <div className="mt-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300">
                  {error}
                </div>
              )}

              <form onSubmit={handleVerify2FA} className="mt-4 space-y-4">
                {twoFactorMode === 'code' ? (
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 text-center">
                      Kode Google Authenticator / OTP
                    </label>
                    <input
                      type="text"
                      value={twoFactorCode}
                      onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="123456"
                      maxLength={6}
                      autoFocus
                      required
                      className="w-full px-4 py-3 bg-[#0c0e14] text-center text-base text-slate-100 rounded-xl border border-white/10 focus:border-indigo-500 focus:outline-none font-mono tracking-[0.4em] transition-colors"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 text-center">
                      Pilih File Kunci (.aerocord-key)
                    </label>
                    <label className="w-full p-4 rounded-2xl bg-[#0c0e14] hover:bg-white/[0.04] border-2 border-dashed border-white/15 hover:border-amber-500/50 flex flex-col items-center justify-center text-center cursor-pointer transition-all">
                      <input
                        type="file"
                        accept=".aerocord-key,.json"
                        onChange={handleKeyFileUpload}
                        className="hidden"
                      />
                      <FileCheck size={24} className={keyFileName ? 'text-emerald-400 mb-1' : 'text-amber-400 mb-1'} />
                      <span className="text-xs font-bold text-white truncate max-w-full">
                        {keyFileName ? keyFileName : 'Klik atau Tarik File .aerocord-key'}
                      </span>
                      <span className="text-[10px] text-slate-400 mt-0.5">
                        {keyFileName ? 'File kunci siap diverifikasi ✓' : 'File tanda tangan digital 256-bit'}
                      </span>
                    </label>
                  </div>
                )}

                <div className="flex items-center space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setTwoFactorChallenge(null)}
                    className="flex-1 py-2.5 bg-[#0c0e14] hover:bg-white/5 text-slate-300 hover:text-white text-xs font-bold rounded-xl border border-white/5 transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={twoFactorLoading || (twoFactorMode === 'code' ? twoFactorCode.length !== 6 : !keyFileContent)}
                    className={`flex-1 py-2.5 disabled:opacity-40 text-white text-xs font-bold rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                      twoFactorMode === 'file'
                        ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 shadow-amber-600/25'
                        : 'bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 shadow-indigo-600/25'
                    }`}
                  >
                    <span>{twoFactorLoading ? 'Memverifikasi...' : 'Masuk'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

