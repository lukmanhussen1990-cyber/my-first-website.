// Props: treasure chest (wood + iron + gold + gems), shovels, pulley rig, bone, metal detector, dirt mound.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32, makeNoise2D } from './util.js';
import { woodTextures, ironTextures, ropeTexture, barkTexture, radialTexture, starTexture } from './materials.js';

function mesh(geo, mat, cast = true) { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; return m; }

export const goldMat = new THREE.MeshPhysicalMaterial({ color: 0xffc243, metalness: 1, roughness: 0.2, clearcoat: 0.6, clearcoatRoughness: 0.15, envMapIntensity: 1.6, emissive: new THREE.Color(1.0, 0.55, 0.08), emissiveIntensity: 0 });

function coinBump() {
  const s = 128, c = document.createElement('canvas'); c.width = c.height = s; const x = c.getContext('2d');
  x.fillStyle = '#808080'; x.fillRect(0, 0, s, s);
  x.strokeStyle = '#fff'; x.lineWidth = 7; x.beginPath(); x.arc(s / 2, s / 2, s * 0.42, 0, 7); x.stroke();
  x.fillStyle = '#e0e0e0'; x.beginPath();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? s * 0.12 : s * 0.27, a = i * Math.PI / 5 - Math.PI / 2; x.lineTo(s / 2 + Math.cos(a) * r, s / 2 + Math.sin(a) * r); }
  x.closePath(); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t;
}

