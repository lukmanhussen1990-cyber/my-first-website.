// THEATRE: a huge golden awards theatre (stage, red curtains, golden arch, giant LIVE screen, orchestra pit, raked rows of
// red seats packed with a blocky celebrity crowd, a TV camera crane) + OUTSIDE: the glowing theatre at night with searchlights.
// The giant screen (and the TV in the living room) show a LIVE feed: a render of the scene from state.liveCam.
// state (theatre): liveCam {pos,target,fov} | null, live 0/1, spot {x,z} (follow spot on the stage), spotOn 0..1,
//   crowd {cheer, sniff, nose, look} (0..1 each), craneYaw, cranePitch, liveBlink 0/1, fog 0..1 (stage green fog, fx draws it)
import * as THREE from 'three';
import { mat, tex, paint, clamp, lerp, smooth, hash1, hexToRgb, chamferBox } from './lib.js';
import { THEATRE, OUTSIDE } from './layout.js';
import { signCanvas, glowDiscCanvas } from './set_tex2.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const T = THEATRE, ST = T.stage, PIT = T.pit, RW = T.rows;

function velvetCanvas(base = [150, 16, 30]) {      // red velvet with vertical folds (light / dark bands)
  return paint(32, 32, (x, y) => { const f = Math.sin((x / 32) * Math.PI * 4) * 26; const n = (hash1(x * 7 + y * 13) - 0.5) * 10; return [base[0] + f + n, base[1] + f * 0.15 + n * 0.3, base[2] + f * 0.25 + n * 0.3]; });
}
function goldCanvas2() { return paint(16, 16, (x, y) => { const n = (hash1(x * 5 + y * 11) - 0.5) * 30 + ((x + y) % 6 === 0 ? 30 : 0); return [214 + n, 168 + n * 0.8, 60 + n * 0.3]; }); }
function woodCanvas() { return paint(32, 32, (x, y) => { const p = Math.floor(x / 8); const n = (hash1(p * 7 + Math.floor((y + p * 9) / 16) * 3) - 0.5) * 20 + (hash1(x * 3 + y * 17) - 0.5) * 8 + (x % 8 === 0 ? -20 : 0); return [92 + n, 56 + n * 0.7, 34 + n * 0.5]; }); }
function carpetCanvas2() { return paint(16, 16, (x, y) => { const d = (Math.abs((x % 8) - 4) + Math.abs((y % 8) - 4)) === 3; const n = (hash1(x * 3 + y * 7) - 0.5) * 8; return d ? [200 + n, 160 + n, 60] : [130 + n, 16 + n * 0.3, 28 + n * 0.3]; }); }
function wallCanvas() { return paint(32, 32, (x, y) => { const d = (Math.abs((x % 16) - 8) + Math.abs((y % 16) - 8)) < 3; const n = (hash1(x * 7 + y * 3) - 0.5) * 8; return d ? [150 + n, 110 + n, 50] : [86 + n, 18 + n * 0.3, 26 + n * 0.3]; }); }
function crowdFaceCanvas() {          // white face (tinted per person by instance colour): two dark dot eyes + a small mouth
  return paint(16, 16, (x, y) => { if (x > 13 && y > 13) return [255, 255, 255]; if ((x === 5 || x === 10) && (y === 7 || y === 8)) return [20, 16, 14]; if (y === 11 && x >= 7 && x <= 8) return [120, 60, 50]; return [255, 255, 255]; });
}

