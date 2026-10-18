import * as THREE from 'three';
import { rng, clamp } from '../core/util.js';

// ---------------------------------------------------------------------------------------------
// Moon vanish: glowing dust burst + expanding ring, driven by `age` (seconds since vanish).
// ---------------------------------------------------------------------------------------------
export class VanishFX {
  constructor({ count = 1400, seed = 3 } = {}) {
    const r = rng(seed);
    const dir = new Float32Array(count * 3);
    const speed = new Float32Array(count);
    const size = new Float32Array(count);
    const tint = new Float32Array(count);
    const v = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      for (;;) {
        v.set(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1);
        const l = v.length();
        if (l > 0.05 && l <= 1) {
          v.divideScalar(l);
          break;
        }
      }
      dir.set([v.x, v.y, v.z], i * 3);
      speed[i] = 0.4 + Math.pow(r(), 2.0) * 2.8;
      size[i] = 1.2 + Math.pow(r(), 4) * 6;
      tint[i] = r();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(dir, 3));
    geo.setAttribute('speed', new THREE.BufferAttribute(speed, 1));
    geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('tint', new THREE.BufferAttribute(tint, 1));
    this.uniforms = {
      age: { value: -1 },
      radius: { value: 0.27 },
      pxScale: { value: 1 },
      intensity: { value: 1 },
    };
    this.points = new THREE.Points(
      geo,
      new THREE.ShaderMaterial({
        vertexShader: /* glsl */ `
          attribute float speed; attribute float size; attribute float tint;
          uniform float age, radius, pxScale;
          varying float vA; varying float vT;
          void main(){
            float a = max(age, 0.0);
            float travel = speed * a * (1.0 - 0.32 * min(a, 1.4)) * radius * 1.6;
            vec3 p = position * (radius * (0.92 + 0.08 * tint) + travel);
            // gentle swirl
            float sw = a * (0.6 + tint);
            p.xz = mat2(cos(sw * 0.4), -sin(sw * 0.4), sin(sw * 0.4), cos(sw * 0.4)) * p.xz;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            float life = exp(-a * (2.2 + 2.5 * tint)) * (1.0 - smoothstep(0.7, 1.3, a));
            vA = age < 0.0 ? 0.0 : life;
            vT = tint;
            gl_PointSize = size * pxScale * (1.0 + a * 0.6) * (420.0 / max(-mv.z, 0.1)) / 160.0;
          }`,
        fragmentShader: /* glsl */ `
          uniform float intensity;
          varying float vA; varying float vT;
          void main(){
            if (vA <= 0.002) discard;
            vec2 p = gl_PointCoord * 2.0 - 1.0;
            float d = dot(p, p);
            float g = exp(-d * 4.0);
            vec3 c = mix(vec3(0.7, 0.84, 1.0), vec3(1.0, 0.93, 0.85), vT) * (0.9 + 2.6 * vT * vT);
            gl_FragColor = vec4(c * g * vA * intensity, 1.0);
          }`,
        uniforms: this.uniforms,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
      }),
    );
    this.points.frustumCulled = false;

