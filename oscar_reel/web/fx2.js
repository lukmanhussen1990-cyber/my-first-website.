// New effects for the mansion reel (sprites + simple meshes, pixel-art canvases). Same rules as fx.js:
// pure functions of the call arguments + t, pooled meshes, emitters record the call and run in commit().
import * as THREE from 'three';
import { clamp, lerp, smooth, easeOutBack, easeOut, hash1, noise1, canvas } from './lib.js';

const V = (a) => (typeof a === 'function' ? V(a()) : a && a.isVector3 ? a.clone() : new THREE.Vector3(a[0], a[1], a[2]));
const h = (i, s) => hash1(i * 13.17 + s * 71.31);
const TAU = Math.PI * 2;

function pix(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; return t; }
function drawGrid(rows, pal, scale = 1) {     // rows of chars -> pixel canvas (palette by char)
  const H = rows.length, W = rows[0].length, c = canvas(W * scale, H * scale), g = c.getContext('2d');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const k = rows[y][x]; if (k === '.' || !pal[k]) continue; g.fillStyle = pal[k]; g.fillRect(x * scale, y * scale, scale, scale); }
  return c;
}
const HEART = ['..oo...oo..', '.oxxo.oxxo.', 'oxwxxoxxxxo', 'oxxxxxxxxxo', 'oxxxxxxxxxo', '.oxxxxxxxo.', '..oxxxxxo..', '...oxxxo...', '....oxo....', '.....o.....'];
const NOTE1 = ['....oooo', '....oxxo', '....oxo.', '....oxo.', '....oxo.', '.ooooxo.', 'oxxxxxo.', 'oxxxxxo.', '.ooooo..'];
const NOTE2 = ['..oooooooo', '..oxxxxxxo', '..oxooooxo', '..oxo..oxo', '..oxo..oxo', 'oooxo.oooxo'.slice(0, 10), 'oxxxooxxxo', 'oxxxooxxxo', '.ooo..ooo.'];
const QMARK = ['..oooo..', '.oxxxxo.', 'oxxooxxo', 'oxo.oxxo', '....oxxo', '...oxxo.', '..oxxo..', '..oxxo..', '..oooo..', '..oxxo..', '..oxxo..', '..oooo..'];
const STAR = ['...o...', '...x...', '..oxo..', 'oxxxxxo', '..oxo..', '.ox.xo.', '.o...o.'];

