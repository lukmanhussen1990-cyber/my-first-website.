// Shot timeline: every frame is a pure function of t.
import * as THREE from './three.module.js';
import { W, H, FPS, clamp, lerp, seg, smooth, smoother, eOut, eIn, eIO, backOut, backIn, elastic, spring, wig, antic, keys, noise, hash } from './util.js';
import { CX, FZ, DH, makePolaroid, makeSanta, makeGradCap, makeWrench, makeMug, makePapers, gradTex } from './sets.js';
import { box, cyl, ico, cone, at, group, canvasTex, mat, glowSprite } from './lowpoly.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
let C = null;
const PI = Math.PI;

// ------------------------------------------------------------------ helpers
function cam(t, pos, look, fov, o = {}) {
  const c = C.camera, hand = o.hand ?? 1, sh = o.shake ?? 0;
  const d = Math.hypot(pos[0] - look[0], pos[1] - look[1], pos[2] - look[2]);
  c.position.set(pos[0] + noise(t * 0.7, 11) * 0.007 * hand * d, pos[1] + noise(t * 0.6, 12) * 0.007 * hand * d, pos[2] + noise(t * 0.5, 18) * 0.004 * hand * d);
  c.up.set(0, 1, 0);
  c.lookAt(look[0] + noise(t * 0.55, 13) * 0.005 * hand * d, look[1] + noise(t * 0.5, 19) * 0.005 * hand * d, look[2]);
  c.rotateZ((o.roll ?? 0) + noise(t * 0.45, 14) * 0.006 * hand + sh * noise(t * 38, 15) * 0.03);
  c.rotateX(sh * noise(t * 41, 16) * 0.02); c.rotateY(sh * noise(t * 37, 17) * 0.02);
  c.fov = fov; c.near = o.near ?? 0.02; c.updateProjectionMatrix();
  c.updateMatrixWorld(true);
}
function proj(v) { const p = v.clone().project(C.camera); return [(p.x * 0.5 + 0.5) * W, (-p.y * 0.5 + 0.5) * H]; }
function wp(obj) { obj.updateWorldMatrix(true, false); return obj.getWorldPosition(V(0, 0, 0)); }
function blink(t, seed, per = 3.2) { const ph = (t + hash(seed) * per) % per; return ph < 0.14 ? Math.sin(ph / 0.14 * PI) : 0; }
function env(t) { const e = C.data.env; return e[Math.min(e.length - 1, Math.max(0, Math.round(t * FPS)))] || 0; }
function shake(t, evs) { let s = 0; for (const [t0, a, k] of evs) if (t >= t0) s += a * Math.exp(-(t - t0) * k); return s; }
function toW(x, z, ry, lx, ly, lz) { const c = Math.cos(ry), s = Math.sin(ry); return [x + lx * c + lz * s, ly, z - lx * s + lz * c]; }
function lipsync(t, amt = 1) { const e = env(t); return clamp(e * 1.15 * amt) * (0.75 + 0.25 * Math.sin(t * 31)); }

// ------------------------------------------------------------------ poses
function crawl(ch, x, z, ry, o = {}) {
  const boss = ch.kind === 'boss';
  const pitch = o.pitch ?? 1.32;
  const L = (lx, ly, lz) => toW(x, z, ry, lx, ly, lz);
  const hy = (o.hipY ?? (boss ? 0.6 : 0.56));
  return {
    x, z, ry, hipY: hy, hipR: [pitch, o.yaw ?? 0, o.roll ?? 0],
    legL: [-pitch + 0.06, 0, -0.12, 1.62], legR: [-pitch + 0.06, 0, 0.12, 1.62], ankleL: [0.6, 0, 0], ankleR: [0.6, 0, 0],
    spine: [0.15 + (o.spineX ?? 0), o.spineY ?? 0, o.spineZ ?? 0],
    neck: [-0.85 + (o.neckX ?? 0), o.neckY ?? 0, o.neckZ ?? 0], head: [-0.62 + (o.headX ?? 0), o.headY ?? 0, o.headZ ?? 0],
    armL: o.armL ?? { ik: L(-0.22, 0.08, boss ? 0.66 : 0.62), pole: L(-0.7, 0.5, 0.3), hand: 'mitten', wr: [0.6, 0, 0] },
    armR: o.armR ?? { ik: L(0.22, 0.08, boss ? 0.66 : 0.62), pole: L(0.7, 0.5, 0.3), hand: 'mitten', wr: [0.6, 0, 0] },
    tieHang: true, tieSwing: o.tieSwing ?? 0, face: o.face ?? {}, breathe: o.breathe ?? 2.2, bper: o.bper ?? 1.4,
  };
}
function prone(ch, x, z, ry, o = {}) {
  const boss = ch.kind === 'boss';
  const pitch = 1.5;
  const L = (lx, ly, lz) => toW(x, z, ry, lx, ly, lz);
  return {
    x, z, ry, hipY: boss ? 0.13 : 0.12, hipR: [pitch, 0, o.roll ?? 0],
    legL: [PI / 2 - pitch - 0.02, 0, -0.06, 0.05], legR: [PI / 2 - pitch - 0.02, 0, 0.06, 0.12], ankleL: [1.1, 0, 0], ankleR: [1.1, 0, 0],
    spine: [-0.38 + (o.spineX ?? 0), o.spineY ?? 0, o.spineZ ?? 0],
    neck: [-0.62 + (o.neckX ?? 0), o.neckY ?? 0, o.neckZ ?? 0], head: [-0.52 + (o.headX ?? 0), o.headY ?? 0, o.headZ ?? 0],
    armL: o.armL ?? { ik: L(-0.17, 0.05, boss ? 0.78 : 0.74), pole: L(-0.5, -0.4, 0.2), hand: 'mitten', wr: [1.2, 0, 0] },
    armR: o.armR ?? { ik: L(0.17, 0.05, boss ? 0.78 : 0.74), pole: L(0.5, -0.4, 0.2), hand: 'mitten', wr: [1.2, 0, 0] },
    tieHang: true, face: o.face ?? {}, breathe: 1.2, bper: 2.2,
  };
}
function stand(ch, x, z, ry, o = {}) {
  return Object.assign({
    x, z, ry, legL: [0, 0, -0.04, 0], legR: [0, 0, 0.04, 0],
    armL: { sh: [0.05, 0, -0.1], el: -0.25 }, armR: { sh: [0.05, 0, 0.1], el: -0.25 }, face: {},
  }, o);
}
function handsOnHips(ch, x, z, ry) {
  const S = ch.S, L = (lx, ly, lz) => toW(x, z, ry, lx, ly, lz);
  return {
    armL: { ik: L(-S.waist * 0.55, S.hipH + 0.05, 0.0), pole: L(-0.7, S.hipH + 0.4, -0.25), hand: 'fist', wr: [0, 0, 0.3] },
    armR: { ik: L(S.waist * 0.55, S.hipH + 0.05, 0.0), pole: L(0.7, S.hipH + 0.4, -0.25), hand: 'fist', wr: [0, 0, -0.3] },
  };
}
function walk(ph, amp = 0.45) {
  const s = Math.sin(ph);
  return {
    legL: [-amp * s, 0, -0.03, Math.max(0, s) * 0.7 + 0.08], legR: [amp * s, 0, 0.03, Math.max(0, -s) * 0.7 + 0.08],
    armLsh: [amp * 0.8 * s, 0, -0.1], armRsh: [-amp * 0.8 * s, 0, 0.1], bob: Math.abs(Math.cos(ph)) * 0.025,
  };
}

// ------------------------------------------------------------------ set modes
function officeMode(mood = 'day') {
  const o = C.office; o.G.visible = true;
  C.scene.background = C.bg.office;
  C.key.position.set(1.6, 3.4, 2.2); C.key.target.position.set(0, 0.5, -0.9);
  C.fill.position.set(-2, 1.5, 3); C.fill.target.position.set(0, 0.6, -1);
  if (mood === 'dark') {
    C.hemi.intensity = 0.08; C.key.intensity = 0.15; C.fill.intensity = 0.05; C.scene.background = C.bg.dark;
  } else if (mood === 'pink') {
    C.hemi.intensity = 0.4; C.hemi.color.set('#ffd6ea'); C.key.intensity = 0.25; C.fill.intensity = 0.1; C.scene.background = C.bg.dark;
  } else if (mood === 'under') {
    C.hemi.intensity = 0.75; C.key.intensity = 1.7; C.fill.intensity = 0.55;
  } else if (mood === 'smoke') {
    C.hemi.intensity = 0.45; C.hemi.color.set('#ffe6d0'); C.key.intensity = 0.9; C.fill.intensity = 0.3;
    C.scene.fog = new THREE.Fog('#6f6a72', 1.2, 4.0); C.scene.background = new THREE.Color('#6f6a72');
  }
}
function hideWall() { C.office.refs.wallStuff.forEach(o => o.visible = false); C.office.refs.cables.forEach(o => o.visible = false); }
function torchOn(intensity = 3.0, target = V(-0.4, 0.33, -1.49)) {
  const T = C.torch; T.visible = true;
  const lens = wp(T.userData.lens);
  C.spot.position.copy(lens); C.spot.target.position.copy(target); C.spot.intensity = intensity; C.spot.distance = 3;
  const b = C.beam; b.visible = true; b.position.copy(lens); b.lookAt(target);
  const d = lens.distanceTo(target); b.scale.set(d * 0.8, d * 0.8, d); b.material.opacity = 0.1 * intensity / 3;
  C.wallPool.visible = true; C.wallPool.position.set(target.x, target.y, -1.488); C.wallPool.material.opacity = 0.35 * intensity / 3;
}
function cornerMode() {
  C.corner.G.visible = true; C.scene.background = C.bg.dusk;
  C.scene.fog = new THREE.Fog('#e89a7a', 14, 85);
  C.hemi.intensity = 1.05; C.hemi.color.set('#ffe1c2'); C.hemi.groundColor.set('#7a5a48');
  C.key.color.set('#ffc07a'); C.key.intensity = 2.6; C.key.position.set(CX + 5, 4.2, -5.5); C.key.target.position.set(CX - 0.2, 0.6, 0.0);
  C.fill.color.set('#b9d3ff'); C.fill.intensity = 0.75; C.fill.position.set(CX - 3, 2, 4); C.fill.target.position.set(CX, 1, 0);
  C.pt1.color.set('#ffd9a8'); C.pt1.intensity = 1.2; C.pt1.distance = 6; C.pt1.position.set(CX - 0.5, 2.6, 1.0);
}
function flashMode() {
  C.flash.G.visible = true; C.scene.background = C.bg.dream;
  C.hemi.intensity = 1.6; C.hemi.color.set('#fff0fb'); C.hemi.groundColor.set('#d9c6ff');
  C.key.intensity = 1.2; C.key.position.set(1, 3, FZ + 5); C.key.target.position.set(0, 0, FZ); C.key.castShadow = false;
  C.fill.intensity = 0.6; C.fill.position.set(-2, -1, FZ + 4); C.fill.target.position.set(0, 0, FZ);
}

