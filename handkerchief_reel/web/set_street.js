// The STREET: early evening just after rain (blue hour). Wet shiny ground, lit shops, lamps, the hollow bush with
// YOU in it, the black stretch limo, YOU's shopping cart, puddles. See set.js for the place contract.
import * as THREE from 'three';
import { mat, tex, clamp, lerp, smooth } from './lib.js';
import { STREET } from './layout.js';
import { glowDiscCanvas } from './set_tex2.js';
import { blobCanvas } from './set_street_tex.js';
import { streetMaterials, buildCity } from './set_city.js';
import { buildBush, buildLimo, buildCart, buildPuddles, lampPostGeometry, LAMP } from './set_street_props.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

function nightSky() {
  const g = new THREE.SphereGeometry(300, 32, 16);
  const p = g.attributes.position, col = new Float32Array(p.count * 3);
  const zen = new THREE.Color('#0a1230'), mid = new THREE.Color('#22305e'), hz = new THREE.Color('#5a5a86'), glow = new THREE.Color('#a0708a');
  for (let i = 0; i < p.count; i++) {
    const d = V(p.getX(i), p.getY(i), p.getZ(i)).normalize();
    const el = Math.asin(clamp(d.y, -1, 1));
    const c = glow.clone().lerp(hz, smooth(clamp(el / 0.08)));
    c.lerp(mid, smooth(clamp((el - 0.06) / 0.35)));
    c.lerp(zen, smooth(clamp((el - 0.4) / 0.9)));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const sky = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.name = 'set.street.sky'; sky.renderOrder = -10; sky.userData.noAudit = true;
  return sky;
}

export function buildStreet(env, world) {
  const group = new THREE.Group(); group.name = 'set.street';
  const glowTex = tex(glowDiscCanvas(64), { nearest: false });
  const M = streetMaterials(env);
  M.glowTex = glowTex;
  M.lampGlass = new THREE.MeshStandardMaterial({ color: '#fff2d0', emissive: '#ffcf80', emissiveIntensity: 2.4, roughness: 0.3 });
  M.poolMat = new THREE.MeshBasicMaterial({ map: tex(blobCanvas(64, 1.4), { nearest: false }), color: '#ffb060', transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending });
  M.shadowMat = new THREE.MeshBasicMaterial({ map: tex(blobCanvas(64, 1.2), { nearest: false }), color: '#000000', transparent: true, opacity: 0.5, depthWrite: false });
  const city = buildCity(env, M); group.add(city.group);
  const sky = nightSky(); group.add(sky);

  // the hero lamp next to the bush (warm light on YOU + the lady)
  const [lx, lz] = STREET.lamp.pos;
  for (const part of lampPostGeometry()) { const m = new THREE.Mesh(part.geo, part.mat === 'glass' ? M.lampGlass : M.iron); m.position.set(lx, STREET.sideY, lz); m.castShadow = true; m.name = 'set.street.heroLamp'; group.add(m); }
  const lampGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffbb70', transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  lampGlow.scale.set(2.6, 2.6, 1); lampGlow.position.set(lx, STREET.sideY + LAMP.lanternY, lz); lampGlow.userData.noAudit = true; group.add(lampGlow);
  const heroLight = new THREE.PointLight('#ffc27a', 34, 14, 1.7); heroLight.position.set(lx, STREET.sideY + LAMP.lanternY - 0.1, lz); heroLight.name = 'set.street.heroLight'; group.add(heroLight);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), M.poolMat); pool.rotation.x = -Math.PI / 2; pool.position.set(lx, STREET.sideY + 0.013, lz); pool.userData.noAudit = true; group.add(pool);
  // soft fill lights from the shop windows (warm, low) and a cool bounce from the wet road
  const shopFill = new THREE.PointLight('#ffb878', 16, 12, 1.6); shopFill.position.set(2.0, 1.8, 0.6); group.add(shopFill);
  const shopFill2 = new THREE.PointLight('#ffc890', 10, 10, 1.6); shopFill2.position.set(-2.4, 1.8, 0.6); group.add(shopFill2);
  const roadBounce = new THREE.PointLight('#7a90d8', 6, 12, 1.5); roadBounce.position.set(1.0, 0.6, -6.5); group.add(roadBounce);

  const bush = buildBush(env); group.add(bush.group);
  const limo = buildLimo(env); group.add(limo.group);
  const cart = buildCart(env); group.add(cart.group);
  const puddles = buildPuddles(env); group.add(puddles.group);

  // key light: cool moonlight / sky from above (the only shadow caster), hemisphere: blue sky over dark wet ground
  const key = new THREE.DirectionalLight('#a8b8ff', 1.1); key.name = 'set.street.key';
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.025;
  key.userData.dir = V(-0.35, 1.0, -0.45).normalize();
  group.add(key, key.target);
  const hemi = new THREE.HemisphereLight('#6a7cc0', '#2a2622', 1.25); group.add(hemi);

  const props = { bush: bush.group, cart: cart.group, limo: limo.group, limoRearDoor: limo.rearDoor, limoFrontDoor: limo.frontDoor,
    puddles: puddles.group, anchors: limo.anchors(STREET.limo.parkedX) };
  return {
    name: 'street', group, props, key,
    look: { background: null, fog: { color: '#2a3458', near: 22, far: 120 }, exposure: 1.15, shadowCenter: [1.0, 0.8, -3.0], shadowRadius: 8 },
    defaults: () => ({ limoX: STREET.limo.parkedX, limoDoor: 0, guardDoor: 0, limoMist: 0, bushShake: 0 }),
    update(t, s, ctx) {
      sky.position.copy(ctx.camera.position);
      limo.update(t, s);
      props.anchors = limo.anchors(s.limoX);
      bush.update(t, s.bushShake);
    },
  };
}
