import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { GLSL_NOISE, rng } from '../core/util.js';

// ---------------------------------------------------------------------------------------------
// Sky: Milky Way band, dust lanes and faint nebula colour, baked once into an equirect texture.
// ---------------------------------------------------------------------------------------------
const SKY_BAKE_FS = /* glsl */ `
${GLSL_NOISE}
varying vec2 vUv;
uniform vec3 galNormal, galCenter;
void main(){
  float phi = vUv.x * 6.2831853;
  float theta = (1.0 - vUv.y) * 3.14159265;
  vec3 d = vec3(-cos(phi) * sin(theta), cos(theta), sin(phi) * sin(theta));
  float b = asin(clamp(dot(d, galNormal), -1.0, 1.0));
  float core = exp(-pow(acos(clamp(dot(d, galCenter), -1.0, 1.0)) / 0.55, 2.0));
  float n1 = fbm(d * 3.0, 6);
  float n2 = fbm(d * 7.0 + 4.0, 6);
  float n3 = fbm(d * 1.6 + 11.0, 4);
  float width = 0.16 + 0.05 * n3 + 0.08 * core;
  float band = exp(-pow(b / width, 2.0)) * (0.55 + 0.45 * n1);
  band += 0.35 * exp(-pow(b / (width * 2.6), 2.0)) * (0.6 + 0.4 * n3);
  float dust = smoothstep(-0.05, 0.45, n2) * exp(-pow((b - 0.02 * n3) / (width * 0.42), 2.0));
  float glow = band * (1.0 - 0.78 * dust) * (0.55 + 1.6 * core);
  vec3 bandCol = mix(vec3(0.62, 0.72, 1.0), vec3(1.0, 0.82, 0.62), core * 0.9);
  vec3 col = bandCol * glow * 0.075;
  // faint coloured nebulosity
  float neb1 = smoothstep(0.15, 0.8, fbm(d * 2.2 + 21.0, 5)) * exp(-pow(b / 0.6, 2.0));
  float neb2 = smoothstep(0.2, 0.85, fbm(d * 2.7 + 37.0, 5));
  col += vec3(0.45, 0.12, 0.30) * neb1 * 0.018 + vec3(0.06, 0.22, 0.42) * neb2 * 0.02;
  // navy base
  col += vec3(0.0035, 0.0055, 0.014);
  gl_FragColor = vec4(col, 1.0);
}
`;

export function bakeSky(renderer, w = 4096, h = 2048) {
  const rt = new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
  });
  const galNormal = new THREE.Vector3(0.35, 0.82, -0.45).normalize();
  const galCenter = new THREE.Vector3(0.62, 0.1, 0.78);
  galCenter.sub(galNormal.clone().multiplyScalar(galCenter.dot(galNormal))).normalize();
  const mat = new THREE.ShaderMaterial({
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: SKY_BAKE_FS,
    uniforms: { galNormal: { value: galNormal }, galCenter: { value: galCenter } },
  });
  const quad = new FullScreenQuad(mat);
  renderer.setRenderTarget(rt);
  quad.render(renderer);
  renderer.setRenderTarget(null);
  quad.dispose();
  mat.dispose();
  return { texture: rt.texture, galNormal, galCenter };
}

