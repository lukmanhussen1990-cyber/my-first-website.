// A soft holy beam of light (God is shown only as light): additive fresnel cone + a glowing pool on the ground +
// drifting motes. makeBeam({ r0, r1, h }) -> { group, mat, set(t, k) }. Used by the Enoch scene and the city's warm light.
import * as THREE from 'three';
import { makeMotes } from './fx.js';

const BEAM_FS = `uniform vec3 uColor; uniform float uK; uniform float uTime; varying vec3 vN; varying vec3 vW; varying float vY;
void main(){ vec3 V = normalize(cameraPosition - vW); float f = abs(dot(normalize(vN), V));
  float core = pow(f, 2.2) * 0.85 + pow(f, 9.0) * 0.6;
  float fy = smoothstep(0.0, 0.05, vY) * (1.0 - smoothstep(0.35, 1.0, vY));
  float sh = 0.82 + 0.18 * sin(vW.x * 2.3 + vW.z * 1.7 + uTime * 0.7) * sin(vY * 9.0 - uTime * 0.45);
  gl_FragColor = vec4(uColor * core * fy * sh * uK, 1.0); }`;
export function makeBeam({ r0 = 1.5, r1 = 2.6, h = 34 } = {}) {
  const g = new THREE.Group();
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uColor: { value: new THREE.Color(1.0, 0.86, 0.58) }, uK: { value: 1 }, uTime: { value: 0 } },
    vertexShader: 'varying vec3 vN; varying vec3 vW; varying float vY; void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vY = uv.y; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: BEAM_FS });
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, h, 40, 1, true).translate(0, h / 2, 0), mat); cone.renderOrder = 6; g.add(cone);
  const R = (r0 * 1.9).toFixed(3);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(r0 * 1.9, 40).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, uniforms: { uColor: mat.uniforms.uColor, uK: mat.uniforms.uK },
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uColor; uniform float uK; varying vec2 vP; void main(){ float d = length(vP) / ${R};
      float a = exp(-d * d * 3.2) * 0.9 + exp(-d * d * 12.0) * 0.6; gl_FragColor = vec4(uColor * a * uK * 0.9, 1.0); }` }));
  pool.position.y = 0.03; pool.renderOrder = 3; g.add(pool);
  const motes = makeMotes(160, 31); g.add(motes.group);
  const _o = new THREE.Vector3();
  return { group: g, mat, set(t, k) { mat.uniforms.uK.value = k; mat.uniforms.uTime.value = t; g.getWorldPosition(_o); motes.set(t, [_o.x, _o.y + 0.2, _o.z], [r0 * 2.2, 7, r0 * 2.2], k * 1.4, [1.0, 0.85, 0.55], 0.035); } };
}
