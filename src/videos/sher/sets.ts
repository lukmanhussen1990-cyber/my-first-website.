// The river for the riddle short: near bank (z > 0) and far bank (z < -6.6) with grass, a river between them, a
// small wooden boat, trees, bushes, two huts, and the bridge downstream (x = +26) that the twist reveals.
import * as THREE from "three";
import { ctex, rep, rng } from "../slippery/paint";
import { twoTone } from "../slippery/shade";
import { NOINK } from "../slippery/ink";

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const mats = new Map<string, THREE.MeshLambertMaterial>();
const lam = (key: string, make: () => THREE.MeshLambertMaterialParameters) => {
  let m = mats.get(key);
  if (!m) { m = twoTone(new THREE.MeshLambertMaterial(make())); mats.set(key, m); }
  return m;
};
const col = (c: string) => lam("c" + c, () => ({ color: c }));
const box = (parent: THREE.Object3D, min: THREE.Vector3, max: THREE.Vector3, mat: THREE.Material, cast = true) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(max.x - min.x, max.y - min.y, max.z - min.z), mat);
  m.position.set((min.x + max.x) / 2, (min.y + max.y) / 2, (min.z + max.z) / 2); m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m;
};
const tile = (t: THREE.Texture) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };

const grassTex = () => tile(ctex("rgrass", 512, 512, (g, r) => {
  g.fillStyle = "#79b84f"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2200; i++) { g.fillStyle = ["#6aa844", "#8ac45e", "#5e9c3c", "#96cc66"][Math.floor(r() * 4)]; const x = r() * 512, y = r() * 512; g.fillRect(x, y, 3, 7 + r() * 6); }
}));
const dirtTex = () => tile(ctex("rdirt", 256, 256, (g, r) => {
  g.fillStyle = "#a8794c"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 500; i++) { g.fillStyle = ["#94683f", "#b88a5a", "#8a5e38"][Math.floor(r() * 3)]; g.fillRect(r() * 256, r() * 256, 4, 3); }
}));
const waterTex = () => tile(ctex("rwater", 512, 512, (g, r) => {
  const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, "#3fa6d6"); gr.addColorStop(1, "#2f8fc6");
  g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = "rgba(220,245,255,0.75)"; g.lineWidth = 5; g.lineCap = "round";
  for (let i = 0; i < 40; i++) { const x = r() * 512, y = r() * 512, w = 20 + r() * 40; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w / 2, y - 6, x + w, y); g.stroke(); }
}));
const plankTex = () => tile(ctex("rplank", 256, 256, (g, r) => {
  for (let i = 0; i < 8; i++) { g.fillStyle = ["#a8723f", "#b98048", "#9a6838"][i % 3]; g.fillRect(0, i * 32, 256, 32); g.fillStyle = "#4a2f1c"; g.fillRect(0, i * 32, 256, 3); }
}));
const thatchTex = () => tile(ctex("rthatch", 256, 256, (g, r) => {
  g.fillStyle = "#d9b25e"; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = "#b08a3c"; g.lineWidth = 3; for (let i = 0; i < 120; i++) { const x = r() * 256, y = r() * 256; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 4, y + 22); g.stroke(); }
}));
const mudWallTex = () => tile(ctex("rmud", 256, 256, (g, r) => {
  g.fillStyle = "#e3c9a0"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(150,110,70,${0.1 + r() * 0.1})`; g.fillRect(r() * 256, r() * 256, 6, 4); }
}));

export type River = { root: THREE.Group; boat: THREE.Group; water: THREE.MeshLambertMaterial; waterTex: THREE.Texture; sky: THREE.ShaderMaterial };
export const BANK_Y = 0.35, NEAR_EDGE = 0, FAR_EDGE = -6.6, BRIDGE_X = 15;

export const buildRiver = (): River => {
  const R = new THREE.Group();
  // sky dome (gradient, never inked)
  const sky = new THREE.ShaderMaterial({
    uniforms: { top: { value: new THREE.Color("#4f8fd8") }, hor: { value: new THREE.Color("#cfe6f5") } },
    vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: "uniform vec3 top, hor; varying vec3 vP; void main(){ float k = smoothstep(0.0, 0.5, vP.y); gl_FragColor = vec4(mix(hor, top, k), 1.0); }",
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(380, 32, 16), sky); dome.layers.set(NOINK); dome.renderOrder = -1; dome.frustumCulled = false; R.add(dome);
  // banks
  const grass = lam("rgrass", () => ({ map: rep(grassTex(), 60, 30) }));
  const dirt = lam("rdirt", () => ({ map: rep(dirtTex(), 80, 1) }));
  box(R, V(-120, -2, NEAR_EDGE), V(120, BANK_Y, 60), grass, false);
  box(R, V(-120, -2, -80), V(120, BANK_Y, FAR_EDGE), grass, false);
  box(R, V(-120, -0.3, NEAR_EDGE - 0.35), V(120, BANK_Y - 0.08, NEAR_EDGE), dirt, false);
  box(R, V(-120, -0.3, FAR_EDGE), V(120, BANK_Y - 0.08, FAR_EDGE + 0.35), dirt, false);
  // river
  const wt = rep(waterTex(), 40, 2.5);
  const water = twoTone(new THREE.MeshLambertMaterial({ map: wt, emissive: new THREE.Color("#1d6fa8"), emissiveIntensity: 0.15 }));
  const wm = new THREE.Mesh(new THREE.PlaneGeometry(240, FAR_EDGE * -1), water);
  wm.rotation.x = -Math.PI / 2; wm.position.set(0, 0.04, FAR_EDGE / 2); wm.receiveShadow = true; R.add(wm);
  // boat (length along x), origin = centre of the floor
  const boat = new THREE.Group();
  const wood = lam("rplank", () => ({ map: plankTex() })), dark = col("#7a4f33");
  box(boat, V(-1.0, -0.1, -0.38), V(1.0, 0.02, 0.38), wood);
  for (const s of [-1, 1]) { const side = box(boat, V(-1.1, 0.0, -0.05), V(1.1, 0.36, 0.05), wood); side.position.z = s * 0.42; side.rotation.x = s * 0.18; }
  for (const s of [-1, 1]) { const end = box(boat, V(-0.05, 0.0, -0.42), V(0.05, 0.4, 0.42), dark); end.position.x = s * 1.12; end.rotation.z = -s * 0.35; }
  box(boat, V(-0.15, 0.2, -0.38), V(0.15, 0.25, 0.38), dark);
  R.add(boat);
  // trees, bushes, reeds
  const r = rng(21);
  const trunk = col("#8a5a3c"), leaf = [col("#4f9a3c"), col("#5fae46"), col("#3f8a34")], bush = col("#5aa448"), reed = col("#6f9a3a");
  const tree = (x: number, z: number, s: number) => {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.18 * s, 1.6 * s, 8), trunk); t.position.set(x, BANK_Y + 0.8 * s, z); t.castShadow = true; R.add(t);
    for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(new THREE.SphereGeometry((0.75 - k * 0.12) * s, 14, 10), leaf[k % 3]); c.position.set(x + (k - 1) * 0.35 * s, BANK_Y + (1.9 + k * 0.45) * s, z + (k % 2) * 0.2 * s); c.castShadow = true; c.receiveShadow = true; R.add(c); }
  };
  for (let i = 0; i < 46; i++) {
    const far = i % 2 === 0, x = -40 + r() * 80, z = far ? -9.5 - r() * 22 : 5 + r() * 20;
    if (!far && Math.abs(x) < 4 && z < 9) continue;
    if (far && Math.abs(x) < 3.5 && z > -12) continue;
    tree(x, z, 0.8 + r() * 0.7);
  }
  for (let i = 0; i < 40; i++) {
    const far = i % 2 === 0, x = -30 + r() * 60, z = far ? -7.6 - r() * 3 : 1.6 + r() * 3;
    if (Math.abs(x) < 2.4) continue;
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.3 + r() * 0.3, 10, 8), bush); b.position.set(x, BANK_Y + 0.15, z); b.scale.y = 0.7; b.castShadow = true; R.add(b);
  }
  for (let i = 0; i < 60; i++) {
    const far = i % 2 === 0, x = -30 + r() * 60, z = far ? FAR_EDGE - 0.1 - r() * 0.3 : NEAR_EDGE + 0.1 + r() * 0.3;
    if (Math.abs(x) < 2.2) continue;
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.6 + r() * 0.4, 5), reed); c.position.set(x, BANK_Y + 0.3, z); R.add(c);
  }
  // huts
  const hut = (x: number, z: number, yaw: number) => {
    const g = new THREE.Group(); g.position.set(x, BANK_Y, z); g.rotation.y = yaw; R.add(g);
    const w = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.35, 1.6, 20), lam("rmud", () => ({ map: rep(mudWallTex(), 3, 1) }))); w.position.y = 0.8; w.castShadow = true; w.receiveShadow = true; g.add(w);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.75, 1.3, 20), lam("rthatch", () => ({ map: rep(thatchTex(), 4, 2) }))); roof.position.y = 2.2; roof.castShadow = true; g.add(roof);
    box(g, V(-0.35, 0, 1.25), V(0.35, 1.2, 1.36), col("#6b4226"));
  };
  hut(-5.5, 6.5, 0.4); hut(6.5, -13, -0.5);
  // the bridge downstream, with railings
  const stone = col("#b9ab96");
  box(R, V(BRIDGE_X - 1.6, 0.9, FAR_EDGE - 1.5), V(BRIDGE_X + 1.6, 1.1, NEAR_EDGE + 1.5), wood);
  for (const s of [-1, 1]) box(R, V(BRIDGE_X + s * 1.55 - 0.05, 1.1, FAR_EDGE - 1.5), V(BRIDGE_X + s * 1.55 + 0.05, 1.7, NEAR_EDGE + 1.5), dark);
  for (const z of [FAR_EDGE + 1.0, -3.3, NEAR_EDGE - 1.0]) box(R, V(BRIDGE_X - 1.3, -0.5, z - 0.25), V(BRIDGE_X + 1.3, 0.9, z + 0.25), stone);
  return { root: R, boat, water, waterTex: wt, sky };
};
