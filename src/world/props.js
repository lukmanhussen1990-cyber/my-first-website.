// Props: ice axe, radios, tents, lanterns, flashlight, rescue tripod + winch + rope,
// logbook, silver blanket, snow bridge.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mulberry32, noise1 } from '../util.js';
import { createHeadlamp } from './headlamp.js';

function tmat(color, o = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.6, metalness: o.metal ?? 0 });
  if (o.emissive !== undefined) m.emissive = new THREE.Color(o.emissive);
  if (o.env) { m.envMap = o.env; m.envMapIntensity = o.envI ?? 1; }
  m.transparent = true;
  m.depthWrite = true;
  return m;
}

function radio(color = 0x2c2f35) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.13, 0.035, 2, 0.01), tmat(color, { rough: 0.5 }));
  g.add(body);
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.006, 0.09, 6), tmat(0x111111));
  ant.position.set(0.022, 0.1, 0);
  g.add(ant);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.045, 0.03), tmat(0x0d1a12, { emissive: 0x000000 }));
  screen.position.set(0, 0.03, 0.0181);
  g.add(screen);
  const ledMat = new THREE.MeshBasicMaterial({ color: 0xff3020, transparent: true });
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6), ledMat);
  led.position.set(-0.022, 0.056, 0.018);
  g.add(led);
  const ledLight = new THREE.PointLight(0xff3020, 0, 0.6, 2);
  ledLight.position.copy(led.position).add(new THREE.Vector3(0, 0, 0.03));
  g.add(ledLight);
  g.userData = { led, ledMat, ledLight, screen };
  return g;
}

function tent(color) {
  const g = new THREE.Group();
  const geo = new THREE.SphereGeometry(1.15, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    p.setX(i, p.getX(i) * 1.35);
    p.setY(i, p.getY(i) * 0.9);
  }
  geo.computeVertexNormals();
  const m = tmat(color, { rough: 0.7, emissive: 0x000000 });
  const shell = new THREE.Mesh(geo, m);
  g.add(shell);
  // poles (dark arcs)
  for (const a of [0.6, -0.6]) {
    const arc = new THREE.Mesh(new THREE.TorusGeometry(1.16, 0.018, 6, 30, Math.PI), tmat(0x222222));
    arc.rotation.y = a;
    arc.scale.set(1.35 * Math.cos(a) ** 2 + Math.sin(a) ** 2, 0.9, 1);
    g.add(arc);
  }
  const door = new THREE.Mesh(new THREE.CircleGeometry(0.42, 20, 0, Math.PI), tmat(0x3a1a08));
  door.position.set(0, 0.0, 1.13);
  g.add(door);
  g.userData = { shell, mat: m, geo, base: Float32Array.from(p.array) };
  return g;
}

function lantern() {
  const g = new THREE.Group();
  const metal = tmat(0x2a2a2a, { rough: 0.4, metal: 0.6 });
  const glassM = new THREE.MeshBasicMaterial({ color: 0xffc070, transparent: true });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.04, 12), metal);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.13, 12), glassM);
  glass.position.y = 0.085;
  const top = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.05, 12), metal);
  top.position.y = 0.17;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.005, 5, 12, Math.PI), metal);
  handle.position.y = 0.2;
  g.add(base, glass, top, handle);
  const light = new THREE.PointLight(0xffa850, 0, 9, 1.6);
  light.position.y = 0.09;
  g.add(light);
  g.userData = { light, glassM };
  return g;
}

function iceAxe() {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.015, 0.62, 8), tmat(0x2a59a8, { rough: 0.4 }));
  shaft.position.y = -0.31;
  const head = new THREE.Mesh(new RoundedBoxGeometry(0.26, 0.03, 0.02, 1, 0.006), tmat(0xb8bcc2, { rough: 0.3, metal: 0.8 }));
  head.position.y = 0.0;
  const spike = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.06, 6), tmat(0xb8bcc2, { rough: 0.3, metal: 0.8 }));
  spike.position.y = -0.64;
  spike.rotation.x = Math.PI;
  g.add(shaft, head, spike);
  return g;
}

