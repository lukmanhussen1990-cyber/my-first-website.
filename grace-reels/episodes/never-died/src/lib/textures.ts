// Global texture cache. All sprites load before the ThreeCanvas mounts, so the first R3F render
// already has every texture (no frame can be captured with a missing image).
import {useEffect, useState} from 'react';
import {continueRender, delayRender, staticFile} from 'remotion';
import * as THREE from 'three';
import spritesJson from '../../public/sprites/sprites.json';

export type SpriteMeta = {file: string; w: number; h: number; foot: [number, number]; top: number};
export const SPRITES = spritesJson as Record<string, SpriteMeta>;

const cache = new Map<string, THREE.Texture>();

export const tex = (name: string): THREE.Texture => {
	const t = cache.get(name);
	if (!t) throw new Error(`Texture not preloaded: ${name}`);
	return t;
};

export const hasTex = (name: string) => cache.has(name);

const loadImage = async (src: string) => {
	const img = new Image();
	img.src = src;
	await img.decode();
	return img;
};

export const registerTexture = (name: string, t: THREE.Texture) => {
	cache.set(name, t);
};

// Extra (non-sprite) images, e.g. derived characters made by tools/derive_characters.py.
export const EXTRA_IMAGES: Record<string, string> = {};

export const usePreloadTextures = (): boolean => {
	const [ready, setReady] = useState(cache.size > 0);
	const [handle] = useState(() => (cache.size > 0 ? null : delayRender('Loading sprite textures')));
	useEffect(() => {
		if (ready) {
			if (handle !== null) continueRender(handle);
			return;
		}
		const entries: [string, string][] = [
			...Object.entries(SPRITES).map(([k, m]) => [k, m.file] as [string, string]),
			...Object.entries(EXTRA_IMAGES),
		];
		Promise.all(
			entries.map(async ([name, file]) => {
				const img = await loadImage(staticFile(file));
				const t = new THREE.Texture(img);
				t.colorSpace = THREE.SRGBColorSpace;
				t.anisotropy = 8;
				t.generateMipmaps = true;
				t.minFilter = THREE.LinearMipmapLinearFilter;
				t.magFilter = THREE.LinearFilter;
				t.needsUpdate = true;
				cache.set(name, t);
			}),
		).then(() => setReady(true));
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
		g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
		g.addColorStop(1, 'rgba(255,255,255,0)');
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, 64, 64);
	});

export const blobShadow = () =>
	canvasTexture('blobShadow', 128, 64, (ctx) => {
		const g = ctx.createRadialGradient(64, 32, 0, 64, 32, 64);
		g.addColorStop(0, 'rgba(40,25,10,0.75)');
		g.addColorStop(0.5, 'rgba(40,25,10,0.35)');
		g.addColorStop(1, 'rgba(40,25,10,0)');
		ctx.setTransform(1, 0, 0, 0.5, 0, 16);
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, 128, 128);
	});
