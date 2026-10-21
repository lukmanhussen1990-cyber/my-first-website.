// The diorama: a slice of parking lot on a gentle hill, cut open at the edges.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32, sstep, fbm2, clamp } from './util.js';
import * as TX from './textures.js';

export const LOT = { x0: -40, x1: 31, z0: -34, z1: 0 };
export const SLAB_BOTTOM = -6.2;

// ground height of the lot surface
export function groundH(x, z) {
  const d = -z;
  const hx = 1.5 * (1 - sstep(-20, 28, x));
  const sp = (u) => Math.log(1 + Math.exp(u));
  const back = 0.085 * sp(d - 9) * sstep(-18, -14, x); // hill rising behind the front lane
  return hx + 0.025 * d + back;
}

export const STALL = { w: 2.6, depth: 5.0 };
// parking stall blocks: car centres
export function parkingLayout() {
  const spots = [];
  const row = (x0, x1, zFront, facing) => { // facing: +1 nose to -Z (rear to lane at zFront)
    for (let x = x0 + STALL.w / 2; x <= x1 - STALL.w / 2 + 1e-6; x += STALL.w) spots.push({ x, z: zFront - facing * STALL.depth / 2, facing });
  };
  // row 1: rears face the front lane at z=-9.0
  row(-15.9, 8.6, -9.0, 1);
  row(14.6, 22.4, -9.0, 1);
  // rows 2-3 (back-to-back) behind the back lane
  row(-15.9, 8.6, -20.5, 1);
  row(14.6, 22.4, -20.5, 1);
  row(-15.9, 8.6, -30.6, -1);
  row(14.6, 22.4, -30.6, -1);
  return spots;
}

