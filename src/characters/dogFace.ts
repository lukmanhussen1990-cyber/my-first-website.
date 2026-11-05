import {staticFile} from 'remotion';
import * as THREE from 'three';
import faceCfg from '../dogFace.json';
import {canvasTex} from '../three/textures';

/* The user's dog face image (cut out by scripts/prepare_face.py) + overlay textures drawn in code. */

export const FACE = faceCfg;

let faceTex: THREE.Texture | null = null;
let lidColor = '#c87a3a';
let lidColorDark = '#8d4a1c';
let loading: Promise<void> | null = null;

export const loadDogFace = () => {
	if (!loading) {
		loading = (async () => {
			const img = new Image();
			img.src = staticFile(faceCfg.image);
			await img.decode();
			const t = new THREE.Texture(img);
			t.colorSpace = THREE.SRGBColorSpace;
			t.anisotropy = 16;
			t.generateMipmaps = true;
			t.minFilter = THREE.LinearMipmapLinearFilter;
			t.magFilter = THREE.LinearFilter;
			t.needsUpdate = true;
			faceTex = t;
			// Sample the fur right around the eyes so code-drawn eyelids blend in.
			const c = document.createElement('canvas');
			c.width = img.naturalWidth;
			c.height = img.naturalHeight;
			const ctx = c.getContext('2d')!;
			ctx.drawImage(img, 0, 0);
			const sample = (u: number, v: number, r: number) => {
				const d = ctx.getImageData(Math.round(u * c.width - r), Math.round(v * c.height - r), r * 2, r * 2).data;
				let R = 0;
				let G = 0;
				let B = 0;
				let n = 0;
				for (let i = 0; i < d.length; i += 4) {
					if (d[i + 3] < 200) continue;
					R += d[i];
					G += d[i + 1];
					B += d[i + 2];
					n++;
				}
				return [R / n, G / n, B / n];
			};
			const L = faceCfg.layout;
			const a = sample(L.eyeL[0], L.eyeL[1] - 0.075, 10);
			const b = sample(L.eyeR[0], L.eyeR[1] - 0.075, 10);
			const avg = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
			const hex = (v: number[]) => '#' + v.map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
			lidColor = hex(avg);
			lidColorDark = hex(avg.map((x) => x * 0.72));
		})();
	}
	return loading;
};

export const getDogFace = () => faceTex;

/** Eyelid covering the top `amount` (0..1) of an eye. A dark lash line marks the lid edge. */
export const lidTex = (amount: number) => {
	const q = Math.round(Math.min(1, Math.max(0, amount)) * 10) / 10;
	return canvasTex(`lid|${q}|${lidColor}`, 256, 128, (ctx, w, h) => {
		const edge = h * (0.08 + q * 0.84);
		const g = ctx.createLinearGradient(0, 0, 0, edge);
		g.addColorStop(0, lidColor);
		g.addColorStop(1, lidColorDark);
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.lineTo(w, 0);
		ctx.lineTo(w, edge * 0.85);
		ctx.quadraticCurveTo(w / 2, edge * 1.18, 0, edge * 0.85);
		ctx.closePath();
		ctx.fill();
		ctx.strokeStyle = '#1b120c';
		ctx.lineWidth = 9;
		ctx.lineCap = 'round';
		ctx.beginPath();
		ctx.moveTo(6, edge * 0.85);
		ctx.quadraticCurveTo(w / 2, edge * 1.18, w - 6, edge * 0.85);
		ctx.stroke();
	});
};

/** Small cartoon eyebrows. kind: brave (angry, inner end low) or sad (inner end high). side: -1 left, 1 right. */
export const browTex = () =>
	canvasTex('dogbrow', 256, 64, (ctx, w, h) => {
		ctx.fillStyle = '#1c120c';
		ctx.beginPath();
		ctx.ellipse(w / 2, h / 2, w * 0.46, h * 0.36, 0, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = 'rgba(255,255,255,0.25)';
		ctx.beginPath();
		ctx.ellipse(w * 0.45, h * 0.38, w * 0.3, h * 0.08, 0, 0, Math.PI * 2);
		ctx.fill();
	});

export const blushTex = () =>
	canvasTex('blush', 128, 64, (ctx, w, h) => {
		const g = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
		g.addColorStop(0, 'rgba(255,110,150,0.85)');
		g.addColorStop(0.6, 'rgba(255,120,160,0.45)');
		g.addColorStop(1, 'rgba(255,120,160,0)');
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
		ctx.fill();
		ctx.strokeStyle = 'rgba(220,60,110,0.6)';
		ctx.lineWidth = 4;
		for (let i = 0; i < 3; i++) {
			ctx.beginPath();
			ctx.moveTo(w * (0.3 + i * 0.17), h * 0.62);
			ctx.lineTo(w * (0.38 + i * 0.17), h * 0.34);
			ctx.stroke();
		}
	});

/** Big round cartoon "shocked" eyes drawn over the real eyes. */
export const shockEyeTex = () =>
	canvasTex('shockeye', 128, 128, (ctx, w, h) => {
		ctx.fillStyle = '#ffffff';
		ctx.strokeStyle = '#1a0f08';
		ctx.lineWidth = 9;
		ctx.beginPath();
		ctx.ellipse(w / 2, h / 2, w * 0.44, h * 0.44, 0, 0, Math.PI * 2);
		ctx.fill();
		ctx.stroke();
		ctx.fillStyle = '#1a0f08';
		ctx.beginPath();
		ctx.arc(w / 2, h / 2, w * 0.13, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = '#ffffff';
		ctx.beginPath();
		ctx.arc(w * 0.46, h * 0.45, w * 0.04, 0, Math.PI * 2);
		ctx.fill();
	});

/** Happy closed eyes "^" shape over the real eyes, on a fur-coloured patch. */
export const happyEyeTex = () =>
	canvasTex(`happyeye|${lidColor}`, 256, 128, (ctx, w, h) => {
		const g = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.5);
		g.addColorStop(0, lidColor);
		g.addColorStop(0.75, lidColor);
		g.addColorStop(1, 'rgba(0,0,0,0)');
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.ellipse(w / 2, h / 2, w * 0.5, h * 0.5, 0, 0, Math.PI * 2);
		ctx.fill();
		ctx.strokeStyle = '#1b120c';
		ctx.lineWidth = 13;
		ctx.lineCap = 'round';
		ctx.beginPath();
		ctx.moveTo(w * 0.18, h * 0.66);
		ctx.quadraticCurveTo(w * 0.5, h * 0.1, w * 0.82, h * 0.66);
		ctx.stroke();
	});

export const tongueTex = () =>
	canvasTex('tongue', 128, 192, (ctx, w, h) => {
		ctx.fillStyle = '#ff6f8e';
		ctx.strokeStyle = '#a8264a';
		ctx.lineWidth = 6;
		ctx.beginPath();
		ctx.moveTo(w * 0.12, 0);
		ctx.lineTo(w * 0.12, h * 0.62);
		ctx.arc(w / 2, h * 0.62, w * 0.38, Math.PI, 0, true);
		ctx.lineTo(w * 0.88, 0);
		ctx.closePath();
		ctx.fill();
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(w / 2, h * 0.1);
		ctx.lineTo(w / 2, h * 0.6);
		ctx.stroke();
		ctx.fillStyle = 'rgba(255,255,255,0.35)';
		ctx.beginPath();
		ctx.ellipse(w * 0.33, h * 0.5, w * 0.08, h * 0.12, 0, 0, Math.PI * 2);
		ctx.fill();
	});
