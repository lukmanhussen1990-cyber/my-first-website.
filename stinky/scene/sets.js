// Sets: bedroom, bathroom, sunny street, cozy cafe. All textures are canvas code.
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { mat, box, cyl, group, canvasTex, hash } from './lib.js';
import { drawText, drawCentered, measure } from './font.js';

export const OFFSETS = { bedroom: new THREE.Vector3(-60, 0, 0), bathroom: new THREE.Vector3(-60, 0, 40), street: new THREE.Vector3(60, 0, 0), cafe: new THREE.Vector3(0, 0, 0) };

function rep(tex, x, y) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(x, y); return tex; }
function tiles(c1, c2, n, grout = 'rgba(0,0,0,0.18)', px = 256) {
  return canvasTex(px, px, (ctx, w) => {
    const s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { ctx.fillStyle = (i + j) % 2 ? c1 : c2; ctx.fillRect(i * s, j * s, s, s); }
    ctx.fillStyle = grout;
    for (let i = 0; i <= n; i++) { ctx.fillRect(i * s - 1, 0, 3, w); ctx.fillRect(0, i * s - 1, w, 3); }
  });
}
function planks(c, px = 256) {
  return canvasTex(px, px, (ctx, w) => {
    ctx.fillStyle = c; ctx.fillRect(0, 0, w, w);
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.05)'; ctx.fillRect(0, i * w / 8, w, w / 8);
      ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(0, i * w / 8, w, 2); ctx.fillRect(((i * 97) % 200) + 20, i * w / 8, 2, w / 8);
    }
  });
}
function brick(c1, c2) {
  return canvasTex(256, 256, (ctx) => {
    ctx.fillStyle = c2; ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 16; y++) for (let x = -1; x < 9; x++) {
      ctx.fillStyle = (x * 7 + y * 3) % 5 === 0 ? c1 : (x + y) % 3 === 0 ? '#c46a4f' : '#b85a40';
      ctx.fillRect(x * 32 + (y % 2) * 16 + 1, y * 16 + 1, 30, 14);
    }
  });
}
function lambert(tex, extra = {}) { return new THREE.MeshLambertMaterial({ map: tex, ...extra }); }
function plane(w, h, m, parent, x, y, z, ry = 0, rx = 0) {
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  p.position.set(x, y, z); p.rotation.set(rx, ry, 0); p.receiveShadow = true; parent.add(p); return p;
}
function frameBox(parent, w, h, x, y, z, color, inner, t = 0.07) {
  const g = group(parent, x, y, z); const fm = mat(color);
  box(w, t, 0.06, fm, 0, h / 2 - t / 2, 0, g, false); box(w, t, 0.06, fm, 0, -h / 2 + t / 2, 0, g, false);
  box(t, h, 0.06, fm, -w / 2 + t / 2, 0, 0, g, false); box(t, h, 0.06, fm, w / 2 - t / 2, 0, 0, g, false);
  if (inner) plane(w - t * 1.6, h - t * 1.6, inner, g, 0, 0, 0.01);
  return g;
}
function pixelSign(w, h, bg, fg, text, s, border) {
  return canvasTex(w, h, (ctx) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    if (border) { ctx.strokeStyle = border; ctx.lineWidth = 6; ctx.strokeRect(5, 5, w - 10, h - 10); }
    const lines = text.split('\n');
    lines.forEach((ln, i) => drawCentered(ctx, ln, w / 2, h / 2 + (i - (lines.length - 1) / 2) * 10 * s, s, { color: fg }));
  }, { nearest: true });
}
function plant(parent, x, z, scale = 1, potColor = 0xb5562b) {
  const p = group(parent, x, 0, z); p.scale.setScalar(scale);
  cyl(0.24, 0.18, 0.42, 8, mat(potColor), 0, 0.21, 0, p);
  for (let i = 0; i < 8; i++) {
    const l = box(0.14, 0.6, 0.05, mat(i % 2 ? 0x2e8b3a : 0x3fa44a), Math.cos(i * 0.8) * 0.1, 0.7, Math.sin(i * 0.8) * 0.1, p);
    l.rotation.set(Math.sin(i * 2.1) * 0.45, i * 0.8, Math.cos(i * 1.3) * 0.45);
  }
  return p;
}

