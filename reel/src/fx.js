// Effects: cables with flowing electricity dots, lawn seams, rain, particles, lightning, crackles.
import * as THREE from 'three';
import { puff, glowSprite } from './textures.js';
import { rng } from './util.js';

const TAU = Math.PI * 2;
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// ---------------- Cables ----------------
// Rounded polyline curve through points.
export function polyCurve(points, tension = 0.2) {
  return new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', tension);
}

const conduitMat = new THREE.MeshPhysicalMaterial({ color: '#7f95a8', roughness: 0.1, metalness: 0, transparent: true, opacity: 0.38, clearcoat: 1, clearcoatRoughness: 0.05, depthWrite: false, side: THREE.DoubleSide });
const coreMat = new THREE.MeshStandardMaterial({ color: '#e08a50', metalness: 0.9, roughness: 0.3, emissive: new THREE.Color('#c86a2a'), emissiveIntensity: 0.12 });

export class Cable {
  constructor(curve, { radius = 0.045, segs = 200, dots = 40, speed = 1, dir = 1, name = '' } = {}) {
    this.curve = curve; this.name = name;
    this.len = curve.getLength();
    this.outerGeo = new THREE.TubeGeometry(curve, segs, radius, 14, false);
    this.coreGeo = new THREE.TubeGeometry(curve, segs, radius * 0.36, 8, false);
    this.coreMat = coreMat.clone();
    this.outer = new THREE.Mesh(this.outerGeo, conduitMat); this.outer.renderOrder = 2;
    this.core = new THREE.Mesh(this.coreGeo, this.coreMat); this.core.castShadow = false; this.core.receiveShadow = true;
    this.group = new THREE.Group(); this.group.add(this.core, this.outer);
    this.nDots = dots; this.speed = speed; this.dir = dir;
    this.reveal = 0; this.density = 0; this.flow = 0; this.glow = 0;
    // arc-length lookup
    this.samples = [];
    for (let i = 0; i <= 400; i++) this.samples.push(curve.getPointAt(i / 400));
    this.tangents = [];
    for (let i = 0; i <= 400; i++) this.tangents.push(curve.getTangentAt(i / 400));
  }
  setReveal(p) {
    this.reveal = p;
    const ri = (geo) => { const n = geo.index.count; geo.setDrawRange(0, Math.floor(n * Math.min(1, Math.max(0, p)) / 6) * 6); };
    ri(this.outerGeo); ri(this.coreGeo);
    this.group.visible = p > 0.001;
    this.coreMat.emissiveIntensity = 0.12 + this.glow;
  }
  pointAt(u) { const x = Math.min(400, Math.max(0, u * 400)); const i = Math.floor(x); const f = x - i; return this.samples[i].clone().lerp(this.samples[Math.min(400, i + 1)], f); }
  tangentAt(u) { const i = Math.round(Math.min(400, Math.max(0, u * 400))); return this.tangents[i]; }
}

