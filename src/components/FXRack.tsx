import React, { useState } from 'react';
import { 
  RotateCcw, 
  Dices, 
  SlidersHorizontal, 
  Sparkles, 
  Waves, 
  Radio, 
  VolumeX, 
  Compass, 
  X, 
  Flame,
  Zap,
  Clock
} from 'lucide-react';
import { FXState, FilterPreset, DEFAULT_FX_STATE } from '../types';
import { isFXActive } from '../utils/audioFX';

interface FXRackProps {
  fx: FXState;
  onChange: (fx: FXState) => void;
  onReset: () => void;
}

export const FXRack: React.FC<FXRackProps> = ({ fx, onChange, onReset }) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const active = isFXActive(fx);

  const toggleReverse = () => {
    onChange({ ...fx, reversed: !fx.reversed });
  };

  const toggleAntiRepetition = () => {
    onChange({ ...fx, antiRepetition: !fx.antiRepetition });
  };

  const toggleFadeIn = () => {
    onChange({ ...fx, fadeIn: !fx.fadeIn });
  };

  const toggleFadeOut = () => {
    onChange({ ...fx, fadeOut: !fx.fadeOut });
  };

  const setFilterPreset = (preset: FilterPreset) => {
    onChange({ ...fx, filterPreset: preset });
  };

  return (
    <div className="fx-rack-container">
      {/* Quick Action Ribbon */}
      <div className="fx-ribbon">
        <div className="fx-ribbon-left">
          <div className="fx-title-tag">
            <Sparkles size={13} color="var(--accent-cyan)" />
            <span>STUDIO FX</span>
          </div>

          {/* 1. Reverse Button */}
          <button
            className={`fx-chip-btn ${fx.reversed ? 'active' : ''}`}
            onClick={toggleReverse}
            title="Reverse Audio (creates reverse transitions and swells)"
          >
            <RotateCcw size={13} />
            <span>Reverse</span>
          </button>

          {/* 2. Anti-Repetition Randomizer */}
          <button
            className={`fx-chip-btn ${fx.antiRepetition ? 'active' : ''}`}
            onClick={toggleAntiRepetition}
            title="Randomize pitch variation so repeated gunshots/whooshes/clicks never sound identical"
          >
            <Dices size={14} />
            <span>Anti-Repeat</span>
          </button>

          {/* 3. Quick Fade In & Out */}
          <button
            className={`fx-chip-btn ${fx.fadeIn ? 'active' : ''}`}
            onClick={toggleFadeIn}
            title="Add smooth 120ms fade-in attack"
          >
            <span>Fade In</span>
          </button>

          <button
            className={`fx-chip-btn ${fx.fadeOut ? 'active' : ''}`}
            onClick={toggleFadeOut}
            title="Add smooth 250ms fade-out tail"
          >
            <span>Fade Out</span>
          </button>

          {/* 4. Filter Presets */}
          <div className="fx-preset-pills">
            <button
              className={`fx-pill ${fx.filterPreset === 'muffled' ? 'active' : ''}`}
              onClick={() => setFilterPreset(fx.filterPreset === 'muffled' ? 'none' : 'muffled')}
              title="Low-Pass Filter: Behind-the-wall / Underwater muffled sound"
            >
              <Waves size={12} />
              <span>Underwater</span>
            </button>

            <button
              className={`fx-pill ${fx.filterPreset === 'radio' ? 'active' : ''}`}
              onClick={() => setFilterPreset(fx.filterPreset === 'radio' ? 'none' : 'radio')}
              title="Band-Pass Filter: Walkie-talkie / Phone / Megaphone sound"
            >
              <Radio size={12} />
              <span>Radio</span>
            </button>

            <button
              className={`fx-pill ${fx.filterPreset === 'crisp' ? 'active' : ''}`}
              onClick={() => setFilterPreset(fx.filterPreset === 'crisp' ? 'none' : 'crisp')}
              title="High-Shelf Boost: Bright, airy presence"
            >
              <Zap size={12} />
              <span>Crisp</span>
            </button>
          </div>
        </div>

        {/* Ribbon Right: Expand Drawer & Reset */}
        <div className="fx-ribbon-right">
          {active && (
            <div className="fx-status-indicator">
              <span className="pulse-dot"></span>
              <span>PROCESSED AUDIO WILL BE DRAGGED</span>
            </div>
          )}

          {active && (
            <button className="fx-reset-btn" onClick={onReset} title="Reset all audio effects to neutral">
              <X size={12} />
              <span>Reset</span>
            </button>
          )}

          <button
            className={`fx-drawer-toggle ${isExpanded ? 'open' : ''}`}
            onClick={() => setIsExpanded(!isExpanded)}
            title="Open advanced FX controls (Pitch, Delay, Reverb, Distortion, Pan)"
          >
            <SlidersHorizontal size={13} />
            <span>{isExpanded ? 'Hide FX Rack' : 'FX Rack'}</span>
          </button>
        </div>
      </div>

      {/* Expandable Advanced Controls Panel */}
      {isExpanded && (
        <div className="fx-drawer-panel">
          {/* Pitch Shifter */}
          <div className="fx-control-card">
            <div className="fx-control-header">
              <span>PITCH SHIFT</span>
              <span className="fx-val-readout">
                {fx.pitchSemitones > 0 ? `+${fx.pitchSemitones}` : fx.pitchSemitones} st
              </span>
            </div>
            <input
              type="range"
              min="-12"
              max="12"
              step="1"
              value={fx.pitchSemitones}
              onChange={(e) => onChange({ ...fx, pitchSemitones: parseInt(e.target.value) })}
              className="fx-slider"
            />
            <div className="fx-slider-ticks">
              <span>-12</span>
              <span onClick={() => onChange({ ...fx, pitchSemitones: 0 })} style={{ cursor: 'pointer' }}>
                0
              </span>
              <span>+12</span>
            </div>
          </div>

          {/* Delay / Slapback Echo */}
          <div className="fx-control-card">
            <div className="fx-control-header">
              <span>ECHO / DELAY</span>
              <span className="fx-val-readout">{Math.round(fx.delayMix * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={fx.delayMix}
              onChange={(e) => onChange({ ...fx, delayMix: parseFloat(e.target.value) })}
              className="fx-slider"
            />
            <div className="fx-slider-ticks">
              <span>Dry</span>
              <span>50%</span>
              <span>Wet</span>
            </div>
          </div>

          {/* Cavern Reverb Space */}
          <div className="fx-control-card">
            <div className="fx-control-header">
              <span>REVERB SPACE</span>
              <span className="fx-val-readout">{Math.round(fx.reverbMix * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={fx.reverbMix}
              onChange={(e) => onChange({ ...fx, reverbMix: parseFloat(e.target.value) })}
              className="fx-slider"
            />
            <div className="fx-slider-ticks">
              <span>Dry</span>
              <span>Room</span>
              <span>Hall</span>
            </div>
          </div>

          {/* Distortion / Crunch */}
          <div className="fx-control-card">
            <div className="fx-control-header">
              <span>WARMTH & GRIT</span>
              <span className="fx-val-readout">{Math.round(fx.distortion * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={fx.distortion}
              onChange={(e) => onChange({ ...fx, distortion: parseFloat(e.target.value) })}
              className="fx-slider"
            />
            <div className="fx-slider-ticks">
              <span>Clean</span>
              <span>Warm</span>
              <span>Drive</span>
            </div>
          </div>

          {/* Stereo Panning */}
          <div className="fx-control-card">
            <div className="fx-control-header">
              <span>STEREO PAN</span>
              <span className="fx-val-readout">
                {fx.pan < -0.05 ? `${Math.round(Math.abs(fx.pan) * 100)}% L` : fx.pan > 0.05 ? `${Math.round(fx.pan * 100)}% R` : 'Center'}
              </span>
            </div>
            <input
              type="range"
              min="-1"
              max="1"
              step="0.1"
              value={fx.pan}
              onChange={(e) => onChange({ ...fx, pan: parseFloat(e.target.value) })}
              className="fx-slider"
            />
            <div className="fx-slider-ticks">
              <span>Left</span>
              <span onClick={() => onChange({ ...fx, pan: 0 })} style={{ cursor: 'pointer' }}>
                Center
              </span>
              <span>Right</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
