import * as THREE from 'three';
import { GLSL_NOISE } from '../core/util.js';

// Sun: granulated, limb-darkened HDR sphere plus a camera-facing corona.
export class Sun {
  constructor() {
    this.uniforms = { time: { value: 0 }, intensity: { value: 6 } };
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 96, 48),
      new THREE.ShaderMaterial({
        vertexShader: /* glsl */ `
          varying vec3 vN, vW, vO;
          void main(){
            vO = position;
            vec4 w = modelMatrix * vec4(position, 1.0);
            vW = w.xyz;
            vN = normalize(mat3(modelMatrix) * normal);
            gl_Position = projectionMatrix * viewMatrix * w;
          }`,
        fragmentShader: /* glsl */ `
          ${GLSL_NOISE}
          uniform float time, intensity;
          varying vec3 vN, vW, vO;
          void main(){
            vec3 V = normalize(cameraPosition - vW);
            float mu = max(dot(normalize(vN), V), 0.0);
            vec3 p = normalize(vO);
            float g = fbm(p * 7.0 + vec3(0.0, time * 0.12, 0.0), 4) * 0.5 + 0.5;
            float g2 = fbm(p * 26.0 + vec3(time * 0.25), 3) * 0.5 + 0.5;
            float k = clamp(g * 0.65 + g2 * 0.45, 0.0, 1.0);
            vec3 c = mix(vec3(1.0, 0.38, 0.06), vec3(1.0, 0.86, 0.5), k);
            c *= mix(0.45, 1.0, pow(mu, 0.45));
            gl_FragColor = vec4(c * intensity, 1.0);
          }`,
        uniforms: this.uniforms,
      }),
    );
    this.coronaUniforms = { time: this.uniforms.time, intensity: { value: 1.1 }, scale: { value: 4.5 } };
    this.corona = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        vertexShader: /* glsl */ `
          uniform float scale;
          varying vec2 vP;
          void main(){
            vP = position.xy * scale;
            vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
            // modelViewMatrix carries the sun radius as uniform scale
            float s = length(modelViewMatrix[0].xyz);
            mv.xy += position.xy * scale * s;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          ${GLSL_NOISE}
          uniform float time, intensity;
          varying vec2 vP;
          void main(){
            float r = length(vP);
            if (r < 0.98) discard;
            float a = atan(vP.y, vP.x);
            float rays = fbm(vec3(cos(a) * 2.5, sin(a) * 2.5, r * 0.35 - time * 0.08), 4) * 0.5 + 0.5;
            float x = r - 1.0;
            float glow = exp(-x * 4.0) * 0.85 + exp(-x * 1.3) * 0.16 + exp(-x * 0.5) * 0.025;
            glow *= 1.0 - smoothstep(2.6, 3.5, x);
            glow *= mix(0.6, 1.45, rays);
            vec3 c = mix(vec3(1.0, 0.42, 0.12), vec3(1.0, 0.8, 0.5), exp(-x * 2.0));
            gl_FragColor = vec4(c * glow * intensity, 1.0);
          }`,
        uniforms: this.coronaUniforms,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
      }),
    );
    this.corona.frustumCulled = false;
    this.group = new THREE.Group();
    this.group.add(this.corona, this.mesh);
  }
  update(t, radius) {
    this.group.scale.setScalar(radius);
    this.uniforms.time.value = t;
  }
}

// Small planet with a procedural surface, lit by a point at `sunPos`.
export class Planet {
  constructor({ color = [0.6, 0.6, 0.6], color2 = [0.4, 0.4, 0.4], bands = 0, noiseScale = 4, seed = 0 } = {}) {
    this.uniforms = {
      sunPos: { value: new THREE.Vector3() },
      c1: { value: new THREE.Vector3(...color) },
      c2: { value: new THREE.Vector3(...color2) },
      bands: { value: bands },
      ns: { value: noiseScale },
      seed: { value: seed },
      gain: { value: 1.6 },
    };
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 64, 32),
      new THREE.ShaderMaterial({
        vertexShader: /* glsl */ `
          varying vec3 vN, vW, vO;
          void main(){
            vO = position;
            vec4 w = modelMatrix * vec4(position, 1.0);
            vW = w.xyz;
            vN = normalize(mat3(modelMatrix) * normal);
            gl_Position = projectionMatrix * viewMatrix * w;
          }`,
        fragmentShader: /* glsl */ `
          ${GLSL_NOISE}
          uniform vec3 sunPos, c1, c2;
          uniform float bands, ns, seed, gain;
          varying vec3 vN, vW, vO;
          void main(){
            vec3 N = normalize(vN);
            vec3 L = normalize(sunPos - vW);
            vec3 V = normalize(cameraPosition - vW);
            vec3 p = normalize(vO);
            float n = fbm(p * ns + seed, 5) * 0.5 + 0.5;
            if (bands > 0.0) n = mix(n, sin(p.y * bands + n * 3.0) * 0.5 + 0.5, 0.6);
            vec3 alb = mix(c2, c1, n);
            float d = max(dot(N, L), 0.0);
            float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0) * smoothstep(-0.2, 0.4, dot(N, L));
            gl_FragColor = vec4(alb * d * gain + alb * rim * 0.5 + alb * 0.006, 1.0);
          }`,
        uniforms: this.uniforms,
      }),
    );
  }
}
