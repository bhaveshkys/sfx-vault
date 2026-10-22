import React, { useState, useEffect, useMemo } from 'react';
import { Search, FolderPlus, Sparkles, Music, Volume2, Film, CheckCircle2, X } from 'lucide-react';
import { SoundFile, FXState, DEFAULT_FX_STATE } from './types';
import { FolderSidebar } from './components/FolderSidebar';
import { SoundItem } from './components/SoundItem';
import { FXRack } from './components/FXRack';
import { AudioPlayer } from './components/AudioPlayer';

// Built-in synthetic demo sounds for immediate testing & preview
const DEMO_SOUNDS: SoundFile[] = [
  {
    id: 'demo-1',
    name: 'Cinematic Whoosh Transition Heavy',
    filename: 'Cinematic_Whoosh_Heavy.wav',
    path: '/Users/bhaveshsharma/Library/Audio/Sounds/Transitions/Cinematic_Whoosh_Heavy.wav',
    streamUrl: 'https://cdn.freesound.org/previews/612/612610_5674468-lq.mp3',
    size: 2450000,
    sizeFormatted: '2.4 MB',
    extension: 'WAV',
    category: 'Transitions',
    subCategory: 'Transitions/Whoosh',
    folderPath: '/Users/bhaveshsharma/Library/Audio/Sounds/Transitions',
    modified: Date.now() - 3600000
  },
  {
    id: 'demo-2',
    name: 'Deep Sub Impact Boom',
    filename: 'Deep_Sub_Impact_Boom.wav',
    path: '/Users/bhaveshsharma/Library/Audio/Sounds/Impacts/Deep_Sub_Impact_Boom.wav',
    streamUrl: 'https://cdn.freesound.org/previews/387/387232_1474204-lq.mp3',
    size: 4120000,
    sizeFormatted: '4.1 MB',
    extension: 'WAV',
    category: 'Impacts',
    subCategory: 'Impacts/Sub',
    folderPath: '/Users/bhaveshsharma/Library/Audio/Sounds/Impacts',
    modified: Date.now() - 7200000
  },
  {
    id: 'demo-3',
    name: 'Cyberpunk UI Glitch Beep',
    filename: 'Cyberpunk_UI_Glitch.mp3',
    path: '/Users/bhaveshsharma/Library/Audio/Sounds/UI/Cyberpunk_UI_Glitch.mp3',
    streamUrl: 'https://cdn.freesound.org/previews/274/274178_4387819-lq.mp3',
    size: 780000,
    sizeFormatted: '780 KB',
    extension: 'MP3',
    category: 'UI',
    subCategory: 'UI/SciFi',
    folderPath: '/Users/bhaveshsharma/Library/Audio/Sounds/UI',
    modified: Date.now() - 12000000
  },
  {
    id: 'demo-4',
    name: 'Cinematic Tension Drone Ambience',
    filename: 'Tension_Drone_Ambience.wav',
    path: '/Users/bhaveshsharma/Library/Audio/Sounds/Ambience/Tension_Drone_Ambience.wav',
    streamUrl: 'https://cdn.freesound.org/previews/566/566435_6890478-lq.mp3',
    size: 8900000,
    sizeFormatted: '8.9 MB',
    extension: 'WAV',
    category: 'Ambience',
    subCategory: 'Ambience/Drones',
    folderPath: '/Users/bhaveshsharma/Library/Audio/Sounds/Ambience',
    modified: Date.now() - 15000000
  },
  {
    id: 'demo-5',
    name: 'Mechanical Camera Shutter Click',
    filename: 'Camera_Shutter_Click.wav',
    path: '/Users/bhaveshsharma/Library/Audio/Sounds/Foley/Camera_Shutter_Click.wav',
    streamUrl: 'https://cdn.freesound.org/previews/240/240209_4056007-lq.mp3',
    size: 520000,
    sizeFormatted: '520 KB',
    extension: 'WAV',
    category: 'Foley',
    subCategory: 'Foley/Mechanical',
    folderPath: '/Users/bhaveshsharma/Library/Audio/Sounds/Foley',
    modified: Date.now() - 25000000
  },
  {
    id: 'demo-6',
    name: 'Fast Swish Swoosh Accent',
    filename: 'Fast_Swish_Swoosh.wav',
    path: '/Users/bhaveshsharma/Library/Audio/Sounds/Transitions/Fast_Swish_Swoosh.wav',
    streamUrl: 'https://cdn.freesound.org/previews/608/608645_11861866-lq.mp3',
    size: 1100000,
    sizeFormatted: '1.1 MB',
    extension: 'WAV',
    category: 'Transitions',
    subCategory: 'Transitions/Fast',
    folderPath: '/Users/bhaveshsharma/Library/Audio/Sounds/Transitions',
    modified: Date.now() - 30000000
  }
];

