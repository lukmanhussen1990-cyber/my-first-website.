// Knight geometry toolkit: one shared "armour" material (per-vertex albedo / metalness / roughness +
// a packed pixel-art detail atlas), parametric plate shells with rolled rims, and a per-bone merger
// so the whole suit costs ~one draw call per bone.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, clamp, smoothstep } from '../core/util.js';

// Texture density: UVs are box-projected in metres * UVS (64 px atlas tile => ~1.1 cm texels).
export const UVS = 1 / 0.72;

// Palette: color (sRGB hex), sel = atlas channel weights [steel grime, leather, mail], metal, rough.
export const PAL = {
  steel: { color: 0x878c94, sel: [1, 0, 0], metal: 0.78, rough: 0.45 },
  steelD: { color: 0x6c7178, sel: [1, 0, 0], metal: 0.78, rough: 0.5 },
  rim: { color: 0x959aa1, sel: [1, 0, 0], metal: 0.82, rough: 0.38 },
  rivet: { color: 0xc4c8cd, sel: [1, 0, 0], metal: 0.88, rough: 0.3 },
  leather: { color: 0x6f4527, sel: [0, 1, 0], metal: 0.0, rough: 0.68 },
  strap: { color: 0x5a371e, sel: [0, 1, 0], metal: 0.0, rough: 0.64 },
  glove: { color: 0x3e332c, sel: [0, 1, 0], metal: 0.0, rough: 0.62 },
  gloveD: { color: 0x2f2621, sel: [0, 1, 0], metal: 0.0, rough: 0.66 },
  pad: { color: 0x3b3029, sel: [0, 1, 0], metal: 0.0, rough: 0.92 },
  mail: { color: 0x66625d, sel: [0, 0, 1], metal: 0.72, rough: 0.5, uvMul: 3.2 },
  brass: { color: 0xc99a42, sel: [1, 0, 0], metal: 0.92, rough: 0.3 },
  void: { color: 0x020203, sel: [0, 0, 0], metal: 0.0, rough: 1.0 },
  cloth: { color: 0x262c3a, sel: [0, 1, 0], metal: 0.0, rough: 0.95 },
  blade: { color: 0xd4d8de, sel: [0.55, 0, 0], metal: 0.68, rough: 0.3 },
  bladeEdge: { color: 0xf4f6f9, sel: [0.3, 0, 0], metal: 0.8, rough: 0.16 },
  fuller: { color: 0x9aa1aa, sel: [1, 0, 0], metal: 0.72, rough: 0.36 },
  iron: { color: 0x8b9099, sel: [1, 0, 0], metal: 0.88, rough: 0.38 },
};

// ---------- detail atlas (RGBA data texture; each channel is a multiplier, 128 = x1.0) ----------
let _atlas = null;
export function knightAtlas() {
  if (_atlas) return _atlas;
  const N = 64, data = new Uint8Array(N * N * 4), r = rng(4242);
  const G = 8, grid = Array.from({ length: G * G }, () => r());
  const vn = (x, y) => { // tileable value noise, cell = N/G px
    const fx = (x / N) * G, fy = (y / N) * G;
    const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const g = (i, j) => grid[(((j % G) + G) % G) * G + (((i % G) + G) % G)];
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const a = g(x0, y0) + (g(x0 + 1, y0) - g(x0, y0)) * sx;
    const b = g(x0, y0 + 1) + (g(x0 + 1, y0 + 1) - g(x0, y0 + 1)) * sx;
    return a + (b - a) * sy;
  };
  const R = new Float32Array(N * N), Gc = new Float32Array(N * N), B = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x;
    const blot = vn(x, y), blot2 = vn(x * 2 + 17, y * 2 + 5);
    // steel: pixel dither + grime blotches
    R[i] = 1.04 + (r() - 0.5) * 0.2 - 0.34 * Math.max(0, blot - 0.45) * 2.0 - 0.12 * Math.max(0, blot2 - 0.55) * 2.5 + (r() < 0.05 ? -0.14 : 0);
    // leather: coarser dither + soft streaks
    Gc[i] = 1.0 + (r() - 0.5) * 0.2 + 0.07 * Math.sin(y * 0.8 + blot * 6) - 0.12 * Math.max(0, blot2 - 0.55);
    // mail: staggered ring cells (4x4)
    const cx = x % 4, cy = (y + ((x >> 2) & 1) * 2) % 4;
    const ring = (cx === 0 || cx === 3) !== (cy === 0 || cy === 3);
    const hole = (cx === 1 || cx === 2) && (cy === 1 || cy === 2);
    B[i] = ring ? 1.28 + (r() - 0.5) * 0.15 : hole ? 0.32 : 0.75 + (r() - 0.5) * 0.15;
  }
  // scratches on steel: short bright diagonal strokes with a dark lip
  for (let k = 0; k < 22; k++) {
    let x = Math.floor(r() * N), y = Math.floor(r() * N);
    const dx = r() < 0.5 ? 1 : -1, dy = r() < 0.7 ? 1 : 0, len = 3 + Math.floor(r() * 6);
    for (let s = 0; s < len; s++) {
      const i = (((y % N) + N) % N) * N + (((x % N) + N) % N);
      R[i] = 1.2; const j = ((((y + 1) % N) + N) % N) * N + (((x % N) + N) % N); R[j] = Math.min(R[j], 0.84);
      x += dx; y += dy || (s % 2);
    }
  }
  for (let i = 0; i < N * N; i++) {
    data[i * 4] = clamp(Math.round(R[i] * 127.5), 0, 255);
    data[i * 4 + 1] = clamp(Math.round(Gc[i] * 127.5), 0, 255);
    data[i * 4 + 2] = clamp(Math.round(B[i] * 127.5), 0, 255);
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  _atlas = tex;
  return tex;
}

