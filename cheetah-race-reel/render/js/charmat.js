import * as THREE from 'three';
import { GLSL_NOISE } from './util.js';
import { SUN_DIR } from './sky.js';

// Character materials: shell fur with cheetah spots, big glossy toon eyes,
// soft skin. All patterns are procedural.

export const FUR_SHELLS = 6;

// mode: 0 body tube, 1 leg tube, 2 tail tube, 3 head (object-space pattern)
export function furMaterial({ mode = 0, circ = 0.6, len = 1.0, furLen = 0.012, shells = FUR_SHELLS } = {}) {
  const u = {
    uMode: { value: mode }, uCirc: { value: circ }, uLen: { value: len }, uFurLen: { value: furLen }, uShells: { value: shells },
    uSun: { value: SUN_DIR.clone() }, uBreath: { value: 0 },
  };
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.78, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uFurLen; uniform float uShells; uniform float uMode;
        attribute float aCirc;
        varying float vShell; varying vec2 vUv2; varying vec3 vObj; varying float vCirc;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float shellF = 0.0;
        #ifdef USE_INSTANCING_SHELLS
        #endif
        shellF = float(gl_InstanceID) / max(uShells, 1.0);
        transformed += normalize(objectNormal) * uFurLen * shellF;
        transformed.y -= uFurLen * 0.35 * shellF * shellF;
        vShell = shellF; vUv2 = uv; vObj = position; vCirc = aCirc;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uMode; uniform float uCirc; uniform float uLen; uniform float uShells; uniform vec3 uSun;
        varying float vShell; varying vec2 vUv2; varying vec3 vObj; varying float vCirc;
        ${GLSL_NOISE}
        // cheetah coat on a tube: u = rest arc length (m), v = angle (0 top, .5 belly)
        vec3 coatTube(vec2 uv, float mode, out float spot){
          float ang = uv.y;                       // 0..1 around
          float belly = smoothstep(0.32, 0.46, abs(ang - 0.0) < 0.5 ? abs(ang) : 1.0 - abs(ang));
          // distance from the top line: 0 top .. 0.5 bottom
          float fromTop = min(ang, 1.0 - ang);
          belly = smoothstep(0.3, 0.46, fromTop);
          vec2 p = vec2(uv.x, ang * vCirc);
          vec3 vo = voronoi2(p * 21.0);
          float r = 0.2 + 0.09 * vo.z;
          spot = smoothstep(r + 0.06, r - 0.04, vo.x) * (1.0 - belly * 0.85);
          vec3 tan_ = mix(vec3(0.86, 0.56, 0.22), vec3(0.95, 0.7, 0.34), fbm2(p * 3.0));
          vec3 cream = vec3(0.97, 0.9, 0.76);
          vec3 c = mix(tan_, cream, belly);
          if (mode > 1.5 && mode < 2.5) {
            // tail: spots, then black rings, white tip
            float t = uv.x / uLen;
            float ring = step(0.5, fract(uv.x * 7.0 + 0.3)) * smoothstep(0.58, 0.62, t);
            spot = max(spot * (1.0 - smoothstep(0.55, 0.62, t)), ring);
            c = mix(c, cream, smoothstep(0.93, 0.95, t));
            spot *= 1.0 - smoothstep(0.93, 0.95, t);
          }
          if (mode > 0.5 && mode < 1.5) {
            // legs: smaller spots, lighter inner side, darker toward paws' back
            vec3 vo2 = voronoi2(p * 30.0);
            spot = smoothstep(0.19, 0.11, vo2.x) * (1.0 - belly * 0.7) * (1.0 - smoothstep(0.75, 0.95, uv.x / uLen));
          }
          return c;
        }
        float segDist(vec3 p, vec3 a, vec3 b, out float h){
          vec3 pa = p - a, ba = b - a;
          h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
          return length(pa - ba * h);
        }
        // black tear mark: from the inner corner of the eye down the side of the
        // muzzle to the corner of the mouth, thin at the eye and bold lower down
        float tearMark(vec3 d){
          float s = d.z > 0.0 ? 1.0 : -1.0;
          vec3 q0 = normalize(vec3(0.86, 0.08, 0.29 * s)), q1 = normalize(vec3(0.93, -0.1, 0.34 * s));
          vec3 q2 = normalize(vec3(0.91, -0.28, 0.36 * s)), q3 = normalize(vec3(0.83, -0.46, 0.32 * s));
          float h, best = 1e3, tb = 0.0;
          float dd = segDist(d, q0, q1, h); if (dd < best) { best = dd; tb = h / 3.0; }
          dd = segDist(d, q1, q2, h); if (dd < best) { best = dd; tb = (1.0 + h) / 3.0; }
          dd = segDist(d, q2, q3, h); if (dd < best) { best = dd; tb = (2.0 + h) / 3.0; }
          float w = mix(0.012, 0.036, smoothstep(0.0, 0.55, tb)) * (1.0 - 0.2 * smoothstep(0.85, 1.0, tb));
          return smoothstep(w, w * 0.7, best);
        }
        vec3 coatHead(vec3 p, out float spot){
          vec3 d = normalize(p);
          vec3 tan_ = mix(vec3(0.88, 0.52, 0.17), vec3(0.97, 0.68, 0.28), fbm3(p * 20.0));
          vec3 cream = vec3(1.0, 0.94, 0.84);
          float muz = smoothstep(0.62, 0.42, acos(clamp(dot(d, normalize(vec3(1.0, -0.45, 0.0))), -1.0, 1.0)));
          muz *= smoothstep(0.05, -0.12, d.y);
          float jaw = smoothstep(-0.32, -0.58, d.y);
          vec3 e1 = normalize(vec3(0.72, -0.14, 0.56)), e2 = normalize(vec3(0.72, -0.14, -0.56));
          float ue = max(smoothstep(0.3, 0.18, acos(clamp(dot(d, e1), -1.0, 1.0))), smoothstep(0.3, 0.18, acos(clamp(dot(d, e2), -1.0, 1.0))));
          float white = clamp(max(max(muz, jaw), ue * 0.7), 0.0, 1.0);
          vec3 c = mix(tan_, cream, white);
          float cd = cell3(d * 12.0);
          spot = smoothstep(0.25, 0.15, cd) * (1.0 - white) * smoothstep(0.92, 0.74, d.x) * smoothstep(-0.3, 0.05, d.y);
          spot = max(spot, tearMark(d));
          return c;
        }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          float spot = 0.0;
          vec3 c;
          if (uMode < 2.5) c = coatTube(vUv2, uMode, spot);
          else c = coatHead(vObj, spot);
          vec3 black = vec3(0.045, 0.035, 0.03);
          c = mix(c, black, spot);
          // fur strands on the shells
          if (vShell > 0.001) {
            // strands on a ~3 mm grid in skin space (sphere uv for the head)
            vec2 q = (uMode < 2.5) ? vec2(vUv2.x, vUv2.y * vCirc) * 320.0 : vec2(vUv2.x * 1.0, vUv2.y * 0.47) * 330.0;
            vec2 cell = floor(q); vec2 f = fract(q) - 0.5 - (hash22(cell) - 0.5) * 0.5;
            float strand = 1.0 - length(f) * 2.0;
            if (strand < vShell * 0.95) discard;
          }
          // darker near the skin (self shadowing of the coat)
          c *= mix(0.74, 1.05, vShell);
          diffuseColor.rgb = c;
        }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          // backlit rim: the low sun glows through the outline of the coat
          vec3 Vv = normalize(vViewPosition);
          float ndv = abs(dot(normalize(vNormal), Vv));
          vec3 Vw = normalize(cameraPosition - vec3(0.0)); // direction hint only
          float rim = pow(1.0 - ndv, 3.0);
          totalEmissiveRadiance += vec3(1.0, 0.62, 0.3) * rim * 0.32 * diffuseColor.rgb * (0.6 + vShell);
        }`);
  };
  m.userData.u = u;
  return m;
}

// Toon eye: sclera + iris + pupil + catchlights drawn procedurally on a
// glossy sphere. The eye looks along its local +z.
export function eyeMaterial({ iris = new THREE.Color(0.85, 0.55, 0.12), irisR = 0.62, pupilR = 0.32 } = {}) {
  const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.12, clearcoat: 1.0, clearcoatRoughness: 0.03 });
  const u = { uIris: { value: iris }, uIrisR: { value: irisR }, uPupilR: { value: pupilR } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vEye;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvEye = normalize(position);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        uniform vec3 uIris; uniform float uIrisR; uniform float uPupilR; varying vec3 vEye;
        ${GLSL_NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 e = normalize(vEye);
          vec2 d = e.xy;                        // radial on the front hemisphere
          float r = length(d) * step(0.0, e.z) + step(e.z, 0.0) * 2.0;
          float ang = atan(d.y, d.x);
          vec3 sclera = vec3(0.97, 0.95, 0.92);
          vec3 c = sclera * (0.9 + 0.1 * smoothstep(1.0, 0.4, r));
          float irisM = smoothstep(uIrisR + 0.015, uIrisR - 0.015, r);
          float streak = 0.75 + 0.25 * vnoise2(vec2(ang * 9.0, r * 3.0));
          vec3 ic = mix(uIris * 0.55, uIris * 1.25, smoothstep(uPupilR, uIrisR, r)) * streak;
          ic = mix(ic, uIris * 0.3, smoothstep(uIrisR - 0.12, uIrisR, r)); // limbal ring
          c = mix(c, ic, irisM);
          float pup = smoothstep(uPupilR + 0.012, uPupilR - 0.012, r);
          c = mix(c, vec3(0.015, 0.012, 0.01), pup);
          diffuseColor.rgb = c;
        }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          vec3 e = normalize(vEye);
          // two catchlights (upper left), fixed in eye space so they read clearly
          float c1 = smoothstep(0.13, 0.1, length(e.xy - vec2(-0.2, 0.24))) * step(0.0, e.z);
          float c2 = smoothstep(0.065, 0.045, length(e.xy - vec2(0.18, -0.16))) * step(0.0, e.z);
          totalEmissiveRadiance += vec3(1.6) * (c1 + 0.7 * c2);
        }`);
  };
  m.userData.u = u;
  return m;
}