export function buildFX2(world) {
  const group = new THREE.Group(); group.name = 'fx2'; world.scene.add(group);
  const calls = [];
  let T = 0, CTX = null, CAM = null;
  const camPos = new THREE.Vector3(), camRight = new THREE.Vector3(), camUp = new THREE.Vector3(), camFwd = new THREE.Vector3();

  const pools = [];
  function pool(n, make, name, order = 50) {
    const items = [];
    for (let i = 0; i < n; i++) { const m = make(i); m.name = `fx2.${name}.${i}`; m.visible = false; m.renderOrder = order + i * 0.001; m.traverse((o) => { o.userData.noAudit = true; o.castShadow = false; o.receiveShadow = false; }); group.add(m); items.push(m); }
    const p = { items, used: 0, take() { return this.used < items.length ? items[this.used++] : null; } };
    pools.push(p); return p;
  }
  const spriteMat = (tex, o = {}) => new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: o.depthTest ?? true, fog: false, blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending, color: o.color || 0xffffff, opacity: 1 });

  // ---- textures
  const heartTex = pix(drawGrid(HEART, { o: '#7a1030', x: '#ff4a7a', w: '#ffd0e0' }, 4));
  const noteTex = [['#e83a3a', '#7a1010'], ['#3a8ae8', '#103a7a'], ['#ffd21e', '#7a5a00'], ['#3ae86a', '#0e5a24'], ['#c84ae8', '#5a107a']]
    .map(([x, o], i) => pix(drawGrid(i % 2 ? NOTE2 : NOTE1, { x, o }, 4)));
  const qTex = pix(drawGrid(QMARK, { o: '#2a1a10', x: '#ffd84a' }, 4));
  const starTex = pix(drawGrid(STAR, { o: '#fff6a0', x: '#ffffff' }, 4));
  const softC = canvas(32, 32); { const g = softC.getContext('2d'); const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); }
  const softTex = new THREE.CanvasTexture(softC);
  const blobC = canvas(16, 16); { const g = blobC.getContext('2d'); g.fillStyle = '#ffffff'; for (const [x, y, w, hh] of [[5, 1, 6, 14], [3, 3, 10, 10], [1, 5, 14, 6], [2, 4, 12, 8]]) g.fillRect(x, y, w, hh); }
  const blobTex = pix(blobC);
  const lineC = canvas(4, 32); { const g = lineC.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(1, 0, 2, 32); }
  const lineTex = pix(lineC);
  const arcC = canvas(32, 32); { const g = arcC.getContext('2d'); g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.beginPath(); g.arc(16, 30, 13, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); }
  const arcTex = pix(arcC);

  // ---- pools
  const P = {
    heart: pool(40, () => new THREE.Sprite(spriteMat(heartTex)), 'heart', 60),
    note: pool(30, (i) => new THREE.Sprite(spriteMat(noteTex[i % noteTex.length])), 'note', 61),
    q: pool(4, () => new THREE.Sprite(spriteMat(qTex)), 'question', 62),
    star: pool(16, () => new THREE.Sprite(spriteMat(starTex)), 'star', 63),
    glow: pool(10, () => new THREE.Sprite(spriteMat(softTex, { additive: true })), 'glow', 55),
    puff: pool(40, () => new THREE.Sprite(spriteMat(softTex)), 'puff', 52),
    blob: pool(90, () => new THREE.Sprite(spriteMat(blobTex)), 'blob', 53),
    streak: pool(160, () => new THREE.Sprite(spriteMat(lineTex)), 'streak', 54),
    arc: pool(12, () => new THREE.Sprite(spriteMat(arcTex)), 'arc', 64),
    speed: pool(36, () => new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide })), 'speed', 70),
    beam: pool(8, () => { const g = new THREE.ConeGeometry(1, 1, 10, 1, true); g.translate(0, -0.5, 0); return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.12, depthWrite: false, fog: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })); }, 'beam', 40),
    spot: pool(16, () => new THREE.Mesh(new THREE.CircleGeometry(1, 16), new THREE.MeshBasicMaterial({ map: softTex, color: '#ffffff', transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 })), 'spot', 41),
  };
  // water jet column: open cylinder with a scrolling stripe texture
  const jetC = canvas(16, 64); { const g = jetC.getContext('2d'); for (let y = 0; y < 64; y++) for (let x = 0; x < 16; x++) { const v = (Math.sin(y * 0.6 + x * 0.9) > 0.3) ? 255 : 160 + ((x * 7 + y * 3) % 40); g.fillStyle = `rgba(${v - 40},${v - 10},255,${0.75 + (v > 200 ? 0.2 : 0)})`; g.fillRect(x, y, 1, 1); } }
  const jetTex = pix(jetC); jetTex.wrapS = jetTex.wrapT = THREE.RepeatWrapping; jetTex.repeat.set(2, 3);
  const jet = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 12, 1, true), new THREE.MeshBasicMaterial({ map: jetTex, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide, opacity: 0.92 }));
  jet.name = 'fx2.jet'; jet.userData.noAudit = true; jet.renderOrder = 45; group.add(jet);
  const jetCore = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 8, 1, true), new THREE.MeshBasicMaterial({ color: '#eaf8ff', transparent: true, opacity: 0.7, depthWrite: false, fog: false }));
  jetCore.name = 'fx2.jetCore'; jetCore.userData.noAudit = true; jetCore.renderOrder = 44; group.add(jetCore);

  function place(s, pos, size, opacity = 1, rot = 0) { s.position.copy(pos); s.scale.set(size, size, 1); s.material.opacity = clamp(opacity); s.material.rotation = rot; s.visible = size > 1e-4 && opacity > 0.003; }
  const towardCam = (p, d) => p.clone().addScaledVector(camPos.clone().sub(p).normalize(), d);

  // ================================================================ emitters
  // hearts popping out of a point and floating up (count, spread, rise, size)
  function doHearts(o) {
    const t = o.t ?? T, t0 = o.t0 ?? 0, at = V(o.at), seed = o.seed ?? 3;
    const n = o.count ?? 6, life = o.life ?? 1.6, size = o.size ?? 0.12;
    for (let i = 0; i < n; i++) {
      const st = t0 + (o.every ? i * o.every : h(i, seed) * 0.25);
      let tau = t - st; if (o.loop && tau > 0) tau %= o.loop;
      if (tau < 0 || tau > life) continue;
      const s = P.heart.take(); if (!s) return;
      const a = (i / n) * TAU + h(i, seed + 1);
      const k = easeOut(clamp(tau / life));
      const pos = at.clone().addScaledVector(camRight, Math.cos(a) * (o.spread ?? 0.15) * (0.3 + k)).add(new THREE.Vector3(0, (o.rise ?? 0.35) * k + Math.sin(a) * 0.04, 0));
      pos.addScaledVector(camRight, Math.sin(tau * 5 + i) * 0.015);
      const sc = (tau < 0.18 ? easeOutBack(tau / 0.18, 2.4) : 1) * size * (0.8 + 0.4 * h(i, seed + 2)) * (1 + 0.08 * Math.sin(tau * 14));
      place(s, towardCam(pos, 0.02), sc, 1 - smooth((tau - life * 0.7) / (life * 0.3)));
      s.material.depthTest = !o.overlay;
    }
  }
  // one big glowing heart (chest) with a heartbeat scale pulse
  function doHeartGlow(o) {
    const t = o.t ?? T, at = V(o.at), amt = clamp(o.amount ?? 1);
    if (amt <= 0.001) return;
    const beat = o.beat ?? 0;
    const g = P.glow.take(); if (g) { place(g, towardCam(at, 0.03), (o.size ?? 0.16) * 3.2 * (1 + beat * 0.25), 0.55 * amt); g.material.color.set(o.glowColor || '#ff5a8a'); g.material.depthTest = !o.overlay; }
    const s = P.heart.take(); if (s) { place(s, towardCam(at, 0.04), (o.size ?? 0.16) * (1 + beat * 0.35) * amt, amt); s.material.depthTest = !o.overlay; }
  }
  // music notes rising and swaying from a point
  function doNotes(o) {
    const t = o.t ?? T, at = V(o.at), seed = o.seed ?? 5, amt = clamp(o.amount ?? 1), n = Math.round((o.count ?? 10) * amt);
    for (let i = 0; i < n; i++) {
      const per = 2.2 + h(i, seed) * 0.8, ph = ((t - (o.t0 ?? 0)) / per + h(i, seed + 1)) % 1;
      if (t < (o.t0 ?? 0)) continue;
      const s = P.note.take(); if (!s) return;
      const a = h(i, seed + 2) * TAU;
      const r = (o.spread ?? 1.2) * (0.3 + 0.7 * h(i, seed + 3));
      const pos = at.clone().add(new THREE.Vector3(Math.cos(a) * r, ph * (o.rise ?? 1.6), Math.sin(a) * r));
      pos.x += Math.sin(t * 3 + i) * 0.12;
      place(s, pos, (o.size ?? 0.22) * (ph < 0.12 ? easeOutBack(ph / 0.12, 2) : 1), (1 - smooth((ph - 0.75) / 0.25)) * amt, Math.sin(t * 4 + i) * 0.35);
    }
  }
  // "?" popping above a head
  function doQuestion(o) {
    const t = o.t ?? T, tau = t - (o.t0 ?? 0); if (tau < 0) return;
    const s = P.q.take(); if (!s) return;
    const sc = (tau < 0.2 ? easeOutBack(tau / 0.2, 2.6) : 1) * (o.size ?? 0.22);
    const pos = V(o.at).add(new THREE.Vector3(0, Math.sin(tau * 6) * 0.015, 0));
    place(s, pos, sc, o.t1 != null ? 1 - smooth((t - o.t1) / 0.15) : 1, Math.sin(tau * 5) * 0.15 + (o.roll ?? 0));
  }
  // dizzy stars circling around a head
  function doStars(o) {
    const t = o.t ?? T, c = V(o.at), n = o.count ?? 4, r = o.radius ?? 0.16;
    for (let i = 0; i < n; i++) {
      const s = P.star.take(); if (!s) return;
      const a = t * (o.speed ?? 5) + (i / n) * TAU;
      place(s, c.clone().add(new THREE.Vector3(Math.cos(a) * r, Math.sin(a * 2) * 0.02, Math.sin(a) * r)), (o.size ?? 0.07) * (0.8 + 0.2 * Math.sin(t * 9 + i)), clamp(o.amount ?? 1));
    }
  }
  // the water jet from the toilet up to the ceiling + a splash under the ceiling + indoor rain
  function doJet(o) {
    const t = o.t ?? T, amt = clamp(o.amount ?? 1); if (amt <= 0.001) return;
    const a = V(o.from), b = V(o.to);
    const len = a.distanceTo(b) * clamp(o.reach ?? 1);
    const r = (o.width ?? 0.09) * (0.6 + 0.4 * amt);
    const dir = b.clone().sub(a).normalize();
    for (const [m, k] of [[jet, 1], [jetCore, 0.5]]) {
      m.position.copy(a).addScaledVector(dir, len / 2);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      m.scale.set(r * k * (1 + 0.08 * Math.sin(t * 40)), len, r * k);
      m.visible = len > 0.01;
    }
    jetTex.offset.set(0, -t * 6);
    // splash at the top (when the jet reaches)
    if ((o.reach ?? 1) > 0.97) {
      const top = b.clone();
      for (let i = 0; i < 26; i++) {
        const s = P.blob.take(); if (!s) break;
        const ph = (t * (1.6 + h(i, 7) * 0.8) + h(i, 9)) % 1;
        const ang = h(i, 11) * TAU + t * 0.4;
        const rr = (0.2 + ph * 1.8) * (0.6 + 0.6 * h(i, 13));
        const pos = top.clone().add(new THREE.Vector3(Math.cos(ang) * rr, -0.05 - ph * ph * 1.4, Math.sin(ang) * rr));
        place(s, pos, (0.05 + 0.06 * h(i, 15)) * (1 - ph * 0.5) * amt, 0.9 * (1 - ph));
        s.material.color.set(i % 3 ? '#cfefff' : '#ffffff');
      }
    }
    // little droplets around the jet column
    for (let i = 0; i < 14; i++) {
      const s = P.blob.take(); if (!s) break;
      const ph = (t * 2.2 + h(i, 21)) % 1, y = h(i, 23) * len;
      const ang = h(i, 25) * TAU;
      const pos = a.clone().addScaledVector(dir, y).add(new THREE.Vector3(Math.cos(ang) * (r + ph * 0.35), -ph * 0.3, Math.sin(ang) * (r + ph * 0.35)));
      place(s, pos, 0.035 * amt, 0.85 * (1 - ph));
      s.material.color.set('#dff4ff');
    }
  }
  // falling streaks in a box (indoor rain from the ceiling splash / dripping)
  function doRain(o) {
    const t = o.t ?? T, amt = clamp(o.amount ?? 1); if (amt <= 0.001) return;
    const c = V(o.center), R = o.radius ?? 2.5, H = o.height ?? 4.5, n = Math.round((o.count ?? 90) * amt), sp = o.speed ?? 6;
    for (let i = 0; i < n; i++) {
      const s = P.streak.take(); if (!s) return;
      const ph = (t * sp / H + h(i, 31)) % 1;
      const ang = h(i, 33) * TAU, rr = Math.sqrt(h(i, 35)) * R;
      const pos = c.clone().add(new THREE.Vector3(Math.cos(ang) * rr, H * (1 - ph), Math.sin(ang) * rr));
      s.position.copy(pos); s.scale.set(0.012 * (o.thick ?? 1), 0.16 * (o.len ?? 1), 1); s.material.opacity = 0.55 * amt; s.material.rotation = 0; s.visible = true;
      s.material.color.set('#d8f0ff');
    }
  }
  // drops forming at points and falling (wet hair / nose / chin / sleeves)
  function doDrips(o) {
    const t = o.t ?? T, pts = (o.points || []).map(V), every = o.every ?? 0.55, g = 4.5;
    pts.forEach((p0, i) => {
      for (let k = 0; k < 2; k++) {
        const ph = ((t + h(i, 41) * every + k * every * 0.5) % every) / every;
        const s = P.blob.take(); if (!s) return;
        const fall = Math.max(0, ph - 0.45) * every;
        const pos = p0.clone().add(new THREE.Vector3(0, -0.5 * g * fall * fall, 0));
        const sz = (o.size ?? 0.022) * (ph < 0.45 ? 0.5 + ph : 1);
        place(s, towardCam(pos, 0.01), sz, ph > 0.95 ? 0 : 0.95);
        s.material.color.set('#bfe6ff');
      }
    });
  }
  // steam puffs rising (coffee)
  function doSteam(o) {
    const t = o.t ?? T, at = V(o.at), n = o.count ?? 7;
    for (let i = 0; i < n; i++) {
      const s = P.puff.take(); if (!s) return;
      const ph = (t * 0.6 + i / n) % 1;
      const pos = at.clone().add(new THREE.Vector3(Math.sin(t * 2 + i * 2) * 0.03 * ph, ph * (o.rise ?? 0.3), 0));
      place(s, pos, (o.size ?? 0.06) * (0.6 + ph), 0.42 * Math.sin(ph * Math.PI) * clamp(o.amount ?? 1));
      s.material.color.set('#ffffff');
    }
  }
  // stomach rumble: curved lines popping out around a point (brownish green)
  function doRumble(o) {
    const t = o.t ?? T, tau = t - (o.t0 ?? 0); if (tau < 0) return;
    const at = V(o.at), n = o.count ?? 6, dur = o.dur ?? 0.9;
    if (tau > dur) return;
    for (let i = 0; i < n; i++) {
      const s = P.arc.take(); if (!s) return;
      const a = (i / n) * TAU + 0.3;
      const k = clamp(tau / dur), r = (o.radius ?? 0.14) * (0.7 + k * 0.6);
      const pos = at.clone().addScaledVector(camRight, Math.cos(a) * r).addScaledVector(camUp, Math.sin(a) * r * 0.8);
      place(s, towardCam(pos, 0.05), (o.size ?? 0.09) * (k < 0.2 ? easeOutBack(k / 0.2, 2) : 1) * (1 + 0.15 * Math.sin(tau * 30 + i)), 1 - smooth((k - 0.7) / 0.3), a - Math.PI / 2);
      s.material.color.set(o.color || '#7a5a2a');
    }
  }
  // speed lines streaming past the camera (running)
  function doSpeed(o) {
    const t = o.t ?? T, amt = clamp(o.amount ?? 1); if (amt <= 0.001) return;
    const n = o.count ?? 24;
    for (let i = 0; i < n; i++) {
      const m = P.speed.take(); if (!m) return;
      const ph = (t * (o.speed ?? 3.5) + h(i, 51)) % 1;
      const a = h(i, 53) * TAU, rr = 0.55 + h(i, 55) * 0.5;
      const d = lerp(4.5, 0.4, ph);
      const pos = camPos.clone().addScaledVector(camFwd, d).addScaledVector(camRight, Math.cos(a) * rr * d * 0.55).addScaledVector(camUp, Math.sin(a) * rr * d * 0.95);
      m.position.copy(pos);
      m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(camRight.clone(), camFwd.clone(), camUp.clone().negate()));
      m.lookAt(camPos); m.rotateZ(Math.atan2(Math.sin(a) * 0.95, Math.cos(a) * 0.55) + Math.PI / 2);
      m.scale.set(0.012 * d, 0.5 * d * 0.4, 1);
      m.material.opacity = 0.45 * amt * Math.sin(ph * Math.PI);
      m.visible = true;
    }
  }
  // disco: coloured beams from the ball + light spots on the room walls (box room)
  const DCOLS = ['#ff3a6a', '#3a8aff', '#3aff7a', '#ffd23a', '#c84aff', '#3affff', '#ff8a3a', '#ffffff'];
  function doDisco(o) {
    const t = o.t ?? T, amt = clamp(o.amount ?? 1); if (amt <= 0.001) return;
    const c = V(o.at), room = o.room; // room = {x0,x1,y0,y1,z0,z1}
    for (let i = 0; i < 6; i++) {
      const m = P.beam.take(); if (!m) break;
      const a = t * 0.9 + (i / 6) * TAU, el = -0.55 - 0.35 * Math.sin(t * 0.7 + i);
      const dir = new THREE.Vector3(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el)).normalize();
      m.position.copy(c); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
      m.scale.set(0.45, o.len ?? 6, 0.45); m.material.color.set(DCOLS[i]); m.material.opacity = 0.1 * amt; m.visible = true;
    }
    if (!room) return;
    for (let i = 0; i < 14; i++) {
      const m = P.spot.take(); if (!m) break;
      const a = t * 0.8 + (i / 14) * TAU * 1.618, el = Math.sin(i * 1.7 + t * 0.5) * 0.7;
      const d = new THREE.Vector3(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el));
      // intersect the ray c + s d with the room box
      let best = 1e9, nrm = null;
      const tryP = (axis, val, n) => { const k = d[axis]; if (Math.abs(k) < 1e-4) return; const s = (val - c[axis]) / k; if (s > 0 && s < best) { best = s; nrm = n; } };
      tryP('x', room.x0, new THREE.Vector3(1, 0, 0)); tryP('x', room.x1, new THREE.Vector3(-1, 0, 0));
      tryP('y', room.y0, new THREE.Vector3(0, 1, 0)); tryP('y', room.y1, new THREE.Vector3(0, -1, 0));
      tryP('z', room.z0, new THREE.Vector3(0, 0, 1)); tryP('z', room.z1, new THREE.Vector3(0, 0, -1));
      if (!nrm) continue;
      const p = c.clone().addScaledVector(d, best).addScaledVector(nrm, 0.03);
      m.position.copy(p); m.lookAt(p.clone().add(nrm));
      const sz = 0.25 + 0.12 * best;
      m.scale.set(sz, sz, 1); m.material.color.set(DCOLS[i % DCOLS.length]); m.material.opacity = 0.55 * amt; m.visible = true;
    }
  }
  // soft glow sprite (lamp halo, heavenly light)
  function doGlow(o) {
    const s = P.glow.take(); if (!s) return;
    place(s, V(o.at), o.size ?? 1, clamp(o.amount ?? 1) * (o.opacity ?? 0.6));
    s.material.color.set(o.color || '#fff0c0'); s.material.depthTest = !o.overlay;
  }

  const DO = { hearts: doHearts, heartGlow: doHeartGlow, notes: doNotes, question: doQuestion, stars: doStars, jet: doJet, rain: doRain,
    drips: doDrips, steam: doSteam, rumble: doRumble, speed: doSpeed, disco: doDisco, glow: doGlow };
  const api = {
    group,
    reset(t, ctx) { T = t; CTX = ctx; calls.length = 0; for (const p of pools) { p.used = 0; for (const m of p.items) m.visible = false; } jet.visible = jetCore.visible = false; },
    commit(ctx) {
      CAM = ctx.camera; CAM.updateMatrixWorld(true);
      if (calls.length) world.scene.updateMatrixWorld();
      camPos.setFromMatrixPosition(CAM.matrixWorld);
      camRight.set(1, 0, 0).applyQuaternion(CAM.quaternion); camUp.set(0, 1, 0).applyQuaternion(CAM.quaternion); camFwd.set(0, 0, -1).applyQuaternion(CAM.quaternion);
      for (const [type, o] of calls) { try { DO[type](o); } catch (e) { console.error(`[log] fx2.${type} failed: ${e.message}`); } }
    },
    emitters: {},
  };
  for (const type of Object.keys(DO)) api.emitters[type] = (o = {}) => { calls.push([type, o || {}]); };
  return api;
}
