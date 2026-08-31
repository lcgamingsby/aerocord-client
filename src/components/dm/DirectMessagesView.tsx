import React, { useRef, useCallback } from 'react';
import { DirectMessageConversation } from '../../types';
import { DMSidebar } from './DMSidebar';
import { FriendsHubView } from './FriendsHubView';
import { ChatArea } from '../chat/ChatArea';

interface DirectMessagesViewProps {
  conversations: DirectMessageConversation[];
  activeConversation: DirectMessageConversation | null;
  unreadDMs?: { [convoId: string]: number };
  onSelectConversation: (convo: DirectMessageConversation | null) => void;
  onOpenSettings: () => void;
  onCreateDMWithUser: (targetUserId: string) => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export const DirectMessagesView: React.FC<DirectMessagesViewProps> = ({
  conversations,
  activeConversation,
  unreadDMs = {},
  onSelectConversation,
  onOpenSettings,
  onCreateDMWithUser,
  isSidebarCollapsed = false,
  onToggleSidebar
}) => {
  // Touch swipe detection: swipe left (right-to-left) to open last conversation
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);

    // Only fire swipe if motion is mostly horizontal
    if (dy > 100) {
      touchStartX.current = null;
      touchStartY.current = null;
      return;
    }

    // Swipe LEFT (right-to-left, dx < -50): open last conversation from Friends Hub
    if (dx < -50 && !activeConversation && conversations.length > 0) {
      onSelectConversation(conversations[0]);
    }

    // Swipe RIGHT (left-to-right, dx > 50): go back to Friends Hub from a conversation
    if (dx > 50 && activeConversation) {
      onSelectConversation(null as unknown as DirectMessageConversation);
    }

    touchStartX.current = null;
    touchStartY.current = null;
  }, [activeConversation, conversations, onSelectConversation]);

  return (
    <div
      className="flex-1 flex h-full select-none overflow-hidden bg-[#0d0f14]"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* 1. Left Resizable DM Sidebar */}
      <DMSidebar
        conversations={conversations}
        activeConversationId={activeConversation?.id || null}
        unreadDMs={unreadDMs}
        onSelectFriendsHub={() => onSelectConversation(null)}
        onSelectConversation={onSelectConversation}
        onOpenSettings={onOpenSettings}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={onToggleSidebar}
      />

      {/* 2. Main Right Area: Friends Hub or Chat Area */}
      {activeConversation ? (
        <ChatArea
          channel={null}
          conversation={activeConversation}
          onToggleMembers={() => {}}
          showMembers={false}
          onStartDM={onCreateDMWithUser}
          onBackToFriends={() => onSelectConversation(null)}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={onToggleSidebar}
        />
      ) : (
        <FriendsHubView 
          onStartDMWithUser={onCreateDMWithUser} 
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={onToggleSidebar}
        />
      )}
    </div>
  );
};
