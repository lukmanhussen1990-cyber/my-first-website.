// Camera-centred sky dome: golden-hour sunset over the backyard, sunrise over
// the beach on the far side (whose "up" is world -y).
import * as THREE from 'three';
import { NOISE } from './lib/glsl.js';

export function buildSky(scene) {
  const uniforms = {
    uMode: { value: 0 }, uUp: { value: new THREE.Vector3(0, 1, 0) },
    uSunDir: { value: new THREE.Vector3(-0.8, 0.2, 0.55).normalize() },
    uRight: { value: new THREE.Vector3(1, 0, 0) }, uTime: { value: 0 }, uBright: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    vertexShader: /* glsl */`varying vec3 vDir; void main(){ vDir = normalize(position);
      vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: /* glsl */`
      ${NOISE}
      uniform float uMode, uTime, uBright; uniform vec3 uUp, uSunDir, uRight; varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        float h = dot(d, uUp);
        float sd = max(dot(d, uSunDir), 0.0);
        vec3 col;
        vec3 fwd = normalize(cross(uUp, uRight));
        vec2 sp = vec2(dot(d, uRight), dot(d, fwd)) / max(0.08, h + 0.12);
        float cl = fbm2(sp * 0.9 + vec2(uTime * 0.01, 0.0), 0.0, 5);
        float clouds = smoothstep(0.08, 0.55, cl) * smoothstep(0.02, 0.18, h) * (1.0 - smoothstep(0.55, 0.9, h));
        if (uMode < 0.5) {
          // golden hour: warm horizon, peach, then dusky blue
          vec3 hor = vec3(2.3, 1.05, 0.42), mid = vec3(1.5, 0.78, 0.48), top = vec3(0.26, 0.32, 0.62);
          col = mix(hor, mid, smoothstep(0.0, 0.16, h));
          col = mix(col, top, smoothstep(0.16, 0.85, h));
          col += vec3(2.6, 1.2, 0.45) * pow(sd, 6.0) * 0.8 + vec3(30.0, 18.0, 8.0) * pow(sd, 900.0);
          vec3 cc = mix(vec3(1.8, 0.75, 0.55), vec3(2.6, 1.3, 0.7), pow(sd, 2.0));
          col = mix(col, cc, clouds * 0.75);
          col = mix(col, vec3(0.35, 0.28, 0.22), smoothstep(0.0, -0.08, h));
        } else {
          // sunrise: pale gold horizon, clean tropical blue above
          vec3 hor = vec3(1.5, 0.98, 0.66), mid = vec3(0.46, 0.68, 1.05), top = vec3(0.14, 0.38, 0.92);
          col = mix(hor, mid, smoothstep(0.0, 0.12, h));
          col = mix(col, top, smoothstep(0.12, 0.6, h));
          col += vec3(1.5, 0.9, 0.45) * pow(sd, 14.0) * 0.38 + vec3(6.0, 4.6, 3.0) * pow(sd, 2400.0);
          vec3 cc = mix(vec3(1.25, 1.2, 1.18), vec3(1.7, 1.15, 0.85), pow(sd, 3.0));
          col = mix(col, cc, clouds * 0.5);
          col = mix(col, vec3(0.1, 0.35, 0.45), smoothstep(0.0, -0.08, h));
        }
        gl_FragColor = vec4(col * uBright, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(900, 64, 32), mat);
  mesh.renderOrder = -1000;
  mesh.frustumCulled = false;
  scene.add(mesh);
  return {
    mesh, uniforms,
    update(camera) { mesh.position.copy(camera.position); },
  };
}
