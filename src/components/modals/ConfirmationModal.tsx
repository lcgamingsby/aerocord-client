import React from 'react';
import { X, AlertTriangle, Check, Trash2, ShieldAlert } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Konfirmasi',
  cancelText = 'Batal',
  variant = 'danger',
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: <Trash2 size={24} className="text-rose-400" />,
          iconBg: 'bg-rose-500/10 border-rose-500/30',
          confirmBtn: 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/25'
        };
      case 'warning':
        return {
          icon: <AlertTriangle size={24} className="text-amber-400" />,
          iconBg: 'bg-amber-500/10 border-amber-500/30',
          confirmBtn: 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/25'
        };
      case 'info':
      default:
        return {
          icon: <Check size={24} className="text-indigo-400" />,
          iconBg: 'bg-indigo-500/10 border-indigo-500/30',
          confirmBtn: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/25'
        };
    }
  };

  const currentVariant = getVariantStyles();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200 select-none">
      <div className="w-full max-w-sm bg-[#13161f] rounded-3xl shadow-2xl overflow-hidden border border-white/10 text-white animate-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${currentVariant.iconBg}`}>
              {currentVariant.icon}
            </div>
            <button
              onClick={onCancel}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
          <p className="text-xs text-slate-400 leading-relaxed">{message}</p>

          <div className="mt-6 flex items-center space-x-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2.5 bg-[#0c0e14] hover:bg-white/5 text-slate-300 hover:text-white text-xs font-bold rounded-xl border border-white/5 transition-colors cursor-pointer"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl shadow-lg transition-all cursor-pointer ${currentVariant.confirmBtn}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