export class DotSystem {
  constructor(max = 2000) {
    this.max = max;
    const geo = new THREE.SphereGeometry(1, 10, 8);
    this.mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(5.0, 3.4, 0.7), toneMapped: true });
    this.mesh = new THREE.InstancedMesh(geo, this.mat, max);
    this.mesh.frustumCulled = false; this.mesh.count = 0;
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.up = new THREE.Vector3(0, 1, 0);
  }
  update(cables, frameStretch = 1) {
    let k = 0;
    const s = new THREE.Vector3();
    for (const c of cables) {
      if (!c.group.visible || c.density <= 0.001) continue;
      for (let i = 0; i < c.nDots && k < this.max; i++) {
        const h = hash(i * 7.31 + c.nDots * 0.17 + (c.name.length * 3.1));
        const vis = Math.min(1, Math.max(0, (c.density - h) / 0.08 + 0.5));
        if (vis <= 0) continue;
        let u = (i / c.nDots + c.flow * c.speed * c.dir / Math.max(0.5, c.len) + h * 0.013) % 1; if (u < 0) u += 1;
        if (u > c.reveal) continue;
        const p = c.pointAt(u); const t = c.tangentAt(u);
        const r = c.dotR ?? 0.03;
        const stretch = 1 + Math.min(0.9, c.dotStretch ?? 0) * frameStretch;
        this.q.setFromUnitVectors(this.up, t);
        // fade at ends
        const endF = Math.min(1, u / 0.02, (c.reveal - u) / 0.02 + 0.2);
        const sc = r * vis * Math.max(0, endF);
        s.set(sc, sc * stretch, sc);
        this.m.compose(p, this.q, s);
        this.mesh.setMatrixAt(k++, this.m);
      }
    }
    this.mesh.count = k;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// Seam: a dug trench on the lawn with a glowing buried cable.
export class Seam {
  constructor(curve, name) {
    this.curve = curve; this.name = name; this.len = curve.getLength();
    const N = 160;
    const mk = (w, y) => {
      const pos = [], idx = [];
      for (let i = 0; i <= N; i++) {
        const p = curve.getPointAt(i / N), t = curve.getTangentAt(i / N);
        const n = new THREE.Vector3(-t.z, 0, t.x).normalize();
        pos.push(p.x + n.x * w, y, p.z + n.z * w, p.x - n.x * w, y, p.z - n.z * w);
        if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      return g;
    };
    this.trenchGeo = mk(0.075, 0.018);
    this.glowGeo = mk(0.022, 0.024);
    this.trench = new THREE.Mesh(this.trenchGeo, new THREE.MeshStandardMaterial({ color: '#3a2618', roughness: 1 }));
    this.trench.receiveShadow = true;
    this.glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0, 0) });
    this.glow = new THREE.Mesh(this.glowGeo, this.glowMat);
    this.group = new THREE.Group(); this.group.add(this.trench, this.glow);
    this.samples = []; this.tangents = [];
    for (let i = 0; i <= 400; i++) { this.samples.push(curve.getPointAt(i / 400).setY(0.035)); this.tangents.push(curve.getTangentAt(i / 400)); }
    this.nDots = Math.max(12, Math.round(this.len * 5)); this.speed = 1; this.dir = 1; this.reveal = 0; this.density = 0; this.flow = 0;
    this.dotR = 0.03;
  }
  setReveal(p, glow) {
    this.reveal = p;
    for (const g of [this.trenchGeo, this.glowGeo]) g.setDrawRange(0, Math.floor(g.index.count * Math.min(1, Math.max(0, p)) / 6) * 6);
    this.group.visible = p > 0.001;
    this.glowMat.color.setRGB(1.1 * glow, 0.65 * glow, 0.13 * glow);
  }
  pointAt(u) { const x = Math.min(400, Math.max(0, u * 400)); const i = Math.floor(x); return this.samples[i].clone().lerp(this.samples[Math.min(400, i + 1)], x - i); }
  tangentAt(u) { return this.tangents[Math.round(Math.min(400, Math.max(0, u * 400)))]; }
}