// standard under-desk character placement (pre-zap)
const YP = { x: -0.33, z: -0.36, ry: PI - 0.2 }, BP = { x: 0.36, z: -0.06, ry: PI + 0.3 };
const SOCK = V(-0.42, 0.346, -1.48);
function youCrawl(t, o = {}) {
  const ch = C.chars.you;
  const reach = o.reach ?? SOCK.clone().add(V(0.0, 0.0, 0.1));
  const L = (lx, ly, lz) => toW(YP.x, YP.z, YP.ry, lx, ly, lz);
  const p = crawl(ch, YP.x, YP.z, YP.ry, {
    neckY: o.neckY ?? 0.25, headY: o.headY ?? 0.1, headZ: o.headZ ?? -0.12, neckZ: -0.05, spineY: 0.12,
    armR: { ik: [reach.x, reach.y, reach.z], pole: [reach.x + 0.3, 0.9, reach.z + 0.3], hand: 'fist', wr: [0.2, 0, 0] },
    face: o.face, headX: o.headX ?? 0,
  });
  p.armL = { ik: L(-0.2, 0.08, 0.6), pole: L(-0.7, 0.5, 0.2), hand: 'mitten', wr: [0.7, 0, 0] };
  ch.apply(p, t); C.plug.visible = o.plug ?? true;
  return ch;
}
function bossCrawl(t, o = {}) {
  const ch = C.chars.boss;
  const L = (lx, ly, lz) => toW(BP.x, BP.z, BP.ry, lx, ly, lz);
  const p = crawl(ch, BP.x, BP.z, BP.ry, {
    neckY: o.neckY ?? -0.28, headY: o.headY ?? -0.12, headZ: o.headZ ?? 0.14, neckZ: 0.06, spineY: -0.15,
    face: o.face, headX: o.headX ?? 0,
  });
  p.armL = { ik: o.cable ?? [0.02, 0.62, -1.36], pole: L(-0.2, 1.2, 0.5), hand: 'fist', wr: [0, 0, 0] };
  ch.apply(p, t);
  return ch;
}
function updateCharger() {
  const pp = wp(C.plug);
  const back = C.plug.localToWorld(V(0, 0, 0.05));
  const ph = V(-0.55, DH + 0.01, -0.86), edge = V(-0.55, DH + 0.005, -0.73);
  const mid = edge.clone().lerp(back, 0.5); mid.y -= 0.18; mid.z += 0.12;
  const pts = [ph, edge, V(edge.x - 0.01, DH - 0.12, edge.z + 0.03), mid, back];
  C.office.refs.charger.visible = C.plug.visible;
  if (C.plug.visible) { const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.006, 5, false); C.office.refs.charger.geometry.dispose(); C.office.refs.charger.geometry = g; }
}
function smokeAt(t, list) {
  // list: [t0, x,y,z, scale, n, seed]
  let k = 0;
  for (const [t0, x, y, z, sc, n, seed, dur = 1.6] of list) {
    for (let i = 0; i < n && k < C.smoke.length; i++, k++) {
      const m = C.smoke[k], d = t - t0 - hash(seed, i) * 0.15;
      if (d < 0 || d > dur) continue;
      const u = d / dur;
      const ang = hash(seed, i, 1) * PI * 2;
      const r = sc * (0.06 + 0.12 * hash(seed, i, 2)) * eOut(u, 2);
      m.visible = true;
      m.position.set(x + Math.cos(ang) * r, y + sc * 0.35 * eOut(u, 1.5) + Math.sin(ang) * r * 0.4, z + Math.sin(ang) * r * 0.5);
      const s = sc * (0.5 + 0.8 * hash(seed, i, 3)) * (0.35 + 0.9 * eOut(u, 2));
      m.scale.setScalar(s); m.rotation.set(u * 2 + i, u * 1.5, i);
      m.material.opacity = 0.75 * (1 - smooth(seg(u, 0.4, 1))) * smooth(seg(u, 0, 0.08));
    }
  }
}
function wisps(t, list) {
  let k = 0;
  for (const [x, y, z, sc, n, seed] of list) {
    for (let i = 0; i < n && k < C.smoke.length; i++, k++) {
      const m = C.smoke[k];
      const per = 1.5 + hash(seed, i), u = ((t + hash(seed, i, 2) * per) % per) / per;
      m.visible = true;
      m.position.set(x + (hash(seed, i, 3) - 0.5) * 0.12 * sc + Math.sin(u * 5 + i) * 0.02 * sc, y + u * 0.35 * sc, z + (hash(seed, i, 4) - 0.5) * 0.08);
      m.scale.setScalar(sc * (0.2 + 0.6 * u)); m.rotation.set(u * 3, i, u);
      m.material.opacity = 0.5 * Math.sin(PI * u);
    }
  }
}

