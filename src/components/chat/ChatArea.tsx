import React, { useState, useEffect, useRef } from 'react';
import { Hash, Volume2, Phone, Video, Users, AtSign, Sparkles, Pin, Search, ArrowLeft, X, Music, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Message, Channel, User, DirectMessageConversation } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useVoice } from '../../context/VoiceContext';
import { useToast } from '../../context/ToastContext';
import { soundEffects } from '../../utils/soundEffects';
import { MessageItem } from './MessageItem';
import { MessageInput } from './MessageInput';
import { ImageLightboxModal } from '../modals/ImageLightboxModal';
import { UserProfileModal } from '../modals/UserProfileModal';
import { apiUrl } from '../../config/api';

interface ChatAreaProps {
  channel: Channel | null;
  conversation?: DirectMessageConversation | null;
  onToggleMembers: () => void;
  showMembers: boolean;
  onStartDM?: (userId: string) => void;
  onBackToFriends?: () => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  channel,
  conversation,
  onToggleMembers,
  showMembers,
  onStartDM,
  onBackToFriends,
  isSidebarCollapsed = false,
  onToggleSidebar
}) => {
  const { user } = useAuth();
  const { socket, typingUsers, sendMessage, editMessage, deleteMessage, addReaction, startTyping, stopTyping } = useSocket();
  const { startDirectCall } = useVoice();
  const { showInfo, showSuccess } = useToast();

  const [messages, setMessages] = useState<Message[]>([]);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [inspectUser, setInspectUser] = useState<User | null>(null);

  // New Features: Search, Pinned Messages, Soundboard
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [showPinned, setShowPinned] = useState<boolean>(false);
  const [showSoundboard, setShowSoundboard] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeId = channel ? channel.id : (conversation ? conversation.id : null);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    if (!activeId) return;

    fetch(apiUrl(`/api/channels/${activeId}/messages`), {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('aerocord_token')}`
      }
    })
      .then(res => res.json())
      .then(data => {
        if (data.messages) {
          setMessages(data.messages);
          setTimeout(() => scrollToBottom('auto'), 100);
        }
      })
      .catch(err => console.error('Failed to fetch messages:', err));
  }, [activeId]);

  useEffect(() => {
    if (!socket || !activeId) return;

    const handleNewMessage = (msg: Message) => {
      if (msg.channelId === activeId) {
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        scrollToBottom();
      }
    };

    const handleMessageUpdated = (updatedMsg: Message) => {
      if (updatedMsg.channelId === activeId) {
        setMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
      }
    };

    const handleMessageDeleted = (data: { messageId: string; channelId: string }) => {
      if (data.channelId === activeId) {
        setMessages(prev => prev.filter(m => m.id !== data.messageId));
      }
    };

    const handleReactionUpdated = (data: { messageId: string; reactions: any[] }) => {
      setMessages(prev => prev.map(m => {
        if (m.id === data.messageId) {
          return { ...m, reactions: data.reactions };
        }
        return m;
      }));
    };

    socket.on('new_message', handleNewMessage);
    socket.on('message_updated', handleMessageUpdated);
    socket.on('message_deleted', handleMessageDeleted);
    socket.on('reaction_updated', handleReactionUpdated);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('message_updated', handleMessageUpdated);
      socket.off('message_deleted', handleMessageDeleted);
      socket.off('reaction_updated', handleReactionUpdated);
    };
  }, [socket, activeId]);

  const channelTypers = activeId ? (typingUsers[activeId] || []).filter(u => u.userId !== user?.id) : [];

  const recipientUser = conversation?.recipients?.find(r => r.id !== user?.id) || conversation?.recipients?.[0];
  const displayName = channel ? channel.name : (conversation?.name || recipientUser?.username || 'Direct Message');

  const handleStartCall = (isVideo = false) => {
    if (recipientUser && conversation) {
      startDirectCall(recipientUser, conversation.id, isVideo);
    }
  };

  const filteredMessages = searchQuery.trim()
    ? messages.filter(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()) || m.author?.username.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  const pinnedMessages = messages.filter(m => m.isPinned);

  const soundboardSounds = [
    { name: 'Voice Join 📢', play: () => soundEffects.playJoinVoiceSound() },
    { name: 'Voice Leave 🚪', play: () => soundEffects.playLeaveVoiceSound() },
    { name: 'Message Pop 💬', play: () => soundEffects.playMessagePop() },
    { name: 'Mute Click 🔘', play: () => soundEffects.playMuteSound() },
    { name: 'Unmute Click 🔔', play: () => soundEffects.playUnmuteSound() }
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0d0f14] overflow-hidden select-text relative">
      {/* Top Clean Minimal Header */}
      <div className="h-14 px-4 sm:px-6 border-b border-white/5 flex items-center justify-between bg-[#11131a]/80 backdrop-blur-md z-20 flex-shrink-0">
        <div className="flex items-center space-x-2.5 min-w-0">
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

          {/* Back button when in DM mode */}
          {conversation && onBackToFriends && (
            <button
              onClick={onBackToFriends}
              title="Kembali ke Friends Hub"
              className="p-1.5 rounded-xl bg-white/[0.04] hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer mr-0.5"
            >
              <ArrowLeft size={16} />
            </button>
          )}

          <div className={`p-2 rounded-xl ${channel?.type === 'voice' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-indigo-500/10 text-indigo-400'}`}>
            {channel?.type === 'voice' ? (
              <Volume2 size={18} />
            ) : conversation ? (
              <AtSign size={18} />
            ) : (
              <Hash size={18} />
            )}
          </div>
          <div>
            <div className="font-bold text-sm text-slate-100 flex items-center space-x-2">
              <span>{displayName}</span>
            </div>
            {channel?.topic && (
              <div className="text-[11px] text-slate-400 truncate max-w-lg hidden sm:block">
                {channel.topic}
              </div>
            )}
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center space-x-2 text-slate-400">
          {/* Search Toggle */}
          <button
            onClick={() => setIsSearching(!isSearching)}
            title="Cari Pesan"
            className={`p-2 rounded-xl transition-colors cursor-pointer ${
              isSearching ? 'text-indigo-400 bg-indigo-500/10' : 'hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Search size={17} />
          </button>

          {/* Soundboard Launcher */}
          <button
            onClick={() => setShowSoundboard(!showSoundboard)}
            title="Soundboard Efek Suara"
            className={`p-2 rounded-xl transition-colors cursor-pointer ${
              showSoundboard ? 'text-indigo-400 bg-indigo-500/10' : 'hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Music size={17} />
          </button>

          {/* Pinned Messages */}
          <button
            onClick={() => setShowPinned(!showPinned)}
            title="Pesan Tersemat"
            className={`p-2 rounded-xl transition-colors cursor-pointer relative ${
              showPinned ? 'text-amber-400 bg-amber-500/10' : 'hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Pin size={17} />
            {pinnedMessages.length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400" />
            )}
          </button>

          {conversation && (
            <>
              <button
                onClick={() => handleStartCall(false)}
                title="Panggilan Suara"
                className="p-2 hover:text-emerald-400 hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
              >
                <Phone size={17} />
              </button>
              <button
                onClick={() => handleStartCall(true)}
                title="Panggilan Video"
                className="p-2 hover:text-indigo-400 hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
              >
                <Video size={17} />
              </button>
            </>
          )}

          {channel && (
            <button
              onClick={onToggleMembers}
              title="Toggle Daftar Anggota"
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                showMembers ? 'text-indigo-400 bg-indigo-500/10' : 'hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Users size={17} />
            </button>
          )}
        </div>
      </div>

      {/* Message Search Filter Bar (if searching) */}
      {isSearching && (
        <div className="px-6 py-2.5 bg-[#11131a] border-b border-white/5 flex items-center space-x-3 animate-in slide-in-from-top-2 duration-150">
          <Search size={15} className="text-indigo-400" />
          <input
            type="text"
            placeholder={`Cari pesan dalam #${displayName}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
            className="flex-1 bg-transparent text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
          />
          {searchQuery && (
            <span className="text-[10px] text-slate-400">
              {filteredMessages.length} hasil ditemukan
            </span>
          )}
          <button
            onClick={() => { setIsSearching(false); setSearchQuery(''); }}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Soundboard Popover */}
      {showSoundboard && (
        <div className="absolute top-16 right-6 z-40 w-64 bg-[#13161f] border border-white/10 rounded-2xl shadow-2xl p-3 animate-in zoom-in-95 duration-100">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400 flex items-center space-x-1.5">
              <Music size={13} />
              <span>Soundboard</span>
            </span>
            <button
              onClick={() => setShowSoundboard(false)}
              className="text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
            >
              <X size={13} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {soundboardSounds.map((snd, idx) => (
              <button
                key={idx}
                onClick={() => {
                  snd.play();
                  showInfo('Sound Played', snd.name);
                }}
                className="p-2.5 bg-[#0c0e14] hover:bg-indigo-600/30 border border-white/5 hover:border-indigo-500/50 rounded-xl text-xs font-semibold text-slate-200 transition-all text-center cursor-pointer"
              >
                {snd.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Pinned Messages Popover */}
      {showPinned && (
        <div className="absolute top-16 right-6 z-40 w-80 max-h-96 overflow-y-auto bg-[#13161f] border border-white/10 rounded-2xl shadow-2xl p-4 animate-in zoom-in-95 duration-100">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-white/5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center space-x-1.5">
              <Pin size={13} />
              <span>Pesan Tersemat ({pinnedMessages.length})</span>
            </span>
            <button
              onClick={() => setShowPinned(false)}
              className="text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
            >
              <X size={13} />
            </button>
          </div>
          {pinnedMessages.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-500">
              Belum ada pesan yang disematkan di channel ini.
            </div>
          ) : (
            <div className="space-y-2">
              {pinnedMessages.map(msg => (
                <div key={msg.id} className="p-2.5 rounded-xl bg-[#0c0e14] border border-white/5 text-xs text-slate-200">
                  <div className="font-bold text-[11px] text-indigo-400 mb-0.5">{msg.author?.username}</div>
                  <div>{msg.content}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 flex flex-col justify-between">
        <div className="space-y-1">
          {/* Welcome Banner */}
          {!searchQuery && (
            <div className="px-4 py-8 mb-6 rounded-2xl bg-gradient-to-r from-indigo-500/5 via-cyan-500/5 to-transparent border border-white/5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center mb-3 shadow-lg shadow-indigo-500/20">
                <Sparkles size={24} className="text-white" />
              </div>
              <h2 className="text-xl font-black text-white mb-1 tracking-tight">
                Selamat datang di {channel ? `#${channel.name}` : displayName}!
              </h2>
              <p className="text-xs text-slate-400">
                {channel
                  ? `Ini adalah awal dari channel obrolan #${channel.name}.`
                  : `Ini adalah riwayat percakapan langsung dengan ${displayName}.`}
              </p>
            </div>
          )}

          {/* Message List */}
          {filteredMessages.map((msg) => (
            <MessageItem
              key={msg.id}
              message={msg}
              currentUser={user}
              onReply={(m) => setReplyingTo(m)}
              onEdit={(mId, content) => editMessage(mId, content)}
              onDelete={(mId) => deleteMessage(mId)}
              onAddReaction={(mId, emoji) => addReaction(mId, emoji)}
              onOpenImage={(url) => setLightboxImage(url)}
              onViewProfile={(authorUser) => setInspectUser(authorUser)}
            />
          ))}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Typing Indicator */}
      {channelTypers.length > 0 && (
        <div className="px-6 py-1 text-xs text-slate-400 flex items-center space-x-2 animate-pulse">
          <div className="flex space-x-1">
            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></span>
            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
          </div>
          <span className="text-[11px]">
            {channelTypers.map(t => t.username).join(', ')} sedang mengetik...
          </span>
        </div>
      )}

      {/* Message Input Bar */}
      <MessageInput
        channelName={displayName}
        isDM={!!conversation}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
        onSendMessage={(content, attachments, stickerUrl, replyToId) => {
          if (activeId) {
            sendMessage(activeId, content, attachments, stickerUrl, replyToId);
          }
        }}
        onTyping={() => {
          if (activeId) startTyping(activeId);
        }}
        onStopTyping={() => {
          if (activeId) stopTyping(activeId);
        }}
      />

      {/* Image Lightbox Modal */}
      <ImageLightboxModal
        imageUrl={lightboxImage}
        onClose={() => setLightboxImage(null)}
      />

      {/* User Profile Modal */}
      <UserProfileModal
        user={inspectUser}
        isOpen={!!inspectUser}
        onClose={() => setInspectUser(null)}
        onStartDM={onStartDM}
      />
    </div>
  );
};

