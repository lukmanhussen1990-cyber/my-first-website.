// Procedural textures generated at load time (no image assets needed).

import * as THREE from 'three';
import { Noise } from './noise.js';
import { RNG } from './rng.js';

const cache = new Map();
function cached(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function finishData(data, size, opts = {}) {
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = opts.anisotropy ?? 4;
  if (opts.srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function finishCanvas(c, opts = {}) {
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = opts.wrapS ?? THREE.RepeatWrapping;
  tex.wrapT = opts.wrapT ?? THREE.RepeatWrapping;
  tex.anisotropy = opts.anisotropy ?? 4;
  if (opts.srgb !== false) tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Converts a periodic height field into a tangent-space normal map. */
function heightToNormal(h, size, strength) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const xl = h[y * size + ((x - 1 + size) % size)];
      const xr = h[y * size + ((x + 1) % size)];
      const yu = h[((y - 1 + size) % size) * size + x];
      const yd = h[((y + 1) % size) * size + x];
      let nx = (xl - xr) * strength;
      let ny = (yd - yu) * strength;
      const inv = 1 / Math.sqrt(nx * nx + ny * ny + 1);
      nx *= inv;
      ny *= inv;
      const i = (y * size + x) * 4;
      data[i] = (nx * 0.5 + 0.5) * 255;
      data[i + 1] = (ny * 0.5 + 0.5) * 255;
      data[i + 2] = (inv * 0.5 + 0.5) * 255;
      data[i + 3] = 255;
    }
  }
  return data;
}

/** Stamps soft round bumps with wrap-around: aggregate stones, leather pebbles. */
function stampBumps(h, size, count, rMin, rMax, rng, hMin = 0.3, hMax = 1) {
  for (let n = 0; n < count; n++) {
    const cx = rng.next() * size;
    const cy = rng.next() * size;
    const r = rng.range(rMin, rMax);
    const amp = rng.range(hMin, hMax);
    const ri = Math.ceil(r);
    for (let dy = -ri; dy <= ri; dy++) {
      for (let dx = -ri; dx <= ri; dx++) {
        const d2 = (dx * dx + dy * dy) / (r * r);
        if (d2 >= 1) continue;
        const x = (((Math.floor(cx) + dx) % size) + size) % size;
        const y = (((Math.floor(cy) + dy) % size) + size) % size;
        const v = amp * Math.sqrt(1 - d2);
        const i = y * size + x;
        if (v > h[i]) h[i] = v;
      }
    }
  }
}

/** Micro asphalt: R = height, G = albedo variation, B = pores, plus a normal map. */
export function asphaltTextures() {
  return cached('asphalt', () => {
    const size = 512;
    const rng = new RNG(911);
    const noise = new Noise(77);
    const h = new Float32Array(size * size);
    stampBumps(h, size, 26000, 1.2, 3.4, rng, 0.25, 1.0);
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        const fine = noise.fbm2(x / 16, y / 16, 3, 2, 0.5, size / 16);
        h[i] = h[i] * 0.8 + fine * 0.15;
        const alb = 0.5 + 0.5 * noise.fbm2(x / 40 + 9, y / 40, 3, 2, 0.5, size / 40);
        const stone = h[i] > 0.55 ? 1 : 0;
        data[i * 4] = Math.max(0, Math.min(255, (h[i] * 0.8 + 0.2) * 255));
        data[i * 4 + 1] = Math.max(0, Math.min(255, (alb * 0.7 + stone * 0.3 * rng.next()) * 255));
        data[i * 4 + 2] = Math.max(0, Math.min(255, (1 - h[i]) * 255));
        data[i * 4 + 3] = 255;
      }
    }
    const detail = finishData(data, size, { anisotropy: 8 });
    const normal = finishData(heightToNormal(h, size, 2.2), size, { anisotropy: 8 });
    return { detail, normal };
  });
}

