// The backyard diorama: sky, cutaway soil block, ground, plants, fence, house, trees.
import * as THREE from 'three';
import * as T from './textures.js';
import * as P from './plants.js';
import { U, windy, holeMaterial } from './shaders.js';
import { rng, lerp, clamp, fbm } from './util.js';

export const ZC = 0.3;          // cut face plane (z)
export const DEPTH = 4.6;       // soil block depth
export const FENCE_Z = -2.75;
export const FENCE_TOP = 1.02;
export const BEDS = [
  { x0: -2.9, x1: 2.9, z0: -0.62, z1: -0.02 },   // front bed (lettuce)
  { x0: -3.1, x1: 3.1, z0: -1.38, z1: -0.86 },   // tomatoes
  { x0: -3.4, x1: 3.4, z0: -2.22, z1: -1.62 },   // corn + lettuce
];
export const BUSHES = [
  { x: -1.2, z: -2.38, r: 0.5 },
  { x: 1.25, z: -2.4, r: 0.52 },
  { x: -3.3, z: -2.35, r: 0.6 },
  { x: 3.45, z: -2.3, r: 0.6 },
];

const std = (o) => new THREE.MeshStandardMaterial(o);

export function buildWorld(scene) {
  const W = { group: new THREE.Group(), mats: {} };
  scene.add(W.group);
  const add = (m, cast = true, recv = true) => { m.castShadow = cast; m.receiveShadow = recv; W.group.add(m); return m; };

  // ---------------------------------------------------------------- sky
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      uZenith: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() },
      uGlow: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3(0.5, 0.1, -1).normalize() },
      uMoonDir: { value: new THREE.Vector3(-0.35, 0.42, -1).normalize() }, uNight: { value: 0 }, uTime: U.uTime,
      uCloud: { value: new THREE.Color() }, uCloudLit: { value: new THREE.Color() },
    },
    vertexShader: /* glsl */`varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: /* glsl */`
      uniform vec3 uZenith, uMid, uHorizon, uGlow, uSunDir, uMoonDir, uCloud, uCloudLit; uniform float uNight, uTime;
      varying vec3 vDir;
      float h21(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 45758.5453); }
      float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<5;i++){ s+=a*vn(p); p*=2.03; a*=0.5; } return s; }
      void main(){
        vec3 d = normalize(vDir); float h = d.y;
        vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.22, h));
        col = mix(col, uZenith, smoothstep(0.18, 0.75, h));
        col = mix(col, uHorizon * 0.32 + uZenith * 0.18, smoothstep(0.0, -0.3, h));
        float sd = max(dot(d, uSunDir), 0.0);
        col += uGlow * (pow(sd, 6.0) * 0.4 + pow(sd, 40.0) * 0.5) * (1.0 - uNight);
        // clouds: soft painted streaks
        vec2 cp = d.xz / max(h + 0.18, 0.05) * 0.9 + vec2(uTime * 0.006, 0.0);
        float c = fbm(cp * 1.3 + vec2(3.0, 7.0));
        float cm = smoothstep(0.52, 0.72, c) * smoothstep(0.02, 0.18, h) * (1.0 - smoothstep(0.55, 0.9, h));
        float lit = clamp(0.5 + 0.8 * (fbm(cp * 1.3 + vec2(3.2, 7.1) + uSunDir.xz * 0.06) - c) * 6.0, 0.0, 1.0);
        vec3 cc = mix(uCloud, uCloudLit, lit * 0.7 + pow(sd, 3.0) * 0.5);
        col = mix(col, cc, cm * 0.85);
        // stars + moon at night
        if (uNight > 0.01) {
          vec3 sp = d * 220.0; vec2 cell = floor(sp.xy + sp.z * 0.37); float r = h21(cell);
          float tw = 0.65 + 0.35 * sin(uTime * (2.0 + r * 5.0) + r * 40.0);
          float star = step(0.987, r) * smoothstep(0.42, 0.08, length(fract(sp.xy + sp.z * 0.37) - 0.5)) * tw;
          col += vec3(0.9, 0.95, 1.2) * star * 2.2 * smoothstep(0.03, 0.25, h) * uNight * (1.0 - cm);
          float md = dot(d, normalize(uMoonDir));
          col += vec3(1.0, 0.97, 0.88) * smoothstep(0.99955, 0.99975, md) * 7.0 * uNight;
          col += vec3(0.45, 0.6, 1.0) * pow(max(md, 0.0), 90.0) * 0.8 * uNight;
        }
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(90, 48, 24), skyMat);
  sky.frustumCulled = false; sky.renderOrder = -10; scene.add(sky);
  W.sky = sky; W.mats.sky = skyMat;

  // ---------------------------------------------------------------- soil block (cut face)
  const soil = T.soilFace();
  const faceW = 15;
  const faceMat = holeMaterial(std({ map: soil.map, normalMap: soil.normalMap, roughnessMap: soil.roughnessMap, normalScale: new THREE.Vector2(1.2, 1.2) }), 0);
  for (const t of [soil.map, soil.normalMap, soil.roughnessMap]) { t.repeat.set(faceW / soil.widthM, 1); t.offset.set(0.37, 0); }
  const faceGeo = new THREE.PlaneGeometry(faceW, DEPTH, 1, 1); faceGeo.translate(0, -DEPTH / 2, ZC);
  add(new THREE.Mesh(faceGeo, faceMat), false, true);
  // sides + bottom so the slab reads as a solid block in wide shots
  const sideMat = std({ color: 0x3a2516, roughness: 1 });
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(faceW, 0.1, 22), sideMat); bottom.position.set(0, -DEPTH - 0.05, ZC - 11); add(bottom, false, false);

  // turf lip along the top edge (the "frosting")
  const lipGeo = new THREE.CylinderGeometry(0.045, 0.045, faceW, 10, 1, false, 0, Math.PI);
  lipGeo.rotateZ(Math.PI / 2); lipGeo.rotateX(-Math.PI / 2); lipGeo.translate(0, -0.012, ZC - 0.02);
  const lipMat = holeMaterial(std({ color: 0x4f7a2a, roughness: 0.9, normalMap: T.groundDetail().normalMap }), 2);
  add(new THREE.Mesh(lipGeo, lipMat), false, true);
  W.lip = lipMat;

  // hole cavity behind the face (visible only where the face discards)
  const loose = T.looseSoil();
  const cavMat = std({ map: loose.map, normalMap: loose.normalMap, color: 0x8a6a55, roughness: 1, side: THREE.DoubleSide });
  const cavGeo = new THREE.CylinderGeometry(1, 0.82, 1, 24, 6, true, Math.PI / 2, Math.PI);
  cavGeo.translate(0, -0.5, 0);
  const cav = new THREE.Mesh(cavGeo, cavMat); cav.position.set(0, 0, ZC + 0.001); add(cav, false, true);
  const cavBottom = new THREE.Mesh(new THREE.CircleGeometry(1, 20, 0, Math.PI), cavMat);
  cavBottom.rotation.x = -Math.PI / 2; add(cavBottom, false, true);
  W.cavity = { cav, cavBottom };

  // ---------------------------------------------------------------- ground top
  const gt = T.groundTop(BEDS); const det = T.groundDetail();
  det.normalMap.repeat.set(40, 40);
  const groundMat = holeMaterial(std({ map: gt.map, roughnessMap: gt.roughnessMap, normalMap: det.normalMap, normalScale: new THREE.Vector2(0.6, 0.6) }), 1);
  const gx0 = -faceW / 2, gx1 = faceW / 2, gz0 = -22, gz1 = ZC;
  const gg = new THREE.PlaneGeometry(gx1 - gx0, gz1 - gz0, 60, 60); gg.rotateX(-Math.PI / 2); gg.translate((gx0 + gx1) / 2, 0, (gz0 + gz1) / 2);
  { // planar uvs into the ground texture
    const p = gg.attributes.position, uv = gg.attributes.uv; const G = T.GROUND;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) - G.x0) / (G.x1 - G.x0), 1 - (p.getZ(i) - G.z0) / (G.z1 - G.z0));
  }
  add(new THREE.Mesh(gg, groundMat), false, true);

  // raised soil beds (gentle mounds)
  const bedMat = std({ map: loose.map, normalMap: loose.normalMap, roughness: 1, color: 0xb59a88 });
  loose.map.repeat.set(1, 1);
  for (const b of BEDS) {
    const w = b.x1 - b.x0, d = b.z1 - b.z0;
    const g = new THREE.BoxGeometry(w, 0.12, d, 40, 1, 8); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const ex = 1 - Math.pow(Math.abs(x) / (w / 2), 8), ez = 1 - Math.pow(Math.abs(z) / (d / 2), 2.2);
      const top = y > 0 ? 0.06 * Math.max(0, ez) * Math.max(0, ex) + (fbm(x * 4, z * 4, 3, 7) - 0.5) * 0.02 : -0.06;
      p.setY(i, Math.max(-0.06, top - 0.005));
      if (y > 0 && Math.abs(z) > d / 2 - 0.001) p.setY(i, -0.01);
    }
    g.computeVertexNormals();
    const uv = g.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) * 1.4, p.getZ(i) * 1.4);
    const m = new THREE.Mesh(g, bedMat); m.position.set((b.x0 + b.x1) / 2, 0, (b.z0 + b.z1) / 2); add(m, false, true);
  }

  // ---------------------------------------------------------------- grass tufts
  const tuftGeos = [P.grassTuft(1), P.grassTuft(2, 8, 0.2), P.grassTuft(3, 6, 0.13)];
  const { material: grassMat } = windy(std({ vertexColors: true, roughness: 0.62, side: THREE.DoubleSide }), { amp: 0.06, ref: 0.18 });
  const r = rng(5);
  const inBed = (x, z, m = 0.04) => BEDS.some((b) => x > b.x0 - m && x < b.x1 + m && z > b.z0 - m && z < b.z1 + m);
  const inHouse = (x, z) => x > -8.7 && x < -1.1 && z > -18.8 && z < -13.5;
  const placements = [[], [], []];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sv = new THREE.Vector3();
  const tryPlace = (x, z, s) => {
    if (inBed(x, z) || inHouse(x, z) || z > ZC - 0.01) return;
    if (Math.abs(x) < 0.32 && z > ZC - 0.32) return; // the dig spot
    if (Math.abs(z - FENCE_Z) < 0.06) return;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6.28);
    sv.set(s, s * (0.8 + r() * 0.5), s); m4.compose(new THREE.Vector3(x, 0, z), q, sv);
    placements[Math.floor(r() * 3)].push(m4.clone());
  };
  for (let i = 0; i < 4200; i++) { const x = lerp(-4.2, 4.2, r()), z = lerp(-3.2, ZC, Math.pow(r(), 0.8)); tryPlace(x, z, 0.6 + r() * 0.4); }
  for (let i = 0; i < 900; i++) { const x = lerp(-5.5, 5.5, r()); tryPlace(x, ZC - 0.015 - r() * 0.07, 0.55 + r() * 0.35); } // edge fringe
  for (let i = 0; i < 1300; i++) { const x = lerp(-9, 9, r()), z = lerp(-20, -3.1, r()); tryPlace(x, z, 1.2 + r() * 0.8); }
  placements.forEach((list, k) => {
    const im = new THREE.InstancedMesh(tuftGeos[k], grassMat, list.length);
    list.forEach((m, i) => im.setMatrixAt(i, m)); im.instanceMatrix.needsUpdate = true;
    add(im, false, true);
  });
  W.grassCount = placements.reduce((a, l) => a + l.length, 0);

  // ---------------------------------------------------------------- plants
  const veinT = T.leafVein();
  const leafM = windy(std({ vertexColors: true, map: veinT.map, normalMap: veinT.normalMap, roughness: 0.55, side: THREE.DoubleSide }), { amp: 0.035, attr: true });
  const fruitM = windy(new THREE.MeshPhysicalMaterial({ color: 0xd8321f, roughness: 0.28, clearcoat: 0.6, clearcoatRoughness: 0.2 }), { amp: 0.035, attr: true });
  const fruitGreenM = windy(new THREE.MeshPhysicalMaterial({ color: 0x8fb33a, roughness: 0.35, clearcoat: 0.4 }), { amp: 0.035, attr: true });
  const fruitOrangeM = windy(new THREE.MeshPhysicalMaterial({ color: 0xec6a1c, roughness: 0.3, clearcoat: 0.5 }), { amp: 0.035, attr: true });
  const calyxM = windy(std({ color: 0x4d7f2a, roughness: 0.6, side: THREE.DoubleSide }), { amp: 0.035, attr: true });
  const w = T.wood('warm');
  const stakeMat = std({ map: w.map, normalMap: w.normalMap, roughness: 0.8 });
  const fruitGeo = P.tomatoFruitGeo(); const calGeo = P.calyxGeo();
  const tomatoX = [-2.5, -1.75, -1.0, 1.0, 1.75, 2.5];
  const tomatoVariants = [P.tomatoPlant(3), P.tomatoPlant(4), P.tomatoPlant(5)];
  W.tomatoes = [];
  const fruitLists = { red: [], orange: [], green: [] };
  tomatoX.forEach((x, i) => {
    const v = tomatoVariants[i % 3]; const grp = new THREE.Group(); grp.position.set(x + (r() - 0.5) * 0.1, 0.03, -1.12 + (r() - 0.5) * 0.08); grp.rotation.y = r() * 6.28;
    const lm = new THREE.Mesh(v.leaves, leafM.material); lm.customDepthMaterial = leafM.depth; lm.castShadow = true; lm.receiveShadow = true; grp.add(lm);
    const sm = new THREE.Mesh(v.stake, stakeMat); sm.castShadow = true; sm.receiveShadow = true; grp.add(sm);
    W.group.add(grp); grp.updateMatrixWorld();
    for (const f of v.fruit) {
      const wp = f.pos.clone().applyMatrix4(grp.matrixWorld);
      const kind = f.ripe < 0.6 ? 'red' : f.ripe < 0.8 ? 'orange' : 'green';
      fruitLists[kind].push({ pos: wp, rad: f.rad, sway: clamp(f.pos.y / v.height) });
    }
    W.tomatoes.push(grp);
  });
  const fruitInst = (list, mat) => {
    const geo = fruitGeo.clone();
    const im = new THREE.InstancedMesh(geo, mat.material, list.length);
    const cim = new THREE.InstancedMesh(calGeo, calyxM.material, list.length);
    const sw = new Float32Array(list.length);
    list.forEach((f, i) => {
      m4.compose(f.pos, q.setFromEuler(new THREE.Euler(r() * 0.4, r() * 6, r() * 0.4)), sv.set(f.rad, f.rad, f.rad)); im.setMatrixAt(i, m4);
      const cp = f.pos.clone(); cp.y += f.rad * 0.82; m4.compose(cp, q, sv.set(f.rad * 1.4, f.rad * 1.4, f.rad * 1.4)); cim.setMatrixAt(i, m4);
      sw[i] = f.sway;
    });
    geo.setAttribute('aSway', new THREE.InstancedBufferAttribute(sw, 1));
    const cg = calGeo.clone(); cg.setAttribute('aSway', new THREE.InstancedBufferAttribute(sw, 1)); cim.geometry = cg;
    im.customDepthMaterial = mat.depth; add(im, true, true); add(cim, false, true);
  };
  fruitInst(fruitLists.red, fruitM); fruitInst(fruitLists.orange, fruitOrangeM); fruitInst(fruitLists.green, fruitGreenM);
  W.mats.tomato = fruitM.material;

  // corn rows at the sides
  const cornV = [P.cornPlant(11), P.cornPlant(12), P.cornPlant(13)];
  const cornM = windy(std({ vertexColors: true, map: veinT.map, normalMap: veinT.normalMap, roughness: 0.6, side: THREE.DoubleSide }), { amp: 0.06, attr: true });
  let ci = 0;
  for (const side of [-1, 1]) for (let k = 0; k < 5; k++) for (const zz of [-1.78, -2.06]) {
    const x = side * (1.45 + k * 0.42 + (zz < -2 ? 0.21 : 0)) + (r() - 0.5) * 0.08;
    const m = new THREE.Mesh(cornV[ci++ % 3].geo, cornM.material); m.position.set(x, 0.04, zz + (r() - 0.5) * 0.08); m.rotation.y = r() * 6.28;
    m.scale.setScalar(0.78 + r() * 0.16); m.customDepthMaterial = cornM.depth; add(m, true, true);
  }

  // lettuce rows
  const letV = [P.lettuce(21), P.lettuce(22, true), P.lettuce(23), P.lettuce(24, true)];
  const letM = windy(std({ vertexColors: true, map: veinT.map, normalMap: veinT.normalMap, roughness: 0.45, side: THREE.DoubleSide }), { amp: 0.015, attr: true });
  const letSpots = [];
  for (let k = 0; k < 7; k++) letSpots.push([0.62 + k * 0.36, -0.32]);
  for (let k = 0; k < 4; k++) letSpots.push([-2.75 + k * 0.36, -0.32]);
  for (let k = 0; k < 6; k++) letSpots.push([-0.9 + k * 0.36, -1.92]);
  letSpots.forEach(([x, z], i) => {
    const m = new THREE.Mesh(letV[i % 4], letM.material); m.position.set(x + (r() - 0.5) * 0.06, 0.05, z + (r() - 0.5) * 0.06);
    m.rotation.y = r() * 6.28; m.scale.setScalar(0.9 + r() * 0.35); m.customDepthMaterial = letM.depth; add(m, true, true);
  });

  // marigolds along the front border
  const mg = [P.marigold(31), P.marigold(32), P.marigold(33)];
  const flowerM = windy(std({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide }), { amp: 0.03, attr: true });
  for (let k = 0; k < 26; k++) {
    const x = k < 13 ? lerp(0.55, 2.9, k / 12) : lerp(-2.9, -1.55, (k - 13) / 12);
    const m = new THREE.Mesh(mg[k % 3], flowerM.material); m.position.set(x + (r() - 0.5) * 0.06, 0, ZC - 0.12 - r() * 0.08);
    m.rotation.y = r() * 6.28; m.scale.setScalar(0.9 + r() * 0.5); add(m, false, true);
  }

  // ---------------------------------------------------------------- fence
  const fw = T.wood('weathered');
  const fenceMat = std({ map: fw.map, normalMap: fw.normalMap, roughnessMap: fw.roughnessMap, color: 0xf0e4d4 });
  const fx0 = -7.2, fx1 = 7.2;
  const picket = new THREE.BoxGeometry(0.085, 0.92, 0.022); picket.translate(0, 0.46, 0);
  const nPick = Math.floor((fx1 - fx0) / 0.125);
  const pim = new THREE.InstancedMesh(picket, fenceMat, nPick);
  for (let i = 0; i < nPick; i++) { m4.compose(new THREE.Vector3(fx0 + i * 0.125, 0, FENCE_Z + 0.04), q.setFromEuler(new THREE.Euler(0, 0, (r() - 0.5) * 0.025)), sv.set(1, 0.97 + r() * 0.05, 1)); pim.setMatrixAt(i, m4); }
  add(pim, true, true);
  for (let x = fx0; x <= fx1 + 0.01; x += 1.6) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.12, 0.1), fenceMat); post.position.set(x, 0.56, FENCE_Z); add(post, true, true);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.035, 0.14), fenceMat); cap.position.set(x, 1.13, FENCE_Z); add(cap, true, true);
  }
  for (const y of [0.25, 0.75]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(fx1 - fx0, 0.07, 0.04), fenceMat); rail.position.set(0, y, FENCE_Z - 0.01); add(rail, true, true); }
  const topRail = new THREE.Mesh(new THREE.BoxGeometry(fx1 - fx0, 0.04, 0.11), fenceMat); topRail.position.set(0, FENCE_TOP - 0.02, FENCE_Z + 0.02); add(topRail, true, true);

  // ---------------------------------------------------------------- bushes (crows dive into these)
  const leafT = T.leafy('#3f7a26', '#7fb243');
  const bushMats = [];
  W.bushes = BUSHES.map((b, i) => {
    const grp = new THREE.Group(); grp.position.set(b.x, 0, b.z);
    const m = windy(std({ map: leafT.map, normalMap: leafT.normalMap, roughnessMap: leafT.roughnessMap, color: 0xdfe8d0 }), { amp: 0.02, ref: b.r * 2 });
    bushMats.push(m.material);
    const core = new THREE.Mesh(P.blob(b.r, 70 + i, { amp: 0.16, freq: 1.8, squash: 0.85 }), m.material); core.position.y = b.r * 0.72;
    core.castShadow = true; core.receiveShadow = true; grp.add(core);
    const shellM = windy(std({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide }), { amp: 0.03, ref: b.r * 2 });
    const shell = new THREE.Mesh(P.leafShell(b.r, 260, 80 + i, { size: 0.1, squash: 0.85 }), shellM.material); shell.position.y = b.r * 0.72; shell.receiveShadow = true; grp.add(shell);
    W.group.add(grp);
    return { grp, core, shell, base: b };
  });

  // ---------------------------------------------------------------- house
  W.house = buildHouse(W.group);

  // ---------------------------------------------------------------- trees
  const bk = T.bark(); const barkMat = std({ map: bk.map, normalMap: bk.normalMap, roughness: 0.95 });
  const canopyT = T.leafy('#3a6e22', '#6fa23a', 171);
  const canopyMat = windy(std({ map: canopyT.map, normalMap: canopyT.normalMap, roughnessMap: canopyT.roughnessMap, color: 0xe6ecd6 }), { amp: 0.06, ref: 6 });
  const shellMat = windy(std({ vertexColors: true, roughness: 0.65, side: THREE.DoubleSide }), { amp: 0.08, ref: 6 });
  const tree = (x, z, s, seed) => {
    const grp = new THREE.Group(); grp.position.set(x, 0, z); grp.scale.setScalar(s);
    const trunkC = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.1, 1.2, 0), new THREE.Vector3(-0.05, 2.4, 0.05), new THREE.Vector3(0.05, 3.2, 0)]);
    const trunk = new THREE.Mesh(new THREE.TubeGeometry(trunkC, 12, 0.18, 8), barkMat); trunk.castShadow = true; grp.add(trunk);
    const rr = rng(seed);
    for (let k = 0; k < 7; k++) {
      const rad = 0.9 + rr() * 0.7; const a = k * 1.9; const c = new THREE.Mesh(P.blob(rad, seed + k, { amp: 0.18, freq: 1.5 }), canopyMat.material);
      c.position.set(Math.cos(a) * 0.9 * (k ? 1 : 0), 3.5 + rr() * 1.1 + (k ? 0 : 0.6), Math.sin(a) * 0.7 * (k ? 1 : 0)); c.castShadow = true; c.receiveShadow = true; grp.add(c);
      const sh = new THREE.Mesh(P.leafShell(rad, 160, seed + 40 + k, { size: 0.22, color: [0.22, 0.42, 0.13] }), shellMat.material); sh.position.copy(c.position); grp.add(sh);
    }
    W.group.add(grp); return grp;
  };
  tree(5.4, -11.5, 1.1, 201);
  tree(-9.5, -19, 1.35, 202);
  tree(9.5, -19.5, 1.25, 203);
  tree(2.6, -20.5, 1.0, 204);

  W.bushMats = bushMats;
  return W;
}