export function createSkyMesh(sky) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tSky; uniform float intensity; uniform vec3 tint;
      varying vec2 vUv;
      void main(){ gl_FragColor = vec4(texture2D(tSky, vUv).rgb * intensity * tint, 1.0); }`,
    uniforms: { tSky: { value: sky.texture }, intensity: { value: 1 }, tint: { value: new THREE.Vector3(1, 1, 1) } },
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1000, 64, 32), mat);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return mesh;
}

// ---------------------------------------------------------------------------------------------
// Stars: crisp point sprites, denser along the Milky Way band.
// ---------------------------------------------------------------------------------------------
export function createStars(sky, { count = 9000, seed = 7, radius = 900 } = {}) {
  const r = rng(seed);
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const phase = new Float32Array(count);
  const v = new THREE.Vector3();
  const temps = [
    [0.66, 0.77, 1.0],
    [0.8, 0.86, 1.0],
    [1.0, 1.0, 1.0],
    [1.0, 0.95, 0.85],
    [1.0, 0.85, 0.65],
    [1.0, 0.72, 0.5],
  ];
  for (let i = 0; i < count; i++) {
    // rejection-sample a direction, favouring the galactic plane
    for (;;) {
      v.set(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1);
      const l = v.length();
      if (l < 0.05 || l > 1) continue;
      v.divideScalar(l);
      const b = Math.abs(v.dot(sky.galNormal));
      if (r() < 0.35 + 0.65 * Math.exp(-((b / 0.25) ** 2))) break;
    }
    pos.set([v.x * radius, v.y * radius, v.z * radius], i * 3);
    const bright = Math.min(5, Math.pow(r(), -1.25) * 0.32);
    const t = temps[Math.min(temps.length - 1, Math.floor(Math.pow(r(), 1.3) * temps.length))];
    col.set([t[0] * bright, t[1] * bright, t[2] * bright], i * 3);
    size[i] = Math.min(4.6, 1.7 + Math.sqrt(bright) * 0.95);
    phase[i] = r() * 100;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('phase', new THREE.BufferAttribute(phase, 1));
  const mat = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      attribute float size; attribute float phase; attribute vec3 color;
      uniform float pxScale, time, twinkle;
      varying vec3 vCol;
      void main(){
        float tw = 1.0 + twinkle * (0.55 * sin(time * 2.3 + phase) + 0.45 * sin(time * 5.7 + phase * 1.7));
        vCol = color * tw;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = size * pxScale;
      }`,
    fragmentShader: /* glsl */ `
      uniform float intensity;
      varying vec3 vCol;
      void main(){
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float d2 = dot(p, p);
        float a = exp(-d2 * 5.5) + 0.25 * exp(-d2 * 1.6);
        if (a < 0.003) discard;
        gl_FragColor = vec4(vCol * a * intensity, 1.0);
      }`,
    uniforms: { pxScale: { value: 1 }, time: { value: 0 }, twinkle: { value: 0.12 }, intensity: { value: 1 } },
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    transparent: true,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = -9;
  return pts;
}

// Background group (sky + stars) that stays centred on the camera.
export class Starfield {
  constructor(sky, opts = {}) {
    this.group = new THREE.Group();
    this.skyMesh = createSkyMesh(sky);
    this.stars = createStars(sky, opts);
    this.group.add(this.skyMesh, this.stars);
  }
  update(camera, t, { skyIntensity = 1, starIntensity = 1, pxScale = 1, rotation = 0 } = {}) {
    this.group.position.copy(camera.position);
    this.group.rotation.y = rotation;
    this.skyMesh.material.uniforms.intensity.value = skyIntensity;
    this.stars.material.uniforms.intensity.value = starIntensity;
    this.stars.material.uniforms.pxScale.value = pxScale;
    this.stars.material.uniforms.time.value = t;
  }
}

