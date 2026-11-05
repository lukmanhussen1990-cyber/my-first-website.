import * as THREE from 'three';
import {POPPINS} from '../lib/fonts';

/* Canvas textures drawn in code (signs, icons, faces). Cached by key. */

const cache = new Map<string, THREE.CanvasTexture>();

export const canvasTex = (key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, srgb = true) => {
	let t = cache.get(key);
	if (!t) {
		const c = document.createElement('canvas');
		c.width = w;
		c.height = h;
		const ctx = c.getContext('2d')!;
		draw(ctx, w, h);
		t = new THREE.CanvasTexture(c);
		if (srgb) t.colorSpace = THREE.SRGBColorSpace;
		t.anisotropy = 8;
		t.generateMipmaps = true;
		t.minFilter = THREE.LinearMipmapLinearFilter;
		t.needsUpdate = true;
		cache.set(key, t);
	}
	return t;
};

export const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.arcTo(x + w, y, x + w, y + h, r);
	ctx.arcTo(x + w, y + h, x, y + h, r);
	ctx.arcTo(x, y + h, x, y, r);
	ctx.arcTo(x, y, x + w, y, r);
	ctx.closePath();
};

export type TextOpts = {
	w?: number;
	h?: number;
	bg?: string | null;
	color?: string;
	stroke?: string | null;
	strokeW?: number;
	weight?: number;
	size?: number;
	radius?: number;
	border?: string | null;
	borderW?: number;
	lines?: number;
	shadow?: boolean;
	italic?: boolean;
	align?: CanvasTextAlign;
};

/** A sign / label texture. Text may contain \n. Font auto-shrinks to fit. */
export const textTex = (text: string, o: TextOpts = {}) => {
	const w = o.w ?? 1024;
	const h = o.h ?? 256;
	return canvasTex(`txt|${text}|${JSON.stringify(o)}`, w, h, (ctx) => {
		if (o.bg) {
			ctx.fillStyle = o.bg;
			roundRect(ctx, 0, 0, w, h, o.radius ?? 0);
			ctx.fill();
		}
		if (o.border) {
			ctx.strokeStyle = o.border;
			ctx.lineWidth = o.borderW ?? 12;
			const b = (o.borderW ?? 12) / 2 + 4;
			roundRect(ctx, b, b, w - 2 * b, h - 2 * b, Math.max(0, (o.radius ?? 0) - b));
			ctx.stroke();
		}
		const lines = text.split('\n');
		let size = o.size ?? Math.floor((h / lines.length) * 0.62);
		const weight = o.weight ?? 800;
		const font = (s: number) => `${o.italic ? 'italic ' : ''}${weight} ${s}px ${POPPINS}, sans-serif`;
		ctx.font = font(size);
		const maxW = w * 0.9;
		const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
		if (widest > maxW) size = Math.floor((size * maxW) / widest);
		ctx.font = font(size);
		ctx.textAlign = o.align ?? 'center';
		ctx.textBaseline = 'middle';
		const lh = size * 1.12;
		const x = o.align === 'left' ? w * 0.05 : o.align === 'right' ? w * 0.95 : w / 2;
		lines.forEach((l, i) => {
			const y = h / 2 + (i - (lines.length - 1) / 2) * lh + size * 0.04;
			if (o.shadow) {
				ctx.fillStyle = 'rgba(0,0,0,0.35)';
				ctx.fillText(l, x + size * 0.04, y + size * 0.06);
			}
			if (o.stroke) {
				ctx.lineJoin = 'round';
				ctx.strokeStyle = o.stroke;
				ctx.lineWidth = o.strokeW ?? size * 0.16;
				ctx.strokeText(l, x, y);
			}
			ctx.fillStyle = o.color ?? '#ffffff';
			ctx.fillText(l, x, y);
		});
	});
};

/* ---------- Small icon textures ---------- */

export const glowTex = () =>
	canvasTex('glow', 128, 128, (ctx, w, h) => {
		const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
		g.addColorStop(0, 'rgba(255,255,255,1)');
		g.addColorStop(0.25, 'rgba(255,255,255,0.6)');
		g.addColorStop(1, 'rgba(255,255,255,0)');
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, w, h);
	});

export const fogTex = () =>
	canvasTex('fog', 256, 256, (ctx, w, h) => {
		const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
		g.addColorStop(0, 'rgba(255,255,255,0.55)');
		g.addColorStop(0.5, 'rgba(255,255,255,0.22)');
		g.addColorStop(1, 'rgba(255,255,255,0)');
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, w, h);
	});

