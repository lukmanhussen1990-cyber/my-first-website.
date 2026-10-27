// Instanced paper-card crowd (200+ people in one draw call). At build time every crowd variant is posed in four
// static chant frames (calm / one fist half-up / fist up / both fists up) and drawn from two views (three-quarter
// front and back) with an orthographic camera, tile by tile, into a small MSAA target; the pixels are copied into
// one atlas texture (mipmapped, anisotropic). Each instance is a cylindrical billboard (turns about Y toward the
// camera) that picks its tile in the vertex shader: front or back from where the camera stands relative to the way
// the person faces, mirrored so they turn toward their own facing, pose frame per instance (set every frame from
// JS: pumping fists, bobbing). Tinted by the mood (uCharLight), two-tone shading from the side the sun is on,
// fog, soft instanced blob shadows under every card.
import * as THREE from 'three';
import { Person } from './rig.js';
import { crowdFrame } from './poses3.js';
import { U, radialTex, OUTLINE_CHAR } from './materials.js';
import { hash01, clamp, mulberry32 } from '../lib/util.js';

const VIEWS = ['threeQuarter', 'back'];
const FRAMES = 4;
const PER_ROW = 2;                 // variants side by side in one atlas row (keeps the atlas square-ish)

export function bakeCrowdAtlas(renderer, variants, { tileW = 192, tileH = 384, outlinePx = 2.2 } = {}) {
  const nV = variants.length, perV = VIEWS.length * FRAMES;
  const cols = perV * PER_ROW, rows = Math.ceil(nV / PER_ROW);
  const W = tileW * cols, Hh = tileH * rows;
  const data = new Uint8Array(W * Hh * 4);
  // clear to the outline colour with zero alpha, so mip levels fringe toward the outline (not black)
  const oc = new THREE.Color(OUTLINE_CHAR); const oc8 = [Math.round(oc.r * 255), Math.round(oc.g * 255), Math.round(oc.b * 255)];
  for (let i = 0; i < W * Hh; i++) { data[i * 4] = oc8[0]; data[i * 4 + 1] = oc8[1]; data[i * 4 + 2] = oc8[2]; }
  const rt = new THREE.WebGLRenderTarget(tileW, tileH, { samples: 4, type: THREE.UnsignedByteType, colorSpace: THREE.SRGBColorSpace, depthBuffer: true });
  const scene = new THREE.Scene();
  const halfH = 1.08, halfW = halfH * tileW / tileH;          // a tile covers 2.16 m of height; feet sit 6 cm above its bottom
  const cam = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 50);
  cam.position.set(0, halfH - 0.06, 10); cam.lookAt(0, halfH - 0.06, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  // neutral light for the bake (restored afterwards): key from the front-top-left, no rim, no point light
  const keep = {};
  for (const k of ['uCharLight', 'uSunDir', 'uSunColor', 'uPointColor', 'uRimK', 'uAO', 'uGroundY', 'uShadeTone', 'uCelWrap']) keep[k] = U[k].value.clone ? U[k].value.clone() : U[k].value;
  U.uCharLight.value.setRGB(1, 1, 1); U.uSunDir.value.set(-0.45, 0.6, 0.66).normalize(); U.uSunColor.value.setRGB(1, 1, 1);
  U.uPointColor.value.setRGB(0, 0, 0); U.uRimK.value = 0; U.uAO.value = 0.12; U.uGroundY.value = 0;
  U.uShadeTone.value.setRGB(0.8, 0.8, 0.86); U.uCelWrap.value = 0.3;
  const prevRT = renderer.getRenderTarget(), prevClear = renderer.getClearColor(new THREE.Color()), prevA = renderer.getClearAlpha();
  const prevShadow = renderer.shadowMap.enabled; renderer.shadowMap.enabled = false;
  const tile = new Uint8Array(tileW * tileH * 4);
  const heights = [];
  variants.forEach((opts, v) => {
    const p = new Person({ ...opts, noShadow: true, noBlob: true, quality: 'crowd' });
    scene.add(p.root); heights.push(p.height);
    VIEWS.forEach((view, vi) => {
      for (let f = 0; f < FRAMES; f++) {
        p.setView(view); p.setFacing(1);
        const P = crowdFrame(f, (opts.seed ?? v) * 7 + 3);
        if (view === 'back') { P.look = 0; P.lookY = 0; }
        p.pose(P);
        p.billboard(cam, 0); p.autoOutline(cam, tileH, outlinePx);
        renderer.setRenderTarget(rt); renderer.setClearColor(oc, 0); renderer.clear(true, true, true);
        renderer.render(scene, cam);
        renderer.readRenderTargetPixels(rt, 0, 0, tileW, tileH, tile);
        const tc = (v % PER_ROW) * perV + vi * FRAMES + f, tr = Math.floor(v / PER_ROW);
        const x0 = tc * tileW, y0 = (rows - 1 - tr) * tileH;     // GL rows run bottom-up (row 0 of the atlas = bottom)
        for (let y = 0; y < tileH; y++) {
          const src = y * tileW * 4, dst = ((y0 + y) * W + x0) * 4;
          for (let x = 0; x < tileW * 4; x += 4) {
            const a = tile[src + x + 3];
            if (a === 0) continue;
            data[dst + x] = tile[src + x]; data[dst + x + 1] = tile[src + x + 1]; data[dst + x + 2] = tile[src + x + 2]; data[dst + x + 3] = a;
          }
        }
      }
    });
    scene.remove(p.root);
  });
  rt.dispose();
  renderer.setRenderTarget(prevRT); renderer.setClearColor(prevClear, prevA); renderer.shadowMap.enabled = prevShadow;
  for (const [k, v] of Object.entries(keep)) { if (U[k].value && U[k].value.copy) U[k].value.copy(v); else U[k].value = v; }
  const tex = new THREE.DataTexture(data, W, Hh, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.colorSpace = THREE.SRGBColorSpace; tex.flipY = false; tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.anisotropy = 4; tex.needsUpdate = true;
  return { tex, data, W, H: Hh, tileW, tileH, cols, rows, perV, halfW, halfH, heights, nV };
}

// The instanced crowd. people: [{ x, z, face (yaw the person faces, rad), v (variant), s (scale), seed }]
export function makeCrowd(atlas, people) {
  const n = people.length;
  const base = new THREE.PlaneGeometry(2 * atlas.halfW, 2 * atlas.halfH);
  base.translate(0, atlas.halfH - 0.06, 0);                    // feet (bake margin) on y = 0
  const ig = new THREE.InstancedBufferGeometry(); ig.index = base.index;
  for (const k of ['position', 'uv', 'normal']) ig.setAttribute(k, base.attributes[k]);
  ig.instanceCount = n;
  const aCell = new Float32Array(n * 2), aFace = new Float32Array(n), aSeed = new Float32Array(n), aPose = new Float32Array(n), aTint = new Float32Array(n * 3);
  const mat = new THREE.MeshBasicMaterial({ map: atlas.tex, alphaTest: 0.5, side: THREE.DoubleSide, fog: true, alphaToCoverage: true });
  const uni = { uCols: { value: atlas.cols }, uRows: { value: atlas.rows }, uFrames: { value: FRAMES }, uFogK: { value: 1 }, uLift: { value: 0 } };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni);
    for (const k of ['uCharLight', 'uSunDir', 'uShadeTone']) sh.uniforms[k] = U[k];
    sh.vertexShader = `attribute vec2 aCell; attribute float aFace; attribute float aSeed; attribute float aPose; attribute vec3 aTint;
uniform float uCols; uniform float uRows; uniform float uFrames; uniform vec3 uSunDir;
varying vec3 vTintC; varying float vSide;\n` + sh.vertexShader
      .replace('#include <begin_vertex>', `
  vec3 transformed = vec3(position);
  vec4 org = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  vec2 toC = cameraPosition.xz - org.xz; float lc = length(toC); toC = lc > 1e-4 ? toC / lc : vec2(0.0, 1.0);
  vec2 fw = vec2(sin(aFace), cos(aFace));
  float front = dot(fw, toC);
  float sideC = fw.x * toC.y - fw.y * toC.x;
  float view = front > -0.2 ? 0.0 : 1.0;
  float mir = view < 0.5 ? (sideC > 0.0 ? 1.0 : -1.0) : (fract(aSeed * 7.31) > 0.5 ? 1.0 : -1.0);
  vec2 rgt = vec2(toC.y, -toC.x);
  float sc = length((instanceMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
  vec3 wp = org.xyz + vec3(rgt.x, 0.0, rgt.y) * position.x * sc + vec3(0.0, position.y * sc, 0.0);
  float col = aCell.x + view * uFrames + aPose;
  vec2 tuv = vec2(mir > 0.0 ? uv.x : 1.0 - uv.x, uv.y);
  vMapUv = vec2((col + clamp(tuv.x, 0.004, 0.996)) / uCols, (uRows - 1.0 - aCell.y + clamp(tuv.y, 0.004, 0.996)) / uRows);
  vTintC = aTint;
  vSide = dot(normalize(vec3(toC.x, 0.0, toC.y)), normalize(vec3(uSunDir.x, 0.0, uSunDir.z) + vec3(1e-4)));
`)
      .replace('#include <project_vertex>', `
  vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
  gl_Position = projectionMatrix * mvPosition;`)
      .replace('#include <worldpos_vertex>', '');
    sh.fragmentShader = `uniform vec3 uCharLight; uniform vec3 uShadeTone; uniform float uFogK; uniform float uLift;
varying vec3 vTintC; varying float vSide;\n` + sh.fragmentShader
      .replace('#include <opaque_fragment>', `
  {
    float lit = smoothstep(-0.35, 0.25, vSide);
    vec3 shade = mix(uShadeTone * 0.9, vec3(1.0), lit);
    outgoingLight = outgoingLight * vTintC * uCharLight * shade + uLift;
  }
  #include <opaque_fragment>`)
      .replace('#include <fog_fragment>', `
  #ifdef USE_FOG
    float fogFactor = smoothstep( fogNear, fogFar, vFogDepth ) * uFogK;
    gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
  #endif`);
  };
  mat.customProgramCacheKey = () => 'crowdCards3';
  const face = new THREE.InstancedBufferAttribute(aFace, 1), pose = new THREE.InstancedBufferAttribute(aPose, 1);
  pose.setUsage(THREE.DynamicDrawUsage); face.setUsage(THREE.DynamicDrawUsage);
  ig.setAttribute('aCell', new THREE.InstancedBufferAttribute(aCell, 2)); ig.setAttribute('aFace', face);
  ig.setAttribute('aSeed', new THREE.InstancedBufferAttribute(aSeed, 1)); ig.setAttribute('aPose', pose); ig.setAttribute('aTint', new THREE.InstancedBufferAttribute(aTint, 3));
  const mesh = new THREE.InstancedMesh(ig, mat, n);
  mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = false;
  const blobGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const blobMat = new THREE.MeshBasicMaterial({ map: radialTex(), color: '#1a120a', transparent: true, opacity: 0.42, depthWrite: false, fog: true });
  const blobs = new THREE.InstancedMesh(blobGeo, blobMat, n); blobs.renderOrder = -1; blobs.frustumCulled = false;
  const group = new THREE.Group(); group.add(blobs, mesh);
  people.forEach((P, i) => {
    const v = P.v % atlas.nV;
    aCell[i * 2] = (v % PER_ROW) * atlas.perV; aCell[i * 2 + 1] = Math.floor(v / PER_ROW);
    aFace[i] = P.face; aSeed[i] = P.seed ?? hash01(i, 5);
    const k = 0.84 + 0.26 * hash01(i, 6); aTint[i * 3] = k; aTint[i * 3 + 1] = k * (0.98 + 0.04 * hash01(i, 7)); aTint[i * 3 + 2] = k * (0.96 + 0.05 * hash01(i, 8));
  });
  const state = people.map((P) => ({ ...P, x0: P.x, z0: P.z, face0: P.face }));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3();
  // every frame: fn(i, person, t) -> { x?, z?, y?, pose?, face?, visible? }
  function set(t, fn) {
    let fc = false;
    for (let i = 0; i < n; i++) {
      const P = state[i];
      const r = fn ? fn(i, P, t) || {} : {};
      const x = r.x ?? P.x0, z = r.z ?? P.z0, y = r.y ?? 0, sc = P.s ?? 1, vis = r.visible ?? true;
      p3.set(x, y, z); s3.setScalar(vis ? sc : 0);
      mesh.setMatrixAt(i, m4.compose(p3, q, s3));
      p3.set(x, 0.012, z); s3.set(vis ? 0.62 * sc : 0, 1, vis ? 0.34 * sc : 0);
      blobs.setMatrixAt(i, m4.compose(p3, q, s3));
      aPose[i] = clamp(Math.round(r.pose ?? 0), 0, FRAMES - 1);
      const f = r.face ?? P.face0; if (f !== aFace[i]) { aFace[i] = f; fc = true; }
    }
    mesh.instanceMatrix.needsUpdate = true; blobs.instanceMatrix.needsUpdate = true; pose.needsUpdate = true; if (fc) face.needsUpdate = true;
  }
  return { group, mesh, blobs, set, state, uni, n };
}

