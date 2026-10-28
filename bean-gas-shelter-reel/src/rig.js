// Character kit for the faceless ("ghost mannequin") people: cloth materials in
// object space, loft and tube geometry for garments, a skeleton posed from a few
// parameters each frame (two-bone IK for arms and legs), and a procedural gait
// that plants the feet on the lawn or on the stair treads.
import * as THREE from 'three';

export const V = (x, y, z) => new THREE.Vector3(x, y, z);
const col = (hex) => new THREE.Color(hex);
const UP = new THREE.Vector3(0, 1, 0);

// ---------------------------------------------------------------------------
// materials (object-space detail, so patterns move with the body parts)
// ---------------------------------------------------------------------------
const NOISE = /* glsl */ `
float chh(vec3 p){ p = fract(p*vec3(.1031,.1030,.0973)); p += dot(p, p.yxz+33.33); return fract((p.x+p.y)*p.z); }
float chn(vec3 p){ vec3 i=floor(p), f=fract(p); vec3 u=f*f*(3.-2.*f);
  return mix(mix(mix(chh(i),chh(i+vec3(1,0,0)),u.x), mix(chh(i+vec3(0,1,0)),chh(i+vec3(1,1,0)),u.x),u.y),
             mix(mix(chh(i+vec3(0,0,1)),chh(i+vec3(1,0,1)),u.x), mix(chh(i+vec3(0,1,1)),chh(i+vec3(1,1,1)),u.x),u.y), u.z); }
float oaa(float f){ float fw = max(length(fwidth(vOPos)), 1e-6); return 1.0 - smoothstep(0.25, 0.6, fw * f); }
`;
let pid = 0;
// colour / bump / roughness / metalness / glow functions of the object-space position;
// the inside of open garments (collars, cuffs, the hood) is a dark lining
export function cloth(mat, { colorFn = '', overFn = '', bumpFn = '', roughFn = '', metalFn = '', glowFn = '', bump = 1, extra = '', key = '', lining = 0.3 }) {
  const id = key || `cl${pid++}`;
  mat.side = THREE.DoubleSide;
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vOPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvOPos = position;');
    let fs = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vOPos;\n${NOISE}\n${extra}`);
    fs = fs.replace('#include <color_fragment>', `#include <color_fragment>\n ${colorFn ? `diffuseColor.rgb *= ${colorFn}(vOPos);` : ''}
      ${overFn ? `{ vec4 ov = ${overFn}(vOPos); diffuseColor.rgb = mix(diffuseColor.rgb, ov.rgb, ov.a); }` : ''}
      if (!gl_FrontFacing) diffuseColor.rgb *= ${lining.toFixed(3)};`);
    if (roughFn) fs = fs.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n roughnessFactor = ${roughFn}(vOPos);`);
    if (metalFn) fs = fs.replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>\n metalnessFactor = ${metalFn}(vOPos);`);
    if (bumpFn) {
      fs = fs.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { float hh = ${bumpFn}(vOPos); vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition);
          vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx); float det = dot(dpx, r1);
          vec3 g = sign(det) * (dFdx(hh) * r1 + dFdy(hh) * r2);
          vec3 nb = abs(det) * normal - g * ${bump.toFixed(3)};
          if (dot(nb, nb) > 1e-24) normal = normalize(nb); }`);
    }
    if (glowFn) fs = fs.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n totalEmissiveRadiance += ${glowFn}(vOPos, diffuseColor.rgb);`);
    sh.fragmentShader = fs;
  };
  mat.customProgramCacheKey = () => id;
  return mat;
}
const std = (hex, rough, metal = 0, extra = {}) => new THREE.MeshStandardMaterial({ color: col(hex), roughness: rough, metalness: metal, ...extra });

// fluorescent orange puffer: quilted baffles (stitch lines, puffed between), nylon
// sheen, grey retro-reflective tape bands; bands = list of [y0, y1] (object space)
export function pufferMat(key, hex, bands = [], period = 0.085) {
  const bandGl = bands.map(([a, b]) => `max(0.0, smoothstep(${a.toFixed(3)}, ${(a + 0.004).toFixed(3)}, p.y) - smoothstep(${b.toFixed(3)}, ${(b + 0.004).toFixed(3)}, p.y))`).join(' + ') || '0.0';
  return cloth(std(hex, 0.48, 0, { emissive: col(hex), emissiveIntensity: 0.0 }), {
    key, colorFn: key + 'C', overFn: key + 'O', bumpFn: key + 'B', roughFn: key + 'R', metalFn: key + 'M', glowFn: key + 'G',
    extra: `float ${key}Tape(vec3 p){ return clamp(${bandGl}, 0.0, 1.0); }
      float ${key}Baf(vec3 p){ float f = fract(p.y / ${period.toFixed(3)}); return sqrt(max(0.0, sin(f * 3.14159))); }
      vec3 ${key}C(vec3 p){
        float tape = ${key}Tape(p);
        float baf = ${key}Baf(p);
        vec3 c = vec3(0.86 + 0.16 * baf * oaa(${(1 / period).toFixed(1)}) + 0.05 * chn(p * 30.0));
        // stitch line between baffles
        float st = 1.0 - smoothstep(0.0, 0.08, min(fract(p.y / ${period.toFixed(3)}), 1.0 - fract(p.y / ${period.toFixed(3)})));
        c *= 1.0 - 0.28 * st * oaa(${(1 / period).toFixed(1)});
        // a zip down the front (z > 0, x ~ 0)
        float zip = (1.0 - smoothstep(0.004, 0.008, abs(p.x))) * step(0.0, p.z);
        c = mix(c, vec3(0.25), zip * 0.8);
        return c;
      }
      // retro-reflective tape: silver grey, fine glass-bead sparkle
      vec4 ${key}O(vec3 p){ return vec4(vec3(0.62, 0.64, 0.66) * (0.85 + 0.25 * chn(p * 400.0) * oaa(400.0)), ${key}Tape(p)); }
      float ${key}B(vec3 p){ return 0.006 * ${key}Baf(p) * oaa(${(1 / period).toFixed(1)}) * (1.0 - ${key}Tape(p)); }
      float ${key}R(vec3 p){ return mix(0.42 - 0.12 * ${key}Baf(p), 0.32, ${key}Tape(p)); }
      float ${key}M(vec3 p){ return 0.25 * ${key}Tape(p); }
      // fluorescent pigment: a little extra glow in the orange
      vec3 ${key}G(vec3 p, vec3 a){ return a * 0.12 * (1.0 - ${key}Tape(p)); }`,
  });
}
// indigo denim: diagonal twill, fading on the fronts, a lighter outer seam
export function denimMat(key, hex = '#2b3e63') {
  return cloth(std(hex, 0.86), {
    key, colorFn: key + 'C', bumpFn: key + 'B',
    extra: `vec3 ${key}C(vec3 p){
        float tw = 0.5 + 0.5 * sin((p.x + p.y + p.z * 0.7) * 1400.0);
        vec3 c = vec3(0.92 + 0.14 * tw * oaa(700.0) + 0.04 * (1.0 - oaa(700.0)));
        c *= 0.9 + 0.2 * chn(vec3(p.x * 30.0, p.y * 6.0, p.z * 30.0));
        c = mix(c, vec3(1.45, 1.42, 1.32), 0.35 * smoothstep(0.35, 0.95, chn(p * 9.0)) * step(0.0, p.z));
        return c; }
      float ${key}B(vec3 p){ return 0.0005 * sin((p.x + p.y + p.z * 0.7) * 1400.0) * oaa(700.0) + 0.0012 * chn(p * 60.0); }`,
  });
}
export function leatherMat(key, hex, rough = 0.55) {
  return cloth(std(hex, rough), {
    key, colorFn: key + 'C', bumpFn: key + 'B',
    extra: `vec3 ${key}C(vec3 p){ return vec3(0.85 + 0.25 * chn(p * 40.0) + 0.1 * chn(p * 9.0)); }
      float ${key}B(vec3 p){ return 0.0007 * chn(p * 160.0) * oaa(160.0) + 0.0012 * chn(p * 35.0); }`,
  });
}
// soft knit: vertical ribs and stitch rows
export function knitMat(key, hex) {
  return cloth(std(hex, 0.92), {
    key, colorFn: key + 'C', bumpFn: key + 'B',
    extra: `float ${key}K(vec3 p){ float a = atan(p.x, p.z) * 18.0; float rib = abs(fract(a / 3.14159) - 0.5) * 2.0;
        float st = abs(fract(p.y * 70.0 + 0.5 * step(0.5, fract(a / 6.28318))) - 0.5) * 2.0; return rib * 0.6 + st * 0.4; }
      vec3 ${key}C(vec3 p){ return vec3(0.84 + 0.22 * ${key}K(p) * oaa(70.0) + 0.06 * chn(p * 20.0)); }
      float ${key}B(vec3 p){ return 0.0025 * ${key}K(p) * oaa(70.0); }`,
  });
}
// cotton jersey (the hoodie, trousers): fine weave, soft folds
export function cottonMat(key, hex, rough = 0.88) {
  return cloth(std(hex, rough), {
    key, colorFn: key + 'C', bumpFn: key + 'B',
    extra: `vec3 ${key}C(vec3 p){ return vec3(0.9 + 0.12 * chn(p * 14.0) + 0.05 * chn(vec3(p.x * 9.0, p.y * 40.0, p.z * 9.0))); }
      float ${key}B(vec3 p){ return 0.0009 * chn(p * 180.0) * oaa(180.0) + 0.0025 * chn(vec3(p.x * 12.0, p.y * 30.0, p.z * 12.0)); }`,
  });
}
export function skinMat(key, hex) {
  return cloth(std(hex, 0.55), { key, colorFn: key + 'C', extra: `vec3 ${key}C(vec3 p){ return vec3(0.95 + 0.08 * chn(p * 25.0)); }` });
}
export function furMat(key, hex) {
  return cloth(std(hex, 0.8), {
    key, colorFn: key + 'C', bumpFn: key + 'B',
    extra: `vec3 ${key}C(vec3 p){ return vec3(0.82 + 0.26 * chn(vec3(p.x * 90.0, p.y * 25.0, p.z * 90.0)) * oaa(90.0)) * (0.9 + 0.14 * chn(p * 6.0)); }
      float ${key}B(vec3 p){ return 0.0035 * chn(vec3(p.x * 110.0, p.y * 30.0, p.z * 110.0)) * oaa(110.0) + 0.002 * chn(p * 40.0); }`,
  });
}
export function hatMat() {
  return new THREE.MeshPhysicalMaterial({ color: col('#f3f2ec'), roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.15, metalness: 0 });
}

// ---------------------------------------------------------------------------
// geometry: a loft of elliptical rings along y (torsos, sleeves, trouser legs)
// rings: [[y, halfWidth (x), halfDepth (z), zOffset], ...]; open at both ends
// ---------------------------------------------------------------------------
export function loft(rings, seg = 28, wave = null) {
  const pos = [], idx = [], uv = [];
  rings.forEach(([y, hw, hd, zo = 0], j) => {
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      let k = 1;
      if (wave) k += wave(a, y);
      pos.push(Math.sin(a) * hw * k, y, Math.cos(a) * hd * k + zo);
      uv.push(i / seg, j / (rings.length - 1));
    }
  });
  for (let j = 0; j < rings.length - 1; j++)
    for (let i = 0; i < seg; i++) {
      const a = j * (seg + 1) + i, b = a + seg + 1;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
// a tapered tube along +y from 0 to len (radii along it), rounded end caps optional
export function tube(len, radii, seg = 20, capEnd = false, flat = 1) {
  const rings = radii.map((r, i) => [(i / (radii.length - 1)) * len, r, r * flat]);
  if (capEnd) {
    const r = radii[radii.length - 1];
    for (let k = 1; k <= 4; k++) {
      const a = (k / 4) * Math.PI / 2;
      rings.push([len + Math.sin(a) * r * 0.8, Math.cos(a) * r + 1e-4, Math.cos(a) * r * flat + 1e-4]);
    }
  }
  return loft(rings, seg);
}

// place a mesh built along +y (from its origin) between points a and b;
// fwd keeps the mesh's +z facing that way (the front of a knee or an elbow)
const _y = new THREE.Vector3(), _z = new THREE.Vector3(), _x = new THREE.Vector3(), _m = new THREE.Matrix4();
export function placeSeg(o, a, b, fwd, len0) {
  _y.subVectors(b, a);
  const L = _y.length();
  if (L < 1e-6) return;
  _y.multiplyScalar(1 / L);
  _z.copy(fwd).addScaledVector(_y, -fwd.dot(_y));
  if (_z.lengthSq() < 1e-8) _z.set(0, 0, 1).addScaledVector(_y, -_y.z);
  _z.normalize();
  _x.crossVectors(_y, _z);
  _m.makeBasis(_x, _y, _z);
  o.quaternion.setFromRotationMatrix(_m);
  o.position.copy(a);
  o.scale.set(1, len0 ? L / len0 : 1, 1);
}
// orient a mesh by a basis (x = side, y = up, z = forward)
export function placeFrame(o, p, x, y, z) {
  _m.makeBasis(x, y, z);
  o.quaternion.setFromRotationMatrix(_m);
  o.position.copy(p);
}

// two-bone IK: root a, target t, lengths l1 l2, pole direction -> the middle joint
export function ik2(a, t, l1, l2, pole, out) {
  const d = new THREE.Vector3().subVectors(t, a);
  let L = d.length();
  const maxL = (l1 + l2) * 0.9995;
  if (L > maxL) { d.multiplyScalar(maxL / L); L = maxL; }
  if (L < 1e-5) { out.copy(a).addScaledVector(pole, l1); return t; }
  const dn = d.clone().multiplyScalar(1 / L);
  const x = (l1 * l1 - l2 * l2 + L * L) / (2 * L);
  const h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  const p = pole.clone().addScaledVector(dn, -pole.dot(dn));
  if (p.lengthSq() < 1e-8) p.set(0, 0, 1);
  p.normalize();
  out.copy(a).addScaledVector(dn, x).addScaledVector(p, h);
  return a.clone().add(d);
}

// ---------------------------------------------------------------------------
// gait: feet planted along a path (polyline in xz); ground(x, z) gives the height
// stride = distance between two placements of the same foot
// ---------------------------------------------------------------------------
export function pathOf(points) {
  const seg = [];
  let L = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    seg.push([L, l]);
    L += l;
  }
  const at = (s) => {
    s = Math.max(0, Math.min(L, s));
    for (let i = 0; i < seg.length; i++) {
      const [s0, l] = seg[i];
      if (s <= s0 + l || i === seg.length - 1) {
        const k = l > 0 ? Math.max(0, Math.min(1, (s - s0) / l)) : 0;
        const a = points[i], b = points[i + 1];
        return { x: a[0] + (b[0] - a[0]) * k, z: a[1] + (b[1] - a[1]) * k, dx: (b[0] - a[0]) / (l || 1), dz: (b[1] - a[1]) / (l || 1) };
      }
    }
    return { x: points[0][0], z: points[0][1], dx: 0, dz: 1 };
  };
  return { L, at };
}
// foot position for foot `side` (0 left, 1 right) when the body is at distance s
export function footAt(path, s, stride, side, width, ground, lift = 0.12) {
  const u = s / stride + (side ? 0.5 : 0);
  const n = Math.floor(u), f = u - n;
  const plantS = (k) => (k - (side ? 0.5 : 0) + 0.25) * stride;
  const foot = (ps) => {
    const p = path.at(ps);
    const sx = p.dz, sz = -p.dx; // to the right of the direction of travel
    const off = side ? -width : width;
    const x = p.x - sx * off, z = p.z - sz * off;
    return { x, z, y: ground(x, z), dx: p.dx, dz: p.dz };
  };
  if (f < 0.5) {
    const q = foot(Math.min(path.L, plantS(n)));
    return { ...q, swing: 0 };
  }
  const k = (f - 0.5) / 0.5;
  const e = k * k * (3 - 2 * k);
  const a = foot(Math.min(path.L, plantS(n))), b = foot(Math.min(path.L, plantS(n + 1)));
  const top = Math.max(a.y, b.y);
  const y = (1 - e) * a.y + e * b.y + Math.sin(k * Math.PI) * lift + Math.max(0, top - Math.min(a.y, b.y)) * Math.sin(k * Math.PI) * 0.6;
  return { x: a.x + (b.x - a.x) * e, z: a.z + (b.z - a.z) * e, y, dx: b.dx, dz: b.dz, swing: Math.sin(k * Math.PI) };
}
