import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import { VoiceParticipant, ActiveCallSession, User } from '../types';
import { soundEffects } from '../utils/soundEffects';

interface VoiceContextType {
  currentVoiceChannel: string | null;
  voiceParticipants: VoiceParticipant[];
  isMuted: boolean;
  isDeafened: boolean;
  isScreenSharing: boolean;
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  userVolumes: Map<string, number>; // 0 to 200
  joinVoiceChannel: (channelId: string) => Promise<void>;
  leaveVoiceChannel: () => void;
  toggleMute: () => void;
  toggleDeafen: () => void;
  toggleScreenShare: () => Promise<void>;
  setUserVolume: (userId: string, volume: number) => void;
  activeCall: ActiveCallSession | null;
  incomingCall: { caller: User; conversationId: string; isVideo: boolean } | null;
  startDirectCall: (targetUser: User, conversationId: string, isVideo?: boolean) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
}

const VoiceContext = createContext<VoiceContextType | undefined>(undefined);

// Free public Google STUN servers for reliable WebRTC NAT traversal
const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

export const VoiceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { socket } = useSocket();

  const [currentVoiceChannel, setCurrentVoiceChannel] = useState<string | null>(null);
  const [voiceParticipants, setVoiceParticipants] = useState<VoiceParticipant[]>([]);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isDeafened, setIsDeafened] = useState<boolean>(false);
  const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [userVolumes, setUserVolumes] = useState<Map<string, number>>(new Map());

  // Direct Call state
  const [activeCall, setActiveCall] = useState<ActiveCallSession | null>(null);
  const [incomingCall, setIncomingCall] = useState<{ caller: User; conversationId: string; isVideo: boolean } | null>(null);

  // Sync references to prevent stale closures in async WebRTC and socket handlers
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const activeCallRef = useRef<ActiveCallSession | null>(null);
  const currentVoiceChannelRef = useRef<string | null>(null);
  const isDeafenedRef = useRef<boolean>(false);
  const isMutedRef = useRef<boolean>(false);
  const userVolumesRef = useRef<Map<string, number>>(new Map());

  // WebRTC Peer Connections: peerUserId -> RTCPeerConnection
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  // HTMLAudioElements for playing remote audio: peerUserId -> HTMLAudioElement
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const speakingIntervalRef = useRef<number | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  useEffect(() => {
    currentVoiceChannelRef.current = currentVoiceChannel;
  }, [currentVoiceChannel]);

  useEffect(() => {
    isDeafenedRef.current = isDeafened;
    // Update all audio elements volume immediately
    audioElementsRef.current.forEach((audioEl, peerId) => {
      const vol = isDeafened ? 0 : ((userVolumesRef.current.get(peerId) ?? 100) / 100);
      audioEl.volume = Math.max(0, Math.min(1, vol));
    });
  }, [isDeafened]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    userVolumesRef.current = userVolumes;
    // Update audio element volume for each peer
    audioElementsRef.current.forEach((audioEl, peerId) => {
      const vol = isDeafenedRef.current ? 0 : ((userVolumes.get(peerId) ?? 100) / 100);
      audioEl.volume = Math.max(0, Math.min(1, vol));
    });
  }, [userVolumes]);

  // Clean disconnect on tab refresh / page close
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (socket) {
        if (activeCallRef.current) {
          socket.emit('call_end', {
            targetUserId: activeCallRef.current.targetUser.id,
            conversationId: activeCallRef.current.conversationId
          });
        }
        if (currentVoiceChannelRef.current) {
          socket.emit('voice_leave_channel', {
            channelId: currentVoiceChannelRef.current
          });
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
    };
  }, [socket]);

  // Initialize Microphone & Web Audio Analyser for Speaking Detection
  const initLocalAudio = async (): Promise<MediaStream | null> => {
    if (localStreamRef.current && localStreamRef.current.active) {
      return localStreamRef.current;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });

      localStreamRef.current = stream;
      setLocalStream(stream);

      // Setup Web Audio Volume Visualizer / Speaking Detector
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!audioContextRef.current) {
          const ctx = new AudioContextClass();
          audioContextRef.current = ctx;

          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);
          analyserRef.current = analyser;

          const bufferLength = analyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);

          let wasSpeaking = false;

          if (speakingIntervalRef.current) clearInterval(speakingIntervalRef.current);

          speakingIntervalRef.current = window.setInterval(() => {
            if (!analyserRef.current || isMutedRef.current) {
              if (wasSpeaking && socket && currentVoiceChannelRef.current) {
                wasSpeaking = false;
                socket.emit('voice_speaking', { channelId: currentVoiceChannelRef.current, isSpeaking: false });
              }
              return;
            }

            analyserRef.current.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
              sum += dataArray[i];
            }
            const average = sum / bufferLength;
            const isSpeakingNow = average > 12; // Threshold for speaking

            if (isSpeakingNow !== wasSpeaking) {
              wasSpeaking = isSpeakingNow;
              if (socket && currentVoiceChannelRef.current) {
                socket.emit('voice_speaking', { channelId: currentVoiceChannelRef.current, isSpeaking: isSpeakingNow });
              }
            }
          }, 150);
        }
      } catch (e) {
        console.warn('AudioContext speaking detector notice:', e);
      }

      return stream;
    } catch (err) {
      console.warn('Microphone permission denied or unavailable:', err);
      return null;
    }
  };

  // Helper to play incoming audio track from WebRTC
  const playRemoteAudio = (targetUserId: string, stream: MediaStream) => {
    let audioEl = audioElementsRef.current.get(targetUserId);
    if (!audioEl) {
      audioEl = new Audio();
      audioEl.autoplay = true;
      audioElementsRef.current.set(targetUserId, audioEl);
    }

    if (audioEl.srcObject !== stream) {
      audioEl.srcObject = stream;
    }

    const vol = isDeafenedRef.current ? 0 : ((userVolumesRef.current.get(targetUserId) ?? 100) / 100);
    audioEl.volume = Math.max(0, Math.min(1, vol));

    audioEl.play().catch(e => {
      console.warn('Remote audio playback auto-play notice (user interaction required):', e);
    });
  };

  const createPeerConnection = (targetUserId: string, channelId: string): RTCPeerConnection => {
    if (peerConnections.current.has(targetUserId)) {
      peerConnections.current.get(targetUserId)!.close();
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Add microphone tracks if available
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // Add screen share tracks (video and audio) if active
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, screenStreamRef.current!);
      });
    }

    // Handle remote track received
    pc.ontrack = (event) => {
      const stream = event.streams[0] || new MediaStream([event.track]);
      
      setRemoteStreams(prev => {
        const next = new Map(prev);
        next.set(targetUserId, stream);
        return next;
      });

      // Play audio automatically
      if (event.track.kind === 'audio' || stream.getAudioTracks().length > 0) {
        playRemoteAudio(targetUserId, stream);
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('voice_signal', {
          targetUserId,
          signal: { type: 'candidate', candidate: event.candidate },
          channelId
        });
      }
    };

    peerConnections.current.set(targetUserId, pc);
    return pc;
  };

  const joinVoiceChannel = async (channelId: string) => {
    if (!socket || !user) return;

    if (currentVoiceChannel === channelId) return; // already in this channel

    // If in another channel, leave it first
    if (currentVoiceChannel) {
      leaveVoiceChannel();
    }

    await initLocalAudio();
    setCurrentVoiceChannel(channelId);
    currentVoiceChannelRef.current = channelId;
    soundEffects.playJoinVoiceSound();

    socket.emit('voice_join_channel', {
      channelId,
      isMuted: isMutedRef.current,
      isDeafened: isDeafenedRef.current
    });
  };

  const leaveVoiceChannel = useCallback(() => {
    if (!socket) return;

    const chId = currentVoiceChannelRef.current;
    if (chId) {
      soundEffects.playLeaveVoiceSound();
      socket.emit('voice_leave_channel', { channelId: chId });
    }

    // Clean up local mic stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }

    // Clean up screen share
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
      setScreenStream(null);
      setIsScreenSharing(false);
    }

    if (speakingIntervalRef.current) {
      clearInterval(speakingIntervalRef.current);
      speakingIntervalRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    // Stop and clear all audio playback elements
    audioElementsRef.current.forEach(audioEl => {
      audioEl.pause();
      audioEl.srcObject = null;
    });
    audioElementsRef.current.clear();

    // Close all peer connections
    peerConnections.current.forEach(pc => pc.close());
    peerConnections.current.clear();

    setRemoteStreams(new Map());
    setVoiceParticipants([]);
    setCurrentVoiceChannel(null);
    currentVoiceChannelRef.current = null;
  }, [socket]);

  // Socket event listeners for Voice Channel and Calls
  useEffect(() => {
    if (!socket) return;

    socket.on('voice_channel_state', async (data: { channelId: string; participants: VoiceParticipant[] }) => {
      setVoiceParticipants(data.participants);

      // Ensure local audio is initialized before creating offers
      if (!localStreamRef.current) {
        await initLocalAudio();
      }

      // Initiate WebRTC offers to existing participants
      data.participants.forEach(async (peer) => {
        if (peer.userId === user?.id) return;

        const pc = createPeerConnection(peer.userId, data.channelId);
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('voice_signal', {
            targetUserId: peer.userId,
            signal: { type: 'offer', sdp: offer },
            channelId: data.channelId
          });
        } catch (err) {
          console.error('Error creating WebRTC offer:', err);
        }
      });
    });

    socket.on('voice_peer_joined', async (participant: VoiceParticipant) => {
      setVoiceParticipants(prev => {
        if (prev.some(p => p.userId === participant.userId)) return prev;
        return [...prev, participant];
      });
      soundEffects.playJoinVoiceSound();
    });

    socket.on('voice_peer_left', (data: { userId: string; channelId: string }) => {
      setVoiceParticipants(prev => prev.filter(p => p.userId !== data.userId));

      const pc = peerConnections.current.get(data.userId);
      if (pc) {
        pc.close();
        peerConnections.current.delete(data.userId);
      }

      // Clean up audio element for departed peer
      const audioEl = audioElementsRef.current.get(data.userId);
      if (audioEl) {
        audioEl.pause();
        audioEl.srcObject = null;
        audioElementsRef.current.delete(data.userId);
      }

      setRemoteStreams(prev => {
        const next = new Map(prev);
        next.delete(data.userId);
        return next;
      });

      soundEffects.playLeaveVoiceSound();

      // If in a 1-on-1 direct call and the other person left / refreshed, terminate call cleanly
      if (activeCallRef.current && (activeCallRef.current.targetUser.id === data.userId || activeCallRef.current.conversationId === data.channelId)) {
        soundEffects.stopRingtone();
        setActiveCall(null);
        setIncomingCall(null);
        leaveVoiceChannel();
      }
    });

    socket.on('voice_peer_speaking', (data: { userId: string; isSpeaking: boolean }) => {
      setVoiceParticipants(prev => prev.map(p => {
        if (p.userId === data.userId) {
          return { ...p, isSpeaking: data.isSpeaking };
        }
        return p;
      }));
    });

    socket.on('voice_peer_state_changed', (data: { userId: string; isMuted: boolean; isDeafened: boolean; isScreenSharing: boolean }) => {
      setVoiceParticipants(prev => prev.map(p => {
        if (p.userId === data.userId) {
          return {
            ...p,
            isMuted: data.isMuted,
            isDeafened: data.isDeafened,
            isScreenSharing: data.isScreenSharing
          };
        }
        return p;
      }));
    });

    // WebRTC Signaling Handshake (Offer, Answer, ICE)
    socket.on('voice_signal', async (data: { senderUserId: string; signal: any; channelId: string }) => {
      const { senderUserId, signal, channelId } = data;

      // Ensure local audio is initialized before answering
      if (!localStreamRef.current) {
        await initLocalAudio();
      }

      let pc = peerConnections.current.get(senderUserId);
      if (!pc) {
        pc = createPeerConnection(senderUserId, channelId);
      }

      if (signal.type === 'offer') {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('voice_signal', {
            targetUserId: senderUserId,
            signal: { type: 'answer', sdp: answer },
            channelId
          });
        } catch (e) {
          console.error('Error handling WebRTC offer:', e);
        }
      } else if (signal.type === 'answer') {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        } catch (e) {
          console.error('Error handling WebRTC answer:', e);
        }
      } else if (signal.type === 'candidate' && signal.candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } catch (e) {
          console.error('Error adding ICE candidate:', e);
        }
      }
    });

    // Direct 1-on-1 Call Handlers
    socket.on('incoming_call', (data: { caller: User; conversationId: string; isVideo: boolean }) => {
      setIncomingCall(data);
      soundEffects.startRingtone();
    });

    socket.on('call_answered', async (data: { calleeId: string; conversationId: string; accepted: boolean }) => {
      soundEffects.stopRingtone();
      if (data.accepted) {
        setActiveCall(prev => prev ? { ...prev, status: 'connected' } : null);
        await joinVoiceChannel(data.conversationId);
      } else {
        setActiveCall(null);
        leaveVoiceChannel();
      }
    });

    socket.on('call_ended', () => {
      soundEffects.stopRingtone();
      setActiveCall(null);
      setIncomingCall(null);
      leaveVoiceChannel();
    });

    return () => {
      socket.off('voice_channel_state');
      socket.off('voice_peer_joined');
      socket.off('voice_peer_left');
      socket.off('voice_peer_speaking');
      socket.off('voice_peer_state_changed');
      socket.off('voice_signal');
      socket.off('incoming_call');
      socket.off('call_answered');
      socket.off('call_ended');
    };
  }, [socket, user, leaveVoiceChannel]);

  const toggleMute = () => {
    const nextState = !isMuted;
    setIsMuted(nextState);
    isMutedRef.current = nextState;

    if (nextState) {
      soundEffects.playMuteSound();
    } else {
      soundEffects.playUnmuteSound();
    }

    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => {
        t.enabled = !nextState;
      });
    }

    if (socket && currentVoiceChannelRef.current) {
      socket.emit('voice_state_update', {
        channelId: currentVoiceChannelRef.current,
        isMuted: nextState,
        isDeafened: isDeafenedRef.current
      });
    }
  };

  const toggleDeafen = () => {
    const nextState = !isDeafened;
    setIsDeafened(nextState);
    isDeafenedRef.current = nextState;

    if (nextState) {
      soundEffects.playMuteSound();
    } else {
      soundEffects.playUnmuteSound();
    }

    // Auto-mute when deafened
    if (nextState && !isMutedRef.current) {
      toggleMute();
    }

    if (socket && currentVoiceChannelRef.current) {
      socket.emit('voice_state_update', {
        channelId: currentVoiceChannelRef.current,
        isMuted: nextState ? true : isMutedRef.current,
        isDeafened: nextState
      });
    }
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
        setScreenStream(null);
      }
      setIsScreenSharing(false);
      if (socket && currentVoiceChannelRef.current) {
        socket.emit('voice_state_update', {
          channelId: currentVoiceChannelRef.current,
          isScreenSharing: false
        });
      }
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        screenStreamRef.current = stream;
        setScreenStream(stream);
        setIsScreenSharing(true);

        // Add all screen tracks (both video AND audio) to all active peer connections
        peerConnections.current.forEach((pc, peerId) => {
          stream.getTracks().forEach(track => {
            pc.addTrack(track, stream);
          });
          // Renegotiate with peer
          if (socket && currentVoiceChannelRef.current) {
            pc.createOffer().then(offer => {
              pc.setLocalDescription(offer);
              socket.emit('voice_signal', {
                targetUserId: peerId,
                signal: { type: 'offer', sdp: offer },
                channelId: currentVoiceChannelRef.current
              });
            }).catch(e => console.warn('Renegotiation offer error:', e));
          }
        });

        // Handle user stopping screen share via browser floating bar
        const primaryTrack = stream.getVideoTracks()[0] || stream.getTracks()[0];
        if (primaryTrack) {
          primaryTrack.onended = () => {
            setIsScreenSharing(false);
            if (screenStreamRef.current) {
              screenStreamRef.current.getTracks().forEach(t => t.stop());
              screenStreamRef.current = null;
            }
            setScreenStream(null);
            if (socket && currentVoiceChannelRef.current) {
              socket.emit('voice_state_update', {
                channelId: currentVoiceChannelRef.current,
                isScreenSharing: false
              });
            }
          };
        }

        if (socket && currentVoiceChannelRef.current) {
          socket.emit('voice_state_update', {
            channelId: currentVoiceChannelRef.current,
            isScreenSharing: true
          });
        }
      } catch (err) {
        console.warn('Screen share cancelled or failed:', err);
      }
    }
  };

  const setUserVolume = (targetUserId: string, volume: number) => {
    setUserVolumes(prev => {
      const next = new Map(prev);
      next.set(targetUserId, volume);
      return next;
    });
  };

  // Direct Call Actions
  const startDirectCall = async (targetUser: User, conversationId: string, isVideo = false) => {
    if (!socket) return;
    await initLocalAudio();
    setActiveCall({
      targetUser,
      conversationId,
      isIncoming: false,
      isVideo,
      status: 'ringing'
    });
    soundEffects.startRingtone();
    socket.emit('call_user', {
      targetUserId: targetUser.id,
      conversationId,
      isVideo
    });
  };

  const acceptCall = async () => {
    if (!incomingCall || !socket) return;
    soundEffects.stopRingtone();
    await initLocalAudio();
    socket.emit('call_response', {
      callerId: incomingCall.caller.id,
      conversationId: incomingCall.conversationId,
      accepted: true
    });
    setActiveCall({
      targetUser: incomingCall.caller,
      conversationId: incomingCall.conversationId,
      isIncoming: true,
      isVideo: incomingCall.isVideo,
      status: 'connected'
    });
    const convoId = incomingCall.conversationId;
    setIncomingCall(null);
    await joinVoiceChannel(convoId);
  };

  const rejectCall = () => {
    if (!incomingCall || !socket) return;
    soundEffects.stopRingtone();
    socket.emit('call_response', {
      callerId: incomingCall.caller.id,
      conversationId: incomingCall.conversationId,
      accepted: false
    });
    setIncomingCall(null);
  };

  const endCall = () => {
    if (activeCallRef.current && socket) {
      socket.emit('call_end', {
        targetUserId: activeCallRef.current.targetUser.id,
        conversationId: activeCallRef.current.conversationId
      });
    }
    soundEffects.stopRingtone();
    setActiveCall(null);
    setIncomingCall(null);
    leaveVoiceChannel();
  };

  return (
    <VoiceContext.Provider
      value={{
        currentVoiceChannel,
        voiceParticipants,
        isMuted,
        isDeafened,
        isScreenSharing,
        localStream,
        screenStream,
        remoteStreams,
        userVolumes,
        joinVoiceChannel,
        leaveVoiceChannel,
        toggleMute,
        toggleDeafen,
        toggleScreenShare,
        setUserVolume,
        activeCall,
        incomingCall,
        startDirectCall,
        acceptCall,
        rejectCall,
        endCall
      }}
    >
      {children}
    </VoiceContext.Provider>
  );
};

export const useVoice = (): VoiceContextType => {
  const context = useContext(VoiceContext);
  if (!context) {
    throw new Error('useVoice must be used within a VoiceProvider');
  }
  return context;
};

