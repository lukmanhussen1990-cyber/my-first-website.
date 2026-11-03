// FX for the mansion reel (from the bear reel's fx.js + new effects for this story).
//
//  - Everything is a pure function of the call arguments + time t. No Math.random / Date, no state between frames.
//  - All meshes are pooled (created once in buildFX), hidden in reset(), positioned + shown in commit().
//  - Emitters only RECORD the request; the work happens in commit() after the camera is set (billboards face the
//    final camera of the frame, characters are posed).
//  - Cartoon overlays use unlit shaders that write display colours (no tone mapping / fog), pixelated in screen
//    space (same pixel size in close-ups and wide shots). Physical bits (drops, leaves, splinters, needles) are lit.
//  - Transparent quads: depthWrite false, fixed renderOrder per pool slot (no sorting flicker).
import * as THREE from 'three';
import { clamp, lerp, smooth, easeOutBack, easeOut, hash1, noise1 } from './lib.js';
const HIDE_TREE = { pos: [0, 0] }, MAP_BEAR = { pos: [0, 60] };   // (bear reel map trail defaults, unused here)
import { VS, VS_STRIP, STINK_FS, STRIP_FS, CLOUD_FS, STAR_FS, ZIG_FS, STREAK_FS, TRAIL_FS } from './fx_shaders.js';
import { dropGeometry, leafGeometry, leafCanvas, badgeCanvas } from './fx_parts.js';
import { buildFX2 } from './fx2.js';

// sRGB hex -> vec3 uniform (display colour, no conversion: the shaders write display colours directly)
const C = (hex) => { const n = parseInt(hex.replace('#', ''), 16); return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255); };
const V = (a) => (typeof a === 'function' ? V(a()) : a && a.isVector3 ? a.clone() : new THREE.Vector3(a[0], a[1], a[2]));   // positions may be functions (evaluated in commit, after the characters are posed)
const TAU = Math.PI * 2;
const h = (i, s) => hash1(i * 13.17 + s * 71.31);   // stable hash in [0,1)
const fract = (x) => x - Math.floor(x);

const COL = {
  stinkCore: C('#9dea4e'), stinkHi: C('#dcff96'), stinkEdge: C('#2a7a1c'),
  puff: C('#9be05e'), puff2: C('#4f9c33'),
  haze: C('#b4dc6a'), haze2: C('#86b04a'),
  tearCore: C('#9ad8ff'), tearHi: C('#ffffff'), tearEdge: C('#2063b4'),
  cryCore: C('#6cc0ff'), cryHi: C('#eef9ff'), cryEdge: C('#1a4c9a'),
  airCore: C('#ffffff'), airHi: C('#ffffff'), airEdge: C('#7f9bb5'),
  itchCore: C('#ff3b2c'), itchEdge: C('#5a0c08'), itchHi: C('#ffc0a8'),
  dust: C('#e6d6b5'), dust2: C('#a99272'),
  star: C('#ffffff'), starGlow: C('#fff1a8'),
  streak: C('#ffffff'), ink: C('#2b2118'),
  trailCore: C('#98ec4a'), trailHi: C('#e2ffa6'), trailEdge: C('#1b5a14'), trailGlow: C('#86e04c'), trailHead: C('#e8ff6e'),
};
// lit materials (THREE.Color, sRGB hex -> working space)
const DROP = {
  sweat: { body: '#a6e2ff', emissive: '#4aa8ec', ei: 0.5, edge: '#1d5598' },
  tear: { body: '#8fd0ff', emissive: '#3a90e6', ei: 0.6, edge: '#1a4f9e' },
  cry: { body: '#79c6ff', emissive: '#2f86e0', ei: 0.7, edge: '#17478f' },
};
const LEAF_COLS = [['#6fae3c', '#3f7426', '#a8d66a'], ['#5c9a32', '#335f1e', '#93c75a'], ['#86b843', '#4f7d25', '#c2e07a'], ['#b0a23a', '#6e6222', '#d8cf72']];
const SPLINTER_COLS = ['#e9d0a0', '#d8b47c', '#f2e2be', '#c99e66'];
const BARK_COLS = ['#5a3a22', '#6e4a2c', '#4a2f1b'];
const NEEDLE_COLS = ['#b4743a', '#94602e', '#c99a5a', '#7d5428', '#6f8a3a'];
const DIRT_COLS = ['#4a3424', '#5d4530', '#3d2b1d', '#6b5a3c'];

const NSEG = 40;            // max segments of one strip
const STRIP_MAX = NSEG + 1;

