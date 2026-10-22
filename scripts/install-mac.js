const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('⚡ Building SFX Vault for macOS...');

// 1. Build Vite frontend bundle
console.log('1. Building frontend production bundle...');
execSync('npm run build:vite', { stdio: 'inherit' });

// 2. Setup build destination
const releaseDir = path.join(__dirname, '..', 'release');
const appBundle = path.join(releaseDir, 'SFX Vault.app');
const targetApp = '/Applications/SFX Vault.app';

fs.rmSync(releaseDir, { recursive: true, force: true });
fs.mkdirSync(releaseDir, { recursive: true });

// 3. Copy Electron template
console.log('2. Staging macOS application bundle...');
execSync(`cp -R "node_modules/electron/dist/Electron.app" "${appBundle}"`);

// 4. Update Info.plist
const plistPath = path.join(appBundle, 'Contents', 'Info.plist');
let plist = fs.readFileSync(plistPath, 'utf8');
plist = plist.replace(/<key>CFBundleDisplayName<\/key>\s*<string>[^<]*<\/string>/, '<key>CFBundleDisplayName</key><string>SFX Vault</string>');
plist = plist.replace(/<key>CFBundleName<\/key>\s*<string>[^<]*<\/string>/, '<key>CFBundleName</key><string>SFX Vault</string>');
plist = plist.replace(/<key>CFBundleIdentifier<\/key>\s*<string>[^<]*<\/string>/, '<key>CFBundleIdentifier</key><string>com.bhavesh.sfxvault</string>');
plist = plist.replace(/<key>CFBundleExecutable<\/key>\s*<string>[^<]*<\/string>/, '<key>CFBundleExecutable</key><string>SFX Vault</string>');
fs.writeFileSync(plistPath, plist);

// 5. Rename executable
fs.renameSync(
  path.join(appBundle, 'Contents', 'MacOS', 'Electron'),
  path.join(appBundle, 'Contents', 'MacOS', 'SFX Vault')
);

// 6. Stage resources/app
console.log('3. Copying app resources...');
const resourcesApp = path.join(appBundle, 'Contents', 'Resources', 'app');
fs.mkdirSync(resourcesApp, { recursive: true });

fs.copyFileSync(path.join(__dirname, '..', 'package.json'), path.join(resourcesApp, 'package.json'));
execSync(`cp -R "${path.join(__dirname, '..', 'electron')}" "${resourcesApp}/"`);
execSync(`cp -R "${path.join(__dirname, '..', 'dist')}" "${resourcesApp}/"`);

// 7. Strip quarantine attribute
execSync(`xattr -cr "${appBundle}"`);

// 8. Copy to /Applications
console.log('4. Installing permanently into /Applications...');
try {
  fs.rmSync(targetApp, { recursive: true, force: true });
  execSync(`cp -R "${appBundle}" "${targetApp}"`);
  execSync(`xattr -cr "${targetApp}"`);
  console.log('🎉 Successfully installed to /Applications/SFX Vault.app!');
} catch (err) {
  console.warn('Could not copy to /Applications automatically. You can find the app at:', appBundle);
}
