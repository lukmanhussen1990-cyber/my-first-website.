// fx agent test harness. Loaded ONLY when the page URL contains fxtest=1 (never in the real render).
// window.FXTEST = { emit: [[type, opts], ...], fakeHead: bool }  -> calls the fx emitters between reset and commit.
// opts.ch may be 'fake' (stand-in head at YOU's seat), or a cast name ('you', 'grandma', ...).
import * as THREE from 'three';
import { mat } from './lib.js';

let fake = null;
function fakeHead(world) {
  if (fake) return fake;
  const root = new THREE.Group(); root.name = 'fxtest.fake';
  const head = new THREE.Group(); head.position.set(0, 1.17, -0.93); root.add(head);
  const skin = mat('#e0ae86');
  const g = new THREE.SphereGeometry(1, 7, 5); g.scale(0.095, 0.115, 0.1);
  const skull = new THREE.Mesh(g, skin); skull.name = 'fake.skull'; head.add(skull);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.03), skin); nose.position.set(0, -0.01, 0.1); head.add(nose);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.045, 0.03), skin); ear.position.set(s * 0.095, 0, 0); head.add(ear);
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.022, 0.004), mat('#111111')); eye.position.set(s * 0.035, 0.012, 0.098); head.add(eye);
  }
  const hairG = new THREE.SphereGeometry(1, 7, 4, 0, Math.PI * 2, 0, Math.PI * 0.45); hairG.scale(0.105, 0.125, 0.11);
  const hair = new THREE.Mesh(hairG, mat('#5a3a22')); hair.name = 'fake.hair'; hair.position.set(0, 0.012, -0.008); head.add(hair);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.24), mat('#3b4a6b')); torso.position.set(0, 0.8, -0.95); root.add(torso);
  world.scene.add(root);
  fake = { name: 'fake', root, head, headRadius: 0.11 };
  return fake;
}

export function fxTest(fx, t, ctx, world) {
  const T = typeof window !== 'undefined' ? window.FXTEST : null;
  if (fake) fake.root.visible = !!(T && T.fakeHead);
  if (!T || !T.emit) return;
  if (T.fakeHead) fakeHead(world).root.visible = true;
  for (const [type, o] of T.emit) {
    const oo = { ...o };
    if (oo.ch === 'fake') oo.ch = fakeHead(world);
    else if (typeof oo.ch === 'string') oo.ch = world.cast[oo.ch];
    if (fx[type]) fx[type](oo);
  }
}
