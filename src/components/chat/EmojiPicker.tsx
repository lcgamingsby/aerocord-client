import React, { useState } from 'react';
import { Smile, Heart, Flame, ThumbsUp, Sparkles, Laugh, Zap, Coffee, Gamepad2, Cat } from 'lucide-react';

interface EmojiPickerProps {
  onSelectEmoji: (emoji: string) => void;
  onClose?: () => void;
}

const EMOJI_CATEGORIES = [
  {
    name: 'Popular',
    icon: Flame,
    emojis: ['👍', '❤️', '🔥', '🎉', '😂', '✨', '🚀', '💯', '👏', '😍', '👀', '🙌', '😎', '💀', '🥳']
  },
  {
    name: 'Smileys',
    icon: Smile,
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐', '😕', '😟', '🙁', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👻', '👽', '🤖']
  },
  {
    name: 'Reactions',
    icon: ThumbsUp,
    emojis: ['👍', '👎', '👊', '✊', '🤛', '🤜', '🤞', '✌️', '🤟', '🤘', '👌', '🤌', '🤏', '👈', '👉', '👆', '👇', '☝️', '✋', '🤚', '🖐️', '🖖', '👋', '🤙', '💪', '🦾', '🖕', '✍️', '🙏', '🤝']
  },
  {
    name: 'Gaming & Fun',
    icon: Gamepad2,
    emojis: ['🎮', '🕹️', '🎯', '🎲', '🎰', '🎳', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🎧', '🎤', '🎬', '🎨', '🎪', '🎫', '🎟️', '🎸', '🎹', '🎺', '🎻', '🥁']
  },
  {
    name: 'Animals & Food',
    icon: Cat,
    emojis: ['🐱', '🐶', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🦆', '🦅', '🦉', '🦇', '🐺', '🍕', '🍔', '🍟', '🌭', '🍿', '🧂', '🥓', '🍳', '🧇', '🥞', '🧈', '🍞', '🥐', '🥖', '🥨', '🧀', '🥗', '☕', '🍵', '🧃', '🥤', '🧋', '🍺', '🍻', '🍷', '🍸', '🍹', '🍾']
  }
];

export const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelectEmoji, onClose }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [search, setSearch] = useState('');

  const filteredEmojis = search.trim()
    ? EMOJI_CATEGORIES.flatMap(c => c.emojis).filter((_, idx, self) => self.indexOf(_) === idx)
    : EMOJI_CATEGORIES[activeTab].emojis;

  return (
    <div className="w-80 h-96 glass-modal rounded-xl flex flex-col overflow-hidden shadow-2xl border border-[#3f4147] text-white z-50 animate-in fade-in zoom-in-95 duration-150">
      {/* Search Bar */}
      <div className="p-3 border-b border-[#35373c] bg-[#232428]">
        <input
          type="text"
          placeholder="Search emojis..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-1.5 rounded-lg bg-[#1e1f22] text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#5865f2]"
        />
      </div>

      {/* Category Tabs */}
      {!search && (
        <div className="flex items-center justify-around px-2 py-1.5 bg-[#1e1f22] border-b border-[#35373c]">
          {EMOJI_CATEGORIES.map((cat, idx) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.name}
                onClick={() => setActiveTab(idx)}
                title={cat.name}
                className={`p-1.5 rounded-md transition-colors ${
                  activeTab === idx ? 'bg-[#35373c] text-[#5865f2]' : 'text-gray-400 hover:text-gray-200 hover:bg-[#2b2d31]'
                }`}
              >
                <Icon size={18} />
              </button>
            );
          })}
        </div>
      )}

      {/* Emoji Grid */}
      <div className="flex-1 p-3 overflow-y-auto grid grid-cols-6 gap-1.5 content-start">
        {filteredEmojis.map((emoji, index) => (
          <button
            key={index}
            onClick={() => {
              onSelectEmoji(emoji);
              if (onClose) onClose();
            }}
            className="w-10 h-10 flex items-center justify-center text-2xl rounded-lg hover:bg-[#35373c] hover:scale-125 transition-all duration-100 cursor-pointer"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};
