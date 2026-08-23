import React, { useState, useEffect } from 'react';
import { X, Edit3 } from 'lucide-react';

interface PromptDialogModalProps {
  isOpen: boolean;
  title: string;
  label: string;
  initialValue?: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: (val: string) => void;
  onCancel: () => void;
}

export const PromptDialogModal: React.FC<PromptDialogModalProps> = ({
  isOpen,
  title,
  label,
  initialValue = '',
  placeholder = '',
  confirmText = 'Simpan',
  cancelText = 'Batal',
  onConfirm,
  onCancel
}) => {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    const submittedVal = value.trim();
    setValue('');
    onConfirm(submittedVal);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200 select-none">
      <div className="w-full max-w-sm bg-[#13161f] rounded-3xl shadow-2xl overflow-hidden border border-white/10 text-white animate-in zoom-in-95 duration-200">
        <form onSubmit={handleSubmit} className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Edit3 size={20} />
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          <h3 className="text-base font-bold text-white mb-1">{title}</h3>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 mt-4">
            {label}
          </label>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            autoFocus
            required
            className="w-full px-3.5 py-2.5 bg-[#0c0e14] text-xs text-slate-100 rounded-xl border border-white/10 focus:border-indigo-500 focus:outline-none transition-colors"
          />

          <div className="mt-6 flex items-center space-x-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2.5 bg-[#0c0e14] hover:bg-white/5 text-slate-300 hover:text-white text-xs font-bold rounded-xl border border-white/5 transition-colors cursor-pointer"
            >
              {cancelText}
            </button>
            <button
              type="submit"
              disabled={!value.trim()}
              className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/25 transition-all cursor-pointer"
            >
              {confirmText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
