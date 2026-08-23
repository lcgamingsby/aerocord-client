import React, { useState, useEffect } from 'react';
import { StickerPack } from '../../types';
import { Sparkles, Layers, Image as ImageIcon } from 'lucide-react';
import { apiUrl } from '../../config/api';

interface StickerPickerProps {
  onSelectSticker: (stickerUrl: string) => void;
  onClose?: () => void;
}

export const StickerPicker: React.FC<StickerPickerProps> = ({ onSelectSticker, onClose }) => {
  const [packs, setPacks] = useState<StickerPack[]>([]);
  const [selectedPackId, setSelectedPackId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(apiUrl('/api/media/stickers'), {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('aerocord_token')}`
      }
    })
      .then(res => res.json())
      .then(data => {
        if (data.stickerPacks && data.stickerPacks.length > 0) {
          setPacks(data.stickerPacks);
          setSelectedPackId(data.stickerPacks[0].id);
        }
      })
      .catch(err => console.error('Failed to load stickers:', err))
      .finally(() => setLoading(false));
  }, []);

  const activePack = packs.find(p => p.id === selectedPackId) || packs[0];

  return (
    <div className="w-88 h-96 glass-modal rounded-xl flex flex-col overflow-hidden shadow-2xl border border-[#3f4147] text-white z-50 animate-in fade-in zoom-in-95 duration-150">
      {/* Header */}
      <div className="p-3 bg-[#232428] border-b border-[#35373c] flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Sparkles size={16} className="text-[#5865f2]" />
          <span className="font-semibold text-sm">Sticker Vault</span>
        </div>
        <span className="text-xs text-gray-400">Click sticker to send</span>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Pack Selector Sidebar */}
        <div className="w-20 bg-[#1e1f22] p-2 flex flex-col items-center space-y-2 border-r border-[#35373c] overflow-y-auto">
          {packs.map((pack) => {
            const firstSticker = pack.stickers[0]?.url;
            const isSelected = pack.id === selectedPackId;
            return (
              <button
                key={pack.id}
                onClick={() => setSelectedPackId(pack.id)}
                title={pack.name}
                className={`w-12 h-12 rounded-xl overflow-hidden border-2 transition-all p-1 ${
                  isSelected
                    ? 'border-[#5865f2] bg-[#35373c] scale-105 shadow-md'
                    : 'border-transparent hover:border-gray-500 hover:bg-[#2b2d31]'
                }`}
              >
                {firstSticker ? (
                  <img src={firstSticker} alt={pack.name} className="w-full h-full object-cover rounded-lg" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-700 rounded-lg">
                    <Layers size={18} />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Sticker Grid */}
        <div className="flex-1 p-3 overflow-y-auto bg-[#2b2d31]">
          {loading ? (
            <div className="flex items-center justify-center h-full text-sm text-gray-400">
              Loading stickers...
            </div>
          ) : activePack ? (
            <div>
              <div className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                {activePack.name}
              </div>
              <div className="text-[11px] text-gray-400 mb-3">{activePack.description}</div>
              <div className="grid grid-cols-3 gap-2.5">
                {activePack.stickers.map((stk) => (
                  <button
                    key={stk.id}
                    onClick={() => {
                      onSelectSticker(stk.url);
                      if (onClose) onClose();
                    }}
                    className="group relative aspect-square rounded-xl bg-[#1e1f22]/60 hover:bg-[#35373c] p-2 flex flex-col items-center justify-center transition-all duration-150 hover:scale-105 hover:shadow-lg border border-transparent hover:border-[#5865f2]/40 cursor-pointer"
                  >
                    <img
                      src={stk.url}
                      alt={stk.name}
                      className="w-full h-full object-contain rounded-lg group-hover:scale-110 transition-transform duration-200"
                    />
                    <span className="absolute bottom-1 bg-black/70 text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity truncate max-w-[90%]">
                      {stk.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-2">
              <ImageIcon size={32} />
              <span className="text-xs">No stickers available</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

