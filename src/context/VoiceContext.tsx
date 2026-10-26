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
  remoteStreams: Map<string, MediaStream>; // peerUserId -> MediaStream (screen share video & screen audio)
  userVolumes: Map<string, number>; // peerUserId -> 0 to 200
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

// Multi-region STUN and global TURN servers for reliable WebRTC NAT & firewall traversal
const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
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
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const voiceParticipantsRef = useRef<VoiceParticipant[]>([]);

  // WebRTC Peer Connections: peerUserId -> RTCPeerConnection
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  // HTMLAudioElements for playing remote microphone audio: peerUserId -> HTMLAudioElement
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  // Buffer for ICE candidates arriving before remote description is set
  const pendingIceCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  // Negotiation tracking for polite peer negotiation
  const makingOfferRef = useRef<Map<string, boolean>>(new Map());

  // Web Audio Speaking Detector
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const speakingIntervalRef = useRef<number | null>(null);

  // Dedicated MediaStreams for remote mic audio playback: peerUserId -> MediaStream
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

  // Helper to play remote mic audio stably
  const playRemoteAudio = (targetUserId: string, stream: MediaStream) => {
    let audioEl = audioElementsRef.current.get(targetUserId);
    if (!audioEl) {
      audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      (audioEl as any).playsInline = true;
      // Position offscreen safely
      audioEl.style.position = 'fixed';
      audioEl.style.top = '-9999px';
      audioEl.style.left = '-9999px';
      audioEl.style.width = '1px';
      audioEl.style.height = '1px';
      audioEl.style.opacity = '0';
      audioEl.style.pointerEvents = 'none';
      document.body.appendChild(audioEl);
      audioElementsRef.current.set(targetUserId, audioEl);
    }

    if (audioEl.srcObject !== stream) {
      audioEl.srcObject = stream;
    }

    const vol = isDeafenedRef.current ? 0 : ((userVolumesRef.current.get(targetUserId) ?? 100) / 100);
    audioEl.volume = Math.max(0, Math.min(1, vol));

    if (audioEl.paused) {
      audioEl.play().catch(e => {
        console.warn(`[WebRTC] Audio play waiting for user gesture (${targetUserId}):`, e);
      });
    }
  };

  // Synchronize all media receivers for a peer connection
  const syncPeerMedia = (peerId: string, conn: RTCPeerConnection) => {
    const receivers = conn.getReceivers();

    // Attach lifecycle listeners to all tracks
    receivers.forEach(receiver => {
      const track = receiver.track;
      if (track && !(track as any)._hasLifecycleListeners) {
        (track as any)._hasLifecycleListeners = true;
        track.onunmute = () => syncPeerMedia(peerId, conn);
        track.onmute = () => syncPeerMedia(peerId, conn);
        track.onended = () => syncPeerMedia(peerId, conn);
      }
    });

    // 1. Microphone Audio Receiver (first audio transceiver)
    const audioReceivers = receivers.filter(r => r.track && r.track.kind === 'audio');
    const micReceiver = audioReceivers[0];

    if (micReceiver && micReceiver.track && micReceiver.track.readyState === 'live') {
      let currentAudioStream = peerAudioStreamsRef.current.get(peerId);
      const currentTrack = currentAudioStream?.getAudioTracks()[0];

      if (!currentAudioStream || currentTrack?.id !== micReceiver.track.id) {
        currentAudioStream = new MediaStream([micReceiver.track]);
        peerAudioStreamsRef.current.set(peerId, currentAudioStream);
      }
      playRemoteAudio(peerId, currentAudioStream);
    }

    // 2. Screen Share Receiver (Video & optional Screen Audio)
    const videoReceiver = receivers.find(r => r.track && r.track.kind === 'video');
    // Screen audio is the second audio receiver if sender shared tab/system audio
    const screenAudioReceiver = audioReceivers.length > 1 ? audioReceivers[1] : null;

    // A screen share is considered active ONLY IF:
    // 1. The peer participant is flagged as sharing screen in signaling (or active 1-on-1 video call)
    // 2. The video receiver track exists and is ready
    const participant = voiceParticipantsRef.current.find(p => p.userId === peerId);
    const isPeerSharing = !!(participant?.isScreenSharing || (activeCallRef.current?.isVideo && activeCallRef.current?.targetUser.id === peerId));
    const hasLiveVideoTrack = !!(videoReceiver && videoReceiver.track && videoReceiver.track.readyState === 'live');

    if (isPeerSharing && hasLiveVideoTrack) {
      const screenTracks: MediaStreamTrack[] = [videoReceiver!.track];
      if (screenAudioReceiver && screenAudioReceiver.track && screenAudioReceiver.track.readyState === 'live') {
        screenTracks.push(screenAudioReceiver.track);
      }

      const existingStream = remoteStreamsRef.current.get(peerId);
      const existingVideoTrack = existingStream?.getVideoTracks()[0];
      const existingAudioTrack = existingStream?.getAudioTracks()[0];
      const newAudioTrackId = screenAudioReceiver?.track?.id;
      const hasChanged = !existingStream ||
        existingVideoTrack?.id !== videoReceiver!.track.id ||
        existingAudioTrack?.id !== newAudioTrackId ||
        existingStream.getVideoTracks().length === 0;

      if (hasChanged) {
        const newStream = new MediaStream(screenTracks);
        remoteStreamsRef.current.set(peerId, newStream);
        setRemoteStreams(new Map(remoteStreamsRef.current));
      }
    } else {
      if (remoteStreamsRef.current.has(peerId)) {
        remoteStreamsRef.current.delete(peerId);
        setRemoteStreams(new Map(remoteStreamsRef.current));
      }
    }
  };

  // Keep refs in sync with state
  useEffect(() => {
    voiceParticipantsRef.current = voiceParticipants;
  }, [voiceParticipants]);

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
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => {
        t.enabled = !isMuted;
      });
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

  // Global User Gesture Unlocker: Automatically unpause audio elements and resume Web Audio contexts on any user interaction
  const unlockAudio = useCallback(() => {
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch(() => {});
    }
    audioElementsRef.current.forEach(el => {
      if (el.paused) {
        el.play().catch(() => {});
      }
    });
  }, []);

  useEffect(() => {
    const events = ['click', 'touchstart', 'touchend', 'keydown', 'mousedown'];
    const handleGesture = () => unlockAudio();
    events.forEach(evt => window.addEventListener(evt, handleGesture, { passive: true }));
    return () => {
      events.forEach(evt => window.removeEventListener(evt, handleGesture));
    };
  }, [unlockAudio]);

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

      // Apply initial mute state
      stream.getAudioTracks().forEach(t => {
        t.enabled = !isMutedRef.current;
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
          let silenceStartTimestamp: number | null = null;
          const SILENCE_DEBOUNCE_MS = 350; // Debounce release buffer (prevents socket spam & avatar flickering)

          if (speakingIntervalRef.current) clearInterval(speakingIntervalRef.current);

          speakingIntervalRef.current = window.setInterval(() => {
            if (!analyserRef.current || isMutedRef.current) {
              if (wasSpeaking && socket && currentVoiceChannelRef.current) {
                wasSpeaking = false;
                silenceStartTimestamp = null;
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
            const isCurrentlyLoud = average > 14;

            if (isCurrentlyLoud) {
              silenceStartTimestamp = null;
              if (!wasSpeaking) {
                wasSpeaking = true;
                if (socket && currentVoiceChannelRef.current) {
                  socket.emit('voice_speaking', { channelId: currentVoiceChannelRef.current, isSpeaking: true });
                }
              }
            } else {
              // Volume dropped below threshold - apply debounce release buffer
              if (wasSpeaking) {
                const now = Date.now();
                if (silenceStartTimestamp === null) {
                  silenceStartTimestamp = now;
                } else if (now - silenceStartTimestamp >= SILENCE_DEBOUNCE_MS) {
                  wasSpeaking = false;
                  silenceStartTimestamp = null;
                  if (socket && currentVoiceChannelRef.current) {
                    socket.emit('voice_speaking', { channelId: currentVoiceChannelRef.current, isSpeaking: false });
                  }
                }
              }
            }
          }, 100);
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

  // Helper to send an SDP offer to a specific peer
  const makeOffer = async (targetUserId: string, channelId?: string) => {
    const pc = peerConnections.current.get(targetUserId);
    if (!pc) return;
    try {
      makingOfferRef.current.set(targetUserId, true);

      // If peer connection is currently in another handshake, wait briefly for it to become stable
      let attempts = 0;
      while ((pc.signalingState as string) !== 'stable' && attempts < 10) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
      }
      if ((pc.signalingState as string) !== 'stable') {
        console.warn(`[WebRTC] Signaling state for ${targetUserId} not stable (${pc.signalingState}), cannot make offer`);
        return;
      }

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

    // 1. Audio Transceiver (Microphone)
    const micTrack = localStreamRef.current?.getAudioTracks()[0];
    if (micTrack && localStreamRef.current) {
      pc.addTrack(micTrack, localStreamRef.current);
    } else {
      pc.addTransceiver('audio', { direction: 'sendrecv' });
    }

    // 2. Video Transceiver (Screen Share Video)
    const screenVideoTrack = screenStreamRef.current?.getVideoTracks()[0];
    if (screenVideoTrack && screenStreamRef.current) {
      pc.addTrack(screenVideoTrack, screenStreamRef.current);
    } else {
      pc.addTransceiver('video', { direction: 'recvonly' });
    }

    // 3. Screen Audio Transceiver (Tab / System Audio from Screen Share)
    const screenAudioTrack = screenStreamRef.current?.getAudioTracks()[0];
    if (screenAudioTrack && screenStreamRef.current) {
      pc.addTrack(screenAudioTrack, screenStreamRef.current);
    } else {
      pc.addTransceiver('audio', { direction: 'recvonly' });
    }

    // Handle incoming remote media
    pc.ontrack = () => {
      syncPeerMedia(targetUserId, pc);
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

    // Auto-restart ICE on connection failure
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') {
        console.warn(`[WebRTC] ICE connection failed with ${targetUserId}, attempting ICE restart...`);
        pc.restartIce();
        makeOffer(targetUserId, channelId);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        console.warn(`[WebRTC] Connection failed with ${targetUserId}, attempting ICE restart...`);
        pc.restartIce();
        makeOffer(targetUserId, channelId);
      }
    };

    peerConnections.current.set(targetUserId, pc);
    return pc;
  };

  const joinVoiceChannel = async (channelId: string) => {
    if (!socket || !user) return;

    unlockAudio();
    if (currentVoiceChannel === channelId) return;

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

    // Clean up screen share stream
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
      voiceParticipantsRef.current = data.participants;
      setVoiceParticipants(data.participants);

      // Ensure local audio is initialized before creating connections
      if (!localStreamRef.current) {
        await initLocalAudio();
      }

      // Initiate WebRTC offers to all existing peers
      data.participants.forEach(async (peer) => {
        if (peer.userId === user?.id) return;

        createPeerConnection(peer.userId, data.channelId);
        await makeOffer(peer.userId, data.channelId);
      });
    });

    socket.on('voice_peer_joined', async (participant: VoiceParticipant) => {
      setVoiceParticipants(prev => {
        if (prev.some(p => p.userId === participant.userId)) return prev;
        const next = [...prev, participant];
        voiceParticipantsRef.current = next;
        return next;
      });
      soundEffects.playJoinVoiceSound();
    });

    socket.on('voice_peer_left', (data: { userId: string; channelId: string }) => {
      setVoiceParticipants(prev => {
        const next = prev.filter(p => p.userId !== data.userId);
        voiceParticipantsRef.current = next;
        return next;
      });

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

      // If in a 1-on-1 direct call and target left, terminate call
      if (activeCallRef.current && (activeCallRef.current.targetUser.id === data.userId || activeCallRef.current.conversationId === data.channelId)) {
        soundEffects.stopRingtone();
        setActiveCall(null);
        setIncomingCall(null);
        leaveVoiceChannel();
      }
    });

    socket.on('voice_peer_speaking', (data: { userId: string; isSpeaking: boolean }) => {
      setVoiceParticipants(prev => {
        const next = prev.map(p => {
          if (p.userId === data.userId) {
            return { ...p, isSpeaking: data.isSpeaking };
          }
          return p;
        });
        voiceParticipantsRef.current = next;
        return next;
      });
    });

    socket.on('voice_peer_state_changed', (data: { userId: string; isMuted: boolean; isDeafened: boolean; isScreenSharing: boolean }) => {
      setVoiceParticipants(prev => {
        const next = prev.map(p => {
          if (p.userId === data.userId) {
            return {
              ...p,
              isMuted: data.isMuted,
              isDeafened: data.isDeafened,
              isScreenSharing: data.isScreenSharing
            };
          }
          return p;
        });
        voiceParticipantsRef.current = next;
        return next;
      });

      // Immediately sync peer receivers on state change
      const pc = peerConnections.current.get(data.userId);
      if (pc) {
        syncPeerMedia(data.userId, pc);
      } else {
        if (!data.isScreenSharing && remoteStreamsRef.current.has(data.userId)) {
          remoteStreamsRef.current.delete(data.userId);
        }
        setRemoteStreams(new Map(remoteStreamsRef.current));
      }
    });

    // WebRTC Signaling Handshake (Offer, Answer, ICE) with Perfect Negotiation pattern
    socket.on('voice_signal', async (data: { senderUserId: string; signal: any; channelId: string }) => {
      const { senderUserId, signal, channelId } = data;

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
              return; // Impolite peer ignores colliding offer
            }
            if (pc.signalingState === 'have-local-offer') {
              await pc.setLocalDescription({ type: 'rollback' });
            }
          }

          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          await processPendingCandidates(senderUserId, pc);

          // Configure Transceiver directions before creating Answer
          const transceivers = pc.getTransceivers();
          const videoTransceiver = transceivers.find(t => 
            (t.receiver && t.receiver.track?.kind === 'video') || 
            (t.sender && t.sender.track?.kind === 'video')
          );
          if (videoTransceiver) {
            const hasLocalVideo = !!(screenStreamRef.current && screenStreamRef.current.getVideoTracks().some(t => t.readyState === 'live'));
            videoTransceiver.direction = hasLocalVideo ? 'sendrecv' : 'recvonly';
          }

          const audioTransceivers = transceivers.filter(t => 
            (t.receiver && t.receiver.track?.kind === 'audio') || 
            (t.sender && t.sender.track?.kind === 'audio')
          );
          // First audio transceiver is microphone
          if (audioTransceivers[0]) {
            audioTransceivers[0].direction = 'sendrecv';
          }
          // Second audio transceiver is screen share audio
          if (audioTransceivers[1]) {
            const hasLocalScreenAudio = !!(screenStreamRef.current && screenStreamRef.current.getAudioTracks().some(t => t.readyState === 'live'));
            audioTransceivers[1].direction = hasLocalScreenAudio ? 'sendrecv' : 'recvonly';
          }

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          socket.emit('voice_signal', {
            targetUserId: senderUserId,
            signal: { type: 'answer', sdp: answer },
            channelId
          });

          // Sync tracks received immediately after remote description set
          syncPeerMedia(senderUserId, pc);
        } catch (e) {
          console.error('[WebRTC] Error handling offer:', e);
        }
      } else if (signal.type === 'answer') {
        try {
          if (pc.signalingState !== 'have-local-offer') {
            console.warn('[WebRTC] Ignoring answer in state:', pc.signalingState);
            return;
          }
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          await processPendingCandidates(senderUserId, pc);

          // Sync tracks confirmed by answer
          syncPeerMedia(senderUserId, pc);
        } catch (e) {
          console.error('[WebRTC] Error handling answer:', e);
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
          console.error('[WebRTC] Error adding ICE candidate:', e);
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
    // 1. Reset transceivers to recvonly and replaceTrack(null)
    for (const pc of peerConnections.current.values()) {
      const transceivers = pc.getTransceivers();
      const videoTransceiver = transceivers.find(t => 
        (t.sender && t.sender.track?.kind === 'video') || 
        (t.receiver && t.receiver.track?.kind === 'video')
      );
      if (videoTransceiver) {
        try {
          videoTransceiver.direction = 'recvonly';
          await videoTransceiver.sender.replaceTrack(null).catch(() => {});
        } catch (e) {}
      }

      const audioTransceivers = transceivers.filter(t => 
        (t.sender && t.sender.track?.kind === 'audio') || 
        (t.receiver && t.receiver.track?.kind === 'audio')
      );
      // Screen audio is the second transceiver
      if (audioTransceivers[1]) {
        try {
          audioTransceivers[1].direction = 'recvonly';
          await audioTransceivers[1].sender.replaceTrack(null).catch(() => {});
        } catch (e) {}
      }
    }

    // 2. Stop tracks
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
      setScreenStream(null);
    }
    setIsScreenSharing(false);

    if (user) {
      setVoiceParticipants(prev => {
        const next = prev.map(p => p.userId === user.id ? { ...p, isScreenSharing: false } : p);
        voiceParticipantsRef.current = next;
        return next;
      });
    }

    const chanId = currentVoiceChannelRef.current || activeCallRef.current?.conversationId;
    if (socket && chanId) {
      socket.emit('voice_state_update', {
        channelId: chanId,
        isScreenSharing: false
      });
    }

    // 3. Renegotiate with all peers to notify removal
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
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              frameRate: { ideal: 30, max: 60 },
              width: { ideal: 1920 },
              height: { ideal: 1080 }
            },
            audio: true
          });
        } catch (mediaErr: any) {
          if (mediaErr.name === 'NotAllowedError') throw mediaErr;
          stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        }

        screenStreamRef.current = stream;
        setScreenStream(stream);
        setIsScreenSharing(true);

        const videoTrack = stream.getVideoTracks()[0];
        const screenAudioTrack = stream.getAudioTracks()[0];

        // Attach tracks to all peer connections
        for (const pc of peerConnections.current.values()) {
          const transceivers = pc.getTransceivers();

          // Video transceiver
          let videoTransceiver = transceivers.find(t => 
            (t.sender && t.sender.track?.kind === 'video') || 
            (t.receiver && t.receiver.track?.kind === 'video')
          );
          if (!videoTransceiver) {
            videoTransceiver = pc.addTransceiver('video', { direction: 'sendrecv' });
          } else {
            videoTransceiver.direction = 'sendrecv';
          }
          if (videoTrack) {
            if ('setStreams' in videoTransceiver.sender) {
              try {
                (videoTransceiver.sender as any).setStreams(stream);
              } catch (e) {}
            }
            await videoTransceiver.sender.replaceTrack(videoTrack).catch(() => {});
          }

          // Screen audio transceiver
          const audioTransceivers = transceivers.filter(t => 
            (t.sender && t.sender.track?.kind === 'audio') || 
            (t.receiver && t.receiver.track?.kind === 'audio')
          );
          let screenAudioTransceiver = audioTransceivers[1];
          if (!screenAudioTransceiver) {
            screenAudioTransceiver = pc.addTransceiver('audio', { direction: screenAudioTrack ? 'sendrecv' : 'recvonly' });
          } else {
            screenAudioTransceiver.direction = screenAudioTrack ? 'sendrecv' : 'recvonly';
          }
          if (screenAudioTrack) {
            if ('setStreams' in screenAudioTransceiver.sender) {
              try {
                (screenAudioTransceiver.sender as any).setStreams(stream);
              } catch (e) {}
            }
            await screenAudioTransceiver.sender.replaceTrack(screenAudioTrack).catch(() => {});
          }
        }

        // Handle user stopping screen share via browser native stop button
        const primaryTrack = stream.getVideoTracks()[0] || stream.getTracks()[0];
        if (primaryTrack) {
          primaryTrack.onended = () => {
            stopScreenShare();
          };
        }

        if (user) {
          setVoiceParticipants(prev => {
            const next = prev.map(p => p.userId === user.id ? { ...p, isScreenSharing: true } : p);
            voiceParticipantsRef.current = next;
            return next;
          });
        }

        const chanId = currentVoiceChannelRef.current || activeCallRef.current?.conversationId;
        if (socket && chanId) {
          socket.emit('voice_state_update', {
            channelId: chanId,
            isScreenSharing: true
          });
        }

        // Renegotiate with all peers immediately
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
    unlockAudio();
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
    unlockAudio();
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