// ---------------- Rain (GPU) ----------------
export function makeRain(count = 9000) {
  const geo = new THREE.InstancedBufferGeometry();
  const quad = new THREE.PlaneGeometry(1, 1);
  geo.index = quad.index; geo.attributes.position = quad.attributes.position; geo.attributes.uv = quad.attributes.uv;
  const R = rng(99);
  const seeds = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) { seeds[i * 4] = R(); seeds[i * 4 + 1] = R(); seeds[i * 4 + 2] = R(); seeds[i * 4 + 3] = R(); }
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
  geo.instanceCount = count;
  const u = {
    uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uSize: { value: new THREE.Vector3(14, 9, 14) },
    uAmount: { value: 0 }, uLen: { value: 0.32 }, uBright: { value: 1 }, uWind: { value: 0.3 }, uCam: { value: new THREE.Vector3() },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, blending: THREE.NormalBlending,
    vertexShader: /* glsl */`
      attribute vec4 aSeed; uniform float uTime, uAmount, uLen, uWind; uniform vec3 uCenter, uSize, uCam;
      varying vec2 vUv; varying float vA;
      void main(){
        vUv = uv;
        float spd = 9.0 + aSeed.w*3.0;
        vec3 p = uCenter + (aSeed.xyz - 0.5) * uSize;
        float fall = mod(uTime*spd + aSeed.y*uSize.y*7.0, uSize.y);
        p.y = uCenter.y + uSize.y*0.5 - fall;
        p.x += -uWind * fall * 0.35 + uWind*uSize.y*0.17;
        vec3 vel = normalize(vec3(-uWind*0.35, -1.0, 0.0));
        vec3 toCam = normalize(uCam - p);
        vec3 side = normalize(cross(vel, toCam));
        float w = 0.0065 + aSeed.z*0.004;
        vec3 wp = p + side * position.x * w + vel * position.y * uLen * (0.7+aSeed.x*0.6);
        vA = step(aSeed.w, uAmount) * (0.35 + 0.4*aSeed.z);
        // fade near camera to avoid big blobs
        float dc = length(uCam - p);
        vA *= smoothstep(0.6, 2.0, dc);
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform float uBright; varying vec2 vUv; varying float vA;
      void main(){
        float a = (1.0 - abs(vUv.x*2.0-1.0)) * smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.6, vUv.y);
        gl_FragColor = vec4(vec3(0.62,0.7,0.85)*uBright, a*vA);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 5;
  return { mesh, uniforms: u };
}

// splashes on the lawn & roofs (GPU)
export function makeSplashes(count = 1400, areas) {
  const geo = new THREE.InstancedBufferGeometry();
  const quad = new THREE.PlaneGeometry(1, 1); quad.rotateX(-Math.PI / 2);
  geo.index = quad.index; geo.attributes.position = quad.attributes.position; geo.attributes.uv = quad.attributes.uv;
  const R = rng(7);
  const a = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const ar = areas[Math.floor(R() * areas.length)];
    a[i * 4] = ar[0] + R() * (ar[1] - ar[0]); a[i * 4 + 1] = ar[4]; a[i * 4 + 2] = ar[2] + R() * (ar[3] - ar[2]); a[i * 4 + 3] = R();
  }
  geo.setAttribute('aP', new THREE.InstancedBufferAttribute(a, 4)); geo.instanceCount = count;
  const u = { uTime: { value: 0 }, uAmount: { value: 0 }, uBright: { value: 1 } };
  const mat = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false,
    vertexShader: `attribute vec4 aP; uniform float uTime, uAmount; varying vec2 vUv; varying float vA;
      void main(){ vUv = uv; float ph = fract(uTime*2.3 + aP.w*13.7); float s = 0.02 + ph*0.09;
        vA = (1.0-ph) * step(fract(aP.w*91.3), uAmount);
        vec3 p = aP.xyz + vec3(position.x*s, 0.004, position.z*s);
        gl_Position = projectionMatrix*viewMatrix*vec4(p,1.); }`,
    fragmentShader: `uniform float uBright; varying vec2 vUv; varying float vA;
      void main(){ float r = length(vUv-0.5)*2.0; float ring = smoothstep(0.55,0.8,r)*smoothstep(1.0,0.85,r);
        gl_FragColor = vec4(vec3(0.75,0.82,0.95)*uBright, ring*vA*0.7); }`,
  });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 4;
  return { mesh, uniforms: u };
}

// ---------------- Billboard particle system (CPU positions) ----------------
export class Billboards {
  constructor(max, { additive = false, texture = null, soft = true } = {}) {
    this.max = max;
    const geo = new THREE.InstancedBufferGeometry();
    const quad = new THREE.PlaneGeometry(1, 1);
    geo.index = quad.index; geo.attributes.position = quad.attributes.position; geo.attributes.uv = quad.attributes.uv;
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.aCol = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4);
    this.aSz = new THREE.InstancedBufferAttribute(new Float32Array(max * 2), 2); // size, rotation
    this.aVel = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3); // for streaks
    for (const [k, v] of [['aPos', this.aPos], ['aCol', this.aCol], ['aSz', this.aSz], ['aVel', this.aVel]]) { v.setUsage(THREE.DynamicDrawUsage); geo.setAttribute(k, v); }
    geo.instanceCount = 0;
    this.geo = geo;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: texture || puff() }, uStreak: { value: 0 } },
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: /* glsl */`
        attribute vec3 aPos; attribute vec4 aCol; attribute vec2 aSz; attribute vec3 aVel; uniform float uStreak;
        varying vec2 vUv; varying vec4 vCol;
        void main(){
          vUv = uv; vCol = aCol;
          vec4 mv = viewMatrix * vec4(aPos, 1.0);
          float c = cos(aSz.y), s = sin(aSz.y);
          vec2 q = vec2(position.x*c - position.y*s, position.x*s + position.y*c) * aSz.x;
          if (uStreak > 0.5) {
            vec3 vv = (viewMatrix * vec4(aVel, 0.0)).xyz;
            vec2 d = length(vv.xy) > 1e-4 ? normalize(vv.xy) : vec2(0.,1.);
            vec2 n = vec2(-d.y, d.x);
            float L = max(aSz.x, length(vv.xy)*aSz.y);
            q = n * position.x * aSz.x + d * position.y * L;
          }
          mv.xy += q;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        uniform sampler2D uMap; varying vec2 vUv; varying vec4 vCol;
        void main(){ vec4 t = texture2D(uMap, vUv); gl_FragColor = vec4(vCol.rgb * t.rgb, t.a * vCol.a); }`,
    });
    this.mesh = new THREE.Mesh(geo, this.mat); this.mesh.frustumCulled = false;
    this.list = [];
  }
  begin() { this.list.length = 0; }
  push(p, col, a, size, rot = 0, vel = null, velScale = 0) { if (this.list.length < this.max) this.list.push([p.x, p.y, p.z, col[0], col[1], col[2], a, size, rot, vel ? vel.x : 0, vel ? vel.y : 0, vel ? vel.z : 0, velScale]); }
  end(camera, sort = true) {
    if (sort) {
      const cp = camera.position;
      this.list.sort((A, B) => ((B[0] - cp.x) ** 2 + (B[1] - cp.y) ** 2 + (B[2] - cp.z) ** 2) - ((A[0] - cp.x) ** 2 + (A[1] - cp.y) ** 2 + (A[2] - cp.z) ** 2));
    }
    const n = this.list.length;
    for (let i = 0; i < n; i++) {
      const e = this.list[i];
      this.aPos.setXYZ(i, e[0], e[1], e[2]); this.aCol.setXYZW(i, e[3], e[4], e[5], e[6]);
      this.aSz.setXY(i, e[7], this.mat.uniforms.uStreak.value > 0.5 ? e[12] : e[8]);
      this.aVel.setXYZ(i, e[9], e[10], e[11]);
    }
    for (const a of [this.aPos, this.aCol, this.aSz, this.aVel]) a.needsUpdate = true;
    this.geo.instanceCount = n;
  }
}

// small lit 3D chunks (dirt clods, water drops)
export class Chunks {
  constructor(max, mat, geo) {
    this.mesh = new THREE.InstancedMesh(geo || new THREE.IcosahedronGeometry(1, 0), mat, max);
    this.mesh.frustumCulled = false; this.mesh.count = 0; this.mesh.castShadow = false;
    this.max = max; this.k = 0; this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.s = new THREE.Vector3();
  }
  begin() { this.k = 0; }
  push(p, size, rot = 0, sy = 1) { if (this.k >= this.max) return; this.e.set(rot, rot * 1.3, rot * 0.7); this.q.setFromEuler(this.e); this.s.set(size, size * sy, size); this.m.compose(p, this.q, this.s); this.mesh.setMatrixAt(this.k++, this.m); }
  end() { this.mesh.count = this.k; this.mesh.instanceMatrix.needsUpdate = true; }
}

// ---------------- Lightning bolt geometry ----------------
export function boltGeometry(start, end, seed, width = 0.35, branches = 4) {
  const R = rng(seed);
  const pts = [start.clone(), end.clone()];
  let disp = start.distanceTo(end) * 0.18;
  for (let it = 0; it < 6; it++) {
    const np = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const m = a.clone().lerp(b, 0.5);
      m.x += (R() - 0.5) * disp; m.z += (R() - 0.5) * disp * 0.4; m.y += (R() - 0.5) * disp * 0.3;
      np.push(a, m);
    }
    np.push(pts[pts.length - 1]);
    pts.splice(0, pts.length, ...np);
    disp *= 0.55;
  }
  const geos = [];
  const ribbon = (P, w) => {
    const curve = new THREE.CatmullRomCurve3(P, false, 'catmullrom', 0.0);
    return new THREE.TubeGeometry(curve, P.length * 2, w, 5, false);
  };
  geos.push(ribbon(pts, width));
  for (let b = 0; b < branches; b++) {
    const i0 = Math.floor(pts.length * (0.15 + R() * 0.55));
    const bp = [pts[i0].clone()];
    const dir = new THREE.Vector3((R() - 0.5) * 2, -0.8 - R(), (R() - 0.5) * 0.4).normalize();
    let cur = pts[i0].clone(); const L = start.distanceTo(end) * (0.08 + R() * 0.12);
    for (let k = 0; k < 10; k++) { cur = cur.clone().addScaledVector(dir, L / 10); cur.x += (R() - 0.5) * L * 0.12; bp.push(cur); }
    geos.push(ribbon(bp, width * 0.5));
  }
  return geos;
}

// crackle arcs (small jagged tubes) around a center
export function crackleGeos(n, seed, radius = 0.25) {
  const R = rng(seed); const out = [];
  for (let i = 0; i < n; i++) {
    const a = R() * TAU, b = a + 0.6 + R() * 1.4;
    const pts = [];
    for (let k = 0; k <= 8; k++) {
      const t = k / 8; const ang = a + (b - a) * t; const r = radius * (1 + (R() - 0.5) * 0.35 + Math.sin(t * Math.PI) * 0.25);
      pts.push(new THREE.Vector3(Math.cos(ang) * r, Math.sin(ang) * r, (R() - 0.5) * 0.12));
    }
    out.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0), 24, 0.006, 4, false));
  }
  return out;
}
