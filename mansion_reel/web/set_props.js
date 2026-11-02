// Hand props (shots move them; characters grip them via userData.grip = {pos, axis, up} in prop space).
import * as THREE from 'three';
import { mat, tex } from './lib.js';
import { goldCanvas } from './set_tex2.js';
import { fabricTex } from './char_tex.js';

function msh(geo, material, n, cast = true) { const m = new THREE.Mesh(geo, material); m.castShadow = cast; m.receiveShadow = true; m.name = `set.prop.${n}`; return m; }

export function buildProps(env) {
  const g = new THREE.Group(); g.name = 'set.props';
  const gold = mat(tex(goldCanvas({ base: '#ffd060', seed: 71 })), { rough: 0.22, metal: 0.9 }); gold.envMap = env; gold.envMapIntensity = 1.5;
  const china = mat('#f6f4ee', { rough: 0.35 }); china.envMap = env; china.envMapIntensity = 0.4;
  // espresso cup + saucer (rich guy, shot 9). grip = the saucer rim
  const esp = new THREE.Group(); esp.name = 'set.prop.espresso'; g.add(esp);
  esp.add(msh(new THREE.CylinderGeometry(0.06, 0.05, 0.012, 14), china, 'saucer'));
  const cup = msh(new THREE.CylinderGeometry(0.03, 0.024, 0.045, 12), china, 'espCup'); cup.position.y = 0.03; esp.add(cup);
  const coffee = msh(new THREE.CircleGeometry(0.027, 12), mat('#3a1e10', { rough: 0.3 }), 'espCoffee', false); coffee.rotation.x = -Math.PI / 2; coffee.position.y = 0.052; esp.add(coffee);
  const rim = msh(new THREE.TorusGeometry(0.06, 0.004, 4, 16), gold, 'saucerRim', false); rim.rotation.x = Math.PI / 2; esp.add(rim);
  esp.userData.grip = { pos: [0.0, -0.006, 0.05], axis: [1, 0, 0], up: [0, 1, 0] };
  // coffee mug (shot 39). grip = the body (both hands around it)
  const mug = new THREE.Group(); mug.name = 'set.prop.mug'; g.add(mug);
  const mugM = mat('#f2efe6', { rough: 0.4 });
  const body = msh(new THREE.CylinderGeometry(0.045, 0.042, 0.1, 14, 1, true), mugM, 'mugBody'); body.material.side = THREE.DoubleSide; mug.add(body);
  const bottom = msh(new THREE.CircleGeometry(0.042, 14), mugM, 'mugBottom'); bottom.rotation.x = Math.PI / 2; bottom.position.y = -0.05; mug.add(bottom);
  const cof = msh(new THREE.CircleGeometry(0.042, 14), mat('#4a2814', { rough: 0.25 }), 'mugCoffee', false); cof.rotation.x = -Math.PI / 2; cof.position.y = 0.035; mug.add(cof);
  const handle = msh(new THREE.TorusGeometry(0.025, 0.007, 5, 10, Math.PI), mugM, 'mugHandle'); handle.rotation.z = -Math.PI / 2; handle.position.set(0.045, 0, 0); mug.add(handle);
  const band = msh(new THREE.CylinderGeometry(0.0455, 0.0455, 0.012, 14, 1, true), gold, 'mugBand', false); band.position.y = 0.03; mug.add(band);
  mug.userData.grips = { L: { pos: [0.0, -0.01, 0.05], axis: [0, 1, 0], up: [1, 0, 0] }, R: { pos: [0.0, -0.01, -0.05], axis: [0, 1, 0], up: [-1, 0, 0] } };
  mug.userData.grip = { pos: [0.0, -0.01, 0.05], axis: [0, 1, 0], up: [1, 0, 0] };
  // golden key (shot 40)
  const key = new THREE.Group(); key.name = 'set.prop.key'; g.add(key);
  const bow = msh(new THREE.TorusGeometry(0.03, 0.009, 6, 14), gold, 'keyBow'); key.add(bow);
  const shaft = msh(new THREE.BoxGeometry(0.1, 0.012, 0.01), gold, 'keyShaft'); shaft.position.set(0.08, 0, 0); key.add(shaft);
  for (const [x, hh] of [[0.115, 0.025], [0.095, 0.018]]) { const b = msh(new THREE.BoxGeometry(0.012, hh, 0.01), gold, 'keyBit'); b.position.set(x, -hh / 2 - 0.004, 0); key.add(b); }
  const gem = msh(new THREE.OctahedronGeometry(0.012, 0), mat('#e8204a', { rough: 0.1, emissive: '#a01030', emissiveIntensity: 0.4 }), 'keyGem'); key.add(gem);
  // folded white towel (shot 38, in the rich guy's hands)
  const towelM = mat(fabricTex('terry', { color: '#f4f2ec', seed: 81 }, 32, [2, 2]), { rough: 0.95 });
  const towel = msh(new THREE.BoxGeometry(0.36, 0.09, 0.26), towelM, 'towelFolded'); towel.name = 'set.prop.towelFolded'; g.add(towel);
  const stripe = msh(new THREE.BoxGeometry(0.365, 0.02, 0.265), mat('#e2b440', { rough: 0.6 }), 'towelStripe', false); stripe.position.y = 0.02; towel.add(stripe);
  towel.userData.grips = { L: { pos: [0.17, 0, 0], axis: [0, 0, 1], up: [0, 1, 0] }, R: { pos: [-0.17, 0, 0], axis: [0, 0, 1], up: [0, 1, 0] } };
  const all = { espresso: esp, mug, key, towel };
  for (const p of Object.values(all)) p.visible = false;
  return { group: g, ...all, reset() { for (const p of Object.values(all)) { p.visible = false; p.position.set(0, -50, 0); p.rotation.set(0, 0, 0); p.scale.setScalar(1); } } };
}