// A complete eye rig: eyeball + upper and lower lids (partial spheres that
// rotate to close). Lid colour is passed in so it matches the face.
export function makeEye(radius, eyeMat, lidMat) {
  const group = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(radius, 40, 28), eyeMat);
  group.add(ball);
  const lidGeo = new THREE.SphereGeometry(radius * 1.07, 40, 18, 0, Math.PI * 2, 0, Math.PI / 2);
  // upper lid: hemisphere whose rim faces +z; we rotate it about x
  const upper = new THREE.Group();
  const um = new THREE.Mesh(lidGeo, lidMat); um.rotation.x = -Math.PI / 2; // dome toward -z... rim at z=0 plane
  upper.add(um);
  const lower = new THREE.Group();
  const lm = new THREE.Mesh(lidGeo, lidMat); lm.rotation.x = -Math.PI / 2;
  lower.add(lm);
  group.add(upper, lower);
  // lids: angle 0 = fully open (rotated out of the way)
  const api = {
    group, ball, upper, lower,
    set({ up = 0, low = 0, gaze = new THREE.Vector3(0, 0, 1) }) {
      // up/low: 0 open .. 1 closed. Each lid is a dome facing -z that swings
      // about x: the upper one comes down over the top, the lower one rises.
      // lid edges are given as angles above (+) / below (-) the eye centre;
      // fully closed both edges meet at -12 degrees
      const d = Math.PI / 180;
      const eu = 55 - 67 * Math.min(1, up), el = -50 + 38 * Math.min(1, low);
      const elC = Math.min(el, eu - 2);
      upper.rotation.x = (90 - eu) * d;
      lower.rotation.x = (-90 - elC) * d;
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), gaze.clone().normalize());
      ball.quaternion.copy(q);
    },
  };
  return api;
}

export function skinMaterial(color = new THREE.Color(0.86, 0.6, 0.45)) {
  const m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.55, sheen: 0.5, sheenRoughness: 0.6, sheenColor: new THREE.Color(1.0, 0.7, 0.55) });
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      {
        // a touch of subsurface warmth on the silhouette
        float ndv = abs(dot(normalize(vNormal), normalize(vViewPosition)));
        totalEmissiveRadiance += vec3(0.9, 0.35, 0.2) * pow(1.0 - ndv, 2.5) * 0.18;
      }`);
  };
  return m;
}
