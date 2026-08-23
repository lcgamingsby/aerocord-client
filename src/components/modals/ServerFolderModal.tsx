import React, { useState, useEffect } from 'react';
import { X, FolderPlus, Folder, Palette, Check } from 'lucide-react';
import { Server } from '../../types';

export interface ServerFolder {
  id: string;
  name: string;
  color: string;
  serverIds: string[];
  isExpanded?: boolean;
}

interface ServerFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (folder: { id?: string; name: string; color: string; serverIds: string[] }) => void;
  existingFolder?: ServerFolder | null;
  initialServerId?: string;
  allServers: Server[];
}

const PRESET_COLORS = [
  '#6366f1', // Indigo
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ef4444', // Rose
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#64748b'  // Slate
];

export const ServerFolderModal: React.FC<ServerFolderModalProps> = ({
  isOpen,
  onClose,
  onSave,
  existingFolder,
  initialServerId,
  allServers
}) => {
  const [folderName, setFolderName] = useState('');
  const [folderColor, setFolderColor] = useState(PRESET_COLORS[0]);
  const [selectedServerIds, setSelectedServerIds] = useState<string[]>([]);

  useEffect(() => {
    if (existingFolder) {
      setFolderName(existingFolder.name);
      setFolderColor(existingFolder.color || PRESET_COLORS[0]);
      setSelectedServerIds(existingFolder.serverIds || []);
    } else {
      setFolderName('');
      setFolderColor(PRESET_COLORS[0]);
      setSelectedServerIds(initialServerId ? [initialServerId] : []);
    }
  }, [existingFolder, initialServerId, isOpen]);

  if (!isOpen) return null;

  const toggleServer = (serverId: string) => {
    setSelectedServerIds(prev =>
      prev.includes(serverId) ? prev.filter(id => id !== serverId) : [...prev, serverId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim()) return;

    onSave({
      id: existingFolder?.id,
      name: folderName.trim(),
      color: folderColor,
      serverIds: selectedServerIds
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200 select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#13161f] rounded-3xl shadow-2xl overflow-hidden border border-white/10 text-white animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-lg"
              style={{ backgroundColor: folderColor }}
            >
              {existingFolder ? <Folder size={20} /> : <FolderPlus size={20} />}
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">
                {existingFolder ? 'Edit Grup / Folder Server' : 'Buat Grup / Folder Server Baru'}
              </h3>
              <p className="text-[11px] text-slate-400">Kelompokkan server-server Anda dalam satu folder</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Folder Name */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Nama Grup / Folder
            </label>
            <input
              type="text"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="misal: Komunitas Gaming, Dev Projects..."
              required
              autoFocus
              className="w-full px-3.5 py-2.5 bg-[#0c0e14] text-xs text-slate-100 rounded-xl border border-white/10 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* Folder Color Palette */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center space-x-1.5">
              <Palette size={13} />
              <span>Warna Label Folder</span>
            </label>
            <div className="flex items-center space-x-2.5 flex-wrap gap-y-2">
              {PRESET_COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setFolderColor(c)}
                  className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                    folderColor === c ? 'ring-2 ring-white scale-110' : 'hover:scale-105 opacity-80'
                  }`}
                  style={{ backgroundColor: c }}
                >
                  {folderColor === c && <Check size={14} className="text-white drop-shadow" />}
                </button>
              ))}
            </div>
          </div>

          {/* Select Servers to include */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Pilih Server yang Masuk ke Folder Ini ({selectedServerIds.length})
            </label>
            <div className="max-h-40 overflow-y-auto space-y-1.5 p-2 rounded-2xl bg-[#0c0e14] border border-white/5 no-scrollbar">
              {allServers.map((s) => {
                const isSelected = selectedServerIds.includes(s.id);
                return (
                  <div
                    key={s.id}
                    onClick={() => toggleServer(s.id)}
                    className={`p-2 rounded-xl flex items-center justify-between transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600/20 border border-indigo-500/40 text-white'
                        : 'bg-[#13161f] hover:bg-white/5 border border-white/5 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      {s.icon ? (
                        <img src={s.icon} alt={s.name} className="w-6 h-6 rounded-lg object-cover" />
                      ) : (
                        <div className="w-6 h-6 rounded-lg bg-indigo-950 flex items-center justify-center text-[10px] font-bold text-indigo-300">
                          {s.name[0]}
                        </div>
                      )}
                      <span className="text-xs font-semibold truncate">{s.name}</span>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                        isSelected
                          ? 'bg-indigo-600 border-indigo-500 text-white'
                          : 'border-white/20 bg-black/30'
                      }`}
                    >
                      {isSelected && <Check size={12} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-[#0c0e14] hover:bg-white/5 text-slate-300 hover:text-white text-xs font-bold rounded-xl border border-white/5 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={!folderName.trim()}
              className="flex-1 py-2.5 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 disabled:opacity-40 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/25 transition-all cursor-pointer font-bold"
            >
              {existingFolder ? 'Simpan Perubahan' : 'Buat Folder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
