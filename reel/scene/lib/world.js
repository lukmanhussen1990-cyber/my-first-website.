// The backyard diorama: sky, lights, cutaway ground, lawn + grass, house, fence, doghouse, trees.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from './util.js';
import {
  U, lin, makeSoilMaterial, makeLawnMaterial, makeGrass, woodTextures, sidingTexture, shingleTexture,
  barkTexture, radialTexture, GLSL_NOISE,
} from './materials.js';

export const SUN_DIR = new THREE.Vector3(-0.62, 0.36, 0.70).normalize();
export const HOUSE_Z = -6.6;   // front facade of the house
export const FENCE_X = 1.95;
export const DOOR_POS = new THREE.Vector3(-1.9, 0, HOUSE_Z);

function std(color, rough = 0.6, metal = 0, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
}

// ---------------------------------------------------------------- SKY
export function makeSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTime: U.uTime },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vDir; uniform float uTime; ${GLSL_NOISE}
      void main(){
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 zen = vec3(0.10, 0.17, 0.42);
        vec3 mid = vec3(0.55, 0.42, 0.62);
        vec3 low = vec3(1.25, 0.62, 0.36);
        vec3 hor = vec3(1.6, 0.95, 0.45);
        vec3 c = mix(hor, low, smoothstep(0.0, 0.08, h));
        c = mix(c, mid, smoothstep(0.06, 0.28, h));
        c = mix(c, zen, smoothstep(0.25, 0.75, h));
        // warm glow toward the low sun (to the left)
        vec3 sd = normalize(vec3(-0.92, 0.10, -0.25));
        float g = max(dot(d, sd), 0.0);
        c += vec3(1.5, 0.75, 0.30) * pow(g, 6.0) * 0.9 + vec3(1.0, 0.55, 0.25) * pow(g, 2.0) * 0.25;
        // stylized clouds
        vec2 cp = d.xz / max(d.y + 0.18, 0.05);
        float cl = fbm(cp * 0.55 + vec2(uTime*0.01, 0.0));
        float cm = smoothstep(0.52, 0.72, cl) * smoothstep(0.02, 0.12, h) * (1.0 - smoothstep(0.35, 0.6, h));
        vec3 cc = mix(vec3(1.25, 0.62, 0.48), vec3(1.6, 0.95, 0.70), smoothstep(0.55, 0.8, cl));
        cc = mix(cc, cc*1.35, pow(g, 3.0));
        c = mix(c, cc, cm * 0.85);
        gl_FragColor = vec4(c * 0.92, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(90, 48, 24), mat);
  m.frustumCulled = false; m.renderOrder = -10;
  return m;
}

export function makeEnvironment(renderer) {
  const s = new THREE.Scene();
  s.add(makeSky());
  const ground = new THREE.Mesh(new THREE.SphereGeometry(80, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.10, 0.13, 0.05), side: THREE.BackSide }));
  s.add(ground);
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(s, 0.02, 0.1, 200);
  pm.dispose();
  return rt.texture;
}

