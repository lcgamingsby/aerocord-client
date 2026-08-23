import React, { useState, useEffect } from 'react';
import { X, MessageSquare, Volume2, Hash } from 'lucide-react';
import { Channel, ChannelCategory } from '../../types';
import { useToast } from '../../context/ToastContext';
import { apiUrl } from '../../config/api';

interface CreateChannelModalProps {
  isOpen: boolean;
  serverId: string;
  categories: ChannelCategory[];
  defaultCategoryId?: string;
  initialType?: 'text' | 'voice';
  onClose: () => void;
  onChannelCreated: (channel: Channel) => void;
}

export const CreateChannelModal: React.FC<CreateChannelModalProps> = ({
  isOpen,
  serverId,
  categories,
  defaultCategoryId,
  initialType = 'text',
  onClose,
  onChannelCreated
}) => {
  const { showSuccess, showError } = useToast();
  const type = initialType; // Strictly locked to the selected type
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [categoryId, setCategoryId] = useState(defaultCategoryId || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (defaultCategoryId) {
      setCategoryId(defaultCategoryId);
    } else {
      const matchCat = categories.find(c =>
        initialType === 'voice'
          ? c.name.toLowerCase().includes('voice')
          : c.name.toLowerCase().includes('text')
      );
      setCategoryId(matchCat ? matchCat.id : (categories[0]?.id || ''));
    }
    setName('');
    setTopic('');
    setError('');
  }, [initialType, defaultCategoryId, categories, isOpen]);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch(apiUrl(`/api/servers/${serverId}/channels`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('aerocord_token')}`
        },
        body: JSON.stringify({
          name: name.trim(),
          type,
          categoryId: categoryId || undefined,
          topic: topic.trim() || undefined
        })
      });
      const data = await res.json();
      if (res.ok && data.channel) {
        onChannelCreated(data.channel);
        showSuccess(
          `${type === 'text' ? 'Text' : 'Voice'} Channel Berhasil Dibuat`,
          `Channel #${data.channel.name} siap digunakan.`
        );
        onClose();
        setName('');
        setTopic('');
      } else {
        const errMsg = data.error || 'Gagal membuat channel';
        setError(errMsg);
        showError('Gagal Membuat Channel', errMsg);
      }
    } catch (err: any) {
      const errMsg = err.message || 'Terjadi kesalahan jaringan';
      setError(errMsg);
      showError('Kesalahan Jaringan', errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#13161f] rounded-3xl shadow-2xl overflow-hidden border border-white/10 text-white animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Dedicated Header for specific channel type */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`p-2.5 rounded-2xl ${type === 'text' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
              {type === 'text' ? <Hash size={22} /> : <Volume2 size={22} />}
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {type === 'text' ? 'Tambah Text Channel' : 'Tambah Voice Channel'}
              </h2>
              <p className="text-xs text-slate-400">
                {type === 'text' ? 'Buat ruang kirim pesan teks, gambar, dan stiker' : 'Buat ruang panggilan suara WebRTC realtime'}
              </p>
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
          <div className="mx-6 mt-4 p-3 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-xs text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleCreate} className="p-6 space-y-4">
          {/* Channel Name */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              Nama Channel <span className="text-rose-400">*</span>
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-slate-400">
                {type === 'text' ? <Hash size={16} /> : <Volume2 size={16} />}
              </span>
              <input
                type="text"
                placeholder={type === 'text' ? 'misal: ngobrol-santai, info' : 'misal: Gaming Lounge, Music Room'}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                className="w-full pl-10 pr-3.5 py-2.5 bg-[#0c0e14] text-sm text-slate-100 rounded-xl border border-white/10 focus:border-indigo-500 focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Category Selector */}
          {categories.length > 0 && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                Kategori Channel
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#0c0e14] text-sm text-slate-100 rounded-xl border border-white/10 focus:border-indigo-500 focus:outline-none"
              >
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Topic (Only for text channels) */}
          {type === 'text' && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                Topik Channel (Opsional)
              </label>
              <input
                type="text"
                placeholder="Deskripsi ringkas topik channel ini"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#0c0e14] text-sm text-slate-100 rounded-xl border border-white/10 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          )}

          <div className="pt-3 flex justify-between items-center">
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className={`px-6 py-2.5 text-white text-xs font-bold rounded-xl shadow-lg transition-all cursor-pointer disabled:opacity-50 ${
                type === 'text'
                  ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/25'
                  : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/25'
              }`}
            >
              {loading ? 'Menambahkan...' : `Buat ${type === 'text' ? 'Text' : 'Voice'} Channel`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

