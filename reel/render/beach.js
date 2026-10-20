// The far side: a bright tropical beach at sunrise. Built in "far-local"
// space (y up, beach surface at y = 0) and placed upside-down in the world.
import * as THREE from 'three';
import { NOISE } from './lib/glsl.js';
import { LAYOUT, pathAtDepth } from './layout.js';
import { rng } from './lib/util.js';

const L = LAYOUT;

function sandMaterial(uniforms) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>\nvarying vec3 vLP;\nuniform float uBulge, uCrater;\nuniform vec2 uExit;\n${NOISE.replace(/vec4 voronoi[\s\S]*$/, '')}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          vec2 d = position.xz - uExit; float r = length(d);
          // swelling mound before the burst, crater with a raised rim after
          float mound = uBulge * 0.75 * exp(-r * r / 1.6) * (1.0 + 0.15 * snoise(position.xz * 3.0));
          float crater = uCrater * (-0.9 * exp(-r * r / 1.1) + 0.32 * exp(-pow(r - 1.55, 2.0) / 0.25));
          // gentle dunes and the slope into the sea
          float dune = 0.05 * snoise(position.xz * 0.35) + 0.015 * snoise(position.xz * 1.7);
          float slope = -smoothstep(-8.0, -13.0, position.z) * 0.7;
          transformed.y += mound + crater + dune + slope;
        }
        vLP = transformed;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vLP;\nuniform vec2 uExit;\nuniform float uCrater;\n${NOISE}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        if (vLP.z > 0.0) discard;
        if (uCrater > 0.5 && length(vLP.xz - uExit) < ${(L.TUNNEL_R * 0.72).toFixed(3)}) discard;`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        float px = length(fwidth(vLP));
        float fine = fbm2(vLP.xz * 14.0, px * 14.0, 3);
        float ripple = sin(vLP.x * 5.5 + snoise(vLP.xz * 0.6) * 3.0 + vLP.z * 1.2);
        ripple *= 1.0 - smoothstep(0.1, 0.35, px * 5.0);
        vec3 dry = vec3(0.88, 0.82, 0.70), wet = vec3(0.68, 0.58, 0.44);
        float wetK = smoothstep(-8.6, -9.6, vLP.z);
        vec3 c = mix(dry, wet, wetK) * (0.93 + 0.07 * fine + 0.03 * ripple);
        float sparkle = step(0.985, hash12(floor(vLP.xz * 160.0))) * (1.0 - smoothstep(0.004, 0.012, px));
        c += sparkle * 0.3;
        diffuseColor.rgb = c;
        float bump = fine * 0.4 + ripple * 0.6;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition); float dhx = dFdx(bump) * 0.012, dhy = dFdy(bump) * 0.012;
          vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx); float det = dot(dpx, r1);
          normal = normalize(abs(det) * normal - sign(det) * (dhx * r1 + dhy * r2)); }`);
  };
  mat.customProgramCacheKey = () => 'beach-sand';
  return mat;
}

