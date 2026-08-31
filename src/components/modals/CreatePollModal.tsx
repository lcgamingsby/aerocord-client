import React, { useState } from 'react';
import { BarChart2, Plus, Trash2, X, Clock, CheckSquare } from 'lucide-react';
import { Poll } from '../../types';

const generateId = (prefix = 'id') => `${prefix}_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;

interface CreatePollModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitPoll: (poll: Poll) => void;
}

export const CreatePollModal: React.FC<CreatePollModalProps> = ({ isOpen, onClose, onSubmitPoll }) => {
  const [question, setQuestion] = useState<string>('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [isMultiChoice, setIsMultiChoice] = useState<boolean>(false);
  const [durationHours, setDurationHours] = useState<number>(24);

  if (!isOpen) return null;

  const handleAddOption = () => {
    if (options.length < 8) {
      setOptions([...options, '']);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleOptionChange = (index: number, val: string) => {
    const updated = [...options];
    updated[index] = val;
    setOptions(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    const validOptions = options
      .map(o => o.trim())
      .filter(Boolean);

    if (validOptions.length < 2) return;

    const poll: Poll = {
      id: generateId('poll'),
      question: question.trim(),
      options: validOptions.map(optText => ({
        id: generateId('opt'),
        text: optText,
        votes: []
      })),
      isMultiChoice,
      expiresAt: durationHours > 0 ? new Date(Date.now() + durationHours * 3600 * 1000).toISOString() : undefined,
      closed: false
    };

    onSubmitPoll(poll);
    onClose();
    setQuestion('');
    setOptions(['', '']);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-md bg-[#13161f] rounded-3xl border border-white/10 shadow-2xl overflow-hidden text-slate-100 animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
              <BarChart2 size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Buat Polling</h3>
              <p className="text-[11px] text-slate-400">Ajukan pertanyaan dan dapatkan suara langsung</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Question */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Pertanyaan Polling *
            </label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Contoh: Kapan kita jadwalkan mabar weekend ini?"
              required
              maxLength={150}
              className="w-full px-4 py-2.5 bg-[#0c0e14] text-xs text-white rounded-xl border border-white/10 focus:border-indigo-500 focus:outline-none transition-colors"
            />
          </div>

          {/* Options */}
          <div className="space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Pilihan Jawaban (Min 2, Maks 8) *
            </label>

            {options.map((opt, idx) => (
              <div key={idx} className="flex items-center space-x-2">
                <span className="text-xs font-mono font-bold text-slate-500 w-4 text-center">
                  {idx + 1}
                </span>
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => handleOptionChange(idx, e.target.value)}
                  placeholder={`Pilihan ${idx + 1}`}
                  required={idx < 2}
                  maxLength={60}
                  className="flex-1 px-3.5 py-2 bg-[#0c0e14] text-xs text-white rounded-xl border border-white/10 focus:border-indigo-500 focus:outline-none transition-colors"
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(idx)}
                    className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}

            {options.length < 8 && (
              <button
                type="button"
                onClick={handleAddOption}
                className="mt-1 w-full py-2 rounded-xl border border-dashed border-white/15 hover:border-indigo-500/50 hover:bg-indigo-500/5 text-indigo-400 text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
              >
                <Plus size={14} />
                <span>Tambah Pilihan</span>
              </button>
            )}
          </div>

          {/* Settings: Multi-Choice & Duration */}
          <div className="pt-2 border-t border-white/5 space-y-3">
            {/* Multi-choice toggle */}
            <label className="flex items-center justify-between p-3 rounded-2xl bg-[#0c0e14] border border-white/5 cursor-pointer hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center space-x-2.5">
                <CheckSquare size={16} className="text-indigo-400" />
                <div>
                  <div className="text-xs font-bold text-white">Izinkan Banyak Pilihan</div>
                  <div className="text-[10px] text-slate-400">Pengguna bisa memilih lebih dari satu opsi</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={isMultiChoice}
                onChange={(e) => setIsMultiChoice(e.target.checked)}
                className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
              />
            </label>

            {/* Duration Selector */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-[#0c0e14] border border-white/5">
              <div className="flex items-center space-x-2.5">
                <Clock size={16} className="text-indigo-400" />
                <div className="text-xs font-bold text-white">Durasi Polling</div>
              </div>

              <select
                value={durationHours}
                onChange={(e) => setDurationHours(Number(e.target.value))}
                className="bg-[#181b24] text-xs text-slate-200 border border-white/10 rounded-xl px-2.5 py-1.5 focus:outline-none cursor-pointer"
              >
                <option value={1}>1 Jam</option>
                <option value={6}>6 Jam</option>
                <option value={24}>24 Jam (1 Hari)</option>
                <option value={72}>3 Hari</option>
                <option value={168}>1 Minggu</option>
                <option value={0}>Tanpa Batas Waktu</option>
              </select>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center space-x-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-bold text-xs transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={!question.trim() || options.filter(o => o.trim()).length < 2}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 disabled:opacity-40 text-white font-bold text-xs shadow-lg shadow-indigo-600/25 transition-all cursor-pointer"
            >
              Buat Polling
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
