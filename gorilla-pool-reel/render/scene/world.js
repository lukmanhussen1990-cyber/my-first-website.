// Backyard diorama: sky, lights, house, fence, lawn + grass, soil cutaway with a
// live hole, pool construction pieces and water.
import * as THREE from 'three';
import { mulberry32, patch, mesh, group, roundedBoxGeo, GLSL_NOISE, clamp, lerp, easeOutBack, seg, canvasTexture } from './lib.js';

export const C = {
  zF: 1.6,          // front cut plane of the diorama
  poolX: 1.5,       // pool half width (inner)
  poolZB: -1.6,     // pool back wall z
  poolD: 1.6,       // correct depth
  shell: 0.16,      // concrete thickness
  fenceZ: -5.0,
  houseZ: -5.6,
  waterTop: -0.12,
};

// uniforms shared by many shaders
export const U = {
  uTime: { value: 0 },
  uHoleBox: { value: new THREE.Vector4(0, 0, 0, 0) },  // x0, x1, zb, depth
  uHoleZf: { value: C.zF },                             // front extent of hole (== zF when open to the cut)
  uHoleOn: { value: 0 },
  uRough: { value: new THREE.Vector4(0.25, 0.25, 0.25, 0.15) }, // L, R, Back, Floor crumble
  uShellOn: { value: new THREE.Vector4(0, 0, 0, 0) },  // L, R, Back, Floor concrete placed
  uWater: { value: -5 },                                // water level (y)
  uWaterOn: { value: 0 },
  uSplash: { value: new THREE.Vector4(0, 0, -100, 0) }, // x, z, t0, amp
  uSunDir: { value: new THREE.Vector3(-0.66, 0.38, 0.65).normalize() },
  uCoping: { value: 0 },
  uPush: { value: new THREE.Vector4(0, 0, -99, 0) },   // grass push (x, z, radius, strength)
};

// --- GLSL shared by soil surfaces -------------------------------------------
const HOLE_GLSL = /* glsl */ `
uniform vec4 uHoleBox; uniform float uHoleZf; uniform float uHoleOn; uniform vec4 uRough; uniform vec4 uShellOn;
float holeDisp(vec2 a, float r){
  float n = (vnoise2(a * 4.5) - 0.5) * 0.9 + (vnoise2(a * 11.0 + 3.7) - 0.5) * 0.35;
  return n * 0.22 * r;
}
`;

const SOIL_GLSL = /* glsl */ `
vec3 soilColor(vec3 P, vec2 q, out float h, out float rough){
  float wav = (fbm2(vec2((P.x + P.z) * 0.5, 3.1)) - 0.5) * 0.55;
  float y = P.y + wav;
  vec3 cTop = vec3(0.085, 0.050, 0.030);
  vec3 cLoam = vec3(0.20, 0.108, 0.055);
  vec3 cClay = vec3(0.36, 0.165, 0.072);
  vec3 cSand = vec3(0.52, 0.37, 0.20);
  vec3 cRock = vec3(0.26, 0.245, 0.235);
  vec3 c = cTop;
  c = mix(c, cLoam, smoothstep(-0.28, -0.42, y));
  c = mix(c, cClay, smoothstep(-1.12, -1.30, y));
  c = mix(c, cSand, smoothstep(-2.10, -2.28, y));
  c = mix(c, cRock, smoothstep(-2.90, -3.08, y));
  float g = fbm2(q * 7.0);
  float g2 = vnoise2(q * 26.0);
  c *= 0.74 + 0.42 * g + 0.14 * g2;
  // thin darker bands inside layers
  c *= 0.9 + 0.1 * sin(y * 38.0 + g * 5.0);
  h = g * 0.7 + g2 * 0.22;
  rough = 0.95;
  // small pebbles (sparse, varied, mostly soil-toned)
  vec4 v = voronoi2(q * 7.5);
  float pr = 0.12 + 0.16 * hash12(vec2(v.y * 31.0, 2.0));
  float peb = step(v.y, 0.12) * smoothstep(pr + 0.015, pr - 0.015, v.x);
  vec3 pc = mix(vec3(0.20, 0.17, 0.14), vec3(0.42, 0.37, 0.31), hash12(vec2(v.y * 91.0, 1.0)));
  pc = mix(pc, c * 1.6, 0.35);
  c = mix(c, pc * (0.8 + 0.3 * g2), peb);
  h += peb * clamp(pr - v.x, 0.0, 1.0) * 4.0;
  rough -= peb * 0.3;
  // larger stones deeper down
  vec4 v2 = voronoi2(q * 1.9 + 13.0);
  float sr = 0.16 + 0.12 * hash12(vec2(v2.y * 17.0, 4.0));
  float sd = v2.x * (1.0 + 0.7 * (vnoise2(q * 6.0 + v2.y * 40.0) - 0.5));
  float zone = step(v2.y, 0.07) * smoothstep(-0.45, -0.7, y);
  float st = zone * smoothstep(sr + 0.01, sr - 0.01, sd);
  c *= 1.0 - 0.45 * zone * smoothstep(sr + 0.06, sr, sd) * (1.0 - st);
  vec3 sc2 = mix(vec3(0.13, 0.12, 0.115), vec3(0.27, 0.25, 0.23), hash12(vec2(v2.y * 7.0, 9.0)));
  c = mix(c, sc2 * (0.6 + 0.7 * fbm2(q * 9.0)), st);
  h += st * clamp(sr - v2.x, 0.0, 1.0) * 6.0;
  rough -= st * 0.3;
  // root threads near the top
  float rz = smoothstep(-1.1, -0.12, y);
  float rl = abs(fract(fbm2(q * vec2(1.6, 2.4) + 4.0) * 5.0) - 0.5);
  float roots = smoothstep(0.045, 0.0, rl) * rz * (1.0 - peb) * (1.0 - st);
  c = mix(c, vec3(0.30, 0.19, 0.10), roots * 0.85);
  h += roots * 0.6;
  // sod line: dense fibres right under the grass
  float sod = smoothstep(-0.16, -0.02, P.y);
  c = mix(c, vec3(0.06, 0.045, 0.025) * (0.8 + 0.4 * vnoise2(q * vec2(80.0, 8.0))), sod * 0.8);
  return c;
}
`;

function soilMaterial(extra = {}) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0 });
  return patch(m, {
    uniforms: { ...U, ...(extra.uniforms || {}) },
    vHead: HOLE_GLSL + (extra.vHead || ''),
    vPre: extra.vPre,
    vMain: extra.vMain,
    fHead: HOLE_GLSL + SOIL_GLSL + (extra.fHead || ''),
    fColor: `
      vec3 P = vWPos; vec3 Nw = normalize(vWNrm);
      vec2 q = abs(Nw.z) > 0.6 ? P.xy : (abs(Nw.x) > 0.6 ? P.zy : P.xz);
      ${extra.fDiscard || ''}
      float sh; float srough;
      vec3 sc = soilColor(P, q, sh, srough);
      ${extra.fAO ? `
        float dF = P.y + uHoleBox.w, dL = P.x - uHoleBox.x, dR = uHoleBox.y - P.x, dB = P.z - uHoleBox.z, dT = -P.y;
        float m = 9.0;
        if (uWallType < 0.5) m = min(min(dF, dB), dT * 3.0);
        else if (uWallType < 1.5) m = min(min(dF, dB), dT * 3.0);
        else if (uWallType < 2.5) m = min(min(dF, min(dL, dR)), dT * 3.0);
        else m = min(dB, min(dL, dR));
        sc *= mix(0.5, 1.0, smoothstep(0.0, 0.55, max(m, 0.0)));
      ` : ''}
      diffuseColor.rgb = sc;
    `,
    fRough: `roughnessFactor = srough;`,
    fNormal: `normal = perturbNormalH(-vViewPosition, normal, sh * 0.012, faceDirection);`,
  });
}

