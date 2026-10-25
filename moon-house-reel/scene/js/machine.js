// The small, slow digging machine: tracks, body with one big friendly camera
// eye, solar panel, and a telescoping arm with a scoop. Parts pop in and snap
// together; the arm is posed every frame.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { popScale, clamp } from './util.js';
import { treadTexture } from './textures.js';

function rbox(w, h, d, r, mat) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, r), mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function cyl(r1, r2, h, mat, seg = 24) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

export function createMachine(scene) {
  const tread = treadTexture(); tread.wrapS = tread.wrapT = THREE.RepeatWrapping; tread.repeat.set(4, 1);
  const M = {
    white: new THREE.MeshStandardMaterial({ color: 0xf3f1ec, roughness: 0.45 }),
    orange: new THREE.MeshStandardMaterial({ color: 0xff8a2a, roughness: 0.45 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x3b3f46, roughness: 0.7 }),
    metal: new THREE.MeshStandardMaterial({ color: 0xb4bcc8, roughness: 0.28, metalness: 0.85 }),
    track: new THREE.MeshStandardMaterial({ map: tread, roughness: 0.85 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x0b1220, roughness: 0.05, metalness: 0.2 }),
    iris: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x47c8ff, emissiveIntensity: 2.6 }),
    panel: new THREE.MeshStandardMaterial({ color: 0x1d3b7a, roughness: 0.25, metalness: 0.4, emissive: 0x0a1630, emissiveIntensity: 0.4 }),
    dust: new THREE.MeshStandardMaterial({ color: 0x8c8c8f, roughness: 1 }),
    led: new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x5dff9a, emissiveIntensity: 3 }),
  };
  const root = new THREE.Group();
  const parts = []; // {obj, t (pop time), from: offset vector}
  const add = (parent, obj, order) => { parent.add(obj); parts.push({ obj, order, base: obj.position.clone(), scale: obj.scale.clone() }); return obj; };

  // tracks (machine faces +z)
  const tracks = new THREE.Group(); root.add(tracks);
  for (const s of [-1, 1]) {
    const tr = rbox(0.26, 0.3, 1.25, 0.12, M.track); tr.position.set(0.43 * s, 0.15, 0); add(tracks, tr, 0);
    for (let k = -1; k <= 1; k++) {
      const wh = cyl(0.1, 0.1, 0.05, M.metal); wh.rotation.z = Math.PI / 2; wh.position.set(0.43 * s + 0.14 * s, 0.15, k * 0.38); tracks.add(wh); parts[parts.length - 1].kids = (parts[parts.length - 1].kids || []).concat(wh);
    }
  }
  const chassis = rbox(0.7, 0.18, 0.95, 0.06, M.dark); chassis.position.set(0, 0.24, 0); add(tracks, chassis, 1);
  // turret (rotates)
  const turret = new THREE.Group(); turret.position.y = 0.33; root.add(turret);
  const ring = cyl(0.36, 0.38, 0.06, M.metal, 32); ring.position.y = 0.03; add(turret, ring, 2);
  const bodyM = rbox(0.86, 0.5, 0.86, 0.14, M.white); bodyM.position.y = 0.31; add(turret, bodyM, 3);
  const stripeM = rbox(0.88, 0.07, 0.88, 0.03, M.orange); stripeM.position.y = 0.2; add(turret, stripeM, 3);
  // head with big friendly eye
  const head = new THREE.Group(); head.position.set(0, 0.62, 0.12); turret.add(head);
  const headShell = rbox(0.44, 0.3, 0.36, 0.12, M.white); add(head, headShell, 4);
  const eyeRim = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.025, 12, 32), M.metal); eyeRim.position.z = 0.185; add(head, eyeRim, 4);
  const eyeGlass = new THREE.Mesh(new THREE.SphereGeometry(0.1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), M.glass); eyeGlass.rotation.x = Math.PI / 2; eyeGlass.position.z = 0.17; eyeGlass.scale.z = 0.5; add(head, eyeGlass, 4);
  const iris = new THREE.Mesh(new THREE.CircleGeometry(0.045, 24), M.iris); iris.position.z = 0.222; add(head, iris, 4);
  const irisHL = new THREE.Mesh(new THREE.CircleGeometry(0.014, 12), new THREE.MeshBasicMaterial({ color: 0xffffff })); irisHL.position.set(-0.02, 0.02, 0.224); head.add(irisHL);
  const antenna = cyl(0.008, 0.008, 0.22, M.metal, 8); antenna.position.set(0.15, 0.24, -0.05); add(head, antenna, 5);
  const antLed = new THREE.Mesh(new THREE.SphereGeometry(0.025, 12, 8), M.led); antLed.position.set(0.15, 0.36, -0.05); add(head, antLed, 5);
  // solar panel on the back
  const panelG = new THREE.Group(); panelG.position.set(0, 0.62, -0.36); turret.add(panelG);
  const mast = cyl(0.025, 0.025, 0.25, M.metal, 8); mast.position.y = 0.05; add(panelG, mast, 5);
  const panel = rbox(0.78, 0.03, 0.42, 0.01, M.panel); panel.position.set(0, 0.2, -0.05); panel.rotation.x = 0.55; add(panelG, panel, 6);
  const panelFrame = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.02, 0.44), M.metal); panelFrame.position.copy(panel.position); panelFrame.rotation.copy(panel.rotation); panelFrame.position.y -= 0.01; panelG.add(panelFrame); parts[parts.length - 1].kids = [panelFrame];
  // arm: boom -> stick (telescoping) -> scoop
  const boom = new THREE.Group(); boom.position.set(0.0, 0.42, 0.42); turret.add(boom);
  const boomJ = cyl(0.08, 0.08, 0.26, M.metal); boomJ.rotation.z = Math.PI / 2; add(boom, boomJ, 7);
  const boomBar = rbox(0.15, 0.15, 0.95, 0.05, M.orange); boomBar.position.z = 0.47; add(boom, boomBar, 7);
  const stick = new THREE.Group(); stick.position.z = 0.95; boom.add(stick);
  const stickJ = cyl(0.07, 0.07, 0.22, M.metal); stickJ.rotation.z = Math.PI / 2; add(stick, stickJ, 8);
  const stickBar = rbox(0.12, 0.12, 0.75, 0.04, M.white); stickBar.position.z = 0.37; add(stick, stickBar, 8);
  const ext = new THREE.Group(); stick.add(ext); // telescoping inner bar
  const extBar = rbox(0.085, 0.085, 0.75, 0.03, M.metal); extBar.position.z = 0.4; ext.add(extBar);
  const scoopJ = new THREE.Group(); scoopJ.position.z = 0.78; ext.add(scoopJ);
  // scoop: a half-pipe bucket with teeth
  const bucket = new THREE.Group(); scoopJ.add(bucket);
  const shellGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.32, 24, 1, true, 0, Math.PI);
  const shell = new THREE.Mesh(shellGeo, new THREE.MeshStandardMaterial({ color: 0xff8a2a, roughness: 0.45, side: THREE.DoubleSide }));
  shell.rotation.set(0, 0, -Math.PI / 2); shell.position.set(0, -0.05, 0.12); shell.castShadow = true;
  add(bucket, shell, 9);
  for (const s of [-1, 1]) { const cap = new THREE.Mesh(new THREE.CircleGeometry(0.17, 24, 0, Math.PI), M.orange); cap.material = cap.material.clone(); cap.material.side = THREE.DoubleSide; cap.position.set(0.16 * s, -0.05, 0.12); cap.rotation.set(0, Math.PI / 2, Math.PI); bucket.add(cap); parts[parts.length - 1].kids = (parts[parts.length - 1].kids || []).concat(cap); }
  for (let k = -2; k <= 2; k++) { const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.07, 8), M.metal); tooth.position.set(k * 0.065, -0.22, 0.12); tooth.rotation.x = Math.PI; bucket.add(tooth); parts[parts.length - 1].kids.push(tooth); }
  const load = new THREE.Mesh(new THREE.SphereGeometry(0.15, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.dust);
  load.scale.set(1.0, 0.6, 0.85); load.position.set(0, -0.06, 0.12); bucket.add(load);
  // hydraulic piston (cosmetic)
  const piston = cyl(0.03, 0.03, 0.55, M.metal, 10); piston.rotation.x = Math.PI / 2; piston.position.set(0, -0.12, 0.3); add(boom, piston, 7);

  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(root);

  const maxOrder = 9;
  function setState(s, t) {
    // s: {x,y,z,yaw, turret, boom, stick, scoop, ext, load, eye, build (time when building starts), buildDur}
    root.position.set(s.x, s.y, s.z);
    root.rotation.y = s.yaw;
    turret.rotation.y = s.turret || 0;
    boom.rotation.x = -(s.boom || 0);
    stick.rotation.x = -(s.stick || 0);
    ext.position.z = s.ext || 0;
    scoopJ.rotation.x = -(s.scoop || 0);
    load.visible = (s.load || 0) > 0.02;
    load.scale.set(1.0 * (s.load || 0), 0.6 * (s.load || 0) + 0.001, 0.85 * (s.load || 0));
    head.rotation.y = s.look || 0;
    head.rotation.x = s.lookUp || 0;
    // snap-together build
    const tb = s.build ?? -1e9, gap = s.buildGap ?? 0.13;
    root.visible = t >= tb;
    for (const p of parts) {
      const k = popScale(t, tb + p.order * gap, 0.42);
      const drop = (1 - clamp(k)) * 0.9;
      p.obj.visible = k > 0.001;
      p.obj.scale.copy(p.scale).multiplyScalar(Math.max(0.001, 0.4 + 0.6 * k));
      p.obj.position.copy(p.base); p.obj.position.y += drop;
      if (p.kids) for (const kd of p.kids) kd.visible = k > 0.5;
    }
    // ext bar + highlight appear with the stick
    extBar.visible = t >= tb + 8 * gap;
    irisHL.visible = t >= tb + 4 * gap;
  }
  return { root, setState, M, bucket, scoopJ, turret, head, partsCount: maxOrder, scoopWorld: () => { const v = new THREE.Vector3(0, -0.1, 0.12); return bucket.localToWorld(v); } };
}

// neat dust piles (smooth mounds), grown by the machine
export function createPiles(scene, regMat, spots) {
  const profile = [];
  for (let i = 0; i <= 24; i++) { const u = i / 24; profile.push(new THREE.Vector2(u * 1.0, Math.pow(1 - u * u, 1.6) * 1.0)); }
  const geo = new THREE.LatheGeometry(profile.reverse(), 48);
  const piles = spots.map((sp) => {
    const m = new THREE.Mesh(geo, regMat);
    m.position.set(sp.x, sp.y, sp.z);
    m.castShadow = true; m.receiveShadow = true;
    m.visible = false;
    scene.add(m);
    return { m, sp };
  });
  return {
    piles,
    set(i, amount) {
      const p = piles[i];
      const a = Math.max(0, amount);
      p.m.visible = a > 0.01;
      p.m.scale.set(p.sp.r * Math.pow(a, 0.4), p.sp.h * a + 0.001, p.sp.r * Math.pow(a, 0.4));
    },
  };
}
