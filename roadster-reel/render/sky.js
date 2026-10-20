// Golden-hour sky dome, sun, painted clouds and a height + direction aware
// atmospheric haze that is patched into every three.js material's fog chunk.
import * as THREE from 'three';
import { makeNoise2, rng, smoothstep } from './util.js';

export const SUN_DIR = new THREE.Vector3(0.79, 0.245, 0.565).normalize();
export const SUN_COLOR = new THREE.Color(1.0, 0.58, 0.30);

const SKY_COMMON = /* glsl */`
const vec3 SUN_DIR = normalize(vec3(0.79, 0.245, 0.565));
vec3 skyGradient(vec3 d){
  float h = d.y;
  vec2 hz = normalize(d.xz + 1e-5);
  float toSun = dot(hz, normalize(SUN_DIR.xz)) * 0.5 + 0.5;       // 0 away from sun, 1 toward
  vec3 zen   = vec3(0.060, 0.105, 0.300);
  vec3 upper = vec3(0.170, 0.205, 0.470);
  vec3 mid   = mix(vec3(0.42, 0.33, 0.52), vec3(0.85, 0.52, 0.50), toSun);
  vec3 hor   = mix(vec3(0.95, 0.52, 0.40), vec3(1.55, 0.78, 0.36), toSun * toSun);
  vec3 c;
  if (h > 0.0) {
    float a = smoothstep(0.0, 0.10, h), b = smoothstep(0.06, 0.36, h), e = smoothstep(0.30, 0.95, h);
    c = mix(hor, mid, a); c = mix(c, upper, b); c = mix(c, zen, e);
  } else {
    // below horizon: warm misty void under the floating diorama
    c = mix(hor * 0.92, vec3(0.30, 0.17, 0.15), smoothstep(0.0, -0.25, h));
  }
  return c;
}
vec3 sunGlow(vec3 d, float k){
  float g = max(dot(d, SUN_DIR), 0.0);
  return k * (vec3(1.0, 0.50, 0.22) * (0.30 * pow(g, 5.0) + 0.70 * pow(g, 40.0)) + vec3(1.0, 0.78, 0.52) * 2.2 * pow(g, 500.0));
}
vec3 hazeColor(vec3 d){
  vec3 dd = normalize(vec3(d.x, clamp(d.y, -0.05, 0.12) * 0.6, d.z));
  return skyGradient(dd) * 0.95 + sunGlow(d, 0.65);
}
`;

export const SKY_GLSL = SKY_COMMON;

// Patch three.js fog to our haze model: fogNear = density, fogFar = height falloff.
export function patchFog() {
  const C = THREE.ShaderChunk;
  C.fog_pars_vertex = `#ifdef USE_FOG\n varying vec3 vFogWorldPos;\n#endif`;
  C.fog_vertex = `#ifdef USE_FOG\n vFogWorldPos = cameraPosition + transpose(mat3(viewMatrix)) * mvPosition.xyz;\n#endif`;
  C.fog_pars_fragment = `#ifdef USE_FOG\n uniform vec3 fogColor; uniform float fogNear; uniform float fogFar; varying vec3 vFogWorldPos;\n${SKY_COMMON}\n#endif`;
  C.fog_fragment = /* glsl */`
#ifdef USE_FOG
  {
    vec3 fv = vFogWorldPos - cameraPosition;
    float fd = length(fv);
    vec3 fdir = fv / max(fd, 1e-4);
    float hf = fogFar;
    float h0 = max(cameraPosition.y, -20.0);
    float dy = vFogWorldPos.y - cameraPosition.y;
    float k = hf * dy;
    float integ = abs(k) > 1e-3 ? (1.0 - exp(-k)) / k : 1.0;
    float od = fogNear * fd * exp(-hf * h0) * integ;
    float ff = 1.0 - exp(-max(od, 0.0));
    gl_FragColor.rgb = mix(gl_FragColor.rgb, hazeColor(fdir) * fogColor, ff);
  }
#endif`;
}

