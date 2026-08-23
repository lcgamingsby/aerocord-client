import React, { useState, useEffect } from 'react';
import { X, Sparkles, Compass, ShieldAlert, Upload, Image } from 'lucide-react';
import { Server } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ImageUploadCropModal } from './ImageUploadCropModal';
import { apiUrl } from '../../config/api';

interface CreateServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onServerCreated: (server: Server) => void;
}

export const CreateServerModal: React.FC<CreateServerModalProps> = ({
  isOpen,
  onClose,
  onServerCreated
}) => {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isCropOpen, setIsCropOpen] = useState(false);

  const isGuestUser = user?.isGuest || user?.id.startsWith('guest_') || user?.email.endsWith('@guest.aerocord.app');

  useEffect(() => {
    if (!isOpen) {
      setName('');
      setIcon('');
      setInviteCode('');
      setError('');
      setLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (isGuestUser) {
      setError('Akun tamu tidak dapat membuat server baru. Silakan tingkatkan akun Anda ke akun permanen terlebih dahulu di pengaturan akun.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await fetch(apiUrl('/api/servers'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('aerocord_token')}`
        },
        body: JSON.stringify({ name: name.trim(), icon: icon.trim() || undefined })
      });
      const data = await res.json();
      if (res.ok && data.server) {
        onServerCreated(data.server);
        showSuccess('Server Berhasil Dibuat', `Server ${data.server.name} siap digunakan.`);
        // Auto-reset form
        setName('');
        setIcon('');
        setInviteCode('');
        setError('');
        onClose();
      } else {
        const errMsg = data.error || 'Gagal membuat server';
        setError(errMsg);
        showError('Gagal Membuat Server', errMsg);
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;

    setLoading(true);
    setError('');
    try {
      const res = await fetch(apiUrl('/api/servers/join'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('aerocord_token')}`
        },
        body: JSON.stringify({ inviteCode: inviteCode.trim() })
      });
      const data = await res.json();
      if (res.ok && data.server) {
        onServerCreated(data.server);
        showSuccess('Berhasil Bergabung', `Anda telah bergabung dengan server ${data.server.name}.`);
        // Auto-reset form
        setName('');
        setIcon('');
        setInviteCode('');
        setError('');
        onClose();
      } else {
        setError(data.error || 'Gagal bergabung ke server');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200 select-none">
      <div className="w-full max-w-md bg-[#13161f] rounded-3xl shadow-2xl overflow-hidden border border-white/10 text-white">
        {/* Header */}
        <div className="p-6 text-center relative border-b border-white/5">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
          <h2 className="text-xl font-bold mb-1">
            {tab === 'create' ? 'Buat Server Baru' : 'Gabung ke Server'}
          </h2>
          <p className="text-xs text-slate-400">
            {tab === 'create'
              ? 'Server adalah ruang tempat Anda dan teman-teman nongkrong, voice chat, dan bermain bersama.'
              : 'Masukkan kode undangan untuk bergabung ke server yang sudah ada.'}
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-white/5 bg-[#0c0e14]/50">
          <button
            onClick={() => { setTab('create'); setError(''); }}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-2 border-b-2 transition-colors cursor-pointer ${
              tab === 'create' ? 'border-indigo-500 text-white bg-[#13161f]' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles size={15} />
            <span>Buat Baru</span>
          </button>
          <button
            onClick={() => { setTab('join'); setError(''); }}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-2 border-b-2 transition-colors cursor-pointer ${
              tab === 'join' ? 'border-indigo-500 text-white bg-[#13161f]' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Compass size={15} />
            <span>Pakai Kode</span>
          </button>
        </div>

        {/* Guest Warning */}
        {tab === 'create' && isGuestUser && (
          <div className="mx-6 mt-4 p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-xs text-amber-300 flex items-start space-x-2.5">
            <ShieldAlert size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-amber-200">Batasan Akun Tamu</div>
              <div>Akun tamu hanya dapat bergabung ke server, tidak dapat membuat server baru. Silakan tingkatkan akun Anda ke akun permanen di pengaturan profil.</div>
            </div>
          </div>
        )}

        {/* Error notice */}
        {error && (
          <div className="mx-6 mt-4 p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300 flex items-start space-x-2">
            <ShieldAlert size={16} className="text-rose-400 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Body */}
        {tab === 'create' ? (
          <form onSubmit={handleCreate} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                Nama Server <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                placeholder="Contoh: Aero Gaming Hub"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={isGuestUser}
                className="w-full px-3.5 py-2.5 bg-[#0c0e14] text-sm text-slate-100 rounded-xl border border-white/10 focus:border-indigo-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Server Icon Upload */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                Ikon Server
              </label>
              <div className="flex items-center space-x-4">
                {icon ? (
                  <div className="relative group">
                    <img src={icon} alt="Server preview" className="w-16 h-16 rounded-2xl object-cover border-2 border-indigo-500 shadow-md" />
                    <button
                      type="button"
                      onClick={() => setIcon('')}
                      className="absolute -top-1.5 -right-1.5 p-1 bg-rose-600 hover:bg-rose-500 text-white rounded-full cursor-pointer shadow"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-[#0c0e14] border border-white/10 flex items-center justify-center text-slate-500">
                    <Image size={24} />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setIsCropOpen(true)}
                  disabled={isGuestUser}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center space-x-2 transition-colors cursor-pointer shadow-lg shadow-indigo-600/20"
                >
                  <Upload size={14} />
                  <span>Upload Gambar Ikon</span>
                </button>
              </div>
            </div>

            <div className="pt-4 flex justify-between items-center border-t border-white/5">
              <button
                type="button"
                onClick={onClose}
                className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={loading || !name.trim() || isGuestUser}
                className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-lg shadow-indigo-600/25"
              >
                {loading ? 'Membuat Server...' : 'Buat Server'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleJoin} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                Kode Undangan <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                placeholder="Contoh: AERO-2026"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-[#0c0e14] text-sm text-slate-100 rounded-xl border border-white/10 focus:border-indigo-500 focus:outline-none uppercase font-mono tracking-widest"
              />
            </div>

            <div className="p-3.5 bg-[#0c0e14] rounded-2xl border border-white/5 text-xs text-slate-400">
              <div className="font-semibold text-slate-300 mb-1">Coba Kode Server Utama:</div>
              <code className="text-emerald-400 font-mono font-bold">AERO-2026</code> (Aero Headquarters)
            </div>

            <div className="pt-4 flex justify-between items-center border-t border-white/5">
              <button
                type="button"
                onClick={onClose}
                className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={loading || !inviteCode.trim()}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-lg shadow-emerald-600/25"
              >
                {loading ? 'Bergabung...' : 'Gabung Server'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Image Upload & Crop Modal */}
      <ImageUploadCropModal
        isOpen={isCropOpen}
        title="Pilih & Potong Ikon Server"
        aspectRatio="square"
        maxDimension={256}
        onClose={() => setIsCropOpen(false)}
        onImageUploaded={(url) => {
          setIcon(url);
          setIsCropOpen(false);
        }}
      />
    </div>
  );
};

