import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, Key, Smartphone, FileCheck, Download, Copy, Check, AlertCircle, Loader2, QrCode } from 'lucide-react';
import QRCode from 'qrcode';
import { useToast } from '../../context/ToastContext';
import { apiUrl } from '../../config/api';

interface Setup2FAModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const Setup2FAModal: React.FC<Setup2FAModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { showSuccess, showError } = useToast();

  const [step, setStep] = useState<'choose' | 'google' | 'file'>('choose');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Google Auth states
  const [googleSecret, setGoogleSecret] = useState('');
  const [googleOtpauth, setGoogleOtpauth] = useState('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [googleViewMode, setGoogleViewMode] = useState<'qr' | 'manual'>('qr');
  const [googleCode, setGoogleCode] = useState('');
  const [copiedSecret, setCopiedSecret] = useState(false);

  // File Key states
  const [fileContent, setFileContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileDownloaded, setFileDownloaded] = useState(false);

  // Auto-reset form on close or open
  useEffect(() => {
    if (!isOpen) {
      setStep('choose');
      setLoading(false);
      setError('');
      setGoogleSecret('');
      setGoogleOtpauth('');
      setQrCodeDataUrl('');
      setGoogleViewMode('qr');
      setGoogleCode('');
      setCopiedSecret(false);
      setFileContent('');
      setFileName('');
      setFileDownloaded(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartGoogleAuth = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(apiUrl('/api/auth/2fa/setup/google'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('aerocord_token')}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        setGoogleSecret(data.secret);
        setGoogleOtpauth(data.otpauthUrl);

        try {
          const qrDataUrl = await QRCode.toDataURL(data.otpauthUrl, {
            margin: 2,
            width: 240,
            color: {
              dark: '#0f172a',
              light: '#ffffff'
            }
          });
          setQrCodeDataUrl(qrDataUrl);
        } catch (qrErr) {
          console.error('Failed to generate QR code:', qrErr);
        }

        setStep('google');
      } else {
        setError(data.error || 'Gagal memulai setup Google Authenticator');
      }
    } catch (err: any) {
      setError(err.message || 'Kesalahan jaringan');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmGoogleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleCode.trim() || googleCode.length !== 6) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(apiUrl('/api/auth/2fa/confirm/google'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('aerocord_token')}`
        },
        body: JSON.stringify({ code: googleCode.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        showSuccess('2FA Google Authenticator Aktif', 'Akun Anda kini dilindungi dengan Google Authenticator!');
        onSuccess();
        onClose();
      } else {
        setError(data.error || 'Kode verifikasi tidak valid.');
      }
    } catch (err: any) {
      setError(err.message || 'Kesalahan jaringan');
    } finally {
      setLoading(false);
    }
  };

  const handleStartFileKey = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(apiUrl('/api/auth/2fa/setup/file'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('aerocord_token')}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        setFileContent(data.fileContent);
        setFileName(data.filename);
        setStep('file');
      } else {
        setError(data.error || 'Gagal membuat file kunci keamanan');
      }
    } catch (err: any) {
      setError(err.message || 'Kesalahan jaringan');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadKeyFile = () => {
    if (!fileContent) return;
    const blob = new Blob([fileContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'aerocord-security-key.aerocord-key';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setFileDownloaded(true);
    showSuccess('File Kunci Diunduh', `File ${fileName} berhasil disimpan di perangkat Anda.`);
  };

  const handleConfirmFileKey = async () => {
    if (!fileDownloaded) {
      setError('Silakan unduh file kunci keamanan Anda terlebih dahulu sebelum mengaktifkan.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(apiUrl('/api/auth/2fa/confirm/file'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('aerocord_token')}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        showSuccess('2FA File Kunci Aktif', 'Akun Anda kini dilindungi dengan File Kunci Keamanan!');
        onSuccess();
        onClose();
      } else {
        setError(data.error || 'Gagal mengaktifkan file kunci.');
      }
    } catch (err: any) {
      setError(err.message || 'Kesalahan jaringan');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200 select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#13161f] rounded-3xl shadow-2xl overflow-hidden border border-white/10 text-white animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Setup Autentikasi Dua Langkah (2FA)</h3>
              <p className="text-[11px] text-slate-400">Pilih metode verifikasi keamanan akun Anda</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300 flex items-center space-x-2">
            <AlertCircle size={16} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-6">
          {/* STEP 1: CHOOSE METHOD */}
          {step === 'choose' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                Autentikasi dua langkah menambahkan lapisan keamanan ekstra dengan meminta verifikasi tambahan setiap kali Anda login.
              </p>

              <div className="space-y-3 pt-2">
                {/* Method 1: Google Authenticator */}
                <button
                  type="button"
                  onClick={handleStartGoogleAuth}
                  disabled={loading}
                  className="w-full p-4 rounded-2xl bg-[#0c0e14] hover:bg-white/[0.04] border border-white/10 hover:border-indigo-500/50 transition-all text-left flex items-start space-x-3.5 group cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 flex-shrink-0 group-hover:scale-105 transition-transform">
                    <Smartphone size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-white group-hover:text-indigo-400 transition-colors flex items-center space-x-2">
                      <span>Google Authenticator / TOTP</span>
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-semibold">Rekomendasi</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      Gunakan aplikasi authenticator seperti Google Authenticator, Microsoft Authenticator, atau Authy untuk memindai kode 6 digit.
                    </p>
                  </div>
                </button>

                {/* Method 2: Security Key File (.aerocord-key) */}
                <button
                  type="button"
                  onClick={handleStartFileKey}
                  disabled={loading}
                  className="w-full p-4 rounded-2xl bg-[#0c0e14] hover:bg-white/[0.04] border border-white/10 hover:border-amber-500/50 transition-all text-left flex items-start space-x-3.5 group cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 flex-shrink-0 group-hover:scale-105 transition-transform">
                    <FileCheck size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-white group-hover:text-amber-400 transition-colors">
                      File Kunci Keamanan (.aerocord-key)
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      Unduh file kunci kriptografi digital 256-bit. Cukup unggah file ini saat login untuk verifikasi instan.
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* STEP 2A: GOOGLE AUTHENTICATOR SETUP */}
          {step === 'google' && (
            <form onSubmit={handleConfirmGoogleAuth} className="space-y-4">
              {/* QR / Manual Switcher */}
              <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-[#0c0e14] border border-white/5">
                <button
                  type="button"
                  onClick={() => setGoogleViewMode('qr')}
                  className={`py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                    googleViewMode === 'qr'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <QrCode size={14} />
                  <span>Pindai QR Code</span>
                </button>
                <button
                  type="button"
                  onClick={() => setGoogleViewMode('manual')}
                  className={`py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                    googleViewMode === 'manual'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Key size={14} />
                  <span>Input Manual</span>
                </button>
              </div>

              {googleViewMode === 'qr' ? (
                <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-[#0c0e14] border border-white/5 space-y-3">
                  {qrCodeDataUrl ? (
                    <div className="p-3 bg-white rounded-2xl shadow-xl border border-white/20">
                      <img
                        src={qrCodeDataUrl}
                        alt="2FA QR Code"
                        className="w-44 h-44 object-contain rounded-lg"
                      />
                    </div>
                  ) : (
                    <div className="w-44 h-44 bg-slate-800 animate-pulse rounded-2xl flex items-center justify-center text-slate-400 text-xs">
                      Memuat QR...
                    </div>
                  )}
                  <p className="text-[11px] text-slate-400 text-center max-w-[260px] leading-relaxed">
                    Buka aplikasi <span className="text-indigo-400 font-semibold">Google Authenticator</span> di HP Anda lalu pindai kode QR di atas.
                  </p>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-[#0c0e14] border border-white/5 space-y-2">
                  <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                    Kode Rahasia (Secret Key)
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#13161f] border border-white/10 font-mono text-xs text-indigo-300 tracking-wider">
                    <span className="truncate">{googleSecret}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(googleSecret)}
                      className="p-1 text-slate-400 hover:text-white rounded transition-colors cursor-pointer ml-2"
                      title="Salin Kunci"
                    >
                      {copiedSecret ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Ketik kode rahasia di atas pada aplikasi Google Authenticator Anda (Account: AeroCord).
                  </p>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 text-center">
                  Masukkan Kode 6-Digit dari Aplikasi
                </label>
                <input
                  type="text"
                  value={googleCode}
                  onChange={(e) => setGoogleCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  maxLength={6}
                  autoFocus
                  required
                  className="w-full px-4 py-3 bg-[#0c0e14] text-center text-lg text-slate-100 rounded-xl border border-white/10 focus:border-indigo-500 focus:outline-none font-mono tracking-[0.4em] transition-colors"
                />
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep('choose')}
                  className="flex-1 py-2.5 bg-[#0c0e14] hover:bg-white/5 text-slate-300 hover:text-white text-xs font-bold rounded-xl border border-white/5 transition-colors cursor-pointer"
                >
                  Kembali
                </button>
                <button
                  type="submit"
                  disabled={loading || googleCode.length !== 6}
                  className="flex-1 py-2.5 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 disabled:opacity-40 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/25 transition-all cursor-pointer flex items-center justify-center space-x-1.5"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  <span>{loading ? 'Memverifikasi...' : 'Aktifkan 2FA'}</span>
                </button>
              </div>
            </form>
          )}

          {/* STEP 2B: SECURITY KEY FILE SETUP */}
          {step === 'file' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                <div className="flex items-center space-x-2 text-xs font-bold text-amber-200">
                  <FileCheck size={16} />
                  <span>File Kunci Kriptografi Siap</span>
                </div>
                <p className="text-[11px] text-amber-300/80 leading-relaxed">
                  File ini berisi tanda tangan digital HMAC-SHA256 untuk memverifikasi identitas Anda saat login. Unduh dan simpan di lokasi yang aman (USB Drive / Folder Aman).
                </p>
              </div>

              <button
                type="button"
                onClick={handleDownloadKeyFile}
                className="w-full py-3 bg-[#0c0e14] hover:bg-white/[0.04] border border-white/10 hover:border-amber-500/50 text-white text-xs font-bold rounded-2xl flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-md"
              >
                <Download size={16} className={fileDownloaded ? 'text-emerald-400' : 'text-amber-400'} />
                <span>{fileDownloaded ? `Unduh Ulang (${fileName}) ✓` : `Unduh ${fileName}`}</span>
              </button>

              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep('choose')}
                  className="flex-1 py-2.5 bg-[#0c0e14] hover:bg-white/5 text-slate-300 hover:text-white text-xs font-bold rounded-xl border border-white/5 transition-colors cursor-pointer"
                >
                  Kembali
                </button>
                <button
                  type="button"
                  onClick={handleConfirmFileKey}
                  disabled={loading || !fileDownloaded}
                  className="flex-1 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 disabled:opacity-40 text-white text-xs font-bold rounded-xl shadow-lg shadow-amber-600/25 transition-all cursor-pointer flex items-center justify-center space-x-1.5"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  <span>{loading ? 'Mengaktifkan...' : 'Konfirmasi & Aktifkan'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