// ---------------------------------------------------------------------------
export function buildWorld(scene, renderer) {
  const rnd = mulberry32(1234);
  const W = { objects: {} };

  // ---------- sky ----------
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTime: U.uTime, uGlow: { value: new THREE.Vector3(-0.85, 0.12, -0.5).normalize() } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize((modelMatrix * vec4(position,1.0)).xyz - cameraPosition*0.0); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      varying vec3 vDir; uniform float uTime; uniform vec3 uGlow;
      ${GLSL_NOISE}
      void main(){
        vec3 d = normalize(vDir); float h = d.y;
        vec3 horizon = vec3(1.0, 0.5, 0.16) * 1.6;
        vec3 low = vec3(1.0, 0.62, 0.3) * 1.35;
        vec3 mid = vec3(1.0, 0.6, 0.5) * 0.95;
        vec3 top = vec3(0.46, 0.46, 0.8) * 0.72;
        vec3 c = mix(horizon, low, smoothstep(0.0, 0.07, h));
        c = mix(c, mid, smoothstep(0.07, 0.28, h));
        c = mix(c, top, smoothstep(0.28, 0.85, h));
        float sd = max(dot(d, uGlow), 0.0);
        c += vec3(1.0, 0.6, 0.22) * (pow(sd, 5.0) * 1.3 + pow(sd, 40.0) * 2.5);
        vec2 cuv = d.xz / max(h + 0.12, 0.04);
        float cl = smoothstep(0.52, 0.8, fbm2(cuv * vec2(0.9, 2.2) + vec2(uTime * 0.012, 0.0)));
        cl *= smoothstep(0.02, 0.10, h) * (1.0 - smoothstep(0.35, 0.6, h));
        vec3 cloudLit = mix(vec3(1.0, 0.6, 0.38) * 1.7, vec3(1.0, 0.52, 0.6) * 1.05, smoothstep(0.05, 0.35, h));
        c = mix(c, cloudLit, cl * 0.8);
        if (h < 0.0) c = mix(horizon, vec3(0.30, 0.24, 0.20), smoothstep(0.0, -0.12, h));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(180, 48, 24), skyMat);
  sky.renderOrder = -10; sky.frustumCulled = false;
  scene.add(sky);

  // environment map for PBR reflections / ambient light
  {
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), skyMat));
    const gnd = new THREE.Mesh(new THREE.CircleGeometry(90, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.16, 0.2, 0.07) }));
    gnd.rotation.x = -Math.PI / 2; gnd.position.y = -1.5; envScene.add(gnd);
    const pm = new THREE.PMREMGenerator(renderer);
    const env = pm.fromScene(envScene, 0.035).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.6;
  }
  scene.fog = new THREE.Fog(new THREE.Color(0.92, 0.6, 0.42), 32, 95);

  // ---------- lights ----------
  const sun = new THREE.DirectionalLight(0xffc08a, 4.1);
  sun.position.copy(U.uSunDir.value).multiplyScalar(30);
  sun.target.position.set(0, 0, -1.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 5, far: 70 });
  sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.02; sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0xa9b8ff, 0x6a5a38, 0.32);
  scene.add(hemi);
  const rim = new THREE.DirectionalLight(0xffb27a, 1.6);
  rim.position.set(4, 5, -12); scene.add(rim);
  const bounce = new THREE.DirectionalLight(0xd8b37a, 0.35);
  bounce.position.set(0.5, -1, 3); scene.add(bounce);
  W.sun = sun;

  // ---------- lawn top ----------
  const lawnMat = patch(new THREE.MeshStandardMaterial({ color: 0x4f8a2b, roughness: 0.92 }), {
    fColor: `
      vec3 P = vWPos;
      float stripe = step(0.5, fract((P.x + 0.45) / 1.8));
      vec3 g1 = vec3(0.085, 0.22, 0.035), g2 = vec3(0.17, 0.39, 0.075);
      vec3 gc = mix(g1, g2, stripe);
      float n = fbm2(P.xz * 3.0);
      gc *= 0.8 + 0.4 * n;
      gc = mix(gc, vec3(0.14, 0.10, 0.04), smoothstep(0.62, 0.8, fbm2(P.xz * 1.3 + 7.0)) * 0.35);
      diffuseColor.rgb = gc;
      float lh = n;
    `,
    fNormal: `normal = perturbNormalH(-vViewPosition, normal, lh * 0.01, faceDirection);`,
  });
  const lawn = mesh(new THREE.BufferGeometry(), lawnMat, { cast: false });
  lawn.frustumCulled = false;
  scene.add(lawn);
  W.lawn = lawn;

  // ---------- front cut face ----------
  const frontMat = soilMaterial({});
  const front = mesh(new THREE.BufferGeometry(), frontMat, { cast: false });
  front.frustumCulled = false;
  scene.add(front);
  W.front = front;

  // ---------- hole walls (CPU geometry so every render pass sees the same shape) ----------
  W.walls = [];
  for (let type = 0; type < 5; type++) {
    const m = soilMaterial({
      uniforms: { uWallType: { value: type } },
      fHead: `uniform float uWallType;`,
      fAO: true,
    });
    const g = new THREE.PlaneGeometry(1, 1, 40, 40);
    const w = mesh(g, m, { cast: false });
    w.frustumCulled = false;
    scene.add(w); W.walls.push(w);
  }

  // ---------- grass blades ----------
  {
    const bladeGeo = new THREE.PlaneGeometry(1, 1, 1, 4);
    bladeGeo.translate(0, 0.5, 0);
    const p = bladeGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i); const x = p.getX(i);
      p.setX(i, x * (1 - y * 0.92));            // taper
      p.setZ(i, y * y * 0.35);                  // curve
    }
    bladeGeo.computeVertexNormals();
    const N = 30000;
    const grassMat = patch(new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.62, color: 0xffffff }), {
      uniforms: U,
      vHead: HOLE_GLSL + `uniform float uTime; uniform float uCoping; uniform vec4 uPush; varying float vH;`,
      vMain: `
        vH = position.y;
        vec3 root = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);
        float hide = 0.0;
        if (uHoleOn > 0.5) {
          float m = 0.06;
          if (root.x > uHoleBox.x - m && root.x < uHoleBox.y + m && root.z > uHoleBox.z - m && root.z < uHoleZf + 0.2) hide = 1.0;
        }
        if (uCoping > 0.5) {
          float m = 0.32;
          if (root.x > -${C.poolX.toFixed(2)} - m && root.x < ${C.poolX.toFixed(2)} + m && root.z > ${C.poolZB.toFixed(2)} - m && root.z < ${C.zF.toFixed(2)} + 0.2) hide = 1.0;
        }
        transformed *= (1.0 - hide);
        float w = sin(uTime * 1.7 + root.x * 0.9 + root.z * 0.6) * 0.6 + sin(uTime * 2.9 + root.x * 2.3 - root.z * 1.7) * 0.25 + (vnoise2(root.xz * 0.7 + uTime * 0.35) - 0.5) * 0.9;
        float k = position.y * position.y;
        transformed.x += w * 0.16 * k;
        transformed.z += w * 0.08 * k;
        vec2 dp = root.xz - uPush.xy; float pd = length(dp);
        float push = uPush.w * smoothstep(uPush.z, 0.0, pd);
        transformed.y *= 1.0 - push * 0.6;
      `,
      fHead: `varying float vH;`,
      fColor: `
        vec3 base = diffuseColor.rgb;
        diffuseColor.rgb = mix(base * 0.35, base * mix(1.0, 1.35, vH) + vec3(0.03, 0.035, 0.0) * vH, smoothstep(0.0, 1.0, vH));
      `,
      fEmissive: `totalEmissiveRadiance += diffuseColor.rgb * vec3(0.35, 0.3, 0.08) * vH * vH * 0.45;`,
    });
    const grass = new THREE.InstancedMesh(bladeGeo, grassMat, N);
    const d = new THREE.Object3D(); const col = new THREE.Color();
    let n = 0;
    while (n < N) {
      const x = -6.5 + rnd() * 13;
      const z = C.fenceZ + 0.08 + rnd() * (C.zF - C.fenceZ - 0.1);
      const h = 0.11 + rnd() * 0.09;
      d.position.set(x, 0, z);
      d.rotation.set(0, rnd() * Math.PI * 2, 0);
      d.scale.set(0.022 + rnd() * 0.012, h, 1);
      // lean forward blades near the front edge (overhang)
      d.updateMatrix();
      grass.setMatrixAt(n, d.matrix);
      const stripe = Math.floor((x + 0.45) / 0.9) % 2 === 0 ? 0 : 1;
      const v = 0.8 + rnd() * 0.4;
      col.setRGB((stripe ? 0.19 : 0.095) * v, (stripe ? 0.46 : 0.26) * v, (stripe ? 0.08 : 0.042) * v, THREE.LinearSRGBColorSpace);
      if (rnd() < 0.05) col.setRGB(0.26 * v, 0.38 * v, 0.07 * v, THREE.LinearSRGBColorSpace);
      grass.setColorAt(n, col);
      n++;
    }
    grass.receiveShadow = true; grass.castShadow = false; grass.frustumCulled = false;
    scene.add(grass);
    W.grass = grass;
  }

  // ---------- house ----------
  buildHouse(scene, rnd, W);
  // ---------- fence, neighbour yard, background ----------
  buildFenceAndBackground(scene, rnd, W);
  // ---------- underground details (rocks, roots, worms, fossil) ----------
  buildUnderground(scene, rnd, W);
  // ---------- pool construction ----------
  buildPool(scene, rnd, W);
  return W;
}

