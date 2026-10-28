// Rasterize every character part (and hand/mouth variant) into a cropped PNG with transparent padding,
// and write the rigs: pivots, parents and draw order per character view. Chromium (Playwright) draws
// the SVG; the crop box is found from the alpha channel in the page.
// Outputs: public/sprites/<id>/<view>/<part>[.<variant>].png, public/sprites/index.json (merged),
// src/characters/rigs.json. Run: node tools/chars/build.mjs [ids]
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {assemble, CAST, PROPS} from './cast.mjs';
import {CH, CW, metrics} from './parts.mjs';
import {crowdSpecs} from './crowd.mjs';

const require = createRequire(import.meta.url);
const {chromium} = require('/opt/node-tools/node_modules/playwright');

const EP = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const SPR = path.join(EP, 'public/sprites');
const PAD = 72; // transparent margin for the screen-space outline

// which views each character needs, and the drawing scale (1 = a figure about 2000 px tall)
const PLAN = {
	farmer: {views: ['side', 'tq', 'back'], scale: 1},
	jesus: {views: ['side', 'tq', 'back'], scale: 1},
	servantA: {views: ['side', 'tq', 'back'], scale: 1},
	servantB: {views: ['side', 'tq', 'back'], scale: 1},
	servantC: {views: ['side', 'tq', 'back'], scale: 1},
	enemy: {views: ['side', 'tq', 'back'], scale: 1},
	saul: {views: ['side', 'tq', 'back'], scale: 1},
	paul: {views: ['side', 'tq', 'back'], scale: 1},
	soldier: {views: ['side', 'tq'], scale: 0.75},
	reaper: {views: ['side', 'tq', 'back'], scale: 0.85},
};

const only = process.argv[2] ? process.argv[2].split(',') : null;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<html><body></body></html>');

// Draw an SVG fragment on the figure canvas at `scale`, crop to its alpha plus PAD; returns the PNG
// (base64) and the crop origin in figure coordinates.
const raster = async (svgBody, scale, box = [CW, CH], origin = [0, 0]) => {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(box[0] * scale)}" height="${Math.round(box[1] * scale)}" viewBox="${origin[0]} ${origin[1]} ${box[0]} ${box[1]}">${svgBody}</svg>`;
	return page.evaluate(
		async ({svg, PAD, scale, origin}) => {
			const img = new Image();
			img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
			await img.decode();
			const c = document.createElement('canvas');
			c.width = img.width;
			c.height = img.height;
			const ctx = c.getContext('2d');
			ctx.drawImage(img, 0, 0);
			const d = ctx.getImageData(0, 0, c.width, c.height).data;
			let x0 = c.width;
			let y0 = c.height;
			let x1 = -1;
			let y1 = -1;
			for (let y = 0; y < c.height; y++) {
				for (let x = 0; x < c.width; x++) {
					if (d[(y * c.width + x) * 4 + 3] > 2) {
						if (x < x0) x0 = x;
						if (x > x1) x1 = x;
						if (y < y0) y0 = y;
						if (y > y1) y1 = y;
					}
				}
			}
			if (x1 < 0) return null;
			const w = x1 - x0 + 1 + 2 * PAD;
			const h = y1 - y0 + 1 + 2 * PAD;
			const o = document.createElement('canvas');
			o.width = w;
			o.height = h;
			o.getContext('2d').drawImage(c, x0 - PAD, y0 - PAD, w, h, 0, 0, w, h);
			return {png: o.toDataURL('image/png').split(',')[1], w, h, ox: (x0 - PAD) / scale + origin[0], oy: (y0 - PAD) / scale + origin[1]};
		},
		{svg, PAD, scale, origin},
	);
};

const index = fs.existsSync(path.join(SPR, 'index.json')) ? JSON.parse(fs.readFileSync(path.join(SPR, 'index.json'), 'utf8')) : {};
const rigsPath = path.join(EP, 'src/characters/rigs.json');
const rigs = fs.existsSync(rigsPath) ? JSON.parse(fs.readFileSync(rigsPath, 'utf8')) : {};

const save = (name, r) => {
	const file = path.join(SPR, `${name}.png`);
	fs.mkdirSync(path.dirname(file), {recursive: true});
	fs.writeFileSync(file, Buffer.from(r.png, 'base64'));
	index[name] = {file: `sprites/${name}.png`, w: r.w, h: r.h, bbox: [PAD, PAD, r.w - PAD, r.h - PAD], foot: [r.w / 2, r.h - PAD]};
};

