export type UserStatus = 'online' | 'idle' | 'dnd' | 'offline';

export interface User {
  id: string;
  username: string;
  discriminator: string;
  email: string;
  avatar: string;
  bannerColor?: string;
  customStatus?: string;
  status: UserStatus;
  bio?: string;
  isGuest?: boolean;
  emailVerified?: boolean;
  twoFactorEnabled?: boolean;
  twoFactorType?: 'google' | 'file' | 'email';
  twoFactorKeyId?: string;
  failedLoginAttempts?: number;
  lockedUntil?: number;
  createdAt: string;
}

export interface FriendRelationItem {
  relationId: string;
  status: 'pending' | 'accepted' | 'blocked';
  isSender: boolean;
  createdAt: string;
  friend: User;
}

export interface Role {
  id: string;
  name: string;
  color: string;
  hoist: boolean;
  position: number;
  permissions: {
    administrator: boolean;
    manageChannels: boolean;
    manageServer: boolean;
    sendMessages: boolean;
    embedLinks: boolean;
    attachFiles: boolean;
    voiceConnect: boolean;
    voiceSpeak: boolean;
    kickMembers: boolean;
    manageMessages: boolean;
  };
}

export interface ServerMember {
  userId: string;
  serverId: string;
  nickname?: string;
  roleIds: string[];
  joinedAt: string;
  user?: User;
}

export interface Channel {
  id: string;
  serverId?: string;
  categoryId?: string;
  name: string;
  type: 'text' | 'voice' | 'dm' | 'group_dm';
  topic?: string;
  position: number;
  userLimit?: number;
  createdAt: string;
}

export interface ChannelCategory {
  id: string;
  serverId: string;
  name: string;
  position: number;
}

export interface Server {
  id: string;
  name: string;
  icon?: string;
  banner?: string;
  description?: string;
  ownerId: string;
  inviteCode: string;
  roles: Role[];
  categories: ChannelCategory[];
  channels: Channel[];
  members: ServerMember[];
  createdAt: string;
}

export interface Reaction {
  emoji: string;
  users: string[]; // user IDs who reacted
}

export interface Attachment {
  id: string;
  url: string;
  filename: string;
  contentType: string;
  size: number;
}

export interface PollOption {
  id: string;
  text: string;
  votes: string[]; // User IDs
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  isMultiChoice?: boolean;
  allowMultipleVotes?: boolean;
  expiresAt?: string;
  closed?: boolean;
}

export interface LinkPreviewData {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  favicon?: string;
  youtubeId?: string;
}

export interface Message {
  id: string;
  channelId: string;
  authorId: string;
  author?: User;
  content: string;
  attachments: Attachment[];
  stickerUrl?: string;
  replyToId?: string;
  replyToMessage?: Partial<Message>;
  reactions: Reaction[];
  poll?: Poll;
  linkPreviews?: LinkPreviewData[];
  isPinned: boolean;
  isEdited: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface DirectMessageConversation {
  id: string;
  type: 'dm' | 'group_dm';
  name?: string;
  icon?: string;
  recipientIds: string[];
  recipients?: User[];
  lastMessage?: Message;
  lastMessageAt?: string;
  createdAt: string;
}

export interface StickerPack {
  id: string;
  name: string;
  description: string;
  stickers: {
    id: string;
    name: string;
    url: string;
    packId: string;
  }[];
}

export interface VoiceParticipant {
  userId: string;
  socketId: string;
  channelId: string;
  isMuted: boolean;
  isDeafened: boolean;
  isScreenSharing: boolean;
  isSpeaking: boolean;
  user?: User;
}

export interface ActiveCallSession {
  targetUser: User;
  conversationId: string;
  isIncoming: boolean;
  isVideo: boolean;
  status: 'ringing' | 'connected' | 'ended';
}
