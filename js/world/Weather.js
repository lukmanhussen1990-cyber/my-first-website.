// Rain streaks streaming past the car (lit by the headlights and nearby
// lamps), splashes on the asphalt in the beams, wetness and lightning.

import * as THREE from 'three';
import { CAR, LAYER } from '../config.js';
import { U } from './shared.js';
import { RNG } from '../core/rng.js';
import { damp } from '../core/math.js';

const RAIN_VERT = /* glsl */ `
attribute vec4 aSeed;
uniform vec3 uOffset;
uniform vec3 uBoxMin;
uniform vec3 uBoxSize;
uniform vec3 uRelVel;
uniform float uRain;
uniform vec3 uCabinMin;
uniform vec3 uCabinMax;
uniform vec3 uHeadL;
uniform vec3 uHeadR;
uniform vec4 uLamps[3];
uniform vec3 uLampCol[3];
uniform float uHeadOn;
varying float vAlpha;
varying vec2 vQ;
varying vec3 vCol;

float beam(vec3 p, vec3 h) {
  vec3 d = p - h;
  float dist = length(d);
  vec3 n = d / max(dist, 1e-3);
  float cone = smoothstep(0.8, 0.97, -n.z);
  float cut = 1.0 - smoothstep(0.0, 0.07, n.y + 0.01);
  return cone * cut / (1.0 + dist * dist * 0.012);
}

void main() {
  vec3 p = uBoxMin + mod(aSeed.xyz * uBoxSize + uOffset * (0.85 + aSeed.w * 0.3), uBoxSize);
  bool isActive = aSeed.w < uRain;
  bool inCabin = all(greaterThan(p, uCabinMin - 0.15)) && all(lessThan(p, uCabinMax + 0.15));
  // Streak along the relative velocity (motion blur over ~1/45 s).
  vec3 v = uRelVel * (0.85 + aSeed.w * 0.3);
  float len = clamp(length(v) / 45.0, 0.12, 0.9);
  vec3 dir = normalize(v);
  vec3 a = p;
  vec3 b = p - dir * len;
  vec3 mvA = (modelViewMatrix * vec4(a, 1.0)).xyz;
  vec3 mvB = (modelViewMatrix * vec4(b, 1.0)).xyz;
  vec3 axis = mvB - mvA;
  vec3 side = normalize(cross(axis, mvA));
  float width = 0.0035 + 0.0012 * length(mvA) * 0.05;
  vec3 mv = mix(mvA, mvB, position.y) + side * position.x * width;
  gl_Position = projectionMatrix * vec4(mv, 1.0);
  if (!isActive || inCabin) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  vQ = position.xy;
  float lit = (beam(p, uHeadL) + beam(p, uHeadR)) * uHeadOn * 6.0;
  vec3 col = vec3(1.0, 0.95, 0.86) * lit;
  for (int i = 0; i < 3; i++) {
    vec3 d = p - uLamps[i].xyz;
    float dd = dot(d, d);
    col += uLampCol[i] * uLamps[i].w / (dd + 2.0);
  }
  col += vec3(0.03, 0.035, 0.05);
  vCol = col;
  vAlpha = smoothstep(0.0, 1.5, -mvA.z) * (0.35 + 0.65 * aSeed.w);
}
`;

const RAIN_FRAG = /* glsl */ `
varying float vAlpha;
varying vec2 vQ;
varying vec3 vCol;
void main() {
  float across = 1.0 - abs(vQ.x);
  float along = smoothstep(0.0, 0.25, vQ.y) * smoothstep(1.0, 0.6, vQ.y);
  float a = across * across * along * vAlpha;
  gl_FragColor = vec4(vCol * a * 0.55, 1.0);
}
`;

