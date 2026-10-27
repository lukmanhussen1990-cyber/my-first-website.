// Tiny local HTTP server for the render harness.
//  - GET  /<path>            serves files from the larry-john/ folder
//  - POST /sink?kind=...     hands the raw request body (pixels / PNG / JSON) to a registered handler
const http = require('http');
const fs = require('fs');
const path = require('path');

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
  '.wav': 'audio/wav', '.glb': 'model/gltf-binary', '.css': 'text/css',
};

function startServer(root, sinkHandler, port = 0) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://x');
      if (req.method === 'POST' && url.pathname === '/sink') {
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', async () => {
          try {
            await sinkHandler(Object.fromEntries(url.searchParams), Buffer.concat(chunks));
            res.writeHead(200); res.end('ok');
          } catch (e) { res.writeHead(500); res.end(String(e)); }
        });
        return;
      }
      const p = path.join(root, decodeURIComponent(url.pathname));
      if (!p.startsWith(root)) { res.writeHead(403); return res.end(); }
      fs.readFile(p, (err, data) => {
        if (err) { res.writeHead(404); return res.end('404 ' + url.pathname); }
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        res.end(data);
      });
    });
    srv.listen(port, '127.0.0.1', () => resolve(srv));
  });
}

module.exports = { startServer };