// ---------- phone lock screen with a message from her ----------
export function phoneScreenTex() {
  const tex = canvasTex(180, 360, () => {}, { nearest: true });
  tex.userData.draw = (k) => {
    const ctx = tex.userData.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, 360); g.addColorStop(0, '#3b4fa8'); g.addColorStop(1, '#c86ba8');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 180, 360);
    drawCentered(ctx, '7:50', 90, 70, 6, { color: '#ffffff' });
    drawCentered(ctx, 'Saturday', 90, 112, 2, { color: '#e8e8ff' });
    if (k > 0) {
      const y = 150 + (1 - Math.min(1, k)) * 30;
      ctx.globalAlpha = Math.min(1, k * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fillRect(10, y, 160, 92);
      ctx.fillStyle = '#ff6fa8'; ctx.fillRect(18, y + 10, 26, 26);
      drawText(ctx, '{heart}', 22, y + 16, 2.6);
      drawText(ctx, 'Crush', 52, y + 12, 2.2, { color: '#202040' });
      drawText(ctx, 'now', 136, y + 14, 1.6, { color: '#8080a0' });
      drawText(ctx, 'See you', 18, y + 46, 2.6, { color: '#202040' });
      drawText(ctx, 'soon {smile}', 18, y + 68, 2.6, { color: '#202040' });
      ctx.globalAlpha = 1;
    }
    tex.needsUpdate = true;
  };
  tex.userData.draw(0);
  return tex;
}

// ---------- mirror crack (drawn progressively) ----------
function crackTex() {
  const tex = canvasTex(512, 512, () => {}, { nearest: false });
  const r = (i) => hash(i * 7.31);
  const rays = Array.from({ length: 13 }, (_, i) => ({ a: i / 13 * Math.PI * 2 + r(i) * 0.4, len: 150 + r(i + 40) * 110, wob: r(i + 80) }));
  tex.userData.draw = (k) => {
    const ctx = tex.userData.ctx; ctx.clearRect(0, 0, 512, 512);
    if (k <= 0) { tex.needsUpdate = true; return; }
    ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    const cx = 250, cy = 230;
    for (const ray of rays) {
      ctx.beginPath(); ctx.moveTo(cx, cy);
      const L = ray.len * Math.min(1, k);
      for (let s = 0; s <= L; s += 18) {
        const ang = ray.a + Math.sin(s * 0.05 + ray.wob * 9) * 0.12;
        ctx.lineTo(cx + Math.cos(ang) * s, cy + Math.sin(ang) * s);
      }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(40,60,70,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 3;
    }
    for (const rr of [40, 95, 160]) {           // ring cracks
      if (k * 200 < rr) continue;
      ctx.beginPath();
      for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.3) { const q = rr + Math.sin(a * 5) * 8; a === 0 ? ctx.moveTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q) : ctx.lineTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q); }
      ctx.stroke();
    }
    tex.needsUpdate = true;
  };
  return tex;
}

