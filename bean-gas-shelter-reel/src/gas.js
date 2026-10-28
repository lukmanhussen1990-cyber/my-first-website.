// The gas: a thick, puffy, glowing yellow-green cloud with soft volume. It is
// raymarched once per frame at half resolution through a tileable 3D noise of
// billows (inverted Worley octaves), shaped by a few analytic forms (the test puff,
// the low layer, the giant cloud with its first burst, the dog's little puff), lit
// by the sun with self-shadowing, a sky ambient and a little glow of its own. The
// march stops at the scene's depth (from the frame's first sub-frame), so the gas
// sits in front of and behind things correctly; the accumulation pass lays the
// result over every sub-frame.
import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

function makeNoise3D(N, seed) {
  let s = seed >>> 0;
  const rnd = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // tileable Worley noise: distance to the nearest feature point, `cells` per tile
  const worley = (cells) => {
    const pts = new Float32Array(cells * cells * cells * 3);
    for (let i = 0; i < pts.length; i++) pts[i] = rnd();
    const out = new Float32Array(N * N * N);
    const k = cells / N;
    for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const px = (x + 0.5) * k, py = (y + 0.5) * k, pz = (z + 0.5) * k;
      const cx = Math.floor(px), cy = Math.floor(py), cz = Math.floor(pz);
      let md = 9;
      for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const ix = (cx + dx + cells) % cells, iy = (cy + dy + cells) % cells, iz = (cz + dz + cells) % cells;
        const j = ((iz * cells + iy) * cells + ix) * 3;
        const fx = cx + dx + pts[j], fy = cy + dy + pts[j + 1], fz = cz + dz + pts[j + 2];
        const d = (px - fx) ** 2 + (py - fy) ** 2 + (pz - fz) ** 2;
        if (d < md) md = d;
      }
      out[(z * N + y) * N + x] = Math.sqrt(md);
    }
    return out;
  };
  const w1 = worley(4), w2 = worley(8), w3 = worley(16);
  const data = new Uint8Array(N * N * N);
  for (let i = 0; i < data.length; i++) {
    const f = (1 - Math.min(1, w1[i] * 1.15)) * 0.6 + (1 - Math.min(1, w2[i] * 1.15)) * 0.27 + (1 - Math.min(1, w3[i] * 1.15)) * 0.13;
    data[i] = Math.round(Math.max(0, Math.min(1, f)) * 255);
  }
  const tex = new THREE.Data3DTexture(data, N, N, N);
  tex.format = THREE.RedFormat;
  tex.type = THREE.UnsignedByteType;
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = tex.wrapR = THREE.RepeatWrapping;
  tex.unpackAlignment = 1;
  tex.needsUpdate = true;
  return tex;
}

