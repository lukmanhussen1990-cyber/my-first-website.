// Props: clipboard, map, glowing depth line, wheelbarrow, dirt heaps, bananas,
// hose + nozzle + water stream, neighbour deck.
import * as THREE from 'three';
import { patch, mesh, group, roundedBoxGeo, canvasTexture, mulberry32, clamp, lerp, sphereGeo, GLSL_NOISE } from './lib.js';
import { C, U } from './world.js';

export const looseDirtMat = patch(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 }), {
  vMain: `transformed += normal * ((vnoise(position * 9.0) - 0.5) * 0.05 + (vnoise(position * 25.0) - 0.5) * 0.015);`,
  fColor: `
    vec3 c = vec3(0.16, 0.085, 0.045);
    c *= 0.7 + 0.5 * fbm3(vWPos * 7.0);
    vec4 v = voronoi2(vWPos.xz * 9.0 + vWPos.y * 3.0);
    float peb = step(v.y, 0.12) * smoothstep(0.3, 0.22, v.x);
    c = mix(c, vec3(0.4, 0.35, 0.3), peb * 0.7);
    diffuseColor.rgb = c;
    float dh = fbm3(vWPos * 14.0) + peb;
  `,
  fNormal: `normal = perturbNormalH(-vViewPosition, normal, dh * 0.012, faceDirection);`,
});

function superRect(geo, n = 4, sx = 1.35) {
  const p = geo.attributes.position; const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const r = Math.hypot(v.x, v.z); if (r < 1e-6) continue;
    const a = Math.atan2(v.z, v.x);
    const k = 1 / Math.pow(Math.pow(Math.abs(Math.cos(a)), n) + Math.pow(Math.abs(Math.sin(a)), n), 1 / n);
    p.setXYZ(i, v.x * k * sx, v.y, v.z * k);
  }
  geo.computeVertexNormals();
  return geo;
}

