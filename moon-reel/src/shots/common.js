import * as THREE from 'three';
import { bakeSky, Starfield, Earth, Moon } from '../world/space.js';
import { VanishFX } from '../world/fx.js';
import { wobble } from '../core/util.js';

const _v = new THREE.Vector3();
const _r = new THREE.Vector3();

export function renderTo(ctx, scene, camera, { clear = 0x000000, target = ctx.post.sceneRT, clearTarget = true } = {}) {
  const r = ctx.renderer;
  r.setRenderTarget(target);
  r.setClearColor(clear, 1);
  if (clearTarget) r.clear(true, true, false);
  const ac = r.autoClear;
  r.autoClear = false;
  r.render(scene, camera);
  r.autoClear = ac;
}

// Project a world point to 1080x1920 overlay coordinates.
export function toScreen(v, camera) {
  _v.copy(v).project(camera);
  return [(_v.x * 0.5 + 0.5) * 1080, (0.5 - _v.y * 0.5) * 1920, _v.z];
}

export function screenRadius(center, radius, camera) {
  _r.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
  const a = toScreen(center, camera);
  const b = toScreen(_r.multiplyScalar(radius).add(center), camera);
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

export function aimCamera(cam, pos, target, { roll = 0, fov = null, shake = 0, t = 0, seed = 0 } = {}) {
  cam.position.set(pos[0], pos[1], pos[2]);
  cam.up.set(0, 1, 0);
  cam.lookAt(target[0], target[1], target[2]);
  if (roll) cam.rotateZ(roll);
  if (shake) {
    cam.rotateX(wobble(t * 1.7, seed + 1) * shake * 0.012);
    cam.rotateY(wobble(t * 1.7, seed + 2) * shake * 0.012);
    cam.rotateZ(wobble(t * 1.3, seed + 3) * shake * 0.006);
  }
  if (fov && cam.fov !== fov) {
    cam.fov = fov;
    cam.updateProjectionMatrix();
  }
  cam.updateMatrixWorld(true);
}

// Shared space scene: sky, stars, Earth, Moon, vanish effect.
export function createSpaceWorld(ctx) {
  const sky = bakeSky(ctx.renderer);
  const scene = new THREE.Scene();
  const starfield = new Starfield(sky);
  const earth = new Earth(ctx.tex);
  const moon = new Moon(ctx.tex);
  const vanish = new VanishFX();
  scene.add(starfield.group, earth.group, moon.group, vanish.group);
  const camera = new THREE.PerspectiveCamera(40, ctx.W / ctx.H, 0.01, 3000);
  return { sky, scene, starfield, earth, moon, vanish, camera };
}

// Longitude (degrees) that should face +Z -> spin angle.
export const spinFor = (lonDeg) => (-(lonDeg + 90) * Math.PI) / 180;

// Orient `cam` at `pos` so world point A lands on screen point sa and B lies in the direction of sb
// (exactly on it when the angular separations agree). Screen points are 1080x1920 pixels.
export function frameTwo(cam, pos, A, sa, B, sb, fov) {
  if (cam.fov !== fov) {
    cam.fov = fov;
    cam.updateProjectionMatrix();
  }
  const tanV = Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const aspect = 1080 / 1920;
  const ray = (s) => new THREE.Vector3(((s[0] / 1080) * 2 - 1) * tanV * aspect, (1 - (s[1] / 1920) * 2) * tanV, -1).normalize();
  const P = new THREE.Vector3(...pos);
  const basis = (a, b) => {
    const x = a.clone();
    const z = a.clone().cross(b).normalize();
    const y = z.clone().cross(x).normalize();
    return new THREE.Matrix4().makeBasis(x, y, z);
  };
  const Mc = basis(ray(sa), ray(sb));
  const Mw = basis(A.clone().sub(P).normalize(), B.clone().sub(P).normalize());
  const R = Mw.multiply(Mc.transpose());
  cam.position.copy(P);
  cam.quaternion.setFromRotationMatrix(R);
  cam.updateMatrixWorld(true);
  return cam.quaternion.clone();
}
