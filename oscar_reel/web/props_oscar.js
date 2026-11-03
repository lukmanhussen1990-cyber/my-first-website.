// Hand props for the oscar reel: the golden award STATUE, the conductor's BATON + STOPWATCH, a VIOLIN (+ bow), a TRUMPET,
// a CELLO (+ bow), Grandma's POPCORN bowl, the director's HANKY, Mom's TISSUE.  prop.p = { visible, pos, rot (YXZ) | quat, scale }
import * as THREE from 'three';
import { hash1 } from './lib.js';

export function buildHandheld(world) {
  const group = new THREE.Group(); group.name = 'handheld'; world.scene.add(group);
  const env = world.set && world.set.env;
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.6, ...o });
  const goldM = new THREE.MeshStandardMaterial({ color: '#ffd060', metalness: 0.95, roughness: 0.18, envMap: env, envMapIntensity: 1.6, emissive: '#5a3a00', emissiveIntensity: 0.35 });
  const woodM = std({ color: '#6a2a0e', roughness: 0.35 });
  const mk = (name, grip) => { const g = new THREE.Group(); g.name = name; g.userData.grip = grip; group.add(g); return g; };
  const sh = (g) => g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  // the award statue: black base + a stylised golden figure (generic, arms crossed over a sword-less chest)
  const statue = mk('statue', { pos: [0, 0.06, 0], axis: [0, 1, 0], up: [0, 0, 1] });
  { const base = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.07, 12), std({ color: '#141416', roughness: 0.3 })); base.position.y = -0.035; statue.add(base);
    const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.12, 8), goldM); legs.position.y = 0.06; statue.add(legs);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.02, 0.12, 8), goldM); body.position.y = 0.18; statue.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), goldM); head.position.y = 0.265; statue.add(head);
    const armsM = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.008, 6, 10, Math.PI), goldM); armsM.position.set(0, 0.19, 0.012); armsM.rotation.set(0, 0, Math.PI); statue.add(armsM); sh(statue); }
  const baton = mk('baton', { pos: [0, 0, 0], axis: [0, 1, 0], up: [0, 0, 1] });
  { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.42, 6), std({ color: '#f4f2ea' })); b.position.y = 0.2; baton.add(b);
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), std({ color: '#3a2414' })); baton.add(h); sh(baton); }
  const stopwatch = mk('stopwatch', { pos: [0, -0.058, 0], axis: [1, 0, 0], up: [0, -1, 0] });
  { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.015, 18), std({ color: '#c8ccd2', metalness: 0.8, roughness: 0.25 })); c.rotation.x = Math.PI / 2; stopwatch.add(c);
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.034, 18), std({ color: '#fbfbf6' })); face.position.z = 0.008; stopwatch.add(face);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.028, 0.002), std({ color: '#d01020' })); hand.geometry.translate(0, 0.012, 0); hand.position.z = 0.01; stopwatch.add(hand); stopwatch.userData.hand = hand;
    const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.014, 8), std({ color: '#c8ccd2', metalness: 0.8 })); btn.position.y = 0.047; stopwatch.add(btn); sh(stopwatch); }
  const violin = mk('violin', { pos: [0, 0, 0.24], axis: [0, 0, 1], up: [0, 1, 0] });
  { const b = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), woodM); b.scale.set(0.085, 0.03, 0.15); violin.add(b);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.015, 0.2), std({ color: '#1a1410' })); neck.position.z = 0.22; violin.add(neck);
    const scroll = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), woodM); scroll.position.z = 0.33; violin.add(scroll); sh(violin); }
  const bow = mk('bow', { pos: [0, 0, 0], axis: [0, 0, 1], up: [0, 1, 0] });
  { const b = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.006, 0.6), std({ color: '#3a2414' })); b.position.z = 0.28; bow.add(b); sh(bow); }
  const bow2 = mk('bow2', { pos: [0, 0, 0], axis: [0, 0, 1], up: [0, 1, 0] });
  { const b = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.007, 0.7), std({ color: '#3a2414' })); b.position.z = 0.33; bow2.add(b); sh(bow2); }
  const trumpet = mk('trumpet', { pos: [0, -0.03, 0.1], axis: [0, 0, 1], up: [0, 1, 0] });
  { const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.36, 8), goldM); tube.rotation.x = Math.PI / 2; tube.position.z = 0.12; trumpet.add(tube);
    const bell = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 14, 1, true), goldM); bell.rotation.x = -Math.PI / 2; bell.position.z = 0.34; trumpet.add(bell);
    const valves = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.07), goldM); valves.position.set(0, 0.03, 0.08); trumpet.add(valves);
    const mp = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.006, 0.04, 8), goldM); mp.rotation.x = Math.PI / 2; mp.position.z = -0.07; trumpet.add(mp); sh(trumpet); }
  const cello = mk('cello', { pos: [0, 0.95, -0.02], axis: [0, 1, 0], up: [0, 0, -1] });
  { const b = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), woodM); b.scale.set(0.2, 0.2, 0.09); b.position.y = 0.24; cello.add(b);
    const b2 = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), woodM); b2.scale.set(0.16, 0.17, 0.085); b2.position.y = 0.52; cello.add(b2);
    const wst = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.16), woodM); wst.position.y = 0.39; cello.add(wst);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 0.03), std({ color: '#1a1410' })); neck.position.y = 0.92; cello.add(neck);
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.2, 6), std({ color: '#c8ccd2', metalness: 0.8 })); pin.position.y = -0.08; cello.add(pin); sh(cello); }
  const popcorn = mk('popcorn', { pos: [0.12, -0.02, 0], axis: [0, 0, 1], up: [0, 1, 0] });
  { const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.08, 0.1, 14, 1, true), std({ color: '#d82a2a', side: THREE.DoubleSide })); popcorn.add(bowl);
    const pm = std({ color: '#fff4cc', roughness: 0.9 });
    for (let i = 0; i < 22; i++) { const k = new THREE.Mesh(new THREE.IcosahedronGeometry(0.018, 0), pm); k.position.set((hash1(i) - 0.5) * 0.18, 0.05 + hash1(i * 3) * 0.04, (hash1(i * 7) - 0.5) * 0.18); popcorn.add(k); } sh(popcorn); }
  const hanky = mk('hanky', { pos: [0, -0.04, 0], axis: [1, 0, 0], up: [0, 0, 1] });
  { const g = new THREE.PlaneGeometry(0.16, 0.16, 4, 4); const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, (hash1(i * 3.3) - 0.5) * 0.02); g.computeVertexNormals();
    const m = new THREE.Mesh(g, std({ color: '#f6f6f2', roughness: 0.95, side: THREE.DoubleSide })); hanky.add(m); }
  const tissue = mk('tissue', { pos: [0, -0.03, 0], axis: [1, 0, 0], up: [0, 0, 1] });
  { const g = new THREE.PlaneGeometry(0.11, 0.11, 3, 3); const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, (hash1(i * 5.1) - 0.5) * 0.025); g.computeVertexNormals();
    tissue.add(new THREE.Mesh(g, std({ color: '#ffffff', roughness: 0.95, side: THREE.DoubleSide }))); }
  const items = { statue, baton, stopwatch, violin, bow, bow2, trumpet, cello, popcorn, hanky, tissue };
  const def = () => ({ visible: false, pos: [0, 0, 0], rot: [0, 0, 0], quat: null, scale: 1, k: 0 });
  for (const it of Object.values(items)) it.p = def();
  const api = {
    group, ...items, items,
    reset() { for (const it of Object.values(items)) { it.p = def(); it.visible = false; } },
    place() {
      for (const it of Object.values(items)) {
        const p = it.p; it.visible = p.visible;
        if (!p.visible) continue;
        it.position.set(...p.pos);
        if (p.quat) it.quaternion.copy(p.quat); else it.rotation.set(p.rot[0], p.rot[1], p.rot[2], 'YXZ');
        it.scale.setScalar(p.scale);
        it.updateMatrixWorld(true);
      }
    },
    commit() { stopwatch.userData.hand.rotation.z = -(stopwatch.p.k || 0) * Math.PI * 2; api.place(); },
  };
  return api;
}
