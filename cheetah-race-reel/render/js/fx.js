import * as THREE from 'three';
import { GLSL_NOISE, hash1 } from './util.js';
import { SUN_DIR } from './sky.js';

// Effects: billboard particles (sand, dust, water, mist), thruster jets with
// heat-shimmer volumes, and glowing force arrows. Particles are evaluated
// analytically from their spawn time, so any sub-frame can be computed
// directly (deterministic motion blur, parallel rendering).

// ---------------------------------------------------------------- particles
const partVert = /* glsl */ `
attribute vec4 aPos;    // xyz, size
attribute vec4 aCol;    // rgb, alpha
attribute vec4 aMisc;   // rotation, seed, stretch, kind
varying vec2 vUv; varying vec4 vCol; varying vec4 vMisc; varying vec3 vWP;
void main(){
  vUv = position.xy + 0.5;
  vCol = aCol; vMisc = aMisc;
  vec4 mv = viewMatrix * vec4(aPos.xyz, 1.0);
  float c = cos(aMisc.x), s = sin(aMisc.x);
  vec2 q = vec2(position.x * (1.0 + aMisc.z), position.y);
  q = vec2(c * q.x - s * q.y, s * q.x + c * q.y);
  mv.xy += q * aPos.w;
  vWP = aPos.xyz;
  gl_Position = projectionMatrix * mv;
}`;
const partFrag = /* glsl */ `
uniform vec3 uSun; uniform float uLit;

varying vec2 vUv; varying vec4 vCol; varying vec4 vMisc; varying vec3 vWP;
${GLSL_NOISE}
void main(){
  vec2 p = vUv - 0.5;
  float r = length(p) * 2.0;
  float kind = vMisc.w;
  float a;
  vec3 c = vCol.rgb;
  // forward scattering: dust and sand glow when we look toward the low sun
  vec3 V = normalize(cameraPosition - vWP);
  float fwdScat = pow(max(dot(-V, uSun), 0.0), 3.0);
  if (kind < 0.5) {            // soft dust puff with eroded edge
    float n = fbm2(vUv * 3.0 + vMisc.y * 17.0);
    a = smoothstep(1.0, 0.25, r + (n - 0.5) * 0.7);
    c *= (0.42 + 0.3 * fwdScat) * (0.8 + 0.4 * (1.0 - a) + 0.25 * n);
  } else if (kind < 1.5) {     // sand grain / pebble: small hard dot, shaded
    a = smoothstep(1.0, 0.7, r);
    c *= (0.38 + 0.25 * fwdScat) * (1.0 - 0.35 * smoothstep(0.0, 0.8, length(p + vec2(0.15, -0.15)) * 2.0));
  } else if (kind < 2.5) {     // water drop: bright core + sparkle
    a = smoothstep(1.0, 0.5, r);
    c += vec3(2.5, 2.2, 1.6) * smoothstep(0.45, 0.0, length(p - vec2(-0.12, 0.12)) * 2.0);
  } else if (kind < 3.5) {     // glow / mist (additive look via colour)
    a = pow(smoothstep(1.0, 0.0, r), 1.6);
  } else {                     // cartoon cloud lobe: crisp edge, shaded like a soft ball
    float n = fbm2(vUv * 2.5 + vMisc.y * 11.0);
    a = smoothstep(1.0, 0.86, r + (n - 0.5) * 0.2);
    vec2 q = p * 2.0;
    vec3 nrm = vec3(q, sqrt(max(0.0, 1.0 - dot(q, q))));
    float lit = clamp(dot(nrm, normalize(vec3(-0.45, 0.65, 0.6))), 0.0, 1.0);
    c *= 0.5 + 0.6 * lit + 0.2 * fwdScat;
  }
  a *= vCol.a;
  if (a < 0.003) discard;
  gl_FragColor = vec4(c * a, a);
}`;

export class Particles {
  constructor(max, { additive = false, renderOrder = 20 } = {}) {
    this.max = max;
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aMisc = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aPos', this.aPos); g.setAttribute('aCol', this.aCol); g.setAttribute('aMisc', this.aMisc);
    g.instanceCount = 0;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: partVert, fragmentShader: partFrag,
      uniforms: { uSun: { value: SUN_DIR.clone() }, uLit: { value: 1 } },
      transparent: true, depthWrite: false,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor, blendDst: additive ? THREE.OneFactor : THREE.OneMinusSrcAlphaFactor,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = renderOrder;
    this.geo = g;
    this.n = 0;
  }
  begin() { this.n = 0; }
  push(x, y, z, size, r, g, b, a, rot = 0, seed = 0, stretch = 0, kind = 0) {
    if (this.n >= this.max || a <= 0.002 || size <= 0) return;
    const i = this.n++;
    this.aPos.array.set([x, y, z, size], i * 4);
    this.aCol.array.set([r, g, b, a], i * 4);
    this.aMisc.array.set([rot, seed, stretch, kind], i * 4);
  }
  end() {
    this.geo.instanceCount = this.n;
    this.aPos.needsUpdate = this.aCol.needsUpdate = this.aMisc.needsUpdate = true;
    this.aPos.addUpdateRange(0, this.n * 4); this.aCol.addUpdateRange(0, this.n * 4); this.aMisc.addUpdateRange(0, this.n * 4);
  }
}

