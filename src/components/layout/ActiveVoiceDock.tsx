import React from 'react';
import { useVoice } from '../../context/VoiceContext';
import { PhoneOff, MonitorUp, Radio } from 'lucide-react';

interface ActiveVoiceDockProps {
  channelName?: string;
}

export const ActiveVoiceDock: React.FC<ActiveVoiceDockProps> = ({ channelName }) => {
  const { currentVoiceChannel, leaveVoiceChannel, toggleScreenShare, isScreenSharing } = useVoice();

  if (!currentVoiceChannel) return null;

  return (
    <div className="px-3.5 py-2.5 bg-emerald-950/30 border-b border-emerald-500/20 flex items-center justify-between animate-in slide-in-from-bottom duration-200">
      <div className="flex items-center space-x-2.5 min-w-0">
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <div className="flex flex-col">
          <div className="flex items-center space-x-1 text-emerald-400 text-xs font-bold">
            <span>Voice Connected</span>
          </div>
          <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
            {channelName || 'Voice Room'} (WebRTC)
          </span>
        </div>
      </div>

      <div className="flex items-center space-x-1">
        <button
          onClick={toggleScreenShare}
          title={isScreenSharing ? 'Hentikan Share Screen' : 'Bagikan Layar'}
          className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
            isScreenSharing ? 'text-emerald-400 bg-emerald-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <MonitorUp size={16} />
        </button>
        <button
          onClick={leaveVoiceChannel}
          title="Putuskan Sambungan"
          className="p-1.5 rounded-xl hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
        >
          <PhoneOff size={16} />
        </button>
      </div>
    </div>
  );
};