// banana: curved tapered sweep; uv.x = position along the fruit
export function bananaGeo(len = 0.26, rad = 0.032, bend = 1.1, peeled = false) {
  const rings = 28, rs = 18; const pos = [], uv = [], idx = [];
  const R = len / bend;
  for (let i = 0; i <= rings; i++) {
    const s = i / rings; const a = (s - 0.5) * bend;
    const cx = Math.sin(a) * R, cy = (1 - Math.cos(a)) * R;
    const tx = Math.cos(a), ty = Math.sin(a); // tangent
    const nx = -ty, ny = tx;                  // normal in plane
    let r = rad * Math.pow(Math.sin(Math.PI * clamp(s * 0.94 + 0.03)), 0.55);
    if (s < 0.08) r = Math.max(r, rad * 0.28);
    for (let j = 0; j <= rs; j++) {
      const th = (j / rs) * Math.PI * 2;
      const rr = r * (1 + (peeled ? 0 : 0.07 * Math.cos(th * 5)));
      const px = cx + nx * Math.cos(th) * rr, py = cy + ny * Math.cos(th) * rr, pz = Math.sin(th) * rr;
      pos.push(px, py, pz); uv.push(s, j / rs);
    }
  }
  for (let i = 0; i < rings; i++) for (let j = 0; j < rs; j++) {
    const a = i * (rs + 1) + j, b = a + rs + 1;
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aS', new THREE.Float32BufferAttribute(uv.filter((_, i) => i % 2 === 0), 1));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
export const bananaMat = patch(new THREE.MeshPhysicalMaterial({ color: 0xffd84a, roughness: 0.45, clearcoat: 0.3 }), {
  vHead: `attribute float aS; varying float vS;`,
  vMain: `vS = aS;`,
  fHead: `varying float vS;`,
  fColor: `
    float s = vS;
    vec3 c = vec3(1.0, 0.7, 0.05);
    c = mix(vec3(0.55, 0.62, 0.15), c, smoothstep(0.0, 0.1, s));
    c = mix(c, vec3(0.25, 0.14, 0.05), smoothstep(0.93, 0.99, s));
    c = mix(c, vec3(0.22, 0.13, 0.05), smoothstep(0.05, 0.0, s));
    float spot = smoothstep(0.75, 0.9, vnoise(vOPos * 120.0)) * 0.6;
    c = mix(c, vec3(0.45, 0.28, 0.08), spot);
    diffuseColor.rgb = c;
  `,
});
const fruitMat = new THREE.MeshPhysicalMaterial({ color: 0xf6ecc4, roughness: 0.5, sheen: 0.3 });

export function buildProps(scene, W) {
  const P = {};
  const rnd = mulberry32(99);

  // ---------- clipboard ----------
  {
    const g = new THREE.Group();
    const board = mesh(roundedBoxGeo(0.24, 0.32, 0.014, 0.006, 2), new THREE.MeshStandardMaterial({ color: 0x9a6a3c, roughness: 0.6 }));
    g.add(board);
    const tex = canvasTexture(256, 340, (c, w, h) => {
      c.fillStyle = '#fbfaf5'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#7fa6d8'; c.lineWidth = 3;
      for (let y = 70; y < h - 20; y += 26) { c.beginPath(); c.moveTo(20, y); c.lineTo(w - 20, y); c.stroke(); }
      c.strokeStyle = '#2b4d8a'; c.lineWidth = 5;
      for (const y of [92, 144, 196]) { c.strokeRect(24, y - 18, 16, 16); c.beginPath(); c.moveTo(52, y - 9); c.bezierCurveTo(90, y - 20, 140, y, 210, y - 12); c.stroke(); }
      c.strokeStyle = '#2b9a52'; c.lineWidth = 6; c.beginPath(); c.moveTo(26, 86); c.lineTo(33, 94); c.lineTo(44, 76); c.stroke();
      c.fillStyle = '#5fb7ee'; c.fillRect(70, 230, 120, 56); c.strokeStyle = '#2b4d8a'; c.lineWidth = 4; c.strokeRect(70, 230, 120, 56);
    });
    const paper = mesh(new THREE.PlaneGeometry(0.21, 0.27), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }), { cast: false });
    paper.position.set(0, -0.015, 0.0085); g.add(paper);
    const clip = mesh(roundedBoxGeo(0.1, 0.035, 0.025, 0.008, 2), new THREE.MeshStandardMaterial({ color: 0xd8dde2, metalness: 1, roughness: 0.25 }));
    clip.position.set(0, 0.15, 0.012); g.add(clip);
    P.clipboard = g;
  }
  // ---------- map ----------
  {
    const tex = canvasTexture(512, 380, (c, w, h) => {
      c.fillStyle = '#f3ead2'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#d9caa4'; c.lineWidth = 2;
      for (let x = 0; x < w; x += 32) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
      for (let y = 0; y < h; y += 32) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
      c.fillStyle = '#5aa33a'; c.fillRect(20, 78, w - 40, 18);
      c.fillStyle = '#8a5a34'; c.fillRect(20, 96, w - 40, h - 120);
      c.fillStyle = '#6fc8f0'; c.fillRect(140, 96, 232, 120);
      c.strokeStyle = '#ffffff'; c.lineWidth = 6; c.strokeRect(140, 96, 232, 120);
      c.strokeStyle = '#1e5fb0'; c.lineWidth = 3; c.setLineDash([]);
      c.beginPath(); c.moveTo(140, 300); c.lineTo(372, 300); c.stroke();
      c.strokeStyle = '#d23a2a'; c.lineWidth = 10;
      c.beginPath(); c.moveTo(330, 270); c.lineTo(390, 330); c.moveTo(390, 270); c.lineTo(330, 330); c.stroke();
      c.strokeStyle = '#2b9a52'; c.lineWidth = 12;
      c.beginPath(); c.moveTo(410, 160); c.lineTo(435, 190); c.lineTo(480, 120); c.stroke();
      c.lineWidth = 4; c.strokeStyle = '#333'; c.beginPath(); c.moveTo(60, 216); c.lineTo(60, 300); c.stroke();
      c.beginPath(); c.moveTo(50, 230); c.lineTo(60, 214); c.lineTo(70, 230); c.stroke();
    });
    const emit = canvasTexture(512, 380, (c, w, h) => {
      c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#7ff3ff'; c.lineWidth = 9; c.setLineDash([22, 14]);
      c.beginPath(); c.moveTo(110, 216); c.lineTo(402, 216); c.stroke();
    });
    const mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: emit, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.8, side: THREE.DoubleSide });
    const geo = new THREE.PlaneGeometry(0.95, 0.7, 12, 1);
    const p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin((p.getX(i) / 0.95 + 0.5) * Math.PI) * 0.04);
    geo.computeVertexNormals();
    const g = new THREE.Group(); const m = mesh(geo, mat, { cast: true }); g.add(m);
    P.map = g; P.mapMat = mat;
  }
  // ---------- glowing depth line ----------
  {
    const g = group(scene, [0, -C.poolD, C.zF + 0.045]);
    const dashMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 2.6, 3.0), transparent: true, toneMapped: true });
    const haloMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 0.9, 1.0), transparent: true, opacity: 0.35, depthWrite: false });
    const dashes = [];
    const n = 19;
    for (let i = 0; i < n; i++) {
      const x = -1.75 + (3.5 * i) / (n - 1);
      const d = mesh(new THREE.CapsuleGeometry(0.028, 0.09, 6, 12), dashMat, { rot: [0, 0, Math.PI / 2], cast: false, receive: false });
      d.position.x = x; g.add(d);
      const h = mesh(new THREE.CapsuleGeometry(0.06, 0.12, 6, 12), haloMat, { rot: [0, 0, Math.PI / 2], cast: false, receive: false });
      h.position.set(x, 0, -0.01); g.add(h);
      dashes.push({ d, h, k: i / (n - 1) });
    }
    for (const s of [-1, 1]) {
      const arrow = new THREE.Shape(); arrow.moveTo(0, 0.13); arrow.lineTo(0.09, 0); arrow.lineTo(-0.09, 0); arrow.lineTo(0, 0.13);
      const am = mesh(new THREE.ShapeGeometry(arrow), dashMat, { cast: false });
      am.position.set(s * 1.92, -0.05, 0); am.rotation.z = s > 0 ? Math.PI / 2 : -Math.PI / 2; g.add(am);
      dashes.push({ d: am, h: null, k: s > 0 ? 1 : 0 });
    }
    g.visible = false;
    P.line = { g, dashes, dashMat, haloMat };
  }
  // ---------- wheelbarrow ----------
  {
    const g = new THREE.Group();
    const paint = new THREE.MeshPhysicalMaterial({ color: 0x2f9e62, roughness: 0.35, clearcoat: 0.8, metalness: 0.1 });
    const prof = [[0, 0], [0.28, 0], [0.34, 0.03], [0.46, 0.33], [0.48, 0.36], [0.45, 0.365], [0.43, 0.34], [0.31, 0.05], [0.0, 0.045]].map(([x, y]) => new THREE.Vector2(x, y));
    const tubGeo = superRect(new THREE.LatheGeometry(prof, 48), 4, 1.45);
    const tub = mesh(tubGeo, paint); tub.position.y = 0.32; g.add(tub);
    const metal = new THREE.MeshStandardMaterial({ color: 0x9aa2a8, metalness: 1, roughness: 0.35 });
    const tire = mesh(new THREE.TorusGeometry(0.17, 0.065, 16, 36), new THREE.MeshStandardMaterial({ color: 0x1d1d1f, roughness: 0.8 }));
    tire.rotation.y = Math.PI / 2; tire.position.set(0.72, 0.235, 0); g.add(tire);
    const hub = mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.1, 20), plasticMat(0xe24b3a)); hub.rotation.z = Math.PI / 2; hub.position.set(0.72, 0.235, 0); g.add(hub);
    for (const s of [-1, 1]) {
      const arm = mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.55, 12), metal); arm.rotation.z = Math.PI / 2 - 0.14; arm.position.set(0.05, 0.36, 0.2 * s); g.add(arm);
      const grip = mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.2, 14), plasticMat(0xe24b3a)); grip.rotation.z = Math.PI / 2 - 0.14; grip.position.set(-0.75, 0.47, 0.2 * s); g.add(grip);
      const leg = mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.3, 10), metal); leg.position.set(-0.32, 0.17, 0.18 * s); g.add(leg);
      const foot = mesh(new THREE.BoxGeometry(0.12, 0.025, 0.05), metal); foot.position.set(-0.32, 0.02, 0.18 * s); g.add(foot);
    }
    const load = mesh(sphereGeo(40).scale(0.56, 0.3, 0.38), looseDirtMat); load.position.set(0, 0.36, 0); g.add(load);
    g.visible = false;
    scene.add(g);
    P.barrow = { g, load };
  }
  // dirt heap by the barrow and on the neighbour
  P.heap = mesh(new THREE.SphereGeometry(1, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), looseDirtMat); P.heap.visible = false; scene.add(P.heap);
  P.mound = mesh(new THREE.SphereGeometry(1, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), looseDirtMat); P.mound.visible = false; scene.add(P.mound);
  P.fenceDirt = mesh(new THREE.SphereGeometry(1, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), looseDirtMat); P.fenceDirt.visible = false; scene.add(P.fenceDirt);
  // neighbour's deck
  {
    const deck = mesh(roundedBoxGeo(2.6, 0.45, 1.6, 0.03, 2), patch(new THREE.MeshStandardMaterial({ color: 0x8a5a36, roughness: 0.8 }), {
      fColor: `diffuseColor.rgb *= 0.8 + 0.3 * fbm2(vec2(vWPos.x * 2.0, vWPos.z * 30.0)); diffuseColor.rgb *= 1.0 - 0.25 * smoothstep(0.45, 0.5, abs(fract(vWPos.z / 0.16) - 0.5));`,
    }));
    deck.position.set(1.9, 0.22, C.fenceZ - 1.25); scene.add(deck);
  }
  // ---------- bananas ----------
  {
    const pile = new THREE.Group();
    const pallet = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0xb88a5a, roughness: 0.85 });
    for (let i = 0; i < 6; i++) pallet.add(mesh(roundedBoxGeo(0.16, 0.04, 1.0, 0.01, 1), wood, { pos: [-0.5 + i * 0.2, 0.1, 0] }));
    for (const z of [-0.42, 0, 0.42]) pallet.add(mesh(roundedBoxGeo(1.18, 0.08, 0.12, 0.01, 1), wood, { pos: [0, 0.04, z] }));
    pile.add(pallet);
    const bg = bananaGeo();
    const bananas = [];
    for (let i = 0; i < 70; i++) {
      const u = rnd(), v = rnd();
      const r = Math.sqrt(u) * 0.52; const a = v * Math.PI * 2;
      const x = Math.cos(a) * r * 1.05, z = Math.sin(a) * r * 0.85;
      const hgt = Math.sqrt(Math.max(0, 1 - (r / 0.56) ** 2)) * 0.62;
      const y = 0.14 + hgt * (0.3 + rnd() * 0.7);
      const b = mesh(bg, bananaMat);
      b.position.set(x, y, z); b.rotation.set(rnd() * 6.28, rnd() * 6.28, rnd() * 6.28);
      b.scale.setScalar(1.1 + rnd() * 0.35);
      pile.add(b); bananas.push(b);
    }
    // a few bunches on top
    for (let k = 0; k < 4; k++) {
      const bunch = group(pile, [(k - 1.5) * 0.22, 0.6 + (k % 2) * 0.06, (k % 2 - 0.5) * 0.2], [0, k * 1.3, 0.3]);
      for (let i = 0; i < 4; i++) bunch.add(mesh(bg, bananaMat, { pos: [0, 0, (i - 1.5) * 0.06], rot: [0.15 * (i - 1.5), 0, 0], scale: 1.25 }));
    }
    pile.visible = false; scene.add(pile);
    P.pile = pile;
    // hero banana (peelable) — attaches to the gorilla's hand
    const hero = new THREE.Group();
    const inner = mesh(bananaGeo(0.3, 0.027, 0.8, true), fruitMat); hero.add(inner);
    const peelLow = mesh(bananaGeo(0.3, 0.034, 0.8), bananaMat); hero.add(peelLow);
    const petals = [];
    for (let q = 0; q < 4; q++) {
      const pg = group(hero, [0, 0, 0]);
      const geo = new THREE.SphereGeometry(0.036, 10, 16, (q / 4) * Math.PI * 2, Math.PI / 2 - 0.08, 0, Math.PI / 2);
      geo.scale(1, 4.2, 1);
      const pm = mesh(geo, bananaMat, { cast: false }); pg.add(pm);
      petals.push(pg);
    }
    hero.visible = false;
    P.hero = { g: hero, inner, peelLow, petals };
    P.floatBanana = mesh(bg, bananaMat); P.floatBanana.visible = false;
  }
  // ---------- hose + nozzle ----------
  {
    P.hoseMesh = mesh(new THREE.BufferGeometry(), W.hoseMat); P.hoseMesh.visible = false; P.hoseMesh.frustumCulled = false; scene.add(P.hoseMesh);
    const nz = new THREE.Group();
    const y = new THREE.MeshPhysicalMaterial({ color: 0xffc928, roughness: 0.35, clearcoat: 0.5 });
    nz.add(mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.26, 16), y, { rot: [Math.PI / 2, 0, 0], pos: [0, 0.02, 0.1] }));
    nz.add(mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.06, 16), new THREE.MeshStandardMaterial({ color: 0xc89b45, metalness: 1, roughness: 0.3 }), { rot: [Math.PI / 2, 0, 0], pos: [0, 0.02, 0.25] }));
    nz.visible = false;
    P.nozzle = nz;
    // stream: tube along a parabola, animated streaks
    P.streamMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uTime: U.uTime, uOn: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `${GLSL_NOISE} varying vec2 vUv; uniform float uTime; uniform float uOn;
        void main(){ float s = vUv.x; float n = vnoise2(vec2(s * 30.0 - uTime * 14.0, vUv.y * 6.0));
          float edge = 1.0 - pow(abs(vUv.y - 0.5) * 2.0, 2.0);
          vec3 c = mix(vec3(0.55, 0.85, 1.0), vec3(1.6, 1.8, 1.9), smoothstep(0.55, 0.9, n));
          float a = (0.45 + 0.4 * n) * edge * uOn * smoothstep(0.0, 0.04, s);
          gl_FragColor = vec4(c * 1.2, a); }`,
    });
    P.stream = new THREE.Mesh(new THREE.BufferGeometry(), P.streamMat); P.stream.visible = false; P.stream.frustumCulled = false; P.stream.renderOrder = 120; scene.add(P.stream);
  }
  // ---------- puddle ----------
  P.puddle = mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshPhysicalMaterial({ color: 0x5a8aa0, roughness: 0.05, transparent: true, opacity: 0.55, clearcoat: 1 }), { cast: false });
  P.puddle.rotation.x = -Math.PI / 2; P.puddle.visible = false; scene.add(P.puddle);
  return P;
}

