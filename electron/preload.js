const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform, // 'darwin' | 'win32' | 'linux'
  selectLibraryFolder: () => ipcRenderer.invoke('select-library-folder'),
  rescanFolder: (folderPath) => ipcRenderer.invoke('rescan-folder', folderPath),
  showInFinder: (filePath) => ipcRenderer.invoke('show-in-finder', filePath),
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  copyFileToClipboard: (filePath) => ipcRenderer.invoke('copy-file-to-clipboard', filePath),
  startDrag: (filePath) => ipcRenderer.send('start-drag', filePath),
  saveProcessedWav: (filename, buffer) => ipcRenderer.invoke('save-processed-wav', filename, buffer)
});
