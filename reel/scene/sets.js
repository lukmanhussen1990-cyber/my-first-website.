// The three sets: couple's bedroom, parents' front door, parents' living room.
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { mat, box, cyl, group, canvasTex } from './lib.js';

export const OFFSETS = { bedroom: new THREE.Vector3(-60, 0, 0), door: new THREE.Vector3(60, 0, 0), living: new THREE.Vector3(0, 0, 0) };
const FONT = '"Pixelify Sans", monospace';

function tiles(c1, c2, n = 8, px = 512, grout = '#00000022') {
  const t = canvasTex(px, px, (ctx, w) => {
    const s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { ctx.fillStyle = (i + j) % 2 ? c1 : c2; ctx.fillRect(i * s, j * s, s, s); }
    ctx.strokeStyle = grout; ctx.lineWidth = 3;
    for (let i = 0; i <= n; i++) { ctx.beginPath(); ctx.moveTo(i * s, 0); ctx.lineTo(i * s, w); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i * s); ctx.lineTo(w, i * s); ctx.stroke(); }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function planks(c, px = 512) {
  const t = canvasTex(px, px, (ctx, w) => {
    ctx.fillStyle = c; ctx.fillRect(0, 0, w, w);
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)'; ctx.fillRect(0, i * w / 8, w, w / 8);
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(0, i * w / 8, w, 3);
      ctx.fillRect(((i * 197) % 400) + 40, i * w / 8, 3, w / 8);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function texMat(tex, repeat = [1, 1], opts = {}) {
  if (repeat) tex.repeat.set(repeat[0], repeat[1]);
  return new THREE.MeshLambertMaterial({ map: tex, ...opts });
}
function plane(w, h, material, parent, x, y, z, ry = 0, rx = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
  m.position.set(x, y, z); m.rotation.set(rx, ry, 0); m.receiveShadow = true;
  parent.add(m);
  return m;
}
function frameBox(parent, w, h, x, y, z, frameColor, inner, t = 0.07, ry = 0) {
  const g = group(parent, x, y, z); g.rotation.y = ry;
  const fm = mat(frameColor);
  box(w, t, 0.06, fm, 0, h / 2 - t / 2, 0, g, false); box(w, t, 0.06, fm, 0, -h / 2 + t / 2, 0, g, false);
  box(t, h, 0.06, fm, -w / 2 + t / 2, 0, 0, g, false); box(t, h, 0.06, fm, w / 2 - t / 2, 0, 0, g, false);
  if (inner) plane(w - t * 1.6, h - t * 1.6, inner, g, 0, 0, 0.01);
  return g;
}

// --- little pixel portraits for the photo frames ---
function portraitTex(kind) {
  return canvasTex(64, 80, (ctx) => {
    const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
    R(0, 0, 64, 80, kind === 'wedding' ? '#f6c8d8' : kind === 'grandpa' ? '#d9d4c8' : kind === 'dad' ? '#b9d7ee' : '#f7e3a1');
    const face = (x, y, skin, hair, opts = {}) => {
      R(x, y, 18, 18, skin); R(x, y - 3, 18, 5, hair);
      R(x + 3, y + 6, 4, 4, '#fff'); R(x + 11, y + 6, 4, 4, '#fff'); R(x + 4, y + 7, 2, 3, '#111'); R(x + 12, y + 7, 2, 3, '#111');
      if (opts.must) R(x + 3, y + 12, 12, 3, '#111'); else R(x + 6, y + 13, 6, 2, opts.smile ? '#7a1e22' : '#4a2a1e');
      if (opts.glasses) { R(x + 2, y + 5, 6, 1, '#111'); R(x + 10, y + 5, 6, 1, '#111'); }
    };
    if (kind === 'wedding') {
      face(10, 22, '#c28760', '#16110e', { smile: true }); R(8, 42, 22, 38, '#20232a'); R(17, 42, 4, 14, '#ffffff');
      face(36, 22, '#d6a07a', '#16110e', { smile: true }); R(34, 42, 22, 38, '#ffffff'); R(33, 18, 20, 4, '#f4f4f4');
      R(40, 52, 8, 6, '#ff6fae'); R(42, 50, 4, 2, '#3a9a3a');
    } else if (kind === 'dad') {
      face(23, 24, '#ab7650', '#4a4642', { must: true, glasses: true }); R(18, 44, 28, 36, '#f3f0e8');
    } else if (kind === 'grandpa') {
      face(23, 24, '#9c6c4a', '#ddd', { must: true, glasses: true }); R(18, 44, 28, 36, '#6b5b4a');
    } else {
      face(14, 26, '#c48a63', '#1d1714', { smile: true }); R(10, 46, 24, 34, '#1f9d55');
      face(34, 30, '#d6a07a', '#16110e', { smile: true }); R(32, 50, 20, 30, '#ff5ea0');
    }
  }, { nearest: true });
}

export function calendarTex() {
  const tex = canvasTex(256, 360, () => {}, { nearest: false });
  tex.userData.draw = (progress) => {
    const ctx = tex.userData.ctx;
    ctx.fillStyle = '#fbf7ee'; ctx.fillRect(0, 0, 256, 360);
    ctx.fillStyle = '#c8302c'; ctx.fillRect(0, 0, 256, 70);
    ctx.fillStyle = '#ffffff'; ctx.font = `700 34px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('NOVEMBER', 128, 44);
    ctx.font = `500 16px ${FONT}`; ctx.fillText('2026', 128, 64);
    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    ctx.fillStyle = '#7b6a58'; ctx.font = `700 16px ${FONT}`;
    days.forEach((d, i) => ctx.fillText(d, 22 + i * 35.5, 96));
    ctx.font = `600 20px ${FONT}`;
    for (let d = 1; d <= 30; d++) {
      const idx = d - 1, col = idx % 7, row = Math.floor(idx / 7);
      ctx.fillStyle = col === 0 ? '#c8302c' : '#3a2e26';
      ctx.fillText(String(d), 22 + col * 35.5, 128 + row * 38);
    }
    // the date circled in red (8th), drawn progressively
    if (progress > 0) {
      ctx.strokeStyle = '#e0141e'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath();
      const a0 = -2.2, a1 = a0 + Math.PI * 2.25 * Math.min(1, progress);
      for (let a = a0; a <= a1; a += 0.05) {
        const r = 20 + Math.sin(a * 3) * 1.5;
        const x = 22 + r * 1.15 * Math.cos(a), y = 160 + r * Math.sin(a);
        a === a0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      if (progress > 1) {
        ctx.fillStyle = '#e0141e'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center';
        const txt = 'MEET HER PARENTS!!!';
        ctx.fillText(txt.slice(0, Math.floor((progress - 1) * 40)), 128, 335);
      }
    }
    tex.needsUpdate = true;
  };
  tex.userData.draw(0);
  return tex;
}

function textTex(w, h, bg, fg, text, size, extra) {
  return canvasTex(w, h, (ctx) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    if (extra) extra(ctx, w, h);
    ctx.fillStyle = fg; ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + 2);
  });
}

// ------------------------------------------------------------------------------------------
export function buildSets(scene) {
  const S = {};
  // ===================== BEDROOM =====================
  {
    const g = group(scene); g.position.copy(OFFSETS.bedroom); S.bedroom = { group: g };
    const wallM = mat(0xf4c9a0), floorM = texMat(planks('#a3683b'), [3, 3]);
    plane(10, 8, floorM, g, 0, 0, 0, 0, -Math.PI / 2);
    box(10, 5, 0.2, wallM, 0, 2.5, -3.1, g);
    box(0.2, 5, 8, wallM, -4.6, 2.5, 0.5, g);
    box(0.2, 5, 8, mat(0xefbf93), 4.6, 2.5, 0.5, g);
    box(10, 0.18, 0.06, mat(0x8a5a35), 0, 0.09, -2.98, g, false); // skirting
    // window with sunlight + curtains
    frameBox(g, 1.5, 1.6, -3.3, 2.6, -2.98, 0xffffff, mat(0xfff1c8, { basic: true }));
    box(0.5, 1.9, 0.06, mat(0xff8c42), -4.2, 2.6, -2.92, g); box(0.5, 1.9, 0.06, mat(0xff8c42), -2.4, 2.6, -2.92, g);
    // dressing table + mirror
    const dress = group(g, -1.0, 0, -2.75);
    box(1.4, 0.8, 0.5, mat(0x8b5a2b), 0, 0.4, 0, dress);
    box(1.46, 0.06, 0.56, mat(0x6e4420), 0, 0.82, 0, dress);
    box(0.5, 0.05, 0.02, mat(0xd9b24a), -0.32, 0.55, 0.26, dress, false); box(0.5, 0.05, 0.02, mat(0xd9b24a), 0.32, 0.55, 0.26, dress, false);
    frameBox(dress, 1.3, 2.0, 0, 1.95, -0.18, 0x6e4420, null, 0.12);
    const mirror = new Reflector(new THREE.PlaneGeometry(1.08, 1.78), { textureWidth: 512, textureHeight: 840, color: 0xc8d4dc, clipBias: 0.003 });
    mirror.position.set(0, 1.95, -0.16); dress.add(mirror);
    S.bedroom.mirror = mirror;
    // perfume bottle on the table (purple glass + gold cap)
    const perf = group(dress, 0.42, 0.85, 0.08);
    box(0.16, 0.24, 0.1, mat(0xb34fd6, { std: true, roughness: 0.15, transparent: true, opacity: 0.85 }), 0, 0.12, 0, perf);
    box(0.07, 0.08, 0.07, mat(0xe8b931, { std: true, metalness: 0.8, roughness: 0.25 }), 0, 0.28, 0, perf);
    S.bedroom.perfumeOnTable = perf;
    box(0.25, 0.05, 0.08, mat(0x222222), -0.4, 0.86, 0.1, dress, false); // comb
    box(0.1, 0.16, 0.1, mat(0xff6f91), -0.15, 0.93, 0.05, dress); // cream jar
    // ironing board + iron + shirt
    const ib = group(g, 1.55, 0, -1.2);
    box(1.8, 0.05, 0.5, mat(0x5e7fa6), 0, 0.92, 0, ib);
    box(1.82, 0.02, 0.52, mat(0xd8e1ec), 0, 0.95, 0, ib, false);
    const legA = box(0.05, 1.2, 0.05, mat(0x9aa5b1), -0.3, 0.46, 0, ib); legA.rotation.z = 0.6;
    const legB = box(0.05, 1.2, 0.05, mat(0x9aa5b1), 0.3, 0.46, 0, ib); legB.rotation.z = -0.6;
    const shirtFlat = group(ib, -0.15, 0.97, 0);
    box(0.9, 0.025, 0.42, mat(0x8fd0f2), 0, 0, 0, shirtFlat, false);
    box(0.2, 0.03, 0.2, mat(0xc4e8fa), -0.45, 0.005, 0, shirtFlat, false);
    for (let i = 0; i < 4; i++) box(0.03, 0.03, 0.03, mat(0xffffff), -0.3 + i * 0.18, 0.015, 0, shirtFlat, false);
    S.bedroom.ironingBoard = ib; S.bedroom.shirtFlat = shirtFlat;
    // calendar on the wall
    const calTex = calendarTex();
    const cal = group(g, 1.6, 2.15, -2.98);
    plane(0.78, 1.1, new THREE.MeshLambertMaterial({ map: calTex }), cal, 0, 0, 0.012);
    box(0.06, 0.06, 0.04, mat(0x777777), 0, 0.58, 0.02, cal, false);
    S.bedroom.calendar = cal; S.bedroom.calTex = calTex;
    const stool = group(g, 0.2, 0, -1.55);
    box(0.52, 0.42, 0.52, mat(0x6e4420), 0, 0.21, 0, stool);
    box(0.5, 0.08, 0.5, mat(0xd94f70), 0, 0.46, 0, stool);
    S.bedroom.stool = stool;
    // bed corner + framed picture + lamp
    const bed = group(g, 3.4, 0, 0.6);
    box(2.2, 0.5, 3.0, mat(0x6e4420), 0, 0.25, 0, bed);
    box(2.1, 0.22, 2.9, mat(0xd94f70), 0, 0.6, 0, bed);
    box(1.8, 0.2, 0.5, mat(0xfff3f5), 0, 0.8, -1.1, bed);
    frameBox(g, 1.0, 0.75, -1.0, 4.0, -2.98, 0xd9b24a, new THREE.MeshLambertMaterial({ map: portraitTex('wedding') }));
  }

  // ===================== FRONT DOOR (exterior) =====================
  {
    const g = group(scene); g.position.copy(OFFSETS.door); S.door = { group: g };
    const wallM = mat(0xf1d7a2), dadoM = mat(0xc98c4f);
    plane(14, 10, texMat(tiles('#c9b8a0', '#bba88e', 8), [5, 5]), g, 0, 0, 2, 0, -Math.PI / 2);
    const DW = 1.3, DH = 2.7;
    box(6, 5.5, 0.3, wallM, -DW / 2 - 3, 2.75, -0.15, g);
    box(6, 5.5, 0.3, wallM, DW / 2 + 3, 2.75, -0.15, g);
    box(DW, 5.5 - DH, 0.3, wallM, 0, DH + (5.5 - DH) / 2, -0.15, g);
    box(5.4, 0.9, 0.02, dadoM, -DW / 2 - 3, 0.45, 0.01, g, false);
    box(5.4, 0.9, 0.02, dadoM, DW / 2 + 3, 0.45, 0.01, g, false);
    // frame
    const fM = mat(0x5a3416);
    box(0.16, DH + 0.16, 0.36, fM, -DW / 2 - 0.08, DH / 2, -0.1, g); box(0.16, DH + 0.16, 0.36, fM, DW / 2 + 0.08, DH / 2, -0.1, g);
    box(DW + 0.32, 0.16, 0.36, fM, 0, DH + 0.08, -0.1, g);
    box(DW + 0.6, 0.12, 0.6, mat(0x9e9081), 0, 0.06, 0.25, g); // step
    // door on a hinge at the left
    const hinge = group(g, -DW / 2, 0, -0.12);
    const doorM = mat(0x7d4b25);
    box(DW, DH, 0.1, doorM, DW / 2, DH / 2, 0, hinge);
    for (const [y, h] of [[0.75, 1.0], [2.0, 1.0]]) { box(DW * 0.36, h, 0.03, mat(0x6a3d1c), DW * 0.28, y, 0.06, hinge, false); box(DW * 0.36, h, 0.03, mat(0x6a3d1c), DW * 0.72, y, 0.06, hinge, false); }
    box(0.06, 0.25, 0.08, mat(0xd9b24a, { std: true, metalness: 0.8, roughness: 0.3 }), DW - 0.15, 1.2, 0.08, hinge, false);
    box(0.14, 0.05, 0.12, mat(0xd9b24a, { std: true, metalness: 0.8, roughness: 0.3 }), DW - 0.15, 1.3, 0.1, hinge, false);
    S.door.hinge = hinge;
    // nameplate
    const np = textTex(256, 96, '#2b1d12', '#f2d38a', '42', 70, (ctx, w, h) => { ctx.strokeStyle = '#f2d38a'; ctx.lineWidth = 6; ctx.strokeRect(8, 8, w - 16, h - 16); });
    const plate = group(g, DW / 2 + 0.85, 1.75, 0.02);
    box(0.78, 0.31, 0.04, mat(0x6b4a10), 0, 0, 0, plate, false);
    plane(0.72, 0.27, new THREE.MeshLambertMaterial({ map: np }), plate, 0, 0, 0.025);
    // wall lamp
    box(0.2, 0.3, 0.16, mat(0x3b2a1a), DW / 2 + 0.85, 2.55, 0.08, g, false);
    const bulb = box(0.14, 0.18, 0.12, mat(0xfff0b0, { basic: true }), DW / 2 + 0.85, 2.48, 0.14, g, false);
    S.door.bulb = bulb;
    // flower pot with tulips
    const pot = group(g, -DW / 2 - 0.75, 0, 0.45);
    cyl(0.32, 0.24, 0.55, 8, mat(0xb5562b), 0, 0.27, 0, pot);
    cyl(0.34, 0.34, 0.06, 8, mat(0x9c4520), 0, 0.55, 0, pot);
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4, r = 0.12 + (i % 3) * 0.07;
      box(0.06, 0.4 + (i % 3) * 0.12, 0.06, mat(0x2e8b3a), Math.cos(a) * r, 0.75 + (i % 3) * 0.06, Math.sin(a) * r, pot);
      box(0.15, 0.17, 0.15, mat(i % 2 ? 0xe8384f : 0xff7aa8), Math.cos(a) * r, 0.98 + (i % 3) * 0.12, Math.sin(a) * r, pot);
    }
    // doormat
    const mt = textTex(256, 128, '#8a4b2a', '#f3d9a0', 'WELCOME', 46, (ctx, w, h) => { ctx.strokeStyle = '#f3d9a0'; ctx.lineWidth = 6; ctx.strokeRect(10, 10, w - 20, h - 20); });
    plane(1.3, 0.65, new THREE.MeshLambertMaterial({ map: mt }), g, 0, 0.125, 0.9, 0, -Math.PI / 2);
    // warm interior behind the door
    const inside = group(g, 0, 0, -3);
    box(4, 0.1, 6, mat(0xd8b58a), 0, -0.04, 0, inside);
    box(4, 5, 0.2, mat(0xf5cf95), 0, 2.5, -2.2, inside);
    box(0.2, 5, 6, mat(0xf0c27e), -1.8, 2.5, 0, inside); box(0.2, 5, 6, mat(0xf0c27e), 1.8, 2.5, 0, inside);
    frameBox(inside, 0.7, 0.9, 0.6, 2.2, -2.08, 0xd9b24a, new THREE.MeshLambertMaterial({ map: portraitTex('grandpa') }));
    S.door.inside = inside;
  }

  // ===================== LIVING ROOM =====================
  {
    const g = group(scene); g.position.copy(OFFSETS.living); S.living = { group: g };
    const wallM = mat(0xf6d39a), wall2 = mat(0xf1c785), dado = mat(0xd49a5c);
    plane(16, 14, texMat(tiles('#e8dcc6', '#d8c7a8', 8), [6, 6]), g, 0, 0, 0, 0, -Math.PI / 2);
    box(16, 5.4, 0.2, wallM, 0, 2.7, -4.6, g);
    box(0.2, 5.4, 12, wall2, -6.6, 2.7, 0.8, g);
    box(0.2, 5.4, 12, wall2, 6.4, 2.7, 0.8, g);
    box(16, 0.2, 14, mat(0xfbe8c4), 0, 5.4, 0, g, false);
    box(16, 1.0, 0.04, dado, 0, 0.5, -4.49, g, false);
    box(16, 0.06, 0.06, mat(0x8a5a35), 0, 1.0, -4.47, g, false);
    // rug
    const rugTex = canvasTex(256, 192, (ctx, w, h) => {
      ctx.fillStyle = '#9c1f2c'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#e8b931'; ctx.lineWidth = 8; ctx.strokeRect(12, 12, w - 24, h - 24);
      ctx.strokeStyle = '#1f4f8a'; ctx.lineWidth = 6; ctx.strokeRect(28, 28, w - 56, h - 56);
      ctx.fillStyle = '#e8b931';
      for (let i = 0; i < 5; i++) { ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(i * Math.PI / 5); ctx.fillRect(-50, -6, 100, 12); ctx.restore(); }
    });
    plane(4.6, 3.0, new THREE.MeshLambertMaterial({ map: rugTex }), g, 0, 0.012, -2.0, 0, -Math.PI / 2);
    // ---- THE SOFA ----
    const sofa = group(g, 0, 0, -3.75);
    const white = mat(0xfbfbf8, { std: true, roughness: 0.28, envMapIntensity: 1.2 });
    const white2 = mat(0xf2f2ee, { std: true, roughness: 0.32, envMapIntensity: 1.1 });
    box(2.8, 0.26, 1.0, white2, 0, 0.21, 0, sofa);
    const cushions = [];
    for (const x of [-0.88, 0, 0.88]) cushions.push(box(0.86, 0.18, 0.84, white, x, 0.43, 0.06, sofa));
    box(2.8, 0.82, 0.26, white2, 0, 0.75, -0.39, sofa);
    const backCushions = [];
    for (const x of [-0.88, 0, 0.88]) { const b = box(0.84, 0.56, 0.16, white, x, 0.86, -0.2, sofa); b.rotation.x = -0.12; backCushions.push(b); }
    S.living.backCushions = backCushions;
    for (const s of [1, -1]) box(0.3, 0.68, 1.0, white, s * 1.48, 0.42, 0, sofa);
    for (const [x, z] of [[-1.5, 0.4], [1.5, 0.4], [-1.5, -0.4], [1.5, -0.4]]) box(0.1, 0.1, 0.1, mat(0xd9b24a, { std: true, metalness: 0.9, roughness: 0.2 }), x, 0.05, z, sofa);
    // price tag still on ("Bought it today")
    const tagTex = textTex(96, 128, '#ffffff', '#d0102a', '', 10, (ctx) => {
      ctx.fillStyle = '#d0102a'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('IMPORTED', 48, 44);
      ctx.fillStyle = '#222'; ctx.font = `700 26px ${FONT}`; ctx.fillText('$4,999', 48, 84);
      ctx.beginPath(); ctx.arc(48, 12, 6, 0, 7); ctx.fillStyle = '#ccc'; ctx.fill();
    });
    const tag = group(sofa, 1.48, 0.76, 0.48);
    box(0.01, 0.16, 0.01, mat(0xd0102a), 0, -0.06, 0.02, tag, false);
    const tagP = plane(0.17, 0.22, new THREE.MeshLambertMaterial({ map: tagTex, side: THREE.DoubleSide }), tag, 0.0, -0.22, 0.03);
    tagP.rotation.z = 0.15;
    S.living.sofa = sofa; S.living.cushions = cushions; S.living.sofaTag = tag; S.living.white = white;
    // coffee table
    const ct = group(g, 0, 0, -2.25);
    box(1.5, 0.08, 0.75, mat(0x7a4a26), 0, 0.46, 0, ct);
    for (const [x, z] of [[-0.68, 0.3], [0.68, 0.3], [-0.68, -0.3], [0.68, -0.3]]) box(0.08, 0.44, 0.08, mat(0x5e3a1d), x, 0.22, z, ct);
    S.living.coffeeTable = ct;
    // dad's armchair (right)
    const ac = group(g, 1.9, 0, -1.65); ac.rotation.y = -1.2;
    box(1.2, 0.34, 1.0, mat(0x8e2f3a), 0, 0.24, 0, ac);
    box(1.0, 0.16, 0.86, mat(0xa3394a), 0, 0.45, 0.04, ac);
    box(1.2, 0.95, 0.24, mat(0x8e2f3a), 0, 0.82, -0.4, ac);
    for (const s of [1, -1]) box(0.2, 0.62, 1.0, mat(0x7a2531), s * 0.6, 0.4, 0, ac);
    S.living.armchair = ac;
    // ceiling fan
    const fan = group(g, 0, 5.3, -1.6);
    cyl(0.04, 0.04, 0.5, 6, mat(0x6b5b4a), 0, -0.25, 0, fan);
    const rotor = group(fan, 0, -0.55, 0);
    cyl(0.22, 0.2, 0.18, 10, mat(0x8a6f50, { std: true, roughness: 0.4, metalness: 0.3 }), 0, 0, 0, rotor);
    for (let i = 0; i < 3; i++) {
      const arm = group(rotor); arm.rotation.y = i * Math.PI * 2 / 3;
      box(1.35, 0.03, 0.26, mat(0x8a6f50), 0.85, -0.04, 0, arm);
    }
    S.living.fan = fan; S.living.fanRotor = rotor;
    // family photos above the sofa
    frameBox(g, 0.9, 1.1, -1.25, 2.85, -4.48, 0xd9b24a, new THREE.MeshLambertMaterial({ map: portraitTex('dad') }));
    frameBox(g, 1.1, 0.85, 0.05, 3.05, -4.48, 0x6e4420, new THREE.MeshLambertMaterial({ map: portraitTex('wedding') }));
    frameBox(g, 0.8, 1.0, 1.25, 2.85, -4.48, 0x3b2a1a, new THREE.MeshLambertMaterial({ map: portraitTex('grandpa') }));
    frameBox(g, 0.7, 0.9, -2.6, 3.0, -4.48, 0xd9b24a, new THREE.MeshLambertMaterial({ map: portraitTex('family') }));
    // window with orange curtains (behind dining)
    frameBox(g, 1.6, 1.7, -4.4, 2.7, -4.48, 0xffffff, mat(0xffeec0, { basic: true }));
    box(0.6, 2.2, 0.06, mat(0xe8742b), -5.4, 2.7, -4.42, g); box(0.6, 2.2, 0.06, mat(0xe8742b), -3.4, 2.7, -4.42, g);
    // floor lamp next to the sofa
    const lamp = group(g, -2.0, 0, -4.1);
    cyl(0.2, 0.25, 0.06, 8, mat(0x3b2a1a), 0, 0.03, 0, lamp);
    cyl(0.03, 0.03, 1.6, 6, mat(0x3b2a1a), 0, 0.8, 0, lamp);
    cyl(0.18, 0.3, 0.4, 8, mat(0xffe7b0, { basic: true }), 0, 1.75, 0, lamp);
    // plant
    const pl = group(g, 2.0, 0, -4.15);
    cyl(0.25, 0.2, 0.5, 8, mat(0xb5562b), 0, 0.25, 0, pl);
    for (let i = 0; i < 7; i++) { const l = box(0.12, 0.7, 0.04, mat(0x2e8b3a), Math.cos(i) * 0.12, 0.8, Math.sin(i) * 0.12, pl); l.rotation.set(Math.sin(i * 2) * 0.4, i, Math.cos(i * 3) * 0.4); }
    // wooden cupboard
    const cb = group(g, 4.75, 0, -4.15);
    const wood = mat(0x8b5a2b), wood2 = mat(0x9c6a35);
    box(1.3, 2.5, 0.65, wood, 0, 1.25, 0, cb);
    box(1.4, 0.1, 0.72, mat(0x6e4420), 0, 2.53, 0, cb);
    const doorL = group(cb, -0.64, 0, 0.33), doorR = group(cb, 0.64, 0, 0.33);
    box(0.63, 2.36, 0.04, wood2, 0.315, 1.25, 0, doorL);
    box(0.63, 2.36, 0.04, wood2, -0.315, 1.25, 0, doorR);
    for (const [d, sx] of [[doorL, 1], [doorR, -1]]) {
      box(0.45, 0.9, 0.02, mat(0x8b5a2b), sx * 0.315, 1.75, 0.03, d, false);
      box(0.45, 0.9, 0.02, mat(0x8b5a2b), sx * 0.315, 0.7, 0.03, d, false);
      box(0.05, 0.05, 0.06, mat(0xd9b24a, { std: true, metalness: 0.8, roughness: 0.3 }), sx * 0.57, 1.25, 0.05, d, false);
    }
    box(1.2, 0.05, 0.55, mat(0x6e4420), 0, 1.4, 0, cb, false);
    for (let i = 0; i < 5; i++) box(0.22, 0.32, 0.4, mat([0x3a6ea5, 0xd9d2c5, 0x8e2f3a, 0x2e8b3a, 0xe8b931][i]), -0.45 + i * 0.23, 1.6, 0, cb); // folded clothes
    S.living.cupboard = cb; S.living.cbDoorL = doorL; S.living.cbDoorR = doorR;
    // dining table with chole bhature
    const dt = group(g, -3.9, 0, -1.0);
    box(2.2, 0.1, 1.2, mat(0x7a4a26), 0, 0.88, 0, dt);
    for (const [x, z] of [[-1, 0.5], [1, 0.5], [-1, -0.5], [1, -0.5]]) box(0.1, 0.84, 0.1, mat(0x5e3a1d), x, 0.42, z, dt);
    box(2.0, 0.01, 0.5, mat(0xfff2d6), 0, 0.94, 0, dt, false); // table runner
    S.living.dining = dt;
    const chairs = [];
    for (const [x, z, ry] of [[-0.55, 0.95, Math.PI], [0.55, 0.95, Math.PI], [0.55, -0.95, 0]]) {
      const c = group(dt, x, 0, z); c.rotation.y = ry;
      box(0.6, 0.08, 0.6, mat(0x6e4420), 0, 0.55, 0, c);
      box(0.6, 0.8, 0.08, mat(0x6e4420), 0, 0.95, -0.27, c);
      for (const [a, b] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) box(0.06, 0.55, 0.06, mat(0x5e3a1d), a, 0.27, b, c);
      chairs.push(c);
    }
    S.living.chairs = chairs;
  }
  return S;
}

// ---------- props held / used in shots ----------
function taco(parent, x, z, ry) {
  const t = group(parent, x, 0.1, z); t.rotation.y = ry;
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.3, 8, 1, true, Math.PI / 2, Math.PI), mat(0xf2c14e, { side: THREE.DoubleSide }));
  shell.rotation.z = Math.PI / 2; shell.castShadow = true; t.add(shell);
  box(0.26, 0.05, 0.16, mat(0x7a3d1a), 0, 0.0, 0, t, false);                   // meat
  for (let i = 0; i < 4; i++) box(0.07, 0.04, 0.07, mat(0x5cc33a), -0.09 + i * 0.06, 0.04, (i % 2 ? 0.03 : -0.03), t, false); // lettuce
  for (let i = 0; i < 3; i++) box(0.05, 0.04, 0.05, mat(0xe8241c), -0.06 + i * 0.06, 0.07, 0.0, t, false);                 // tomato
  box(0.2, 0.02, 0.1, mat(0xffd34d), 0, 0.09, 0, t, false);                    // cheese
  return t;
}
export function makeFoodPlate(full = true) {
  const g = new THREE.Group();
  cyl(0.36, 0.32, 0.04, 14, mat(0xfafafa, { std: true, roughness: 0.25 }), 0, 0, 0, g);
  cyl(0.3, 0.3, 0.005, 14, mat(0x3a6ea5), 0, 0.022, 0, g);                      // blue rim stripe
  cyl(0.28, 0.28, 0.006, 14, mat(0xfafafa, { std: true, roughness: 0.25 }), 0, 0.024, 0, g);
  if (full) {
    taco(g, -0.1, 0.06, 0.3); taco(g, 0.12, -0.08, -0.2); taco(g, 0.02, 0.17, 0.1);
    cyl(0.07, 0.06, 0.05, 8, mat(0xffffff), 0.2, 0.05, 0.16, g);                 // salsa bowl
    cyl(0.06, 0.06, 0.02, 8, mat(0xd9301c), 0.2, 0.075, 0.16, g);
    box(0.08, 0.04, 0.05, mat(0x8fd14f), -0.22, 0.04, -0.14, g, false);          // lime wedge
  }
  return g;
}
export function makeTaco() { // single falling taco
  const g = new THREE.Group(); taco(g, 0, 0, 0); g.children[0].position.y = 0; return g;
}
export function makeIron() {
  const g = new THREE.Group();
  const base = box(0.34, 0.08, 0.2, mat(0xd8dde3, { std: true, metalness: 0.7, roughness: 0.3 }), 0, 0, 0, g);
  box(0.26, 0.1, 0.16, mat(0x2f6fd6), -0.02, 0.08, 0, g);
  box(0.06, 0.02, 0.02, mat(0xff3b2f, { basic: true }), 0.06, 0.135, 0.06, g, false);
  box(0.22, 0.05, 0.05, mat(0x1d1d1d), -0.03, 0.2, 0, g);
  box(0.04, 0.08, 0.05, mat(0x1d1d1d), -0.12, 0.15, 0, g); box(0.04, 0.08, 0.05, mat(0x1d1d1d), 0.08, 0.15, 0, g);
  return g;
}
export function makeComb() {
  const g = new THREE.Group();
  box(0.3, 0.05, 0.03, mat(0x1d1d1d), 0, 0, 0, g);
  for (let i = 0; i < 9; i++) box(0.012, 0.07, 0.02, mat(0x1d1d1d), -0.13 + i * 0.032, -0.05, 0, g, false);
  return g;
}
export function makePerfume() {
  const g = new THREE.Group();
  box(0.16, 0.24, 0.1, mat(0xb34fd6, { std: true, roughness: 0.15 }), 0, 0, 0, g);
  box(0.12, 0.08, 0.02, mat(0xfff3c4), 0, 0.0, 0.055, g, false);
  box(0.07, 0.08, 0.07, mat(0xe8b931, { std: true, metalness: 0.8, roughness: 0.25 }), 0, 0.16, 0, g);
  return g;
}
export function makePen() {
  const g = new THREE.Group();
  const body = box(0.05, 0.42, 0.05, mat(0x141414, { std: true, roughness: 0.15, metalness: 0.3 }), 0, 0, 0, g);
  box(0.055, 0.06, 0.055, mat(0xe8b931, { std: true, metalness: 0.95, roughness: 0.15 }), 0, 0.12, 0, g);
  box(0.015, 0.16, 0.02, mat(0xe8b931, { std: true, metalness: 0.95, roughness: 0.15 }), 0.03, 0.12, 0, g);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.08, 6), mat(0xe8b931, { std: true, metalness: 0.95, roughness: 0.15 }));
  tip.position.y = -0.25; tip.rotation.x = Math.PI; g.add(tip);
  return g;
}
export function makeDivorcePaper() {
  const tex = canvasTex(360, 480, () => {});
  tex.userData.draw = (sig) => {
    const ctx = tex.userData.ctx;
    ctx.fillStyle = '#fbf8f0'; ctx.fillRect(0, 0, 360, 480);
    ctx.strokeStyle = '#c9c0a8'; ctx.lineWidth = 4; ctx.strokeRect(10, 10, 340, 460);
    ctx.fillStyle = '#e0141e'; ctx.font = `700 76px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('DIVORCE', 180, 98);
    ctx.font = `700 30px ${FONT}`; ctx.fillText('PAPERS', 180, 136);
    ctx.fillStyle = '#9a917c';
    for (let i = 0; i < 9; i++) ctx.fillRect(40, 170 + i * 22, 280 - ((i * 37) % 90), 8);
    ctx.fillStyle = '#3a2e26'; ctx.font = `600 18px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText('SIGNED (FOR HER):', 40, 392);
    ctx.fillStyle = '#3a2e26'; ctx.fillRect(40, 440, 280, 3);
    // stamp
    ctx.save(); ctx.translate(290, 395); ctx.rotate(-0.3); ctx.strokeStyle = 'rgba(224,20,30,0.75)'; ctx.lineWidth = 4; ctx.strokeRect(-40, -18, 80, 36); ctx.fillStyle = 'rgba(224,20,30,0.75)'; ctx.font = `700 16px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('FINAL', 0, 6); ctx.restore();
    if (sig > 0) { // signature scribble drawn progressively
      ctx.strokeStyle = '#1235a8'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      const N = 140, n = Math.floor(N * Math.min(1, sig));
      for (let i = 0; i <= n; i++) {
        const u = i / N;
        const x = 50 + u * 250 + Math.sin(u * 40) * 10;
        const y = 425 - Math.abs(Math.sin(u * 23)) * 26 + Math.sin(u * 7) * 6;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    tex.needsUpdate = true;
  };
  tex.userData.draw(0);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.8), new THREE.MeshLambertMaterial({ map: tex }));
  m.receiveShadow = true;
  m.userData.tex = tex;
  return m;
}
export function makePlateStack() {
  const g = new THREE.Group();
  const plates = [];
  for (let i = 0; i < 4; i++) {
    const p = group(g, 0, i * 0.055, 0);
    cyl(0.36, 0.32, 0.045, 14, mat(0xfafafa, { std: true, roughness: 0.25 }), 0, 0, 0, p); cyl(0.3, 0.3, 0.005, 14, mat(0x3a6ea5), 0, 0.024, 0, p);
    box(0.06, 0.01, 0.04, mat(0xd9301c), 0.08 - i * 0.03, 0.03, 0.05, p, false); // salsa smears
    plates.push(p);
  }
  g.userData.plates = plates;
  return g;
}

export function makeSweetsBox() {
  const g = new THREE.Group();
  box(0.5, 0.16, 0.36, mat(0xff7eb6), 0, 0, 0, g);
  box(0.52, 0.03, 0.06, mat(0xf2c14e), 0, 0.085, 0, g, false);
  box(0.06, 0.03, 0.38, mat(0xf2c14e), 0, 0.085, 0, g, false);
  box(0.12, 0.06, 0.12, mat(0xf2c14e), 0, 0.11, 0, g, false);
  return g;
}
