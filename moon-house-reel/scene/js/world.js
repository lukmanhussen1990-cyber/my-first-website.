// The Moon diorama: a slab of ground cut open like a slice of cake, floating in
// a starry sky with the Earth. Also renderer + post-processing setup.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { mulberry32, fbm2, clamp, smoothstep } from './util.js';
import { regolithTextures, strataTextures, earthTextures, footprintTexture } from './textures.js';

export const SLAB = { x0: -14, x1: 14, z0: -24, z1: 0, bottom: -12 };
export const SUN_DIR = new THREE.Vector3(-0.74, 0.5, 0.4).normalize();
export const EARTH_DIR = new THREE.Vector3(-0.30, 0.13, -0.945).normalize();

// ---------------------------------------------------------------- renderer --
export function createRenderer(W, H) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.localClippingEnabled = true;
  document.body.appendChild(renderer.domElement);
  return renderer;
}

const VignetteShader = {
  uniforms: { tDiffuse: { value: null }, uAmount: { value: 0.32 }, uRes: { value: new THREE.Vector2(1080, 1920) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uAmount; uniform vec2 uRes; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 d = (vUv - 0.5) * vec2(1.0, uRes.y / uRes.x) * 0.9;
      float v = smoothstep(1.05, 0.25, length(d * vec2(1.25, 0.82)));
      c.rgb *= mix(1.0 - uAmount, 1.0, v);
      // static (frame-stable) dither against banding in dark gradients
      c.rgb += (h(gl_FragCoord.xy) - 0.5) / 255.0;
      gl_FragColor = c;
    }`,
};

export function createComposer(renderer, scene, camera, W, H, msaa = 4) {
  const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: msaa });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(1);
  composer.setSize(W, H);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.42, 0.55, 0.92);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const vig = new ShaderPass(VignetteShader);
  vig.uniforms.uRes.value.set(W, H);
  composer.addPass(vig);
  return { composer, bloom, vignette: vig };
}

// ---------------------------------------------------------- environment ----
// A tiny "space" environment for reflections: black sky, a hard sun, grey ground glow.
export function createEnvironment(renderer) {
  const env = new THREE.Scene();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { uSun: { value: SUN_DIR }, uEarth: { value: EARTH_DIR } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `
      uniform vec3 uSun, uEarth; varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        float ground = smoothstep(0.02, -0.12, d.y);
        vec3 col = vec3(0.006, 0.008, 0.014);
        col = mix(col, vec3(0.32, 0.31, 0.30), ground);            // sunlit moon dust below
        col += vec3(40.0, 37.0, 33.0) * smoothstep(0.9990, 0.9996, dot(d, uSun));
        col += vec3(1.2, 1.1, 1.0) * pow(max(dot(d, uSun), 0.0), 24.0) * 0.4;
        col += vec3(0.25, 0.5, 1.2) * smoothstep(0.992, 0.997, dot(d, uEarth)) * 1.6;
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
  env.add(sky);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(env, 0.0, 0.1, 100);
  pmrem.dispose();
  return rt.texture;
}

// ------------------------------------------------------------ terrain -------
export const CRATERS = [
  { x: -7.6, z: -5.2, r: 2.3, d: 0.65 },
  { x: 9.8, z: -9.5, r: 3.4, d: 0.85 },
  { x: -4.0, z: -15.5, r: 4.6, d: 1.1 },
  { x: 6.0, z: -19.0, r: 2.2, d: 0.5 },
  { x: -11.0, z: -11.0, r: 1.6, d: 0.4 },
  { x: 2.5, z: -12.5, r: 1.3, d: 0.35 },
  { x: 11.5, z: -2.8, r: 1.2, d: 0.3 },
  { x: -12.0, z: -20.0, r: 2.6, d: 0.6 },
  { x: 12.0, z: -16.5, r: 1.8, d: 0.45 },
  { x: -1.5, z: -21.0, r: 1.5, d: 0.35 },
];
function workMask(x, z) {
  // 0 in the flat work area around the house site, 1 elsewhere
  const dx = Math.max(0, Math.abs(x - 1.5) - 7.5), dz = Math.max(0, -z - 6.5);
  return smoothstep(0, 2.5, Math.hypot(dx, dz));
}
export function groundHeight(x, z) {
  const m = workMask(x, z);
  let h = 0.05 * fbm2(x * 0.35, z * 0.35, 3) + m * 0.32 * fbm2(x * 0.07 + 4, z * 0.07 - 2, 4);
  for (const c of CRATERS) {
    const d = Math.hypot(x - c.x, z - c.z) / c.r;
    if (d > 2.2) continue;
    const bowl = d < 1 ? -c.d * (1 - d * d) : 0;
    const rim = c.d * 0.38 * Math.exp(-Math.pow((d - 1.0) / 0.28, 2));
    h += bowl + rim;
  }
  // soften towards the cut edges so the "cake" edge stays clean
  h *= smoothstep(0, 0.25, -z) * 0.25 + 0.75;
  return h;
}

// common GLSL helpers injected into ground materials
const GLSL_COMMON = /* glsl */`
  varying vec3 vWPos;
  uniform vec4 uCav[6];   // cx, cy, half w, half h  (in the plane of the cut)
  uniform vec4 uCavB[6];  // corner radius, angle, rough edge amp, enabled
  uniform vec4 uPit;      // x0, x1, z0, z1 footprint hole in the top surface
  uniform float uPitOn;
  uniform vec4 uFill;     // x0, x1, yBottom, yTop  (refilled dust region, drawn lighter)
  uniform vec3 uTemp;     // x: hot(+1)..cold(-1), y: intensity, z: time
  uniform float uDeepOn;  // steady deep-zone glow
  float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(hsh(i),hsh(i+vec2(1,0)),f.x), mix(hsh(i+vec2(0,1)),hsh(i+vec2(1,1)),f.x), f.y); }
  float sdRR(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q,0.0)) + min(max(q.x,q.y),0.0) - r; }
  float cavityDist(vec2 p){
    float sd = 1e5;
    for (int i = 0; i < 6; i++) {
      if (uCavB[i].w < 0.5) continue;
      vec2 d = p - uCav[i].xy; float a = uCavB[i].y;
      d = mat2(cos(a), sin(a), -sin(a), cos(a)) * d;
      float s = sdRR(d, uCav[i].zw, uCavB[i].x);
      s += uCavB[i].z * (vnoise(p * 6.0) - 0.5 + 0.5 * (vnoise(p * 17.0) - 0.5));
      sd = min(sd, s);
    }
    return sd;
  }
  vec3 tempGlow(float depth){
    vec3 hot = vec3(1.0, 0.38, 0.06), cold = vec3(0.15, 0.48, 1.0);
    float k = clamp(uTemp.x * 0.5 + 0.5, 0.0, 1.0);
    vec3 c = mix(cold, hot, k);
    float waves = 0.75 + 0.25 * sin(depth * 9.0 - uTemp.z * 5.0);
    float a = exp(-depth / 0.85) * waves * uTemp.y;
    vec3 g = c * a * 0.9;
    // calm, steady zone below ~2 m
    float deep = smoothstep(2.0, 2.8, depth) * (1.0 - smoothstep(9.0, 11.0, depth));
    float calm = 0.75 + 0.25 * sin(depth * 2.0 + 1.0);
    g += vec3(0.16, 0.62, 0.42) * deep * uDeepOn * 0.085 * calm;
    return g;
  }
`;

function groundUniforms() {
  const cav = [], cavB = [];
  for (let i = 0; i < 6; i++) { cav.push(new THREE.Vector4()); cavB.push(new THREE.Vector4()); }
  return {
    uCav: { value: cav }, uCavB: { value: cavB },
    uPit: { value: new THREE.Vector4(0, 0, 0, 0) }, uPitOn: { value: 0 },
    uFill: { value: new THREE.Vector4(0, 0, 0, -100) },
    uTemp: { value: new THREE.Vector3(0, 0, 0) }, uDeepOn: { value: 0 },
  };
}

// mode: 'cut' (front face, discards cavities, temp glow by depth),
//       'top' (terrain, discards pit footprint, temp glow on the surface),
//       'wall' (dug pit walls: temp glow by depth only)
function patchGround(mat, U, mode) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    let pre = '';
    if (mode === 'cut') pre = `
      if (cavityDist(vWPos.xy) < 0.0) discard;
      float fillK = step(uFill.x, vWPos.x) * step(vWPos.x, uFill.y) * step(uFill.z, vWPos.y) * step(vWPos.y, uFill.w);
    `;
    else if (mode === 'top') pre = `
      if (uPitOn > 0.5) {
        float e = 0.06 * (vnoise(vWPos.xz * 5.0) - 0.5);
        if (vWPos.x > uPit.x + e && vWPos.x < uPit.y - e && vWPos.z > uPit.z + e && vWPos.z < uPit.w + 0.5) discard;
      }
      float fillK = 0.0;
    `;
    else pre = 'float fillK = 0.0;';
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + GLSL_COMMON)
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + pre)
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec3 fillCol = vec3(0.19, 0.19, 0.195) * (0.88 + 0.24 * vnoise(vWPos.xy * 21.0)) * (0.94 + 0.06 * sin(vWPos.y * 16.0 + 2.0 * vnoise(vWPos.xy * 2.0)));
        diffuseColor.rgb = mix(diffuseColor.rgb, fillCol, fillK * 0.9);
        diffuseColor.rgb *= 0.93 + 0.14 * vnoise(vWPos.xy * 3.1 + vWPos.zz * 2.3);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += tempGlow(${mode === 'top' ? '0.0' : 'max(0.0, -vWPos.y)'}) * ${mode === 'wall' ? '0.35' : '1.0'};`);
  };
  mat.customProgramCacheKey = () => 'ground-' + mode;
}

export function createSlab(scene) {
  const U = groundUniforms();
  const reg = regolithTextures(1024);
  const str = strataTextures(28, 14, 140);

  // --- top terrain
  const W = SLAB.x1 - SLAB.x0, D = SLAB.z1 - SLAB.z0;
  const nx = 280, nz = 240;
  const g = new THREE.PlaneGeometry(W, D, nx, nz);
  g.rotateX(-Math.PI / 2);
  g.translate((SLAB.x0 + SLAB.x1) / 2, 0, (SLAB.z0 + SLAB.z1) / 2);
  const p = g.attributes.position, uv = g.attributes.uv;
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const h = groundHeight(x, z);
    p.setY(i, h);
    uv.setXY(i, x / 3.0, z / 3.0);
    // baked cavity AO: darker in bowls, brighter on rims
    const c = 0.25 * (groundHeight(x + 0.6, z) + groundHeight(x - 0.6, z) + groundHeight(x, z + 0.6) + groundHeight(x, z - 0.6));
    const ao = clamp(1.0 + (h - c) * 1.6, 0.72, 1.08);
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = ao;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  const topMat = new THREE.MeshStandardMaterial({
    map: reg.map, normalMap: reg.normalMap, normalScale: new THREE.Vector2(1.3, 1.3),
    roughness: 0.97, metalness: 0, vertexColors: true, color: 0xc6c6c8,
  });
  patchGround(topMat, U, 'top');
  const top = new THREE.Mesh(g, topMat);
  top.receiveShadow = true; top.castShadow = true;
  scene.add(top);

  // --- front cut face (z = 0): top edge follows the terrain
  const faceMat = new THREE.MeshStandardMaterial({
    map: str.map, normalMap: str.normalMap, normalScale: new THREE.Vector2(2.2, 2.2),
    roughness: 0.95, metalness: 0, color: 0xd2d2d6,
  });
  patchGround(faceMat, U, 'cut');
  const mkFace = (axis) => {
    // axis 'front': along x at z=0 ; 'left'/'right': along z at x = x0/x1
    const n = axis === 'front' ? 560 : 240, m = 60;
    const geo = new THREE.BufferGeometry();
    const pos = [], uvs = [], idx = [];
    for (let j = 0; j <= m; j++) {
      for (let i = 0; i <= n; i++) {
        const s = i / n, tt = j / m;
        let x, z;
        if (axis === 'front') { x = SLAB.x0 + s * W; z = 0; }
        else if (axis === 'left') { x = SLAB.x0; z = SLAB.z0 + s * D; }
        else { x = SLAB.x1; z = SLAB.z1 - s * D; }
        const yTop = groundHeight(x, z);
        const y = yTop + (SLAB.bottom - yTop) * tt;
        pos.push(x, y, z);
        const along = axis === 'front' ? x - SLAB.x0 : (axis === 'left' ? z - SLAB.z0 : SLAB.z1 - z) + 3.0;
        uvs.push(along / str.worldW, Math.max(0, -y) / str.worldH);
      }
    }
    for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) {
      const a = j * (n + 1) + i, b = a + 1, c = a + n + 1, d2 = c + 1;
      idx.push(a, c, b, b, c, d2);
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, axis === 'front' ? faceMat : sideMat);
    mesh.receiveShadow = true; mesh.castShadow = true;
    scene.add(mesh);
    return mesh;
  };
  const sideMat = faceMat.clone();
  sideMat.color = new THREE.Color(0.86, 0.86, 0.88);
  patchGround(sideMat, groundUniforms(), 'wall');
  const front = mkFace('front');
  mkFace('left'); mkFace('right');
  // bottom
  const bot = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ color: 0x2b2c30, roughness: 1 }));
  bot.rotation.x = Math.PI / 2; bot.position.set(0, SLAB.bottom, (SLAB.z0 + SLAB.z1) / 2);
  scene.add(bot);

  // pit interior walls (rebuilt each frame from the pit shape)
  const wallMat = new THREE.MeshStandardMaterial({ map: str.map, normalMap: str.normalMap, roughness: 0.96, color: 0xd8d8dc, side: THREE.DoubleSide });
  patchGround(wallMat, U, 'wall');
  const floorMat = new THREE.MeshStandardMaterial({ map: reg.map, normalMap: reg.normalMap, roughness: 0.98, color: 0xa9a9ab });
  patchGround(floorMat, U, 'wall');
  const pitWalls = new THREE.Mesh(new THREE.BufferGeometry(), wallMat);
  const pitFloor = new THREE.Mesh(new THREE.BufferGeometry(), floorMat);
  pitWalls.receiveShadow = pitFloor.receiveShadow = true;
  pitWalls.castShadow = true;
  scene.add(pitWalls, pitFloor);

  return { top, front, U, reg, str, pitWalls, pitFloor, faceMat, wallMat, floorMat, patchGround };
}

// rebuild pit interior: back wall, two side walls, floor
export function setPit(slab, pit) {
  // pit: {x0,x1,zBack,yFloor,on, fillTop}
  const { pitWalls, pitFloor } = slab;
  if (!pit.on) { pitWalls.visible = pitFloor.visible = false; return; }
  pitWalls.visible = pitFloor.visible = true;
  const { x0, x1, zBack } = pit;
  const yb = pit.yFloor - 0.02, yt = 0.05;
  const e = 0.03;
  const W = 28, H = 14;
  const quads = [
    // back wall (faces +z)
    [[x0 - e, yb, zBack], [x1 + e, yb, zBack], [x1 + e, yt, zBack], [x0 - e, yt, zBack], (x) => [(x[0] + 14) / W, -x[1] / H]],
    // left wall (faces +x)
    [[x0, yb, 0.01], [x0, yb, zBack - e], [x0, yt, zBack - e], [x0, yt, 0.01], (x) => [(-x[2] + 1) / W, -x[1] / H]],
    // right wall (faces -x)
    [[x1, yb, zBack - e], [x1, yb, 0.01], [x1, yt, 0.01], [x1, yt, zBack - e], (x) => [(-x[2] + 7) / W, -x[1] / H]],
  ];
  const pos = [], uv = [], idx = [];
  for (const q of quads) {
    const base = pos.length / 3;
    for (let k = 0; k < 4; k++) { pos.push(...q[k]); uv.push(...q[4](q[k])); }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const gw = new THREE.BufferGeometry();
  gw.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  gw.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  gw.setIndex(idx); gw.computeVertexNormals();
  pitWalls.geometry.dispose(); pitWalls.geometry = gw;
  const gf = new THREE.PlaneGeometry(x1 - x0, -zBack, 1, 1);
  gf.rotateX(-Math.PI / 2);
  gf.translate((x0 + x1) / 2, pit.yFloor, zBack / 2);
  const fu = gf.attributes.uv, fp = gf.attributes.position;
  for (let i = 0; i < fp.count; i++) fu.setXY(i, fp.getX(i) / 3, fp.getZ(i) / 3);
  pitFloor.geometry.dispose(); pitFloor.geometry = gf;
}

// ------------------------------------------------------------ pebbles -------
export function createPebbles(scene, avoid) {
  const r = mulberry32(42);
  const base = new THREE.IcosahedronGeometry(1, 3);
  const pp = base.attributes.position;
  for (let i = 0; i < pp.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pp, i);
    const n = 1 + 0.22 * fbm2(v.x * 1.7 + 3, v.y * 1.7 + v.z, 3) + 0.12 * Math.sign(v.x * v.y);
    v.multiplyScalar(n); v.y *= 0.62;
    pp.setXYZ(i, v.x, v.y, v.z);
  }
  base.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: 0x6f6f72, roughness: 0.92, metalness: 0 });
  const N = 700;
  const mesh = new THREE.InstancedMesh(base, mat, N);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), t = new THREE.Vector3();
  const col = new THREE.Color();
  let k = 0;
  while (k < N) {
    const x = SLAB.x0 + 0.6 + r() * (SLAB.x1 - SLAB.x0 - 1.2);
    const z = SLAB.z0 + 0.6 + r() * (SLAB.z1 - SLAB.z0 - 1.0);
    if (z > -0.35) continue;
    if (avoid(x, z)) continue;
    let sz = 0.025 + Math.pow(r(), 3.5) * 0.22;
    if (r() < 0.015 && z < -3) sz = 0.3 + r() * 0.4;
    t.set(x, groundHeight(x, z) + sz * 0.15, z);
    q.setFromEuler(new THREE.Euler(r() * 0.4, r() * 6.28, r() * 0.4));
    s.set(sz * (0.8 + r() * 0.5), sz, sz * (0.8 + r() * 0.5));
    m.compose(t, q, s);
    mesh.setMatrixAt(k, m);
    const g = 0.7 + r() * 0.3; col.setRGB(g, g * 0.99, g * 0.98);
    mesh.setColorAt(k, col);
    k++;
  }
  mesh.castShadow = true; mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

// ------------------------------------------------------------- footprints ---
export function createFootprints(scene, prints) {
  // prints: [{x,z,rot,t,side}]
  const tex = footprintTexture();
  const mat = new THREE.MeshStandardMaterial({
    color: 0x7a7a7c, normalMap: tex.normalMap, alphaMap: tex.alphaMap, transparent: true,
    roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const geo = new THREE.PlaneGeometry(0.17, 0.32);
  geo.rotateX(-Math.PI / 2);
  const meshes = prints.map((pr) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(pr.x, groundHeight(pr.x, pr.z) + 0.006, pr.z);
    m.rotation.y = pr.rot;
    m.receiveShadow = true;
    m.visible = false;
    scene.add(m);
    return m;
  });
  return { update(t) { prints.forEach((pr, i) => { meshes[i].visible = t >= pr.t; }); } };
}

// ---------------------------------------------------------------- sky -------
export function createSky(scene) {
  const r = mulberry32(7);
  const N = 5200;
  const pos = new Float32Array(N * 3), size = new Float32Array(N), col = new Float32Array(N * 3);
  const band = new THREE.Vector3(0.35, 0.8, -0.48).normalize(); // galaxy band normal
  for (let i = 0; i < N; i++) {
    let v;
    for (;;) {
      v = new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1);
      const l = v.length(); if (l > 1 || l < 0.1) continue;
      v.normalize();
      const inBand = Math.exp(-Math.pow(v.dot(band) / 0.16, 2));
      if (r() < 0.45 + 0.55 * inBand) break;
    }
    v.multiplyScalar(900);
    pos.set([v.x, v.y, v.z], i * 3);
    const b = Math.pow(r(), 5.5);
    size[i] = 1.6 + b * 4.2;
    const tint = r();
    const c = tint < 0.15 ? [0.75, 0.85, 1.25] : tint > 0.88 ? [1.25, 1.0, 0.8] : [1, 1, 1];
    const bright = 0.35 + b * 6.0;
    col.set([c[0] * bright, c[1] * bright, c[2] * bright], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 1.0 } },
    vertexShader: `
      attribute float aSize; attribute vec3 aCol; varying vec3 vCol; uniform float uScale;
      void main(){ vCol = aCol; vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv; gl_PointSize = aSize * uScale; }`,
    fragmentShader: `
      varying vec3 vCol;
      void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0;
        float a = smoothstep(1.0, 0.0, r); a *= a;
        gl_FragColor = vec4(vCol * a, 1.0); }`,
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
  });
  const stars = new THREE.Points(g, mat);
  stars.frustumCulled = false;
  stars.renderOrder = -10;
  scene.add(stars);
  return stars;
}

export function createEarth(scene) {
  const tex = earthTextures(1024, 512);
  const R = 46, DIST = 820;
  const group = new THREE.Group();
  const mat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: tex.map }, uClouds: { value: tex.clouds }, uSun: { value: SUN_DIR }, uSpin: { value: 0 } },
    vertexShader: `
      varying vec3 vN; varying vec2 vUv; varying vec3 vView;
      void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal);
        vec4 wp = modelMatrix * vec4(position,1.0); vView = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `
      uniform sampler2D uMap, uClouds; uniform vec3 uSun; uniform float uSpin;
      varying vec3 vN; varying vec2 vUv; varying vec3 vView;
      void main(){
        vec3 n = normalize(vN);
        float l = dot(n, normalize(uSun));
        float day = smoothstep(-0.15, 0.25, l);
        vec3 alb = texture2D(uMap, vUv + vec2(uSpin, 0.0)).rgb;
        alb = pow(alb, vec3(2.2));
        float cl = texture2D(uClouds, vUv + vec2(uSpin * 1.35, 0.0)).a;
        vec3 col = mix(alb, vec3(1.0), cl * 0.85);
        vec3 lit = col * (day * 2.2 + 0.012);
        // ocean glint
        vec3 h = normalize(normalize(uSun) + normalize(vView));
        float ocean = 1.0 - smoothstep(0.08, 0.2, alb.g + alb.r) ;
        lit += vec3(1.0, 0.9, 0.75) * pow(max(dot(n, h), 0.0), 60.0) * ocean * (1.0 - cl) * 1.5 * day;
        // atmosphere rim inside the disc
        float fr = pow(1.0 - max(dot(n, normalize(vView)), 0.0), 3.0);
        lit += vec3(0.25, 0.55, 1.2) * fr * (0.25 + day * 1.4);
        gl_FragColor = vec4(lit, 1.0);
      }`,
  });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), mat);
  earth.rotation.z = 0.41;
  group.add(earth);
  const atm = new THREE.Mesh(new THREE.SphereGeometry(R * 1.12, 96, 64), new THREE.ShaderMaterial({
    uniforms: { uSun: { value: SUN_DIR } },
    vertexShader: `varying vec3 vN; varying vec3 vView;
      void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 wp = modelMatrix * vec4(position,1.0);
        vView = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `uniform vec3 uSun; varying vec3 vN; varying vec3 vView;
      void main(){ vec3 n = normalize(vN); float v = dot(n, normalize(vView));
        float rim = pow(clamp(1.0 + v * 1.0, 0.0, 1.0), 5.0);
        float sunSide = smoothstep(-0.4, 0.6, dot(n, normalize(uSun)));
        gl_FragColor = vec4(vec3(0.22, 0.5, 1.25) * rim * (0.15 + sunSide * 1.5), 1.0); }`,
    side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
  }));
  group.add(atm);
  group.position.copy(EARTH_DIR).multiplyScalar(DIST);
  scene.add(group);
  return { group, earth, mat, R, DIST };
}

// ------------------------------------------------------------- lights -------
export function createLights(scene) {
  const sun = new THREE.DirectionalLight(0xfff3e6, 3.4);
  sun.position.copy(SUN_DIR).multiplyScalar(40);
  sun.target.position.set(0, 0, -6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const sc = sun.shadow.camera;
  sc.left = -21; sc.right = 21; sc.top = 19; sc.bottom = -19; sc.near = 1; sc.far = 110;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.025;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0x2a3550, 0x575553, 0.55);
  scene.add(hemi);
  const earthshine = new THREE.DirectionalLight(0x8fb4ff, 0.32);
  earthshine.position.copy(EARTH_DIR).multiplyScalar(30);
  scene.add(earthshine);
  return { sun, hemi, earthshine };
}