// Analytic particle with linear drag k and gravity g (vectors as arrays)
export function ballistic(p0, v0, dt, k = 0, gy = -9.8) {
  if (k < 1e-4) return [p0[0] + v0[0] * dt, p0[1] + v0[1] * dt + 0.5 * gy * dt * dt, p0[2] + v0[2] * dt];
  const e = (1 - Math.exp(-k * dt)) / k;
  return [p0[0] + v0[0] * e, p0[1] + v0[1] * e + (gy / k) * (dt - e), p0[2] + v0[2] * e];
}

// deterministic random for (emitter, index, channel)
export const rnd = (em, i, ch) => hash1(em * 7.13 + i * 1.618 + ch * 31.7);

// Emit continuous particles between t0 and t1 at `rate` per second; for each
// live one at time t calls fn(i, age, life, u(i, ch)). Independent of frame.
export function emitStream(em, t, t0, t1, rate, life, fn) {
  const iEnd = Math.floor((Math.min(t, t1) - t0) * rate);
  const iStart = Math.max(0, Math.ceil((t - life - t0) * rate));
  for (let i = iStart; i <= iEnd; i++) {
    const ts = t0 + i / rate;
    if (ts > t1 || ts > t) continue;
    const age = t - ts;
    if (age < 0 || age > life) continue;
    fn(i, age, ts, (ch) => rnd(em, i, ch));
  }
}

// ---------------------------------------------------------------- thrusters
const jetVert = /* glsl */ `
uniform float uLen;
varying vec3 vN; varying vec3 vV; varying float vT; varying float vAng;
void main(){
  vT = clamp(position.y / uLen, 0.0, 1.0);
  vAng = atan(position.z, position.x);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vV = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const jetFrag = /* glsl */ `