for (const [id, plan] of Object.entries(PLAN)) {
	if (only && !only.includes(id)) continue;
	const spec = CAST[id];
	rigs[id] = rigs[id] ?? {};
	for (const view of plan.views) {
		const {parts, sole} = assemble(spec, view);
		const S = plan.scale;
		const crop = {};
		const out = {};
		for (const p of parts) {
			if (!p.svg) continue;
			const name = `${id}/${view}/${p.name}`;
			const r = await raster(p.svg, S);
			if (!r) continue;
			save(name, r);
			crop[p.name] = [r.ox, r.oy];
			const variants = {};
			if (p.variants) {
				for (const [k, svg] of Object.entries(p.variants)) {
					const rv = await raster(svg, S);
					if (!rv) continue;
					const vn = `${name}.${k}`;
					save(vn, rv);
					variants[k] = {sprite: vn, pivot: [(p.joint[0] - rv.ox) * S, (p.joint[1] - rv.oy) * S]};
				}
			}
			out[p.name] = {sprite: name, pivot: [(p.joint[0] - r.ox) * S, (p.joint[1] - r.oy) * S], parent: p.parent, z: p.z, ...(p.variants ? {variants} : {})};
		}
		// where each part hangs in its parent's image
		for (const [n, def] of Object.entries(out)) {
			const p = parts.find((q) => q.name === n);
			if (def.parent && crop[def.parent]) {
				const o = crop[def.parent];
				def.at = [(p.joint[0] - o[0]) * S, (p.joint[1] - o[1]) * S];
			} else if (def.parent) {
				throw new Error(`${id}/${view}: ${n} has no parent image ${def.parent}`);
			}
		}
		const root = parts.find((q) => q.parent === null);
		const M = metrics(spec);
		// eyes for the blinks, in the head image's px
		const {H} = assemble(spec, view);
		const hc = crop.head;
		const eyes = [];
		if (hc && !spec.faceless) {
			const toImg = (e) => ({c: [(e.c[0] - hc[0]) * S, (e.c[1] - hc[1]) * S], w: e.w * S, h: e.h * S});
			if (H.eye) eyes.push(toImg(H.eye));
			if (H.eyes) eyes.push(toImg(H.eyes.near), toImg(H.eyes.far));
		}
		rigs[id][view] = {
			scale: S,
			heightPx: M.Hf * S,
			root: root.name,
			// the soles relative to the root pivot, in image px (y down)
			sole: [(sole[0] - root.joint[0]) * S, (sole[1] - root.joint[1]) * S],
			order: parts.filter((q) => out[q.name]).map((q) => q.name),
			parts: out,
			eyes,
			skin: spec.skin,
		};
		console.log(`${id}/${view}: ${Object.keys(out).length} parts`);
	}
}

// Close-ups: one arm chain drawn big (the enemy's hand throwing seed in the opening macro shot)
const MACRO = {enemy: {view: 'side', scale: 3, parts: ['arm_upper_near', 'forearm_near', 'hand_near']}};
for (const [id, mc] of Object.entries(MACRO)) {
	if (!only || !only.includes('macro')) continue;
	const spec = CAST[id];
	const {parts} = assemble(spec, mc.view);
	const S = mc.scale;
	const crop = {};
	const out = {};
	for (const p of parts.filter((q) => mc.parts.includes(q.name))) {
		// draw only the box around the part so the canvas stays small
		const box = [700, 1100];
		const origin = [p.joint[0] - 350, p.joint[1] - 300];
		const name = `${id}/macro/${p.name}`;
		const r = await raster(p.svg, S, box, origin);
		save(name, r);
		crop[p.name] = [r.ox, r.oy];
		const variants = {};
		for (const [k, svg] of Object.entries(p.variants ?? {})) {
			const rv = await raster(svg, S, box, origin);
			if (!rv) continue;
			save(`${name}.${k}`, rv);
			variants[k] = {sprite: `${name}.${k}`, pivot: [(p.joint[0] - rv.ox) * S, (p.joint[1] - rv.oy) * S]};
		}
		out[p.name] = {sprite: name, pivot: [(p.joint[0] - r.ox) * S, (p.joint[1] - r.oy) * S], parent: p.name === mc.parts[0] ? null : p.parent, z: p.z, ...(p.variants ? {variants} : {})};
	}
	for (const [n, def] of Object.entries(out)) {
		if (!def.parent) continue;
		const p = parts.find((q) => q.name === n);
		const o = crop[def.parent];
		def.at = [(p.joint[0] - o[0]) * S, (p.joint[1] - o[1]) * S];
	}
	rigs[id].macro = {scale: S, heightPx: metrics(spec).Hf * S, root: mc.parts[0], sole: [0, 0], order: mc.parts, parts: out, eyes: [], skin: spec.skin};
	console.log(`${id}/macro: ${Object.keys(out).length} parts`);
}

// Props: one image each, the grip point at the part pivot
for (const [k, draw] of Object.entries(PROPS)) {
	if (only && !only.includes('props')) continue;
	const u = 19.6;
	const svg = draw(u, u * 0.3);
	const r = await raster(svg, 1, [1400, 1400], [-700, -700]);
	save(`props/${k}`, r);
	index[`props/${k}`].pivot = [(0 - r.ox), (0 - r.oy)];
	console.log(`props/${k}`);
}

// The crowd on the beach: flattened figures (no rig), a back view and a three-quarter view each
if (!only || only.includes('crowd')) {
	for (const spec of crowdSpecs()) {
		for (const view of ['back', 'tq']) {
			const {parts} = assemble(spec, view);
			const svg = parts.map((p) => p.svg).join('');
			const r = await raster(svg, 0.5);
			save(`crowd/${spec.id}_${view}`, r);
			const M = metrics(spec);
			index[`crowd/${spec.id}_${view}`].foot = [(800 - r.ox) * 0.5, (2160 - r.oy) * 0.5];
			index[`crowd/${spec.id}_${view}`].heightPx = M.Hf * 0.5;
		}
		console.log(`crowd/${spec.id}`);
	}
}

fs.writeFileSync(path.join(SPR, 'index.json'), JSON.stringify(index, null, 1) + '\n');
fs.writeFileSync(rigsPath, JSON.stringify(rigs, null, 1) + '\n');
await browser.close();
console.log(`${Object.keys(index).length} sprites`);
