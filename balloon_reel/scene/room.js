// Balloon reel: the SEMIGENIUS-style beige living room (clean, bright, warm) + props: the pink balloon (soft / hot /
// hard / melted hole / tape), a pink hairdryer, a hand pump, a big orange leaf blower, a low-poly cat.
import * as THREE from 'three';
import { mat, tex, paint, canvas, rng, hexToRgb, clamp, lerp, hash1 } from './lib.js';
import { glowSprite } from './sets.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const M = (geo, material, { cast = true, receive = true, name } = {}) => {
  const m = new THREE.Mesh(geo, material); m.castShadow = cast; m.receiveShadow = receive; if (name) m.name = name; return m;
};
const add = (parent, m, x = 0, y = 0, z = 0) => { m.position.set(x, y, z); parent.add(m); return m; };
const boxG = (w, h, d) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
const grp = (parent, x = 0, y = 0, z = 0, ry = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g); return g; };
const ctex = (w, h, draw, rep = [1, 1]) => { const c = canvas(w, h), g = c.getContext('2d'); draw(g, w, h); return tex(c, { repeat: rep, nearest: false }); };
const noisy = (hex, amount = 8, seed = 3, rep = [1, 1]) => { const b = hexToRgb(hex), R = rng(seed); return tex(paint(32, 32, () => { const d = (R() - 0.5) * amount; return [b[0] + d, b[1] + d, b[2] + d]; }), { repeat: rep }); };

export function roomLights(W, { at = [0, 1, 0], size = 5 } = {}) {
  const L = {};
  L.hemi = new THREE.HemisphereLight(0xfff6ea, 0xb8a084, 1.2); W.scene.add(L.hemi);
  L.key = new THREE.DirectionalLight(0xfff0dc, 1.7); L.key.castShadow = true; L.key.shadow.mapSize.set(2048, 2048);
  L.key.shadow.bias = -0.0005; L.key.shadow.normalBias = 0.03; L.key.shadow.radius = 5;
  const t = V(...at); L.key.position.copy(t).add(V(3, 7, 6)); L.key.target.position.copy(t);
  Object.assign(L.key.shadow.camera, { left: -size, right: size, top: size, bottom: -size, near: 0.5, far: 40 }); L.key.shadow.camera.updateProjectionMatrix();
  W.scene.add(L.key); W.scene.add(L.key.target);
  W.scene.background = new THREE.Color('#e8d6b0'); W.lights = L;
  return L;
}

