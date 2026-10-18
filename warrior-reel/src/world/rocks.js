// The two seat rocks: the knight's tall mossy purple-grey faceted boulder and Jesus's lower, flatter rock.
// Built as jittered "lathe" rings with a flat top cap (the sitting surface), flat shaded, pixel moss texture
// + per-face vertex colour (lighter top facets, lavender/pink sides, darker base, green moss on top faces).
import * as THREE from 'three';
import { rng, smoothstep, clamp } from '../core/util.js';
import { flatten, boxUV, faceColors, noise2, hash2 } from './wutil.js';
import { rockTexture } from './textures.js';

// rings: [y, radiusScale]; rx/rz = base radii (front = +z, back = -z), top = seat height.
function ringRock({ seed, rx, rzF, rzB, top, rings, seg = 11, jitter = 0.08, topR = 0.5, tilt = 0 }) {
  const rand = rng(seed);
  const verts = [];
  const idx = [];
  const ringStart = [];
  const angJ = Array.from({ length: seg }, () => (rand() - 0.5) * 0.35);
  for (let r = 0; r < rings.length; r++) {
    const [yf, s] = rings[r];
    ringStart.push(verts.length / 3);
    for (let k = 0; k < seg; k++) {
      const a = ((k + 0.5 + angJ[k] * (r === rings.length - 1 ? 0.3 : 1)) / seg) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      const rz = sa > 0 ? rzF : rzB;
      const jr = 1 + (rand() - 0.5) * 2 * jitter * (r === rings.length - 1 ? 0.4 : 1);
      const x = ca * rx * s * jr, z = sa * rz * s * jr;
      let y = yf * top;
      if (r === rings.length - 1) y = top + tilt * z + (rand() - 0.5) * 0.008; // the seat rim
      else if (r > 0) y += (rand() - 0.5) * 0.05 * top;
      verts.push(x, y, z);
    }
  }
  // top cap centre
  const cIdx = verts.length / 3;
  verts.push(0, rings[rings.length - 1][0] * top + 0.004, 0);
  for (let r = 0; r < rings.length - 1; r++) {
    const a0 = ringStart[r], a1 = ringStart[r + 1];
    for (let k = 0; k < seg; k++) {
      const k1 = (k + 1) % seg;
      idx.push(a0 + k, a1 + k, a0 + k1, a0 + k1, a1 + k, a1 + k1);
    }
  }
  const last = ringStart[rings.length - 1];
  for (let k = 0; k < seg; k++) idx.push(last + k, cIdx, last + (k + 1) % seg);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setIndex(idx);
  return g;
}

function paintRock(geo, { seed, base, light, tint, moss, mossAmt, top }) {
  const B = new THREE.Color(base), L = new THREE.Color(light), T = new THREE.Color(tint), M = new THREE.Color(moss), D = new THREE.Color(0x3c3646);
  faceColors(geo, (c, n, i) => {
    const col = B.clone();
    const h = hash2(i, seed, 7);
    col.lerp(T, smoothstep(0.6, 1, h) * 0.55);                 // pink/lavender facets
    col.lerp(L, clamp(n.y * 0.55 + n.x * -0.2 + n.z * 0.15, 0, 1) * 0.5); // light from above/front-left
    col.lerp(D, (1 - smoothstep(0.0, top * 0.35, c.y)) * 0.45);  // darker at the base (ground contact)
    const m = noise2(c.x * 7 + seed, c.z * 7 + c.y * 4, 3);
    if (n.y > 0.35 && m > 0.15 - mossAmt) col.lerp(M, 0.55 * smoothstep(0.35, 0.8, n.y));
    col.multiplyScalar(0.94 + 0.12 * h);
    return col;
  });
}

export function buildSeats() {
  const tex = rockTexture(21, 0.14);
  const mat = new THREE.MeshLambertMaterial({ map: tex, vertexColors: true, flatShading: true });

  // Knight: tall rounded boulder, ~0.95 m wide at the base, ~0.75 m mid, flat seat top at y = 0.48.
  let gk = ringRock({
    seed: 3, rx: 0.5, rzF: 0.36, rzB: 0.46, top: 0.48, seg: 11, jitter: 0.09,
    rings: [[-0.25, 0.96], [0.0, 1.0], [0.22, 0.98], [0.46, 0.88], [0.68, 0.74], [0.86, 0.6], [0.97, 0.48], [1.0, 0.4]],
  });
  gk.translate(-0.55, 0, -0.05);
  gk = flatten(gk);
  boxUV(gk, 2.2);
  paintRock(gk, { seed: 3, base: 0x8a7d98, light: 0xc0b6c8, tint: 0xa98aa8, moss: 0x6f9f32, mossAmt: 0.1, top: 0.48 });
  const knight = new THREE.Mesh(gk, mat);
  knight.name = 'seatKnight';

  // Jesus: lower, broader, flatter slab-like rock, top y = 0.44.
  let gj = ringRock({
    seed: 9, rx: 0.56, rzF: 0.42, rzB: 0.46, top: 0.44, seg: 10, jitter: 0.08, tilt: -0.02,
    rings: [[-0.3, 0.97], [0.0, 1.0], [0.3, 0.98], [0.62, 0.92], [0.86, 0.8], [1.0, 0.64]],
  });
  gj.rotateY(0.35);
  gj.translate(0.80, 0, 0.05);
  gj = flatten(gj);
  boxUV(gj, 2.2, [0.37, 0.11]);
  paintRock(gj, { seed: 9, base: 0x857c92, light: 0xbdb3c4, tint: 0x9d8aa6, moss: 0x74a434, mossAmt: 0.0, top: 0.44 });
  const jesus = new THREE.Mesh(gj, mat);
  jesus.name = 'seatJesus';

  for (const m of [knight, jesus]) { m.castShadow = true; m.receiveShadow = true; }
  return {
    knight, jesus,
    seats: { knight: new THREE.Vector3(-0.55, 0.48, -0.05), jesus: new THREE.Vector3(0.80, 0.44, 0.05) },
  };
}