function tripod() {
  const g = new THREE.Group();
  const steel = tmat(0x9aa3ad, { rough: 0.35, metal: 0.85 });
  const H = 2.6;
  const legs = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    const foot = new THREE.Vector3(Math.cos(a) * 1.5, 0, Math.sin(a) * 1.2);
    const top = new THREE.Vector3(0, H, 0);
    const len = foot.distanceTo(top);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, len, 8), steel);
    leg.position.copy(foot).add(top).multiplyScalar(0.5);
    leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(foot).normalize());
    g.add(leg);
    legs.push(foot);
  }
  const headBox = new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.14, 0.22, 2, 0.03), tmat(0xd8231f, { rough: 0.45 }));
  headBox.position.y = H;
  g.add(headBox);
  const pulley = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.02, 8, 16), steel);
  pulley.position.set(0, H - 0.15, 0);
  g.add(pulley);
  // winch on one leg
  const winch = new THREE.Group();
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.2, 14), tmat(0x333333, { rough: 0.4, metal: 0.6 }));
  drum.rotation.z = Math.PI / 2;
  const box = new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.2, 0.18, 2, 0.03), tmat(0xd8231f, { rough: 0.45 }));
  box.position.x = -0.2;
  winch.add(drum, box);
  const f0 = legs[0];
  winch.position.copy(f0).multiplyScalar(0.62).add(new THREE.Vector3(0, H * 0.38, 0));
  g.add(winch);
  g.userData = { H, drum, winch, pulleyY: H - 0.15 };
  return g;
}

function logbook() {
  const g = new THREE.Group();
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 700;
  const x = c.getContext('2d');
  x.fillStyle = '#d9cba6';
  x.fillRect(0, 0, 1024, 700);
  // age stains
  const r = mulberry32(31);
  for (let i = 0; i < 40; i++) {
    const gx = r() * 1024, gy = r() * 700, rr = 20 + r() * 120;
    const grd = x.createRadialGradient(gx, gy, 0, gx, gy, rr);
    grd.addColorStop(0, 'rgba(120,90,40,0.10)');
    grd.addColorStop(1, 'rgba(120,90,40,0)');
    x.fillStyle = grd;
    x.fillRect(0, 0, 1024, 700);
  }
  x.strokeStyle = 'rgba(70,60,50,0.35)';
  x.lineWidth = 2;
  for (let row = 0; row < 16; row++) {
    const y = 70 + row * 38;
    x.beginPath(); x.moveTo(30, y); x.lineTo(490, y); x.moveTo(534, y); x.lineTo(994, y); x.stroke();
  }
  x.strokeStyle = 'rgba(40,30,25,0.8)';
  for (let row = 0; row < 31; row++) {
    const page = row < 16 ? 0 : 1;
    const rr2 = row % 16;
    const y = 62 + rr2 * 38;
    const x0 = page ? 544 : 40;
    // year-ish digits and scribbled names (illegible on purpose)
    x.font = '24px serif';
    x.fillStyle = 'rgba(35,28,22,0.85)';
    x.fillText(String(1950 + Math.floor(row * 2.3 + r() * 2)), x0, y);
    x.lineWidth = 2.2;
    x.beginPath();
    let px = x0 + 80;
    x.moveTo(px, y - 6);
    for (let k = 0; k < 26; k++) {
      px += 6 + r() * 6;
      x.lineTo(px, y - 6 + Math.sin(k * 1.7 + r() * 3) * (5 + r() * 5));
    }
    x.stroke();
  }
  const texPage = new THREE.CanvasTexture(c);
  texPage.colorSpace = THREE.SRGBColorSpace;
  const pageM = tmat(0xffffff, { rough: 0.85 });
  pageM.map = texPage;
  const coverM = tmat(0x3b2a1c, { rough: 0.7 });
  const left = new THREE.Group(), right = new THREE.Group();
  const pw = 0.21, ph = 0.29;
  const lp = new THREE.Mesh(new THREE.BoxGeometry(pw, 0.012, ph), [coverM, coverM, pageM, coverM, coverM, coverM]);
  lp.position.x = -pw / 2;
  left.add(lp);
  const rp = new THREE.Mesh(new THREE.BoxGeometry(pw, 0.012, ph), [coverM, coverM, pageM, coverM, coverM, coverM]);
  rp.position.x = pw / 2;
  right.add(rp);
  // map the left half of the canvas to the left page, right half to the right page
  const uvL = lp.geometry.attributes.uv, uvR = rp.geometry.attributes.uv;
  for (let i = 8; i < 12; i++) { uvL.setX(i, uvL.getX(i) * 0.5); uvR.setX(i, 0.5 + uvR.getX(i) * 0.5); }
  g.add(left, right);
  g.userData = { left, right };
  return g;
}

