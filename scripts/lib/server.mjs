// Tiny static file server for the render page (ES modules need http://, not file://).
// POST requests are handed to `onPost(url, bodyBuffer)` (used to stream raw frames out).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ttf': 'font/ttf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
};

export function startServer(root, { port = 0, onPost = null } = {}) {
  const absRoot = path.resolve(root);
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (req.method === 'POST') {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', async () => {
        try {
          if (onPost) await onPost(url, Buffer.concat(chunks));
          res.writeHead(200).end('ok');
        } catch (err) {
          res.writeHead(500).end(String(err));
        }
      });
      return;
    }
    const urlPath = decodeURIComponent(url.pathname);
    const filePath = path.join(absRoot, urlPath === '/' ? '/src/index.html' : urlPath);
    if (!filePath.startsWith(absRoot)) {
      res.writeHead(403).end();
      return;
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404).end('not found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      res.end(data);
    });
  });
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      resolve({ server, url: `http://127.0.0.1:${server.address().port}` });
    });
  });
}