export const sparkleTex = () =>
	canvasTex('sparkle', 128, 128, (ctx, w, h) => {
		const cx = w / 2;
		const cy = h / 2;
		const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, w / 2);
		g.addColorStop(0, 'rgba(255,255,230,0.9)');
		g.addColorStop(0.3, 'rgba(255,240,150,0.25)');
		g.addColorStop(1, 'rgba(255,240,150,0)');
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, w, h);
		ctx.fillStyle = '#fffbe0';
		ctx.beginPath();
		const R = w * 0.48;
		const r = w * 0.07;
		for (let i = 0; i < 8; i++) {
			const a = (i * Math.PI) / 4 - Math.PI / 2;
			const rad = i % 2 === 0 ? R : r;
			ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
		}
		ctx.closePath();
		ctx.fill();
	});

const heartPath = (ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) => {
	ctx.beginPath();
	ctx.moveTo(cx, cy + s * 0.35);
	ctx.bezierCurveTo(cx - s * 0.05, cy + s * 0.28, cx - s * 0.5, cy + s * 0.05, cx - s * 0.5, cy - s * 0.18);
	ctx.bezierCurveTo(cx - s * 0.5, cy - s * 0.42, cx - s * 0.2, cy - s * 0.5, cx, cy - s * 0.28);
	ctx.bezierCurveTo(cx + s * 0.2, cy - s * 0.5, cx + s * 0.5, cy - s * 0.42, cx + s * 0.5, cy - s * 0.18);
	ctx.bezierCurveTo(cx + s * 0.5, cy + s * 0.05, cx + s * 0.05, cy + s * 0.28, cx, cy + s * 0.35);
	ctx.closePath();
};

export const heartTex = (color = '#ff4f7a') =>
	canvasTex(`heart${color}`, 128, 128, (ctx, w) => {
		heartPath(ctx, w / 2, w / 2 + 6, w * 0.95);
		ctx.fillStyle = color;
		ctx.fill();
		ctx.lineWidth = 6;
		ctx.strokeStyle = 'rgba(120,0,40,0.35)';
		ctx.stroke();
		ctx.fillStyle = 'rgba(255,255,255,0.65)';
		ctx.beginPath();
		ctx.ellipse(w * 0.33, w * 0.36, w * 0.08, w * 0.05, -0.6, 0, Math.PI * 2);
		ctx.fill();
	});

export const zTex = () =>
	canvasTex('zzz', 128, 128, (ctx, w) => {
		ctx.font = `800 110px ${POPPINS}, sans-serif`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.lineJoin = 'round';
		ctx.lineWidth = 14;
		ctx.strokeStyle = '#2b3a67';
		ctx.strokeText('z', w / 2, w / 2);
		ctx.fillStyle = '#ffffff';
		ctx.fillText('z', w / 2, w / 2);
	});

export const dropTex = (color = '#5ec8ff') =>
	canvasTex(`drop${color}`, 64, 96, (ctx, w, h) => {
		ctx.beginPath();
		ctx.moveTo(w / 2, 4);
		ctx.bezierCurveTo(w * 0.62, h * 0.3, w * 0.95, h * 0.5, w * 0.95, h * 0.68);
		ctx.arc(w / 2, h * 0.68, w * 0.45, 0, Math.PI);
		ctx.bezierCurveTo(w * 0.05, h * 0.5, w * 0.38, h * 0.3, w / 2, 4);
		ctx.closePath();
		ctx.fillStyle = color;
		ctx.fill();
		ctx.lineWidth = 4;
		ctx.strokeStyle = 'rgba(20,60,120,0.6)';
		ctx.stroke();
		ctx.fillStyle = 'rgba(255,255,255,0.8)';
		ctx.beginPath();
		ctx.ellipse(w * 0.36, h * 0.66, w * 0.09, h * 0.08, 0, 0, Math.PI * 2);
		ctx.fill();
	});

export const bangTex = () =>
	canvasTex('bang', 128, 160, (ctx, w, h) => {
		ctx.font = `800 150px ${POPPINS}, sans-serif`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.lineJoin = 'round';
		ctx.lineWidth = 16;
		ctx.strokeStyle = '#3a1300';
		ctx.strokeText('!', w / 2, h / 2 + 6);
		ctx.fillStyle = '#ffd21f';
		ctx.fillText('!', w / 2, h / 2 + 6);
	});

