/**
 * Procedural canvas textures — no external images, fully deterministic.
 */
import * as THREE from 'three';
import { rand } from './math';

const cache = new Map<string, THREE.Texture>();
const memo = <T extends THREE.Texture>(key: string, make: () => T): T => {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key) as T;
};

const canvas = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

/** Matte teal-slate wall tiles with soft grout + per-tile shade variation. */
export const tileTexture = () =>
  memo('tiles', () => {
    const size = 1024;
    const n = 8;
    const c = canvas(size, size);
    const g = c.getContext('2d')!;
    const cell = size / n;
    g.fillStyle = '#2f5d5e'; // grout
    g.fillRect(0, 0, size, size);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const i = y * n + x;
        const l = 44 + rand(i, 1) * 5; // lightness jitter
        const hue = 178 + rand(i, 2) * 6;
        const pad = 5;
        const x0 = x * cell + pad;
        const y0 = y * cell + pad;
        const s = cell - pad * 2;
        // tile body
        g.fillStyle = `hsl(${hue}, 24%, ${l}%)`;
        g.beginPath();
        g.roundRect(x0, y0, s, s, 7);
        g.fill();
        // soft top-left highlight / bottom-right shade → fake bevel
        const grad = g.createLinearGradient(x0, y0, x0 + s, y0 + s);
        grad.addColorStop(0, 'rgba(255,255,255,0.10)');
        grad.addColorStop(0.5, 'rgba(255,255,255,0)');
        grad.addColorStop(1, 'rgba(0,0,0,0.12)');
        g.fillStyle = grad;
        g.beginPath();
        g.roundRect(x0, y0, s, s, 7);
        g.fill();
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
    return tex;
  });

/** Large, low-contrast workshop floor tiles. */
export const floorTexture = () =>
  memo('floor', () => {
    const size = 1024;
    const n = 4;
    const c = canvas(size, size);
    const g = c.getContext('2d')!;
    const cell = size / n;
    g.fillStyle = '#3c4f53';
    g.fillRect(0, 0, size, size);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const i = y * n + x;
        const l = 39 + rand(i, 7) * 3;
        g.fillStyle = `hsl(190, 10%, ${l}%)`;
        g.fillRect(x * cell + 3, y * cell + 3, cell - 6, cell - 6);
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
    return tex;
  });

/** Soft round glow sprite (white → transparent). */
export const glowTexture = () =>
  memo('glow', () => {
    const size = 256;
    const c = canvas(size, size);
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    grad.addColorStop(0.6, 'rgba(255,255,255,0.12)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  });

/** Building facade: pastel wall with a grid of windows. */
export const windowTexture = () =>
  memo('windows', () => {
    const c = canvas(256, 512);
    const g = c.getContext('2d')!;
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 256, 512);
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 4; x++) {
        g.fillStyle = rand(x + y * 4, 3) > 0.75 ? '#fff3c4' : '#8fb7c9';
        g.fillRect(18 + x * 60, 22 + y * 62, 38, 40);
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  });
