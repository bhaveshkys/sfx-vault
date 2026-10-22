import { FXState, DEFAULT_FX_STATE } from '../types';

/**
 * Checks if any audio effect is currently active
 */
export function isFXActive(fx: FXState): boolean {
  return (
    fx.reversed ||
    fx.pitchSemitones !== 0 ||
    fx.antiRepetition ||
    fx.fadeIn ||
    fx.fadeOut ||
    fx.filterPreset !== 'none' ||
    fx.delayMix > 0.05 ||
    fx.reverbMix > 0.05 ||
    fx.distortion > 0.05 ||
    Math.abs(fx.pan) > 0.05
  );
}

/**
 * Generates an algorithmic impulse response for smooth stereo reverb
 */
function createReverbImpulse(ctx: BaseAudioContext, duration = 1.8, decay = 2.2): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * duration);
  const impulse = ctx.createBuffer(2, length, sampleRate);
  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);

  for (let i = 0; i < length; i++) {
    const t = i / length;
    const factor = Math.exp(-t * decay);
    left[i] = (Math.random() * 2 - 1) * factor;
    right[i] = (Math.random() * 2 - 1) * factor;
  }
  return impulse;
}

/**
 * Creates a distortion curve for analog warmth & grit
 */
function createDistortionCurve(amount = 25, samples = 44100): Float32Array {
  const curve = new Float32Array(samples);
  const deg = Math.PI / 180;
  const k = Math.max(1, amount * 50);

  for (let i = 0; i < samples; ++i) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

/**
 * High-speed offline rendering of processed audio buffer with all effects
 */
export async function renderProcessedAudio(
  sourceBuffer: AudioBuffer,
  fx: FXState
): Promise<AudioBuffer> {
  // Compute effective pitch shift in semitones
  let effectiveSemitones = fx.pitchSemitones;
  if (fx.antiRepetition) {
    // Generate organic micro-variance (e.g. -1.8 to +1.8 semitones)
    const randomShift = (Math.random() * 3.6 - 1.8);
    effectiveSemitones += randomShift;
  }

  const playbackRate = Math.pow(2, effectiveSemitones / 12);

  // Calculate new duration
  let baseDuration = sourceBuffer.duration / playbackRate;
  // Add tail time if delay or reverb are active
  const tailTime = fx.reverbMix > 0.05 || fx.delayMix > 0.05 ? 1.5 : 0.05;
  const renderDuration = Math.min(60, baseDuration + tailTime);

  const sampleRate = sourceBuffer.sampleRate;
  const offlineCtx = new OfflineAudioContext(
    2,
    Math.ceil(renderDuration * sampleRate),
    sampleRate
  );

  // Prepare Source Buffer (Reverse if enabled)
  let preparedBuffer = sourceBuffer;
  if (fx.reversed) {
    preparedBuffer = offlineCtx.createBuffer(
      sourceBuffer.numberOfChannels,
      sourceBuffer.length,
      sourceBuffer.sampleRate
    );
    for (let c = 0; c < sourceBuffer.numberOfChannels; c++) {
      const srcData = sourceBuffer.getChannelData(c);
      const destData = preparedBuffer.getChannelData(c);
      for (let i = 0; i < srcData.length; i++) {
        destData[i] = srcData[srcData.length - 1 - i];
      }
    }
  }

  const sourceNode = offlineCtx.createBufferSource();
  sourceNode.buffer = preparedBuffer;
  sourceNode.playbackRate.value = playbackRate;

  // Master Chain input
  let lastNode: AudioNode = sourceNode;

  // 1. Fade In / Fade Out Envelopes
  if (fx.fadeIn || fx.fadeOut) {
    const fadeGain = offlineCtx.createGain();
    const startTime = 0;
    const endTime = baseDuration;

    if (fx.fadeIn) {
      fadeGain.gain.setValueAtTime(0.0001, startTime);
      fadeGain.gain.exponentialRampToValueAtTime(1.0, startTime + 0.12);
    } else {
      fadeGain.gain.setValueAtTime(1.0, startTime);
    }

    if (fx.fadeOut) {
      fadeGain.gain.setValueAtTime(1.0, Math.max(startTime + 0.05, endTime - 0.25));
      fadeGain.gain.exponentialRampToValueAtTime(0.0001, endTime);
    }

    lastNode.connect(fadeGain);
    lastNode = fadeGain;
  }

  // 2. Frequency Filters (Underwater / Muffled, Radio, Crisp)
  if (fx.filterPreset !== 'none') {
    if (fx.filterPreset === 'muffled') {
      const lp = offlineCtx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 750;
      lp.Q.value = 1.2;
      lastNode.connect(lp);
      lastNode = lp;
    } else if (fx.filterPreset === 'radio') {
      const bp = offlineCtx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1400;
      bp.Q.value = 2.2;
      lastNode.connect(bp);
      lastNode = bp;
    } else if (fx.filterPreset === 'crisp') {
      const hs = offlineCtx.createBiquadFilter();
      hs.type = 'highshelf';
      hs.frequency.value = 3200;
      hs.gain.value = 6.0;
      lastNode.connect(hs);
      lastNode = hs;
    }
  }

  // 3. Distortion / Drive
  if (fx.distortion > 0.05) {
    const shaper = offlineCtx.createWaveShaper();
    shaper.curve = createDistortionCurve(fx.distortion) as unknown as Float32Array<ArrayBuffer>;
    shaper.oversample = '4x';
    lastNode.connect(shaper);
    lastNode = shaper;
  }

  // 4. Stereo Delay & Echo
  if (fx.delayMix > 0.05) {
    const dryGain = offlineCtx.createGain();
    const wetGain = offlineCtx.createGain();
    const delay = offlineCtx.createDelay(1.0);
    const feedback = offlineCtx.createGain();

    delay.delayTime.value = 0.22; // 220ms slapback
    feedback.gain.value = 0.38;

    dryGain.gain.value = 1 - fx.delayMix * 0.5;
    wetGain.gain.value = fx.delayMix * 0.7;

    lastNode.connect(dryGain);
    lastNode.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wetGain);

    const delaySummer = offlineCtx.createGain();
    dryGain.connect(delaySummer);
    wetGain.connect(delaySummer);
    lastNode = delaySummer;
  }

  // 5. Algorithmic Reverb Space
  if (fx.reverbMix > 0.05) {
    const dryGain = offlineCtx.createGain();
    const wetGain = offlineCtx.createGain();
    const convolver = offlineCtx.createConvolver();

    convolver.buffer = createReverbImpulse(offlineCtx, 1.8, 2.0);
    dryGain.gain.value = 1 - fx.reverbMix * 0.4;
    wetGain.gain.value = fx.reverbMix * 0.65;

    lastNode.connect(dryGain);
    lastNode.connect(convolver);
    convolver.connect(wetGain);

    const reverbSummer = offlineCtx.createGain();
    dryGain.connect(reverbSummer);
    wetGain.connect(reverbSummer);
    lastNode = reverbSummer;
  }

  // 6. Stereo Panning
  if (Math.abs(fx.pan) > 0.05 && offlineCtx.createStereoPanner) {
    const panner = offlineCtx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, fx.pan));
    lastNode.connect(panner);
    lastNode = panner;
  }

  // Connect to offline destination
  lastNode.connect(offlineCtx.destination);
  sourceNode.start(0);

  return offlineCtx.startRendering();
}