// ------------------------------------------------------------ TREASURE CHEST
export function makeChest() {
  const W = 0.72, H = 0.34, D = 0.48, LR = D / 2;
  const root = new THREE.Group();          // origin: bottom centre
  const wood = woodTextures({ planks: 4, base: [128, 78, 44], seed: 3, weather: 0.45 });
  wood.map.rotation = Math.PI / 2; wood.bump.rotation = Math.PI / 2;
  const woodM = new THREE.MeshStandardMaterial({ map: wood.map, bumpMap: wood.bump, bumpScale: 2.5, roughness: 0.78, color: 0xffffff });
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x3a2214, roughness: 0.9 });
  const iron = ironTextures({});
  const ironM = new THREE.MeshStandardMaterial({ map: iron.map, roughnessMap: iron.rough, metalness: 0.85, roughness: 1.0, color: 0xffffff, envMapIntensity: 0.9 });
  // body: outer walls (open top) so the interior is visible
  const body = new THREE.Group(); root.add(body);
  const t = 0.04;
  body.add(mesh(new RoundedBoxGeometry(W, 0.05, D, 2, 0.015).translate(0, 0.025, 0), woodM));
  for (const s of [-1, 1]) {
    body.add(mesh(new RoundedBoxGeometry(W, H, t, 2, 0.012).translate(0, H / 2, s * (D / 2 - t / 2)), woodM));
    body.add(mesh(new RoundedBoxGeometry(t, H, D, 2, 0.012).translate(s * (W / 2 - t / 2), H / 2, 0), woodM));
  }
  const inner = mesh(new THREE.BoxGeometry(W - 2 * t, H - 0.06, D - 2 * t).translate(0, H / 2 + 0.02, 0), new THREE.MeshStandardMaterial({ color: 0x2a170c, roughness: 0.95, side: THREE.BackSide }), false);
  body.add(inner);
  // iron bands + corner brackets + rivets
  const bandGeo = [];
  for (const x of [-W * 0.32, W * 0.32]) {
    bandGeo.push(new THREE.BoxGeometry(0.06, H + 0.01, 0.012).translate(x, H / 2, D / 2 + 0.004));
    bandGeo.push(new THREE.BoxGeometry(0.06, H + 0.01, 0.012).translate(x, H / 2, -D / 2 - 0.004));
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    bandGeo.push(new THREE.BoxGeometry(0.014, H + 0.012, 0.09).translate(sx * (W / 2 + 0.005), H / 2, sz * (D / 2 - 0.04)));
    bandGeo.push(new THREE.BoxGeometry(0.09, H + 0.012, 0.014).translate(sx * (W / 2 - 0.04), H / 2, sz * (D / 2 + 0.005)));
  }
  bandGeo.push(new THREE.BoxGeometry(W + 0.012, 0.035, D + 0.012).translate(0, H - 0.017, 0));
  bandGeo.push(new THREE.BoxGeometry(W + 0.012, 0.035, D + 0.012).translate(0, 0.03, 0));
  body.add(mesh(mergeGeometries(bandGeo), ironM));
  const rivetGeo = new THREE.SphereGeometry(0.009, 8, 6); const rivets = [];
  for (const x of [-W * 0.32, W * 0.32]) for (let i = 0; i < 4; i++) rivets.push(rivetGeo.clone().translate(x, 0.07 + i * 0.075, D / 2 + 0.012));
  body.add(mesh(mergeGeometries(rivets), ironM, false));
  // front lock plate
  const lock = mesh(new RoundedBoxGeometry(0.11, 0.13, 0.02, 2, 0.008).translate(0, H - 0.07, D / 2 + 0.012), goldMat);
  body.add(lock);
  const keyhole = new THREE.Mesh(new THREE.CircleGeometry(0.014, 12), new THREE.MeshBasicMaterial({ color: 0x0a0503 })); keyhole.position.set(0, H - 0.075, D / 2 + 0.0231); body.add(keyhole);
  // side handles
  for (const s of [-1, 1]) { const h = mesh(new THREE.TorusGeometry(0.05, 0.01, 8, 20, Math.PI), ironM); h.rotation.set(0, s * Math.PI / 2, Math.PI); h.position.set(s * (W / 2 + 0.02), H * 0.72, 0); body.add(h); }
  // ---- treasure inside: coin heap (instanced), gems, necklace, goblet
  const treasure = new THREE.Group(); root.add(treasure);
  const coinGeo = new THREE.CylinderGeometry(0.034, 0.034, 0.009, 24);
  const coinM = goldMat.clone(); coinM.bumpMap = coinBump(); coinM.bumpScale = 1.5;
  const rnd = mulberry32(31); const NC = 520;
  const coins = new THREE.InstancedMesh(coinGeo, coinM, NC); const d = new THREE.Object3D();
  const heap = (x, z) => H - 0.02 + 0.12 * Math.max(0, 1 - (x / (W * 0.48)) ** 2) * Math.max(0, 1 - (z / (D * 0.48)) ** 2);
  for (let i = 0; i < NC; i++) {
    let x, z, y;
    if (i < NC - 40) { x = (rnd() - 0.5) * (W - 0.1); z = (rnd() - 0.5) * (D - 0.1); y = heap(x, z) - rnd() * 0.05; }
    else { x = (rnd() - 0.5) * (W - 0.15); z = D / 2 + 0.01 + rnd() * 0.03; y = H - 0.04 - rnd() * 0.25; } // spilling down the front
    d.position.set(x, y, z); d.rotation.set((rnd() - 0.5) * 1.4, rnd() * 6, (rnd() - 0.5) * 1.4);
    if (i >= NC - 40) d.rotation.set(Math.PI / 2 + (rnd() - 0.5) * 0.6, 0, rnd() * 6);
    d.updateMatrix(); coins.setMatrixAt(i, d.matrix);
  }
  coins.castShadow = true; treasure.add(coins);
  const gemCols = [0xff2a55, 0x22d07a, 0x2f8bff, 0xb44dff, 0xff9a1f, 0x30e0e0];
  const gems = [];
  for (let i = 0; i < 11; i++) {
    const c = gemCols[i % gemCols.length];
    const gm = new THREE.MeshPhysicalMaterial({ color: c, metalness: 0.0, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02, emissive: c, emissiveIntensity: 0.25, envMapIntensity: 2.5, flatShading: true, ior: 2.0, specularIntensity: 1 });
    const geo = i % 3 === 0 ? new THREE.OctahedronGeometry(0.04, 0) : i % 3 === 1 ? new THREE.IcosahedronGeometry(0.035, 0) : new THREE.DodecahedronGeometry(0.033, 0);
    const g = mesh(geo, gm); const x = (rnd() - 0.5) * (W - 0.18), z = (rnd() - 0.5) * (D - 0.16);
    g.position.set(x, heap(x, z) + 0.012, z); g.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); g.scale.y = i % 3 === 0 ? 1.3 : 1;
    treasure.add(g); gems.push(g);
  }
  // pearl necklace draped over the front edge
  const pearlM = new THREE.MeshPhysicalMaterial({ color: 0xfff6ee, roughness: 0.15, clearcoat: 1, sheen: 1, sheenColor: new THREE.Color(0xffd8f0), iridescence: 0.6 });
  const pg = []; for (let i = 0; i < 26; i++) { const a = i / 25; const x = -0.2 + a * 0.32; const y = H + 0.015 - Math.sin(a * Math.PI) * 0.09; pg.push(new THREE.SphereGeometry(0.012, 10, 8).translate(x, y, D / 2 + 0.02 - (1 - Math.sin(a * Math.PI)) * 0.04)); }
  treasure.add(mesh(mergeGeometries(pg), pearlM, false));
  // little goblet
  const prof = [[0, 0], [0.04, 0], [0.042, 0.008], [0.01, 0.02], [0.008, 0.07], [0.045, 0.1], [0.05, 0.15], [0.045, 0.15], [0.004, 0.11]].map(([a, b]) => new THREE.Vector2(a, b));
  const gob = mesh(new THREE.LatheGeometry(prof, 24), goldMat); gob.position.set(W * 0.25, heap(W * 0.25, -0.05) - 0.02, -0.05); gob.rotation.z = 0.3; treasure.add(gob);
  // ---- lid (barrel top), hinged at the back
  const lid = new THREE.Group(); lid.position.set(0, H, -D / 2); root.add(lid);
  const lidGeo = new THREE.CylinderGeometry(LR, LR, W, 32, 1, false, 0, Math.PI); lidGeo.rotateZ(Math.PI / 2); lidGeo.rotateX(0);
  // after rotateZ the half-cylinder axis is x; ensure the curved part faces up
  const lidMesh = mesh(lidGeo, woodM); lidMesh.position.set(0, 0, LR); lidMesh.scale.set(1, 0.92, 1); lid.add(lidMesh);
  const lidUnder = mesh(new THREE.PlaneGeometry(W - 0.02, D - 0.02), darkWood, false); lidUnder.rotation.x = Math.PI / 2; lidUnder.position.set(0, 0.001, LR); lid.add(lidUnder);
  const lidBands = [];
  for (const x of [-W * 0.32, W * 0.32]) { const tg = new THREE.TorusGeometry(LR + 0.006, 0.01, 6, 32, Math.PI); tg.scale(1, 0.92, 1); tg.rotateY(Math.PI / 2); tg.translate(x, 0, LR); lidBands.push(tg); }
  lid.add(mesh(mergeGeometries(lidBands), ironM));
  const hasp = mesh(new RoundedBoxGeometry(0.07, 0.09, 0.016, 2, 0.006).translate(0, -0.02, D + 0.006), goldMat); lid.add(hasp);
  const ring = mesh(new THREE.TorusGeometry(0.035, 0.009, 8, 20), ironM); ring.position.set(0, LR * 0.92 + 0.02, LR); lid.add(ring);
  // ---- glow + sparkles + interior light
  const glowTex = radialTexture({ stops: [[0, 'rgba(255,230,150,1)'], [0.35, 'rgba(255,190,70,0.5)'], [1, 'rgba(255,150,30,0)']] });
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(1.0, 0.75, 0.35), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
  glow.scale.set(1.3, 1.0, 1); glow.position.set(0, H + 0.12, 0.05); root.add(glow);
  const light = new THREE.PointLight(0xffc35a, 0, 3.5, 1.6); light.position.set(0, H + 0.22, 0.12); root.add(light);
  const star = starTexture();
  const sparkles = [];
  for (let i = 0; i < 26; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: star, color: new THREE.Color(1.0, 0.92, 0.7).multiplyScalar(3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
    const x = (rnd() - 0.5) * (W - 0.12), z = (rnd() - 0.5) * (D - 0.12); s.position.set(x, heap(x, z) + 0.02, z); s.userData = { ph: rnd(), sp: 0.7 + rnd() * 0.9, sz: 0.06 + rnd() * 0.08 };
    root.add(s); sparkles.push(s);
  }
  const chest = { root, lid, glow, light, sparkles, treasure, coins, gems, W, H, D, coinM };
  // open: 0..1 ; magic: glow strength 0..>1
  chest.set = (t, open, magic) => {
    lid.rotation.x = -open * 1.95;
    treasure.visible = open > 0.01;
    const m = magic * Math.min(1, open * 3);
    glow.material.opacity = Math.min(1, m * 0.9); glow.scale.set(1.0 + m * 0.6, 0.8 + m * 0.5, 1);
    light.intensity = m * 6.5;
    coinM.emissiveIntensity = 0.12 * m; goldMat.emissiveIntensity = 0.12 * m;
    for (const s of sparkles) {
      const u = s.userData; const c = ((t * u.sp + u.ph) % 1);
      const tw = Math.pow(Math.max(0, Math.sin(c * Math.PI)), 6);
      s.material.opacity = tw * Math.min(1, m * 1.2); const z = u.sz * (0.5 + tw) * (0.6 + m * 0.5); s.scale.set(z, z, 1);
      s.material.rotation = t * 0.8 + u.ph * 6;
    }
    for (const [i, g] of gems.entries()) g.material.emissiveIntensity = 0.15 + 0.5 * m * (0.6 + 0.4 * Math.sin(t * 3 + i));
  };
  return chest;
}