// ---------------------------------------------------------------------------
function buildHouse(scene, rnd, W) {
  const house = group(scene, [0, 0, 0]);
  const x0 = -11.5, x1 = -0.9, zb = C.houseZ, depth = 7;
  const wallMat = patch(new THREE.MeshStandardMaterial({ color: 0xe0c08c, roughness: 0.9 }), {
    fColor: `
      float n = fbm3(vWPos * 3.0); float n2 = vnoise(vWPos * 18.0);
      diffuseColor.rgb *= 0.9 + 0.12 * n + 0.05 * n2;
      // siding boards
      float b = smoothstep(0.02, 0.0, abs(fract(vWPos.y / 0.24) - 0.5) - 0.47);
      diffuseColor.rgb *= 1.0 - b * 0.18;
      float hh = n2 * 0.3 + b;
    `,
    fNormal: `normal = perturbNormalH(-vViewPosition, normal, hh * 0.006, faceDirection);`,
  });
  const H1 = 3.0, H2 = 6.0;
  const body = mesh(new THREE.BoxGeometry(x1 - x0, H2, depth), wallMat);
  body.position.set((x0 + x1) / 2, H2 / 2, zb - depth / 2);
  house.add(body);
  // foundation strip
  const found = mesh(new THREE.BoxGeometry(x1 - x0 + 0.08, 0.35, depth + 0.08), new THREE.MeshStandardMaterial({ color: 0x8d8478, roughness: 0.95 }));
  found.position.set((x0 + x1) / 2, 0.17, zb - depth / 2); house.add(found);
  // trim band between floors
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xf7f1e6, roughness: 0.6 });
  const band = mesh(new THREE.BoxGeometry(x1 - x0 + 0.1, 0.14, 0.1), trimMat);
  band.position.set((x0 + x1) / 2, H1 + 0.05, zb + 0.04); house.add(band);
  for (const cx of [x1 - 0.06]) {
    const c = mesh(new THREE.BoxGeometry(0.16, H2, 0.16), trimMat); c.position.set(cx, H2 / 2, zb - 0.02); house.add(c);
  }
  // roof (gable along x)
  {
    const rh = 2.3, over = 0.45;
    const shape = new THREE.Shape();
    shape.moveTo(-depth / 2 - over, 0); shape.lineTo(depth / 2 + over, 0); shape.lineTo(0, rh); shape.lineTo(-depth / 2 - over, 0);
    const g = new THREE.ExtrudeGeometry(shape, { depth: x1 - x0 + 0.6, bevelEnabled: false });
    g.rotateY(Math.PI / 2);
    const roofMat = patch(new THREE.MeshStandardMaterial({ color: 0x5b4a4a, roughness: 0.8 }), {
      fColor: `
        float row = fract(vWPos.y / 0.16 + vWPos.z * 0.0);
        float col = fract(vWPos.x / 0.32 + step(0.5, fract(vWPos.y / 0.32)) * 0.5);
        float edge = smoothstep(0.0, 0.08, row) * smoothstep(0.0, 0.04, col) * smoothstep(1.0, 0.96, col);
        float tone = 0.75 + 0.35 * hash12(floor(vec2(vWPos.x / 0.32 + step(0.5, fract(vWPos.y / 0.32)) * 0.5, vWPos.y / 0.16)));
        diffuseColor.rgb *= tone * (0.55 + 0.45 * edge);
        float rh2 = edge;
      `,
      fNormal: `normal = perturbNormalH(-vViewPosition, normal, rh2 * 0.01, faceDirection);`,
    });
    const roof = mesh(g, roofMat);
    roof.position.set(x0 - 0.3, H2, zb - depth / 2);
    house.add(roof);
    const fascia = mesh(new THREE.BoxGeometry(x1 - x0 + 0.6, 0.12, 0.1), trimMat);
    fascia.position.set((x0 + x1) / 2, H2 + 0.02, zb + over - 0.02); house.add(fascia);
    const gutter = mesh(new THREE.CylinderGeometry(0.06, 0.06, x1 - x0 + 0.6, 12, 1, false, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0xece8e0, roughness: 0.4, side: THREE.DoubleSide }));
    gutter.rotation.z = Math.PI / 2; gutter.rotation.x = Math.PI; gutter.position.set((x0 + x1) / 2, H2 + 0.0, zb + over + 0.03); house.add(gutter);
  }
  // windows with blue shutters
  const shutterMat = patch(new THREE.MeshStandardMaterial({ color: 0x3c6fae, roughness: 0.55 }), {
    fColor: `float sl = smoothstep(0.35, 0.5, abs(fract(vOPos.y / 0.07) - 0.5)); diffuseColor.rgb *= 1.0 - sl * 0.35; float shh = sl;`,
    fNormal: `normal = perturbNormalH(-vViewPosition, normal, shh * 0.004, faceDirection);`,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x223448, roughness: 0.08, metalness: 0.0, clearcoat: 1, emissive: 0xffa95a, emissiveIntensity: 0.55 });
  const curtainMat = new THREE.MeshStandardMaterial({ color: 0xf3e6cf, roughness: 0.9, emissive: 0xffb070, emissiveIntensity: 0.25 });
  function windowAt(cx, cy, w, h) {
    const g = group(house, [cx, cy, zb]);
    const frame = mesh(roundedBoxGeo(w + 0.16, h + 0.16, 0.12, 0.03, 2), trimMat); frame.position.z = 0.03; g.add(frame);
    const glass = mesh(new THREE.BoxGeometry(w, h, 0.05), glassMat); glass.position.z = 0.07; g.add(glass);
    const cl = mesh(new THREE.BoxGeometry(w * 0.28, h * 0.92, 0.02), curtainMat); cl.position.set(-w * 0.34, 0, 0.06); g.add(cl);
    const cr = cl.clone(); cr.position.x = w * 0.34; g.add(cr);
    const mv = mesh(new THREE.BoxGeometry(0.05, h, 0.06), trimMat); mv.position.z = 0.1; g.add(mv);
    const mh = mesh(new THREE.BoxGeometry(w, 0.05, 0.06), trimMat); mh.position.z = 0.1; g.add(mh);
    const sill = mesh(new THREE.BoxGeometry(w + 0.32, 0.07, 0.2), trimMat); sill.position.set(0, -h / 2 - 0.1, 0.1); g.add(sill);
    for (const s of [-1, 1]) {
      const sh = mesh(roundedBoxGeo(w * 0.48, h + 0.12, 0.05, 0.015, 2), shutterMat);
      sh.position.set(s * (w / 2 + w * 0.24 + 0.1), 0, 0.06); g.add(sh);
    }
    return g;
  }
  windowAt(x1 - 1.7, 4.55, 1.05, 1.25);
  windowAt(x1 - 4.6, 4.55, 1.05, 1.25);
  windowAt(x1 - 7.6, 4.55, 1.05, 1.25);
  windowAt(x1 - 4.6, 1.65, 1.2, 1.35);
  windowAt(x1 - 7.6, 1.65, 1.2, 1.35);
  // back door
  {
    const g = group(house, [x1 - 1.7, 0, zb]);
    const doorMat = patch(new THREE.MeshStandardMaterial({ color: 0x3c6fae, roughness: 0.5 }), {
      fColor: `vec2 dq = vOPos.xy; float pan = step(0.06, abs(fract(dq.y / 0.62) - 0.5)) ; diffuseColor.rgb *= 0.9 + 0.1 * pan;`,
    });
    const frame = mesh(new THREE.BoxGeometry(1.15, 2.3, 0.12), trimMat); frame.position.set(0, 1.15 + 0.3, 0.03); g.add(frame);
    const door = mesh(roundedBoxGeo(0.95, 2.1, 0.08, 0.02, 2), doorMat); door.position.set(0, 1.05 + 0.32, 0.07); g.add(door);
    const win = mesh(new THREE.BoxGeometry(0.55, 0.6, 0.03), glassMat); win.position.set(0, 1.8, 0.115); g.add(win);
    const knob = mesh(new THREE.SphereGeometry(0.04, 16, 12), new THREE.MeshStandardMaterial({ color: 0xd9b25a, metalness: 1, roughness: 0.25 })); knob.position.set(0.36, 1.32, 0.13); g.add(knob);
    const step1 = mesh(roundedBoxGeo(1.6, 0.18, 0.55, 0.03, 2), new THREE.MeshStandardMaterial({ color: 0xbdb5a8, roughness: 0.9 })); step1.position.set(0, 0.09, 0.28); g.add(step1);
    const step2 = mesh(roundedBoxGeo(1.4, 0.18, 0.3, 0.03, 2), new THREE.MeshStandardMaterial({ color: 0xc8c0b3, roughness: 0.9 })); step2.position.set(0, 0.25, 0.15); g.add(step2);
    const lamp = mesh(new THREE.SphereGeometry(0.09, 16, 12), new THREE.MeshStandardMaterial({ color: 0xfff0d0, emissive: 0xffc070, emissiveIntensity: 4 })); lamp.position.set(0.8, 2.5, 0.14); g.add(lamp);
    const lampCap = mesh(new THREE.CylinderGeometry(0.06, 0.11, 0.07, 16), new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.4 })); lampCap.position.set(0.8, 2.6, 0.14); g.add(lampCap);
  }
  // spigot for the hose
  {
    const brass = new THREE.MeshStandardMaterial({ color: 0xc89b45, metalness: 1, roughness: 0.3 });
    const sp = group(house, [x1 - 0.65, 0.55, zb + 0.02]);
    const pipe = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.16, 12), brass); pipe.rotation.x = Math.PI / 2; pipe.position.z = 0.08; sp.add(pipe);
    const spout = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.12, 12), brass); spout.position.set(0, -0.05, 0.16); sp.add(spout);
    const handle = mesh(new THREE.TorusGeometry(0.05, 0.012, 8, 20), new THREE.MeshStandardMaterial({ color: 0xb8322a, roughness: 0.5 })); handle.position.set(0, 0.06, 0.12); handle.rotation.x = Math.PI / 2; sp.add(handle);
    W.spigot = new THREE.Vector3(x1 - 0.65, 0.49, zb + 0.2);
    // hose reel coil on the ground
    const hoseMat = new THREE.MeshStandardMaterial({ color: 0x2f9a45, roughness: 0.45 });
    W.hoseMat = hoseMat;
    for (let i = 0; i < 4; i++) {
      const tor = mesh(new THREE.TorusGeometry(0.28 - i * 0.012, 0.03, 10, 40), hoseMat);
      tor.rotation.x = Math.PI / 2; tor.position.set(x1 - 0.35, 0.03 + i * 0.055, zb + 0.4); house.add(tor);
    }
  }
  // shrubs + flowers along the house
  const leafMat = patch(new THREE.MeshStandardMaterial({ color: 0x2f6b2a, roughness: 0.85 }), {
    vMain: `transformed += normal * (vnoise(position * 6.0) - 0.5) * 0.12;`,
    fColor: `diffuseColor.rgb *= 0.7 + 0.5 * vnoise(vOPos * 14.0);`,
  });
  const flowerCols = [0xff6f91, 0xffd166, 0xffffff, 0xc77dff];
  for (let i = 0; i < 6; i++) {
    const x = x1 - 9.6 + i * 1.55;
    if (Math.abs(x - (x1 - 1.7)) < 1.0 || x > x1 - 0.5) continue;
    const s = 0.45 + rnd() * 0.25;
    const b = mesh(new THREE.IcosahedronGeometry(1, 3), leafMat, { scale: [s * 1.2, s, s] });
    b.position.set(x, s * 0.7, zb + 0.55); house.add(b);
    for (let k = 0; k < 7; k++) {
      const f = mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshStandardMaterial({ color: flowerCols[(i + k) % 4], roughness: 0.6 }));
      const a = rnd() * Math.PI * 2, e = rnd() * 0.9 + 0.2;
      f.position.set(x + Math.cos(a) * s * 1.1 * Math.cos(e), s * 0.7 + Math.sin(e) * s * 0.95, zb + 0.55 + Math.sin(a) * s * 0.9 * Math.cos(e) + 0.15);
      house.add(f);
    }
  }
  W.house = house;
}