// ------------------------------------------------------------------ photos for polaroids
export function makePhotos(ctx) {
  C = ctx;
  const { renderer, scene, chars } = ctx;
  const studio = new THREE.Scene();
  studio.add(new THREE.HemisphereLight('#ffffff', '#cbb8a6', 1.4));
  const dl = new THREE.DirectionalLight('#fff4e6', 2.3); dl.position.set(1.2, 3, 4); dl.castShadow = true; dl.shadow.mapSize.set(1024, 1024);
  Object.assign(dl.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2 }); studio.add(dl);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 }));
  back.position.z = -0.9; back.receiveShadow = true; studio.add(back);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 }));
  floor.rotation.x = -PI / 2; floor.receiveShadow = true; studio.add(floor);
  const props = new THREE.Group(); studio.add(props);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
  const shoot = (bgc, used, setup, cpos, look) => {
    props.clear(); back.material.color.set(bgc); floor.material.color.set(new THREE.Color(bgc).multiplyScalar(0.85));
    used.forEach(ch => studio.add(ch.root));
    const cleanup = setup(props) || (() => {});
    cam.position.set(...cpos); cam.lookAt(...look);
    const rt = new THREE.WebGLRenderTarget(512, 512, { samples: 4 });
    renderer.setRenderTarget(rt); renderer.render(studio, cam); renderer.setRenderTarget(null);
    cleanup();
    used.forEach(ch => { scene.add(ch.root); ch.root.visible = false; });
    return rt.texture;
  };
  const { you, boss, k1 } = chars;
  const T = 1.0;
  const life = [];
  life.push(['BABY ME', shoot('#9fd8ff', [k1], (g) => {
    k1.apply(stand(k1, 0, 0, 0.15, { face: { happy: 1, smile: 0.7, mouth: 0.35 }, armR: { sh: [-0.4, 0, 1.6], el: -1.2, hand: 'fist' }, armL: { sh: [-0.3, 0, -0.9], el: -0.6 } }), T);
    const r = group(at(cyl(0.008, 0.008, 0.12, 6, '#ff8fb1'), 0, 0, 0), at(ico(0.035, 0, '#ffd23f'), 0, 0.07, 0)); k1.wr.R.add(r); r.position.y = -0.04;
    return () => k1.wr.R.remove(r);
  }, [0.05, 0.72, 1.6], [0, 0.62, 0])]);
  life.push(['GRADUATION', shoot('#b79cff', [you], (g) => {
    you.apply(stand(you, 0, 0, 0.1, { face: { smile: 0.8, mouth: 0.3, brow: 0.4 }, armR: { sh: [-1.2, 0, 0.35], el: -0.6, hand: 'fist' } }), T);
    const cap = makeGradCap(); cap.position.y = you.S.R * 1.12; cap.rotation.x = -0.15; you.head.add(cap);
    const dip = group(at(cyl(0.02, 0.02, 0.24, 7, '#fbfbf2'), 0, 0, 0, 0, 0, PI / 2), at(cyl(0.022, 0.022, 0.025, 7, '#d42a3c'), 0, 0, 0, 0, 0, PI / 2)); dip.position.y = -0.06; you.wr.R.add(dip);
    return () => { you.head.remove(cap); you.wr.R.remove(dip); };
  }, [0.1, 1.75, 1.95], [0, 1.62, 0])]);
  life.push(['FIRST DAY', shoot('#ffd9a0', [you], (g) => {
    you.apply(stand(you, 0, 0, -0.15, { face: { grit: 1, brow: 0.6, browA: -0.25, sweat: 0.0 }, armL: { sh: [-1.3, 0, -0.5], el: -1.2, hand: 'fist', wr: [0, 0, 0] } }), T);
    const bc = box(0.3, 0.22, 0.08, '#6b4226'); bc.position.set(0, -0.2, 0); const bc2 = group(bc); you.wr.R.add(bc2);
    return () => you.wr.R.remove(bc2);
  }, [0.0, 1.66, 2.05], [0, 1.56, 0])]);
  life.push(['BIRTHDAY', shoot('#ffe58a', [k1], (g) => {
    k1.apply(stand(k1, 0, 0, 0, { face: { happy: 1, smile: 0.8, mouth: 0.5 } }), T);
    const hat = cone(0.06, 0.15, 6, '#ff4f8b'); hat.position.set(0.02, k1.S.R * 1.3, 0); hat.rotation.z = -0.2; k1.head.add(hat);
    const cake = group(at(cyl(0.16, 0.16, 0.12, 10, '#ffffff'), 0, 0.06, 0), at(cyl(0.165, 0.165, 0.03, 10, '#ff8fb1'), 0, 0.12, 0));
    for (let i = 0; i < 3; i++) { cake.add(at(cyl(0.006, 0.006, 0.06, 5, '#4d8cff'), -0.05 + i * 0.05, 0.16, 0)); cake.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.012, 5, 4), new THREE.MeshBasicMaterial({ color: '#ffcc33' })), -0.05 + i * 0.05, 0.2, 0)); }
    cake.position.set(0, 0.36, 0.25); g.add(cake); g.add(at(box(0.6, 0.36, 0.4, '#b97f4b'), 0, 0.18, 0.25));
    return () => k1.head.remove(hat);
  }, [0.0, 0.72, 1.6], [0, 0.6, 0])]);
  life.push(['GYM ERA', shoot('#9ff0c8', [you], (g) => {
    you.apply(stand(you, 0, 0, 0, { face: { grit: 1, brow: -0.2, browA: 0.35 }, armL: { sh: [0, 0, -1.45], el: -1.9, elY: 0, hand: 'fist' }, armR: { sh: [0, 0, 1.45], el: -1.9, hand: 'fist' } }), T);
  }, [0.0, 1.66, 2.0], [0, 1.56, 0])]);
  const bossP = [];
  bossP.push(['Q4 PRESENTATION', shoot('#8ecbff', [boss], (g) => {
    boss.apply(stand(boss, 0.18, 0, -0.35, { face: { smile: 0.6, brow: 0.5, mouth: 0.3 }, armR: { sh: [0, 0, 0.2], el: -0.2 }, armL: { ik: [-0.32, 1.62, 0.12], pole: [0, 1, -1], hand: 'point' } }), T);
    const ct = canvasTex(256, 200, (x, w, h) => { x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); const cs = ['#2a9d8f', '#e9c46a', '#f4a261', '#e76f51']; for (let i = 0; i < 4; i++) { x.fillStyle = cs[i]; x.fillRect(30 + i * 52, h - 30 - (35 + i * 32), 38, 35 + i * 32); } x.strokeStyle = '#e63946'; x.lineWidth = 7; x.beginPath(); x.moveTo(25, 150); x.lineTo(230, 30); x.stroke(); });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.48), new THREE.MeshStandardMaterial({ map: ct })); board.position.set(-0.52, 1.58, -0.1); board.rotation.y = 0.3; g.add(board);
    g.add(at(box(0.66, 0.52, 0.02, '#333'), -0.53, 1.58, -0.115, 0, 0.3, 0));
  }, [-0.1, 1.8, 2.5], [-0.12, 1.74, 0])]);
  bossP.push(['COFFEE #4', shoot('#ffbf8a', [boss], (g) => {
    const m = makeMug('#ffffff'); boss.wr.R.add(m); m.position.set(0, -0.09, 0.04); m.rotation.set(-PI / 2, 0, 0);
    boss.apply(stand(boss, 0, 0, 0.25, { head: [-0.2, 0, 0], face: { lid: 1, smile: 0.3, blush: 0.3 }, armR: { ik: [0.06, 1.76, 0.2], pole: [0.6, 1.1, 0.3], hand: 'fist', wr: [0.4, 0, 0] } }), T);
    return () => boss.wr.R.remove(m);
  }, [0.05, 1.88, 1.9], [0, 1.86, 0])]);
  bossP.push(['XMAS PARTY', shoot('#2f8a5a', [boss], (g) => {
    boss.apply(stand(boss, 0, 0, 0.1, { face: { happy: 1, smile: 0.9, mouth: 0.45, teeth: true } }), T);
    const hat = makeSanta(); hat.position.set(0.02, boss.S.R * 1.0, -0.01); hat.rotation.set(-0.25, 0, -0.1); boss.head.add(hat);
    const cols = ['#ff4d4d', '#ffd23f', '#4d8cff', '#3bceac'];
    for (let i = 0; i < 14; i++) g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 4), new THREE.MeshBasicMaterial({ color: cols[i % 4] })), -0.9 + i * 0.14, 2.25 - Math.sin(i * 0.45) * 0.12, -0.8));
    const tin = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 4, 12, PI), new THREE.MeshStandardMaterial({ color: '#d4af37', metalness: 0.7, roughness: 0.3, flatShading: true })); tin.position.set(0, 1.36, 0.1); tin.rotation.z = PI; boss.chest.add(tin); tin.position.set(0, -0.12, 0.13);
    return () => { boss.head.remove(hat); boss.chest.remove(tin); };
  }, [0.0, 1.9, 1.9], [0, 1.86, 0])]);
  bossP.push(['PRINTER HERO', shoot('#b9c3cf', [boss], (g) => {
    const w = makeWrench(); boss.wr.R.add(w); w.position.set(0, -0.06, 0.02);
    boss.apply(stand(boss, 0.15, 0, -0.25, { face: { grit: 1, brow: -0.3, browA: 0.4 }, armR: { sh: [-0.4, 0, 2.4], el: -0.9, hand: 'fist', wr: [0, 0, 0] } }), T);
    const pr = group(at(box(0.6, 0.35, 0.45, '#e9ecef'), 0, 0, 0), at(box(0.45, 0.04, 0.3, '#2b2d33'), 0, 0.19, 0.0), at(box(0.3, 0.005, 0.25, '#ffffff'), 0, 0.25, 0.1, -0.4));
    pr.position.set(-0.5, 1.07, 0.1); g.add(pr); g.add(at(box(0.7, 0.9, 0.5, '#8a6a4a'), -0.5, 0.45, 0.1));
    for (let i = 0; i < 4; i++) g.add(at(box(0.2, 0.004, 0.27, '#ffffff'), -0.7 + i * 0.15, 1.42 + i * 0.12, 0.1, 0.6 * i, i, 0.5));
    return () => boss.wr.R.remove(w);
  }, [-0.15, 1.72, 2.5], [-0.15, 1.64, 0])]);
  // polaroid meshes
  const F = ctx.flash;
  F.refs.life = life.map(([cap, tex]) => { const p = makePolaroid(tex, cap); F.G.add(p); return p; });
  F.refs.boss = bossP.map(([cap, tex]) => { const p = makePolaroid(tex, cap); F.G.add(p); return p; });
}

