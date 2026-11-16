// Smoke test: painted ground + plank path + a stickman card + sun shadows + slow push-in.
import * as THREE from "three";
import { grass, planks, stone, rep } from "./paint.js";
import { Pen, bodyFront, INK } from "./toonbase.js";

export const FPS = 30, TOTAL = 60;
let scene, camera, W, H;

const SU = 0.00216; // metres per design unit (1000 units = 2.16 m)
const card = (outfit, opts) => {
  const cv = document.createElement("canvas");
  cv.width = 1200; cv.height = 2000;
  const g = cv.getContext("2d");
  g.scale(2, 2);
  bodyFront(new Pen(g), outfit, opts);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const geo = new THREE.PlaneGeometry(600 * SU, 1000 * SU);
  geo.translate(0, 475 * SU, 0); // soles (design y 975) at the origin
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide }));
  m.castShadow = true;
  m.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5 });
  return m;
};

export async function setup(ctx) {
  W = ctx.W; H = ctx.H;
  scene = new THREE.Scene();
  scene.background = new THREE.Color("#7fb0e6");
  scene.fog = new THREE.Fog("#b8d0ec", 25, 120);
  camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 500);

  scene.add(new THREE.HemisphereLight("#cfe3ff", "#6b5a3a", 1.2));
  const sun = new THREE.DirectionalLight("#fff1d6", 2.6);
  sun.position.set(6, 10, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 40 });
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshLambertMaterial({ map: rep(grass(), 40, 40) }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const path = new THREE.Mesh(new THREE.BoxGeometry(3, 0.12, 30), new THREE.MeshLambertMaterial({ map: rep(planks(), 1.5, 15) }));
  path.position.set(0, 0.06, -8); path.receiveShadow = true; scene.add(path);
  for (const [x, z, s] of [[-3.2, -6, 1.4], [3.4, -9, 1.8], [-3.6, -14, 2.2]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(s, s * 1.6, s), new THREE.MeshLambertMaterial({ map: stone() }));
    b.position.set(x, s * 0.8, z); b.castShadow = b.receiveShadow = true; scene.add(b);
  }

  const hero = card({ jacket: "#b8322f", pants: INK, boots: INK, skin: "#ffffff" }, { expr: "grin", mode: "stand", seed: 3, facing: 1 });
  hero.position.set(-0.6, 0.12, -2); scene.add(hero);
  const pal = card({ jacket: "#3f6fb5", pants: INK, boots: INK, skin: "#ffffff", dress: "#c25a7a" }, { expr: "shock", mode: "stand", seed: 8, facing: -1 });
  pal.position.set(0.7, 0.12, -2.4); scene.add(pal);
}

export function frame(f) {
  const u = f / TOTAL;
  camera.position.set(0.1, 1.55, 3.6 - 0.6 * u);
  camera.lookAt(0, 1.2, -2.2);
  return { scene, camera };
}
