// 'riot' set (S6): who Barabbas is — a night flashback of the insurrection (Mark 15:7), shown only as fire, smoke,
// running people and their huge shadows on a wall; no violence. Barabbas strides toward us through the street with a
// torch, hard-eyed. Layout in src/cams/riot.js (RIOT).
import * as THREE from 'three';
import { makeMudHouse, makeBevelBox, scatterPots, scatterBaskets, scatterPebbles, makeStone } from '../kit.js';
import { makeFire, makeMotes, makeSprites, puffTex, FLAME_FS } from '../fx.js';
import { MOODS, merge } from '../moods.js';
import { Person, Poses, expr } from '../rig.js';
import '../poses3.js';
import { BARABBAS, JERUSALEM_CROWD } from '../characters/cast.js';
import { clamp, smooth, invLerp, lerp, hash01, noise2 } from '../../lib/util.js';
import { RIOT } from '../../cams/riot.js';

// a hand torch: wooden stick, wrapped head, live flame (additive shader planes) + glow
function makeTorch(seed = 3) {
  const g = new THREE.Group();
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.62, 6).translate(0, 0.2, 0), new THREE.MeshLambertMaterial({ color: '#5a3c22', flatShading: true })); stick.castShadow = true; g.add(stick);
  const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.12, 7).translate(0, 0.53, 0), new THREE.MeshLambertMaterial({ color: '#3a2618', flatShading: true })); g.add(wrap);
  const flames = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), new THREE.ShaderMaterial({ uniforms: { time: { value: 0 }, seed: { value: seed + i * 2.3 }, k: { value: 1 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: FLAME_FS }));
    m.position.y = 0.55; m.renderOrder = 7; g.add(m); flames.push(m);
  }
  const _p = new THREE.Vector3();
  return {
    group: g,
    head: () => g.localToWorld(_p.set(0, 0.7, 0)),
    set(t, cam) {
      const o = g.getWorldPosition(new THREE.Vector3()), yaw = Math.atan2(cam.position.x - o.x, cam.position.z - o.z);
      flames.forEach((m, i) => { m.material.uniforms.time.value = t + i * 0.3; m.quaternion.copy(g.getWorldQuaternion(new THREE.Quaternion()).invert()); m.rotateY(yaw + (i - 1) * 0.25); const s = (i ? 0.75 : 1) * (0.9 + 0.15 * noise2(t * 3, i, seed)); m.scale.set(0.3 * s, 0.6 * s, 1); });
    },
  };
}

