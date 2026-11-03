// Hand props for the dubai aunty reel: Mom's MUG (coffee) + TISSUE box, Aunty's TEACUP, her SHOPPING BAGS, Grandpa's CANE,
// the WILL (paper with a list of names; k = how far the red line crossing out "YOU" has been drawn) and the red PEN.
//   prop.p = { visible, pos:[x,y,z], rot:[x,y,z] (Euler YXZ) | quat, k, scale }   (reset every frame)
import * as THREE from 'three';
import { paint, tex, hash1 } from './lib.js';
import { signCanvas } from './set_tex2.js';

function willCanvas() {
  const c = document.createElement('canvas'); c.width = 192; c.height = 256;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  g.fillStyle = '#f6f0dc'; g.fillRect(0, 0, 192, 256);
  g.strokeStyle = '#c8b890'; g.lineWidth = 2; g.strokeRect(6, 6, 180, 244);
  g.fillStyle = '#1a1a2a'; g.textAlign = 'center'; g.font = '700 34px "Pixelify Sans", sans-serif'; g.fillText('MY WILL', 96, 46);
  g.font = '700 18px "Pixelify Sans", sans-serif'; g.textAlign = 'left';
  const rows = [['Gold', 'Mom'], ['Villa', 'Grandpa'], ['Cat', 'Neighbor'], ['$$$', 'YOU']];
  rows.forEach(([a, b], i) => { g.fillStyle = '#1a1a2a'; g.fillText(`${a} - ${b}`, 22, 96 + i * 36); });
  g.fillStyle = '#9a8a6a'; for (let i = 0; i < 3; i++) g.fillRect(22, 230 - i * 8, 120 - i * 30, 2);
  return c;
}