// ------------------------------------------------------------------------------------------
export function buildWorld(scene, env) {
  const rnd = mulberry32(2024);
  const world = { dynamic: {} };
  const asphalt = TX.makeAsphalt();
  asphalt.map.repeat.set(1 / 6, 1 / 6); asphalt.normalMap.repeat.set(1 / 6, 1 / 6); asphalt.roughnessMap.repeat.set(1 / 6, 1 / 6);
  const rect = { x0: LOT.x0, x1: LOT.x1, z0: LOT.z0, z1: LOT.z1 };
  const spots = parkingLayout();
  world.spots = spots;

  // ---------------- lot paint (lines, arrows, tire marks, stains)
  const paint = TX.makeLotPaint(rect, 56, (ctx) => {
    const R = mulberry32(7);
    // concrete apron in front of the store
    ctx.fillStyle = 'rgba(178,170,158,0.95)'; ctx.fillRect(-40, -12.6, 22.4, 3.1);
    for (let x = -40; x < -17.6; x += 1.5) { ctx.fillStyle = 'rgba(90,85,80,0.35)'; ctx.fillRect(x, -12.6, 0.03, 3.1); }
    ctx.fillStyle = 'rgba(90,85,80,0.35)'; ctx.fillRect(-40, -11.05, 22.4, 0.03);
    // stall lines
    ctx.strokeStyle = 'rgba(245,245,238,0.92)'; ctx.lineWidth = 0.12;
    const blocks = [[-15.9, 8.6], [14.6, 22.4]];
    for (const [a, b] of blocks) {
      for (const [zA, zB] of [[-9.0, -14.0], [-20.5, -25.5], [-25.6, -30.6]]) {
        for (let x = a; x <= b + 1e-6; x += STALL.w) { ctx.beginPath(); ctx.moveTo(x, zA); ctx.lineTo(x, zB); ctx.stroke(); }
      }
    }
    // lane edge dashes (front lane centre line)
    ctx.fillStyle = 'rgba(250,214,80,0.85)';
    for (let x = -17; x < 30; x += 3) ctx.fillRect(x, -5.05, 1.6, 0.12);
    // big painted arrows on the lane
    const arrow = (x, z, ang, s = 1) => {
      ctx.save(); ctx.translate(x, z); ctx.rotate(ang); ctx.scale(s, s); ctx.fillStyle = 'rgba(248,248,240,0.88)';
      ctx.beginPath(); ctx.moveTo(-1.6, -0.18); ctx.lineTo(0.4, -0.18); ctx.lineTo(0.4, -0.55); ctx.lineTo(1.4, 0); ctx.lineTo(0.4, 0.55); ctx.lineTo(0.4, 0.18); ctx.lineTo(-1.6, 0.18); ctx.closePath(); ctx.fill(); ctx.restore();
    };
    arrow(-2, -6.8, 0); arrow(17, -6.8, 0); arrow(11.6, -17, -Math.PI / 2); arrow(26, -14, Math.PI / 2); arrow(26, -24, Math.PI / 2);
    // curved turn arrow before aisle A
    ctx.strokeStyle = 'rgba(248,248,240,0.88)'; ctx.lineWidth = 0.36; ctx.beginPath(); ctx.arc(6.6, -10.4, 2.0, Math.PI * 0.5, Math.PI * 0.02, true); ctx.stroke();
    ctx.fillStyle = 'rgba(248,248,240,0.88)'; ctx.beginPath(); ctx.moveTo(8.05, -10.6); ctx.lineTo(9.15, -10.6); ctx.lineTo(8.6, -11.7); ctx.closePath(); ctx.fill();
    // pedestrian zebra in front of the entrance
    for (let x = -34.6; x < -30; x += 0.9) { ctx.fillStyle = 'rgba(250,250,245,0.85)'; ctx.fillRect(x, -9.4, 0.5, 2.4); }
    // start line (x=10) and finish line (x=-9): checkered strips
    const checker = (x0, w) => { const s = 0.45; let k = 0; for (let z = -8.8; z < -0.6; z += s) { for (let c = 0; c < 2; c++) { ctx.fillStyle = ((k + c) % 2) ? 'rgba(20,20,22,0.95)' : 'rgba(250,250,250,0.95)'; ctx.fillRect(x0 + c * s, z, s, s); } k++; } };
    checker(10.25, 0.9); checker(-9.45, 0.9);
    // oil stains in stalls
    for (const s of spots) { if (R() < 0.6) { ctx.fillStyle = `rgba(15,14,18,${0.12 + R() * 0.18})`; ctx.beginPath(); ctx.ellipse(s.x + (R() - 0.5), s.z + (R() - 0.5), 0.3 + R() * 0.5, 0.2 + R() * 0.3, R() * 3, 0, 6.28); ctx.fill(); } }
    // tire marks: soft dark arcs everywhere
    ctx.lineCap = 'round';
    for (let i = 0; i < 70; i++) {
      const x = -36 + R() * 64, z = -32 + R() * 31, r = 2 + R() * 9, a0 = R() * 6.28, a1 = a0 + 0.3 + R() * 0.9;
      ctx.strokeStyle = `rgba(8,8,10,${0.06 + R() * 0.12})`; ctx.lineWidth = 0.08 + R() * 0.1;
      for (const o of [0, 0.5]) { ctx.beginPath(); ctx.arc(x, z, r + o, a0, a1); ctx.stroke(); }
    }
    // patch repairs
    for (let i = 0; i < 14; i++) { ctx.fillStyle = `rgba(35,35,40,${0.15 + R() * 0.15})`; const x = -36 + R() * 64, z = -32 + R() * 30; ctx.fillRect(x, z, 0.8 + R() * 2.2, 0.6 + R() * 1.6); }
    // drain grates
    for (const [x, z] of [[-3, -3], [20, -3.6], [11.6, -14], [-24, -8]]) { ctx.fillStyle = 'rgba(30,30,32,0.95)'; ctx.fillRect(x - 0.35, z - 0.2, 0.7, 0.4); ctx.fillStyle = 'rgba(110,110,115,0.9)'; for (let k = 0; k < 6; k++) ctx.fillRect(x - 0.3 + k * 0.11, z - 0.16, 0.05, 0.32); }
    // manhole
    ctx.fillStyle = 'rgba(70,68,66,0.95)'; ctx.beginPath(); ctx.arc(2.0, -2.6, 0.38, 0, 6.28); ctx.fill();
    ctx.strokeStyle = 'rgba(40,40,40,0.9)'; ctx.lineWidth = 0.04; for (let r = 0.1; r < 0.36; r += 0.08) { ctx.beginPath(); ctx.arc(2.0, -2.6, r, 0, 6.28); ctx.stroke(); }
  });

  // ---------------- top surface heightfield
  const segX = 284, segZ = 136;
  const g = new THREE.PlaneGeometry(LOT.x1 - LOT.x0, LOT.z1 - LOT.z0, segX, segZ);
  g.rotateX(-Math.PI / 2);
  g.translate((LOT.x0 + LOT.x1) / 2, 0, (LOT.z0 + LOT.z1) / 2);
  const pa = g.attributes.position;
  for (let i = 0; i < pa.count; i++) pa.setY(i, groundH(pa.getX(i), pa.getZ(i)));
  g.computeVertexNormals();
  const uv = g.attributes.uv; // use world xz for tiling
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pa.getX(i), -pa.getZ(i));
  const groundMat = new THREE.MeshStandardMaterial({ map: asphalt.map, normalMap: asphalt.normalMap, roughnessMap: asphalt.roughnessMap, roughness: 1.0, metalness: 0.0, normalScale: new THREE.Vector2(0.6, 0.6), envMapIntensity: 0.55 });
  groundMat.onBeforeCompile = (sh) => {
    sh.uniforms.paintMap = { value: paint };
    sh.uniforms.paintRect = { value: new THREE.Vector4(rect.x0, rect.z0, rect.x1 - rect.x0, rect.z1 - rect.z0) };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed,1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nuniform sampler2D paintMap;\nuniform vec4 paintRect;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec2 puv = vec2((vWPos.x - paintRect.x) / paintRect.z, 1.0 - (vWPos.z - paintRect.y) / paintRect.w);
        vec4 pc = texture2D(paintMap, puv);
        diffuseColor.rgb = mix(diffuseColor.rgb, pc.rgb, pc.a);
        float paintA = pc.a;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.55, paintA * step(0.5, pc.r));`);
  };
  const ground = new THREE.Mesh(g, groundMat);
  ground.receiveShadow = true;
  scene.add(ground);
  world.ground = ground;

  // ---------------- cut faces (soil layers)
  const soil = TX.makeSoil();
  const soilMat = new THREE.MeshStandardMaterial({ map: soil.map, normalMap: soil.normalMap, normalScale: new THREE.Vector2(1.2, 1.2), roughness: 0.93, metalness: 0, envMapIntensity: 0.35, emissive: 0xffffff, emissiveMap: soil.map, emissiveIntensity: 0.14 });
  const faceGeo = (pts, outward) => { // pts: [[x,z],...] along the edge, outward normal side
    const pos = [], uvs = [], idx = [];
    let along = 0;
    for (let i = 0; i < pts.length; i++) {
      const [x, z] = pts[i];
      if (i > 0) along += Math.hypot(x - pts[i - 1][0], z - pts[i - 1][1]);
      const top = groundH(x, z) + 0.002;
      pos.push(x, top, z, x, SLAB_BOTTOM, z);
      uvs.push(along / soil.repeatMeters, 1.0, along / soil.repeatMeters, 1.0 - (top - SLAB_BOTTOM) / TX.SOIL_DEPTH);
      if (i > 0) { const a = (i - 1) * 2, b = i * 2; if (outward) idx.push(a, a + 1, b, b, a + 1, b + 1); else idx.push(a, b, a + 1, b, b + 1, a + 1); }
    }
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    fg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    fg.setIndex(idx); fg.computeVertexNormals();
    return fg;
  };
  const line = (x0, z0, x1, z1, n) => { const p = []; for (let i = 0; i <= n; i++) p.push([x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n]); return p; };
  const faces = [
    faceGeo(line(LOT.x0, 0, LOT.x1, 0, 284), true),
    faceGeo(line(LOT.x1, 0, LOT.x1, LOT.z0, 136), true),
    faceGeo(line(LOT.x1, LOT.z0, LOT.x0, LOT.z0, 284), true),
    faceGeo(line(LOT.x0, LOT.z0, LOT.x0, 0, 136), true),
  ];
  for (const fg of faces) { const m = new THREE.Mesh(fg, soilMat); m.receiveShadow = true; m.castShadow = true; scene.add(m); }
  // bottom
  const bottom = new THREE.Mesh(new THREE.PlaneGeometry(LOT.x1 - LOT.x0, LOT.z1 - LOT.z0), new THREE.MeshStandardMaterial({ color: 0x3b2e26, roughness: 1 }));
  bottom.rotation.x = Math.PI / 2; bottom.position.set((LOT.x0 + LOT.x1) / 2, SLAB_BOTTOM, (LOT.z0 + LOT.z1) / 2); scene.add(bottom);
  // 3D pebbles poking out of the cut faces
  {
    const pg = new THREE.IcosahedronGeometry(1, 1);
    const pp = pg.attributes.position; for (let i = 0; i < pp.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(pp, i); v.multiplyScalar(0.85 + 0.3 * Math.abs(Math.sin(v.x * 7 + v.y * 5))); pp.setXYZ(i, v.x, v.y, v.z); } pg.computeVertexNormals();
    const pm = new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0, vertexColors: false });
    const N = 520; const inst = new THREE.InstancedMesh(pg, pm, N); const M = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      let x, z, nx, nz;
      const side = rnd();
      if (side < 0.7) { x = LOT.x0 + rnd() * (LOT.x1 - LOT.x0); z = 0; nx = 0; nz = 1; } else if (side < 0.85) { x = LOT.x1; z = LOT.z0 * rnd(); nx = 1; nz = 0; } else { x = LOT.x0; z = LOT.z0 * rnd(); nx = -1; nz = 0; }
      const top = groundH(x, z); const depth = 0.3 + Math.pow(rnd(), 0.8) * (top - SLAB_BOTTOM - 0.5);
      const s = (depth < 0.5 ? 0.02 + rnd() * 0.03 : 0.04 + rnd() * rnd() * 0.22);
      const p = new THREE.Vector3(x + nx * s * 0.25, top - depth, z + nz * s * 0.25);
      q.setFromEuler(new THREE.Euler(rnd() * 6, rnd() * 6, rnd() * 6));
      M.compose(p, q, new THREE.Vector3(s * (1 + rnd() * 0.5), s * (0.6 + rnd() * 0.3), s * (0.8 + rnd() * 0.4)));
      inst.setMatrixAt(i, M);
      const l = 0.35 + rnd() * 0.4; c.setRGB(l * (1 + rnd() * 0.15), l * 0.95, l * (0.85 + rnd() * 0.15)); inst.setColorAt(i, c);
    }
    inst.castShadow = true; inst.receiveShadow = true; scene.add(inst);
  }

  // ---------------- common materials
  const concrete = new THREE.MeshStandardMaterial({ color: 0xa59d92, roughness: 0.9 });
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x5f8f3a, roughness: 0.95 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.45, metalness: 0.7 });

  // curbs + grass strips along back & right edges
  const addCurbStrip = (x0, x1, z0, z1) => {
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const h0 = groundH(cx, cz);
    const curb = new THREE.Mesh(new RoundedBoxGeometry(w, 0.3, d, 2, 0.05), concrete); curb.position.set(cx, h0 + 0.02, cz); curb.receiveShadow = curb.castShadow = true; scene.add(curb);
    const gr = new THREE.Mesh(new RoundedBoxGeometry(w - 0.3, 0.3, d - 0.3, 2, 0.08), grassMat); gr.position.set(cx, h0 + 0.06, cz); gr.receiveShadow = true; scene.add(gr);
    return h0 + 0.21;
  };
  addCurbStrip(-16.5, 31, -34, -31.2);

  // ---------------- trees
  const leafMats = [0x4f8a3b, 0x5b9a40, 0x6aa548, 0x477f36].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }));
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a32, roughness: 0.9 });
  const blob = (r, seed) => {
    const geo = new THREE.SphereGeometry(r, 28, 20); const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i); const n = fbm2(v.x * 2.2 + seed, v.y * 2.2 + v.z * 1.7, 3); v.multiplyScalar(1 + n * 0.22); p.setXYZ(i, v.x, v.y, v.z); }
    geo.computeVertexNormals(); return geo;
  };
  const addTree = (x, z, s = 1, baseY = null) => {
    const y0 = baseY ?? groundH(x, z);
    const t = new THREE.Group(); t.position.set(x, y0, z);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.18 * s, 2.2 * s, 10), trunkMat); trunk.position.y = 1.1 * s; trunk.castShadow = true; t.add(trunk);
    const n = 3 + Math.floor(rnd() * 2);
    for (let i = 0; i < n; i++) {
      const r = (0.9 + rnd() * 0.5) * s; const m = new THREE.Mesh(blob(r, rnd() * 10), leafMats[Math.floor(rnd() * leafMats.length)]);
      m.position.set((rnd() - 0.5) * 1.2 * s, (2.5 + rnd() * 0.9) * s, (rnd() - 0.5) * 1.2 * s); m.castShadow = true; m.receiveShadow = true; t.add(m);
    }
    scene.add(t); return t;
  };
  for (let x = -14; x < 30; x += 4.2 + rnd() * 1.5) addTree(x, -32.6, 0.9 + rnd() * 0.35, groundH(x, -32.6) + 0.2);
  addTree(30.15, -29.5, 0.8, groundH(30.15, -29.5) + 0.2);
  for (let z = -30; z < -14; z += 5) addTree(-39.0, z, 0.8 + rnd() * 0.3);
  for (let x = -37; x < -17; x += 3.4 + rnd() * 1.2) addTree(x, -26.5 - rnd() * 4, 0.9 + rnd() * 0.4);

  // ---------------- islands at row ends (curb + grass + lamp post)
  const islands = [];
  const addIsland = (x0, x1, z0, z1, lamp = true, tree = false) => {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, h0 = groundH(cx, cz);
    const c = new THREE.Mesh(new RoundedBoxGeometry(x1 - x0, 0.32, z1 - z0, 3, 0.12), concrete); c.position.set(cx, h0 + 0.04, cz); c.castShadow = c.receiveShadow = true; scene.add(c);
    const gr = new THREE.Mesh(new RoundedBoxGeometry(x1 - x0 - 0.28, 0.3, z1 - z0 - 0.28, 3, 0.1), grassMat); gr.position.set(cx, h0 + 0.08, cz); gr.receiveShadow = true; scene.add(gr);
    islands.push({ x0, x1, z0, z1 });
    if (tree) addTree(cx, cz, 0.7, h0 + 0.22);
    return { cx, cz, top: h0 + 0.22 };
  };
  addIsland(-17.5, -16.1, -14.0, -9.2, false, true);
  addIsland(8.7, 9.9, -14.0, -9.4, true);
  addIsland(13.3, 14.5, -14.0, -9.4, false, true);
  addIsland(8.7, 9.9, -30.6, -20.5, false, true);
  addIsland(13.3, 14.5, -30.6, -20.5, true);
  addIsland(22.5, 23.0, -14.0, -9.4, true);

  // ---------------- lamp posts (glowing heads)
  const lampGlow = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffd9a0, emissiveIntensity: 9 });
  const glowTex = TX.makeGlowSprite();
  const addLamp = (x, z, rotY = 0) => {
    const y0 = groundH(x, z) + 0.2;
    const L = new THREE.Group(); L.position.set(x, y0, z); L.rotation.y = rotY;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 5.4, 12), darkMetal); pole.position.y = 2.7; pole.castShadow = true; L.add(pole);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.35, 16), concrete); base.position.y = 0.17; L.add(base);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.07, 0.08), darkMetal); arm.position.set(0.5, 5.35, 0); L.add(arm);
    const head = new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.16, 0.34, 2, 0.05), darkMetal); head.position.set(1.0, 5.3, 0); head.castShadow = true; L.add(head);
    const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.03, 0.24), lampGlow); bulb.position.set(1.0, 5.215, 0); L.add(bulb);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffc98a, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    sp.scale.set(1.6, 1.6, 1); sp.position.set(1.0, 5.15, 0); L.add(sp);
    scene.add(L);
  };
  addLamp(9.3, -13.6, 0); addLamp(13.9, -25, Math.PI); addLamp(22.75, -13.6, Math.PI); addLamp(-16.8, -13.6, 0);

  // ---------------- parked cars
  world.cars = [];
  const carColors = [0x2bb3a3, 0xf2c14e, 0xe8574d, 0xf3f0e8, 0x9a7fd1, 0x5aa9e6, 0x7ccf8a, 0xf08a4b, 0x3d5a80, 0xd94f70, 0xc7d3dd, 0xffb7c5];
  let ci = 0;
  for (const s of spots) {
    if (rnd() < 0.18 && !(s.x > -15 && s.x < -13.5 && s.z > -12)) continue; // some empty stalls (keep the bonk car)
    const car = makeToyCar(carColors[ci++ % carColors.length], rnd);
    const y = groundH(s.x, s.z);
    car.position.set(s.x + (rnd() - 0.5) * 0.12, y, s.z + (rnd() - 0.5) * 0.15);
    car.rotation.y = (s.facing > 0 ? Math.PI / 2 : -Math.PI / 2) + (rnd() - 0.5) * 0.05; // nose to -Z (facing>0)
    // pitch with the slope
    const dz = groundH(s.x, s.z - 1) - groundH(s.x, s.z + 1);
    car.rotateOnAxis(new THREE.Vector3(0, 0, 1), Math.atan2(dz, 2) * (s.facing > 0 ? 1 : -1));
    scene.add(car);
    world.cars.push({ obj: car, spot: s });
  }
  // the car John bonks into (row 1, first stall)
  world.bonkCar = world.cars.find((c) => Math.abs(c.spot.x - (-14.6)) < 0.1 && c.spot.z > -15)?.obj;

  // ---------------- the store
  world.store = buildStore(scene, env, concrete, darkMetal, glowTex);

  // ---------------- cones (static ones; race/turn cones placed by the timeline)
  world.makeCone = () => makeCone();

  // ---------------- background hills + far trees
  {
    const hillMat = new THREE.MeshStandardMaterial({ color: 0x5f5378, roughness: 1, fog: true, side: THREE.BackSide });
    const hillMat2 = new THREE.MeshStandardMaterial({ color: 0x8b7598, roughness: 1, fog: true, side: THREE.BackSide });
    const ridge = (radius, height, seed, mat, y0) => {
      const geo = new THREE.CylinderGeometry(radius, radius, 1, 160, 8, true);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), z = p.getZ(i), yy = p.getY(i);
        const a = Math.atan2(z, x);
        const hh = height * (0.55 + 0.45 * (fbm2(Math.cos(a) * 3 + seed, Math.sin(a) * 3 + seed, 4) * 0.5 + 0.5));
        p.setY(i, y0 + (yy + 0.5) * hh);
        const k = 1 - (yy + 0.5) * 0.04; p.setX(i, x * k); p.setZ(i, z * k);
      }
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, mat); m.position.set(0, 0, -20); scene.add(m);
    };
    // distant town + forest silhouettes around the horizon
    {
      const R2 = mulberry32(77);
      const bG = new THREE.BoxGeometry(1, 1, 1); bG.translate(0, 0.5, 0);
      const town = new THREE.InstancedMesh(bG, new THREE.MeshStandardMaterial({ color: 0x8e7f9a, roughness: 1, fog: true }), 260);
      const tG = new THREE.SphereGeometry(1, 10, 8);
      const forest = new THREE.InstancedMesh(tG, new THREE.MeshStandardMaterial({ color: 0x5e6a6a, roughness: 1, fog: true }), 520);
      const M = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
      for (let i = 0; i < 260; i++) {
        const a = R2() * Math.PI * 2, r = 620 + R2() * 160;
        const w = 6 + R2() * 16, h = 3 + R2() * R2() * 12;
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a);
        M.compose(new THREE.Vector3(Math.cos(a) * r, -20, -20 + Math.sin(a) * r), q, new THREE.Vector3(w, h + 14, 6 + R2() * 10));
        town.setMatrixAt(i, M); c.setHSL(0.75 + R2() * 0.1, 0.12, 0.5 + R2() * 0.12); town.setColorAt(i, c);
      }
      for (let i = 0; i < 520; i++) {
        const a = R2() * Math.PI * 2, r = 420 + R2() * 90, s2 = 4 + R2() * 6;
        M.compose(new THREE.Vector3(Math.cos(a) * r, -16 + s2 * 0.6, -20 + Math.sin(a) * r), q.identity(), new THREE.Vector3(s2, s2 * 1.3, s2));
        forest.setMatrixAt(i, M); c.setHSL(0.35 + R2() * 0.08, 0.18, 0.32 + R2() * 0.08); forest.setColorAt(i, c);
      }
      scene.add(town, forest);
    }
    ridge(560, 26, 1.7, hillMat, -14);
    ridge(950, 52, 4.2, hillMat2, -22);
  }
  world.addTree = addTree;
  return world;
}

// ------------------------------------------------------------------------------------------
export function makeCone() {
  const g = new THREE.Group();
  const prof = [[0, 0.62], [0.035, 0.62], [0.05, 0.6], [0.16, 0.06], [0.17, 0.04], [0, 0.04]].map(([r, y]) => new THREE.Vector2(r, y));
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 28), new THREE.MeshStandardMaterial({ color: 0xff6a13, roughness: 0.38 }));
  body.castShadow = true; body.receiveShadow = true; g.add(body);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.083, 0.112, 0.12, 28, 1, true), new THREE.MeshStandardMaterial({ color: 0xf6f6f6, roughness: 0.25, metalness: 0.1 }));
  band.position.y = 0.33; g.add(band);
  const base = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.045, 0.42, 2, 0.015), new THREE.MeshStandardMaterial({ color: 0x1d1d20, roughness: 0.8 }));
  base.position.y = 0.022; base.castShadow = true; base.receiveShadow = true; g.add(base);
  return g;
}

// ------------------------------------------------------------------------------------------
const tread = { tex: null };
export function makeToyCar(color, rnd) {
  const car = new THREE.Group();
  const body = new THREE.Group(); car.add(body);
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.22, metalness: 0.08, envMapIntensity: 1.35 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x2a3a4c, roughness: 0.04, metalness: 0.5, envMapIntensity: 2.4 });
  const black = new THREE.MeshStandardMaterial({ color: 0x1b1c20, roughness: 0.75 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xdfe3e8, roughness: 0.18, metalness: 1.0 });
  if (!tread.tex) tread.tex = TX.makeTread();
  const tire = new THREE.MeshStandardMaterial({ map: tread.tex, roughness: 0.85 });
  // dimensions (x = length forward)
  const L = 3.7, W = 1.7, H1 = 0.62;
  const lower = new THREE.Mesh(new RoundedBoxGeometry(L, H1, W, 4, 0.22), paint); lower.position.y = 0.32 + H1 / 2; body.add(lower);
  const cabL = 2.0 + rnd() * 0.3, cabH = 0.62, cabW = W - 0.18;
  const cy = 0.32 + H1 + cabH / 2 - 0.08;
  const cab = new THREE.Mesh(new RoundedBoxGeometry(cabL, cabH, cabW, 4, 0.2), paint); cab.position.set(-0.15, cy, 0); body.add(cab);
  // glass: side strips (with a pillar), windshield + rear window, slightly proud of the cabin surface
  const side = new THREE.Mesh(new RoundedBoxGeometry(cabL - 0.42, cabH - 0.24, cabW + 0.02, 3, 0.07), glass); side.position.set(-0.15, cy + 0.02, 0); body.add(side);
  const pil = new THREE.Mesh(new THREE.BoxGeometry(0.09, cabH - 0.22, cabW + 0.035), paint); pil.position.set(-0.1, cy + 0.02, 0); body.add(pil);
  const ws = new THREE.Mesh(new RoundedBoxGeometry(cabL + 0.02, cabH - 0.22, cabW - 0.3, 3, 0.07), glass); ws.position.set(-0.15, cy + 0.01, 0); body.add(ws);
  // bumpers
  for (const sx of [1, -1]) {
    const b = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.22, W + 0.04, 2, 0.06), black); b.position.set(sx * (L / 2 + 0.02), 0.42, 0); body.add(b);
  }
  // lights
  const head = new THREE.MeshStandardMaterial({ color: 0xfff6e0, emissive: 0xfff0c8, emissiveIntensity: 1.2, roughness: 0.1 });
  const tail = new THREE.MeshStandardMaterial({ color: 0xc8202a, emissive: 0xff2030, emissiveIntensity: 1.6, roughness: 0.2 });
  for (const sz of [1, -1]) {
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), head); h.scale.set(0.5, 1, 1); h.position.set(L / 2 - 0.02, 0.7, sz * 0.58); body.add(h);
    const t = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.14, 0.32, 2, 0.03), tail); t.position.set(-L / 2 + 0.0, 0.72, sz * 0.55); body.add(t);
  }
  // plates (blank)
  const plate = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.14, 0.42, 2, 0.02), new THREE.MeshStandardMaterial({ color: 0xf2efe0, roughness: 0.5 }));
  plate.position.set(-L / 2 - 0.08, 0.45, 0); body.add(plate); const p2 = plate.clone(); p2.position.x = L / 2 + 0.08; body.add(p2);
  // mirrors
  for (const sz of [1, -1]) { const m = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.1, 0.16, 2, 0.03), paint); m.position.set(0.55, 1.0, sz * (W / 2 + 0.06)); body.add(m); }
  // wheels
  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 28); wheelGeo.rotateX(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.19, 0.19, 0.25, 20); hubGeo.rotateX(Math.PI / 2);
  for (const sx of [1, -1]) for (const sz of [1, -1]) {
    const w = new THREE.Mesh(wheelGeo, tire); w.position.set(sx * 1.2, 0.34, sz * (W / 2 - 0.08)); w.castShadow = true; car.add(w);
    const hb = new THREE.Mesh(hubGeo, chrome); hb.position.copy(w.position); car.add(hb);
  }
  body.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  car.userData.body = body;
  return car;
}

// ------------------------------------------------------------------------------------------
function buildStore(scene, env, concrete, darkMetal, glowTex) {
  const S = new THREE.Group(); scene.add(S);
  const x0 = -38, x1 = -18, zf = -12.5, zb = -23.0, Hh = 7.6;
  const y0 = groundH(-28, zf) - 0.05;
  const wall = new THREE.MeshStandardMaterial({ color: 0xe9dcc8, roughness: 0.85 });
  const accent = new THREE.MeshStandardMaterial({ color: 0x2f8f83, roughness: 0.55, emissive: 0x1d4a44, emissiveIntensity: 0.6 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x3b4148, roughness: 0.5, metalness: 0.5 });
  // main box
  const box = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, Hh, zf - zb), wall); box.position.set((x0 + x1) / 2, y0 + Hh / 2, (zf + zb) / 2); box.castShadow = box.receiveShadow = true; S.add(box);
  // parapet band + accent stripe
  const band = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 + 0.3, 2.3, 0.5), accent); band.position.set((x0 + x1) / 2, y0 + Hh - 0.5, zf + 0.15); band.castShadow = true; S.add(band);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 + 0.5, 0.18, 0.7), trim); cap.position.set((x0 + x1) / 2, y0 + Hh + 0.55, zf + 0.15); S.add(cap);
  // wall panel grooves
  for (let x = x0 + 1.2; x < x1; x += 1.2) { const gr = new THREE.Mesh(new THREE.BoxGeometry(0.04, Hh - 2.2, 0.04), new THREE.MeshStandardMaterial({ color: 0xcdbfa9, roughness: 0.9 })); gr.position.set(x, y0 + (Hh - 2.2) / 2, zf + 0.02); S.add(gr); }
  // shop windows (lit interior)
  const winMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: TX.makeStoreWindow(2), emissiveIntensity: 1.05, roughness: 0.08, metalness: 0.0 });
  const glassOver = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.12, envMapIntensity: 1.6 });
  const addWindow = (cx, w, h, yb, z, rotY = 0) => {
    const g = new THREE.Group(); g.position.set(cx, yb, z); g.rotation.y = rotY;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), winMat); p.position.y = h / 2; g.add(p);
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glassOver); gl.position.set(0, h / 2, 0.03); g.add(gl);
    const fr = (ww, hh, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(ww, hh, 0.1), trim); m.position.set(x, y, 0.05); m.castShadow = true; g.add(m); };
    fr(w + 0.16, 0.12, 0, h); fr(w + 0.16, 0.16, 0, 0); for (let k = 0; k <= 4; k++) fr(0.09, h, -w / 2 + k * w / 4, h / 2);
    S.add(g);
  };
  addWindow(-24.0, 9.0, 3.1, y0 + 0.35, zf + 0.01);
  addWindow(-36.5, 1.8, 3.1, y0 + 0.35, zf + 0.01);
  // canopy over windows with warm downlights
  const canopy = new THREE.Mesh(new RoundedBoxGeometry(14.0, 0.22, 1.8, 2, 0.06), accent); canopy.position.set(-25.0, y0 + 3.9, zf + 0.85); canopy.castShadow = true; S.add(canopy);
  const dl = new THREE.MeshStandardMaterial({ color: 0, emissive: 0xffe2b0, emissiveIntensity: 7 });
  for (let x = -31.5; x < -18.5; x += 1.6) { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.03, 16), dl); d.position.set(x, y0 + 3.78, zf + 1.2); S.add(d); }
  // vestibule (entrance) with sliding doors on its right side (facing +X)
  const vx0 = -35, vx1 = -29.5, vz = -9.8, vh = 3.7;
  const vest = new THREE.Group(); S.add(vest);
  const roofV = new THREE.Mesh(new RoundedBoxGeometry(vx1 - vx0 + 0.3, 0.4, zf - vz - 0.0 + 0.3, 2, 0.08), accent); roofV.position.set((vx0 + vx1) / 2, y0 + vh + 0.2, (zf + vz) / 2); roofV.castShadow = true; vest.add(roofV);
  // front glass wall of the vestibule (lit)
  const vw = new THREE.Mesh(new THREE.PlaneGeometry(vx1 - vx0 - 0.3, vh - 0.2), new THREE.MeshStandardMaterial({ color: 0, emissive: 0xffffff, emissiveMap: TX.makeStoreWindow(5), emissiveIntensity: 1.0, roughness: 0.1 }));
  vw.position.set((vx0 + vx1) / 2, y0 + vh / 2, vz); vest.add(vw);
  const vg = new THREE.Mesh(new THREE.PlaneGeometry(vx1 - vx0 - 0.3, vh - 0.2), glassOver); vg.position.set((vx0 + vx1) / 2, y0 + vh / 2, vz + 0.03); vest.add(vg);
  for (const x of [vx0, (vx0 + vx1) / 2, vx1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.16, vh, 0.16), trim); p.position.set(x, y0 + vh / 2, vz); p.castShadow = true; vest.add(p); }
  const sill = new THREE.Mesh(new THREE.BoxGeometry(vx1 - vx0, 0.16, 0.18), trim); sill.position.set((vx0 + vx1) / 2, y0 + 0.08, vz); vest.add(sill);
  // right side: door opening, frame and two sliding panels (along z)
  const dzc = -11.15, dW = 1.75; // opening width along z
  const sideWall1 = new THREE.Mesh(new THREE.BoxGeometry(0.16, vh, (zf - (dzc - dW / 2)) * -1), trim);
  sideWall1.position.set(vx1, y0 + vh / 2, (zf + dzc - dW / 2) / 2); vest.add(sideWall1);
  const sideWall2 = new THREE.Mesh(new THREE.BoxGeometry(0.16, vh, Math.abs(vz - (dzc + dW / 2))), trim);
  sideWall2.position.set(vx1, y0 + vh / 2, (vz + dzc + dW / 2) / 2); vest.add(sideWall2);
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.2, vh - 2.5, dW + 0.2), trim); lintel.position.set(vx1, y0 + 2.5 + (vh - 2.5) / 2, dzc); vest.add(lintel);
  // interior behind the doors (warm glow box)
  const inner = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.5), new THREE.MeshStandardMaterial({ color: 0, emissive: 0xffffff, emissiveMap: TX.makeStoreWindow(9), emissiveIntensity: 1.0 }));
  inner.rotation.y = Math.PI / 2; inner.position.set(vx0 + 0.3, y0 + 1.25, dzc); vest.add(inner);
  const floorIn = new THREE.Mesh(new THREE.PlaneGeometry(vx1 - vx0, zf - vz), new THREE.MeshStandardMaterial({ color: 0xd8cfc0, roughness: 0.3 }));
  floorIn.rotation.x = -Math.PI / 2; floorIn.position.set((vx0 + vx1) / 2, y0 + 0.02, (zf + vz) / 2); vest.add(floorIn);
  const ceilLight = new THREE.Mesh(new THREE.PlaneGeometry(vx1 - vx0 - 0.4, 1.0), new THREE.MeshStandardMaterial({ color: 0, emissive: 0xfff0d0, emissiveIntensity: 3 }));
  ceilLight.rotation.x = Math.PI / 2; ceilLight.position.set((vx0 + vx1) / 2, y0 + vh - 0.05, (zf + vz) / 2); vest.add(ceilLight);
  const doorGlass = new THREE.MeshStandardMaterial({ color: 0xcfe8ef, roughness: 0.05, transparent: true, opacity: 0.28, envMapIntensity: 1.5 });
  const doors = [];
  for (const s of [-1, 1]) {
    const d = new THREE.Group();
    const pane = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.4, dW / 2), doorGlass); pane.position.y = 1.2; d.add(pane);
    const fr = new THREE.Mesh(new THREE.BoxGeometry(0.07, 2.42, 0.06), trim); fr.position.set(0, 1.21, -s * dW / 4 + s * 0.0); d.add(fr);
    const fr2 = fr.clone(); fr2.position.z = s * dW / 4; d.add(fr2);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, dW / 2), trim); bar.position.y = 2.38; d.add(bar);
    const bar2 = bar.clone(); bar2.position.y = 0.04; d.add(bar2);
    d.position.set(vx1 + 0.02, y0, dzc + s * dW / 4); vest.add(d);
    doors.push({ obj: d, s, base: dzc + s * dW / 4 });
  }
  // door sensor + green entrance light
  const sensor = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.12, 0.5, 2, 0.03), new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4 }));
  sensor.position.set(vx1 + 0.12, y0 + 2.62, dzc); vest.add(sensor);
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.04, 0.3), new THREE.MeshStandardMaterial({ color: 0, emissive: 0x39ff88, emissiveIntensity: 5 }));
  led.position.set(vx1 + 0.19, y0 + 2.6, dzc); vest.add(led);
  // big glowing sign letters on the parapet
  const sign = new THREE.Group(); S.add(sign);
  const signGlow = new THREE.MeshStandardMaterial({ color: 0xfff1cc, emissive: 0xffe7b0, emissiveIntensity: 4.2, roughness: 0.3 });
  const signSide = new THREE.MeshStandardMaterial({ color: 0xf3a63a, emissive: 0xff9a2a, emissiveIntensity: 2.0, roughness: 0.4 });
  const font = new FontLoader().parse(window.__FONT_JSON);
  const mkLine = (txt, size, y) => {
    const tg = new TextGeometry(txt, { font, size, depth: 0.16, curveSegments: 6, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.025, bevelSegments: 2 });
    tg.computeBoundingBox(); const bb = tg.boundingBox; tg.translate(-(bb.max.x + bb.min.x) / 2, 0, 0);
    const m = new THREE.Mesh(tg, [signGlow, signSide]); m.position.set(-22.4, y, zf + 0.42); sign.add(m);
  };
  mkLine('SUPER', 0.72, y0 + Hh - 0.12);
  mkLine('MARKET', 0.72, y0 + Hh - 1.12);
  // round cart logo
  const logo = new THREE.Group(); logo.position.set(-31.0, y0 + Hh - 0.45, zf + 0.45); sign.add(logo);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.14, 40), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4dd, emissiveIntensity: 4.5 })); disc.rotation.x = Math.PI / 2; logo.add(disc);
  const ico = new THREE.MeshStandardMaterial({ color: 0x1f6f66, roughness: 0.5 });
  const seg = (x0_, y0_, x1_, y1_, w = 0.09) => { const L = Math.hypot(x1_ - x0_, y1_ - y0_); const m = new THREE.Mesh(new THREE.BoxGeometry(L, w, 0.06), ico); m.position.set((x0_ + x1_) / 2, (y0_ + y1_) / 2, 0.09); m.rotation.z = Math.atan2(y1_ - y0_, x1_ - x0_); logo.add(m); };
  seg(-0.55, 0.35, -0.38, 0.35); seg(-0.38, 0.35, -0.25, -0.15); seg(-0.25, -0.15, 0.4, -0.15); seg(0.4, -0.15, 0.5, 0.25); seg(-0.33, 0.2, 0.5, 0.25);
  for (const x of [-0.18, 0.32]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 16), ico); w.rotation.x = Math.PI / 2; w.position.set(x, -0.32, 0.09); logo.add(w); }
  // sign glow halos
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffc070, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.set(8, 3.4, 1); halo.position.set(-22.4, y0 + Hh - 0.45, zf + 0.9); sign.add(halo);
  // colourful produce mural on the side wall facing the lot
  {
    const c = document.createElement('canvas'); c.width = 2048; c.height = 768; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 768); g.addColorStop(0, '#2f8f83'); g.addColorStop(1, '#246f66'); x.fillStyle = g; x.fillRect(0, 0, 2048, 768);
    const R = mulberry32(5);
    const fruit = (cx, cy, r, col, leaf) => { x.fillStyle = 'rgba(0,0,0,0.18)'; x.beginPath(); x.ellipse(cx + 10, cy + 12, r, r * 0.95, 0, 0, 6.28); x.fill();
      const gg = x.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r); gg.addColorStop(0, '#fff6'); gg.addColorStop(0.25, col); gg.addColorStop(1, col); x.fillStyle = gg; x.beginPath(); x.arc(cx, cy, r, 0, 6.28); x.fill();
      if (leaf) { x.fillStyle = '#5fbf4a'; x.beginPath(); x.ellipse(cx + r * 0.3, cy - r * 1.05, r * 0.35, r * 0.15, -0.5, 0, 6.28); x.fill(); } };
    const cols = ['#ff5a4e', '#ffb02e', '#ffd84a', '#7ed957', '#ff7ab6', '#a66bff', '#ff8a3d'];
    for (let i = 0; i < 26; i++) fruit(80 + R() * 1890, 140 + R() * 500, 50 + R() * 80, cols[i % cols.length], R() < 0.7);
    // big cart graphic
    x.strokeStyle = '#fff4dd'; x.lineWidth = 26; x.lineCap = 'round'; x.lineJoin = 'round';
    x.beginPath(); x.moveTo(700, 250); x.lineTo(800, 250); x.lineTo(880, 520); x.lineTo(1300, 520); x.lineTo(1360, 320); x.lineTo(830, 320); x.stroke();
    x.fillStyle = '#fff4dd'; for (const cx of [920, 1260]) { x.beginPath(); x.arc(cx, 600, 40, 0, 6.28); x.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    const mural = new THREE.Mesh(new THREE.PlaneGeometry(9.5, 3.6), new THREE.MeshStandardMaterial({ map: t, roughness: 0.75 }));
    mural.rotation.y = Math.PI / 2; mural.position.set(x1 + 0.03, y0 + 3.6, (zf + zb) / 2); mural.receiveShadow = true; S.add(mural);
    for (const z of [zf - 1.2, zb + 1.2]) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), new THREE.MeshStandardMaterial({ color: 0, emissive: 0xffd49a, emissiveIntensity: 6 })); l.position.set(x1 + 0.25, y0 + 5.9, z); S.add(l); }
  }
  // rooftop units
  for (const [x, z] of [[-33, -19], [-27, -20], [-22, -17]]) { const u = new THREE.Mesh(new RoundedBoxGeometry(2.2, 1.0, 1.6, 2, 0.08), new THREE.MeshStandardMaterial({ color: 0xb9bec4, roughness: 0.5, metalness: 0.4 })); u.position.set(x, y0 + Hh + 0.5, z); u.castShadow = true; S.add(u); }
  // wall lamps
  for (const x of [-37.3, -18.6]) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), new THREE.MeshStandardMaterial({ color: 0, emissive: 0xffd49a, emissiveIntensity: 8 })); l.position.set(x, y0 + 3.4, zf + 0.25); S.add(l); }
  // bins / benches near the door for scale
    S.traverse((o) => { if (o.isMesh && o.castShadow === false && o.material && !o.material.transparent) o.receiveShadow = true; });
  return { group: S, doors, y0, doorX: vx1, doorZ: dzc, vest: { x0: vx0, x1: vx1, z0: zf, z1: vz } };
}