/**
 * Encodes an AudioBuffer into an uncompressed 16-bit 48kHz WAV ArrayBuffer
 */
export function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const numSamples = buffer.length * numChannels;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * bytesPerSample;
  const totalSize = 44 + dataSize;

  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  // RIFF Chunk
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');

  // fmt Subchunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, format, true); // AudioFormat
  view.setUint16(22, numChannels, true); // NumChannels
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, byteRate, true); // ByteRate
  view.setUint16(32, blockAlign, true); // BlockAlign
  view.setUint16(34, bitDepth, true); // BitsPerSample

  // data Subchunk
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleave audio samples into 16-bit PCM
  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i] || 0));
      const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, int16, true);
      offset += 2;
    }
  }

  return arrayBuffer;
}

/**
 * Renders audio with effects into an in-memory WAV Blob URL for live auditioning & waveform
 */
export async function renderProcessedBlobUrl(
  streamUrl: string,
  fx: FXState
): Promise<{ blobUrl: string; buffer: AudioBuffer; wavBytes: ArrayBuffer }> {
  const response = await fetch(streamUrl);
  const arrayBuffer = await response.arrayBuffer();
  const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  const decoded = await audioCtx.decodeAudioData(arrayBuffer);

  const rendered = await renderProcessedAudio(decoded, fx);
  const wavBytes = audioBufferToWav(rendered);
  const blob = new Blob([wavBytes], { type: 'audio/wav' });
  const blobUrl = URL.createObjectURL(blob);

  return { blobUrl, buffer: rendered, wavBytes };
}

/**
 * Saves rendered audio buffer to disk via Electron IPC and returns absolute file path
 */
export async function exportProcessedSoundFile(
  soundName: string,
  originalPath: string,
  wavBytes: ArrayBuffer,
  fx: FXState
): Promise<string> {
  const tags: string[] = [];
  if (fx.reversed) tags.push('REV');
  if (fx.pitchSemitones !== 0) tags.push(`PITCH${fx.pitchSemitones > 0 ? '+' : ''}${fx.pitchSemitones}`);
  if (fx.antiRepetition) tags.push('VAR');
  if (fx.filterPreset !== 'none') tags.push(fx.filterPreset.toUpperCase());
  if (fx.delayMix > 0.05) tags.push('ECHO');
  if (fx.reverbMix > 0.05) tags.push('VERB');

  const tagStr = tags.length > 0 ? `_${tags.join('_')}` : '_FX';
  const outFilename = `${soundName}${tagStr}.wav`;

  if (window.electronAPI?.saveProcessedWav) {
    return await window.electronAPI.saveProcessedWav(outFilename, wavBytes);
  }
  return originalPath;
}