// ---------------------------------------------------------------- the live feed (shared by the giant screen + the living-room TV)
const LIVE = { screens: [], rt: new THREE.WebGLRenderTarget(512, 288), cam: new THREE.PerspectiveCamera(30, 512 / 288, 0.05, 200), busy: false, theatre: null, frame: -1 };
LIVE.rt.texture.colorSpace = THREE.SRGBColorSpace;
export function liveRender(renderer, scene, state) {
  if (LIVE.busy || !state || !state.liveCam || !LIVE.theatre) return;
  LIVE.busy = true;
  const c = state.liveCam; LIVE.cam.fov = c.fov || 30; LIVE.cam.position.set(...c.pos); LIVE.cam.lookAt(...c.target); LIVE.cam.updateProjectionMatrix(); LIVE.cam.updateMatrixWorld(true);
  const vis = LIVE.theatre.visible; LIVE.theatre.visible = true; const sv = LIVE.screens.map((m) => m.visible); for (const m of LIVE.screens) m.visible = false;
  const prevRT = renderer.getRenderTarget(), prevXR = renderer.xr.enabled; renderer.xr.enabled = false;
  const sm = renderer.shadowMap.autoUpdate;
  renderer.setRenderTarget(LIVE.rt); renderer.clear(); renderer.render(scene, LIVE.cam);
  renderer.setRenderTarget(prevRT); renderer.xr.enabled = prevXR; renderer.shadowMap.autoUpdate = sm;
  LIVE.theatre.visible = vis; LIVE.screens.forEach((m, i) => { m.visible = sv[i]; }); LIVE.busy = false;
}
export const liveTexture = () => LIVE.rt.texture;
export const addLiveScreen = (m) => LIVE.screens.push(m);

