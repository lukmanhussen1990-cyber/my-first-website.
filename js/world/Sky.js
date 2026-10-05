// Night sky dome (stars, moon, moonlit clouds, lightning) and rings of distant
// mountain silhouettes. Both follow the camera so they read as infinitely far.

import * as THREE from 'three';
import { Noise } from '../core/noise.js';
import { U } from './shared.js';

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}
`;

const SKY_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uMoonDir;
uniform float uMoonBright;
uniform float uMoonVeil;
uniform float uCloudCover;
uniform vec2 uCloudWind;
uniform float uLightning;
uniform vec3 uLightningDir;
uniform vec3 uTownDir;
uniform float uTownGlow;
uniform float uStrangeGlow;
uniform vec3 uStrangeDir;
varying vec3 vDir;

uint pcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
float hash3(vec3 p) {
  uvec3 q = uvec3(ivec3(floor(p)) + 32768);
  return float(pcg(q.x + pcg(q.y + pcg(q.z)))) / 4294967295.0;
}
float hash2(vec2 p) {
  uvec2 q = uvec2(ivec2(floor(p)) + 32768);
  return float(pcg(q.x + pcg(q.y))) / 4294967295.0;
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash2(i);
  float b = hash2(i + vec2(1.0, 0.0));
  float c = hash2(i + vec2(0.0, 1.0));
  float d = hash2(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    s += a * vnoise(p);
    p = p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return s;
}

vec3 stars(vec3 d, float scale, float threshold, float size) {
  vec3 sp = d * scale;
  vec3 id = floor(sp);
  float r = hash3(id);
  if (r < threshold) return vec3(0.0);
  vec3 o = vec3(hash3(id + 11.0), hash3(id + 23.0), hash3(id + 37.0)) * 0.6 + 0.2;
  vec3 f = fract(sp) - o;
  float dist = length(f);
  float px = fwidth(sp.x) + fwidth(sp.y);
  float core = smoothstep(size + px, 0.0, dist);
  float mag = pow((r - threshold) / (1.0 - threshold), 4.0);
  float tw = 0.7 + 0.3 * sin(uTime * (1.5 + r * 6.0) + r * 91.0);
  float temp = hash3(id + 71.0);
  vec3 tint = mix(vec3(0.75, 0.82, 1.0), vec3(1.0, 0.86, 0.7), temp);
  return tint * core * (0.3 + mag * 6.0) * tw;
}

void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 zenith = vec3(0.0016, 0.0024, 0.0055);
  vec3 horizon = vec3(0.012, 0.016, 0.026);
  vec3 col = mix(horizon, zenith, pow(clamp(h, 0.0, 1.0), 0.5));
  // Faint warm light pollution from the town ahead, and a cold glow near the moon.
  float town = pow(max(dot(normalize(vec3(d.x, 0.0, d.z)), uTownDir), 0.0), 6.0) * exp(-max(h, 0.0) * 14.0);
  col += vec3(0.05, 0.028, 0.012) * town * uTownGlow;
  float strange = pow(max(dot(normalize(vec3(d.x, 0.0, d.z)), uStrangeDir), 0.0), 40.0) * exp(-max(h, 0.0) * 9.0);
  col += vec3(0.02, 0.05, 0.045) * strange * uStrangeGlow;

  float md = dot(d, uMoonDir);
  float ang = acos(clamp(md, -1.0, 1.0));

  // Clouds on a virtual plane above.
  float cloud = 0.0;
  vec3 cloudCol = vec3(0.0);
  if (h > -0.02) {
    vec2 cp = d.xz / (h + 0.09) * 1.4 + uCloudWind * uTime;
    float n = fbm(cp * 0.55);
    float cover = mix(0.72, 0.36, uCloudCover);
    cloud = smoothstep(cover, cover + 0.28, n);
    // A cloud bank the director can slide over the moon.
    vec3 t1 = normalize(cross(uMoonDir, vec3(0.0, 1.0, 0.0)));
    vec3 t2 = cross(t1, uMoonDir);
    vec2 mp = vec2(dot(d, t1), dot(d, t2));
    float veil = smoothstep(0.32, 0.0, length(mp + vec2(0.06, 0.0)) - fbm(mp * 9.0 + uTime * 0.05) * 0.18);
    cloud = max(cloud, veil * uMoonVeil * smoothstep(0.0, 0.2, md));
    float thin = 1.0 - smoothstep(0.0, 0.9, cloud);
    float silver = exp(-ang * 4.0) * (0.35 + thin * 1.6);
    cloudCol = vec3(0.016, 0.019, 0.027) + vec3(0.14, 0.15, 0.17) * silver * uMoonBright;
    cloudCol += vec3(0.6, 0.65, 0.8) * uLightning * (0.3 + 0.7 * smoothstep(0.2, 1.0, dot(d, uLightningDir))) * (0.4 + cloud);
    cloudCol += vec3(0.03, 0.017, 0.008) * town * uTownGlow * 2.0;
    cloud *= smoothstep(-0.02, 0.12, h);
  }

  // Stars and the Milky Way, hidden by clouds and haze near the horizon.
  if (h > 0.0) {
    float vis = (1.0 - cloud) * smoothstep(0.0, 0.18, h);
    vec3 sc = stars(d, 180.0, 0.82, 0.16) + stars(d, 420.0, 0.9, 0.2) * 0.5;
    vec3 mwN = normalize(vec3(0.35, 0.55, 0.76));
    float band = exp(-pow(dot(d, mwN) / 0.2, 2.0));
    float mw = band * fbm(d.xz * 9.0 + d.y * 3.0) * 0.02;
    col += (sc * 0.06 + vec3(0.7, 0.75, 1.0) * mw) * vis;
  }

  // Moon disc with maria and limb darkening, plus halo.
  float moonR = 0.0135;
  float moonVis = (1.0 - min(cloud * 1.1, 0.96));
  if (ang < moonR * 1.2) {
    vec3 t1 = normalize(cross(uMoonDir, vec3(0.0, 1.0, 0.0)));
    vec3 t2 = cross(t1, uMoonDir);
    vec2 mp = vec2(dot(d, t1), dot(d, t2)) / moonR;
    float r2 = dot(mp, mp);
    float limb = sqrt(max(0.0, 1.0 - r2));
    float maria = fbm(mp * 2.3 + 4.1);
    float craters = smoothstep(0.55, 0.85, fbm(mp * 7.0 + 1.3));
    vec3 moonCol = vec3(1.0, 0.96, 0.88) * (0.6 + 0.4 * limb) * (0.66 + 0.5 * (1.0 - maria) + craters * 0.1);
    float disc = smoothstep(moonR, moonR * 0.9, ang);
    col = mix(col, moonCol * 9.0 * uMoonBright, disc * moonVis);
  }
  col += vec3(0.5, 0.58, 0.75) * (exp(-ang * 55.0) * 0.5 + exp(-ang * 9.0) * 0.05) * uMoonBright * (0.35 + 0.65 * moonVis);

  col = mix(col, cloudCol, cloud);
  // Below the horizon: the dark valley haze.
  col = mix(col, horizon * 0.55, smoothstep(0.0, -0.06, h));
  col += vec3(0.25, 0.28, 0.35) * uLightning * 0.04;
  gl_FragColor = vec4(col, 1.0);
}
`;

