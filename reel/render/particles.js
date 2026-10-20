// Deterministic particles: every particle's state is a closed-form function of
// its spawn time, so any frame can be rendered alone and nothing flickers.
import * as THREE from 'three';
import { rng } from './lib/util.js';

// Hash -> [0,1) for (seed, index, channel)
export function h(seed, i, c = 0) {
  let x = (seed * 374761393 + i * 668265263 + c * 2147483647) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 1274126177) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  return x / 4294967296;
}

function rockGeometry() {
  const g = new THREE.IcosahedronGeometry(1, 0);
  const r = rng(77);
  const p = g.attributes.position;
  // jitter shared vertices consistently
  const map = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    if (!map.has(k)) map.set(k, 0.7 + r() * 0.55);
    const s = map.get(k);
    p.setXYZ(i, p.getX(i) * s, p.getY(i) * s * 0.8, p.getZ(i) * s);
  }
  g.computeVertexNormals();
  return g;
}

export class Particles {
  constructor(scene, { chunks = 3500, sparks = 2600, puffs = 1400 } = {}) {
    this.scene = scene;
    // tumbling chunks (dirt, rock, sand)
    const cMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0 });
    this.chunk = new THREE.InstancedMesh(rockGeometry(), cMat, chunks);
    this.chunk.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(chunks * 3), 3);
    this.chunk.castShadow = true; this.chunk.receiveShadow = true; this.chunk.frustumCulled = false;
    scene.add(this.chunk);
    // glowing sparks: unit box along +y, stretched along velocity
    const sGeo = new THREE.BoxGeometry(1, 1, 1); sGeo.translate(0, -0.5, 0);
    const sMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false });
    this.spark = new THREE.InstancedMesh(sGeo, sMat, sparks);
    this.spark.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(sparks * 3), 3);
    this.spark.frustumCulled = false;
    scene.add(this.spark);
    // soft puffs: camera-facing quads with a radial falloff
    const pGeo = new THREE.PlaneGeometry(1, 1);
    this.puffAlpha = new THREE.InstancedBufferAttribute(new Float32Array(puffs), 1);
    pGeo.setAttribute('aAlpha', this.puffAlpha);
    const pMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      vertexShader: /* glsl */`
        attribute float aAlpha; varying float vA; varying vec2 vUv; varying vec3 vCol;
        void main(){
          vUv = uv; vA = aAlpha;
          #ifdef USE_INSTANCING_COLOR
            vCol = instanceColor;
          #else
            vCol = vec3(1.0);
          #endif
          vec4 c = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float s = length(instanceMatrix[0].xyz);
          float rot = atan(instanceMatrix[0].y, instanceMatrix[0].x);
          vec2 q = position.xy * s; q = vec2(q.x * cos(rot) - q.y * sin(rot), q.x * sin(rot) + q.y * cos(rot));
          c.xy += q;
          gl_Position = projectionMatrix * c;
        }`,
      fragmentShader: /* glsl */`
        varying float vA; varying vec2 vUv; varying vec3 vCol;
        void main(){
          vec2 d = vUv - 0.5; float r = length(d) * 2.0;
          float a = smoothstep(1.0, 0.0, r); a *= a;
          gl_FragColor = vec4(vCol, a * vA);
        }`,
    });
    this.puff = new THREE.InstancedMesh(pGeo, pMat, puffs);
    this.puff.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(puffs * 3), 3);
    this.puff.frustumCulled = false; this.puff.renderOrder = 10;
    scene.add(this.puff);
    this.cap = { c: chunks, s: sparks, p: puffs };
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(); this._e = new THREE.Euler();
    this._up = new THREE.Vector3(0, 1, 0);
  }
  begin() { this.nc = 0; this.ns = 0; this.np = 0; }
  addChunk(p, rot, size, col) {
    if (this.nc >= this.cap.c) return;
    this._e.set(rot.x, rot.y, rot.z); this._q.setFromEuler(this._e);
    this._m.compose(p, this._q, this._s.set(size, size, size));
    this.chunk.setMatrixAt(this.nc, this._m);
    this.chunk.instanceColor.setXYZ(this.nc, col.r, col.g, col.b);
    this.nc++;
  }
  // spark from p along direction d (normalised), length len, width w, HDR colour
  addSpark(p, d, len, w, col) {
    if (this.ns >= this.cap.s) return;
    this._q.setFromUnitVectors(this._up, d);
    this._m.compose(p, this._q, this._s.set(w, len, w));
    this.spark.setMatrixAt(this.ns, this._m);
    this.spark.instanceColor.setXYZ(this.ns, col.r, col.g, col.b);
    this.ns++;
  }
  addPuff(p, size, col, alpha, rot = 0) {
    if (this.np >= this.cap.p) return;
    this._q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), rot);
    this._m.compose(p, this._q, this._s.set(size, size, size));
    this.puff.setMatrixAt(this.np, this._m);
    this.puff.instanceColor.setXYZ(this.np, col.r, col.g, col.b);
    this.puffAlpha.setX(this.np, alpha);
    this.np++;
  }
  end() {
    // full capacity stays allocated; count controls how many are drawn
    this.chunk.count = this.nc; this.chunk.instanceMatrix.needsUpdate = true; this.chunk.instanceColor.needsUpdate = true;
    this.spark.count = this.ns; this.spark.instanceMatrix.needsUpdate = true; this.spark.instanceColor.needsUpdate = true;
    this.puff.count = this.np; this.puff.instanceMatrix.needsUpdate = true; this.puff.instanceColor.needsUpdate = true;
    this.puffAlpha.needsUpdate = true;
  }
}

// Run an emitter: particles spawn at a fixed rate between t0 and t1; each one
// is described by spawn(k, tk) and drawn by draw(k, age, life, state).
export function emit(t, { t0, t1, rate, life, seed = 1 }, fn) {
  if (t < t0) return;
  const tEnd = Math.min(t, t1);
  const n = Math.floor((tEnd - t0) * rate) + 1;
  // only particles that can still be alive
  const kMin = Math.max(0, Math.floor((t - life * 1.4 - t0) * rate));
  for (let k = kMin; k < n; k++) {
    const tk = t0 + k / rate;
    if (tk > t1) break;
    const age = t - tk;
    const lifeK = life * (0.6 + 0.8 * h(seed, k, 99));
    if (age < 0 || age > lifeK) continue;
    fn(k, tk, age, lifeK);
  }
}
