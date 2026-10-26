// The cut-open glacier: a slab of see-through blue ice sliced at z=0, a deep narrow
// crevasse at x~0, snow on top, white frost rim along the crack edges, Max's ledge,
// and glowing "deep ice" backdrops inside the slab that the transmission samples.
import * as THREE from 'three';
import { GLSL_NOISE, lerp, smoothstep, noise1, fbm1 } from '../util.js';

export const LEDGE_Y = -40;
export const CRACK_BOTTOM = -135;
export const SLAB_X = 60;        // half width of the visible slab
export const CRACK_DEPTH_Z = 46; // how far the crevasse runs back into the glacier

export function crackCenter(y) {
  return 0.22 * Math.sin(y * 0.083 + 0.4) + 0.12 * Math.sin(y * 0.21 + 2.0) - 0.06;
}
export function crackHalf(y) {
  let w;
  if (y > LEDGE_Y) w = lerp(0.74, 1.7, Math.pow(smoothstep(LEDGE_Y, 0, y), 1.2));
  else w = lerp(0.74, 0.5, smoothstep(LEDGE_Y, CRACK_BOTTOM, y));
  w += 0.07 * fbm1(y * 0.35, 3) + 0.03 * noise1(y * 2.1, 9);
  return w;
}
// wall x at height y and depth z (side -1 left, +1 right); walls wobble a bit with z
export function wallX(side, y, z = 0) {
  return crackCenter(y) + side * (crackHalf(y) + 0.06 * fbm1(z * 0.45 + y * 0.12, side > 0 ? 21 : 37)) ;
}
export function snowTop(x) {
  return 0.0 + 0.18 * fbm1(x * 0.07, 5) + 0.06 * noise1(x * 0.5, 2);
}
export const SNOW_DEPTH = 1.1;