const GAS_FS = /* glsl */ `
precision highp sampler3D;
uniform sampler2D tDepth; uniform sampler3D tNoise;
uniform mat4 uProjInv, uCamW; uniform vec3 uCamPos, uSun;
uniform float uTime;
uniform vec4 uPuff; uniform float uPuffD;
uniform vec4 uDog; uniform float uDogD;
uniform vec4 uLayer; // leading edge x, height, density, pile-up over the door
uniform vec4 uCloud; // source x, z, front radius, height
uniform vec4 uBurst; // burst radius, burst centre height, density, seconds since the blast
uniform vec4 uBurstC; // burst centre (behind the little brother), and how far its front has come (0..1)
uniform vec3 uBoxMin, uBoxMax;
varying vec2 vUv;

float nz(vec3 p){ return texture(tNoise, p).r; }
// two octaves of billows
float bill(vec3 q){ return nz(q) * 0.64 + nz(q * 2.63 + vec3(0.31, 0.17, 0.53)) * 0.36; }
// a soft shape broken up into puffs by the noise
float puffy(float shape, float n){ return clamp(shape * 1.7 - (1.0 - n) * 1.15, 0.0, 1.0); }

// density at p; cheap: the light probe uses one octave. gN keeps the billow noise of
// the shape that gave the density, for the shading
float gN = 0.5;
float density(vec3 p, bool cheap){
  float d = 0.0;
  gN = 0.5;
  if (p.z > 0.0) return 0.0; // cut away with everything else in front of the cut face
  // the small puffs: finer billows, turning slowly
  if (uPuffD > 0.0) {
    float r = length(p - uPuff.xyz) / uPuff.w;
    if (r < 1.2) {
      vec3 q = (p - uPuff.xyz) * 0.75 + vec3(uTime * 0.07, -uTime * 0.05, 0.0);
      float n = cheap ? nz(q) : bill(q);
      float v = puffy(1.0 - smoothstep(0.2, 1.1, r), n) * 1.25 * uPuffD;
      if (v > d) { d = v; gN = n; }
    }
  }
  if (uDogD > 0.0) {
    float r = length(p - uDog.xyz) / uDog.w;
    if (r < 1.2) {
      vec3 q = (p - uDog.xyz) * 2.2 + vec3(uTime * 0.15, -uTime * 0.1, 0.05);
      float n = cheap ? nz(q) : bill(q);
      float v = puffy(1.0 - smoothstep(0.2, 1.05, r), n) * uDogD;
      if (v > d) { d = v; gN = n; }
    }
  }
  if (p.y < -0.02) return d; // the layer and the big cloud lie on the lawn
  // the low layer, drifting right
  if (uLayer.z > 0.0 && p.y < 2.0) {
    vec3 q = p * 0.42 + vec3(-uTime * 0.12, 0.0, uTime * 0.03);
    float n = cheap ? nz(q) : bill(q);
    vec2 dd = (p.xz - vec2(2.5, -0.62)) / vec2(1.6, 1.0);
    float pile = uLayer.w * exp(-dot(dd, dd));
    float h = uLayer.y * (0.75 + 0.5 * n) + 0.6 * pile;
    float sh = smoothstep(h, h * 0.2, p.y) * smoothstep(uLayer.x, uLayer.x - 2.5, p.x + (n - 0.5) * 2.0) * smoothstep(-9.6, -7.6, p.z);
    float v = puffy(sh, n) * uLayer.z * (0.6 + 0.6 * pile);
    if (v > d) { d = v; gN = n; }
  }
  // the giant cloud: a ballooning burst over the porch and a front rolling out over
  // the ground, taller round the source; its billows roll outwards and upwards
  if (uBurst.z > 0.0) {
    vec2 rel = p.xz - uCloud.xy;
    float r = length(rel * vec2(1.0, 1.05));
    // the billows spread with the cloud (the noise field scales out from the source)
    // and roll upwards
    float ex = 1.0 / (1.0 + 0.07 * uBurst.w);
    vec3 q = vec3(rel.x * ex, p.y - 0.18 * uBurst.w, rel.y * ex) * 0.3 + vec3(0.37, 0.0, 0.11);
    float n = cheap ? nz(q) : bill(q);
    float edge = uCloud.z - r + (n - 0.5) * 2.4;
    float H = uCloud.w * (1.0 + 0.7 * exp(-r * 0.22));
    float ground = smoothstep(0.0, 1.8, edge) * smoothstep(H, H * 0.25, p.y + (n - 0.5) * 1.1);
    // the burst balloons up and out behind him first; its front reaches him a moment later
    vec3 dp = p - uBurstC.xyz;
    float br = length(dp * vec3(1.0, 1.2, dp.z > 0.0 ? 1.0 / max(uBurstC.w, 0.05) : 1.0)) / max(uBurst.x, 0.01);
    float burst = 1.0 - smoothstep(0.3, 1.0, br);
    float v = puffy(max(ground, burst), n) * uBurst.z;
    if (v > d) { d = v; gN = n; }
  }
  return d;
}

float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }

void main(){
  float z = texture2D(tDepth, vUv).x;
  vec4 v = uProjInv * vec4(vUv * 2.0 - 1.0, z * 2.0 - 1.0, 1.0);
  vec3 wp = (uCamW * vec4(v.xyz / v.w, 1.0)).xyz;
  vec3 ro = uCamPos;
  vec3 rd = normalize(wp - ro);
  float tEnd = z >= 0.999999 ? 1e5 : length(wp - ro);
  vec3 inv = 1.0 / rd;
  vec3 t0 = (uBoxMin - ro) * inv, t1 = (uBoxMax - ro) * inv;
  vec3 tn = min(t0, t1), tf = max(t0, t1);
  float ta = max(max(tn.x, tn.y), max(tn.z, 0.0));
  float tb = min(min(min(tf.x, tf.y), tf.z), tEnd);
  if (tb <= ta) { gl_FragColor = vec4(0.0); return; }
  const int STEPS = 44;
  float dt = (tb - ta) / float(STEPS);
  float jit = ign(gl_FragCoord.xy);
  float Tr = 1.0;
  vec3 L = vec3(0.0);
  vec3 alb = vec3(0.62, 0.88, 0.16);
  vec3 sunC = vec3(1.0, 0.95, 0.84) * 1.45;
  vec3 skyC = vec3(0.36, 0.44, 0.5);
  vec3 glowC = vec3(0.16, 0.27, 0.025);
  for (int i = 0; i < STEPS; i++) {
    float t = ta + (float(i) + jit) * dt;
    if (t > tb) break;
    vec3 p = ro + rd * t;
    float d = density(p, false);
    if (d < 0.004) continue;
    // the billows: bright rounded lobes, darker olive in the folds between them (reads
    // as volume even with the sun behind the camera)
    float lobe = smoothstep(0.25, 0.85, gN);
    // light reaching p from the sun through the gas (three probes towards the sun, so
    // big billows shade each other), and sky light blocked by the gas above
    float dl = 0.6 * density(p + uSun * 0.25, true) + density(p + uSun * 0.7, true) + 0.8 * density(p + uSun * 1.6, true);
    float Tl = exp(-dl * 2.1);
    float ao = exp(-1.5 * density(p + vec3(0.0, 0.75, 0.0), true));
    float powder = 1.0 - exp(-d * 3.0);
    float up = clamp(0.55 + 0.35 * (p.y + 0.5), 0.3, 1.2);
    vec3 col = alb * (sunC * Tl * (0.55 + 0.45 * powder) + skyC * up * (0.4 + 0.6 * ao)) * (0.6 + 0.5 * lobe) + glowC * (0.6 + 0.8 * d);
    col = mix(col * vec3(0.85, 0.9, 0.7), col, lobe); // olive in the folds
    float a = 1.0 - exp(-d * 3.4 * dt);
    L += Tr * a * col;
    Tr *= 1.0 - a;
    if (Tr < 0.02) break;
  }
  gl_FragColor = vec4(L, 1.0 - Tr);
}`;

