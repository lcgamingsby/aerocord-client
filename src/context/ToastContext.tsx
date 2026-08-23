import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X, Sparkles } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  showToast: (title: string, message?: string, type?: ToastType, duration?: number) => void;
  showSuccess: (title: string, message?: string) => void;
  showError: (title: string, message?: string) => void;
  showInfo: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((title: string, message?: string, type: ToastType = 'info', duration: number = 3500) => {
    const id = `toast_${Date.now()}_${Math.random()}`;
    const newToast: ToastItem = { id, title, message, type, duration };

    setToasts(prev => [...prev.slice(-4), newToast]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const showSuccess = useCallback((title: string, message?: string) => {
    showToast(title, message, 'success', 3500);
  }, [showToast]);

  const showError = useCallback((title: string, message?: string) => {
    showToast(title, message, 'error', 4500);
  }, [showToast]);

  const showInfo = useCallback((title: string, message?: string) => {
    showToast(title, message, 'info', 3500);
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, showSuccess, showError, showInfo }}>
      {children}
      {/* Windowed Toast Notification Container */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col space-y-2.5 max-w-sm w-full pointer-events-none">
        {toasts.map(toast => {
          const typeConfig = {
            success: {
              icon: <CheckCircle2 size={18} className="text-emerald-400 flex-shrink-0" />,
              border: 'border-emerald-500/30',
              bg: 'bg-[#121820]/95',
              glow: 'shadow-emerald-500/10'
            },
            error: {
              icon: <AlertCircle size={18} className="text-rose-400 flex-shrink-0" />,
              border: 'border-rose-500/30',
              bg: 'bg-[#1c1318]/95',
              glow: 'shadow-rose-500/10'
            },
            info: {
              icon: <Info size={18} className="text-indigo-400 flex-shrink-0" />,
              border: 'border-indigo-500/30',
              bg: 'bg-[#131622]/95',
              glow: 'shadow-indigo-500/10'
            }
          }[toast.type];

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto p-4 rounded-2xl border ${typeConfig.border} ${typeConfig.bg} backdrop-blur-xl shadow-2xl ${typeConfig.glow} text-white flex items-start space-x-3 animate-in slide-in-from-bottom-5 fade-in duration-200 transition-all`}
            >
              <div className="mt-0.5">{typeConfig.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-xs text-slate-100">{toast.title}</div>
                {toast.message && (
                  <div className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{toast.message}</div>
                )}
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