function buildFenceAndBackground(scene, rnd, W) {
  const fenceMat = patch(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82 }), {
    fColor: `
      vec3 P = vWPos;
      float grain = fbm2(vec2(P.x * 60.0, P.y * 2.5)) ;
      float lines = abs(sin((P.x * 140.0 + grain * 9.0)));
      vec3 wood = diffuseColor.rgb * (0.78 + 0.22 * grain) * (0.92 + 0.08 * lines);
      float knot = smoothstep(0.06, 0.0, length(vec2(fract(P.x * 3.1) - 0.5, (fract(P.y * 1.3) - 0.5) * 0.5))) * step(0.7, hash12(floor(vec2(P.x * 3.1, P.y * 1.3))));
      wood *= 1.0 - knot * 0.45;
      diffuseColor.rgb = wood;
      float fh = grain * 0.5 + lines * 0.15;
    `,
    fNormal: `normal = perturbNormalH(-vViewPosition, normal, fh * 0.004, faceDirection);`,
  });
  const fx0 = -0.85, fx1 = 10;
  const pw = 0.14, n = Math.ceil((fx1 - fx0) / (pw + 0.012));
  const plankGeo = roundedBoxGeo(pw, 1.6, 0.035, 0.012, 2);
  const planks = new THREE.InstancedMesh(plankGeo, fenceMat, n);
  const d = new THREE.Object3D(); const col = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const h = 1.6 + (rnd() - 0.5) * 0.04;
    d.position.set(fx0 + i * (pw + 0.012) + pw / 2, h / 2 - 0.02, C.fenceZ - 0.04);
    d.rotation.set(0, 0, (rnd() - 0.5) * 0.012);
    d.scale.set(1, h / 1.6, 1); d.updateMatrix(); planks.setMatrixAt(i, d.matrix);
    const v = 0.85 + rnd() * 0.25;
    col.setRGB(0.42 * v, 0.24 * v, 0.12 * v, THREE.LinearSRGBColorSpace);
    planks.setColorAt(i, col);
  }
  planks.castShadow = true; planks.receiveShadow = true;
  scene.add(planks);
  const railMat = fenceMat.clone(); railMat.color = new THREE.Color(0.35, 0.2, 0.1);
  patch(railMat, { fColor: `diffuseColor.rgb *= 0.85 + 0.25 * fbm2(vec2(vWPos.x * 3.0, vWPos.y * 40.0));` });
  for (const y of [0.35, 1.25]) {
    const r = mesh(new THREE.BoxGeometry(fx1 - fx0, 0.09, 0.05), railMat); r.position.set((fx0 + fx1) / 2, y, C.fenceZ + 0.005); scene.add(r);
  }
  for (let x = fx0 + 0.05; x < fx1; x += 2.1) {
    const p = mesh(new THREE.BoxGeometry(0.1, 1.7, 0.1), railMat); p.position.set(x, 0.85, C.fenceZ + 0.03); scene.add(p);
  }
  // neighbour lawn
  const nlawn = mesh(new THREE.PlaneGeometry(30, 14), patch(new THREE.MeshStandardMaterial({ color: 0x4e8a32, roughness: 0.95 }), {
    fColor: `diffuseColor.rgb *= 0.75 + 0.4 * fbm2(vWPos.xz * 1.5); diffuseColor.rgb *= vec3(0.62, 0.72, 0.45);`,
  }), { cast: false });
  nlawn.rotation.x = -Math.PI / 2; nlawn.position.set(4, -0.005, C.fenceZ - 7); scene.add(nlawn);
  // neighbour house (far right)
  {
    const nh = group(scene, [7.5, 0, -12.5]);
    const wall = mesh(new THREE.BoxGeometry(9, 4.2, 6), patch(new THREE.MeshStandardMaterial({ color: 0xbfd3c6, roughness: 0.9 }), {
      fColor: `diffuseColor.rgb *= 0.92 + 0.12 * fbm3(vWPos * 2.0); diffuseColor.rgb *= 1.0 - 0.12 * smoothstep(0.02,0.0, abs(fract(vWPos.y / 0.25) - 0.5) - 0.47);`,
    }));
    wall.position.y = 2.1; nh.add(wall);
    const shape = new THREE.Shape(); shape.moveTo(-3.4, 0); shape.lineTo(3.4, 0); shape.lineTo(0, 2.0); shape.lineTo(-3.4, 0);
    const rg = new THREE.ExtrudeGeometry(shape, { depth: 9.6, bevelEnabled: false }); rg.rotateY(Math.PI / 2);
    const roof = mesh(rg, new THREE.MeshStandardMaterial({ color: 0x6a5450, roughness: 0.85 })); roof.position.set(-4.8, 4.2, 0); nh.add(roof);
    for (const x of [-2.6, 0.2, 2.8]) {
      const w = mesh(new THREE.BoxGeometry(1.0, 1.1, 0.1), new THREE.MeshStandardMaterial({ color: 0x2a3a4a, roughness: 0.1, emissive: 0xffa040, emissiveIntensity: 0.6 }));
      w.position.set(x, 2.4, 3.02); nh.add(w);
      const f = mesh(new THREE.BoxGeometry(1.16, 1.26, 0.06), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 })); f.position.set(x, 2.4, 2.99); nh.add(f);
    }
  }
  // trees
  const leafMat = patch(new THREE.MeshStandardMaterial({ color: 0x3d7a2e, roughness: 0.9 }), {
    vMain: `transformed += normal * (vnoise(position * 2.2 + 3.0) - 0.5) * 0.45 + normal * (vnoise(position * 7.0) - 0.5) * 0.12;`,
    fColor: `diffuseColor.rgb *= 0.65 + 0.55 * vnoise(vOPos * 5.0);`,
  });
  const barkMat = new THREE.MeshStandardMaterial({ color: 0x5a3d28, roughness: 0.95 });
  function tree(x, z, s, tint) {
    const g = group(scene, [x, 0, z]);
    const trunk = mesh(new THREE.CylinderGeometry(0.16 * s, 0.24 * s, 2.6 * s, 12), barkMat); trunk.position.y = 1.3 * s; g.add(trunk);
    const m = tint ? leafMat.clone() : leafMat;
    if (tint) { m.color = new THREE.Color(tint); m.onBeforeCompile = leafMat.onBeforeCompile; m.customProgramCacheKey = leafMat.customProgramCacheKey; }
    for (let i = 0; i < 6; i++) {
      const r = (0.9 + rnd() * 0.6) * s;
      const b = mesh(new THREE.IcosahedronGeometry(r, 4), m);
      b.position.set((rnd() - 0.5) * 1.8 * s, (2.8 + rnd() * 1.6) * s, (rnd() - 0.5) * 1.4 * s); g.add(b);
    }
    return g;
  }
  tree(4.6, -9.6, 0.82);
  tree(-6.0, -22, 1.2, 0x3b6b3a);
  for (let i = 0; i < 16; i++) tree(-22 + i * 3.2 + rnd(), -30 - rnd() * 6, 0.85 + rnd() * 0.45, 0x35603a);
  // neighbour bushes along the fence (their side)
  for (let i = 0; i < 5; i++) {
    const s = 0.5 + rnd() * 0.3;
    const b = mesh(new THREE.IcosahedronGeometry(1, 3), leafMat, { scale: [s * 1.3, s, s] }); b.position.set(4.5 + i * 1.3, s * 0.8, C.fenceZ - 0.7); scene.add(b);
  }
}

