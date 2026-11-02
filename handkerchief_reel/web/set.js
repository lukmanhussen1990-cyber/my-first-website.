// All places of the handkerchief reel. Each place is built by its own module and lives far from the others
// (see layout.js); only the current shot's place is visible (its lights + sky with it). Everything visual is a pure
// function of t + state (state is reset every frame, shots override it).
//
// Location module contract (set_street.js, set_rest.js, set_out.js):
//   build<Place>(env, world) -> {
//     name, group,                      // THREE.Group placed in world coordinates (layout.js)
//     props: { ... },                   // named objects the shots may move / read (limo door, cart, ...)
//     look: { background: '#hex' | null, fog: { color, near, far } | null, exposure: 1.0,
//             shadowCenter: [x, y, z], shadowRadius: 8 },
//     key: THREE.DirectionalLight | null,   // the ONE shadow-casting light (inside group); key.userData.dir = unit
//                                           // vector from the scene toward the light
//     defaults(): { ...place-specific state fields with their default values },
//     update(t, state, ctx),            // per frame, only when this place is shown (doors, shaking bush, sky follows camera)
//   }
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { locOf } from './layout.js';
// place modules load one by one: a broken / unfinished module only blanks its own places
const MODS = {};
for (const [k, f] of [['street', './set_street.js'], ['rest', './set_rest.js'], ['out', './set_out.js']]) {
  try { MODS[k] = await import(f); } catch (e) { console.warn(`[log] set: ${f} failed to load: ${e.message}`); MODS[k] = {}; }
}
const need = (mod, fn) => (MODS[mod] && MODS[mod][fn]) || (() => { throw new Error(`${fn} unavailable`); });
const buildStreet = (...a) => need('street', 'buildStreet')(...a);
const buildVoid = (...a) => need('rest', 'buildVoid')(...a);
const buildRestaurant = (...a) => need('rest', 'buildRestaurant')(...a);
const buildInterior = (...a) => need('rest', 'buildInterior')(...a);
const buildParis = (...a) => need('out', 'buildParis')(...a);
const buildWedding = (...a) => need('out', 'buildWedding')(...a);
const buildPorch = (...a) => need('out', 'buildPorch')(...a);

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export function buildSet(world) {
  const { scene, renderer } = world;
  const group = new THREE.Group(); group.name = 'set'; scene.add(group);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  scene.fog = new THREE.Fog(new THREE.Color('#202a40'), 30, 220);

  const places = {};
  const safe = (name, fn) => {
    try { places[name] = fn(env, world); }
    catch (e) { console.warn(`[log] set: place ${name} failed to build: ${e.message}`); places[name] = emptyPlace(name); }
    group.add(places[name].group);
  };
  safe('street', buildStreet); safe('void', buildVoid); safe('restaurant', buildRestaurant); safe('interior', buildInterior);
  safe('paris', buildParis); safe('wedding', buildWedding); safe('porch', buildPorch);

  const props = {}; for (const [k, p] of Object.entries(places)) props[k] = p.props || {};
  const colliders = [];
  const defaults = () => {
    const s = { loc: 'street', fog: null, exposure: null, shadow: null, background: null };
    for (const p of Object.values(places)) if (p.defaults) Object.assign(s, p.defaults());
    return s;
  };
  const set = { group, colliders, props, places, env, anchors: {}, state: defaults(),
    reset(t, ctx) {
      const s = (set.state = defaults());
      const n = ctx && ctx.shot ? Number(String(ctx.shot.id).replace(/\D/g, '')) : 1;
      s.loc = ctx?.shot?.loc || locOf(n);
      const P = places[s.loc];
      if (P && P.reset) P.reset(t, s, ctx);
    },
    commit(ctx) {
      const s = set.state, t = ctx.t;
      for (const [k, p] of Object.entries(places)) p.group.visible = k === s.loc;
      const P = places[s.loc] || places.street;
      const look = P.look || {};
      const fog = s.fog || look.fog;
      if (fog) { scene.fog.color.set(fog.color); scene.fog.near = fog.near; scene.fog.far = fog.far; }
      else { scene.fog.near = 1e5; scene.fog.far = 1e6; }
      const bg = s.background || look.background;
      if (bg) { if (!(scene.background && scene.background.isColor)) scene.background = new THREE.Color(); scene.background.set(bg); }
      else scene.background = null;
      renderer.toneMappingExposure = s.exposure ?? look.exposure ?? 1.0;
      if (P.key) {
        const c = V(...((s.shadow && s.shadow.center) || look.shadowCenter || [0, 1, 0]));
        const r = (s.shadow && s.shadow.radius) || look.shadowRadius || 8;
        const dir = (P.key.userData.dir || V(0.4, 1, -0.5)).clone().normalize();
        P.key.target.position.copy(c); P.key.position.copy(c).addScaledVector(dir, 40);
        Object.assign(P.key.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: 120 });
        P.key.shadow.camera.updateProjectionMatrix();
      }
      if (P.update) P.update(t, s, ctx);
    },
  };
  return set;
}

function emptyPlace(name) {
  const group = new THREE.Group(); group.name = `set.${name}.empty`;
  const l = new THREE.HemisphereLight('#ffffff', '#444444', 2); group.add(l);
  return { name, group, props: {}, look: { background: '#552244', fog: null, exposure: 1 }, key: null, defaults: () => ({}), update() {} };
}