// ------------------------------------------------------------ SHOVEL (origin at blade tip, handle along +Y)
export function makeShovel({ len = 0.7, bladeW = 0.17, bladeH = 0.21, woodHex = [176, 120, 70] } = {}) {
  const g = new THREE.Group();
  const wood = woodTextures({ planks: 1, base: woodHex, seed: 44 });
  const woodM = new THREE.MeshStandardMaterial({ map: wood.map, bumpMap: wood.bump, bumpScale: 1, roughness: 0.6 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x9aa3ab, metalness: 0.9, roughness: 0.32, envMapIntensity: 1.2 });
  const grip = new THREE.MeshStandardMaterial({ color: 0x2f6b3f, roughness: 0.5 });
  // blade: curved spade
  const sh = new THREE.Shape(); const w = bladeW / 2;
  sh.moveTo(-w, bladeH); sh.lineTo(w, bladeH); sh.quadraticCurveTo(w * 1.02, bladeH * 0.25, 0, 0); sh.quadraticCurveTo(-w * 1.02, bladeH * 0.25, -w, bladeH);
  const bg = new THREE.ExtrudeGeometry(sh, { depth: 0.008, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.003, bevelSegments: 2, curveSegments: 16 });
  const p = bg.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, p.getZ(i) - (x / w) ** 2 * 0.025); }
  bg.computeVertexNormals();
  g.add(mesh(bg, steel));
  g.add(mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.08, 16).translate(0, bladeH + 0.03, 0.004), steel));
  g.add(mesh(new THREE.CylinderGeometry(0.017, 0.017, len, 14).translate(0, bladeH + len / 2, 0.004), woodM));
  // D-grip
  const dg = new THREE.TorusGeometry(0.055, 0.014, 10, 24); dg.translate(0, bladeH + len + 0.045, 0.004);
  g.add(mesh(dg, grip));
  g.userData = { top: new THREE.Vector3(0, bladeH + len + 0.07, 0), mid: new THREE.Vector3(0, bladeH + len * 0.45, 0), bladeH, len };
  // dirt clump on the blade (shown when carrying soil)
  const clump = mesh(new THREE.IcosahedronGeometry(0.07, 1), new THREE.MeshStandardMaterial({ color: 0x4a2e1a, roughness: 1 }));
  clump.scale.set(1.2, 0.6, 0.8); clump.position.set(0, bladeH * 0.45, 0.04); clump.visible = false; g.add(clump);
  g.userData.clump = clump;
  return g;
}