function buildUnderground(scene, rnd, W) {
  const z = C.zF;
  const rockMat = patch(new THREE.MeshStandardMaterial({ color: 0x5f5a55, roughness: 0.85, flatShading: true }), {
    vMain: `transformed += normal * (vnoise(position * 2.2) - 0.5) * 0.45;`,
    fColor: `diffuseColor.rgb *= 0.7 + 0.5 * fbm3(vOPos * 6.0); float rkh = vnoise(vOPos * 20.0);`,
    fNormal: `normal = perturbNormalH(-vViewPosition, normal, rkh * 0.01, faceDirection);`,
  });
  const rocks = [[-3.0, -0.95, 0.32], [2.6, -1.7, 0.42], [-2.4, -2.6, 0.5], [3.1, -3.2, 0.38], [-3.6, -3.9, 0.55], [0.0, -4.4, 0.6], [2.2, -4.6, 0.45], [-2.1, -1.35, 0.2]];
  for (const [x, y, s] of rocks) {
    const r = mesh(new THREE.IcosahedronGeometry(1, 1), rockMat, { scale: [s * 1.25, s * 0.7, s * 0.5], cast: false });
    r.position.set(x, y, z - s * 0.25); r.rotation.set(rnd(), rnd(), rnd());
    scene.add(r);
  }
  // roots: wiggly tubes hugging the cut face
  const rootMat = new THREE.MeshStandardMaterial({ color: 0x7a5636, roughness: 0.8 });
  for (let i = 0; i < 9; i++) {
    const sx = -3.8 + i * 0.95 + rnd() * 0.3;
    if (Math.abs(sx) < 1.9) continue;
    const pts = []; let x = sx, y = -0.06;
    for (let k = 0; k < 7; k++) { pts.push(new THREE.Vector3(x, y, z + 0.01)); x += (rnd() - 0.5) * 0.32; y -= 0.1 + rnd() * 0.12; }
    const curve = new THREE.CatmullRomCurve3(pts);
    const g = new THREE.TubeGeometry(curve, 40, 0.018 + rnd() * 0.01, 6);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) { const t = k / p.count; const v = new THREE.Vector3().fromBufferAttribute(p, k); const c = curve.getPoint(t); v.sub(c).multiplyScalar(1 - t * 0.8).add(c); p.setXYZ(k, v.x, v.y, v.z); }
    g.computeVertexNormals();
    scene.add(mesh(g, rootMat, { cast: false }));
  }
  // cute fossil bone + old boot details
  const boneMat = new THREE.MeshStandardMaterial({ color: 0xe9dfc8, roughness: 0.7 });
  const bone = group(scene, [-2.7, -3.25, z + 0.01], [0, 0, 0.35]);
  bone.add(mesh(new THREE.CapsuleGeometry(0.06, 0.55, 6, 16), boneMat, { rot: [0, 0, Math.PI / 2], cast: false }));
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) bone.add(mesh(new THREE.SphereGeometry(0.075, 16, 12), boneMat, { pos: [sx * 0.33, sy * 0.055, 0], cast: false }));
  // worms
  const wormMat = new THREE.MeshPhysicalMaterial({ color: 0xe88a8a, roughness: 0.35, clearcoat: 0.6 });
  W.worms = [];
  for (const [x, y] of [[-3.3, -0.55], [2.75, -0.75], [3.4, -2.25]]) {
    const wg = group(scene, [x, y, z + 0.02]);
    const segs = [];
    for (let k = 0; k < 9; k++) { const s = mesh(new THREE.SphereGeometry(0.03 - Math.abs(k - 4) * 0.0018, 12, 10), wormMat, { cast: false }); wg.add(s); segs.push(s); }
    W.worms.push({ g: wg, segs, phase: rnd() * 6 });
  }
}