// ---------------------------------------------------------------- ice material
export function createIceMaterial(tex, env, opts = {}) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0.8, 0.95, 1.0),
    roughness: opts.roughness ?? 0.32,
    metalness: 0,
    transmission: 1,
    thickness: opts.thickness ?? 0.9,
    ior: 1.31,
    attenuationColor: new THREE.Color(0.22, 0.62, 0.9),
    attenuationDistance: opts.attenuationDistance ?? 1.6,
    specularIntensity: 1,
    envMap: env,
    envMapIntensity: opts.envMapIntensity ?? 0.6,
    side: THREE.FrontSide,
  });
  const u = {
    tIce: { value: tex.ice },
    uCrackAmt: { value: opts.crackAmt ?? 1 },
    uFrostAmt: { value: opts.frostAmt ?? 1 },
    uGlow: { value: opts.glow ?? 0.0 },
    uDeep: { value: 1.0 },
    uWarmPos: { value: new THREE.Vector3(0, -1000, 0) },   // headlamp hit point (adds warm scattering glow)
    uWarmCol: { value: new THREE.Vector3(0, 0, 0) },
    uWarmRad: { value: 0.6 },
    uHandPos: { value: new THREE.Vector3(0, -1000, 0) },   // day-4 crack spread origin
    uHandCrack: { value: 0 },
    uFrostCol: { value: new THREE.Vector3(0.62, 0.78, 0.95) },
  };
  mat.userData.u = u;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vIceW; varying vec3 vIceN;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvIceW = (modelMatrix * vec4(transformed,1.0)).xyz; vIceN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vIceW; varying vec3 vIceN;
        uniform sampler2D tIce; uniform float uCrackAmt, uFrostAmt, uGlow, uDeep, uWarmRad, uHandCrack;
        uniform vec3 uWarmPos, uWarmCol, uHandPos, uFrostCol;
        ${GLSL_NOISE}
        float iceCrack, iceBub, iceCloud, iceFrost;
        vec3 iceTint(float y){
          float d = clamp(-y/110., 0., 1.);
          vec3 top = vec3(0.86, 0.97, 1.0), mid = vec3(0.45, 0.82, 0.98), deep = vec3(0.12, 0.55, 0.72);
          return d < 0.38 ? mix(top, mid, d/0.38) : mix(mid, deep, (d-0.38)/0.62);
        }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          vec3 an = abs(vIceN);
          vec2 p = an.z > 0.5 ? vIceW.xy : (an.x > 0.5 ? vIceW.zy : vIceW.xz);
          vec4 A = texture2D(tIce, p / 61.0);
          vec4 B = texture2D(tIce, p / 13.0 + 0.37);
          vec4 C = texture2D(tIce, p / 3.1 + 0.71);
          iceCrack = max(max(A.r, B.r*0.8), C.r*0.55) * uCrackAmt;
          iceBub = max(B.g*0.7, C.g) ;
          iceCloud = A.b*0.6 + B.b*0.4;
          iceFrost = mix(B.a, C.a, 0.5) * uFrostAmt;
          // day-4: hairline cracks radiating from the hand print
          if (uHandCrack > 0.0) {
            vec3 dp = vIceW - uHandPos;
            float r = length(dp);
            float ang = atan(dp.y, an.x > 0.5 ? dp.z : dp.x);
            float rays = pow(abs(sin(ang*7.0 + fbm(vec2(ang*3.0, r*4.0))*2.5)), 30.0);
            float lines = rays * smoothstep(uHandCrack, uHandCrack*0.6, r) * smoothstep(0.02, 0.06, r);
            float web = (1.0 - smoothstep(0.0, 0.015, abs(sin(r*55.0 + fbm(vec2(ang*6., r*9.))*3.)))) * smoothstep(uHandCrack*0.8, 0., r) * 0.6 * step(0.5, fbm(vec2(ang*5., r*3.)));
            iceCrack = max(iceCrack, clamp(lines + web, 0., 1.));
          }
          vec3 tint = iceTint(vIceW.y) * mix(1.0, 0.82 + 0.36*iceCloud, 0.7);
          diffuseColor.rgb *= mix(vec3(1.0), tint, uDeep);
          diffuseColor.rgb = mix(diffuseColor.rgb, uFrostCol, clamp(iceCrack*0.9 + iceBub*0.6 + iceFrost*0.12, 0., 1.));
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + iceFrost*0.22 + iceCrack*0.25, 0.05, 1.0);`)
      .replace('#include <transmission_fragment>', `
        #include <transmission_fragment>
        `)
      .replace('material.transmission = transmission;', 'material.transmission = transmission * (1.0 - clamp(iceCrack*0.85 + iceBub*0.55 + iceFrost*0.1, 0., 0.95));')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          totalEmissiveRadiance += uFrostCol * (iceCrack*0.5 + iceBub*0.25) * uGlow;
          float wd = length(vIceW - uWarmPos);
          totalEmissiveRadiance += uWarmCol * exp(-wd*wd/(uWarmRad*uWarmRad)) * (0.35 + iceCrack*1.5 + iceBub*0.8);
        }`);
  };
  mat.customProgramCacheKey = () => 'ice-v1';
  return mat;
}