/** Large-scale road variation: R puddles, G repair patches, B cracks, A stains. */
export function roadMacroTexture() {
  return cached('roadMacro', () => {
    const size = 256;
    const noise = new Noise(5150);
    const rng = new RNG(42);
    const data = new Uint8Array(size * size * 4);
    // Worley distance for crack network.
    const pts = [];
    const cells = 7;
    for (let j = 0; j < cells; j++) {
      for (let i = 0; i < cells; i++) {
        pts.push([(i + rng.next()) * (size / cells), (j + rng.next()) * (size / cells)]);
      }
    }
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const puddle = noise.fbm2(x / 48, y / 48, 4, 2, 0.5, size / 48) * 0.5 + 0.5;
        // Blocky repair patches.
        const px = Math.floor(x / 32);
        const py = Math.floor(y / 21);
        const pr = ((px * 73856093) ^ (py * 19349663)) >>> 0;
        const patch = (pr % 7) === 0 ? 1 : 0;
        let d1 = 1e9;
        let d2 = 1e9;
        for (const [qx, qy] of pts) {
          let dx = Math.abs(x - qx);
          let dy = Math.abs(y - qy);
          dx = Math.min(dx, size - dx);
          dy = Math.min(dy, size - dy);
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
        }
        const wobble = noise.n2(x / 6, y / 6, size / 6) * 2.5;
        const edge = d2 - d1 + wobble;
        const crackMask = noise.fbm2(x / 30 + 3, y / 30, 2, 2, 0.5, size / 30) > -0.05 ? 1 : 0;
        const crack = edge < 1.4 ? (1 - edge / 1.4) * crackMask : 0;
        const stain = noise.fbm2(x / 20 + 17, y / 20, 3, 2, 0.5, size / 20) * 0.5 + 0.5;
        data[i] = puddle * 255;
        data[i + 1] = patch * 255;
        data[i + 2] = Math.max(0, Math.min(1, crack)) * 255;
        data[i + 3] = stain * 255;
      }
    }
    const tex = finishData(data, size, { anisotropy: 8 });
    return tex;
  });
}

/** Tileable leather/soft-touch grain normal map. */
export function grainNormal(seed = 3, size = 256, density = 5200, rMin = 1.4, rMax = 3.2, strength = 1.6) {
  return cached(`grain-${seed}-${size}-${density}`, () => {
    const rng = new RNG(seed);
    const noise = new Noise(seed + 1);
    const h = new Float32Array(size * size);
    stampBumps(h, size, density, rMin, rMax, rng, 0.4, 1.0);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        h[y * size + x] += noise.fbm2(x / 24, y / 24, 3, 2, 0.5, size / 24) * 0.25;
      }
    }
    return finishData(heightToNormal(h, size, strength), size);
  });
}

/** Woven fabric normal map (headliner, seat inserts). */
export function weaveNormal(size = 256) {
  return cached(`weave-${size}`, () => {
    const noise = new Noise(808);
    const h = new Float32Array(size * size);
    const period = 4;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const cx = Math.floor(x / period);
        const cy = Math.floor(y / period);
        const fx = (x % period) / period;
        const fy = (y % period) / period;
        const over = (cx + cy) % 2 === 0;
        const warp = Math.sin(fx * Math.PI);
        const weft = Math.sin(fy * Math.PI);
        h[y * size + x] = (over ? warp * 0.8 + weft * 0.2 : weft * 0.8 + warp * 0.2) +
          noise.n2(x / 9, y / 9, size / 9) * 0.15;
      }
    }
    return finishData(heightToNormal(h, size, 1.2), size);
  });
}

