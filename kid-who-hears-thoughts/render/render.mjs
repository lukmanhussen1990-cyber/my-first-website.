// Headless deterministic renderer: Playwright -> Chromium (SwiftShader WebGL) -> Three.js -> PNG frames.
// Usage:
//   node render/render.mjs                 render every frame to frames/%05d.png
//   node render/render.mjs --preview       first 10 seconds only
//   node render/render.mjs --frames 0-299  a range
//   node render/render.mjs --stills a,b,c --out dir   one frame from the middle of the named shots
//   node render/render.mjs --thumbnail     out/thumbnail.png
//   node render/render.mjs --events        story/events.json (bubble pop times for the sound effects)
// Options: --workers N (default 4), --scale 0.5 (lower resolution test renders)
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, def) => {
	const i = args.indexOf(`--${name}`);
	return i >= 0 ? args[i + 1] : def;
};
const has = (name) => args.includes(`--${name}`);
const WORKERS = Number(opt('workers', 4));
const SCALE = Number(opt('scale', 1));
const OUT = path.resolve(ROOT, opt('out', 'frames'));
const timeline = JSON.parse(fs.readFileSync(path.join(ROOT, 'story/timeline.json'), 'utf8'));

/* tiny static file server for the project folder */
const TYPES = {'.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png'};
const server = http.createServer((req, res) => {
	const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
	if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
		res.writeHead(404);
		res.end('not found');
		return;
	}
	res.writeHead(200, {'Content-Type': TYPES[path.extname(p)] ?? 'application/octet-stream'});
	fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;

const browser = await chromium.launch({args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']});
const W = Math.round(1080 * SCALE);
const H = Math.round(1920 * SCALE);
async function openPage() {
	const page = await browser.newPage({viewport: {width: W, height: H}, deviceScaleFactor: 1});
	page.on('pageerror', (e) => console.error('[page error]', e.message));
	page.on('console', (m) => {
		if (m.type() === 'error') console.error('[console]', m.text());
	});
	await page.goto(`http://127.0.0.1:${PORT}/web/index.html?scale=${SCALE}`);
	await page.waitForFunction(() => window.ready === true, null, {timeout: 120000});
	return page;
}

fs.mkdirSync(OUT, {recursive: true});
const t0 = Date.now();

if (has('events')) {
	const page = await openPage();
	const ev = await page.evaluate(() => window.collectEvents());
	fs.writeFileSync(path.join(ROOT, 'story/events.json'), JSON.stringify(ev, null, 1));
	console.log('events:', ev.length, '-> story/events.json');
} else if (has('stills') || has('thumbnail')) {
	const page = await openPage();
	if (has('thumbnail')) {
		await page.evaluate(() => {
			window.renderFrame(0, {
				shot: 'hook_ecu',
				lt: 1.1,
				noCaptions: true,
				thumbnail: (ctx, w, h) => {
					const k = w / 1080;
					ctx.drawImage(window.bubbleCanvas('???'), w * 0.38, h * 0.02, w * 0.6, w * 0.4);
					ctx.drawImage(window.bubbleCanvas('pizza'), w * 0.02, h * 0.1, w * 0.42, w * 0.28);
					ctx.save();
					ctx.textAlign = 'center';
					ctx.textBaseline = 'middle';
					ctx.lineJoin = 'round';
					ctx.font = `800 ${150 * k}px Poppins, sans-serif`;
					['I HEAR', 'THOUGHTS?!'].forEach((line, i) => {
						const y = h * (0.72 + i * 0.09);
						ctx.lineWidth = 26 * k;
						ctx.strokeStyle = '#111';
						ctx.strokeText(line, w / 2, y);
						ctx.fillStyle = i ? '#ffd23a' : '#ffffff';
						ctx.fillText(line, w / 2, y);
					});
					ctx.restore();
				},
			});
		});
		const file = path.resolve(ROOT, 'out/thumbnail.png');
		fs.mkdirSync(path.dirname(file), {recursive: true});
		await page.screenshot({path: file, type: 'png'});
		console.log('thumbnail:', file);
	}
	if (has('stills')) {
		const ids = opt('stills', '').split(',').filter(Boolean);
		const list = ids.length && ids[0] !== 'all' ? ids : timeline.shots.map((s) => s.id);
		const frac = Number(opt('at', 0.6));
		for (const id of list) {
			const s = timeline.shots.find((x) => x.id === id);
			const f = Math.min(timeline.frames - 1, Math.round(s.startFrame + (s.endFrame - s.startFrame) * frac));
			const info = await page.evaluate((i) => window.renderFrame(i), f);
			await page.screenshot({path: path.join(OUT, `${id}.png`), type: 'png'});
			console.log(id, f, info.cap ? `caption@${info.cap.y}` : '');
		}
	}
} else {
	let [a, b] = [0, timeline.frames - 1];
	if (has('preview')) b = Math.min(b, 10 * timeline.fps - 1);
	if (opt('frames')) [a, b] = opt('frames').split('-').map(Number);
	let next = a;
	let done = 0;
	const total = b - a + 1;
	const pages = await Promise.all(Array.from({length: WORKERS}, openPage));
	const tStart = Date.now();
	await Promise.all(
		pages.map(async (page) => {
			while (next <= b) {
				const i = next++;
				await page.evaluate((f) => window.renderFrame(f), i);
				await page.screenshot({path: path.join(OUT, `${String(i).padStart(5, '0')}.png`), type: 'png'});
				done++;
				if (done % 25 === 0 || done === total) {
					const el = (Date.now() - tStart) / 1000;
					const rate = done / el;
					console.log(`frame ${done}/${total}  ${rate.toFixed(2)} fps  eta ${((total - done) / rate / 60).toFixed(1)} min`);
				}
			}
		}),
	);
}
await browser.close();
server.close();
console.log(`render time: ${((Date.now() - t0) / 1000).toFixed(1)} s -> ${OUT}`);