const SPLASH_VERT = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime;
uniform float uRain;
uniform vec3 uHeadL;
uniform vec3 uHeadR;
uniform float uHeadOn;
uniform vec2 uScroll;
varying vec2 vQ;
varying float vI;
float beam(vec3 p, vec3 h) {
  vec3 d = p - h;
  float dist = length(d);
  vec3 n = d / max(dist, 1e-3);
  return smoothstep(0.75, 0.97, -n.z) / (1.0 + dist * dist * 0.01);
}
void main() {
  // Splashes live on the road ahead in car space; they cycle quickly.
  float life = fract(uTime * (2.5 + aSeed.w * 2.0) + aSeed.z * 7.0);
  float cyc = floor(uTime * (2.5 + aSeed.w * 2.0) + aSeed.z * 7.0);
  vec2 r = fract(aSeed.xy + vec2(cyc * 0.618, cyc * 0.381));
  vec3 p = vec3(-4.2 + r.x * 8.4, 0.03, -3.0 - r.y * 34.0);
  float h = sin(life * 3.14159) * (0.05 + aSeed.w * 0.06);
  vec3 c = p + vec3(0.0, h, 0.0);
  vec4 mv = modelViewMatrix * vec4(c, 1.0);
  float size = 0.025 + aSeed.z * 0.02;
  mv.xy += position.xy * size;
  gl_Position = projectionMatrix * mv;
  vQ = position.xy;
  vI = (beam(p, uHeadL) + beam(p, uHeadR)) * uHeadOn * (1.0 - life) * step(aSeed.w, uRain) * 3.0;
}
`;

const SPLASH_FRAG = /* glsl */ `
varying vec2 vQ;
varying float vI;
void main() {
  float d = length(vQ);
  float a = smoothstep(1.0, 0.2, d);
  gl_FragColor = vec4(vec3(1.0, 0.95, 0.88) * a * vI * 0.6, 1.0);
}
`;

export class Weather {
  constructor(scene, car, quality) {
    this.car = car;
    const count = quality.rain;
    const rng = new RNG(77);
    const quad = new THREE.InstancedBufferGeometry();
    quad.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, 1, 1, 0, -1, 1, 0], 3));
    quad.setIndex([0, 1, 2, 0, 2, 3]);
    const seeds = new Float32Array(count * 4);
    for (let i = 0; i < count * 4; i++) seeds[i] = rng.next();
    quad.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
    quad.instanceCount = count;
    this.boxMin = new THREE.Vector3(-13, -0.5, -46);
    this.boxSize = new THREE.Vector3(26, 13, 52);
    this.uniforms = {
      uOffset: { value: new THREE.Vector3() },
      uBoxMin: { value: this.boxMin },
      uBoxSize: { value: this.boxSize },
      uRelVel: { value: new THREE.Vector3(0, -9, 0) },
      uRain: U.uRain,
      uCabinMin: { value: new THREE.Vector3(...CAR.cabinMin) },
      uCabinMax: { value: new THREE.Vector3(...CAR.cabinMax) },
      uHeadL: { value: new THREE.Vector3(CAR.headlights[0].x, CAR.headlights[0].y, CAR.headlights[0].z) },
      uHeadR: { value: new THREE.Vector3(CAR.headlights[1].x, CAR.headlights[1].y, CAR.headlights[1].z) },
      uLamps: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] },
      uLampCol: { value: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] },
      uHeadOn: U.uHeadOn,
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: RAIN_VERT,
      fragmentShader: RAIN_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.rain = new THREE.Mesh(quad, mat);
    this.rain.frustumCulled = false;
    this.rain.layers.set(LAYER.NO_REFLECT);
    this.rain.renderOrder = 10;
    car.group.add(this.rain);

    const sCount = Math.round(count * 0.12);
    const sq = new THREE.InstancedBufferGeometry();
    sq.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
    sq.setIndex([0, 1, 2, 0, 2, 3]);
    const ss = new Float32Array(sCount * 4);
    for (let i = 0; i < sCount * 4; i++) ss[i] = rng.next();
    sq.setAttribute('aSeed', new THREE.InstancedBufferAttribute(ss, 4));
    sq.instanceCount = sCount;
    this.splashUniforms = {
      uTime: U.uTime,
      uRain: U.uRain,
      uHeadL: this.uniforms.uHeadL,
      uHeadR: this.uniforms.uHeadR,
      uHeadOn: U.uHeadOn,
      uScroll: { value: new THREE.Vector2() },
    };
    this.splash = new THREE.Mesh(sq, new THREE.ShaderMaterial({
      uniforms: this.splashUniforms,
      vertexShader: SPLASH_VERT,
      fragmentShader: SPLASH_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    this.splash.frustumCulled = false;
    this.splash.layers.set(LAYER.NO_REFLECT);
    this.splash.renderOrder = 11;
    car.group.add(this.splash);

    this.offset = new THREE.Vector3();
    this.rainLevel = 0;
    this.wetness = 0.65;
    this.lightning = 0;
    this.flashQueue = [];
    this.onThunder = null;
    this._inv = new THREE.Matrix4();
    this._v = new THREE.Vector3();
  }

  /** A lightning strike: a few rapid flickers; thunder follows via onThunder. */
  strike(distance = 0.5) {
    const t0 = performance.now() / 1000;
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) this.flashQueue.push({ t: t0 + i * (0.06 + Math.random() * 0.12), a: 0.6 + Math.random() * 0.4 });
    if (this.onThunder) this.onThunder(distance);
  }

  update(dt, { rain, wind, lamps }) {
    this.rainLevel = damp(this.rainLevel, rain, 0.6, dt);
    U.uRain.value = this.rainLevel;
    // Road gets wet quickly, dries very slowly.
    const targetWet = Math.max(0.55, Math.min(1, this.rainLevel * 2.2));
    this.wetness = targetWet > this.wetness ? damp(this.wetness, targetWet, 0.5, dt) : damp(this.wetness, targetWet, 0.02, dt);
    U.uWetness.value = this.wetness;

    // Rain velocity relative to the car, in car space.
    const car = this.car;
    this._inv.copy(car.group.matrixWorld).invert();
    const worldVel = this._v.set(wind.x * 3, -8.5, wind.y * 3);
    const local = worldVel.transformDirection(this._inv).multiplyScalar(worldVel.length());
    const rel = this.uniforms.uRelVel.value.set(local.x, local.y, local.z + car.v);
    this.offset.addScaledVector(rel, dt);
    this.uniforms.uOffset.value.copy(this.offset);

    // Nearest lamps in car space.
    const L = this.uniforms.uLamps.value;
    const C = this.uniforms.uLampCol.value;
    for (let i = 0; i < 3; i++) {
      const lamp = lamps[i];
      if (lamp && lamp.level > 0.01) {
        const p = this._v.copy(lamp.pos).applyMatrix4(this._inv);
        L[i].set(p.x, p.y, p.z, lamp.level * lamp.intensity * 0.02);
        C[i].set(lamp.color.r, lamp.color.g, lamp.color.b);
      } else {
        L[i].w = 0;
      }
    }

    // Lightning envelope.
    const now = performance.now() / 1000;
    let flash = 0;
    this.flashQueue = this.flashQueue.filter((f) => {
      const age = now - f.t;
      if (age < 0) return true;
      flash = Math.max(flash, f.a * Math.exp(-age * 9));
      return age < 1.2;
    });
    this.lightning = flash;
    U.uLightning.value = flash;
  }
}
