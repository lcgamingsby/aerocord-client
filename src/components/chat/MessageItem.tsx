import React, { useState, useRef, useEffect } from 'react';
import { Message, User, Role, LinkPreviewData } from '../../types';
import { renderMarkdown } from '../../utils/markdown';
import { Smile, Reply, Edit2, Trash2, Pin, Check, X, Download, File, FileText, Film, Music, FileArchive, BarChart2, CheckCircle2, Circle } from 'lucide-react';
import { EmojiPicker } from './EmojiPicker';
import { AudioPlayer } from './AudioPlayer';
import { CodeBlock } from './CodeBlock';
import { LinkEmbedCard } from './LinkEmbedCard';
import { useSocket } from '../../context/SocketContext';
import { apiUrl } from '../../config/api';

interface MessageItemProps {
  message: Message;
  currentUser: User | null;
  roles?: Role[];
  userRoleIds?: string[];
  onReply: (message: Message) => void;
  onEdit: (messageId: string, content: string) => void;
  onDelete: (messageId: string) => void;
  onAddReaction: (messageId: string, emoji: string) => void;
  onOpenImage: (url: string) => void;
  onViewProfile?: (user: User) => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  currentUser,
  roles = [],
  userRoleIds = [],
  onReply,
  onEdit,
  onDelete,
  onAddReaction,
  onOpenImage,
  onViewProfile
}) => {
  const { socket } = useSocket();
  const [isHovered, setIsHovered] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [autoLinkPreview, setAutoLinkPreview] = useState<LinkPreviewData | null>(null);

  const emojiPickerRef = useRef<HTMLDivElement>(null);

  const isAuthor = currentUser?.id === message.authorId;
  const author = message.author;

  // Resolve user role color
  const userRoles = roles.filter(r => userRoleIds.includes(r.id)).sort((a, b) => (b.position || 0) - (a.position || 0));
  const highestRole = userRoles[0];
  const roleColor = highestRole?.color || undefined;

  // Auto-fetch link preview if URL detected and not already fetched
  useEffect(() => {
    if (message.linkPreviews && message.linkPreviews.length > 0) {
      setAutoLinkPreview(message.linkPreviews[0]);
      return;
    }

    if (!message.content || autoLinkPreview) return;

    const urlMatch = message.content.match(/(https?:\/\/[^\s]+)/);
    if (urlMatch && urlMatch[0]) {
      const url = urlMatch[0];
      const token = localStorage.getItem('aerocord_token');
      fetch(apiUrl(`/api/media/link-preview?url=${encodeURIComponent(url)}`), {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.preview && (data.preview.title || data.preview.youtubeId || data.preview.image)) {
            setAutoLinkPreview(data.preview);
          }
        })
        .catch(() => {});
    }
  }, [message.content, message.linkPreviews]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker]);

  const formatTimestamp = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      if (isToday) return `Hari ini ${timeStr}`;
      return `${date.toLocaleDateString()} ${timeStr}`;
    } catch {
      return '';
    }
  };

  const handleSaveEdit = () => {
    if (editContent.trim() && editContent !== message.content) {
      onEdit(message.id, editContent.trim());
    }
    setIsEditing(false);
  };

  const handleVotePoll = (optionId: string) => {
    if (!socket || !message.poll || message.poll.closed) return;
    socket.emit('vote_poll', { messageId: message.id, optionId });
  };

  // Helper to render content with code blocks separated
  const renderMessageContent = (raw: string) => {
    if (!raw) return null;

    // Check for ```lang\ncode\n```
    const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(raw)) !== null) {
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: raw.substring(lastIndex, match.index)
        });
      }
      parts.push({
        type: 'code',
        language: match[1] || 'text',
        code: match[2]
      });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < raw.length) {
      parts.push({
        type: 'text',
        content: raw.substring(lastIndex)
      });
    }

    if (parts.length === 0) {
      return <div>{renderMarkdown(raw)}</div>;
    }

    return (
      <div className="space-y-1">
        {parts.map((p, idx) => {
          if (p.type === 'code') {
            return <CodeBlock key={idx} code={p.code!} language={p.language} />;
          }
          return <div key={idx}>{renderMarkdown(p.content!)}</div>;
        })}
      </div>
    );
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`group relative flex px-4 py-1.5 hover:bg-[#2e3035]/60 transition-colors duration-100 ${
        isEditing ? 'bg-[#2e3035]/90' : ''
      }`}
    >
      {/* Reply Reference Preview if any */}
      {message.replyToMessage && (
        <div className="absolute -top-3.5 left-14 flex items-center space-x-1.5 text-xs text-[#949ba4] select-none">
          <div className="w-6 h-3 border-l-2 border-t-2 border-[#4e5058] rounded-tl-md -mr-1"></div>
          <span className="font-semibold text-gray-300">
            @{message.replyToMessage.author?.username || 'User'}
          </span>
          <span className="truncate max-w-xs text-gray-400">
            {message.replyToMessage.content || '[Attachment/Sticker]'}
          </span>
        </div>
      )}

      {/* Floating Action Toolbar on Hover */}
      {isHovered && !isEditing && (
        <div className="absolute -top-3.5 right-4 z-30 flex items-center bg-[#313338] border border-[#232428] rounded-md shadow-lg p-0.5 space-x-0.5 animate-in fade-in zoom-in-95 duration-100">
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            title="Add Reaction"
            className="p-1.5 hover:bg-[#35373c] text-gray-400 hover:text-[#f0b232] rounded transition-colors"
          >
            <Smile size={16} />
          </button>
          <button
            onClick={() => onReply(message)}
            title="Reply"
            className="p-1.5 hover:bg-[#35373c] text-gray-400 hover:text-gray-200 rounded transition-colors"
          >
            <Reply size={16} />
          </button>
          {isAuthor && (
            <button
              onClick={() => setIsEditing(true)}
              title="Edit Message"
              className="p-1.5 hover:bg-[#35373c] text-gray-400 hover:text-gray-200 rounded transition-colors"
            >
              <Edit2 size={16} />
            </button>
          )}
          {isAuthor && (
            <button
              onClick={() => onDelete(message.id)}
              title="Delete Message"
              className="p-1.5 hover:bg-rose-500/20 text-gray-400 hover:text-rose-400 rounded transition-colors"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      )}

      {/* Emoji Picker Popover */}
      {showEmojiPicker && (
        <div ref={emojiPickerRef} className="absolute right-4 top-6 z-50">
          <EmojiPicker
            onSelectEmoji={(emoji) => {
              onAddReaction(message.id, emoji);
              setShowEmojiPicker(false);
            }}
            onClose={() => setShowEmojiPicker(false)}
          />
        </div>
      )}

      {/* User Avatar */}
      <div className="mr-3.5 flex-shrink-0 mt-0.5">
        <img
          onClick={() => author && onViewProfile && onViewProfile(author)}
          src={
            author?.avatar ||
            `https://api.dicebear.com/7.x/bottts/svg?seed=${message.authorId}`
          }
          alt={author?.username || 'User'}
          className="w-9 h-9 rounded-xl object-cover hover:opacity-80 transition-all cursor-pointer shadow-md border border-white/5"
        />
      </div>

      {/* Message Body */}
      <div className="flex-1 min-w-0">
        {/* Header (Username, Role Badge, Timestamp) */}
        <div className="flex items-center space-x-2">
          <span
            onClick={() => author && onViewProfile && onViewProfile(author)}
            style={{ color: roleColor }}
            className="font-bold text-xs hover:underline cursor-pointer transition-colors"
          >
            {author?.username || 'User'}
          </span>

          {/* Role Badge if any */}
          {highestRole && (
            <span
              style={{
                backgroundColor: `${highestRole.color}20`,
                borderColor: `${highestRole.color}50`,
                color: highestRole.color
              }}
              className="px-1.5 py-0.2 rounded-md text-[9px] font-black border uppercase tracking-wider select-none"
            >
              {highestRole.name}
            </span>
          )}

          <span className="text-[10px] text-slate-500">
            {formatTimestamp(message.createdAt)}
          </span>
          {message.isEdited && (
            <span className="text-[9px] text-slate-600">(edited)</span>
          )}
        </div>

        {/* Content / Edit Mode */}
        {isEditing ? (
          <div className="mt-1 space-y-1.5">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSaveEdit();
                }
                if (e.key === 'Escape') setIsEditing(false);
              }}
              rows={2}
              className="w-full p-2 rounded-lg bg-[#383a40] text-gray-100 text-sm focus:outline-none focus:ring-1 focus:ring-[#5865f2] resize-none"
            />
            <div className="flex items-center space-x-2 text-xs">
              <span className="text-gray-400">escape to cancel • enter to save</span>
              <button
                onClick={handleSaveEdit}
                className="px-2.5 py-1 bg-[#5865f2] hover:bg-[#4752c4] text-white rounded font-medium flex items-center space-x-1"
              >
                <Check size={12} />
                <span>Save</span>
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="px-2.5 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded font-medium flex items-center space-x-1"
              >
                <X size={12} />
                <span>Cancel</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-[#dbdee1] leading-relaxed mt-0.5">
            {message.content && renderMessageContent(message.content)}
          </div>
        )}

        {/* Interactive Poll Rendering */}
        {message.poll && (
          <div className="mt-3 p-4 rounded-2xl bg-[#11131a] border border-white/10 max-w-md shadow-xl select-none">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <BarChart2 size={16} className="text-indigo-400" />
                <span className="font-bold text-xs text-white">Polling</span>
              </div>
              {message.poll.isMultiChoice && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 font-semibold border border-indigo-500/25">
                  Banyak Pilihan
                </span>
              )}
            </div>

            <h4 className="font-bold text-sm text-slate-100 mb-3 leading-snug">
              {message.poll.question}
            </h4>

            {/* Options List */}
            {(() => {
              const totalVotes = message.poll.options.reduce((sum, opt) => sum + (opt.votes?.length || 0), 0);

              return (
                <div className="space-y-2">
                  {message.poll.options.map((opt) => {
                    const voteCount = opt.votes?.length || 0;
                    const percent = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
                    const hasVoted = currentUser && opt.votes?.includes(currentUser.id);

                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleVotePoll(opt.id)}
                        className={`relative w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all overflow-hidden cursor-pointer group ${
                          hasVoted
                            ? 'border-indigo-500/50 bg-indigo-600/10'
                            : 'border-white/10 bg-[#0c0e14] hover:border-white/20'
                        }`}
                      >
                        {/* Progress Bar Fill */}
                        <div
                          style={{ width: `${percent}%` }}
                          className={`absolute inset-0 transition-all duration-300 pointer-events-none ${
                            hasVoted ? 'bg-indigo-600/20' : 'bg-white/5'
                          }`}
                        />

                        {/* Option Info */}
                        <div className="relative z-10 flex items-center space-x-2.5 min-w-0">
                          {hasVoted ? (
                            <CheckCircle2 size={16} className="text-indigo-400 flex-shrink-0" />
                          ) : (
                            <Circle size={16} className="text-slate-500 group-hover:text-slate-400 flex-shrink-0" />
                          )}
                          <span className={`text-xs font-semibold truncate ${hasVoted ? 'text-indigo-200' : 'text-slate-200'}`}>
                            {opt.text}
                          </span>
                        </div>

                        {/* Vote Percent & Count */}
                        <div className="relative z-10 text-[11px] font-mono font-bold text-slate-400 flex items-center space-x-1.5 ml-2 flex-shrink-0">
                          <span>{voteCount}</span>
                          <span className="text-slate-500">({percent}%)</span>
                        </div>
                      </button>
                    );
                  })}

                  <div className="text-[10px] text-slate-400 pt-1 flex items-center justify-between font-mono">
                    <span>Total {totalVotes} Suara</span>
                    {message.poll.expiresAt && (
                      <span>Berakhir {new Date(message.poll.expiresAt).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Link Embed Preview Card */}
        {autoLinkPreview && (
          <LinkEmbedCard preview={autoLinkPreview} />
        )}

        {/* Sticker Attachment */}
        {message.stickerUrl && (
          <div className="mt-2 inline-block">
            <img
              src={message.stickerUrl}
              alt="Sticker"
              className="w-36 h-36 object-contain rounded-xl hover:scale-105 transition-transform duration-200 cursor-pointer drop-shadow-md"
            />
          </div>
        )}

        {/* Attachments (Images, Voice Notes, Audio, Video, Files) */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2.5 space-y-2 max-w-lg">
            {message.attachments.map((att) => {
              const ext = att.filename?.split('.').pop()?.toLowerCase() || '';
              const isImage = att.contentType?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);
              const isVideo = att.contentType?.startsWith('video/') || ['mp4', 'webm', 'mov', 'mkv'].includes(ext);
              const isAudio = att.contentType?.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'webm'].includes(ext);

              const formatSize = (bytes?: number) => {
                if (!bytes) return '';
                if (bytes < 1024) return `${bytes} B`;
                if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
                return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
              };

              if (isImage) {
                return (
                  <div
                    key={att.id}
                    onClick={() => onOpenImage(att.url)}
                    className="relative group/img max-w-md max-h-80 overflow-hidden rounded-2xl border border-white/10 bg-[#0c0e14] cursor-pointer shadow-lg inline-block"
                  >
                    <img
                      src={att.url}
                      alt={att.filename}
                      className="max-h-72 w-auto object-cover rounded-2xl group-hover/img:scale-[1.01] transition-all"
                    />
                  </div>
                );
              }

              if (isAudio) {
                return (
                  <AudioPlayer key={att.id} src={att.url} filename={att.filename} />
                );
              }

              if (isVideo) {
                return (
                  <div key={att.id} className="rounded-2xl overflow-hidden border border-white/10 bg-[#0c0e14] shadow-lg max-w-md">
                    <video src={att.url} controls className="w-full max-h-72 object-contain" />
                    <div className="p-2.5 text-xs text-slate-300 flex items-center justify-between border-t border-white/5">
                      <span className="truncate font-semibold">{att.filename}</span>
                      <span className="text-[10px] text-slate-400 font-mono ml-2">{formatSize(att.size)}</span>
                    </div>
                  </div>
                );
              }

              // Document / Archive / Generic File Download Card
              return (
                <div
                  key={att.id}
                  className="flex items-center justify-between p-3.5 bg-[#0c0e14] border border-white/10 rounded-2xl max-w-md shadow-md hover:border-indigo-500/40 transition-colors group"
                >
                  <div className="flex items-center space-x-3 min-w-0 pr-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 flex-shrink-0">
                      {['zip', 'rar', '7z', 'tar', 'gz'].includes(ext) ? (
                        <FileArchive size={20} className="text-amber-400" />
                      ) : ['pdf', 'doc', 'docx', 'txt', 'md'].includes(ext) ? (
                        <FileText size={20} className="text-cyan-400" />
                      ) : (
                        <File size={20} className="text-indigo-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-200 truncate group-hover:text-indigo-300 transition-colors">
                        {att.filename}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {formatSize(att.size)} • {ext.toUpperCase() || 'FILE'}
                      </div>
                    </div>
                  </div>

                  <a
                    href={att.url}
                    download={att.filename}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-indigo-600 hover:text-white text-slate-300 transition-all flex items-center space-x-1.5 text-xs font-bold flex-shrink-0 cursor-pointer shadow"
                    title="Download File"
                  >
                    <Download size={14} />
                    <span className="hidden sm:inline">Unduh</span>
                  </a>
                </div>
              );
            })}
          </div>
        )}

        {/* Reactions Counter / Chips */}
        {message.reactions && message.reactions.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5 items-center">
            {message.reactions.map((r, i) => {
              const hasReacted = currentUser ? r.users.includes(currentUser.id) : false;
              return (
                <button
                  key={i}
                  onClick={() => onAddReaction(message.id, r.emoji)}
                  className={`flex items-center space-x-1.5 px-2 py-0.5 rounded-md text-xs font-semibold border transition-all ${
                    hasReacted
                      ? 'bg-[#5865f2]/20 border-[#5865f2] text-[#c9cdfb]'
                      : 'bg-[#2b2d31] border-[#3f4147] text-gray-300 hover:bg-[#35373c]'
                  }`}
                >
                  <span className="text-sm">{r.emoji}</span>
                  <span>{r.users.length}</span>
                </button>
              );
            })}
            {/* Quick Add reaction button */}
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-1 rounded-md bg-[#2b2d31] border border-[#3f4147] text-gray-400 hover:text-gray-200 hover:bg-[#35373c] text-xs transition-colors"
            >
              <Smile size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
