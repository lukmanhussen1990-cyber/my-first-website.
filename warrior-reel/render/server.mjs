// Tiny static file server rooted at the project dir, with an optional POST /frame sink.
import http from 'http';
import fs from 'fs';
import path from 'path';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.wasm': 'application/wasm' };

export function startServer(root, { port = 0, onFrame = null } = {}) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://x');
      if (req.method === 'POST' && url.pathname === '/frame' && onFrame) {
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', async () => { await onFrame(Buffer.concat(chunks), url.searchParams); res.writeHead(200); res.end('ok'); });
        return;
      }
      const f = path.join(root, decodeURIComponent(url.pathname));
      if (!f.startsWith(root)) { res.writeHead(403); res.end(); return; }
      fs.readFile(f, (err, data) => {
        if (err) { res.writeHead(404); res.end('not found'); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        res.end(data);
      });
    });
    srv.listen(port, '127.0.0.1', () => resolve({ srv, port: srv.address().port }));
  });
}