// ------------------------------------------------------------ PULLEY RIG over the hole
export function makePulley({ x = 0.15, z = -0.3, span = 1.35, height = 1.8 }) {
  const g = new THREE.Group();
  const logM = new THREE.MeshStandardMaterial({ color: 0xffffff, map: barkTexture(), roughness: 0.85 });
  const woodT = woodTextures({ planks: 1, base: [190, 140, 90], seed: 55 });
  const plankM = new THREE.MeshStandardMaterial({ map: woodT.map, bumpMap: woodT.bump, bumpScale: 1, roughness: 0.7 });
  const ironM = new THREE.MeshStandardMaterial({ color: 0x55504a, metalness: 0.8, roughness: 0.45 });
  const parts = [];
  const top = (s) => new THREE.Vector3(x + s * span / 2, height, z);
  const legBetween = (a, b, r = 0.035) => {
    const len = a.distanceTo(b); const geo = new THREE.CylinderGeometry(r * 0.85, r, len, 10); const m = mesh(geo, logM);
    m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); return m;
  };
  for (const s of [-1, 1]) {
    const grp = new THREE.Group(); const T = top(s);
    grp.add(legBetween(new THREE.Vector3(T.x + s * 0.12, 0, z + 0.25), T));
    grp.add(legBetween(new THREE.Vector3(T.x + s * 0.12, 0, z - 0.75), T));
    grp.add(legBetween(new THREE.Vector3(T.x + s * 0.09, 0.55, z + 0.06), new THREE.Vector3(T.x + s * 0.09, 0.55, z - 0.5), 0.02));
    parts.push(grp);
  }
  const bar = new THREE.Group(); bar.add(legBetween(top(-1).add(new THREE.Vector3(-0.08, 0.02, 0)), top(1).add(new THREE.Vector3(0.08, 0.02, 0)), 0.04)); parts.push(bar);
  // wheel
  const wheel = new THREE.Group();
  const rim = mesh(new THREE.TorusGeometry(0.11, 0.022, 10, 32), plankM); wheel.add(rim);
  for (let i = 0; i < 4; i++) { const sp = mesh(new THREE.BoxGeometry(0.2, 0.02, 0.018), plankM); sp.rotation.z = i * Math.PI / 4; wheel.add(sp); }
  wheel.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.06, 12).rotateX(Math.PI / 2), ironM));
  const wheelPivot = new THREE.Group(); wheelPivot.position.set(x, height - 0.17, z);
  const yoke = mesh(new THREE.BoxGeometry(0.03, 0.17, 0.08).translate(0, 0.085, 0), ironM); wheelPivot.add(yoke, wheel);
  parts.push(wheelPivot);
  const ropeT = ropeTexture();
  const ropeM = new THREE.MeshStandardMaterial({ map: ropeT.map, bumpMap: ropeT.bump, bumpScale: 1.5, roughness: 0.9 });
  const ropeA = mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 8, 1, true), ropeM); // wheel -> load
  const ropeB = mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 8, 1, true), ropeM); // wheel -> puller
  const hook = mesh(new THREE.TorusGeometry(0.035, 0.008, 8, 16, Math.PI * 1.5), ironM);
  const ropes = new THREE.Group(); ropes.add(ropeA, ropeB, hook); parts.push(ropes);
  parts.forEach((p) => g.add(p));
  const setRope = (m, a, b) => { const len = Math.max(0.001, a.distanceTo(b)); m.scale.set(1, len, 1); m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); };
  const wheelBottom = new THREE.Vector3(x, height - 0.17 - 0.11, z);
  const wheelSide = new THREE.Vector3(x - 0.11, height - 0.17, z);
  return {
    group: g, parts, wheel, wheelBottom, wheelSide, hook,
    setRopes(load, puller, spin) {
      ropes.visible = true;
      setRope(ropeA, wheelBottom, load);
      hook.position.copy(load).add(new THREE.Vector3(0, 0.02, 0)); hook.rotation.set(0, 0, Math.PI * 0.75);
      if (puller) { ropeB.visible = true; setRope(ropeB, wheelSide, puller); } else ropeB.visible = false;
      wheel.rotation.z = spin;
    },
  };
}

