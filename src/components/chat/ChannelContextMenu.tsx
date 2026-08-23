import React, { useEffect, useRef } from 'react';
import { Channel, ChannelCategory } from '../../types';
import { BellOff, Bell, FolderInput, Edit2, Trash2, FolderPlus, Hash, Volume2, Clock, Timer } from 'lucide-react';
import { apiUrl } from '../../config/api';

interface MuteDuration {
  label: string;
  minutes: number | null; // null = forever
}

const MUTE_DURATIONS: MuteDuration[] = [
  { label: '15 menit', minutes: 15 },
  { label: '1 jam', minutes: 60 },
  { label: '8 jam', minutes: 480 },
  { label: '24 jam', minutes: 1440 },
  { label: 'Sampai saya aktifkan kembali', minutes: null }
];

interface ChannelContextMenuProps {
  channel: Channel;
  categories: ChannelCategory[];
  isMuted: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  onToggleMute: (channelId: string, durationMinutes?: number | null) => void;
  onMoveToCategory: (channelId: string, categoryId: string) => void;
  onRenameChannel: (channel: Channel) => void;
  onDeleteChannel: (channelId: string) => void;
}

export const ChannelContextMenu: React.FC<ChannelContextMenuProps> = ({
  channel,
  categories,
  isMuted,
  position,
  onClose,
  onToggleMute,
  onMoveToCategory,
  onRenameChannel,
  onDeleteChannel
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showMuteSubmenu, setShowMuteSubmenu] = React.useState(false);
  const [showCategorySubmenu, setShowCategorySubmenu] = React.useState(false);
  const [showNewCategoryInput, setShowNewCategoryInput] = React.useState(false);
  const [newCategoryName, setNewCategoryName] = React.useState('');

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Adjust menu position so it doesn't overflow viewport
  const style: React.CSSProperties = {
    top: `${Math.min(position.y, window.innerHeight - 320)}px`,
    left: `${Math.min(position.x, window.innerWidth - 240)}px`
  };

  const handleCreateCategoryAndMove = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const res = await fetch(apiUrl(`/api/servers/${channel.serverId}/categories`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('aerocord_token')}`
        },
        body: JSON.stringify({ name: newCategoryName.trim() })
      });
      const data = await res.json();
      if (res.ok && data.server) {
        const newCat = data.server.categories[data.server.categories.length - 1];
        if (newCat) {
          onMoveToCategory(channel.id, newCat.id);
        }
      }
    } catch (err) {
      console.error('Failed to create category:', err);
    }
    setNewCategoryName('');
    setShowNewCategoryInput(false);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      style={style}
      className="fixed z-50 w-60 bg-[#181b24] border border-white/10 rounded-2xl shadow-2xl p-1.5 text-white animate-in zoom-in-95 duration-100 select-none text-xs"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-white/5 flex items-center space-x-1.5">
        {channel.type === 'voice' ? <Volume2 size={12} /> : <Hash size={12} />}
        <span className="truncate">{channel.name}</span>
      </div>

      <div className="py-1 space-y-0.5">
        {/* Mute with Duration Submenu */}
        {isMuted ? (
          <button
            onClick={() => {
              onToggleMute(channel.id);
              onClose();
            }}
            className="w-full px-3 py-2 flex items-center space-x-2.5 rounded-xl hover:bg-white/[0.06] text-slate-200 hover:text-white transition-colors text-left cursor-pointer"
          >
            <Bell size={15} className="text-emerald-400" />
            <span>Bunyikan Notifikasi</span>
          </button>
        ) : (
          <div className="relative">
            <button
              onClick={() => { setShowMuteSubmenu(!showMuteSubmenu); setShowCategorySubmenu(false); }}
              className="w-full px-3 py-2 flex items-center justify-between rounded-xl hover:bg-white/[0.06] text-slate-200 hover:text-white transition-colors text-left cursor-pointer"
            >
              <div className="flex items-center space-x-2.5">
                <BellOff size={15} className="text-amber-400" />
                <span>Bisukan Notifikasi</span>
              </div>
              <span className="text-[10px] text-slate-400">▶</span>
            </button>

            {showMuteSubmenu && (
              <div className="absolute left-full top-0 ml-1 w-52 bg-[#181b24] border border-white/10 rounded-2xl shadow-2xl p-1.5 z-50 space-y-0.5 animate-in fade-in zoom-in-95">
                <div className="px-2.5 py-1 text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
                  <Timer size={10} />
                  <span>Pilih Durasi Mute:</span>
                </div>
                {MUTE_DURATIONS.map((dur, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      onToggleMute(channel.id, dur.minutes);
                      onClose();
                    }}
                    className="w-full px-2.5 py-2 rounded-lg text-left text-xs transition-colors flex items-center space-x-2 cursor-pointer hover:bg-white/5 text-slate-300 hover:text-white"
                  >
                    <Clock size={13} className="text-amber-400 flex-shrink-0" />
                    <span>{dur.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Move to Group / Category */}
        <div className="relative">
          <button
            onClick={() => { setShowCategorySubmenu(!showCategorySubmenu); setShowMuteSubmenu(false); }}
            className="w-full px-3 py-2 flex items-center justify-between rounded-xl hover:bg-white/[0.06] text-slate-200 hover:text-white transition-colors text-left cursor-pointer"
          >
            <div className="flex items-center space-x-2.5">
              <FolderInput size={15} className="text-indigo-400" />
              <span>Gabungkan ke Grup Channel</span>
            </div>
            <span className="text-[10px] text-slate-400">▶</span>
          </button>

          {showCategorySubmenu && (
            <div className="absolute left-full top-0 ml-1 w-52 bg-[#181b24] border border-white/10 rounded-2xl shadow-2xl p-1.5 z-50 space-y-0.5 animate-in fade-in zoom-in-95">
              <div className="px-2.5 py-1 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                Pilih Grup:
              </div>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => {
                    onMoveToCategory(channel.id, cat.id);
                    onClose();
                  }}
                  className={`w-full px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors flex items-center space-x-1.5 cursor-pointer ${
                    channel.categoryId === cat.id
                      ? 'bg-indigo-600/30 text-indigo-300 font-bold'
                      : 'hover:bg-white/5 text-slate-300'
                  }`}
                >
                  <FolderPlus size={13} className="text-indigo-400" />
                  <span className="truncate">{cat.name}</span>
                </button>
              ))}

              <div className="h-[1px] bg-white/5 my-1" />

              {/* Create new group inline */}
              {showNewCategoryInput ? (
                <div className="flex items-center space-x-1 px-1.5">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreateCategoryAndMove(); }}
                    placeholder="Nama grup baru..."
                    autoFocus
                    className="flex-1 px-2 py-1.5 bg-[#0c0e14] text-[11px] text-white rounded-lg border border-white/10 focus:border-indigo-500 focus:outline-none"
                  />
                  <button
                    onClick={handleCreateCategoryAndMove}
                    disabled={!newCategoryName.trim()}
                    className="p-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg cursor-pointer text-[10px]"
                  >
                    ✓
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewCategoryInput(true)}
                  className="w-full px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors flex items-center space-x-1.5 cursor-pointer hover:bg-emerald-500/10 text-emerald-400"
                >
                  <FolderPlus size={13} />
                  <span>Buat Grup Baru & Pindahkan</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Rename Channel */}
        <button
          onClick={() => {
            onRenameChannel(channel);
            onClose();
          }}
          className="w-full px-3 py-2 flex items-center space-x-2.5 rounded-xl hover:bg-white/[0.06] text-slate-200 hover:text-white transition-colors text-left cursor-pointer"
        >
          <Edit2 size={15} className="text-cyan-400" />
          <span>Ubah Nama Channel</span>
        </button>

        <div className="h-[1px] bg-white/5 my-1" />

        {/* Delete Channel */}
        <button
          onClick={() => {
            onDeleteChannel(channel.id);
            onClose();
          }}
          className="w-full px-3 py-2 flex items-center space-x-2.5 rounded-xl hover:bg-rose-500/15 text-rose-400 hover:text-rose-300 transition-colors text-left cursor-pointer"
        >
          <Trash2 size={15} />
          <span>Hapus Channel</span>
        </button>
      </div>
    </div>
  );
};