export function buildSets(scene) {
  const S = {};
  // ======================= BEDROOM =======================
  {
    const g = group(scene); g.position.copy(OFFSETS.bedroom); S.bedroom = { group: g };
    plane(9, 8, lambert(rep(planks('#b07a4c'), 3, 3)), g, 0, 0, 0, 0, -Math.PI / 2);
    box(9, 5, 0.2, mat(0x9fb6d6), 0, 2.5, -3.1, g);
    box(0.2, 5, 8, mat(0x93abcd), -3.6, 2.5, 0.5, g);
    box(0.2, 5, 8, mat(0x93abcd), 3.6, 2.5, 0.5, g);
    const rug = canvasTex(128, 128, (ctx) => { ctx.fillStyle = '#e8a33d'; ctx.fillRect(0, 0, 128, 128); ctx.fillStyle = '#f7d27a'; for (let i = 0; i < 128; i += 16) ctx.fillRect(i, 0, 8, 128); ctx.strokeStyle = '#8a4b1a'; ctx.lineWidth = 6; ctx.strokeRect(4, 4, 120, 120); }, { nearest: true });
    plane(2.4, 1.6, lambert(rug), g, -0.2, 0.012, 0.8, 0, -Math.PI / 2);
    // bed
    const bed = group(g, 0, 0, -1.55); S.bedroom.bed = bed;
    box(2.2, 0.42, 3.1, mat(0x7a4a26), 0, 0.21, 0, bed);
    box(2.2, 1.3, 0.14, mat(0x6a3d1c), 0, 0.65, -1.55, bed);
    box(2.1, 0.22, 3.0, mat(0xf4f4f4), 0, 0.52, 0, bed);
    box(1.4, 0.2, 0.55, mat(0xffffff), 0, 0.72, -1.15, bed);
    const blanketTex = canvasTex(128, 128, (ctx) => { ctx.fillStyle = '#3e6fb0'; ctx.fillRect(0, 0, 128, 128); ctx.fillStyle = '#ffffff'; for (let y = 8; y < 128; y += 32) for (let x = (y / 32) % 2 ? 24 : 8; x < 128; x += 32) { ctx.fillRect(x + 4, y, 4, 12); ctx.fillRect(x, y + 4, 12, 4); } }, { nearest: true });
    const blanket = box(2.18, 0.26, 2.0, lambert(rep(blanketTex, 2, 2)), 0, 0.68, 0.5, bed);
    S.bedroom.blanket = blanket;
    // nightstand + alarm clock + phone
    const ns = group(g, 1.55, 0, -2.55);
    box(0.65, 0.62, 0.5, mat(0x8b5a2b), 0, 0.31, 0, ns); box(0.4, 0.05, 0.02, mat(0xd9b24a), 0, 0.42, 0.26, ns, false);
    const clock = group(ns, -0.1, 0.62, 0.05); S.bedroom.clock = clock;
    const body = group(clock, 0, 0.2, 0);
    const red = mat(0xd8312c, { std: true, roughness: 0.35, metalness: 0.2 });
    const face = cyl(0.17, 0.17, 0.09, 16, red, 0, 0, 0, body); face.rotation.x = Math.PI / 2;
    const dial = cyl(0.14, 0.14, 0.02, 16, mat(0xffffff), 0, 0, 0.05, body); dial.rotation.x = Math.PI / 2;
    box(0.015, 0.09, 0.01, mat(0x111111), 0, 0.035, 0.065, body, false);
    const mh = box(0.012, 0.12, 0.01, mat(0x111111), 0.03, 0.02, 0.066, body, false); mh.rotation.z = -0.9;
    for (const s of [1, -1]) {
      const bell = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xe8c24a, { std: true, metalness: 0.7, roughness: 0.3 }));
      bell.position.set(s * 0.11, 0.17, 0); bell.rotation.z = -s * 0.5; body.add(bell);
      box(0.03, 0.12, 0.03, mat(0x333333), s * 0.11, -0.16, 0, body);
    }
    S.bedroom.clockBody = body;
    const phone = group(ns, 0.15, 0.63, 0.02); S.bedroom.phoneSpot = phone;
    // window with morning sun + curtains + wilting plant on the sill
    frameBox(g, 1.5, 1.6, -2.0, 2.4, -2.98, 0xffffff, mat(0xfff3c8, { basic: true }));
    box(0.5, 2.0, 0.06, mat(0xf2b8c6), -2.95, 2.4, -2.9, g); box(0.5, 2.0, 0.06, mat(0xf2b8c6), -1.05, 2.4, -2.9, g);
    box(1.6, 0.06, 0.25, mat(0xffffff), -2.0, 1.58, -2.88, g);
    const pl = plant(g, -2.0, -2.82, 0.55); pl.position.y = 1.6; S.bedroom.plant = pl;
    // poster + lamp
    const poster = pixelSign(160, 200, '#1f2a44', '#ffd23f', 'GAME\nON', 5, '#ff5d93');
    frameBox(g, 0.9, 1.1, 2.0, 2.6, -2.98, 0xffffff, lambert(poster));
  }
  // ======================= BATHROOM =======================
  {
    const g = group(scene); g.position.copy(OFFSETS.bathroom); S.bathroom = { group: g };
    plane(8, 8, lambert(rep(tiles('#e6f2f7', '#7fb8d6', 4), 6, 6)), g, 0, 0, 0, 0, -Math.PI / 2);
    const wall = lambert(rep(tiles('#f4fbff', '#e2eff7', 8, 'rgba(90,140,170,0.35)'), 4, 3));
    box(8, 4.5, 0.2, wall, 0, 2.25, -2.6, g);
    box(0.2, 4.5, 6, wall, -2.6, 2.25, 0.2, g); box(0.2, 4.5, 6, wall, 2.6, 2.25, 0.2, g);
    // vanity + basin + faucet
    const v = group(g, 0, 0, -2.25); S.bathroom.vanity = v;
    box(1.8, 0.86, 0.6, mat(0xf2efe8), 0, 0.43, 0, v);
    box(1.9, 0.06, 0.66, mat(0xd8d8d8, { std: true, roughness: 0.3 }), 0, 0.89, 0, v);
    box(0.7, 0.05, 0.4, mat(0xbfd6e2), 0, 0.925, 0.02, v, false);
    const chrome = mat(0xe0e6ea, { std: true, metalness: 0.9, roughness: 0.15 });
    cyl(0.03, 0.03, 0.2, 8, chrome, 0, 1.0, -0.2, v); box(0.04, 0.04, 0.16, chrome, 0, 1.09, -0.13, v, false);
    // mirror + crack overlay
    frameBox(g, 1.35, 1.55, 0, 2.0, -2.48, 0x3b6e8c, null, 0.1);
    const mirror = new Reflector(new THREE.PlaneGeometry(1.2, 1.4), { textureWidth: 512, textureHeight: 600, color: 0xbfd0d8, clipBias: 0.003 });
    mirror.position.set(0, 2.0, -2.46); g.add(mirror); S.bathroom.mirror = mirror;
    const ct = crackTex();
    const crack = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.4), new THREE.MeshBasicMaterial({ map: ct, transparent: true, depthWrite: false }));
    crack.position.set(0, 2.0, -2.45); crack.renderOrder = 5; g.add(crack);
    S.bathroom.crackTex = ct;
    // cup + toothbrush, toothpaste, mouthwash, perfume, towel
    cyl(0.07, 0.06, 0.16, 10, mat(0x7fc8ff), -0.62, 1.0, -0.12, v);
    box(0.03, 0.3, 0.03, mat(0x3fbf6f), -0.6, 1.14, -0.12, v).rotation.z = -0.2;
    box(0.22, 0.06, 0.07, mat(0xffffff), -0.38, 0.95, 0.12, v).rotation.y = 0.4;
    const mw = group(v, 0.48, 0.92, -0.08); S.bathroom.mouthwashSpot = mw;
    box(0.14, 0.32, 0.1, mat(0x29a9e0, { std: true, roughness: 0.2, transparent: true, opacity: 0.88 }), 0, 0.16, 0, mw);
    box(0.08, 0.06, 0.08, mat(0xffffff), 0, 0.35, 0, mw);
    const pf = group(v, 0.7, 0.92, 0.0);
    box(0.12, 0.16, 0.08, mat(0xff8fc1, { std: true, roughness: 0.15, transparent: true, opacity: 0.9 }), 0, 0.08, 0, pf);
    box(0.05, 0.06, 0.05, mat(0xe8c24a, { std: true, metalness: 0.8, roughness: 0.25 }), 0, 0.19, 0, pf);
    box(0.5, 0.8, 0.06, pattern2('#ff9a8a', '#ffffff'), 1.6, 1.4, -2.47, g);
    box(0.7, 0.05, 0.08, chrome, 1.6, 1.85, -2.44, g, false);
  }
  // ======================= SUNNY STREET =======================
  {
    const g = group(scene); g.position.copy(OFFSETS.street); S.street = { group: g };
    const asphalt = canvasTex(256, 256, (ctx) => { ctx.fillStyle = '#4a4d55'; ctx.fillRect(0, 0, 256, 256); for (let i = 0; i < 900; i++) { ctx.fillStyle = hash(i) > 0.5 ? '#55585f' : '#43464d'; ctx.fillRect(hash(i * 3) * 256, hash(i * 7) * 256, 3, 3); } ctx.fillStyle = '#f2f2f2'; ctx.fillRect(0, 122, 90, 12); ctx.fillRect(160, 122, 90, 12); });
    plane(80, 8, lambert(rep(asphalt, 10, 1)), g, 0, 0, 5.5, 0, -Math.PI / 2);
    plane(80, 3.4, lambert(rep(tiles('#d8cfc0', '#cfc4b2', 4), 24, 1)), g, 0, 0.06, 0, 0, -Math.PI / 2);
    box(80, 0.12, 0.2, mat(0xbdb3a3), 0, 0.06, 1.75, g);
    // building facades (blocky, colorful, window grids)
    const winTex = (c) => canvasTex(128, 128, (ctx) => { ctx.fillStyle = c; ctx.fillRect(0, 0, 128, 128); for (let y = 10; y < 128; y += 42) for (let x = 12; x < 128; x += 40) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 3, y - 3, 30, 32); ctx.fillStyle = '#8ec9ff'; ctx.fillRect(x, y, 24, 26); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(x + 2, y + 2, 6, 10); } }, { nearest: true });
    const cols = ['#f2b880', '#9fd3c7', '#f7d36b', '#e88d7a', '#b8a4e3', '#8fc0e8'];
    for (let i = 0; i < 12; i++) {
      const h = 4 + (i * 37 % 5) * 0.9, w = 5.6;
      const b = box(w, h, 2, i % 3 === 1 ? lambert(rep(brick('#d27a5a', '#e9d8c4'), 2, 2)) : lambert(winTex(cols[i % cols.length])), -30 + i * 5.8, h / 2, -2.8, g);
      void b;
      box(w, 0.25, 2.3, mat(0xffffff), -30 + i * 5.8, h, -2.75, g);
      if (i % 2 === 0) { const aw = box(2.2, 0.08, 0.9, mat([0xe24a4a, 0x2f8fd8, 0x3fae5a][i % 3]), -30 + i * 5.8, 2.3, -1.4, g); aw.rotation.x = 0.35; }
      box(1.0, 2.0, 0.06, mat(0x6a3d1c), -30 + i * 5.8 + 1.5, 1.0, -1.79, g);
    }
    // trees, lamps, bench, parked car
    for (let i = 0; i < 10; i++) {
      const x = -28 + i * 6.3;
      cyl(0.1, 0.13, 1.8, 6, mat(0x6b4423), x, 0.9, 1.3, g);
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 0), mat(i % 2 ? 0x3fa44a : 0x4fb85a)); crown.position.set(x, 2.3, 1.3); crown.castShadow = true; g.add(crown);
      if (i % 2) { cyl(0.05, 0.06, 3.0, 6, mat(0x333a44), x + 3, 1.5, 1.45, g); box(0.4, 0.15, 0.25, mat(0x333a44), x + 3, 3.0, 1.35, g); box(0.25, 0.12, 0.18, mat(0xfff3c4, { basic: true }), x + 3, 2.92, 1.35, g, false); }
    }
    const car = group(g, 6, 0, 4.0);
    box(3.0, 0.7, 1.4, mat(0xe24a4a, { std: true, roughness: 0.35 }), 0, 0.6, 0, car); box(1.7, 0.6, 1.3, mat(0xe24a4a, { std: true, roughness: 0.35 }), -0.2, 1.2, 0, car);
    box(1.6, 0.45, 1.32, mat(0x8ec9ff, { std: true, roughness: 0.1 }), -0.2, 1.22, 0, car, false);
    for (const [x, z] of [[-1, 0.7], [1, 0.7], [-1, -0.7], [1, -0.7]]) { const w = cyl(0.3, 0.3, 0.22, 10, mat(0x1a1a1a), x, 0.3, z, car); w.rotation.x = Math.PI / 2; }
  }
  // ======================= COZY CAFE =======================
  {
    const g = group(scene); g.position.copy(OFFSETS.cafe); S.cafe = { group: g };
    plane(14, 12, lambert(rep(tiles('#2f2a28', '#e9e1d2', 8, 'rgba(0,0,0,0.25)'), 5, 5)), g, 0, 0, 0, 0, -Math.PI / 2);
    box(14, 4.6, 0.2, mat(0xf3dfc0), 0, 2.3, -4.2, g); box(14, 1.1, 0.04, mat(0x5f8f6a), 0, 0.55, -4.08, g, false);
    box(0.2, 4.6, 4.2, mat(0xeed4b0), -5.2, 2.3, -2.1, g); box(0.2, 4.6, 4.4, mat(0xeed4b0), -5.2, 2.3, 3.4, g); box(0.2, 2.1, 1.2, mat(0xeed4b0), -5.2, 3.55, 0.6, g);
    box(0.2, 4.6, 10, mat(0xeed4b0), 5.2, 2.3, 0.6, g);
    box(0.04, 1.1, 10, mat(0x5f8f6a), -5.08, 0.55, 0.6, g, false); box(0.04, 1.1, 10, mat(0x5f8f6a), 5.08, 0.55, 0.6, g, false);
    // big sunny window on the back wall + menu board + counter + coffee machine
    frameBox(g, 2.6, 1.7, -2.6, 2.4, -4.08, 0x5a3a22, mat(0xfff0c0, { basic: true }), 0.1);
    box(0.06, 1.6, 0.04, mat(0x5a3a22), -2.6, 2.4, -4.04, g, false);
    const menu = pixelSign(256, 160, '#22302a', '#f4ead2', 'CAFE\nCOFFEE  3\nCAKE  4', 4, '#c49a5a');
    frameBox(g, 1.6, 1.0, 1.2, 2.9, -4.08, 0x5a3a22, lambert(menu));
    const counter = group(g, 3.4, 0, -3.3);
    box(3.0, 1.05, 0.8, mat(0x7a4a26), 0, 0.52, 0, counter); box(3.1, 0.07, 0.9, mat(0xe9e1d2), 0, 1.08, 0, counter);
    box(0.5, 0.6, 0.4, mat(0x9aa5b1, { std: true, metalness: 0.7, roughness: 0.3 }), 0.6, 1.42, -0.1, counter);
    box(0.7, 0.4, 0.4, mat(0xf7e7c8), -0.6, 1.32, 0, counter); // cake case
    // pendant lamps
    for (const x of [-2.4, 0, 2.4]) { cyl(0.01, 0.01, 1.3, 4, mat(0x222222), x, 3.95, -1.6, g); cyl(0.12, 0.32, 0.26, 10, mat(0x2f5a3f), x, 3.2, -1.6, g); const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), mat(0xfff0b0, { basic: true })); bulb.position.set(x, 3.06, -1.6); g.add(bulb); }
    // tables + chairs + cups
    const table = (x, z) => {
      const t = group(g, x, 0, z);
      cyl(0.48, 0.48, 0.05, 16, mat(0xf4efe6), 0, 0.76, 0, t); cyl(0.04, 0.04, 0.74, 6, mat(0x333333), 0, 0.38, 0, t); cyl(0.25, 0.25, 0.03, 10, mat(0x333333), 0, 0.02, 0, t);
      return t;
    };
    const chair = (x, z, ry) => { const c = group(g, x, 0, z); c.rotation.y = ry; box(0.5, 0.06, 0.5, mat(0x9c6a3a), 0, 0.5, 0, c); box(0.5, 0.6, 0.06, mat(0x9c6a3a), 0, 0.82, -0.22, c); for (const [a, b] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) box(0.04, 0.5, 0.04, mat(0x5e3a1d), a, 0.25, b, c); return c; };
    const cup = (parent, x, z, c = 0xffffff) => { const u = group(parent, x, 0.79, z); cyl(0.07, 0.06, 0.12, 10, mat(c), 0, 0.06, 0, u); cyl(0.11, 0.11, 0.015, 12, mat(0xffffff), 0, 0.0, 0, u); cyl(0.06, 0.06, 0.01, 10, mat(0x5a3418), 0, 0.12, 0, u); return u; };
    S.cafe.dateTable = table(0, -1.7); chair(-0.72, -1.7, Math.PI / 2); chair(0.72, -1.7, -Math.PI / 2);
    cup(S.cafe.dateTable, -0.22, 0.05, 0xff8fb1); cup(S.cafe.dateTable, 0.22, -0.05);
    const cake = group(S.cafe.dateTable, 0.0, 0.79, 0.22); box(0.18, 0.1, 0.14, mat(0xf7e1b5), 0, 0.05, 0, cake); box(0.18, 0.03, 0.14, mat(0xff8fb1), 0, 0.11, 0, cake); box(0.03, 0.04, 0.03, mat(0xd8312c), 0, 0.14, 0, cake);
    S.cafe.tableB = table(2.6, -2.2); chair(2.0, -2.2, Math.PI / 2); chair(3.2, -2.2, -Math.PI / 2); cup(S.cafe.tableB, 0.15, 0.1); cup(S.cafe.tableB, -0.15, -0.1, 0x7fc8ff);
    S.cafe.tableC = table(-2.7, -2.6); chair(-2.7, -1.95, Math.PI); cup(S.cafe.tableC, 0.0, 0.2);
    plant(g, -4.6, -3.6, 1.1); plant(g, 4.7, -0.8, 1.0, 0x3b6e8c); plant(g, -4.6, 0.8, 0.9, 0xd9b24a);
    // entrance door with a bell (left wall)
    const doorH = group(g, -5.08, 0, 1.2); S.cafe.doorHinge = doorH;
    box(0.08, 2.5, 1.2, mat(0x6b3f22), 0, 1.25, -0.6, doorH); box(0.09, 1.2, 0.8, mat(0xbfe3ff, { basic: true }), 0.0, 1.55, -0.6, doorH, false);
    const outside = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshBasicMaterial({ color: 0xfff4d6 }));
    outside.position.set(-5.6, 1.3, 0.6); outside.rotation.y = Math.PI / 2; g.add(outside);   // sunny street glow through the door
    box(0.22, 2.5, 0.08, mat(0xeed4b0), -5.2, 1.25, 1.24, g); box(0.22, 2.5, 0.08, mat(0xeed4b0), -5.2, 1.25, -0.04, g);
    const bell = group(g, -4.95, 2.6, 0.55); S.cafe.bell = bell;
    const bm = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.16, 8), mat(0xe8c24a, { std: true, metalness: 0.8, roughness: 0.25 })); bm.position.y = -0.1; bell.add(bm);
    box(0.02, 0.1, 0.02, mat(0x333333), 0, 0.0, 0, bell);
  }
  return S;
}
function pattern2(a, b) { return lambert(canvasTex(64, 64, (ctx) => { ctx.fillStyle = a; ctx.fillRect(0, 0, 64, 64); ctx.fillStyle = b; ctx.fillRect(0, 48, 64, 6); ctx.fillRect(0, 8, 64, 3); }, { nearest: true })); }

