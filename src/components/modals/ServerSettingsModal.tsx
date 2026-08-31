import React, { useState, useEffect } from 'react';
import { Server, ChannelCategory, Role } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ImageUploadCropModal } from './ImageUploadCropModal';
import { X, Settings, ShieldCheck, Hash, Volume2, Trash2, FolderPlus, Users, Crown, Image, AlertTriangle, Check, Upload, Plus, Shield, Palette, Tag } from 'lucide-react';
import { apiUrl } from '../../config/api';

const generateId = (prefix = 'id') => `${prefix}_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;

interface ServerSettingsModalProps {
  server: Server | null;
  isOpen: boolean;
  onClose: () => void;
  onServerUpdated: (updatedServer: Server) => void;
  onServerDeleted: (serverId: string) => void;
}

type TabType = 'overview' | 'roles' | 'categories' | 'members' | 'danger';

const ROLE_COLOR_PRESETS = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#d946ef', // Fuchsia
  '#ec4899', // Pink
  '#94a3b8'  // Slate
];

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

  // Role Creation States
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleColor, setNewRoleColor] = useState('#6366f1');
  const [newRoleIsAdmin, setNewRoleIsAdmin] = useState(false);
  const [newRoleManageChannels, setNewRoleManageChannels] = useState(false);

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

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;

    const newRole: Role = {
      id: generateId('role'),
      name: newRoleName.trim(),
      color: newRoleColor,
      hoist: true,
      position: (server.roles?.length || 0) + 1,
      permissions: {
        administrator: newRoleIsAdmin,
        manageChannels: newRoleManageChannels || newRoleIsAdmin,
        manageServer: newRoleIsAdmin,
        sendMessages: true,
        embedLinks: true,
        attachFiles: true,
        voiceConnect: true,
        voiceSpeak: true,
        kickMembers: newRoleIsAdmin,
        manageMessages: newRoleIsAdmin
      }
    };

    const updatedRoles = [...(server.roles || []), newRole];

    try {
      const res = await fetch(apiUrl(`/api/servers/${server.id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('aerocord_token')}`
        },
        body: JSON.stringify({ roles: updatedRoles })
      });
      const data = await res.json();
      if (res.ok && data.server) {
        onServerUpdated(data.server);
        showSuccess('Role Dibuat', `Role "${newRole.name}" berhasil ditambahkan.`);
        setNewRoleName('');
        setNewRoleColor('#6366f1');
        setNewRoleIsAdmin(false);
        setNewRoleManageChannels(false);
      } else {
        showError('Gagal Membuat Role', data.error);
      }
    } catch (err: any) {
      showError('Kesalahan', err.message);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    const updatedRoles = (server.roles || []).filter(r => r.id !== roleId);
    const updatedMembers = (server.members || []).map(m => ({
      ...m,
      roleIds: m.roleIds.filter(rId => rId !== roleId)
    }));

    try {
      const res = await fetch(apiUrl(`/api/servers/${server.id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('aerocord_token')}`
        },
        body: JSON.stringify({ roles: updatedRoles, members: updatedMembers })
      });
      const data = await res.json();
      if (res.ok && data.server) {
        onServerUpdated(data.server);
        showSuccess('Role Dihapus', 'Role berhasil dihapus.');
      } else {
        showError('Gagal Menghapus Role', data.error);
      }
    } catch (err: any) {
      showError('Kesalahan', err.message);
    }
  };

  const handleToggleMemberRole = async (userId: string, roleId: string) => {
    const updatedMembers = (server.members || []).map(m => {
      if (m.userId === userId) {
        const hasRole = m.roleIds.includes(roleId);
        return {
          ...m,
          roleIds: hasRole ? m.roleIds.filter(id => id !== roleId) : [...m.roleIds, roleId]
        };
      }
      return m;
    });

    try {
      const res = await fetch(apiUrl(`/api/servers/${server.id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('aerocord_token')}`
        },
        body: JSON.stringify({ members: updatedMembers })
      });
      const data = await res.json();
      if (res.ok && data.server) {
        onServerUpdated(data.server);
        showSuccess('Role Diperbarui', 'Role anggota berhasil diubah.');
      } else {
        showError('Gagal Mengubah Role', data.error);
      }
    } catch (err: any) {
      showError('Kesalahan', err.message);
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
    if (confirmDeleteName !== server.name) return;
    try {
      const res = await fetch(apiUrl(`/api/servers/${server.id}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('aerocord_token')}` }
      });
      if (res.ok) {
        onServerDeleted(server.id);
        onClose();
        showSuccess('Server Dihapus', `Server "${server.name}" telah dihapus secara permanen.`);
      }
    } catch (err: any) {
      showError('Kesalahan', err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-3xl h-[85vh] bg-[#13161f] rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col md:flex-row text-slate-100 animate-in zoom-in-95 duration-150">
        {/* Left Sidebar Navigation */}
        <div className="w-full md:w-60 bg-[#0c0e14] p-5 border-r border-white/5 flex flex-col justify-between flex-shrink-0">
          <div>
            <div className="px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-400 mb-2 truncate">
              {server.name}
            </div>

            <div className="space-y-1">
              <button
                onClick={() => setActiveTab('overview')}
                className={`w-full px-3 py-2.5 rounded-xl flex items-center space-x-2.5 text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'overview'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                }`}
              >
                <Settings size={15} />
                <span>Overview</span>
              </button>

              <button
                onClick={() => setActiveTab('roles')}
                className={`w-full px-3 py-2.5 rounded-xl flex items-center space-x-2.5 text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'roles'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                }`}
              >
                <ShieldCheck size={15} />
                <span>Role & Izin</span>
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
                <span>Group Channel</span>
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
              {activeTab === 'roles' && `Kelola Role & Izin (${server.roles?.length || 0})`}
              {activeTab === 'categories' && 'Kelola Group & Kategori Channel'}
              {activeTab === 'members' && `Daftar Anggota Server (${server.members?.length || 0})`}
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
                      <img src={icon} alt="Server icon" className="w-16 h-16 rounded-2xl object-cover border-2 border-indigo-500/50 shadow-md" />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-[#0c0e14] border border-white/10 flex items-center justify-center text-slate-500 font-bold text-lg">
                        {server.name.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => setIsIconUploadOpen(true)}
                        className="px-3.5 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5"
                      >
                        <Upload size={14} />
                        <span>Upload & Crop Ikon</span>
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                    Deskripsi Server
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={!isOwner}
                    rows={3}
                    placeholder="Tulis deskripsi singkat tentang server ini..."
                    className="w-full px-3.5 py-2.5 bg-[#0c0e14] text-sm text-slate-100 rounded-xl border border-white/10 focus:border-indigo-500 focus:outline-none resize-none"
                  />
                </div>

                {isOwner && (
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/25 transition-all cursor-pointer"
                    >
                      {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
                    </button>
                  </div>
                )}
              </form>
            )}

            {/* ROLES TAB */}
            {activeTab === 'roles' && (
              <div className="space-y-6 max-w-xl">
                {/* Create Role Box */}
                {isOwner && (
                  <form onSubmit={handleCreateRole} className="p-4 rounded-2xl bg-[#0c0e14] border border-white/10 space-y-4 shadow-lg">
                    <div className="flex items-center space-x-2 text-indigo-400 font-bold text-xs uppercase tracking-wider">
                      <Plus size={15} />
                      <span>Buat Role Baru</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                          Nama Role
                        </label>
                        <input
                          type="text"
                          value={newRoleName}
                          onChange={(e) => setNewRoleName(e.target.value)}
                          placeholder="Misal: Moderator, VIP, Member..."
                          required
                          className="w-full px-3.5 py-2 bg-[#13161f] text-xs text-white rounded-xl border border-white/10 focus:border-indigo-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                          Warna Role ({newRoleColor})
                        </label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="color"
                            value={newRoleColor}
                            onChange={(e) => setNewRoleColor(e.target.value)}
                            className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                          />
                          <div className="flex-1 flex flex-wrap gap-1">
                            {ROLE_COLOR_PRESETS.slice(0, 7).map(c => (
                              <button
                                key={c}
                                type="button"
                                onClick={() => setNewRoleColor(c)}
                                style={{ backgroundColor: c }}
                                className="w-5 h-5 rounded-full border border-black/30 hover:scale-110 transition-transform cursor-pointer"
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Permissions Toggles */}
                    <div className="space-y-2 pt-1">
                      <label className="flex items-center justify-between p-2.5 rounded-xl bg-[#13161f] border border-white/5 cursor-pointer">
                        <div className="flex items-center space-x-2">
                          <Shield size={14} className="text-rose-400" />
                          <span className="text-xs font-semibold text-white">Administrator (Akses Penuh)</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={newRoleIsAdmin}
                          onChange={(e) => setNewRoleIsAdmin(e.target.checked)}
                          className="w-4 h-4 rounded accent-indigo-600"
                        />
                      </label>

                      <label className="flex items-center justify-between p-2.5 rounded-xl bg-[#13161f] border border-white/5 cursor-pointer">
                        <div className="flex items-center space-x-2">
                          <FolderPlus size={14} className="text-cyan-400" />
                          <span className="text-xs font-semibold text-white">Kelola Channel & Kategori</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={newRoleManageChannels}
                          onChange={(e) => setNewRoleManageChannels(e.target.checked)}
                          className="w-4 h-4 rounded accent-indigo-600"
                        />
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={!newRoleName.trim()}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                    >
                      Tambahkan Role
                    </button>
                  </form>
                )}

                {/* Existing Roles List */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3">
                    Daftar Role Server ({server.roles?.length || 0})
                  </h3>

                  {(!server.roles || server.roles.length === 0) ? (
                    <div className="text-center py-8 text-xs text-slate-500 bg-[#0c0e14] rounded-2xl border border-white/5">
                      Belum ada role kustom yang dibuat di server ini.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {server.roles.map(r => (
                        <div
                          key={r.id}
                          className="p-3 bg-[#0c0e14] rounded-xl border border-white/5 flex items-center justify-between shadow-sm"
                        >
                          <div className="flex items-center space-x-3">
                            <div
                              style={{ backgroundColor: r.color }}
                              className="w-3.5 h-3.5 rounded-full shadow-sm"
                            />
                            <div>
                              <span style={{ color: r.color }} className="font-bold text-xs">
                                {r.name}
                              </span>
                              <div className="text-[10px] text-slate-400">
                                {r.permissions.administrator ? 'Administrator' : r.permissions.manageChannels ? 'Kelola Channel' : 'Member Biasa'}
                              </div>
                            </div>
                          </div>

                          {isOwner && (
                            <button
                              type="button"
                              onClick={() => handleDeleteRole(r.id)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="Hapus Role"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
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
                    Daftar Group yang Ada ({server.categories?.length || 0})
                  </h3>
                  <div className="space-y-2">
                    {server.categories?.map(cat => {
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
              <div className="space-y-3 max-w-xl">
                {server.members?.map(m => {
                  const u = m.user;
                  const isSrvOwner = m.userId === server.ownerId;
                  const memberRoles = (server.roles || []).filter(r => m.roleIds.includes(r.id));

                  return (
                    <div
                      key={m.userId}
                      className="p-3.5 bg-[#0c0e14] rounded-2xl border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <img
                          src={u?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${m.userId}`}
                          alt={u?.username || 'User'}
                          className="w-9 h-9 rounded-xl object-cover flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-white flex items-center space-x-1.5 truncate">
                            <span>{u?.username || m.userId}</span>
                            {isSrvOwner && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold border border-amber-500/30 flex items-center space-x-1">
                                <Crown size={10} />
                                <span>Owner</span>
                              </span>
                            )}
                          </div>
                          {/* Role Badges */}
                          <div className="flex flex-wrap gap-1 mt-1">
                            {memberRoles.map(r => (
                              <span
                                key={r.id}
                                style={{ backgroundColor: `${r.color}20`, borderColor: `${r.color}40`, color: r.color }}
                                className="px-1.5 py-0.2 rounded-md text-[9px] font-bold border"
                              >
                                {r.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Role Assignment Buttons (for Owner) */}
                      {isOwner && !isSrvOwner && server.roles && server.roles.length > 0 && (
                        <div className="flex flex-wrap gap-1 items-center">
                          {server.roles.map(r => {
                            const isAssigned = m.roleIds.includes(r.id);
                            return (
                              <button
                                key={r.id}
                                type="button"
                                onClick={() => handleToggleMemberRole(m.userId, r.id)}
                                style={{
                                  backgroundColor: isAssigned ? `${r.color}25` : 'transparent',
                                  borderColor: isAssigned ? r.color : 'rgba(255,255,255,0.1)',
                                  color: isAssigned ? r.color : '#94a3b8'
                                }}
                                className="px-2 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer hover:scale-105"
                                title={isAssigned ? `Hapus role ${r.name}` : `Beri role ${r.name}`}
                              >
                                {isAssigned ? `✓ ${r.name}` : `+ ${r.name}`}
                              </button>
                            );
                          })}
                        </div>
                      )}
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