function buildPool(scene, rnd, W) {
  const X = C.poolX, ZB = C.poolZB, D = C.poolD, S = C.shell, ZF = C.zF;
  const concreteMat = patch(new THREE.MeshStandardMaterial({ color: 0xc7c1b6, roughness: 0.88 }), {
    fColor: `diffuseColor.rgb *= 0.88 + 0.16 * fbm3(vWPos * 6.0) + 0.06 * vnoise(vWPos * 40.0); float ch = vnoise(vWPos * 30.0);`,
    fNormal: `normal = perturbNormalH(-vViewPosition, normal, ch * 0.003, faceDirection);`,
  });
  const fz = 0.004; // front faces pushed slightly in front of the soil cut to avoid z-fighting
  const slabs = [
    { size: [S, D + S, ZF - ZB + S + fz], pos: [-X - S / 2, -(D + S) / 2, (ZF + fz + ZB - S) / 2], from: [0.5, 0, 0] },
    { size: [S, D + S, ZF - ZB + S + fz], pos: [X + S / 2, -(D + S) / 2, (ZF + fz + ZB - S) / 2], from: [-0.5, 0, 0] },
    { size: [2 * X + 2 * S, D + S, S], pos: [0, -(D + S) / 2, ZB - S / 2], from: [0, 0, 0.5] },
    { size: [2 * X + 2 * S, S, ZF - ZB + S + fz], pos: [0, -D - S / 2, (ZF + fz + ZB - S) / 2], from: [0, 0.5, 0] },
  ];
  W.slabs = slabs.map((s) => {
    const m = mesh(new THREE.BoxGeometry(...s.size), concreteMat, { cast: false });
    m.position.set(...s.pos); m.visible = false; scene.add(m);
    return { m, base: new THREE.Vector3(...s.pos), from: new THREE.Vector3(...s.from) };
  });
  // tiles
  const tileMat = patch(new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.14, clearcoat: 0.8, clearcoatRoughness: 0.1 }), {
    uniforms: U,
    fHead: `uniform float uWater; uniform float uWaterOn; uniform float uTime;`,
    fColor: `
      float tn = vnoise(vWPos * 25.0);
      diffuseColor.rgb *= 0.94 + 0.1 * tn;
      float under = uWaterOn * smoothstep(uWater + 0.01, uWater - 0.03, vWPos.y);
      float dep = clamp((uWater - vWPos.y) / 1.6, 0.0, 1.0);
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.55, 0.85, 0.95), under * (0.4 + 0.5 * dep));
    `,
    fEmissive: `
      {
        vec3 Nw = normalize(vWNrm);
        vec2 cq = abs(Nw.y) > 0.5 ? vWPos.xz : (abs(Nw.x) > 0.5 ? vWPos.zy : vWPos.xy);
        float ca = causticPattern(cq * 0.42 + vec2(0.0, uTime * 0.01), uTime * 0.55);
        float cb = causticPattern(cq * 0.42 + vec2(0.31, 0.17), uTime * 0.55 + 1.7);
        float caus = ca * 0.6 + cb * 0.4;
        totalEmissiveRadiance += vec3(0.75, 0.95, 1.0) * caus * under * 0.55 * (1.0 - dep * 0.5);
      }
    `,
  });
  const tiles = [];
  const ts = 0.2, gap = 0.012, th = 0.016;
  // back wall
  for (let iy = 0; iy < 8; iy++) for (let ix = 0; ix < 15; ix++)
    tiles.push({ p: [-X + ts / 2 + ix * ts, -D + ts / 2 + iy * ts, ZB + th / 2], n: [0, 0, 1], rot: [0, 0, 0], k: ix * 0.6 + iy * 0.9, row: iy, wall: 0 });
  // side walls
  for (let iy = 0; iy < 8; iy++) for (let iz = 0; iz < 16; iz++) {
    tiles.push({ p: [-X + th / 2, -D + ts / 2 + iy * ts, ZB + ts / 2 + iz * ts], n: [1, 0, 0], rot: [0, Math.PI / 2, 0], k: 10 + iz * 0.5 + iy * 0.9, row: iy, wall: 1 });
    tiles.push({ p: [X - th / 2, -D + ts / 2 + iy * ts, ZB + ts / 2 + iz * ts], n: [-1, 0, 0], rot: [0, Math.PI / 2, 0], k: 10 + iz * 0.5 + iy * 0.9, row: iy, wall: 2 });
  }
  // floor
  for (let iz = 0; iz < 16; iz++) for (let ix = 0; ix < 15; ix++)
    tiles.push({ p: [-X + ts / 2 + ix * ts, -D + th / 2, ZB + ts / 2 + iz * ts], n: [0, 1, 0], rot: [Math.PI / 2, 0, 0], k: 20 + iz * 0.55 + Math.abs(ix - 7) * 0.25, row: -1, wall: 3 });
  const kmax = Math.max(...tiles.map((t) => t.k));
  const tileGeo = roundedBoxGeo(ts - gap, ts - gap, th, 0.006, 1);
  const tileMesh = new THREE.InstancedMesh(tileGeo, tileMat, tiles.length);
  const col = new THREE.Color();
  tiles.forEach((t, i) => {
    t.k /= kmax;
    const v = 0.9 + rnd() * 0.18;
    if (t.row === 7) col.setRGB(0.02 * v, 0.12 * v, 0.42 * v, THREE.LinearSRGBColorSpace);
    else col.setRGB(0.05 * v, 0.36 * v, 0.78 * v, THREE.LinearSRGBColorSpace);
    if (t.row === 6 && (i % 3 === 0)) col.setRGB(0.6, 0.85, 0.95, THREE.LinearSRGBColorSpace);
    tileMesh.setColorAt(i, col);
  });
  tileMesh.castShadow = false; tileMesh.receiveShadow = true; tileMesh.frustumCulled = false;
  scene.add(tileMesh);
  W.tiles = { mesh: tileMesh, list: tiles };

  // coping stones around the rim
  const copeMat = patch(new THREE.MeshStandardMaterial({ color: 0xece3d2, roughness: 0.7 }), {
    fColor: `diffuseColor.rgb *= 0.9 + 0.14 * fbm3(vWPos * 8.0); float cph = vnoise(vWPos * 35.0);`,
    fNormal: `normal = perturbNormalH(-vViewPosition, normal, cph * 0.003, faceDirection);`,
  });
  const cope = [];
  const cw = 0.34, ch = 0.07;
  for (let x = -X - cw; x < X + cw - 0.01; x += 0.55) cope.push({ p: [x + 0.275, ch / 2, ZB - cw / 2 + 0.04], s: [0.54, ch, cw] });
  for (let z = ZB + 0.04; z < ZF - 0.01; z += 0.55) {
    const len = Math.min(0.54, ZF - z - 0.005);
    cope.push({ p: [-X - cw / 2 + 0.04, ch / 2, z + len / 2], s: [cw, ch, len] });
    cope.push({ p: [X + cw / 2 - 0.04, ch / 2, z + len / 2], s: [cw, ch, len] });
  }
  W.cope = cope.map((c, i) => {
    const m = mesh(roundedBoxGeo(c.s[0] - 0.012, c.s[1], c.s[2] - 0.012, 0.02, 2), copeMat);
    m.position.set(...c.p); m.visible = false; scene.add(m);
    return { m, base: new THREE.Vector3(...c.p), k: i / cope.length };
  });

  // ladder
  {
    const chrome = new THREE.MeshStandardMaterial({ color: 0xe8eef2, metalness: 1, roughness: 0.12 });
    const lad = group(scene, [X - 0.02, 0, -0.75]);
    for (const dz of [-0.24, 0.24]) {
      const pts = [new THREE.Vector3(0.35, 0.02, dz), new THREE.Vector3(0.32, 0.75, dz), new THREE.Vector3(0.05, 0.85, dz), new THREE.Vector3(-0.14, 0.55, dz), new THREE.Vector3(-0.16, -1.2, dz)];
      lad.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 50, 0.025, 10), chrome));
    }
    for (const y of [-0.15, -0.5, -0.85]) {
      const st = mesh(new THREE.BoxGeometry(0.1, 0.03, 0.5), chrome); st.position.set(-0.17, y, 0); lad.add(st);
    }
    lad.scale.setScalar(0.001); lad.visible = false;
    W.ladder = lad;
  }

  // water surface
  const WAVES = /* glsl */ `
    uniform float uTime; uniform vec4 uSplash;
    float waveH(vec2 p){
      float h = sin(p.x * 2.1 + uTime * 1.3) * 0.012 + sin(p.y * 2.7 - uTime * 1.1 + p.x * 0.7) * 0.01
              + sin((p.x + p.y) * 4.3 + uTime * 2.2) * 0.005 + (vnoise2(p * 3.0 + uTime * 0.4) - 0.5) * 0.012;
      float dt = uTime - uSplash.z;
      if (dt > 0.0 && dt < 6.0) {
        float r = length(p - uSplash.xy);
        float front = dt * 1.9;
        h += uSplash.w * exp(-dt * 0.7) * sin((r - front) * 9.0) * exp(-pow((r - front) * 1.3, 2.0)) * 0.25;
        h += uSplash.w * exp(-dt * 1.5) * sin(r * 6.0 - dt * 10.0) * 0.05 * exp(-r * 0.8);
      }
      return h;
    }`;
  const waterMat = patch(new THREE.MeshPhysicalMaterial({
    color: 0x7fd8ee, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.62, envMapIntensity: 1.6,
    ior: 1.33, specularIntensity: 1, clearcoat: 1, clearcoatRoughness: 0.02, depthWrite: false,
  }), {
    uniforms: U,
    vHead: WAVES,
    vPre: `
      vec2 wp2 = vec2(position.x, -position.y);
      float e2 = 0.02;
      float h0 = waveH(wp2);
      float hx = waveH(wp2 + vec2(e2, 0.0)) - h0, hz = waveH(wp2 + vec2(0.0, e2)) - h0;
      objectNormal = normalize(vec3(-hx / e2, hz / e2, 1.0));
    `,
    vMain: `transformed.z += h0;`,
    fHead: `uniform float uTime;`,
    fColor: `
      float spk = pow(vnoise2(vWPos.xz * 14.0 + uTime * vec2(0.6, -0.4)), 22.0);
    `,
    fEnd: `gl_FragColor.a = mix(0.5, 0.93, pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 3.0));`,
    fEmissive: `totalEmissiveRadiance += vec3(1.0, 0.85, 0.6) * spk * 2.0;`,
  });
  const surf = mesh(new THREE.PlaneGeometry(2 * X - 0.03, ZF - ZB - 0.02, 90, 90), waterMat, { cast: false });
  surf.rotation.x = -Math.PI / 2; surf.position.set(0, -1, (ZF + ZB) / 2);
  surf.renderOrder = 101; surf.visible = false; scene.add(surf);
  // front face of the water volume (the "aquarium" cut)
  const faceMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { ...U, uLevel: U.uWater, uFloor: { value: -D } },
    vertexShader: `
      ${GLSL_NOISE}
      ${WAVES}
      uniform float uLevel; uniform float uFloor; varying vec3 vP; varying float vTop;
      void main(){
        vec3 p = position; // x in [-X,X], y in [0,1]
        float y = mix(uFloor, uLevel, p.y);
        vec2 wp2 = vec2(p.x, ${(ZF - (ZF + ZB) / 2).toFixed(4)});
        if (p.y > 0.5) y += waveH(wp2);
        vP = vec3(p.x, y, ${(ZF + 0.006).toFixed(4)}); vTop = p.y;
        gl_Position = projectionMatrix * viewMatrix * vec4(vP, 1.0);
      }`,
    fragmentShader: `
      ${GLSL_NOISE}
      uniform float uTime; uniform float uLevel; uniform float uFloor; varying vec3 vP; varying float vTop;
      void main(){
        float depth = clamp((uLevel - vP.y) / 1.6, 0.0, 1.0);
        vec3 shallow = vec3(0.30, 0.85, 1.0), deep = vec3(0.02, 0.30, 0.62);
        vec3 c = mix(shallow, deep, smoothstep(0.0, 1.0, depth));
        float a = mix(0.32, 0.6, depth);
        // light shafts and caustic bands
        float shaft = pow(vnoise2(vec2(vP.x * 2.2 + vP.y * 0.6 + uTime * 0.25, uTime * 0.15)), 3.0);
        float caus = causticPattern(vec2(vP.x * 0.4, vP.y * 0.25) + vec2(uTime * 0.01, 0.0), uTime * 0.6);
        c += vec3(0.8, 0.95, 1.0) * (shaft * 0.35 * (1.0 - depth) + caus * 0.25 * (1.0 - depth * 0.7));
        // bubbles
        vec2 bq = vec2(vP.x * 9.0, vP.y * 9.0 - uTime * 1.6);
        vec4 vb = voronoi2(bq);
        float bub = step(vb.y, 0.05) * smoothstep(0.16, 0.1, vb.x) * smoothstep(0.08, 0.13, vb.x);
        c += vec3(0.9, 1.0, 1.0) * bub * 0.9; a += bub * 0.3;
        // meniscus highlight at the top edge
        float topD = (uLevel + 0.03 - vP.y);
        float men = smoothstep(0.05, 0.0, abs(vTop - 1.0) * 1.0) ;
        c += vec3(1.0, 0.97, 0.9) * men * 1.4; a = max(a, men * 0.85);
        gl_FragColor = vec4(c, a);
      }`,
  });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(2 * X - 0.03, 1, 120, 1).translate(0, 0.5, 0), faceMat);
  face.frustumCulled = false; face.renderOrder = 100; face.visible = false; scene.add(face);
  W.water = { surf, face, faceMat };
}

