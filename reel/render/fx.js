// Every effect in the film: particles, tunnel rings, heat shield, frost, icy
// vents, thruster jets, the core flash, the hologram globe, sand, ice cream.
import * as THREE from 'three';
import { Particles, emit, h } from './particles.js';
import { buildRingMachine, buildShieldMaterial } from './gadgets.js';
import { shieldGeometry } from './car.js';
import { LAYOUT, pathAtS, pathAtDepth } from './layout.js';
import { carToWorld, makeTipTrack, worldToFar, farToWorld } from './director.js';
import { clamp, lerp, smoothstep, popBounce } from './lib/util.js';
import { NOISE } from './lib/glsl.js';

const L = LAYOUT;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const C = (r, g, b) => new THREE.Color(r, g, b);

// Colour of debris by depth below the near surface.
function debrisColor(s, j) {
  const v = 0.85 + 0.3 * j;
  if (s < 1.3) return C(0.2 * v, 0.13 * v, 0.08 * v);
  if (s < 5) return C(0.36 * v, 0.24 * v, 0.14 * v);
  if (s < 10) return C(0.5 * v, 0.32 * v, 0.2 * v);
  if (s < 24) return C(0.42 * v, 0.42 * v, 0.44 * v);
  if (s < 32) return C(0.22 * v, 0.19 * v, 0.18 * v);
  if (s < 96) return C(0.12 * v, 0.06 * v, 0.04 * v);
  if (s < 111) return C(0.12 * v, 0.06 * v, 0.04 * v);
  if (s < 117) return C(0.24 * v, 0.21 * v, 0.19 * v);
  if (s < 128) return C(0.6 * v, 0.53 * v, 0.44 * v);
  return C(0.8 * v, 0.73 * v, 0.6 * v);
}
const hot = (s) => (s > 23 && s < 50) || (s > 94 && s < 118);