export function build(ctx) {
  const { renderer, camera, W, H, WD } = ctx;
  const tNoise = makeNoise3D(64, 9001);
  const gw = Math.round(W / 2), gh = Math.round(H / 2);
  const rt = new THREE.WebGLRenderTarget(gw, gh, { type: THREE.HalfFloatType, depthBuffer: false });
  rt.texture.minFilter = rt.texture.magFilter = THREE.LinearFilter;
  const V3 = () => new THREE.Vector3();
  const U = {
    tDepth: { value: null }, tNoise: { value: tNoise }, uProjInv: { value: new THREE.Matrix4() }, uCamW: { value: new THREE.Matrix4() },
    uCamPos: { value: V3() }, uSun: { value: ctx.SUN_DIR.clone() }, uTime: { value: 0 },
    uPuff: { value: new THREE.Vector4() }, uPuffD: { value: 0 }, uDog: { value: new THREE.Vector4() }, uDogD: { value: 0 },
    uLayer: { value: new THREE.Vector4() }, uCloud: { value: new THREE.Vector4() }, uBurst: { value: new THREE.Vector4() }, uBurstC: { value: new THREE.Vector4() },
    uBoxMin: { value: V3() }, uBoxMax: { value: V3() },
  };
  const quad = new FullScreenQuad(new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: GAS_FS,
    depthTest: false,
    depthWrite: false,
  }));
  let active = false;

  // set the shapes for time t; returns false when there is no gas in the world
  function setup(t) {
    const lo = new THREE.Vector3(1e9, 1e9, 1e9), hi = new THREE.Vector3(-1e9, -1e9, -1e9);
    const grow = (x0, y0, z0, x1, y1, z1) => {
      lo.min(new THREE.Vector3(x0, y0, z0));
      hi.max(new THREE.Vector3(x1, y1, z1));
    };
    U.uTime.value = t;
    const pf = WD.puffTest(t);
    U.uPuffD.value = pf ? pf.d : 0;
    if (pf && pf.d > 0) {
      U.uPuff.value.set(pf.x, pf.y, pf.z, pf.r);
      const e = pf.r * 1.25;
      grow(pf.x - e, pf.y - e, pf.z - e, pf.x + e, pf.y + e, pf.z + e);
    }
    const dg = WD.dogPuff(t);
    U.uDogD.value = dg ? dg.d : 0;
    if (dg && dg.d > 0) {
      U.uDog.value.set(dg.x, dg.y, dg.z, dg.r);
      const e = dg.r * 1.25;
      grow(dg.x - e, dg.y - e, dg.z - e, dg.x + e, dg.y + e, dg.z + e);
    }
    const ly = WD.layer(t);
    U.uLayer.value.set(ly ? ly.front : -99, ly ? ly.h : 0, ly ? ly.d : 0, ly ? ly.press : 0);
    if (ly && ly.d > 0) grow(-14, 0, -9.8, Math.min(ly.front + 1.5, 16), 1.9, 0);
    const bc = WD.bigCloud(t);
    U.uBurst.value.set(bc ? bc.burst : 0, bc ? bc.burstY : 0, bc ? bc.d : 0, bc ? t - ctx.T.blast : 0);
    if (bc && bc.d > 0) {
      U.uCloud.value.set(bc.x, bc.z, bc.R, bc.H);
      U.uBurstC.value.set(bc.x, bc.burstY, bc.burstZ, bc.front);
      const e = bc.R + 2.4;
      grow(bc.x - e, 0, bc.z - e, bc.x + e, Math.max(bc.H * 1.9, bc.burstY + bc.burst * 0.9), Math.min(0, bc.z + e));
      grow(bc.x - bc.burst, bc.burstY - bc.burst, bc.burstZ - bc.burst, bc.x + bc.burst, bc.burstY + bc.burst, Math.min(0, bc.burstZ + bc.burst * bc.front));
    }
    lo.z = Math.min(lo.z, 0);
    hi.z = Math.min(hi.z, 0);
    U.uBoxMin.value.copy(lo);
    U.uBoxMax.value.copy(hi);
    return hi.x > lo.x;
  }

  return {
    texture: rt.texture,
    get active() { return active; },
    // march the gas for frame time t against the depth of the frame's first sub-frame
    render(t, depthTex) {
      active = setup(t);
      if (!active) return;
      camera.updateMatrixWorld();
      U.tDepth.value = depthTex;
      U.uProjInv.value.copy(camera.projectionMatrixInverse);
      U.uCamW.value.copy(camera.matrixWorld);
      U.uCamPos.value.setFromMatrixPosition(camera.matrixWorld);
      const prev = renderer.getRenderTarget();
      renderer.setRenderTarget(rt);
      quad.render(renderer);
      renderer.setRenderTarget(prev);
    },
  };
}