const MTN_VERT = /* glsl */ `
attribute float aRidge;
varying float vH;
varying float vRidge;
varying vec3 vWPos;
void main() {
  vH = position.y;
  vRidge = aRidge;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const MTN_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uHaze;
uniform float uHazeAmt;
uniform vec3 uMoonDir;
uniform float uMoonBright;
uniform float uLightning;
varying float vH;
varying float vRidge;
varying vec3 vWPos;
void main() {
  // Distance below this column's ridge line: rim light near the top edge.
  float below = vRidge - vH;
  vec3 toP = normalize(vec3(vWPos.x - cameraPosition.x, 0.0, vWPos.z - cameraPosition.z));
  float moonSide = max(dot(toP, normalize(vec3(uMoonDir.x, 0.0, uMoonDir.z))), 0.0);
  float rim = exp(-below / 18.0) * (0.25 + 0.75 * moonSide) * uMoonBright;
  vec3 col = uColor * (0.6 + 0.4 * smoothstep(-40.0, 200.0, vH));
  col += vec3(0.025, 0.03, 0.045) * rim;
  col = mix(col, uHaze, uHazeAmt * (0.75 + 0.25 * exp(-max(vH, 0.0) / 120.0)));
  col += vec3(0.07, 0.08, 0.1) * uLightning * (0.4 + rim);
  gl_FragColor = vec4(col, 1.0);
}
`;

