import React, { useState, useEffect } from 'react';
import { Server, ChannelCategory, Role } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ImageUploadCropModal } from './ImageUploadCropModal';
import { X, Settings, ShieldCheck, Hash, Volume2, Trash2, FolderPlus, Users, Crown, Image, AlertTriangle, Check, Upload } from 'lucide-react';
import { apiUrl } from '../../config/api';

interface ServerSettingsModalProps {
  server: Server | null;
  isOpen: boolean;
  onClose: () => void;
  onServerUpdated: (updatedServer: Server) => void;
  onServerDeleted: (serverId: string) => void;
}

type TabType = 'overview' | 'categories' | 'members' | 'danger';

export const ServerSettingsModal: React.FC<ServerSettingsModalProps> = ({
  server,
  isOpen,
  onClose,
  onServerUpdated,
  onServerDeleted
}) => {
  const { user } = useAuth();
  const { showSuccess, showError, showInfo } = useToast();

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [description, setDescription] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [loading, setLoading] = useState(false);
  const [isIconUploadOpen, setIsIconUploadOpen] = useState(false);
  const [confirmDeleteName, setConfirmDeleteName] = useState('');

  useEffect(() => {
    if (server) {
      setName(server.name);
      setIcon(server.icon || '');
      setDescription(server.description || '');
    }
  }, [server, isOpen]);

  if (!isOpen || !server) return null;

  const isOwner = server.ownerId === user?.id;

  const handleSaveOverview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/servers/${server.id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('aerocord_token')}`
        },
        body: JSON.stringify({ name: name.trim(), icon: icon.trim(), description: description.trim() })
      });
      const data = await res.json();
      if (res.ok && data.server) {
        onServerUpdated(data.server);
        showSuccess('Pengaturan Disimpan', 'Informasi server berhasil diperbarui.');
      } else {
        showError('Gagal Menyimpan', data.error || 'Terjadi kesalahan');
      }
    } catch (err: any) {
      showError('Kesalahan Jaringan', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    try {
      const res = await fetch(apiUrl(`/api/servers/${server.id}/categories`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('aerocord_token')}`
        },
        body: JSON.stringify({ name: newCategoryName.trim() })
      });
      const data = await res.json();
      if (res.ok && data.server) {
        onServerUpdated(data.server);
        showSuccess('Group Channel Dibuat', `Group "${newCategoryName}" berhasil ditambahkan.`);
        setNewCategoryName('');
      } else {
        showError('Gagal Membuat Group', data.error);
      }
    } catch (err: any) {
      showError('Kesalahan', err.message);
    }
  };

  const handleDeleteServer = async () => {
    if (confirmDeleteName !== server.name) {
      showInfo('Nama Tidak Cocok', 'Ketik nama server dengan tepat untuk konfirmasi.');
      return;
    }

    try {
      const res = await fetch(apiUrl(`/api/servers/${server.id}`), {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('aerocord_token')}`
        }
      });
      if (res.ok) {
        showSuccess('Server Dihapus', `Server ${server.name} telah dihapus.`);
        onServerDeleted(server.id);
        onClose();
      } else {
        const data = await res.json();
        showError('Gagal Menghapus Server', data.error);
      }
    } catch (err: any) {
      showError('Kesalahan', err.message);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl h-[560px] bg-[#13161f] rounded-3xl shadow-2xl overflow-hidden border border-white/10 text-white flex flex-col md:flex-row animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left Settings Sidebar */}
        <div className="w-full md:w-56 bg-[#0c0e14] p-4 border-r border-white/5 flex flex-col justify-between flex-shrink-0">
          <div>
            <div className="px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-400">
              {server.name}
            </div>

            <div className="space-y-1 mt-2">
              <button
                onClick={() => setActiveTab('overview')}
                className={`w-full px-3 py-2.5 rounded-xl flex items-center space-x-2.5 text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'overview'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                }`}
              >
                <Settings size={15} />
                <span>Overview Server</span>
              </button>

              <button
                onClick={() => setActiveTab('categories')}
                className={`w-full px-3 py-2.5 rounded-xl flex items-center space-x-2.5 text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'categories'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                }`}
              >
                <FolderPlus size={15} />
                <span>Group & Kategori</span>
              </button>

              <button
                onClick={() => setActiveTab('members')}
                className={`w-full px-3 py-2.5 rounded-xl flex items-center space-x-2.5 text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'members'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                }`}
              >
                <Users size={15} />
                <span>Daftar Anggota</span>
              </button>

              {isOwner && (
                <button
                  onClick={() => setActiveTab('danger')}
                  className={`w-full px-3 py-2.5 rounded-xl flex items-center space-x-2.5 text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'danger'
                      ? 'bg-rose-600 text-white shadow-md'
                      : 'text-rose-400 hover:text-rose-300 hover:bg-rose-500/10'
                  }`}
                >
                  <Trash2 size={15} />
                  <span>Hapus Server</span>
                </button>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer text-left"
          >
            Tutup Pengaturan
          </button>
        </div>

        {/* Right Tab Content */}
        <div className="flex-1 flex flex-col h-full bg-[#13161f] overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-base font-bold text-white">
              {activeTab === 'overview' && 'Pengaturan Overview'}
              {activeTab === 'categories' && 'Kelola Group & Kategori Channel'}
              {activeTab === 'members' && `Daftar Anggota Server (${server.members.length})`}
              {activeTab === 'danger' && 'Zona Berbahaya'}
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <form onSubmit={handleSaveOverview} className="space-y-4 max-w-lg">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                    Nama Server
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    disabled={!isOwner}
                    className="w-full px-3.5 py-2.5 bg-[#0c0e14] text-sm text-slate-100 rounded-xl border border-white/10 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                    Ikon Server
                  </label>
                  <div className="flex items-center space-x-4 mb-3">
                    {icon ? (
                      <img src={icon} alt="Server icon" className="w-16 h-16 rounded-2xl object-cover border-2 border-indigo-500/50" />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-[#0c0e14] border border-white/10 flex items-center justify-center text-slate-500">
                        <Image size={24} />
                      </div>
                    )}
                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => setIsIconUploadOpen(true)}
                        className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center space-x-2 transition-colors cursor-pointer shadow-lg"
                      >
                        <Upload size={14} />
                        <span>Upload Gambar</span>
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    placeholder="Atau masukkan URL gambar..."
                    disabled={!isOwner}
                    className="w-full px-3.5 py-2.5 bg-[#0c0e14] text-sm text-slate-100 rounded-xl border border-white/10 focus:border-indigo-500 focus:outline-none text-[11px]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                    Deskripsi Server
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder="Tentang server ini..."
                    disabled={!isOwner}
                    className="w-full px-3.5 py-2.5 bg-[#0c0e14] text-sm text-slate-100 rounded-xl border border-white/10 focus:border-indigo-500 focus:outline-none resize-none"
                  />
                </div>

                {isOwner && (
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer"
                    >
                      {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
                    </button>
                  </div>
                )}
              </form>
            )}

            {/* CATEGORIES & GROUPS TAB */}
            {activeTab === 'categories' && (
              <div className="space-y-6 max-w-lg">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                    Tambah Group Channel Baru
                  </h3>
                  <form onSubmit={handleCreateCategory} className="flex space-x-2">
                    <input
                      type="text"
                      placeholder="Nama group (misal: 🎮 Gaming, 🎵 Music, 📁 Projects)..."
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      className="flex-1 px-3.5 py-2.5 bg-[#0c0e14] text-sm text-slate-100 rounded-xl border border-white/10 focus:border-indigo-500 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={!newCategoryName.trim()}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer whitespace-nowrap"
                    >
                      Tambah Group
                    </button>
                  </form>
                </div>

                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3">
                    Daftar Group yang Ada ({server.categories.length})
                  </h3>
                  <div className="space-y-2">
                    {server.categories.map(cat => {
                      const count = server.channels.filter(c => c.categoryId === cat.id).length;
                      return (
                        <div
                          key={cat.id}
                          className="p-3 bg-[#0c0e14] rounded-xl border border-white/5 flex items-center justify-between"
                        >
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-xs text-white">{cat.name}</span>
                            <span className="text-[10px] text-slate-400">({count} channel)</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* MEMBERS TAB */}
            {activeTab === 'members' && (
              <div className="space-y-2 max-w-lg">
                {server.members.map(m => {
                  const u = m.user;
                  const isSrvOwner = m.userId === server.ownerId;
                  return (
                    <div
                      key={m.userId}
                      className="p-3 bg-[#0c0e14] rounded-xl border border-white/5 flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-3">
                        <img
                          src={u?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${m.userId}`}
                          alt={u?.username || 'User'}
                          className="w-8 h-8 rounded-lg object-cover"
                        />
                        <div>
                          <div className="font-bold text-xs text-white flex items-center space-x-1.5">
                            <span>{u?.username || m.userId}</span>
                            {isSrvOwner && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold border border-amber-500/30 flex items-center space-x-1">
                                <Crown size={10} />
                                <span>Owner</span>
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            Bergabung: {new Date(m.joinedAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* DANGER ZONE TAB */}
            {activeTab === 'danger' && isOwner && (
              <div className="space-y-4 max-w-lg p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30">
                <div className="flex items-center space-x-2 text-rose-400 font-bold text-sm">
                  <AlertTriangle size={18} />
                  <span>Hapus Server Secara Permanen</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Tindakan ini tidak dapat dibatalkan. Seluruh channel, pesan, dan data di server ini akan dihapus secara permanen.
                </p>
                <div className="mt-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Ketik <span className="text-rose-300 font-mono">"{server.name}"</span> untuk konfirmasi
                  </label>
                  <input
                    type="text"
                    value={confirmDeleteName}
                    onChange={(e) => setConfirmDeleteName(e.target.value)}
                    placeholder={server.name}
                    className="w-full px-3.5 py-2.5 bg-[#0c0e14] text-xs text-slate-100 rounded-xl border border-rose-500/30 focus:border-rose-500 focus:outline-none transition-colors font-mono"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleDeleteServer}
                  disabled={confirmDeleteName !== server.name}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer"
                >
                  Hapus Server Ini
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Image Upload Modal for Server Icon */}
      <ImageUploadCropModal
        isOpen={isIconUploadOpen}
        title="Upload Ikon Server"
        aspectRatio="square"
        maxDimension={256}
        onClose={() => setIsIconUploadOpen(false)}
        onImageUploaded={(url) => {
          setIcon(url);
          setIsIconUploadOpen(false);
        }}
      />
    </div>
  );
};

