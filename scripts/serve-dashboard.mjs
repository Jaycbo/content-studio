import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const PORT = 3000;
const DOWNLOADS_DIR = path.join(process.env.HOME, 'Downloads');
const ARCHIVE_DIR = path.join(process.cwd(), 'var/fyp-capture/archive');

fs.mkdirSync(ARCHIVE_DIR, { recursive: true });

let isProcessing = false;
let debounceTimeout = null;

function runPipeline(harPath) {
  if (isProcessing) return;
  isProcessing = true;
  try {
    console.log(`\n[Engine] Running auto-import on: ${harPath}`);
    execSync(`node scripts/fyp-har-import.mjs "${harPath}"`, { stdio: 'inherit' });
    execSync(`node scripts/generate-briefs.mjs`, { stdio: 'inherit' });

    // Move to internal archive once ingestion is 100% complete
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archiveDest = path.join(ARCHIVE_DIR, `tiktok-${timestamp}.har`);
    fs.renameSync(harPath, archiveDest);
    console.log(`[Engine] Safely archived processed HAR to: ${archiveDest}`);
    console.log('[Engine] Pipeline complete. Dashboard updated.');
  } catch (err) {
    console.error('[Engine] Pipeline failed:', err.message);
  } finally {
    isProcessing = false;
  }
}

fs.watch(DOWNLOADS_DIR, (eventType, filename) => {
  if (filename && filename.toLowerCase().includes('tiktok') && (filename.endsWith('.har') || filename.endsWith('.json'))) {
    const fullPath = path.join(DOWNLOADS_DIR, filename);
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      if (fs.existsSync(fullPath)) {
        console.log(`\n⚡ [Auto-Detector] Detected new HAR download: ${filename}`);
        runPipeline(fullPath);
      }
    }, 1500);
  }
});

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/dashboard') {
    const html = fs.readFileSync('public/studio/preview.html', 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  } else if (req.url === '/api/briefs') {
    const briefsDir = 'var/briefs';
    const files = fs.existsSync(briefsDir) ? fs.readdirSync(briefsDir).filter(f => f.endsWith('.json')) : [];
    const briefs = files.map(file => JSON.parse(fs.readFileSync(path.join(briefsDir, file), 'utf8')));
    briefs.sort((a, b) => a.rank - b.rank);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(briefs));
  } else if (req.url === '/api/sync-har' && req.method === 'POST') {
    const files = fs.readdirSync(DOWNLOADS_DIR)
      .filter(f => f.toLowerCase().includes('tiktok') && (f.endsWith('.har') || f.endsWith('.json')))
      .map(f => ({ name: f, time: fs.statSync(path.join(DOWNLOADS_DIR, f)).mtimeMs }))
      .sort((a, b) => b.time - a.time);

    if (files.length === 0) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No new tiktok*.har files in ~/Downloads' }));
      return;
    }

    const latestHar = path.join(DOWNLOADS_DIR, files[0].name);
    runPipeline(latestHar);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, file: files[0].name }));
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`\n🚀 Content Studio Server active at: http://localhost:${PORT}`);
  console.log(`👀 Actively watching ~/Downloads for new *.har files...`);
});