// ---------------------------------------------------------------- LIGHTS
export function makeLights(scene) {
  const sun = new THREE.DirectionalLight(new THREE.Color(1.0, 0.76, 0.52), 3.4);
  sun.position.copy(SUN_DIR).multiplyScalar(30);
  sun.target.position.set(0, 0, -1.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const sc = sun.shadow.camera; sc.left = -9; sc.right = 9; sc.top = 9; sc.bottom = -9; sc.near = 5; sc.far = 70;
  sun.shadow.bias = -0.00025; sun.shadow.normalBias = 0.02; sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(new THREE.Color(0.55, 0.62, 0.95), new THREE.Color(0.42, 0.30, 0.16), 0.75);
  scene.add(hemi);
  const fill = new THREE.DirectionalLight(new THREE.Color(0.75, 0.82, 1.0), 0.55);
  fill.position.set(6, 3, 8); scene.add(fill);
  const rim = new THREE.DirectionalLight(new THREE.Color(1.0, 0.62, 0.45), 1.6);
  rim.position.set(4, 5, -9); scene.add(rim);
  return { sun, hemi, fill, rim };
}

// ---------------------------------------------------------------- GROUND / CUTAWAY
export function makeGround() {
  const g = new THREE.Group();
  // front cut face
  const face = new THREE.Mesh(new THREE.PlaneGeometry(36, 9, 1, 1), makeSoilMaterial());
  face.position.set(0, -4.5, 0); face.receiveShadow = true; g.add(face);
  // lawn top
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(36, 40), makeLawnMaterial());
  lawn.rotation.x = -Math.PI / 2; lawn.position.set(0, 0, -20); lawn.receiveShadow = true; g.add(lawn);
  // cavity (open hole) walls
  const imat = makeSoilMaterial({ interior: true });
  const cav = new THREE.Group();
  const back = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), imat); back.receiveShadow = true;
  const left = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), imat); left.receiveShadow = true;
  const right = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), imat); right.receiveShadow = true;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), imat); floor.receiveShadow = true;
  left.rotation.y = Math.PI / 2; right.rotation.y = -Math.PI / 2; floor.rotation.x = -Math.PI / 2;
  cav.add(back, left, right, floor); g.add(cav);
  function updateCavity() {
    const x0 = U.uHoleX.value.x, x1 = U.uHoleX.value.y, zb = U.uHoleZ.value, yb = U.uOpenBottom.value;
    const open = yb < -0.001;
    cav.visible = open;
    if (!open) return;
    const w = x1 - x0, h = -yb, d = -zb;
    back.scale.set(w, h, 1); back.position.set((x0 + x1) / 2, yb / 2, zb);
    left.scale.set(d, h, 1); left.position.set(x0, yb / 2, zb / 2);
    right.scale.set(d, h, 1); right.position.set(x1, yb / 2, zb / 2);
    floor.scale.set(w, d, 1); floor.position.set((x0 + x1) / 2, yb, zb / 2);
  }
  // embedded 3D stones protruding from the cut face (avoid the hole column)
  const rnd = mulberry32(77);
  const stoneGeo = new THREE.IcosahedronGeometry(1, 2);
  { const p = stoneGeo.attributes.position; for (let i = 0; i < p.count; i++) { const k = 1 + (Math.sin(p.getX(i) * 7 + p.getY(i) * 5) * 0.08 + Math.sin(p.getZ(i) * 9) * 0.06); p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); } stoneGeo.computeVertexNormals(); }
  const stoneMat = std(0xffffff, 0.7, 0, { vertexColors: false });
  const N = 260; const stones = new THREE.InstancedMesh(stoneGeo, stoneMat, N);
  const dm = new THREE.Object3D(); const col = new THREE.Color(); let k = 0;
  const palette = [0xa89b8a, 0x8d8780, 0xc2b195, 0x7b6f63, 0xb5a48c, 0x9a8c7c];
  while (k < N) {
    const x = -9 + rnd() * 18, y = -0.12 - rnd() * 6.2;
    if (x > -0.75 && x < 1.25 && y > -3.9) continue;
    const s = (0.025 + rnd() * 0.06) * (1 + Math.min(2, -y / 2.5));
    dm.position.set(x, y, s * 0.15); dm.scale.set(s * (1 + rnd() * 0.6), s * (0.7 + rnd() * 0.4), s * 0.6);
    dm.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); dm.updateMatrix(); stones.setMatrixAt(k, dm.matrix);
    stones.setColorAt(k, col.set(palette[Math.floor(rnd() * palette.length)]).multiplyScalar(0.8 + rnd() * 0.3)); k++;
  }
  stones.castShadow = true; stones.receiveShadow = true; g.add(stones);
  // easter eggs: a fossil shell deep down + an old glass bottle
  const shell = new THREE.Mesh(new THREE.TorusKnotGeometry(0.12, 0.035, 80, 10, 1, 3), std(0xd8c9a8, 0.7));
  shell.scale.set(1, 1, 0.25); shell.position.set(-1.9, -3.4, 0.01); g.add(shell);
  const bottle = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.14, 6, 12), new THREE.MeshPhysicalMaterial({ color: 0x5f9a7c, roughness: 0.15, transmission: 0, transparent: true, opacity: 0.85, clearcoat: 1 }));
  bottle.rotation.z = 1.2; bottle.scale.z = 0.5; bottle.position.set(1.65, -1.55, 0.015); g.add(bottle);
  return { group: g, updateCavity, face, lawn };
}

