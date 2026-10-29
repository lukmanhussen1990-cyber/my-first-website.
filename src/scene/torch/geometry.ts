import {
  BufferGeometry,
  Color,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Path,
  Shape,
  ShapeGeometry,
  Uint32BufferAttribute,
  Vector2,
} from 'three';
import { mulberry32 } from '../../lib/noise';

/** [radius, height] in lathe space (the lathe axis is +Y). */
export type ProfilePoint = [number, number];

export interface LatheOptions {
  segments?: number;
  phiStart?: number;
  phiLength?: number;
  /** World size of one texture tile, used for both U and V so texel density is uniform. */
  tile?: number;
  /** Profile corners sharper than this (degrees) get split normals → crisp machined edges. */
  creaseAngle?: number;
}

/**
 * Lathe with arc-length V coordinates and hard edges at sharp profile corners.
 * (three's LatheGeometry averages normals everywhere, which rounds off chamfers.)
 * The outward side of the surface is on the right of the profile direction.
 */
export function createLathe(points: ProfilePoint[], options: LatheOptions = {}): BufferGeometry {
  const { segments = 128, phiStart = 0, phiLength = Math.PI * 2, tile = 0.22, creaseAngle = 28 } = options;

  const pts: ProfilePoint[] = [];
  for (const p of points) {
    const last = pts[pts.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > 1e-7) pts.push([Math.max(0, p[0]), p[1]]);
  }
  const segCount = pts.length - 1;
  const dirs: [number, number][] = [];
  const norms: [number, number][] = [];
  let maxR = 0;
  for (let k = 0; k < segCount; k++) {
    const dr = pts[k + 1][0] - pts[k][0];
    const dy = pts[k + 1][1] - pts[k][1];
    const len = Math.hypot(dr, dy);
    dirs.push([dr / len, dy / len]);
    norms.push([dy / len, -dr / len]);
  }
  for (const p of pts) maxR = Math.max(maxR, p[0]);

  interface Entry {
    r: number;
    y: number;
    nr: number;
    ny: number;
    v: number;
    breakBefore: boolean;
  }
  const entries: Entry[] = [];
  const cosCrease = Math.cos((creaseAngle * Math.PI) / 180);
  let arc = 0;
  for (let k = 0; k < pts.length; k++) {
    if (k > 0) arc += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
    const v = arc / tile;
    const [r, y] = pts[k];
    if (k === 0 || k === pts.length - 1) {
      const n = norms[k === 0 ? 0 : segCount - 1];
      entries.push({ r, y, nr: n[0], ny: n[1], v, breakBefore: false });
      continue;
    }
    const a = dirs[k - 1];
    const b = dirs[k];
    if (a[0] * b[0] + a[1] * b[1] < cosCrease) {
      entries.push({ r, y, nr: norms[k - 1][0], ny: norms[k - 1][1], v, breakBefore: false });
      entries.push({ r, y, nr: norms[k][0], ny: norms[k][1], v, breakBefore: true });
    } else {
      const nr = norms[k - 1][0] + norms[k][0];
      const ny = norms[k - 1][1] + norms[k][1];
      const l = Math.hypot(nr, ny) || 1;
      entries.push({ r, y, nr: nr / l, ny: ny / l, v, breakBefore: false });
    }
  }

  const cols = segments + 1;
  const uRepeat = Math.max(1, Math.round((2 * Math.PI * maxR) / tile)) * (phiLength / (Math.PI * 2));
  const positions = new Float32Array(entries.length * cols * 3);
  const normals = new Float32Array(entries.length * cols * 3);
  const uvs = new Float32Array(entries.length * cols * 2);
  const sin = new Float32Array(cols);
  const cos = new Float32Array(cols);
  for (let i = 0; i < cols; i++) {
    const phi = phiStart + (i / segments) * phiLength;
    sin[i] = Math.sin(phi);
    cos[i] = Math.cos(phi);
  }
  entries.forEach((e, row) => {
    for (let i = 0; i < cols; i++) {
      const idx = row * cols + i;
      positions[idx * 3] = e.r * sin[i];
      positions[idx * 3 + 1] = e.y;
      positions[idx * 3 + 2] = e.r * cos[i];
      normals[idx * 3] = e.nr * sin[i];
      normals[idx * 3 + 1] = e.ny;
      normals[idx * 3 + 2] = e.nr * cos[i];
      uvs[idx * 2] = (i / segments) * uRepeat;
      uvs[idx * 2 + 1] = e.v;
    }
  });
  const indices: number[] = [];
  for (let row = 0; row < entries.length - 1; row++) {
    if (entries[row + 1].breakBefore) continue;
    for (let i = 0; i < segments; i++) {
      const a = row * cols + i;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geo.setIndex(new Uint32BufferAttribute(indices, 1));
  geo.computeBoundingSphere();
  return geo;
}

/** Smooth S-curve between two profile points (for flares and transitions). */
export function sCurve(from: ProfilePoint, to: ProfilePoint, steps = 14): ProfilePoint[] {
  const out: ProfilePoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const e = t * t * (3 - 2 * t);
    out.push([from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * t]);
  }
  return out;
}

/** Chamfered rectangular groove/rib helpers used by the body profile. */
export function vGroove(r: number, y: number, depth: number, width: number): ProfilePoint[] {
  return [
    [r, y - width / 2],
    [r - depth, y],
    [r, y + width / 2],
  ];
}

/* -------------------------------------------------------------------------- */
/*  Diamond knurling                                                          */
/* -------------------------------------------------------------------------- */

export interface KnurlOptions {
  radius: number; // valley radius
  depth: number; // full pyramid height
  y0: number;
  y1: number;
  count: number; // diamonds around the circumference
  flat: number; // top land as a fraction of the half-diagonal (0..1)
  tile?: number;
  seed?: number;
  base: Color;
  worn: Color;
}

/**
 * Real geometric diamond knurl: every tooth is a truncated pyramid with flat
 * facets, so the grip catches light (and shows a serrated silhouette) the way
 * machined knurling does. Some peaks carry anodising wear via vertex colours.
 */
export function createKnurl(o: KnurlOptions): BufferGeometry {
  const { radius: R, depth, y0, y1, count, flat, tile = 0.22, seed = 3 } = o;
  const P = (2 * Math.PI * R) / count;
  const half = P / 2;
  const rowStart = Math.floor((y0 - half) / half);
  const rowEnd = Math.ceil((y1 + half) / half);
  const rnd = mulberry32(seed);
  const uScale = Math.max(1, Math.round((2 * Math.PI * R) / tile)) / (2 * Math.PI * R);

  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const wearAttr: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const tmpColor = new Color();
  const H = depth * (1 - flat);

  const toWorld = (s: number, z: number, h: number): [number, number, number] => {
    const phi = s / R;
    const r = R + h;
    return [r * Math.sin(phi), z, r * Math.cos(phi)];
  };

  const pushQuad = (q: [number, number, number][], uv: [number, number][], color: Color, wear: number) => {
    // Face normal from the quad diagonals (robust for slightly non-planar facets).
    const ax = q[2][0] - q[0][0], ay = q[2][1] - q[0][1], az = q[2][2] - q[0][2];
    const bx = q[3][0] - q[1][0], by = q[3][1] - q[1][1], bz = q[3][2] - q[1][2];
    let nx = ay * bz - az * by;
    let ny = az * bx - ax * bz;
    let nz = ax * by - ay * bx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    const baseIndex = positions.length / 3;
    for (let k = 0; k < 4; k++) {
      positions.push(q[k][0], q[k][1], q[k][2]);
      normals.push(nx, ny, nz);
      colors.push(color.r, color.g, color.b);
      wearAttr.push(wear);
      uvs.push(uv[k][0], uv[k][1]);
    }
    indices.push(baseIndex, baseIndex + 1, baseIndex + 2, baseIndex, baseIndex + 2, baseIndex + 3);
  };

  for (let m = rowStart; m <= rowEnd; m++) {
    const zc = m * half;
    for (let n = 0; n < count; n++) {
      const sc = (m + 2 * n + 1) * half;
      // Wear: a minority of peaks are rubbed down to bare aluminium.
      const roll = rnd();
      const wear = roll < 0.16 ? Math.pow(rnd(), 1.6) * 0.85 : 0;
      const tone = 0.94 + rnd() * 0.12;
      const topColor = tmpColor.copy(o.base).multiplyScalar(tone).lerp(o.worn, wear).clone();
      const sideColor = o.base.clone().multiplyScalar(tone).lerp(o.worn, wear * 0.18);

      // Corners in CCW order seen from outside: right, top, left, bottom.
      const outer: [number, number][] = [
        [sc + half, zc],
        [sc, zc + half],
        [sc - half, zc],
        [sc, zc - half],
      ];
      const inner: [number, number][] = outer.map(([s, z]) => [sc + (s - sc) * flat, zc + (z - zc) * flat]);
      const o3 = outer.map(([s, z]) => toWorld(s, z, 0));
      const i3 = inner.map(([s, z]) => toWorld(s, z, H));
      const uvOf = ([s, z]: [number, number]): [number, number] => [s * uScale, z / tile];

      for (let e = 0; e < 4; e++) {
        const a = e;
        const b = (e + 1) % 4;
        pushQuad([o3[a], o3[b], i3[b], i3[a]], [uvOf(outer[a]), uvOf(outer[b]), uvOf(inner[b]), uvOf(inner[a])], sideColor, wear * 0.18);
      }
      pushQuad([i3[0], i3[1], i3[2], i3[3]], inner.map(uvOf), topColor, wear);
    }
  }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geo.setAttribute('wear', new Float32BufferAttribute(wearAttr, 1));
  geo.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geo.setIndex(new Uint32BufferAttribute(indices, 1));
  geo.computeBoundingSphere();
  return geo;
}

/* -------------------------------------------------------------------------- */
/*  Sweep hugging the cylinder (pocket clip)                                  */
/* -------------------------------------------------------------------------- */

export interface ClipStation {
  y: number;
  r: number; // radius of the strip's centre line
  width: number;
}

/**
 * Sweeps a rounded-rectangle section along stations, bending it around the
 * torch axis so the strip follows the tube's curvature. Smooth normals.
 */
export function createCylinderSweep(stations: ClipStation[], phi0: number, thickness: number, cornerRadius: number, tile = 0.12): BufferGeometry {
  // Unit rounded-rect section in (t, n) with t ∈ [-0.5, 0.5] (scaled by width) and n ∈ [-th/2, th/2].
  const section: [number, number, number][] = []; // t factor, n offset, corner-local t offset
  const arcSteps = 5;
  const hn = thickness / 2;
  const rc = Math.min(cornerRadius, hn * 0.98);
  const corners: [number, number, number][] = [
    [0.5, hn - rc, 0], // top-right corner centre (t factor, n), start angle
    [-0.5, hn - rc, Math.PI / 2],
    [-0.5, -hn + rc, Math.PI],
    [0.5, -hn + rc, (3 * Math.PI) / 2],
  ];
  for (const [tf, nc, start] of corners) {
    for (let s = 0; s <= arcSteps; s++) {
      const a = start + (s / arcSteps) * (Math.PI / 2);
      section.push([tf, nc + Math.sin(a) * rc, Math.cos(a) * rc]);
    }
  }
  const ring = section.length;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let arc = 0;
  stations.forEach((st, k) => {
    if (k > 0) arc += Math.hypot(st.y - stations[k - 1].y, st.r - stations[k - 1].r);
    for (let i = 0; i < ring; i++) {
      const [tf, n, tOff] = section[i];
      const t = tf * (st.width - 2 * rc) + tOff;
      const rr = st.r + n;
      const phi = phi0 + t / st.r;
      positions.push(rr * Math.sin(phi), st.y, rr * Math.cos(phi));
      uvs.push(i / ring, arc / tile);
    }
  });
  for (let k = 0; k < stations.length - 1; k++) {
    for (let i = 0; i < ring; i++) {
      const a = k * ring + i;
      const b = k * ring + ((i + 1) % ring);
      const c = a + ring;
      const d = b + ring;
      indices.push(a, c, b, b, c, d);
    }
  }
  // End caps (section is convex → fan triangulation around its centroid).
  for (const [k, flip] of [[0, true], [stations.length - 1, false]] as const) {
    const st = stations[k];
    const centre = positions.length / 3;
    positions.push(st.r * Math.sin(phi0), st.y, st.r * Math.cos(phi0));
    uvs.push(0.5, 0.5);
    for (let i = 0; i < ring; i++) {
      const src = (k * ring + i) * 3;
      positions.push(positions[src], positions[src + 1], positions[src + 2]);
      uvs.push(0.5 + section[i][0] * 0.5, 0.5 + section[i][1]);
    }
    for (let i = 0; i < ring; i++) {
      const a = centre + 1 + i;
      const b = centre + 1 + ((i + 1) % ring);
      if (flip) indices.push(centre, a, b);
      else indices.push(centre, b, a);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/* -------------------------------------------------------------------------- */
/*  Small hardware                                                            */
/* -------------------------------------------------------------------------- */

function torxPath(outer: number, inner: number, samples = 96): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < samples; i++) {
    const a = (i / samples) * Math.PI * 2;
    const lobe = Math.pow(0.5 + 0.5 * Math.cos(a * 6), 0.75);
    const r = inner + (outer - inner) * lobe;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return pts;
}

/** Torx button-head screw. Local axis +Z (head top faces +Z), base at z = 0. */
export function createTorxScrew(headRadius: number, headHeight: number) {
  const shape = new Shape();
  shape.absarc(0, 0, headRadius, 0, Math.PI * 2, false);
  const recess = torxPath(headRadius * 0.52, headRadius * 0.34);
  const hole = new Path();
  // Holes must wind opposite to the outline.
  hole.moveTo(recess[0][0], recess[0][1]);
  for (let i = recess.length - 1; i > 0; i--) hole.lineTo(recess[i][0], recess[i][1]);
  hole.closePath();
  shape.holes.push(hole);
  const bevel = headHeight * 0.32;
  const head = new ExtrudeGeometry(shape, {
    depth: headHeight - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.9,
    bevelSegments: 3,
    curveSegments: 28,
  });
  head.translate(0, 0, bevel);
  const floorShape = new Shape(recess.map(([x, y]) => new Vector2(x, y)));
  const floor = new ShapeGeometry(floorShape);
  floor.translate(0, 0, headHeight * 0.32);
  return { head, floor };
}

/** One crenellation tooth of the strike bezel (annular sector). Local extrusion +Z. */
export function createBezelTooth(rIn: number, rOut: number, a0: number, a1: number, height: number) {
  const shape = new Shape();
  shape.absarc(0, 0, rOut, a0, a1, false);
  shape.absarc(0, 0, rIn, a1, a0, true);
  shape.closePath();
  const bevel = Math.min(0.0028, height * 0.2);
  const geo = new ExtrudeGeometry(shape, {
    depth: height - bevel,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.85,
    bevelOffset: -bevel * 0.85,
    bevelSegments: 2,
    curveSegments: 18,
  });
  return geo;
}

/** Patch of a cylinder (for decals that wrap the tube). U along axis, V around. */
export function createCylinderPatch(radius: number, y0: number, y1: number, phiCenter: number, phiHalf: number, segU = 24, segV = 12) {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let j = 0; j <= segV; j++) {
    const v = j / segV;
    const phi = phiCenter + phiHalf - v * 2 * phiHalf; // canvas top → larger φ
    for (let i = 0; i <= segU; i++) {
      const u = i / segU;
      const y = y1 - u * (y1 - y0); // canvas left → head side
      positions.push(radius * Math.sin(phi), y, radius * Math.cos(phi));
      normals.push(Math.sin(phi), 0, Math.cos(phi));
      uvs.push(u, 1 - v);
    }
  }
  const cols = segU + 1;
  for (let j = 0; j < segV; j++) {
    for (let i = 0; i < segU; i++) {
      const a = j * cols + i;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeBoundingSphere();
  return geo;
}
