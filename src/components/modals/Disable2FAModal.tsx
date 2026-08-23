import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, Smartphone, FileCheck, Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { apiUrl } from '../../config/api';

interface Disable2FAModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  twoFactorType?: 'google' | 'file' | 'email';
}

export const Disable2FAModal: React.FC<Disable2FAModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  twoFactorType = 'google'
}) => {
  const { showSuccess } = useToast();

  const [code, setCode] = useState('');
  const [keyFileName, setKeyFileName] = useState('');
  const [keyFileContent, setKeyFileContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Reset form when modal opens or closes
  useEffect(() => {
    if (!isOpen) {
      setCode('');
      setKeyFileName('');
      setKeyFileContent('');
      setError('');
      setLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

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

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload: { code?: string; keyFileContent?: string } = {};
      if (twoFactorType === 'file') {
        if (!keyFileContent) {
          setError('Silakan pilih file kunci keamanan (.aerocord-key) Anda.');
          setLoading(false);
          return;
        }
        payload.keyFileContent = keyFileContent;
      } else {
        if (!code.trim() || code.length !== 6) {
          setError('Masukkan 6-digit kode verifikasi dari Google Authenticator.');
          setLoading(false);
          return;
        }
        payload.code = code.trim();
      }

      const res = await fetch(apiUrl('/api/auth/2fa/disable'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('aerocord_token')}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        showSuccess('2FA Dinonaktifkan', data.message || 'Autentikasi Dua Langkah berhasil dinonaktifkan.');
        // Auto-reset form
        setCode('');
        setKeyFileName('');
        setKeyFileContent('');
        setError('');
        onSuccess();
        onClose();
      } else {
        setError(data.error || 'Gagal menonaktifkan 2FA.');
      }
    } catch (err: any) {
      setError(err.message || 'Kesalahan jaringan.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200 select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-[#13161f] rounded-3xl shadow-2xl overflow-hidden border border-white/10 text-white animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
              <ShieldAlert size={20} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Nonaktifkan 2FA</h3>
              <p className="text-[11px] text-slate-400">Verifikasi keamanan identitas akun</p>
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

        <form onSubmit={handleDisable} className="p-6 space-y-4">
          <p className="text-xs text-slate-300 leading-relaxed">
            {twoFactorType === 'file'
              ? 'Untuk menonaktifkan 2FA, silakan unggah file kunci (.aerocord-key) yang sama dengan saat Anda mengaktifkannya.'
              : 'Untuk menonaktifkan 2FA, masukkan 6 digit kode aktif dari aplikasi Google Authenticator Anda.'}
          </p>

          {twoFactorType === 'file' ? (
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 text-center">
                Pilih File Kunci (.aerocord-key)
              </label>
              <label className="w-full p-4 rounded-2xl bg-[#0c0e14] hover:bg-white/[0.04] border-2 border-dashed border-white/15 hover:border-rose-500/50 flex flex-col items-center justify-center text-center cursor-pointer transition-all">
                <input
                  type="file"
                  accept=".aerocord-key,.json"
                  onChange={handleKeyFileUpload}
                  className="hidden"
                />
                <FileCheck size={24} className={keyFileName ? 'text-emerald-400 mb-1' : 'text-rose-400 mb-1'} />
                <span className="text-xs font-bold text-white truncate max-w-full">
                  {keyFileName ? keyFileName : 'Klik atau Tarik File .aerocord-key'}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5">
                  {keyFileName ? 'File kunci siap diverifikasi ✓' : 'File tanda tangan digital'}
                </span>
              </label>
            </div>
          ) : (
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 text-center">
                Kode Google Authenticator
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                maxLength={6}
                autoFocus
                required
                className="w-full px-4 py-3 bg-[#0c0e14] text-center text-lg text-slate-100 rounded-xl border border-white/10 focus:border-rose-500 focus:outline-none font-mono tracking-[0.4em] transition-colors"
              />
            </div>
          )}

          <div className="flex items-center space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-[#0c0e14] hover:bg-white/5 text-slate-300 hover:text-white text-xs font-bold rounded-xl border border-white/5 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading || (twoFactorType === 'file' ? !keyFileContent : code.length !== 6)}
              className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/25 transition-all cursor-pointer flex items-center justify-center space-x-1.5"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : null}
              <span>{loading ? 'Memverifikasi...' : 'Nonaktifkan 2FA'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

