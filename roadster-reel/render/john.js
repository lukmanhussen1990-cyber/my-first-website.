// John: cute stylised driver. Big expressive eyes behind clear racing goggles,
// messy brown hair, red hoodie. All expression controls are plain numbers set per frame.
import * as THREE from 'three';
import { canvasTex } from './tex.js';
import { rng, clamp, lerp } from './util.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const WHEEL_POS = V(0.17, 0.675, 0);           // steering wheel centre (car body space)
export const WHEEL_N = V(-0.85, 0.52, 0).normalize(); // wheel faces the driver

const lin = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);

function irisTexture() {
  return canvasTex(256, 256, (ctx, w) => {
    const c = w / 2;
    const g = ctx.createRadialGradient(c, c, 0, c, c, c);
    g.addColorStop(0.0, '#050302'); g.addColorStop(0.36, '#050302');
    g.addColorStop(0.40, '#3d2412'); g.addColorStop(0.62, '#7a4a22'); g.addColorStop(0.82, '#5a3418'); g.addColorStop(0.93, '#2a170a'); g.addColorStop(1.0, '#1a0d05');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c, c, c, 0, Math.PI * 2); ctx.fill();
    // radial fibres
    const R = rng(4);
    for (let i = 0; i < 90; i++) {
      const a = (i / 90) * Math.PI * 2 + R() * 0.05;
      ctx.strokeStyle = `rgba(${150 + R() * 60},${100 + R() * 40},${50 + R() * 20},${0.15 + R() * 0.2})`;
      ctx.lineWidth = 1 + R() * 1.5;
      ctx.beginPath(); ctx.moveTo(c + Math.cos(a) * c * 0.42, c + Math.sin(a) * c * 0.42); ctx.lineTo(c + Math.cos(a) * c * (0.78 + R() * 0.12), c + Math.sin(a) * c * (0.78 + R() * 0.12)); ctx.stroke();
    }
  });
}
function blushTexture() {
  return canvasTex(128, 128, (ctx, w) => {
    const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(255,120,120,0.55)'); g.addColorStop(1, 'rgba(255,120,120,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, w);
  });
}

// spherical cap with polar (radial) UVs so a round texture maps cleanly
function capGeometry(r, thetaMax, seg = 32, rings = 10) {
  const g = new THREE.SphereGeometry(r, seg, rings, 0, Math.PI * 2, 0, thetaMax);
  const p = g.getAttribute('position'), uv = g.getAttribute('uv');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const th = Math.acos(clamp(y / r, -1, 1)) / thetaMax;
    const ph = Math.atan2(z, x);
    uv.setXY(i, 0.5 + 0.5 * th * Math.cos(ph), 0.5 + 0.5 * th * Math.sin(ph));
  }
  g.rotateZ(-Math.PI / 2); // cap axis -> +X
  return g;
}

function capsuleBetween(mesh, p0, p1) {
  const d = new THREE.Vector3().subVectors(p1, p0);
  mesh.position.copy(p0).addScaledVector(d, 0.5);
  mesh.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
}

function ik2(S, T, a, b, pole) {
  const d0 = new THREE.Vector3().subVectors(T, S);
  let d = d0.length();
  d = clamp(d, Math.abs(a - b) + 1e-3, a + b - 1e-3);
  const u = d0.normalize();
  const cosA = (a * a + d * d - b * b) / (2 * a * d);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const v = pole.clone().addScaledVector(u, -pole.dot(u)).normalize();
  const E = S.clone().addScaledVector(u, a * cosA).addScaledVector(v, a * sinA);
  const Tn = S.clone().addScaledVector(u, d);
  return { E, T: Tn };
}

