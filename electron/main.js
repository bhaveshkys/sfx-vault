const { app, BrowserWindow, ipcMain, dialog, shell, protocol, net, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { pathToFileURL } = require('url');

// Supported audio extensions
const AUDIO_EXTENSIONS = new Set(['.wav', '.mp3', '.ogg', '.flac', '.aif', '.aiff', '.m4a', '.aac']);

let mainWindow;

// Register custom scheme as privileged BEFORE app is ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'sfx',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true,
      corsEnabled: true
    }
  }
]);

const MIME_TYPES = {
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
  '.aif': 'audio/x-aiff',
  '.aiff': 'audio/x-aiff',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac'
};

// Register custom protocol for streaming local audio files with HTTP 206 Range support
function registerAudioProtocol() {
  protocol.handle('sfx', (request) => {
    try {
      let rawPath = request.url.replace(/^sfx:\/+/i, '');
      let filePath = decodeURIComponent(rawPath);
      if (process.platform === 'win32') {
        filePath = filePath.replace(/^\/+/, '');
      } else {
        if (!filePath.startsWith('/')) {
          filePath = '/' + filePath;
        }
      }
      filePath = path.normalize(filePath);
      if (!fs.existsSync(filePath)) {
        console.error('SFX File not found:', filePath);
        return new Response('File not found', { status: 404 });
      }

      const stat = fs.statSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mimeType = MIME_TYPES[ext] || 'audio/mpeg';

      const rangeHeader = request.headers.get('range');
      if (rangeHeader) {
        const parts = rangeHeader.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
        const chunkSize = end - start + 1;

        const nodeStream = fs.createReadStream(filePath, { start, end });
        const webStream = new ReadableStream({
          start(controller) {
            nodeStream.on('data', (chunk) => controller.enqueue(chunk));
            nodeStream.on('end', () => controller.close());
            nodeStream.on('error', (err) => controller.error(err));
          },
          cancel() {
            nodeStream.destroy();
          }
        });

        return new Response(webStream, {
          status: 206,
          headers: {
            'Content-Range': `bytes ${start}-${end}/${stat.size}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': String(chunkSize),
            'Content-Type': mimeType
          }
        });
      }

      const nodeStream = fs.createReadStream(filePath);
      const webStream = new ReadableStream({
        start(controller) {
          nodeStream.on('data', (chunk) => controller.enqueue(chunk));
          nodeStream.on('end', () => controller.close());
          nodeStream.on('error', (err) => controller.error(err));
        },
        cancel() {
          nodeStream.destroy();
        }
      });

      return new Response(webStream, {
        status: 200,
        headers: {
          'Content-Length': String(stat.size),
          'Content-Type': mimeType,
          'Accept-Ranges': 'bytes'
        }
      });
    } catch (err) {
      console.error('Failed to load sfx protocol file:', err);
      return new Response('File not found', { status: 404 });
    }
  });
}

function createWindow() {
  const isMac = process.platform === 'darwin';
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 850,
    minWidth: 1000,
    minHeight: 650,
    titleBarStyle: isMac ? 'hiddenInset' : 'default', // Sleek traffic lights on Mac, native window frame on Windows
    autoHideMenuBar: true, // Clean studio look on Windows
    backgroundColor: '#0c0e14',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false // Allows smooth local audio buffer reading and waveform rendering
    }
  });

  const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

// Create a valid macOS NativeImage drag preview icon
function getDragIcon() {
  const iconPath = path.join(__dirname, 'drag-icon.png');
  if (fs.existsSync(iconPath)) {
    try {
      const img = nativeImage.createFromPath(iconPath);
      if (!img.isEmpty()) return img;
    } catch (e) {
      console.warn('Could not create nativeImage from file:', e);
    }
  }
  // Safe 1x1 base64 PNG fallback
  return nativeImage.createFromBuffer(
    Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')
  );
}

// Recursively scan directory for audio files
function scanDirectory(dirPath, rootPath = dirPath) {
  const results = [];
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      // Skip hidden files and common noise folders
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '__MACOSX') {
        continue;
      }

      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        results.push(...scanDirectory(fullPath, rootPath));
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (AUDIO_EXTENSIONS.has(ext)) {
          const stats = fs.statSync(fullPath);
          const relativeDir = path.relative(rootPath, dirPath);
          const category = relativeDir && relativeDir !== '' ? relativeDir.split(path.sep)[0] : 'General';
          const subCategory = relativeDir && relativeDir !== '' ? relativeDir.replace(/\\/g, '/') : 'General';

          results.push({
            id: Buffer.from(fullPath).toString('base64'),
            name: path.basename(entry.name, ext),
            filename: entry.name,
            path: fullPath,
            streamUrl: `sfx://${encodeURI(fullPath.replace(/\\/g, '/'))}`,
            size: stats.size,
            sizeFormatted: formatBytes(stats.size),
            extension: ext.replace('.', '').toUpperCase(),
            category: category,
            subCategory: subCategory,
            folderPath: dirPath,
            modified: stats.mtimeMs
          });
        }
      }
    }
  } catch (err) {
    console.error('Error scanning dir:', dirPath, err);
  }
  return results;
}

function formatBytes(bytes, decimals = 1) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// IPC Handlers
ipcMain.handle('select-library-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select SFX Library Root Folder'
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const folderPath = result.filePaths[0];
  const files = scanDirectory(folderPath);
  return {
    folderPath,
    files
  };
});

