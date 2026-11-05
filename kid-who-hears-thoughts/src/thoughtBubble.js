// Pop-in thought / speech bubbles (billboard sprites with a canvas texture).
import * as THREE from 'three';
import {FONT, canvasTex, clamp, easeOutBack, roundRect} from './lib.js';

function cloud(ctx, x, y, w, h) {
	ctx.beginPath();
	const n = 9;
	for (let i = 0; i < n; i++) {
		const a = (i / n) * Math.PI * 2;
		const cx = x + w / 2 + Math.cos(a) * w * 0.42;
		const cy = y + h / 2 + Math.sin(a) * h * 0.36;
		ctx.moveTo(cx + w * 0.16, cy);
		ctx.arc(cx, cy, w * 0.16, 0, Math.PI * 2);
	}
	ctx.ellipse(x + w / 2, y + h / 2, w * 0.43, h * 0.37, 0, 0, Math.PI * 2);
}

function drawPizza(ctx, x, y, s) {
	ctx.save();
	ctx.translate(x, y);
	ctx.fillStyle = '#f0b44a';
	ctx.beginPath();
	ctx.moveTo(0, -s);
	ctx.lineTo(-s * 0.7, s * 0.6);
	ctx.quadraticCurveTo(0, s * 0.85, s * 0.7, s * 0.6);
	ctx.closePath();
	ctx.fill();
	ctx.fillStyle = '#ffd54a';
	ctx.beginPath();
	ctx.moveTo(0, -s * 0.8);
	ctx.lineTo(-s * 0.55, s * 0.45);
	ctx.lineTo(s * 0.55, s * 0.45);
	ctx.closePath();
	ctx.fill();
	ctx.fillStyle = '#d6342f';
	[[0, -0.2], [-0.2, 0.2], [0.22, 0.25]].forEach(([a, b]) => {
		ctx.beginPath();
		ctx.arc(a * s, b * s, s * 0.12, 0, Math.PI * 2);
		ctx.fill();
	});
	ctx.restore();
}

/** Texture for a bubble. kind: 'thought' (cloud + trailing dots) or 'speech' (rounded + tail). */
export const bubbleTex = (text, kind = 'thought', color = '#ffffff', ink = '#1a1a1a') =>
	canvasTex(`bubble|${kind}|${text}|${color}`, 768, 512, (ctx, W, H) => {
		ctx.lineWidth = 12;
		ctx.strokeStyle = ink;
		ctx.fillStyle = color;
		if (kind === 'thought') {
			cloud(ctx, 40, 20, W - 80, H - 150);
			ctx.fill();
			ctx.stroke();
			cloud(ctx, 40, 20, W - 80, H - 150);
			ctx.fill();
			[[W * 0.3, H - 95, 26], [W * 0.22, H - 45, 16]].forEach(([x, y, r]) => {
				ctx.beginPath();
				ctx.arc(x, y, r, 0, Math.PI * 2);
				ctx.fill();
				ctx.stroke();
			});
		} else {
			roundRect(ctx, 30, 30, W - 60, H - 160, 110);
			ctx.fill();
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(W * 0.38, H - 132);
			ctx.lineTo(W * 0.3, H - 30);
			ctx.lineTo(W * 0.52, H - 132);
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
			ctx.fillRect(W * 0.37, H - 150, W * 0.16, 30);
		}
		const cy = kind === 'thought' ? 20 + (H - 150) / 2 : 30 + (H - 160) / 2;
		ctx.fillStyle = ink;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		if (text === 'pizza') {
			drawPizza(ctx, W * 0.33, cy, 80);
			ctx.font = `800 96px ${FONT}, sans-serif`;
			ctx.fillText('pizza...', W * 0.62, cy + 6);
			return;
		}
		if (text === '?') {
			ctx.font = `800 220px ${FONT}, sans-serif`;
			ctx.fillText('?', W / 2, cy + 12);
			return;
		}
		// wrap text to at most 3 lines
		const words = text.split(' ');
		let size = 110;
		const maxW = W * 0.66;
		let lines = [];
		for (; size > 40; size -= 6) {
			ctx.font = `800 ${size}px ${FONT}, sans-serif`;
			lines = [];
			let cur = '';
			for (const w of words) {
				const test = cur ? `${cur} ${w}` : w;
				if (ctx.measureText(test).width > maxW && cur) {
					lines.push(cur);
					cur = w;
				} else cur = test;
			}
			lines.push(cur);
			if (lines.length * size * 1.1 < (H - 200) * 0.85) break;
		}
		ctx.font = `800 ${size}px ${FONT}, sans-serif`;
		lines.forEach((l, i) => ctx.fillText(l, W / 2, cy + (i - (lines.length - 1) / 2) * size * 1.08 + size * 0.05));
	});

/** A bubble sprite. update(t) pops it in at `at` seconds (scale 0 -> 1.12 -> 1) and floats gently. */
export function makeBubble() {
	const material = new THREE.SpriteMaterial({transparent: true, depthWrite: false, depthTest: true});
	const sprite = new THREE.Sprite(material);
	sprite.renderOrder = 10;
	const set = (text, kind = 'thought', color = '#ffffff') => {
		material.map = bubbleTex(text, kind, color);
		material.needsUpdate = true;
	};
	/** Place the bubble; returns true if visible. */
	const place = (pos, size, t, at, opts = {}) => {
		const u = (t - at) / 0.28;
		if (u < 0) {
			sprite.visible = false;
			return false;
		}
		const s = size * (u < 1 ? easeOutBack(u, 2.6) : 1) * (opts.grow ? 1 + opts.grow * clamp(t - at) : 1);
		const fl = Math.sin((t + at) * 2.2) * 0.08 * size;
		sprite.visible = true;
		sprite.position.set(pos[0], pos[1] + fl, pos[2]);
		sprite.scale.set(s * 1.5, s, 1);
		material.opacity = opts.fadeAt !== undefined ? clamp(1 - (t - opts.fadeAt) / 0.3) : 1;
		material.rotation = opts.rot ?? 0;
		return true;
	};
	return {sprite, set, place};
}
