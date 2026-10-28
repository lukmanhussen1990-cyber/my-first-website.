// Global texture cache. All sprites load before the ThreeCanvas mounts, so the first R3F render
// already has every texture (no frame can be captured with a missing image).
import {useEffect, useState} from 'react';
import {continueRender, delayRender, staticFile} from 'remotion';
import * as THREE from 'three';
import indexJson from '../../public/sprites/index.json';

export type SpriteMeta = {file: string; w: number; h: number; bbox: [number, number, number, number]; foot: [number, number]};
export const SPRITES = indexJson as unknown as Record<string, SpriteMeta>;

const cache = new Map<string, THREE.Texture>();

export const tex = (name: string): THREE.Texture => {
	const t = cache.get(name);
	if (!t) throw new Error(`Texture not preloaded: ${name}`);
	return t;
};

export const meta = (name: string): SpriteMeta => {
	const m = SPRITES[name];
	if (!m) throw new Error(`Unknown sprite: ${name}`);
	return m;
};

const loadImage = async (src: string) => {
	const img = new Image();
	img.src = src;
	await img.decode();
	return img;
};

let loading: Promise<void> | null = null;
const loadAll = () => {
	if (!loading) {
		loading = Promise.all(
			Object.entries(SPRITES).map(async ([name, m]) => {
				const img = await loadImage(staticFile(m.file));
				const t = new THREE.Texture(img);
				t.colorSpace = THREE.SRGBColorSpace;
				t.anisotropy = 8;
				t.generateMipmaps = true;
				t.minFilter = THREE.LinearMipmapLinearFilter;
				t.magFilter = THREE.LinearFilter;
				t.needsUpdate = true;
				cache.set(name, t);
			}),
		).then(() => undefined);
	}
	return loading;
};

export const usePreloadTextures = (): boolean => {
	const [ready, setReady] = useState(cache.size >= Object.keys(SPRITES).length);
	const [handle] = useState(() => (ready ? null : delayRender('Loading sprite textures')));
	useEffect(() => {
		if (ready) {
			if (handle !== null) continueRender(handle);
			return;
		}
		loadAll().then(() => setReady(true));
	}, [ready, handle]);
	return ready;
};

// Small procedural textures made once on a canvas (soft dots, gradients).
export const canvasTexture = (name: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) => {
	const hit = cache.get(name);
	if (hit) return hit;
	const c = document.createElement('canvas');
	c.width = w;
	c.height = h;
	draw(c.getContext('2d')!);
	const t = new THREE.CanvasTexture(c);
	t.colorSpace = THREE.SRGBColorSpace;
	cache.set(name, t);
	return t;
};

export const softDot = () =>
	canvasTexture('softDot', 64, 64, (ctx) => {
		const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
		g.addColorStop(0, 'rgba(255,255,255,1)');
		g.addColorStop(0.3, 'rgba(255,255,255,0.6)');
		g.addColorStop(1, 'rgba(255,255,255,0)');
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, 64, 64);
	});

export const blobShadow = () =>
	canvasTexture('blobShadow', 128, 128, (ctx) => {
		const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
		g.addColorStop(0, 'rgba(0,0,0,1)');
		g.addColorStop(0.45, 'rgba(0,0,0,0.55)');
		g.addColorStop(1, 'rgba(0,0,0,0)');
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, 128, 128);
	});
