// Add-ons the car gains on the way: the drill, the concrete ring machine, the
// heat shield, cold-air vents, thruster jets and the hologram globe.
import * as THREE from 'three';
import { LAYOUT } from './layout.js';
import { NOISE } from './lib/glsl.js';

const L = LAYOUT;

// ---------------------------------------------------------------- drill
export function buildDrill() {
  const g = new THREE.Group(); g.name = 'drill';
  const spin = new THREE.Group(); g.add(spin);
  const steel = new THREE.MeshPhysicalMaterial({ color: 0xd9dde3, metalness: 1.0, roughness: 0.18,
    clearcoat: 0.6, clearcoatRoughness: 0.12, envMapIntensity: 1.3 });
  const darkSteel = new THREE.MeshPhysicalMaterial({ color: 0x3a3f46, metalness: 1.0, roughness: 0.35 });
  const brass = new THREE.MeshPhysicalMaterial({ color: 0xc9a24a, metalness: 1.0, roughness: 0.3 });
  const R = L.DRILL_R, LEN = 1.45, x0 = 0.12; // cone from x0 to x0+LEN along +x
  // Fluted cone: radius shrinks to the tip, three helical flutes twist around it.
  const segU = 72, segV = 96, flutes = 3, twist = 1.35;
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= segU; i++) {
    const u = i / segU;
    const rBase = R * (1 - u) * (1 - 0.06 * Math.pow(u, 0.6)) + 0.012;
    for (let j = 0; j <= segV; j++) {
      const v = j / segV;
      const a = v * Math.PI * 2;
      const ph = (v * flutes - u * twist) * Math.PI * 2;
      const ridge = Math.pow(0.5 + 0.5 * Math.cos(ph), 3.0);
      const r = rBase * (0.86 + 0.16 * ridge);
      pos.push(x0 + u * LEN, Math.cos(a) * r, Math.sin(a) * r);
      uv.push(u, v);
    }
  }
  for (let i = 0; i < segU; i++) for (let j = 0; j < segV; j++) {
    const a = i * (segV + 1) + j, b = a + 1, c = a + segV + 1, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const coneGeo = new THREE.BufferGeometry();
  coneGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  coneGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  coneGeo.setIndex(idx);
  coneGeo.computeVertexNormals();
  const cone = new THREE.Mesh(coneGeo, steel); spin.add(cone);
  // Sharp tip
  const tipGeo = new THREE.ConeGeometry(0.06, 0.22, 16); tipGeo.rotateZ(-Math.PI / 2);
  const tip = new THREE.Mesh(tipGeo, darkSteel); tip.position.x = x0 + LEN + 0.06; spin.add(tip);
  // Collar + back plate that bolts onto the nose
  const collarGeo = new THREE.CylinderGeometry(R * 1.0, R * 1.02, 0.16, 64); collarGeo.rotateZ(Math.PI / 2);
  const collar = new THREE.Mesh(collarGeo, darkSteel); collar.position.x = 0.04; spin.add(collar);
  const ringGeo = new THREE.TorusGeometry(R * 0.99, 0.035, 10, 64); ringGeo.rotateY(Math.PI / 2);
  const ring = new THREE.Mesh(ringGeo, brass); ring.position.x = 0.12; spin.add(ring);
  // Bolts around the collar
  const boltGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.05, 8); boltGeo.rotateZ(Math.PI / 2);
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    const b = new THREE.Mesh(boltGeo, brass);
    b.position.set(-0.05, Math.cos(a) * R * 0.85, Math.sin(a) * R * 0.85);
    spin.add(b);
  }
  // Fixed hub that holds the drill to the car
  const hubGeo = new THREE.CylinderGeometry(0.38, 0.5, 0.26, 32); hubGeo.rotateZ(Math.PI / 2);
  const hub = new THREE.Mesh(hubGeo, darkSteel); hub.position.x = -0.1; g.add(hub);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { group: g, spin, length: x0 + LEN + 0.17 };
}