// ---------------------------------------------------------------------------------------------
// Earth
// ---------------------------------------------------------------------------------------------
const PLANET_VS = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormalW, vPosW, vEastW, vNorthW;
void main(){
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vPosW = wp.xyz;
  vec3 P = normalize(position);
  vec3 east = cross(vec3(0.0, 1.0, 0.0), P);
  float el = length(east);
  east = el > 1e-4 ? east / el : vec3(1.0, 0.0, 0.0);
  vec3 north = cross(P, east);
  mat3 m = mat3(modelMatrix);
  vNormalW = normalize(m * normal);
  vEastW = normalize(m * east);
  vNorthW = normalize(m * north);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

// Tangent-space normal (x = east, y = north) -> world space.
const TANGENT_FRAME = /* glsl */ `
vec3 perturb(vec3 nTS){
  return normalize(normalize(vEastW) * nTS.x + normalize(vNorthW) * nTS.y + normalize(vNormalW) * nTS.z);
}
`;

const EARTH_FS = /* glsl */ `
uniform sampler2D tDay, tLights, tClouds, tWater, tNormal;
uniform vec3 sunDir, sunColor;
uniform float cloudShift, lightsGain, atmoStrength, cloudOpacity, bumpStrength, dayGain, specGain;
uniform float nightAmbient;
varying vec2 vUv;
varying vec3 vNormalW, vPosW, vEastW, vNorthW;
${TANGENT_FRAME}
void main(){
  vec3 Ng = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vPosW);
  vec3 L = normalize(sunDir);
  vec3 nTS = texture2D(tNormal, vUv).xyz * 2.0 - 1.0;
  nTS.xy *= bumpStrength;
  vec3 Nb = perturb(normalize(nTS));
  float water = texture2D(tWater, vUv).r;
  vec3 N = normalize(mix(Nb, Ng, water));

  float mu = dot(Ng, L);
  float NdV = max(dot(Ng, V), 0.0);
  float dayMask = smoothstep(-0.10, 0.22, mu);

  vec3 albedo = texture2D(tDay, vUv).rgb * dayGain;
  // deepen and saturate the oceans slightly
  albedo = mix(albedo, albedo * vec3(0.55, 0.85, 1.45) + vec3(0.0, 0.004, 0.012), water);

  vec2 cuv = vUv + vec2(cloudShift, 0.0);
  float cRaw = texture2D(tClouds, cuv).r;
  float cloud = smoothstep(0.06, 0.85, cRaw) * cloudOpacity;
  float cShadow = smoothstep(0.1, 0.8, texture2D(tClouds, cuv + vec2(0.0022, -0.0012)).r) * cloudOpacity;

  float wrap = clamp((dot(N, L) + 0.06) / 1.06, 0.0, 1.0);
  vec3 col = albedo * sunColor * wrap * (1.0 - 0.5 * cShadow * (1.0 - cloud));

  // ocean glint
  vec3 H = normalize(L + V);
  float NdH = max(dot(Ng, H), 0.0);
  float spec = pow(NdH, 420.0) * 0.32 + pow(NdH, 60.0) * 0.018;
  float fres = 0.02 + 0.98 * pow(1.0 - NdV, 5.0);
  col += water * (1.0 - cloud) * sunColor * spec * specGain * smoothstep(0.0, 0.12, mu) * (0.6 + fres);
  col += water * (1.0 - cloud) * vec3(0.03, 0.08, 0.2) * fres * dayMask;

  // clouds, with a warm tint near the terminator
  vec3 cloudTint = mix(vec3(1.0, 0.62, 0.42), vec3(1.0), smoothstep(0.0, 0.3, mu));
  vec3 cloudLit = cloudTint * sunColor * (smoothstep(-0.08, 0.6, mu) * 0.98 + 0.02);
  col = mix(col, cloudLit, cloud);

  // night side: city lights + faint ambient so the dark side is not pure black
  float lights = texture2D(tLights, vUv).r;
  float night = 1.0 - smoothstep(-0.22, 0.06, mu);
  vec3 lc = mix(vec3(1.0, 0.48, 0.14), vec3(1.0, 0.82, 0.5), smoothstep(0.2, 0.9, lights));
  col += lc * lights * lightsGain * night * (1.0 - cloud * 0.8);
  col += (albedo * 0.6 + vec3(cloud) * 0.5) * vec3(0.35, 0.5, 1.0) * nightAmbient * night;

  // atmosphere on the disc: Rayleigh-blue rim on the day side, orange at the terminator
  float rim = pow(1.0 - NdV, 2.2);
  float lit = smoothstep(-0.3, 0.45, mu);
  vec3 atmo = mix(vec3(0.95, 0.5, 0.3), vec3(0.28, 0.58, 1.0), smoothstep(-0.12, 0.12, mu));
  float atmoAmt = rim * lit * 0.92 * atmoStrength * mix(0.35, 1.0, smoothstep(-0.05, 0.25, mu));
  col = mix(col, atmo * 1.35, clamp(atmoAmt, 0.0, 1.0));
  col += vec3(0.018, 0.045, 0.11) * dayMask * (0.35 + rim) * atmoStrength;

  gl_FragColor = vec4(col, 1.0);
}
`;

const ATMO_FS = /* glsl */ `
uniform vec3 sunDir, center;
uniform float R, Ra, strength, falloff;
varying vec3 vPosW;
void main(){
  vec3 rd = normalize(vPosW - cameraPosition);
  vec3 oc = cameraPosition - center;
  float tca = -dot(oc, rd);
  vec3 pc = oc + rd * tca;
  float b = length(pc);
  float h = clamp((b - R) / (Ra - R), 0.0, 1.0);
  float dens = exp(-h * falloff) * (1.0 - h) * (1.0 - h);
  vec3 n = pc / max(b, 1e-5);
  vec3 L = normalize(sunDir);
  float mu = dot(n, L);
  float lit = smoothstep(-0.3, 0.3, mu);
  vec3 col = mix(vec3(0.9, 0.42, 0.22), vec3(0.26, 0.56, 1.0), smoothstep(-0.18, 0.12, mu));
  float cosT = dot(rd, L);
  float g = 0.8;
  float mie = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * cosT, 1.5) * 0.03;
  vec3 o = col * dens * lit * 1.6 + vec3(1.0, 0.85, 0.7) * mie * dens * smoothstep(-0.25, 0.15, mu);
  gl_FragColor = vec4(o * strength, 1.0);
}
`;

export class Earth {
  constructor(tex, { segments = 192 } = {}) {
    this.group = new THREE.Group(); // position + axial tilt
    this.spin = new THREE.Group(); // rotation about the polar axis
    this.group.add(this.spin);
    this.uniforms = {
      tDay: { value: tex.earthDay },
      tLights: { value: tex.earthLights },
      tClouds: { value: tex.earthClouds },
      tWater: { value: tex.earthWater },
      tNormal: { value: tex.earthNormal },
      sunDir: { value: new THREE.Vector3(-1, 0.2, 0.4).normalize() },
      sunColor: { value: new THREE.Vector3(1.9, 1.84, 1.75) },
      cloudShift: { value: 0 },
      lightsGain: { value: 3.2 },
      atmoStrength: { value: 1 },
      cloudOpacity: { value: 0.92 },
      bumpStrength: { value: 1 },
      dayGain: { value: 1.0 },
      specGain: { value: 1.0 },
      nightAmbient: { value: 0.012 },
    };
    this.surface = new THREE.Mesh(
      new THREE.SphereGeometry(1, segments, segments / 2),
      new THREE.ShaderMaterial({ vertexShader: PLANET_VS, fragmentShader: EARTH_FS, uniforms: this.uniforms }),
    );
    this.spin.add(this.surface);
    this.atmoUniforms = {
      sunDir: this.uniforms.sunDir,
      center: { value: new THREE.Vector3() },
      R: { value: 1 },
      Ra: { value: 1.045 },
      strength: { value: 1 },
      falloff: { value: 3.2 },
    };
    this.atmo = new THREE.Mesh(
      new THREE.SphereGeometry(1.045, 96, 48),
      new THREE.ShaderMaterial({
        vertexShader: PLANET_VS,
        fragmentShader: ATMO_FS,
        uniforms: this.atmoUniforms,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    );
    this.group.add(this.atmo);
  }
  setScale(s) {
    this.group.scale.setScalar(s);
  }
  update({ sunDir, spin = 0, cloudShift = 0 } = {}) {
    if (sunDir) this.uniforms.sunDir.value.copy(sunDir).normalize();
    this.spin.rotation.y = spin;
    this.uniforms.cloudShift.value = cloudShift;
    this.group.updateMatrixWorld(true);
    const c = this.atmoUniforms.center.value;
    this.group.getWorldPosition(c);
    const s = this.group.scale.x;
    this.atmoUniforms.R.value = s;
    this.atmoUniforms.Ra.value = 1.045 * s;
  }
}

// ---------------------------------------------------------------------------------------------
// Moon
// ---------------------------------------------------------------------------------------------
const MOON_FS = /* glsl */ `
uniform sampler2D tColor, tNormal;
uniform vec3 sunDir, sunColor;
uniform float normalStrength, glow, albedoGain, earthshine;
varying vec2 vUv;
varying vec3 vNormalW, vPosW, vEastW, vNorthW;
${TANGENT_FRAME}
void main(){
  vec3 Ng = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vPosW);
  vec3 L = normalize(sunDir);
  vec3 nTS = texture2D(tNormal, vUv).xyz * 2.0 - 1.0;
  nTS.xy *= normalStrength;
  vec3 N = perturb(normalize(nTS));
  float mu0 = max(dot(N, L), 0.0);
  float mu = max(dot(N, V), 0.0);
  float ls = 2.0 * mu0 / max(mu0 + mu, 1e-3);
  float term = smoothstep(-0.03, 0.06, dot(Ng, L));
  float shade = mix(mu0, ls * 0.62, 0.45) * term;
  vec3 albedo = texture2D(tColor, vUv).rgb * albedoGain;
  vec3 col = albedo * sunColor * shade;
  col += albedo * vec3(0.30, 0.42, 0.75) * earthshine;
  float rim = pow(1.0 - max(dot(Ng, V), 0.0), 2.0);
  col = mix(col, vec3(0.8, 0.9, 1.0) * 2.5, clamp(glow * glow, 0.0, 1.0));
  col += vec3(0.5, 0.72, 1.0) * glow * rim * 1.2;
  gl_FragColor = vec4(col, 1.0);
}
`;

export class Moon {
  constructor(tex) {
    this.group = new THREE.Group();
    this.uniforms = {
      tColor: { value: tex.moonColor },
      tNormal: { value: tex.moonNormal },
      sunDir: { value: new THREE.Vector3(-1, 0.2, 0.4).normalize() },
      sunColor: { value: new THREE.Vector3(2.1, 2.05, 1.98) },
      normalStrength: { value: 1.0 },
      glow: { value: 0 },
      albedoGain: { value: 1.35 },
      earthshine: { value: 0.02 },
    };
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 128, 64),
      new THREE.ShaderMaterial({ vertexShader: PLANET_VS, fragmentShader: MOON_FS, uniforms: this.uniforms }),
    );
    this.group.add(this.mesh);
  }
  // Tidally locked: rotate so the near side (texture centre, local +X) faces `target`.
  faceTowards(target) {
    const p = new THREE.Vector3();
    this.group.getWorldPosition(p);
    const dir = target.clone().sub(p).normalize();
    this.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
  }
}
