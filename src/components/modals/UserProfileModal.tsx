import React from 'react';
import { User, ServerMember, Role } from '../../types';
import { X, MessageSquare, Phone, UserPlus, ShieldCheck, Crown, Calendar, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useVoice } from '../../context/VoiceContext';
import { useToast } from '../../context/ToastContext';

interface UserProfileModalProps {
  user: User | null;
  memberInfo?: ServerMember;
  roles?: Role[];
  isOwner?: boolean;
  isOpen: boolean;
  onClose: () => void;
  onStartDM?: (userId: string) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  user,
  memberInfo,
  roles = [],
  isOwner = false,
  isOpen,
  onClose,
  onStartDM
}) => {
  const { user: currentUser, friends, sendFriendRequest } = useAuth();
  const { startDirectCall } = useVoice();
  const { showSuccess, showError } = useToast();

  if (!isOpen || !user) return null;

  const isMe = currentUser?.id === user.id;
  const isFriend = friends.some(f => f.friend.id === user.id && f.status === 'accepted');
  const userRoles = memberInfo ? roles.filter(r => memberInfo.roleIds.includes(r.id)) : [];

  const statusColors: { [key: string]: { bg: string; text: string; label: string } } = {
    online: { bg: 'bg-emerald-500', text: 'text-emerald-400', label: 'Online' },
    idle: { bg: 'bg-amber-500', text: 'text-amber-400', label: 'Idle' },
    dnd: { bg: 'bg-rose-500', text: 'text-rose-400', label: 'Do Not Disturb' },
    offline: { bg: 'bg-slate-500', text: 'text-slate-400', label: 'Offline' }
  };

  const currentStatus = statusColors[user.status] || statusColors.offline;

  const handleAddFriend = async () => {
    const res = await sendFriendRequest({ userId: user.id });
    if (res.success) {
      showSuccess('Permintaan Pertemanan Terkirim', `Permintaan pertemanan terkirim ke ${user.username}!`);
    } else {
      showError('Gagal Mengirim Permintaan', res.error || 'Terjadi kesalahan');
    }
  };

  const handleStartCall = () => {
    onClose();
    if (onStartDM) onStartDM(user.id);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#13161f] rounded-3xl shadow-2xl overflow-hidden border border-white/10 text-white animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Banner with Gradient & Custom Color */}
        <div
          className="h-28 w-full relative transition-all"
          style={{
            background: user.bannerColor
              ? `linear-gradient(135deg, ${user.bannerColor}, #0f172a)`
              : 'linear-gradient(135deg, #6366f1, #06b6d4)'
          }}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3.5 right-3.5 p-1.5 rounded-full bg-black/40 hover:bg-black/70 text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Profile Details Container */}
        <div className="px-6 pb-6 pt-0 relative">
          {/* Avatar floating on banner */}
          <div className="flex justify-between items-end -mt-14 mb-4">
            <div className="relative">
              <img
                src={user.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.id}`}
                alt={user.username}
                className="w-24 h-24 rounded-2xl border-4 border-[#13161f] object-cover bg-slate-800 shadow-xl"
              />
              <div
                className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-4 border-[#13161f] ${currentStatus.bg}`}
                title={currentStatus.label}
              />
            </div>

            {/* Action buttons (if not self) */}
            {!isMe && (
              <div className="flex items-center space-x-2 pb-1">
                <button
                  onClick={() => {
                    onClose();
                    if (onStartDM) onStartDM(user.id);
                  }}
                  title="Send Direct Message"
                  className="p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg hover:shadow-indigo-500/25 transition-all flex items-center space-x-1.5 text-xs font-semibold cursor-pointer"
                >
                  <MessageSquare size={16} />
                  <span>Chat</span>
                </button>
                <button
                  onClick={handleStartCall}
                  title="Voice Call"
                  className="p-2.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-xl border border-white/10 transition-colors cursor-pointer"
                >
                  <Phone size={16} />
                </button>
                {!isFriend && (
                  <button
                    onClick={handleAddFriend}
                    title="Add Friend"
                    className="p-2.5 bg-slate-800 hover:bg-slate-700 text-indigo-400 rounded-xl border border-white/10 transition-colors cursor-pointer"
                  >
                    <UserPlus size={16} />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Username & Discriminator */}
          <div className="mb-3">
            <div className="flex items-center space-x-2">
              <h3 className="text-xl font-black text-white">{user.username}</h3>
              <span className="text-xs text-slate-400 font-mono">#{user.discriminator}</span>
              {isOwner && (
                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30 flex items-center space-x-1">
                  <Crown size={12} />
                  <span>Owner</span>
                </span>
              )}
            </div>
            {user.customStatus && (
              <div className="text-xs text-indigo-300 mt-1 flex items-center space-x-1.5 font-medium">
                <Sparkles size={13} className="text-indigo-400" />
                <span>{user.customStatus}</span>
              </div>
            )}
          </div>

          <div className="h-[1px] bg-white/10 my-3.5" />

          {/* About Me / Bio */}
          <div className="space-y-3 text-xs">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                About Me
              </div>
              <p className="text-slate-300 leading-relaxed">
                {user.bio || 'This user prefers to keep an air of mystery. No bio provided yet.'}
              </p>
            </div>

            {/* Server Roles if any */}
            {userRoles.length > 0 && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Roles
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {userRoles.map(r => (
                    <span
                      key={r.id}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border flex items-center space-x-1"
                      style={{
                        backgroundColor: `${r.color}15`,
                        borderColor: `${r.color}40`,
                        color: r.color
                      }}
                    >
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: r.color }} />
                      <span>{r.name}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Account Info */}
            <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400">
              <div className="flex items-center space-x-1.5">
                <Calendar size={14} className="text-slate-500" />
                <span>Member since {new Date(user.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center space-x-1 text-emerald-400">
                <ShieldCheck size={14} />
                <span>Verified</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
