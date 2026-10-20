// Interactive preview: node scripts/serve.mjs  ->  open the printed URL (space = play/pause, arrows = seek).
// Plays audio/mix/master.wav in sync when it exists (run `npm run mix` once to create it).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { buildTimeline } from './timeline.mjs';
import { P, ROOT } from './config.mjs';

fs.mkdirSync(P('build'), { recursive: true });
fs.writeFileSync(P('build', 'timeline.json'), JSON.stringify(buildTimeline(), null, 2));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.ttf': 'font/ttf', '.wav': 'audio/wav', '.png': 'image/png' };
const port = Number(process.env.PORT || 5173);
http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(ROOT, url === '/' ? '/src/index.html' : url);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}).listen(port, () => console.log(`Preview: http://localhost:${port}/src/index.html?preview`));
