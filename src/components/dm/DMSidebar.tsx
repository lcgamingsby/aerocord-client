import React, { useState, useRef, useEffect, useCallback } from 'react';
import { DirectMessageConversation, Message } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { Users, GripVertical, PanelLeftClose } from 'lucide-react';
import { UserDock } from '../layout/UserDock';
import { ActiveVoiceDock } from '../layout/ActiveVoiceDock';

interface DMSidebarProps {
  conversations: DirectMessageConversation[];
  activeConversationId: string | null;
  unreadDMs?: { [convoId: string]: number };
  onSelectFriendsHub: () => void;
  onSelectConversation: (convo: DirectMessageConversation) => void;
  onOpenSettings: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const DMSidebar: React.FC<DMSidebarProps> = ({
  conversations,
  activeConversationId,
  unreadDMs = {},
  onSelectFriendsHub,
  onSelectConversation,
  onOpenSettings,
  isCollapsed = false,
  onToggleCollapse
}) => {
  const { user, friends } = useAuth();
  const pendingCount = friends.filter(f => f.status === 'pending' && !f.isSender).length;
  const [sidebarWidth, setSidebarWidth] = useState<number>(260);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing) {
      // 68px is the width of ServerSidebar
      const newWidth = e.clientX - 68;
      if (newWidth >= 200 && newWidth <= 480) {
        setSidebarWidth(newWidth);
      }
    }
  }, [isResizing]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
    } else {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    }
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  return (
    <div
      ref={sidebarRef}
      style={{ width: isCollapsed ? 0 : `${sidebarWidth}px` }}
      className={`bg-[#11131a] flex flex-col h-full border-r border-white/5 flex-shrink-0 select-none relative group/sidebar transition-all duration-300 ease-in-out ${
        isCollapsed ? 'min-w-0 max-w-0 opacity-0 -translate-x-4 pointer-events-none overflow-hidden border-none' : 'opacity-100 translate-x-0'
      }`}
    >
      {/* Friends Hub Button Header */}
      <div className="p-3 border-b border-white/5 flex items-center space-x-1.5">
        <button
          onClick={onSelectFriendsHub}
          className={`flex-1 px-3 py-2 rounded-2xl flex items-center justify-between font-bold text-xs transition-all cursor-pointer ${
            activeConversationId === null
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
              : 'text-slate-300 hover:bg-white/5 hover:text-white'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            <Users size={16} />
            <span>Friends</span>
          </div>
          {pendingCount > 0 && (
            <span className="px-1.5 py-0.5 bg-rose-500 text-white text-[9px] font-bold rounded-full">
              {pendingCount}
            </span>
          )}
        </button>

        {/* Minimalist Collapse Sidebar Button */}
        {onToggleCollapse && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse();
            }}
            title="Tutup Sidebar (Ctrl+B)"
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer flex-shrink-0"
          >
            <PanelLeftClose size={16} />
          </button>
        )}
      </div>

      {/* Direct Messages List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          Direct Messages ({conversations.length})
        </div>

        {conversations.map(convo => {
          const recipient = convo.recipients?.find(r => r.id !== user?.id) || convo.recipients?.[0];
          const isActive = activeConversationId === convo.id;
          const unread = unreadDMs[convo.id] || 0;
          const name = convo.name || recipient?.username || 'Direct Message';
          const avatar = recipient?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${recipient?.id}`;

          return (
            <button
              key={convo.id}
              onClick={() => onSelectConversation(convo)}
              className={`w-full flex items-center px-3 py-2.5 rounded-2xl transition-all cursor-pointer text-left group ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-100'
              }`}
            >
              <div className="relative mr-3 flex-shrink-0">
                <img src={avatar} alt={name} className="w-8 h-8 rounded-xl object-cover" />
                <div
                  className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#11131a] ${
                    recipient?.status === 'online' ? 'bg-emerald-500' : 'bg-slate-500'
                  }`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs truncate">{name}</span>
                  {unread > 0 && !isActive && (
                    <span className="min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center shadow animate-pulse ml-1 flex-shrink-0">
                      {unread}
                    </span>
                  )}
                </div>
                <div className={`text-[10px] truncate ${isActive ? 'text-indigo-200' : 'text-slate-500'}`}>
                  {convo.lastMessage?.content || 'Klik untuk chat'}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Voice & User Profile Dock */}
      <ActiveVoiceDock />
      <UserDock onOpenSettings={onOpenSettings} />

      {/* Draggable Resizer Slider on Right Edge */}
      <div
        onMouseDown={startResizing}
        title="Tahan & geser untuk mengubah lebar sidebar"
        className={`absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-indigo-500/60 transition-colors z-40 ${
          isResizing ? 'bg-indigo-500' : 'bg-transparent'
        }`}
      />
    </div>
  );
};
