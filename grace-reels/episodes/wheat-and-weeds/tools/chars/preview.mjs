// Quick look at the drawings: every character view assembled in its rest pose as one SVG, with an SVG
// outline filter standing in for the shader outline, rendered by Chromium into one PNG sheet.
// Usage: node tools/chars/preview.mjs out.png [ids] [views] [scale]
import {createRequire} from 'node:module';
import {assemble, CAST} from './cast.mjs';
import {CH, CW} from './parts.mjs';

const require = createRequire(import.meta.url);
const {chromium} = require('/opt/node-tools/node_modules/playwright');

const [out = 'characters/work/preview.png', idArg, viewArg, scaleArg] = process.argv.slice(2);
const ids = idArg && idArg !== 'all' ? idArg.split(',') : Object.keys(CAST);
const views = viewArg && viewArg !== 'all' ? viewArg.split(',') : ['side', 'tq', 'back'];
const scale = Number(scaleArg ?? 0.3);
const OUT_PX = 5; // outline width on screen

// crop the canvas to the figure (most of the width is empty margin)
const HEADS = process.env.HEADS === '1';
const X0 = HEADS ? 520 : 300;
const X1 = HEADS ? 1120 : 1300;
const Y0 = HEADS ? 120 : 0;
const Y1 = HEADS ? 760 : 2240;

const cell = (id, view) => {
	const {parts} = assemble(CAST[id], view);
	const r = OUT_PX / scale;
	const filt = `<filter id="ol_${id}_${view}" x="-20%" y="-20%" width="140%" height="140%"><feMorphology in="SourceAlpha" operator="dilate" radius="${r}" result="d"/><feFlood flood-color="#2b1d12"/><feComposite in2="d" operator="in" result="o"/><feMerge><feMergeNode in="o"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
	const body = parts.map((p) => `<g filter="url(#ol_${id}_${view})">${p.svg}</g>`).join('');
	const w = (X1 - X0) * scale;
	const h = (Y1 - Y0) * scale;
	return `<div style="display:inline-block;margin:4px;background:#7c7c86;position:relative"><svg width="${w}" height="${h}" viewBox="${X0} ${Y0} ${X1 - X0} ${Y1 - Y0}" xmlns="http://www.w3.org/2000/svg"><defs>${filt}</defs>${body}</svg><div style="position:absolute;left:4px;bottom:2px;font:bold 13px sans-serif;color:#ffe08a">${id}/${view}</div></div>`;
};

const html = `<html><body style="margin:0;background:#333">${ids.map((id) => `<div style="white-space:nowrap">${views.map((v) => cell(id, v)).join('')}</div>`).join('')}</body></html>`;
const browser = await chromium.launch();
const page = await browser.newPage({viewport: {width: 1800, height: 1000}});
await page.setContent(html);
await page.screenshot({path: out, fullPage: true});
await browser.close();
console.log(out);
void CW;
