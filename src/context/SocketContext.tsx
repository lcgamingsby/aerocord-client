import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { Message, UserStatus } from '../types';
import { soundEffects } from '../utils/soundEffects';
import { SOCKET_URL } from '../config/api';

interface TypingUser {
  userId: string;
  username: string;
}

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  activeChannelId: string | null;
  setActiveChannelId: (id: string | null) => void;
  typingUsers: { [channelId: string]: TypingUser[] };
  sendMessage: (channelId: string, content: string, attachments?: any[], stickerUrl?: string, replyToId?: string) => void;
  editMessage: (messageId: string, content: string) => void;
  deleteMessage: (messageId: string) => void;
  addReaction: (messageId: string, emoji: string) => void;
  startTyping: (channelId: string) => void;
  stopTyping: (channelId: string) => void;
  onlineUsers: Map<string, { status: UserStatus; customStatus?: string }>;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [activeChannelId, setActiveChannelId] = useState<string | null>('chan_general');
  const [typingUsers, setTypingUsers] = useState<{ [channelId: string]: TypingUser[] }>({});
  const [onlineUsers, setOnlineUsers] = useState<Map<string, { status: UserStatus; customStatus?: string }>>(new Map());

  const typingTimeouts = useRef<{ [key: string]: number }>({});

  useEffect(() => {
    if (!token || !user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    const s = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    s.on('connect', () => {
      setIsConnected(true);
      if (activeChannelId) {
        s.emit('join_channel', activeChannelId);
      }
    });

    s.on('disconnect', () => {
      setIsConnected(false);
    });

    s.on('user_presence_change', (data: { userId: string; status: UserStatus; customStatus?: string }) => {
      setOnlineUsers(prev => {
        const next = new Map(prev);
        next.set(data.userId, { status: data.status, customStatus: data.customStatus });
        return next;
      });
    });

    s.on('user_typing', (data: { channelId: string; user: { id: string; username: string } }) => {
      const { channelId, user: typingUser } = data;
      setTypingUsers(prev => {
        const current = prev[channelId] || [];
        if (current.some(u => u.userId === typingUser.id)) return prev;
        return { ...prev, [channelId]: [...current, { userId: typingUser.id, username: typingUser.username }] };
      });

      // Clear after 3 seconds
      const key = `${channelId}_${typingUser.id}`;
      if (typingTimeouts.current[key]) {
        clearTimeout(typingTimeouts.current[key]);
      }
      typingTimeouts.current[key] = window.setTimeout(() => {
        setTypingUsers(prev => {
          const current = prev[channelId] || [];
          return { ...prev, [channelId]: current.filter(u => u.userId !== typingUser.id) };
        });
      }, 3500);
    });

    s.on('user_stopped_typing', (data: { channelId: string; userId: string }) => {
      setTypingUsers(prev => {
        const current = prev[data.channelId] || [];
        return { ...prev, [data.channelId]: current.filter(u => u.userId !== data.userId) };
      });
    });

    s.on('new_message', (msg: Message) => {
      if (msg.authorId !== user.id) {
        soundEffects.playMessagePop();
      }
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, [token, user]);

  // Handle active channel room joining
  useEffect(() => {
    if (!socket || !isConnected || !activeChannelId) return;

    socket.emit('join_channel', activeChannelId);

    return () => {
      socket.emit('leave_channel', activeChannelId);
    };
  }, [socket, isConnected, activeChannelId]);

  const sendMessage = useCallback((channelId: string, content: string, attachments: any[] = [], stickerUrl?: string, replyToId?: string) => {
    if (!socket) return;
    socket.emit('send_message', {
      channelId,
      content,
      attachments,
      stickerUrl,
      replyToId
    });
    soundEffects.playMessagePop();
  }, [socket]);

  const editMessage = useCallback((messageId: string, content: string) => {
    if (!socket) return;
    socket.emit('edit_message', { messageId, content });
  }, [socket]);

  const deleteMessage = useCallback((messageId: string) => {
    if (!socket) return;
    socket.emit('delete_message', { messageId });
  }, [socket]);

  const addReaction = useCallback((messageId: string, emoji: string) => {
    if (!socket) return;
    socket.emit('add_reaction', { messageId, emoji });
  }, [socket]);

  const startTyping = useCallback((channelId: string) => {
    if (!socket) return;
    socket.emit('typing_start', { channelId });
  }, [socket]);

  const stopTyping = useCallback((channelId: string) => {
    if (!socket) return;
    socket.emit('typing_stop', { channelId });
  }, [socket]);

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        activeChannelId,
        setActiveChannelId,
        typingUsers,
        sendMessage,
        editMessage,
        deleteMessage,
        addReaction,
        startTyping,
        stopTyping,
        onlineUsers
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = (): SocketContextType => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