/** Forest floor: needles, leaves, moss — albedo + normal. */
export function forestFloorTextures() {
  return cached('forestFloor', () => {
    const size = 512;
    const rng = new RNG(1234);
    const c = canvas(size, size);
    const g = c.getContext('2d');
    g.fillStyle = '#2b2219';
    g.fillRect(0, 0, size, size);
    const wrapDraw = (fn) => {
      for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) fn(ox, oy);
    };
    // Moss / dirt blotches.
    for (let i = 0; i < 260; i++) {
      const x = rng.next() * size;
      const y = rng.next() * size;
      const r = rng.range(10, 46);
      const moss = rng.chance(0.4);
      const col = moss ? `rgba(${40 + rng.int(0, 20)},${52 + rng.int(0, 22)},${26 + rng.int(0, 12)},0.35)` :
        `rgba(${50 + rng.int(0, 25)},${38 + rng.int(0, 16)},${26 + rng.int(0, 10)},0.35)`;
      wrapDraw((ox, oy) => {
        const grd = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        grd.addColorStop(0, col);
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grd;
        g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
      });
    }
    // Fallen leaves.
    for (let i = 0; i < 520; i++) {
      const x = rng.next() * size;
      const y = rng.next() * size;
      const a = rng.next() * Math.PI;
      const l = rng.range(3, 7);
      const tone = rng.int(0, 3);
      const col = ['#4a3220', '#5a3a1e', '#3d2c1c', '#5b4a2a'][tone];
      wrapDraw((ox, oy) => {
        g.save();
        g.translate(x + ox, y + oy);
        g.rotate(a);
        g.fillStyle = col;
        g.beginPath();
        g.ellipse(0, 0, l, l * 0.45, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
      });
    }
    // Pine needles.
    g.lineCap = 'round';
    for (let i = 0; i < 9000; i++) {
      const x = rng.next() * size;
      const y = rng.next() * size;
      const a = rng.next() * Math.PI * 2;
      const l = rng.range(5, 14);
      const v = rng.int(0, 4);
      const col = ['#6b4a2c', '#7d5530', '#4d3a28', '#5f5545', '#3b2c1f'][v];
      const near = x < 16 || y < 16 || x > size - 16 || y > size - 16;
      const draw = (ox, oy) => {
        g.strokeStyle = col;
        g.lineWidth = rng.range(0.6, 1.2);
        g.beginPath();
        g.moveTo(x + ox, y + oy);
        g.lineTo(x + ox + Math.cos(a) * l, y + oy + Math.sin(a) * l);
        g.stroke();
      };
      if (near) wrapDraw(draw); else draw(0, 0);
    }
    // Twigs.
    for (let i = 0; i < 70; i++) {
      const x = rng.next() * size;
      const y = rng.next() * size;
      const a = rng.next() * Math.PI * 2;
      const l = rng.range(16, 40);
      wrapDraw((ox, oy) => {
        g.strokeStyle = '#3a2b1e';
        g.lineWidth = rng.range(1.2, 2.4);
        g.beginPath();
        g.moveTo(x + ox, y + oy);
        g.quadraticCurveTo(x + ox + Math.cos(a + 0.3) * l * 0.5, y + oy + Math.sin(a + 0.3) * l * 0.5,
          x + ox + Math.cos(a) * l, y + oy + Math.sin(a) * l);
        g.stroke();
      });
    }
    const albedo = finishCanvas(c, { anisotropy: 8 });
    // Height from luminance for the normal map.
    const img = g.getImageData(0, 0, size, size).data;
    const h = new Float32Array(size * size);
    for (let i = 0; i < size * size; i++) {
      h[i] = (img[i * 4] * 0.4 + img[i * 4 + 1] * 0.5 + img[i * 4 + 2] * 0.1) / 255;
    }
    const normal = finishData(heightToNormal(h, size, 3.0), size, { anisotropy: 8 });
    return { albedo, normal };
  });
}