// ------------------------------------------------------------------ house
function buildHouse(parent) {
  const grp = new THREE.Group(); grp.position.set(-4.9, 0, -16.2); grp.scale.setScalar(0.95); parent.add(grp);
  const sd = T.siding(); sd.map.repeat.set(3, 2.6); sd.normalMap.repeat.set(3, 2.6);
  const wallMat = std({ map: sd.map, normalMap: sd.normalMap, roughness: 0.85, color: 0xfff6e8 });
  const trimMat = std({ color: 0xf7f2ea, roughness: 0.6 });
  const shutterMat = std({ color: 0x2f6fb4, roughness: 0.55 });
  const sh = T.shingles(); sh.map.repeat.set(4, 2.5); sh.normalMap.repeat.set(4, 2.5);
  const roofMat = std({ map: sh.map, normalMap: sh.normalMap, roughness: 0.85, side: THREE.DoubleSide });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x8aa2bd, roughness: 0.06, metalness: 0.65, emissive: 0xffb45c, emissiveIntensity: 0.0, clearcoat: 1 });
  const Wd = 7.4, D = 5, Hw = 5.3;
  const body = new THREE.Mesh(new THREE.BoxGeometry(Wd, Hw, D), wallMat); body.position.y = Hw / 2; body.castShadow = true; body.receiveShadow = true; grp.add(body);
  // gable roof along x
  const roofH = 2.3, over = 0.35;
  const shape = new THREE.Shape(); shape.moveTo(-D / 2 - over, 0); shape.lineTo(0, roofH); shape.lineTo(D / 2 + over, 0); shape.lineTo(-D / 2 - over, 0);
  const gable = new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-D / 2, 0), new THREE.Vector2(0, roofH - 0.12), new THREE.Vector2(D / 2, 0)]), { depth: Wd - 0.02, bevelEnabled: false }), wallMat);
  gable.rotation.y = Math.PI / 2; gable.position.set(-Wd / 2 + 0.01, Hw, 0); grp.add(gable);
  const slope = Math.hypot(D / 2 + over, roofH); const ang = Math.atan2(roofH, D / 2 + over);
  for (const s of [-1, 1]) {
    const pl = new THREE.Mesh(new THREE.BoxGeometry(Wd + 0.6, 0.12, slope), roofMat);
    pl.position.set(0, Hw + roofH / 2 - 0.02, s * (D / 2 + over) / 2); pl.rotation.x = s * ang; pl.castShadow = true; pl.receiveShadow = true; grp.add(pl);
  }
  const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, Wd + 0.6, 8), roofMat); ridge.rotation.z = Math.PI / 2; ridge.position.set(0, Hw + roofH + 0.02, 0); grp.add(ridge);
  const chim = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.2, 0.7), std({ color: 0xa4533c, roughness: 0.9 })); chim.position.set(2.2, Hw + 1.7, -0.9); chim.castShadow = true; grp.add(chim);
  // windows with shutters (front facade at z = D/2)
  const windows = [];
  const winAt = (x, y, w = 1.0, h = 1.35) => {
    const fz = D / 2 + 0.02;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, h + 0.2, 0.08), trimMat); frame.position.set(x, y, fz); grp.add(frame);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glassMat); glass.position.set(x, y, fz + 0.045); grp.add(glass); windows.push(glass);
    const mullV = new THREE.Mesh(new THREE.BoxGeometry(0.05, h, 0.03), trimMat); mullV.position.set(x, y, fz + 0.06); grp.add(mullV);
    const mullH = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, 0.03), trimMat); mullH.position.set(x, y, fz + 0.06); grp.add(mullH);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(w + 0.35, 0.08, 0.2), trimMat); sill.position.set(x, y - h / 2 - 0.12, fz + 0.06); grp.add(sill);
    for (const s of [-1, 1]) {
      const sh = new THREE.Mesh(new THREE.BoxGeometry(0.42, h + 0.15, 0.05), shutterMat); sh.position.set(x + s * (w / 2 + 0.35), y, fz + 0.03); sh.castShadow = true; grp.add(sh);
      for (let k = 0; k < 7; k++) { const sl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.035, 0.025), shutterMat); sl.position.set(sh.position.x, y - h / 2 + 0.15 + k * (h - 0.15) / 7, fz + 0.065); sl.rotation.x = -0.5; grp.add(sl); }
    }
  };
  for (const x of [-2.3, 0.0, 2.3]) winAt(x, 3.85);
  winAt(-2.3, 1.55); winAt(2.3, 1.55);
  // door with little porch roof
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.1, 0.08), std({ color: 0x2a5f9e, roughness: 0.5 })); door.position.set(0, 1.05, D / 2 + 0.03); grp.add(door);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), std({ color: 0xd9b25a, metalness: 1, roughness: 0.3 })); knob.position.set(0.36, 1.05, D / 2 + 0.09); grp.add(knob);
  const dframe = new THREE.Mesh(new THREE.BoxGeometry(1.25, 2.3, 0.06), trimMat); dframe.position.set(0, 1.12, D / 2 + 0.01); grp.add(dframe);
  const porch = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.1, 1.0), roofMat); porch.position.set(0, 2.55, D / 2 + 0.5); porch.rotation.x = 0.18; porch.castShadow = true; grp.add(porch);
  const step = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.18, 0.7), std({ color: 0xb8b0a4, roughness: 0.9 })); step.position.set(0, 0.09, D / 2 + 0.35); grp.add(step);
  // foundation strip + corner trim
  const fnd = new THREE.Mesh(new THREE.BoxGeometry(Wd + 0.1, 0.35, D + 0.1), std({ color: 0x9b9184, roughness: 0.95 })); fnd.position.y = 0.17; grp.add(fnd);
  for (const s of [-1, 1]) { const ct = new THREE.Mesh(new THREE.BoxGeometry(0.16, Hw, 0.16), trimMat); ct.position.set(s * Wd / 2, Hw / 2, D / 2); grp.add(ct); }
  const eave = new THREE.Mesh(new THREE.BoxGeometry(Wd + 0.4, 0.14, 0.12), trimMat); eave.position.set(0, Hw - 0.02, D / 2 + 0.06); grp.add(eave);
  return { grp, glassMat, windows };
}
