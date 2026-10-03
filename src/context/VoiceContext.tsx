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

  // WebRTC Peer Connections: peerUserId -> RTCPeerConnection
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  // HTMLAudioElements for playing remote audio: peerUserId -> HTMLAudioElement
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  // Buffer for ICE candidates arriving before remote description is set
  const pendingIceCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  // Negotiation tracking for Perfect Negotiation pattern
  const makingOfferRef = useRef<Map<string, boolean>>(new Map());

  // Track the current active outgoing audio track and stream (microphone or mixed mic+screen audio)
  const currentActiveAudioTrackRef = useRef<MediaStreamTrack | null>(null);
  const activeAudioStreamRef = useRef<MediaStream | null>(null);

  // Web Audio Mixer for combining Microphone and Screen Share audio seamlessly on sender side
  const audioMixerRef = useRef<AudioContext | null>(null);
  const micSourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const micGainNodeRef = useRef<GainNode | null>(null);
  const screenSourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const screenGainNodeRef = useRef<GainNode | null>(null);
  const destNodeRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const screenAudioSourceStreamRef = useRef<MediaStream | null>(null);

  // Web Audio Speaking Detector
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const speakingIntervalRef = useRef<number | null>(null);

  // Dedicated stable MediaStreams for remote audio playback: peerUserId -> MediaStream
  const peerAudioStreamsRef = useRef<Map<string, MediaStream>>(new Map());

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

  // Helper to play remote audio stream stably
  const playRemoteAudio = (targetUserId: string, stream: MediaStream) => {
    let audioEl = audioElementsRef.current.get(targetUserId);
    if (!audioEl) {
      audioEl = new Audio();
      audioEl.autoplay = true;
      audioEl.style.display = 'none';
      document.body.appendChild(audioEl);
      audioElementsRef.current.set(targetUserId, audioEl);
    }

    if (audioEl.srcObject !== stream) {
      audioEl.srcObject = stream;
    }

    const vol = isDeafenedRef.current ? 0 : ((userVolumesRef.current.get(targetUserId) ?? 100) / 100);
    audioEl.volume = Math.max(0, Math.min(1, vol));

    audioEl.play().catch(e => {
      console.warn('Remote audio playback notice:', e);
      const resumeAudio = () => {
        audioEl?.play().catch(() => {});
        window.removeEventListener('click', resumeAudio);
        window.removeEventListener('keydown', resumeAudio);
      };
      window.addEventListener('click', resumeAudio, { once: true });
      window.addEventListener('keydown', resumeAudio, { once: true });
    });
  };

  // Helper to sync all live receivers (video and audio) for a peer connection into remoteStreams & audio
  const syncPeerMedia = (peerId: string, conn: RTCPeerConnection) => {
    const liveTracks: MediaStreamTrack[] = [];
    conn.getReceivers().forEach(receiver => {
      if (receiver.track) {
        if (!(receiver.track as any)._hasListeners) {
          (receiver.track as any)._hasListeners = true;
          receiver.track.onunmute = () => syncPeerMedia(peerId, conn);
          receiver.track.onmute = () => syncPeerMedia(peerId, conn);
          receiver.track.onended = () => syncPeerMedia(peerId, conn);
        }
        if (receiver.track.readyState === 'live') {
          liveTracks.push(receiver.track);
        }
      }
    });

    // 1. Audio playback management via dedicated stable stream to avoid resetting HTMLAudioElement
    const audioTracks = liveTracks.filter(t => t.kind === 'audio');
    if (audioTracks.length > 0) {
      let audioStream = peerAudioStreamsRef.current.get(peerId);
      if (!audioStream) {
        audioStream = new MediaStream();
        peerAudioStreamsRef.current.set(peerId, audioStream);
      }
      const curTracks = audioStream.getAudioTracks();
      curTracks.forEach(t => {
        if (!audioTracks.some(at => at.id === t.id)) {
          audioStream!.removeTrack(t);
        }
      });
      audioTracks.forEach(at => {
        if (!audioStream!.getAudioTracks().some(t => t.id === at.id)) {
          audioStream!.addTrack(at);
        }
      });
      playRemoteAudio(peerId, audioStream);
    }

    // 2. Video and composite stream for UI rendering
    // Creating a fresh MediaStream ensures React components and <video> elements detect the new track state immediately
    const freshStream = new MediaStream(liveTracks);
    remoteStreamsRef.current.set(peerId, freshStream);
    setRemoteStreams(new Map(remoteStreamsRef.current));
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
    audioElementsRef.current.forEach((audioEl, peerId) => {
      const vol = isDeafened ? 0 : ((userVolumesRef.current.get(peerId) ?? 100) / 100);
      audioEl.volume = Math.max(0, Math.min(1, vol));
    });
  }, [isDeafened]);

  useEffect(() => {
    isMutedRef.current = isMuted;
    if (micGainNodeRef.current) {
      micGainNodeRef.current.gain.value = isMuted ? 0 : 1;
    }
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

      // Keep current active track & stream reference
      if (!currentActiveAudioTrackRef.current) {
        currentActiveAudioTrackRef.current = stream.getAudioTracks()[0] || null;
        activeAudioStreamRef.current = stream;
      }

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

    // Ensure sender audio mixer is running if screen sharing
    if (audioMixerRef.current && audioMixerRef.current.state === 'suspended') {
      audioMixerRef.current.resume().catch(() => {});
    }

    // Add audio track (using active composite audio stream if screen sharing with audio, else microphone stream)
    const audioStreamToSend = activeAudioStreamRef.current || localStreamRef.current;
    const audioTrackToSend = currentActiveAudioTrackRef.current || localStreamRef.current?.getAudioTracks()[0];
    if (audioStreamToSend && audioTrackToSend) {
      pc.addTrack(audioTrackToSend, audioStreamToSend);
    } else {
      pc.addTransceiver('audio', { direction: 'sendrecv' });
    }

    // Handle video transceiver (either sendrecv with active screen stream, or recvonly ready to receive)
    if (screenStreamRef.current && screenStreamRef.current.getVideoTracks().length > 0) {
      const videoTrack = screenStreamRef.current.getVideoTracks()[0];
      pc.addTrack(videoTrack, screenStreamRef.current);
    } else {
      pc.addTransceiver('video', { direction: 'recvonly' });
    }

    // Handle remote track received
    pc.ontrack = (event) => {
      syncPeerMedia(targetUserId, pc);

      event.track.onended = () => {
        syncPeerMedia(targetUserId, pc);
      };

      event.track.onmute = () => {
        syncPeerMedia(targetUserId, pc);
      };

      event.track.onunmute = () => {
        syncPeerMedia(targetUserId, pc);
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

    currentActiveAudioTrackRef.current = null;
    activeAudioStreamRef.current = null;

    // Clean up audio mixer
    if (screenSourceNodeRef.current) {
      screenSourceNodeRef.current.disconnect();
      screenSourceNodeRef.current = null;
    }
    if (screenGainNodeRef.current) {
      screenGainNodeRef.current.disconnect();
      screenGainNodeRef.current = null;
    }
    if (micSourceNodeRef.current) {
      micSourceNodeRef.current.disconnect();
      micSourceNodeRef.current = null;
    }
    if (micGainNodeRef.current) {
      micGainNodeRef.current.disconnect();
      micGainNodeRef.current = null;
    }
    if (destNodeRef.current) {
      destNodeRef.current = null;
    }
    if (audioMixerRef.current) {
      audioMixerRef.current.close().catch(() => {});
      audioMixerRef.current = null;
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
      if (audioEl.parentNode) {
        audioEl.parentNode.removeChild(audioEl);
      }
    });
    audioElementsRef.current.clear();
    peerAudioStreamsRef.current.clear();

    // Close all peer connections
    peerConnections.current.forEach(pc => pc.close());
    peerConnections.current.clear();
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
      pendingIceCandidates.current.delete(data.userId);
      makingOfferRef.current.delete(data.userId);

      // Clean up audio element for departed peer
      const audioEl = audioElementsRef.current.get(data.userId);
      if (audioEl) {
        audioEl.pause();
        audioEl.srcObject = null;
        if (audioEl.parentNode) {
          audioEl.parentNode.removeChild(audioEl);
        }
        audioElementsRef.current.delete(data.userId);
      }
      peerAudioStreamsRef.current.delete(data.userId);

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

      // Immediately sync peer receivers on state change
      const pc = peerConnections.current.get(data.userId);
      if (pc) {
        syncPeerMedia(data.userId, pc);
      } else {
        setRemoteStreams(new Map(remoteStreamsRef.current));
      }
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

          // Sync tracks received from the offer immediately
          syncPeerMedia(senderUserId, pc);
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

          // Sync tracks confirmed by the answer
          syncPeerMedia(senderUserId, pc);
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

    if (micGainNodeRef.current) {
      micGainNodeRef.current.gain.value = nextState ? 0 : 1;
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
    // 1. Set video transceivers to recvonly and replaceTrack(null) first so senders detach cleanly
    for (const pc of peerConnections.current.values()) {
      const videoTransceiver = pc.getTransceivers().find(t => 
        (t.sender && t.sender.track?.kind === 'video') || 
        (t.receiver && t.receiver.track?.kind === 'video')
      );
      if (videoTransceiver) {
        try {
          videoTransceiver.direction = 'recvonly';
          await videoTransceiver.sender.replaceTrack(null).catch(() => {});
        } catch (e) {
          console.warn('Error resetting video transceiver:', e);
        }
      }
    }

    // 2. Stop and clear screen stream tracks
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
      setScreenStream(null);
    }
    setIsScreenSharing(false);

    // 3. Revert active audio stream & track back to original microphone
    const originalMicTrack = localStreamRef.current?.getAudioTracks()[0];
    currentActiveAudioTrackRef.current = originalMicTrack || null;
    activeAudioStreamRef.current = localStreamRef.current;

    if (originalMicTrack) {
      for (const pc of peerConnections.current.values()) {
        const audioSender = pc.getSenders().find(s => s.track && s.track.kind === 'audio');
        if (audioSender) {
          await audioSender.replaceTrack(originalMicTrack).catch(() => {});
        }
      }
    }

    // Disconnect screen audio mixer nodes
    if (screenSourceNodeRef.current) {
      screenSourceNodeRef.current.disconnect();
      screenSourceNodeRef.current = null;
    }
    screenAudioSourceStreamRef.current = null;
    if (screenGainNodeRef.current) {
      screenGainNodeRef.current.disconnect();
      screenGainNodeRef.current = null;
    }
    if (micSourceNodeRef.current) {
      micSourceNodeRef.current.disconnect();
      micSourceNodeRef.current = null;
    }
    if (micGainNodeRef.current) {
      micGainNodeRef.current.disconnect();
      micGainNodeRef.current = null;
    }
    if (destNodeRef.current) {
      destNodeRef.current = null;
    }

    const chanId = currentVoiceChannelRef.current || activeCallRef.current?.conversationId;
    if (socket && chanId) {
      socket.emit('voice_state_update', {
        channelId: chanId,
        isScreenSharing: false
      });
    }

    // 4. Renegotiate with all peers to notify removal
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
        const screenAudioTrack = stream.getAudioTracks()[0];

        // 1. Audio Mixing on Sender side (mix Microphone + Screen Audio)
        if (screenAudioTrack) {
          try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (!audioMixerRef.current || audioMixerRef.current.state === 'closed') {
              audioMixerRef.current = new AudioContextClass();
            }
            const ctx = audioMixerRef.current;
            if (ctx.state === 'suspended') {
              await ctx.resume();
            }

            // Keep AudioContext active (never auto-suspended by browser)
            try {
              const silenceGain = ctx.createGain();
              silenceGain.gain.value = 0;
              silenceGain.connect(ctx.destination);
            } catch (e) {}

            const dest = ctx.createMediaStreamDestination();
            destNodeRef.current = dest;
            activeAudioStreamRef.current = dest.stream;

            // Connect mic to destination if present
            if (localStreamRef.current && localStreamRef.current.getAudioTracks().length > 0) {
              const micSource = ctx.createMediaStreamSource(localStreamRef.current);
              const micGain = ctx.createGain();
              micGain.gain.value = isMutedRef.current ? 0 : 1;
              micSource.connect(micGain);
              micGain.connect(dest);
              micSourceNodeRef.current = micSource;
              micGainNodeRef.current = micGain;
            }

            // Connect screen audio to destination using persistent MediaStream ref
            const audioStreamForSource = new MediaStream([screenAudioTrack]);
            screenAudioSourceStreamRef.current = audioStreamForSource;
            const screenSource = ctx.createMediaStreamSource(audioStreamForSource);
            const screenGain = ctx.createGain();
            screenGain.gain.value = 1;
            screenSource.connect(screenGain);
            screenGain.connect(dest);
            screenSourceNodeRef.current = screenSource;
            screenGainNodeRef.current = screenGain;

            const compositeAudioTrack = dest.stream.getAudioTracks()[0];
            currentActiveAudioTrackRef.current = compositeAudioTrack;

            // Seamlessly swap audio senders on all active peer connections
            for (const pc of peerConnections.current.values()) {
              const audioSender = pc.getSenders().find(s => s.track && s.track.kind === 'audio');
              if (audioSender) {
                await audioSender.replaceTrack(compositeAudioTrack).catch(() => {});
              }
            }
          } catch (mixErr) {
            console.warn('[Web Audio] Screen audio mix error:', mixErr);
          }
        }

        // 2. Set video transceivers to sendrecv, associate stream, and replaceTrack(videoTrack)
        for (const pc of peerConnections.current.values()) {
          const videoTransceiver = pc.getTransceivers().find(t => 
            (t.sender && t.sender.track?.kind === 'video') || 
            (t.receiver && t.receiver.track?.kind === 'video')
          );

          if (videoTrack) {
            if (videoTransceiver) {
              videoTransceiver.direction = 'sendrecv';
              if ('setStreams' in videoTransceiver.sender) {
                try {
                  (videoTransceiver.sender as any).setStreams(stream);
                } catch (e) {}
              }
              await videoTransceiver.sender.replaceTrack(videoTrack).catch(() => {});
            } else {
              pc.addTrack(videoTrack, stream);
            }
          }
        }

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

        // 3. Renegotiate video with all peers immediately!
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