function plasticMat(hex) { return new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.35, clearcoat: 0.6 }); }

export function setHose(P, from, to, t) {
  // hose lies on the lawn from the spigot to the gorilla's hand
  const mid1 = new THREE.Vector3(from.x + 0.3, 0.03, from.z + 0.9);
  const mid2 = new THREE.Vector3(lerp(from.x, to.x, 0.5), 0.03, Math.min(from.z, to.z) + 0.6);
  const mid3 = new THREE.Vector3(to.x - 0.25, 0.03, to.z - 0.1);
  const curve = new THREE.CatmullRomCurve3([from.clone(), new THREE.Vector3(from.x, 0.03, from.z + 0.2), mid1, mid2, mid3, new THREE.Vector3(to.x - 0.1, Math.min(0.4, to.y * 0.5), to.z), to.clone()]);
  P.hoseMesh.geometry.dispose();
  P.hoseMesh.geometry = new THREE.TubeGeometry(curve, 160, 0.028, 10);
}

export function setStream(P, a, v, gy, tEnd) {
  // parabola from a with velocity v until time tEnd
  const pts = [];
  for (let i = 0; i <= 40; i++) { const tt = (i / 40) * tEnd; pts.push(new THREE.Vector3(a.x + v.x * tt, a.y + v.y * tt + 0.5 * gy * tt * tt, a.z + v.z * tt)); }
  P.stream.geometry.dispose();
  P.stream.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.035, 8);
}
