import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Repeat, Volume2, VolumeX, GripVertical, Sparkles } from 'lucide-react';
import { SoundFile, FXState } from '../types';
import { WaveformDisplay } from './WaveformDisplay';
import { isFXActive, renderProcessedBlobUrl, exportProcessedSoundFile } from '../utils/audioFX';

interface AudioPlayerProps {
  currentSound: SoundFile | null;
  isPlaying: boolean;
  fx: FXState;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onNotify: (message: string) => void;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  currentSound,
  isPlaying,
  fx,
  onTogglePlay,
  onNext,
  onPrev,
  onNotify
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0.85);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);

  // Active processed audio state
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const [cachedWav, setCachedWav] = useState<ArrayBuffer | null>(null);
  const [isRenderingFX, setIsRenderingFX] = useState<boolean>(false);

  const fxActive = isFXActive(fx);

  // When sound or FX change, prepare active audio stream (raw vs rendered with FX)
  useEffect(() => {
    if (!currentSound) {
      setActiveUrl(null);
      setCachedWav(null);
      return;
    }

    let isCancelled = false;

    if (!fxActive) {
      setActiveUrl(currentSound.streamUrl);
      setCachedWav(null);
      return;
    }

    // Render processed FX audio in background
    setIsRenderingFX(true);
    renderProcessedBlobUrl(currentSound.streamUrl, fx)
      .then(({ blobUrl, wavBytes }) => {
        if (!isCancelled) {
          setActiveUrl(blobUrl);
          setCachedWav(wavBytes);
          setIsRenderingFX(false);
        }
      })
      .catch((err) => {
        console.warn('Error rendering FX audio:', err);
        if (!isCancelled) {
          setActiveUrl(currentSound.streamUrl);
          setIsRenderingFX(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [currentSound, fx, fxActive]);

  // Coordinated playback synchronization
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!activeUrl) {
      audio.pause();
      setCurrentTime(0);
      setDuration(0);
      return;
    }

    if (audio.src !== activeUrl) {
      audio.src = activeUrl;
      audio.currentTime = 0;
      setCurrentTime(0);
    }

    audio.playbackRate = playbackRate;
    audio.loop = isLooping;

    if (isPlaying) {
      const p = audio.play();
      if (p !== undefined) {
        p.catch((err) => console.warn('Playback error / interrupted:', err));
      }
    } else {
      audio.pause();
    }
  }, [activeUrl, isPlaying, playbackRate, isLooping]);

  // Volume
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  // Speed
  const handleRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) audioRef.current.playbackRate = rate;
  };

  // Seek
  const handleSeek = (newTime: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  // Spacebar & Arrows
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;

      if (e.code === 'Space') {
        e.preventDefault();
        onTogglePlay();
      } else if (e.code === 'ArrowDown' || e.code === 'ArrowRight') {
        e.preventDefault();
        onNext();
      } else if (e.code === 'ArrowUp' || e.code === 'ArrowLeft') {
        e.preventDefault();
        onPrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onTogglePlay, onNext, onPrev]);

  // Drag handler: drops original file OR rendered processed WAV
  const handleDragCurrent = async (e: React.DragEvent) => {
    if (!currentSound) return;

    if (window.electronAPI?.isElectron) {
      e.preventDefault();

      if (fxActive && cachedWav) {
        try {
          const processedPath = await exportProcessedSoundFile(
            currentSound.name,
            currentSound.path,
            cachedWav,
            fx
          );
          window.electronAPI.startDrag(processedPath);
          onNotify(`Dragging PROCESSED audio into Premiere / AE...`);
        } catch (err) {
          console.error(err);
          window.electronAPI.startDrag(currentSound.path);
        }
      } else {
        window.electronAPI.startDrag(currentSound.path);
        onNotify(`Dragging "${currentSound.name}" to Premiere / After Effects...`);
      }
    } else {
      e.dataTransfer.setData('text/plain', currentSound.path);
    }
  };

  return (
    <footer className="player-deck">
      <audio
        ref={audioRef}
        preload="auto"
        onTimeUpdate={() => {
          if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
        }}
        onLoadedMetadata={() => {
          if (audioRef.current) setDuration(audioRef.current.duration || 0);
        }}
        onEnded={() => {
          if (!isLooping) {
            onTogglePlay();
          }
        }}
        onError={() => {
          const err = audioRef.current?.error;
          console.warn('Audio element error:', err?.code, err?.message);
        }}
      />

      {/* Top Deck Row */}
      <div className="player-top-row">
        {/* Current Sound Meta & FX Badge */}
        <div className="current-sound-info">
          {currentSound ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="current-title">{currentSound.name}</span>
                {fxActive && (
                  <span
                    style={{
                      background: 'rgba(0, 240, 255, 0.15)',
                      color: 'var(--accent-cyan)',
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: 4,
                      border: '1px solid rgba(0, 240, 255, 0.3)'
                    }}
                  >
                    FX ACTIVE
                  </span>
                )}
              </div>
              <div className="current-path">
                {currentSound.category} • {currentSound.extension} • {currentSound.sizeFormatted}
                {isRenderingFX && ' • Processing effects...'}
              </div>
            </div>
          ) : (
            <div>
              <div className="current-title" style={{ color: 'var(--text-muted)' }}>
                No sound selected
              </div>
              <div className="current-path">Select an audio file or press Spacebar</div>
            </div>
          )}
        </div>

        {/* Center Playback Controls */}
        <div className="player-center-controls">
          <button className="ctrl-btn" onClick={onPrev} title="Previous Sound (Up Arrow)">
            <SkipBack size={16} />
          </button>

          <button
            className="ctrl-btn main-play-btn"
            onClick={onTogglePlay}
            disabled={!currentSound}
            title={isPlaying ? 'Pause (Spacebar)' : 'Play (Spacebar)'}
          >
            {isPlaying ? <Pause size={20} /> : <Play size={20} style={{ marginLeft: 2 }} />}
          </button>

          <button className="ctrl-btn" onClick={onNext} title="Next Sound (Down Arrow)">
            <SkipForward size={16} />
          </button>

          <button
            className={`ctrl-btn ${isLooping ? 'active' : ''}`}
            onClick={() => {
              setIsLooping(!isLooping);
              if (audioRef.current) audioRef.current.loop = !isLooping;
            }}
            title={isLooping ? 'Loop Enabled' : 'Enable Loop'}
          >
            <Repeat size={15} />
          </button>
        </div>

        {/* Right Controls: Pitch/Speed, Volume, Premiere Drag Badge */}
        <div className="player-right-controls">
          {/* Speed Selector */}
          <div className="speed-selector" title="Playback Speed">
            {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((rate) => (
              <button
                key={rate}
                className={`speed-opt ${playbackRate === rate ? 'active' : ''}`}
                onClick={() => handleRateChange(rate)}
              >
                {rate}x
              </button>
            ))}
          </div>

          {/* Volume */}
          <div className="volume-slider-group">
            <button
              className="ctrl-btn"
              style={{ width: 28, height: 28 }}
              onClick={() => setIsMuted(!isMuted)}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                setVolume(parseFloat(e.target.value));
                if (isMuted) setIsMuted(false);
              }}
              className="volume-slider"
            />
          </div>

          {/* Direct Premiere Drag from Player */}
          {currentSound && (
            <div
              className="drag-handle-badge"
              draggable="true"
              onDragStart={handleDragCurrent}
              title={
                fxActive
                  ? 'Drag PROCESSED audio directly into Premiere Pro or After Effects'
                  : 'Drag audio directly into Premiere Pro or After Effects'
              }
              style={{
                padding: '7px 12px',
                borderColor: fxActive ? 'var(--accent-cyan)' : undefined,
                boxShadow: fxActive ? '0 0 12px rgba(0, 240, 255, 0.35)' : undefined
              }}
            >
              <GripVertical size={14} />
              <span>{fxActive ? 'DROP PROCESSED' : 'DROP TO TIMELINE'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Waveform Scrubber Deck */}
      <WaveformDisplay
        audioUrl={activeUrl}
        currentTime={currentTime}
        duration={duration}
        isPlaying={isPlaying}
        onSeek={handleSeek}
      />
    </footer>
  );
};
