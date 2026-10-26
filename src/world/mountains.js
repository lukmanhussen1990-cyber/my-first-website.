// Background snowy peaks: layered ridge silhouettes with snow, moon rim light and fog.
import * as THREE from 'three';
import { GLSL_NOISE, mulberry32, fbm1 } from '../util.js';

function ridge(x, seed, sharp) {
  // jagged peaks: sum of abs-sin "teeth" + fbm
  let h = 0;
  h += Math.pow(Math.abs(Math.sin(x * 0.011 + seed)), sharp) * 1.0;
  h += Math.pow(Math.abs(Math.sin(x * 0.027 + seed * 2.3)), sharp) * 0.45;
  h += fbm1(x * 0.05, seed, 4) * 0.22 + fbm1(x * 0.2, seed + 3, 3) * 0.05;
  return h;
}

export function createMountains() {
  const group = new THREE.Group();
  const uniforms = {
    uMoonDir: { value: new THREE.Vector3(0.6, 0.5, 0.3).normalize() },
    uLight: { value: new THREE.Vector3(0.55, 0.65, 0.9) },
    uSnow: { value: new THREE.Vector3(0.55, 0.62, 0.78) },
    uRock: { value: new THREE.Vector3(0.03, 0.04, 0.06) },
    uFog: { value: new THREE.Vector3(0.02, 0.05, 0.1) },
    uAmb: { value: 0.25 },
    uWarm: { value: new THREE.Vector3(0, 0, 0) },
    uBright: { value: 1 },
  };
  const layers = [
    { z: -1500, h: 520, base: 40, width: 5200, seed: 1.3, fog: 0.62, sharp: 2.2 },
    { z: -1000, h: 400, base: 10, width: 4000, seed: 4.1, fog: 0.45, sharp: 2.0 },
    { z: -650, h: 300, base: -5, width: 2800, seed: 7.7, fog: 0.28, sharp: 1.8 },
    { z: -380, h: 170, base: -6, width: 1800, seed: 2.9, fog: 0.12, sharp: 1.6 },
  ];
  for (const L of layers) {
    const NX = 420, NY = 12;
    const pos = [], aux = [], idx = [];
    for (let i = 0; i <= NX; i++) {
      const x = -L.width / 2 + (i / NX) * L.width;
      const r = ridge(x, L.seed, L.sharp);
      const top = L.base + r * L.h;
      const rl = ridge(x - 2, L.seed, L.sharp), rr = ridge(x + 2, L.seed, L.sharp);
      const slope = ((rr - rl) * L.h) / 4;
      for (let j = 0; j <= NY; j++) {
        const v = j / NY; // 0 bottom .. 1 top
        const y = -60 + (top + 60) * Math.pow(v, 0.8);
        pos.push(x, y, L.z + (1 - v) * 30);
        aux.push(top, slope, v);
      }
    }
    for (let i = 0; i < NX; i++)
      for (let j = 0; j < NY; j++) {
        const a = i * (NY + 1) + j, b = a + NY + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aux', new THREE.Float32BufferAttribute(aux, 3));
    g.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...uniforms, uLayerFog: { value: L.fog }, uH: { value: L.h }, uBase: { value: L.base } },
      fog: false,
      vertexShader: /* glsl */ `
        attribute vec3 aux; varying vec3 vAux; varying vec3 vW;
        void main(){ vAux = aux; vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: GLSL_NOISE + /* glsl */ `
        uniform vec3 uMoonDir, uLight, uSnow, uRock, uFog, uWarm; uniform float uAmb, uLayerFog, uH, uBase, uBright;
        varying vec3 vAux; varying vec3 vW;
        void main(){
          float top = vAux.x, slope = vAux.y;
          float below = top - vW.y;               // meters below the ridge line
          // snow: lots near the top, streaky gullies lower down
          float streak = fbm(vec2(vW.x*0.035, vW.y*0.006));
          float snowLine = mix(0.15, 0.55, streak) * uH;
          float snow = smoothstep(snowLine, snowLine*0.55, below) ;
          snow = max(snow, smoothstep(0.62, 0.7, fbm(vec2(vW.x*0.02 + slope*0.1, vW.y*0.03))) * 0.85);
          // fake normal from ridge slope + noise facets
          float facet = fbm(vec2(vW.x*0.05, vW.y*0.05)) - 0.5;
          vec3 n = normalize(vec3(-slope*0.9 + facet*1.2, 0.55, 0.65));
          float lit = clamp(dot(n, uMoonDir), 0., 1.);
          vec3 base = mix(uRock, uSnow, snow);
          vec3 col = base * (uAmb + lit * uLight * 1.2) + uWarm * snow * lit;
          // rim light right at the ridge
          col += uLight * snow * smoothstep(3.0, 0.0, below) * 0.25;
          // atmospheric fog: per layer + thicker near the valley floor
          float valley = smoothstep(uBase + uH*0.35, uBase - 20., vW.y);
          col = mix(col, uFog, clamp(uLayerFog + valley*0.85, 0., 1.));
          gl_FragColor = vec4(col * uBright, 1.);
        }`,
    });
    const mesh = new THREE.Mesh(g, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = -90;
    group.add(mesh);
  }
  // soft fog banks between layers
  const fogMat = new THREE.ShaderMaterial({
    uniforms: { uFog: uniforms.uFog, uTime: { value: 0 }, uAlpha: { value: 0.75 } },
    transparent: true,
    depthWrite: false,
    vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }',
    fragmentShader: GLSL_NOISE + /* glsl */ `
      uniform vec3 uFog; uniform float uTime, uAlpha; varying vec2 vUv; varying vec3 vW;
      void main(){
        float n = fbm(vec2(vW.x*0.004 + uTime*0.01, vUv.y*2.0 + vW.z*0.001));
        float a = smoothstep(1.0, 0.25, vUv.y) * smoothstep(0.0, 0.18, vUv.y) * (0.45 + 0.75*n);
        gl_FragColor = vec4(uFog*1.15, a*uAlpha);
      }`,
  });
  const fogs = [];
  for (const [z, y, h] of [[-1250, 20, 160], [-820, 0, 130], [-520, -10, 90], [-300, -12, 50]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(6000, h), fogMat);
    m.position.set(0, y + h * 0.35, z);
    m.renderOrder = -80;
    group.add(m);
    fogs.push(m);
  }
  group.userData = { uniforms, fogMat };
  return group;
}