// ---------------------------------------------------------------- concrete rings
// Half-buried tunnel lining rings (cut away in front of z = 0 like the Earth).
export function buildRingMachine(maxRings = 150) {
  const Ri = L.TUNNEL_R - 0.11, Ro = L.TUNNEL_R, W = 0.5;
  const concrete = new THREE.MeshStandardMaterial({ color: 0xb9b6ae, roughness: 0.85,
    clippingPlanes: [new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)], clipShadows: true, side: THREE.DoubleSide });
  concrete.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLocal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocal = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vLocal;\n${NOISE}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        float ang = atan(vLocal.z, vLocal.x);
        float seg = fract(ang / 6.28318 * 7.0);
        float joint = 1.0 - smoothstep(0.0, 0.012, min(seg, 1.0 - seg));
        float edge = 1.0 - smoothstep(0.0, 0.02, min(abs(vLocal.y), abs(vLocal.y - ${W.toFixed(2)})));
        float n = snoise(vLocal * 6.0) * 0.06 + snoise(vLocal * 22.0) * 0.03;
        diffuseColor.rgb *= (0.92 + n) * (1.0 - joint * 0.45) * (1.0 - edge * 0.25);`);
  };
  concrete.customProgramCacheKey = () => 'concrete-ring';
  // Ring geometry: lathe of the cross-section, local axis = +y (ring sits on y in [0, W]).
  const prof = [new THREE.Vector2(Ri, 0), new THREE.Vector2(Ro, 0), new THREE.Vector2(Ro, W), new THREE.Vector2(Ri, W), new THREE.Vector2(Ri, 0)];
  const geo = new THREE.LatheGeometry(prof, 72);
  const mesh = new THREE.InstancedMesh(geo, concrete, maxRings);
  mesh.count = 0; mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  // Flat caps where the cut plane slices each ring (lighter "cut section").
  const capMat = new THREE.MeshStandardMaterial({ color: 0xd6d2c8, roughness: 0.9 });
  const capGeo = new THREE.PlaneGeometry(1, 1);
  const caps = new THREE.InstancedMesh(capGeo, capMat, maxRings * 2);
  caps.count = 0; caps.frustumCulled = false; caps.receiveShadow = true;
  return { mesh, caps, Ri, Ro, W };
}

// ---------------------------------------------------------------- heat shield
// Crumpled silver foil: flat facets (car-space Voronoi cells) with soft creases.
export function buildShieldMaterial() {
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xe9ebee, metalness: 1.0, roughness: 0.26,
    envMapIntensity: 0.9, transparent: false, side: THREE.DoubleSide });
  const uniforms = { uWrap: { value: 0 }, uTime: { value: 0 } };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLocal;\nvarying vec3 vNL;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocal = position;\nvNL = normal;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vLocal;\nvarying vec3 vNL;\nuniform float uWrap, uTime;\nuniform mat3 normalMatrix;\n${NOISE}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        // wraps from the nose (+x) back to the tail
        float front = mix(2.6, -2.6, uWrap);
        float wob = snoise(vLocal * 3.0) * 0.12;
        if (vLocal.x + wob < front) discard;
        float rim = 1.0 - smoothstep(0.0, 0.18, vLocal.x + wob - front);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          vec3 nL = normalize(vNL);
          vec3 an = abs(nL);
          vec2 fp = an.z >= max(an.x, an.y) ? vLocal.xy : (an.y >= an.x ? vLocal.xz : vLocal.zy);
          float pxs = length(fwidth(fp)) * 14.0;              // cell size in pixels^-1
          vec4 vc = voronoi(fp * 14.0 + vec2(snoise(fp * 3.0)) * 0.35);
          vec2 tilt = (hash22(vc.zw + 1.7) - 0.5) * 0.4 * (1.0 - smoothstep(0.15, 0.5, pxs));
          float crease = smoothstep(0.0, max(0.07, pxs * 2.0), vc.y - vc.x);
          vec3 T = normalize(cross(nL, abs(nL.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
          vec3 B = cross(nL, T);
          vec2 fine = vec2(snoise(vLocal * 38.0), snoise(vLocal * 38.0 + 9.1)) * 0.06 * (1.0 - smoothstep(0.2, 0.6, pxs * 3.0));
          vec3 nP = normalize(nL + T * (tilt.x * crease + fine.x) + B * (tilt.y * crease + fine.y));
          normal = normalize(normalMatrix * nP) * faceDirection;
        }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(0.7, 0.85, 1.0) * rim * 1.1 * (1.0 - smoothstep(0.85, 1.0, uWrap));`);
  };
  mat.customProgramCacheKey = () => 'heat-shield-foil';
  return { mat, uniforms };
}