export function buildHandheld(world) {
  const group = new THREE.Group(); group.name = 'handheld'; world.scene.add(group);
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.6, ...o });
  // coffee mug (big, yellow with a heart)
  const mug = new THREE.Group(); mug.name = 'mug';
  { const m = std({ color: '#f2c84a', roughness: 0.35 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.044, 0.11, 16), m); mug.add(body);
    const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.044, 16), std({ color: '#5a3010', roughness: 0.2 })); coffee.rotation.x = -Math.PI / 2; coffee.position.y = 0.048; mug.add(coffee);
    const hd = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.009, 6, 12), m); hd.position.set(0.055, 0, 0); mug.add(hd);
    const heart = new THREE.Mesh(new THREE.CircleGeometry(0.016, 4), std({ color: '#e84a6a' })); heart.position.set(0, 0.005, 0.049); heart.rotation.z = Math.PI / 4; mug.add(heart);
    mug.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    mug.userData.grip = { pos: [0.06, 0, 0], axis: [0, 1, 0], up: [1, 0, 0] }; }
  // tissue box (pastel) with a tissue sticking out
  const tissues = new THREE.Group(); tissues.name = 'tissues';
  { const b = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.08, 0.13), std({ map: tex(paint(8, 8, (x, y) => ((x + y) % 4 < 2 ? [170, 210, 240] : [240, 240, 250])) ) }));
    tissues.add(b);
    const t = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.07, 5), std({ color: '#ffffff', roughness: 0.95 })); t.position.y = 0.07; t.rotation.z = 0.2; tissues.add(t);
    tissues.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    tissues.userData.grip = { pos: [0, -0.045, 0], axis: [1, 0, 0], up: [0, 1, 0] }; }
  // teacup + saucer
  const cup = new THREE.Group(); cup.name = 'cup';
  { const china = std({ color: '#fbf8f2', roughness: 0.25 });
    const sau = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.012, 16), china); cup.add(sau);
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.06, 14), china); c.position.y = 0.036; cup.add(c);
    const tea = new THREE.Mesh(new THREE.CircleGeometry(0.04, 14), std({ color: '#a8642a', roughness: 0.3 })); tea.rotation.x = -Math.PI / 2; tea.position.y = 0.065; cup.add(tea);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.004, 4, 16), std({ color: '#e8c040', metalness: 0.8, roughness: 0.2 })); rim.rotation.x = Math.PI / 2; rim.position.y = 0.066; cup.add(rim);
    cup.userData.grip = { pos: [0, -0.01, 0], axis: [1, 0, 0], up: [0, 1, 0] }; }
  // three shopping bags (gold, pink, black) - carried together by their handles
  const bags = new THREE.Group(); bags.name = 'bags';
  { [['#e8c040', -0.1, 0.0], ['#ff6aa8', 0.06, 0.04], ['#1a1a1e', 0.2, -0.02]].forEach(([c, x, z], i) => {
      const m = std({ color: c, roughness: 0.35, metalness: i === 0 ? 0.5 : 0 });
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.28, 0.1), m); b.position.set(x, -0.2, z); b.rotation.y = (i - 1) * 0.2; bags.add(b);
      const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.06), std({ color: i === 2 ? '#e8c040' : '#ffffff' })); logo.position.set(x, -0.18, z + 0.051); logo.rotation.y = (i - 1) * 0.2; bags.add(logo);
      const h = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.006, 4, 10, Math.PI), m); h.position.set(x, -0.06, z); h.rotation.y = (i - 1) * 0.2; bags.add(h);
    });
    bags.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    bags.userData.grip = { pos: [0.05, -0.03, 0], axis: [1, 0, 0], up: [0, 0, 1] }; }
  // walking cane
  const cane = new THREE.Group(); cane.name = 'cane';
  { const wm = std({ color: '#5a3a1e', roughness: 0.5 });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.88, 8), wm); shaft.position.y = -0.44; cane.add(shaft);
    const crook = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 12, Math.PI), wm); crook.position.set(0.05, 0, 0); cane.add(crook);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.03, 8), std({ color: '#1a1a1a' })); tip.position.y = -0.88; cane.add(tip);
    cane.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    cane.userData.grip = { pos: [0.0, 0.0, 0], axis: [0, 0, 1], up: [0, 1, 0] }; }
  // the will (paper lying on the table, faces +Y) + the red line through "YOU"
  const will = new THREE.Group(); will.name = 'will';
  { const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.28), std({ map: tex(willCanvas(), { nearest: true }), roughness: 0.9, side: THREE.DoubleSide }));
    paper.rotation.x = -Math.PI / 2; paper.receiveShadow = true; will.add(paper);
    const line = new THREE.Mesh(new THREE.BoxGeometry(1, 0.002, 0.006), std({ color: '#e01020', emissive: '#600008', emissiveIntensity: 0.6 }));
    line.position.set(-0.055, 0.002, 0.0 + (96 + 3 * 36 - 128 - 6) / 256 * 0.28); will.add(line); will.userData.line = line;
    will.userData.lineX0 = -0.065; will.userData.lineLen = 0.13; }
  // red pen
  const pen = new THREE.Group(); pen.name = 'pen';
  { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.13, 8), std({ color: '#d81c2c', roughness: 0.3 })); b.position.y = 0.065; pen.add(b);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.006, 0.02, 8), std({ color: '#f2f2f2' })); tip.rotation.x = Math.PI; tip.position.y = -0.01; pen.add(tip);
    pen.userData.grip = { pos: [0, 0.03, 0], axis: [0, 1, 0], up: [0, 0, 1] }; }
  group.add(mug, tissues, cup, bags, cane, will, pen);
  void signCanvas; void hash1;
  const items = { mug, tissues, cup, bags, cane, will, pen };
  const def = () => ({ visible: false, pos: [0, 0, 0], rot: [0, 0, 0], quat: null, k: 0, scale: 1 });
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
    commit() {
      const L = will.userData.line, k = Math.max(0.001, will.p.k || 0);
      L.scale.x = will.userData.lineLen * k; L.position.x = will.userData.lineX0 + will.userData.lineLen * k / 2; L.visible = (will.p.k || 0) > 0.001;
      api.place();
    },
  };
  return api;
}