export function build(ctx) {
  const { plan } = ctx; const E = plan.ev; const Bk = ctx.B.riot;
  const g = new THREE.Group();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 40, 30, 12).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#7a6448', flatShading: true }));
  ground.position.x = -10; ground.receiveShadow = true; g.add(ground);
  // houses along both sides of the street (doors to the street) + the house closing its far end
  let i = 0;
  for (let x = -24; x < 8; x += 4.6) {
    for (const side of [-1, 1]) {
      const w = 4.0 + 0.5 * hash01(i, 2), d = 3.4, h = 2.8 + 1.4 * hash01(i, 3);
      const hs = makeMudHouse({ w, d, h, seed: 60 + i, color: ['#a88a62', '#9c7e58', '#b0916a'][i % 3], ladder: hash01(i, 4) < 0.3, glow: hash01(i, 5) < 0.35 ? 0.8 : 0, roofClutter: false });
      hs.position.set(x, 0, side * (2.7 + d / 2)); hs.rotation.y = side < 0 ? 0 : Math.PI; g.add(hs); i++;
    }
  }
  const endH = makeMudHouse({ w: 9, d: 4, h: 4.6, seed: 77, color: '#b39570', ladder: false, windows: 3 }); endH.position.set(RIOT.endWall - 2, 0, 0); endH.rotation.y = Math.PI / 2; g.add(endH);
  // the overturned cart: tipped box, a wheel in the air, spilled pots + baskets, burning
  const cart = new THREE.Group(); cart.position.set(...RIOT.cart); g.add(cart);
  const body = makeBevelBox(2.4, 0.7, 1.4, '#5e4026', { bevel: 0.05, seed: 81 }); body.position.set(0, 0.62, 0); body.rotation.x = 1.75; cart.add(body);
  for (const [z, ry] of [[-0.75, 0], [0.8, 0]]) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.1, 12).rotateX(Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#4a3220', flatShading: true })); wh.position.set(0.4, z > 0 ? 1.25 : 0.2, z); wh.rotation.y = ry; wh.rotation.x = z > 0 ? 0.0 : 1.4; wh.castShadow = true; cart.add(wh); }
  g.add(scatterPots(6, { points: [[-11.2, 1.6], [-11.6, 2.0], [-13.4, -0.8], [-10.8, 1.1], [-13.9, 1.7], [-12.0, -1.2]], scale: [0.8, 1.2], tilt: 1.2 }));
  g.add(scatterBaskets(4, { points: [[-10.4, -0.9], [-13.1, 2.2], [-9.8, 1.6], [-14.2, -0.3]], tilt: 1.0 }));
  g.add(scatterPebbles(200, { area: [-26, -2.6, 6, 2.6], seed: 9, colors: ['#6e5a42', '#7a6448', '#5e4c38'] }));
  const fire = makeFire(5); fire.group.position.set(RIOT.cart[0] + 0.1, 0.2, RIOT.cart[2]); fire.group.scale.setScalar(1.25); g.add(fire.group);
  // wall torches
  const torches = [];
  for (const [x, z] of [[-6.2, -2.55], [-15.8, 2.55], [-20.5, -2.55], [1.6, 2.55]]) { const tt = makeTorch(5 + x); tt.group.position.set(x, 1.8, z); tt.group.rotation.x = z > 0 ? -0.5 : 0.5; g.add(tt.group); torches.push(tt); }
  // Barabbas + his torch; people running across the far end of the street (their shadows stretch on the end wall)
  const bar = new Person({ ...BARABBAS }); g.add(bar.root);
  const torch = makeTorch(9); bar.attach(torch.group, 'armF.hand');
  const runners = Array.from({ length: 7 }, (_, k) => { const p = new Person({ ...JERUSALEM_CROWD[(k * 3 + 1) % JERUSALEM_CROWD.length] }); g.add(p.root); return { p, k, x: -16.2 - 1.3 * (k % 4), dir: k % 2 ? 1 : -1, ph: hash01(k, 3), speed: 3.4 + 0.8 * hash01(k, 4) }; });
  const smoke = makeSprites(30, { tex: puffTex(), order: 4 }); g.add(smoke.group);
  const embers = makeMotes(140, 61); g.add(embers.group);
  const _o = new THREE.Vector3();

  return {
    group: g, persons: [bar, ...runners.map((r) => r.p)],
    update(t, cam) {
      const bp = Bk.bAt(t);
      bar.root.position.set(bp[0], 0, bp[2]); bar.setView('threeQuarter'); bar.setFacing(-1);
      bar.act((tt) => { const P = Poses.walk(tt, 15, 0.62, 0.85); P.aF = [3.8 + 0.03 * Math.sin(tt * 3), 0.0, 0.1]; /* the torch held straight up beside his head, never across the face (3/4 view damps angles x0.85) */ P.handF = 'grip'; P.aB[1] += 0.3; P.handB = 'grip'; expr(P, 'angry', 0.75); P.mouth = 'none'; P.lookY = 0.05; return P; }, t, { wind: 0.7, vx: 0.6 });
      bar.billboard(cam, 0.3); bar.autoOutline(cam);
      torch.group.position.set(0.0, -0.02, 0.03); torch.group.rotation.set(0, 0, Math.PI - 0.15);
      torch.set(t, cam);
      for (const tt of torches) tt.set(t, cam);
      runners.forEach((r) => {
        const L = 7.0, u = ((t * r.speed / L + r.ph) % 1 + 1) % 1, z = r.dir * lerp(-3.4, 3.4, u);
        r.p.root.position.set(r.x, 0, z); r.p.setView('side'); r.p.setFacing(r.dir > 0 ? -1 : 1);
        r.p.act((tt) => { const P = Poses.run(tt, 900 + r.k, 1.0); P.mouth = 'open'; expr(P, 'worry', 0.7); return P; }, t + r.k, { wind: 0.6, vx: r.speed });
        r.p.billboard(cam, 0.2); r.p.autoOutline(cam);
      });
      fire.set(t, cam, 1.2);
      g.getWorldPosition(_o);
      smoke.begin();
      for (let k = 0; k < 30; k++) { const life = 5, u = ((t + k * life / 30) % life) / life; smoke.add(_o.x + RIOT.cart[0] + 2 * u + 0.6 * Math.sin(k), _o.y + 1.4 + u * 6, _o.z + RIOT.cart[2] + 1.5 * Math.sin(k * 1.7) * u, 1 + u * 4.5, 0.2, 0.15, 0.14, 0.42 * Math.sin(Math.PI * u), k); }
      smoke.end();
      embers.set(t, [_o.x + RIOT.cart[0] + 2, _o.y + 0.5, _o.z + RIOT.cart[2]], [10, 6, 5], 1.6, [1.0, 0.45, 0.12], 0.035);
    },
    mood(t) {
      const bp = Bk.bAt(t), tp = [bp[0] - 0.1, 2.75, bp[2] + 0.1];       // his raised torch (pure function of t)
      const fl = 0.85 + 0.15 * noise2(t * 8, 1, 3);
      return merge(MOODS.nightLamp, {
        sky: { top: '#06070e', horizon: '#2a1416', bottom: '#0a0606', band: '#2a1010', stars: 0.35, moon: 0, clouds: 0.3, cloudLit: '#5a2a22', cloudShade: '#120a0c' },
        sunDir: [0.3, 0.8, 0.5], sun: { color: '#7a86b8', intensity: 0.25 },
        hemi: { sky: '#2a2238', ground: '#1a0e08', intensity: 0.35 },
        fog: { color: '#2a1410', near: 6, far: 70, density: 0.035, height: 6, sun: 0 },
        char: '#c8a090', ao: 0.25, wind: 1.2,
        spot: { pos: [RIOT.cart[0] + 1.0, 2.2, RIOT.cart[2] + 0.3], target: [RIOT.endWall, 2.2, 0], color: '#ff8a3a', intensity: 160 * fl, angle: 0.9, penumbra: 0.4, decay: 1.5, distance: 40, shadow: true },
        point: { pos: tp, color: '#ff9a46', intensity: 9 * fl, distance: 9, charColor: '#ffae66', charK: 0.9, charRange: 3.6 },
        post: { exposure: 1.15, bloom: 1.15, bloomThreshold: 0.8, haze: 0, vignette: 0.72, grain: 0.04, sat: 1.08, contrast: 1.16,
          split: 0.45, splitShadow: '#24304e', splitHigh: '#ff9a4a', ao: 0.6, dof: 0.55, focusRange: 1.8, tilt: 0 },
      });
    },
  };
}