// glowing interior of the ice (what you see through it). Lit material + emissive depth gradient.
export function createDeepMaterial() {
  const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.35, 0.6, 0.75), roughness: 1, metalness: 0 });
  const u = {
    uTopCol: { value: new THREE.Vector3(0.1, 0.32, 0.55) },
    uMidCol: { value: new THREE.Vector3(0.02, 0.11, 0.24) },
    uDeepCol: { value: new THREE.Vector3(0.0, 0.015, 0.035) },
    uGlowAmt: { value: 1 },
  };
  mat.userData.u = u;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vDW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvDW = (modelMatrix * vec4(transformed,1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vDW; uniform vec3 uTopCol, uMidCol, uDeepCol; uniform float uGlowAmt;\n' + GLSL_NOISE)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          float y = vDW.y;
          vec3 g = y > -35. ? mix(uMidCol, uTopCol, smoothstep(-35., -1., y)) : mix(uDeepCol, uMidCol, smoothstep(-115., -35., y));
          float n = fbm(vDW.xy*0.08 + vDW.z*0.06) ;
          float shafts = pow(fbm(vec2(vDW.x*0.05 + vDW.z*0.05, 3.0)), 3.0) * smoothstep(-60., 0., y);
          totalEmissiveRadiance += g * (0.6 + 0.8*n + shafts*1.5) * uGlowAmt;
        }`);
  };
  mat.customProgramCacheKey = () => 'deep-v1';
  return mat;
}

export function createSnowMaterial(tex, opts = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(opts.color ?? 0xdde8f4),
    roughness: 0.92,
    metalness: 0,
  });
  const u = { tSnow: { value: tex.snow }, uSparkle: { value: opts.sparkle ?? 1.0 }, uScale: { value: opts.scale ?? 6.0 } };
  mat.userData.u = u;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSW; varying vec3 vSN;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvSW = (modelMatrix * vec4(transformed,1.0)).xyz; vSN = normalize(mat3(modelMatrix)*objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSW; varying vec3 vSN; uniform sampler2D tSnow; uniform float uSparkle, uScale;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec3 sn = abs(vSN);
        vec2 sp = sn.y > 0.5 ? vSW.xz : (sn.z > 0.5 ? vSW.xy : vSW.zy);
        vec4 S = texture2D(tSnow, sp / uScale);
        vec4 S2 = texture2D(tSnow, sp / (uScale*7.0));
        diffuseColor.rgb *= 0.86 + 0.18*S.r + 0.1*S2.g;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(0.8,0.9,1.0) * S.b * uSparkle * 0.6;`);
  };
  mat.customProgramCacheKey = () => 'snow-v1';
  return mat;
}

