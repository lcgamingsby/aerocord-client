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
  playSoundboard: (soundId: string, soundName?: string, soundUrl?: string) => void;
}

const VoiceContext = createContext<VoiceContextType | undefined>(undefined);

// Multi-region STUN and global TURN servers for reliable WebRTC NAT & firewall traversal across different networks/ISPs
const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    // Google & Cloudflare STUN Servers (discover public IP)
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    // Free Globally Distributed TURN Servers (Open Relay Project / Metered) for cross-NAT relaying
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turns:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turns:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ],
  iceCandidatePoolSize: 10
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
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const screenSendersRef = useRef<Map<string, RTCRtpSender[]>>(new Map());

  // WebRTC Peer Connections: peerUserId -> RTCPeerConnection
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  // HTMLAudioElements for playing remote audio per track: `${peerUserId}:${trackId}` -> HTMLAudioElement
  const remoteAudioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  // Buffer for ICE candidates arriving before remote description is set
  const pendingIceCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  // Negotiation tracking for Perfect Negotiation pattern
  const makingOfferRef = useRef<Map<string, boolean>>(new Map());

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const speakingIntervalRef = useRef<number | null>(null);

  // Helper to process queued ICE candidates once remote description is set
  const processPendingCandidates = async (peerId: string, pc: RTCPeerConnection) => {
    const candidates = pendingIceCandidates.current.get(peerId) || [];
    if (candidates.length > 0) {
      for (const candidate of candidates) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn(`[WebRTC] Error adding buffered ICE candidate for ${peerId}:`, err);
        }
      }
      pendingIceCandidates.current.set(peerId, []);
    }
  };

  // Helper to play an individual audio track (microphone OR screen share audio)
  // Each track gets its own HTMLAudioElement to prevent the browser from silencing secondary audio tracks.
  const playRemoteAudioTrack = (peerUserId: string, track: MediaStreamTrack) => {
    const key = `${peerUserId}:${track.id}`;
    let audioEl = remoteAudioElementsRef.current.get(key);
    if (!audioEl) {
      audioEl = new Audio();
      audioEl.autoplay = true;
      remoteAudioElementsRef.current.set(key, audioEl);
    }

    const singleTrackStream = new MediaStream([track]);
    audioEl.srcObject = singleTrackStream;

    const vol = isDeafenedRef.current ? 0 : ((userVolumesRef.current.get(peerUserId) ?? 100) / 100);
    audioEl.volume = Math.max(0, Math.min(1, vol));

    audioEl.play().catch(e => {
      console.warn(`[WebRTC Audio] Remote audio playback auto-play notice for ${key}:`, e);
    });

    track.onended = () => {
      audioEl?.pause();
      if (audioEl) audioEl.srcObject = null;
      remoteAudioElementsRef.current.delete(key);
    };
  };

  // Helper to stop all audio elements for a departed or disconnected peer
  const stopPeerAudioTracks = (peerUserId: string) => {
    remoteAudioElementsRef.current.forEach((audioEl, key) => {
      if (key.startsWith(`${peerUserId}:`)) {
        audioEl.pause();
        audioEl.srcObject = null;
        remoteAudioElementsRef.current.delete(key);
      }
    });
  };

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
    remoteAudioElementsRef.current.forEach((audioEl, key) => {
      const peerUserId = key.split(':')[0];
      const vol = isDeafened ? 0 : ((userVolumesRef.current.get(peerUserId) ?? 100) / 100);
      audioEl.volume = Math.max(0, Math.min(1, vol));
    });
  }, [isDeafened]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    userVolumesRef.current = userVolumes;
    // Update audio element volume for each peer
    remoteAudioElementsRef.current.forEach((audioEl, key) => {
      const peerUserId = key.split(':')[0];
      const vol = isDeafenedRef.current ? 0 : ((userVolumes.get(peerUserId) ?? 100) / 100);
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

  // Helper to send an SDP offer to a specific peer for initial handshake or renegotiation
  const makeOffer = async (targetUserId: string, channelId?: string) => {
    const pc = peerConnections.current.get(targetUserId);
    if (!pc) return;
    try {
      makingOfferRef.current.set(targetUserId, true);
      const offer = await pc.createOffer();
      if (pc.signalingState !== 'stable') return;
      await pc.setLocalDescription(offer);
      if (socket) {
        const chId = channelId || currentVoiceChannelRef.current || activeCallRef.current?.conversationId || '';
        socket.emit('voice_signal', {
          targetUserId,
          signal: { type: 'offer', sdp: offer },
          channelId: chId
        });
      }
    } catch (err) {
      console.warn(`[WebRTC] Error making offer to ${targetUserId}:`, err);
    } finally {
      makingOfferRef.current.set(targetUserId, false);
    }
  };

  const createPeerConnection = (targetUserId: string, channelId: string): RTCPeerConnection => {
    if (peerConnections.current.has(targetUserId)) {
      peerConnections.current.get(targetUserId)!.close();
    }
    makingOfferRef.current.set(targetUserId, false);

    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Add microphone tracks if available, otherwise add audio transceiver
    if (localStreamRef.current && localStreamRef.current.getAudioTracks().length > 0) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    } else {
      pc.addTransceiver('audio', { direction: 'sendrecv' });
    }

    // Add screen share tracks (video and audio) if active, otherwise add recvonly video transceiver
    if (screenStreamRef.current && screenStreamRef.current.getVideoTracks().length > 0) {
      const senders: RTCRtpSender[] = [];
      screenStreamRef.current.getTracks().forEach(track => {
        const sender = pc.addTrack(track, screenStreamRef.current!);
        senders.push(sender);
      });
      screenSendersRef.current.set(targetUserId, senders);
    } else {
      // Ensure video transceiver exists in SDP offer & answer so incoming screen share is negotiated immediately
      pc.addTransceiver('video', { direction: 'recvonly' });
    }

    // Handle remote track received
    pc.ontrack = (event) => {
      if (event.track.kind === 'audio') {
        playRemoteAudioTrack(targetUserId, event.track);
      }

      // Maintain composite peer MediaStream for video / UI rendering
      let peerStream = remoteStreamsRef.current.get(targetUserId);
      if (!peerStream) {
        peerStream = new MediaStream();
      }

      if (!peerStream.getTracks().some(t => t.id === event.track.id)) {
        peerStream.addTrack(event.track);
      }

      // Construct a new MediaStream reference with all live tracks to trigger clean React re-renders and rebind video elements
      const liveTracks = peerStream.getTracks().filter(t => t.readyState === 'live');
      const freshStream = new MediaStream(liveTracks);
      remoteStreamsRef.current.set(targetUserId, freshStream);
      setRemoteStreams(new Map(remoteStreamsRef.current));

      const handleTrackEnd = () => {
        if (event.track.kind === 'audio') {
          const key = `${targetUserId}:${event.track.id}`;
          const audioEl = remoteAudioElementsRef.current.get(key);
          if (audioEl) {
            audioEl.pause();
            audioEl.srcObject = null;
            remoteAudioElementsRef.current.delete(key);
          }
        }
        const currentStream = remoteStreamsRef.current.get(targetUserId);
        if (currentStream) {
          currentStream.removeTrack(event.track);
          const remainingLive = currentStream.getTracks().filter(t => t.readyState === 'live');
          remoteStreamsRef.current.set(targetUserId, new MediaStream(remainingLive));
          setRemoteStreams(new Map(remoteStreamsRef.current));
        }
      };

      event.track.onended = handleTrackEnd;
      event.track.onmute = () => {
        setRemoteStreams(new Map(remoteStreamsRef.current));
      };
      event.track.onunmute = () => {
        setRemoteStreams(new Map(remoteStreamsRef.current));
      };
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

    // Auto-restart ICE on connection failure across different networks
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') {
        console.warn(`[WebRTC] ICE connection failed with ${targetUserId}, attempting ICE restart...`);
        pc.restartIce();
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
    remoteAudioElementsRef.current.forEach(audioEl => {
      audioEl.pause();
      audioEl.srcObject = null;
    });
    remoteAudioElementsRef.current.clear();

    // Close all peer connections
    peerConnections.current.forEach(pc => pc.close());
    peerConnections.current.clear();
    screenSendersRef.current.clear();
    pendingIceCandidates.current.clear();
    makingOfferRef.current.clear();
    remoteStreamsRef.current.clear();

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

        createPeerConnection(peer.userId, data.channelId);
        await makeOffer(peer.userId, data.channelId);
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
      screenSendersRef.current.delete(data.userId);
      pendingIceCandidates.current.delete(data.userId);
      makingOfferRef.current.delete(data.userId);

      // Clean up audio elements for departed peer
      stopPeerAudioTracks(data.userId);

      remoteStreamsRef.current.delete(data.userId);
      setRemoteStreams(new Map(remoteStreamsRef.current));

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

      // Trigger UI update when peer screen share state changes
      setRemoteStreams(new Map(remoteStreamsRef.current));
    });

    // WebRTC Signaling Handshake (Offer, Answer, ICE) with Perfect Negotiation pattern
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

      // Helper to ensure all active receivers are playing audio and present in remoteStreams
      const syncReceivers = (peerId: string, conn: RTCPeerConnection) => {
        let peerStream = remoteStreamsRef.current.get(peerId);
        if (!peerStream) {
          peerStream = new MediaStream();
        }

        conn.getReceivers().forEach(receiver => {
          if (receiver.track) {
            if (receiver.track.kind === 'audio') {
              playRemoteAudioTrack(peerId, receiver.track);
            }
            if (!peerStream!.getTracks().some(t => t.id === receiver.track.id)) {
              peerStream!.addTrack(receiver.track);
            }
          }
        });

        const liveTracks = peerStream.getTracks().filter(t => t.readyState === 'live');
        remoteStreamsRef.current.set(peerId, new MediaStream(liveTracks));
        setRemoteStreams(new Map(remoteStreamsRef.current));
      };

      if (signal.type === 'offer') {
        try {
          const isOfferCollision = makingOfferRef.current.get(senderUserId) || pc.signalingState !== 'stable';
          const isPolite = (user?.id || '') > senderUserId; // deterministic polite peer resolution

          if (isOfferCollision) {
            if (!isPolite) {
              // Impolite peer ignores colliding offer
              return;
            }
            // Polite peer rolls back local offer to accept remote offer
            await pc.setLocalDescription({ type: 'rollback' });
          }

          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          await processPendingCandidates(senderUserId, pc);

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          socket.emit('voice_signal', {
            targetUserId: senderUserId,
            signal: { type: 'answer', sdp: answer },
            channelId
          });

          syncReceivers(senderUserId, pc);
        } catch (e) {
          console.error('Error handling WebRTC offer:', e);
        }
      } else if (signal.type === 'answer') {
        try {
          if (pc.signalingState !== 'have-local-offer') {
            console.warn('[WebRTC] Ignoring stale answer from', senderUserId, 'in state', pc.signalingState);
            return;
          }
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          await processPendingCandidates(senderUserId, pc);

          syncReceivers(senderUserId, pc);
        } catch (e) {
          console.error('Error handling WebRTC answer:', e);
        }
      } else if (signal.type === 'candidate' && signal.candidate) {
        try {
          if (pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } else {
            if (!pendingIceCandidates.current.has(senderUserId)) {
              pendingIceCandidates.current.set(senderUserId, []);
            }
            pendingIceCandidates.current.get(senderUserId)!.push(signal.candidate);
          }
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

    // Soundboard event broadcast listener
    socket.on('voice_soundboard_played', (data: { userId: string; soundId: string; soundName?: string; soundUrl?: string }) => {
      if (isDeafenedRef.current) return;
      if (data.soundUrl) {
        try {
          const audio = new Audio(data.soundUrl);
          audio.volume = 0.85;
          audio.play().catch(e => console.warn('Soundboard audio play error:', e));
        } catch (err) {
          console.warn('Soundboard audio error:', err);
        }
      } else {
        soundEffects.playSoundboard(data.soundId);
      }
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
      socket.off('voice_soundboard_played');
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

    const chanId = currentVoiceChannelRef.current || activeCallRef.current?.conversationId;
    if (socket && chanId) {
      socket.emit('voice_state_update', {
        channelId: chanId,
        isMuted: nextState,
        isDeafened: isDeafenedRef.current
      });
    }

    if (user) {
      setVoiceParticipants(prev => prev.map(p => {
        if (p.userId === user.id) {
          return { ...p, isMuted: nextState };
        }
        return p;
      }));
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

    const chanId = currentVoiceChannelRef.current || activeCallRef.current?.conversationId;
    if (socket && chanId) {
      socket.emit('voice_state_update', {
        channelId: chanId,
        isMuted: nextState ? true : isMutedRef.current,
        isDeafened: nextState
      });
    }

    if (user) {
      setVoiceParticipants(prev => prev.map(p => {
        if (p.userId === user.id) {
          return { ...p, isDeafened: nextState, isMuted: nextState ? true : isMutedRef.current };
        }
        return p;
      }));
    }
  };

  const stopScreenShare = async () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
      setScreenStream(null);
    }
    setIsScreenSharing(false);

    // Remove screen track senders from all active peer connections
    peerConnections.current.forEach((pc, peerId) => {
      const senders = screenSendersRef.current.get(peerId);
      if (senders && senders.length > 0) {
        senders.forEach(sender => {
          try {
            pc.removeTrack(sender);
          } catch (e) {
            console.warn('Error removing screen track sender:', e);
          }
        });
        screenSendersRef.current.delete(peerId);
      }
    });

    const chanId = currentVoiceChannelRef.current || activeCallRef.current?.conversationId;
    if (socket && chanId) {
      socket.emit('voice_state_update', {
        channelId: chanId,
        isScreenSharing: false
      });
    }

    // Explicitly renegotiate with all peers to announce track removal
    for (const peerId of peerConnections.current.keys()) {
      await makeOffer(peerId, chanId);
    }
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      await stopScreenShare();
    } else {
      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        } catch (mediaErr: any) {
          if (mediaErr.name === 'NotAllowedError') throw mediaErr;
          stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        }

        screenStreamRef.current = stream;
        setScreenStream(stream);
        setIsScreenSharing(true);

        const videoTrack = stream.getVideoTracks()[0];
        const audioTrack = stream.getAudioTracks()[0];

        // Add screen tracks to all active peer connections
        peerConnections.current.forEach((pc, peerId) => {
          // Clean up any previous senders first
          const prevSenders = screenSendersRef.current.get(peerId);
          if (prevSenders) {
            prevSenders.forEach(s => {
              try { pc.removeTrack(s); } catch (e) {}
            });
          }

          const senders: RTCRtpSender[] = [];

          if (videoTrack) {
            const sender = pc.addTrack(videoTrack, stream);
            senders.push(sender);
          }

          if (audioTrack) {
            const sender = pc.addTrack(audioTrack, stream);
            senders.push(sender);
          }

          screenSendersRef.current.set(peerId, senders);
        });

        // Handle user stopping screen share via browser native stop button
        const primaryTrack = stream.getVideoTracks()[0] || stream.getTracks()[0];
        if (primaryTrack) {
          primaryTrack.onended = () => {
            stopScreenShare();
          };
        }

        const chanId = currentVoiceChannelRef.current || activeCallRef.current?.conversationId;
        if (socket && chanId) {
          socket.emit('voice_state_update', {
            channelId: chanId,
            isScreenSharing: true
          });
        }

        // Explicitly renegotiate with all peers immediately!
        for (const peerId of peerConnections.current.keys()) {
          await makeOffer(peerId, chanId);
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

  const playSoundboard = (soundId: string, soundName?: string, soundUrl?: string) => {
    const activeChan = currentVoiceChannelRef.current || (activeCallRef.current?.conversationId ? activeCallRef.current.conversationId : null);
    if (!activeChan || !socket) return;
    socket.emit('voice_soundboard', {
      channelId: activeChan,
      soundId,
      soundName: soundName || soundId,
      soundUrl
    });
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
        endCall,
        playSoundboard
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