// ---------- hand props ----------
export function makePhone(tex) {
  const g = new THREE.Group();
  box(0.2, 0.4, 0.03, mat(0x1b1b22, { std: true, roughness: 0.3 }), 0, 0, 0, g);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.36), new THREE.MeshBasicMaterial({ map: tex })); scr.position.z = 0.016; g.add(scr);
  return g;
}
export function makeToothbrush() {
  const g = new THREE.Group();
  box(0.04, 0.42, 0.03, mat(0x3fbf6f), 0, 0, 0, g);
  box(0.05, 0.1, 0.05, mat(0xffffff), 0, 0.24, 0.025, g);
  box(0.04, 0.06, 0.03, mat(0x7fdcff), 0, 0.27, 0.05, g); // toothpaste blob
  return g;
}
export function makeMintPack() {
  const g = new THREE.Group();
  box(0.16, 0.32, 0.07, mat(0x2fbf9f), 0, 0, 0, g);
  const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.12), new THREE.MeshBasicMaterial({ map: canvasTex(64, 56, (ctx) => { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 64, 56); drawCentered(ctx, 'MINT', 32, 28, 2.2, { color: '#1f8f6f' }); }, { nearest: true }) }));
  lab.position.set(0, 0.02, 0.036); g.add(lab);
  return g;
}
export function makeBottle() {
  const g = new THREE.Group();
  box(0.14, 0.32, 0.1, mat(0x29a9e0, { std: true, roughness: 0.2 }), 0, 0, 0, g); box(0.07, 0.06, 0.07, mat(0xffffff), 0, 0.19, 0, g);
  return g;
}
export function makeSprayCan() {
  const g = new THREE.Group();
  cyl(0.07, 0.07, 0.34, 10, mat(0x7fdc7f, { std: true, roughness: 0.3, metalness: 0.4 }), 0, 0, 0, g);
  cyl(0.05, 0.06, 0.06, 8, mat(0xffffff), 0, 0.2, 0, g); box(0.03, 0.03, 0.05, mat(0xffffff), 0, 0.22, 0.04, g);
  return g;
}
export function makeMint() {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.015, 10), mat(0xffffff));
  return m;
}