export function makeSkyDome() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: true, fog: false,
    uniforms: { uSunScale: { value: 1.0 } },
    vertexShader: /* glsl */`varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: /* glsl */`${SKY_COMMON}
      uniform float uSunScale; varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        vec3 c = skyGradient(d) + sunGlow(d, 1.0);
        float g = dot(d, SUN_DIR);
        c += vec3(40.0, 27.0, 15.0) * smoothstep(0.99955, 0.99975, g) * uSunScale;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(4000, 64, 32), mat);
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  return dome;
}

// Painted stylised cumulus / stratus clouds lit from the low sun.
function cloudTexture(seed, w = 512, h = 256, kind = 0) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(w, h);
  const N = makeNoise2(seed);
  const R = rng(seed * 7 + 3);
  // a few blobs define the silhouette
  const blobs = [];
  const nb = kind === 0 ? 7 : 11;
  for (let i = 0; i < nb; i++) {
    const x = 0.12 + 0.76 * (i + R() * 0.6) / nb;
    blobs.push({ x, y: kind === 0 ? 0.62 - R() * 0.16 : 0.55 + (R() - 0.5) * 0.08, r: kind === 0 ? 0.13 + R() * 0.12 : 0.06 + R() * 0.05 });
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w, v = y / h;
      let d = 0;
      for (const b of blobs) {
        const dx = (u - b.x) * (w / h) * 0.5, dy = (v - b.y);
        const r = Math.sqrt(dx * dx + dy * dy);
        d = Math.max(d, 1 - r / b.r);
      }
      const n = N.fbm(u * 8, v * 4, 5, 8, 4);
      let dens = d + n * 0.35 - 0.05;
      // flat-ish bottoms for cumulus
      if (kind === 0) dens *= smoothstep(0.86, 0.66, v);
      const a = smoothstep(0.0, 0.25, dens);
      // lighting: bottom/sun side glows warm, top is cooler lavender
      const lit = smoothstep(0.35, 0.95, v) * 0.6 + 0.4 * (1 - smoothstep(0.0, 0.5, dens));
      const i4 = (y * w + x) * 4;
      const r = 150 + 105 * lit, g = 105 + 75 * lit, bcol = 140 + 20 * lit - 40 * lit * lit;
      img.data[i4] = r; img.data[i4 + 1] = g; img.data[i4 + 2] = bcol; img.data[i4 + 3] = 255 * a;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeClouds() {
  const group = new THREE.Group();
  const R = rng(42);
  const texs = [cloudTexture(11, 512, 256, 0), cloudTexture(23, 512, 256, 0), cloudTexture(37, 512, 192, 1), cloudTexture(51, 512, 192, 1)];
  const placements = [];
  // azimuths measured from +X toward +Z ... we want clouds mostly behind the city (−Z) and toward the sun (+X)
  for (let i = 0; i < 26; i++) {
    const az = -Math.PI * 0.95 + R() * Math.PI * 1.55;  // mostly the -Z half plus the sun side
    const el = 0.035 + Math.pow(R(), 1.6) * 0.30;
    const dist = 2600 + R() * 900;
    const kind = R() < 0.55 ? 0 : 1;
    placements.push({ az, el, dist, kind, s: (kind === 0 ? 420 : 520) + R() * 520 });
  }
  for (const p of placements) {
    const tex = texs[(p.kind === 0 ? 0 : 2) + (R() < 0.5 ? 0 : 1)];
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, opacity: 0.9 });
    // tint by direction: clouds toward the sun glow warmer and brighter (HDR)
    const dir = new THREE.Vector3(Math.cos(p.az) * Math.cos(p.el), Math.sin(p.el), Math.sin(p.az) * Math.cos(p.el));
    const sunw = Math.max(dir.dot(SUN_DIR), 0);
    const warm = 0.75 + 1.2 * Math.pow(sunw, 3) + 0.3 * (1 - p.el * 3);
    mat.color.setRGB(warm * 1.0, warm * 0.86, warm * 0.86 + 0.08);
    const aspect = tex.image.width / tex.image.height;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(p.s * aspect * 0.5, p.s * 0.5), mat);
    m.position.copy(dir.multiplyScalar(p.dist));
    m.lookAt(0, m.position.y * 0.2, 0);
    m.renderOrder = -9;
    m.frustumCulled = false;
    group.add(m);
  }
  return group;
}
