// Sky dome: gradient + stars + big moon + optional sun glow and storm clouds.
import * as THREE from 'three';
import { GLSL_NOISE } from '../util.js';

export const SKY_PRESETS = {
  night: {
    top: [0.002, 0.006, 0.02], horizon: [0.02, 0.055, 0.11], bottom: [0.008, 0.02, 0.045],
    stars: 1.0, moon: 1.0, sun: 0.0, sunColor: [1, 0.5, 0.2], clouds: 0.0, cloudColor: [0.05, 0.07, 0.1],
  },
  sunset: {
    top: [0.03, 0.04, 0.12], horizon: [1.1, 0.42, 0.16], bottom: [0.25, 0.12, 0.12],
    stars: 0.0, moon: 0.25, sun: 1.0, sunColor: [1.3, 0.55, 0.2], clouds: 0.25, cloudColor: [0.55, 0.25, 0.25],
  },
  storm: {
    top: [0.015, 0.02, 0.03], horizon: [0.06, 0.075, 0.09], bottom: [0.03, 0.035, 0.045],
    stars: 0.0, moon: 0.0, sun: 0.0, sunColor: [0, 0, 0], clouds: 1.0, cloudColor: [0.07, 0.085, 0.1],
  },
  dawn: {
    top: [0.08, 0.17, 0.42], horizon: [1.0, 0.55, 0.62], bottom: [0.35, 0.3, 0.42],
    stars: 0.08, moon: 0.15, sun: 0.6, sunColor: [1.2, 0.6, 0.45], clouds: 0.12, cloudColor: [0.9, 0.55, 0.6],
  },
  sunrise: {
    top: [0.12, 0.26, 0.55], horizon: [1.25, 0.72, 0.45], bottom: [0.45, 0.38, 0.4],
    stars: 0.0, moon: 0.0, sun: 1.0, sunColor: [1.6, 0.9, 0.5], clouds: 0.1, cloudColor: [1.0, 0.7, 0.55],
  },
};

