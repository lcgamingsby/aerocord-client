import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider, useSocket } from './context/SocketContext';
import { VoiceProvider, useVoice } from './context/VoiceContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { Server, Channel, DirectMessageConversation, User, Message } from './types';

import { AuthPage } from './components/auth/AuthPage';
import { ServerSidebar } from './components/layout/ServerSidebar';
import { ChannelSidebar } from './components/layout/ChannelSidebar';
import { DirectMessagesView } from './components/dm/DirectMessagesView';
import { ChatArea } from './components/chat/ChatArea';
import { MemberListSidebar } from './components/chat/MemberListSidebar';
import { VoiceChannelRoom } from './components/voice/VoiceChannelRoom';
import { DirectCallModal } from './components/voice/DirectCallModal';

import { CreateServerModal } from './components/modals/CreateServerModal';
import { CreateChannelModal } from './components/modals/CreateChannelModal';
import { UserSettingsModal } from './components/modals/UserSettingsModal';
import { ServerSettingsModal } from './components/modals/ServerSettingsModal';
import { UserProfileModal } from './components/modals/UserProfileModal';
import { apiUrl } from './config/api';
import { Sparkles, Plus } from 'lucide-react';

const MainLayout: React.FC = () => {
  const { user, token } = useAuth();
  const { showInfo } = useToast();
  const { socket, setActiveChannelId, onlineUsers } = useSocket();
  const { currentVoiceChannel } = useVoice();

  const [servers, setServers] = useState<Server[]>([]);
  const [activeServerId, setActiveServerId] = useState<string | null>(null);
  const [activeServer, setActiveServer] = useState<Server | null>(null);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);

  const [conversations, setConversations] = useState<DirectMessageConversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<DirectMessageConversation | null>(null);
  const [unreadDMs, setUnreadDMs] = useState<{ [convoId: string]: number }>({});

  const [showMembers, setShowMembers] = useState(() => typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('aerocord_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem('aerocord_sidebar_collapsed', String(next)); } catch {}
      return next;
    });
  }, []);

  // Global keyboard shortcut: Ctrl+B or Cmd+B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        // Prevent toggle if currently typing inside an input/textarea
        const activeTag = document.activeElement?.tagName.toLowerCase();
        if (activeTag === 'input' || activeTag === 'textarea') return;
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar]);

  // Auto-close member sidebar when window width narrows/shrinks (< 1024px)
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setShowMembers(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Modals
  const [isCreateServerOpen, setIsCreateServerOpen] = useState(false);
  const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false);
  const [createChannelType, setCreateChannelType] = useState<'text' | 'voice'>('text');
  const [createChannelCategoryId, setCreateChannelCategoryId] = useState<string | undefined>(undefined);
  const [isUserSettingsOpen, setIsUserSettingsOpen] = useState(false);
  const [isServerSettingsOpen, setIsServerSettingsOpen] = useState(false);
  const [inspectUser, setInspectUser] = useState<User | null>(null);

  // Fetch servers list
  const fetchServers = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(apiUrl('/api/servers'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setServers(data.servers || []);
      }
    } catch (err) {
      console.error('Failed to fetch servers:', err);
    }
  }, [token]);

  // Fetch DM conversations list
  const fetchConversations = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(apiUrl('/api/dm/conversations'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
    }
  }, [token]);

  // Fetch active server details
  const fetchActiveServerDetails = useCallback(async (srvId: string) => {
    if (!token) return;
    try {
      const res = await fetch(apiUrl(`/api/servers/${srvId}`), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.server) {
          setActiveServer(data.server);
          const firstText = data.server.channels?.find((c: Channel) => c.type === 'text') || data.server.channels?.[0];
          if (firstText) {
            setActiveChannel(firstText);
            setActiveChannelId(firstText.id);
          }
          return;
        }
      }
      // If server does not exist, fallback cleanly to Direct Messages
      setActiveServerId(null);
      setActiveServer(null);
    } catch (err) {
      console.error('Failed to fetch server details:', err);
      setActiveServerId(null);
      setActiveServer(null);
    }
  }, [token, setActiveChannelId]);

  useEffect(() => {
    if (token) {
      fetchServers();
      fetchConversations();
    }
  }, [token, fetchServers, fetchConversations]);

  useEffect(() => {
    if (activeServerId) {
      fetchActiveServerDetails(activeServerId);
      setActiveConversation(null);
    } else {
      setActiveServer(null);
      setActiveChannel(null);
      setActiveChannelId(null);
    }
  }, [activeServerId, fetchActiveServerDetails, setActiveChannelId]);

  // Auto toast notification for incoming private messages and track unread DMs per conversation
  useEffect(() => {
    if (!socket || !user) return;

    const handleIncomingMessage = (msg: Message) => {
      if (msg.authorId !== user.id) {
        if (msg.channelId.startsWith('dm_')) {
          if (msg.channelId !== activeConversation?.id) {
            setUnreadDMs(prev => ({
              ...prev,
              [msg.channelId]: (prev[msg.channelId] || 0) + 1
            }));
            showInfo(
              `💬 Pesan dari ${msg.author?.username || 'Teman'}`,
              msg.content || (msg.attachments && msg.attachments.length > 0 ? '📷 Mengirim gambar' : '🎨 Mengirim stiker')
            );
          }
        }
        fetchConversations();
      }
    };

    socket.on('new_message', handleIncomingMessage);
    return () => {
      socket.off('new_message', handleIncomingMessage);
    };
  }, [socket, user, activeConversation, showInfo, fetchConversations]);

  // Handler for creating DM with a user
  const handleCreateDMWithUser = async (targetUserId: string) => {
    if (!token) return;
    try {
      const res = await fetch(apiUrl('/api/dm/create'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ targetUserId })
      });
      const data = await res.json();
      if (res.ok && data.conversation) {
        setConversations(prev => {
          if (prev.some(c => c.id === data.conversation.id)) return prev;
          return [data.conversation, ...prev];
        });
        setActiveServerId(null);
        setActiveConversation(data.conversation);
        setActiveChannelId(data.conversation.id);
        setUnreadDMs(prev => ({ ...prev, [data.conversation.id]: 0 }));
      }
    } catch (err) {
      console.error('Failed to create DM:', err);
    }
  };

  const handleSelectServer = (srvId: string | null) => {
    setActiveServerId(srvId);
  };

  const handleSelectChannel = (channel: Channel) => {
    setActiveChannel(channel);
    setActiveChannelId(channel.id);
  };

  const handleSelectConversation = (convo: DirectMessageConversation | null) => {
    setActiveConversation(convo);
    setActiveChannelId(convo ? convo.id : null);
    if (convo) {
      // Clear unread notification only when this specific conversation is opened directly
      setUnreadDMs(prev => ({ ...prev, [convo.id]: 0 }));
    }
  };

  const totalUnreadDMs = Object.values(unreadDMs).reduce((a, b) => a + b, 0);

  return (
    <div className="flex h-[100dvh] w-screen bg-[#0b0c10] overflow-hidden text-slate-100 font-sans">
      {/* 1. Leftmost Spaces Rail */}
      <ServerSidebar
        servers={servers}
        activeServerId={activeServerId}
        unreadDMCount={totalUnreadDMs}
        onSelectServer={handleSelectServer}
        onOpenCreateServer={() => setIsCreateServerOpen(true)}
      />

      {/* 2. Main Content Area */}
      {activeServerId === null ? (
        // Direct Messages Mode
        <DirectMessagesView
          conversations={conversations}
          activeConversation={activeConversation}
          unreadDMs={unreadDMs}
          onSelectConversation={handleSelectConversation}
          onOpenSettings={() => setIsUserSettingsOpen(true)}
          onCreateDMWithUser={handleCreateDMWithUser}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={toggleSidebar}
        />
      ) : activeServer ? (
        // Server Mode
        <div className="flex-1 flex h-full min-w-0 overflow-hidden">
          {/* Channel Sidebar */}
          <ChannelSidebar
            server={activeServer}
            activeChannelId={activeChannel?.id || null}
            onSelectChannel={handleSelectChannel}
            onOpenCreateChannel={(type, catId) => {
              setCreateChannelType(type);
              setCreateChannelCategoryId(catId);
              setIsCreateChannelOpen(true);
            }}
            onOpenSettings={() => setIsServerSettingsOpen(true)}
            onOpenUserSettings={() => setIsUserSettingsOpen(true)}
            onServerUpdated={(updated) => {
              setActiveServer(updated);
              setServers(prev => prev.map(s => s.id === updated.id ? updated : s));
            }}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={toggleSidebar}
          />

          {/* Chat or Voice Room */}
          {activeChannel?.type === 'voice' && currentVoiceChannel === activeChannel.id ? (
            <VoiceChannelRoom channelName={activeChannel.name} />
          ) : (
            <ChatArea
              channel={activeChannel}
              conversation={null}
              onToggleMembers={() => setShowMembers(!showMembers)}
              showMembers={showMembers}
              onStartDM={handleCreateDMWithUser}
              isSidebarCollapsed={isSidebarCollapsed}
              onToggleSidebar={toggleSidebar}
            />
          )}

          {/* Right Member List Sidebar (for server text channels) */}
          {showMembers && activeChannel?.type === 'text' && (
            <MemberListSidebar
              members={activeServer.members}
              roles={activeServer.roles}
              ownerId={activeServer.ownerId}
              onlineUsers={onlineUsers}
              onViewProfile={(targetUser) => setInspectUser(targetUser)}
            />
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-[#0d0f14] p-6 text-center select-none animate-in fade-in duration-300">
          <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4 shadow-xl">
            <Sparkles size={32} />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Selamat Datang di AeroCord!</h2>
          <p className="text-xs text-slate-400 max-w-sm mb-6 leading-relaxed">
            Pilih server di sebelah kiri atau buat server baru untuk mulai mengobrol dengan teman-teman Anda.
          </p>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsCreateServerOpen(true)}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-2xl shadow-lg shadow-indigo-600/25 transition-all cursor-pointer flex items-center space-x-2"
            >
              <Plus size={16} />
              <span>Buat Server Baru</span>
            </button>
            <button
              onClick={() => setActiveServerId(null)}
              className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white text-xs font-bold rounded-2xl border border-white/10 transition-all cursor-pointer"
            >
              Buka Obrolan Langsung (DM)
            </button>
          </div>
        </div>
      )}

      {/* Floating Incoming/Outgoing Voice Call Modal */}
      <DirectCallModal />

      {/* User Profile Modal */}
      <UserProfileModal
        user={inspectUser}
        isOpen={!!inspectUser}
        onClose={() => setInspectUser(null)}
        onStartDM={handleCreateDMWithUser}
      />

      {/* Dialog Modals */}
      <CreateServerModal
        isOpen={isCreateServerOpen}
        onClose={() => setIsCreateServerOpen(false)}
        onServerCreated={(newServer) => {
          setServers(prev => [...prev, newServer]);
          setActiveServerId(newServer.id);
        }}
      />

      {activeServer && (
        <>
          <CreateChannelModal
            isOpen={isCreateChannelOpen}
            serverId={activeServer.id}
            categories={activeServer.categories}
            defaultCategoryId={createChannelCategoryId}
            initialType={createChannelType}
            onClose={() => setIsCreateChannelOpen(false)}
            onChannelCreated={(newChannel) => {
              setActiveServer(prev => prev ? { ...prev, channels: [...prev.channels, newChannel] } : null);
              handleSelectChannel(newChannel);
            }}
          />

          <ServerSettingsModal
            server={activeServer}
            isOpen={isServerSettingsOpen}
            onClose={() => setIsServerSettingsOpen(false)}
            onServerUpdated={(updated) => {
              setActiveServer(updated);
              setServers(prev => prev.map(s => s.id === updated.id ? updated : s));
            }}
            onServerDeleted={(deletedId) => {
              setServers(prev => prev.filter(s => s.id !== deletedId));
              setActiveServerId(null);
            }}
          />
        </>
      )}

      <UserSettingsModal
        isOpen={isUserSettingsOpen}
        onClose={() => setIsUserSettingsOpen(false)}
      />
    </div>
  );
};

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <SocketProvider>
          <VoiceProvider>
            <AppContent />
          </VoiceProvider>
        </SocketProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

const AppContent: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-[#0b0c10] flex flex-col items-center justify-center text-white space-y-4">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <div className="text-xs font-bold tracking-widest uppercase text-slate-400">Memuat AeroCord...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return <MainLayout />;
};