/** Spruce branch layer: dense needles near the trunk, ragged tips at the bottom edge. */
export function foliageTexture() {
  return cached('foliage', () => {
    const w = 256;
    const h = 256;
    const rng = new RNG(31337);
    const c = canvas(w, h);
    const g = c.getContext('2d');
    g.clearRect(0, 0, w, h);
    g.lineCap = 'round';
    const greens = ['#1d2b1f', '#243426', '#2c3d2b', '#1a251b', '#334532', '#202f22'];
    // Dense inner mass.
    for (let i = 0; i < 2600; i++) {
      const x = rng.next() * w;
      const y = rng.next() * h * 0.55;
      const a = Math.PI * 0.5 + rng.range(-0.9, 0.9);
      const l = rng.range(6, 14);
      g.strokeStyle = rng.pick(greens);
      g.lineWidth = rng.range(1.0, 2.2);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }
    // Branches reaching down to ragged tips.
    const branches = 22;
    for (let b = 0; b < branches; b++) {
      let x = (b + rng.next()) * (w / branches);
      let y = rng.range(0, h * 0.3);
      const end = rng.range(h * 0.72, h * 0.98);
      const sway = rng.range(-0.25, 0.25);
      while (y < end) {
        const nx = x + sway * 4 + rng.range(-1, 1);
        const ny = y + 5;
        g.strokeStyle = '#2a2219';
        g.lineWidth = 1.4 * (1 - y / h) + 0.6;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(nx, ny);
        g.stroke();
        // Needles on both sides, sweeping downward.
        for (let k = 0; k < 4; k++) {
          const side = k % 2 ? 1 : -1;
          const a = Math.PI * 0.5 + side * rng.range(0.5, 1.1);
          const l = rng.range(5, 11) * (1 - 0.4 * (y / h));
          g.strokeStyle = rng.pick(greens);
          g.lineWidth = rng.range(0.9, 1.6);
          g.beginPath();
          g.moveTo(nx, ny - k);
          g.lineTo(nx + Math.cos(a) * l, ny - k + Math.sin(a) * l);
          g.stroke();
        }
        x = nx;
        y = ny;
      }
    }
    return finishCanvas(c, { wrapT: THREE.ClampToEdgeWrapping, anisotropy: 4 });
  });
}

export function barkTexture() {
  return cached('bark', () => {
    const w = 128;
    const h = 256;
    const rng = new RNG(99);
    const c = canvas(w, h);
    const g = c.getContext('2d');
    g.fillStyle = '#2a221c';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const x = rng.next() * w;
      const y = rng.next() * h;
      const l = rng.range(20, 90);
      const v = rng.int(0, 3);
      g.strokeStyle = ['#3a3027', '#1b1612', '#463b30', '#2f2a25'][v];
      g.lineWidth = rng.range(1, 4);
      for (const ox of [-w, 0, w]) {
        for (const oy of [-h, 0, h]) {
          g.beginPath();
          g.moveTo(x + ox, y + oy);
          g.lineTo(x + ox + rng.range(-3, 3), y + oy + l);
          g.stroke();
        }
      }
    }
    for (let i = 0; i < 40; i++) {
      const x = rng.next() * w;
      const y = rng.next() * h;
      g.strokeStyle = '#120e0b';
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + rng.range(6, 18), y + rng.range(-2, 2));
      g.stroke();
    }
    return finishCanvas(c);
  });
}

export function grassTexture() {
  return cached('grass', () => {
    const w = 128;
    const h = 128;
    const rng = new RNG(4242);
    const c = canvas(w, h);
    const g = c.getContext('2d');
    g.clearRect(0, 0, w, h);
    g.lineCap = 'round';
    const cols = ['#3c4a2a', '#4f5631', '#5f5a36', '#2f3d24', '#6b6440', '#46502e'];
    for (let i = 0; i < 46; i++) {
      const x0 = rng.range(w * 0.15, w * 0.85);
      const len = rng.range(h * 0.45, h * 0.98);
      const bend = rng.range(-28, 28);
      const width = rng.range(1.6, 3.4);
      g.strokeStyle = rng.pick(cols);
      const steps = 8;
      for (let s = 0; s < steps; s++) {
        const t0 = s / steps;
        const t1 = (s + 1) / steps;
        g.lineWidth = width * (1 - t0 * 0.85);
        g.beginPath();
        g.moveTo(x0 + bend * t0 * t0, h - len * t0);
        g.lineTo(x0 + bend * t1 * t1, h - len * t1);
        g.stroke();
      }
    }
    return finishCanvas(c, { wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping });
  });
}

