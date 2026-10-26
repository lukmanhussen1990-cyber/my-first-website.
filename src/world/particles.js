// Deterministic particle systems (positions are pure functions of time):
// snowfall / blowing snow, sprite puffs (breath, impact, snow dust), falling chunks, ice chips.
import * as THREE from 'three';
import { mulberry32 } from '../util.js';

function snowSystem(tex, N, seed) {
  const rnd = mulberry32(seed);
  const pos = new Float32Array(N * 3), sd = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    pos.set([rnd(), rnd(), rnd()], i * 3);
    sd.set([rnd(), rnd(), rnd(), rnd()], i * 4);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('seed', new THREE.BufferAttribute(sd, 4));
  const u = {
    uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uBox: { value: new THREE.Vector3(20, 20, 20) },
    uVel: { value: new THREE.Vector3(0, -1, 0) }, uTurb: { value: 0.4 }, uSize: { value: 40 }, uAlpha: { value: 0 },
    uColor: { value: new THREE.Vector3(0.85, 0.9, 1.0) }, tSprite: { value: tex.sprite }, uPx: { value: 1 }, uStreak: { value: 0 },
  };
  const m = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false,
    vertexShader: /* glsl */ `
      attribute vec4 seed; uniform float uTime, uTurb, uSize, uPx, uAlpha; uniform vec3 uCenter, uBox, uVel; varying float vA;
      void main(){
        vec3 v = uVel * (0.7 + 0.6*seed.x);
        vec3 p = position * uBox + v * uTime;
        p.x += sin(uTime*(0.6+seed.y) + seed.z*30.) * uTurb;
        p.z += cos(uTime*(0.5+seed.w) + seed.y*20.) * uTurb;
        // wrap into the box around the centre
        vec3 rel = p - (uCenter - uBox*0.5);
        rel = mod(rel, uBox);
        p = uCenter - uBox*0.5 + rel;
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        float edge = min(min(rel.x, uBox.x-rel.x)/uBox.x, min(rel.y, uBox.y-rel.y)/uBox.y);
        vA = uAlpha * smoothstep(0.0, 0.08, edge) * (0.5 + 0.5*seed.w);
        gl_PointSize = uSize * uPx * (0.4 + seed.x*0.9) / max(-mv.z, 0.1);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tSprite; uniform vec3 uColor; varying float vA;
      void main(){ float s = texture2D(tSprite, gl_PointCoord).r; if (s*vA < 0.003) discard; gl_FragColor = vec4(uColor, s*vA); }`,
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  pts.renderOrder = 20;
  pts.visible = false;
  return { points: pts, u };
}

// a pool of soft camera-facing sprites driven per frame by the shots (breath, puffs, dust)
function spritePool(tex, N) {
  const pos = new Float32Array(N * 3), size = new Float32Array(N), alpha = new Float32Array(N), col = new Float32Array(N * 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('psize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('palpha', new THREE.BufferAttribute(alpha, 1));
  g.setAttribute('pcol', new THREE.BufferAttribute(col, 3));
  const u = { tSprite: { value: tex.puff }, uPx: { value: 1 } };
  const m = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false,
    vertexShader: /* glsl */ `
      attribute float psize; attribute float palpha; attribute vec3 pcol; uniform float uPx; varying float vA; varying vec3 vC;
      void main(){ vA = palpha; vC = pcol; vec4 mv = modelViewMatrix * vec4(position,1.); gl_PointSize = psize * uPx * 900.0 / max(-mv.z, 0.05); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tSprite; varying float vA; varying vec3 vC;
      void main(){ float s = texture2D(tSprite, gl_PointCoord).r; if (s*vA < 0.002) discard; gl_FragColor = vec4(vC, s*vA); }`,
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  pts.renderOrder = 21;
  let n = 0;
  return {
    points: pts, u, N,
    begin() { n = 0; },
    add(x, y, z, s, a, r = 1, gg = 1, b = 1) {
      if (n >= N || a <= 0.001) return;
      pos[n * 3] = x; pos[n * 3 + 1] = y; pos[n * 3 + 2] = z;
      size[n] = s; alpha[n] = a; col[n * 3] = r; col[n * 3 + 1] = gg; col[n * 3 + 2] = b;
      n++;
    },
    end() {
      g.setDrawRange(0, n);
      for (const k of ['position', 'psize', 'palpha', 'pcol']) g.attributes[k].needsUpdate = true;
      pts.visible = n > 0;
    },
  };
}

// instanced rigid bits (snow chunks / ice chips)
function chunkPool(N, geo, mat) {
  const mesh = new THREE.InstancedMesh(geo, mat, N);
  mesh.frustumCulled = false;
  mesh.count = 0;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
  let n = 0;
  return {
    mesh,
    begin() { n = 0; },
    add(x, y, z, rx, ry, rz, sc) {
      if (n >= N) return;
      e.set(rx, ry, rz);
      q.setFromEuler(e);
      s.set(sc, sc, sc);
      p.set(x, y, z);
      m4.compose(p, q, s);
      mesh.setMatrixAt(n++, m4);
    },
    end() { mesh.count = n; mesh.instanceMatrix.needsUpdate = true; mesh.visible = n > 0; },
  };
}

export function createParticles(tex) {
  const group = new THREE.Group();
  const snow = snowSystem(tex, 3000, 101);
  const snow2 = snowSystem(tex, 1200, 202); // second layer (near, bigger flakes / storm streaks)
  const sprites = spritePool(tex, 600);
  const chunkGeo = new THREE.IcosahedronGeometry(0.12, 0);
  const chunkMat = new THREE.MeshStandardMaterial({ color: 0xe6eef8, roughness: 0.9, flatShading: true, transparent: true, depthWrite: true });
  const chunks = chunkPool(160, chunkGeo, chunkMat);
  const chipGeo = new THREE.TetrahedronGeometry(0.03, 0);
  const chipMat = new THREE.MeshStandardMaterial({ color: 0xcfeeff, roughness: 0.15, metalness: 0.1, emissive: new THREE.Color(0.08, 0.16, 0.22), flatShading: true, transparent: true, depthWrite: true });
  const chips = chunkPool(260, chipGeo, chipMat);
  group.add(snow.points, snow2.points, sprites.points, chunks.mesh, chips.mesh);
  return { group, snow, snow2, sprites, chunks, chips };
}
