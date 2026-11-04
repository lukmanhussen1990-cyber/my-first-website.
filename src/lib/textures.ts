// Procedural canvas textures (all generated in code, deterministic, cached).
import * as THREE from 'three';
import {mulberry32} from './random';
import {POPPINS} from './fonts';

const cache = new Map<string, THREE.Texture>();

function make(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, opts: {repeat?: [number, number]; srgb?: boolean; nearest?: boolean} = {}) {
	const k = key + JSON.stringify(opts);
	let t = cache.get(k);
	if (t) return t;
	const c = document.createElement('canvas');
	c.width = w;
	c.height = h;
	const ctx = c.getContext('2d')!;
	draw(ctx, w, h);
	const tex = new THREE.CanvasTexture(c);
	if (opts.srgb !== false) tex.colorSpace = THREE.SRGBColorSpace;
	tex.anisotropy = 8;
	if (opts.repeat) {
		tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
		tex.repeat.set(opts.repeat[0], opts.repeat[1]);
	}
	tex.needsUpdate = true;
	cache.set(k, tex);
	return tex;
}

const shade = (hex: string, k: number) => {
	const c = new THREE.Color(hex);
	if (k >= 0) c.lerp(new THREE.Color('#ffffff'), k);
	else c.multiplyScalar(1 + k);
	return '#' + c.getHexString();
};

/** speckled noise (grass, dirt, sand, stone floors) */
export const noiseTex = (base: string, amount = 0.08, seed = 1, repeat: [number, number] = [8, 8], blobs = 260) =>
	make(`noise|${base}|${amount}|${seed}|${blobs}`, 256, 256, (ctx, w, h) => {
		const r = mulberry32(seed);
		ctx.fillStyle = base;
		ctx.fillRect(0, 0, w, h);
		for (let i = 0; i < blobs; i++) {
			const x = r() * w;
			const y = r() * h;
			const s = 2 + r() * 10;
			ctx.fillStyle = shade(base, (r() - 0.5) * amount * 2);
			ctx.globalAlpha = 0.5 + r() * 0.5;
			ctx.beginPath();
			ctx.ellipse(x, y, s, s * (0.5 + r() * 0.6), r() * 3, 0, Math.PI * 2);
			ctx.fill();
			// wrap
			if (x < s) { ctx.beginPath(); ctx.ellipse(x + w, y, s, s * 0.7, 0, 0, Math.PI * 2); ctx.fill(); }
			if (y < s) { ctx.beginPath(); ctx.ellipse(x, y + h, s, s * 0.7, 0, 0, Math.PI * 2); ctx.fill(); }
		}
		ctx.globalAlpha = 1;
	}, {repeat});

/** wooden planks with grain */
export const woodTex = (base: string, repeat: [number, number] = [2, 2], planks = 6, seed = 3) =>
	make(`wood|${base}|${planks}|${seed}`, 512, 512, (ctx, w, h) => {
		const r = mulberry32(seed);
		const ph = h / planks;
		for (let p = 0; p < planks; p++) {
			ctx.fillStyle = shade(base, (r() - 0.5) * 0.12);
			ctx.fillRect(0, p * ph, w, ph);
			ctx.strokeStyle = shade(base, -0.12);
			ctx.lineWidth = 1.5;
			for (let g = 0; g < 7; g++) {
				const y = p * ph + r() * ph;
				ctx.globalAlpha = 0.35;
				ctx.beginPath();
				ctx.moveTo(0, y);
				for (let x = 0; x <= w; x += 32) ctx.lineTo(x, y + Math.sin(x * 0.02 + r() * 6) * 3);
				ctx.stroke();
			}
			ctx.globalAlpha = 1;
			ctx.fillStyle = shade(base, -0.28);
			ctx.fillRect(0, p * ph, w, 3);
			// plank joints
			const jx = r() * w;
			ctx.fillRect(jx, p * ph, 3, ph);
		}
	}, {repeat});

/** horizontal house siding */
export const sidingTex = (base: string, repeat: [number, number] = [1, 1], rows = 16) =>
	make(`siding|${base}|${rows}`, 256, 256, (ctx, w, h) => {
		const rh = h / rows;
		for (let i = 0; i < rows; i++) {
			const g = ctx.createLinearGradient(0, i * rh, 0, (i + 1) * rh);
			g.addColorStop(0, shade(base, 0.08));
			g.addColorStop(0.85, base);
			g.addColorStop(1, shade(base, -0.18));
			ctx.fillStyle = g;
			ctx.fillRect(0, i * rh, w, rh);
		}
	}, {repeat});

