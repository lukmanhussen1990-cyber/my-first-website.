// The empty street outside: near sidewalk (z 5.25..8.5), wet road (8.5..19.5),
// far sidewalk (19.5..23) with ONE flickering sodium streetlight, closed shops beyond.
import * as THREE from 'three';
import { mesh, group, rbox, glowMaterial, makeCanvas, canvasTexture } from './util.js';
import * as TX from './textures.js';
import { addReflection } from './reflect.js';

export const STREET = {
  lampHead: new THREE.Vector3(-1.25, 5.85, 20.15),
  spotUnderLamp: new THREE.Vector3(-1.2, 0.15, 19.95),
  roadMiddle: new THREE.Vector3(-0.75, 0.0, 14.2),
};

export function buildStreet(scene, { floorRefl }) {
  const S = { lights: {}, refs: {} };
  const root = group(scene, { name: 'street' });
  S.root = root;

  // ---------- ground ----------
  const asph = TX.asphaltTextures();
  for (const t of [asph.map, asph.roughness]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(40 / 6, 11 / 6);
  }
  const roadMat = addReflection(
    new THREE.MeshStandardMaterial({ map: asph.map, roughnessMap: asph.roughness, roughness: 0.9, metalness: 0.0, envMapIntensity: 0.3 }),
    floorRefl,
    { strength: 1.4, blur: 1.2, fresnel: 0.12, roughBlur: 3.5, stretch: 0.012 }
  );
  const road = mesh(new THREE.PlaneGeometry(40, 11), roadMat, { rx: -Math.PI / 2, z: 14.0, cast: false, parent: root });
  road.name = 'road';
  S.road = road;
  // lane markings
  const paint = new THREE.MeshStandardMaterial({ color: 0xd9c67a, roughness: 0.6 });
  for (let x = -19; x < 20; x += 3) mesh(new THREE.PlaneGeometry(1.6, 0.12), paint, { rx: -Math.PI / 2, x, y: 0.003, z: 14.0, cast: false, parent: root });
  const white = new THREE.MeshStandardMaterial({ color: 0xc9cdd2, roughness: 0.7 });
  for (const z of [9.0, 19.0]) mesh(new THREE.PlaneGeometry(40, 0.1), white, { rx: -Math.PI / 2, y: 0.003, z, cast: false, parent: root });
  // manhole
  mesh(new THREE.CircleGeometry(0.35, 28), new THREE.MeshStandardMaterial({ color: 0x23262b, metalness: 0.7, roughness: 0.45 }), { rx: -Math.PI / 2, x: 2.6, y: 0.004, z: 12.0, cast: false, parent: root });

  const conc = TX.concreteTexture();
  conc.wrapS = conc.wrapT = THREE.RepeatWrapping;
  const walkMat = (w, d) => {
    const t = conc.clone();
    t.repeat.set(w / 1.5, d / 1.5);
    t.needsUpdate = true;
    return addReflection(new THREE.MeshStandardMaterial({ map: t, roughness: 0.7, envMapIntensity: 0.3 }), floorRefl, { strength: 0.6, blur: 2.0, fresnel: 0.06, roughBlur: 3 });
  };
  const nearWalk = mesh(new THREE.BoxGeometry(40, 0.15, 3.3), walkMat(40, 3.3), { y: 0.075, z: 6.85, parent: root });
  const farWalk = mesh(new THREE.BoxGeometry(40, 0.15, 3.6), walkMat(40, 3.6), { y: 0.075, z: 21.3, parent: root });
  nearWalk.receiveShadow = farWalk.receiveShadow = true;
  S.mirrorSurfaces = [road, nearWalk, farWalk];
  const curbMat = new THREE.MeshStandardMaterial({ color: 0x6d727a, roughness: 0.8 });
  mesh(new THREE.BoxGeometry(40, 0.16, 0.18), curbMat, { y: 0.08, z: 8.5, parent: root });
  mesh(new THREE.BoxGeometry(40, 0.16, 0.18), curbMat, { y: 0.08, z: 19.5, parent: root });

  // light spilling from the restaurant windows onto the sidewalk
  const [sc, sctx] = makeCanvas(64, 256);
  const sg = sctx.createLinearGradient(0, 0, 0, 256);
  sg.addColorStop(0, 'rgba(255,255,255,0.55)');
  sg.addColorStop(1, 'rgba(255,255,255,0)');
  sctx.fillStyle = sg;
  sctx.fillRect(0, 0, 64, 256);
  const spillTex = canvasTexture(sc, { mipmaps: false });
  const spillMat = new THREE.MeshBasicMaterial({ map: spillTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: new THREE.Color(0.55, 0.62, 0.66) });
  for (const [a, b] of [[-7, -4.7], [-4.7, -2.4], [-2.4, -0.1], [-0.1, 2.2], [2.25, 3.25], [3.3, 5.15], [5.15, 7]]) {
    const w = b - a - 0.1;
    const p = mesh(new THREE.PlaneGeometry(w, 2.6), spillMat, { rx: -Math.PI / 2, x: (a + b) / 2, y: 0.152, z: 5.25 + 1.3, cast: false, receive: false, parent: root });
    p.rotation.z = Math.PI;
  }

  // ---------- the streetlight ----------
  const L = STREET.lampHead;
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2e3238, metalness: 0.6, roughness: 0.5 });
  const pole = group(root, { x: L.x - 1.25, z: L.z + 0.05, name: 'streetlight' });
  mesh(new THREE.CylinderGeometry(0.07, 0.11, 6.0, 14), poleMat, { y: 3.0 + 0.15, parent: pole });
  mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.5, 14), poleMat, { y: 0.4, parent: pole });
  const arm = mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.3, 10), poleMat, { x: 0.62, y: 5.95, rz: Math.PI / 2 + 0.1, parent: pole });
  void arm;
  const head = group(root, { x: L.x, y: L.y + 0.12, z: L.z });
  mesh(rbox(0.62, 0.14, 0.3, 0.06), poleMat, { parent: head });
  const bulbMat = glowMaterial(0xff9a3d, 9);
  mesh(new THREE.PlaneGeometry(0.46, 0.2), bulbMat, { y: -0.075, rx: Math.PI / 2, parent: head, cast: false, receive: false });
  S.lampMat = bulbMat;
  S.lampBase = bulbMat.color.clone();
  // soft halo sprite around the lamp
  const [hc, hctx] = makeCanvas(256, 256);
  const hg = hctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  hg.addColorStop(0, 'rgba(255,190,120,0.9)');
  hg.addColorStop(0.2, 'rgba(255,150,70,0.35)');
  hg.addColorStop(1, 'rgba(255,120,40,0)');
  hctx.fillStyle = hg;
  hctx.fillRect(0, 0, 256, 256);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTexture(hc, { mipmaps: false }), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, color: new THREE.Color(1.0, 0.8, 0.6) }));
  halo.position.set(L.x, L.y - 0.1, L.z);
  halo.scale.set(1.3, 1.3, 1);
  root.add(halo);
  S.halo = halo;

  const sodium = new THREE.SpotLight(0xff8f33, 260, 18, 0.95, 0.55, 1.7);
  sodium.position.copy(L);
  sodium.target.position.set(L.x + 0.1, 0, L.z - 0.6);
  sodium.castShadow = true;
  sodium.shadow.mapSize.set(1024, 1024);
  sodium.shadow.bias = -0.0005;
  sodium.shadow.normalBias = 0.03;
  sodium.shadow.camera.near = 1;
  sodium.shadow.camera.far = 14;
  scene.add(sodium, sodium.target);
  S.lights.sodium = sodium;
  S.sodiumBase = sodium.intensity;
  // cold light leaking out of the restaurant (lights the sidewalk + her face at the glass)
  const spill = new THREE.PointLight(0xdfeaff, 7, 7, 1.5);
  spill.position.set(0.6, 2.4, 5.7);
  scene.add(spill);
  S.lights.spill = spill;
  S.spillBase = spill.intensity;
  // sodium rim light behind her when she is pressed against the glass (off otherwise)
  const rim = new THREE.PointLight(0xff8a30, 0, 6, 1.6);
  rim.position.set(1.0, 2.6, 7.4);
  scene.add(rim);
  S.lights.rim = rim;
  const hemi = new THREE.HemisphereLight(0x22344f, 0x0b3a3a, 0.55);
  scene.add(hemi);
  S.lights.hemi = hemi;

  // ---------- buildings across the street ----------
  const shops = ['LAUNDROMAT', 'PAWN & LOAN', 'DONUTS', 'TAILOR', 'VIDEO'];
  for (let i = 0; i < 6; i++) {
    const w = 6.6;
    const h = 7.5 + (i % 3) * 1.4;
    const x = -19.8 + i * w;
    const mat = new THREE.MeshStandardMaterial({ map: TX.facadeTexture(100 + i, { shop: shops[i % shops.length], lit: 0.25 }), roughness: 0.85, emissive: 0xffffff, emissiveIntensity: 0.0 });
    mat.emissiveMap = mat.map;
    mat.emissiveIntensity = 0.22;
    mesh(new THREE.BoxGeometry(w - 0.1, h, 1.0), mat, { x: x + w / 2, y: h / 2, z: 23.6, parent: root, cast: false });
    mesh(new THREE.BoxGeometry(w - 0.1, 0.3, 1.2), new THREE.MeshStandardMaterial({ color: 0x15181f, roughness: 0.8 }), { x: x + w / 2, y: h + 0.15, z: 23.6, parent: root, cast: false });
  }
  // far-away silhouettes
  for (let i = 0; i < 8; i++) {
    const h = 12 + (i % 4) * 4;
    mesh(new THREE.BoxGeometry(7, h, 2), new THREE.MeshBasicMaterial({ color: 0x070b13 }), { x: -28 + i * 8, y: h / 2, z: 33, parent: root, cast: false, receive: false });
  }

  // ---------- props ----------
  const red = new THREE.MeshStandardMaterial({ color: 0x6a7e83, roughness: 0.5, metalness: 0.3 });
  const hyd = group(root, { x: -3.7, y: 0.15, z: 7.9 });
  mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.55, 14), red, { y: 0.28, parent: hyd });
  mesh(new THREE.SphereGeometry(0.11, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), red, { y: 0.55, parent: hyd });
  mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.32, 10), red, { y: 0.36, rz: Math.PI / 2, parent: hyd });
  const bin = group(root, { x: 4.6, y: 0.15, z: 6.3 });
  mesh(new THREE.CylinderGeometry(0.28, 0.25, 0.9, 18, 1, true), new THREE.MeshStandardMaterial({ color: 0x1d3b3c, roughness: 0.5, side: THREE.DoubleSide }), { y: 0.45, parent: bin });
  mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 18), new THREE.MeshStandardMaterial({ color: 0x15292a, roughness: 0.5 }), { y: 0.92, parent: bin });
  const busStop = group(root, { x: 4.2, y: 0.15, z: 20.2 });
  mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.6, 10), poleMat, { y: 1.3, parent: busStop });
  mesh(rbox(0.5, 0.36, 0.03, 0.02), new THREE.MeshStandardMaterial({ color: 0x1e6a6b, roughness: 0.5 }), { y: 2.45, parent: busStop });
  const bench = group(root, { x: 5.6, y: 0.15, z: 21.6 });
  mesh(rbox(1.8, 0.06, 0.45, 0.02), poleMat, { y: 0.45, parent: bench });
  mesh(rbox(1.8, 0.4, 0.05, 0.02), poleMat, { y: 0.75, z: 0.2, parent: bench });

  // ---------- sky ----------
  const sky = new THREE.Mesh(new THREE.SphereGeometry(80, 32, 16), new THREE.MeshBasicMaterial({ map: TX.skyTexture(), side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.position.set(0, 0, 10);
  root.add(sky);

  return S;
}