// ---------- per-frame world update ----------
export function updateWorld(W, s, t) {
  U.uTime.value = t;
  const hb = s.hole;
  U.uHoleBox.value.set(hb.x0, hb.x1, hb.zb, hb.d);
  U.uHoleZf.value = hb.zf;
  U.uHoleOn.value = hb.on ? 1 : 0;
  U.uRough.value.set(...s.rough);
  U.uShellOn.value.set(...s.shellOn);
  rebuildHole(W, s);
  // slabs
  W.slabs.forEach((sl, i) => {
    const k = s.slabK[i];
    sl.m.visible = k > 0;
    const e = easeOutBack(k, 2.4);
    sl.m.position.copy(sl.base).addScaledVector(sl.from, 1 - e);
  });
  // tiles
  {
    const { mesh: tm, list } = W.tiles; const d = new THREE.Object3D();
    const tp = s.tileK; // 0..1 sweep progress
    for (let i = 0; i < list.length; i++) {
      const tl = list[i];
      const k = clamp((tp * 1.25 - tl.k) / 0.25);
      const e = easeOutBack(k, 2.6);
      d.position.set(tl.p[0] + tl.n[0] * (1 - e) * 0.25, tl.p[1] + tl.n[1] * (1 - e) * 0.25, tl.p[2] + tl.n[2] * (1 - e) * 0.25);
      d.rotation.set(...tl.rot);
      const sc = k <= 0 ? 0 : Math.max(0.001, e);
      d.scale.set(sc, sc, sc);
      d.updateMatrix(); tm.setMatrixAt(i, d.matrix);
    }
    tm.instanceMatrix.needsUpdate = true;
    tm.visible = tp > 0;
  }
  // coping
  W.cope.forEach((c) => {
    const k = clamp((s.copeK * 1.3 - c.k) / 0.3);
    c.m.visible = k > 0;
    const e = easeOutBack(k, 2.4);
    c.m.position.set(c.base.x, c.base.y + (1 - e) * 0.4, c.base.z);
    c.m.scale.setScalar(Math.max(0.001, e));
  });
  U.uCoping.value = s.copeK > 0.98 ? 1 : 0;
  // ladder
  W.ladder.visible = s.ladderK > 0;
  W.ladder.scale.setScalar(Math.max(0.001, easeOutBack(s.ladderK, 2.2)));
  // water
  const wl = s.water;
  U.uWater.value = wl.level;
  U.uWaterOn.value = wl.on ? 1 : 0;
  W.water.surf.visible = wl.on; W.water.face.visible = wl.on;
  W.water.surf.position.y = wl.level;
  U.uSplash.value.set(...wl.splash);
  // worms wiggle
  for (const w of W.worms) {
    w.segs.forEach((sg, k) => {
      const a = k * 0.6 + t * 3.0 + w.phase;
      sg.position.set(k * 0.045 - 0.18, Math.sin(a) * 0.035, 0);
    });
  }
  U.uPush.value.set(...(s.grassPush || [0, 0, 0.001, 0]));
}