// ---------------------------------------------------------------- geometry helpers
function gridGeometry(nu, nv, fn) {
  // fn(u, v) -> [x,y,z]; u,v in [0,1]
  const pos = new Float32Array((nu + 1) * (nv + 1) * 3);
  let k = 0;
  for (let j = 0; j <= nv; j++)
    for (let i = 0; i <= nu; i++) {
      const p = fn(i / nu, j / nv);
      pos[k++] = p[0]; pos[k++] = p[1]; pos[k++] = p[2];
    }
  const idx = [];
  for (let j = 0; j < nv; j++)
    for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// non-uniform y distribution: dense near the top and near the ledge
function yAt(v, yTop, yBot) {
  const t = Math.pow(v, 1.35);
  return lerp(yTop, yBot, t);
}

export function createGlacier(tex, env) {
  const group = new THREE.Group();
  const ice = createIceMaterial(tex, env);
  const wallIce = createIceMaterial(tex, env, { roughness: 0.38, envMapIntensity: 0.9 });
  const deep = createDeepMaterial();
  const snow = createSnowMaterial(tex);
  const snowCut = createSnowMaterial(tex, { color: 0xc9d8e8, sparkle: 0.3, scale: 3 });
  const frost = new THREE.MeshStandardMaterial({ color: 0xf2f8ff, roughness: 0.85, emissive: new THREE.Color(0.12, 0.16, 0.22) });

  const NV = 300;
  // -------- cut face (z=0), left and right of the crack, from below the snow down to the bottom
  for (const side of [-1, 1]) {
    const g = gridGeometry(70, NV, (u, v) => {
      const y = yAt(v, -SNOW_DEPTH + 0.05, CRACK_BOTTOM - 20);
      const inner = wallX(side, Math.max(y, CRACK_BOTTOM), 0);
      const t = Math.pow(u, 2.2);
      const x = lerp(inner, side * SLAB_X, t);
      return [x, y, 0];
    });
    if (side < 0) {
      // flip winding so the face points to +z
      const ix = g.index.array;
      for (let i = 0; i < ix.length; i += 3) { const tmp = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = tmp; }
      g.computeVertexNormals();
    }
    const m = new THREE.Mesh(g, ice);
    m.name = 'cutface' + side;
    group.add(m);
  }
  // -------- snow layer cross-section on the cut face (white band), and the snow top surface
  for (const side of [-1, 1]) {
    const g = gridGeometry(120, 6, (u, v) => {
      const t = Math.pow(u, 1.8);
      const inner = wallX(side, -0.3, 0) + side * 0.02;
      const x = lerp(inner, side * SLAB_X, t);
      const top = snowTop(x);
      // rounded lip into the crack
      const lip = smoothstep(0.0, 0.5, Math.abs(x - inner));
      const yTopEdge = top - (1 - lip) * 0.25;
      const y = lerp(-SNOW_DEPTH, yTopEdge, v);
      return [x, y, 0.001];
    });
    if (side < 0) {
      const ix = g.index.array;
      for (let i = 0; i < ix.length; i += 3) { const tmp = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = tmp; }
      g.computeVertexNormals();
    }
    group.add(new THREE.Mesh(g, snowCut));
    // top surface strip from the cut back along the crack
    const gt = gridGeometry(80, 40, (u, v) => {
      const z = -v * (CRACK_DEPTH_Z + 4);
      const inner = wallX(side, -0.3, z) * (1 - smoothstep(CRACK_DEPTH_Z - 10, CRACK_DEPTH_Z, -z) * 1.0);
      const t = Math.pow(u, 1.8);
      const x = lerp(inner, side * SLAB_X * 3, t);
      const lip = smoothstep(0.0, 0.5, Math.abs(x - inner));
      return [x, snowTop(x) + 0.1 * fbm1(z * 0.2 + x * 0.1, 11) - (1 - lip) * 0.25, z];
    });
    if (side > 0) {
      const ix = gt.index.array;
      for (let i = 0; i < ix.length; i += 3) { const tmp = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = tmp; }
      gt.computeVertexNormals();
    }
    group.add(new THREE.Mesh(gt, snow));
  }
  // far snowfield (behind the end of the crack) rolling up to the mountains
  const far = gridGeometry(60, 60, (u, v) => {
    const x = lerp(-SLAB_X * 6, SLAB_X * 6, u);
    const z = lerp(-CRACK_DEPTH_Z - 2, -420, Math.pow(v, 1.5));
    const y = snowTop(x) + 0.15 * fbm1(z * 0.05, 4) + Math.pow(Math.max(0, (-z - 60) / 360), 2) * 40 + 8 * fbm1(x * 0.01 + z * 0.004, 8) * smoothstep(60, 200, -z);
    return [x, y, z];
  });
  {
    const ix = far.index.array;
    for (let i = 0; i < ix.length; i += 3) { const tmp = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = tmp; }
    far.computeVertexNormals();
  }
  group.add(new THREE.Mesh(far, snow));

  // -------- crack walls (facing into the void)
  const walls = [];
  for (const side of [-1, 1]) {
    const g = gridGeometry(40, NV, (u, v) => {
      const y = yAt(v, -0.05, CRACK_BOTTOM - 20);
      const z = -Math.pow(u, 1.6) * CRACK_DEPTH_Z;
      const close = smoothstep(CRACK_DEPTH_Z - 12, CRACK_DEPTH_Z, -z);
      const yy = Math.max(y, CRACK_BOTTOM);
      const x = lerp(wallX(side, yy, z), crackCenter(yy), close * 0.98);
      return [x, y, z];
    });
    if (side > 0) {
      const ix = g.index.array;
      for (let i = 0; i < ix.length; i += 3) { const tmp = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = tmp; }
      g.computeVertexNormals();
    }
    const m = new THREE.Mesh(g, wallIce);
    m.name = 'wall' + side;
    group.add(m);
    walls.push(m);
  }
  // dark floor far down (just blackness)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(6, CRACK_DEPTH_Z + 2), new THREE.MeshBasicMaterial({ color: 0x000003 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, CRACK_BOTTOM - 2, -CRACK_DEPTH_Z / 2);
  group.add(floor);

  // -------- frost rim along both crack edges on the cut face
  for (const side of [-1, 1]) {
    const pts = [];
    for (let y = -0.25; y >= CRACK_BOTTOM; y -= 0.25) pts.push(new THREE.Vector3(wallX(side, y, 0) + side * 0.015, y, 0.03));
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = new THREE.TubeGeometry(curve, pts.length * 2, 0.055, 6, false);
    // lumpy frost
    const p = tube.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const k = 1 + 0.35 * noise1(y * 3.1, side * 5) + 0.2 * noise1(y * 11.0, side * 3);
      p.setX(i, (p.getX(i) - wallX(side, y, 0) - side * 0.015) * k + wallX(side, y, 0) + side * 0.015);
      p.setZ(i, (p.getZ(i) - 0.03) * k + 0.03);
    }
    tube.computeVertexNormals();
    group.add(new THREE.Mesh(tube, frost));
  }
  // rim along the top edge of the snow cut (thin bright lip)
  for (const side of [-1, 1]) {
    const pts = [];
    const inner = wallX(side, -0.3, 0);
    for (let i = 0; i <= 200; i++) {
      const x = lerp(inner, side * SLAB_X, Math.pow(i / 200, 1.8));
      const lip = smoothstep(0.0, 0.5, Math.abs(x - inner));
      pts.push(new THREE.Vector3(x, snowTop(x) - (1 - lip) * 0.25, 0.02));
    }
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 400, 0.05, 5, false);
    group.add(new THREE.Mesh(tube, frost));
  }

  // -------- ledge (ice shelf on the left wall at LEDGE_Y)
  const ledge = createLedge(tex, env);
  group.add(ledge);

  // -------- deep-ice backdrops (only ever seen through the ice)
  const deepGroup = new THREE.Group();
  for (const side of [-1, 1]) {
    // back plane behind the cut face
    const back = new THREE.Mesh(new THREE.PlaneGeometry(SLAB_X, 170, 4, 40), deep);
    back.position.set(side * (SLAB_X / 2 + 1.6), -80, -7.5);
    deepGroup.add(back);
    // side plane behind each crack wall, facing the crack
    const sideP = new THREE.Mesh(new THREE.PlaneGeometry(CRACK_DEPTH_Z + 10, 170, 20, 40), deep);
    sideP.rotation.y = -side * Math.PI / 2;
    sideP.position.set(side * 3.4, -80, -(CRACK_DEPTH_Z + 10) / 2 + 0.5);
    deepGroup.add(sideP);
  }
  group.add(deepGroup);

  group.userData = { ice, wallIce, deep, snow, snowCut, frost, ledge, walls };
  return group;
}