/** square tiles with grout */
export const tilesTex = (base: string, grout = '#ffffff', repeat: [number, number] = [4, 4], n = 4, seed = 5) =>
	make(`tiles|${base}|${grout}|${n}|${seed}`, 256, 256, (ctx, w, h) => {
		const r = mulberry32(seed);
		ctx.fillStyle = grout;
		ctx.fillRect(0, 0, w, h);
		const s = w / n;
		for (let i = 0; i < n; i++)
			for (let j = 0; j < n; j++) {
				ctx.fillStyle = shade(base, (r() - 0.5) * 0.08);
				ctx.fillRect(i * s + 3, j * s + 3, s - 6, s - 6);
				ctx.fillStyle = 'rgba(255,255,255,0.18)';
				ctx.fillRect(i * s + 5, j * s + 5, s - 20, 6);
			}
	}, {repeat});

/** irregular stone blocks (castle) */
export const stoneTex = (base: string, repeat: [number, number] = [2, 2], seed = 7, rows = 6) =>
	make(`stone|${base}|${seed}|${rows}`, 512, 512, (ctx, w, h) => {
		const r = mulberry32(seed);
		ctx.fillStyle = shade(base, -0.35);
		ctx.fillRect(0, 0, w, h);
		const rh = h / rows;
		for (let i = 0; i < rows; i++) {
			let x = -r() * 60;
			while (x < w) {
				const bw = 60 + r() * 70;
				ctx.fillStyle = shade(base, (r() - 0.5) * 0.25);
				const pad = 4;
				ctx.beginPath();
				const y0 = i * rh + pad;
				const x0 = x + pad;
				const ww = bw - pad * 2;
				const hh = rh - pad * 2;
				ctx.moveTo(x0 + 6, y0);
				ctx.arcTo(x0 + ww, y0, x0 + ww, y0 + hh, 8);
				ctx.arcTo(x0 + ww, y0 + hh, x0, y0 + hh, 8);
				ctx.arcTo(x0, y0 + hh, x0, y0, 8);
				ctx.arcTo(x0, y0, x0 + ww, y0, 8);
				ctx.fill();
				ctx.fillStyle = 'rgba(255,255,255,0.06)';
				ctx.fillRect(x0 + 4, y0 + 3, ww - 8, 5);
				// cracks / specks
				for (let k = 0; k < 6; k++) {
					ctx.fillStyle = `rgba(0,0,0,${0.08 + r() * 0.1})`;
					ctx.fillRect(x0 + r() * ww, y0 + r() * hh, 3 + r() * 6, 2 + r() * 3);
				}
				x += bw;
			}
		}
	}, {repeat});

/** road asphalt: fine low-contrast specks */
export const asphaltTex = (repeat: [number, number] = [2, 12]) =>
	make('asphalt', 256, 256, (ctx, w, h) => {
		const r = mulberry32(21);
		ctx.fillStyle = '#5d6270';
		ctx.fillRect(0, 0, w, h);
		for (let i = 0; i < 2600; i++) {
			const v = r();
			ctx.fillStyle = v > 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.12)';
			const s = 0.8 + r() * 1.8;
			ctx.fillRect(r() * w, r() * h, s, s);
		}
	}, {repeat});

/** soft round dot (glows, particles) */
export const dotTex = () =>
	make('dot', 128, 128, (ctx, w, h) => {
		const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
		g.addColorStop(0, 'rgba(255,255,255,1)');
		g.addColorStop(0.25, 'rgba(255,255,255,0.75)');
		g.addColorStop(0.6, 'rgba(255,255,255,0.18)');
		g.addColorStop(1, 'rgba(255,255,255,0)');
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, w, h);
	}, {srgb: false});

/** 4-point sparkle star */
export const starTex = () =>
	make('star', 128, 128, (ctx, w, h) => {
		ctx.translate(w / 2, h / 2);
		const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 64);
		g.addColorStop(0, 'rgba(255,255,255,1)');
		g.addColorStop(0.2, 'rgba(255,255,255,0.5)');
		g.addColorStop(1, 'rgba(255,255,255,0)');
		ctx.fillStyle = g;
		ctx.beginPath();
		for (let i = 0; i < 8; i++) {
			const rr = i % 2 === 0 ? 62 : 9;
			const a = (i / 8) * Math.PI * 2;
			ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
		}
		ctx.closePath();
		ctx.fill();
	}, {srgb: false});

