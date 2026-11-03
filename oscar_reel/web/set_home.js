// HOME: the cosy living room from the house reel (moved to HOME.origin) + a big TV showing the LIVE awards feed.
import * as THREE from 'three';
import { mat } from './lib.js';
import { HOME, HOUSE } from './layout.js';
import { buildHouse } from './set_house.js';
import { liveRender, liveTexture, addLiveScreen } from './set_theatre.js';

export function buildHome(env, world) {
  const P = buildHouse(env, world);
  const wrap = new THREE.Group(); wrap.name = 'set.home';
  P.group.position.x = HOME.origin[0]; wrap.add(P.group);
  if (P.key) { P.group.remove(P.key, P.key.target); wrap.add(P.key, P.key.target); }      // the key light works in world space
  // the TV: on a low cabinet in front of the sofa, facing it (+Z)
  const [cx, cz] = HOUSE.coffee.pos, ox = HOME.origin[0], tvZ = cz - 1.35;
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.45), mat('#5a3a24', { rough: 0.6 })); cab.position.set(ox + cx, 0.25, tvZ); cab.castShadow = cab.receiveShadow = true; wrap.add(cab);
  const tv = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.78, 0.06), mat('#141418', { rough: 0.3 })); tv.position.set(ox + cx, 0.98, tvZ); tv.castShadow = true; wrap.add(tv);
  const screenMat = new THREE.MeshBasicMaterial({ map: liveTexture(), toneMapped: false });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.24, 0.7), screenMat); screen.position.set(ox + cx, 0.98, tvZ + 0.032); wrap.add(screen);
  const glow = new THREE.PointLight('#a8c8ff', 3, 4, 1.8); glow.position.set(ox + cx, 1.0, tvZ + 0.6); wrap.add(glow);
  const STATE = { s: null };
  screen.onBeforeRender = (renderer, scene) => liveRender(renderer, scene, STATE.s); addLiveScreen(screen);
  const look = { ...P.look, shadowCenter: [P.look.shadowCenter[0] + ox, P.look.shadowCenter[1], P.look.shadowCenter[2]] };
  return { ...P, name: 'home', group: wrap, look,
    defaults: () => ({ ...P.defaults(), liveCam: null }),
    update(t, s, ctx) { STATE.s = s; P.update(t, s, ctx); } };
}