export function buildJohn() {
  const john = new THREE.Group();
  john.position.set(-0.27, 0.375, 0);         // hips, in car-body space
  const M = {
    skin: new THREE.MeshPhysicalMaterial({ color: lin(0.93, 0.70, 0.55), roughness: 0.55, sheen: 0.4, sheenColor: lin(1.0, 0.6, 0.5), sheenRoughness: 0.5, emissive: lin(0.93, 0.62, 0.5), emissiveIntensity: 0.07 }),
    skinDark: new THREE.MeshStandardMaterial({ color: lin(0.88, 0.60, 0.46), roughness: 0.6 }),
    hoodie: new THREE.MeshPhysicalMaterial({ color: lin(0.86, 0.11, 0.10), roughness: 0.82, sheen: 0.8, sheenColor: lin(1.0, 0.45, 0.4), sheenRoughness: 0.6, emissive: lin(0.86, 0.11, 0.1), emissiveIntensity: 0.05 }),
    hoodieDark: new THREE.MeshStandardMaterial({ color: lin(0.62, 0.07, 0.07), roughness: 0.85 }),
    string: new THREE.MeshStandardMaterial({ color: lin(0.95, 0.95, 0.92), roughness: 0.7 }),
    jeans: new THREE.MeshStandardMaterial({ color: lin(0.18, 0.26, 0.42), roughness: 0.8 }),
    hair: new THREE.MeshPhysicalMaterial({ color: lin(0.50, 0.29, 0.14), roughness: 0.48, sheen: 0.6, sheenColor: lin(0.9, 0.6, 0.35), sheenRoughness: 0.4 }),
    sclera: new THREE.MeshPhysicalMaterial({ color: lin(0.98, 0.98, 0.97), roughness: 0.12, clearcoat: 1.0, clearcoatRoughness: 0.05 }),
    iris: new THREE.MeshPhysicalMaterial({ map: irisTexture(), roughness: 0.1, clearcoat: 1.0, clearcoatRoughness: 0.03 }),
    glint: new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(2.6) }),
    lash: new THREE.MeshStandardMaterial({ color: lin(0.10, 0.06, 0.04), roughness: 0.6 }),
    brow: new THREE.MeshStandardMaterial({ color: lin(0.28, 0.15, 0.07), roughness: 0.6 }),
    mouth: new THREE.MeshStandardMaterial({ color: lin(0.42, 0.06, 0.08), roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    teeth: new THREE.MeshStandardMaterial({ color: lin(0.97, 0.96, 0.92), roughness: 0.35, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
    tongue: new THREE.MeshStandardMaterial({ color: lin(0.92, 0.40, 0.42), roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
    blush: new THREE.MeshBasicMaterial({ map: blushTexture(), transparent: true, depthWrite: false, opacity: 0.9 }),
    chrome: new THREE.MeshStandardMaterial({ color: lin(0.92, 0.92, 0.95), roughness: 0.12, metalness: 1.0 }),
    rubber: new THREE.MeshStandardMaterial({ color: lin(0.08, 0.08, 0.09), roughness: 0.55 }),
    leather: new THREE.MeshStandardMaterial({ color: lin(0.45, 0.24, 0.10), roughness: 0.6 }),
    lens: new THREE.MeshPhysicalMaterial({ color: lin(1.0, 0.85, 0.55), roughness: 0.02, transparent: true, opacity: 0.16, envMapIntensity: 2.0, depthWrite: false }),
    foam: new THREE.MeshPhysicalMaterial({ color: lin(0.97, 0.98, 1.0), roughness: 0.45, sheen: 1.0, sheenColor: lin(0.85, 0.9, 1.0), clearcoat: 0.6, clearcoatRoughness: 0.3 }),
    star: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.85, 0.2).multiplyScalar(4) }),
  };
  const add = (parent, geo, mat, pos, cast = true) => { const m = new THREE.Mesh(geo, mat); if (pos) m.position.copy(pos); m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m; };

  // ---- torso ----
  const torsoPivot = new THREE.Group(); john.add(torsoPivot);
  const prof = [[0.0, 0.0], [0.13, 0.01], [0.175, 0.06], [0.19, 0.16], [0.185, 0.26], [0.165, 0.33], [0.12, 0.38], [0.06, 0.405], [0.0, 0.41]].map(([r, y]) => new THREE.Vector2(r, y));
  const torsoGeo = new THREE.LatheGeometry(prof, 32); torsoGeo.scale(0.9, 1, 1.05);
  add(torsoPivot, torsoGeo, M.hoodie, V(0, 0, 0));
  // kangaroo pocket and hem
  const pocket = add(torsoPivot, new THREE.SphereGeometry(1, 24, 12, -0.9, 1.8, 1.25, 0.5), M.hoodieDark, V(0, 0.2, 0));
  pocket.scale.set(0.172, 0.21, 0.19);
  const hem = add(torsoPivot, new THREE.TorusGeometry(0.16, 0.022, 8, 32), M.hoodieDark, V(0, 0.03, 0)); hem.rotation.x = Math.PI / 2; hem.scale.set(0.95, 1.1, 1);
  // hood bunched behind the neck
  const hood = add(torsoPivot, new THREE.TorusGeometry(0.095, 0.05, 12, 28, Math.PI * 1.35), M.hoodie, V(-0.035, 0.40, 0));
  hood.rotation.set(Math.PI / 2, 0, Math.PI * 0.82);
  // drawstrings
  for (const s of [1, -1]) {
    const st = add(torsoPivot, new THREE.CylinderGeometry(0.0055, 0.0055, 0.13, 6), M.string, V(0.155, 0.31, 0.035 * s));
    st.rotation.z = -0.22;
    add(torsoPivot, new THREE.CylinderGeometry(0.009, 0.009, 0.022, 8), M.string, V(0.168, 0.24, 0.035 * s)).rotation.z = -0.22;
  }
  // neck
  add(torsoPivot, new THREE.CylinderGeometry(0.045, 0.05, 0.08, 16), M.skinDark, V(0.0, 0.43, 0));

  // ---- legs (mostly hidden under the dash) ----
  const legs = new THREE.Group(); john.add(legs);
  for (const s of [1, -1]) {
    const thigh = add(legs, new THREE.CapsuleGeometry(0.058, 0.28, 6, 12), M.jeans);
    capsuleBetween(thigh, V(0.02, 0.06, 0.085 * s), V(0.33, 0.13, 0.10 * s));
    const shin = add(legs, new THREE.CapsuleGeometry(0.05, 0.22, 6, 12), M.jeans);
    capsuleBetween(shin, V(0.36, 0.12, 0.10 * s), V(0.52, -0.12, 0.10 * s));
  }

  // ---- arms (IK each frame) ----
  const arms = [1, -1].map((s) => {
    const upper = add(john, new THREE.CapsuleGeometry(0.05, 0.16, 6, 12), M.hoodie);
    const fore = add(john, new THREE.CapsuleGeometry(0.046, 0.16, 6, 12), M.hoodie);
    const cuff = add(john, new THREE.CylinderGeometry(0.05, 0.05, 0.03, 14), M.hoodieDark);
    const hand = new THREE.Group(); john.add(hand);
    const palm = add(hand, new THREE.SphereGeometry(1, 16, 12), M.skin); palm.scale.set(0.045, 0.04, 0.052);
    const thumb = add(hand, new THREE.CapsuleGeometry(0.014, 0.03, 4, 8), M.skin, V(0.01, 0.03, -0.03 * s)); thumb.rotation.x = 0.6 * s;
    return { s, upper, fore, cuff, hand, thumb };
  });

  // ---- head ----
  const neckPivot = new THREE.Group(); neckPivot.position.set(0.0, 0.44, 0); torsoPivot.add(neckPivot);
  const headGroup = new THREE.Group(); headGroup.position.set(0.035, 0.11, 0); neckPivot.add(headGroup);
  const RH = 0.155;
  const head = add(headGroup, new THREE.SphereGeometry(RH, 48, 36), M.skin);
  head.scale.set(1.0, 0.97, 1.04);
  for (const s of [1, -1]) {
    const ear = add(headGroup, new THREE.SphereGeometry(0.034, 16, 12), M.skin, V(-0.005, -0.005, 0.158 * s)); ear.scale.set(0.8, 1.0, 0.5);
  }
  const nose = add(headGroup, new THREE.SphereGeometry(0.023, 16, 12), M.skinDark, V(0.152, -0.032, 0));
  // blush
  for (const s of [1, -1]) {
    const b = add(headGroup, new THREE.PlaneGeometry(0.055, 0.04), M.blush, null, false);
    const dir = V(Math.cos(-0.3) * Math.cos(0.62 * s), Math.sin(-0.3), Math.cos(-0.3) * Math.sin(0.62 * s));
    b.position.copy(dir.clone().multiplyScalar(RH * 1.01)); b.lookAt(b.position.clone().multiplyScalar(2)); b.renderOrder = 3;
  }

  // eyes
  const eyes = [1, -1].map((s) => {
    const center = V(0.108, 0.012, 0.062 * s);
    const g = new THREE.Group(); g.position.copy(center); headGroup.add(g);
    const RE = 0.05;
    add(g, new THREE.SphereGeometry(RE, 32, 24), M.sclera, null, false);
    const gaze = new THREE.Group(); g.add(gaze);
    add(gaze, capGeometry(RE * 1.008, Math.asin(0.032 / RE), 40, 10), M.iris, null, false);
    // fixed glints
    add(g, new THREE.SphereGeometry(0.0085, 10, 8), M.glint, V(0.044, 0.02, 0.012 * s + 0.004), false);
    add(g, new THREE.SphereGeometry(0.0045, 8, 6), M.glint, V(0.047, -0.008, -0.01 * s + 0.002), false);
    // upper lid (hemisphere cap around +Y) with lash line
    const lid = new THREE.Group(); g.add(lid);
    add(lid, new THREE.SphereGeometry(RE * 1.07, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.skin, null, false);
    const lash = add(lid, new THREE.TorusGeometry(RE * 1.07, 0.0042, 6, 40, Math.PI), M.lash, null, false);
    lash.rotation.x = Math.PI / 2; lash.rotation.z = -Math.PI / 2;
    // lower lid (small)
    const lowLid = new THREE.Group(); g.add(lowLid);
    add(lowLid, new THREE.SphereGeometry(RE * 1.05, 32, 8, 0, Math.PI * 2, Math.PI * 0.72, Math.PI * 0.28), M.skin, null, false);
    return { g, gaze, lid, lowLid, s };
  });
  // brows
  const brows = [1, -1].map((s) => {
    const pos = V(0.128, 0.108, 0.064 * s).normalize().multiplyScalar(RH + 0.007);
    const b = add(headGroup, new THREE.CapsuleGeometry(0.0095, 0.048, 4, 10), M.brow, pos, false);
    b.rotation.set(Math.PI / 2, 0, 0);
    return { m: b, s, base: b.position.clone() };
  });
  // goggles
  const goggles = new THREE.Group(); headGroup.add(goggles);
  for (const s of [1, -1]) {
    const dir = V(0.108, 0.012, 0.062 * s).normalize();
    const eg = new THREE.Group(); eg.position.copy(dir.clone().multiplyScalar(0.152)); eg.quaternion.setFromUnitVectors(V(1, 0, 0), dir); goggles.add(eg);
    const rim = add(eg, new THREE.TorusGeometry(0.054, 0.0105, 12, 40), M.chrome, V(0.008, 0, 0)); rim.rotation.y = Math.PI / 2;
    const seal = add(eg, new THREE.TorusGeometry(0.056, 0.0125, 10, 40), M.rubber, V(-0.004, 0, 0)); seal.rotation.y = Math.PI / 2;
    const lens = add(eg, capGeometry(0.075, Math.asin(0.054 / 0.075), 32, 6), M.lens, V(0.008 - 0.052, 0, 0), false);
    lens.renderOrder = 4;
  }
  add(goggles, new THREE.CylinderGeometry(0.007, 0.007, 0.03, 8), M.chrome, V(0.158, 0.02, 0)).rotation.x = Math.PI / 2;
  const strapG = new THREE.TorusGeometry(0.159, 0.014, 8, 56, Math.PI * 2 - 1.9); strapG.rotateZ(0.95); strapG.rotateX(Math.PI / 2);
  const strap = add(goggles, strapG, M.leather, V(-0.004, 0.02, 0));
  strap.scale.set(1.0, 1.0, 1.06); strap.rotation.z = -0.06;

  // hair: lumpy volume cap + messy tapered spikes
  const hairG = new THREE.Group(); headGroup.add(hairG);
  const capG = new THREE.SphereGeometry(RH * 1.075, 56, 28, 0, Math.PI * 2, 0, 1.5);
  {
    const p = capG.getAttribute('position'); const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.set(p.getX(i), p.getY(i), p.getZ(i));
      const n = v.clone().normalize();
      const lump = 1 + 0.035 * Math.sin(n.x * 11 + n.z * 5) * Math.sin(n.z * 13 - n.y * 4) + 0.02 * Math.sin(n.x * 23 + n.y * 17);
      v.multiplyScalar(lump); p.setXYZ(i, v.x, v.y, v.z);
    }
    capG.computeVertexNormals();
  }
  const cap = add(hairG, capG, M.hair); cap.rotation.z = 0.55; cap.position.set(-0.012, 0.004, 0); cap.scale.set(1, 1, 1.03);
  const tuftGeo = (() => {
    const p = [];
    for (let i = 0; i <= 6; i++) { const ph = -Math.PI / 2 + (i / 6) * Math.PI / 2; p.push(new THREE.Vector2(0.042 * Math.cos(ph), 0.022 * Math.sin(ph))); }
    for (let i = 1; i <= 12; i++) { const t = i / 12; p.push(new THREE.Vector2(Math.max(0.0008, 0.042 * Math.pow(1 - t, 1.25)), 0.105 * t)); }
    const g = new THREE.LatheGeometry(p, 12);
    // bend the spike so it curls a little
    const pos = g.getAttribute('position');
    for (let i = 0; i < pos.count; i++) { const y = Math.max(0, pos.getY(i)); pos.setX(i, pos.getX(i) + 1.6 * y * y); }
    g.computeVertexNormals();
    return g;
  })();
  const R = rng(17);
  const tufts = [];
  // [elevation, azimuth (0 = forward, +z right), length, curl roll]
  const tuftSpots = [
    [0.62, 0.0, 1.0, 0], [0.55, 0.32, 0.95, 0.4], [0.55, -0.32, 0.95, -0.4], [0.5, 0.65, 0.9, 0.8], [0.5, -0.65, 0.9, -0.8],
    [0.85, 0.15, 0.8, 0.3], [0.85, -0.25, 0.8, -0.3], [1.05, 0.5, 0.7, 1.2], [1.05, -0.6, 0.7, -1.2], [1.2, 0.0, 0.65, 0],
    [1.15, 1.6, 0.75, 1.6], [1.15, -1.6, 0.75, -1.6], [0.9, 1.1, 0.85, 1.4], [0.9, -1.1, 0.85, -1.4], [0.75, 2.2, 0.9, 2.3],
    [0.75, -2.2, 0.9, -2.3], [0.6, 2.7, 0.9, 3.0], [0.6, -2.7, 0.9, -3.0], [0.4, 3.14, 0.85, 3.14], [1.0, 2.8, 0.75, 2.9],
    [1.0, -2.8, 0.75, -2.9], [0.35, 1.35, 0.8, 1.5], [0.35, -1.35, 0.8, -1.5],
  ];
  for (const [el, az, len, roll] of tuftSpots) {
    const n = V(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
    const m = add(hairG, tuftGeo, M.hair, n.clone().multiplyScalar(RH * 1.04));
    // spikes lean outward + back, bangs fall forward
    const out = n.clone().add(V(el < 0.7 && Math.abs(az) < 0.8 ? 0.35 : -0.25, el < 0.7 && Math.abs(az) < 0.8 ? -0.25 : 0.35, 0)).normalize();
    m.quaternion.setFromUnitVectors(V(0, 1, 0), out);
    m.rotateY(roll + (R() - 0.5) * 0.8);
    const sc = (0.85 + R() * 0.35); m.scale.set(sc, sc * len * (el > 1.0 ? 0.55 : el > 0.8 ? 0.8 : 1.0), sc);
    tufts.push(m);
  }

  // mouth decal (rebuilt each frame from expression parameters)
  const NM = 18;
  const mkDecal = (mat) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NM * 6 * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(NM * 6 * 3), 3));
    const m = new THREE.Mesh(g, mat); m.frustumCulled = false; headGroup.add(m); return m;
  };
  const mouth = mkDecal(M.mouth), teeth = mkDecal(M.teeth), tongue = mkDecal(M.tongue);
  const sph = (a, b, r) => V(Math.cos(b) * Math.cos(a), Math.sin(b), Math.cos(b) * Math.sin(a)).multiplyScalar(r);
  function fillDecal(mesh, upper, lower, r) {
    const pos = mesh.geometry.getAttribute('position'), nor = mesh.geometry.getAttribute('normal');
    let k = 0;
    for (let i = 0; i < NM; i++) {
      const quad = [upper[i], upper[i + 1], lower[i + 1], upper[i], lower[i + 1], lower[i]];
      for (const [a, b] of quad) { const p = sph(a, b, r); pos.setXYZ(k, p.x, p.y, p.z); const n = p.clone().normalize(); nor.setXYZ(k, n.x, n.y, n.z); k++; }
    }
    pos.needsUpdate = true; nor.needsUpdate = true;
    mesh.geometry.computeBoundingSphere();
  }

  // foam blobs (end gag) and dizzy stars
  const foam = new THREE.Group(); headGroup.add(foam);
  const FR = rng(9);
  const foamSpots = [[0.17, 0.03, 0.06, 0.045], [0.165, 0.055, 0.035, 0.032], [0.17, -0.005, 0.085, 0.03], [0.16, 0.06, 0.09, 0.028], [0.15, 0.08, -0.07, 0.026],
    [0.05, 0.18, 0.0, 0.06], [0.0, 0.19, 0.06, 0.05], [-0.04, 0.17, -0.06, 0.055], [0.08, 0.16, -0.05, 0.04], [0.09, 0.16, 0.07, 0.035], [-0.09, 0.15, 0.02, 0.045]];
  for (const [x, y, z, r] of foamSpots) {
    const m = add(foam, new THREE.IcosahedronGeometry(r, 2), M.foam, V(x, y, z));
    m.scale.set(1, 0.8 + FR() * 0.3, 1);
  }
  foam.visible = false;
  const stars = new THREE.Group(); stars.position.set(0.0, 0.21, 0); headGroup.add(stars);
  const starShape = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + Math.PI / 2; const r = i % 2 ? 0.012 : 0.028; if (i === 0) starShape.moveTo(Math.cos(a) * r, Math.sin(a) * r); else starShape.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  const starGeo = new THREE.ExtrudeGeometry(starShape, { depth: 0.008, bevelEnabled: false }); starGeo.center();
  const starMeshes = [0, 1, 2].map(() => { const m = new THREE.Mesh(starGeo, M.star); stars.add(m); return m; });
  stars.visible = false;

  // ---------------- expression state ----------------
  const state = {
    eyeOpen: 1, lookX: 0, lookY: 0, browRaise: 0, browTilt: 0, mouthOpen: 0, smile: 0.35, mouthW: 1,
    headYaw: 0, headPitch: 0, headRoll: 0, leanPitch: 0, leanRoll: 0, leanSide: 0, squish: 0, squishSide: 1,
    honk: 0, wave: 0, foam: 0, dizzy: 0, time: 0, handsOff: 0,
  };

  const wheelUp = V(0.52, 0.85, 0).normalize();
  function update(t, carBody) {
    const s = state;
    // torso lean
    torsoPivot.rotation.set(s.leanRoll, 0, s.leanPitch);
    torsoPivot.position.set(0, 0, s.leanSide);
    // head
    neckPivot.rotation.set(s.headRoll, s.headYaw, s.headPitch, 'YXZ');
    // squish against the side glass: John slides across the seat, face flattens on the window
    const sq = s.squish;
    john.position.set(-0.27, 0.375, 0.40 * sq * s.squishSide);
    neckPivot.position.set(0.0, 0.44, 0.17 * sq * s.squishSide);
    headGroup.position.set(0.035, 0.11 + 0.07 * sq, 0);
    headGroup.scale.set(1 - 0.36 * sq, 1 + 0.12 * sq, 1 + 0.34 * sq);
    nose.scale.set(1 - 0.6 * sq, 1 + 0.25 * sq, 1 + 0.5 * sq);
    // eyes
    const lidA = lerp(-0.62, 0.62, clamp(s.eyeOpen, 0, 1.15));
    for (const e of eyes) {
      e.gaze.rotation.set(0, -s.lookX, s.lookY, 'YXZ');
      e.lid.rotation.set(0, 0, lidA - 0.12 * s.browTilt * e.s * 0);
      e.lowLid.rotation.set(0, 0, 0.18 * clamp(s.smile, 0, 1) * 0.6);
      e.g.scale.setScalar(1 + 0.12 * sq + 0.06 * Math.max(0, s.eyeOpen - 1));
    }
    for (const b of brows) {
      b.m.position.copy(b.base).add(V(0, 0.012 * s.browRaise, 0));
      b.m.rotation.set(Math.PI / 2 + 0.38 * s.browTilt * b.s, -0.42 * b.s, 0, 'YXZ');
    }
    // mouth
    const w = 0.21 * s.mouthW, b0 = -0.50, open = clamp(s.mouthOpen, 0, 1), sm = clamp(s.smile, -1, 1);
    const up = [], lo = [], tu = [], tl = [], gu = [], gl = [];
    for (let i = 0; i <= NM; i++) {
      const u = i / NM * 2 - 1; const a = u * w;
      const line = b0 - sm * 0.055 * (1 - u * u);
      const thick = 0.012 + open * 0.17 * (1 - u * u);
      const yu = line + 0.006 + open * 0.03 * (1 - u * u);
      const yl = line - thick;
      up.push([a, yu]); lo.push([a, yl]);
      // teeth band under the upper lip
      const ti = 0.8; tu.push([a * ti, yu - 0.004]); tl.push([a * ti, yu - 0.004 - Math.min(0.035, open * 0.05) * (1 - u * u)]);
      gu.push([a * 0.7, yl + Math.min(0.05, open * 0.07) * (1 - u * u)]); gl.push([a * 0.7, yl + 0.004]);
    }
    fillDecal(mouth, up, lo, RH * 1.012);
    teeth.visible = open > 0.12; tongue.visible = open > 0.2;
    if (teeth.visible) fillDecal(teeth, tu, tl, RH * 1.015);
    if (tongue.visible) fillDecal(tongue, gu, gl, RH * 1.015);
    // arms: hands on the wheel (or honking)
    const swPos = WHEEL_POS.clone();
    for (const a of arms) {
      torsoPivot.updateMatrix();
      const sh = V(0.0, 0.36, 0.165 * a.s).applyMatrix4(torsoPivot.matrix);
      const rimT = swPos.clone().addScaledVector(wheelUp, 0.13 * 0.55).add(V(0, 0, 0.11 * a.s));
      let target = rimT.clone().sub(john.position);
      if (a.s > 0 && s.honk > 0) {
        const hub = swPos.clone().addScaledVector(WHEEL_N, 0.03).sub(john.position);
        target.lerp(hub, clamp(s.honk, 0, 1));
      }
      if (s.handsOff > 0) target.lerp(sh.clone().add(V(0.12, 0.25, 0.12 * a.s)), s.handsOff);
      const { E, T } = ik2(sh, target, 0.19, 0.19, V(-0.2, -1, 0.9 * a.s));
      a.upper.geometry.dispose(); a.upper.geometry = new THREE.CapsuleGeometry(0.05, Math.max(0.01, sh.distanceTo(E) - 0.04), 6, 12); capsuleBetween(a.upper, sh, E);
      a.fore.geometry.dispose(); a.fore.geometry = new THREE.CapsuleGeometry(0.046, Math.max(0.01, E.distanceTo(T) - 0.06), 6, 12); capsuleBetween(a.fore, E, T);
      const dirF = T.clone().sub(E).normalize();
      a.cuff.position.copy(T).addScaledVector(dirF, -0.02); a.cuff.quaternion.setFromUnitVectors(V(0, 1, 0), dirF);
      a.hand.position.copy(T).addScaledVector(dirF, 0.03);
      a.hand.quaternion.setFromUnitVectors(V(1, 0, 0), dirF);
    }
    // foam & stars
    foam.visible = s.foam > 0.01; foam.scale.setScalar(Math.max(0.001, s.foam));
    stars.visible = s.dizzy > 0.01;
    if (stars.visible) {
      starMeshes.forEach((m, i) => { const a = t * 7 + (i / 3) * Math.PI * 2; m.position.set(Math.cos(a) * 0.15, Math.sin(a * 2) * 0.012, Math.sin(a) * 0.15); m.rotation.set(0, -a, 0.3); m.scale.setScalar(s.dizzy); });
    }
  }
  return { group: john, state, update, mats: M, headGroup, eyes };
}
