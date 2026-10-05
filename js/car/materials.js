// Interior materials and a small pre-filtered night environment for glossy
// reflections on the hood, trim and piano-black plastics.

import * as THREE from 'three';
import { grainNormal, weaveNormal } from '../core/textures.js';

export function createNightEnvironment(renderer, moonDir) {
  const scene = new THREE.Scene();
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(10, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: { uMoon: { value: moonDir.clone().normalize() } },
      vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `
        uniform vec3 uMoon;
        varying vec3 vD;
        void main() {
          vec3 d = normalize(vD);
          float h = d.y;
          vec3 col = mix(vec3(0.02, 0.026, 0.04), vec3(0.004, 0.006, 0.012), smoothstep(0.0, 0.7, h));
          col = mix(col, vec3(0.006, 0.006, 0.006), smoothstep(0.02, -0.15, h));
          float m = max(dot(d, uMoon), 0.0);
          col += vec3(0.55, 0.6, 0.75) * pow(m, 900.0) * 30.0 + vec3(0.06, 0.07, 0.09) * pow(m, 16.0);
          // Soft canopy band of dark tree tops around the horizon.
          col *= 1.0 - 0.6 * smoothstep(0.0, 0.08, h) * smoothstep(0.35, 0.1, h);
          gl_FragColor = vec4(col, 1.0);
        }`,
    }),
  );
  scene.add(sky);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(scene, 0.02);
  pmrem.dispose();
  sky.geometry.dispose();
  sky.material.dispose();
  return rt.texture;
}

let cache = null;

/** A copy of a shared texture with its own repeat. */
function tiled(tex, repeat) {
  const t = tex.clone();
  t.repeat.set(repeat, repeat);
  t.needsUpdate = true;
  return t;
}

export function interiorMaterials(envMap) {
  if (cache) return cache;
  const leatherN = grainNormal(3, 256, 5200, 1.4, 3.2, 1.6);
  const plasticN = grainNormal(8, 256, 9000, 0.8, 1.8, 1.2);
  const weave = weaveNormal(256);
  const std = (o) => new THREE.MeshStandardMaterial({ envMap, envMapIntensity: 0.6, ...o });
  cache = {
    leather: std({ color: 0x232226, roughness: 0.5, normalMap: leatherN, normalScale: new THREE.Vector2(0.35, 0.35) }),
    leatherPerf: std({ color: 0x151417, roughness: 0.6, normalMap: plasticN, normalScale: new THREE.Vector2(0.6, 0.6) }),
    fabric: std({ color: 0x2e2c2a, roughness: 0.96, normalMap: weave, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 0.1 }),
    headliner: std({ color: 0x2a2826, roughness: 0.97, normalMap: tiled(weave, 14), normalScale: new THREE.Vector2(0.3, 0.3), envMapIntensity: 0.05 }),
    seatFabric: std({ color: 0x232327, roughness: 0.92, normalMap: weave, normalScale: new THREE.Vector2(0.9, 0.9), envMapIntensity: 0.15 }),
    dash: std({ color: 0x141518, roughness: 0.74, normalMap: plasticN, normalScale: new THREE.Vector2(0.3, 0.3) }),
    plastic: std({ color: 0x0f1012, roughness: 0.48, normalMap: plasticN, normalScale: new THREE.Vector2(0.15, 0.15) }),
    piano: std({ color: 0x040405, roughness: 0.1, envMapIntensity: 1.2 }),
    satin: std({ color: 0x8b8f94, metalness: 1, roughness: 0.3, envMapIntensity: 1.1 }),
    chrome: std({ color: 0xb8bcc2, metalness: 1, roughness: 0.12, envMapIntensity: 1.4 }),
    carpet: std({ color: 0x0c0c0d, roughness: 1, envMapIntensity: 0 }),
    rubber: std({ color: 0x060606, roughness: 0.85, envMapIntensity: 0.2 }),
    belt: std({ color: 0x1f2022, roughness: 0.75, normalMap: weave, normalScale: new THREE.Vector2(0.8, 0.8) }),
    wood: std({ color: 0x2a1a12, roughness: 0.25, envMapIntensity: 1 }),
    paint: new THREE.MeshPhysicalMaterial({
      color: 0x0d1114,
      metalness: 0.55,
      roughness: 0.38,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      envMap,
      envMapIntensity: 1.3,
    }),
    denim: std({ color: 0x1b2230, roughness: 0.95, normalMap: weave, normalScale: new THREE.Vector2(1.2, 1.2), envMapIntensity: 0.05 }),
    jacket: std({ color: 0x121215, roughness: 0.85, normalMap: weave, normalScale: new THREE.Vector2(0.7, 0.7), envMapIntensity: 0.1 }),
    shadowOnly: new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
  };
  return cache;
}