ipcMain.handle('rescan-folder', async (event, folderPath) => {
  if (!folderPath || !fs.existsSync(folderPath)) {
    return [];
  }
  return scanDirectory(folderPath);
});

// Reveal in macOS Finder
ipcMain.handle('show-in-finder', async (event, filePath) => {
  if (fs.existsSync(filePath)) {
    shell.showItemInFolder(filePath);
    return true;
  }
  return false;
});

// Open file with default macOS audio player / editor
ipcMain.handle('open-file', async (event, filePath) => {
  if (fs.existsSync(filePath)) {
    await shell.openPath(filePath);
    return true;
  }
  return false;
});

// Copy file reference to clipboard so pressing Cmd+V in Premiere / AE imports it directly
ipcMain.handle('copy-file-to-clipboard', async (event, filePath) => {
  if (!fs.existsSync(filePath)) return false;
  
  if (process.platform === 'darwin') {
    // AppleScript puts native POSIX file on macOS pasteboard
    const script = `osascript -e 'set the clipboard to (POSIX file "${filePath.replace(/"/g, '\\"')}")'`;
    exec(script, (error) => {
      if (error) console.error('Error copying file to clipboard:', error);
    });
    return true;
  } else if (process.platform === 'win32') {
    // Windows PowerShell copies native CF_HDROP file list to Windows clipboard
    const winPath = path.resolve(filePath).replace(/'/g, "''");
    const psCmd = `powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; $c = New-Object System.Collections.Specialized.StringCollection; $c.Add('${winPath}'); [System.Windows.Forms.Clipboard]::SetFileDropList($c)"`;
    exec(psCmd, (error) => {
      if (error) {
        console.error('Error copying file on Windows:', error);
      }
    });
    return true;
  }
  return false;
});

// Native OS Drag-and-Drop for Adobe Premiere Pro, After Effects, DaVinci, Finder
ipcMain.on('start-drag', (event, filePath) => {
  if (!filePath || !fs.existsSync(filePath)) {
    console.warn('File does not exist for drag:', filePath);
    return;
  }

  try {
    const icon = getDragIcon();
    event.sender.startDrag({
      file: filePath,
      icon: icon
    });
  } catch (err) {
    console.error('Error in startDrag:', err);
  }
});

// Save rendered audio buffer to cached WAV file for dragging into Premiere/AE
ipcMain.handle('save-processed-wav', async (event, filename, arrayBuffer) => {
  try {
    const cacheDir = path.join(app.getPath('userData'), 'processed_sfx');
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    const safeName = filename.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    const outPath = path.join(cacheDir, safeName);
    fs.writeFileSync(outPath, Buffer.from(arrayBuffer));
    return outPath;
  } catch (err) {
    console.error('Failed to save processed WAV:', err);
    throw err;
  }
});

app.whenReady().then(() => {
  registerAudioProtocol();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