function waterMaterial(uniforms) {
  return new THREE.ShaderMaterial({
    uniforms, transparent: false,
    vertexShader: /* glsl */`
      varying vec3 vW; varying vec3 vL;
      void main(){ vL = position; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`
      ${NOISE}
      uniform float uTime; uniform vec3 uCam, uSun, uUp; varying vec3 vW; varying vec3 vL;
      vec3 skyCol(vec3 d){ float h = dot(d, uUp);
        vec3 c = mix(vec3(1.4, 0.95, 0.65), vec3(0.18, 0.44, 0.95), smoothstep(0.0, 0.5, h));
        c += vec3(1.4, 0.9, 0.5) * pow(max(dot(d, uSun), 0.0), 10.0);
        return c; }
      void main(){
        vec2 q = vL.xz;
        float px = length(fwidth(vL));
        // waves: several moving noise layers -> normal
        float t = uTime;
        vec2 g = vec2(0.0);
        float e = 0.05;
        for (int i = 0; i < 2; i++) {
          float f = i == 0 ? 0.45 : 1.6; float a = i == 0 ? 1.0 : 0.35;
          vec2 o = vec2(t * 0.4 * (i == 0 ? 1.0 : -0.7), t * 0.25);
          float h0 = snoise(q * f + o), hx = snoise((q + vec2(e, 0.0)) * f + o), hz = snoise((q + vec2(0.0, e)) * f + o);
          g += a * vec2(hx - h0, hz - h0) / e * f * (1.0 - smoothstep(0.1, 0.6, px * f * 3.0));
        }
        vec3 nL = normalize(vec3(-g.x * 0.06, 1.0, -g.y * 0.06));
        // local -> world (water sits in the upside-down far group)
        vec3 n = normalize(vec3(-nL.x, -nL.y, nL.z));
        vec3 v = normalize(uCam - vW);
        float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
        vec3 r = reflect(-v, n);
        vec3 refl = skyCol(r);
        float depth = smoothstep(-9.0, -40.0, vL.z);
        vec3 shallow = vec3(0.03, 0.62, 0.60), deep = vec3(0.01, 0.20, 0.42);
        vec3 body = mix(shallow, deep, depth) * (0.9 + 0.2 * snoise(q * 0.3 + t * 0.05));
        vec3 c = mix(body, refl, clamp(fres, 0.0, 1.0) * 0.55);
        // sun glitter path
        float spec = pow(max(dot(r, uSun), 0.0), 900.0) * 5.0 + pow(max(dot(r, uSun), 0.0), 80.0) * 0.6;
        c += vec3(1.0, 0.9, 0.7) * spec;
        // foam where the waves meet the sand
        float shore = vL.z + 9.6 + 0.35 * sin(t * 1.1) + 0.15 * snoise(vec2(vL.x * 0.4, t * 0.3));
        float foam = smoothstep(0.55, 0.0, abs(shore)) * (0.6 + 0.4 * snoise(vec2(vL.x * 3.0, vL.z * 3.0 + t)));
        c = mix(c, vec3(1.6), clamp(foam, 0.0, 1.0));
        // fade into the horizon haze
        float dist = length(vW - uCam);
        c = mix(c, vec3(1.15, 0.9, 0.7), smoothstep(300.0, 1100.0, dist));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
}

function buildPalm(seed, height, lean) {
  const r = rng(seed);
  const g = new THREE.Group();
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const u = i / 12;
    pts.push(new THREE.Vector3(lean * u * u * height * 0.35, u * height, lean * 0.15 * Math.sin(u * 3) * height * 0.1));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const trunkGeo = new THREE.TubeGeometry(curve, 40, 0.16, 12, false);
  // taper the tube toward the top
  const pos = trunkGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const ring = Math.floor(i / 13), u = ring / 40;
    const c = curve.getPointAt(u);
    const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).sub(c).multiplyScalar(1.0 - 0.45 * u + 0.08 * Math.sin(u * 40));
    pos.setXYZ(i, c.x + v.x, c.y + v.y, c.z + v.z);
  }
  trunkGeo.computeVertexNormals();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x9a7b55, roughness: 0.9 });
  trunkMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vUv3;').replace('#include <uv_vertex>', '#include <uv_vertex>\nvUv3 = uv;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vUv3;')
      .replace('#include <map_fragment>', '#include <map_fragment>\nfloat ringz = fract(vUv3.x * 40.0); diffuseColor.rgb *= 0.72 + 0.28 * smoothstep(0.0, 0.35, ringz);');
  };
  trunkMat.customProgramCacheKey = () => 'palm-trunk';
  const trunk = new THREE.Mesh(trunkGeo, trunkMat); trunk.castShadow = true; trunk.receiveShadow = true;
  g.add(trunk);
  const top = curve.getPointAt(1);
  const crown = new THREE.Group(); crown.position.copy(top); g.add(crown);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f8a2a, roughness: 0.7, side: THREE.DoubleSide });
  const leafMat2 = new THREE.MeshStandardMaterial({ color: 0x3fa535, roughness: 0.7, side: THREE.DoubleSide });
  const fronds = [];
  const N = 9;
  for (let k = 0; k < N; k++) {
    const ang = (k / N) * Math.PI * 2 + r() * 0.3;
    const len = 2.2 + r() * 0.7;
    // frond: a central rib with leaflets, drooping
    const verts = [];
    const segs = 14;
    const rib = [];
    for (let i = 0; i <= segs; i++) {
      const u = i / segs;
      rib.push(new THREE.Vector3(u * len, 0.6 * u - 1.5 * u * u, 0));
    }
    for (let i = 0; i < segs; i++) {
      const a = rib[i], b = rib[i + 1];
      const u = i / segs;
      const w = 0.42 * Math.sin(Math.PI * Math.min(1, u * 1.15 + 0.05));
      for (const side of [-1, 1]) {
        // leaflet: thin triangle angled down and outward
        const tipP = a.clone().add(new THREE.Vector3(0.12, -0.12 - 0.15 * u, side * w));
        verts.push(a.x, a.y, a.z, b.x, b.y, b.z, tipP.x, tipP.y, tipP.z);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.computeVertexNormals();
    const frond = new THREE.Mesh(geo, k % 2 ? leafMat : leafMat2);
    frond.castShadow = true;
    const holder = new THREE.Group();
    holder.rotation.y = ang;
    holder.rotation.z = 0.25 + r() * 0.3;
    holder.add(frond);
    crown.add(holder);
    fronds.push(holder);
  }
  const nutMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.6 });
  for (let k = 0; k < 3; k++) {
    const n = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), nutMat);
    n.position.set(Math.cos(k * 2.1) * 0.13, -0.12, Math.sin(k * 2.1) * 0.13);
    n.castShadow = true; crown.add(n);
  }
  return { group: g, fronds };
}