// ---------- CPU hole geometry (mirrors holeDisp() in GLSL) ----------
const fract = (x) => x - Math.floor(x);
function hash12(px, py) {
  let x = fract(px * 0.1031), y = fract(py * 0.1031), z = fract(px * 0.1031);
  const d = x * (y + 33.33) + y * (z + 33.33) + z * (x + 33.33);
  x += d; y += d; z += d;
  return fract((x + y) * z);
}
function vnoise2(px, py) {
  const ix = Math.floor(px), iy = Math.floor(py), fx = px - ix, fy = py - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash12(ix, iy), b = hash12(ix + 1, iy), c = hash12(ix, iy + 1), d = hash12(ix + 1, iy + 1);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uy);
}
export function holeDisp(a, b, r) {
  return ((vnoise2(a * 4.5, b * 4.5) - 0.5) * 0.9 + (vnoise2(a * 11 + 3.7, b * 11 + 3.7) - 0.5) * 0.35) * 0.22 * r;
}

function shapeGeo(outer, holes = []) {
  const sh = new THREE.Shape(outer.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const h of holes) sh.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
  return new THREE.ShapeGeometry(sh, 1);
}

function rebuildHole(W, s) {
  const hb = s.hole; const [rL, rR, rB, rF] = s.rough; const so = s.shellOn;
  const N = 40, ZF = C.zF, SH = C.shell;
  const open = hb.on && hb.zf >= ZF - 0.001;
  const lx = (z, y) => hb.x0 - holeDisp(z, y, rL);
  const rx = (z, y) => hb.x1 + holeDisp(z + 11, y, rR);
  const bz = (x, y) => hb.zb - holeDisp(x + 23, y, rB);
  const fy = (x, z) => -hb.d + holeDisp(x + 5, z + 5, rF) * 0.5;
  // front cut face with a U-shaped notch when the hole reaches it
  {
    const pts = [[-13, 0]];
    if (open) {
      const xl = (y) => (so[0] > 0.5 ? Math.min(lx(ZF, y), hb.x0 - SH) : lx(ZF, y));
      const xr = (y) => (so[1] > 0.5 ? Math.max(rx(ZF, y), hb.x1 + SH) : rx(ZF, y));
      const yb = (x) => (so[3] > 0.5 ? Math.min(fy(x, ZF), -hb.d - SH) : fy(x, ZF));
      const ybot = Math.min(yb(hb.x0), yb(hb.x1));
      for (let i = 0; i <= N; i++) { const y = lerp(0, ybot * 0.999, i / N); pts.push([xl(y), y]); }
      for (let i = 1; i < N; i++) { const x = lerp(xl(ybot), xr(ybot), i / N); pts.push([x, yb(x)]); }
      for (let i = N; i >= 0; i--) { const y = lerp(0, ybot * 0.999, i / N); pts.push([xr(y), y]); }
    }
    pts.push([13, 0], [13, -9], [-13, -9]);
    W.front.geometry.dispose();
    const g = shapeGeo(pts.reverse());
    g.translate(0, 0, ZF);
    W.front.geometry = g;
  }
  // lawn top with the hole opening (shape in x / -z)
  {
    const z0 = C.fenceZ - 0.1, z1 = ZF;
    const outer = [[-13, -z1], [13, -z1], [13, -z0], [-13, -z0]];
    let geo;
    if (!hb.on) geo = shapeGeo(outer);
    else {
      const ring = [];
      const zf = Math.min(hb.zf, ZF);
      for (let i = 0; i <= N; i++) { const z = lerp(zf, hb.zb, i / N); ring.push([lx(z, 0), -z]); }
      for (let i = 1; i < N; i++) { const x = lerp(hb.x0, hb.x1, i / N); ring.push([x, -bz(x, 0)]); }
      for (let i = 0; i <= N; i++) { const z = lerp(hb.zb, zf, i / N); ring.push([rx(z, 0), -z]); }
      if (open) {
        // notch: walk the outer edge and dip into the hole at the front
        const pts = [[-13, -z1], ...ring.slice().reverse().map(([x, y]) => [x, y]).reverse(), [13, -z1], [13, -z0], [-13, -z0]];
        geo = shapeGeo(pts);
      } else {
        for (let i = 1; i < N; i++) { const x = lerp(hb.x1, hb.x0, i / N); ring.push([x, -zf]); }
        geo = shapeGeo(outer, [ring.reverse()]);
      }
    }
    geo.rotateX(-Math.PI / 2);
    W.lawn.geometry.dispose();
    W.lawn.geometry = geo;
  }
  // walls
  const zf = Math.min(hb.zf, ZF);
  W.walls.forEach((w, type) => {
    let vis = hb.on;
    if (type === 4) vis = vis && !open;
    if (type < 4 && so[type] > 0.5) vis = false;
    w.visible = vis;
    if (!vis) return;
    const p = w.geometry.attributes.position;
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const u = i / N, v = 1 - j / N; const idx = j * (N + 1) + i;
      let x, y, z;
      if (type === 0) { z = lerp(zf, hb.zb, u); y = lerp(-hb.d, 0, v); x = lx(z, y); }
      else if (type === 1) { z = lerp(hb.zb, zf, u); y = lerp(-hb.d, 0, v); x = rx(z, y); }
      else if (type === 2) { x = lerp(hb.x0, hb.x1, u); y = lerp(-hb.d, 0, v); z = bz(x, y); }
      else if (type === 3) { x = lerp(hb.x0, hb.x1, u); z = lerp(zf, hb.zb, v); y = fy(x, z); }
      else { x = lerp(hb.x1, hb.x0, u); y = lerp(-hb.d, 0, v); z = zf; }
      p.setXYZ(idx, x, y, z);
    }
    p.needsUpdate = true;
    w.geometry.computeVertexNormals();
    w.geometry.computeBoundingSphere();
  });
}
