import React, { useState, useEffect } from 'react';
import { useVoice } from '../../context/VoiceContext';
import { useAuth } from '../../context/AuthContext';
import { Mic, MicOff, Headphones, MonitorUp, PhoneOff, Volume2, Maximize2, Minimize2, X } from 'lucide-react';

interface VoiceChannelRoomProps {
  channelName: string;
}

export const VoiceChannelRoom: React.FC<VoiceChannelRoomProps> = ({ channelName }) => {
  const { user } = useAuth();
  const {
    voiceParticipants,
    isMuted,
    isDeafened,
    isScreenSharing,
    screenStream,
    remoteStreams,
    toggleMute,
    toggleDeafen,
    toggleScreenShare,
    leaveVoiceChannel,
    userVolumes,
    setUserVolume
  } = useVoice();

  const [fullscreenShareId, setFullscreenShareId] = useState<string | null>(null);

  // Escape key exits fullscreen
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && fullscreenShareId) {
        setFullscreenShareId(null);
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [fullscreenShareId]);

  // Find any active video/screen share stream (local or remote)
  const activeShares: { userId: string; username: string; stream: MediaStream; isLocal: boolean }[] = [];

  if (isScreenSharing && screenStream) {
    activeShares.push({
      userId: user?.id || 'local',
      username: `${user?.username || 'You'} (Layar Anda)`,
      stream: screenStream,
      isLocal: true
    });
  }

  remoteStreams.forEach((stream, peerId) => {
    const hasVideo = stream.getVideoTracks().length > 0;
    if (hasVideo) {
      const peerUser = voiceParticipants.find(p => p.userId === peerId)?.user;
      activeShares.push({
        userId: peerId,
        username: `${peerUser?.username || 'Peer'} (Screen Share)`,
        stream,
        isLocal: false
      });
    }
  });

  // Fullscreen share overlay
  const fullscreenShare = fullscreenShareId ? activeShares.find(s => s.userId === fullscreenShareId) : null;

  if (fullscreenShare) {
    return (
      <div className="fixed inset-0 z-50 bg-black/95 flex flex-col animate-in fade-in duration-200">
        {/* Top Bar */}
        <div className="flex items-center justify-between px-6 py-3 bg-[#0c0e14]/90 border-b border-white/5 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <MonitorUp size={16} className="text-emerald-400" />
            <span className="text-xs font-bold text-white">{fullscreenShare.username}</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
              {voiceParticipants.length} Terhubung
            </span>
          </div>
          <button
            onClick={() => setFullscreenShareId(null)}
            title="Keluar Fullscreen (Esc)"
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <Minimize2 size={16} />
          </button>
        </div>

        {/* Fullscreen Video */}
        <div className="flex-1 flex items-center justify-center overflow-hidden p-4 min-h-0">
          <video
            ref={(videoEl) => {
              if (videoEl && videoEl.srcObject !== fullscreenShare.stream) {
                videoEl.srcObject = fullscreenShare.stream;
              }
            }}
            autoPlay
            playsInline
            muted={fullscreenShare.isLocal}
            className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl border border-white/5"
          />
        </div>

        {/* Bottom Control Bar */}
        <div className="flex items-center justify-center space-x-3 py-4 bg-[#0c0e14]/90 border-t border-white/5 flex-shrink-0">
          <button onClick={toggleMute} title={isMuted ? 'Nyalakan Mic' : 'Bisukan Mic'} className={`p-3 rounded-xl transition-all cursor-pointer ${isMuted ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' : 'bg-slate-800 hover:bg-slate-700 text-white'}`}>
            {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
          <button onClick={toggleDeafen} title={isDeafened ? 'Undeafen' : 'Deafen'} className={`p-3 rounded-xl transition-all cursor-pointer ${isDeafened ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' : 'bg-slate-800 hover:bg-slate-700 text-white'}`}>
            <Headphones size={18} />
          </button>
          <button onClick={toggleScreenShare} title={isScreenSharing ? 'Hentikan Share Screen' : 'Bagikan Layar'} className={`p-3 rounded-xl transition-all cursor-pointer ${isScreenSharing ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25' : 'bg-slate-800 hover:bg-slate-700 text-white'}`}>
            <MonitorUp size={18} />
          </button>
          <button onClick={leaveVoiceChannel} title="Keluar dari Voice Channel" className="p-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-lg shadow-rose-600/25 transition-transform hover:scale-105 cursor-pointer ml-2">
            <PhoneOff size={18} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#0d0f14] flex flex-col h-full overflow-hidden select-none p-6 relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400">
            <Volume2 size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center space-x-2">
              <span>{channelName}</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                {voiceParticipants.length} Terhubung
              </span>
            </h2>
            <p className="text-xs text-slate-400">WebRTC Encrypted Realtime Audio & Video Room</p>
          </div>
        </div>
      </div>

      {/* Screen Share Stage View (Local & Remote) */}
      {activeShares.length > 0 && (
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[45vh] overflow-y-auto">
          {activeShares.map(share => (
            <div
              key={share.userId}
              className="rounded-3xl overflow-hidden bg-black/90 border border-white/10 shadow-2xl relative aspect-video flex items-center justify-center group"
            >
              <video
                ref={(videoEl) => {
                  if (videoEl && videoEl.srcObject !== share.stream) {
                    videoEl.srcObject = share.stream;
                  }
                }}
                autoPlay
                playsInline
                muted={share.isLocal}
                className="w-full h-full object-contain"
              />
              <div className="absolute top-3 left-3 px-3 py-1.5 bg-black/75 backdrop-blur-md rounded-xl text-xs font-semibold text-white flex items-center space-x-2 border border-white/10">
                <MonitorUp size={14} className="text-emerald-400" />
                <span>{share.username}</span>
              </div>
              {/* Fullscreen button */}
              <button
                onClick={() => setFullscreenShareId(share.userId)}
                title="Tampilan Penuh (Fullscreen)"
                className="absolute top-3 right-3 p-2 bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-xl text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border border-white/10"
              >
                <Maximize2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Voice Participants Grid */}
      <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 auto-rows-max pb-24">
        {voiceParticipants.map((participant) => {
          const pUser = participant.user;
          const isMe = participant.userId === user?.id;
          const currentVol = userVolumes.get(participant.userId) ?? 100;

          return (
            <div
              key={participant.userId}
              className={`relative rounded-3xl p-5 bg-[#13161f] border transition-all duration-200 flex flex-col items-center justify-center text-center shadow-xl group ${
                participant.isSpeaking
                  ? 'border-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.25)] scale-[1.02]'
                  : 'border-white/5 hover:border-white/20'
              }`}
            >
              {/* Avatar with speaking ring */}
              <div className="relative mb-3">
                <img
                  src={pUser?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${participant.userId}`}
                  alt={pUser?.username || 'User'}
                  className={`w-20 h-20 rounded-2xl object-cover transition-all ${
                    participant.isSpeaking ? 'speaking-ring ring-4 ring-emerald-400' : ''
                  }`}
                />
                {/* Mute badge */}
                {(participant.isMuted || participant.isDeafened) && (
                  <div className="absolute -bottom-1 -right-1 p-1.5 rounded-xl bg-rose-500 text-white shadow-md">
                    <MicOff size={13} />
                  </div>
                )}
              </div>

              {/* Username */}
              <span className="font-bold text-xs text-white truncate max-w-[140px]">
                {pUser?.username || 'User'} {isMe && '(Anda)'}
              </span>
              <span className={`text-[10px] mt-0.5 ${participant.isSpeaking ? 'text-emerald-400 font-bold animate-pulse' : 'text-slate-400'}`}>
                {participant.isSpeaking ? 'Sedang Bicara...' : 'Mendengarkan'}
              </span>

              {/* User Volume Slider */}
              {!isMe && (
                <div className="mt-3 w-full px-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                    <span>Volume</span>
                    <span>{currentVol}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="200"
                    value={currentVol}
                    onChange={(e) => setUserVolume(participant.userId, parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Persistent Floating Bottom Voice Control Bar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#13161f]/95 backdrop-blur-xl px-6 py-3 rounded-2xl flex items-center space-x-3 shadow-2xl z-40 border border-white/10">
        <button
          onClick={toggleMute}
          title={isMuted ? 'Nyalakan Mic' : 'Bisukan Mic'}
          className={`p-3 rounded-xl transition-all cursor-pointer ${
            isMuted ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' : 'bg-slate-800 hover:bg-slate-700 text-white'
          }`}
        >
          {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
        </button>

        <button
          onClick={toggleDeafen}
          title={isDeafened ? 'Undeafen' : 'Deafen'}
          className={`p-3 rounded-xl transition-all cursor-pointer ${
            isDeafened ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' : 'bg-slate-800 hover:bg-slate-700 text-white'
          }`}
        >
          <Headphones size={18} />
        </button>

        <button
          onClick={toggleScreenShare}
          title={isScreenSharing ? 'Hentikan Share Screen' : 'Bagikan Layar (Share Screen)'}
          className={`p-3 rounded-xl transition-all cursor-pointer ${
            isScreenSharing ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25' : 'bg-slate-800 hover:bg-slate-700 text-white'
          }`}
        >
          <MonitorUp size={18} />
        </button>

        <button
          onClick={leaveVoiceChannel}
          title="Keluar dari Voice Channel"
          className="p-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-lg shadow-rose-600/25 transition-transform hover:scale-105 cursor-pointer ml-2"
        >
          <PhoneOff size={18} />
        </button>
      </div>
    </div>
  );
};


interface VoiceChannelRoomProps {
  channelName: string;
}
