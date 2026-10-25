import React, { useState } from 'react';
import { X, ExternalLink, ShieldAlert, AlertTriangle } from 'lucide-react';

interface ExternalLinkModalProps {
  isOpen: boolean;
  url: string;
  onClose: () => void;
}

export const ExternalLinkModal: React.FC<ExternalLinkModalProps> = ({
  isOpen,
  url,
  onClose
}) => {
  const [trustDomain, setTrustDomain] = useState(false);

  if (!isOpen || !url) return null;

  let domain = '';
  try {
    const parsed = new URL(url);
    domain = parsed.hostname;
  } catch {
    domain = url;
  }

  const handleProceed = () => {
    if (trustDomain && domain) {
      try {
        const stored = localStorage.getItem('trusted_external_domains');
        const list: string[] = stored ? JSON.parse(stored) : [];
        if (!list.includes(domain)) {
          list.push(domain);
          localStorage.setItem('trusted_external_domains', JSON.stringify(list));
        }
      } catch (err) {
        console.error('Failed to save trusted domain:', err);
      }
    }
    window.open(url, '_blank', 'noopener,noreferrer');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200 select-none">
      <div className="w-full max-w-md bg-[#13161f] rounded-3xl shadow-2xl overflow-hidden border border-white/10 text-white animate-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center border bg-amber-500/10 border-amber-500/30 text-amber-400">
              <ShieldAlert size={26} />
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          <h3 className="text-lg font-bold text-white mb-1.5 flex items-center space-x-2">
            <span>Peringatan Tautan Eksternal</span>
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed mb-4">
            Anda akan diarahkan ke luar dari platform AeroCord. Harap selalu berhati-hati terhadap percobaan phishing atau pencurian data.
          </p>

          <div className="p-3.5 rounded-2xl bg-[#0c0e14] border border-white/5 space-y-1.5 mb-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Domain Tujuan</div>
            <div className="text-sm font-semibold text-amber-300 break-all flex items-center space-x-1.5">
              <span>{domain}</span>
            </div>
            <div className="text-[11px] text-slate-400 break-all line-clamp-2 select-all font-mono">
              {url}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] leading-relaxed flex items-start space-x-2 mb-4">
            <AlertTriangle size={15} className="text-rose-400 mt-0.5 flex-shrink-0" />
            <span>Jangan pernah memasukkan kata sandi, kode 2FA/OTP, atau informasi rahasia akun AeroCord Anda pada situs tersebut!</span>
          </div>

          <label className="flex items-center space-x-2 text-xs text-slate-400 hover:text-slate-300 cursor-pointer mb-6 select-none">
            <input
              type="checkbox"
              checked={trustDomain}
              onChange={(e) => setTrustDomain(e.target.checked)}
              className="rounded bg-[#1a1d26] border-white/20 text-indigo-500 focus:ring-0 cursor-pointer"
            />
            <span>Percayai domain <strong className="text-slate-200">{domain}</strong> dan jangan peringatkan lagi</span>
          </label>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-300 bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleProceed}
              className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 shadow-lg shadow-amber-600/25 transition-all cursor-pointer flex items-center justify-center space-x-1.5"
            >
              <span>Buka Tautan</span>
              <ExternalLink size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
