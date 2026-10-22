import React from 'react';
import { Play, Pause, FolderOpen, Copy, Star, GripVertical, Sparkles } from 'lucide-react';
import { SoundFile, FXState } from '../types';
import { isFXActive, renderProcessedBlobUrl, exportProcessedSoundFile } from '../utils/audioFX';

interface SoundItemProps {
  sound: SoundFile;
  isSelected: boolean;
  isPlaying: boolean;
  isFavorite: boolean;
  fx: FXState;
  onSelect: (sound: SoundFile) => void;
  onTogglePlay: (sound: SoundFile) => void;
  onToggleFavorite: (soundId: string) => void;
  onNotify: (message: string) => void;
}

export const SoundItem: React.FC<SoundItemProps> = ({
  sound,
  isSelected,
  isPlaying,
  isFavorite,
  fx,
  onSelect,
  onTogglePlay,
  onToggleFavorite,
  onNotify
}) => {
  const fxActive = isFXActive(fx);
  const isMac = !window.electronAPI?.platform || window.electronAPI.platform === 'darwin';
  const revealLabel = isMac ? 'Finder' : 'Explorer';
  const pasteShortcut = isMac ? 'Cmd+V' : 'Ctrl+V';

  const handleDragStart = async (e: React.DragEvent) => {
    if (window.electronAPI?.isElectron) {
      e.preventDefault();

      if (fxActive) {
        try {
          const { wavBytes } = await renderProcessedBlobUrl(sound.streamUrl, fx);
          const processedPath = await exportProcessedSoundFile(sound.name, sound.path, wavBytes, fx);
          window.electronAPI.startDrag(processedPath);
          onNotify(`Dragging PROCESSED "${sound.name}" to Premiere / AE...`);
        } catch (err) {
          console.error(err);
          window.electronAPI.startDrag(sound.path);
        }
      } else {
        window.electronAPI.startDrag(sound.path);
        onNotify(`Dragging "${sound.name}" to Premiere / After Effects...`);
      }
    } else {
      e.dataTransfer.setData('text/plain', sound.path);
    }
  };

  const handleShowInFinder = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.electronAPI?.isElectron) {
      const ok = await window.electronAPI.showInFinder(sound.path);
      if (ok) {
        onNotify(`Revealed in ${revealLabel}: ${sound.filename}`);
      } else {
        onNotify(`Could not locate file on disk: ${sound.filename}`);
      }
    } else {
      try {
        const res = await fetch('/api/reveal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: sound.path })
        });
        const data = await res.json();
        if (data.ok) {
          onNotify(`Revealed in ${revealLabel}: ${sound.filename}`);
        } else {
          onNotify(`File path: ${sound.path}`);
        }
      } catch {
        onNotify(`File path: ${sound.path}`);
      }
    }
  };

  const handleCopyFile = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.electronAPI?.isElectron) {
      let pathToCopy = sound.path;
      if (fxActive) {
        try {
          const { wavBytes } = await renderProcessedBlobUrl(sound.streamUrl, fx);
          pathToCopy = await exportProcessedSoundFile(sound.name, sound.path, wavBytes, fx);
          await window.electronAPI.copyFileToClipboard(pathToCopy);
          onNotify(`Copied PROCESSED file! Press ${pasteShortcut} in Premiere or AE`);
          return;
        } catch (err) {
          console.error(err);
        }
      }

      await window.electronAPI.copyFileToClipboard(pathToCopy);
      onNotify(`Copied! Press ${pasteShortcut} in Premiere or AE to import`);
    } else {
      try {
        const res = await fetch('/api/copy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: sound.path })
        });
        const data = await res.json();
        if (data.ok) {
          onNotify(`Copied! Press ${pasteShortcut} in Premiere or AE to import`);
        } else {
          navigator.clipboard.writeText(sound.path);
          onNotify(`Copied file path to clipboard!`);
        }
      } catch {
        navigator.clipboard.writeText(sound.path);
        onNotify(`Copied file path to clipboard!`);
      }
    }
  };

  return (
    <div
      className={`sound-row ${isSelected ? 'selected' : ''} ${isPlaying ? 'playing' : ''}`}
      onClick={() => onSelect(sound)}
      onDoubleClick={() => onTogglePlay(sound)}
    >
      {/* Play/Pause Button */}
      <button
        className="row-play-btn"
        onClick={(e) => {
          e.stopPropagation();
          onTogglePlay(sound);
        }}
        title={isPlaying ? 'Pause' : 'Play (Double click or Spacebar)'}
      >
        {isPlaying ? <Pause size={14} /> : <Play size={14} style={{ marginLeft: 2 }} />}
      </button>

      {/* Name and Subcategory */}
      <div className="sound-name-col">
        <span className="sound-title" title={sound.name}>
          {sound.name}
        </span>
        <span className="sound-meta-sub" title={sound.subCategory}>
          {sound.subCategory}
        </span>
      </div>

      {/* Category Tag */}
      <div>
        <span className="badge-tag">{sound.category}</span>
      </div>

      {/* Format */}
      <div>
        <span className="format-badge">{sound.extension}</span>
      </div>

      {/* Size */}
      <div>
        <span className="size-text">{sound.sizeFormatted}</span>
      </div>

      {/* Action Buttons: Finder, Copy, Native Drag Handle */}
      <div className="action-buttons">
        {/* Favorite */}
        <button
          className="action-btn"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(sound.id);
          }}
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Star
            size={13}
            color={isFavorite ? '#f59e0b' : 'currentColor'}
            fill={isFavorite ? '#f59e0b' : 'none'}
          />
        </button>

        {/* Finder / Explorer Reveal */}
        <button
          className="action-btn finder-btn"
          onClick={handleShowInFinder}
          title={`Open & Highlight in ${isMac ? 'macOS Finder' : 'Windows Explorer'}`}
        >
          <FolderOpen size={13} />
          {revealLabel}
        </button>

        {/* Copy for Cmd+V */}
        <button
          className="action-btn copy-btn"
          onClick={handleCopyFile}
          title={fxActive ? 'Copy PROCESSED file for instant Cmd+V in Premiere / AE' : 'Copy file for instant Cmd+V in Premiere / AE'}
        >
          <Copy size={13} />
        </button>

        {/* Native OS Drag Handle to Premiere / After Effects */}
        <div
          className="drag-handle-badge"
          draggable="true"
          onDragStart={handleDragStart}
          title={
            fxActive
              ? 'Drag PROCESSED audio directly into Premiere Pro or After Effects'
              : 'Drag audio directly into Premiere Pro or After Effects'
          }
          style={{
            borderColor: fxActive ? 'var(--accent-cyan)' : undefined,
            background: fxActive
              ? 'linear-gradient(135deg, rgba(0, 240, 255, 0.28) 0%, rgba(168, 85, 247, 0.28) 100%)'
              : undefined
          }}
        >
          <GripVertical size={13} />
          <span>{fxActive ? 'DRAG FX' : 'DRAG'}</span>
        </div>
      </div>
    </div>
  );
};