export function makeLawnGrass() {
  const group = new THREE.Group();
  // dense near the action, sparser further back (blades get larger further away to keep coverage)
  const near = makeGrass({ count: 150000, x0: -5.5, x1: 5.5, z0: -4.2, z1: 0.0, seed: 3, bladeH: 0.15, bladeW: 0.024 });
  const mid = makeGrass({ count: 70000, x0: -9, x1: 9, z0: -11, z1: -4.2, seed: 4, bladeH: 0.2, bladeW: 0.045 });
  group.add(near, mid);
  return { group, meshes: [near, mid] };
}

// ---------------------------------------------------------------- HOUSE
export function makeHouse() {
  const g = new THREE.Group();
  const W = 6.4, D = 4.6, H = 5.0, cx = -2.4;
  const sid = sidingTexture({});
  sid.map.repeat.set(3, 3); sid.bump.repeat.set(3, 3);
  const wall = std(0xffffff, 0.8, 0, { map: sid.map, bumpMap: sid.bump, bumpScale: 2.0 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), wall);
  body.position.set(cx, H / 2, HOUSE_Z - D / 2); body.castShadow = true; body.receiveShadow = true; g.add(body);
  // gable roof (ridge along x)
  const roofMat = std(0xffffff, 0.85, 0, { map: shingleTexture({}) }); roofMat.map.repeat.set(3, 2);
  const rh = 2.0, over = 0.35;
  const slopeL = Math.hypot(D / 2 + over, rh);
  for (const s of [-1, 1]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(W + over * 2, 0.14, slopeL), roofMat);
    const ang = Math.atan2(rh, D / 2 + over);
    r.position.set(cx, H + rh / 2 - 0.05, HOUSE_Z - D / 2 + s * (D / 4 + over / 2));
    r.rotation.x = s * ang; r.castShadow = true; r.receiveShadow = true; g.add(r);
  }
  // gable triangles
  const tri = new THREE.Shape(); tri.moveTo(-D / 2, 0); tri.lineTo(D / 2, 0); tri.lineTo(0, rh); tri.closePath();
  for (const s of [-1, 1]) {
    const gm = new THREE.Mesh(new THREE.ShapeGeometry(tri), wall);
    gm.rotation.y = Math.PI / 2 * s; gm.position.set(cx + s * W / 2, H, HOUSE_Z - D / 2); g.add(gm);
  }
  const trim = std(0xf6f1e6, 0.5);
  // fascia + corner boards
  for (const s of [-1, 1]) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.16, H, 0.16), trim); c.position.set(cx + s * W / 2, H / 2, HOUSE_Z); c.castShadow = true; g.add(c); }
  const band = new THREE.Mesh(new THREE.BoxGeometry(W + 0.1, 0.14, 0.1), trim); band.position.set(cx, H / 2, HOUSE_Z + 0.03); g.add(band);
  const fascia = new THREE.Mesh(new THREE.BoxGeometry(W + over * 2, 0.18, 0.12), trim); fascia.position.set(cx, H - 0.02, HOUSE_Z + over); g.add(fascia);
  // chimney
  const ch = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.8, 0.6), std(0x9a5a48, 0.9)); ch.position.set(cx + 2.0, H + 1.6, HOUSE_Z - 2.6); ch.castShadow = true; g.add(ch);
  // windows with blue shutters
  // window glass: dark reflective pane over a warm lamp-lit interior with curtains (painted by code)
  const winTex = (() => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 160; const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 120, 4, 64, 100, 110); g.addColorStop(0, '#ffcf86'); g.addColorStop(0.45, '#a8673a'); g.addColorStop(1, '#3a2418');
    x.fillStyle = g; x.fillRect(0, 0, 128, 160);
    for (const s of [0, 1]) { const cg = x.createLinearGradient(s ? 128 : 0, 0, s ? 90 : 38, 0); cg.addColorStop(0, '#f3e6cf'); cg.addColorStop(1, '#cdb894'); x.fillStyle = cg;
      x.beginPath(); x.moveTo(s ? 128 : 0, 0); x.lineTo(s ? 92 : 36, 0); x.quadraticCurveTo(s ? 100 : 28, 90, s ? 116 : 12, 160); x.lineTo(s ? 128 : 0, 160); x.fill(); }
    x.fillStyle = 'rgba(255,255,255,0.12)'; x.beginPath(); x.moveTo(10, 0); x.lineTo(40, 0); x.lineTo(0, 60); x.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x4a3a30, map: winTex, emissiveMap: winTex, roughness: 0.08, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.05, emissive: new THREE.Color(1.0, 0.8, 0.6), emissiveIntensity: 0.55, envMapIntensity: 0.35 });
  const shutterMat = std(0x2f66a6, 0.55);
  const louverGeo = (() => { const parts = []; for (let i = 0; i < 9; i++) { const b = new THREE.BoxGeometry(0.42, 0.1, 0.05); b.rotateX(-0.5); b.translate(0, -0.6 + i * 0.15, 0); parts.push(b); } const fr = new THREE.BoxGeometry(0.46, 1.42, 0.03); parts.push(fr); return mergeGeometries(parts); })();
  function windowAt(x, y, w = 1.0, h = 1.35) {
    const wg = new THREE.Group();
    for (const [fw, fh, fx, fy] of [[w + 0.18, 0.09, 0, h / 2 + 0.045], [w + 0.18, 0.09, 0, -h / 2 - 0.045], [0.09, h, -w / 2 - 0.045, 0], [0.09, h, w / 2 + 0.045, 0]]) {
      const fr = new THREE.Mesh(new RoundedBoxGeometry(fw, fh, 0.12, 2, 0.02), trim); fr.position.set(fx, fy, 0); fr.castShadow = true; wg.add(fr); }
    const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0x2a1a10 })); back.position.z = -0.02; wg.add(back);
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glass); gl.position.z = 0.04; wg.add(gl);
    const mv = new THREE.Mesh(new THREE.BoxGeometry(0.05, h, 0.05), trim); mv.position.z = 0.07; wg.add(mv);
    const mh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, 0.05), trim); mh.position.z = 0.07; wg.add(mh);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.08, 0.22), trim); sill.position.set(0, -h / 2 - 0.12, 0.08); sill.castShadow = true; wg.add(sill);
    for (const s of [-1, 1]) { const sh = new THREE.Mesh(louverGeo, shutterMat); sh.scale.set(1, h / 1.35, 1); sh.position.set(s * (w / 2 + 0.36), 0, 0.03); sh.castShadow = true; wg.add(sh); }
    // flower box on the window
    wg.position.set(x, y, HOUSE_Z + 0.02); g.add(wg); return wg;
  }
  windowAt(cx - 2.0, 3.65); windowAt(cx, 3.65); windowAt(cx + 2.0, 3.65);
  windowAt(cx - 2.1, 1.45); windowAt(cx + 1.9, 1.45);
  // warm curtains behind the glass
  
  // door (pivot on its left edge) + frame + porch step + lamp
  const doorG = new THREE.Group();
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.25, 2.3, 0.14), trim); doorFrame.position.set(DOOR_POS.x, 1.15, HOUSE_Z + 0.01); g.add(doorFrame);
  const interior = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.1), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.32, 0.16, 0.06) }));
  interior.position.set(DOOR_POS.x, 1.07, HOUSE_Z + 0.08); g.add(interior);
  const doorMat = std(0x2b5d99, 0.45);
  const door = new THREE.Mesh(new RoundedBoxGeometry(1.0, 2.1, 0.08, 2, 0.02), doorMat); door.position.set(0.5, 1.05, 0); door.castShadow = true;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), std(0xd9b45a, 0.25, 1)); knob.position.set(0.85, 1.0, 0.07);
  const dwin = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.42), glass); dwin.position.set(0.5, 1.6, 0.045);
  doorG.add(door, knob, dwin); doorG.position.set(DOOR_POS.x - 0.5, 0.02, HOUSE_Z + 0.11); g.add(doorG);
  const step = new THREE.Mesh(new RoundedBoxGeometry(1.8, 0.16, 0.7, 2, 0.04), std(0xbab0a2, 0.8)); step.position.set(DOOR_POS.x, 0.08, HOUSE_Z + 0.35); step.castShadow = true; step.receiveShadow = true; g.add(step);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), new THREE.MeshStandardMaterial({ color: 0xffe2a8, emissive: 0xffc070, emissiveIntensity: 3 }));
  lamp.position.set(DOOR_POS.x + 0.85, 2.0, HOUSE_Z + 0.15); g.add(lamp);
  // foundation strip
  const found = new THREE.Mesh(new THREE.BoxGeometry(W + 0.05, 0.3, D + 0.05), std(0x8f877c, 0.9)); found.position.set(cx, 0.15, HOUSE_Z - D / 2); g.add(found);
  return { group: g, door: doorG };
}