export class Sky {
  constructor(scene, seed = 1) {
    this.uniforms = {
      uTime: U.uTime,
      uMoonDir: { value: new THREE.Vector3(-0.34, 0.235, -0.91).normalize() },
      uMoonBright: { value: 1 },
      uMoonVeil: { value: 0 },
      uCloudCover: { value: 0.3 },
      uCloudWind: { value: new THREE.Vector2(0.004, 0.0015) },
      uLightning: U.uLightning,
      uLightningDir: { value: new THREE.Vector3(0.6, 0.3, -0.7).normalize() },
      uTownDir: { value: new THREE.Vector3(0, 0, -1) },
      uTownGlow: { value: 0.2 },
      uStrangeDir: { value: new THREE.Vector3(1, 0, 0) },
      uStrangeGlow: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(3000, 64, 32), mat);
    this.dome.renderOrder = -10;
    this.dome.frustumCulled = false;
    this.dome.name = 'sky';
    scene.add(this.dome);

    this.mountains = new THREE.Group();
    this.mountains.name = 'mountains';
    const layers = [
      { r: 1250, base: 40, amp: 150, freq: 3.1, color: 0x020304, haze: 0.42 },
      { r: 1900, base: 90, amp: 260, freq: 2.2, color: 0x030508, haze: 0.62 },
      { r: 2700, base: 170, amp: 380, freq: 1.6, color: 0x04060a, haze: 0.78 },
    ];
    const noise = new Noise(seed * 101 + 7);
    this.mtnMats = [];
    layers.forEach((L, li) => {
      const seg = 720;
      const pos = new Float32Array((seg + 1) * 2 * 3);
      const ridge = new Float32Array((seg + 1) * 2);
      for (let s = 0; s <= seg; s++) {
        const a = (s / seg) * Math.PI * 2;
        const cx = Math.cos(a);
        const sz = Math.sin(a);
        const k = L.freq;
        let n = 0;
        let amp = 1;
        let f = 1;
        for (let o = 0; o < 5; o++) {
          const v = 1 - Math.abs(noise.n2(cx * k * f + li * 17, sz * k * f + li * 5));
          n += v * v * amp;
          amp *= 0.5;
          f *= 2.1;
        }
        const hgt = L.base + L.amp * (n * 0.9 - 0.25);
        const i = s * 2;
        pos.set([cx * L.r, -120, sz * L.r], i * 3);
        pos.set([cx * L.r, hgt, sz * L.r], (i + 1) * 3);
        ridge[i] = hgt;
        ridge[i + 1] = hgt;
      }
      const idx = [];
      for (let s = 0; s < seg; s++) {
        const a = s * 2;
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('aRidge', new THREE.BufferAttribute(ridge, 1));
      geo.setIndex(idx);
      const mat2 = new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color(L.color) },
          uHaze: { value: new THREE.Color(0x0b1019) },
          uHazeAmt: { value: L.haze },
          uMoonDir: this.uniforms.uMoonDir,
          uMoonBright: this.uniforms.uMoonBright,
          uLightning: U.uLightning,
        },
        vertexShader: MTN_VERT,
        fragmentShader: MTN_FRAG,
        side: THREE.DoubleSide,
      });
      this.mtnMats.push(mat2);
      const mesh = new THREE.Mesh(geo, mat2);
      mesh.frustumCulled = false;
      mesh.renderOrder = -5 + li;
      this.mountains.add(mesh);
    });
    scene.add(this.mountains);
  }

  get moonDir() {
    return this.uniforms.uMoonDir.value;
  }

  update(camera, baseY) {
    this.dome.position.copy(camera.position);
    this.mountains.position.set(camera.position.x, baseY, camera.position.z);
  }

  setHaze(amount) {
    // Thicker mist swallows the distant ridges.
    this.mtnMats.forEach((m, i) => {
      m.uniforms.uHazeAmt.value = Math.min(1, [0.42, 0.62, 0.78][i] + amount * (0.3 + i * 0.1));
    });
  }
}
