import React, { useState, useEffect } from 'react';
import { Server, Channel, Message } from '../../types';
import { useVoice } from '../../context/VoiceContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useSocket } from '../../context/SocketContext';
import { Hash, Volume2, Plus, ChevronDown, ChevronRight, Settings, UserPlus, MicOff, Radio, BellOff, FolderPlus, PanelLeftClose } from 'lucide-react';
import { UserDock } from './UserDock';
import { ActiveVoiceDock } from './ActiveVoiceDock';
import { ChannelContextMenu } from '../chat/ChannelContextMenu';
import { ConfirmationModal } from '../modals/ConfirmationModal';
import { PromptDialogModal } from '../modals/PromptDialogModal';
import { apiUrl } from '../../config/api';

interface ChannelSidebarProps {
  server: Server;
  activeChannelId: string | null;
  onSelectChannel: (channel: Channel) => void;
  onOpenCreateChannel: (type: 'text' | 'voice', categoryId?: string) => void;
  onOpenSettings: () => void;
  onOpenUserSettings?: () => void;
  onServerUpdated?: (server: Server) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const ChannelSidebar: React.FC<ChannelSidebarProps> = ({
  server,
  activeChannelId,
  onSelectChannel,
  onOpenCreateChannel,
  onOpenSettings,
  onOpenUserSettings,
  onServerUpdated,
  isCollapsed = false,
  onToggleCollapse
}) => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const { showSuccess, showError, showInfo } = useToast();
  const { currentVoiceChannel, voiceParticipants, joinVoiceChannel } = useVoice();

  const [showServerMenu, setShowServerMenu] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<{ [catId: string]: boolean }>({});
  // mutedUntil: { [channelId]: timestamp | null } (null means forever, number means expiry Date.now() + ms)
  const [mutedUntil, setMutedUntil] = useState<{ [channelId: string]: number | null }>({});
  const [unreadCounts, setUnreadCounts] = useState<{ [channelId: string]: number }>({});