function blanket(env) {
  // crinkled emergency foil wrapped around the shoulders
  const geo = new THREE.CylinderGeometry(0.3, 0.44, 0.9, 110, 36, true, -Math.PI * 0.92, Math.PI * 1.84);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = 1 + 0.035 * noise1(x * 60 + y * 23, 3) + 0.03 * noise1(z * 71 - y * 37, 8) + 0.05 * noise1(x * 9 + z * 7 + y * 3, 1);
    p.setXYZ(i, x * n, y + 0.012 * noise1(x * 47 + z * 53, 5), z * n);
  }
  geo.computeVertexNormals();
  const m = tmat(0xc9ced4, { rough: 0.32, metal: 1.0, env, envI: 0.55 });
  m.side = THREE.DoubleSide;
  m.flatShading = true;
  return new THREE.Mesh(geo, m);
}

function snowBridge() {
  // thin, slightly sagging slab of snow across the crack mouth
  const g = new THREE.Group();
  const m = tmat(0xe8f0f8, { rough: 0.95, emissive: 0x5a6878 });
  const pieces = [];
  const r = mulberry32(5);
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 3; j++) {
      const w = 0.5, d = 0.9;
      const geo = new RoundedBoxGeometry(w * (0.92 + r() * 0.1), 0.16, d * (0.9 + r() * 0.1), 1, 0.05);
      const mesh = new THREE.Mesh(geo, m);
      mesh.userData.home = new THREE.Vector3(-2.0 + i * 0.5 + 0.25, -0.12, -0.2 - j * 0.9);
      mesh.userData.spin = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(6);
      mesh.userData.delay = r() * 0.25;
      mesh.position.copy(mesh.userData.home);
      g.add(mesh);
      pieces.push(mesh);
    }
  }
  g.userData = { pieces };
  return g;
}

export function createProps(tex, env, envDay) {
  const group = new THREE.Group();
  const axe = iceAxe();
  const maxRadio = radio(0x2b2f36);
  const friendRadio = radio(0x1b1d22);
  const tents = [tent(0xff6a10), tent(0xff7a1c)];
  const lanterns = [lantern(), lantern()];
  const flash = new THREE.Group();
  const flashBody = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.026, 0.16, 10), tmat(0x222428, { rough: 0.4, metal: 0.5 }));
  flashBody.rotation.x = Math.PI / 2;
  flash.add(flashBody);
  const flashLamp = createHeadlamp(tex, { intensity: 30, angle: 0.16, len: 40, color: 0xeef4ff, distance: 120, seed: 3, dust: 200, dustSize: 40 });
  flashLamp.group.position.z = 0.08;
  flash.add(flashLamp.group);
  const trip = tripod();
  const ropeM = tmat(0xd8c26a, { rough: 0.7 });
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 6), ropeM);
  const rope2 = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1, 6), tmat(0xc23a2a, { rough: 0.7 }));
  const book = logbook();
  const blank = blanket(envDay || env);
  const bridge = snowBridge();
  // light from far above (rescuers' searchlight down the crack, scene 7)
  const searchLight = new THREE.SpotLight(0xe8f2ff, 0, 80, 0.22, 0.7, 0.6);
  const searchTarget = new THREE.Object3D();
  searchLight.target = searchTarget;
  group.add(axe, maxRadio, friendRadio, ...tents, ...lanterns, flash, trip, rope, rope2, book, blank, bridge, searchLight, searchTarget);
  const all = [axe, maxRadio, friendRadio, ...tents, ...lanterns, flash, trip, rope, rope2, book, blank, bridge];
  return {
    group, axe, maxRadio, friendRadio, tents, lanterns, flash, flashLamp, tripod: trip, rope, rope2, book, blanket: blank, bridge,
    searchLight, searchTarget, all,
  };
}

// stretch a unit cylinder between two points
export function setRope(mesh, a, b) {
  const d = b.clone().sub(a);
  const len = d.length();
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.scale.set(1, Math.max(len, 0.001), 1);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  mesh.visible = true;
}
