export interface SoundFile {
  id: string;
  name: string;
  filename: string;
  path: string;
  streamUrl: string;
  size: number;
  sizeFormatted: string;
  extension: string;
  category: string;
  subCategory: string;
  folderPath: string;
  modified: number;
  duration?: number;
  isFavorite?: boolean;
}

export type FilterPreset = 'none' | 'muffled' | 'radio' | 'crisp';

export interface FXState {
  reversed: boolean;
  pitchSemitones: number; // -12 to +12 semitones
  antiRepetition: boolean; // automatically detunes micro-pitch to prevent repetition
  fadeIn: boolean; // 120ms smooth attack
  fadeOut: boolean; // 250ms smooth tail
  filterPreset: FilterPreset; // EQ shaping
  delayMix: number; // 0 to 1 (Echo tail)
  reverbMix: number; // 0 to 1 (Cavernous space)
  distortion: number; // 0 to 1 (Saturation / Drive)
  pan: number; // -1 (Left) to +1 (Right)
}

export const DEFAULT_FX_STATE: FXState = {
  reversed: false,
  pitchSemitones: 0,
  antiRepetition: false,
  fadeIn: false,
  fadeOut: false,
  filterPreset: 'none',
  delayMix: 0,
  reverbMix: 0,
  distortion: 0,
  pan: 0
};

export interface ElectronAPI {
  isElectron: boolean;
  platform?: string; // 'darwin' | 'win32' | 'linux'
  selectLibraryFolder: () => Promise<{ folderPath: string; files: SoundFile[] } | null>;
  rescanFolder: (folderPath: string) => Promise<SoundFile[]>;
  showInFinder: (filePath: string) => Promise<boolean>;
  openFile: (filePath: string) => Promise<boolean>;
  copyFileToClipboard: (filePath: string) => Promise<boolean>;
  startDrag: (filePath: string) => void;
  saveProcessedWav: (filename: string, buffer: ArrayBuffer) => Promise<string>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