  // Modals for rename and delete channel
  const [renameModal, setRenameModal] = useState<{ isOpen: boolean; channel: Channel | null }>({ isOpen: false, channel: null });
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; channelId: string | null; channelName: string }>({ isOpen: false, channelId: null, channelName: '' });

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    channel: Channel;
    position: { x: number; y: number };
  } | null>(null);

  // Listen to new messages to increment unread counter on channels
  useEffect(() => {
    if (!socket || !user) return;

    const handleNewMessage = (msg: Message) => {
      if (msg.authorId !== user.id && msg.channelId !== activeChannelId) {
        // Check if message belongs to this server
        const isServerChannel = server.channels.some(c => c.id === msg.channelId);
        if (isServerChannel) {
          setUnreadCounts(prev => ({
            ...prev,
            [msg.channelId]: (prev[msg.channelId] || 0) + 1
          }));
        }
      }
    };

    socket.on('new_message', handleNewMessage);
    return () => {
      socket.off('new_message', handleNewMessage);
    };
  }, [socket, user, activeChannelId, server.channels]);

  // Reset unread count when active channel changes
  useEffect(() => {
    if (activeChannelId) {
      setUnreadCounts(prev => ({ ...prev, [activeChannelId]: 0 }));
    }
  }, [activeChannelId]);

  const copyInviteCode = () => {
    navigator.clipboard.writeText(server.inviteCode);
    showSuccess('Kode Undangan Disalin', `Kode undangan server (${server.inviteCode}) telah disalin.`);
    setShowServerMenu(false);
  };

  const toggleCategoryCollapse = (catId: string) => {
    setCollapsedCategories(prev => ({ ...prev, [catId]: !prev[catId] }));
  };

  const isChannelMuted = (channelId: string): boolean => {
    const muteVal = mutedUntil[channelId];
    if (muteVal === undefined) return false;
    if (muteVal === null) return true; // forever
    return Date.now() < muteVal;
  };

  const toggleMuteChannel = (channelId: string, durationMinutes?: number | null) => {
    if (durationMinutes === undefined) {
      // Toggle off if currently muted
      if (isChannelMuted(channelId)) {
        setMutedUntil(prev => {
          const next = { ...prev };
          delete next[channelId];
          return next;
        });
        showSuccess('Notifikasi Diaktifkan', 'Notifikasi channel telah dibunyikan kembali.');
        return;
      }
      durationMinutes = null; // default forever
    }

    if (durationMinutes === null) {
      setMutedUntil(prev => ({ ...prev, [channelId]: null }));
      showInfo('Notifikasi Dibisukan', 'Notifikasi channel dibisukan sampai Anda mengaktifkannya kembali.');
    } else {
      const expiry = Date.now() + durationMinutes * 60 * 1000;
      setMutedUntil(prev => ({ ...prev, [channelId]: expiry }));
      showInfo('Notifikasi Dibisukan', `Notifikasi channel dibisukan selama ${durationMinutes >= 60 ? (durationMinutes / 60) + ' jam' : durationMinutes + ' menit'}.`);
    }
  };

  const handleMoveChannelToCategory = async (channelId: string, categoryId: string) => {
    try {
      const res = await fetch(apiUrl(`/api/servers/${server.id}/channels/${channelId}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('aerocord_token')}`
        },
        body: JSON.stringify({ categoryId })
      });
      const data = await res.json();
      if (res.ok) {
        const updatedChannels = server.channels.map(c => c.id === channelId ? { ...c, categoryId } : c);
        if (onServerUpdated) {
          onServerUpdated({ ...server, channels: updatedChannels });
        }
        showSuccess('Channel Dipindahkan', 'Channel berhasil dimasukkan ke group pilihan.');
      }
    } catch (err: any) {
      showError('Gagal Memindahkan Channel', err.message);
    }
  };

  const handleOpenRename = (channel: Channel) => {
    setRenameModal({ isOpen: true, channel });
  };

  const handleConfirmRename = async (newName: string) => {
    const channel = renameModal.channel;
    if (!channel || !newName.trim() || newName.trim() === channel.name) {
      setRenameModal({ isOpen: false, channel: null });
      return;
    }

    try {
      const res = await fetch(apiUrl(`/api/servers/${server.id}/channels/${channel.id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('aerocord_token')}`
        },
        body: JSON.stringify({ name: newName.trim() })
      });
      if (res.ok) {
        const updatedChannels = server.channels.map(c => c.id === channel.id ? { ...c, name: newName.trim() } : c);
        if (onServerUpdated) {
          onServerUpdated({ ...server, channels: updatedChannels });
        }
        showSuccess('Nama Channel Diubah', `Channel kini bernama #${newName.trim()}`);
      }
    } catch (err: any) {
      showError('Gagal Mengubah Nama', err.message);
    } finally {
      setRenameModal({ isOpen: false, channel: null });
    }
  };

  const handleOpenDelete = (channelId: string) => {
    const targetChan = server.channels.find(c => c.id === channelId);
    setDeleteModal({
      isOpen: true,
      channelId,
      channelName: targetChan ? targetChan.name : 'Channel'
    });
  };

  const handleConfirmDelete = async () => {
    const channelId = deleteModal.channelId;
    if (!channelId) return;

    try {
      const res = await fetch(apiUrl(`/api/servers/${server.id}/channels/${channelId}`), {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('aerocord_token')}`
        }
      });
      if (res.ok) {
        const updatedChannels = server.channels.filter(c => c.id !== channelId);
        if (onServerUpdated) {
          onServerUpdated({ ...server, channels: updatedChannels });
        }
        showSuccess('Channel Dihapus', 'Channel berhasil dihapus dari server.');
      }
    } catch (err: any) {
      showError('Gagal Menghapus Channel', err.message);
    } finally {
      setDeleteModal({ isOpen: false, channelId: null, channelName: '' });
    }
  };

  const getConnectedVoiceUsers = (channelId: string) => {
    return voiceParticipants.filter(p => p.channelId === channelId);
  };

  return (
    <div className={`bg-[#11131a] flex flex-col h-full select-none z-20 flex-shrink-0 border-r border-white/5 relative transition-all duration-300 ease-in-out ${
      isCollapsed
        ? 'w-0 min-w-0 max-w-0 opacity-0 -translate-x-4 pointer-events-none overflow-hidden border-none'
        : 'w-60 min-w-[240px] opacity-100 translate-x-0'
    }`}>
      {/* Server Header Dropdown */}
      <div className="relative flex items-center h-14 px-3 border-b border-white/5">
        <button
          onClick={() => setShowServerMenu(!showServerMenu)}
          className="flex-1 min-w-0 h-full flex items-center justify-between font-bold text-sm text-slate-100 hover:bg-white/[0.03] rounded-xl px-2 transition-colors cursor-pointer"
        >
          <div className="flex items-center space-x-2.5 truncate">
            {server.icon ? (
              <img src={server.icon} alt={server.name} className="w-6 h-6 rounded-lg object-cover" />
            ) : (
              <div className="w-6 h-6 rounded-lg bg-indigo-600/30 text-indigo-400 flex items-center justify-center text-xs font-bold">
                {server.name.charAt(0)}
              </div>
            )}
            <span className="truncate font-black tracking-tight">{server.name}</span>
          </div>
          <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ml-1.5 flex-shrink-0 ${showServerMenu ? 'rotate-180' : ''}`} />
        </button>

        {/* Minimalist Collapse Sidebar Button */}
        {onToggleCollapse && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse();
            }}
            title="Tutup Sidebar (Ctrl+B)"
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer ml-1 flex-shrink-0"
          >
            <PanelLeftClose size={16} />
          </button>
        )}
      </div>

      {/* Server Dropdown Menu */}
      {showServerMenu && (
        <div
          className="absolute top-14 left-2 right-2 bg-[#181b24] border border-white/10 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100"
          onMouseLeave={() => setShowServerMenu(false)}
        >
            <button
              onClick={copyInviteCode}
              className="w-full px-3 py-2.5 flex items-center justify-between text-xs text-indigo-400 font-semibold hover:bg-indigo-600 hover:text-white rounded-xl transition-colors cursor-pointer"
            >
              <span>Bagikan Kode Undangan ({server.inviteCode})</span>
              <UserPlus size={15} />
            </button>
            <button
              onClick={() => {
                onOpenCreateChannel('text');
                setShowServerMenu(false);
              }}
              className="w-full px-3 py-2.5 flex items-center justify-between text-xs text-slate-300 hover:bg-white/5 hover:text-white rounded-xl transition-colors cursor-pointer"
            >
              <span>Tambah Text Channel</span>
              <Plus size={15} />
            </button>
            <button
              onClick={() => {
                onOpenCreateChannel('voice');
                setShowServerMenu(false);
              }}
              className="w-full px-3 py-2.5 flex items-center justify-between text-xs text-slate-300 hover:bg-white/5 hover:text-white rounded-xl transition-colors cursor-pointer"
            >
              <span>Tambah Voice Channel</span>
              <Volume2 size={15} />
            </button>
            <div className="h-[1px] bg-white/5 my-1" />
            <button
              onClick={() => {
                onOpenSettings();
                setShowServerMenu(false);
              }}
              className="w-full px-3 py-2.5 flex items-center justify-between text-xs text-slate-300 hover:bg-white/5 hover:text-white rounded-xl transition-colors cursor-pointer"
            >
              <span>Pengaturan Server</span>
              <Settings size={15} />
            </button>
          </div>
        )}

      {/* Channel Categories & Groups */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        {server.categories.map((category) => {
          const categoryChannels = server.channels.filter(c => c.categoryId === category.id);
          const isCollapsed = collapsedCategories[category.id] || false;

          return (
            <div key={category.id} className="space-y-1">
              {/* Category Group Header */}
              <div className="flex items-center justify-between px-2 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider group hover:text-slate-200">
                <button
                  onClick={() => toggleCategoryCollapse(category.id)}
                  className="flex items-center space-x-1.5 cursor-pointer flex-1 text-left"
                >
                  <ChevronRight size={13} className={`text-slate-500 transition-transform duration-150 ${isCollapsed ? '' : 'rotate-90'}`} />
                  <span className="truncate">{category.name} ({categoryChannels.length})</span>
                </button>

                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => onOpenCreateChannel('text', category.id)}
                    title={`Tambah Text Channel di ${category.name}`}
                    className="p-1 rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <Plus size={13} />
                  </button>
                </div>
              </div>

              {/* Group Channels List (if not collapsed) */}
              {!isCollapsed && (
                <div className="space-y-0.5 pl-1">
                  {categoryChannels.map((channel) => {
                    const isActive = activeChannelId === channel.id;
                    const isMuted = isChannelMuted(channel.id);
                    const unread = unreadCounts[channel.id] || 0;
                    const connectedUsers = channel.type === 'voice' ? getConnectedVoiceUsers(channel.id) : [];
                    const isInThisVoice = channel.type === 'voice' && currentVoiceChannel === channel.id;

                    return (
                      <div key={channel.id} className="flex flex-col">
                        <button
                          onClick={() => {
                            if (channel.type === 'voice') {
                              joinVoiceChannel(channel.id);
                            }
                            onSelectChannel(channel);
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setContextMenu({
                              channel,
                              position: { x: e.clientX, y: e.clientY }
                            });
                          }}
                          title={`Klik kanan untuk opsi channel #${channel.name}`}
                          className={`w-full flex items-center px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left group relative ${
                            isInThisVoice
                              ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30'
                              : isActive
                              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                              : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-100'
                          }`}
                        >
                          {channel.type === 'voice' ? (
                            <Volume2 size={15} className={`mr-2 flex-shrink-0 ${isInThisVoice ? 'text-emerald-400 animate-pulse' : 'text-slate-500 group-hover:text-slate-300'}`} />
                          ) : (
                            <Hash size={15} className={`mr-2 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`} />
                          )}

                          <span className="truncate flex-1">{channel.name}</span>

                          {/* Unread Message Badge */}
                          {unread > 0 && !isActive && (
                            <span className="min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center shadow-md animate-pulse ml-1.5 flex-shrink-0">
                              {unread}
                            </span>
                          )}

                          {/* Muted Icon */}
                          {isMuted && (
                            <BellOff size={13} className="text-amber-400 ml-1.5 flex-shrink-0" />
                          )}

                          {connectedUsers.length > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold ml-1">
                              {connectedUsers.length}
                            </span>
                          )}
                        </button>

                        {/* Connected Voice Members */}
                        {channel.type === 'voice' && connectedUsers.length > 0 && (
                          <div className="pl-6 py-1 space-y-1">
                            {connectedUsers.map((participant) => {
                              const pUser = participant.user;
                              const isMe = participant.userId === user?.id;
                              const isTalking = participant.isSpeaking;

                              return (
                                <div
                                  key={participant.userId}
                                  className="flex items-center space-x-2 py-0.5 px-2 rounded-lg bg-white/[0.02] text-xs text-slate-300"
                                >
                                  <img
                                    src={pUser?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${participant.userId}`}
                                    alt={pUser?.username || 'User'}
                                    className={`w-5 h-5 rounded-full object-cover ${
                                      isTalking ? 'ring-2 ring-emerald-400' : ''
                                    }`}
                                  />
                                  <span className={`truncate flex-1 text-[11px] ${isMe ? 'font-bold text-emerald-400' : ''}`}>
                                    {pUser?.username || 'User'}
                                  </span>
                                  {participant.isMuted && (
                                    <MicOff size={11} className="text-rose-400 flex-shrink-0" />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Active Voice Dock */}
      <ActiveVoiceDock channelName={server.channels.find(c => c.id === currentVoiceChannel)?.name} />

      {/* User Profile Dock */}
      <UserDock onOpenSettings={onOpenUserSettings || onOpenSettings} />

      {/* Right-click Context Menu */}
      {contextMenu && (
        <ChannelContextMenu
          channel={contextMenu.channel}
          categories={server.categories}
          isMuted={isChannelMuted(contextMenu.channel.id)}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
          onToggleMute={toggleMuteChannel}
          onMoveToCategory={handleMoveChannelToCategory}
          onRenameChannel={handleOpenRename}
          onDeleteChannel={handleOpenDelete}
        />
      )}

      {/* Rename Channel Modal (No native window.prompt) */}
      <PromptDialogModal
        isOpen={renameModal.isOpen}
        title="Ubah Nama Channel"
        label="Nama Channel Baru"
        initialValue={renameModal.channel?.name || ''}
        placeholder="nama-channel"
        confirmText="Simpan Nama"
        onConfirm={handleConfirmRename}
        onCancel={() => setRenameModal({ isOpen: false, channel: null })}
      />

      {/* Delete Channel Modal (No native window.confirm) */}
      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        title="Hapus Channel"
        message={`Apakah Anda yakin ingin menghapus channel #${deleteModal.channelName}? Semua riwayat pesan di dalamnya akan terhapus secara permanen.`}
        confirmText="Hapus Channel"
        cancelText="Batal"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteModal({ isOpen: false, channelId: null, channelName: '' })}
      />
    </div>
  );
};