/** Vertical gradient (for skies). stops: [offset, color][] from top to bottom. */
export const gradientTex = (key: string, stops: [number, string][]) =>
	canvasTex(`grad|${key}`, 4, 512, (ctx, w, h) => {
		const g = ctx.createLinearGradient(0, 0, 0, h);
		stops.forEach(([o, c]) => g.addColorStop(o, c));
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, w, h);
	});

/** Speech bubble with text. */
export const bubbleTex = (text: string, color = '#ffffff', ink = '#1a1a1a') =>
	canvasTex(`bubble|${text}|${color}`, 512, 300, (ctx, w, h) => {
		ctx.fillStyle = color;
		ctx.strokeStyle = ink;
		ctx.lineWidth = 10;
		roundRect(ctx, 14, 14, w - 28, h - 90, 90);
		ctx.fill();
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(w * 0.42, h - 80);
		ctx.lineTo(w * 0.36, h - 14);
		ctx.lineTo(w * 0.56, h - 80);
		ctx.closePath();
		ctx.fill();
		ctx.stroke();
		ctx.fillStyle = color;
		ctx.fillRect(w * 0.41, h - 96, w * 0.16, 22);
		ctx.font = `800 ${text.length > 7 ? 70 : 92}px ${POPPINS}, sans-serif`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillStyle = ink;
		ctx.fillText(text, w / 2, (h - 76) / 2 + 8);
	});

/** Simple noisy texture for wood / grass / paving. Deterministic. */
export const noiseTex = (key: string, base: string, vary: string, kind: 'wood' | 'grass' | 'tiles' | 'plain', rep = 1) => {
	const t = canvasTex(`noise|${key}`, 256, 256, (ctx, w, h) => {
		ctx.fillStyle = base;
		ctx.fillRect(0, 0, w, h);
		let s = 1234567;
		const r = () => {
			s = (s * 16807) % 2147483647;
			return s / 2147483647;
		};
		if (kind === 'wood') {
			ctx.strokeStyle = vary;
			for (let i = 0; i < 40; i++) {
				ctx.globalAlpha = 0.15 + r() * 0.2;
				ctx.lineWidth = 1 + r() * 3;
				const y = r() * h;
				ctx.beginPath();
				ctx.moveTo(0, y);
				ctx.bezierCurveTo(w * 0.3, y + (r() - 0.5) * 12, w * 0.6, y + (r() - 0.5) * 12, w, y + (r() - 0.5) * 8);
				ctx.stroke();
			}
		} else if (kind === 'grass') {
			for (let i = 0; i < 1400; i++) {
				ctx.globalAlpha = 0.2 + r() * 0.25;
				ctx.fillStyle = r() > 0.5 ? vary : base;
				ctx.fillRect(r() * w, r() * h, 2 + r() * 3, 4 + r() * 6);
			}
		} else if (kind === 'tiles') {
			ctx.strokeStyle = vary;
			ctx.lineWidth = 3;
			ctx.globalAlpha = 0.55;
			for (let i = 0; i <= 4; i++) {
				ctx.beginPath();
				ctx.moveTo(0, (i * h) / 4);
				ctx.lineTo(w, (i * h) / 4);
				ctx.stroke();
				for (let j = 0; j <= 4; j++) {
					const off = i % 2 ? w / 8 : 0;
					ctx.beginPath();
					ctx.moveTo((j * w) / 4 + off, (i * h) / 4);
					ctx.lineTo((j * w) / 4 + off, ((i + 1) * h) / 4);
					ctx.stroke();
				}
			}
			for (let i = 0; i < 300; i++) {
				ctx.globalAlpha = 0.06;
				ctx.fillStyle = vary;
				ctx.fillRect(r() * w, r() * h, 6, 6);
			}
		} else {
			for (let i = 0; i < 500; i++) {
				ctx.globalAlpha = 0.05 + r() * 0.06;
				ctx.fillStyle = vary;
				ctx.fillRect(r() * w, r() * h, 3 + r() * 6, 3 + r() * 6);
			}
		}
		ctx.globalAlpha = 1;
	});
	t.wrapS = THREE.RepeatWrapping;
	t.wrapT = THREE.RepeatWrapping;
	t.repeat.set(rep, rep);
	return t;
};