export function buildTheatre(env, world) {
  const group = new THREE.Group(); group.name = 'set.theatre'; LIVE.theatre = group;
  const add = (m, name, cast = true, recv = true) => { m.castShadow = cast; m.receiveShadow = recv; if (name) m.name = `set.theatre.${name}`; group.add(m); return m; };
  const box = (w, h, d, material, x, y, z, name, cast = true) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material); m.position.set(x, y, z); return add(m, name, cast); };
  const gold = new THREE.MeshStandardMaterial({ map: tex(goldCanvas2()), color: '#ffd878', metalness: 0.75, roughness: 0.32, envMap: env, envMapIntensity: 1.2 });
  const velvet = mat(tex(velvetCanvas(), { repeat: [6, 1] }), { rough: 0.95 });
  const wood = mat(tex(woodCanvas(), { repeat: [8, 4] }), { rough: 0.45 });
  const dark = mat('#141016', { rough: 0.8 });
  const carpet = mat(tex(carpetCanvas2(), { repeat: [10, 12] }), { rough: 1 });

  // ---------------------------------------------------------------- stage, pit, audience floor, stairs
  box(ST.x1 - ST.x0, ST.y, ST.z1 - ST.z0, [dark, dark, wood, dark, dark, dark], 0, ST.y / 2, (ST.z0 + ST.z1) / 2, 'stage');
  box(ST.x1 - ST.x0 + 0.1, 0.08, 0.1, gold, 0, ST.y - 0.04, ST.z1 + 0.02, 'stageLip', false);
  const footM = mat('#fff4d0', { emissive: '#ffd890', emissiveIntensity: 1.4 });
  for (let x = -6.5; x <= 6.5; x += 0.65) box(0.3, 0.06, 0.08, footM, x, ST.y + 0.03, ST.z1 - 0.1, 'footlight', false);
  const pitFloor = new THREE.Mesh(new THREE.PlaneGeometry(PIT.x1 - PIT.x0, PIT.z1 - PIT.z0), mat('#2a1a14', { rough: 0.8 }));
  pitFloor.rotation.x = -Math.PI / 2; pitFloor.position.set(0, PIT.y, (PIT.z0 + PIT.z1) / 2); add(pitFloor, 'pitFloor', false);
  box(PIT.x1 - PIT.x0, -PIT.y, 0.12, [dark, dark, gold, dark, wood, wood], 0, PIT.y / 2, PIT.z1 + 0.06, 'pitWall', false);
  box(PIT.x1 - PIT.x0 + 0.1, 0.06, 0.18, gold, 0, 0.03, PIT.z1 + 0.06, 'pitRail', false);
  for (const sx of [-1, 1]) box(1.6, 0.02, PIT.z1 - PIT.z0, carpet, sx * (PIT.x1 + 0.8), 0.0, (PIT.z0 + PIT.z1) / 2, 'pitSide', false);
  const floorA = new THREE.Mesh(new THREE.PlaneGeometry(20, 18), carpet); floorA.rotation.x = -Math.PI / 2; floorA.position.set(0, 0, PIT.z1 + 9); add(floorA, 'audienceFloor', false);
  // side stairs (stage right): 5 steps up from the audience floor
  const SS = T.stairs, nSteps = 6;
  for (let i = 0; i < nSteps; i++) {
    const zz = lerp(SS.z1, SS.z0, (i + 0.5) / nSteps), h = ST.y * (i + 1) / nSteps;
    box(SS.x1 - SS.x0, h, (SS.z1 - SS.z0) / nSteps, [dark, dark, carpet, dark, wood, wood], (SS.x0 + SS.x1) / 2, h / 2, zz, 'step');
  }
  // raked rows (risers) + instanced red seats
  const seatSpots = [];
  for (let i = 0; i < RW.n; i++) {
    const z = RW.z0 + i * RW.dz, y = i * RW.rise;
    if (i > 0) box(RW.x1 - RW.x0 + 1.2, y, RW.dz, carpet, 0, y / 2, z + 0.1, 'riser', false);
    for (let x = RW.x0; x <= RW.x1 + 1e-6; x += RW.dx) { if (Math.abs(x) < RW.aisle) continue; seatSpots.push({ x, y, z, row: i }); }
  }
  const seatBase = new THREE.InstancedMesh(chamferBox(0.5, 0.16, 0.5, 0.04), mat('#a8141e', { rough: 0.85 }), seatSpots.length);
  const seatBack = new THREE.InstancedMesh(chamferBox(0.52, 0.62, 0.1, 0.04), mat('#8a0f18', { rough: 0.85 }), seatSpots.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = V(1, 1, 1), p3 = V();
  seatSpots.forEach((s, k) => {
    m4.compose(p3.set(s.x, s.y + RW.seatY - 0.08, s.z), q.identity(), sc.set(1, 1, 1)); seatBase.setMatrixAt(k, m4);
    m4.compose(p3.set(s.x, s.y + RW.seatY + 0.28, s.z + 0.27), q.setFromAxisAngle(V(1, 0, 0), -0.12), sc.set(1, 1, 1)); seatBack.setMatrixAt(k, m4);
  });
  seatBase.castShadow = seatBack.castShadow = true; seatBase.receiveShadow = seatBack.receiveShadow = true; group.add(seatBase, seatBack);

  // ---------------------------------------------------------------- the crowd: instanced blocky celebrities (tuxedos + gowns)
  const reserved = new Set(Object.values(T.front).map((x) => `0:${x.toFixed(2)}`));
  const people = seatSpots.filter((s) => !(s.row === 0 && reserved.has(`0:${s.x.toFixed(2)}`)) && hash1(s.x * 7 + s.z * 3) > 0.06);
  const skins = ['#f2cfb4', '#e0a882', '#c58c64', '#a8714a', '#8a5a3a', '#f0c8a8'];
  const clothes = ['#141418', '#141418', '#1a1a24', '#c81c3a', '#2a6ad0', '#e8c040', '#d8dce8', '#7a2a9a', '#141418', '#f2f2f2', '#1a7a5a', '#ff8ab0'];
  const hairs = ['#1a120c', '#3a2414', '#6a4028', '#e8c070', '#141010', '#b8b4ae', '#a83a1a'];
  const N = people.length;
  const pTorso = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.5, 0.22), mat('#ffffff', { rough: 0.6 }), N);
  const pLegs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 0.12, 0.44), mat('#ffffff', { rough: 0.8 }), N);
  const headG = new THREE.BoxGeometry(0.22, 0.24, 0.22);
  { const uv = headG.attributes.uv; for (let i = 0; i < uv.count; i++) { const face = Math.floor(i / 4); if (face !== 4) uv.setXY(i, 0.97, 0.03); } }
  const pHead = new THREE.InstancedMesh(headG, mat(tex(crowdFaceCanvas()), { rough: 0.8 }), N);
  const pHair = new THREE.InstancedMesh(new THREE.BoxGeometry(0.235, 0.09, 0.235), mat('#ffffff', { rough: 0.9 }), N);
  const pArmL = new THREE.InstancedMesh(new THREE.BoxGeometry(0.09, 0.42, 0.09), mat('#ffffff', { rough: 0.7 }), N);
  const pArmR = new THREE.InstancedMesh(new THREE.BoxGeometry(0.09, 0.42, 0.09), mat('#ffffff', { rough: 0.7 }), N);
  const col = new THREE.Color();
  people.forEach((s, k) => {
    const r = (j) => hash1(k * 13.7 + j * 3.1);
    const cl = clothes[Math.floor(r(1) * clothes.length)];
    pTorso.setColorAt(k, col.set(cl)); pArmL.setColorAt(k, col.set(cl)); pArmR.setColorAt(k, col.set(cl));
    pLegs.setColorAt(k, col.set(cl === '#f2f2f2' ? '#f2f2f2' : r(2) > 0.5 ? '#141418' : cl));
    pHead.setColorAt(k, col.set(skins[Math.floor(r(3) * skins.length)])); pHair.setColorAt(k, col.set(hairs[Math.floor(r(4) * hairs.length)]));
  });
  for (const im of [pTorso, pLegs, pHead, pHair, pArmL, pArmR]) { im.castShadow = true; im.receiveShadow = true; group.add(im); im.frustumCulled = false; }
  const crowdPose = (t, cs) => {
    const cheer = cs.cheer || 0, sniff = cs.sniff || 0, nose = cs.nose || 0, look = cs.look || 0;
    const e = new THREE.Euler(), qq = new THREE.Quaternion();
    people.forEach((s, k) => {
      const ph = hash1(k * 5.3) * 6.28, bob = cheer * 0.04 * Math.abs(Math.sin(t * 9 + ph));
      const hip = V(s.x, s.y + RW.seatY + 0.02 + bob, s.z + 0.05);
      m4.compose(p3.set(hip.x, hip.y, hip.z - 0.2), q.identity(), sc.set(1, 1, 1)); pLegs.setMatrixAt(k, m4);
      m4.compose(p3.set(hip.x, hip.y + 0.27, hip.z), q.identity(), sc.set(1, 1, 1)); pTorso.setMatrixAt(k, m4);
      const yaw = look * (hash1(k * 9.1) > 0.5 ? 0.5 : -0.5) + Math.sin(t * 0.7 + ph) * 0.05, pitch = -sniff * (0.3 + 0.1 * Math.sin(t * 14 + ph)) + 0.05;
      e.set(pitch, yaw, 0, 'YXZ'); qq.setFromEuler(e);
      m4.compose(p3.set(hip.x, hip.y + 0.66, hip.z), qq, sc.set(1, 1, 1)); pHead.setMatrixAt(k, m4);
      const hairPos = V(0, 0.155, -0.005).applyQuaternion(qq).add(V(hip.x, hip.y + 0.66, hip.z));
      m4.compose(hairPos, qq, sc.set(1, 1, 1)); pHair.setMatrixAt(k, m4);
      for (const [im, sd] of [[pArmL, 1], [pArmR, -1]]) {
        let ax = -0.4, az = sd * 0.1, ay = 0.25, dz = 0.12;
        if (cheer > 0 && hash1(k * 3 + sd) > 0.35) { ax = lerp(-0.4, -2.8, cheer) + 0.25 * Math.sin(t * 10 + ph + sd); ay = lerp(0.25, 0.55, cheer); dz = lerp(0.12, 0.05, cheer); }
        if (nose > 0 && sd < 0) { ax = lerp(ax, -2.2, nose); ay = lerp(ay, 0.42, nose); dz = lerp(dz, 0.16, nose); az = lerp(az, 0.35, nose); }
        e.set(ax, 0, az); qq.setFromEuler(e);
        const off = V(0, -0.2, 0).applyQuaternion(qq);
        m4.compose(p3.set(hip.x + sd * 0.215, hip.y + ay + 0.2 + off.y, hip.z + dz + off.z * 0.6), qq, sc.set(1, 1, 1)); im.setMatrixAt(k, m4);
      }
    });
    for (const im of [pTorso, pLegs, pHead, pHair, pArmL, pArmR]) im.instanceMatrix.needsUpdate = true;
  };
  crowdPose(0, {});

  // ---------------------------------------------------------------- walls, ceiling, curtains, golden arch, the LIVE screen
  const wallM = mat(tex(wallCanvas(), { repeat: [10, 4] }), { rough: 0.85 });
  for (const sx of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(26, 12), wallM); w.position.set(sx * 9.5, 6, 6); w.rotation.y = -sx * Math.PI / 2; add(w, 'wall', false); }
  const back = new THREE.Mesh(new THREE.PlaneGeometry(20, 12), wallM); back.position.set(0, 6, 15); back.rotation.y = Math.PI; add(back, 'backWall', false);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(20, 26), mat('#1a1018', { rough: 0.9 })); ceil.position.set(0, 11.5, 3); ceil.rotation.x = Math.PI / 2; add(ceil, 'ceiling', false);
  const starM = mat('#fff4d0', { emissive: '#ffe0a0', emissiveIntensity: 1.5 });
  for (let i = 0; i < 70; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.05, 4, 3), starM); s.position.set((hash1(i) - 0.5) * 18, 11.4, -1 + hash1(i * 3) * 16); add(s, null, false, false); }
  for (const sx of [-1, 1]) for (let z = 2; z < 15; z += 3) { const sconce = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), mat('#fff0c8', { emissive: '#ffd890', emissiveIntensity: 1.2 })); sconce.position.set(sx * 9.4, 3.2, z); add(sconce, 'sconce', false); }
  const curtG = new THREE.PlaneGeometry(16, 9, 48, 1); { const p = curtG.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 3.2) * 0.12); curtG.computeVertexNormals(); }
  const backCurtain = new THREE.Mesh(curtG, velvet); backCurtain.position.set(0, 4.5 + ST.y - 0.2, ST.z0 + 0.2); add(backCurtain, 'backCurtain', false);
  for (const sx of [-1, 1]) {
    const g = new THREE.PlaneGeometry(2.4, 9.5, 10, 1); const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 6) * 0.1); g.computeVertexNormals();
    const c = new THREE.Mesh(g, velvet); c.position.set(sx * 6.6, 4.75, ST.z1 - 0.3); add(c, 'sideCurtain', false);
    box(0.6, 9.6, 0.6, gold, sx * 8.0, 4.8, ST.z1 - 0.15, 'archPillar');
  }
  const valG = new THREE.PlaneGeometry(16.6, 1.6, 40, 1); { const p = valG.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 2.4) * 0.15); valG.computeVertexNormals(); }
  const val = new THREE.Mesh(valG, velvet); val.position.set(0, 8.7, ST.z1 - 0.2); add(val, 'valance', false);
  box(16.6, 0.6, 0.6, gold, 0, 9.6, ST.z1 - 0.15, 'archTop');
  const emblem = new THREE.Mesh(new THREE.CircleGeometry(0.7, 6), gold); emblem.position.set(0, 9.6, ST.z1 + 0.17); add(emblem, 'emblem', false);
  // giant screen above the stage (gold frame) with the live feed
  const SC = T.screen;
  box(SC.w + 0.3, SC.h + 0.3, 0.12, gold, SC.pos[0], SC.pos[1], SC.pos[2] - 0.08, 'screenFrame');
  const screenMat = new THREE.MeshBasicMaterial({ map: LIVE.rt.texture, toneMapped: false });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(SC.w, SC.h), screenMat); screen.position.set(...SC.pos); add(screen, 'screen', false, false);
  const offScreen = new THREE.Mesh(new THREE.PlaneGeometry(SC.w, SC.h), mat('#0a0a10', { rough: 0.35 })); offScreen.position.set(SC.pos[0], SC.pos[1], SC.pos[2] - 0.012); add(offScreen, 'screenOff', false, false);
  screen.onBeforeRender = (renderer, scene) => liveRender(renderer, scene, STATE.s); LIVE.screens.push(screen);
  { const c = T.musicians.find((m) => m[2] === 'cello'); if (c) box(0.4, 0.45, 0.4, dark, c[0], PIT.y + 0.225, c[1] - 0.05, 'stool'); }
  // golden mic stand on the stage
  const MIC = T.mic.pos, micG = new THREE.Group(); micG.position.set(MIC[0], ST.y, MIC[1]); group.add(micG);
  { const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.03, 16), gold); base.position.y = 0.015; micG.add(base);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.36, 8), gold); pole.position.y = 0.69; micG.add(pole);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.25, 8), dark); neck.position.set(0, 1.44, -0.07); neck.rotation.x = -0.9; micG.add(neck);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.12, 10), mat('#2a2a30', { rough: 0.4 })); head.position.set(0, 1.5, -0.14); head.rotation.x = -1.2; micG.add(head);
    micG.traverse((o) => { if (o.isMesh) o.castShadow = true; }); }
  // the conductor's podium + music stands in the pit
  const CD = T.conductor.pos; box(0.9, 0.25, 0.7, dark, CD[0], PIT.y + 0.125, CD[1], 'podium');
  for (const [mx, mz] of T.musicians) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.02), dark); st.position.set(mx, PIT.y + 1.0, mz + 0.5); st.rotation.x = 0.4; add(st, 'musicStand'); const ps = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.9, 6), dark); ps.position.set(mx, PIT.y + 0.45, mz + 0.5); add(ps, null); }
  // TV camera crane (base in the side aisle, arm swings toward the stage) with a red LIVE light
  const CR = T.crane, crane = new THREE.Group(); crane.position.set(CR.base[0], 0, CR.base[1]); group.add(crane);
  const craneM = mat('#2a2c34', { rough: 0.5 });
  const cbase = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.9), craneM); cbase.position.y = 0.15; crane.add(cbase);
  const cpost = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.8, 8), craneM); cpost.position.y = 1.2; crane.add(cpost);
  const armPiv = new THREE.Group(); armPiv.position.y = 2.1; crane.add(armPiv);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, CR.armLen), craneM); arm.position.z = -CR.armLen / 2 + 1.0; armPiv.add(arm);
  const cw = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), craneM); cw.position.z = 1.1; armPiv.add(cw);
  const camBox = new THREE.Group(); camBox.position.z = -CR.armLen + 1.0; armPiv.add(camBox);
  { const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.5), mat('#1a1a1e', { rough: 0.4 })); body.position.y = -0.2; camBox.add(body);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.25, 12), mat('#0a0a0c', { rough: 0.2 })); lens.rotation.x = Math.PI / 2; lens.position.set(0, -0.2, -0.36); camBox.add(lens); }
  const liveLight = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.04), new THREE.MeshBasicMaterial({ color: '#ff1a1a' })); liveLight.position.set(0, 0.0, -0.18); camBox.add(liveLight);
  crane.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  // ---------------------------------------------------------------- lights: warm house light, stage key, follow spot
  const key = new THREE.DirectionalLight('#fff0d8', 1.4); key.name = 'set.theatre.key';
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0005; key.shadow.normalBias = 0.03;
  key.userData.dir = V(0.25, 1.0, 0.9).normalize(); group.add(key, key.target);
  group.add(new THREE.HemisphereLight('#ffe8c8', '#7a4030', 0.95));
  const fill = new THREE.DirectionalLight('#ffe2c4', 1.1); fill.position.set(0, 5.5, -7); fill.target.position.set(0, 0.6, 5); group.add(fill, fill.target);   // stage spill onto the audience faces
  const stageWash = new THREE.PointLight('#ffd8a0', 30, 16, 1.6); stageWash.position.set(0, 7, -3); group.add(stageWash);
  const houseL = new THREE.PointLight('#ffc890', 22, 22, 1.4); houseL.position.set(0, 8, 8); group.add(houseL);
  const pitL = new THREE.PointLight('#ffd0a0', 26, 9, 1.4); pitL.position.set(0, 2.2, 0.9); group.add(pitL);
  const spot = new THREE.SpotLight('#fff6e0', 120, 30, 0.22, 0.5, 1.2); spot.position.set(0, 10.5, 9); group.add(spot, spot.target);
  const glowTex = tex(glowDiscCanvas(64), { nearest: false });
  const spotPool = new THREE.Mesh(new THREE.CircleGeometry(1.0, 24), new THREE.MeshBasicMaterial({ map: glowTex, color: '#fff2d0', transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
  spotPool.rotation.x = -Math.PI / 2; group.add(spotPool);
  const STATE = { s: null };
  return {
    name: 'theatre', group, props: { screen, crane, micG, liveLight }, key,
    look: { background: '#0c0810', fog: { color: '#1a0e14', near: 28, far: 60 }, exposure: 1.1, shadowCenter: [0, 1.5, -3], shadowRadius: 9 },
    defaults: () => ({ liveCam: null, spot: { x: 0, z: T.actor.pos[1] }, spotOn: 1, crowd: { cheer: 0, sniff: 0, nose: 0, look: 0 }, craneYaw: 0.5, cranePitch: 0.15, liveBlink: 1 }),
    update(t, s) {
      STATE.s = s;
      crowdPose(t, s.crowd || {});
      spot.target.position.set(s.spot.x, ST.y, s.spot.z); spot.intensity = 120 * (s.spotOn ?? 1);
      spotPool.position.set(s.spot.x, ST.y + 0.012, s.spot.z); spotPool.material.opacity = 0.45 * (s.spotOn ?? 1);
      armPiv.rotation.set(s.cranePitch, s.craneYaw, 0, 'YXZ'); camBox.rotation.x = -s.cranePitch;
      liveLight.visible = (s.liveBlink ?? 1) > 0.5 && Math.sin(t * 6) > -0.3;
      screen.visible = !!s.liveCam;
    },
  };
}

// ---------------------------------------------------------------- OUTSIDE: the glowing theatre at night + searchlights
export function buildOutside(env) {
  const group = new THREE.Group(); group.name = 'set.outside';
  const [ox, oz] = OUTSIDE.origin;
  const add = (m, cast = true) => { m.castShadow = cast; m.receiveShadow = true; group.add(m); return m; };
  const gold = new THREE.MeshStandardMaterial({ color: '#ffd070', metalness: 0.6, roughness: 0.35, envMap: env, emissive: '#6a4400', emissiveIntensity: 0.6 });
  const wallM = mat('#e8d8b8', { rough: 0.7, emissive: '#5a3a10', emissiveIntensity: 0.35 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), mat('#1a1a22', { rough: 0.9 })); ground.rotation.x = -Math.PI / 2; ground.position.set(ox, 0, oz); add(ground, false);
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), mat('#3a3440', { rough: 0.8 })); plaza.rotation.x = -Math.PI / 2; plaza.position.set(ox, 0.01, oz + 8); add(plaza, false);
  const carpetM = mat('#b0101e', { rough: 0.9 }); const rc = new THREE.Mesh(new THREE.PlaneGeometry(3, 18), carpetM); rc.rotation.x = -Math.PI / 2; rc.position.set(ox, 0.02, oz + 12); add(rc, false);
  const body = new THREE.Mesh(new THREE.BoxGeometry(34, 18, 24), wallM); body.position.set(ox, 9, oz - 12); add(body);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(9, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), gold); dome.position.set(ox, 18, oz - 12); add(dome);
  for (let i = -3; i <= 3; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 12, 10), mat('#fff4e0', { emissive: '#8a6a30', emissiveIntensity: 0.5 })); c.position.set(ox + i * 4.4, 6, oz + 0.4); add(c); }
  const roofEdge = new THREE.Mesh(new THREE.BoxGeometry(34.6, 1.2, 1.2), gold); roofEdge.position.set(ox, 12.6, oz + 0.4); add(roofEdge);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.4), new THREE.MeshBasicMaterial({ map: tex(signCanvas(['THE AWARDS'], { w: 512, h: 88, bg: '#1a0e08', color: '#ffd040', border: '#ffd040', borderW: 6 })), toneMapped: false }));
  sign.position.set(ox, 14.6, oz + 0.05); add(sign, false);
  const winM = new THREE.MeshBasicMaterial({ color: '#ffd890' });
  for (let i = -3; i < 3; i++) for (let j = 0; j < 2; j++) { const w = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 3.0), winM); w.position.set(ox + i * 4.4 + 2.2, 3 + j * 5, oz + 0.02); add(w, false); }
  // searchlight beams (additive cones) - swing in update
  const beams = [];
  const beamM = new THREE.MeshBasicMaterial({ color: '#fff0c0', transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  for (const [bx, bz, ph] of [[-12, 6, 0], [-5, 10, 1.3], [6, 10, 2.1], [13, 6, 3.4]]) {
    const g = new THREE.ConeGeometry(2.4, 90, 16, 1, true); g.translate(0, -45, 0); g.rotateX(Math.PI);
    const piv = new THREE.Group(); piv.position.set(ox + bx, 0.5, oz + bz); group.add(piv);
    const cone = new THREE.Mesh(g, beamM); piv.add(cone); beams.push({ piv, ph });
  }
  // night sky dome with stars
  const skyG = new THREE.SphereGeometry(300, 24, 12), sp = skyG.attributes.position, cols = new Float32Array(sp.count * 3);
  for (let i = 0; i < sp.count; i++) { const y = sp.getY(i) / 300; const c = new THREE.Color('#2a1a3a').lerp(new THREE.Color('#06061a'), clamp(y * 1.6)); cols.set([c.r, c.g, c.b], i * 3); }
  skyG.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const sky = new THREE.Mesh(skyG, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })); sky.renderOrder = -10; group.add(sky);
  const starPts = []; for (let i = 0; i < 400; i++) { const a = hash1(i) * Math.PI * 2, e = 0.15 + hash1(i * 3) * 1.2; starPts.push(Math.cos(a) * Math.cos(e) * 280, Math.sin(e) * 280, Math.sin(a) * Math.cos(e) * 280); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(starPts, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 1.4, sizeAttenuation: false, fog: false })); group.add(stars);
  const key = new THREE.DirectionalLight('#9aa8ff', 0.6); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.userData.dir = V(-0.3, 1, 0.6).normalize(); group.add(key, key.target);
  group.add(new THREE.HemisphereLight('#4a4a8a', '#1a1018', 0.7));
  const facadeL = new THREE.PointLight('#ffc870', 400, 60, 1.4); facadeL.position.set(ox, 6, oz + 14); group.add(facadeL);
  return {
    name: 'outside', group, props: {}, key,
    look: { background: '#06061a', fog: { color: '#0c0a1e', near: 80, far: 260 }, exposure: 1.1, shadowCenter: [ox, 4, oz], shadowRadius: 24 },
    defaults: () => ({}),
    update(t, s, ctx) {
      sky.position.copy(ctx.camera.position); stars.position.copy(ctx.camera.position);
      for (const b of beams) b.piv.rotation.set(0.35 * Math.sin(t * 0.6 + b.ph), 0, 0.4 * Math.sin(t * 0.45 + b.ph * 1.7));
    },
  };
}
