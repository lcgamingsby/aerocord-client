import React, { useState, useEffect, useRef } from 'react';
import { Music, X, Volume2, Plus, Trash2, Upload, AlertCircle, Sparkles, Check } from 'lucide-react';
import { useVoice } from '../../context/VoiceContext';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config/api';

export interface CustomSoundItem {
  id: string;
  name: string;
  emoji: string;
  audioUrl: string;
  sizeBytes: number;
  createdAt: string;
}

interface SoundboardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EMOJI_OPTIONS = ['🔊', '🎶', '💥', '🎺', '🤣', '🎮', '⚡', '🔔', '📣', '🦆', '🏆', '✨', '💣', '🚀', '🎯', '🐱'];
const MAX_SOUNDBOARDS = 5;
const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024; // 1MB

export const SoundboardModal: React.FC<SoundboardModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const { playSoundboard, currentVoiceChannel, activeCall } = useVoice();
  const storageKey = `aerocord_custom_soundboards_${user?.id || 'guest'}`;

  const [sounds, setSounds] = useState<CustomSoundItem[]>([]);
  const [activeSoundId, setActiveSoundId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form states for adding sound
  const [soundName, setSoundName] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('🔊');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioFileName, setAudioFileName] = useState('');
  const [audioFileSize, setAudioFileSize] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [formError, setFormError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load custom soundboards on mount/user change
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setSounds(JSON.parse(saved));
      } else {
        setSounds([]);
      }
    } catch {
      setSounds([]);
    }
  }, [storageKey, isOpen]);

  // Save to localStorage
  const saveSounds = (newSounds: CustomSoundItem[]) => {
    setSounds(newSounds);
    localStorage.setItem(storageKey, JSON.stringify(newSounds));
  };

  if (!isOpen) return null;

  const handlePlaySound = (item: CustomSoundItem) => {
    setActiveSoundId(item.id);

    // If connected to voice channel or call, broadcast via socket
    // (the server will broadcast to room and VoiceContext will play it once)
    if (currentVoiceChannel || activeCall) {
      playSoundboard(item.id, item.name, item.audioUrl);
    } else {
      // If not in a voice channel, play locally for preview
      try {
        const audio = new Audio(item.audioUrl);
        audio.volume = 0.85;
        audio.play().catch(err => console.warn('Audio play error:', err));
      } catch (err) {
        console.warn('Audio error:', err);
      }
    }

    setTimeout(() => {
      setActiveSoundId(null);
    }, 800);
  };

  const handleDeleteSound = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const filtered = sounds.filter(s => s.id !== id);
    saveSounds(filtered);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormError('');
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/i)) {
      setFormError('Hanya file audio (MP3, WAV, OGG, M4A) yang didukung.');
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFormError(`Ukuran file melebihi batas 1MB (${(file.size / (1024 * 1024)).toFixed(1)} MB).`);
      return;
    }

    setAudioFile(file);
    setAudioFileName(file.name);
    setAudioFileSize(file.size);
    if (!soundName) {
      const baseName = file.name.replace(/\.[^/.]+$/, '');
      setSoundName(baseName.slice(0, 20));
    }
  };

  const handleCreateSound = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (sounds.length >= MAX_SOUNDBOARDS) {
      setFormError(`Maksimal ${MAX_SOUNDBOARDS} soundboard per akun. Hapus soundboard lama terlebih dahulu.`);
      return;
    }

    if (!soundName.trim()) {
      setFormError('Nama soundboard wajib diisi.');
      return;
    }

    if (!audioFile) {
      setFormError('Pilih file audio terlebih dahulu.');
      return;
    }

    setIsUploading(true);

    try {
      // 1. Try uploading to server media storage
      let audioUrl = '';
      const formData = new FormData();
      formData.append('file', audioFile);

      try {
        const token = localStorage.getItem('aerocord_token');
        const res = await fetch(apiUrl('/api/media/upload'), {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          body: formData
        });
        if (res.ok) {
          const data = await res.json();
          audioUrl = data.url || data.fileUrl;
        }
      } catch {
        // ignore and fallback to data url
      }

      // 2. Fallback: Convert to Base64 Data URL if server upload not returned
      if (!audioUrl) {
        audioUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(audioFile);
        });
      }

      const newSound: CustomSoundItem = {
        id: `sound_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        name: soundName.trim(),
        emoji: selectedEmoji,
        audioUrl,
        sizeBytes: audioFileSize,
        createdAt: new Date().toISOString()
      };

      saveSounds([...sounds, newSound]);
      setShowAddForm(false);
      setSoundName('');
      setAudioFile(null);
      setAudioFileName('');
      setAudioFileSize(0);
      setSelectedEmoji('🔊');
    } catch (err: any) {
      setFormError(err.message || 'Gagal mengunggah file suara.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md bg-[#13161f] border border-white/10 rounded-3xl shadow-2xl p-5 animate-in zoom-in-95 duration-150 relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/5">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Music size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center space-x-1.5">
                <span>Soundboard Voice</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 font-bold border border-indigo-500/20">
                  {sounds.length}/{MAX_SOUNDBOARDS} Suara
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">Putar suara kustom Anda ke semua peserta voice channel</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Add Form Mode */}
        {showAddForm ? (
          <form onSubmit={handleCreateSound} className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">Unggah Soundboard Baru</span>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="text-[11px] text-slate-400 hover:text-white cursor-pointer"
              >
                Batal
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300 flex items-start space-x-2">
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5 text-rose-400" />
                <span>{formError}</span>
              </div>
            )}

            {/* Sound Name */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                Nama Suara <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={soundName}
                onChange={(e) => setSoundName(e.target.value)}
                placeholder="contoh: Bruh, Laugh, GG"
                maxLength={24}
                required
                className="w-full px-3 py-2 bg-[#0c0e14] text-xs text-slate-100 rounded-xl border border-white/10 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {/* Emoji Selector */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Ikon Emoji
              </label>
              <div className="flex flex-wrap gap-1.5 p-2 bg-[#0c0e14] rounded-xl border border-white/5">
                {EMOJI_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setSelectedEmoji(emoji)}
                    className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center transition-all cursor-pointer ${
                      selectedEmoji === emoji ? 'bg-indigo-600 scale-110 ring-2 ring-indigo-400' : 'hover:bg-white/5'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Audio File Upload (<= 1MB) */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                File Audio (Maks. 1MB) <span className="text-rose-400">*</span>
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.ogg,.m4a"
                onChange={handleFileChange}
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full p-4 rounded-2xl bg-[#0c0e14] hover:bg-white/[0.03] border-2 border-dashed border-white/15 hover:border-indigo-500/50 flex flex-col items-center justify-center text-center cursor-pointer transition-all"
              >
                <Upload size={20} className={audioFile ? 'text-emerald-400 mb-1' : 'text-slate-400 mb-1'} />
                <span className="text-xs font-bold text-slate-200 truncate max-w-full">
                  {audioFileName || 'Pilih atau Tarik File Audio'}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5">
                  {audioFileSize ? `${(audioFileSize / (1024 * 1024)).toFixed(2)} MB ✓` : 'Format MP3, WAV, OGG (Maks. 1MB)'}
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={isUploading || !soundName.trim() || !audioFile}
              className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 disabled:opacity-40 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/25 transition-all cursor-pointer flex items-center justify-center space-x-2"
            >
              {isUploading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Mengunggah...</span>
                </>
              ) : (
                <>
                  <Check size={14} />
                  <span>Simpan Soundboard</span>
                </>
              )}
            </button>
          </form>
        ) : (
          /* List Mode */
          <div className="space-y-3">
            {sounds.length < MAX_SOUNDBOARDS && (
              <button
                type="button"
                onClick={() => { setShowAddForm(true); setFormError(''); }}
                className="w-full py-2.5 px-3 bg-indigo-600/15 hover:bg-indigo-600/25 border border-indigo-500/30 text-indigo-300 hover:text-white rounded-2xl text-xs font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer"
              >
                <Plus size={15} />
                <span>Tambah Soundboard Sendiri ({sounds.length}/{MAX_SOUNDBOARDS})</span>
              </button>
            )}

            {sounds.length === 0 ? (
              <div className="py-8 px-4 text-center rounded-2xl bg-[#0c0e14] border border-white/5 space-y-2">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto">
                  <Music size={20} />
                </div>
                <div className="text-xs font-bold text-slate-200">Belum Ada Soundboard</div>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  Tambahkan file suara kustom Anda (maks. 1MB per file, hingga 5 suara per akun) untuk diputar di voice chat.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5 max-h-[50vh] overflow-y-auto pr-0.5 custom-scrollbar">
                {sounds.map((item) => {
                  const isPlaying = activeSoundId === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => handlePlaySound(item)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer text-left flex flex-col justify-between relative overflow-hidden group active:scale-95 ${
                        isPlaying
                          ? 'bg-indigo-600 text-white border-indigo-400 shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-400/50 scale-[0.98]'
                          : 'bg-[#0c0e14] hover:bg-[#181b25] border-white/5 hover:border-indigo-500/40 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="text-xl">{item.emoji}</span>
                        <div className="flex items-center space-x-1">
                          <Volume2 size={13} className={`${isPlaying ? 'text-white animate-bounce' : 'text-slate-500 group-hover:text-indigo-400'}`} />
                          <button
                            type="button"
                            onClick={(e) => handleDeleteSound(e, item.id)}
                            title="Hapus Soundboard"
                            className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                      <div className="font-bold text-xs truncate">{item.name}</div>
                      <div className={`text-[9px] truncate ${isPlaying ? 'text-indigo-100' : 'text-slate-400'}`}>
                        {item.sizeBytes ? `${(item.sizeBytes / (1024 * 1024)).toFixed(1)} MB` : 'Custom Audio'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Footer Hint */}
            <div className="pt-2 border-t border-white/5 text-center text-[10px] text-slate-400">
              Maksimal 5 soundboard per akun & maksimal 1MB per file.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
