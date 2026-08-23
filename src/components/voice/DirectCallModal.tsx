import React, { useState, useEffect } from 'react';
import { useVoice } from '../../context/VoiceContext';
import { Phone, PhoneOff, Mic, MicOff, Headphones, MonitorUp, Maximize2, Minimize2 } from 'lucide-react';

export const DirectCallModal: React.FC = () => {
  const {
    incomingCall,
    activeCall,
    acceptCall,
    rejectCall,
    endCall,
    isMuted,
    isDeafened,
    isScreenSharing,
    screenStream,
    remoteStreams,
    toggleMute,
    toggleDeafen,
    toggleScreenShare
  } = useVoice();

  const [callDuration, setCallDuration] = useState<number>(0);
  const [isScreenShareExpanded, setIsScreenShareExpanded] = useState<boolean>(false);

  useEffect(() => {
    let timer: number | null = null;
    if (activeCall && activeCall.status === 'connected') {
      timer = window.setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
      setIsScreenShareExpanded(false);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [activeCall]);

  // Escape key to exit fullscreen screen share
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isScreenShareExpanded) {
        setIsScreenShareExpanded(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isScreenShareExpanded]);

  if (!incomingCall && !activeCall) return null;

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Detect remote screen share stream
  let remoteScreenStream: MediaStream | null = null;
  remoteStreams.forEach((stream) => {
    if (stream.getVideoTracks().length > 0) {
      remoteScreenStream = stream;
    }
  });

  // 1. Incoming Call Windowed Popup
  if (incomingCall) {
    const caller = incomingCall.caller;

    return (
      <div className="fixed top-6 right-6 z-50 bg-[#13161f]/95 backdrop-blur-xl p-5 rounded-3xl shadow-2xl border border-indigo-500/50 flex items-center space-x-4 animate-in slide-in-from-top-4 duration-300">
        <div className="relative">
          <img
            src={caller.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${caller.id}`}
            alt={caller.username}
            className="w-14 h-14 rounded-2xl object-cover call-ringing-pulse border-2 border-indigo-500 shadow-xl"
          />
        </div>
        <div>
          <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
            Panggilan {incomingCall.isVideo ? 'Video' : 'Suara'} Masuk
          </div>
          <div className="font-bold text-white text-sm">{caller.username}</div>
          <div className="text-xs text-slate-400 animate-pulse">Sedang memanggil...</div>
        </div>
        <div className="flex items-center space-x-2 ml-4">
          <button onClick={acceptCall} title="Terima Panggilan" className="p-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl transition-transform hover:scale-110 shadow-lg shadow-emerald-600/30 cursor-pointer animate-bounce">
            <Phone size={18} />
          </button>
          <button onClick={rejectCall} title="Tolak Panggilan" className="p-3 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl transition-transform hover:scale-110 shadow-lg shadow-rose-600/30 cursor-pointer">
            <PhoneOff size={18} />
          </button>
        </div>
      </div>
    );
  }

  // 2. Outgoing Call Ringing Window
  if (activeCall && activeCall.status === 'ringing') {
    const target = activeCall.targetUser;
    return (
      <div className="fixed top-6 right-6 z-50 bg-[#13161f]/95 backdrop-blur-xl p-5 rounded-3xl shadow-2xl border border-white/10 flex items-center space-x-4 animate-in slide-in-from-top-4 duration-300">
        <div className="relative">
          <img src={target.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${target.id}`} alt={target.username} className="w-14 h-14 rounded-2xl object-cover call-ringing-pulse border-2 border-slate-600" />
        </div>
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Memanggil {activeCall.isVideo ? 'Video' : 'Suara'}</div>
          <div className="font-bold text-white text-sm">{target.username}</div>
          <div className="text-xs text-slate-400 animate-pulse">Menghubungkan...</div>
        </div>
        <div className="flex items-center space-x-2 ml-4">
          <button onClick={endCall} title="Batalkan Panggilan" className="p-3 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl transition-transform hover:scale-110 shadow-lg shadow-rose-600/30 cursor-pointer">
            <PhoneOff size={18} />
          </button>
        </div>
      </div>
    );
  }

  // 3. Active Connected Call
  if (activeCall && activeCall.status === 'connected') {
    const target = activeCall.targetUser;
    const hasScreenShare = remoteScreenStream || (isScreenSharing && screenStream);

    // ─── Fullscreen Screen Share Overlay ───
    if (isScreenShareExpanded && hasScreenShare) {
      const displayStream = remoteScreenStream || screenStream;
      const shareLabel = remoteScreenStream ? `${target.username} membagikan layar` : 'Layar Anda (Screen Share)';

      return (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col animate-in fade-in duration-200">
          {/* Top Bar */}
          <div className="flex items-center justify-between px-6 py-3 bg-[#0c0e14]/90 border-b border-white/5 flex-shrink-0">
            <div className="flex items-center space-x-3">
              <MonitorUp size={16} className="text-emerald-400" />
              <span className="text-xs font-bold text-white">{shareLabel}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold">{formatTime(callDuration)}</span>
            </div>
            <button onClick={() => setIsScreenShareExpanded(false)} title="Keluar Fullscreen (Esc)" className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer">
              <Minimize2 size={16} />
            </button>
          </div>

          {/* Screen Share Video */}
          <div className="flex-1 flex items-center justify-center overflow-hidden p-4 min-h-0">
            <video
              ref={(el) => { if (el && displayStream && el.srcObject !== displayStream) el.srcObject = displayStream; }}
              autoPlay playsInline muted={!remoteScreenStream}
              className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl border border-white/5"
            />
          </div>

          {/* Bottom Control Bar */}
          <div className="flex items-center justify-center space-x-3 py-4 bg-[#0c0e14]/90 border-t border-white/5 flex-shrink-0">
            <div className="flex items-center space-x-2 mr-4">
              <img src={target.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${target.id}`} alt={target.username} className="w-8 h-8 rounded-xl object-cover border border-emerald-500/50" />
              <span className="text-xs font-bold text-white">{target.username}</span>
            </div>
            <button onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'} className={`p-3 rounded-xl transition-all cursor-pointer ${isMuted ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' : 'bg-slate-800 hover:bg-slate-700 text-white'}`}>
              {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            <button onClick={toggleDeafen} title={isDeafened ? 'Undeafen' : 'Deafen'} className={`p-3 rounded-xl transition-all cursor-pointer ${isDeafened ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' : 'bg-slate-800 hover:bg-slate-700 text-white'}`}>
              <Headphones size={18} />
            </button>
            <button onClick={toggleScreenShare} title={isScreenSharing ? 'Hentikan Share Screen' : 'Bagikan Layar'} className={`p-3 rounded-xl transition-all cursor-pointer ${isScreenSharing ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25' : 'bg-slate-800 hover:bg-slate-700 text-white'}`}>
              <MonitorUp size={18} />
            </button>
            <button onClick={endCall} title="Akhiri Panggilan" className="p-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-lg shadow-rose-600/25 transition-transform hover:scale-105 cursor-pointer ml-2">
              <PhoneOff size={18} />
            </button>
          </div>
        </div>
      );
    }

    // ─── Compact Floating Call Dock ───
    return (
      <div className="fixed top-6 right-6 z-50 bg-[#13161f]/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-emerald-500/40 animate-in slide-in-from-top-4 duration-300 overflow-hidden" style={{ maxWidth: '380px' }}>
        {/* Screen share thumbnail preview */}
        {hasScreenShare && (
          <div className="relative cursor-pointer group" onClick={() => setIsScreenShareExpanded(true)} title="Klik untuk memperbesar screen share">
            <video
              ref={(el) => {
                const stream = remoteScreenStream || screenStream;
                if (el && stream && el.srcObject !== stream) el.srcObject = stream;
              }}
              autoPlay playsInline muted
              className="w-full h-[140px] object-cover"
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <div className="flex items-center space-x-2 text-white text-xs font-bold">
                <Maximize2 size={16} />
                <span>Klik untuk Fullscreen</span>
              </div>
            </div>
            <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/70 backdrop-blur-sm rounded-lg text-[10px] font-semibold text-white flex items-center space-x-1.5 border border-white/10">
              <MonitorUp size={11} className="text-emerald-400" />
              <span>{remoteScreenStream ? target.username : 'Anda'}</span>
            </div>
          </div>
        )}

        {/* Call info & controls */}
        <div className="p-4 flex items-center space-x-4">
          <div className="relative flex-shrink-0">
            <img src={target.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${target.id}`} alt={target.username} className="w-12 h-12 rounded-2xl object-cover border-2 border-emerald-500" />
            <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#13161f]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-white text-xs">{target.username}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-mono font-bold">{formatTime(callDuration)}</span>
            </div>
            <div className="text-[10px] text-emerald-400 font-medium">Panggilan Langsung Terhubung</div>
          </div>
          <div className="flex items-center space-x-1.5 ml-auto flex-shrink-0">
            <button onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'} className={`p-2 rounded-xl transition-colors cursor-pointer ${isMuted ? 'bg-rose-500/20 text-rose-400' : 'bg-white/5 hover:bg-white/10 text-white'}`}>
              {isMuted ? <MicOff size={15} /> : <Mic size={15} />}
            </button>
            <button onClick={toggleScreenShare} title="Share Screen" className={`p-2 rounded-xl transition-colors cursor-pointer ${isScreenSharing ? 'bg-emerald-600 text-white' : 'bg-white/5 hover:bg-white/10 text-white'}`}>
              <MonitorUp size={15} />
            </button>
            <button onClick={endCall} title="Akhiri Panggilan" className="p-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl transition-colors shadow-lg cursor-pointer">
              <PhoneOff size={15} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