export function createSky() {
  const uniforms = {
    uTop: { value: new THREE.Vector3() },
    uHorizon: { value: new THREE.Vector3() },
    uBottom: { value: new THREE.Vector3() },
    uStars: { value: 1 },
    uMoon: { value: 1 },
    uMoonDir: { value: new THREE.Vector3(0.32, 0.36, -0.88).normalize() },
    uMoonSize: { value: 0.034 },
    uSun: { value: 0 },
    uSunDir: { value: new THREE.Vector3(-0.55, 0.035, -0.83).normalize() },
    uSunColor: { value: new THREE.Vector3(1, 0.5, 0.2) },
    uClouds: { value: 0 },
    uCloudColor: { value: new THREE.Vector3() },
    uTime: { value: 0 },
    uBright: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.); gl_Position = p.xyww; }`,
    fragmentShader: GLSL_NOISE + /* glsl */ `
      uniform vec3 uTop, uHorizon, uBottom, uMoonDir, uSunDir, uSunColor, uCloudColor;
      uniform float uStars, uMoon, uMoonSize, uSun, uClouds, uTime, uBright;
      varying vec3 vDir;
      float starLayer(vec2 p, float dens, float sz){
        vec2 i = floor(p), f = fract(p);
        float h = hash12(i);
        if (h > dens) return 0.;
        vec2 o = hash22(i + 3.7) * 0.8 + 0.1;
        float d = length(f - o);
        float b = pow(hash12(i + 11.1), 6.) * 2.5 + 0.25;
        float tw = 0.75 + 0.25*sin(uTime*(1.5 + 3.0*hash12(i+5.)) + h*40.);
        return b * tw * smoothstep(sz, 0., d);
      }
      void main(){
        vec3 d = normalize(vDir);
        float e = d.y;
        vec3 col = e > 0. ? mix(uHorizon, uTop, pow(smoothstep(0., 0.75, e), 0.65)) : mix(uHorizon, uBottom, smoothstep(0., -0.25, e));
        // stars
        if (uStars > 0.) {
          float az = atan(d.x, -d.z);
          vec2 sp = vec2(az * 3.0, asin(clamp(e, -1., 1.)) * 3.0);
          float s = starLayer(sp*60., 0.11, 0.09) + starLayer(sp*130. + 7.3, 0.07, 0.12)*0.6 + starLayer(sp*24. + 2.1, 0.035, 0.06)*1.6;
          // faint milky band
          float band = exp(-pow((sp.y*0.9 - sp.x*0.35 - 0.6), 2.) * 3.) * (0.6 + 0.8*fbm(sp*6.));
          col += vec3(0.75, 0.85, 1.0) * s * uStars * smoothstep(0.0, 0.12, e);
          col += vec3(0.04, 0.06, 0.1) * band * uStars * smoothstep(0.02, 0.3, e) * 0.5;
        }
        // moon
        if (uMoon > 0.) {
          float md = acos(clamp(dot(d, uMoonDir), -1., 1.));
          vec3 right = normalize(cross(uMoonDir, vec3(0,1,0)));
          vec3 up = cross(right, uMoonDir);
          vec2 mp = vec2(dot(d, right), dot(d, up)) / uMoonSize;
          float disc = smoothstep(1.0, 0.97, md / uMoonSize);
          float crater = fbm(mp*2.3 + 3.1)*0.55 + fbm(mp*6.0)*0.25;
          float limb = sqrt(max(0., 1. - dot(mp,mp)));
          vec3 moonC = vec3(1.0, 0.98, 0.92) * (0.62 + 0.45*limb) * (1.15 - crater*0.75);
          col = mix(col, moonC * 3.2, disc * uMoon);
          float glow = exp(-md / uMoonSize * 0.9) * 0.55 + exp(-md * 7.0) * 0.18;
          col += vec3(0.55, 0.68, 0.9) * glow * uMoon * (1. - disc);
        }
        // sun glow near the horizon
        if (uSun > 0.) {
          float sd = max(dot(d, uSunDir), 0.);
          col += uSunColor * (pow(sd, 6.) * 0.6 + pow(sd, 60.) * 1.5 + pow(sd, 900.) * 8.) * uSun;
        }
        // clouds
        if (uClouds > 0.) {
          vec2 cp = d.xz / max(d.y + 0.08, 0.04);
          float c = fbm(cp * 0.55 + vec2(uTime*0.02, 0.)) ;
          float cov = smoothstep(0.42, 0.75, c) * smoothstep(-0.05, 0.25, e);
          col = mix(col, uCloudColor * (0.6 + 0.8*fbm(cp*1.7)), cov * uClouds);
        }
        gl_FragColor = vec4(col * uBright, 1.);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), mat);
  mesh.scale.setScalar(1500);
  mesh.renderOrder = -100;
  mesh.frustumCulled = false;
  mesh.userData.uniforms = uniforms;

  function setPreset(a, b = null, k = 0) {
    const A = SKY_PRESETS[a], B = b ? SKY_PRESETS[b] : A;
    const mix = (x, y) => x.map((v, i) => v + (y[i] - v) * k);
    uniforms.uTop.value.fromArray(mix(A.top, B.top));
    uniforms.uHorizon.value.fromArray(mix(A.horizon, B.horizon));
    uniforms.uBottom.value.fromArray(mix(A.bottom, B.bottom));
    uniforms.uStars.value = A.stars + (B.stars - A.stars) * k;
    uniforms.uMoon.value = A.moon + (B.moon - A.moon) * k;
    uniforms.uSun.value = A.sun + (B.sun - A.sun) * k;
    uniforms.uSunColor.value.fromArray(mix(A.sunColor, B.sunColor));
    uniforms.uClouds.value = A.clouds + (B.clouds - A.clouds) * k;
    uniforms.uCloudColor.value.fromArray(mix(A.cloudColor, B.cloudColor));
  }
  setPreset('night');
  return { mesh, uniforms, setPreset };
}