/** Low-beam headlight pattern projected by the spot lights (top of canvas = up). */
export function headlightPattern() {
  return cached('headlight', () => {
    const size = 256;
    const c = canvas(size, size);
    const g = c.getContext('2d');
    const img = g.createImageData(size, size);
    const noise = new Noise(7);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / (size - 1) - 0.5; // -0.5 left .. 0.5 right
        const v = 0.5 - y / (size - 1); // -0.5 bottom .. 0.5 top
        // Asymmetric cutoff: kinks upward on the right (kerb side).
        const cutoff = 0.012 + (u > 0.03 ? Math.min((u - 0.03) * 0.55, 0.05) : 0);
        const below = 1 / (1 + Math.exp((v - cutoff) / 0.0045));
        const hot = Math.exp(-((u - 0.035) ** 2) / 0.006 - ((v + 0.035) ** 2) / 0.0016);
        const spread = Math.exp(-(u * u) / 0.075 - ((v + 0.06) ** 2) / 0.012);
        const wide = Math.exp(-(u * u) / 0.18 - ((v + 0.12) ** 2) / 0.05);
        // Less light right in front of the bumper (steep downward angles).
        const near = 0.35 + 0.65 * Math.min(1, Math.max(0, (v + 0.42) / 0.3));
        let I = (hot * 1.0 + spread * 0.55 + wide * 0.22) * below * near;
        I += 0.018 * Math.exp(-(u * u) / 0.1) * (1 - below); // stray light above the cutoff
        I *= 0.92 + 0.08 * noise.n2(x / 9, y / 9);
        // Faint cool fringe along the cutoff line.
        const fringe = Math.exp(-((v - cutoff - 0.008) ** 2) / 0.00003) * 0.12 * Math.exp(-(u * u) / 0.08);
        const edgeFade = Math.min(1, (0.5 - Math.abs(u)) / 0.08) * Math.min(1, (0.5 - Math.abs(v)) / 0.08);
        const r = Math.min(1, I + fringe * 0.6) * edgeFade;
        const gg = Math.min(1, I + fringe * 0.8) * edgeFade;
        const b = Math.min(1, I + fringe * 1.4) * edgeFade;
        const i = (y * size + x) * 4;
        img.data[i] = Math.pow(r, 1 / 2.2) * 255;
        img.data[i + 1] = Math.pow(gg, 1 / 2.2) * 255;
        img.data[i + 2] = Math.pow(b, 1 / 2.2) * 255;
        img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    const tex = finishCanvas(c, { wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping, anisotropy: 1 });
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    return tex;
  });
}

/** Tileable 3D noise for volumetric fog density (R8). */
export function fogNoise3D(size = 64) {
  return cached(`fog3d-${size}`, () => {
    const noise = new Noise(2024);
    const data = new Uint8Array(size * size * size);
    const p = 4; // lattice cells per tile on the base octave
    for (let z = 0; z < size; z++) {
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const fx = (x / size) * p;
          const fy = (y / size) * p;
          const fz = (z / size) * p;
          let n = noise.fbm3(fx, fy, fz, 4, 2, 0.52, p);
          // Billowy shapes: fold the noise.
          n = 1 - Math.abs(n * 1.4);
          n = n * n;
          data[(z * size + y) * size + x] = Math.max(0, Math.min(255, n * 255));
        }
      }
    }
    const tex = new THREE.Data3DTexture(data, size, size, size);
    tex.format = THREE.RedFormat;
    tex.type = THREE.UnsignedByteType;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.wrapS = tex.wrapT = tex.wrapR = THREE.RepeatWrapping;
    tex.unpackAlignment = 1;
    tex.needsUpdate = true;
    return tex;
  });
}

/** Soft radial sprite used for glows, bulbs and eyeshine. */
export function glowSprite() {
  return cached('glow', () => {
    const size = 128;
    const c = canvas(size, size);
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.18, 'rgba(255,255,255,0.55)');
    grd.addColorStop(0.45, 'rgba(255,255,255,0.12)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, size, size);
    return finishCanvas(c, { wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping });
  });
}
