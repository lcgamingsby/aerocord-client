import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useVoice } from '../../context/VoiceContext';
import { Mic, MicOff, Headphones, Settings, Sparkles } from 'lucide-react';
import { UserStatus } from '../../types';

interface UserDockProps {
  onOpenSettings: () => void;
}

export const UserDock: React.FC<UserDockProps> = ({ onOpenSettings }) => {
  const { user, updateStatus } = useAuth();
  const { isMuted, isDeafened, toggleMute, toggleDeafen } = useVoice();
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  if (!user) return null;

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

  const currentStatus = statusColors[user.status] || statusColors.online;

  return (
    <div className="h-16 bg-[#0e1017] px-3 flex items-center justify-between border-t border-white/5 select-none relative">
      {/* Profile & Status Pill */}
      <div className="relative">
        <button
          onClick={() => setShowStatusMenu(!showStatusMenu)}
          className="flex items-center space-x-2.5 p-1.5 rounded-xl hover:bg-white/[0.04] transition-all cursor-pointer text-left max-w-[130px]"
        >
          <div className="relative">
            <img
              src={user.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.id}`}
              alt={user.username}
              className="w-8 h-8 rounded-xl object-cover border border-white/10"
            />
            <div
              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0e1017] ${currentStatus.bg}`}
            />
          </div>
          <div className="flex flex-col truncate">
            <span className="text-xs font-bold text-slate-100 truncate">{user.username}</span>
            <span className="text-[10px] text-slate-400 font-mono">#{user.discriminator}</span>
          </div>
        </button>

        {/* Status Dropdown Popover */}
        {showStatusMenu && (
          <div
            className="absolute bottom-16 left-0 w-44 bg-[#181b24] border border-white/10 rounded-2xl shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
            onMouseLeave={() => setShowStatusMenu(false)}
          >
            <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Atur Status</div>
            {statusOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => {
                  updateStatus(opt.value);
                  setShowStatusMenu(false);
                }}
                className="w-full px-3 py-2 flex items-center space-x-2.5 hover:bg-indigo-600 hover:text-white text-slate-300 text-xs transition-colors text-left cursor-pointer"
              >
                <div className={`w-2 h-2 rounded-full ${opt.color}`} />
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Voice Controls & Settings */}
      <div className="flex items-center space-x-1 text-slate-400">
        <button
          onClick={toggleMute}
          title={isMuted ? 'Unmute' : 'Mute'}
          className={`p-1.5 rounded-xl transition-all cursor-pointer ${
            isMuted ? 'text-rose-400 bg-rose-500/10' : 'hover:text-slate-100 hover:bg-white/[0.04]'
          }`}
        >
          {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
        </button>

        <button
          onClick={toggleDeafen}
          title={isDeafened ? 'Undeafen' : 'Deafen'}
          className={`p-1.5 rounded-xl transition-all cursor-pointer ${
            isDeafened ? 'text-rose-400 bg-rose-500/10' : 'hover:text-slate-100 hover:bg-white/[0.04]'
          }`}
        >
          <Headphones size={16} />
        </button>

        <button
          onClick={onOpenSettings}
          title="Pengaturan Akun"
          className="p-1.5 rounded-xl hover:bg-white/[0.04] hover:text-slate-100 transition-colors cursor-pointer"
        >
          <Settings size={16} />
        </button>
      </div>
    </div>
  );
};