// ---------------------------------------------------------------- FENCE (right side, neighbor beyond)
export function makeFence() {
  const g = new THREE.Group();
  const wood = woodTextures({ planks: 1, base: [196, 150, 104], seed: 5, weather: 0.5 });
  const mat = std(0xffffff, 0.8, 0, { map: wood.map, bumpMap: wood.bump, bumpScale: 1.5 });
  const pk = new THREE.BoxGeometry(0.035, 1.0, 0.13); pk.translate(0, 0.5, 0);
  const tip = new THREE.CylinderGeometry(0.0, 0.092, 0.1, 4, 1); tip.rotateY(Math.PI / 4); tip.scale(0.38, 1, 1); tip.translate(0, 1.05, 0);
  const picket = mergeGeometries([pk, tip]);
  const z0 = 0.0, z1 = -12, step = 0.17; const n = Math.floor((z0 - z1) / step);
  const inst = new THREE.InstancedMesh(picket, mat, n); const d = new THREE.Object3D(); const rnd = mulberry32(9);
  for (let i = 0; i < n; i++) { d.position.set(FENCE_X, -0.0, z0 - 0.08 - i * step); d.rotation.set(0, 0, (rnd() - 0.5) * 0.02); d.scale.set(1, 0.97 + rnd() * 0.06, 1); d.updateMatrix(); inst.setMatrixAt(i, d.matrix); }
  inst.castShadow = true; inst.receiveShadow = true; g.add(inst);
  for (const y of [0.28, 0.78]) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, -z1), mat); r.position.set(FENCE_X + 0.05, y, z1 / 2); r.castShadow = true; g.add(r); }
  for (let z = -0.1; z > z1; z -= 2.4) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.1, 0.1), mat); p.position.set(FENCE_X + 0.06, 0.55, z); p.castShadow = true; g.add(p); }
  return g;
}