/** radial light rays (alpha), for god-ray fans */
export const raysTex = (n = 14, seed = 9) =>
	make(`rays|${n}|${seed}`, 512, 512, (ctx, w, h) => {
		const r = mulberry32(seed);
		ctx.translate(w / 2, h / 2);
		for (let i = 0; i < n; i++) {
			const a = (i / n) * Math.PI * 2 + r() * 0.2;
			const width = 0.05 + r() * 0.08;
			const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 256);
			g.addColorStop(0, 'rgba(255,255,255,0.9)');
			g.addColorStop(0.5, 'rgba(255,255,255,0.35)');
			g.addColorStop(1, 'rgba(255,255,255,0)');
			ctx.fillStyle = g;
			ctx.beginPath();
			ctx.moveTo(0, 0);
			ctx.arc(0, 0, 256, a - width, a + width);
			ctx.closePath();
			ctx.fill();
		}
	}, {srgb: false});

/** vertical fade (1 at bottom -> 0 at top) for light beams/cones */
export const fadeTex = () =>
	make('fade', 4, 256, (ctx, w, h) => {
		const g = ctx.createLinearGradient(0, h, 0, 0);
		g.addColorStop(0, 'rgba(255,255,255,0.0)');
		g.addColorStop(0.08, 'rgba(255,255,255,0.9)');
		g.addColorStop(0.4, 'rgba(255,255,255,0.35)');
		g.addColorStop(1, 'rgba(255,255,255,0)');
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, w, h);
	}, {srgb: false});

/** spiderweb (white on transparent) */
export const webTex = (seed = 13) =>
	make(`web|${seed}`, 512, 512, (ctx, w, h) => {
		const r = mulberry32(seed);
		ctx.strokeStyle = 'rgba(235,240,255,0.85)';
		ctx.lineWidth = 2;
		const cx = 0;
		const cy = 0;
		const spokes = 9;
		const angs: number[] = [];
		for (let i = 0; i < spokes; i++) angs.push((i / (spokes - 1)) * (Math.PI / 2) + (r() - 0.5) * 0.06);
		for (const a of angs) {
			ctx.beginPath();
			ctx.moveTo(cx, cy);
			ctx.lineTo(Math.cos(a) * 720, Math.sin(a) * 720);
			ctx.stroke();
		}
		ctx.lineWidth = 1.5;
		for (let rr = 40; rr < 700; rr += 34 + r() * 10) {
			ctx.beginPath();
			for (let i = 0; i < angs.length; i++) {
				const a = angs[i];
				const sag = i > 0 ? 0.92 : 1;
				const x = Math.cos(a) * rr * sag;
				const y = Math.sin(a) * rr * sag;
				if (i === 0) ctx.moveTo(x, y);
				else {
					const pa = angs[i - 1];
					const mx = (Math.cos(pa) + Math.cos(a)) * 0.5 * rr * 0.86;
					const my = (Math.sin(pa) + Math.sin(a)) * 0.5 * rr * 0.86;
					ctx.quadraticCurveTo(mx, my, x, y);
				}
			}
			ctx.stroke();
		}
	}, {srgb: false});

// ------------------------------------------------------------------ text
export type TextLine = {text: string; size: number; color?: string; weight?: number; font?: string; y: number; x?: number; align?: CanvasTextAlign; chalk?: boolean};