// the room: floor x -4..4, z -4..4; back wall z = -3, side walls x = +-4; the window on the back wall (night outside)
export function buildRoom(W) {
  const g = grp(W.scene); const R = { g };
  const planks = ctex(128, 128, (c) => { c.fillStyle = '#c48a54'; c.fillRect(0, 0, 128, 128); const r = rng(5); for (let i = 0; i < 8; i++) { c.fillStyle = 'rgba(90,50,20,0.25)'; c.fillRect(0, i * 16, 128, 2); for (let k = 0; k < 3; k++) c.fillRect(Math.floor(r() * 128), i * 16, 2, 16); c.fillStyle = `rgba(255,255,255,${0.03 + r() * 0.05})`; c.fillRect(0, i * 16 + 2, 128, 14); } }, [4, 4]);
  add(g, M(new THREE.PlaneGeometry(10, 10).rotateX(-Math.PI / 2), mat(planks, { rough: 0.8 }), { cast: false }), 0, 0, 0.5);
  const wall = mat(noisy('#ead8b2', 5, 7, [6, 3]), { rough: 0.95 });
  add(g, M(new THREE.PlaneGeometry(10, 4), wall, { cast: false }), 0, 2, -3);
  for (const sx of [-1, 1]) { const p = add(g, M(new THREE.PlaneGeometry(9, 4), wall, { cast: false }), sx * 4, 2, 0.5); p.rotation.y = -sx * Math.PI / 2; }
  add(g, M(new THREE.PlaneGeometry(10, 9).rotateX(Math.PI / 2), mat('#f8f2e6'), { cast: false }), 0, 4, 0.5);
  add(g, M(new THREE.BoxGeometry(10, 0.12, 0.04), mat('#fbf6ec')), 0, 0.06, -2.98);                                         // baseboard
  // the window (night outside: dark blue + a moon)
  R.win = grp(g, 1.6, 1.9, -2.98);
  add(R.win, M(new THREE.PlaneGeometry(1.4, 1.3), mat('#1c2a5e', { emissive: '#1c2a5e', emissiveIntensity: 0.7 }), { cast: false }), 0, 0, 0.005);
  add(R.win, M(new THREE.CircleGeometry(0.12, 16), new THREE.MeshBasicMaterial({ color: '#fff6d8' }), { cast: false }), 0.35, 0.3, 0.01);
  for (const [w, h, x, y] of [[1.52, 0.08, 0, 0.65], [1.52, 0.08, 0, -0.65], [0.08, 1.3, -0.7, 0], [0.08, 1.3, 0.7, 0], [0.05, 1.3, 0, 0], [1.4, 0.05, 0, 0]]) add(R.win, M(new THREE.BoxGeometry(w, h, 0.06), mat('#fbf8f0')), x, y, 0.03);
  // a green sofa, a lamp, a picture, a plant, a rug, a little side table
  const sofa = grp(g, -2.2, 0, -2.4); const sm = mat('#6aae5a', { rough: 0.9 }), sd = mat('#5a964c');
  add(sofa, M(boxG(2.0, 0.42, 0.85), sm)); add(sofa, M(boxG(2.0, 0.55, 0.22), sd), 0, 0.42, -0.32); for (const sx of [-1, 1]) add(sofa, M(boxG(0.22, 0.62, 0.85), sd), sx * 1.0, 0, 0);
  add(g, M(boxG(0.06, 1.5, 0.06), mat('#3a3028')), 0.4, 0, -2.6); add(g, M(new THREE.CylinderGeometry(0.16, 0.28, 0.32, 10).translate(0, -0.16, 0), mat('#fff2d0', { emissive: '#ffd890', emissiveIntensity: 0.6 })), 0.4, 1.75, -2.6);
  add(g, M(new THREE.BoxGeometry(0.98, 0.68, 0.03), mat('#ffffff')), -2.2, 2.0, -2.985); add(g, M(new THREE.PlaneGeometry(0.9, 0.6), mat('#f29ab4')), -2.2, 2.0, -2.97);
  const pot = grp(g, 3.2, 0, -2.4); add(pot, M(new THREE.CylinderGeometry(0.2, 0.15, 0.4, 8).translate(0, 0.2, 0), mat('#c86a3a'))); for (let i = 0; i < 4; i++) add(pot, M(new THREE.IcosahedronGeometry(0.28, 0), mat(['#3a8a3a', '#4a9a44'][i % 2])), (i % 2 - 0.5) * 0.2, 0.6 + i * 0.12, ((i >> 1) - 0.5) * 0.2);
  add(g, M(new THREE.CylinderGeometry(1.4, 1.4, 0.015, 24), mat('#e8a05a', { rough: 1 }), { cast: false }), 0, 0.008, 0.2);
  add(g, M(boxG(0.5, 0.5, 0.5), mat('#b8743a')), 2.6, 0, -2.5); R.vase = add(g, M(new THREE.CylinderGeometry(0.07, 0.1, 0.3, 8).translate(0, 0.15, 0), mat('#4a8ad8')), 2.6, 0.5, -2.5);
  return R;
}