    this.ringUniforms = { age: { value: -1 }, radius: { value: 0.27 } };
    this.ring = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          uniform float age, radius;
          void main(){
            vUv = uv * 2.0 - 1.0;
            float s = radius * 3.2;
            vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
            mv.xy += position.xy * s;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          uniform float age;
          varying vec2 vUv;
          void main(){
            if (age < 0.0) discard;
            float r = length(vUv);
            float R = 0.08 + 0.85 * (1.0 - exp(-age * 4.0));
            float w = 0.006 + 0.018 * age;
            float ring = exp(-pow((r - R) / w, 2.0));
            float core = exp(-r * r * 1400.0) * exp(-age * 18.0) * 4.0 + exp(-r * r * 90.0) * exp(-age * 12.0) * 0.25;
            float fade = exp(-age * 5.5) * (1.0 - smoothstep(0.55, 0.9, R));
            vec3 c = vec3(0.55, 0.78, 1.0) * ring * 0.9 * fade + vec3(1.0, 0.95, 0.9) * core;
            gl_FragColor = vec4(c, 1.0);
          }`,
        uniforms: this.ringUniforms,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
        transparent: true,
      }),
    );
    this.ring.frustumCulled = false;
    this.group = new THREE.Group();
    this.group.add(this.points, this.ring);
  }
  update(age, position, radius, pxScale) {
    this.group.position.copy(position);
    this.uniforms.age.value = age;
    this.uniforms.radius.value = radius;
    this.uniforms.pxScale.value = pxScale;
    this.ringUniforms.age.value = age;
    this.ringUniforms.radius.value = radius;
    this.group.visible = age >= 0 && age < 2.0;
  }
}

// ---------------------------------------------------------------------------------------------
// Glowing tube along a curve that can "grow" (progress 0..1) and fade along its length.
// ---------------------------------------------------------------------------------------------
export class GlowTube {
  constructor(curve, { radius = 0.02, segments = 256, radial = 10, color = [0.3, 0.7, 1.0], intensity = 3, closed = false } = {}) {
    this.uniforms = {
      color: { value: new THREE.Vector3(...color) },
      intensity: { value: intensity },
      progress: { value: 1 },
      start: { value: 0 },
      opacity: { value: 1 },
      headFade: { value: 0 },
      tailFade: { value: 0 },
      dash: { value: 0 },
      dashOffset: { value: 0 },
      trailHead: { value: 0 },
      trailLen: { value: 0 },
      baseAlpha: { value: 1 },
    };
    const geo = new THREE.TubeGeometry(curve, segments, radius, radial, closed);
    this.mesh = new THREE.Mesh(
      geo,
      new THREE.ShaderMaterial({
        vertexShader: /* glsl */ `
          varying vec2 vUv; varying vec3 vN; varying vec3 vV;
          void main(){
            vUv = uv;
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vN = normalize(mat3(modelMatrix) * normal);
            vV = normalize(cameraPosition - wp.xyz);
            gl_Position = projectionMatrix * viewMatrix * wp;
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 color; uniform float intensity, progress, start, opacity, headFade, tailFade, dash, dashOffset;
          uniform float trailHead, trailLen, baseAlpha;
          varying vec2 vUv; varying vec3 vN; varying vec3 vV;
          void main(){
            float u = vUv.x;
            if (u > progress || u < start) discard;
            if (dash > 0.0 && fract(u * dash + dashOffset) > 0.55) discard;
            float edge = pow(max(dot(normalize(vN), normalize(vV)), 0.0), 0.6);
            float a = opacity;
            if (trailLen > 0.0) {
              float d = fract(trailHead - u);
              a *= mix(baseAlpha, 1.0, exp(-d / trailLen));
            }
            if (headFade > 0.0) a *= smoothstep(progress, progress - headFade, u);
            if (tailFade > 0.0) a *= smoothstep(start, start + tailFade, u);
            gl_FragColor = vec4(color * intensity * (0.35 + 0.65 * edge) * a, 1.0);
          }`,
        uniforms: this.uniforms,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
      }),
    );
    this.mesh.frustumCulled = false;
  }
}

// Arrow = glowing tube shaft + cone head; grows with `progress`.
export class GlowArrow {
  constructor(points, { radius = 0.03, headLen = 0.18, headRadius = 0.08, color = [0.25, 0.65, 1.0], intensity = 3.5 } = {}) {
    this.curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    this.tube = new GlowTube(this.curve, { radius, color, intensity, segments: 128 });
    this.headLen = headLen;
    this.head = new THREE.Mesh(
      new THREE.ConeGeometry(headRadius, headLen, 24),
      new THREE.ShaderMaterial({
        vertexShader: /* glsl */ `
          varying vec3 vN; varying vec3 vV;
          void main(){
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vN = normalize(mat3(modelMatrix) * normal);
            vV = normalize(cameraPosition - wp.xyz);
            gl_Position = projectionMatrix * viewMatrix * wp;
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 color; uniform float intensity, opacity;
          varying vec3 vN; varying vec3 vV;
          void main(){
            float edge = pow(abs(dot(normalize(vN), normalize(vV))), 0.5);
            gl_FragColor = vec4(color * intensity * (0.45 + 0.55 * edge) * opacity, 1.0);
          }`,
        uniforms: { color: this.tube.uniforms.color, intensity: this.tube.uniforms.intensity, opacity: this.tube.uniforms.opacity },
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
      }),
    );
    this.group = new THREE.Group();
    this.group.add(this.tube.mesh, this.head);
    this.len = this.curve.getLength();
  }
  set(progress, opacity = 1) {
    const p = clamp(progress);
    this.group.visible = p > 0.001 && opacity > 0.001;
    // leave room for the head
    const shaftEnd = Math.max(0, p - this.headLen / this.len);
    this.tube.uniforms.progress.value = shaftEnd;
    this.tube.uniforms.opacity.value = opacity;
    const tip = this.curve.getPointAt(Math.max(p, 0.001));
    const tan = this.curve.getTangentAt(Math.max(p, 0.001));
    this.head.position.copy(tip).addScaledVector(tan, -this.headLen / 2);
    this.head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tan);
    this.head.visible = p > 0.02;
  }
}

// ---------------------------------------------------------------------------------------------
// Ocean tidal bulge: translucent water envelope stretched along an axis (exaggerated for clarity).
// ---------------------------------------------------------------------------------------------
export class TideBulge {
  constructor() {
    this.uniforms = {
      time: { value: 0 },
      opacity: { value: 1 },
      color: { value: new THREE.Vector3(0.16, 0.55, 1.0) },
    };
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 128, 64),
      new THREE.ShaderMaterial({
        vertexShader: /* glsl */ `
          varying vec3 vN, vW, vO;
          void main(){
            vO = position;
            vec4 w = modelMatrix * vec4(position, 1.0);
            vW = w.xyz;
            vN = normalize(normalMatrix * normal);
            vN = normalize((inverse(viewMatrix) * vec4(vN, 0.0)).xyz);
            gl_Position = projectionMatrix * viewMatrix * w;
          }`,
        fragmentShader: /* glsl */ `
          uniform float time, opacity;
          uniform vec3 color;
          varying vec3 vN, vW, vO;
          void main(){
            vec3 V = normalize(cameraPosition - vW);
            float f = 1.0 - abs(dot(normalize(vN), V));
            float rings = 0.5 + 0.5 * sin(vO.x * 26.0 - time * 3.0);
            float edge = pow(f, 2.2);
            vec3 c = color * (0.55 + 1.8 * edge) + vec3(0.6, 0.9, 1.0) * edge * edge * 1.4;
            c *= 0.9 + 0.2 * rings;
            float a = (0.07 + 0.66 * edge) * opacity;
            gl_FragColor = vec4(c * a, a);
          }`,
        uniforms: this.uniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.CustomBlending,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
      }),
    );
    this.group = new THREE.Group();
    this.group.add(this.mesh);
  }
  // axis: unit vector in world space; stretch: fractional elongation along the axis
  set(center, axis, stretch, baseR, t, opacity = 1) {
    this.group.position.copy(center);
    this.group.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), axis);
    const along = baseR * (1 + stretch);
    const across = baseR;
    this.mesh.scale.set(along, across, across);
    this.uniforms.time.value = t;
    this.uniforms.opacity.value = opacity;
    this.group.visible = opacity > 0.001;
  }
}