// ------------------------------------------------------------------ the shots
export function buildShots(ctx) {
  C = ctx;
  const { chars, office, ov, post } = ctx;
  const U = post.u;
  const S = [];
  const add = (name, t0, run) => S.push({ name, t0, run });

  // S1 — misdirect: two sweaty faces in the dark, desk shaking
  add('S1 faces', 0.0, (t, lt) => {
    officeMode('dark'); hideWall();
    const desk = office.refs.desk;
    desk.position.set(noise(t * 33, 1) * 0.008, Math.abs(noise(t * 29, 2)) * 0.006, 0); desk.rotation.z = noise(t * 31, 3) * 0.006;
    const push = Math.sin(t * 2 * PI * 2.4);
    const y = youCrawl(t, { plug: false, neckY: 0.42, headY: 0.18, headZ: -0.16, headX: 0.04 * push, face: { grit: 1, browA: 0.38, brow: -0.25, lid: 0.35, sweat: 1, look: [0.4, 0] } });
    const b = bossCrawl(t, { neckY: -0.45, headY: -0.22, headZ: 0.18, headX: -0.04 * push, face: { grit: 1, browA: 0.4, brow: -0.1, lid: 0.3, sweat: 1, look: [-0.4, 0] } });
    C.plug.visible = false; office.refs.charger.visible = false;
    const yh = wp(y.head), bh = wp(b.head);
    const mid = yh.clone().lerp(bh, 0.5);
    C.pt1.color.set('#ff6a3d'); C.pt1.intensity = 2.6; C.pt1.distance = 1.6; C.pt1.position.set(mid.x, mid.y - 0.3, mid.z - 0.35);
    C.pt2.color.set('#7fb2ff'); C.pt2.intensity = 1.6; C.pt2.distance = 1.5; C.pt2.position.set(mid.x + 0.5, mid.y + 0.25, mid.z - 0.1);
    C.pt3.color.set('#ffd2b0'); C.pt3.intensity = 0.9; C.pt3.distance = 1.4; C.pt3.position.set(mid.x - 0.3, mid.y + 0.1, mid.z - 0.6);
    const z = lerp(1.75, 1.62, lt / 0.85);
    cam(t, [mid.x + 0.02, mid.y + 0.03, mid.z - z], [mid.x, mid.y - 0.01, mid.z], 32, { shake: 0.25 });
    U.uVig.value = 0.6; U.uExp.value = 1.25; U.uSat.value = 1.2;
    ov.comic(t, 0.15, 0.82, 'HNNNGH!', 700, 360, 92, 0.1, { shake: 4, top: '#ffffff', fill: '#ffd0e6', inner: '#ff3fa4' });
  });

  // S2 — desk legs rattle, mug spills, pens roll off
  add('S2 desk', 0.85, (t, lt) => {
    officeMode('under');
    const desk = office.refs.desk;
    desk.position.set(noise(t * 40, 1) * 0.012, Math.abs(noise(t * 36, 2)) * 0.01, noise(t * 33, 5) * 0.006); desk.rotation.z = noise(t * 37, 3) * 0.01;
    youCrawl(t, { plug: false, face: { grit: 1 } }); bossCrawl(t, { face: { grit: 1 } });
    C.plug.visible = false; office.refs.charger.visible = false;
    const mug = office.refs.mug;
    mug.position.y = DH + 0.001 + Math.abs(Math.sin(t * 26)) * 0.012; mug.rotation.z = Math.sin(t * 21) * 0.12; mug.rotation.x = Math.sin(t * 17) * 0.08;
    mug.position.x = 0.52 + lt * 0.05;
    // coffee drops
    C.drops.forEach((d, i) => {
      const t0 = 0.95 + hash(i, 1) * 0.45, dd = t - t0; if (dd < 0 || dd > 0.6) return;
      d.visible = true; const vx = (hash(i, 2) - 0.3) * 0.5, vz = 0.2 + hash(i, 3) * 0.6, vy = 0.6 + hash(i, 4) * 0.9;
      d.position.set(mug.position.x + vx * dd, DH + 0.1 + vy * dd - 4.9 * dd * dd, -0.9 + vz * dd);
      if (d.position.y < DH + 0.005 && d.position.z < -0.74) d.position.y = DH + 0.005;
      d.scale.setScalar(0.8 + hash(i, 5) * 1.6);
    });
    office.refs.pens.forEach((pen, i) => {
      const [hx, hy, hz] = pen.userData.home;
      const t0 = 0.88 + i * 0.12, roll = eIn(seg(t, t0, t0 + 0.32), 1.6), fallT = t - (t0 + 0.32);
      let z = lerp(hz, -0.73, roll), y = hy, rx = (z - hz) / 0.0065;
      let rz = 0;
      if (fallT > 0) { z = -0.73 + fallT * 0.5; y = hy - 4.9 * fallT * fallT; rz = fallT * 9 * (i ? -1 : 1); rx += fallT * 20; if (y < 0.007) { y = 0.007; } }
      pen.position.set(hx, y, z); pen.rotation.set(rx, 0, rz);
    });
    const tt = smooth(lt / 0.73);
    cam(t, [lerp(1.02, 0.96, tt), lerp(1.24, 1.2, tt), lerp(-0.22, -0.3, tt)], [0.55, DH - 0.12, -0.84], 52, { shake: 0.35 });
    ov.comic(t, 0.9, 1.56, 'RATTLE', 330, 470, 110, -0.12, { shake: 9 });
    ov.comic(t, 1.05, 1.56, 'RATTLE!', 690, 640, 96, 0.1, { shake: 9 });
  });

  function pensFallen() {
    office.refs.pens.forEach((pen, i) => { pen.position.set(0.24 + i * 0.09, 0.007, -0.6 + i * 0.07); pen.rotation.set(0, 0.4 + i, PI / 2 * 0); });
  }
  C.pensFallen = pensFallen;
  // S3 — coworkers walk past, stop, turn, drop papers, spit coffee
  add('S3 coworkers', 1.583, (t, lt) => {
    officeMode('day');
    const desk = office.refs.desk;
    desk.position.set(noise(t * 40, 1) * 0.01, Math.abs(noise(t * 36, 2)) * 0.008, 0); desk.rotation.z = noise(t * 37, 3) * 0.008;
    const wig1 = Math.sin(t * 2 * PI * 2.4);
    const y = youCrawl(t, { plug: false, face: { grit: 1 } }); const b = bossCrawl(t, { face: { grit: 1 } });
    y.hips.rotation.z += wig1 * 0.06; b.hips.rotation.z -= wig1 * 0.06;
    C.plug.visible = false; office.refs.charger.visible = false;
    const stopT = 1.95;
    for (const [ch, x0, x1, z, seed] of [[chars.cw1, -2.9, -0.75, 2.2, 1], [chars.cw2, -3.5, 0.3, 2.65, 2]]) {
      const u = eOut(seg(t, 1.583, stopT), 1.6);
      const x = lerp(x0, x1, u) + wig(t, stopT, 0.04, 2, 7);
      const ph = (x - x0) / 0.32 * PI;
      const wk = walk(ph, 0.45 * (1 - smooth(seg(t, stopT - 0.08, stopT + 0.05))));
      const turn = smoother(seg(t, stopT + 0.05, stopT + 0.4));
      const headTurn = smoother(seg(t, stopT + 0.0, stopT + 0.28));
      const shock = seg(t, 2.15, 2.25);
      const ry = lerp(PI / 2, PI - 0.25 + (seed === 2 ? 0.3 : 0), turn);
      const face = { eyeS: 1 + 0.4 * backOut(shock), brow: 1.0 * shock, mouth: 0.6 * shock, blink: blink(t, seed) * (1 - shock), look: [0, 0] };
      const p = stand(ch, x, z, ry, { hipY: ch.S.hipH + wk.bob, legL: wk.legL, legR: wk.legR, neck: [0, (1 - turn) * headTurn * 0.9, 0], head: [-0.1 * shock, 0, 0], face, spine: [-0.08 * shock, 0, 0] });
      if (seed === 1) {
        const drop = seg(t, 2.25, 2.3);
        p.armL = { sh: [-0.9 + drop * 0.7, 0, -0.25 - 0.4 * drop], el: -1.2 + drop * 0.8, hand: 'mitten' };
        p.armR = { sh: [-0.9 + drop * 0.7, 0, 0.25 + 0.4 * drop], el: -1.2 + drop * 0.8, hand: 'mitten' };
        C.papers.visible = t < 2.25;
      } else {
        const sip = smooth(seg(t, stopT + 0.05, stopT + 0.3)) * (1 - smooth(seg(t, 2.42, 2.55)));
        p.armL = { sh: [lerp(-0.2, -1.55, sip), 0, -0.2 + 0.2 * sip], el: lerp(-0.5, -1.9, sip), hand: 'fist', wr: [0, 0, 0] };
        p.armR = { sh: [wk.armRsh[0], 0, 0.12], el: -0.3 };
        C.cup.visible = true;
        if (t > 2.42) { face.mouth = 0.8; face.eyeS = 1.45; }
      }
      if (seed === 1) { p.armL.sh = p.armL.sh; }
      ch.apply(p, t);
    }
    // flying papers
    C.sheets.forEach((s, i) => {
      const d = t - 2.25 - hash(i, 1) * 0.05; if (d < 0) return;
      s.visible = true; const hp = wp(chars.cw1.wr.R);
      const fall = Math.min(d, 0.9);
      s.position.set(hp.x + (hash(i, 2) - 0.5) * 0.9 * fall + Math.sin(d * 7 + i) * 0.05, Math.max(0.01, hp.y + 0.3 * fall - 2.2 * fall * fall), hp.z - 0.1 - hash(i, 3) * 0.5 * fall);
      s.rotation.set(-PI / 2 + Math.sin(d * 8 + i) * 0.9, d * 3 * (hash(i, 4) - 0.5), Math.sin(d * 6 + i * 2) * 0.8);
      if (s.position.y <= 0.011) s.rotation.set(-PI / 2, 0, i);
    });
    // coffee spit
    const mp = wp(chars.cw2.head).add(V(0, -0.06, -0.12));
    C.drops.forEach((d, i) => {
      const dd = t - 2.42 - hash(i, 9) * 0.06; if (dd < 0 || dd > 0.55) return;
      d.visible = true; d.scale.setScalar(1 + hash(i, 5) * 1.5);
      d.position.set(mp.x + (hash(i, 6) - 0.5) * 1.2 * dd, mp.y + (0.5 + hash(i, 7)) * dd - 4.9 * dd * dd, mp.z - (1.2 + hash(i, 8) * 1.5) * dd);
    });
    const tt = smooth(lt / 1.37);
    cam(t, [lerp(-0.12, -0.2, tt), lerp(1.08, 1.12, tt), lerp(-0.5, -0.38, tt)], [lerp(-0.4, -0.22, tt), 1.4, 2.4], 54, { shake: 0.08 + shake(t, [[2.25, 0.25, 6]]) });
    if (t > 2.15) { const hp = proj(wp(chars.cw1.head).add(V(0, 0.32, 0))); ov.comic(t, 2.15, 2.95, 'GASP!', hp[0], hp[1], 100, -0.1, { shake: 3 }); }
    if (t > 2.42) { const hp = proj(wp(chars.cw2.head).add(V(-0.1, 0.3, 0))); ov.comic(t, 2.42, 2.95, 'PFFFT!', hp[0] + 40, hp[1], 84, 0.12, { top: '#fff2d9', fill: '#d7a26a', inner: '#7a4a1e' }); }
  });

  // S4 — YOU's face, blush, sparkles
  add('S4 blush', 2.95, (t, lt) => {
    officeMode('pink'); hideWall();
    const bl = smooth(seg(t, 3.0, 3.6));
    const y = youCrawl(t, { plug: false, neckY: 0.38, headY: 0.32, headZ: -0.22, face: { dreamy: 1, lid: 0.32, blush: bl, smile: 0.65, brow: 0.45, browA: -0.22, look: [0.5, 0.1], blink: blink(t, 7, 2.2) } });
    bossCrawl(t, { face: { lid: 0.3 } });
    C.plug.visible = false; office.refs.charger.visible = false;
    const h = wp(y.head);
    C.pt1.color.set('#ff8cc2'); C.pt1.intensity = 0.9; C.pt1.distance = 1.4; C.pt1.position.set(h.x + 0.15, h.y + 0.05, h.z - 0.45);
    C.pt2.color.set('#ffe2c4'); C.pt2.intensity = 1.6; C.pt2.distance = 1.6; C.pt2.position.set(h.x - 0.3, h.y + 0.2, h.z - 0.6);
    const z = lerp(1.95, 1.75, smooth(lt / 1.8));
    cam(t, [h.x + 0.04, h.y + 0.03, h.z - z], [h.x + 0.03, h.y - 0.03, h.z], 28, { roll: 0.06 });
    U.uDream.value = 0.35; U.uVig.value = 0.5; U.uSat.value = 1.1; U.uExp.value = 1.3;
    const hp = proj(h);
    ov.glow(hp[0], hp[1] + 120, 520, 'rgba(255,90,170,A)', 0.35 * bl);
    ov.sparkles(t, hp[0], hp[1], 430, 520, 16, 4, 40, '#ffffff', bl);
    ov.hearts(t, hp[0], hp[1] + 300, 6, 3, 46, 0.9 * bl, 700, 700);
  });

  // S5 — the reveal: pull back + rotate. Plug + flashlight.
  add('S5 reveal', 4.75, (t, lt) => {
    officeMode('under');
    const lit = smooth(seg(t, 4.75, 5.4));
    C.hemi.intensity = lerp(0.25, 0.75, lit); C.key.intensity = lerp(0.25, 1.7, lit); C.fill.intensity = lerp(0.1, 0.55, lit);
    if (lit < 1) C.scene.background = new THREE.Color().lerpColors(new THREE.Color('#050508'), new THREE.Color('#dfe6ea'), lit);
    const wiggle = V(0.012 * Math.sin(t * 7.3), 0.03 + 0.012 * Math.cos(t * 9.1), 0.07 + 0.01 * Math.sin(t * 5));
    const y = youCrawl(t, { reach: SOCK.clone().add(wiggle), neckY: lerp(0.38, 0.1, lit), headY: lerp(0.32, -0.05, lit), headZ: -0.1,
      face: { blush: 0.9 * (1 - lit), dreamy: 1 - lit, lid: lerp(0.32, 0.1, lit), smile: lerp(0.65, 0.1, lit), mouth: lit * 0.12, brow: lerp(0.45, -0.1, lit), browA: lerp(-0.22, 0.3, lit), sweat: lit, look: [lerp(0.5, -0.3, lit), 0], blink: blink(t, 3) } });
    const b = bossCrawl(t, { neckY: -0.15, headY: -0.1, headZ: 0.1, face: { mouth: 0.3, browA: 0.3, brow: -0.1, sweat: 1, look: [-0.5, -0.2], blink: blink(t, 5) } });
    torchOn(3.2 * lit, SOCK.clone());
    updateCharger();
    // camera orbit around pivot from behind wall (face close-up) to front-left wide
    const P = V(-0.18, 0.78, -1.08);
    const u = eIO(seg(t, 4.78, 6.25), 2.6);
    const az = lerp(PI, PI * 1.53, u);
    const r = lerp(1.1, 2.1, u) - 0.2 * smooth(seg(t, 6.3, 7.63));
    const hgt = lerp(0.02, 0.2, u);
    const pos = [P.x + Math.sin(az) * r, P.y + hgt, P.z + Math.cos(az) * r];
    const yh = wp(y.head);
    const look = yh.clone().lerp(V(-0.05, 0.62, -1.1), smooth(seg(t, 4.8, 6.0)));
    cam(t, pos, [look.x, look.y, look.z], lerp(28, 46, u), { roll: lerp(0.06, 0, u) });
    U.uVig.value = lerp(0.5, 0.3, lit);
  });

  // S6a — slow-motion close-up: plug approaches socket
  add('S6a slowmo', 7.633, (t, lt) => {
    officeMode('under');
    C.hemi.intensity = 0.55; C.key.intensity = 1.2;
    const off = keys(t, [[7.633, [0.1, 0.07, 0.17]], [7.95, [0.04, 0.05, 0.075], eOut], [8.2, [-0.02, 0.04, 0.066]], [8.38, [0.012, 0.033, 0.068]], [8.56, [0.0, 0.03, 0.068]], [8.69, [0.0, 0.03, 0.054], eIn]]);
    const tr = V(noise(t * 30, 4) * 0.0025, noise(t * 27, 5) * 0.0025, 0);
    const reach = SOCK.clone().add(V(...off)).add(tr);
    youCrawl(t, { reach, face: { grit: 1, browA: 0.4, brow: -0.2, sweat: 1, look: [-0.5, -0.3] } });
    bossCrawl(t, { face: { mouth: 0.3, look: [-0.5, -0.3] } });
    torchOn(3.0, SOCK.clone());
    updateCharger();
    const k = smooth(lt / 1.07);
    C.office.refs.cables.forEach(o => o.visible = false);
    const pos = V(-0.86, 0.43, -1.2).lerp(V(-0.78, 0.415, -1.25), k);
    cam(t, [pos.x, pos.y, pos.z], [-0.4, 0.365, -1.43], 36, { hand: 0.5 });
    U.uSat.value = 0.9; U.uVig.value = 0.55 + 0.1 * Math.max(0, Math.sin(t * 2 * PI * 1.3)); U.uContrast.value = 1.1;
    if (t > 8.6) { const sp = proj(SOCK.clone().add(V(0, 0.03, 0.04))); ov.bolts(t, sp[0], sp[1], 3, 160, 9, seg(t, 8.6, 8.7)); }
  });

  // S6b — ZAP: flash, x-ray, hair up, smoke
  add('S6b zap', 8.7, (t, lt) => {
    officeMode('under'); hideWall();
    C.hemi.intensity = 0.5; C.key.intensity = 0.9;
    const xr = t > 8.74 && t < 9.12 && Math.floor((t - 8.74) * FPS / 4) % 2 === 0;
    const st = t - 8.7;
    const dazed = smooth(seg(t, 9.15, 9.4));
    const y = youCrawl(t, { reach: SOCK.clone().add(V(0.02 + 0.05 * eOut(seg(t, 8.7, 8.85)), 0.03, 0.09 + 0.08 * eOut(seg(t, 8.7, 8.85)))), neckY: 0.15, headY: 0.05,
      face: { shock: 1, shockT: st, eyeS: 1.35 - 0.2 * dazed, mouth: 0.95 * (1 - dazed) + 0.15 * dazed, teeth: true, brow: 1 - dazed, lid: 0.3 * dazed, soot: smooth(seg(t, 8.85, 9.0)), look: [0, 0] } });
    const b = bossCrawl(t, { neckY: -0.1, face: { shock: 1, shockT: st - 0.02, eyeS: 1.3, mouth: 0.8 * (1 - dazed), brow: 1 - dazed, lid: 0.3 * dazed, soot: smooth(seg(t, 8.85, 9.0)) } });
    y.root.position.y += Math.abs(Math.sin(st * 40)) * 0.02 * (1 - seg(t, 8.7, 9.15)); b.root.position.y += Math.abs(Math.sin(st * 37)) * 0.02 * (1 - seg(t, 8.7, 9.15));
    if (xr) { y.setXray(true); b.setXray(true); C.plug.visible = true; }
    torchOn(2.0, SOCK.clone());
    updateCharger();
    C.pt1.color.set('#fff6a0'); C.pt1.intensity = (t < 9.2 ? 6 + 4 * Math.sin(t * 90) : 0); C.pt1.distance = 2.2; C.pt1.position.copy(SOCK).add(V(0.05, 0.1, 0.15));
    const yh = wp(y.head);
    const k = smooth(seg(t, 8.7, 9.45));
    cam(t, [yh.x + 0.08, yh.y + 0.04, yh.z - lerp(1.05, 0.9, k)], [yh.x + 0.05, yh.y - 0.08, yh.z], 38, { shake: shake(t, [[8.7, 1.4, 4]]) });
    smokeAt(t, [[9.0, yh.x, yh.y + 0.25, yh.z, 0.6, 7, 3], [9.08, wp(b.head).x, wp(b.head).y + 0.25, wp(b.head).z, 0.6, 6, 4], [8.95, SOCK.x, SOCK.y, SOCK.z + 0.05, 0.5, 5, 5]]);
    U.uFlash.value = t < 8.735 ? 1 : 1 - smooth(seg(t, 8.735, 8.86));
    U.uXray.value = xr ? 0.92 : 0;
    U.uCA.value = 0.012 * (1 - seg(t, 8.7, 9.2));
    // swirl out
    const sw = smooth(seg(t, 9.28, 9.45));
    U.uSwirl.value = 9 * sw * sw; U.uFlash.value = Math.max(U.uFlash.value, 0.55 * sw); U.uFlashCol.value.set('#f3dcff');
    const sp = proj(SOCK.clone());
    if (t < 9.25) ov.bolts(t, sp[0], sp[1], 7, 560, 11, 1 - seg(t, 9.0, 9.25));
    if (t > 8.75 && t < 9.3) { const hp = proj(yh.clone().add(V(0, 0.25, 0))); ov.bolts(t, hp[0], hp[1], 4, 230, 21, 1 - seg(t, 9.1, 9.3)); }
    ov.comic(t, 8.72, 9.42, 'ZAP!!', 560, 470, 190, -0.12, { shake: 12, burst: true, burstCol: '#3ec7ff', burstR: 1.6 });
  });

  // S7 — flashback: polaroids of your whole life fly past
  add('S7 flashback', 9.45, (t, lt) => {
    flashMode();
    const F = C.flash.refs;
    F.life.forEach((p, i) => p.visible = false); F.boss.forEach(p => p.visible = false);
    for (let n = 0; n < 7; n++) {
      const p = F.life[n % F.life.length];
      const ts = 9.42 + n * 0.36, u = seg(t, ts, ts + 1.55);
      if (u <= 0 || u >= 1) continue;
      if (p.visible) continue;
      p.visible = true;
      const ang = hash(n, 3) * PI * 2;
      const e = eIn(u, 2.2);
      const z = lerp(-7, 2.4, e);
      const spread = 0.08 + 0.95 * e;
      p.position.set(Math.cos(ang) * spread * 0.55, Math.sin(ang) * spread * 0.9, z);
      p.rotation.set(Math.sin(t * 2 + n) * 0.3, Math.cos(t * 1.7 + n) * 0.4, (hash(n, 4) - 0.5) * 0.8 + u * 1.2 * (n % 2 ? 1 : -1));
      p.scale.setScalar(2.3);
    }
    F.bokeh.forEach((s, i) => { s.position.z = -2 - ((hash(i, 5) * 10 + (t - 9.45) * 4) % 10); });
    F.hearts.forEach(h => h.visible = false);
    cam(t, [0, 0, FZ + 3.2], [0, 0, FZ], 42, { roll: Math.sin(t * 0.8) * 0.05 });
    const sw = 1 - smooth(seg(t, 9.45, 9.82));
    U.uSwirl.value = -9 * sw * sw; U.uFlash.value = 0.55 * sw; U.uFlashCol.value.set('#f3dcff');
    U.uDream.value = 0.3; U.uSat.value = 1.15; U.uVig.value = 0.35; U.uExp.value = 1.1;
    ov.sparkles(t, W / 2, H / 2, 520, 900, 22, 8, 34, '#ffffff', 0.9);
  });

  // S8 — every picture is him
  add('S8 boss pics', 11.95, (t, lt) => {
    flashMode();
    const F = C.flash.refs;
    F.life.forEach(p => p.visible = false);
    const grid = [[-0.205, 0.27, -0.1], [0.205, 0.25, 0.08], [-0.2, -0.27, 0.06], [0.205, -0.26, -0.07]];
    const lands = [12.15, 12.6, 12.98, 13.33];
    const beat = Math.max(0, Math.sin(seg(t, 13.68, 13.9) * PI)) * 0.07 + Math.max(0, Math.sin(seg(t, 14.05, 14.25) * PI)) * 0.05;
    F.boss.forEach((p, i) => {
      const u = seg(t, lands[i] - 0.38, lands[i]);
      p.visible = u > 0;
      if (!p.visible) return;
      const e = backOut(u, 1.4);
      const [gx, gy, gr] = grid[i];
      const fromA = hash(i, 7) * PI * 2;
      p.position.set(lerp(Math.cos(fromA) * 1.6, gx, e), lerp(Math.sin(fromA) * 2.4, gy, e) + Math.sin(t * 2 + i) * 0.006, lerp(-4, 0, e) + i * 0.002);
      p.rotation.set(Math.sin(t * 1.5 + i) * 0.04, Math.sin(t * 1.2 + i * 2) * 0.05, lerp(gr * 4, gr, e));
      p.scale.setScalar(1.0 + beat);
    });
    F.hearts.forEach((h, i) => {
      const t0 = lands[i % 4] + 0.1 + (i / 4 | 0) * 0.15, d = t - t0;
      h.visible = d > 0;
      if (!h.visible) return;
      const [gx, gy] = grid[i % 4];
      const per = 1.6, u = (d % per) / per;
      h.position.set(gx + (hash(i, 2) > 0.5 ? 0.17 : -0.17) + Math.sin(u * 6 + i) * 0.02, gy - 0.15 + u * 0.4, 0.05 + hash(i, 3) * 0.06);
      h.rotation.set(0, Math.sin(t * 3 + i) * 0.6, (hash(i, 4) - 0.5) * 0.6);
      const s = (0.3 + 0.35 * Math.sin(PI * u)) * (1 + 2 * beat); h.scale.setScalar(s);
    });
    F.bokeh.forEach((s, i) => { s.position.z = -2 - ((hash(i, 5) * 10 + (t - 9.45) * 4) % 10); });
    const push = smooth(seg(t, 13.6, 14.27));
    cam(t, [0, 0, FZ + lerp(1.75, 1.45, push)], [0, 0, FZ], 42, { roll: Math.sin(t * 0.8) * 0.03 });
    U.uDream.value = 0.25; U.uExp.value = 1.1; U.uSat.value = 1.15; U.uVig.value = 0.3 + beat * 2; U.uTint.value.setRGB(1, 1 - beat * 1.2, 1 - beat * 0.6);
    ov.hearts(t, W / 2, 1500, 10, 12, 50, 0.9 * seg(t, 12.2, 12.6), 900, 1100);
    ov.comic(t, 13.66, 14.27, 'BA-DUM!', 540, 340, 120, -0.06, { top: '#ffd0e6', fill: '#ff4f8b', inner: '#a3164a' });
  });

  // S9 — back under the desk, smoky. Grab his tie. "Marry me..."
  add('S9 tie', 14.267, (t, lt) => {
    officeMode('smoke'); hideWall();
    C.plug.visible = false; office.refs.charger.visible = false;
    const pull = backOut(seg(t, 14.8, 15.3), 1.5);
    const turn = smooth(seg(t, 14.3, 14.7));
    const ych = chars.you, bch = chars.boss;
    const YX = -0.26, YZ = -0.42, YR = PI - 0.12, BX = lerp(0.36, 0.27, pull), BZ = -0.38, BR = PI + 0.15 + 0.06 * pull;
    const talk = t > 16.0 && t < 17.8 ? lipsync(t) : 0;
    const romance = smooth(seg(t, 15.85, 16.2));
    const yp = prone(ych, YX, YZ, YR, { neckY: lerp(0.0, 0.5, turn), headY: lerp(0, 0.3, turn), headZ: -0.15 * turn, spineY: 0.1,
      face: { shock: 1, soot: 1, lid: 0.25 - 0.25 * romance, mouth: talk, smile: 0.5, brow: 0.3 + 0.4 * romance, browA: -0.2 * romance, dreamy: romance, blush: romance * 0.9, blink: blink(t, 8) } });
    // hand: anticipate, grab tie, pull toward chin
    ych.apply(yp, t);
    bch.apply(prone(bch, BX, BZ, BR, { neckY: lerp(0, -0.42, turn), headY: lerp(0, -0.22, turn), headZ: 0.12 * turn, face: {} }), t);
    const tieTip = bch.tie2.localToWorld(V(0, -bch.tieLen * 0.22, 0));
    const yh = wp(ych.head);
    const chin = V(yh.x + 0.1, 0.32, yh.z - 0.05);
    const reachU = antic(seg(t, 14.42, 14.66), 0.25);
    const handT = V().lerpVectors(V(yh.x + 0.05, 0.08, yh.z + 0.2), tieTip, clamp(reachU)).lerp(chin, pull);
    yp.armR = { ik: [handT.x, handT.y, handT.z], pole: [handT.x + 0.1, 0.6, handT.z + 0.4], hand: t > 14.62 ? 'fist' : 'mitten', wr: [0.4, 0, 0] };
    ych.apply(yp, t);
    const handW = wp(ych.wr.R);
    const bp = prone(bch, BX, BZ, BR, { neckY: lerp(0, -0.42, turn), headY: lerp(0, -0.22, turn), headZ: 0.12 * turn, spineZ: -0.06 * pull,
      face: { shock: 1, soot: 1, eyeS: 1 + 0.3 * seg(t, 14.8, 15.0) - 0.15 * seg(t, 16.8, 17.3), brow: 0.8, mouth: 0.25 * seg(t, 14.8, 15.0) * (1 - seg(t, 15.6, 16.0)), smile: 0.1, blush: 0.75 * smooth(seg(t, 16.9, 17.5)), lid: t > 17.45 && t < 17.85 ? Math.sin(seg(t, 17.45, 17.85) * PI) : 0 } });
    if (t > 14.62) bp.tieTo = [handW.x, handW.y - 0.03, handW.z];
    bch.apply(bp, t);
    const bh = wp(bch.head);
    // torch on floor lighting the scene
    C.torchFloor.visible = true; C.torchFloor.position.set(0.15, 0.03, -0.75); C.torchFloor.rotation.set(0, PI + 0.6, PI / 2);
    C.spot.position.set(0.15, 0.05, -0.8); C.spot.target.position.set(-0.3, 0.3, -1.49); C.spot.intensity = 1.6;
    const mid = yh.clone().lerp(bh, 0.5);
    C.pt1.color.set('#ff8cc2'); C.pt1.intensity = 0.9 * romance + 0.5; C.pt1.distance = 1.5; C.pt1.position.set(mid.x, mid.y + 0.1, mid.z - 0.45);
    C.pt2.color.set('#ffc98a'); C.pt2.intensity = 1.2; C.pt2.distance = 1.4; C.pt2.position.set(mid.x + 0.4, mid.y + 0.3, mid.z);
    wisps(t, [[mid.x, 0.55, mid.z + 0.2, 1.0, 10, 31], [yh.x, yh.y + 0.3, yh.z, 0.5, 4, 32], [bh.x, bh.y + 0.3, bh.z, 0.5, 4, 33]]);
    const close = smooth(seg(t, 15.3, 16.1));
    const camZ = lerp(2.25, 1.95, close) - 0.12 * smooth(seg(t, 16.1, 18.05));
    cam(t, [mid.x + 0.03, mid.y + lerp(0.05, 0.03, close), mid.z - camZ], [mid.x, mid.y - lerp(0.04, 0.0, close), mid.z], lerp(34, 30, close), { shake: shake(t, [[14.8, 0.3, 6]]) });
    U.uDream.value = 0.2 * romance; U.uSat.value = 1.1; U.uVig.value = 0.45; U.uExp.value = 1.1;
    const mp = proj(mid.clone().add(V(0, 0.05, 0.05)));
    ov.rays(mp[0], mp[1] - 250, 1300, 18, t * 0.25, 'rgba(255,170,210,A)', 0.28 * romance, 0.4);
    ov.glow(mp[0], mp[1] - 200, 500, 'rgba(255,120,180,A)', 0.16 * romance);
    ov.sparkles(t, mp[0], mp[1], 480, 600, 18 * romance | 0, 14, 38, '#fff3fb', romance);
    ov.hearts(t, mp[0], mp[1] + 250, 8, 15, 48, romance, 650, 800);
    ov.comic(t, 14.62, 15.4, 'YOINK!', 300, 420, 110, -0.15, { shake: 4 });
  });

  // S10 — boss close-up: hair standing up, smoking, slow blinks
  add('S10 boss hair', 18.05, (t, lt) => {
    officeMode('smoke'); hideWall();
    C.plug.visible = false; office.refs.charger.visible = false;
    const ych = chars.you, bch = chars.boss;
    ych.apply(prone(ych, -0.26, -0.42, PI - 0.12, { neckY: 0.5, headY: 0.3, headZ: -0.15, face: { shock: 1, soot: 1, smile: 0.5, dreamy: 1, blush: 0.8 } }), t);
    const sb1 = seg(t, 18.35, 18.85), sb2 = seg(t, 19.8, 20.3);
    const lid = Math.max(0.28, Math.sin(sb1 * PI), Math.sin(sb2 * PI));
    bch.apply(prone(bch, 0.27, -0.38, PI + 0.21, { neckY: -0.42, headY: -0.22, headZ: 0.12, face: { shock: 1, soot: 1, lid, brow: 0.2, mouth: 0.0, smile: 0.0, look: [0, 0.1] } }), t);
    const bh = wp(bch.head);
    C.torchFloor.visible = true; C.torchFloor.position.set(0.15, 0.03, -0.75); C.torchFloor.rotation.set(0, PI + 0.6, PI / 2);
    C.pt1.color.set('#ffd2a8'); C.pt1.intensity = 2.2; C.pt1.distance = 1.4; C.pt1.position.set(bh.x - 0.2, bh.y + 0.15, bh.z - 0.45);
    C.pt2.color.set('#9ec5ff'); C.pt2.intensity = 1.0; C.pt2.distance = 1.2; C.pt2.position.set(bh.x + 0.35, bh.y + 0.3, bh.z - 0.1);
    const up = smoother(seg(t, 18.95, 19.75));
    const look = [bh.x, bh.y + lerp(0.0, 0.15, up), bh.z];
    cam(t, [bh.x + 0.03, bh.y + lerp(0.02, 0.1, up), bh.z - lerp(1.0, 1.2, up)], look, lerp(28, 34, up), { hand: 0.8 });
    wisps(t, [[bh.x, bh.y + 0.38, bh.z, 0.7, 8, 41], [bh.x - 0.08, bh.y + 0.3, bh.z, 0.5, 5, 42], [bh.x + 0.09, bh.y + 0.32, bh.z, 0.5, 5, 43]]);
    U.uSat.value = 1.08; U.uVig.value = 0.45; U.uExp.value = 1.1;
    const hp = proj(bh.clone().add(V(0, 0.35, 0)));
    if (hash(Math.floor(t * 6), 3) > 0.6) ov.bolts(t, hp[0] + (hash(Math.floor(t * 6), 4) - 0.5) * 200, hp[1] - 60, 2, 110, 51, 0.8);
    ov.comic(t, 18.4, 18.95, 'blink...', 790, 560, 70, 0.08, { top: '#ffffff', fill: '#dfe8ff', inner: '#3a4a7a' });
    ov.comic(t, 19.85, 20.45, 'blink.', 790, 520, 70, -0.06, { top: '#ffffff', fill: '#dfe8ff', inner: '#3a4a7a' });
  });

  // S11a — boss hands you the corner office keys
  add('S11a keys', 20.5, (t, lt) => {
    officeMode('smoke'); hideWall();
    C.scene.fog = new THREE.Fog('#5c5762', 1.0, 3.6);
    C.plug.visible = false; office.refs.charger.visible = false;
    const ych = chars.you, bch = chars.boss;
    ych.apply(prone(ych, -0.26, -0.42, PI - 0.12, { neckY: 0.5, headY: 0.3, headZ: -0.15, face: { shock: 1, soot: 1, smile: 0.2, mouth: 0.4 * seg(t, 21.0, 21.2), eyeS: 1 + 0.35 * backOut(seg(t, 21.0, 21.2)), brow: 0.8 } }), t);
    const bp = prone(bch, 0.27, -0.38, PI + 0.21, { neckY: -0.42, headY: -0.22, headZ: 0.12, face: { shock: 1, soot: 1, smile: 0.55, brow: 0.5, blush: 0.5, lid: 0.15 } });
    bch.apply(bp, t);
    const bh = wp(bch.head), yh = wp(ych.head);
    const mid = yh.clone().lerp(bh, 0.5);
    const lift = antic(seg(t, 20.62, 21.05), 0.2);
    const kt = V(mid.x + 0.02, lerp(0.12, mid.y - 0.02, clamp(lift)), mid.z - 0.22);
    bp.armL = { ik: [kt.x, kt.y, kt.z], pole: [kt.x + 0.3, 0.1, kt.z + 0.3], hand: 'fist', wr: [0, 0, 0] };
    bch.apply(bp, t);
    C.keysProp.visible = true; C.keysProp.rotation.set(0, Math.sin(t * 5) * 0.4, Math.sin(t * 7) * 0.25);
    const kp = wp(C.keysProp);
    C.keyGlow.material.opacity = 0.45 * smooth(seg(t, 20.9, 21.1));
    C.pt1.color.set('#ffcf5a'); C.pt1.intensity = 2.2 * smooth(seg(t, 20.9, 21.1)); C.pt1.distance = 1.6; C.pt1.position.copy(kp).add(V(0, 0.05, -0.15));
    C.pt2.color.set('#ffd2a8'); C.pt2.intensity = 1.2; C.pt2.distance = 1.4; C.pt2.position.set(mid.x, mid.y + 0.2, mid.z - 0.5);
    const push = eIn(seg(t, 21.3, 21.7), 2);
    const camP = V(mid.x + 0.02, mid.y + 0.02, mid.z - 1.0).lerp(kp.clone().add(V(0, 0, -0.18)), push * 0.85);
    cam(t, [camP.x, camP.y, camP.z], [lerp(mid.x, kp.x, 0.6), lerp(mid.y - 0.03, kp.y, 0.7), mid.z], lerp(36, 30, push), { hand: 0.8 });
    U.uZoomBlur.value = push * 1.6; U.uExp.value = 1.15; U.uVig.value = 0.4;
    const k2 = proj(kp), g = smooth(seg(t, 20.9, 21.15));
    ov.rays(k2[0], k2[1], 1400, 16, t * 0.6, 'rgba(255,214,90,A)', 0.3 * g, 0.35);
    ov.glow(k2[0], k2[1], 300, 'rgba(255,220,120,A)', 0.3 * g);
    ov.sparkles(t, k2[0], k2[1], 260, 260, 14, 61, 34, '#fff6c8', g);
    ov.comic(t, 20.95, 21.7, 'DING!', 540, 430, 140, -0.1, { shake: 2 });
    ov.streaks(seg(t, 21.55, 21.7), 70, 'rgba(255,240,200,A)');
  });

  // S11b — corner office, skyline, name sign flips to YOU
  add('S11b corner', 21.7, (t, lt) => {
    cornerMode(); drawBoard(0);
    C.corner.refs.sign.rotation.z = PI * backOut(seg(t, 22.2, 22.52), 1.2);
    const whip = smoother(seg(t, 22.0, 22.16));
    const a0 = { p: [CX - 1.55, 1.5, 2.9], l: [CX + 1.5, 1.32, -2.7], f: 52 };
    const a1 = { p: [CX - 1.75, 1.5, 1.05], l: [CX - 3.3, 1.52, 0.9], f: 34 };
    const push = smooth(seg(t, 22.16, 23.0));
    const pos = a0.p.map((v, i) => lerp(v, a1.p[i], whip)), look = a0.l.map((v, i) => lerp(v, a1.l[i], whip));
    pos[0] -= 0.15 * push;
    C.pt2.color.set('#ffe6c0'); C.pt2.intensity = 2.2 * whip; C.pt2.distance = 3; C.pt2.position.set(CX - 2.4, 2.0, 1.2);
    cam(t, pos, look, lerp(a0.f, a1.f, whip) - 3 * push);
    U.uZoomBlur.value = 1.6 * (1 - smooth(seg(t, 21.7, 21.86))) + 1.2 * Math.sin(whip * PI);
    U.uSat.value = 1.15; U.uVig.value = 0.3;
    ov.streaks(Math.sin(whip * PI) * 0.9, 81);
    if (t > 22.35) { const sp = proj(V(CX - 3.3, 1.55, 0.9)); ov.glow(sp[0], sp[1], 420, 'rgba(255,220,140,A)', 0.35 * smooth(seg(t, 22.35, 22.5))); ov.sparkles(t, sp[0], sp[1], 330, 160, 12, 91, 38, '#fff3c8', smooth(seg(t, 22.35, 22.5))); }
    ov.comic(t, 22.3, 23.0, 'FLIP!', 300, 520, 110, -0.12);
  });

  // shared: corner office family poses
  function family(t, mode) {
    cornerMode();
    const { you, boss, k1, k2, k3 } = chars;
    const Y = { x: -0.62, z: 0.2, ry: 0.12 }, B = { x: 0.32, z: 0.05, ry: -0.08 };
    const fYou = { shock: 1, smile: 0.6, brow: 0.3, blink: blink(t, 21) }, fBoss = { shock: 1, smile: 0.45, brow: 0.2, blink: blink(t, 22) };
    const yp = stand(you, CX + Y.x, Y.z, Y.ry, { face: fYou });
    const bp = stand(boss, CX + B.x, B.z, B.ry, { face: fBoss });
    if (mode === 'proud') {
      Object.assign(yp, handsOnHips(you, CX + Y.x, Y.z, Y.ry)); Object.assign(bp, handsOnHips(boss, CX + B.x, B.z, B.ry));
      yp.spine = [-0.08, 0, 0]; bp.spine = [-0.08, 0, 0]; fYou.smile = 0.8; fBoss.smile = 0.7; fYou.dreamy = 1; fYou.brow = 0.6; fBoss.brow = 0.5;
      yp.head = [-0.1, 0, 0]; bp.head = [-0.08 + 0.05 * Math.sin(t * 9) * seg(t, 26.6, 27.2), 0, 0];
    }
    you.apply(yp, t); boss.apply(bp, t);
    // kid2 on boss's shoulders
    const nb = wp(boss.neck);
    const bounce = Math.abs(Math.sin(t * 5.5)) * 0.02;
    const kp = { x: nb.x, y: nb.y - k2.S.hipH + 0.07 + bounce, z: nb.z - 0.02, ry: B.ry,
      legL: [-1.45, 0, -0.75, 1.5], legR: [-1.45, 0, 0.75, 1.5], face: { happy: 1, smile: 0.8, mouth: 0.4 + 0.2 * Math.sin(t * 9) } };
    const bht = wp(boss.head);
    kp.armL = { ik: [bht.x - 0.1, bht.y + 0.12, bht.z + 0.02], pole: [bht.x - 0.4, bht.y + 0.4, bht.z], hand: 'mitten' };
    kp.armR = { ik: [bht.x + 0.1, bht.y + 0.12, bht.z + 0.02], pole: [bht.x + 0.4, bht.y + 0.4, bht.z], hand: 'mitten' };
    return { yp, bp, kp, Y, B };
  }

  // S12 — 3 YEARS LATER + three kids
  add('S12 kids', 23.0, (t, lt) => {
    const { you, boss, k1, k2, k3 } = chars;
    const { yp, bp, kp, B } = family(t, 'normal'); C.corner.refs.sign.rotation.z = PI;
    // boss hands hold kid2's shins
    k2.apply(kp, t);
    const aL = wp(k2.ankle.L), aR = wp(k2.ankle.R);
    bp.armL = { ik: [aL.x, aL.y + 0.02, aL.z + 0.03], pole: [aL.x - 0.5, aL.y - 0.4, aL.z], hand: 'fist' };
    bp.armR = { ik: [aR.x, aR.y + 0.02, aR.z + 0.03], pole: [aR.x + 0.5, aR.y - 0.4, aR.z], hand: 'fist' };
    boss.apply(bp, t); k2.apply(kp, t);
    yp.armR = { sh: [-0.25, 0, 0.2], el: -1.1 + 0.2 * Math.sin(t * 3), hand: 'mitten' }; you.apply(yp, t);
    // kid1 draws on the whiteboard
    const wb = C.corner.refs.wb;
    const draw = seg(t, 23.4, 25.5);
    const bx = CX - 1.2, bz = -0.95;
    const sx = Math.sin(t * 9) * 0.08, sy = Math.cos(t * 7) * 0.05;
    const k1p = stand(k1, bx - 0.05, bz + 0.05, PI + 0.35, { face: { smile: 0.5 }, armR: { ik: [bx - 0.05 + sx * Math.cos(0.35), 0.86 + sy, bz - 0.3], pole: [bx + 0.3, 0.3, bz], hand: 'fist' } });
    k1.apply(k1p, t);
    drawBoard(draw);
    // kid3 peeks from under the desk
    const peek = 0.5 + 0.5 * Math.sin(t * 4.2);
    k3.apply({ x: CX + 0.9, z: -1.45, ry: 0, hipY: 0.18, hipR: [0.5, 0, 0], legL: [-1.8, 0, -0.3, 2.3], legR: [-1.8, 0, 0.3, 2.3],
      spine: [0.2, 0, 0], neck: [-0.2 - 0.2 * peek, 0, 0.15 * Math.sin(t * 2)], head: [-0.25, 0, 0],
      armL: { sh: [-1.1, 0, -0.3], el: -1.2 }, armR: { sh: [-1.1, 0, 0.3], el: -1.2 }, face: { happy: peek > 0.6 ? 1 : 0, smile: 0.8, mouth: 0.3 } }, t);
    const wide = t < 24.55;
    if (wide) cam(t, [CX - 0.55, 1.55, 4.3], [CX - 0.3, 1.2, -0.6], 52);
    else { const u = smooth(seg(t, 24.55, 25.583)); cam(t, [CX + lerp(0.15, 0.35, u), 1.55, lerp(3.3, 3.0, u)], [CX + 0.45, 1.25, -0.8], 50); }
    U.uSat.value = 1.15;
    const dim = smooth(seg(t, 23.0, 23.12)) * (1 - smooth(seg(t, 23.75, 23.95)));
    U.uDark.value = 0.45 * dim; U.uZoomBlur.value = 0.8 * dim;
    ov.titleCard(t, 23.02, 23.75, '3 YEARS LATER', 'still at the same desk');
    if (t > 24.0) { const p = proj(wp(k2.head).add(V(0, 0.25, 0))); ov.comic(t, 24.05, 25.0, 'HEHEHE!', p[0], p[1], 76, 0.1, { top: '#ffffff', fill: '#bfeaff', inner: '#2a7fd1' }); }
  });

  // S13 — "DEADLINE!"
  add('S13 deadline', 25.583, (t, lt) => {
    const { you, boss, k1, k2, k3 } = chars;
    drawBoard(1); C.corner.refs.sign.rotation.z = PI;
    const { yp, bp, kp } = family(t, 'proud');
    const yell = t > 26.55 ? clamp(lipsync(t, 1.4) + 0.35 * seg(t, 26.55, 26.65) * (1 - seg(t, 27.25, 27.38))) : 0.15 + 0.1 * Math.sin(t * 8);
    const pointU = backOut(seg(t, 26.25, 26.6), 2);
    const camP = V(CX - 0.05, 0.95, 3.0);
    const kidFace = { eyeS: 1.15, brow: 0.6, mouth: yell, teeth: false, smile: 0.4 };
    const point = (ch, p) => {
      ch.apply(p, t); const sh = wp(ch.sh.R); const dir = camP.clone().sub(sh).normalize();
      const rest = sh.clone().add(V(0.08, -0.25, 0.05));
      const tgt = rest.lerp(sh.clone().addScaledVector(dir, (ch.S.ua + ch.S.fa) * 0.95), clamp(pointU));
      p.armR = { ik: [tgt.x, tgt.y, tgt.z], pole: [sh.x + 0.3, sh.y - 0.4, sh.z], hand: 'point' }; ch.apply(p, t);
    };
    kp.face = { ...kidFace }; point(k2, kp);
    const aL = wp(k2.ankle.L), aR = wp(k2.ankle.R);
    bp.armL = { ik: [aL.x, aL.y + 0.02, aL.z + 0.03], pole: [aL.x - 0.5, aL.y - 0.4, aL.z], hand: 'fist' };
    boss.apply(bp, t); point(k2, kp);
    point(k1, stand(k1, CX - 0.48, 1.15, 0.15, { face: { ...kidFace }, spine: [-0.1 * pointU, 0, 0] }));
    point(k3, stand(k3, CX + 0.42, 1.2, -0.2, { face: { ...kidFace }, spine: [-0.1 * pointU, 0, 0] }));
    const punch = backOut(seg(t, 26.6, 26.75), 2);
    cam(t, [camP.x, camP.y, camP.z], [CX - 0.05, 1.3, 0.0], lerp(56, 49, punch), { shake: shake(t, [[26.62, 0.9, 5]]) });
    U.uSat.value = 1.18;
    ov.comic(t, 26.6, 27.38, 'DEADLINE!', 540, 760, 150, -0.08, { shake: 10, burst: true, burstCol: '#ff3f6c', burstR: 1.25 });
  });

  // S14 — record scratch, "Genius."
  add('S14 genius', 27.383, (t, lt) => {
    cornerMode(); drawBoard(1); C.corner.refs.sign.rotation.z = PI;
    const { you, boss, k1, k2, k3 } = chars;
    const Y = { x: -0.3, z: 0.25 }, B = { x: 0.32, z: 0.2 };
    const g = smooth(seg(t, 27.65, 27.8));
    const sway = Math.sin(t * 4) * 0.03 * g;
    const yp = stand(you, CX + Y.x, Y.z, 0.06, { face: { shock: 1, happy: g > 0.3 ? 1 : 0, smile: 0.9, mouth: 0.45, eyeS: 1.2 - 0.2 * g }, hipR: [0, 0, sway] });
    const bp = stand(boss, CX + B.x, B.z, -0.06, { face: { shock: 1, happy: g > 0.3 ? 1 : 0, smile: 0.9, mouth: 0.4, teeth: true, eyeS: 1.15 - 0.15 * g }, hipR: [0, 0, sway] });
    you.apply(yp, t); boss.apply(bp, t);
    const bs = wp(boss.sh.R), ys = wp(you.sh.L);
    yp.armR = { ik: [bs.x - 0.02, bs.y + 0.05, bs.z - 0.05], pole: [CX, 2.0, -0.6], hand: 'mitten', wr: [0, 0, 0] };
    bp.armL = { ik: [ys.x + 0.02, ys.y + 0.04, ys.z - 0.06], pole: [CX, 2.1, -0.7], hand: 'mitten', wr: [0, 0, 0] };
    yp.armL = { sh: [-0.3, 0, -1.2 - 0.3 * g], el: -1.4, hand: 'fist' };
    bp.armR = { sh: [-0.3, 0, 1.2 + 0.3 * g], el: -1.4, hand: 'point' };
    you.apply(yp, t); boss.apply(bp, t);
    const hug = (ch, x, z, legObj, ry) => {
      const lp = wp(legObj);
      const p = stand(ch, x, z, ry, { face: { happy: 1, smile: 0.9, mouth: 0.3 }, spine: [0.15, 0, 0], head: [0.05, ry * -0.5, 0.15] });
      ch.apply(p, t);
      p.armL = { ik: [lp.x - 0.05, lp.y - 0.12, lp.z + 0.04], pole: [lp.x - 0.4, 0.3, lp.z + 0.3], hand: 'mitten' };
      p.armR = { ik: [lp.x + 0.05, lp.y - 0.12, lp.z + 0.04], pole: [lp.x + 0.4, 0.3, lp.z + 0.3], hand: 'mitten' };
      ch.apply(p, t);
    };
    hug(k1, CX + Y.x - 0.15, Y.z + 0.2, you.hip.L, 0.3);
    hug(k2, CX + 0.0, 0.42, you.hip.R, 0.0);
    hug(k3, CX + B.x + 0.15, B.z + 0.2, boss.hip.R, -0.3);
    // confetti
    const cf = C.confetti; cf.visible = t > 27.62;
    if (cf.visible) {
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = V(1, 1, 1);
      for (let i = 0; i < 260; i++) {
        const d = t - 27.62 - hash(i, 1) * 0.4;
        const x = CX + (hash(i, 2) - 0.5) * 3.2 + Math.sin(d * 3 + i) * 0.1, y = 2.9 - Math.max(0, d) * (0.8 + 0.7 * hash(i, 3)), z = -0.6 + hash(i, 4) * 2.6;
        e.set(d * 6 * hash(i, 5) + i, d * 4 + i * 2, d * 5 * hash(i, 6)); q.setFromEuler(e);
        m.compose(V(x, d < 0 ? 10 : y, z), q, s); cf.setMatrixAt(i, m);
      }
      cf.instanceMatrix.needsUpdate = true;
    }
    const pu = smooth(seg(t, 27.383, 28.533));
    const punch = 1 - smooth(seg(t, 27.383, 27.5));
    cam(t, [CX + 0.0, 1.4, lerp(3.9, 3.6, pu)], [CX, 1.25, 0.0], 48 - 3 * punch);
    const scr = 1 - smooth(seg(t, 27.6, 27.7));
    U.uSat.value = lerp(1.18, 0.15, scr); U.uContrast.value = 1.04 + 0.15 * scr; U.uZoomBlur.value = 0.5 * punch;
    const c = proj(V(CX, 1.45, 0.2));
    ov.rays(c[0], c[1], 1500, 20, t * 0.4, 'rgba(255,225,130,A)', 0.45 * g, 0.45);
    ov.comic(t, 27.39, 27.66, 'SCRRRTCH!', 540, 420, 110, -0.12, { shake: 14, top: '#ffffff', fill: '#cfcfcf', inner: '#333333' });
    ov.sparkles(t, W / 2, 700, 480, 420, 16, 99, 40, '#fff6c8', g);
  });

  function drawBoard(u) {
    const tex = C.corner.refs.wbTex, x = tex.userData.ctx;
    const key = Math.round(u * 60);
    if (tex.userData.k === key) return; tex.userData.k = key;
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, 600, 400);
    x.lineCap = 'round'; x.lineJoin = 'round';
    const strokes = [
      ['#e63946', [[60, 330], [140, 250], [220, 280], [330, 150], [450, 90]]],
      ['#e63946', [[420, 80], [452, 88], [440, 120]]],
      ['#1d6fd1', [[90, 120], [90, 200]]], ['#1d6fd1', [[90, 130], [70, 165]]], ['#1d6fd1', [[90, 130], [110, 165]]],
      ['#1d6fd1', [[150, 120], [150, 200]]], ['#1d6fd1', [[150, 130], [130, 165]]], ['#1d6fd1', [[150, 130], [170, 165]]],
      ['#2a9d8f', [[480, 250], [520, 250], [520, 340], [480, 340], [480, 250]]],
    ];
    const total = strokes.length; const n = u * total;
    strokes.forEach(([col, pts], i) => {
      const f = clamp(n - i); if (f <= 0) return;
      x.strokeStyle = col; x.lineWidth = 9; x.beginPath();
      const L = Math.max(1, Math.round(f * (pts.length - 1) * 10));
      for (let k = 0; k <= L; k++) { const s = k / 10, j = Math.min(pts.length - 2, Math.floor(s)), fr = s - j; const p0 = pts[j], p1 = pts[j + 1]; const px = p0[0] + (p1[0] - p0[0]) * fr, py = p0[1] + (p1[1] - p0[1]) * fr; k ? x.lineTo(px, py) : x.moveTo(px, py); }
      x.stroke();
    });
    if (u > 0.4) { x.fillStyle = '#1d6fd1'; for (const hx of [90, 150]) { x.beginPath(); x.arc(hx, 100, 20, 0, 7); x.lineWidth = 8; x.strokeStyle = '#1d6fd1'; x.stroke(); } }
    if (u > 0.7) { x.fillStyle = '#ff4f8b'; x.font = '60px LG'; x.fillText('♥', 105, 90); }
    if (u > 0.85) { x.fillStyle = '#e63946'; x.font = '44px LG'; x.fillText('DEADLINE', 300, 370); }
    tex.needsUpdate = true;
  }
  return S;
}