uniform float uTime, uPower, uSeed, uCore;
uniform vec3 uColor;
varying vec3 vN; varying vec3 vV; varying float vT; varying float vAng;
${GLSL_NOISE}
void main(){
  float facing = pow(abs(dot(normalize(vN), normalize(vV))), 1.4);
  float n = fbm2(vec2(vT * 5.0 - uTime * 24.0 + uSeed, vAng * 2.0 + uSeed * 3.0));
  float flick = 0.75 + 0.5 * n;
  float along = pow(1.0 - vT, 1.3) * smoothstep(0.0, 0.06, vT + 0.03);
  // shock diamonds near the nozzle
  float diamonds = 1.0 + 0.35 * uCore * smoothstep(0.6, 0.0, vT) * pow(0.5 + 0.5 * cos(vT * 38.0 - uTime * 2.0), 6.0);
  vec3 c = mix(uColor, vec3(1.0), uCore * smoothstep(0.55, 0.0, vT)) * along * flick * facing * diamonds;
  c *= uPower;
  gl_FragColor = vec4(c, 0.0);
}`;
const heatFrag = /* glsl */ `
uniform float uTime, uPower, uSeed;
varying vec3 vN; varying vec3 vV; varying float vT; varying float vAng;
${GLSL_NOISE}
void main(){
  float facing = pow(abs(dot(normalize(vN), normalize(vV))), 1.0);
  float amp = facing * smoothstep(1.0, 0.2, vT) * uPower;
  vec2 d = vec2(vnoise2(vec2(vT * 9.0 - uTime * 18.0, vAng * 3.0 + uSeed)), vnoise2(vec2(vAng * 3.0 - uSeed, vT * 9.0 - uTime * 21.0))) - 0.5;
  gl_FragColor = vec4(0.5 + d * amp, 0.0, 1.0);
}`;

export function makeJet(seed = 0, { len = 1.4, r0 = 0.05, r1 = 0.32, color = new THREE.Color(0.18, 0.5, 1.0) } = {}) {
  const group = new THREE.Group();
  const layers = [];
  const mk = (rr0, rr1, L, core, colScale) => {
    const g = new THREE.CylinderGeometry(rr1, rr0, L, 28, 12, true);
    g.translate(0, L / 2, 0);
    const m = new THREE.ShaderMaterial({
      vertexShader: jetVert, fragmentShader: jetFrag,
      uniforms: { uLen: { value: L }, uTime: { value: 0 }, uPower: { value: 0 }, uSeed: { value: seed }, uCore: { value: core }, uColor: { value: color.clone().multiplyScalar(colScale) } },
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    });
    const mesh = new THREE.Mesh(g, m);
    mesh.renderOrder = 30; mesh.frustumCulled = false;
    group.add(mesh); layers.push(m);
  };
  mk(r0 * 0.6, r1 * 0.22, len * 0.7, 1.0, 3.2);    // hot core
  mk(r0, r1 * 0.6, len, 0.25, 1.5);                 // body
  mk(r0 * 1.4, r1, len * 1.15, 0.0, 0.7);           // outer glow
  // heat volume (rendered only in the heat pass)
  const hg = new THREE.CylinderGeometry(r1 * 1.4, r0 * 2.0, len * 1.6, 20, 8, true); hg.translate(0, len * 0.8, 0);
  const heatMat = new THREE.ShaderMaterial({ vertexShader: jetVert, fragmentShader: heatFrag, side: THREE.DoubleSide, depthTest: false, depthWrite: false,
    uniforms: { uLen: { value: len * 1.6 }, uTime: { value: 0 }, uPower: { value: 0 }, uSeed: { value: seed } } });
  const heat = new THREE.Mesh(hg, heatMat); heat.frustumCulled = false;
  return {
    group, heat,
    set(power, time, lenScale = 1) {
      group.visible = power > 0.01;
      heat.visible = power > 0.01;
      group.scale.set(0.8 + 0.25 * power, (0.35 + 0.65 * power) * lenScale, 0.8 + 0.25 * power);
      heat.scale.copy(group.scale);
      for (const m of layers) { m.uniforms.uPower.value = power; m.uniforms.uTime.value = time; }
      heatMat.uniforms.uPower.value = power; heatMat.uniforms.uTime.value = time;
    },
  };
}

// ---------------------------------------------------------------- arrows
const arrowFrag = /* glsl */ `
uniform float uTime, uAlpha;
uniform vec3 uColor;
varying vec3 vN; varying vec3 vV; varying float vT; varying float vAng;
void main(){
  float facing = abs(dot(normalize(vN), normalize(vV)));
  // chevrons sliding toward the tip
  float bands = 0.65 + 0.35 * smoothstep(0.3, 0.7, fract(vT * 3.0 - uTime * 2.2));
  vec3 c = uColor * (0.5 + 1.2 * pow(facing, 0.6)) * bands;
  c += vec3(0.6, 0.9, 1.0) * pow(facing, 6.0) * 0.35;
  gl_FragColor = vec4(c * uAlpha, uAlpha * 0.92);
}`;
const glowFrag = /* glsl */ `
uniform float uAlpha; uniform vec3 uColor;
varying vec3 vN; varying vec3 vV; varying float vT; varying float vAng;
void main(){
  float facing = abs(dot(normalize(vN), normalize(vV)));
  float a = pow(facing, 2.5) * uAlpha * 0.5;
  gl_FragColor = vec4(uColor * a, 0.0);
}`;

// Arrow pointing along +y from the origin, length L.
export function makeArrow(L = 1.6, color = new THREE.Color(0.05, 0.75, 1.0)) {
  const group = new THREE.Group();
  const uni = { uTime: { value: 0 }, uAlpha: { value: 0 }, uColor: { value: color.clone().multiplyScalar(0.9) }, uLen: { value: L } };
  const solid = new THREE.ShaderMaterial({ vertexShader: jetVert, fragmentShader: arrowFrag, uniforms: uni, transparent: true, depthWrite: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor });
  const glow = new THREE.ShaderMaterial({ vertexShader: jetVert, fragmentShader: glowFrag, uniforms: uni, transparent: true, depthWrite: false, side: THREE.BackSide,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor });
  const shaftL = L * 0.68, headL = L * 0.32;
  const shaft = new THREE.CylinderGeometry(0.075, 0.075, shaftL, 20, 8); shaft.translate(0, shaftL / 2, 0);
  const head = new THREE.ConeGeometry(0.2, headL, 24, 4); head.translate(0, shaftL + headL / 2, 0);
  for (const g of [shaft, head]) {
    const a = new THREE.Mesh(g, solid); a.renderOrder = 40; group.add(a);
    const gg = g.clone(); gg.scale(1.6, 1.0, 1.6);
    const b = new THREE.Mesh(gg, glow); b.renderOrder = 41; group.add(b);
  }
  group.traverse((o) => { o.frustumCulled = false; });
  return {
    group,
    set(alpha, time) { group.visible = alpha > 0.01; uni.uAlpha.value = alpha; uni.uTime.value = time; },
  };
}
