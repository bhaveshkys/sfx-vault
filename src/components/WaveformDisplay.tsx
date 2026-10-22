import React, { useEffect, useRef, useState } from 'react';

interface WaveformDisplayProps {
  audioUrl: string | null;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onSeek: (time: number) => void;
}

export const WaveformDisplay: React.FC<WaveformDisplayProps> = ({
  audioUrl,
  currentTime,
  duration,
  isPlaying,
  onSeek
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [isHovering, setIsHovering] = useState(false);
  const [hoverPosition, setHoverPosition] = useState<number>(0);

  // Generate or extract peaks for audioUrl
  useEffect(() => {
    if (!audioUrl) {
      setPeaks([]);
      return;
    }

    let isCancelled = false;

    // Use Web Audio API to decode real audio peaks
    const loadAudioPeaks = async () => {
      try {
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        
        if (isCancelled) return;

        const rawData = audioBuffer.getChannelData(0); // Left channel
        const samples = 120; // Number of waveform bars
        const blockSize = Math.floor(rawData.length / samples);
        const extractedPeaks: number[] = [];

        for (let i = 0; i < samples; i++) {
          let blockStart = blockSize * i;
          let sum = 0;
          for (let j = 0; j < blockSize; j++) {
            sum += Math.abs(rawData[blockStart + j] || 0);
          }
          extractedPeaks.push(sum / blockSize);
        }

        // Normalize peaks to 0.1 - 1.0 range
        const max = Math.max(...extractedPeaks, 0.001);
        const normalized = extractedPeaks.map(p => Math.max(0.12, p / max));
        setPeaks(normalized);
      } catch (err) {
        // Fallback to deterministic pseudo-waveform based on audioUrl hash
        const sampleBars = 120;
        const fakePeaks: number[] = [];
        let seed = 0;
        for (let i = 0; i < audioUrl.length; i++) {
          seed = (seed * 31 + audioUrl.charCodeAt(i)) % 10000;
        }
        for (let i = 0; i < sampleBars; i++) {
          const val = Math.abs(Math.sin((i + seed) * 0.18) * 0.6 + Math.cos(i * 0.4) * 0.3);
          fakePeaks.push(Math.max(0.15, Math.min(1.0, val)));
        }
        if (!isCancelled) {
          setPeaks(fakePeaks);
        }
      }
    };

    loadAudioPeaks();

    return () => {
      isCancelled = true;
    };
  }, [audioUrl]);

  // Draw waveform on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    if (peaks.length === 0) {
      // Empty waveform placeholder line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
      return;
    }

    const progressRatio = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;
    const barCount = peaks.length;
    const totalGap = 3;
    const barWidth = (width - (barCount - 1) * totalGap) / barCount;
    const centerY = height / 2;

    peaks.forEach((peak, index) => {
      const x = index * (barWidth + totalGap);
      const barHeight = peak * (height * 0.85);
      const barProgress = index / barCount;
      const isPlayed = barProgress <= progressRatio;

      ctx.beginPath();
      ctx.roundRect(x, centerY - barHeight / 2, barWidth, barHeight, 2);

      if (isPlayed) {
        // Electric Cyan active gradient
        const gradient = ctx.createLinearGradient(0, centerY - barHeight / 2, 0, centerY + barHeight / 2);
        gradient.addColorStop(0, '#00f0ff');
        gradient.addColorStop(1, '#0088ff');
        ctx.fillStyle = gradient;
        ctx.shadowColor = 'rgba(0, 240, 255, 0.4)';
        ctx.shadowBlur = 6;
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.shadowBlur = 0;
      }

      ctx.fill();
    });

    // Draw hover scrub line
    if (isHovering) {
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(hoverPosition, 0);
      ctx.lineTo(hoverPosition, height);
      ctx.stroke();
    }

  }, [peaks, currentTime, duration, isHovering, hoverPosition]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!duration || duration <= 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    onSeek(ratio * duration);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    setHoverPosition(e.clientX - rect.left);
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00.0';
    const mins = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 10);
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  return (
    <div className="waveform-section">
      <div className="waveform-canvas-container">
        <canvas
          ref={canvasRef}
          width={800}
          height={80}
          style={{ width: '100%', height: '100%', display: 'block' }}
          onClick={handleCanvasClick}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          onMouseMove={handleMouseMove}
        />
      </div>
      <div className="time-readout">
        {formatTime(currentTime)} / {formatTime(duration)}
      </div>
    </div>
  );
};