function buildUmbrella() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.2, 8), new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.4 }));
  pole.position.y = 1.1; pole.rotation.z = 0.12; pole.castShadow = true; g.add(pole);
  const c = document.createElement('canvas'); c.width = 256; c.height = 32;
  const x = c.getContext('2d');
  for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#ffffff' : '#ff5a4f'; x.fillRect(i * 32, 0, 32, 32); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.2, 0.45, 16, 1, true), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.7 }));
  canopy.position.set(0.25, 2.2, 0); canopy.rotation.z = 0.12; canopy.castShadow = true; g.add(canopy);
  return g;
}
function buildTowel() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const x = c.getContext('2d');
  const cols = ['#2f8bd6', '#ffffff', '#ffd23f', '#ffffff'];
  for (let i = 0; i < 8; i++) { x.fillStyle = cols[i % 4]; x.fillRect(0, i * 16, 64, 16); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const t = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.8), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
  t.rotation.x = -Math.PI / 2; t.position.y = 0.012; t.receiveShadow = true;
  return t;
}

export function buildBeach(scene) {
  const local = new THREE.Group(); local.name = 'beach';
  // Put the far side in place: rotated 180 degrees about z, beach surface at y = FAR_Y.
  const holder = new THREE.Group();
  holder.position.set(0, L.FAR_Y, 0);
  holder.rotation.z = Math.PI;
  holder.add(local);
  scene.add(holder);

  const exitX = -pathAtDepth(-L.FAR_Y).x; // far-local x where the tunnel reaches the surface
  const uniforms = { uBulge: { value: 0 }, uCrater: { value: 0 }, uExit: { value: new THREE.Vector2(exitX, L.TUNNEL_Z) } };
  const sandGeo = new THREE.PlaneGeometry(90, 16, 360, 64);
  sandGeo.rotateX(-Math.PI / 2);
  sandGeo.translate(0, 0, -8);
  const sand = new THREE.Mesh(sandGeo, sandMaterial(uniforms));
  sand.receiveShadow = true; local.add(sand);

  const wu = { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uSun: { value: new THREE.Vector3(0, -0.1, -1).normalize() },
    uUp: { value: new THREE.Vector3(0, -1, 0) } };
  const waterGeo = new THREE.PlaneGeometry(2400, 1200, 1, 1); waterGeo.rotateX(-Math.PI / 2); waterGeo.translate(0, -0.22, -608);
  const water = new THREE.Mesh(waterGeo, waterMaterial(wu)); local.add(water);

  const palms = [];
  for (const [x, z, h, lean, seed] of [[3.6, -4.6, 5.2, -0.6, 11], [7.8, -6.5, 6.0, 0.5, 13], [-12.5, -5.0, 5.6, 0.7, 17], [-17.5, -7.2, 4.8, -0.4, 19], [12.5, -3.2, 4.6, -0.8, 23], [-5.4, -6.8, 5.0, -0.35, 29]]) {
    const p = buildPalm(seed, h, lean); p.group.position.set(x, 0, z); local.add(p.group); palms.push(p);
  }
  const umb = buildUmbrella(); umb.position.set(-10.6, 0, -3.4); local.add(umb);
  const towel = buildTowel(); towel.position.set(-10.2, 0, -2.6); towel.rotation.z = 0.3; local.add(towel);
  // a few shells and a starfish
  const shellMat = new THREE.MeshStandardMaterial({ color: 0xffe2d0, roughness: 0.5 });
  const r = rng(31);
  for (let i = 0; i < 14; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.04 + r() * 0.03, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), shellMat);
    s.position.set(-14 + r() * 26, 0.0, -0.6 - r() * 7.5); s.scale.y = 0.5; local.add(s);
  }
  local.traverse((o) => { if (o.isMesh && o !== water) o.receiveShadow = true; });
  return { holder, local, sand, water, uniforms, waterUniforms: wu, palms, exitX };
}