export const App: React.FC = () => {
  const [sounds, setSounds] = useState<SoundFile[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>('__ALL__');
  const [activeFormat, setActiveFormat] = useState<string>('ALL');
  const [selectedSound, setSelectedSound] = useState<SoundFile | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('sfx_favorites');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [notification, setNotification] = useState<string | null>(null);
  const [fxState, setFxState] = useState<FXState>(DEFAULT_FX_STATE);

  // Show notification toast
  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification((curr) => (curr === msg ? null : curr));
    }, 3200);
  };

  const isMac = !window.electronAPI?.platform || window.electronAPI.platform === 'darwin';
  const DEFAULT_SFX_FOLDER = isMac ? '/Users/bhaveshsharma/Projects/SFX Pack' : '';
  const [visibleCount, setVisibleCount] = useState<number>(80);

  // Restore previous library folder on startup or use default SFX pack
  useEffect(() => {
    const savedFolder = localStorage.getItem('sfx_last_folder') || DEFAULT_SFX_FOLDER;
    if (!savedFolder) {
      setSounds(DEMO_SOUNDS);
      setSelectedSound(DEMO_SOUNDS[0]);
      return;
    }

    setCurrentFolder(savedFolder);
    setIsScanning(true);

    if (window.electronAPI?.isElectron) {
      window.electronAPI
        .rescanFolder(savedFolder)
        .then((files) => {
          if (files && files.length > 0) {
            setSounds(files);
            setSelectedSound(files[0]);
            showNotification(`Loaded ${files.length} SFX from ${savedFolder.split('/').pop()}`);
          } else {
            setSounds(DEMO_SOUNDS);
            setSelectedSound(DEMO_SOUNDS[0]);
          }
        })
        .catch((err) => {
          console.error(err);
          setSounds(DEMO_SOUNDS);
        })
        .finally(() => setIsScanning(false));
    } else {
      // Browser companion scan
      fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath: savedFolder })
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.files && data.files.length > 0) {
            setSounds(data.files);
            setSelectedSound(data.files[0]);
            showNotification(`Loaded ${data.files.length} SFX from ${savedFolder.split('/').pop()}`);
          } else {
            setSounds(DEMO_SOUNDS);
            setSelectedSound(DEMO_SOUNDS[0]);
          }
        })
        .catch((err) => {
          console.error(err);
          setSounds(DEMO_SOUNDS);
        })
        .finally(() => setIsScanning(false));
    }
  }, []);

  // Save favorites to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('sfx_favorites', JSON.stringify(Array.from(favorites)));
    } catch (err) {
      console.error(err);
    }
  }, [favorites]);

  // Handle Pick Library Folder
  const handleSelectFolder = async () => {
    if (window.electronAPI?.isElectron) {
      setIsScanning(true);
      try {
        const result = await window.electronAPI.selectLibraryFolder();
        if (result && result.files) {
          setCurrentFolder(result.folderPath);
          setSounds(result.files);
          if (result.files.length > 0) {
            setSelectedSound(result.files[0]);
          }
          localStorage.setItem('sfx_last_folder', result.folderPath);
          showNotification(`Scanned ${result.files.length} SFX files!`);
        }
      } catch (err) {
        console.error('Error selecting folder:', err);
      } finally {
        setIsScanning(false);
      }
    } else {
      // In browser / PWA mode, prompt for directory path on local machine
      const folderPath = window.prompt(
        'Enter absolute path to your SFX library folder on macOS:\n(e.g. /Users/bhaveshsharma/Music or /Users/bhaveshsharma/Downloads/SFX)',
        currentFolder || '/Users/bhaveshsharma'
      );
      if (!folderPath) return;

      setIsScanning(true);
      try {
        const res = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folderPath })
        });
        const data = await res.json();
        if (data.files && data.files.length > 0) {
          setCurrentFolder(folderPath);
          setSounds(data.files);
          setSelectedSound(data.files[0]);
          localStorage.setItem('sfx_last_folder', folderPath);
          showNotification(`Scanned ${data.files.length} SFX files!`);
        } else {
          showNotification(`No audio files found in ${folderPath}`);
        }
      } catch (err) {
        console.error(err);
        showNotification('Error scanning directory');
      } finally {
        setIsScanning(false);
      }
    }
  };

  // Rescan existing folder
  const handleRescan = async () => {
    if (!currentFolder) return;
    setIsScanning(true);
    if (window.electronAPI?.isElectron) {
      try {
        const files = await window.electronAPI.rescanFolder(currentFolder);
        setSounds(files);
        showNotification(`Rescanned: ${files.length} sounds found.`);
      } catch (err) {
        console.error(err);
      } finally {
        setIsScanning(false);
      }
    } else {
      try {
        const res = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folderPath: currentFolder })
        });
        const data = await res.json();
        if (data.files) {
          setSounds(data.files);
          showNotification(`Rescanned: ${data.files.length} sounds found.`);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsScanning(false);
      }
    }
  };

  // Toggle favorite
  const handleToggleFavorite = (soundId: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(soundId)) {
        next.delete(soundId);
      } else {
        next.add(soundId);
      }
      return next;
    });
  };

  // Sound selection and play toggle
  const handleSelectSound = (sound: SoundFile) => {
    if (selectedSound?.id === sound.id) {
      setIsPlaying(!isPlaying);
    } else {
      setSelectedSound(sound);
      setIsPlaying(true);
    }
  };

  const handleTogglePlay = (sound?: SoundFile) => {
    if (sound && selectedSound?.id !== sound.id) {
      setSelectedSound(sound);
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  // Compute Categories from sound files
  const categories = useMemo(() => {
    const map = new Map<string, number>();
    sounds.forEach((s) => {
      const cat = s.category || 'General';
      map.set(cat, (map.get(cat) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [sounds]);

  // Filtered sounds list
  const filteredSounds = useMemo(() => {
    let list = sounds;

    // Category / Favorites filter
    if (activeCategory === '__FAVORITES__') {
      list = list.filter((s) => favorites.has(s.id));
    } else if (activeCategory !== '__ALL__') {
      list = list.filter((s) => s.category === activeCategory);
    }

    // Format filter
    if (activeFormat !== 'ALL') {
      list = list.filter((s) => s.extension.toUpperCase() === activeFormat);
    }

    // Search query filter
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q) ||
          s.subCategory.toLowerCase().includes(q) ||
          s.extension.toLowerCase().includes(q)
      );
    }

    return list;
  }, [sounds, activeCategory, activeFormat, searchQuery, favorites]);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(80);
  }, [searchQuery, activeCategory, activeFormat]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 400) {
      setVisibleCount((prev) => Math.min(prev + 60, filteredSounds.length));
    }
  };

  // Navigation: Next / Prev
  const handleNext = () => {
    if (filteredSounds.length === 0) return;
    const currentIndex = filteredSounds.findIndex((s) => s.id === selectedSound?.id);
    const nextIndex = currentIndex >= 0 && currentIndex < filteredSounds.length - 1 ? currentIndex + 1 : 0;
    setSelectedSound(filteredSounds[nextIndex]);
    setIsPlaying(true);
  };

  const handlePrev = () => {
    if (filteredSounds.length === 0) return;
    const currentIndex = filteredSounds.findIndex((s) => s.id === selectedSound?.id);
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : filteredSounds.length - 1;
    setSelectedSound(filteredSounds[prevIndex]);
    setIsPlaying(true);
  };

  return (
    <div className="app-layout">
      {/* Titlebar with dynamic macOS vs Windows Controls Padding */}
      <header className={`titlebar ${isMac ? 'mac' : 'win'}`}>
        <div className="titlebar-center">
          <Film size={15} color="var(--accent-cyan)" />
          <span>SFX VAULT</span>
          <span className="titlebar-badge">PREMIERE & AE READY</span>
        </div>
        <div className="titlebar-actions">
          {currentFolder ? (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {currentFolder}
            </span>
          ) : (
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Demo Mode</span>
          )}
        </div>
      </header>

      {/* Main Split Interface */}
      <div className="main-content">
        {/* Left Library & Category Sidebar */}
        <FolderSidebar
          currentFolder={currentFolder}
          categories={categories}
          activeCategory={activeCategory}
          activeFormat={activeFormat}
          totalCount={sounds.length}
          favoritesCount={sounds.filter((s) => favorites.has(s.id)).length}
          isScanning={isScanning}
          onSelectFolder={handleSelectFolder}
          onRescan={handleRescan}
          onSelectCategory={setActiveCategory}
          onSelectFormat={setActiveFormat}
        />

        {/* Center Sound Browser */}
        <main className="browser-view">
          {/* Top Search & Stats Toolbar */}
          <div className="toolbar">
            <div className="search-box">
              <Search className="search-icon" size={15} />
              <input
                type="text"
                className="search-input"
                placeholder="Search sounds (e.g. whoosh, impact, sub, foley, glitch)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="search-clear" onClick={() => setSearchQuery('')}>
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="toolbar-stats">
              <div className="stat-pill">
                <span>{filteredSounds.length}</span>
                <span style={{ color: 'var(--text-muted)' }}>of {sounds.length} sounds</span>
              </div>
            </div>
          </div>

          {/* Sound Table */}
          <div className="sound-list-container" onScroll={handleScroll}>
            {filteredSounds.length > 0 ? (
              <>
                <div className="sound-table-header">
                  <span>PLAY</span>
                  <span>NAME & SUBCATEGORY</span>
                  <span>CATEGORY</span>
                  <span>FORMAT</span>
                  <span>SIZE</span>
                  <span style={{ textAlign: 'right' }}>ACTIONS / DRAG</span>
                </div>

                {filteredSounds.slice(0, visibleCount).map((sound) => (
                  <SoundItem
                    key={sound.id}
                    sound={sound}
                    isSelected={selectedSound?.id === sound.id}
                    isPlaying={isPlaying && selectedSound?.id === sound.id}
                    isFavorite={favorites.has(sound.id)}
                    fx={fxState}
                    onSelect={handleSelectSound}
                    onTogglePlay={() => handleTogglePlay(sound)}
                    onToggleFavorite={handleToggleFavorite}
                    onNotify={showNotification}
                  />
                ))}

                {filteredSounds.length > visibleCount && (
                  <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)', fontSize: 12 }}>
                    Showing {visibleCount} of {filteredSounds.length} sounds (scroll down to load more)
                  </div>
                )}
              </>
            ) : (
              <div className="empty-library-state">
                <div className="empty-icon-circle">
                  <Volume2 size={32} />
                </div>
                <h3 className="empty-title">No Audio Files Found</h3>
                <p className="empty-desc">
                  {searchQuery
                    ? `No sound effects match "${searchQuery}". Try a different keyword.`
                    : 'Choose your SFX folder on your Mac to scan all WAV, MP3, AAC, and AIFF audio files.'}
                </p>
                <button className="library-picker-btn" onClick={handleSelectFolder}>
                  <FolderPlus size={16} />
                  <span>Choose SFX Folder</span>
                </button>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Studio FX Rack with Reverse, Pitch, Anti-Repetition, Delay, Reverb, Filters */}
      <FXRack
        fx={fxState}
        onChange={setFxState}
        onReset={() => setFxState(DEFAULT_FX_STATE)}
      />

      {/* Persistent Audio Player & Waveform Deck */}
      <AudioPlayer
        currentSound={selectedSound}
        isPlaying={isPlaying}
        fx={fxState}
        onTogglePlay={() => handleTogglePlay()}
        onNext={handleNext}
        onPrev={handlePrev}
        onNotify={showNotification}
      />

      {/* Floating Action Toast */}
      {notification && (
        <div className="toast-notice">
          <CheckCircle2 size={16} color="var(--accent-cyan)" />
          <span>{notification}</span>
        </div>
      )}
    </div>
  );
};