// ---------------------------------------------------------------- DOGHOUSE
export function makeDoghouse() {
  const g = new THREE.Group();
  const wood = woodTextures({ planks: 5, base: [214, 168, 96], seed: 15 });
  wood.map.rotation = Math.PI / 2; wood.bump.rotation = Math.PI / 2;
  const wm = std(0xffffff, 0.75, 0, { map: wood.map, bumpMap: wood.bump, bumpScale: 1.5 });
  const shape = new THREE.Shape(); shape.moveTo(-0.5, 0); shape.lineTo(0.5, 0); shape.lineTo(0.5, 0.62); shape.lineTo(0, 1.02); shape.lineTo(-0.5, 0.62); shape.closePath();
  const hole = new THREE.Path(); hole.moveTo(-0.2, 0.0); hole.lineTo(0.2, 0.0); hole.lineTo(0.2, 0.36); hole.absarc(0, 0.36, 0.2, 0, Math.PI, false); hole.closePath(); shape.holes.push(hole);
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 1.0, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 }), wm);
  body.position.z = -0.5; body.castShadow = true; body.receiveShadow = true; g.add(body);
  const inside = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.9), new THREE.MeshBasicMaterial({ color: 0x150c06 })); inside.position.set(0, 0.32, 0); g.add(inside);
  const roofM = std(0xb8432f, 0.6);
  for (const s of [-1, 1]) { const r = new THREE.Mesh(new RoundedBoxGeometry(0.72, 0.07, 1.2, 2, 0.02), roofM); r.position.set(s * 0.27, 0.84, 0); r.rotation.z = -s * 0.68; r.castShadow = true; g.add(r); }
  const plate = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.12, 0.03, 2, 0.01), std(0xf2e2c0, 0.6)); plate.position.set(0, 0.8, 0.53); g.add(plate);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.07, 24), std(0xc0392b, 0.35)); bowl.position.set(0.7, 0.035, 0.45); bowl.castShadow = true; g.add(bowl);
  g.position.set(-2.95, 0, -2.9); g.rotation.y = 0.5;
  return g;
}

