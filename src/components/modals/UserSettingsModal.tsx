import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useVoice } from '../../context/VoiceContext';
import { useToast } from '../../context/ToastContext';
import { useTheme, THEME_OPTIONS } from '../../context/ThemeContext';
import { X, User, Mic, ShieldCheck, LogOut, CheckCircle2, RefreshCw, Upload, Sparkles, Image as ImageIcon, Rocket, Mail, Lock, Key, Smartphone, FileCheck, Palette, Check } from 'lucide-react';
import { ImageUploadCropModal } from './ImageUploadCropModal';
import { Setup2FAModal } from './Setup2FAModal';
import { Disable2FAModal } from './Disable2FAModal';
import { apiUrl } from '../../config/api';

interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserSettingsModal: React.FC<UserSettingsModalProps> = ({ isOpen, onClose }) => {
  const { user, updateProfile, logout } = useAuth();
  const { isMuted } = useVoice();
  const { showSuccess, showError } = useToast();
  const { theme, setTheme } = useTheme();

  const [tab, setTab] = useState<'profile' | 'voice' | 'security' | 'appearance' | 'upgrade'>('profile');

  // Profile Form States
  const [username, setUsername] = useState(user?.username || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [bannerColor, setBannerColor] = useState(user?.bannerColor || '#6366f1');
  const [customStatus, setCustomStatus] = useState(user?.customStatus || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [isSaving, setIsSaving] = useState(false);

  // Crop Modal state
  const [cropTarget, setCropTarget] = useState<'avatar' | 'banner' | null>(null);

  // Mic test state
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const micTestInterval = useRef<number | null>(null);

  // Guest upgrade states
  const isGuestUser = user?.isGuest || user?.id.startsWith('guest_') || user?.email.endsWith('@guest.aerocord.app');
  const [upgradeEmail, setUpgradeEmail] = useState('');
  const [upgradePassword, setUpgradePassword] = useState('');
  const [upgradePasswordConfirm, setUpgradePasswordConfirm] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [upgradeError, setUpgradeError] = useState('');

  // Security tab states
  const [is2FAEnabled, setIs2FAEnabled] = useState(user?.twoFactorEnabled || false);
  const [twoFactorType, setTwoFactorType] = useState(user?.twoFactorType || 'google');
  const [show2FASetupModal, setShow2FASetupModal] = useState(false);
  const [showDisable2FAModal, setShowDisable2FAModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordChangeError, setPasswordChangeError] = useState('');
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState('');

  // Auto-reset and sync when modal opens/closes
  useEffect(() => {
    if (user) {
      setUsername(user.username);
      setAvatar(user.avatar);
      setBannerColor(user.bannerColor || '#6366f1');
      setCustomStatus(user.customStatus || '');
      setBio(user.bio || '');
      setIs2FAEnabled(user.twoFactorEnabled || false);
      setTwoFactorType(user.twoFactorType || 'google');
    }
    if (!isOpen) {
      // Auto-reset password change fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setPasswordChangeError('');
      setPasswordChangeSuccess('');
      // Auto-reset guest upgrade fields
      setUpgradeEmail('');
      setUpgradePassword('');
      setUpgradePasswordConfirm('');
      setVerificationCode('');
      setIsCodeSent(false);
      setUpgradeError('');
    }
  }, [user, isOpen]);

  const handleToggle2FA = () => {
    if (isGuestUser) return;
    if (!is2FAEnabled) {
      setShow2FASetupModal(true);
    } else {
      setShowDisable2FAModal(true);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordChangeError('');
    setPasswordChangeSuccess('');

    if (newPassword !== confirmNewPassword) {
      setPasswordChangeError('Konfirmasi password baru tidak cocok.');
      return;
    }

    if (
      newPassword.length < 8 ||
      !/[A-Z]/.test(newPassword) ||
      !/[a-z]/.test(newPassword) ||
      !/[0-9]/.test(newPassword) ||
      !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword)
    ) {
      setPasswordChangeError('Password baru harus minimal 8 karakter dengan huruf besar, huruf kecil, angka, dan simbol.');
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await fetch(apiUrl('/api/auth/change-password'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('aerocord_token')}`
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();
      if (res.ok) {
        setPasswordChangeSuccess('Password berhasil diperbarui dengan aman!');
        showSuccess('Password Diperbarui', 'Password akun Anda telah berhasil diganti.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
      } else {
        setPasswordChangeError(data.error || 'Gagal mengubah password');
      }
    } catch (err: any) {
      setPasswordChangeError(err.message || 'Kesalahan koneksi');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const success = await updateProfile({
      username: username.trim(),
      avatar: avatar.trim(),
      bannerColor,
      customStatus: customStatus.trim(),
      bio: bio.trim()
    });
    setIsSaving(false);
    if (success) {
      showSuccess('Profil Diperbarui', 'Informasi akun Anda berhasil disimpan.');
    } else {
      showError('Gagal Menyimpan', 'Terjadi kesalahan saat memperbarui profil.');
    }
  };

  const handleRandomizeAvatar = () => {
    const seed = Math.random().toString(36).substring(7);
    setAvatar(`https://api.dicebear.com/7.x/bottts/svg?seed=${seed}`);
  };

  if (!isOpen || !user) return null;

  const handleSendVerificationCode = async () => {
    if (!upgradeEmail.trim()) return;
    setIsSendingCode(true);
    setUpgradeError('');
    try {
      const res = await fetch(apiUrl('/api/auth/send-verification'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('aerocord_token')}`
        },
        body: JSON.stringify({ email: upgradeEmail.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setIsCodeSent(true);
        showSuccess('Kode Verifikasi Terkirim', `Kode: ${data.code || '(cek email)'}. Berlaku 10 menit.`);
      } else {
        setUpgradeError(data.error || 'Gagal mengirim kode verifikasi.');
      }
    } catch (err: any) {
      setUpgradeError(err.message || 'Network error');
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleUpgradeAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (upgradePassword !== upgradePasswordConfirm) {
      setUpgradeError('Konfirmasi password tidak cocok!');
      return;
    }
    if (upgradePassword.length < 6) {
      setUpgradeError('Password minimal 6 karakter.');
      return;
    }
    setIsUpgrading(true);
    setUpgradeError('');
    try {
      const res = await fetch(apiUrl('/api/auth/upgrade-guest'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('aerocord_token')}`
        },
        body: JSON.stringify({
          email: upgradeEmail.trim(),
          password: upgradePassword,
          verificationCode: verificationCode.trim()
        })
      });
      const data = await res.json();
      if (res.ok && data.user) {
        showSuccess('Akun Ditingkatkan!', 'Selamat! Akun tamu Anda sekarang menjadi akun permanen.');
        // Refresh user state
        await updateProfile({});
        setTab('profile');
      } else {
        setUpgradeError(data.error || 'Gagal upgrade akun.');
      }
    } catch (err: any) {
      setUpgradeError(err.message || 'Network error');
    } finally {
      setIsUpgrading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl h-[620px] bg-[#13161f] rounded-3xl shadow-2xl overflow-hidden border border-white/10 text-white flex flex-col md:flex-row animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left Navigation Sidebar */}
        <div className="w-full md:w-60 bg-[#0c0e14] p-5 border-r border-white/5 flex flex-col justify-between flex-shrink-0">
          <div>
            <div className="px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-400 mb-2">
              Pengaturan Akun
            </div>

            <div className="space-y-1">
              <button
                onClick={() => setTab('profile')}
                className={`w-full px-3.5 py-2.5 rounded-xl flex items-center space-x-3 text-xs font-semibold transition-all cursor-pointer ${
                  tab === 'profile'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                }`}
              >
                <User size={16} />
                <span>Profil & Avatar</span>
              </button>

              <button
                onClick={() => setTab('voice')}
                className={`w-full px-3.5 py-2.5 rounded-xl flex items-center space-x-3 text-xs font-semibold transition-all cursor-pointer ${
                  tab === 'voice'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                }`}
              >
                <Mic size={16} />
                <span>Suara & Audio</span>
              </button>

              <button
                onClick={() => setTab('security')}
                className={`w-full px-3.5 py-2.5 rounded-xl flex items-center space-x-3 text-xs font-semibold transition-all cursor-pointer ${
                  tab === 'security'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                }`}
              >
                <ShieldCheck size={16} />
                <span>Keamanan & Privasi</span>
              </button>

              <button
                onClick={() => setTab('appearance')}
                className={`w-full px-3.5 py-2.5 rounded-xl flex items-center space-x-3 text-xs font-semibold transition-all cursor-pointer ${
                  tab === 'appearance'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                }`}
              >
                <Palette size={16} />
                <span>Tema & Tampilan</span>
              </button>

              {isGuestUser && (
                <button
                  onClick={() => setTab('upgrade')}
                  className={`w-full px-3.5 py-2.5 rounded-xl flex items-center space-x-3 text-xs font-semibold transition-all cursor-pointer ${
                    tab === 'upgrade'
                      ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md'
                      : 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10'
                  }`}
                >
                  <Rocket size={16} />
                  <span>Tingkatkan Akun</span>
                </button>
              )}
            </div>
          </div>

          <button
            onClick={() => {
              logout();
              onClose();
            }}
            className="w-full px-3.5 py-2.5 rounded-xl flex items-center space-x-3 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
          >
            <LogOut size={16} />
            <span>Keluar Akun (Logout)</span>
          </button>
        </div>

        {/* Settings Main Content */}
        <div className="flex-1 flex flex-col h-full bg-[#13161f] relative overflow-hidden">
          {/* Header */}
          <div className="px-8 py-5 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-base font-bold text-white">
              {tab === 'profile' && 'Kustomisasi Profil Pengguna'}
              {tab === 'voice' && 'Pengaturan Audio & Mikrofon'}
              {tab === 'security' && 'Keamanan & Autentikasi'}
              {tab === 'upgrade' && 'Tingkatkan ke Akun Permanen'}
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-8 max-w-2xl">
            {/* PROFILE TAB */}
            {tab === 'profile' && (
              <form onSubmit={handleSaveProfile} className="space-y-6">
                {/* Profile Card Preview */}
                <div className="rounded-3xl overflow-hidden border border-white/10 bg-[#0c0e14] shadow-xl">
                  <div
                    className="h-24 w-full transition-colors relative flex items-center justify-end px-4"
                    style={{
                      background: bannerColor
                        ? `linear-gradient(135deg, ${bannerColor}, #0f172a)`
                        : 'linear-gradient(135deg, #6366f1, #06b6d4)'
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setCropTarget('banner')}
                      className="px-3 py-1.5 bg-black/50 hover:bg-black/80 rounded-xl text-xs font-semibold text-white flex items-center space-x-1.5 backdrop-blur cursor-pointer"
                    >
                      <ImageIcon size={13} />
                      <span>Ubah Warna / Banner</span>
                    </button>
                  </div>

                  <div className="px-6 pb-6 pt-0 relative">
                    <div className="flex justify-between items-end -mt-12 mb-4">
                      <div className="relative group">
                        <img
                          src={avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.id}`}
                          alt="Avatar"
                          className="w-24 h-24 rounded-2xl border-4 border-[#0c0e14] object-cover bg-slate-800 shadow-2xl"
                        />
                        <button
                          type="button"
                          onClick={() => setCropTarget('avatar')}
                          className="absolute inset-0 bg-black/60 rounded-2xl opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-[10px] font-bold transition-opacity cursor-pointer border-4 border-transparent"
                        >
                          <Upload size={16} className="mb-1" />
                          <span>Upload & Crop</span>
                        </button>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => setCropTarget('avatar')}
                          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-semibold text-white flex items-center space-x-1.5 shadow cursor-pointer"
                        >
                          <Upload size={14} />
                          <span>Upload Foto</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleRandomizeAvatar}
                          title="Generate Acak"
                          className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 hover:text-white transition-colors cursor-pointer"
                        >
                          <RefreshCw size={15} />
                        </button>
                      </div>
                    </div>

                    <div className="font-black text-lg text-white">{username}</div>
                    <div className="text-xs text-slate-400 font-mono mb-2">#{user.discriminator}</div>
                    {customStatus && (
                      <div className="text-xs text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 p-2.5 rounded-xl mb-2 flex items-center space-x-1.5">
                        <Sparkles size={14} className="text-indigo-400" />
                        <span>{customStatus}</span>
                      </div>
                    )}
                    {bio && <div className="text-xs text-slate-300 italic">{bio}</div>}
                  </div>
                </div>

                {/* Username Input */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                    Nama Tampilan (Username)
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-[#0c0e14] text-sm text-slate-100 rounded-xl border border-white/10 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                {/* Custom Status */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                    Status Kustom
                  </label>
                  <input
                    type="text"
                    value={customStatus}
                    onChange={(e) => setCustomStatus(e.target.value)}
                    placeholder="misal: 🚀 Sedang coding AeroCord"
                    className="w-full px-3.5 py-2.5 bg-[#0c0e14] text-sm text-slate-100 rounded-xl border border-white/10 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                {/* Bio */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                    Tentang Saya (Bio)
                  </label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={3}
                    placeholder="Ceritakan sedikit tentang dirimu..."
                    className="w-full px-3.5 py-2.5 bg-[#0c0e14] text-sm text-slate-100 rounded-xl border border-white/10 focus:border-indigo-500 focus:outline-none resize-none"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/25 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSaving ? 'Menyimpan...' : 'Simpan Perubahan Profil'}
                  </button>
                </div>
              </form>
            )}

            {/* VOICE & AUDIO TAB */}
            {tab === 'voice' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-white mb-2">Uji Coba Mikrofon</h3>
                  <p className="text-xs text-slate-400 mb-4">
                    Pastikan mikrofon Anda berfungsi dengan normal sebelum bergabung ke voice channel.
                  </p>
                  <div className="p-4 rounded-2xl bg-[#0c0e14] border border-white/5 flex items-center space-x-3">
                    <Mic size={20} className={isMuted ? 'text-rose-400' : 'text-emerald-400'} />
                    <span className="text-xs text-slate-200 font-semibold">
                      Status Mikrofon: {isMuted ? 'Muted (Dibisukan)' : 'Aktif'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* SECURITY TAB */}
            {tab === 'security' && (
              <div className="space-y-6">
                {/* Security Overview Card */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950/40 to-slate-900/60 border border-white/10 space-y-3">
                  <div className="flex items-center space-x-2 text-indigo-400 font-bold text-xs uppercase tracking-wider">
                    <ShieldCheck size={18} />
                    <span>Perlindungan Keamanan Sistem & Database</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div className="p-3 rounded-xl bg-[#0c0e14]/80 border border-white/5">
                      <div className="text-[10px] font-bold text-emerald-400 uppercase">SQL & NoSQL Guard</div>
                      <div className="text-xs text-slate-200 font-semibold mt-0.5">Anti-Injection Aktif</div>
                      <div className="text-[9px] text-slate-400 mt-1">Sanitasi query & parameter input otomatis</div>
                    </div>
                    <div className="p-3 rounded-xl bg-[#0c0e14]/80 border border-white/5">
                      <div className="text-[10px] font-bold text-indigo-400 uppercase">Brute-Force Shield</div>
                      <div className="text-xs text-slate-200 font-semibold mt-0.5">Maks 5x Percobaan</div>
                      <div className="text-[9px] text-slate-400 mt-1">Kunci akun 15 menit jika terdeteksi serangan</div>
                    </div>
                    <div className="p-3 rounded-xl bg-[#0c0e14]/80 border border-white/5">
                      <div className="text-[10px] font-bold text-cyan-400 uppercase">Enkripsi Data</div>
                      <div className="text-xs text-slate-200 font-semibold mt-0.5">Bcrypt & JWT</div>
                      <div className="text-[9px] text-slate-400 mt-1">Salted hash password & WebRTC P2P</div>
                    </div>
                  </div>
                </div>

                {/* Two-Factor Authentication (2FA) */}
                {!isGuestUser && (
                  <div className="p-5 rounded-2xl bg-[#0c0e14] border border-white/10 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                          is2FAEnabled
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : 'bg-slate-800 border-white/10 text-slate-400'
                        }`}>
                          {is2FAEnabled && twoFactorType === 'file' ? <FileCheck size={18} /> : is2FAEnabled ? <Smartphone size={18} /> : <Key size={18} />}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white flex items-center space-x-2">
                            <span>Autentikasi Dua Langkah (2FA)</span>
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                              is2FAEnabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-300'
                            }`}>
                              {is2FAEnabled ? (twoFactorType === 'file' ? 'Aktif (File Kunci)' : 'Aktif (Google Auth)') : 'Nonaktif'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {is2FAEnabled
                              ? twoFactorType === 'file'
                                ? 'Akun dilindungi oleh File Kunci Kriptografi digital (.aerocord-key).'
                                : 'Akun dilindungi oleh kode 6-digit Google Authenticator / TOTP.'
                              : 'Pilih sistem verifikasi: Google Authenticator atau File Kunci Keamanan.'}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleToggle2FA}
                        className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md ${
                          is2FAEnabled
                            ? 'bg-rose-600/80 hover:bg-rose-600 text-white'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        }`}
                      >
                        {is2FAEnabled ? 'Nonaktifkan 2FA' : 'Aktifkan 2FA'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Secure Password Change */}
                {!isGuestUser && (
                  <div className="p-5 rounded-2xl bg-[#0c0e14] border border-white/10 space-y-4">
                    <div className="flex items-center space-x-2 text-slate-200 font-bold text-xs">
                      <Lock size={16} className="text-indigo-400" />
                      <span>Ubah Password Akun</span>
                    </div>

                    {passwordChangeError && (
                      <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300">
                        {passwordChangeError}
                      </div>
                    )}

                    {passwordChangeSuccess && (
                      <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-300">
                        {passwordChangeSuccess}
                      </div>
                    )}

                    <form onSubmit={handleChangePassword} className="space-y-3.5">
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                          Password Saat Ini
                        </label>
                        <input
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="Ketik password lama Anda"
                          required
                          className="w-full px-3.5 py-2.5 bg-[#13161f] text-xs text-slate-100 rounded-xl border border-white/10 focus:border-indigo-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                          Password Baru (Minimal 8 Karakter)
                        </label>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Huruf besar, kecil, angka & simbol"
                          required
                          minLength={8}
                          className="w-full px-3.5 py-2.5 bg-[#13161f] text-xs text-slate-100 rounded-xl border border-white/10 focus:border-indigo-500 focus:outline-none"
                        />
                        {newPassword.length > 0 && (
                          <div className="mt-1.5 flex items-center space-x-2">
                            <div className="flex-1 h-1.5 bg-[#13161f] rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  newPassword.length < 8 ? 'w-1/4 bg-rose-500' :
                                  newPassword.length < 10 ? 'w-2/4 bg-amber-500' :
                                  newPassword.length < 14 ? 'w-3/4 bg-emerald-500' :
                                  'w-full bg-cyan-400'
                                }`}
                              />
                            </div>
                            <span className={`text-[10px] font-bold ${
                              newPassword.length < 8 ? 'text-rose-400' :
                              newPassword.length < 10 ? 'text-amber-400' :
                              'text-emerald-400'
                            }`}>
                              {newPassword.length < 8 ? 'Terlalu pendek' :
                               newPassword.length < 10 ? 'Cukup' :
                               newPassword.length < 14 ? 'Kuat' : 'Sangat Kuat'}
                            </span>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                          Konfirmasi Password Baru
                        </label>
                        <input
                          type="password"
                          value={confirmNewPassword}
                          onChange={(e) => setConfirmNewPassword(e.target.value)}
                          placeholder="Ketik ulang password baru"
                          required
                          className={`w-full px-3.5 py-2.5 bg-[#13161f] text-xs text-slate-100 rounded-xl border focus:outline-none ${
                            confirmNewPassword && confirmNewPassword !== newPassword
                              ? 'border-rose-500'
                              : confirmNewPassword && confirmNewPassword === newPassword
                              ? 'border-emerald-500'
                              : 'border-white/10 focus:border-indigo-500'
                          }`}
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isChangingPassword || !currentPassword || !newPassword || newPassword !== confirmNewPassword}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/25 transition-all cursor-pointer"
                      >
                        {isChangingPassword ? 'Menyimpan...' : 'Perbarui Password'}
                      </button>
                    </form>
                  </div>
                )}

                {/* Guest Account Info */}
                {isGuestUser && (
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start space-x-3">
                    <Rocket size={18} className="text-amber-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-amber-200 mb-1">Akun Tamu Aktif</div>
                      <p className="text-[11px] text-amber-300/80">Anda sedang login sebagai tamu. Akun tamu akan dihapus saat logout. Tingkatkan ke akun permanen agar tidak kehilangan data Anda.</p>
                      <button
                        onClick={() => setTab('upgrade')}
                        className="mt-2 px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                      >
                        Tingkatkan Sekarang →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Appearance / Theme Picker Tab */}
            {tab === 'appearance' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div>
                  <div className="flex items-center space-x-2.5 mb-1">
                    <Palette size={20} className="text-indigo-400" />
                    <h3 className="text-base font-bold text-white">Tema & Palet Tampilan</h3>
                  </div>
                  <p className="text-xs text-slate-400">
                    Pilih palet tema AeroCord sesuai dengan kenyamanan mata dan gaya visual favorit Anda.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {THEME_OPTIONS.map((opt) => {
                    const isCurrent = theme === opt.id;
                    return (
                      <div
                        key={opt.id}
                        onClick={() => {
                          setTheme(opt.id);
                          showSuccess('Tema Diterapkan', `Tema ${opt.name} aktif.`);
                        }}
                        className={`relative rounded-2xl p-4 border transition-all cursor-pointer group flex flex-col justify-between ${
                          isCurrent
                            ? 'bg-[#181b24] border-indigo-500 shadow-xl ring-2 ring-indigo-500/20'
                            : 'bg-[#0c0e14] border-white/5 hover:border-white/20 hover:bg-[#13161f]'
                        }`}
                      >
                        {/* Color Preview Swatch */}
                        <div className={`h-12 w-full rounded-xl bg-gradient-to-r ${opt.previewGradient} mb-3 shadow-md flex items-center justify-end p-2`}>
                          {isCurrent && (
                            <div className="w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center shadow-lg">
                              <Check size={14} className="text-white" />
                            </div>
                          )}
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
                              {opt.name}
                            </h4>
                            {isCurrent && (
                              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${opt.badgeBg} ${opt.badgeText}`}>
                                Aktif
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            {opt.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* GUEST UPGRADE TAB */}
            {tab === 'upgrade' && isGuestUser && (
              <div className="space-y-5">
                <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20">
                  <div className="flex items-center space-x-2.5 mb-2">
                    <Rocket size={20} className="text-amber-400" />
                    <h3 className="text-sm font-bold text-white">Tingkatkan ke Akun Permanen</h3>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Tambahkan email dan password untuk mengubah akun tamu Anda menjadi akun permanen. Setelah ditingkatkan, data Anda tidak akan hilang saat logout.
                  </p>
                </div>

                {upgradeError && (
                  <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300">
                    {upgradeError}
                  </div>
                )}

                <form onSubmit={handleUpgradeAccount} className="space-y-4">
                  {/* Email */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      <Mail size={12} className="inline mr-1" /> Alamat Email
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="email"
                        value={upgradeEmail}
                        onChange={(e) => { setUpgradeEmail(e.target.value); setIsCodeSent(false); }}
                        placeholder="email@anda.com"
                        required
                        className="flex-1 px-3.5 py-2.5 bg-[#0c0e14] text-xs text-slate-100 rounded-xl border border-white/10 focus:border-indigo-500 focus:outline-none transition-colors"
                      />
                      <button
                        type="button"
                        onClick={handleSendVerificationCode}
                        disabled={isSendingCode || !upgradeEmail.trim() || isCodeSent}
                        className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-[11px] font-bold rounded-xl whitespace-nowrap transition-colors cursor-pointer"
                      >
                        {isSendingCode ? 'Mengirim...' : isCodeSent ? 'Terkirim ✓' : 'Kirim Kode'}
                      </button>
                    </div>
                  </div>

                  {/* Verification Code */}
                  {isCodeSent && (
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                        <Key size={12} className="inline mr-1" /> Kode Verifikasi (6 Digit)
                      </label>
                      <input
                        type="text"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="123456"
                        maxLength={6}
                        required
                        className="w-40 px-3.5 py-2.5 bg-[#0c0e14] text-center text-sm text-slate-100 rounded-xl border border-white/10 focus:border-indigo-500 focus:outline-none font-mono tracking-[0.3em] transition-colors"
                      />
                    </div>
                  )}

                  {/* Password */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      <Lock size={12} className="inline mr-1" /> Password Baru
                    </label>
                    <input
                      type="password"
                      value={upgradePassword}
                      onChange={(e) => setUpgradePassword(e.target.value)}
                      placeholder="Minimal 6 karakter"
                      required
                      minLength={6}
                      className="w-full px-3.5 py-2.5 bg-[#0c0e14] text-xs text-slate-100 rounded-xl border border-white/10 focus:border-indigo-500 focus:outline-none transition-colors"
                    />
                    {upgradePassword.length > 0 && (
                      <div className="mt-1.5 flex items-center space-x-2">
                        <div className="flex-1 h-1.5 bg-[#0c0e14] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              upgradePassword.length < 6 ? 'w-1/4 bg-rose-500' :
                              upgradePassword.length < 10 ? 'w-2/4 bg-amber-500' :
                              upgradePassword.length < 14 ? 'w-3/4 bg-emerald-500' :
                              'w-full bg-cyan-400'
                            }`}
                          />
                        </div>
                        <span className={`text-[10px] font-bold ${
                          upgradePassword.length < 6 ? 'text-rose-400' :
                          upgradePassword.length < 10 ? 'text-amber-400' :
                          'text-emerald-400'
                        }`}>
                          {upgradePassword.length < 6 ? 'Terlalu pendek' :
                           upgradePassword.length < 10 ? 'Cukup' :
                           upgradePassword.length < 14 ? 'Kuat' : 'Sangat kuat'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      <Lock size={12} className="inline mr-1" /> Konfirmasi Password
                    </label>
                    <input
                      type="password"
                      value={upgradePasswordConfirm}
                      onChange={(e) => setUpgradePasswordConfirm(e.target.value)}
                      placeholder="Ketik ulang password"
                      required
                      className={`w-full px-3.5 py-2.5 bg-[#0c0e14] text-xs text-slate-100 rounded-xl border focus:outline-none transition-colors ${
                        upgradePasswordConfirm && upgradePasswordConfirm !== upgradePassword
                          ? 'border-rose-500'
                          : upgradePasswordConfirm && upgradePasswordConfirm === upgradePassword
                          ? 'border-emerald-500'
                          : 'border-white/10 focus:border-indigo-500'
                      }`}
                    />
                    {upgradePasswordConfirm && upgradePasswordConfirm !== upgradePassword && (
                      <span className="text-[10px] text-rose-400 mt-1">Password tidak cocok</span>
                    )}
                  </div>

                  {/* Submit */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isUpgrading || !isCodeSent || !verificationCode || !upgradePassword || upgradePassword !== upgradePasswordConfirm}
                      className="w-full py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 disabled:opacity-40 text-white text-xs font-bold rounded-xl shadow-lg shadow-amber-600/25 transition-all cursor-pointer flex items-center justify-center space-x-2"
                    >
                      <Rocket size={14} />
                      <span>{isUpgrading ? 'Memproses Upgrade...' : 'Tingkatkan ke Akun Permanen'}</span>
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Image Crop & Upload Modal */}
      <ImageUploadCropModal
        isOpen={!!cropTarget}
        title={cropTarget === 'avatar' ? 'Crop & Kompres Avatar Foto' : 'Pilih & Pasang Banner Profil'}
        aspectRatio={cropTarget === 'avatar' ? 'circle' : 'banner'}
        maxDimension={cropTarget === 'avatar' ? 400 : 800}
        onClose={() => setCropTarget(null)}
        onImageUploaded={(url) => {
          if (cropTarget === 'avatar') {
            setAvatar(url);
          } else if (cropTarget === 'banner') {
            setBannerColor(url);
          }
          setCropTarget(null);
        }}
      />

      {/* 2FA Setup Modal (Google Authenticator or Security Key File) */}
      <Setup2FAModal
        isOpen={show2FASetupModal}
        onClose={() => setShow2FASetupModal(false)}
        onSuccess={async () => {
          setIs2FAEnabled(true);
          await updateProfile({});
        }}
      />

      {/* 2FA Disable Modal (Requires active TOTP code or matching .aerocord-key file) */}
      <Disable2FAModal
        isOpen={showDisable2FAModal}
        onClose={() => setShowDisable2FAModal(false)}
        onSuccess={async () => {
          setIs2FAEnabled(false);
          await updateProfile({});
        }}
        twoFactorType={twoFactorType}
      />
    </div>
  );
};

