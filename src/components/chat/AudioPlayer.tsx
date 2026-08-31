import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, Download, RotateCcw } from 'lucide-react';

interface AudioPlayerProps {
  src: string;
  filename?: string;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ src, filename = 'Voice_Note.webm' }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  // Generate a consistent pseudorandom waveform array for aesthetic visualizer
  const waveformBars = useRef<number[]>(
    Array.from({ length: 32 }, () => Math.floor(Math.random() * 65) + 25)
  ).current;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && audio.duration !== Infinity) {
        setDuration(audio.duration);
      }
      setIsLoaded(true);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (!duration && audio.duration && !isNaN(audio.duration) && audio.duration !== Infinity) {
        setDuration(audio.duration);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [duration]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(console.error);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const seekTime = Math.max(0, Math.min(pos * duration, duration));
    audioRef.current.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  const cycleSpeed = () => {
    if (!audioRef.current) return;
    const rates = [1, 1.5, 2];
    const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
    const nextRate = rates[nextIdx];
    audioRef.current.playbackRate = nextRate;
    setPlaybackRate(nextRate);
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs === Infinity) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 bg-[#11131a]/90 backdrop-blur-md border border-white/10 rounded-2xl p-3 max-w-sm sm:max-w-md select-none shadow-lg">
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Play/Pause Button */}
      <button
        type="button"
        onClick={togglePlay}
        className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-indigo-600/25 transition-transform active:scale-95 cursor-pointer"
        title={isPlaying ? 'Jeda' : 'Putar Pesan Suara'}
      >
        {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
      </button>

      {/* Waveform & Scrubber */}
      <div className="flex-1 flex flex-col justify-center space-y-1.5 min-w-0">
        <div
          onClick={handleSeek}
          className="h-7 w-full flex items-center space-x-0.5 sm:space-x-1 cursor-pointer group py-1 relative"
          title="Klik untuk melompat"
        >
          {waveformBars.map((barHeight, idx) => {
            const barProgress = (idx / waveformBars.length) * 100;
            const isPassed = progressPercent >= barProgress;

            return (
              <div
                key={idx}
                style={{ height: `${barHeight}%` }}
                className={`flex-1 rounded-full transition-all duration-150 ${
                  isPassed
                    ? 'bg-gradient-to-t from-indigo-500 to-cyan-400'
                    : 'bg-white/15 group-hover:bg-white/25'
                }`}
              />
            );
          })}
        </div>

        {/* Time & Speed Controls */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono font-medium">
          <span>{formatTime(currentTime)} / {formatTime(duration)}</span>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={cycleSpeed}
              className="px-1.5 py-0.5 rounded-md bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-bold text-[10px] transition-colors cursor-pointer"
              title="Ubah kecepatan putar"
            >
              {playbackRate}x
            </button>
            <a
              href={src}
              download={filename}
              target="_blank"
              rel="noreferrer"
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
              title="Unduh Pesan Suara"
            >
              <Download size={13} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
