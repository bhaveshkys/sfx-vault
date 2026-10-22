import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { exec, execFile } from 'child_process';

const AUDIO_EXTENSIONS = new Set(['.wav', '.mp3', '.ogg', '.flac', '.aif', '.aiff', '.m4a', '.aac']);

function formatBytes(bytes: number, decimals = 1) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function scanDir(dirPath: string, rootPath = dirPath): any[] {
  const results: any[] = [];
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '__MACOSX') continue;
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        results.push(...scanDir(fullPath, rootPath));
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (AUDIO_EXTENSIONS.has(ext)) {
          const stats = fs.statSync(fullPath);
          const relativeDir = path.relative(rootPath, dirPath);
          const category = relativeDir && relativeDir !== '' ? relativeDir.split(path.sep)[0] : 'General';
          const subCategory = relativeDir && relativeDir !== '' ? relativeDir : 'General';

          results.push({
            id: Buffer.from(fullPath).toString('base64'),
            name: path.basename(entry.name, ext),
            filename: entry.name,
            path: fullPath,
            streamUrl: `/api/stream?path=${encodeURIComponent(fullPath)}`,
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
    console.error('Scan error:', err);
  }
  return results;
}

function sfxCompanionPlugin(): Plugin {
  return {
    name: 'sfx-companion',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url || '', `http://${req.headers.host}`);

        // Stream audio file endpoint with range support
        if (url.pathname === '/api/stream') {
          const filePath = url.searchParams.get('path');
          if (!filePath || !fs.existsSync(filePath)) {
            res.statusCode = 404;
            res.end('File not found');
            return;
          }

          const stat = fs.statSync(filePath);
          const range = req.headers.range;

          if (range) {
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
            const chunksize = end - start + 1;
            const file = fs.createReadStream(filePath, { start, end });
            res.writeHead(206, {
              'Content-Range': `bytes ${start}-${end}/${stat.size}`,
              'Accept-Ranges': 'bytes',
              'Content-Length': chunksize,
              'Content-Type': 'audio/mpeg'
            });
            file.pipe(res);
          } else {
            res.writeHead(200, {
              'Content-Length': stat.size,
              'Content-Type': 'audio/mpeg'
            });
            fs.createReadStream(filePath).pipe(res);
          }
          return;
        }

        // Reveal in Finder
        if (url.pathname === '/api/reveal') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const { filePath } = JSON.parse(body || '{}');
              if (filePath && fs.existsSync(filePath)) {
                execFile('open', ['-R', filePath], (err) => {
                  if (err) console.error(err);
                });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true }));
              } else {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: false, error: 'File not found' }));
              }
            } catch (e: any) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: e.message }));
            }
          });
          return;
        }

        // Copy POSIX file to macOS clipboard for Cmd+V in Premiere/AE
        if (url.pathname === '/api/copy') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const { filePath } = JSON.parse(body || '{}');
              if (filePath && fs.existsSync(filePath) && process.platform === 'darwin') {
                const script = `osascript -e 'set the clipboard to (POSIX file "${filePath.replace(/"/g, '\\"')}")'`;
                exec(script);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true }));
              } else {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: false }));
              }
            } catch (e: any) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: e.message }));
            }
          });
          return;
        }

        // Scan folder
        if (url.pathname === '/api/scan') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const { folderPath } = JSON.parse(body || '{}');
              if (folderPath && fs.existsSync(folderPath)) {
                const files = scanDir(folderPath);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ files }));
              } else {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Folder not found' }));
              }
            } catch (e: any) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: e.message }));
            }
          });
          return;
        }

        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), sfxCompanionPlugin()],
  base: './',
  server: {
    port: 5173,
    strictPort: true
  }
});
