// S2 — Proverbs 6:16 on a parchment scroll. A dusty beam from a high window falls on a dark table;
// the scroll unrolls toward the lens (the sheet really winds around its roll), the verse is lettered
// on the parchment and each word warms to gold as it is spoken; SEVEN shimmers.
import * as THREE from 'three';
import { texMat, woodTex, plasterTex, makeJar } from '../kit.js';
import { makeRays, makeMotes, makeSprites } from '../fx.js';
import { matte } from '../materials.js';
import { SERIF, SANS } from '../../lib/fonts.js';
import { clamp, smooth, invLerp, easeOut, lerp, hash01, fbm, noise2 } from '../../lib/util.js';

const PW = 1.5, PL = 3.4, R = 0.085, TOP = 1.0, Z0 = -2.35; // sheet width/length, roll radius, table top, far end
const CW = 1024, CH = Math.round(CW * PL / PW / 8) * 8;

function parchmentBg() {
  const c = document.createElement('canvas'); c.width = CW; c.height = CH; const g = c.getContext('2d');
  const img = g.createImageData(CW, CH); const d = img.data;
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
    const n = fbm(x * 0.006, y * 0.006, 4, 3), f = fbm(x * 0.05, y * 0.012, 2, 5), fib = noise2(x * 0.4, y * 0.02, 7);
    const ex = Math.min(x, CW - 1 - x) / CW, ey = Math.min(y, CH - 1 - y) / CH;
    const edge = smooth(clamp(ex * 9)) * smooth(clamp(ey * 26));
    const stain = smooth(invLerp(0.22, 0.5, fbm(x * 0.0025 + 9, y * 0.0025, 3, 8))) * 0.08;
    const k = (0.9 + n * 0.12 + f * 0.05 + fib * 0.025) * (0.62 + 0.38 * edge) * (1 - stain);
    const i = (y * CW + x) * 4; d[i] = 238 * k; d[i + 1] = 214 * k; d[i + 2] = 168 * k; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // ruled margin lines, faint
  g.strokeStyle = 'rgba(120,80,40,0.16)'; g.lineWidth = 2;
  for (const x of [70, CW - 70]) { g.beginPath(); g.moveTo(x, 60); g.lineTo(x, CH - 60); g.stroke(); }
  return c;
}