// ---------------------------------------------------------------- TREES / BUSHES / FLOWERS
function blobGeo(r, detail, seed, amp = 0.18) {
  const geo = new THREE.IcosahedronGeometry(r, detail); const p = geo.attributes.position; const rnd = mulberry32(seed);
  const ph = [rnd() * 6, rnd() * 6, rnd() * 6];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + amp * (Math.sin(x * 3.1 / r + ph[0]) * Math.sin(y * 2.7 / r + ph[1]) * Math.sin(z * 3.3 / r + ph[2]));
    p.setXYZ(i, x * k, y * k * 0.9, z * k);
  }
  geo.computeVertexNormals(); return geo;
}
export function makeTree({ x, z, s = 1, seed = 1, hue = 0x4f8f3a }) {
  const g = new THREE.Group(); const rnd = mulberry32(seed);
  const trunkM = std(0xffffff, 0.9, 0, { map: barkTexture() });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s, 0.26 * s, 2.4 * s, 12), trunkM); trunk.position.y = 1.2 * s; trunk.castShadow = true; g.add(trunk);
  const leaves = [];
  for (let i = 0; i < 7; i++) {
    const c = new THREE.Color(hue).offsetHSL((rnd() - 0.5) * 0.04, (rnd() - 0.5) * 0.1, (rnd() - 0.5) * 0.08);
    const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 });
    const r = (0.7 + rnd() * 0.5) * s;
    const b = new THREE.Mesh(blobGeo(r, 3, seed * 10 + i), m);
    const a = (i / 7) * Math.PI * 2;
    b.position.set(Math.cos(a) * 0.7 * s * (i ? 1 : 0), (2.6 + rnd() * 1.0 + (i ? 0 : 0.7)) * s, Math.sin(a) * 0.6 * s * (i ? 1 : 0));
    b.castShadow = true; b.receiveShadow = true; g.add(b); leaves.push(b);
  }
  g.position.set(x, 0, z);
  g.userData.sway = (t) => { g.rotation.z = Math.sin(t * 0.7 + seed) * 0.012; g.rotation.x = Math.sin(t * 0.55 + seed * 2) * 0.008; };
  return g;
}
export function makeBush({ x, z, s = 1, seed = 1, hue = 0x3f7f35, flowers = null }) {
  const g = new THREE.Group(); const rnd = mulberry32(seed);
  for (let i = 0; i < 4; i++) {
    const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(hue).offsetHSL((rnd() - 0.5) * 0.03, 0, (rnd() - 0.5) * 0.08), roughness: 0.85 });
    const b = new THREE.Mesh(blobGeo((0.35 + rnd() * 0.2) * s, 2, seed * 7 + i, 0.2), m);
    b.position.set((rnd() - 0.5) * 0.6 * s, (0.3 + rnd() * 0.15) * s, (rnd() - 0.5) * 0.4 * s); b.castShadow = true; b.receiveShadow = true; g.add(b);
  }
  if (flowers) {
    const fg = new THREE.SphereGeometry(0.045 * s, 8, 6);
    const fm = new THREE.MeshStandardMaterial({ color: flowers, roughness: 0.5, emissive: flowers, emissiveIntensity: 0.08 });
    const inst = new THREE.InstancedMesh(fg, fm, 40); const d = new THREE.Object3D();
    for (let i = 0; i < 40; i++) { const a = rnd() * 6.28, e = rnd() * 1.2; d.position.set(Math.cos(a) * 0.45 * s * Math.cos(e) * 1.1, (0.35 + Math.sin(e) * 0.4) * s, Math.sin(a) * 0.32 * s); d.updateMatrix(); inst.setMatrixAt(i, d.matrix); }
    g.add(inst);
  }
  g.position.set(x, 0, z); return g;
}