function createLedge(tex, env) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x9cc6e4, roughness: 0.6, metalness: 0, envMap: env, envMapIntensity: 0.4 });
  const snowMat = new THREE.MeshStandardMaterial({ color: 0xe6eef7, roughness: 0.95 });
  const g = new THREE.Group();
  const y = LEDGE_Y;
  const x0 = wallX(-1, y, -0.8);
  // shelf body: a squashed, lumpy box sticking out of the wall
  const box = new THREE.BoxGeometry(0.75, 0.42, 1.7, 10, 4, 14);
  const p = box.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const bx = p.getX(i), by = p.getY(i), bz = p.getZ(i);
    const n = noise1(bz * 4 + bx * 3, 4) * 0.04 + noise1(bz * 9 + by * 7, 8) * 0.015;
    // taper underneath toward the wall
    const under = by < 0 ? (bx + 0.375) / 0.75 : 0;
    p.setX(i, bx - under * 0.25 * (-by / 0.21) * 0.6 + n);
    p.setY(i, by + n * 0.6);
    p.setZ(i, bz * (1 - 0.25 * Math.pow(Math.abs(by) / 0.21, 2)) + n);
  }
  box.computeVertexNormals();
  const body = new THREE.Mesh(box, mat);
  body.position.set(x0 + 0.375 - 0.06, y - 0.21, -0.82);
  g.add(body);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.04, 1.6, 6, 1, 8), snowMat);
  cap.position.set(x0 + 0.36 - 0.06, y + 0.005, -0.82);
  g.add(cap);
  g.userData = { x0, mat };
  return g;
}