export function buildScroll(ctx) {
  const { plan } = ctx;
  const S2 = plan.shots.find((s) => s.id === 'S2');
  const g = new THREE.Group();
  // room: floor, back wall with the window opening, table
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30).rotateX(-Math.PI / 2), texMat('#5a4636', woodTex())); floor.receiveShadow = true; g.add(floor);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(30, 12), texMat('#7a6450', plasterTex())); wall.position.set(0, 6, -7); wall.receiveShadow = true; g.add(wall);
  const tw = 3.6, td = 7.0;
  const table = new THREE.Mesh(new THREE.BoxGeometry(tw, 0.12, td), texMat('#6a4a30', woodTex())); table.position.set(0, TOP - 0.06, -0.8); table.receiveShadow = true; table.castShadow = true; g.add(table);
  for (const [x, z] of [[-1.6, -4], [1.6, -4], [-1.6, 2.4], [1.6, 2.4]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.16, TOP - 0.12, 0.16), matte('#4a3220')); l.position.set(x, (TOP - 0.12) / 2, z); g.add(l); }
  // props on the table: clay oil lamp, inkwell + reed pen, a closed scroll
  const lamp = new THREE.Group(); lamp.position.set(-1.25, TOP, -1.9); g.add(lamp);
  const lb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.3, 0.55, 1), matte('#9a5a34')); lb.rotation.x = Math.PI; lb.position.y = 0.09; lamp.add(lb);
  const ink = makeJar(0.32, '#2e2a2a'); ink.position.set(1.05, TOP, -2.2); g.add(ink);
  const pen = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.008, 0.7, 5), matte('#c8a870')); pen.rotation.set(0.15, 0.4, Math.PI / 2 - 0.1); pen.position.set(0.95, TOP + 0.03, -1.55); g.add(pen);
  const closed = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.1, 14), texMat('#d9c09a', null)); closed.rotation.set(0, 0.5, Math.PI / 2); closed.position.set(-1.15, TOP + 0.1, 0.6); closed.castShadow = true; g.add(closed);
  const flame = makeSprites(2, { additive: true, fog: false, order: 8 }); g.add(flame.group);

  // ---- the sheet: (segs+1) x 2 vertices, positions computed every frame ----
  const segs = 260; const N = (segs + 1) * 2;
  const pos = new Float32Array(N * 3), uv = new Float32Array(N * 2), idx = [];
  for (let i = 0; i <= segs; i++) for (let j = 0; j < 2; j++) { const k = i * 2 + j; uv[k * 2] = j; uv[k * 2 + 1] = 1 - i / segs; }
  for (let i = 0; i < segs; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx);
  const canvas = document.createElement('canvas'); canvas.width = CW; canvas.height = CH; const cg = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const front = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex, side: THREE.FrontSide })); front.castShadow = true; front.receiveShadow = true;
  const backM = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: '#cdb183', side: THREE.BackSide })); backM.castShadow = true;
  front.frustumCulled = backM.frustumCulled = false; g.add(front, backM);
  // rods: far end (top of the scroll) + the travelling roll's handles
  const rodGeo = new THREE.CylinderGeometry(0.03, 0.03, PW + 0.34, 8).rotateZ(Math.PI / 2);
  const knob = new THREE.SphereGeometry(0.055, 10, 8);
  const mkRod = () => { const r = new THREE.Group(); const m = new THREE.Mesh(rodGeo, texMat('#6b4426', woodTex())); m.castShadow = true; r.add(m); for (const s of [-1, 1]) { const k = new THREE.Mesh(knob, matte('#5a3820')); k.position.x = s * (PW / 2 + 0.17); k.castShadow = true; r.add(k); } return r; };
  const rodFar = mkRod(); rodFar.position.set(0, TOP + 0.05, Z0 - 0.03); g.add(rodFar);
  const farRoll = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, PW, 16).rotateZ(Math.PI / 2), matte('#cdb183')); farRoll.position.copy(rodFar.position); farRoll.castShadow = true; g.add(farRoll);
  const rodNear = mkRod(); g.add(rodNear);

  // ---- words, karaoke-timed from the voice ----
  const words = plan.words.filter((w) => w.beat === 'B03').map((w) => ({ ...w, text: w.w.replace(/["“”]/g, '').replace(/^seven$/i, 'SEVEN') }));
  const lines = [[0, 3], [3, 6], [6, 9], [9, 12], [12, 15]];   // These six things | doth the LORD | hate: yea, SEVEN | are an abomination | unto him.
  const bg = parchmentBg();
  let lastKey = '';
  const draw = (t, fontsOk) => {
    const key = words.map((w) => (t < w.start ? 0 : t < w.end + 0.15 ? 1 : 2)).join('') + (fontsOk ? 'f' : '') + (Math.round(t * 15));
    if (key === lastKey) return; lastKey = key;
    cg.drawImage(bg, 0, 0);
    cg.textAlign = 'center'; cg.textBaseline = 'alphabetic';
    // reference line + ornament
    cg.font = `700 40px ${SANS}`; cg.fillStyle = 'rgba(120,72,30,0.95)';
    const ref = 'P R O V E R B S   6 : 1 6   ·   K J V'; cg.fillText(ref, CW / 2, 250);
    cg.strokeStyle = 'rgba(150,100,45,0.6)'; cg.lineWidth = 2; cg.beginPath(); cg.moveTo(CW / 2 - 170, 286); cg.lineTo(CW / 2 + 170, 286); cg.stroke();
    cg.beginPath(); cg.arc(CW / 2, 286, 6, 0, Math.PI * 2); cg.fillStyle = 'rgba(170,115,50,0.8)'; cg.fill();
    const fs = 88, lh = 118, y0 = 420;
    lines.forEach(([a, b], li) => {
      const ws = words.slice(a, b);
      cg.font = `600 ${fs}px ${SERIF}`;
      const widths = ws.map((w) => cg.measureText(w.text).width); const sp = cg.measureText(' ').width;
      const total = widths.reduce((x, y) => x + y, 0) + sp * (ws.length - 1);
      let x = CW / 2 - total / 2;
      ws.forEach((w, i) => {
        const y = y0 + li * lh; const cx = x + widths[i] / 2;
        const on = t >= w.start - 0.02 && t < w.end + 0.15; const done = t >= w.end + 0.15;
        const gold = w.text === 'SEVEN' || /hate/.test(w.text);
        const heat = on ? 1 : done && gold ? 0.8 : 0;
        cg.save();
        if (heat > 0 || w.text === 'SEVEN') {
          const sh = w.text === 'SEVEN' && t > w.start ? 0.5 + 0.5 * Math.sin(t * 9) : 0;
          cg.shadowColor = `rgba(255,190,90,${0.55 * heat + 0.35 * sh})`; cg.shadowBlur = 22 + 10 * sh;
        }
        cg.fillStyle = heat > 0 ? (gold ? '#b8741a' : '#8a4a18') : 'rgba(58,34,18,0.93)';
        if (w.text === 'SEVEN') { cg.font = `700 ${fs + 8}px ${SERIF}`; cg.fillStyle = t >= w.start ? '#c07a14' : '#7a4a1c'; }
        cg.fillText(w.text, cx, y);
        cg.restore();
        x += widths[i] + sp;
      });
    });
    tex.needsUpdate = true;
  };

  const rays = makeRays(4, 6); g.add(rays.group);
  const motes = makeMotes(220, 13); g.add(motes.group);
  const lightDir = new THREE.Vector3(0.42, -0.78, 0.46).normalize(); // beam travels down-right-forward

  const rollAt = (t) => { const u = clamp((t - S2.t0 + 0.05) / 1.35); return lerp(0.22, PL, 1 - (1 - u) ** 3); };
  return {
    group: g, persons: [], spotShadow: true,
    update(t, cam) {
      const sr = rollAt(t);
      for (let i = 0; i <= segs; i++) {
        const s = (i / segs) * PL;
        let y, z;
        if (s <= sr) { y = TOP + 0.004; z = Z0 + s; }
        else { const phi = (s - sr) / R; const r = Math.max(0.02, R - 0.0035 * phi); y = TOP + R + 0.004 - r * Math.cos(phi); z = Z0 + sr + r * Math.sin(phi); }
        for (let j = 0; j < 2; j++) { const k = (i * 2 + j) * 3; pos[k] = (j - 0.5) * PW; pos[k + 1] = y; pos[k + 2] = z; }
      }
      geo.attributes.position.needsUpdate = true; geo.computeVertexNormals(); geo.computeBoundingSphere();
      rodNear.position.set(0, TOP + R + 0.004, Z0 + sr); rodNear.rotation.x = (sr - 0.22) / R;
      draw(t, ctx.world.fontsOk);
      const fl = 0.85 + 0.15 * noise2(t * 8, 1, 3);
      flame.begin(); flame.add(-1.25 - 0.2, TOP + 0.2, -1.9, 0.12 * fl, 2.2 * fl, 1.3 * fl, 0.45 * fl, 1); flame.add(-1.45, TOP + 0.22, -1.9, 0.6, 0.5 * fl, 0.25 * fl, 0.08 * fl, 0.6); flame.end();
      rays.set(t, cam, [lightDir.x, lightDir.y, lightDir.z], [
        { p: [-0.25, TOP, -1.2], w: 0.9, len: 7, a: 0.16 }, { p: [0.35, TOP, -0.6], w: 0.6, len: 7, a: 0.12 },
        { p: [-0.6, TOP, -0.2], w: 0.5, len: 6, a: 0.1 }, { p: [0.1, TOP, -1.9], w: 0.7, len: 7, a: 0.1 },
      ], 1, [1.0, 0.82, 0.55]);
      motes.set(t, [0.0, TOP + 0.1, -1.0], [2.4, 2.6, 2.6], 1.1, [1.0, 0.8, 0.5], 0.012);
    },
    mood() {
      return {
        sky: { top: '#140e0a', horizon: '#1c140e', bottom: '#120c08' },
        sunDir: [-0.42, 0.78, -0.46], sun: { color: '#ffd9a6', intensity: 0.5 },
        hemi: { sky: '#7a6a58', ground: '#2a1c12', intensity: 0.55 },
        fog: { color: '#1a120c', near: 9, far: 30 }, char: '#ffffff', ao: 0,
        spot: { pos: [-2.94, TOP + 5.46, -4.42], target: [0.0, TOP, -1.2], color: '#ffd7a0', intensity: 140, angle: 0.36, penumbra: 0.75, distance: 30, decay: 2, shadow: true },
        shadow: { size: 3.5, y: TOP },
        post: { exposure: 1.0, bloom: 0.6, bloomThreshold: 0.8, haze: 0, tint: '#fff1dc', lift: '#0a0604', sat: 1.02, contrast: 1.06, vignette: 0.75, dof: 0.85, focusRange: 0.55, tilt: 0, grain: 0.035 },
      };
    },
  };
}