// Shared material: albedo from vertex colours, metal/rough from aMR, detail from atlas channel aSel.
// Back faces (insides of open plates) are darkened so shells read as thick/hollow armour.
export function makeKnightMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, map: knightAtlas(), metalness: 1, roughness: 1, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aSel;\nattribute vec2 aMR;\nvarying vec3 vSel;\nvarying vec2 vMR;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSel = aSel; vMR = aMR;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSel;\nvarying vec2 vMR;')
      .replace('#include <map_fragment>', `
        float kN = 1.0;
        #ifdef USE_MAP
          vec4 kT = texture2D( map, vMapUv );
          kN = dot( kT.rgb, vSel ) * 2.0 + ( 1.0 - ( vSel.x + vSel.y + vSel.z ) );
        #endif
        diffuseColor.rgb *= kN;
        if ( !gl_FrontFacing ) diffuseColor.rgb *= 0.26;`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = clamp( vMR.y + ( 1.0 - kN ) * 0.45, 0.05, 1.0 );')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vMR.x;');
  };
  m.customProgramCacheKey = () => 'knightArmour.v1';
  return m;
}

// ---------- painting ----------
const _c = new THREE.Color();
const _n = new THREE.Vector3();
// Convert to non-indexed, box-project UVs (metres), write color/aSel/aMR. spec: PAL entry (+ bright).
export function paint(geo, spec, { bright = 1, uvOff = null } = {}) {
  let g = geo.index ? geo.toNonIndexed() : geo;
  if (!g.attributes.normal) g.computeVertexNormals();
  const pos = g.attributes.position, nor = g.attributes.normal, n = pos.count;
  const shade = g.attributes.shade;
  const col = new Float32Array(n * 3), sel = new Float32Array(n * 3), mr = new Float32Array(n * 2), uv = new Float32Array(n * 2);
  _c.set(spec.color);
  const uvm = UVS * (spec.uvMul || 1);
  const ox = uvOff ? uvOff[0] : 0, oy = uvOff ? uvOff[1] : 0;
  for (let i = 0; i < n; i++) {
    const s = (shade ? shade.getX(i) : 1) * bright;
    col[i * 3] = _c.r * s; col[i * 3 + 1] = _c.g * s; col[i * 3 + 2] = _c.b * s;
    sel[i * 3] = spec.sel[0]; sel[i * 3 + 1] = spec.sel[1]; sel[i * 3 + 2] = spec.sel[2];
    mr[i * 2] = spec.metal; mr[i * 2 + 1] = spec.rough;
    _n.fromBufferAttribute(nor, i);
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const ax = Math.abs(_n.x), ay = Math.abs(_n.y), az = Math.abs(_n.z);
    let u, v;
    if (ax >= ay && ax >= az) { u = z; v = y; } else if (ay >= az) { u = x; v = z; } else { u = x; v = y; }
    uv[i * 2] = u * uvm + ox; uv[i * 2 + 1] = v * uvm + oy;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', pos);
  out.setAttribute('normal', nor);
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setAttribute('aSel', new THREE.BufferAttribute(sel, 3));
  out.setAttribute('aMR', new THREE.BufferAttribute(mr, 2));
  return out;
}

// ---------- parametric plate shell ----------
// Surface of elliptical (or squarish) rings around local Y. θ = 0 faces +Z (front), θ = +90° faces +X.
// o.prof(t) -> { y, rx, rz | rzF/rzB, rxL/rxR, cx, cz, sq } for t in [0,1].
// o.disp(θ, t, p) -> radial offset; o.warp(p, θ, t) -> free deformation.
// AO: o.aoTop / o.aoBot darken near the t=1 / t=0 edges (where the next lame overlaps).
export function shellGeo(o) {
  const nU = o.nU ?? 24, nV = o.nV ?? 6;
  const th0 = o.th0 ?? -Math.PI, th1 = o.th1 ?? Math.PI;
  const closed = (th1 - th0) >= 2 * Math.PI - 1e-6;
  const rows = [], rads = [];
  for (let j = 0; j <= nV; j++) {
    const t = j / nV, pr = o.prof(t);
    const row = [];
    let rad = 0;
    for (let i = 0; i <= nU; i++) {
      const th = th0 + (th1 - th0) * (i / nU);
      let s = Math.sin(th), c = Math.cos(th);
      if (pr.sq && pr.sq !== 2) { const e = 2 / pr.sq; s = Math.sign(s) * Math.pow(Math.abs(s), e); c = Math.sign(c) * Math.pow(Math.abs(c), e); }
      const rz = c >= 0 ? (pr.rzF ?? pr.rz ?? pr.rzB) : (pr.rzB ?? pr.rz ?? pr.rzF);
      const rx = s >= 0 ? (pr.rxL ?? pr.rx ?? pr.rxR) : (pr.rxR ?? pr.rx ?? pr.rxL);
      const p = new THREE.Vector3((pr.cx || 0) + rx * s, pr.y, (pr.cz || 0) + rz * c);
      if (o.disp) { const d = o.disp(th, t, p); p.x += Math.sin(th) * d; p.z += Math.cos(th) * d; }
      if (o.warp) o.warp(p, th, t);
      rad = Math.max(rad, rx, rz);
      row.push(p);
    }
    rows.push(row); rads.push(rad);
  }
  const W = nU + 1, pos = new Float32Array(W * (nV + 1) * 3), shade = new Float32Array(W * (nV + 1));
  const aoT = (o.aoTop ?? 0.12) * 1.5, aoB = (o.aoBot ?? 0.0) * 1.5, aoW = o.aoW ?? 0.35;
  for (let j = 0; j <= nV; j++) for (let i = 0; i <= nU; i++) {
    const k = j * W + i, p = rows[j][i];
    pos[k * 3] = p.x; pos[k * 3 + 1] = p.y; pos[k * 3 + 2] = p.z;
    const t = j / nV, th = th0 + (th1 - th0) * (i / nU);
    let s = 1 - aoT * smoothstep(1 - aoW, 1, t) - aoB * (1 - smoothstep(0, aoW, t));
    if (o.shade) s *= o.shade(th, t);
    shade[k] = s;
  }
  const yUp = (o.flip ?? false) ? false : true;
  const idx = [];
  for (let j = 0; j < nV; j++) for (let i = 0; i < nU; i++) {
    const a = j * W + i, b = a + 1, c = a + W + 1, d = a + W;
    if (yUp) idx.push(a, b, c, a, c, d); else idx.push(a, c, b, a, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('shade', new THREE.BufferAttribute(shade, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  const nor = g.attributes.normal;
  if (closed) for (let j = 0; j <= nV; j++) {
    const a = j * W, b = j * W + nU;
    _n.set(nor.getX(a) + nor.getX(b), nor.getY(a) + nor.getY(b), nor.getZ(a) + nor.getZ(b)).normalize();
    nor.setXYZ(a, _n.x, _n.y, _n.z); nor.setXYZ(b, _n.x, _n.y, _n.z);
  }
  for (const j of [0, nV]) if (rads[j] < 1e-4) { // collapsed pole: use the averaged ring normal
    const jj = j === 0 ? 1 : nV - 1; _n.set(0, 0, 0);
    for (let i = 0; i <= nU; i++) { const k = jj * W + i; _n.x += nor.getX(k); _n.y += nor.getY(k); _n.z += nor.getZ(k); }
    _n.normalize();
    for (let i = 0; i <= nU; i++) nor.setXYZ(j * W + i, _n.x, _n.y, _n.z);
  }
  g.userData = { rows, rads, closed, nU, nV, W };
  return g;
}

// Rolled-edge bead(s) along a shell's boundary. edges: 'all' | array of 'top','bottom','left','right'.
export function shellRims(g, r = 0.0055, edges = 'all', radial = 4) {
  const { rows, rads, closed, nU, nV, W } = g.userData;
  const nor = g.attributes.normal;
  const pt = (j, i) => {
    const p = rows[j][i].clone();
    const k = j * W + i;
    return p.addScaledVector(_n.set(nor.getX(k), nor.getY(k), nor.getZ(k)), r * 0.35);
  };
  const want = (e) => edges === 'all' || edges.includes(e);
  const out = [];
  const tube = (pts, loop) => {
    if (pts.length < 2) return;
    const curve = new THREE.CatmullRomCurve3(pts, loop, 'centripetal');
    out.push(new THREE.TubeGeometry(curve, Math.max(6, Math.round(pts.length * 1.2)), r, radial, loop));
  };
  if (closed) {
    if (want('top') && rads[nV] > 1e-3) tube(rows[nV].slice(0, nU).map((_, i) => pt(nV, i)), true);
    if (want('bottom') && rads[0] > 1e-3) tube(rows[0].slice(0, nU).map((_, i) => pt(0, i)), true);
  } else if (edges === 'all') {
    const loop = [];
    if (rads[nV] > 1e-3) for (let i = 0; i <= nU; i++) loop.push(pt(nV, i)); else loop.push(pt(nV, nU));
    for (let j = nV - 1; j >= 1; j--) loop.push(pt(j, nU));
    if (rads[0] > 1e-3) for (let i = nU; i >= 0; i--) loop.push(pt(0, i)); else loop.push(pt(0, 0));
    for (let j = 1; j <= nV - 1; j++) loop.push(pt(j, 0));
    tube(loop, true);
  } else {
    if (want('top')) tube(Array.from({ length: nU + 1 }, (_, i) => pt(nV, i)), false);
    if (want('bottom')) tube(Array.from({ length: nU + 1 }, (_, i) => pt(0, i)), false);
    if (want('left')) tube(Array.from({ length: nV + 1 }, (_, j) => pt(j, 0)), false);
    if (want('right')) tube(Array.from({ length: nV + 1 }, (_, j) => pt(j, nU)), false);
  }
  return out;
}

// Smooth profile helper: piecewise-linear interpolation of key rows (with smoothstep blending).
export function profile(keys) {
  return (t) => {
    if (t <= keys[0].t) return { ...keys[0] };
    for (let k = 1; k < keys.length; k++) {
      const a = keys[k - 1], b = keys[k];
      if (t <= b.t) {
        const u0 = (t - a.t) / (b.t - a.t), u = u0 * u0 * (3 - 2 * u0) * 0.6 + u0 * 0.4;
        const o = {};
        for (const key of Object.keys(b)) if (typeof b[key] === 'number' && typeof a[key] === 'number') o[key] = a[key] + (b[key] - a[key]) * u;
        return o;
      }
    }
    return { ...keys[keys.length - 1] };
  };
}

// ---------- per-parent merger ----------
export class Kit {
  constructor(material) { this.material = material; this.groups = new Map(); this.r = rng(99); this.tris = 0; }
  add(parent, geo, spec, opts = {}) {
    if (opts.matrix) geo.applyMatrix4(opts.matrix);
    const g = paint(geo, spec, { bright: opts.bright ?? 1, uvOff: [this.r() * 7, this.r() * 7] });
    let arr = this.groups.get(parent);
    if (!arr) this.groups.set(parent, (arr = []));
    arr.push(g);
    return g;
  }
  // shell + optional rims in one call
  shell(parent, o, spec = PAL.steel, { rim = 0.0055, edges = 'all', rimSpec = PAL.rim, matrix = null } = {}) {
    const g = shellGeo(o);
    const rims = rim > 0 ? shellRims(g, rim * (this.rimScale || 1), edges) : [];
    if (matrix) { g.applyMatrix4(matrix); rims.forEach((r) => r.applyMatrix4(matrix)); }
    this.add(parent, g, spec);
    for (const r of rims) this.add(parent, r, rimSpec);
    return g;
  }
  build({ name = 'knightPart' } = {}) {
    const meshes = [];
    for (const [parent, arr] of this.groups) {
      const geo = mergeGeometries(arr, false);
      geo.computeBoundingSphere();
      const m = new THREE.Mesh(geo, this.material);
      m.name = name + ':' + (parent.name || 'part');
      m.castShadow = true; m.receiveShadow = true;
      parent.add(m);
      meshes.push(m);
      this.tris += geo.attributes.position.count / 3;
    }
    this.groups.clear();
    return meshes;
  }
}

// ---------- small primitives ----------
export const M4 = () => new THREE.Matrix4();
export function tf(pos = [0, 0, 0], rotDeg = [0, 0, 0], scale = [1, 1, 1]) {
  const D = Math.PI / 180;
  return new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(rotDeg[0] * D, rotDeg[1] * D, rotDeg[2] * D, 'XYZ')), new THREE.Vector3(...scale));
}
export function sphere(r, ws = 10, hs = 7) { return new THREE.SphereGeometry(r, ws, hs); }
export function rivetGeo(r = 0.007) { return new THREE.SphereGeometry(r, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2); }
// A rivet placed at point p (vector) with its dome facing along n.
export function rivetAt(p, n, r = 0.0065) {
  const g = rivetGeo(r);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n.clone().normalize());
  g.applyMatrix4(new THREE.Matrix4().compose(p, q, new THREE.Vector3(1, 0.7, 1)));
  return g;
}
// Shell surface point/normal (approximate) at (θ, t) for decorating (rivets, slits, straps).
export function shellPoint(o, th, t) {
  const pr = o.prof(t);
  let s = Math.sin(th), c = Math.cos(th);
  if (pr.sq && pr.sq !== 2) { const e = 2 / pr.sq; s = Math.sign(s) * Math.pow(Math.abs(s), e); c = Math.sign(c) * Math.pow(Math.abs(c), e); }
  const rz = c >= 0 ? (pr.rzF ?? pr.rz ?? pr.rzB) : (pr.rzB ?? pr.rz ?? pr.rzF);
  const rx = s >= 0 ? (pr.rxL ?? pr.rx ?? pr.rxR) : (pr.rxR ?? pr.rx ?? pr.rxL);
  const p = new THREE.Vector3((pr.cx || 0) + rx * s, pr.y, (pr.cz || 0) + rz * c);
  if (o.disp) { const d = o.disp(th, t, p); p.x += Math.sin(th) * d; p.z += Math.cos(th) * d; }
  if (o.warp) o.warp(p, th, t);
  // normal by finite differences
  const e = 1e-3;
  const a = shellPointRaw(o, th + e, t), b = shellPointRaw(o, th - e, t), c2 = shellPointRaw(o, th, Math.min(1, t + e)), d = shellPointRaw(o, th, Math.max(0, t - e));
  const n = new THREE.Vector3().crossVectors(a.sub(b), c2.sub(d)).normalize();
  return { p, n };
}
function shellPointRaw(o, th, t) {
  const pr = o.prof(t);
  let s = Math.sin(th), c = Math.cos(th);
  if (pr.sq && pr.sq !== 2) { const e = 2 / pr.sq; s = Math.sign(s) * Math.pow(Math.abs(s), e); c = Math.sign(c) * Math.pow(Math.abs(c), e); }
  const rz = c >= 0 ? (pr.rzF ?? pr.rz ?? pr.rzB) : (pr.rzB ?? pr.rz ?? pr.rzF);
  const rx = s >= 0 ? (pr.rxL ?? pr.rx ?? pr.rxR) : (pr.rxR ?? pr.rx ?? pr.rxL);
  const p = new THREE.Vector3((pr.cx || 0) + rx * s, pr.y, (pr.cz || 0) + rz * c);
  if (o.disp) { const d = o.disp(th, t, p); p.x += Math.sin(th) * d; p.z += Math.cos(th) * d; }
  if (o.warp) o.warp(p, th, t);
  return p;
}

// A band (strap) wrapped on a shell at height t, between θa..θb, width w (in t units converted by caller).
export function bandGeo(o, t0, t1, th0, th1, lift = 0.004, nU = 16) {
  const g = shellGeo({
    nU, nV: 1, th0, th1, aoTop: 0, aoBot: 0,
    prof: (t) => o.prof(t0 + (t1 - t0) * t),
    disp: (th, t, p) => (o.disp ? o.disp(th, t0 + (t1 - t0) * t, p) : 0) + lift,
    warp: o.warp ? (p, th, t) => o.warp(p, th, t0 + (t1 - t0) * t) : undefined,
  });
  return g;
}
