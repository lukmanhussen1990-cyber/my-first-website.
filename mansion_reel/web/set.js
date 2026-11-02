// All sets of the mansion reel + sky + lights. Everything visual is a pure function of t + state (reset every frame).
// state.loc picks the location that is shown (others are hidden: faster renders):
//   'street' | 'ext' (mansion outside; the hallway shows through the open door) | 'in' (hallway + bathrooms) | 'zoo'
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mat, tex, clamp, lerp, smooth, v3 } from './lib.js';
import { SUN, SKY, BATH, THRONE, HALL, MANSION } from './layout.js';
import { buildCity } from './set_city.js';
import { buildMansion } from './set_mansion.js';
import { buildZoo } from './set_zoo.js';
import { buildProps } from './set_props.js';
import { glowDiscCanvas } from './set_tex2.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const C = (h) => new THREE.Color(h);
const SUNV = V(...SUN.dir).normalize();

function buildSky() {
  const g = new THREE.SphereGeometry(360, 40, 20);
  const p = g.attributes.position, col = new Float32Array(p.count * 3);
  const hz = C(SKY.horizon), mid = C(SKY.mid), zen = C(SKY.top), glow = C(SKY.glow), below = C('#3a3430'), opp = C('#d8a8a0');
  const sunH = V(SUNV.x, 0, SUNV.z).normalize();
  for (let i = 0; i < p.count; i++) {
    const d = V(p.getX(i), p.getY(i), p.getZ(i)).normalize();
    const el = Math.asin(clamp(d.y, -1, 1));
    const az = V(d.x, 0, d.z).normalize().dot(sunH);
    let c = opp.clone().lerp(hz, Math.pow(clamp((az + 1) / 2), 1.4));
    c.lerp(mid, smooth(clamp(el / 0.35)));
    c.lerp(zen, smooth(clamp((el - 0.25) / 0.9)));
    c.lerp(glow, clamp(Math.pow(Math.max(0, d.dot(SUNV)), 8) * 0.85));
    if (el < 0) c.lerp(below, smooth(clamp(-el / 0.1)));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false });
  const sky = new THREE.Mesh(g, m); sky.name = 'set.sky'; sky.renderOrder = -10; sky.userData.noAudit = true;
  const glowT = tex(glowDiscCanvas(64), { nearest: false });
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, color: C('#ffe0a0'), fog: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  sun.scale.set(70, 70, 1); sun.name = 'set.sunDisc'; sun.userData.noAudit = true;
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, color: C('#fff6e2'), fog: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  core.scale.set(20, 20, 1); core.name = 'set.sunCore'; core.userData.noAudit = true;
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, color: C('#dfe8ff'), fog: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  moon.scale.set(16, 16, 1); moon.name = 'set.moon'; moon.userData.noAudit = true;
  // a few soft clouds (flat sprites around the horizon)
  const clouds = [];
  const cm = new THREE.SpriteMaterial({ map: glowT, color: C('#ffd6c0'), fog: false, transparent: true, depthWrite: false, opacity: 0.35 });
  for (let i = 0; i < 9; i++) { const s = new THREE.Sprite(cm); s.scale.set(90 + i * 7, 18, 1); s.name = 'set.cloud'; s.userData.noAudit = true; s.userData.dir = V(Math.cos(i * 0.9 + 0.4), 0.12 + (i % 3) * 0.06, Math.sin(i * 0.9 + 0.4)).normalize(); clouds.push(s); }
  return { sky, sun, core, moon, clouds };
}

const LOC_BY_SHOT = (n) => (n <= 4 ? 'street' : n <= 13 ? 'ext' : n <= 32 ? 'in' : n <= 37 ? 'zoo' : n <= 40 ? 'in' : n === 41 ? 'ext' : 'in');