export function buildFX({ scene, car, carAt, TL, earth, post, beach }) {
  const E = TL.events;
  const P = new Particles(scene);
  const tip = makeTipTrack(E);
  // memoised car states for spawn times (1/600 s grid)
  const memo = new Map();
  const carState = (t) => {
    const k = Math.round(t * 600);
    if (!memo.has(k)) { memo.set(k, carAt(k / 600)); if (memo.size > 20000) memo.clear(); }
    return memo.get(k);
  };
  const gravityAt = (y) => (y > L.CORE_Y ? V(0, -9.8, 0) : V(0, 9.8, 0));

  // ---------------------------------------------------------------- rings
  const rings = buildRingMachine(220);
  scene.add(rings.mesh); scene.add(rings.caps);
  // inverse of the tip track: when does the car's tail reach path length s?
  const TAIL = L.DRILL_LEN + 4.5;
  const tAtTail = (s) => {
    let lo = E.drill_go, hi = 47;
    if (tip(hi) - TAIL < s) return Infinity;
    for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (tip(m) - TAIL < s) lo = m; else hi = m; }
    return (lo + hi) / 2;
  };
  const ringList = [];
  const crumbleS0 = 1.0, crumbleS1 = 4.8;
  const tailAtStart = tip(E.rings_start) - TAIL;
  // the crumbled stretch is lined first, zipping up from the car
  for (let s = tailAtStart - 0.5; s >= crumbleS0 - 0.01; s -= rings.W) ringList.push({ s, t: E.rings_start + (tailAtStart - s) * 0.075 });
  for (let s = tailAtStart; s < 49; s += rings.W) ringList.push({ s, t: Math.max(E.rings_start, tAtTail(s)) });
  for (let s = 100; s < 128; s += rings.W) ringList.push({ s, t: tAtTail(s) });
  earth.uniforms.uCrumbleS0.value = crumbleS0;
  earth.uniforms.uCrumbleS1.value = crumbleS1;

  // ---------------------------------------------------------------- heat shield
  const shield = buildShieldMaterial();
  const shieldMesh = new THREE.Mesh(shieldGeometry(), shield.mat);
  shieldMesh.castShadow = true; shieldMesh.visible = false;
  car.root.add(shieldMesh);

  // ---------------------------------------------------------------- frost on the glass
  const frostU = { uFrost: { value: 0 }, uTime: { value: 0 } };
  const frostMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  frostMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, frostU);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLP = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vLP;\nuniform float uFrost, uTime;\n${NOISE}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        // frost creeps in from the window edges; John's face area stays clear
        vec2 c = vec2(-0.1, 1.0);
        float dx = abs(vLP.x - c.x) / 0.5, dy = abs(vLP.y - c.y) / 0.32;
        float edge = clamp(max(dx, dy), 0.0, 1.6);
        float n = fbm3(vLP * 9.0, 0.0, 4) * 0.5 + 0.5;
        float crystals = abs(snoise(vLP * 30.0));
        float f = smoothstep(1.25 - uFrost * 0.75, 1.25 - uFrost * 0.75 + 0.2, edge * 0.85 + n * 0.45);
        // feathery ice crystals
        float fern = 1.0 - smoothstep(0.0, 0.1, abs(snoise(vLP.xy * vec2(16.0, 42.0) + snoise(vLP * 5.0) * 1.6)));
        f *= 0.62 + 0.38 * smoothstep(0.0, 0.3, crystals);
        f = clamp(f + fern * 0.3 * f, 0.0, 1.0);
        diffuseColor = vec4(vec3(0.22, 0.25, 0.3), f * 0.9);`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(0.72, 0.86, 1.0) * 0.9 * diffuseColor.a;');
  };
  frostMat.customProgramCacheKey = () => 'frost3';
  const hidden = new THREE.MeshBasicMaterial({ visible: false });
  const bodyMesh = car.root.children.find((o) => o.isMesh);
  const frostMesh = new THREE.Mesh(bodyMesh.geometry, car.mats.list.map((m, i) => (i === 2 || i === 6 ? frostMat : hidden)));
  frostMesh.scale.setScalar(1.004); frostMesh.visible = false; frostMesh.renderOrder = 5;
  car.root.add(frostMesh);

  // ---------------------------------------------------------------- thruster jets
  const jetU = { uTime: { value: 0 }, uPower: { value: 0 } };
  const jetMat = new THREE.ShaderMaterial({
    uniforms: jetU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec2 vUv; varying vec3 vP; void main(){ vUv = uv; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `${NOISE}
      uniform float uTime, uPower; varying vec2 vUv; varying vec3 vP;
      void main(){
        float along = clamp(-vP.y, 0.0, 1.0);               // 0 at nozzle, 1 at the tail end
        float core = 1.0 - smoothstep(0.0, 1.0, length(vP.xz) / (0.09 + along * 0.22));
        float flick = 0.75 + 0.25 * snoise(vec3(vP.xz * 9.0, uTime * 22.0 - along * 6.0));
        float diamonds = 0.8 + 0.2 * sin(along * 38.0 - uTime * 60.0);
        float fade = (1.0 - along) * (1.0 - along);
        vec3 col = mix(vec3(0.42, 0.68, 1.0), vec3(1.0), core * (1.0 - along));
        gl_FragColor = vec4(col * (core * 2.4 + 0.3) * flick * diamonds * fade * uPower * 7.0, 1.0);
      }`,
  });
  const jetGeo = new THREE.CylinderGeometry(0.09, 0.32, 1, 20, 8, true); jetGeo.translate(0, -0.5, 0);
  const jets = car.thrusters.nozzles.map((n) => {
    const m = new THREE.Mesh(jetGeo, jetMat);
    m.position.copy(n.exit); m.rotation.z = -Math.PI / 2; // point along car -x
    m.visible = false; m.renderOrder = 8;
    car.root.add(m);
    return m;
  });

  // ---------------------------------------------------------------- hologram globe
  // floats over the yoke, just in front of John's face (in reach of his near hand)
  const holo = new THREE.Group(); holo.position.set(0.05, 0.95, -0.36); holo.visible = false;
  const HOLO_SIZE = 0.66; // globe radius 0.1 m
  car.root.add(holo);
  const holoU = { uTime: { value: 0 }, uTap: { value: 0 }, uLock: { value: 0 } };
  const globeMat = new THREE.ShaderMaterial({
    uniforms: holoU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying vec3 vN; varying vec3 vP; varying vec3 vV; void main(){ vP = position; vN = normalize(normalMatrix * normal);
      vec4 mv = modelViewMatrix * vec4(position,1.0); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `${NOISE}
      uniform float uTime, uTap, uLock; varying vec3 vN; varying vec3 vP; varying vec3 vV;
      void main(){
        vec3 d = normalize(vP);
        // continents: mostly ocean (about a quarter land)
        float land = smoothstep(0.24, 0.3, snoise(d * 1.8 + 3.0) * 0.6 + snoise(d * 4.1) * 0.25);
        float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
        float lat = abs(fract(asin(d.y) * 3.8) - 0.5), lon = abs(fract(atan(d.z, d.x) * 2.6) - 0.5);
        float grid = (1.0 - smoothstep(0.0, 0.04, lat)) + (1.0 - smoothstep(0.0, 0.03, lon));
        float scan = 0.85 + 0.15 * sin(vP.y * 260.0 - uTime * 8.0);
        vec3 ocean = vec3(0.02, 0.22, 0.9), ground = vec3(0.3, 1.1, 0.25);
        vec3 c = mix(ocean, ground, land) + vec3(0.3, 0.7, 1.0) * grid * 0.18 + vec3(0.3, 0.7, 1.0) * fres * 0.9;
        // tap ripple
        float rip = exp(-pow((acos(clamp(dot(d, normalize(vec3(0.02, -0.385, -0.924))), -1.0, 1.0)) - uTap * 2.4) * 7.0, 2.0)) * (1.0 - uTap) * step(0.001, uTap);
        c += vec3(0.8, 1.0, 1.0) * rip * 2.5;
        gl_FragColor = vec4(c * scan * 1.25, 1.0);
      }`,
  });
  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.15, 40, 24), globeMat); holo.add(globe);
  const beamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 0.6, 1.0), transparent: true, opacity: 0.16,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.22, 24, 1, true), beamMat);
  beam.position.y = -0.17; beam.rotation.z = Math.PI; holo.add(beam);
  // path line on the globe: from the entry point, first toward open ocean, then bending to a tiny beach
  const pathMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.0, 1.6, 0.4), toneMapped: false });
  const pathPts = (bend) => {
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const u = i / 40;
      const a = lerp(-0.4, 1.0, u), b = lerp(0.2, lerp(0.2, -0.55, bend), u * u);
      pts.push(new THREE.Vector3(Math.cos(a) * Math.cos(b), Math.sin(b), Math.sin(a) * Math.cos(b)).multiplyScalar(0.158));
    }
    return pts;
  };
  const pathMesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pathPts(0)), 40, 0.01, 6), pathMat);
  holo.add(pathMesh);
  const target = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3.2, 0.6), toneMapped: false }));
  holo.add(target);
  const islandMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 2.2, 0.8), toneMapped: false });
  const island = new THREE.Mesh(new THREE.SphereGeometry(0.017, 10, 6), islandMat); holo.add(island);

  // ---------------------------------------------------------------- sand pile from the door
  const pileMat = new THREE.MeshStandardMaterial({ color: 0xd9c7a2, roughness: 1 });
  const pile = new THREE.Mesh(new THREE.SphereGeometry(0.35, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), pileMat);
  pile.castShadow = true; pile.receiveShadow = true; pile.visible = false;
  beach.local.add(pile);

  // ---------------------------------------------------------------- per-frame update
  const update = function update(t, st, camera, splatLocal) {
    P.begin();
    const tmpV = new THREE.Vector3();

    // 1. Hole opens: dirt and turf crumbs pop up and fall in.
    emit(t, { t0: E.hole_open, t1: E.hole_open + 0.35, rate: 220, life: 1.3, seed: 11 }, (k, tk, age) => {
      const a = h(11, k, 1) * Math.PI * 2, r = L.TUNNEL_R * (0.5 + 0.5 * h(11, k, 2));
      const p0 = V(Math.cos(a) * r, 0.05, L.TUNNEL_Z + Math.sin(a) * r * 0.5 + 0.3);
      const v = V(-Math.cos(a) * 1.2, 2.5 + 2.5 * h(11, k, 3), (h(11, k, 4) - 0.2) * 1.5);
      const p = p0.addScaledVector(v, age).add(V(0, -4.9 * age * age, 0));
      const c = h(11, k, 5) < 0.3 ? C(0.12, 0.3, 0.06) : debrisColor(1, h(11, k, 6));
      P.addChunk(p, V(age * 5 + k, age * 3, k), 0.03 + 0.05 * h(11, k, 7), c);
    });
    emit(t, { t0: E.hole_open, t1: E.hole_open + 0.25, rate: 60, life: 1.6, seed: 12 }, (k, tk, age, life) => {
      const a = h(12, k, 1) * Math.PI * 2;
      const p = V(Math.cos(a) * 1.0, 0.3 + age * 0.8, L.TUNNEL_Z + 0.6 + Math.sin(a) * 0.3);
      P.addPuff(p, 0.6 + age * 1.2, C(0.55, 0.42, 0.3), 0.5 * (1 - age / life), k);
    });
    // 2. Car thuds onto the pit floor: dust and clods.
    emit(t, { t0: E.car_land, t1: E.car_land + 0.15, rate: 260, life: 1.0, seed: 21 }, (k, tk, age) => {
      const a = h(21, k, 1) * Math.PI - Math.PI / 2;
      const p0 = V((h(21, k, 2) - 0.5) * 1.6, -L.PIT_DEPTH + 0.1, 0.1 + h(21, k, 3) * 0.3);
      const v = V(Math.sin(a) * 2.5, 2 + 3 * h(21, k, 4), 0.5 + h(21, k, 5) * 1.5);
      const p = p0.addScaledVector(v, age).add(V(0, -4.9 * age * age, 0));
      P.addChunk(p, V(age * 6, k, age * 4), 0.025 + 0.04 * h(21, k, 6), debrisColor(4, h(21, k, 7)));
    });
    emit(t, { t0: E.car_land, t1: E.car_land + 0.2, rate: 70, life: 1.8, seed: 22 }, (k, tk, age, life) => {
      const p = V((h(22, k, 1) - 0.5) * 2.2, -L.PIT_DEPTH + 0.3 + age * 0.9, 0.3 + h(22, k, 2) * 0.4);
      P.addPuff(p, 0.7 + age * 1.4, C(0.5, 0.38, 0.27), 0.55 * (1 - age / life), k);
    });
    // 3. Spinning tyres: a fountain of dirt shooting out of the hole.
    for (const [wx, wz, sd] of [[1.0, -0.85, 31], [1.0, 0.85, 32], [-1.65, -0.85, 33], [-1.65, 0.85, 34]]) {
      emit(t, { t0: E.spin_start + 0.1, t1: E.spin_end, rate: 55, life: 1.8, seed: sd }, (k, tk, age) => {
        const s0 = carState(tk);
        const p0 = carToWorld(s0, V(wx, 0.05, wz));
        p0.z = Math.max(p0.z, -0.4) + h(sd, k, 9) * 0.3;
        const v = V((h(sd, k, 1) - 0.3) * 2.4, 7.5 + 4.5 * h(sd, k, 2), 0.6 + h(sd, k, 3) * 2.2);
        const p = p0.addScaledVector(v, age).add(V(0, -4.9 * age * age, 0));
        if (p.y < 0.02 && age > 0.6) p.y = 0.02; // settle on the lawn
        P.addChunk(p, V(age * 9 + k, age * 7, k), 0.025 + 0.055 * h(sd, k, 4), debrisColor(2 + 2 * h(sd, k, 5), h(sd, k, 6)));
      });
    }
    emit(t, { t0: E.spin_start + 0.2, t1: E.spin_end, rate: 26, life: 2.0, seed: 35 }, (k, tk, age, life) => {
      const p = V((h(35, k, 1) - 0.5) * 2.4, -2.2 + age * 2.4, 0.4 + h(35, k, 2) * 0.5);
      P.addPuff(p, 0.8 + age * 1.3, C(0.48, 0.36, 0.25), 0.45 * Math.sin(Math.PI * age / life), k);
    });
    // 4. Drill snaps on: a glint.
    if (t > E.drill_snap && t < E.drill_snap + 0.7) {
      const u = (t - E.drill_snap) / 0.7;
      const gp = carToWorld(st, V(3.0, 1.3, -1.25));
      const g = Math.sin(u * Math.PI) * 6;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI + u * 1.2;
        P.addSpark(gp.clone().addScaledVector(V(Math.cos(a), Math.sin(a), 0), -0.18 * (1 - u) - 0.05), V(Math.cos(a), Math.sin(a), 0), 0.5 * (1 - u * 0.5), 0.012, C(g, g, g * 0.9));
      }
    }
    // 5. Drilling debris (and sparks in hot rock), both sides of the Earth.
    const drilling = (t > E.drill_go && t < E.zoom_start) || (t > E.zoom_end + 0.3 && t < E.burst);
    if (t > E.drill_go) {
      emit(t, { t0: E.drill_go, t1: E.burst, rate: 46, life: 1.1, seed: 51 }, (k, tk, age) => {
        if ((tk > E.zoom_start && tk < E.zoom_end + 0.3)) return;
        const s0 = carState(tk);
        const sTip = s0.s;
        const tp = carToWorld(s0, V(3.5, 0.6, 0));
        const g = gravityAt(tp.y);
        const out = h(51, k, 1) < 0.5 ? -1 : 1;
        const back = 1; // always flung back up the tunnel (world +y on both sides)
        const p0 = V(tp.x + out * (0.5 + 0.4 * h(51, k, 2)), tp.y + back * 0.4, 0.05 + 0.25 * h(51, k, 3));
        const v = V(out * (1.2 + 2.5 * h(51, k, 4)), back * (2.0 + 3.0 * h(51, k, 5)), 1.0 + 2.5 * h(51, k, 6));
        const p = p0.addScaledVector(v, age).addScaledVector(g, 0.5 * age * age);
        if (hot(sTip) && h(51, k, 7) < 0.6) {
          const vv = v.clone().addScaledVector(g, age);
          const glow = 4 + 6 * h(51, k, 8);
          P.addSpark(p, vv.clone().normalize(), 0.06 + vv.length() * 0.02, 0.01, C(glow, glow * 0.45, glow * 0.08));
        } else {
          P.addChunk(p, V(age * 8 + k, age * 5, k), 0.02 + 0.05 * h(51, k, 9), debrisColor(sTip, h(51, k, 10)));
        }
      });
    }
    void drilling;
    // 6. Crumbling tunnel walls behind the car.
    emit(t, { t0: E.crumble_start, t1: E.crumble_end, rate: 38, life: 1.5, seed: 61 }, (k, tk, age) => {
      const s = lerp(crumbleS0 + 0.3, crumbleS1, h(61, k, 1));
      const pa = pathAtS(s);
      const side = h(61, k, 2) < 0.5 ? -1 : 1;
      const p0 = V(pa.x + side * (0.75 + 0.15 * h(61, k, 3)), pa.y, -0.05 + 0.3 * h(61, k, 4));
      const v = V(-side * 0.6 * h(61, k, 5), -0.5 * h(61, k, 6), 0.4 * h(61, k, 7));
      const p = p0.addScaledVector(v, age).add(V(0, -4.9 * age * age, 0));
      P.addChunk(p, V(age * 4 + k, age * 3, k), 0.04 + 0.08 * h(61, k, 8), debrisColor(s, h(61, k, 9)));
    });
    emit(t, { t0: E.crumble_start, t1: E.crumble_end, rate: 14, life: 1.6, seed: 62 }, (k, tk, age, life) => {
      const s = lerp(crumbleS0, crumbleS1, h(62, k, 1));
      const pa = pathAtS(s);
      const p = V(pa.x + (h(62, k, 2) - 0.5) * 1.6, pa.y - age * 0.8, 0.15);
      P.addPuff(p, 0.5 + age, C(0.45, 0.34, 0.24), 0.4 * Math.sin(Math.PI * age / life), k);
    });
    earth.uniforms.uCrumble.value = smoothstep(E.crumble_start, E.crumble_start + 1.2, t) * (1 - smoothstep(E.rings_start, E.rings_start + 1.4, t));

    // Rings: pop out of the tail and snap onto the tunnel wall.
    {
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
      let n = 0, nc = 0;
      const capM = new THREE.Matrix4();
      for (const r of ringList) {
        if (t < r.t) continue;
        const u = clamp((t - r.t) / 0.32);
        const pop = popBounce(u);
        const pa = pathAtS(r.s);
        const dir = V(Math.sin(pa.ang), -Math.cos(pa.ang), 0);
        q.setFromUnitVectors(V(0, 1, 0), dir.clone().negate());
        const scR = lerp(0.82, 1.0, pop), scY = lerp(0.3, 1.0, Math.min(1, pop * 1.2));
        sc.set(scR, scY, scR);
        m4.compose(V(pa.x, pa.y, L.TUNNEL_Z), q, sc);
        rings.mesh.setMatrixAt(n++, m4);
        // the cut-section caps (two per ring) on the plane z = 0
        const hw = Math.sqrt(Math.max(0, (rings.Ro * scR) ** 2 - 1)) , hi = Math.sqrt(Math.max(0, (rings.Ri * scR) ** 2 - 1));
        for (const sd of [-1, 1]) {
          const cx = (hw + hi) / 2 * sd;
          capM.compose(V(pa.x + cx * Math.cos(pa.ang) - dir.x * (rings.W * scY) / 2, pa.y + cx * Math.sin(pa.ang) - dir.y * (rings.W * scY) / 2, 0.001),
            new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), pa.ang), V(Math.max(0.001, hw - hi), rings.W * scY, 1));
          rings.caps.setMatrixAt(nc++, capM);
        }
        // a puff of dust as each ring thunks home
        if (u < 1) {
          for (let i = 0; i < 3; i++) P.addPuff(V(pa.x + (i - 1) * 0.6, pa.y, 0.2), 0.3 + u * 0.6, C(0.75, 0.73, 0.7), 0.35 * (1 - u), i);
        }
      }
      rings.mesh.count = n; rings.mesh.instanceMatrix.needsUpdate = true;
      rings.caps.count = nc; rings.caps.instanceMatrix.needsUpdate = true;
    }

    // Heat shield: wraps nose -> tail with a pop, peels off later.
    const wrapOn = clamp((t - E.shield_wrap) / (E.shield_done - E.shield_wrap));
    const wrapOff = clamp((t - E.shield_off) / 0.5);
    shield.uniforms.uWrap.value = Math.max(0, wrapOn - wrapOff);
    shield.uniforms.uTime.value = t;
    shieldMesh.visible = t > E.shield_wrap && wrapOff < 1;
    const sPop = t < E.shield_done + 0.4 ? popBounce(clamp((t - E.shield_wrap) / 0.6)) : 1;
    shieldMesh.scale.set(1, 0.97 + 0.03 * sPop, 0.97 + 0.03 * sPop);

    // Frost grows on the windows, melts near the core.
    const frost = smoothstep(E.frost, E.frost + 1.1, t) * (1 - smoothstep(31.0, 33.0, t));
    frostU.uFrost.value = frost; frostU.uTime.value = t;
    frostMesh.visible = frost > 0.01;

    // Icy air from little vents.
    if (t > E.vents - 0.1 && t < 31.2) {
      for (const [vx, vy, vz, sd] of [[1.55, 0.62, -1.02, 71], [0.44, 0.88, -0.93, 72], [-1.95, 0.72, -1.0, 73], [-1.12, 0.98, -0.86, 74]]) {
        emit(t, { t0: E.vents, t1: 31.0, rate: 34, life: 0.9, seed: sd }, (k, tk, age, life) => {
          const s0 = carState(tk);
          const p0 = carToWorld(s0, V(vx, vy, vz));
          const dirL = V(-1.0 - 0.6 * h(sd, k, 1), (h(sd, k, 2) - 0.5) * 0.8, -0.8 - 0.8 * h(sd, k, 3)).applyQuaternion(s0.quat);
          const p = p0.addScaledVector(dirL, age * 1.4);
          const a = Math.sin(Math.PI * Math.min(1, age / life)) * (t < 30.6 ? 1 : 1 - (t - 30.6) / 0.6);
          P.addPuff(p, 0.15 + age * 1.1, C(0.72, 0.92, 1.3), 0.62 * a, k);
          if (h(sd, k, 4) < 0.15) P.addSpark(p.clone().addScaledVector(dirL, 0.1), dirL.clone().normalize(), 0.03, 0.005, C(1.0, 1.6, 2.4));
        });
      }
    }

    // Thrusters: blue-white jets, sparks, and the dash through the core.
    const power = smoothstep(E.thrusters - 0.05, E.thrusters + 0.12, t) * (1 - smoothstep(E.zoom_end + 0.1, E.zoom_end + 0.7, t));
    jetU.uPower.value = power; jetU.uTime.value = t;
    car.thrusters.innerMat.emissiveIntensity = power * 6;
    jets.forEach((j, i) => { j.visible = power > 0.01; j.scale.set(1, 1.6 + 2.6 * power + 0.2 * Math.sin(t * 40 + i), 1); });
    if (power > 0.01) {
      emit(t, { t0: E.thrusters, t1: E.zoom_end + 0.5, rate: 160, life: 0.25, seed: 81 }, (k, tk, age) => {
        const n = car.thrusters.nozzles[k % 4];
        const s0 = carState(tk);
        const p0 = carToWorld(s0, n.exit.clone());
        const dir = V(-1, (h(81, k, 1) - 0.5) * 0.25, (h(81, k, 2) - 0.5) * 0.25).applyQuaternion(s0.quat).normalize();
        const p = p0.addScaledVector(dir, age * 14);
        const g = 6 * (1 - age / 0.4);
        P.addSpark(p, dir, 0.25, 0.012, C(g * 0.6, g * 0.85, g));
      });
    }
    // speed streaks while zooming through the core
    const zoom = smoothstep(E.zoom_start - 0.2, E.zoom_start + 0.2, t) * (1 - smoothstep(E.zoom_end - 0.1, E.zoom_end + 0.35, t));
    if (zoom > 0.01) {
      const cen = carToWorld(st, V(0, 0.6, 0));
      for (let i = 0; i < 70; i++) {
        const ph = (h(91, i, 1) + t * (2.5 + 2 * h(91, i, 2))) % 1;
        const x = (h(91, i, 3) - 0.5) * 9, z = -1.5 + h(91, i, 4) * 3.5;
        const dy = (ph - 0.5) * 18;
        const p = V(cen.x + x, cen.y + dy, z);
        const b = (1.2 + 2.4 * h(91, i, 5)) * zoom;
        P.addSpark(p, V(0, 1, 0), 2.5 + 3 * zoom, 0.02, C(b, b * 0.72, b * 0.32));
      }
    }
    post.haze.uniforms.uFlash.value = Math.exp(-Math.pow((t - E.flash) / 0.04, 2)) * 0.15;
    post.haze.uniforms.uStreak.value = zoom * 0.38;
    // blur along the on-screen direction of travel (world -y) under the camera roll
    { const ru = camera.up; post.haze.uniforms.uStreakDir.value.set(-ru.x * 0 + ru.x, ru.y).normalize(); }

    // Hologram globe on the dashboard.
    const hp = popBounce(clamp((t - E.holo_pop) / 0.4));
    const hOff = 1 - smoothstep(E.surface_rise - 0.4, E.surface_rise, t);
    holo.visible = t > E.holo_pop && hOff > 0.01;
    holo.scale.setScalar(Math.max(0.001, hp * hOff) * HOLO_SIZE);
    // spins until the tap, then turns the new landing spot toward us
    globe.rotation.y = 0.6 * (Math.max(0, Math.min(t, E.holo_tap) - E.holo_pop)) + 0.67 * smoothstep(E.holo_tap, E.holo_tap + 0.8, t);
    holoU.uTime.value = t;
    holoU.uTap.value = t > E.holo_tap ? clamp((t - E.holo_tap) / 0.7) : 0;
    const bend = smoothstep(E.path_bend, E.beach_lock, t);
    if (!pathMesh.userData.bend || Math.abs(pathMesh.userData.bend - bend) > 0.01) {
      pathMesh.geometry.dispose();
      pathMesh.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pathPts(bend)), 40, 0.01, 6);
      pathMesh.userData.bend = bend;
    }
    const pts = pathPts(bend);
    target.position.copy(pts[pts.length - 1]);
    island.position.copy(pathPts(1)[40]);
    const lock = smoothstep(E.beach_lock - 0.1, E.beach_lock + 0.2, t);
    target.scale.setScalar(1 + lock * (0.6 + 0.4 * Math.sin(t * 12)));
    pathMesh.rotation.y = globe.rotation.y; target.rotation.y = globe.rotation.y;
    pathMesh.position.set(0, 0, 0);
    // keep the path drawn in the globe's frame
    const gRot = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), globe.rotation.y);
    target.position.applyQuaternion(gRot); island.position.applyQuaternion(gRot);
    pathMesh.quaternion.copy(gRot);

    // Beach: sand bursts out, the car lands, ice cream plops, sand pours from the door.
    const exitL = V(beach.exitX, 0, L.TUNNEL_Z);
    const toW = (v) => farToWorld(v);
    emit(t, { t0: E.sand_bulge, t1: E.burst, rate: 40, life: 0.6, seed: 101 }, (k, tk, age) => {
      const a = h(101, k, 1) * 6.28, r = 0.3 + 0.9 * h(101, k, 2);
      const pL = V(exitL.x + Math.cos(a) * r, 0.25 + age * 1.5 - 4.9 * age * age, exitL.z + Math.sin(a) * r * 0.6);
      P.addChunk(toW(pL), V(age * 4, k, 0), 0.02 + 0.02 * h(101, k, 3), C(0.86, 0.78, 0.62));
    });
    emit(t, { t0: E.burst, t1: E.burst + 0.22, rate: 1500, life: 1.6, seed: 102 }, (k, tk, age) => {
      const a = h(102, k, 1) * 6.28, spd = 3 + 7 * h(102, k, 2);
      const vL = V(Math.cos(a) * spd * 0.45, 4 + 8 * h(102, k, 3), Math.sin(a) * spd * 0.35 + 0.8);
      const pL = V(exitL.x + Math.cos(a) * 0.5, 0.1, exitL.z + Math.sin(a) * 0.4).addScaledVector(vL, age);
      pL.y -= 0.5 * 12 * age * age;
      if (pL.y < 0.02) pL.y = 0.02;
      const c = h(102, k, 4) < 0.25 ? C(0.66, 0.56, 0.42) : C(0.9, 0.83, 0.68);
      P.addChunk(toW(pL), V(age * 7 + k, age * 5, k), 0.018 + 0.04 * h(102, k, 5), c);
    });
    emit(t, { t0: E.burst, t1: E.burst + 0.3, rate: 90, life: 2.2, seed: 103 }, (k, tk, age, life) => {
      const a = h(103, k, 1) * 6.28;
      const pL = V(exitL.x + Math.cos(a) * (0.5 + age * 1.3), 0.4 + age * (1.0 + h(103, k, 2)), exitL.z + 0.2 + Math.sin(a) * 0.5);
      P.addPuff(toW(pL), 0.9 + age * 1.6, C(0.92, 0.86, 0.74), 0.5 * (1 - age / life), k);
    });
    emit(t, { t0: E.land, t1: E.land + 0.12, rate: 700, life: 1.0, seed: 104 }, (k, tk, age) => {
      const wx = [1.0, -1.65][k % 2];
      const base = st.originLocal ? V(-6.2 - wx, 0.05, -1.15) : exitL;
      const a = h(104, k, 1) * Math.PI;
      const vL = V(Math.cos(a) * 2.5, 1.5 + 2.5 * h(104, k, 2), 0.5 + 1.5 * h(104, k, 3));
      const pL = base.clone().addScaledVector(vL, age); pL.y -= 6 * age * age; if (pL.y < 0.02) pL.y = 0.02;
      P.addChunk(toW(pL), V(age * 6, k, 0), 0.015 + 0.03 * h(104, k, 4), C(0.88, 0.8, 0.65));
    });
    emit(t, { t0: E.land, t1: E.land + 0.2, rate: 60, life: 1.6, seed: 105 }, (k, tk, age, life) => {
      const pL = V(-6.2 + (h(105, k, 1) - 0.5) * 4.2, 0.3 + age * 0.6, -1.0 + h(105, k, 2) * 0.6);
      P.addPuff(toW(pL), 0.7 + age * 1.1, C(0.9, 0.84, 0.72), 0.45 * (1 - age / life), k);
    });
    // ice-cream plop splash
    emit(t, { t0: E.plop, t1: E.plop + 0.05, rate: 400, life: 0.5, seed: 106 }, (k, tk, age) => {
      const a = h(106, k, 1) * 6.28;
      const base = splatLocal ? splatLocal.clone().setY(0.05) : V(-7.6, 0.05, -0.3);
      const pL = base.clone().add(V(Math.cos(a) * age * 0.8, age * 1.6 - 6 * age * age, Math.sin(a) * age * 0.8));
      if (pL.y < 0.01) pL.y = 0.01;
      P.addChunk(toW(pL), V(0, k, 0), 0.012, C(1.0, 0.62, 0.78));
    });
    // sand pours out of the open door
    const pour = smoothstep(E.sand_pour, E.sand_pour + 0.2, t) * (1 - smoothstep(E.sand_pour + 1.1, E.sand_pour + 1.6, t));
    emit(t, { t0: E.sand_pour, t1: E.sand_pour + 1.5, rate: 260, life: 0.7, seed: 107 }, (k, tk, age) => {
      const sill = V(-6.2 + 0.05 - 0.4 * (h(107, k, 1) - 0.5), 0.36, -1.02);
      const pL = sill.clone().add(V((h(107, k, 2) - 0.5) * 0.1, -6 * age * age, 0.25 * age + 0.05 * h(107, k, 3)));
      if (pL.y < 0.03) return;
      P.addChunk(toW(pL), V(age * 5, k, 0), 0.012 + 0.014 * h(107, k, 4), C(0.9, 0.82, 0.66));
    });
    pile.visible = t > E.sand_pour + 0.2;
    const pg = clamp((t - E.sand_pour - 0.2) / 1.4);
    pile.scale.set(0.3 + 0.7 * pg, 0.25 + 0.55 * pg, 0.3 + 0.7 * pg);
    pile.position.set(-6.2 + 0.05, 0, -0.85);
    void pour; void tmpV; void worldToFar; void pathAtDepth; void camera;

    P.end();
  };
  update.shieldMat = shield.mat;
  return update;
}
