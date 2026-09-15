import React from 'react';
import { Music, X, Volume2, Sparkles } from 'lucide-react';
import { useVoice } from '../../context/VoiceContext';

interface SoundboardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SOUNDBOARD_ITEMS = [
  { id: 'tada', name: 'Tada', icon: '🎉', desc: 'Perayaan & Ceria' },
  { id: 'airhorn', name: 'Airhorn', icon: '🎺', desc: 'Hype Horn DJ' },
  { id: 'ding', name: 'Lonceng', icon: '🔔', desc: 'Chime Bersih' },
  { id: 'applause', name: 'Tepuk Tangan', icon: '👏', desc: 'Sorakan Tim' },
  { id: 'quack', name: 'Bebek', icon: '🦆', desc: 'Suara Lucu' },
  { id: 'victory', name: 'Menang', icon: '🏆', desc: 'Fanfare Kemenangan' },
  { id: 'boing', name: 'Boing', icon: '🌀', desc: 'Efek Pegas Kartun' },
  { id: 'sparkle', name: 'Magic', icon: '✨', desc: 'Kilau Magis' }
];

export const SoundboardModal: React.FC<SoundboardModalProps> = ({ isOpen, onClose }) => {
  const { playSoundboard } = useVoice();
  const [activeSoundId, setActiveSoundId] = React.useState<string | null>(null);

  if (!isOpen) return null;

  const handlePlaySound = (soundId: string, soundName: string) => {
    setActiveSoundId(soundId);
    playSoundboard(soundId, soundName);
    setTimeout(() => {
      setActiveSoundId(null);
    }, 600);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-sm bg-[#13161f] border border-white/10 rounded-3xl shadow-2xl p-5 animate-in zoom-in-95 duration-150 relative overflow-hidden"
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
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                  Live
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">Suara akan terdengar oleh semua anggota di voice chat</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Sound Items Grid */}
        <div className="grid grid-cols-2 gap-2.5 max-h-[60vh] overflow-y-auto pr-0.5 custom-scrollbar">
          {SOUNDBOARD_ITEMS.map((item) => {
            const isPlaying = activeSoundId === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handlePlaySound(item.id, item.name)}
                className={`p-3 rounded-2xl border transition-all cursor-pointer text-left flex flex-col justify-between relative overflow-hidden group active:scale-95 ${
                  isPlaying
                    ? 'bg-indigo-600 text-white border-indigo-400 shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-400/50 scale-[0.98]'
                    : 'bg-[#0c0e14] hover:bg-[#181b25] border-white/5 hover:border-indigo-500/40 text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="text-xl">{item.icon}</span>
                  <Volume2 size={13} className={`${isPlaying ? 'text-white animate-bounce' : 'text-slate-500 group-hover:text-indigo-400'}`} />
                </div>
                <div className="font-bold text-xs truncate">{item.name}</div>
                <div className={`text-[10px] truncate ${isPlaying ? 'text-indigo-100' : 'text-slate-400'}`}>
                  {item.desc}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer Hint */}
        <div className="mt-4 pt-3 border-t border-white/5 text-center text-[10px] text-slate-400">
          Klik tombol suara untuk memutar secara realtime ke seluruh anggota voice.
        </div>
      </div>
    </div>
  );
};