// ------------------------------------------------------------ BONE
export function makeBone(s = 1) {
  const m = new THREE.MeshPhysicalMaterial({ color: 0xf5ead2, roughness: 0.5, clearcoat: 0.3 });
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.035 * s, 0.035 * s, 0.32 * s, 14).rotateZ(Math.PI / 2), m));
  for (const x of [-1, 1]) for (const y of [-1, 1]) { const b = mesh(new THREE.SphereGeometry(0.05 * s, 16, 12), m); b.position.set(x * 0.17 * s, y * 0.035 * s, 0); g.add(b); }
  return g;
}

// ------------------------------------------------------------ METAL DETECTOR (origin at grip; extends along -Y towards the coil)
export function makeDetector(len = 1.45) {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0xc9ced3, metalness: 0.85, roughness: 0.3 });
  const black = new THREE.MeshStandardMaterial({ color: 0x1f2326, roughness: 0.5 });
  const yellow = new THREE.MeshPhysicalMaterial({ color: 0xf2b51f, roughness: 0.35, clearcoat: 0.6 });
  g.add(mesh(new THREE.CylinderGeometry(0.016, 0.016, len, 12).translate(0, -len / 2, 0), metal));
  g.add(mesh(new RoundedBoxGeometry(0.1, 0.16, 0.07, 2, 0.02).translate(0, -0.12, 0.05), yellow));
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), new THREE.MeshStandardMaterial({ color: 0x113322, emissive: new THREE.Color(0.2, 1.0, 0.6), emissiveIntensity: 0 }));
  led.position.set(0, -0.08, 0.088); g.add(led);
  g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 12).translate(0, 0.03, 0), black));
  const coil = new THREE.Group(); coil.position.y = -len;
  const ring = mesh(new THREE.TorusGeometry(0.15, 0.022, 10, 36), yellow); ring.rotation.x = Math.PI / 2; ring.scale.set(1, 1.25, 1); coil.add(ring);
  const disc = mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.012, 36), black); disc.scale.set(1, 1, 1.25); coil.add(disc);
  const glowRing = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.012, 8, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 2.2, 1.7), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  glowRing.rotation.x = Math.PI / 2; glowRing.scale.set(1, 1.25, 1); coil.add(glowRing);
  g.add(coil);
  return { group: g, coil, led, glowRing, len };
}

