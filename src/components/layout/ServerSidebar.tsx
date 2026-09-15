import React, { useState, useEffect, useRef } from 'react';
import { Server, UserStatus } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useVoice } from '../../context/VoiceContext';
import { useToast } from '../../context/ToastContext';
import { 
  MessageSquare, 
  Plus, 
  BellOff, 
  Bell, 
  FolderPlus, 
  Folder, 
  FolderOpen, 
  ChevronDown, 
  ChevronRight, 
  Trash2, 
  Edit3, 
  Copy, 
  LogOut, 
  Clock, 
  VolumeX,
  Volume2,
  FolderMinus,
  Mic,
  MicOff,
  Headphones,
  Settings
} from 'lucide-react';
import { ServerFolderModal, ServerFolder } from '../modals/ServerFolderModal';

interface ServerSidebarProps {
  servers: Server[];
  activeServerId: string | null;
  unreadDMCount?: number;
  onSelectServer: (serverId: string | null) => void;
  onOpenCreateServer: () => void;
  isSidebarCollapsed?: boolean;
  onOpenUserSettings?: () => void;
}

export const ServerSidebar: React.FC<ServerSidebarProps> = ({
  servers,
  activeServerId,
  unreadDMCount = 0,
  onSelectServer,
  onOpenCreateServer,
  isSidebarCollapsed = false,
  onOpenUserSettings
}) => {
  const { user, friends, updateStatus } = useAuth();
  const { isMuted, isDeafened, toggleMute, toggleDeafen } = useVoice();
  const { showSuccess, showInfo } = useToast();

  // Floating user modal state
  const [showUserModal, setShowUserModal] = useState(false);
  const userModalRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const pendingFriendRequests = friends.filter(f => f.status === 'pending' && !f.isSender).length;
  const totalNotifications = pendingFriendRequests + unreadDMCount;

  // Folder & Mute state persistence
  const [folders, setFolders] = useState<ServerFolder[]>(() => {
    try {
      const saved = localStorage.getItem('aerocord_server_folders');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [mutedServers, setMutedServers] = useState<{ [serverId: string]: number }>(() => {
    try {
      const saved = localStorage.getItem('aerocord_muted_servers');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Modal & Context Menu States
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<ServerFolder | null>(null);
  const [initialServerForFolder, setInitialServerForFolder] = useState<string | undefined>();

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: 'server' | 'folder';
    server?: Server;
    folder?: ServerFolder;
  } | null>(null);

  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Close context menu & user modal on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (contextMenuRef.current && !contextMenuRef.current.contains(target)) {
        setContextMenu(null);
      }
      if (userModalRef.current && !userModalRef.current.contains(target)) {
        // Also ensure not clicking the avatar button itself if it was a toggle
        setShowUserModal(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('touchstart', handleClickOutside);
    window.addEventListener('contextmenu', handleClickOutside as EventListener);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('touchstart', handleClickOutside);
      window.removeEventListener('contextmenu', handleClickOutside as EventListener);
    };
  }, []);

  const statusColors: { [key: string]: { bg: string; label: string } } = {
    online: { bg: 'bg-emerald-500', label: 'Online' },
    idle: { bg: 'bg-amber-500', label: 'Idle' },
    dnd: { bg: 'bg-rose-500', label: 'Do Not Disturb' },
    offline: { bg: 'bg-slate-500', label: 'Invisible' }
  };

  const statusOptions: { label: string; value: UserStatus; color: string }[] = [
    { label: 'Online', value: 'online', color: 'bg-emerald-500' },
    { label: 'Idle', value: 'idle', color: 'bg-amber-500' },
    { label: 'Do Not Disturb', value: 'dnd', color: 'bg-rose-500' },
    { label: 'Invisible', value: 'offline', color: 'bg-slate-500' }
  ];

  const currentStatus = user ? (statusColors[user.status] || statusColors.online) : statusColors.online;

  // Hover handlers for Desktop
  const handleUserMouseEnter = () => {
    if (window.matchMedia('(hover: hover)').matches) {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      setShowUserModal(true);
    }
  };

  const handleUserMouseLeave = () => {
    if (window.matchMedia('(hover: hover)').matches) {
      hoverTimeoutRef.current = setTimeout(() => {
        setShowUserModal(false);
      }, 250);
    }
  };

  // Click/Tap handler for Mobile or explicit click
  const handleUserClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowUserModal(prev => !prev);
  };

  // Save folders to localStorage
  const saveFolders = (newFolders: ServerFolder[]) => {
    setFolders(newFolders);
    localStorage.setItem('aerocord_server_folders', JSON.stringify(newFolders));
  };

  // Save muted servers to localStorage
  const saveMutedServers = (newMuted: { [serverId: string]: number }) => {
    setMutedServers(newMuted);
    localStorage.setItem('aerocord_muted_servers', JSON.stringify(newMuted));
  };

  // Check if a server is currently muted
  const isServerMuted = (serverId: string): boolean => {
    const until = mutedServers[serverId];
    if (!until) return false;
    if (until === -1) return true; // Forever
    return Date.now() < until;
  };

  // Mute server handler
  const handleMuteServer = (serverId: string, serverName: string, durationMs: number | -1) => {
    const until = durationMs === -1 ? -1 : Date.now() + durationMs;
    const next = { ...mutedServers, [serverId]: until };
    saveMutedServers(next);

    const labels: { [key: number]: string } = {
      [15 * 60 * 1000]: '15 Menit',
      [60 * 60 * 1000]: '1 Jam',
      [8 * 60 * 60 * 1000]: '8 Jam',
      [24 * 60 * 60 * 1000]: '24 Jam',
      [-1]: 'Permanen (Selamanya)'
    };

    showSuccess('Notifikasi Dimute', `Notifikasi dari ${serverName} telah dibisukan selama ${labels[durationMs] || 'beberapa waktu'}.`);
    setContextMenu(null);
  };

  // Unmute server handler
  const handleUnmuteServer = (serverId: string, serverName: string) => {
    const next = { ...mutedServers };
    delete next[serverId];
    saveMutedServers(next);
    showInfo('Notifikasi Diaktifkan', `Notifikasi dari ${serverName} telah diaktifkan kembali.`);
    setContextMenu(null);
  };

  // Toggle folder open/closed
  const toggleFolder = (folderId: string) => {
    const next = folders.map(f => f.id === folderId ? { ...f, isExpanded: !f.isExpanded } : f);
    saveFolders(next);
  };

  // Save new / edited folder
  const handleSaveFolder = (data: { id?: string; name: string; color: string; serverIds: string[] }) => {
    if (data.id) {
      // Edit existing
      const next = folders.map(f => f.id === data.id ? { ...f, ...data } : f);
      saveFolders(next);
      showSuccess('Folder Diperbarui', `Folder "${data.name}" berhasil diperbarui.`);
    } else {
      // Create new
      const newFolder: ServerFolder = {
        id: `folder_${Date.now()}`,
        name: data.name,
        color: data.color,
        serverIds: data.serverIds,
        isExpanded: true
      };
      saveFolders([...folders, newFolder]);
      showSuccess('Folder Dibuat', `Grup server "${data.name}" berhasil dibuat.`);
    }
  };

  // Delete folder
  const handleDeleteFolder = (folderId: string, folderName: string) => {
    const next = folders.filter(f => f.id !== folderId);
    saveFolders(next);
    showInfo('Folder Dihapus', `Grup "${folderName}" telah dihapus. Server di dalamnya kembali ke daftar utama.`);
    setContextMenu(null);
  };

  // Add server to existing folder
  const handleAddServerToFolder = (serverId: string, folderId: string) => {
    const next = folders.map(f => {
      if (f.id === folderId) {
        return {
          ...f,
          serverIds: f.serverIds.includes(serverId) ? f.serverIds : [...f.serverIds, serverId]
        };
      }
      return f;
    });
    saveFolders(next);
    const targetFolder = folders.find(f => f.id === folderId);
    showSuccess('Server Dipindahkan', `Server dimasukkan ke grup "${targetFolder?.name || 'Folder'}".`);
    setContextMenu(null);
  };

  // Remove server from folder
  const handleRemoveServerFromFolder = (serverId: string) => {
    const next = folders.map(f => ({
      ...f,
      serverIds: f.serverIds.filter(id => id !== serverId)
    })).filter(f => f.serverIds.length > 0);
    saveFolders(next);
    showInfo('Server Dikeluarkan', 'Server telah dikeluarkan dari grup.');
    setContextMenu(null);
  };

  // Find if server belongs to a folder
  const getServerFolder = (serverId: string): ServerFolder | undefined => {
    return folders.find(f => f.serverIds.includes(serverId));
  };

  // Right-click context menu triggers
  const handleServerContextMenu = (e: React.MouseEvent, server: Server) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: Math.min(e.clientX, window.innerWidth - 220),
      y: Math.min(e.clientY, window.innerHeight - 340),
      type: 'server',
      server
    });
  };

  const handleFolderContextMenu = (e: React.MouseEvent, folder: ServerFolder) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: Math.min(e.clientX, window.innerWidth - 220),
      y: Math.min(e.clientY, window.innerHeight - 200),
      type: 'folder',
      folder
    });
  };

  // Servers that are not inside any folder
  const standaloneServers = servers.filter(s => !folders.some(f => f.serverIds.includes(s.id)));

  return (
    <div className="w-[68px] bg-[#0c0e14] flex flex-col items-center py-4 space-y-3 select-none h-full z-30 flex-shrink-0 border-r border-white/5 relative">
      {/* Direct Messages Hub Icon */}
      <div className="relative group flex items-center justify-center w-full">
        <div
          className={`absolute left-0 w-1 bg-gradient-to-b from-indigo-500 to-cyan-400 rounded-r-full transition-all duration-200 ${
            activeServerId === null
              ? 'h-8'
              : 'h-2 scale-0 group-hover:scale-100 group-hover:h-5'
          }`}
        />
        <button
          onClick={() => onSelectServer(null)}
          title="Direct Messages & Friends Hub"
          className={`relative w-11 h-11 flex items-center justify-center transition-all duration-200 cursor-pointer ${
            activeServerId === null
              ? 'bg-gradient-to-tr from-indigo-600 to-cyan-500 rounded-2xl text-white shadow-lg shadow-indigo-600/30'
              : 'bg-slate-900 hover:bg-slate-800 rounded-2xl text-slate-400 hover:text-white border border-white/5 hover:border-indigo-500/30'
          }`}
        >
          <MessageSquare size={20} />
          {totalNotifications > 0 && (
            <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-[#0c0e14] shadow-md animate-bounce">
              {totalNotifications}
            </span>
          )}
        </button>
      </div>

      {/* Divider */}
      <div className="w-6 h-[1px] bg-white/10 rounded my-0.5" />

      {/* Server List & Folders */}
      <div className="flex-1 w-full flex flex-col items-center space-y-2.5 overflow-y-auto no-scrollbar pb-2">
        {/* RENDER FOLDERS */}
        {folders.map((folder) => {
          const folderServers = servers.filter(s => folder.serverIds.includes(s.id));
          if (folderServers.length === 0) return null;

          const isExpanded = folder.isExpanded ?? true;

          return (
            <div key={folder.id} className="w-full flex flex-col items-center space-y-2">
              {/* Folder Header Icon */}
              <div className="relative group flex items-center justify-center w-full">
                <button
                  onClick={() => toggleFolder(folder.id)}
                  onContextMenu={(e) => handleFolderContextMenu(e, folder)}
                  title={`${folder.name} (${folderServers.length} Server)`}
                  className="relative w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-200 cursor-pointer overflow-hidden border border-white/10 hover:border-white/30 shadow-md group"
                  style={{
                    backgroundColor: `${folder.color}20`,
                    borderColor: isExpanded ? folder.color : undefined
                  }}
                >
                  {isExpanded ? (
                    <FolderOpen size={20} style={{ color: folder.color }} />
                  ) : (
                    /* Miniature 2x2 server icon preview */
                    <div className="grid grid-cols-2 gap-0.5 p-1 w-full h-full items-center justify-center">
                      {folderServers.slice(0, 4).map((s) => (
                        <div key={s.id} className="w-4 h-4 rounded overflow-hidden bg-black/40 flex items-center justify-center">
                          {s.icon ? (
                            <img src={s.icon} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[7px] font-bold text-white/80">{s.name[0]}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Tiny server count badge */}
                  <span
                    className="absolute -bottom-1 -right-1 text-[8px] font-bold px-1 rounded-full text-white shadow border border-black/40"
                    style={{ backgroundColor: folder.color }}
                  >
                    {folderServers.length}
                  </span>
                </button>
              </div>

              {/* Expanded Folder Member Servers */}
              {isExpanded && (
                <div
                  className="w-full flex flex-col items-center space-y-2 pl-2 pr-1 py-1 rounded-2xl border-l-2 my-0.5 transition-all animate-in fade-in duration-200"
                  style={{ borderColor: folder.color, backgroundColor: `${folder.color}08` }}
                >
                  {folderServers.map((server) => {
                    const isActive = activeServerId === server.id;
                    const muted = isServerMuted(server.id);
                    const initials = server.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

                    return (
                      <div key={server.id} className="relative group flex items-center justify-center w-full">
                        <div
                          className={`absolute left-0 w-1 bg-gradient-to-b from-indigo-500 to-cyan-400 rounded-r-full transition-all duration-200 ${
                            isActive ? 'h-8' : 'h-2 scale-0 group-hover:scale-100 group-hover:h-5'
                          }`}
                        />
                        <button
                          onClick={() => onSelectServer(server.id)}
                          onContextMenu={(e) => handleServerContextMenu(e, server)}
                          title={server.name + (muted ? ' (Muted)' : '')}
                          className={`relative w-10 h-10 flex items-center justify-center overflow-hidden font-bold transition-all duration-200 cursor-pointer rounded-2xl ${
                            isActive
                              ? 'border-2 border-indigo-500 shadow-lg shadow-indigo-500/20 bg-indigo-950/40 text-white'
                              : 'bg-slate-900 hover:bg-slate-800 border border-white/5 hover:border-white/20 text-slate-300 hover:text-white'
                          }`}
                        >
                          {server.icon ? (
                            <img src={server.icon} alt={server.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xs font-black tracking-wider text-indigo-300">{initials}</span>
                          )}

                          {/* Muted Icon Badge */}
                          {muted && (
                            <div className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full bg-slate-950/90 border border-rose-500/50 flex items-center justify-center text-rose-400">
                              <BellOff size={10} />
                            </div>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* RENDER STANDALONE SERVERS (NOT IN FOLDERS) */}
        {standaloneServers.map((server) => {
          const isActive = activeServerId === server.id;
          const muted = isServerMuted(server.id);
          const initials = server.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

          return (
            <div key={server.id} className="relative group flex items-center justify-center w-full">
              <div
                className={`absolute left-0 w-1 bg-gradient-to-b from-indigo-500 to-cyan-400 rounded-r-full transition-all duration-200 ${
                  isActive ? 'h-8' : 'h-2 scale-0 group-hover:scale-100 group-hover:h-5'
                }`}
              />
              <button
                onClick={() => onSelectServer(server.id)}
                onContextMenu={(e) => handleServerContextMenu(e, server)}
                title={server.name + (muted ? ' (Muted)' : '')}
                className={`relative w-11 h-11 flex items-center justify-center overflow-hidden font-bold transition-all duration-200 cursor-pointer rounded-2xl ${
                  isActive
                    ? 'border-2 border-indigo-500 shadow-lg shadow-indigo-500/20 bg-indigo-950/40 text-white'
                    : 'bg-slate-900 hover:bg-slate-800 border border-white/5 hover:border-white/20 text-slate-300 hover:text-white'
                }`}
              >
                {server.icon ? (
                  <img src={server.icon} alt={server.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs font-black tracking-wider text-indigo-300">{initials}</span>
                )}

                {/* Muted Icon Badge */}
                {muted && (
                  <div className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full bg-slate-950/90 border border-rose-500/50 flex items-center justify-center text-rose-400">
                    <BellOff size={10} />
                  </div>
                )}
              </button>
            </div>
          );
        })}

        {/* Add Server Button */}
        <div className="relative group flex items-center justify-center w-full pt-1">
          <button
            onClick={onOpenCreateServer}
            title="Tambah atau Gabung Server"
            className="w-11 h-11 rounded-2xl bg-slate-900 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-white/5 hover:border-emerald-500/50 flex items-center justify-center transition-all duration-200 shadow cursor-pointer group"
          >
            <Plus size={20} className="group-hover:rotate-90 transition-transform duration-200" />
          </button>
        </div>
      </div>

      {/* User Avatar & Quick Controls Button (Only visible when sidebar is collapsed) */}
      {isSidebarCollapsed && user && (
        <div 
          className="relative group flex flex-col items-center justify-center w-full pt-2 mt-auto flex-shrink-0 border-t border-white/5"
          onMouseEnter={handleUserMouseEnter}
          onMouseLeave={handleUserMouseLeave}
        >
          <button
            onClick={handleUserClick}
            title={`${user.username}#${user.discriminator} (Klik / Arahkan kursor untuk kontrol profil)`}
            className="relative w-11 h-11 rounded-2xl overflow-hidden border border-white/10 hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/25 transition-all duration-200 cursor-pointer bg-slate-900 group"
          >
            <img
              src={user.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.id}`}
              alt={user.username}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            />
            {/* Status dot */}
            <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#0c0e14] ${currentStatus.bg}`} />
          </button>

          {/* Floating Quick Controls Modal */}
          {showUserModal && (
            <div
              ref={userModalRef}
              onMouseEnter={() => {
                if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
              }}
              onMouseLeave={handleUserMouseLeave}
              className="fixed left-[72px] bottom-3 w-64 bg-[#13161f]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-3 z-50 text-slate-200 animate-in fade-in zoom-in-95 duration-150 select-none"
            >
              {/* User Info Header */}
              <div className="flex items-center space-x-3 pb-3 border-b border-white/5">
                <div className="relative flex-shrink-0">
                  <img
                    src={user.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.id}`}
                    alt={user.username}
                    className="w-10 h-10 rounded-xl object-cover border border-white/10"
                  />
                  <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#13161f] ${currentStatus.bg}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white truncate">{user.username}</div>
                  <div className="text-[11px] text-slate-400 font-mono">#{user.discriminator}</div>
                </div>
              </div>

              {/* Status Quick Switch */}
              <div className="py-2 border-b border-white/5 space-y-1">
                <div className="px-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</div>
                <div className="grid grid-cols-2 gap-1">
                  {statusOptions.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => updateStatus(opt.value)}
                      className={`px-2 py-1 rounded-xl flex items-center space-x-1.5 text-[11px] font-medium transition-all cursor-pointer ${
                        user.status === opt.value
                          ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 font-bold'
                          : 'hover:bg-white/5 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full ${opt.color}`} />
                      <span className="truncate">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Voice Controls & Settings Bar */}
              <div className="pt-2 flex items-center justify-between">
                <div className="flex items-center space-x-1">
                  {/* Mute Button */}
                  <button
                    onClick={toggleMute}
                    title={isMuted ? 'Nyalakan Mikrofon' : 'Bisukan Mikrofon'}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
                      isMuted
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 shadow-sm'
                        : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white'
                    }`}
                  >
                    {isMuted ? <MicOff size={14} /> : <Mic size={14} />}
                    <span className="text-[11px]">{isMuted ? 'Muted' : 'Mute'}</span>
                  </button>

                  {/* Deafen Button */}
                  <button
                    onClick={toggleDeafen}
                    title={isDeafened ? 'Nyalakan Suara' : 'Bisukan Suara (Deafen)'}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
                      isDeafened
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 shadow-sm'
                        : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white'
                    }`}
                  >
                    <Headphones size={14} className={isDeafened ? 'text-rose-400' : ''} />
                    <span className="text-[11px]">{isDeafened ? 'Deafened' : 'Deafen'}</span>
                  </button>
                </div>

                {/* Settings Button */}
                {onOpenUserSettings && (
                  <button
                    onClick={() => {
                      setShowUserModal(false);
                      onOpenUserSettings();
                    }}
                    title="Buka Pengaturan Akun"
                    className="p-2 rounded-xl bg-white/5 hover:bg-indigo-600 text-slate-300 hover:text-white transition-all cursor-pointer flex items-center justify-center shadow-sm"
                  >
                    <Settings size={15} />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CONTEXT MENU FOR SERVER / FOLDER */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 w-56 bg-[#13161f]/95 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl p-1.5 text-xs text-slate-200 animate-in fade-in zoom-in-95 duration-150 select-none"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === 'server' && contextMenu.server && (
            <div className="space-y-1">
              {/* Server Name Header */}
              <div className="px-3 py-1.5 text-[11px] font-bold text-white border-b border-white/5 truncate">
                {contextMenu.server.name}
              </div>

              {/* Mute Section */}
              <div className="pt-1">
                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                  <VolumeX size={12} />
                  <span>Mute Notifikasi Server</span>
                </div>

                {isServerMuted(contextMenu.server.id) ? (
                  <button
                    onClick={() => handleUnmuteServer(contextMenu.server!.id, contextMenu.server!.name)}
                    className="w-full px-3 py-1.5 rounded-xl hover:bg-emerald-500/20 text-emerald-400 text-left font-semibold flex items-center space-x-2 transition-colors cursor-pointer"
                  >
                    <Volume2 size={13} />
                    <span>Unmute Notifikasi Server</span>
                  </button>
                ) : (
                  <div className="space-y-0.5">
                    <button
                      onClick={() => handleMuteServer(contextMenu.server!.id, contextMenu.server!.name, 15 * 60 * 1000)}
                      className="w-full px-3 py-1.5 rounded-xl hover:bg-white/5 text-slate-300 hover:text-white text-left flex items-center space-x-2 transition-colors cursor-pointer"
                    >
                      <Clock size={13} className="text-slate-400" />
                      <span>Selama 15 Menit</span>
                    </button>
                    <button
                      onClick={() => handleMuteServer(contextMenu.server!.id, contextMenu.server!.name, 60 * 60 * 1000)}
                      className="w-full px-3 py-1.5 rounded-xl hover:bg-white/5 text-slate-300 hover:text-white text-left flex items-center space-x-2 transition-colors cursor-pointer"
                    >
                      <Clock size={13} className="text-slate-400" />
                      <span>Selama 1 Jam</span>
                    </button>
                    <button
                      onClick={() => handleMuteServer(contextMenu.server!.id, contextMenu.server!.name, 8 * 60 * 60 * 1000)}
                      className="w-full px-3 py-1.5 rounded-xl hover:bg-white/5 text-slate-300 hover:text-white text-left flex items-center space-x-2 transition-colors cursor-pointer"
                    >
                      <Clock size={13} className="text-slate-400" />
                      <span>Selama 8 Jam</span>
                    </button>
                    <button
                      onClick={() => handleMuteServer(contextMenu.server!.id, contextMenu.server!.name, 24 * 60 * 60 * 1000)}
                      className="w-full px-3 py-1.5 rounded-xl hover:bg-white/5 text-slate-300 hover:text-white text-left flex items-center space-x-2 transition-colors cursor-pointer"
                    >
                      <Clock size={13} className="text-slate-400" />
                      <span>Selama 24 Jam</span>
                    </button>
                    <button
                      onClick={() => handleMuteServer(contextMenu.server!.id, contextMenu.server!.name, -1)}
                      className="w-full px-3 py-1.5 rounded-xl hover:bg-rose-500/15 text-rose-300 text-left font-semibold flex items-center space-x-2 transition-colors cursor-pointer"
                    >
                      <BellOff size={13} />
                      <span>Sampai Diaktifkan (Permanen)</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="h-[1px] bg-white/5 my-1" />

              {/* Group / Folder Section */}
              <div>
                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                  <Folder size={12} />
                  <span>Grup / Folder Server</span>
                </div>

                <button
                  onClick={() => {
                    setEditingFolder(null);
                    setInitialServerForFolder(contextMenu.server!.id);
                    setFolderModalOpen(true);
                    setContextMenu(null);
                  }}
                  className="w-full px-3 py-1.5 rounded-xl hover:bg-white/5 text-indigo-300 text-left font-semibold flex items-center space-x-2 transition-colors cursor-pointer"
                >
                  <FolderPlus size={13} />
                  <span>Buat Folder Baru...</span>
                </button>

                {/* Existing Folders */}
                {folders.map((f) => {
                  const isInThisFolder = f.serverIds.includes(contextMenu.server!.id);
                  if (isInThisFolder) return null;
                  return (
                    <button
                      key={f.id}
                      onClick={() => handleAddServerToFolder(contextMenu.server!.id, f.id)}
                      className="w-full px-3 py-1.5 rounded-xl hover:bg-white/5 text-slate-300 hover:text-white text-left flex items-center space-x-2 transition-colors cursor-pointer"
                    >
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: f.color }} />
                      <span className="truncate">Masuk ke "{f.name}"</span>
                    </button>
                  );
                })}

                {/* Remove from folder if in one */}
                {getServerFolder(contextMenu.server.id) && (
                  <button
                    onClick={() => handleRemoveServerFromFolder(contextMenu.server!.id)}
                    className="w-full px-3 py-1.5 rounded-xl hover:bg-amber-500/15 text-amber-300 text-left flex items-center space-x-2 transition-colors cursor-pointer"
                  >
                    <FolderMinus size={13} />
                    <span>Keluarkan dari Grup</span>
                  </button>
                )}
              </div>

              <div className="h-[1px] bg-white/5 my-1" />

              {/* Copy ID */}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(contextMenu.server!.id);
                  showSuccess('ID Disalin', `ID Server (${contextMenu.server!.id}) telah disalin.`);
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white text-left flex items-center space-x-2 transition-colors cursor-pointer"
              >
                <Copy size={13} />
                <span>Salin ID Server</span>
              </button>
            </div>
          )}

          {contextMenu.type === 'folder' && contextMenu.folder && (
            <div className="space-y-1">
              <div className="px-3 py-1.5 text-[11px] font-bold text-white border-b border-white/5 flex items-center space-x-2 truncate">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: contextMenu.folder.color }} />
                <span>{contextMenu.folder.name}</span>
              </div>

              <button
                onClick={() => {
                  setEditingFolder(contextMenu.folder!);
                  setFolderModalOpen(true);
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 rounded-xl hover:bg-white/5 text-slate-200 text-left flex items-center space-x-2 transition-colors cursor-pointer"
              >
                <Edit3 size={13} className="text-indigo-400" />
                <span>Ubah Nama & Warna Folder</span>
              </button>

              <button
                onClick={() => handleDeleteFolder(contextMenu.folder!.id, contextMenu.folder!.name)}
                className="w-full px-3 py-1.5 rounded-xl hover:bg-rose-500/15 text-rose-300 text-left flex items-center space-x-2 transition-colors cursor-pointer font-semibold"
              >
                <Trash2 size={13} />
                <span>Hapus Folder</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Server Folder Create / Edit Modal */}
      <ServerFolderModal
        isOpen={folderModalOpen}
        onClose={() => {
          setFolderModalOpen(false);
          setEditingFolder(null);
          setInitialServerForFolder(undefined);
        }}
        onSave={handleSaveFolder}
        existingFolder={editingFolder}
        initialServerId={initialServerForFolder}
        allServers={servers}
      />
    </div>
  );
};
