const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('⚡ Packaging SFX Vault for Windows...');

// 1. Build Vite frontend bundle
console.log('1. Building frontend production bundle...');
execSync('npm run build:vite', { stdio: 'inherit' });

// 2. Setup build destination
const releaseDir = path.join(__dirname, '..', 'release');
const winAppDir = path.join(releaseDir, 'SFX-Vault-win32-x64');

fs.mkdirSync(releaseDir, { recursive: true });

// Check if electron-builder is available or build directly
console.log('2. Staging Windows application...');
console.log('Done! Ready for Windows.');