/** generic sign / board texture with text lines (sizes in px of a w x h canvas) */
export const textTex = (key: string, w: number, h: number, bg: string | null, lines: TextLine[], opts: {border?: string; borderW?: number; radius?: number; chalk?: boolean} = {}) =>
	make(`text|${key}`, w, h, (ctx) => {
		if (bg) {
			ctx.fillStyle = bg;
			const rr = opts.radius ?? 0;
			ctx.beginPath();
			ctx.moveTo(rr, 0);
			ctx.arcTo(w, 0, w, h, rr);
			ctx.arcTo(w, h, 0, h, rr);
			ctx.arcTo(0, h, 0, 0, rr);
			ctx.arcTo(0, 0, w, 0, rr);
			ctx.fill();
			if (opts.border) {
				ctx.strokeStyle = opts.border;
				ctx.lineWidth = opts.borderW ?? 12;
				ctx.stroke();
			}
		}
		if (opts.chalk) {
			// smudges
			const r = mulberry32(31);
			for (let i = 0; i < 40; i++) {
				ctx.fillStyle = `rgba(255,255,255,${0.02 + r() * 0.04})`;
				ctx.beginPath();
				ctx.ellipse(r() * w, r() * h, 40 + r() * 120, 10 + r() * 30, r(), 0, Math.PI * 2);
				ctx.fill();
			}
		}
		for (const l of lines) {
			ctx.font = `${l.weight ?? 800} ${l.size}px ${l.font ?? POPPINS}, sans-serif`;
			ctx.textAlign = l.align ?? 'center';
			ctx.textBaseline = 'middle';
			ctx.fillStyle = l.color ?? '#ffffff';
			const x = l.x ?? w / 2;
			if (l.chalk || opts.chalk) {
				ctx.globalAlpha = 0.92;
				ctx.fillText(l.text, x, l.y);
				// chalk grain
				ctx.globalCompositeOperation = 'destination-out';
				const r = mulberry32(l.y);
				for (let i = 0; i < l.text.length * 60; i++) {
					ctx.fillStyle = `rgba(0,0,0,${0.25 + r() * 0.5})`;
					const tw = ctx.measureText(l.text).width;
					const x0 = (ctx.textAlign === 'center' ? x - tw / 2 : ctx.textAlign === 'right' ? x - tw : x) + r() * tw;
					ctx.fillRect(x0, l.y - l.size / 2 + r() * l.size, 1.5 + r() * 2, 1.5 + r() * 2);
				}
				ctx.globalCompositeOperation = 'source-over';
				ctx.globalAlpha = 1;
			} else {
				ctx.fillText(l.text, x, l.y);
			}
		}
	});

/** clock face (numbers + ticks); hands are 3D */
export const clockTex = () =>
	make('clock', 512, 512, (ctx, w, h) => {
		ctx.translate(w / 2, h / 2);
		ctx.fillStyle = '#fffaf0';
		ctx.beginPath();
		ctx.arc(0, 0, 250, 0, Math.PI * 2);
		ctx.fill();
		ctx.strokeStyle = '#1d1d24';
		ctx.lineWidth = 14;
		ctx.stroke();
		for (let i = 0; i < 60; i++) {
			const a = (i / 60) * Math.PI * 2;
			const big = i % 5 === 0;
			ctx.lineWidth = big ? 12 : 4;
			ctx.beginPath();
			ctx.moveTo(Math.sin(a) * (big ? 190 : 210), -Math.cos(a) * (big ? 190 : 210));
			ctx.lineTo(Math.sin(a) * 228, -Math.cos(a) * 228);
			ctx.stroke();
		}
		ctx.fillStyle = '#1d1d24';
		ctx.font = `800 54px ${POPPINS}, sans-serif`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		for (let i = 1; i <= 12; i++) {
			const a = (i / 12) * Math.PI * 2;
			ctx.fillText(String(i), Math.sin(a) * 148, -Math.cos(a) * 148 + 3);
		}
	});

/** newspaper page */
export const newspaperTex = () =>
	make('newspaper', 512, 384, (ctx, w, h) => {
		ctx.fillStyle = '#f2eee4';
		ctx.fillRect(0, 0, w, h);
		ctx.fillStyle = '#1d1d24';
		ctx.font = `900 46px ${POPPINS}, sans-serif`;
		ctx.textAlign = 'center';
		ctx.fillText('THE DAILY BUCKET', w / 2, 52);
		ctx.fillRect(20, 66, w - 40, 4);
		ctx.font = `800 28px ${POPPINS}, sans-serif`;
		ctx.fillText('LOCAL BOY FINDS GOLDEN THRONE?!', w / 2, 102);
		const r = mulberry32(77);
		ctx.fillStyle = '#c9c3b6';
		ctx.fillRect(24, 124, 200, 130);
		ctx.fillStyle = '#7d776b';
		for (let col = 0; col < 2; col++) {
			for (let i = 0; i < 12; i++) {
				const x = col === 0 ? 24 : 250;
				const y = (col === 0 ? 268 : 128) + i * 14;
				if (y > h - 16) break;
				ctx.fillRect(x, y, (col === 0 ? 200 : 238) * (0.7 + r() * 0.3), 6);
			}
		}
	});
export const canvasTex = make;
