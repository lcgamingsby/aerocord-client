import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { User } from '../../types';
import { Users, MessageSquare, Phone, Check, X, UserPlus, Search, Sparkles, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { UserProfileModal } from '../modals/UserProfileModal';

interface FriendsHubViewProps {
  onStartDMWithUser: (targetUserId: string) => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

type TabType = 'online' | 'all' | 'pending' | 'add_friend';

export const FriendsHubView: React.FC<FriendsHubViewProps> = ({
  onStartDMWithUser,
  isSidebarCollapsed = false,
  onToggleSidebar
}) => {
  const { user, friends, refreshFriends, sendFriendRequest, respondFriendRequest } = useAuth();
  const { showSuccess, showError, showInfo } = useToast();

  const [activeTab, setActiveTab] = useState<TabType>('online');
  const [friendInput, setFriendInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [inspectUser, setInspectUser] = useState<User | null>(null);

  useEffect(() => {
    refreshFriends();
  }, [refreshFriends]);

  const handleSendRequest = async (targetUsername?: string) => {
    const input = targetUsername || friendInput;
    if (!input.trim()) return;

    let target: any = {};
    if (input.includes('#')) {
      const [username, discriminator] = input.split('#');
      target = { username: username.trim(), discriminator: discriminator.trim() };
    } else {
      target = { username: input.trim() };
    }

    const res = await sendFriendRequest(target);
    if (res.success) {
      showSuccess('Permintaan Pertemanan Terkirim', `Permintaan berhasil dikirim ke ${input}.`);
      setFriendInput('');
    } else {
      showError('Gagal Mengirim Permintaan', res.error || 'User tidak ditemukan atau sudah berteman.');
    }
  };

  const pendingRequests = friends.filter(f => f.status === 'pending');
  const acceptedFriends = friends.filter(f => f.status === 'accepted');
  const onlineFriends = acceptedFriends.filter(f => f.friend.status === 'online' || f.friend.status === 'idle');

  const displayedFriends = activeTab === 'online'
    ? onlineFriends
    : activeTab === 'all'
    ? acceptedFriends
    : [];

  const filteredFriends = searchQuery.trim()
    ? displayedFriends.filter(f => f.friend.username.toLowerCase().includes(searchQuery.toLowerCase()))
    : displayedFriends;

  return (
    <div className="flex-1 flex flex-col bg-[#0d0f14] h-full overflow-hidden select-none relative">
      {/* Top Tab Navigation Bar */}
      <div className="h-14 px-4 sm:px-6 border-b border-white/5 flex items-center space-x-4 sm:space-x-6 bg-[#11131a]/80 backdrop-blur-md flex-shrink-0">
        <div className="flex items-center space-x-2.5 text-white font-black text-sm">
          {/* Sidebar Open Button (Only visible when sidebar is collapsed) */}
          {onToggleSidebar && isSidebarCollapsed && (
            <button
              onClick={onToggleSidebar}
              title="Buka Sidebar (Ctrl+B)"
              className="p-1.5 rounded-xl transition-all cursor-pointer mr-0.5 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white border border-indigo-500/30 shadow-sm"
            >
              <PanelLeftOpen size={16} />
            </button>
          )}
          <Users size={18} className="text-indigo-400" />
          <span>Friends</span>
        </div>

        <div className="h-4 w-[1px] bg-white/10" />

        <div className="flex items-center space-x-2 text-xs font-semibold overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('online')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'online' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Online ({onlineFriends.length})
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'all' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Semua ({acceptedFriends.length})
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap relative ${
              activeTab === 'pending' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Tertunda</span>
            {pendingRequests.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-rose-500 text-white text-[9px] font-bold rounded-full">
                {pendingRequests.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('add_friend')}
            className={`px-3.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'add_friend'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-md shadow-emerald-600/25'
            }`}
          >
            Tambah Teman
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6 relative">
        {/* Tap-to-open-sidebar overlay: only shown on mobile when sidebar is collapsed */}
        {isSidebarCollapsed && onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="absolute inset-0 z-10 bg-transparent cursor-pointer md:hidden"
            aria-label="Buka sidebar"
          />
        )}
        {/* ADD FRIEND TAB */}
        {activeTab === 'add_friend' && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-wider mb-1">
                Tambah Teman
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                Ketik username dan tag 4-digit teman Anda (contoh: <code className="text-indigo-300">username#1234</code>).
              </p>

              <div className="relative flex items-center bg-[#13161f] p-3 rounded-2xl border border-white/10 focus-within:border-indigo-500 shadow-lg">
                <input
                  type="text"
                  placeholder="Ketik username#tag teman..."
                  value={friendInput}
                  onChange={(e) => setFriendInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendRequest()}
                  className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
                />
                <button
                  onClick={() => handleSendRequest()}
                  disabled={!friendInput.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg transition-all cursor-pointer"
                >
                  Kirim Permintaan
                </button>
              </div>
            </div>

            {/* Share Your Tag Card */}
            {user && (
              <div className="p-5 rounded-3xl bg-[#13161f] border border-white/10 space-y-2 shadow-xl">
                <div className="flex items-center space-x-2 text-xs font-bold text-indigo-400 uppercase tracking-wider">
                  <Sparkles size={16} />
                  <span>Bagikan Tag Anda</span>
                </div>
                <p className="text-xs text-slate-400">
                  Teman Anda dapat menambahkan Anda menggunakan tag AeroCord Anda:
                </p>
                <div className="p-3 bg-[#0c0e14] border border-white/5 rounded-2xl flex items-center justify-between">
                  <span className="font-mono text-sm font-bold text-white tracking-wide">
                    {user.username}#{user.discriminator}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${user.username}#${user.discriminator}`);
                      showSuccess('Disalin!', 'Tag Anda berhasil disalin ke clipboard.');
                    }}
                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-200 rounded-xl transition-all cursor-pointer"
                  >
                    Salin Tag
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PENDING REQUESTS TAB */}
        {activeTab === 'pending' && (
          <div className="space-y-4">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Permintaan Pertemanan Tertunda — {pendingRequests.length}
            </div>

            {pendingRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500 space-y-2">
                <Users size={40} className="text-slate-600" />
                <span className="text-xs">Tidak ada permintaan pertemanan yang tertunda.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingRequests.map(req => (
                  <div
                    key={req.relationId}
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-[#13161f] border border-white/5 hover:border-white/10 transition-all"
                  >
                    <div
                      className="flex items-center space-x-3 cursor-pointer"
                      onClick={() => setInspectUser(req.friend)}
                    >
                      <img
                        src={req.friend.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${req.friend.id}`}
                        alt={req.friend.username}
                        className="w-10 h-10 rounded-xl object-cover"
                      />
                      <div>
                        <div className="font-bold text-xs text-white">
                          {req.friend.username}
                          <span className="text-slate-400 text-[10px] ml-1">#{req.friend.discriminator}</span>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {req.isSender ? 'Permintaan Terkirim' : 'Permintaan Masuk'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {!req.isSender && (
                        <button
                          onClick={async () => {
                            await respondFriendRequest(req.relationId, 'accept');
                            showSuccess('Pertemanan Diterima', `Anda sekarang berteman dengan ${req.friend.username}.`);
                          }}
                          title="Terima"
                          className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer"
                        >
                          <Check size={16} />
                        </button>
                      )}
                      <button
                        onClick={async () => {
                          await respondFriendRequest(req.relationId, 'decline');
                          showInfo('Permintaan Ditolak', `Permintaan dari ${req.friend.username} ditolak.`);
                        }}
                        title="Tolak"
                        className="p-2 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white transition-colors cursor-pointer"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ONLINE / ALL FRIENDS TAB */}
        {(activeTab === 'online' || activeTab === 'all') && (
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="relative max-w-md">
              <input
                type="text"
                placeholder="Cari teman..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3.5 py-2.5 pl-10 bg-[#13161f] text-xs text-slate-100 rounded-2xl border border-white/10 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <Search size={15} className="absolute left-3.5 top-3 text-slate-500" />
            </div>

            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {activeTab === 'online' ? 'Teman Online' : 'Semua Teman'} — {filteredFriends.length}
            </div>

            {filteredFriends.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500 space-y-2">
                <Users size={40} className="text-slate-600" />
                <span className="text-xs">Tidak ada teman ditemukan.</span>
              </div>
            ) : (
              <div className="space-y-1.5">
                {filteredFriends.map(f => (
                  <div
                    key={f.relationId}
                    className="flex items-center justify-between p-3 rounded-2xl hover:bg-white/[0.03] transition-all border border-transparent hover:border-white/5 group"
                  >
                    <div
                      className="flex items-center space-x-3 cursor-pointer flex-1"
                      onClick={() => setInspectUser(f.friend)}
                    >
                      <div className="relative">
                        <img
                          src={f.friend.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${f.friend.id}`}
                          alt={f.friend.username}
                          className="w-9 h-9 rounded-xl object-cover"
                        />
                        <div
                          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0d0f14] ${
                            f.friend.status === 'online' ? 'bg-emerald-500' : 'bg-amber-500'
                          }`}
                        />
                      </div>
                      <div>
                        <div className="font-bold text-xs text-white flex items-center space-x-1">
                          <span>{f.friend.username}</span>
                          <span className="text-slate-400 text-[10px]">#{f.friend.discriminator}</span>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {f.friend.customStatus || (f.friend.status === 'online' ? 'Online' : 'Idle')}
                        </span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => onStartDMWithUser(f.friend.id)}
                        title="Kirim Pesan"
                        className="p-2.5 bg-slate-800 hover:bg-indigo-600 rounded-xl text-slate-300 hover:text-white transition-all cursor-pointer"
                      >
                        <MessageSquare size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* User Profile Modal */}
      <UserProfileModal
        user={inspectUser}
        isOpen={!!inspectUser}
        onClose={() => setInspectUser(null)}
        onStartDM={onStartDMWithUser}
      />
    </div>
  );
};