export function buildSet(world) {
  const { scene, renderer } = world;
  const group = new THREE.Group(); group.name = 'set'; scene.add(group);
  // environment for gold / marble reflections (only on materials that ask for it)
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  scene.fog = new THREE.Fog(C('#e6b48c'), 40, 260);
  const sk = buildSky(); group.add(sk.sky, sk.sun, sk.core, sk.moon, ...sk.clouds);
  const city = buildCity(); group.add(city.group);
  const mansion = buildMansion(env); group.add(mansion.group);
  const zoo = buildZoo(); group.add(zoo.group);
  const hp = buildProps(env); group.add(hp.group);

  // lights: ONE shadow-casting key light (the sun outside, the warm ceiling light inside)
  const sun = new THREE.DirectionalLight(C(SUN.color), SUN.intensity); sun.name = 'set.sun';
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.025;
  group.add(sun); group.add(sun.target);
  const hemi = new THREE.HemisphereLight(C('#ffd8bc'), C('#4a4038'), 1.5); hemi.name = 'set.hemi'; group.add(hemi);
  const fill = new THREE.DirectionalLight(C('#ffe6d2'), 0); fill.name = 'set.fill'; group.add(fill); group.add(fill.target);
  // disco lights (no shadows), only on during the party
  const discoLights = ['#ff3a6a', '#3a8aff', '#3aff7a', '#ffd23a'].map((c, i) => { const l = new THREE.PointLight(C(c), 0, 14, 1.6); l.name = `set.discoLight${i}`; group.add(l); return l; });
  const bulb = new THREE.PointLight(C('#ffd8a0'), 0, 16, 1.4); bulb.name = 'set.warmBulb'; group.add(bulb);

  const props = { city, mansion, zoo, sun, hemi, fill, env, sky: sk.sky, shops: city.shops, throne: mansion.throne, myThrone: mansion.myThrone,
    leaves: mansion.leaves, bathDoor: mansion.bathDoor, yourDoor: mansion.yourDoor, disco: mansion.disco, plaque: mansion.plaque,
    espresso: hp.espresso, mug: hp.mug, key: hp.key, towel: hp.towel };
  const colliders = [];
  const defaults = () => ({
    loc: 'street', interior: false,
    fog: null, shadow: { center: [0, 1, 0], radius: 8 }, fill: { dir: [0, 0.3, -1], intensity: 0.3, color: '#ffe6d2' },
    exposure: 1.1, sunIntensity: 1.0, hemi: 1.0,
    key: null,                     // interior key light {dir, color, intensity}
    day: 0,                        // time-lapse: sky cycle phase (0 = this sunset); night when cos < 0
    frontDoor: 0, bathDoor: 0, yourDoor: 0,
    disco: 0, discoSpin: 0, party: 0,
    buttons: null,                 // function(i, t) -> 0..1 glow, or a number for all
    seatSpin: 0, seatTilt: 0, panelShake: 0,
    windowsLit: 1, bulb: 0, bulbPos: [0, 3, 0],
  });
  const set = { group, colliders, props, anchors: {}, state: defaults(), env,
    reset(t, ctx) {
      const s = (set.state = defaults());
      hp.reset();
      const n = ctx && ctx.shot ? Number(ctx.shot.id.slice(1)) : 1;
      s.loc = LOC_BY_SHOT(n);
      s.interior = s.loc === 'in';
      // story continuity
      if (n >= 9 && n <= 13) s.frontDoor = 1;
      if (n >= 23 && n <= 40) s.bathDoor = n === 23 ? 0 : 1;
      if (n >= 21 && n <= 24) s.disco = 1, s.party = 1;
      if (n === 25) s.disco = 1;
    },
    commit(ctx) {
      const s = set.state, t = ctx.t, cam = ctx.camera;
      // ---- which location
      const locs = Array.isArray(s.loc) ? s.loc : [s.loc];
      city.group.visible = locs.includes('street');
      mansion.ext.visible = locs.includes('ext');
      mansion.inn.visible = locs.includes('in') || (locs.includes('ext') && s.frontDoor > 0.01);
      zoo.group.visible = locs.includes('zoo');
      const inside = s.interior;
      sk.sky.visible = sk.sun.visible = sk.core.visible = !inside;
      for (const c of sk.clouds) c.visible = !inside;
      // ---- sky / time of day (time-lapse)
      const dayA = s.day * Math.PI * 2;
      const night = clamp(-Math.cos(dayA) * 1.6 + 0.2);         // 0 at day 0, 1 at day 0.5
      const sunDir = SUNV.clone().applyAxisAngle(V(0.6, 0, 0.8).normalize(), dayA);
      sk.sky.material.color.setRGB(1, 1, 1).lerp(C('#1c2448'), night * 0.85);
      sk.sky.position.copy(cam.position);
      sk.sun.position.copy(cam.position).addScaledVector(sunDir, 330); sk.core.position.copy(sk.sun.position);
      sk.sun.visible = sk.core.visible = !inside && sunDir.y > -0.05;
      sk.moon.visible = !inside && night > 0.3;
      sk.moon.position.copy(cam.position).addScaledVector(sunDir.clone().negate(), 330);
      sk.moon.material.opacity = night;
      for (const c of sk.clouds) { c.position.copy(cam.position).addScaledVector(c.userData.dir.clone().applyAxisAngle(V(0, 1, 0), t * 0.004 + s.day * 2), 320); c.material.color.set('#ffd6c0').lerp(C('#3a4060'), night); }
      // ---- fog
      const fogDef = inside ? (locs.includes('in') && ctx.camera.position.z < HALL.z1 ? { color: '#d2a454', near: 22, far: 95 } : { color: '#e8cfa0', near: 30, far: 400 })
        : locs.includes('zoo') ? { color: '#efb994', near: 45, far: 470 } : locs.includes('ext') ? { color: '#efc19a', near: 60, far: 330 } : { color: '#e6b48c', near: 35, far: 230 };
      const fog = s.fog || fogDef;
      scene.fog.color.set(fog.color).lerp(C('#141a30'), night * 0.8); scene.fog.near = fog.near; scene.fog.far = fog.far;
      // ---- lights
      world.renderer.toneMappingExposure = s.exposure * (1 - night * 0.35);
      const c = V(...s.shadow.center), r = s.shadow.radius;
      if (inside) {
        const k = s.key || { dir: [0.25, 1, -0.45], color: '#ffe0b4', intensity: 2.0 };
        const kd = V(...k.dir).normalize();
        sun.color.set(k.color); sun.intensity = k.intensity * s.sunIntensity;
        sun.target.position.copy(c); sun.position.copy(c).addScaledVector(kd, 30);
        hemi.color.set('#ffe6c4'); hemi.groundColor.set('#7a5a38'); hemi.intensity = 1.35 * s.hemi;
      } else {
        sun.color.set(SUN.color).lerp(C('#8aa0ff'), night); sun.intensity = SUN.intensity * s.sunIntensity * Math.max(0.12, 1 - night * 0.9);
        const sd = sunDir.y > 0.05 ? sunDir : sunDir.clone().negate();
        sun.target.position.copy(c); sun.position.copy(c).addScaledVector(sd, 60);
        hemi.color.set('#ffd8bc').lerp(C('#4a5a90'), night); hemi.groundColor.set('#4a4038').lerp(C('#141420'), night); hemi.intensity = 1.5 * s.hemi * (1 - night * 0.5);
      }
      Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: 160 }); sun.shadow.camera.updateProjectionMatrix();
      fill.intensity = s.fill.intensity; fill.color.set(s.fill.color);
      fill.target.position.copy(c); fill.position.copy(c).addScaledVector(V(...s.fill.dir).normalize(), 20);
      bulb.intensity = s.bulb; bulb.position.set(...s.bulbPos);
      // ---- mansion doors
      const fd = smooth(clamp(s.frontDoor)) * 1.45;
      for (const piv of mansion.leaves) piv.rotation.y = piv.userData.sd * fd;
      mansion.bathDoor.rotation.y = -smooth(clamp(s.bathDoor)) * 1.7;
      mansion.yourDoor.rotation.y = smooth(clamp(s.yourDoor)) * 1.55;
      for (const w of mansion.winLit) { w.material.emissiveIntensity = 0.55 * s.windowsLit * (0.4 + night * 1.4); }
      // ---- toilet: buttons, seat spin
      const th = mansion.throne;
      th.buttons.forEach((b, i) => {
        const v = typeof s.buttons === 'function' ? s.buttons(i, t) : (s.buttons ?? 0);
        b.material.emissiveIntensity = 0.06 + clamp(v) * 1.6;
        b.position.y = 0.035 - clamp(v) * 0.008;
      });
      th.seat.rotation.y = s.seatSpin;
      if (th.panel.userData.top) th.panel.userData.top.position.x = Math.sin(t * 60) * 0.004 * s.panelShake;
      // ---- disco ball + party lights
      const dz = smooth(clamp(s.disco));
      const ball = mansion.disco.userData.ball, chain = mansion.disco.userData.chain;
      mansion.disco.visible = dz > 0.001;
      const by = BATH.ceilY - 0.05 - dz * 1.55;
      ball.position.set(THRONE.pos[0], by, 188.6); ball.rotation.y = t * 1.6 + s.discoSpin;
      chain.position.set(THRONE.pos[0], by + 0.4, 188.6); chain.scale.set(1, Math.max(0.01, BATH.ceilY - by - 0.4), 1);
      const party = clamp(s.party);
      discoLights.forEach((l, i) => {
        const a = t * 2.2 + i * Math.PI / 2;
        l.position.set(THRONE.pos[0] + Math.cos(a) * 3.2, BATH.floorY + 2.6 + Math.sin(a * 1.3) * 0.6, 188.6 + Math.sin(a) * 3.2);
        l.intensity = party * (inside ? 9 : 0) * (0.6 + 0.4 * Math.sin(t * 9 + i * 2));
      });
      for (const ch of mansion.chand) ch.rotation.y = 0;
    },
  };
  return set;
}
