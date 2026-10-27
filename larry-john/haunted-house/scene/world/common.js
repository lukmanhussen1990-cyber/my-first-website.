// Small helpers shared by the set builders.
import * as THREE from 'three';
import { clay } from '../../../engine/toon/materials.js';

export function add(parent, geo, mat, pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1], { shadow = true, name } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos); m.rotation.set(...rot);
  if (typeof scl === 'number') m.scale.setScalar(scl); else m.scale.set(...scl);
  m.castShadow = shadow; m.receiveShadow = true;
  if (name) m.name = name;
  parent.add(m);
  return m;
}

export function group(parent, pos = [0, 0, 0], rot = [0, 0, 0], name) {
  const g = new THREE.Group(); g.position.set(...pos); g.rotation.set(...rot);
  if (name) g.name = name;
  if (parent) parent.add(g);
  return g;
}

// Canvas texture helper (signs, wallpaper, paintings).
export function canvasTex(w, h, draw, { srgb = true, repeat = null } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}

// Instanced mesh from a list of [pos, rotY, scale] (shadows on).
export function instanced(geo, mat, items, { shadow = true } = {}) {
  const m = new THREE.InstancedMesh(geo, mat, items.length);
  const o = new THREE.Object3D();
  items.forEach(([p, ry = 0, s = 1, rx = 0, rz = 0], i) => {
    o.position.set(...p); o.rotation.set(rx, ry, rz);
    if (typeof s === 'number') o.scale.setScalar(s); else o.scale.set(...s);
    o.updateMatrix(); m.setMatrixAt(i, o.matrix);
  });
  m.castShadow = shadow; m.receiveShadow = true;
  m.instanceMatrix.needsUpdate = true;
  m.computeBoundingSphere();
  return m;
}

// Hand-lettered sign texture (Permanent Marker), cardboard/wood/paper backgrounds.
export function signTexture(lines, { w = 1024, h = 512, bg = '#c9a46a', ink = '#1e1a18', font = 'Permanent Marker', sizes = null,
  cardboard = true, rotate = -0.02, extra = null } = {}) {
  return canvasTex(w, h, (c) => {
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    if (cardboard) {
      // corrugation stripes + stains + tape
      c.globalAlpha = 0.07;
      for (let x = 0; x < w; x += 18) { c.fillStyle = x % 36 ? '#000' : '#fff'; c.fillRect(x, 0, 9, h); }
      c.globalAlpha = 0.12; c.fillStyle = '#7a5a2a';
      for (const [x, y, r] of [[0.2, 0.8, 60], [0.85, 0.25, 45], [0.6, 0.9, 30]]) { c.beginPath(); c.arc(x * w, y * h, r, 0, 7); c.fill(); }
      c.globalAlpha = 1;
    }
    c.save(); c.translate(w / 2, h / 2); c.rotate(rotate);
    c.fillStyle = ink; c.textAlign = 'center'; c.textBaseline = 'middle';
    const n = lines.length;
    lines.forEach((ln, i) => {
      const size = sizes ? sizes[i] : Math.min(h / (n + 0.4), 200);
      c.font = `${size}px "${font}"`;
      const y = (i - (n - 1) / 2) * (h / (n + 0.3));
      const txt = typeof ln === 'string' ? ln : ln.text;
      if (typeof ln !== 'string' && ln.color) c.fillStyle = ln.color; else c.fillStyle = ink;
      c.fillText(txt, 0, y);
    });
    c.restore();
    if (extra) extra(c, w, h);
  });
}

export const M = {
  wood: clay('#a8774c'), woodDark: clay('#7a5233'), woodLight: clay('#c79a66'),
  white: clay('#f7f5ee'), stone: clay('#cfd1cf', { roughness: 0.9 }),
};
