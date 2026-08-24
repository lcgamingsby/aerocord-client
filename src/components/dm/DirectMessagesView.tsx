import React from 'react';
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
  return (
    <div className="flex-1 flex h-full select-none overflow-hidden bg-[#0d0f14]">
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
