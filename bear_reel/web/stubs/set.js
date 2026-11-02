// STUB set: same layout numbers + same API as the real set.js, simple shapes. Used when ?use= excludes 'set'.
import * as THREE from 'three';
import { mat, matNoisy, cyl, lowSphere, mesh, v3 } from '../lib.js';
import { HIDE_TREE, HIDE_BUSH, LEAF_BUSH, GIANT_LEAF, TENT, BRANCH, FORE_BRANCH, SUN, SKY } from '../layout.js';

export function buildSet(world) {
  const g = new THREE.Group(); world.scene.add(g);
  world.scene.background = new THREE.Color(SKY.mid);
  world.scene.fog = new THREE.Fog(SKY.horizon, 30, 160);
  const ground = mesh(new THREE.PlaneGeometry(300, 300), matNoisy('#4d6b2f')); ground.rotation.x = -Math.PI / 2; g.add(ground);
  const pine = (x, z, h = 12, r = 0.3) => {
    const t = new THREE.Group(); t.position.set(x, 0, z);
    t.add(cyl(r * 0.6, r, h, 6, matNoisy('#5a3a22')));
    for (let i = 0; i < 4; i++) { const c = mesh(new THREE.ConeGeometry(h * 0.22 - i * 0.4, h * 0.3, 7), matNoisy('#2f5a2a')); c.position.y = h * 0.35 + i * h * 0.15; t.add(c); }
    g.add(t); return t;
  };
  const hideTree = pine(HIDE_TREE.pos[0], HIDE_TREE.pos[1], HIDE_TREE.height, HIDE_TREE.trunkR);
  for (let i = 0; i < 60; i++) { const a = i * 2.4, r = 6 + (i % 7) * 4; pine(Math.cos(a) * r, Math.sin(a) * r + 6, 10 + (i % 5) * 1.5); }
  const bush = (p, r, h) => { const b = mesh(lowSphere(r, h / 2, r, 8, 6), matNoisy('#3f6e2c')); b.position.set(p[0], h / 2, p[1]); g.add(b); return b; };
  const hideBush = bush(HIDE_BUSH.pos, HIDE_BUSH.r, HIDE_BUSH.h);
  const leafBush = bush(LEAF_BUSH.pos, LEAF_BUSH.r, LEAF_BUSH.h);
  const giantLeaf = new THREE.Group(); giantLeaf.position.set(...GIANT_LEAF.stem); g.add(giantLeaf);
  const blade = mesh(new THREE.PlaneGeometry(GIANT_LEAF.w, GIANT_LEAF.len), mat('#5c9a33', { side: THREE.DoubleSide })); blade.position.y = GIANT_LEAF.len / 2; giantLeaf.add(blade);
  giantLeaf.userData.grip = { pos: [0.08, GIANT_LEAF.len * 0.8, 0], axis: [0, 1, 0], up: [0, 0, 1] };
  const tent = mesh(new THREE.ConeGeometry(TENT.size * 0.6, TENT.size * 0.6, 4), matNoisy('#e2711d')); tent.position.set(TENT.pos[0], TENT.size * 0.3, TENT.pos[1]); g.add(tent);
  const branch = new THREE.Group(); branch.position.set(BRANCH.pos[0], 0.04, BRANCH.pos[1]); g.add(branch);
  const halves = [0, 1].map((i) => { const h = mesh(new THREE.CylinderGeometry(0.025, 0.03, BRANCH.len / 2, 5), matNoisy('#7a5a3a')); h.rotation.z = Math.PI / 2; h.position.x = (i - 0.5) * BRANCH.len / 2; branch.add(h); return h; });
  branch.userData.halves = halves;
  const foreBranch = new THREE.Group(); foreBranch.position.set(...FORE_BRANCH.pos); g.add(foreBranch);
  const fb = mesh(new THREE.CylinderGeometry(0.04, 0.07, 3, 6), matNoisy('#5a3a22')); fb.rotation.z = Math.PI / 2; fb.position.x = 1.5; foreBranch.add(fb);
  foreBranch.userData.path = (u) => v3(FORE_BRANCH.pos).add(v3(FORE_BRANCH.dir).normalize().multiplyScalar(u * 3)).add(v3(0, 0.06, 0));
  const tpTube = mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.1, 10, 1, true), mat('#b88b5a', { side: THREE.DoubleSide })); g.add(tpTube); tpTube.visible = false;
  tpTube.userData.grip = { pos: [0, 0, 0], axis: [0, 1, 0], up: [0, 0, 1] };
  const sunDir = v3(SUN.dir).normalize();
  const sun = new THREE.DirectionalLight(SUN.color, SUN.intensity); sun.position.copy(sunDir.clone().multiplyScalar(40)); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 100 }); g.add(sun); g.add(sun.target);
  const hemi = new THREE.HemisphereLight('#ffd2b0', '#33402a', 1.0); g.add(hemi);
  const fill = new THREE.DirectionalLight('#ffe8d8', 0); g.add(fill); g.add(fill.target);
  const props = { hideTree, hideBush, leafBush, giantLeaf, tent, branch, foreBranch, tpTube, sun, hemi, fill };
  const defaults = () => ({ fog: { color: SKY.horizon, near: 30, far: 160 }, shadow: { center: [0, 1, 2], radius: 10 }, fill: { dir: [0, 0.3, 1], intensity: 0, color: '#ffe8d8' },
    exposure: 1, sunIntensity: 1, skyDark: 0, rays: 0.5, bushShake: 0, branchSnap: 0, leafTorn: false, tentVisible: true });
  const set = { group: g, colliders: [], props, anchors: {}, state: defaults(),
    reset() { set.state = defaults(); },
    commit(ctx) {
      const s = set.state;
      world.scene.fog.color.set(s.fog.color); world.scene.fog.near = s.fog.near; world.scene.fog.far = s.fog.far;
      halves[0].rotation.y = s.branchSnap * 0.5; halves[1].rotation.y = -s.branchSnap * 0.5;
      world.renderer.toneMappingExposure = s.exposure;
      fill.intensity = s.fill.intensity; fill.position.copy(v3(s.fill.dir).normalize().multiplyScalar(20)).add(v3(s.shadow.center)); fill.target.position.set(...s.shadow.center);
      sun.target.position.set(...s.shadow.center); sun.position.copy(sunDir.clone().multiplyScalar(40)).add(v3(s.shadow.center));
    } };
  return set;
}