export function buildFX(world) {
  const group = new THREE.Group();
  group.name = 'fx';
  world.scene.add(group);

  const quadBottom = new THREE.PlaneGeometry(1, 1); quadBottom.translate(0, 0.5, 0); // origin at bottom centre
  const quadCenter = new THREE.PlaneGeometry(1, 1);

  function shaderMat(fs, uniforms, { vs = VS, depthTest = true, additive = false } = {}) {
    const u = {};
    for (const [k, v] of Object.entries(uniforms)) u[k] = { value: v };
    if (!u.uPix) u.uPix = { value: 0 };
    return new THREE.ShaderMaterial({
      uniforms: u, vertexShader: vs, fragmentShader: fs, transparent: true, depthWrite: false, depthTest,
      side: THREE.DoubleSide, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false,
    });
  }

  const pools = [];
  function pool(n, make, name, baseOrder) {
    const items = [];
    for (let i = 0; i < n; i++) {
      const m = make(i);
      m.name = `fx.${name}.${i}`;
      m.visible = false;
      m.traverse((o) => { o.userData.noAudit = true; o.castShadow = false; o.receiveShadow = false; if (o !== m && o.isMesh) o.name = `${m.name}.${o.name || 'part'}`; });
      if (baseOrder != null) m.traverse((o) => { o.renderOrder = baseOrder + i * 0.001; });
      group.add(m);
      items.push(m);
    }
    const p = { items, used: 0, take() { return this.used < items.length ? items[this.used++] : null; } };
    pools.push(p);
    return p;
  }

  // ---------------------------------------------------------------- pooled things
  const stinkU = () => ({ uT: 0, uPhase: 0, uAmp: 0.04, uLambda: 0.2, uThick: 0.03, uOpacity: 1, uYa: 0, uYb: 0.3, uFadeBot: 0.45, uSway: 0,
    uOutline: 0.3, uSize: new THREE.Vector2(0.2, 0.5), uCore: COL.stinkCore.clone(), uEdge: COL.stinkEdge.clone(), uHi: COL.stinkHi.clone() });
  const cloudU = () => ({ uT: 0, uPhase: 0, uOpacity: 0.5, uSoft: 0.3, uCoreA: 1, uLump: 1, uCol: COL.puff.clone(), uCol2: COL.puff2.clone() });
  const stripU = () => ({ uCore: COL.stinkCore.clone(), uEdge: COL.stinkEdge.clone(), uHi: COL.stinkHi.clone(), uOutline: 0.3, uOpacity: 1, uHiAmt: 1, uHiSide: 1, uShade: 0.85 });

  function makeStrip() {
    const nV = STRIP_MAX * 2;
    const g = new THREE.BufferGeometry();
    const attr = (k) => new THREE.BufferAttribute(new Float32Array(nV * k), k).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', attr(3)); g.setAttribute('uv', attr(2)); g.setAttribute('aW', attr(1)); g.setAttribute('aA', attr(1));
    const idx = [];
    for (let i = 0; i < NSEG; i++) { const a = 2 * i; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setIndex(idx);
    const m = new THREE.Mesh(g, shaderMat(STRIP_FS, stripU(), { vs: VS_STRIP }));
    m.frustumCulled = false;
    return m;
  }
  const dropGeo = dropGeometry();
  function makeDrop() {
    const grp = new THREE.Group();
    const body = new THREE.Mesh(dropGeo, new THREE.MeshStandardMaterial({ color: DROP.sweat.body, emissive: DROP.sweat.emissive, emissiveIntensity: DROP.sweat.ei, roughness: 0.12, metalness: 0, flatShading: true }));
    body.name = 'body';
    const outline = new THREE.Mesh(dropGeo, new THREE.MeshBasicMaterial({ color: DROP.sweat.edge, side: THREE.BackSide }));
    outline.name = 'outline'; outline.scale.setScalar(1.14); outline.position.y = -0.005;
    const hl = new THREE.Mesh(new THREE.SphereGeometry(1, 6, 4), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    hl.name = 'highlight'; hl.scale.set(0.055, 0.11, 0.035); hl.position.set(-0.1, -0.08, 0.265); hl.rotation.z = -0.35;
    grp.add(body, outline, hl);
    grp.userData.kind = '';
    return grp;
  }
  const leafGeo = leafGeometry();
  const leafMats = LEAF_COLS.map(([b, d, l], i) => {
    const tx = new THREE.CanvasTexture(leafCanvas(b, d, l, 11 + i));
    tx.colorSpace = THREE.SRGBColorSpace; tx.magFilter = THREE.NearestFilter; tx.minFilter = THREE.NearestFilter; tx.generateMipmaps = false;
    return new THREE.MeshStandardMaterial({ map: tx, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8, emissive: b, emissiveIntensity: 0.12, flatShading: true });
  });
  const chipGeo = new THREE.BoxGeometry(1, 1, 1);

  const P = {
    cloud: pool(96, () => new THREE.Mesh(quadCenter, shaderMat(CLOUD_FS, cloudU())), 'cloud', 6),
    wave: pool(48, () => new THREE.Mesh(quadBottom, shaderMat(STINK_FS, stinkU())), 'stink', 20),
    strip: pool(64, () => makeStrip(), 'strip', 30),
    zig: pool(16, () => new THREE.Mesh(quadCenter, shaderMat(ZIG_FS, { uN: 5, uAmp: 0.35, uW: 0.09, uOpacity: 1, uT: 0, uSeed: 0,
      uCore: COL.itchCore.clone(), uEdge: COL.itchEdge.clone(), uHi: COL.itchHi.clone() })), 'itch', 60),
    streak: pool(6, () => new THREE.Mesh(quadCenter, shaderMat(STREAK_FS, { uOpacity: 1, uCount: 7, uProg: 0, uW: 0.06, uSeed: 0,
      uCol: COL.streak.clone(), uOut: COL.ink.clone() })), 'streak', 66),
    star: pool(12, () => new THREE.Mesh(quadCenter, shaderMat(STAR_FS, { uOpacity: 1, uCol: COL.star.clone(), uGlowCol: COL.starGlow.clone() })), 'glint', 90),
    drop: pool(80, () => makeDrop(), 'drop'),
    leaf: pool(48, (i) => new THREE.Mesh(leafGeo, leafMats[i % leafMats.length]), 'leaf'),
    chip: pool(96, () => new THREE.Mesh(chipGeo, new THREE.MeshStandardMaterial({ color: '#8a6a4a', roughness: 0.9, flatShading: true })), 'chip'),
  };
  // the map trail: one mesh, geometry rebuilt only when the points / width change
  const trailMesh = new THREE.Mesh(new THREE.BufferGeometry(), shaderMat(TRAIL_FS, { uT: 0, uHead: 0, uLen: 1, uWidth: 4, uOpacity: 1, uTailIn: 6, uHeadLen: 10,
    uCore: COL.trailCore.clone(), uEdge: COL.trailEdge.clone(), uHi: COL.trailHi.clone(), uGlowCol: COL.trailGlow.clone(), uHeadCol: COL.trailHead.clone() }));
  trailMesh.name = 'fx.trail'; trailMesh.visible = false; trailMesh.frustumCulled = false; trailMesh.userData.noAudit = true; trailMesh.renderOrder = 4;
  group.add(trailMesh);
  let trailKey = '', trailLen = 0, trailCurve = null;
  // badge: one quad per distinct text (canvas drawn on first use)
  const badgeMeshes = new Map();
  function badgeMesh(text) {
    if (badgeMeshes.has(text)) return badgeMeshes.get(text);
    const tx = new THREE.CanvasTexture(badgeCanvas(text, 1024));
    tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8; tx.generateMipmaps = true; tx.minFilter = THREE.LinearMipmapLinearFilter; tx.magFilter = THREE.LinearFilter;
    const m = new THREE.Mesh(quadCenter, new THREE.MeshBasicMaterial({ map: tx, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, fog: false }));
    m.name = `fx.badge.${badgeMeshes.size}`; m.userData.noAudit = true; m.renderOrder = 200; m.visible = false; m.frustumCulled = false;
    group.add(m);
    badgeMeshes.set(text, m);
    return m;
  }

  // ---------------------------------------------------------------- frame state + scratch (no per-frame allocation)
  let T = 0, CTX = null, CAM = null;
  const camPos = new THREE.Vector3(), camRight = new THREE.Vector3(), camUp = new THREE.Vector3(), camFwd = new THREE.Vector3();
  const pixBlock = (k = 4) => k * Math.max(0.25, (world.renderer?.domElement?.width || 1080) / 1080);
  const calls = [];
  const t1 = new THREE.Vector3(), t2 = new THREE.Vector3(), t3 = new THREE.Vector3(), t4 = new THREE.Vector3(), t5 = new THREE.Vector3();
  const q1 = new THREE.Quaternion(), m4 = new THREE.Matrix4();
  const ray = new THREE.Raycaster();
  const shotStart = () => (CTX ? CTX.t - CTX.lt : 0);
  // strip scratch
  const SP = Array.from({ length: STRIP_MAX }, () => new THREE.Vector3());
  const SN = Array.from({ length: STRIP_MAX }, () => new THREE.Vector3());
  const SW = new Float32Array(STRIP_MAX), SA = new Float32Array(STRIP_MAX), ARC = new Float32Array(STRIP_MAX);

  // ---------------------------------------------------------------- helpers
  // yaw (+ partial tilt toward camera) billboard for upright effects anchored at their bottom
  function uprightBillboard(m, base, tiltK = 0.35) {
    const dx = camPos.x - base.x, dz = camPos.z - base.z, dy = camPos.y - base.y;
    const yaw = Math.atan2(dx, dz);
    const elev = Math.atan2(dy, Math.hypot(dx, dz));
    m.rotation.set(-clamp(elev * tiltK, -0.45, 0.45), yaw, 0, 'YXZ');
    m.position.copy(base);
  }
  function fullBillboard(m, pos, roll = 0) {
    m.position.copy(pos);
    m.quaternion.copy(CAM.quaternion);
    if (roll) m.quaternion.multiply(q1.setFromAxisAngle(t5.set(0, 0, 1), roll));
  }
  const towardCam = (p, d, out = new THREE.Vector3()) => out.copy(p).add(t5.subVectors(camPos, p).normalize().multiplyScalar(d));
  // rounded cap factor for a strip at distance e from its end (cap radius r)
  const cap = (e, r) => (e >= r ? 1 : Math.sqrt(Math.max(0, 1 - (1 - e / r) * (1 - e / r))));

  // Fill strip mesh m with the n points in SP / SW / SA. Camera-facing, or lying on the surface (normals in SN).
  function fillStrip(m, n, onSurface = false) {
    if (n < 2) { m.visible = false; return; }
    const g = m.geometry, pos = g.attributes.position.array, uv = g.attributes.uv.array, aw = g.attributes.aW.array, aa = g.attributes.aA.array;
    let wMax = 1e-6, L = 0;
    ARC[0] = 0;
    for (let i = 0; i < n; i++) { wMax = Math.max(wMax, SW[i]); if (i) { L += SP[i].distanceTo(SP[i - 1]); ARC[i] = L; } }
    L = Math.max(L, 1e-6);
    for (let i = 0; i < n; i++) {
      const p = SP[i];
      t1.subVectors(SP[Math.min(n - 1, i + 1)], SP[Math.max(0, i - 1)]);
      if (onSurface) t2.crossVectors(t1, SN[i]); else t2.crossVectors(t1, t3.subVectors(camPos, p));
      if (t2.lengthSq() < 1e-14) t2.copy(camRight);
      t2.normalize().multiplyScalar(SW[i]);
      const a = i * 6, b = i * 4;
      pos[a] = p.x - t2.x; pos[a + 1] = p.y - t2.y; pos[a + 2] = p.z - t2.z;
      pos[a + 3] = p.x + t2.x; pos[a + 4] = p.y + t2.y; pos[a + 5] = p.z + t2.z;
      const u = ARC[i] / L;
      uv[b] = u; uv[b + 1] = 0; uv[b + 2] = u; uv[b + 3] = 1;
      aw[i * 2] = aw[i * 2 + 1] = SW[i] / wMax;
      aa[i * 2] = aa[i * 2 + 1] = SA[i];
    }
    g.setDrawRange(0, (n - 1) * 6);
    g.attributes.position.needsUpdate = true; g.attributes.uv.needsUpdate = true; g.attributes.aW.needsUpdate = true; g.attributes.aA.needsUpdate = true;
    m.visible = true;
  }
  function stripStyle(m, { core, edge, hi, outline = 0.3, hiAmt = 1, hiSide = 1, shade = 0.85, opacity = 1, pix = 4, depthTest = true }) {
    const u = m.material.uniforms;
    u.uCore.value.copy(core); u.uEdge.value.copy(edge); u.uHi.value.copy(hi);
    u.uOutline.value = outline; u.uHiAmt.value = hiAmt; u.uHiSide.value = hiSide; u.uShade.value = shade; u.uOpacity.value = opacity;
    u.uPix.value = pix > 0 ? pixBlock(pix) : 0;
    m.material.depthTest = depthTest;
    m.material.polygonOffset = false;
  }
  // characters: head info + surface probing (rays from outside toward the head centre; first hit = outer surface)
  const headMeshes = (head) => { const arr = []; head.traverse((o) => { if (o.isMesh && o.visible && !o.userData.fxSkip) arr.push(o); }); return arr; };
  function headInfo(ch) {
    if (!ch || !ch.head) return null;
    if (ch.root && ch.root.visible === false) return null;
    const head = ch.head;
    head.updateWorldMatrix(true, true);
    const sW = t1.setFromMatrixScale(head.matrixWorld).x || 1;
    const r = ch.headRadius || 0.11;
    return { head, sW, r, rL: r / sW, meshes: headMeshes(head), center: head.getWorldPosition(new THREE.Vector3()) };
  }
  // world surface point + normal in head-local direction dirL (unit). Returns {hit, hair}
  function surfaceAt(hi, dirL, outP, outN) {
    const far = hi.rL * 2.6;
    const o = hi.head.localToWorld(t3.copy(dirL).multiplyScalar(far));
    const dir = t4.subVectors(hi.center, o).normalize();
    ray.set(o, dir); ray.near = 0; ray.far = far * hi.sW;
    const hits = hi.meshes.length ? ray.intersectObjects(hi.meshes, false) : [];
    if (!hits.length) { outP.copy(hi.center).addScaledVector(dir, -hi.r); outN.copy(dir).negate(); return { hit: false, hair: false }; }
    const hit = hits[0];
    outP.copy(hit.point);
    if (hit.face) { outN.copy(hit.face.normal).transformDirection(hit.object.matrixWorld); if (outN.dot(dir) > 0) outN.negate(); } else outN.copy(dir).negate();
    const nm = `${hit.object.name} ${hit.object.parent ? hit.object.parent.name : ''}`;
    return { hit: true, hair: /hair|hat|cap|bun|beanie|wig/i.test(nm) };
  }
  function setDropLook(g, kind) {
    if (g.userData.kind === kind) return;
    const L = DROP[kind];
    const [body, outline] = g.children;
    body.material.color.set(L.body); body.material.emissive.set(L.emissive); body.material.emissiveIntensity = L.ei;
    outline.material.color.set(L.edge);
    g.userData.kind = kind;
  }
  // orient a drop so its tip (+Y) points along dir (world), facing the camera as much as possible
  function orientDrop(g, tipDir) {
    t1.copy(tipDir).normalize();
    t2.subVectors(camPos, g.position); t2.addScaledVector(t1, -t2.dot(t1));
    if (t2.lengthSq() < 1e-10) t2.set(0, 0, 1);
    t2.normalize();
    t3.crossVectors(t1, t2).normalize();
    g.quaternion.setFromRotationMatrix(m4.makeBasis(t3, t1, t2));
  }

  // ================================================================ STINK LINES
  // Line bases are spread along the camera's horizontal right vector so from any view the lines fan out across the
  // frame (optional central gap), with a little depth jitter; layout 'ring' places them on a fixed ring instead.
  const SLOTS = [-0.55, 0.6, 0.02, -0.95, 0.95, 0.3, -0.3, 0.8];
  function doStink(o, idx) {
    if (!o.at) return;
    const t = o.t ?? T;
    const amount = clamp(o.amount ?? 0.7);
    if (amount <= 0.001) return;
    const sc = o.scale ?? 1;
    const seed = o.seed ?? (idx * 17 + 3);
    const at = V(o.at);
    const spread = (o.spread ?? 0.36) * sc;
    const gap = Math.min((o.gap ?? 0) * sc, spread * 0.9);
    const H0 = (o.height ?? 0.55) * sc * lerp(0.75, 1.0, amount);
    const thickK = o.thick ?? 1;
    const nF = o.count ?? lerp(3, 6, amount);
    const maxN = Math.min(SLOTS.length, Math.ceil(nF));
    const opac = lerp(0.7, 1.0, amount) * smooth(amount / 0.08) * (o.opacity ?? 1);
    const bursts = o.burst == null ? [] : (Array.isArray(o.burst) ? o.burst : [o.burst]);
    let boost = 0;
    for (const b of bursts) { const u = (t - b) / 0.9; if (u >= 0 && u < 1) boost = Math.max(boost, Math.sin(Math.PI * Math.min(1, u * 2.5)) * (1 - u)); }
    const fwd = t4.copy(camFwd); fwd.y = 0;
    if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1); fwd.normalize();
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const fwdC = fwd.clone();
    for (let i = 0; i < maxN; i++) {
      const w = clamp(nF - i);
      if (w <= 0.001) break;
      const r1 = h(i, seed), r2 = h(i + 31, seed), r3 = h(i + 57, seed), r4 = h(i + 83, seed), r5 = h(i + 97, seed);
      const per = 2.5 + 0.9 * r1;
      let c = fract(t / per + r5), reveal = 1;
      if (o.t0 != null) {
        const tr = t - o.t0 - i * 0.11;
        if (tr < 0) continue;
        reveal = smooth(tr / 0.5);
        c = fract(tr / per + 0.12 + 0.3 * r5);
      }
      const m = P.wave.take(); if (!m) break;
      const H = H0 * (0.8 + 0.35 * r2) * (1 + boost * 0.25);
      const lam = H * (0.42 + 0.12 * r4);
      const amp = H * 0.085 * (0.85 + 0.35 * r3);
      const thick = H * 0.085 * thickK * (0.9 + 0.2 * r2);
      const sway = amp * 0.9 * Math.sin(t * (0.8 + 0.5 * r1) + r3 * TAU);
      const Wq = 2 * (amp * 1.25 + Math.abs(sway) + thick);
      // the segment: grows up from the base, rises slowly while the wave travels up it, detaches + thins at the top
      const Ls = 0.58 * H;
      let ya = c * 0.42 * H;
      const grow = Math.max(0.04, smooth(c / 0.15)) * reveal;
      const leave = smooth((c - 0.7) / 0.3);
      const yb = ya + Ls * grow;
      ya += (yb - ya) * 0.8 * leave;
      const base = at.clone();
      if ((o.layout ?? 'screen') === 'ring') {
        const ang = i * 2.39996 + seed * 0.7, rad = (0.62 + 0.38 * r1) * spread * 0.5;
        base.add(t1.set(Math.cos(ang) * rad, 0, Math.sin(ang) * rad));
      } else {
        const sl = SLOTS[i] + (r1 - 0.5) * 0.12;
        const x = Math.sign(sl || 1) * (gap / 2 + Math.abs(sl) * (spread / 2 - gap / 2));
        base.addScaledVector(right, x).addScaledVector(fwdC, (r4 - 0.5) * spread * 0.35);
      }
      base.y += (r4 - 0.5) * 0.06 * H;
      uprightBillboard(m, base);
      m.scale.set(Wq, H, 1);
      const u = m.material.uniforms;
      const vc = 0.38 * H;                                  // crest speed (m/s) up the line
      u.uT.value = (TAU * vc / lam) * t + r1 * 7.0; u.uPhase.value = r2 * TAU; u.uAmp.value = amp; u.uLambda.value = lam;
      u.uThick.value = thick; u.uSway.value = sway; u.uSize.value.set(Wq, H);
      u.uYa.value = ya; u.uYb.value = yb; u.uFadeBot.value = 0.55; u.uOutline.value = 0.3;
      u.uOpacity.value = Math.min(1, opac * smooth(w / 0.35) * smooth(c / 0.06) * (1 - smooth((c - 0.86) / 0.14)) * (1 + boost * 0.3));
      u.uPix.value = pixBlock(o.pixel ?? 4);
      u.uCore.value.copy(COL.stinkCore); u.uEdge.value.copy(COL.stinkEdge); u.uHi.value.copy(COL.stinkHi);
      m.material.depthTest = !o.overlay;
      m.visible = true;
    }
    // small green puffs drifting up from the base
    if (o.puffs) {
      for (let i = 0; i < 3; i++) {
        if (o.t0 != null && t < o.t0 + 0.2 + i * 0.25) continue;
        const m = P.cloud.take(); if (!m) break;
        const r1 = h(i + 200, seed), r2 = h(i + 230, seed);
        const u = fract((t + 20) / 1.9 + i / 3 + r1 * 0.2);
        const sl = [-0.75, 0.8, 0.1][i];
        const x = Math.sign(sl) * (gap / 2 + Math.abs(sl) * (spread / 2 - gap / 2));
        const base = at.clone().addScaledVector(right, x).addScaledVector(fwdC, (r2 - 0.5) * spread * 0.2);
        base.y += H0 * (0.05 + 0.4 * u);
        const s = H0 * (0.16 + 0.2 * u) * (0.85 + 0.3 * r2);
        fullBillboard(m, base, r1 * 3);
        m.scale.set(s, s, 1);
        cloudLook(m, t, r2, COL.puff, COL.puff2, { soft: 0.2, coreA: 0.75, opacity: Math.sin(Math.PI * u) * 0.5 * amount, pix: 4 });
      }
    }
    // bursts: green puffs pushed out of the source
    for (const b of bursts) {
      const ub = (t - b) / 1.1;
      if (ub < 0 || ub >= 1) continue;
      for (let i = 0; i < 4; i++) {
        const m = P.cloud.take(); if (!m) break;
        const r1 = h(i + 300, seed + Math.round(b * 30));
        const e = 1 - Math.pow(1 - ub, 2.5);
        const sl = [-1, 1, -0.55, 0.6][i] * (0.85 + 0.3 * r1);
        const x = Math.sign(sl) * (gap / 2 + Math.abs(sl) * spread * 0.5 * (0.35 + 0.65 * e));
        const pos = at.clone().addScaledVector(right, x).addScaledVector(fwdC, (r1 - 0.5) * spread * 0.2);
        pos.y += H0 * (0.04 + 0.3 * e) + (i % 2) * 0.03 * sc;
        const s = H0 * (0.12 + 0.3 * e);
        fullBillboard(m, pos, r1 * 4);
        m.scale.set(s, s, 1);
        cloudLook(m, t, r1, COL.puff, COL.puff2, { soft: 0.2, coreA: 0.7, opacity: smooth(ub / 0.08) * Math.pow(1 - ub, 1.4) * 0.7, pix: 4 });
      }
    }
  }
  function cloudLook(m, t, ph, c1, c2, { soft = 0.3, coreA = 1, opacity = 0.5, pix = 0, lump = 1 } = {}) {
    const u = m.material.uniforms;
    u.uT.value = t; u.uPhase.value = ph * TAU; u.uSoft.value = soft; u.uCoreA.value = coreA; u.uLump.value = lump;
    u.uOpacity.value = opacity; u.uPix.value = pix > 0 ? pixBlock(pix) : 0;
    u.uCol.value.copy(c1); u.uCol2.value.copy(c2);
    m.visible = opacity > 0.003;
  }

  // ================================================================ STINK FLOW (lines sucked into a nose)
  // progress 0..1: 0-0.5 the stream reaches from `from` to `to`, 0.5-1 its tail is pulled in after it.
  // Inside the visible window dashes of wavy line keep streaming toward `to` (speed = path lengths / s).
  function doStinkFlow(o, idx) {
    if (!o.from || !o.to) return;
    const t = o.t ?? T;
    const prog = clamp(o.progress ?? 0.5);
    const g1 = smooth(prog / 0.55), g0 = smooth((prog - 0.45) / 0.55);
    if (g1 - g0 < 0.003) return;
    const from = V(o.from), to = V(o.to);
    const L = from.distanceTo(to);
    if (L < 1e-4) return;
    const count = clamp(Math.round(o.count ?? 4), 1, 8);
    const width = o.width ?? L * 0.4;
    const seed = o.seed ?? (idx * 23 + 7);
    const th = (o.thick ?? L * 0.022) * (o.scale ?? 1);
    const speed = o.speed ?? 1.25;
    const ctrl = from.clone().lerp(to, 0.5).add(t1.set(0, (o.arc ?? 0.15) * L, 0));
    const lam = L * 0.32, amp = width * 0.14;
    const bez = (u, out) => {
      const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u;
      return out.set(a * from.x + b * ctrl.x + c * to.x, a * from.y + b * ctrl.y + c * to.y, a * from.z + b * ctrl.z + c * to.z);
    };
    const bezT = (u, out) => out.set(2 * (1 - u) * (ctrl.x - from.x) + 2 * u * (to.x - ctrl.x), 2 * (1 - u) * (ctrl.y - from.y) + 2 * u * (to.y - ctrl.y), 2 * (1 - u) * (ctrl.z - from.z) + 2 * u * (to.z - ctrl.z));
    const P0 = new THREE.Vector3(), TT = new THREE.Vector3(), SD = new THREE.Vector3();
    const K = 2, dl = 0.62;
    for (let i = 0; i < count; i++) {
      const ri = h(i, seed), rj = h(i + 40, seed);
      const off = (count > 1 ? i / (count - 1) - 0.5 : 0) * width + (ri - 0.5) * width * 0.18;
      const ph = rj * TAU;
      for (let j = 0; j < K; j++) {
        const uc = fract(t * speed * (0.9 + 0.2 * ri) + j / K + ri) * (1 + dl) - dl / 2;
        const ua = Math.max(g0, uc - dl / 2, 0), ub = Math.min(g1, uc + dl / 2, 1);
        if (ub - ua < 0.02) continue;
        const m = P.strip.take(); if (!m) return;
        const n = 28;
        for (let k = 0; k < n; k++) {
          const u = lerp(ua, ub, k / (n - 1));
          bez(u, P0); bezT(u, TT);
          SD.crossVectors(TT, t2.subVectors(camPos, P0));
          if (SD.lengthSq() < 1e-12) SD.copy(camRight);
          SD.normalize();
          const conv = Math.pow(1 - u, 1.35);
          const wav = amp * Math.pow(1 - u, 0.7) * Math.sin(TAU * (u * L) / lam - t * 9 + ph);
          SP[k].copy(P0).addScaledVector(SD, off * conv + wav);
          const e = Math.min(u - ua, ub - u) * L;
          const tw = th * lerp(1, 0.22, u);
          SW[k] = tw * cap(e, tw * 1.1);
          SA[k] = (o.opacity ?? 1) * smooth((u - ua) / Math.max(1e-3, (ub - ua) * 0.35) + 0.25);
        }
        fillStrip(m, n);
        stripStyle(m, { core: COL.stinkCore, edge: COL.stinkEdge, hi: COL.stinkHi, outline: 0.32, pix: o.pixel ?? 4, depthTest: !o.overlay });
      }
    }
  }

  // ================================================================ MAP TRAIL
  function defaultTrailPoints() {
    let nose = null;
    try { const mb = world.animals?.mapBear; if (mb && mb.nosePos) nose = mb.nosePos(); } catch (e) { nose = null; }
    const end = nose ? [nose.x, nose.y, nose.z] : [MAP_BEAR.pos[0], 22, MAP_BEAR.pos[1] - 6];
    const y = 24, x0 = HIDE_TREE.pos[0], z0 = HIDE_TREE.pos[1];
    return [[x0, y, z0 + 1], [x0 + 5, y, z0 + 13], [x0 - 4, y, z0 + 27], [x0 + 3, y, z0 + 42], [x0 - 5, y, z0 + 57], [end[0] - 3, y, end[2] - 18], [end[0] + 2, y, end[2] - 7], end];
  }
  function buildTrail(points, width) {
    const key = JSON.stringify(points) + '|' + width;
    if (key === trailKey) return;
    trailKey = key;
    const curve = new THREE.CatmullRomCurve3(points.map(V), false, 'centripetal');
    trailCurve = curve;
    trailLen = curve.getLength();
    const N = clamp(Math.round(trailLen / 0.6), 64, 600);
    const ext = width * 1.4;                      // geometry extends past both ends (round caps, head glow)
    const half = width * 1.3;
    const pos = [], uv = [], idx = [];
    const p = new THREE.Vector3(), tg = new THREE.Vector3(), sd = new THREE.Vector3();
    const rows = N + 3;
    for (let i = 0; i < rows; i++) {
      let s;
      if (i === 0) { s = -ext; curve.getPointAt(0, p); curve.getTangentAt(0, tg); p.addScaledVector(tg, -ext); }
      else if (i === rows - 1) { s = trailLen + ext; curve.getPointAt(1, p); curve.getTangentAt(1, tg); p.addScaledVector(tg, ext); }
      else { const u = (i - 1) / N; s = u * trailLen; curve.getPointAt(u, p); curve.getTangentAt(u, tg); }
      sd.set(-tg.z, 0, tg.x);
      if (sd.lengthSq() < 1e-8) sd.set(1, 0, 0);
      sd.normalize();
      pos.push(p.x - sd.x * half, p.y, p.z - sd.z * half, p.x + sd.x * half, p.y, p.z + sd.z * half);
      uv.push(s, -half, s, half);
    }
    for (let i = 0; i < rows - 1; i++) { const a = 2 * i; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    trailMesh.geometry.dispose();
    trailMesh.geometry = g;
  }
  function doTrail(o) {
    const pts = o.points && o.points.length >= 2 ? o.points : defaultTrailPoints();
    const width = o.width ?? 5;
    buildTrail(pts, width);
    const t = o.t ?? T;
    const prog = clamp(o.progress ?? 1);
    const u = trailMesh.material.uniforms;
    u.uT.value = t; u.uHead.value = prog * trailLen; u.uLen.value = trailLen; u.uWidth.value = width;
    u.uOpacity.value = clamp(o.opacity ?? 1) * smooth(prog / 0.01);
    u.uTailIn.value = Math.min(trailLen * 0.15, width * 2.5); u.uHeadLen.value = width * 2.6;
    u.uPix.value = pixBlock(o.pixel ?? 4);
    trailMesh.material.depthTest = !o.overlay;
    trailMesh.visible = prog > 0.001;
  }
  // world position of the trail head (for cameras following it). Same arguments as trail().
  function trailHead(o = {}) {
    const pts = o.points && o.points.length >= 2 ? o.points : defaultTrailPoints();
    const curve = new THREE.CatmullRomCurve3(pts.map(V), false, 'centripetal');
    return curve.getPointAt(clamp(o.progress ?? 1)).toArray();
  }

  // ================================================================ HAZE (soft green stink fog)
  function doHaze(o, idx) {
    if (!o.at) return;
    const t = o.t ?? T;
    const amount = clamp(o.amount ?? 0.6);
    if (amount <= 0.001) return;
    const at = V(o.at), R = o.radius ?? 1.5, seed = o.seed ?? (idx * 29 + 5);
    const n = clamp(Math.round(o.count ?? 10), 1, 24);
    const ground = o.ground === undefined ? 0 : o.ground;
    const flat = o.flat ?? 0.45;
    for (let i = 0; i < n; i++) {
      const m = P.cloud.take(); if (!m) break;
      const r1 = h(i + 400, seed), r2 = h(i + 430, seed), r3 = h(i + 460, seed);
      const ang = i * 2.39996 + seed;
      const rad = R * (i === 0 ? 0 : Math.sqrt((i + 0.5) / n) * 0.85);
      const s = R * (0.75 + 0.45 * r3) * (1 + 0.06 * Math.sin(t * 0.7 + i));
      const pos = t2.set(
        at.x + Math.cos(ang) * rad + noise1(t * 0.22 + i * 3, 1) * R * 0.15 + t * 0.03 * R * (r1 - 0.5),
        at.y + (r2 - 0.45) * R * flat + noise1(t * 0.2 + i * 5, 2) * R * 0.06,
        at.z + Math.sin(ang) * rad + noise1(t * 0.22 + i * 7, 4) * R * 0.15);
      if (ground != null) pos.y = Math.max(pos.y, ground + s * 0.42);
      const dCam = pos.distanceTo(camPos);
      const near = smooth((dCam - (CAM.near + s * 0.15)) / Math.max(0.05, s * 0.6));
      if (near <= 0.001) continue;
      fullBillboard(m, pos, r1 * TAU + t * 0.06 * (r2 - 0.5));
      m.scale.set(s, s, 1);
      cloudLook(m, t * 0.5, r2, o.color ? C(o.color) : COL.haze, o.color2 ? C(o.color2) : COL.haze2, { soft: 0.62, coreA: 1, lump: 0.6, pix: 0,
        opacity: (o.opacity ?? 0.22) * amount * (0.8 + 0.2 * Math.sin(t * 0.9 + i * 1.7)) * near });
      m.material.depthTest = !o.overlay;
    }
  }

  // ================================================================ SWEAT
  // Paths in head space: [azimuth from the face direction toward the side (deg), elevation (deg)] keypoints.
  const DROP_PATHS = [
    [[38, 30], [50, 2], [60, -40]],     // temple -> cheek -> jaw (main)
    [[16, 52], [44, 24], [56, -30]],    // forehead -> around the outer brow -> cheek
    [[40, 26], [52, 0], [62, -36]],     // other temple
  ];
  function pathDir(path, s, sx, out) {
    const seg = s < 0.5 ? 0 : 1, u = s < 0.5 ? s * 2 : (s - 0.5) * 2;
    const a = path[seg], b = path[seg + 1];
    const az = THREE.MathUtils.degToRad(lerp(a[0], b[0], u)), el = THREE.MathUtils.degToRad(lerp(a[1], b[1], u));
    return out.set(sx * Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  }
  const _sp = new THREE.Vector3(), _sn = new THREE.Vector3(), _dl = new THREE.Vector3();
  function doSweat(o) {
    const hi = headInfo(o.ch); if (!hi) return;
    const t = o.t ?? T;
    const { head, sW, r } = hi;
    const size = o.size ?? 1;
    const dropH = r * 0.46 * size, dropW = dropH * 0.6, dropT = dropH * 0.36;
    const t0 = o.t0 ?? shotStart() + 0.15;
    const hold = o.hold ?? 0.25, slide = o.slide ?? 1.3, drip = 0.3;
    const count = clamp(Math.round(o.count ?? 1), 1, 3);
    let side = o.side ?? 'auto';
    if (side !== 'L' && side !== 'R') side = head.worldToLocal(t1.copy(camPos)).x >= 0 ? 'L' : 'R';
    const sxMain = side === 'L' ? 1 : -1; // 'L' = the character's left = +X in head space (face looks +Z)
    for (let k = 0; k < count; k++) {
      const start = t0 + k * 0.42;
      let tau = t - start;
      if (o.repeat && tau > 0) tau %= o.repeat;
      const life = 0.2 + hold + slide + drip;
      if (tau < 0 || tau >= life) continue;
      const g = P.drop.take(); if (!g) break;
      setDropLook(g, 'sweat');
      const path = DROP_PATHS[k], sx = k === 2 ? -sxMain : sxMain;
      let s = 0;
      const ts = tau - 0.2 - hold;
      if (ts > 0) { const u = clamp(ts / slide); s = clamp(0.35 * u * u + 0.65 * u * u * u + 0.025 * Math.sin(u * TAU * 2) * u * (1 - u)); }
      // surface distance profile along the path (max-filtered so the drop rides over bumps smoothly)
      const N = 14, prof = [];
      let firstSkin = -1;
      for (let i = 0; i <= N; i++) {
        pathDir(path, i / N, sx, _dl);
        const res = surfaceAt(hi, _dl, _sp, _sn);
        const rho = _sp.distanceTo(hi.center) / sW;
        const slant = Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, _sn.dot(t1.subVectors(_sp, hi.center).normalize())), 2)));
        prof.push(rho + (dropW * 0.5 * slant * 0.8) / sW);
        if (!res.hair && firstSkin < 0) firstSkin = i;
      }
      const s0 = firstSkin > 0 && firstSkin <= N - 4 ? (firstSkin + 0.25) / N : 0;
      const se = s0 + s * (1 - s0);
      pathDir(path, se, sx, _dl);
      const fi = se * N, i0 = Math.min(N - 1, Math.floor(fi)), fr = fi - i0;
      const pm = (i) => Math.max(prof[Math.max(0, i - 1)], prof[i], prof[Math.min(N, i + 1)]);
      const rho = lerp(pm(i0), pm(i0 + 1), fr);
      const out = rho + (dropT * 0.42 + 0.0015) / sW;
      const pos = head.localToWorld(_dl.clone().multiplyScalar(out));
      const n = _dl.clone().transformDirection(head.matrixWorld);
      const upW = new THREE.Vector3(0, 1, 0).transformDirection(head.matrixWorld);
      const up = upW.sub(n.clone().multiplyScalar(upW.dot(n))).normalize();
      const xAxis = new THREE.Vector3().crossVectors(up, n).normalize();
      g.quaternion.setFromRotationMatrix(m4.makeBasis(xAxis, up, n));
      let sc = 1;
      if (tau < 0.2) sc = Math.max(0.001, easeOutBack(tau / 0.2, 2.6));
      let sy = 1 + Math.sin(tau * 26) * Math.exp(-tau * 6) * 0.12 + (ts > 0 ? 0.12 * clamp(ts / slide) : 0);
      const td = tau - (0.2 + hold + slide);
      if (td > 0) {
        const u = td / drip;
        pos.addScaledVector(n, 0.12 * td * r / 0.11).add(t1.set(0, -0.5 * 3.2 * td * td - 0.15 * td, 0));
        sy *= 1 + 0.5 * u;
        sc *= 1 - smooth((u - 0.35) / 0.65);
      }
      g.position.copy(pos);
      g.scale.set((dropW * sc) / 0.6, (dropH * sc * sy) / 1.02, (dropT * sc) / 0.6);
      g.visible = sc > 0.01;
    }
  }
  // big drops flying off the head in all directions (panic). every > 0 repeats the burst.
  function doSweatBurst(o) {
    const hi = headInfo(o.ch); if (!hi) return;
    const t = o.t ?? T;
    const t0 = o.t0 ?? shotStart() + 0.1;
    const count = clamp(Math.round(o.count ?? 6), 1, 12);
    const every = o.every ?? 0;
    const size = o.size ?? 1;
    const { head, r } = hi;
    const life = 0.62;
    const k = r / 0.11;
    const bursts = [];
    if (every > 0) { const b = Math.floor((t - t0) / every); for (let j = b; j >= Math.max(0, b - 3); j--) bursts.push(j); }
    else bursts.push(0);
    for (const b of bursts) {
      const tb = t0 + b * every;
      const tau = t - tb;
      if (tau < 0 || tau >= life) continue;
      for (let i = 0; i < count; i++) {
        const r1 = h(i + b * 17, 501), r2 = h(i + b * 17, 502), r3 = h(i + b * 17, 503);
        const ti = tau - r3 * 0.06;
        if (ti < 0) continue;
        const g = P.drop.take(); if (!g) return;
        setDropLook(g, 'sweat');
        const sx = i % 2 === 0 ? 1 : -1;
        const az = THREE.MathUtils.degToRad(sx * (45 + 65 * r1)), el = THREE.MathUtils.degToRad(8 + 60 * r2);
        _dl.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
        surfaceAt(hi, _dl, _sp, _sn);
        const dirW = t2.copy(_dl).transformDirection(head.matrixWorld);
        const sp = (1.3 + 0.9 * r3) * Math.sqrt(k);
        const vx = dirW.x * sp, vy = dirW.y * sp + 0.9 * Math.sqrt(k), vz = dirW.z * sp;
        const gk = 5.5 * k;
        g.position.set(_sp.x + vx * ti, _sp.y + vy * ti - 0.5 * gk * ti * ti, _sp.z + vz * ti);
        orientDrop(g, t3.set(-vx, -(vy - gk * ti), -vz));
        let sc = ti < 0.08 ? Math.max(0.001, easeOutBack(ti / 0.08, 2)) : 1;
        sc *= 1 - smooth((ti - (life - 0.2)) / 0.2);
        const dh = r * 0.5 * size * (0.8 + 0.4 * r2) * sc;
        g.scale.set(dh * 0.6 / 0.6, dh / 1.02, dh * 0.36 / 0.6);
        g.visible = sc > 0.01;
      }
    }
  }

  // ================================================================ TEARS (streams down the cheeks + drips)
  const _ep = new THREE.Vector3(), _ed = new THREE.Vector3();
  function doTears(o) {
    const hi = headInfo(o.ch); if (!hi || !o.ch.eyeLocal) return;
    const t = o.t ?? T;
    const t0 = o.t0 ?? shotStart() + 0.1;
    const tau = t - t0;
    if (tau < 0) return;
    const amount = clamp(o.amount ?? 1);
    if (amount <= 0.001) return;
    const { head, r } = hi;
    const sides = o.side === 'L' || o.side === 'R' ? [o.side] : ['L', 'R'];
    const grow = easeOut(clamp(tau / (o.grow ?? 0.8)));
    const drift = THREE.MathUtils.degToRad(o.drift ?? 12), drop = THREE.MathUtils.degToRad(o.len ?? 50);
    const off = Math.max(0.004, r * 0.03);
    const wHalf = r * 0.07 * lerp(0.55, 1, amount) * (o.size ?? 1);
    for (const side of sides) {
      const sx = side === 'L' ? 1 : -1;
      const E = _ep.copy(o.ch.eyeLocal(side));
      const eD = _ed.copy(E).normalize();
      const az0 = Math.atan2(eD.x, eD.z), el0 = Math.asin(clamp(eD.y, -1, 1));
      const m = P.strip.take(); if (!m) return;
      const n = 18;
      let used = 0, ended = false;
      for (let k = 0; k < n; k++) {
        const s = (k / (n - 1)) * grow;
        const az = az0 + sx * drift * s, el = el0 - THREE.MathUtils.degToRad(7) - drop * s;
        _dl.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
        surfaceAt(hi, _dl, SP[k], SN[k]);
        if (k > 1 && SN[k].y < -0.55) ended = true;     // the surface turns under the chin: stop, drip from here
        SP[k].addScaledVector(SN[k], off);
        const fl = 1 + 0.18 * Math.sin(s * 14 - t * 8 + sx);
        const bulb = 1 + 0.8 * smooth((s - grow + 0.2) / 0.2) * (grow < 0.999 ? 1 : 0.55 + 0.45 * Math.sin(t * 6 + sx));
        SW[k] = wHalf * fl * bulb * cap(s * r * 1.2, wHalf * 1.2);
        SA[k] = 0.95;
        used = k + 1;
        if (ended) break;
      }
      // smooth normals a little (faceted heads)
      for (let k = 1; k < used - 1; k++) SN[k].add(SN[k - 1]).add(SN[k + 1]).normalize();
      SW[used - 1] = Math.max(SW[used - 1], wHalf * 0.9);
      fillStrip(m, used, true);
      stripStyle(m, { core: COL.tearCore, edge: COL.tearEdge, hi: COL.tearHi, outline: 0.3, hiAmt: 1, hiSide: -sx, shade: 0.9, opacity: smooth(tau / 0.08), pix: o.pixel ?? 3 });
      m.material.polygonOffset = true; m.material.polygonOffsetFactor = -2; m.material.polygonOffsetUnits = -4;
      // drips falling from the end of the stream
      if (grow > 0.95) {
        const end = SP[used - 1], nEnd = SN[used - 1];
        const per = lerp(0.6, 0.32, amount);
        const jb = Math.floor((tau - 0.75) / per);
        for (let j = jb; j >= Math.max(0, jb - 2); j--) {
          const ta = tau - 0.75 - j * per - h(j, sx + 3) * 0.08;
          if (ta < 0 || ta > 0.55) continue;
          const g = P.drop.take(); if (!g) return;
          setDropLook(g, 'tear');
          const fall = 0.5 * 9.0 * ta * ta;
          g.position.copy(end).addScaledVector(nEnd, off + r * 0.05 * ta).add(t1.set(0, -fall, 0));
          orientDrop(g, t1.set(0, 1, 0));
          const ds = r * 0.12 * lerp(0.7, 1, amount) * (o.size ?? 1) * Math.min(1, easeOutBack(clamp(ta / 0.1), 2));
          g.scale.set(ds * 0.6 / 0.6, ds * (1 + Math.min(0.4, ta)) / 1.02, ds * 0.5 / 0.6);
          g.visible = ds > 1e-4;
        }
      }
    }
  }

  // ================================================================ CRY TEARS (big cartoon streams shooting out of both eyes)
  // Each eye shoots a jet outward + up (like a fountain); `dir` (default: the head's backward direction) is the way the
  // tears get blown while running: the jets and the drops bend toward it (wind acceleration `wind`, 0 = no wind).
  const _out = new THREE.Vector3(), _dir = new THREE.Vector3(), _eye = new THREE.Vector3(), _hp = new THREE.Vector3(), _acc = new THREE.Vector3(), _vel = new THREE.Vector3();
  function doCryTears(o) {
    const hi = headInfo(o.ch); if (!hi || !o.ch.eyeLocal) return;
    const t = o.t ?? T;
    const amount = clamp(o.amount ?? 1);
    if (amount <= 0.001) return;
    const { head, r } = hi;
    const sz = o.size ?? 1;
    const k = (r / 0.35) * sz;                       // trajectories scale with the head
    if (o.dir) _dir.copy(V(o.dir)); else _dir.set(0, 0, -1).transformDirection(head.matrixWorld);
    if (_dir.lengthSq() > 1e-8) _dir.normalize();
    const wind = (o.wind ?? 6.5) * k;
    const grav = (o.gravity ?? 7.5) * k;
    const up = (o.lift ?? 1.35) * k, outS = (o.spread ?? 1.9) * k, back = (o.back ?? 0.5) * k;
    const seedS = o.seed ?? 7;
    const W0 = r * 0.085 * sz * lerp(0.7, 1, amount);
    const tJ = 0.3 * lerp(0.75, 1, amount);           // the jet is continuous for tJ seconds, then breaks into drops
    _acc.copy(_dir).multiplyScalar(wind); _acc.y -= grav;
    for (const side of ['L', 'R']) {
      const sx = side === 'L' ? 1 : -1;
      const E = head.localToWorld(_eye.copy(o.ch.eyeLocal(side)));
      _out.set(sx, 0, 0).transformDirection(head.matrixWorld);
      _hp.subVectors(E, hi.center).normalize();
      E.addScaledVector(_hp, r * 0.05);
      const pulse = 1 + 0.12 * Math.sin(t * 13 + sx * 1.3) + 0.06 * Math.sin(t * 29 + sx);
      _vel.copy(_out).multiplyScalar(outS * pulse).addScaledVector(_dir, back).add(t1.set(0, up * pulse, 0)).multiplyScalar(lerp(0.75, 1, amount));
      const vx = _vel.x, vy = _vel.y, vz = _vel.z;
      const posAt = (tt, out, vj = 1) => out.set(E.x + vx * vj * tt + 0.5 * _acc.x * tt * tt, E.y + vy * vj * tt + 0.5 * _acc.y * tt * tt, E.z + vz * vj * tt + 0.5 * _acc.z * tt * tt);
      // the jet: a wobbling stream from the eye
      const m = P.strip.take(); if (!m) return;
      const n = 28;
      const spd = _vel.length();
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1), tt = u * tJ;
        posAt(tt, SP[i]);
        const wob = 1 + 0.22 * Math.sin(u * 11 - t * 26 + sx) + 0.1 * Math.sin(u * 23 - t * 41);
        SW[i] = W0 * lerp(0.55, 1.2, Math.pow(u, 0.6)) * wob * cap(u * tJ * spd, W0 * 0.7) * cap((1 - u) * tJ * spd, W0 * 1.2);
        SA[i] = 1;
      }
      fillStrip(m, n);
      stripStyle(m, { core: COL.cryCore, edge: COL.cryEdge, hi: COL.cryHi, outline: 0.32, hiAmt: 1, hiSide: 1, shade: 0.88, pix: o.pixel ?? 4 });
      // drops flying on from the end of the jet
      const per = 0.034 / lerp(0.55, 1, amount);
      const lifeD = o.life ?? 0.5;
      const tA = tJ * 0.7;
      const jb = Math.floor(t / per);
      const nD = Math.ceil((tJ - tA + lifeD) / per);
      for (let j = jb; j > jb - nD; j--) {
        const rj = h(j, seedS + sx * 5), rk = h(j + 99, seedS + sx * 5), rl = h(j + 177, seedS + sx * 5);
        const tt = tA + (t - j * per) - rj * per * 0.6;
        if (tt < tA || tt > tJ + lifeD) continue;
        const gD = P.drop.take(); if (!gD) return;
        setDropLook(gD, 'cry');
        const vj = 0.85 + 0.3 * rk;
        posAt(tt, gD.position, vj);
        const spr = Math.min(1, (tt - tA) * 5) * r * 0.5;
        gD.position.addScaledVector(_out, (rl - 0.5) * spr).add(t1.set(0, (rj - 0.5) * spr, 0)).addScaledVector(_dir, (rk - 0.5) * spr);
        orientDrop(gD, t1.set(-(vx * vj + _acc.x * tt), -(vy * vj + _acc.y * tt), -(vz * vj + _acc.z * tt)));
        const fade = 1 - smooth((tt - tJ - lifeD * 0.55) / (lifeD * 0.45));
        const ds = r * (0.16 + 0.12 * rj) * sz * lerp(0.7, 1, amount) * fade * Math.min(1, 0.6 + (tt - tA) * 4);
        gD.scale.set(ds * 0.62 / 0.6, ds * 1.12 / 1.02, ds * 0.45 / 0.6);
        gD.visible = ds > 1e-4;
      }
    }
  }

  // ================================================================ ITCH (red zigzag squiggles popping around a point)
  function doItch(o, idx) {
    if (!o.at) return;
    const t = o.t ?? T;
    const t0 = o.t0 ?? shotStart();
    const tau = t - t0;
    if (tau < 0) return;
    const at = V(o.at), R = o.radius ?? 0.25, count = clamp(Math.round(o.count ?? 6), 1, 12), seed = o.seed ?? (idx * 31 + 11);
    const C0 = towardCam(at, o.offset ?? R * 0.3, t4);
    for (let i = 0; i < count; i++) {
      const si = i * 0.07 + h(i, seed) * 0.05;
      if (tau < si) continue;
      const per = 0.5 + 0.22 * h(i + 10, seed);
      const kk = Math.floor((tau - si) / per), c = (tau - si) / per - kk;
      const m = P.zig.take(); if (!m) return;
      const ra = h(i * 7 + kk * 13, seed + 1), rb = h(i * 7 + kk * 13, seed + 2), rc = h(i * 7 + kk * 13, seed + 3);
      const ang = (i / count) * TAU + (ra - 0.5) * 1.1 + kk * 0.9;
      const rad = R * (0.55 + 0.45 * rb);
      const pos = t2.copy(C0).addScaledVector(camRight, Math.cos(ang) * rad).addScaledVector(camUp, Math.sin(ang) * rad);
      const L = R * (0.42 + 0.22 * rc);
      pos.addScaledVector(camRight, noise1(t * 30, i + seed) * L * 0.05).addScaledVector(camUp, noise1(t * 30, i + seed + 5) * L * 0.05);
      let sc = c < 0.2 ? Math.max(0.001, easeOutBack(c / 0.2, 3)) : 1;
      sc *= 1 - smooth((c - 0.78) / 0.22);
      fullBillboard(m, pos, ang + (rc - 0.5) * 0.5);
      m.scale.set(L * sc, L * 0.62 * sc, 1);
      const u = m.material.uniforms;
      u.uN.value = 4 + (i % 2); u.uAmp.value = 0.42; u.uW.value = 0.085; u.uT.value = t; u.uSeed.value = i * 3.1 + kk;
      u.uOpacity.value = 1; u.uPix.value = pixBlock(o.pixel ?? 4);
      m.material.depthTest = !o.overlay;
      m.visible = sc > 0.01;
    }
  }

  // ================================================================ SWIRL (white curly air lines spiralling into a point)
  function doSwirl(o, idx) {
    if (!o.to) return;
    const t = o.t ?? T;
    const amount = clamp(o.amount ?? 1);
    if (amount <= 0.001) return;
    const to = V(o.to), R = o.radius ?? 0.12, seed = o.seed ?? (idx * 19 + 2);
    const n = clamp(Math.round(o.count ?? 4), 1, 8);
    const dirS = o.spin ?? 1;
    const C0 = towardCam(to, o.offset ?? R * 0.2, t4);
    const speed = o.speed ?? 1;
    for (let i = 0; i < n; i++) {
      const per = (0.85 + 0.25 * h(i, seed)) / speed;
      const c = fract(t / per + i / n + h(i + 5, seed) * 0.3);
      const a = amount * smooth(c / 0.15) * (1 - smooth((c - 0.78) / 0.22));
      if (a <= 0.01) continue;
      const m = P.strip.take(); if (!m) return;
      const th0 = (i / n) * TAU + h(i + 9, seed) * 0.8;
      const rh = R * Math.pow(1 - c, 1.25) + R * 0.04;
      const thh = th0 + dirS * c * 3.4;
      const arc = 1.7 * (0.55 + 0.45 * (1 - c));
      const b = 0.45;
      const np = 22;
      const wMax = R * 0.05 * lerp(0.45, 1, 1 - c);
      for (let k = 0; k < np; k++) {
        const u = k / (np - 1);                 // 0 = outer tail .. 1 = head (inner end)
        const th = thh - dirS * arc * (1 - u);
        const rr = rh * Math.exp(b * arc * (1 - u));
        SP[k].copy(C0).addScaledVector(camRight, Math.cos(th) * rr).addScaledVector(camUp, Math.sin(th) * rr);
        SW[k] = wMax * Math.sin(Math.PI * Math.min(1, 0.06 + u * 0.94)) ** 0.7;
        SA[k] = a;
      }
      fillStrip(m, np);
      stripStyle(m, { core: COL.airCore, edge: COL.airEdge, hi: COL.airHi, outline: 0.36, hiAmt: 0, shade: 0.92, pix: o.pixel ?? 3, depthTest: !o.overlay });
    }
  }

  // ================================================================ LEAVES (burst off a bush, flutter down)
  function doLeaves(o, idx) {
    if (!o.at) return;
    const t = o.t ?? T;
    const t0 = o.t0 ?? shotStart();
    const tau = t - t0;
    if (tau < 0) return;
    const at = V(o.at), count = clamp(Math.round(o.count ?? 10), 1, 40), spread = o.spread ?? 0.5, seed = o.seed ?? (idx * 41 + 13);
    const ground = o.ground ?? 0, size = o.size ?? 1;
    const kd = 2.6, vt = 0.45;
    for (let i = 0; i < count; i++) {
      const r1 = h(i, seed), r2 = h(i + 50, seed), r3 = h(i + 90, seed), r4 = h(i + 130, seed);
      const ti = tau - r4 * 0.12;
      if (ti < 0 || ti > 5) continue;
      const m = P.leaf.take(); if (!m) return;
      const ang = r1 * TAU;
      const vh = (0.9 + 1.4 * r2) * (spread / 0.5), vy = 1.4 + 1.6 * r3;
      const e = (1 - Math.exp(-kd * ti)) / kd;
      const x = at.x + Math.cos(ang) * spread * 0.35 * r3 + Math.cos(ang) * vh * e;
      const z = at.z + Math.sin(ang) * spread * 0.35 * r3 + Math.sin(ang) * vh * e;
      let y = at.y - vt * ti + (vy + vt) * e;
      // flutter: side-to-side sway growing as the leaf slows down
      const fl = (1 - Math.exp(-2.2 * ti)) * (0.07 + 0.06 * r2);
      const sw = Math.sin(ti * (5 + 2 * r1) + r2 * TAU);
      const px = x + Math.cos(ang + 1.57) * fl * sw, pz = z + Math.sin(ang + 1.57) * fl * sw;
      const len = 0.075 * size * (0.8 + 0.45 * r1);
      let landed = false;
      if (y < ground + 0.004) { y = ground + 0.004; landed = true; }
      m.position.set(px, y, pz);
      if (landed) m.rotation.set(-Math.PI / 2, 0, r1 * TAU);
      else m.rotation.set(sw * 0.9 + r3 * 2 + ti * 1.5 * (r1 - 0.5), ti * (2 + 3 * r2) + r1 * TAU, Math.cos(ti * (4 + r3 * 3)) * 0.7);
      const fade = 1 - smooth((ti - 3.8) / 1.0);
      m.scale.setScalar(len * Math.min(1, ti / 0.05 + 0.3) * fade);
      m.visible = fade > 0.01;
    }
  }

  // ================================================================ BALLISTIC CHIPS (splinters, needles, dirt)
  // pos after a launch with velocity v, gravity g, one bounce on the ground plane, then sliding to rest
  function ballistic(out, p0, vx, vy, vz, ti, g, ground, rest = 0.3) {
    const tf = (vy + Math.sqrt(Math.max(0, vy * vy + 2 * g * Math.max(0, p0.y - ground)))) / g;
    if (ti < tf) { out.set(p0.x + vx * ti, p0.y + vy * ti - 0.5 * g * ti * ti, p0.z + vz * ti); return 0; }
    const xF = p0.x + vx * tf, zF = p0.z + vz * tf;
    const t2b = ti - tf, vy2 = (g * tf - vy) * rest, tf2 = (2 * vy2) / g;
    if (t2b < tf2) { out.set(xF + vx * 0.5 * t2b, ground + vy2 * t2b - 0.5 * g * t2b * t2b, zF + vz * 0.5 * t2b); return 1; }
    const sl = Math.min(t2b - tf2, 0.25);
    out.set(xF + vx * 0.5 * tf2 + vx * 0.35 * (sl - sl * sl * 2), ground, zF + vz * 0.5 * tf2 + vz * 0.35 * (sl - sl * sl * 2));
    return 2;
  }
  function chip(color, pos, sx, sy, sz, rx, ry, rz) {
    const m = P.chip.take(); if (!m) return null;
    m.material.color.set(color);
    m.position.copy(pos); m.rotation.set(rx, ry, rz); m.scale.set(sx, sy, sz);
    m.visible = true;
    return m;
  }
  function doSplinters(o, idx) {
    if (!o.at) return;
    const t = o.t ?? T;
    const t0 = o.t0 ?? shotStart();
    const tau = t - t0;
    if (tau < 0 || tau > 3) return;
    const at = V(o.at), count = clamp(Math.round(o.count ?? 14), 1, 40), seed = o.seed ?? (idx * 43 + 17);
    const ground = o.ground ?? 0, size = o.size ?? 1;
    const fade = 1 - smooth((tau - 2.2) / 0.8);
    for (let i = 0; i < count; i++) {
      const r1 = h(i, seed), r2 = h(i + 50, seed), r3 = h(i + 90, seed), r4 = h(i + 130, seed);
      const ang = r1 * TAU, el = 0.5 + 0.9 * r2;
      const spd = (1.6 + 2.0 * r3) * Math.sqrt(size);
      const vx = Math.cos(ang) * Math.cos(el) * spd, vz = Math.sin(ang) * Math.cos(el) * spd, vy = Math.sin(el) * spd;
      const st = ballistic(t2, at, vx, vy, vz, tau, 9.8, ground + 0.004, 0.3);
      const bark = i % 4 === 3;
      const spin = st === 0 ? tau * (14 + 16 * r4) : (st === 1 ? 6 + tau * 4 : 8);
      const len = (bark ? 0.016 : 0.022 + 0.035 * r4) * size;
      const thk = (bark ? 0.004 : 0.004 + 0.003 * r2) * size;
      chip(o.color ? (Array.isArray(o.color) ? o.color[i % o.color.length] : o.color) : bark ? BARK_COLS[i % 3] : SPLINTER_COLS[i % 4], t2, bark ? len * 0.9 : thk, thk, len * fade, spin * (r2 - 0.5) * 2 + r1, spin + r2 * 3, r3 * 3);
    }
    // little puff of wood dust + comic snap lines
    if (o.puff !== false && tau < 0.8) {
      for (let i = 0; i < 3; i++) {
        const m = P.cloud.take(); if (!m) break;
        const u = clamp(tau / 0.8), e = 1 - Math.pow(1 - u, 2.2), r1 = h(i + 300, seed);
        const s = size * (0.05 + 0.1 * e) * (0.8 + 0.4 * r1);
        const ang = (i / 3) * TAU + r1;
        fullBillboard(m, t2.set(at.x + Math.cos(ang) * 0.06 * e * size, at.y + s * 0.4 + 0.02 * size, at.z + Math.sin(ang) * 0.06 * e * size), r1 * 4);
        m.scale.set(s, s, 1);
        cloudLook(m, t, r1, COL.dust, COL.dust2, { soft: 0.25, coreA: 0.8, opacity: smooth(u / 0.05) * Math.pow(1 - u, 1.3) * 0.8, pix: 4 });
      }
    }
    if (o.lines !== false && tau < 0.35) {
      const m = P.streak.take();
      if (m) {
        const R = 0.16 * size, ul = tau / 0.35;
        fullBillboard(m, towardCam(at, 0.05 * size, t2).addScaledVector(camUp, R * 0.15), 0);
        m.scale.set(R * 2, R * 2, 1);
        const un = m.material.uniforms;
        un.uCount.value = 7; un.uProg.value = ul; un.uW.value = 0.06; un.uSeed.value = seed * 0.37; un.uOpacity.value = 1 - smooth((ul - 0.65) / 0.35);
        un.uCol.value.copy(COL.streak); un.uOut.value.copy(COL.ink); un.uPix.value = pixBlock(4);
        m.visible = true;
      }
    }
  }
  function doNeedles(o, idx) {
    if (!o.at) return;
    const t = o.t ?? T;
    const t0 = o.t0 ?? shotStart();
    const tau = t - t0;
    if (tau < 0 || tau > 2.6) return;
    const at = V(o.at), count = clamp(Math.round(o.count ?? 16), 1, 48), seed = o.seed ?? (idx * 47 + 19);
    const ground = o.ground ?? 0, size = o.size ?? 1;
    const fade = 1 - smooth((tau - 1.8) / 0.8);
    const dir = o.dir ? V(o.dir).setY(0).normalize() : null;
    for (let i = 0; i < count; i++) {
      const r1 = h(i, seed), r2 = h(i + 50, seed), r3 = h(i + 90, seed), r4 = h(i + 130, seed);
      let ang = r1 * TAU;
      if (dir) ang = Math.atan2(dir.z, dir.x) + (r1 - 0.5) * 2.2;
      const el = 0.45 + 0.75 * r2;
      const spd = (0.9 + 1.5 * r3) * Math.sqrt(size);
      const vx = Math.cos(ang) * Math.cos(el) * spd, vz = Math.sin(ang) * Math.cos(el) * spd, vy = Math.sin(el) * spd;
      const p0 = t1.set(at.x + Math.cos(ang) * 0.08 * size * r4, at.y + 0.01, at.z + Math.sin(ang) * 0.08 * size * r4);
      const st = ballistic(t2, p0, vx, vy, vz, tau, 9.8, ground + 0.003, 0.2);
      const dirt = i % 3 === 2;
      const spin = st === 0 ? tau * (10 + 14 * r4) : 5 + r4 * 3;
      if (dirt) { const d = (0.012 + 0.012 * r4) * size * fade; chip(DIRT_COLS[i % 4], t2, d, d * 0.8, d * 0.9, spin, spin * 0.7, r3 * 3); }
      else { const len = (0.035 + 0.02 * r4) * size * fade, th = 0.0035 * size; chip(NEEDLE_COLS[i % 5], t2, th, th, len, spin * (r2 - 0.5) * 2 + r1, spin + r2 * 3, r3 * 2); }
    }
    if (o.puff !== false) doDust({ at: o.at, t0: o.t0 ?? t0, t, amount: 0.35 * size, seed: seed + 1, size: size * 0.6 }, idx);
  }

  // ================================================================ DUST (puffs from running feet / heavy steps)
  function doDust(o, idx) {
    if (!o.at) return;
    const t = o.t ?? T;
    const t0 = o.t0 ?? shotStart();
    const life = o.life ?? 0.9;
    const tau = t - t0;
    if (tau < 0 || tau > life) return;
    const at = V(o.at), amount = clamp(o.amount ?? 0.7, 0, 2), seed = o.seed ?? (idx * 37 + 9), size = (o.size ?? 1) * lerp(0.6, 1.2, Math.min(1, amount));
    const n = Math.round(lerp(3, 7, Math.min(1, amount)));
    const u = tau / life, e = 1 - Math.pow(1 - u, 2.4);
    const dir = o.dir ? V(o.dir) : null;
    for (let i = 0; i < n; i++) {
      const m = P.cloud.take(); if (!m) break;
      const r1 = h(i + 500, seed), r2 = h(i + 530, seed);
      const ang = (i / n) * TAU + r1 * 0.9;
      const s = size * (0.12 + 0.3 * e) * (0.75 + 0.5 * r2);
      const pos = t2.set(at.x + Math.cos(ang) * 0.32 * size * e, at.y + s * 0.42 + 0.12 * size * e * r2, at.z + Math.sin(ang) * 0.32 * size * e);
      if (dir) pos.addScaledVector(dir, 0.35 * size * e);
      fullBillboard(m, pos, r1 * 5 + u * (r2 - 0.5));
      m.scale.set(s, s, 1);
      cloudLook(m, t, r1, COL.dust, COL.dust2, { soft: 0.3, coreA: 0.8, opacity: smooth(u / 0.06) * Math.pow(1 - u, 1.4) * 0.85 * Math.min(1, amount + 0.2), pix: 4 });
      m.material.depthTest = true;
    }
  }

  // ================================================================ GLINT (small 4-point sparkle)
  function doGlint(o, idx) {
    if (!o.at) return;
    const t = o.t ?? T;
    const at = V(o.at), size = o.size ?? 0.05, seed = o.seed ?? idx * 3.7;
    let sc, rot;
    if (o.t0 != null) {       // one pop
      const tau = t - o.t0;
      if (tau < 0 || tau > 0.62) return;
      sc = tau < 0.12 ? easeOutBack(tau / 0.12, 2.2) : tau < 0.3 ? 1 : 1 - smooth((tau - 0.3) / 0.32);
      rot = tau * 2.4;
    } else {                  // continuous twinkle
      const tw = 0.5 + 0.5 * Math.sin(t * 7.3 + seed * 5.1);
      sc = 0.68 + 0.32 * tw * tw + 0.08 * Math.sin(t * 17 + seed);
      rot = Math.sin(t * 1.3 + seed) * 0.35;
    }
    const m = P.star.take(); if (!m) return;
    fullBillboard(m, towardCam(at, o.offset ?? Math.min(0.03, size * 0.6), t2), rot);
    const s = Math.max(1e-4, sc * size * (o.amount ?? 1));
    m.scale.set(s, s, 1);
    m.material.uniforms.uOpacity.value = clamp(o.opacity ?? 1);
    m.material.uniforms.uCol.value.copy(o.color ? C(o.color) : COL.star);
    m.material.uniforms.uGlowCol.value.copy(o.glow ? C(o.glow) : COL.starGlow);
    m.material.uniforms.uPix.value = 0;
    m.material.depthTest = o.overlay ? false : true;
    m.visible = true;
  }

  // ================================================================ BADGE ("x7")
  function doBadge(o) {
    if (!o.at) return;
    const t = o.t ?? T;
    const t0 = o.t0 ?? shotStart();
    const tau = t - t0;
    if (tau < 0) return;
    const m = badgeMesh(String(o.text ?? 'x7'));
    const size = o.size ?? 0.6;
    let sc = easeOutBack(clamp(tau / 0.3), 2.6);
    sc *= 1 + 0.035 * Math.sin(tau * 5.3) * smooth(tau / 0.4);
    if (o.t1 != null) sc *= 1 - smooth((t - o.t1 + 0.18) / 0.18);
    if (sc <= 0.001) return;
    const roll = -0.18 * (1 - smooth(tau / 0.35)) + 0.055 * Math.sin(tau * 6.1) * Math.exp(-tau * 0.8) + 0.03 * Math.sin(tau * 2.7 + 1) + (o.roll ?? -0.08);
    fullBillboard(m, V(o.at), roll);
    m.scale.set(size * sc, size * sc, 1);
    m.material.depthTest = !!o.depthTest;
    m.material.opacity = clamp(o.opacity ?? 1);
    m.visible = true;
  }

  // ---------------------------------------------------------------- module API
  const DO = { stink: doStink, stinkFlow: doStinkFlow, trail: doTrail, haze: doHaze, sweat: doSweat, sweatBurst: doSweatBurst,
    tears: doTears, cryTears: doCryTears, itch: doItch, swirl: doSwirl, leaves: doLeaves, splinters: doSplinters, dust: doDust,
    needles: doNeedles, glint: doGlint, badge: doBadge };
  const fx2 = buildFX2(world);
  const api = {
    group,
    trailHead,
    reset(t, ctx) {
      fx2.reset(t, ctx);
      T = t; CTX = ctx;
      calls.length = 0;
      for (const p of pools) { p.used = 0; for (const m of p.items) m.visible = false; }
      trailMesh.visible = false;
      for (const m of badgeMeshes.values()) m.visible = false;
    },
    commit(ctx) {
      CAM = ctx.camera;
      if (calls.length) world.scene.updateMatrixWorld();   // characters were just posed: make every world matrix valid
      CAM.updateMatrixWorld(true);
      camPos.setFromMatrixPosition(CAM.matrixWorld);
      camRight.set(1, 0, 0).applyQuaternion(CAM.quaternion);
      camUp.set(0, 1, 0).applyQuaternion(CAM.quaternion);
      camFwd.set(0, 0, -1).applyQuaternion(CAM.quaternion);
      const counters = {};
      for (const [type, o] of calls) {
        const idx = (counters[type] = (counters[type] ?? -1) + 1);
        try { DO[type](o, idx); } catch (e) { console.error(`[log] fx.${type} failed: ${e.message}`); }
      }
      fx2.commit(ctx);
    },
  };
  for (const type of Object.keys(DO)) api[type] = (o = {}) => { calls.push([type, o || {}]); };
  Object.assign(api, fx2.emitters);
  return api;
}
