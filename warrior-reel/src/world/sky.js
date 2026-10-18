// Sky dome (gradient + sun glow, matches the fog/mist colour at the horizon) and stylised pixel clouds.
import * as THREE from 'three';
import { rng } from '../core/util.js';
import { cloudTexture } from './textures.js';

const SKY_VS = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * p;
  gl_Position.z = gl_Position.w * 0.99999; // always at the far plane
}`;
const SKY_FS = /* glsl */`
uniform vec3 uTop, uMid, uHorizon, uSunDir, uSunCol;
uniform float uGlow, uDisc;
varying vec3 vDir;
float h21(vec2 p) { p = fract(p * vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x * p.y); }
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.16, h));
  col = mix(col, uTop, smoothstep(0.1, 0.6, h));
  col = mix(col, uHorizon, 1.0 - smoothstep(-0.02, 0.035, h)); // white mist band at the horizon
  float s = max(dot(d, normalize(uSunDir)), 0.0);
  col += uSunCol * (pow(s, 6.0) * 0.18 + pow(s, 48.0) * 0.45) * uGlow;
  col += uSunCol * smoothstep(0.99955, 0.9998, s) * uDisc;
  col += (h21(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function buildSky() {
  const uniforms = {
    uTop: { value: new THREE.Color(0x3b8ee6) }, uMid: { value: new THREE.Color(0x92c3ef) }, uHorizon: { value: new THREE.Color(0xeef2f4) },
    uSunDir: { value: new THREE.Vector3(-0.55, 0.95, 0.45).normalize() }, uSunCol: { value: new THREE.Color(1, 0.95, 0.85) },
    uGlow: { value: 0.5 }, uDisc: { value: 3.0 },
  };
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, fog: false });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(450, 32, 16), mat);
  dome.name = 'sky';
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  // keep the dome centred on the camera
  dome.onBeforeRender = (r, s, cam) => { dome.position.copy(cam.position); dome.updateMatrixWorld(); };

  // ---- clouds: quads on a ring facing the centre, merged into one mesh
  const rand = rng(2024);
  const tex = [cloudTexture(5), cloudTexture(8), cloudTexture(13)];
  const groups = [[], [], []];
  const N = 16;
  for (let i = 0; i < N; i++) {
    const az = (i / N) * Math.PI * 2 + rand() * 0.3;
    const el = (5 + rand() * 18) * Math.PI / 180;
    const R = 330;
    const w = 70 + rand() * 90, hgt = w * (0.28 + rand() * 0.12);
    const g = new THREE.PlaneGeometry(w, hgt);
    const pos = new THREE.Vector3(Math.sin(az) * Math.cos(el) * R, Math.sin(el) * R, Math.cos(az) * Math.cos(el) * R);
    const m = new THREE.Matrix4().lookAt(pos, new THREE.Vector3(0, pos.y * 0.6, 0), new THREE.Vector3(0, 1, 0));
    g.applyMatrix4(new THREE.Matrix4().makeRotationY(Math.PI)); // face the centre
    g.applyMatrix4(m.setPosition(pos));
    groups[i % 3].push(g);
  }
  const clouds = new THREE.Group();
  clouds.name = 'clouds';
  const cloudMats = [];
  groups.forEach((list, k) => {
    const merged = list.length ? mergeList(list) : null;
    if (!merged) return;
    const m = new THREE.MeshBasicMaterial({ map: tex[k], transparent: true, depthWrite: false, fog: false, color: 0xffffff });
    cloudMats.push(m);
    const mesh = new THREE.Mesh(merged, m);
    mesh.renderOrder = -9;
    mesh.frustumCulled = false;
    clouds.add(mesh);
  });
  clouds.onBeforeRender = () => {};
  return { dome, uniforms, clouds, cloudMats };
}

function mergeList(list) {
  const pos = [], uv = [], idx = [];
  let base = 0;
  for (const g of list) {
    const p = g.attributes.position, u = g.attributes.uv;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); uv.push(u.getX(i), u.getY(i)); }
    for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + base);
    base += p.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}
