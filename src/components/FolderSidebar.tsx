import React from 'react';
import { Folder, FolderPlus, RefreshCw, Star, Music, Layers, Volume2 } from 'lucide-react';

interface FolderSidebarProps {
  currentFolder: string | null;
  categories: { name: string; count: number }[];
  activeCategory: string;
  activeFormat: string;
  totalCount: number;
  favoritesCount: number;
  isScanning: boolean;
  onSelectFolder: () => void;
  onRescan: () => void;
  onSelectCategory: (category: string) => void;
  onSelectFormat: (format: string) => void;
}

export const FolderSidebar: React.FC<FolderSidebarProps> = ({
  currentFolder,
  categories,
  activeCategory,
  activeFormat,
  totalCount,
  favoritesCount,
  isScanning,
  onSelectFolder,
  onRescan,
  onSelectCategory,
  onSelectFormat
}) => {
  const formats = ['ALL', 'WAV', 'MP3', 'AIFF', 'FLAC', 'M4A'];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <button
          className="library-picker-btn"
          onClick={onSelectFolder}
          disabled={isScanning}
        >
          <FolderPlus size={16} />
          <span>{currentFolder ? 'Change Library Folder' : 'Choose SFX Library'}</span>
        </button>

        {currentFolder && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-muted)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontFamily: 'var(--font-mono)'
              }}
              title={currentFolder}
            >
              {currentFolder.split('/').pop() || currentFolder}
            </div>
            <button
              onClick={onRescan}
              disabled={isScanning}
              className="action-btn"
              style={{ padding: '3px 6px' }}
              title="Rescan directory for newly added audio files"
            >
              <RefreshCw size={12} className={isScanning ? 'spin' : ''} />
            </button>
          </div>
        )}
      </div>

      <div className="sidebar-nav">
        {/* Main Views */}
        <div className="nav-header">Library</div>

        <div
          className={`nav-item ${activeCategory === '__ALL__' ? 'active' : ''}`}
          onClick={() => onSelectCategory('__ALL__')}
        >
          <div className="nav-item-left">
            <Music size={15} />
            <span>All Sounds</span>
          </div>
          <span className="nav-count">{totalCount}</span>
        </div>

        <div
          className={`nav-item ${activeCategory === '__FAVORITES__' ? 'active' : ''}`}
          onClick={() => onSelectCategory('__FAVORITES__')}
        >
          <div className="nav-item-left">
            <Star size={15} color="#f59e0b" fill={activeCategory === '__FAVORITES__' ? '#f59e0b' : 'none'} />
            <span>Favorites</span>
          </div>
          <span className="nav-count">{favoritesCount}</span>
        </div>

        {/* Categories / Folders */}
        {categories.length > 0 && (
          <>
            <div className="nav-header" style={{ marginTop: 12 }}>
              Categories ({categories.length})
            </div>
            {categories.map((cat) => (
              <div
                key={cat.name}
                className={`nav-item ${activeCategory === cat.name ? 'active' : ''}`}
                onClick={() => onSelectCategory(cat.name)}
              >
                <div className="nav-item-left">
                  <Folder size={14} />
                  <span>{cat.name}</span>
                </div>
                <span className="nav-count">{cat.count}</span>
              </div>
            ))}
          </>
        )}

        {/* Format Filter */}
        <div className="nav-header" style={{ marginTop: 12 }}>
          Audio Format
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '4px 10px' }}>
          {formats.map((fmt) => (
            <button
              key={fmt}
              onClick={() => onSelectFormat(fmt)}
              style={{
                background: activeFormat === fmt ? 'var(--accent-cyan)' : 'var(--bg-surface-elevated)',
                color: activeFormat === fmt ? '#060911' : 'var(--text-secondary)',
                border: '1px solid',
                borderColor: activeFormat === fmt ? 'var(--accent-cyan)' : 'var(--border-subtle)',
                borderRadius: '4px',
                padding: '3px 7px',
                fontSize: '11px',
                fontWeight: 600,
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer'
              }}
            >
              {fmt}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
};