// ------------------------------------------------------------ DIRT MOUND
export function makeMound(seed = 4) {
  const N = makeNoise2D(seed);
  const geo = new THREE.SphereGeometry(1, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = 1 + (N.fbm(x * 2 + 3, z * 2 + 5, 4) - 0.5) * 0.45 + (N.noise(x * 9, z * 9) - 0.5) * 0.14 + (N.noise(x * 23, z * 23) - 0.5) * 0.06; const yy = y * (0.75 + 0.5 * N.fbm(x * 3, z * 3, 3)); p.setXYZ(i, x * k, Math.pow(Math.max(yy, 0), 0.8) * k, z * k); }
  geo.computeVertexNormals();
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); const img = x.createImageData(256, 256); const rnd = mulberry32(seed);
  for (let j = 0; j < 256; j++) for (let i = 0; i < 256; i++) { const n = N.fbm(i / 18, j / 18, 4), f = N.noise(i / 3, j / 3); const k = 0.6 + 0.5 * n + 0.25 * (f - 0.5); const o = (j * 256 + i) * 4; img.data[o] = 92 * k; img.data[o + 1] = 60 * k; img.data[o + 2] = 36 * k; img.data[o + 3] = 255; }
  x.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3);
  const m = mesh(geo, new THREE.MeshStandardMaterial({ map: t, bumpMap: t, bumpScale: 4, roughness: 1 }));
  return m;
}