// A jittered crowd filling a box [x0, z0, x1, z1] (people / m2), skipping holes; everyone faces lookAt [x, z]
// with a little random spread. variants: how many atlas variants to draw from.
export function crowdLayout({ box, density = 0.9, seed = 7, skip = null, lookAt = [0, 0], variants = 16, spacing = 0.6, spread = 0.7 } = {}) {
  const [x0, z0, x1, z1] = box; const R = mulberry32(seed);
  const out = [];
  const cell = Math.sqrt(1 / density);
  for (let z = z0; z < z1; z += cell) for (let x = x0; x < x1; x += cell) {
    const px = x + (R() - 0.5) * cell * 0.9, pz = z + (R() - 0.5) * cell * 0.9;
    if (skip && skip(px, pz)) continue;
    let near = false; for (const o of out) if (Math.abs(o.x - px) < spacing && Math.abs(o.z - pz) < spacing && Math.hypot(o.x - px, o.z - pz) < spacing) { near = true; break; }
    if (near) continue;
    const face = Math.atan2(lookAt[0] - px, lookAt[1] - pz) + (R() - 0.5) * spread;
    out.push({ x: px, z: pz, face, v: Math.floor(R() * variants), s: 0.93 + 0.14 * R(), seed: R() });
  }
  return out;
}