// ------------------------------------------------------------------ the pink balloon
// state: r (radius), soft 0..1 (droops + wobbles), hot 0..1 (glows red), hole 0..1 (melted spot), tape (an X of tape)
export function balloon(parent) {
  const g = new THREE.Group(); parent.add(g);
  const geo = new THREE.IcosahedronGeometry(1, 3); const base = Float32Array.from(geo.attributes.position.array);
  const m = mat('#f472b6', { rough: 0.35, emissive: '#ff2a00', emissiveIntensity: 0 });
  const body = add(g, M(geo, m)); m.flatShading = false; m.needsUpdate = true;
  const knot = add(g, M(new THREE.ConeGeometry(0.035, 0.07, 8).rotateX(Math.PI), mat('#e05aa0')));
  const neck = add(g, M(new THREE.CylinderGeometry(0.015, 0.03, 0.12, 8), mat('#f472b6', { rough: 0.35 })));
  const hole = add(g, M(new THREE.CircleGeometry(1, 12), mat('#3a1020', { rough: 1 }), { cast: false }));
  const tape = new THREE.Group(); g.add(tape); const tm = mat('#a8acb4', { rough: 0.6 });
  add(tape, M(new THREE.BoxGeometry(0.42, 0.11, 0.012), tm)).rotation.z = 0.7; add(tape, M(new THREE.BoxGeometry(0.42, 0.11, 0.012), tm)).rotation.z = -0.7;
  g.userData = { body, knot, neck, hole, tape, m, set(st, t = 0) {
    const r = st.r ?? 0.3, soft = st.soft ?? 0, p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = base[i * 3], y = base[i * 3 + 1], z = base[i * 3 + 2];
      const droop = soft * (0.35 + 0.15 * Math.sin(t * 6 + x * 3));                    // a soft balloon sags into a teardrop
      const k = 1 + y * 0.15;                                                              // a little pear shape (wider at the top)
      x *= k * (1 + soft * 0.15); z *= k * (1 + soft * 0.15); y = y * (1 - droop * 0.5) - droop * 0.3 * (1 - y * y);
      x += Math.sin(t * 9 + y * 4) * 0.03 * soft;
      p.setXYZ(i, x * r, (y + 1) * r, z * r);                                              // the knot end at the origin (bottom)
    }
    p.needsUpdate = true; geo.computeVertexNormals();
    knot.position.set(0, -0.02, 0); neck.position.set(0, -0.08, 0);
    m.emissiveIntensity = (st.hot ?? 0) * 0.9; m.color.set(st.hot > 0.5 ? '#ff5a8a' : '#f472b6');
    // the hole + the tape face a world direction (default: toward +z and a bit up, where his face is)
    const wd = V(...(st.holeDir || [0, 0.45, 1])).normalize(), ld = wd.clone().applyQuaternion(g.getWorldQuaternion(new THREE.Quaternion()).invert()).normalize();
    const hp = V(0, r, 0).addScaledVector(ld, r * 1.02);
    hole.visible = (st.hole ?? 0) > 0.02; hole.scale.setScalar(Math.max(0.001, (st.hole ?? 0) * r * 0.22)); hole.position.copy(hp); hole.quaternion.setFromUnitVectors(V(0, 0, 1), ld);
    tape.visible = !!st.tape; tape.position.copy(V(0, r, 0).addScaledVector(ld, r * 1.04)); tape.quaternion.setFromUnitVectors(V(0, 0, 1), ld); tape.scale.setScalar(Math.max(0.25, r * 1.6));
  } };
  g.userData.set({ r: 0.3 });
  return g;
}

