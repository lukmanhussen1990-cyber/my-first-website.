// S4 — "A lying tongue." A busy morning market. The smiling seller offers a fine fruit; focus racks
// to his shadow on the wall behind him, which quietly swaps it for a rotten one ("even the small ones").
import * as THREE from 'three';
import { makeHouse, makeWall, makeStall, makeJar, makeBasket, texMat, plasterTex, paveTex, stripeTex } from '../kit.js';
import { makeMotes } from '../fx.js';
import { matte } from '../materials.js';
import { SKIN, HAIR, CLOTH, Poses, expr } from '../rig.js';
import { person, puppet, place, finish } from '../cast.js';
import { SETS } from '../../lib/director.js';
import { clamp, smooth, invLerp, lerp, easeOutBack, hash01 } from '../../lib/util.js';

const WALL_Z = -2.6;

export function buildMarket(ctx) {
  const { plan, B } = ctx; const O = SETS.market;
  const g = new THREE.Group();
  const pave = paveTex().clone(); pave.needsUpdate = true; pave.repeat.set(8, 8);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(50, 50).rotateX(-Math.PI / 2), texMat('#c7ab84', pave, { flat: false })); ground.receiveShadow = true; g.add(ground);
  // back wall (the shadow screen) with a doorway, shelf of pots, hanging herbs
  const wall = new THREE.Mesh(new THREE.BoxGeometry(7.2, 4.6, 0.4), texMat('#e0bf8c', plasterTex())); wall.position.set(-0.9, 2.3, WALL_Z - 0.2); wall.receiveShadow = true; wall.castShadow = true; g.add(wall);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.0), matte('#4a2e1c')); door.position.set(-2.6, 1.0, WALL_Z + 0.01); g.add(door);
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 0.3), matte('#6a4a30')); shelf.position.set(-1.55, 2.35, WALL_Z + 0.15); shelf.castShadow = true; g.add(shelf);
  for (let i = 0; i < 3; i++) { const j = makeJar(0.5 + 0.12 * (i % 2), ['#b0683c', '#8a5a3a', '#c07a4a'][i]); j.position.set(-2.0 + i * 0.42, 2.38, WALL_Z + 0.15); g.add(j); }
  for (let i = 0; i < 5; i++) { const h = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.42, 5), matte(i % 2 ? '#8a8a3a' : '#c9b06a')); h.position.set(1.2 + i * 0.16, 3.05 - 0.05 * (i % 2), WALL_Z + 0.08); h.rotation.x = Math.PI; g.add(h); }
  // the stall in front of the seller
  const stall = makeStall({ awning: ['#a83e2a', '#efe0bf'], goods: ['#e0742c', '#b8352c', '#d9a640', '#7a2a4a'], seed: 5, w: 2.9 }); stall.position.set(-0.3, 0, -0.75); g.add(stall);
  stall.children.forEach((c) => { if (c.geometry && c.geometry.type === 'PlaneGeometry') c.castShadow = false; }); // keep the shadow wall readable
  // neighbouring stalls + the alley to the right, other shoppers
  const s2 = makeStall({ awning: ['#2f6b66', '#e8dcc0'], goods: ['#7a9a3a', '#e0c04a', '#c0602c'], seed: 6, w: 2.6 }); s2.position.set(-3.6, 0, -0.9); s2.rotation.y = 0.15; g.add(s2);
  const s3 = makeStall({ awning: ['#c9922c', '#f0e4c8'], goods: ['#b8352c', '#e0742c'], seed: 7, w: 2.6 }); s3.position.set(4.2, 0, -6.5); s3.rotation.y = -0.4; g.add(s3);
  const hR = makeHouse({ w: 5, d: 5, h: 4.4, wall: '#d6b48c', roofCol: '#a88660', windows: 2, seed: 12 }); hR.position.set(6.4, 0, -10); g.add(hR);
  const hR2 = makeHouse({ w: 4, d: 4, h: 5.6, wall: '#cfa982', roofCol: '#a88660', windows: 2, seed: 13 }); hR2.position.set(2.2, 0, -14); g.add(hR2);
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.9), texMat('#ffffff', stripeTex('#b8452c', '#e9d8b0', 6), { params: { side: THREE.DoubleSide } })); cloth.position.set(3.4, 3.3, -4.2); cloth.rotation.set(-1.25, -0.3, 0); g.add(cloth);
  for (const [x, z, s] of [[1.4, -1.9, 1.0], [-2.0, 0.3, 0.85], [2.6, -3.4, 0.9]]) { const b = makeBasket(s, ['#e0742c', '#b8352c'], Math.round(x * 10)); b.position.set(x, 0, z); g.add(b); }
  for (const [x, z] of [[1.0, -2.3], [-2.9, -1.6]]) { const j = makeJar(0.9, '#a86238'); j.position.set(x, 0, z); g.add(j); }

  const seller = person(g, { seed: 41, height: 1.78, skin: SKIN[4], hair: 'short', hairColor: HAIR.black, beard: 'short', outfit: 'tunic', cloth: CLOTH.teal, trim: CLOTH.ochre, belt: '#d7b484', legs: '#5a4636', prop: 'fruitGood', noShadow: true });
  const buyer = person(g, { seed: 42, height: 1.66, skin: SKIN[5], hair: 'veil', wrap: '#b46a5c', outfit: 'robe', cloth: CLOTH.olive, trim: '#d9b26a', prop: 'bowl' });
  const shoppers = [
    person(g, { seed: 43, height: 1.72, skin: SKIN[2], hair: 'wrap', wrap: '#d8c8a8', beard: 'long', beardColor: HAIR.grey, outfit: 'robe', cloth: CLOTH.brown }),
    person(g, { seed: 44, height: 1.6, skin: SKIN[3], hair: 'veil', wrap: '#5f87a3', outfit: 'robe', cloth: CLOTH.indigo }),
    person(g, { seed: 45, height: 1.2, kid: true, skin: SKIN[4], hair: 'curly', outfit: 'tunic', cloth: CLOTH.ochre, legs: SKIN[4] }),
  ];
  const shadow = puppet(g, { seed: 41, height: 1.78, hair: 'short', beard: 'short', outfit: 'tunic', prop: 'fruitGood' }, '#2a1a12', 0.5);
  const persons = [seller, buyer, ...shoppers];
  const flies = Array.from({ length: 4 }, () => { const f = new THREE.Mesh(new THREE.CircleGeometry(0.026, 6), shadow.mat); g.add(f); return f; });
  const _hp = new THREE.Vector3();
  const motes = makeMotes(120, 21); g.add(motes.group);
  const [sw0, sw1] = B.swapT;

  return {
    group: g, persons,
    update(t, cam) {
      // the seller: warm smile, open hand, offering the good fruit; a tiny wink on "small"
      const P = Poses.sell(t, 41);
      P.aF = [1.25 + 0.06 * Math.sin(t * 2.1), 0.35 + 0.05 * Math.sin(t * 1.7)];
      expr(P, 'happy', 1); P.mouth = Math.sin(t * 7) > 0.2 && t < sw1 + 0.6 ? 'talk' : 'smile';
      if (t > sw1 + 0.05 && t < sw1 + 0.38) P.eye = 0.08;
      seller.setFacing(1); seller.pose(P); place(seller, O, B.seller());
      // the shadow: same man, but the hand dips below the table and comes back with a rotten fruit
      const SP = { ...P, aF: [...P.aF], aB: [...P.aB] };
      const dn = smooth(invLerp(sw0, sw0 + 0.3, t)), up = smooth(invLerp(sw0 + 0.4, sw0 + 0.8, t));
      const k = dn * (1 - up);                                   // arm swings behind his back and returns
      SP.aF = [lerp(P.aF[0], -0.85, k), lerp(P.aF[1], 0.7, k)];
      SP.aB = [lerp(P.aB[0], -0.5, dn), lerp(P.aB[1], 1.25, dn)]; SP.headTilt = (P.headTilt || 0) + 0.12 * k;
      shadow.setProp(t > sw0 + 0.38 ? 'fruitBad' : 'fruitGood');
      if (shadow.prop) shadow.prop.scale.setScalar(2.1 * (t > sw0 + 0.38 ? lerp(0.6, 1, easeOutBack(clamp((t - sw0 - 0.38) / 0.3))) : 1));
      shadow.setFacing(1); shadow.pose(SP);
      const sp = B.wallShadow(); shadow.root.position.set(sp[0] - O[0] + 0.25, -0.12, WALL_Z + 0.02); shadow.root.scale.set(1.22, 1.22, 1);
      // three tiny flies buzz round the rotten fruit (in shadow)
      shadow.armF.hand.updateWorldMatrix(true, false); const hp = shadow.armF.hand.getWorldPosition(_hp);
      flies.forEach((f, i) => { const on = t > sw0 + 0.55; f.visible = on; if (!on) return; const a = t * (9 + i * 2.3) + i * 2.1;
        f.position.set(hp.x - g.position.x + Math.cos(a) * 0.2, hp.y - g.position.y + 0.12 + Math.sin(a * 1.7) * 0.1, WALL_Z + 0.03); });
      // the buyer waits, then reaches for it
      const BP = Poses.idle(t, 42); BP.aF = [lerp(0.4, 1.05, smooth(invLerp(sw1 + 0.3, sw1 + 0.9, t))), lerp(1.2, 0.4, smooth(invLerp(sw1 + 0.3, sw1 + 0.9, t)))]; BP.look = 0.4; expr(BP, 'happy', 0.6);
      buyer.setFacing(-1); buyer.pose(BP); place(buyer, O, B.buyer());
      shoppers.forEach((p, i) => {
        const x = [2.3, -4.8, 3.3][i] + (i === 1 ? 0.55 * (t - 17.8) : 0), z = [-5.2, -2.6, -3.6][i];
        const pp = i === 1 ? Poses.walk(t, 44, 0.9) : Poses.talk(t, 43 + i, 0.6);
        if (i === 1) p.secondary(pp, { vx: 0.55, t });
        p.setFacing(i === 0 ? -1 : 1); p.pose(pp); p.root.position.set(x, 0, z);
      });
      finish(persons, cam);
      motes.set(t, [0.2, 0.3, -1.2], [5, 3.5, 3], 0.7, [1.0, 0.85, 0.6], 0.025);
    },
    mood() {
      return {
        sky: { top: '#7fa4c2', horizon: '#f2dfb8', bottom: '#c9a77a', sunGlow: '#ffe2b0' },
        sunDir: [-0.45, 0.32, 0.83], sun: { color: '#ffe6bd', intensity: 3.0 },
        hemi: { sky: '#d8e6f2', ground: '#a07850', intensity: 1.05 },
        fog: { color: '#ead8b4', near: 22, far: 90 }, char: '#fff6e8', ao: 0.18,
        shadow: { size: 6 },
        post: { exposure: 0.98, bloom: 0.45, bloomThreshold: 0.92, haze: 0.06, hazeColor: '#f4e2c0', tint: '#fff8ec', sat: 1.1, contrast: 1.05, vignette: 0.45, dof: 0.9, focusRange: 0.45, tilt: 0, grain: 0.03 },
      };
    },
  };
}