export function makeBackdrop() {
  const g = new THREE.Group();
  // neighbor's house (partially visible beyond the fence)
  const nh = new THREE.Mesh(new THREE.BoxGeometry(5, 4.2, 4), std(0xb9c7b0, 0.85)); nh.position.set(6.8, 2.1, -9.5); nh.castShadow = true; nh.receiveShadow = true; g.add(nh);
  const nr = new THREE.Mesh(new THREE.ConeGeometry(3.9, 1.8, 4, 1), std(0x6a4b45, 0.85)); nr.rotation.y = Math.PI / 4; nr.position.set(6.8, 5.1, -9.5); nr.scale.set(1, 1, 0.75); nr.castShadow = true; g.add(nr);
  const nwin = new THREE.MeshPhysicalMaterial({ color: 0x1d2a3a, roughness: 0.05, clearcoat: 1, emissive: new THREE.Color(1, 0.6, 0.3), emissiveIntensity: 0.3 });
  for (const [x, y] of [[5.4, 2.9], [6.8, 2.9], [5.4, 1.2]]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.0), nwin); w.position.set(x, y, -7.49); g.add(w); }
  // trees
  g.add(makeTree({ x: 4.9, z: -7.8, s: 1.2, seed: 3 }));
  g.add(makeTree({ x: -5.6, z: -3.8, s: 1.25, seed: 5, hue: 0x5a9a3c }));
  g.add(makeTree({ x: -7.5, z: -9, s: 1.5, seed: 8, hue: 0x4a8436 }));
  g.add(makeTree({ x: 9.5, z: -14, s: 1.6, seed: 11, hue: 0x52883a }));
  g.add(makeTree({ x: 2.6, z: -13.5, s: 1.5, seed: 13, hue: 0x4c8a3a }));
  g.add(makeTree({ x: -3.5, z: -14, s: 1.7, seed: 17, hue: 0x588f3e }));
  // bushes / flower beds along the house and the left edge
  g.add(makeBush({ x: -4.4, z: HOUSE_Z + 0.5, s: 1.0, seed: 21, flowers: 0xf06292 }));
  g.add(makeBush({ x: -0.4, z: HOUSE_Z + 0.5, s: 1.0, seed: 22, flowers: 0xffd54f }));
  g.add(makeBush({ x: 0.7, z: HOUSE_Z + 0.55, s: 0.8, seed: 23, flowers: 0xff7043 }));
  g.add(makeBush({ x: -5.2, z: -1.5, s: 1.3, seed: 24 }));
  g.add(makeBush({ x: -4.4, z: -6.5, s: 1.2, seed: 25, flowers: 0xba68c8 }));
  g.add(makeBush({ x: 3.4, z: -2.2, s: 0.9, seed: 26, flowers: 0xffffff }));
  return g;
}

// soft blob shadow decal (contact shadow / AO under characters)
let _blobTex = null;
export function makeContactShadow(radius = 0.4, opacity = 0.45) {
  _blobTex = _blobTex || radialTexture({ stops: [[0, 'rgba(0,0,0,1)'], [0.5, 'rgba(0,0,0,0.5)'], [1, 'rgba(0,0,0,0)']] });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), new THREE.MeshBasicMaterial({ map: _blobTex, transparent: true, opacity, depthWrite: false, color: 0x1a1008 }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.012; m.renderOrder = 1;
  return m;
}

export function makeSapling() {
  const g = new THREE.Group();
  const prof = [[0.0, 0], [0.12, 0], [0.15, 0.02], [0.18, 0.24], [0.2, 0.25], [0.2, 0.29], [0.17, 0.29], [0.16, 0.27]].map(([x, y]) => new THREE.Vector2(x, y));
  const pot = new THREE.Mesh(new THREE.LatheGeometry(prof, 32), std(0xc0643c, 0.8)); pot.castShadow = true; pot.receiveShadow = true; g.add(pot);
  const soil = new THREE.Mesh(new THREE.CircleGeometry(0.165, 24), std(0x3b2414, 1)); soil.rotation.x = -Math.PI / 2; soil.position.y = 0.26; g.add(soil);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.42, 8), std(0x6b4a2a, 0.8)); stem.position.y = 0.46; g.add(stem);
  const leafM = std(0x5aa83c, 0.6);
  for (let i = 0; i < 7; i++) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), leafM); l.scale.set(1, 0.35, 0.55);
    const a = i * 2.3; l.position.set(Math.cos(a) * 0.07, 0.48 + i * 0.045, Math.sin(a) * 0.07); l.rotation.set(0.4, a, 0.5); l.castShadow = true; g.add(l);
  }
  return g;
}