export function hairdryer(parent) {
  const g = new THREE.Group(); parent.add(g); const pink = mat('#f48ac8', { rough: 0.35 });
  add(g, M(new THREE.CylinderGeometry(0.06, 0.06, 0.22, 12).rotateZ(Math.PI / 2), pink), 0.03, 0.2, 0);
  add(g, M(new THREE.CylinderGeometry(0.04, 0.05, 0.06, 12).rotateZ(Math.PI / 2), mat('#3a3a40')), 0.16, 0.2, 0);
  add(g, M(new THREE.CylinderGeometry(0.03, 0.035, 0.2, 8).translate(0, 0.1, 0), pink), -0.02, 0, 0);
  g.userData.grip = { pos: [-0.02, 0.06, 0], axis: [0, 1, 0], up: [1, 0, 0] };
  g.userData.nozzle = V(0.2, 0.2, 0);
  return g;
}
export function handPump(parent) {
  const g = new THREE.Group(); parent.add(g);
  add(g, M(new THREE.CylinderGeometry(0.045, 0.045, 0.55, 10).translate(0, 0.275, 0), mat('#e83a3a', { rough: 0.4 })));
  add(g, M(new THREE.BoxGeometry(0.2, 0.03, 0.08), mat('#2a2a30')), 0, 0.02, 0);
  const rod = grp(g, 0, 0.55, 0); add(rod, M(new THREE.CylinderGeometry(0.01, 0.01, 0.3, 6).translate(0, 0.15, 0), mat('#c8ccd4', { metal: 0.8 })));
  add(rod, M(new THREE.CylinderGeometry(0.02, 0.02, 0.26, 8).rotateZ(Math.PI / 2), mat('#2a2a30')), 0, 0.3, 0);
  g.userData.rod = rod; g.userData.handle = (k) => { rod.position.y = 0.55 - 0.25 * k; };
  return g;
}
export function leafBlower(parent) {
  const g = new THREE.Group(); parent.add(g); const o = mat('#f07a1a', { rough: 0.5 }), k = mat('#2a2a30');
  add(g, M(new THREE.BoxGeometry(0.3, 0.3, 0.26), o), 0, 0, 0);
  add(g, M(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 12).rotateX(Math.PI / 2), k), 0, 0, 0.15);
  add(g, M(new THREE.CylinderGeometry(0.05, 0.065, 0.9, 10).rotateZ(Math.PI / 2).translate(0.55, -0.05, 0), o), 0, 0, 0);
  add(g, M(new THREE.TorusGeometry(0.07, 0.02, 6, 10, Math.PI).rotateY(Math.PI / 2), k), 0, 0.2, 0);
  g.userData.grip = { pos: [0, 0.26, 0], axis: [1, 0, 0], up: [0, 1, 0] };
  g.userData.nozzle = V(1.0, -0.05, 0);
  return g;
}
// a low-poly orange tabby cat (faces +z); g.userData.walk(t) animates the legs and tail
export function cat(parent) {
  const g = new THREE.Group(); parent.add(g);
  const fur = mat(ctex(64, 64, (c) => { c.fillStyle = '#f0a040'; c.fillRect(0, 0, 64, 64); c.fillStyle = '#c87420'; for (let i = 0; i < 6; i++) c.fillRect(0, 4 + i * 10, 64, 4); }), { rough: 0.9 });
  const white = mat('#fbf4e8');
  const body = add(g, M(new THREE.IcosahedronGeometry(0.16, 1).scale(0.8, 0.7, 1.4), fur), 0, 0.26, 0);
  const head = grp(g, 0, 0.42, 0.23); add(head, M(new THREE.IcosahedronGeometry(0.11, 1).scale(1.1, 0.95, 1), fur));
  for (const sx of [-1, 1]) { add(head, M(new THREE.ConeGeometry(0.04, 0.08, 4), fur), sx * 0.06, 0.1, -0.01); add(head, M(new THREE.SphereGeometry(0.018, 6, 5), mat('#2a2018')), sx * 0.045, 0.02, 0.1); }
  add(head, M(new THREE.SphereGeometry(0.035, 6, 5).scale(1.2, 0.8, 0.8), white), 0, -0.035, 0.09); add(head, M(new THREE.SphereGeometry(0.012, 5, 4), mat('#e86a8a')), 0, -0.01, 0.115);
  const legs = [[-0.07, 0.13], [0.07, 0.13], [-0.07, -0.15], [0.07, -0.15]].map(([x, z]) => { const l = grp(g, x, 0.2, z); add(l, M(new THREE.CylinderGeometry(0.028, 0.025, 0.2, 6).translate(0, -0.1, 0), fur)); add(l, M(new THREE.SphereGeometry(0.03, 6, 4), white), 0, -0.2, 0.01); return l; });
  const tail = grp(g, 0, 0.32, -0.2); add(tail, M(new THREE.CylinderGeometry(0.022, 0.03, 0.32, 6).translate(0, 0.16, 0), fur)); tail.rotation.x = -0.8;
  g.userData = { head, legs, tail, walk(t, run = 1) { legs.forEach((l, i) => { l.rotation.x = Math.sin(t * 12 * run + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * 0.6 * run; }); tail.rotation.z = Math.sin(t * 4) * 0.4; } };
  return g;
}
// streaks of air (a few thin translucent lines) from a point along a direction (hairdryer / leaf blower / the fart)
export function airStreaks(parent, n = 10, color = '#ffffff', opacity = 0.5) {
  const g = new THREE.Group(); parent.add(g); const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
  for (let i = 0; i < n; i++) g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.3, 4).rotateZ(Math.PI / 2), m));
  g.userData.mat = m;
  g.userData.blow = (from, dir, t, len = 0.6, spread = 0.12) => { const d = dir.clone().normalize(); const q = new THREE.Quaternion().setFromUnitVectors(V(1, 0, 0), d);
    g.children.forEach((s, i) => { const k = ((t * 3 + hash1(i * 3.1)) % 1); const off = V(0, (hash1(i * 1.7) - 0.5) * spread, (hash1(i * 2.3) - 0.5) * spread).applyQuaternion(q); s.position.copy(from).addScaledVector(d, k * len).add(off); s.quaternion.copy(q); s.scale.set(1, 1, 1); }); };
  return g;
}
export { glowSprite };
