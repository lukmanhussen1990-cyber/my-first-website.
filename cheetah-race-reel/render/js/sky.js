import * as THREE from 'three';
import { GLSL_NOISE } from './util.js';

// Low sun behind the scene, a little left of the camera axis, so the sunset
// glow sits in the upper part of the frame and backlights grass and fur.
export const SUN_DIR = new THREE.Vector3(-0.15, 0.15, -0.977).normalize();
export const SUN_COLOR = new THREE.Color(1.0, 0.56, 0.24);

const skyVert = /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww; // always at the far plane
}`;

export const skyFragBody = /* glsl */ `
uniform vec3 uSun;
uniform float uGround; // 1 = render a warm ground below the horizon (env map)
uniform float uGain;   // brightness of the visible sky (the env map keeps 1.0)
${GLSL_NOISE}
vec3 skyColor(vec3 d){
  float el = d.y;
  float cosSun = dot(d, uSun);
  // base vertical gradient (linear HDR): golden horizon -> coral -> violet -> deep blue
  vec3 zenith = vec3(0.035, 0.045, 0.16);
  vec3 upper  = vec3(0.26, 0.09, 0.27);
  vec3 lower  = vec3(1.15, 0.36, 0.15);
  vec3 horiz  = vec3(2.1, 0.86, 0.2);
  float e = max(el, 0.0);
  vec3 c = mix(horiz, lower, smoothstep(0.0, 0.15, e));
  c = mix(c, upper, smoothstep(0.13, 0.42, e));
  c = mix(c, zenith, smoothstep(0.42, 0.95, e));
  // the side facing away from the sun is cooler and pinker (belt of Venus)
  float away = smoothstep(0.2, -0.9, cosSun);
  vec3 antiH = vec3(1.0, 0.48, 0.42);
  c = mix(c, mix(antiH, upper * 1.1, smoothstep(0.0, 0.3, e)), away * 0.6 * (1.0 - smoothstep(0.3, 0.8, e)));
  // sun glow (broad + tight) and disk
  float g = max(cosSun, 0.0);
  c += vec3(1.5, 0.52, 0.1) * pow(g, 18.0) * 0.65;
  c += vec3(2.8, 1.35, 0.4) * pow(g, 120.0);
  c += vec3(3.5, 2.4, 1.0) * pow(g, 1600.0);
  float disk = smoothstep(0.99935, 0.99965, cosSun);
  c = mix(c, vec3(15.0, 10.0, 4.2), disk);
  // stylized cloud streaks lit from below by the sun
  if (el > 0.0) {
    float az = atan(d.x, -d.z);
    vec2 q = vec2(az * 3.2, el * 26.0);
    float n = fbm2(q * vec2(1.0, 1.0) + vec2(0.0, 3.0));
    float band = smoothstep(0.035, 0.09, el) * (1.0 - smoothstep(0.18, 0.34, el));
    float dens = smoothstep(0.53, 0.72, n + 0.08 * fbm2(q * 4.0)) * band;
    vec3 lit = mix(vec3(1.3, 0.42, 0.42), vec3(2.8, 1.25, 0.42), pow(g, 3.0));
    vec3 shade = vec3(0.3, 0.14, 0.32);
    float edge = smoothstep(0.55, 0.85, n);
    vec3 cc = mix(lit, shade, edge * 0.55);
    c = mix(c, cc, dens * 0.85);
  }
  // below the horizon: warm haze, darker ground in the env map
  if (el < 0.0) {
    vec3 haze = mix(horiz * 0.85, vec3(0.8, 0.4, 0.22), smoothstep(0.0, -0.08, el));
    vec3 ground = vec3(0.32, 0.2, 0.1);
    c = mix(haze, ground, uGround * smoothstep(0.0, -0.2, el));
    c += vec3(1.2, 0.6, 0.25) * pow(g, 8.0) * (1.0 - smoothstep(0.0, -0.1, el));
  }
  return c;
}`;

export function makeSky() {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uSun: { value: SUN_DIR.clone() }, uGround: { value: 0 }, uGain: { value: 0.78 } },
    vertexShader: skyVert,
    fragmentShader: skyFragBody + `
varying vec3 vDir;
void main(){
  vec3 c = skyColor(normalize(vDir));
  // keep the sun itself hot for bloom, tone the rest of the sky down
  float hot = smoothstep(0.9993, 0.9997, dot(normalize(vDir), uSun));
  gl_FragColor = vec4(c * mix(uGain, 1.0, hot), 1.0);
}`,
    side: THREE.BackSide, depthWrite: false, depthTest: true,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1000, 64, 32), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  return { mesh, mat, follow(cam) { mesh.position.copy(cam.position); } };
}

export function makeEnvironment(renderer) {
  const scene = new THREE.Scene();
  const sky = makeSky();
  sky.mat.uniforms.uGround.value = 1;
  sky.mat.uniforms.uGain.value = 1;
  scene.add(sky.mesh);
  const rt = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType });
  const cc = new THREE.CubeCamera(0.1, 2000, rt);
  cc.update(renderer, scene);
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromCubemap(rt.texture).texture;
  rt.dispose(); pm.dispose();
  return env;
}
