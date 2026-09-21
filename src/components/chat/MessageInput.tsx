import React, { useState, useRef, useEffect, useMemo } from 'react';
import { PlusCircle, Smile, Sparkles, X, Image as ImageIcon, Send, Loader2, File as FileIcon, FileText, Film, Music, FileArchive, Paperclip, ShieldAlert, Mic, MicOff, Square, BarChart2, AtSign, Users } from 'lucide-react';
import { Message, Poll, ServerMember, Role } from '../../types';
import { EmojiPicker } from './EmojiPicker';
import { StickerPicker } from './StickerPicker';
import { CreatePollModal } from '../modals/CreatePollModal';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config/api';

interface MessageInputProps {
  channelName: string;
  isDM?: boolean;
  members?: ServerMember[];
  roles?: Role[];
  replyingTo: Message | null;
  onCancelReply: () => void;
  onSendMessage: (content: string, attachments?: any[], stickerUrl?: string, replyToId?: string, poll?: Poll) => void;
  onTyping: () => void;
  onStopTyping: () => void;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  channelName,
  isDM,
  members,
  roles,
  replyingTo,
  onCancelReply,
  onSendMessage,
  onTyping,
  onStopTyping
}) => {
  const { user } = useAuth();
  const { showError, showInfo, showSuccess } = useToast();
  const [content, setContent] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showPollModal, setShowPollModal] = useState(false);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Mention Autocomplete States (Server Chat Only)
  const [showMentionPopup, setShowMentionPopup] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const [selectedMentionIdx, setSelectedMentionIdx] = useState(0);

  // Voice Note Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  const isGuestUser = user?.isGuest || user?.id.startsWith('guest_') || user?.email.endsWith('@guest.aerocord.app');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const stickerRef = useRef<HTMLDivElement>(null);
  const mentionPopupRef = useRef<HTMLDivElement>(null);

  // Filtered mentions for server chat
  const mentionList = useMemo(() => {
    if (isDM || !members || members.length === 0 || !showMentionPopup) return [];
    const items: Array<{
      type: 'special' | 'member';
      id: string;
      name: string;
      tag: string;
      description?: string;
      avatar?: string;
      color?: string;
      discriminator?: string;
    }> = [];

    // 1. Special mentions
    if ('everyone'.includes(mentionQuery)) {
      items.push({
        type: 'special',
        id: 'everyone',
        name: 'everyone',
        tag: '@everyone',
        description: 'Notifikasi semua anggota server'
      });
    }
    if ('here'.includes(mentionQuery)) {
      items.push({
        type: 'special',
        id: 'here',
        name: 'here',
        tag: '@here',
        description: 'Notifikasi anggota yang sedang online'
      });
    }

    // 2. Member mentions
    members.forEach(m => {
      if (!m.user) return;
      const u = m.user;
      const nick = m.nickname || u.username;
      if (
        u.username.toLowerCase().includes(mentionQuery) ||
        nick.toLowerCase().includes(mentionQuery)
      ) {
        const memberRole = roles?.find(r => m.roleIds.includes(r.id));
        items.push({
          type: 'member',
          id: u.id,
          name: nick,
          tag: `@${u.username}`,
          description: m.nickname ? `Username: ${u.username}` : undefined,
          avatar: u.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.id}`,
          color: memberRole?.color,
          discriminator: u.discriminator
        });
      }
    });

    return items.slice(0, 8);
  }, [isDM, members, roles, showMentionPopup, mentionQuery]);

  // Auto-focus input when clicking Reply on a message
  useEffect(() => {
    if (replyingTo && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [replyingTo]);

  // Voice Note Recorder Handlers
  const startVoiceRecording = async () => {
    if (isGuestUser) {
      showError('Batasan Akun Tamu', 'Akun tamu tidak dapat mengirim pesan suara.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.start(200);
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } catch (err: any) {
      showError('Gagal Akses Mikrofon', 'Pastikan izin mikrofon telah diberikan di browser Anda.');
    }
  };

  const cancelVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      mediaRecorderRef.current.stop();
    }
    clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setRecordingSeconds(0);
    audioChunksRef.current = [];
  };

  const finishVoiceRecording = async () => {
    if (!mediaRecorderRef.current || !isRecording) return;

    clearInterval(recordingTimerRef.current);
    setIsRecording(false);

    mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    mediaRecorderRef.current.stop();

    setIsUploading(true);

    setTimeout(async () => {
      try {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], `Voice_Note_${Date.now()}.webm`, { type: 'audio/webm' });

        const formData = new FormData();
        formData.append('file', audioFile);

        const token = localStorage.getItem('aerocord_token');
        const res = await fetch(apiUrl('/api/media/upload'), {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Gagal mengunggah pesan suara.');
        }

        const data = await res.json();
        if (data.attachment) {
          onSendMessage('', [data.attachment], undefined, replyingTo?.id);
          onCancelReply();
        }
      } catch (err: any) {
        showError('Gagal Mengirim Pesan Suara', err.message);
      } finally {
        setIsUploading(false);
        setRecordingSeconds(0);
        audioChunksRef.current = [];
      }
    }, 300);
  };

  const formatRecordTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Close popovers on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
      if (stickerRef.current && !stickerRef.current.contains(e.target as Node)) {
        setShowStickerPicker(false);
      }
      if (mentionPopupRef.current && !mentionPopupRef.current.contains(e.target as Node) && textareaRef.current !== e.target) {
        setShowMentionPopup(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSend = () => {
    if ((!content.trim() && attachments.length === 0) || isUploading) return;

    onSendMessage(content.trim(), attachments, undefined, replyingTo?.id);
    setContent('');
    setAttachments([]);
    setShowMentionPopup(false);
    onCancelReply();
    onStopTyping();
  };

  const insertMention = (mentionTag: string) => {
    const cursor = textareaRef.current?.selectionStart ?? content.length;
    const before = content.slice(0, mentionIndex);
    const after = content.slice(cursor);
    const replacement = `${mentionTag} `;
    const updated = before + replacement + after;
    setContent(updated);
    setShowMentionPopup(false);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newPos = before.length + replacement.length;
        textareaRef.current.setSelectionRange(newPos, newPos);
      }
    }, 10);
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    onTyping();

    if (!isDM && members && members.length > 0) {
      const cursor = e.target.selectionStart ?? newContent.length;
      const textBeforeCursor = newContent.slice(0, cursor);
      const atMatch = textBeforeCursor.match(/(?:^|\s)@([a-zA-Z0-9_-]*)$/);

      if (atMatch) {
        const query = atMatch[1].toLowerCase();
        const matchStart = atMatch.index! + (atMatch[0].startsWith(' ') ? 1 : 0);
        setMentionQuery(query);
        setMentionIndex(matchStart);
        setShowMentionPopup(true);
        setSelectedMentionIdx(0);
      } else {
        setShowMentionPopup(false);
      }
    } else {
      setShowMentionPopup(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentionPopup && mentionList.length > 0) {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMentionIdx(prev => (prev > 0 ? prev - 1 : mentionList.length - 1));
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMentionIdx(prev => (prev < mentionList.length - 1 ? prev + 1 : 0));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const selected = mentionList[selectedMentionIdx];
        if (selected) {
          insertMention(selected.tag);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowMentionPopup(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleUploadClick = () => {
    if (isGuestUser) {
      showError(
        'Batasan Akun Tamu',
        'Akun tamu tidak dapat mengirim lampiran file/gambar. Silakan tingkatkan akun Anda ke akun permanen di Pengaturan Profil.'
      );
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (isGuestUser) {
      showError('Batasan Akun Tamu', 'Akun tamu tidak diizinkan mengirim file atau lampiran.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const file = files[0];

    // Max 15MB limit check (15 * 1024 * 1024 bytes)
    const maxSizeBytes = 15 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      showError('Ukuran File Terlalu Besar', `Batas maksimum ukuran file adalah 15 MB. File Anda berukuran ${(file.size / (1024 * 1024)).toFixed(1)} MB.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setIsUploading(true);
    try {
      const res = await fetch(apiUrl('/api/media/upload'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('aerocord_token')}`
        },
        body: formData
      });
      const data = await res.json();
      const newAttachment = data.attachment || (data.url ? {
        id: `att_${Date.now()}`,
        url: data.url,
        filename: file.name,
        contentType: file.type,
        size: file.size
      } : null);

      if (res.ok && newAttachment) {
        setAttachments(prev => [...prev, newAttachment]);
      } else {
        showError('Upload Gagal', data.error || 'Gagal mengunggah file.');
      }
    } catch (err: any) {
      showError('Upload Gagal', err.message || 'Kesalahan koneksi saat upload.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const getFileIcon = (contentType: string = '', filename: string = '') => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (contentType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
      return <ImageIcon size={20} className="text-indigo-400" />;
    }
    if (contentType.startsWith('video/') || ['mp4', 'mkv', 'webm', 'mov'].includes(ext)) {
      return <Film size={20} className="text-rose-400" />;
    }
    if (contentType.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) {
      return <Music size={20} className="text-emerald-400" />;
    }
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
      return <FileArchive size={20} className="text-amber-400" />;
    }
    if (['pdf', 'doc', 'docx', 'txt', 'md'].includes(ext)) {
      return <FileText size={20} className="text-cyan-400" />;
    }
    return <FileIcon size={20} className="text-slate-400" />;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isImageFile = (att: any) => {
    const ext = att.filename?.split('.').pop()?.toLowerCase() || '';
    return att.contentType?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);
  };

  return (
    <div className="px-4 pb-5 pt-1 relative select-none">
      {/* Replying banner */}
      {replyingTo && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-[#181a20] rounded-t-2xl border-t border-l border-r border-white/10 text-xs text-slate-300">
          <div className="flex items-center space-x-1.5 truncate">
            <span className="text-slate-400">Membalas</span>
            <span className="font-semibold text-indigo-400">
              @{replyingTo.author?.username || 'User'}
            </span>
          </div>
          <button
            onClick={onCancelReply}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Attachment Previews */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2.5 p-3 bg-[#13161f] border-t border-l border-r border-white/10 rounded-t-2xl">
          {attachments.map((att, idx) => (
            <div key={idx} className="relative group rounded-2xl overflow-hidden border border-white/10 bg-[#0c0e14] p-2 flex items-center space-x-3 shadow-md max-w-xs">
              {isImageFile(att) ? (
                <img src={att.url} alt={att.filename} className="w-12 h-12 rounded-xl object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                  {getFileIcon(att.contentType, att.filename)}
                </div>
              )}
              <div className="min-w-0 flex-1 pr-4">
                <div className="text-xs font-bold text-slate-200 truncate">{att.filename}</div>
                <div className="text-[10px] text-slate-400">{formatFileSize(att.size)}</div>
              </div>
              <button
                onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                className="absolute top-1.5 right-1.5 p-1 bg-black/60 hover:bg-rose-600 rounded-full text-white transition-colors cursor-pointer"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main Input Box */}
      <div className={`relative flex items-center bg-[#13161f] border border-white/10 px-3.5 py-2.5 shadow-xl transition-all ${
        replyingTo || attachments.length > 0 ? 'rounded-b-2xl' : 'rounded-2xl'
      }`}>
        {isRecording ? (
          /* Live Voice Recording UI Bar */
          <div className="flex-1 flex items-center justify-between animate-in fade-in duration-150">
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 rounded-full bg-rose-500 animate-pulse shadow-md shadow-rose-500/50" />
              <div className="text-xs font-mono font-bold text-rose-400">
                {formatRecordTime(recordingSeconds)}
              </div>
              <span className="text-xs text-slate-300 font-medium hidden sm:inline">
                Merekam Pesan Suara...
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={cancelVoiceRecording}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 text-xs font-bold transition-all cursor-pointer flex items-center space-x-1"
                title="Batalkan Rekaman"
              >
                <X size={14} />
                <span>Batal</span>
              </button>

              <button
                type="button"
                onClick={finishVoiceRecording}
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 transition-all cursor-pointer flex items-center space-x-1.5"
                title="Kirim Pesan Suara"
              >
                <Send size={13} />
                <span>Kirim</span>
              </button>
            </div>
          </div>
        ) : (
          /* Standard Input Bar */
          <>
            {/* Upload Button */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={handleUploadClick}
              disabled={isUploading}
              title={isGuestUser ? 'Akun tamu tidak dapat mengirim lampiran (Tingkatkan akun)' : 'Kirim File / Gambar (Maks 15 MB)'}
              className={`p-1.5 rounded-xl transition-colors mr-1 cursor-pointer flex-shrink-0 ${
                isGuestUser
                  ? 'text-slate-500 hover:text-amber-400 hover:bg-amber-500/10'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {isUploading ? (
                <Loader2 size={19} className="animate-spin text-indigo-400" />
              ) : isGuestUser ? (
                <ShieldAlert size={19} className="text-amber-400" />
              ) : (
                <Paperclip size={19} />
              )}
            </button>

            {/* Create Poll Launcher Button */}
            <button
              type="button"
              onClick={() => setShowPollModal(true)}
              title="Buat Polling"
              className="p-1.5 rounded-xl text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors mr-2 cursor-pointer flex-shrink-0"
            >
              <BarChart2 size={19} />
            </button>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleContentChange}
              onKeyDown={handleKeyDown}
              placeholder={isDM ? `Message @${channelName}` : `Message #${channelName}`}
              rows={1}
              className="flex-1 bg-transparent text-gray-100 placeholder-gray-500 text-sm focus:outline-none resize-none max-h-32 min-h-[22px] py-0.5 leading-relaxed"
            />

            {/* Action Buttons (Sticker, Emoji, Voice Mic, Send) */}
            <div className="flex items-center space-x-1.5 ml-2">
              {/* Sticker Button */}
              <div ref={stickerRef} className="relative">
                <button
                  onClick={() => {
                    setShowStickerPicker(!showStickerPicker);
                    setShowEmojiPicker(false);
                  }}
                  title="Send a Sticker"
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    showStickerPicker ? 'text-[#5865f2] bg-[#313338]' : 'text-gray-400 hover:text-gray-200 hover:bg-[#313338]'
                  }`}
                >
                  <Sparkles size={19} />
                </button>
                {showStickerPicker && (
                  <div className="absolute right-0 bottom-12 z-50">
                    <StickerPicker
                      onSelectSticker={(url) => {
                        onSendMessage('', [], url, replyingTo?.id);
                        setShowStickerPicker(false);
                        onCancelReply();
                      }}
                      onClose={() => setShowStickerPicker(false)}
                    />
                  </div>
                )}
              </div>

              {/* Emoji Button */}
              <div ref={emojiRef} className="relative">
                <button
                  onClick={() => {
                    setShowEmojiPicker(!showEmojiPicker);
                    setShowStickerPicker(false);
                  }}
                  title="Add Emoji"
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    showEmojiPicker ? 'text-[#f0b232] bg-[#313338]' : 'text-gray-400 hover:text-[#f0b232] hover:bg-[#313338]'
                  }`}
                >
                  <Smile size={19} />
                </button>
                {showEmojiPicker && (
                  <div className="absolute right-0 bottom-12 z-50">
                    <EmojiPicker
                      onSelectEmoji={(emoji) => setContent(prev => prev + emoji)}
                      onClose={() => setShowEmojiPicker(false)}
                    />
                  </div>
                )}
              </div>

              {/* Voice Note Mic Button (when text is empty) */}
              {!content.trim() && attachments.length === 0 && (
                <button
                  type="button"
                  onClick={startVoiceRecording}
                  title="Rekam Pesan Suara"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                >
                  <Mic size={19} />
                </button>
              )}

              {/* Send Button */}
              {(content.trim() || attachments.length > 0) && (
                <button
                  onClick={handleSend}
                  title="Send message"
                  className="p-1.5 bg-[#5865f2] hover:bg-[#4752c4] text-white rounded-lg transition-all animate-in zoom-in-75 duration-150 cursor-pointer"
                >
                  <Send size={16} />
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Floating Mention Autocomplete Popup (Server Chat Only) */}
      {!isDM && showMentionPopup && mentionList.length > 0 && (
        <div
          ref={mentionPopupRef}
          className="absolute bottom-full mb-2 left-4 right-4 max-w-sm bg-[#13161f] border border-white/10 rounded-2xl shadow-2xl p-1.5 overflow-hidden z-40 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-150"
        >
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-white/5 flex items-center justify-between">
            <span className="flex items-center space-x-1.5">
              <AtSign size={12} className="text-indigo-400" />
              <span>Tag Anggota Server</span>
            </span>
            <span className="text-[9px] text-slate-500">↑↓ Navigasi • ↵ Pilih</span>
          </div>

          <div className="max-h-52 overflow-y-auto custom-scrollbar p-1 space-y-0.5">
            {mentionList.map((item, idx) => {
              const isSelected = idx === selectedMentionIdx;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => insertMention(item.tag)}
                  onMouseEnter={() => setSelectedMentionIdx(idx)}
                  className={`w-full px-2.5 py-2 rounded-xl flex items-center space-x-2.5 text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'hover:bg-white/[0.04] text-slate-200'
                  }`}
                >
                  {item.type === 'special' ? (
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-indigo-500/15 text-indigo-400'
                    }`}>
                      {item.id === 'everyone' ? <Users size={15} /> : <AtSign size={15} />}
                    </div>
                  ) : (
                    <img
                      src={item.avatar}
                      alt={item.name}
                      className="w-7 h-7 rounded-lg object-cover bg-slate-800"
                    />
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-1.5">
                      <span className="font-bold text-xs truncate" style={{ color: !isSelected && item.color ? item.color : undefined }}>
                        {item.tag}
                      </span>
                      {item.discriminator && (
                        <span className={`text-[10px] font-mono ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                          #{item.discriminator}
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <div className={`text-[10px] truncate ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>
                        {item.description}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Create Poll Modal */}
      <CreatePollModal
        isOpen={showPollModal}
        onClose={() => setShowPollModal(false)}
        onSubmitPoll={(poll) => {
          onSendMessage('', [], undefined, replyingTo?.id, poll);
          onCancelReply();
        }}
      />
    </div>
  );
};

