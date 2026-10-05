// Bedrock attachable preview rig (dev tool, not shipped).
// Conventions (calibrated against vanilla):
//  * Geometry/animation numbers live in "file space" F. The physical world is F mirrored in X.
//  * Rotation: standard matrices in F with angle signs (-x, +y, -z), order Z*Y*X.
//  * Bound attachable bones: world = Hand * T(handPivot) * T(0,-24,0) * L_bone * v.
import * as THREE from 'three';

const { Molang, Context } = window.Molang;
const DEG = Math.PI / 180;
const lc = (s) => String(s).toLowerCase();

const state = {
  geos: {},          // id -> {texW,texH,bones}
  anims: {},         // id -> animation
  controllers: {},   // id -> controller
  attachables: {},   // name -> attachable description
  textures: {},      // url -> THREE.Texture
  playerGeo: null,
};

async function getJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('fetch failed ' + url + ' ' + r.status);
  return JSON.parse(await r.text());
}
function loadTexture(url) {
  if (state.textures[url]) return state.textures[url];
  state.textures[url] = new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(url, (t) => {
      t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
      t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = false;
      resolve(t);
    }, undefined, () => reject(new Error('texture failed ' + url)));
  });
  return state.textures[url];
}

// ---------------------------------------------------------------- geometry
function parseGeometries(json) {
  const out = {};
  if (json['minecraft:geometry']) {
    for (const g of json['minecraft:geometry']) {
      const d = g.description;
      out[d.identifier] = { texW: d.texture_width, texH: d.texture_height, bones: g.bones };
    }
    return out;
  }
  const raw = {};
  for (const [key, val] of Object.entries(json)) {
    if (!key.startsWith('geometry.')) continue;
    const [id, parent] = key.split(':');
    raw[id] = { parent, val };
  }
  const resolve = (id) => {
    const { parent, val } = raw[id];
    let base = parent && raw[parent] ? resolve(parent) : { bones: [], texW: 64, texH: 32 };
    const bones = base.bones.map((b) => b);
    for (const b of val.bones || []) {
      const i = bones.findIndex((x) => lc(x.name) === lc(b.name));
      if (i >= 0) bones[i] = b; else bones.push(b);
    }
    return { texW: val.texturewidth ?? base.texW, texH: val.textureheight ?? base.texH, bones };
  };
  for (const id of Object.keys(raw)) out[id] = resolve(id);
  return out;
}

const FACE_SHADE = { up: 1.0, down: 0.55, north: 0.85, south: 0.85, east: 0.7, west: 0.7 };

function cubeGeometry(c, texW, texH) {
  const inf = c.inflate || 0;
  const [ox, oy, oz] = c.origin; const [sx, sy, sz] = c.size;
  const x0 = ox - inf, x1 = ox + sx + inf, y0 = oy - inf, y1 = oy + sy + inf, z0 = oz - inf, z1 = oz + sz + inf;
  const faces = {
    north: [[x0, y1, z0], [x1, y1, z0], [x1, y0, z0], [x0, y0, z0], [0, 0, -1]],
    south: [[x1, y1, z1], [x0, y1, z1], [x0, y0, z1], [x1, y0, z1], [0, 0, 1]],
    east:  [[x0, y1, z1], [x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [-1, 0, 0]],
    west:  [[x1, y1, z0], [x1, y1, z1], [x1, y0, z1], [x1, y0, z0], [1, 0, 0]],
    up:    [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0]],
    down:  [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]],
  };
  let uvs = null;
  if (Array.isArray(c.uv)) {
    const [u, v] = c.uv;
    uvs = {
      east: [u, v + sz, sz, sy], north: [u + sz, v + sz, sx, sy], west: [u + sz + sx, v + sz, sz, sy],
      south: [u + 2 * sz + sx, v + sz, sx, sy], up: [u + sz, v, sx, sz], down: [u + sz + sx, v, sx, sz],
    };
  } else if (c.uv && typeof c.uv === 'object') {
    uvs = {};
    for (const [k, f] of Object.entries(c.uv)) uvs[k] = [f.uv[0], f.uv[1], f.uv_size ? f.uv_size[0] : 0, f.uv_size ? f.uv_size[1] : 0];
  }
  const pos = [], nor = [], uv = [], col = [], idx = [];
  let vi = 0;
  for (const [name, f] of Object.entries(faces)) {
    if (!uvs || !uvs[name]) continue;
    const [u, v, w, h] = uvs[name];
    const corners = [[u, v], [u + w, v], [u + w, v + h], [u, v + h]];
    for (let i = 0; i < 4; i++) {
      pos.push(...f[i]); nor.push(...f[4]);
      uv.push(corners[i][0] / texW, 1 - corners[i][1] / texH);
      const s = FACE_SHADE[name]; col.push(s, s, s);
    }
    idx.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3); vi += 4;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// ---------------------------------------------------------------- skeleton
const M4 = THREE.Matrix4;
function boneMatrix(def, t) {
  const P = def.pivot || [0, 0, 0];
  const rest = def.rotation || [0, 0, 0];
  const rx = rest[0] + t.rot[0], ry = rest[1] + t.rot[1], rz = rest[2] + t.rot[2];
  const R = new M4().makeRotationFromEuler(new THREE.Euler(-rx * DEG, ry * DEG, -rz * DEG, 'ZYX'));
  const S = new M4().makeScale(t.scale[0], t.scale[1], t.scale[2]);
  const T1 = new M4().makeTranslation(P[0] + t.pos[0], P[1] + t.pos[1], P[2] + t.pos[2]);
  const T0 = new M4().makeTranslation(-P[0], -P[1], -P[2]);
  return T1.multiply(R).multiply(S).multiply(T0);
}
const ident = () => ({ pos: [0, 0, 0], rot: [0, 0, 0], scale: [1, 1, 1] });

class Skel {
  constructor(geo, matFor) {
    this.geo = geo;
    this.root = new THREE.Group();
    this.bones = new Map();
    for (const def of geo.bones) {
      const g = new THREE.Group(); g.matrixAutoUpdate = false;
      this.bones.set(lc(def.name), { def, g });
    }
    for (const [, b] of this.bones) {
      const p = b.def.parent ? this.bones.get(lc(b.def.parent)) : null;
      (p ? p.g : this.root).add(b.g);
    }
    for (const [k, b] of this.bones) {
      if (b.def.neverRender) continue;
      for (const c of b.def.cubes || []) {
        const m = matFor(k, b.def, c);
        if (!m) continue;
        b.g.add(new THREE.Mesh(cubeGeometry(c, geo.texW, geo.texH), m));
      }
    }
  }
  pose(tr) {
    for (const [k, b] of this.bones) b.g.matrix.copy(boneMatrix(b.def, tr[k] || ident()));
  }
}

// ---------------------------------------------------------------- molang
function makeMolang(vars, queries, ctxVars, ctxQueries) {
  const env = {
    variable: { ...vars },
    query: { ...queries },
    context: { ...(ctxVars || {}), owning_entity: new Context({ variable: ctxQueries?.vars || {}, query: ctxQueries?.queries || {} }) },
  };
  return new Molang(env, { useCache: false, useOptimizer: false, convertUndefined: true });
}
function ex(ml, expr, thisVal = 0, scal = {}) {
  if (typeof expr === 'number') return expr;
  let s = String(expr);
  s = s.replace(/\bthis\b/g, `(${thisVal})`);
  // rig-only workaround: the molang package cannot apply '!' to boolean values
  s = s.replace(/!(?!=)\s*([a-zA-Z_][\w.]*(?:->[\w.]+)?)/g, '(($1) ? 0 : 1)');
  for (const [k, v] of Object.entries(scal)) s = s.replace(new RegExp(`\\b(?:q|query)\\.${k}\\b`, 'gi'), `(${v})`);
  try {
    const r = ml.execute(s);
    return typeof r === 'number' ? r : (r === true ? 1 : (r === false ? 0 : Number(r) || 0));
  } catch (e) { console.log('MOLANG ERR', s.slice(0, 160), e.message); return 0; }
}

// ---------------------------------------------------------------- animation evaluation
function lerpV(a, b, t) { return a.map((x, i) => x + (b[i] - x) * t); }
function catmull(p0, p1, p2, p3, t) {
  return p1.map((_, i) => 0.5 * ((2 * p1[i]) + (-p0[i] + p2[i]) * t + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t * t + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t * t * t));
}
function evalChannel(ch, t, ml, thisVal, scal, isScale) {
  const asVec = (v) => {
    if (Array.isArray(v)) return v.map((e, i) => ex(ml, e, thisVal[i], scal));
    const n = ex(ml, v, thisVal[0], scal); return [n, n, n];
  };
  if (Array.isArray(ch) || typeof ch === 'number' || typeof ch === 'string') return asVec(ch);
  const keys = Object.keys(ch).map(Number).sort((a, b) => a - b);
  const kf = keys.map((k) => {
    const raw = ch[String(k)] ?? ch[k.toFixed(1)] ?? ch[Object.keys(ch).find((kk) => Number(kk) === k)];
    if (raw && !Array.isArray(raw) && typeof raw === 'object') {
      return { t: k, pre: asVec(raw.pre ?? raw.post), post: asVec(raw.post ?? raw.pre), mode: raw.lerp_mode };
    }
    const v = asVec(raw); return { t: k, pre: v, post: v, mode: undefined };
  });
  if (t <= kf[0].t) return kf[0].post;
  if (t >= kf[kf.length - 1].t) return kf[kf.length - 1].pre;
  let i = 0; while (i < kf.length - 1 && !(t >= kf[i].t && t < kf[i + 1].t)) i++;
  const a = kf[i], b = kf[i + 1]; const u = (t - a.t) / (b.t - a.t);
  if (a.mode === 'catmullrom' || b.mode === 'catmullrom') {
    const p0 = (kf[i - 1] || a).post, p3 = (kf[i + 2] || b).pre;
    return catmull(p0, a.post, b.pre, p3, u);
  }
  return lerpV(a.post, b.pre, u);
}

function animLocalTime(anim, t) {
  const len = anim.animation_length;
  if (anim.loop === true && len) return t % len;
  if (anim.loop === 'hold_on_last_frame' && len) return Math.min(t, len);
  return t;
}

// accumulate one animation into acc (map lcBone -> {pos,rot,scale})
function applyAnimation(animId, t, ml, acc, scalBase, weight = 1) {
  const anim = state.anims[animId];
  if (!anim) { console.log('MISSING ANIM', animId); return; }
  let lt;
  if (anim.anim_time_update !== undefined) {
    lt = ex(ml, anim.anim_time_update, 0, { ...scalBase, anim_time: 0 });
    if (anim.loop === true && anim.animation_length) lt = lt % anim.animation_length;
    else if (anim.loop === 'hold_on_last_frame' && anim.animation_length) lt = Math.min(lt, anim.animation_length);
  } else lt = animLocalTime(anim, t);
  if (!anim.loop && anim.animation_length && lt > anim.animation_length) return;
  const scal = { ...scalBase, anim_time: lt };
  for (const [bone, chans] of Object.entries(anim.bones || {})) {
    const k = lc(bone);
    const cur = acc[k] || (acc[k] = ident());
    if (anim.override_previous_animation) { cur.pos = [0, 0, 0]; cur.rot = [0, 0, 0]; cur.scale = [1, 1, 1]; }
    if (chans.rotation !== undefined) { const v = evalChannel(chans.rotation, lt, ml, cur.rot, scal); cur.rot = cur.rot.map((x, i) => x + v[i] * weight); }
    if (chans.position !== undefined) { const v = evalChannel(chans.position, lt, ml, cur.pos, scal); cur.pos = cur.pos.map((x, i) => x + v[i] * weight); }
    if (chans.scale !== undefined) { const v = evalChannel(chans.scale, lt, ml, cur.scale, scal, true); cur.scale = cur.scale.map((x, i) => x * (1 + (v[i] - 1) * weight)); }
  }
}

function resolveControllerAnims(ctrlId, shortToId, ml, scal) {
  const c = state.controllers[ctrlId];
  if (!c) { console.log('MISSING CONTROLLER', ctrlId); return []; }
  let cur = c.initial_state || Object.keys(c.states)[0];
  for (let n = 0; n < 8; n++) {
    const st = c.states[cur]; let moved = false;
    for (const tr of st.transitions || []) {
      const [target, cond] = Object.entries(tr)[0];
      if (ex(ml, cond, 0, scal)) { cur = target; moved = true; break; }
    }
    if (!moved) break;
  }
  const out = [];
  for (const a of c.states[cur].animations || []) {
    if (typeof a === 'string') out.push(a);
    else { const [n, cond] = Object.entries(a)[0]; if (ex(ml, cond, 0, scal)) out.push(n); }
  }
  return out.map((n) => shortToId[n]).filter(Boolean);
}

function expandAnimateList(list, shortToId, ml, scal) {
  const ids = [];
  const push = (shortName) => {
    const id = shortToId[shortName];
    if (!id) { console.log('UNKNOWN short anim', shortName); return; }
    if (id.startsWith('controller.')) {
      // controller animations reference short names of the same map
      for (const sub of resolveControllerAnims(id, shortToId, ml, scal)) ids.push(sub);
    } else ids.push(id);
  };
  for (const e of list) {
    if (typeof e === 'string') push(e);
    else { const [n, cond] = Object.entries(e)[0]; if (ex(ml, cond, 0, scal)) push(n); }
  }
  return ids;
}

// ---------------------------------------------------------------- player
function playerMats(name) {
  const colors = { head: 0xc99c76, body: 0x2f8f9d, rightarm: 0xc99c76, leftarm: 0xc99c76, rightleg: 0x3b4a9e, leftleg: 0x3b4a9e };
  if (!(name in colors)) return null;
  return new THREE.MeshLambertMaterial({ color: colors[name], side: THREE.DoubleSide });
}

async function setup(cfg) {
  for (const f of cfg.geoFiles) Object.assign(state.geos, parseGeometries(await getJson(f)));
  for (const f of cfg.animFiles) {
    const j = await getJson(f);
    for (const [id, a] of Object.entries(j.animations || {})) state.anims[id] = a;
  }
  for (const f of cfg.controllerFiles || []) {
    const j = await getJson(f);
    for (const [id, c] of Object.entries(j.animation_controllers || {})) state.controllers[id] = c;
  }
  for (const a of cfg.attachables) {
    const j = await getJson(a.url);
    state.attachables[a.name] = { desc: j['minecraft:attachable'].description, root: a.root };
  }
  state.playerGeo = state.geos['geometry.humanoid.custom'];
  return Object.keys(state.geos).length;
}

function buildPlayer() {
  const skel = new Skel(state.playerGeo, (k, def, c) => {
    if (['hat', 'jacket', 'leftsleeve', 'rightsleeve', 'leftpants', 'rightpants', 'cape'].includes(k)) return null;
    const m = playerMats(k);
    return m;
  });
  const faceMat = new THREE.MeshBasicMaterial({ color: 0x222222, side: THREE.DoubleSide });
  const head = skel.bones.get('head');
  for (const c of [{ origin: [-3, 27, -4.15], size: [2, 1.5, 0.3] }, { origin: [1, 27, -4.15], size: [2, 1.5, 0.3] }]) {
    const g = cubeGeometry({ ...c, uv: { north: { uv: [0, 0], uv_size: [1, 1] }, south: { uv: [0, 0], uv_size: [1, 1] }, east: { uv: [0, 0], uv_size: [1, 1] }, west: { uv: [0, 0], uv_size: [1, 1] }, up: { uv: [0, 0], uv_size: [1, 1] }, down: { uv: [0, 0], uv_size: [1, 1] } } }, 1, 1);
    head.g.add(new THREE.Mesh(g, faceMat));
  }
  for (const [k, b] of skel.bones) b.g.children.forEach((o) => { if (o.isMesh) { o.userData.isPlayer = true; o.userData.bone = k; } });
  return skel;
}

async function buildAttachable(name) {
  const a = state.attachables[name];
  const geoId = a.desc.geometry.default;
  const geo = state.geos[geoId];
  if (!geo) throw new Error('geometry not found: ' + geoId);
  const texPath = a.root + a.desc.textures.default + '.png';
  const tex = await loadTexture(texPath);
  const mat = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide });
  const glowMat = new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide });
  const skel = new Skel(geo, (k) => (k.startsWith('glow') ? glowMat : mat));
  return { skel, a, geo };
}

// ---------------------------------------------------------------- scene / render
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);

const PIVOT = (bone, axis) => {
  const b = state.playerGeo.bones.find((x) => lc(x.name) === lc(bone));
  return b ? (b.pivot || [0, 0, 0])[axis] : 0;
};

function playerEnvVars(view, ownerVars) {
  const at = ownerVars.attack_time || 0;
  return {
    is_holding_right: 1, is_holding_left: 0, attack_time: at,
    attack_body_rot_y: Math.sin(360 * Math.sqrt(at) * DEG) * 5,
    first_person_rotation_factor: Math.sin((1 - at) * 180 * DEG),
    short_arm_offset_right: 0, short_arm_offset_left: 0, bob_animation: 0, player_arm_height: 1,
    is_using_vr: 0, hand_bob: 0, tcos0: 0, ...ownerVars,
  };
}
function baseQueries(q, defaultPivot) {
  return {
    life_time: 0, target_x_rotation: 0, target_y_rotation: 0, frame_alpha: 0, anim_time: 0,
    is_using_item: 0, main_hand_item_use_duration: 0, main_hand_item_max_duration: 0,
    can_damage_nearby_mobs: 0, has_target: 0, walk_distance: 0, is_sneaking: 0, is_on_ground: 1, is_sprinting: 0,
    ground_speed: 0, modified_move_speed: 0,
    get_default_bone_pivot: defaultPivot,
    get_equipped_item_name: () => '',
    item_remaining_use_duration: () => 0,
    cooldown_time_remaining: () => q.cooldown_remaining || 0,
    cooldown_time: () => q.cooldown_total || 0,
    ...q,
  };
}

const FP_ANIMS = ['animation.player.first_person.base_pose', 'animation.player.first_person.empty_hand'];
const TP_ANIMS = ['animation.humanoid.base_pose', 'animation.player.holding', 'animation.player.attack.rotations', 'animation.player.attack.positions'];


function evaluatePlayer(view, ownerVars, queries) {
  const pVars = playerEnvVars(view, ownerVars);
  const pml = makeMolang(pVars, queries);
  const pAcc = {};
  const pList = (view === 'first' ? FP_ANIMS : TP_ANIMS).slice();
  if (view === 'first' && (pVars.attack_time || 0) > 0) pList.push('animation.player.first_person.attack_rotation');
  for (const id of pList) applyAnimation(id, queries.life_time, pml, pAcc, { life_time: queries.life_time });
  return { pAcc, pVars };
}

const V3 = THREE.Vector3;
function chainMatrix(player, boneKey) {
  const chain = [];
  for (let o = player.bones.get(boneKey).g; o && o !== player.root; o = o.parent) chain.push(o);
  const M = new M4();
  for (let i = chain.length - 1; i >= 0; i--) M.multiply(chain[i].matrix);
  return M;
}

// Build a pose (view frame: x=right, y=up, z=forward) -> tip & edge directions
function poseDirs(pitch, lean, roll) {
  const tip = new V3(Math.tan(lean * DEG), 1, Math.tan(pitch * DEG)).normalize();
  let e = new V3(0, 0, 1); e.sub(tip.clone().multiplyScalar(e.dot(tip))).normalize();
  // roll about the tip axis (Rodrigues)
  const k = tip, c = Math.cos(roll * DEG), sn = Math.sin(roll * DEG);
  const kxe = new V3().crossVectors(k, e);
  const er = e.clone().multiplyScalar(c).add(kxe.multiplyScalar(sn)).add(k.clone().multiplyScalar(k.dot(e) * (1 - c)));
  return { tip, edge: er.normalize() };
}

function solveHold(player, view, spec) {
  const queries = baseQueries({}, PIVOT);
  const { pAcc } = evaluatePlayer(view, { attack_time: 0 }, queries);
  player.pose(pAcc);
  const handF = chainMatrix(player, 'rightitem');
  const P_h = new V3(...player.bones.get('rightitem').def.pivot);
  const handPos = P_h.clone().applyMatrix4(handF);
  const toF = (v) => (view === 'first' ? new V3(v.x, v.y, v.z) : new V3(-v.x, v.y, -v.z));
  const { tip, edge } = poseDirs(spec.pitch || 0, spec.lean || 0, spec.roll || 0);
  const Y = toF(tip).normalize();
  let E = toF(edge); E.sub(Y.clone().multiplyScalar(E.dot(Y))).normalize();
  const Z = E.clone().multiplyScalar(-1);
  const X = new V3().crossVectors(Y, Z).normalize();
  const R = new M4().makeBasis(X, Y, Z);
  const off = spec.offset || [0, 0, 0];
  const anchor = handPos.clone().add(toF(new V3(off[0], off[1], off[2])));
  const pivot = new V3(0, 24, 0);
  const W = new M4().makeTranslation(anchor.x, anchor.y, anchor.z).multiply(R).multiply(new M4().makeTranslation(-pivot.x, -pivot.y, -pivot.z));
  const A = new M4().makeTranslation(P_h.x, P_h.y - 24, P_h.z);
  const L = A.clone().invert().multiply(handF.clone().invert()).multiply(W);
  const R3 = new M4().extractRotation(L);
  const t = new V3().setFromMatrixPosition(L);
  const RP = pivot.clone().applyMatrix4(R3);
  const pos = t.clone().sub(pivot).add(RP);
  const e = new THREE.Euler().setFromRotationMatrix(R3, 'ZYX');
  const r = (n) => Math.round(n * 100) / 100;
  return { pos: [r(pos.x), r(pos.y), r(pos.z)], rot: [r(-e.x / DEG), r(e.y / DEG), r(-e.z / DEG)], scale: [1, 1, 1] };
}

function evaluateFrame(attName, built, tile) {
  const view = tile.view || 'third';
  const ownerVars = tile.ownerVars || {};
  const queries = baseQueries(tile.queries || {}, PIVOT);
  const pVars = playerEnvVars(view, ownerVars);
  // --- player pose
  const { pAcc } = evaluatePlayer(view, ownerVars, queries);
  // --- attachable pose
  const d = built.a.desc;
  const ownerCtx = { vars: pVars, queries };
  const aml = makeMolang({}, queries, { is_first_person: view === 'first' ? 1 : 0, item_slot: 'main_hand' }, ownerCtx);
  const scalA = { life_time: queries.life_time, frame_alpha: queries.frame_alpha };
  for (const line of d.scripts?.initialize || []) ex(aml, line, 0, scalA);
  for (const line of d.scripts?.pre_animation || []) ex(aml, line, 0, scalA);
  const shortToId = d.animations || {};
  const ids = expandAnimateList(d.scripts?.animate || [], shortToId, aml, scalA);
  const aAcc = {};
  const aTime = tile.animTime ?? queries.life_time;
  for (const id of ids) applyAnimation(id, aTime, aml, aAcc, scalA);
  return { pAcc, aAcc, ids };
}

function placeCamera(cam, view, aspect) {
  const camera = new THREE.PerspectiveCamera(cam.fov || (view === 'first' ? 70 : 35), aspect, 0.3, 500);
  if (view === 'first') {
    const y = cam.eyeY ?? 23, z = cam.eyeZ ?? 0, x = cam.eyeX ?? 0;
    camera.position.set(x, y, z);
    camera.up.set(0, 1, 0);
    camera.lookAt(x, y, z + 1);
  } else {
    const t = cam.target || [0, 17, 0];
    const az = (cam.az ?? 40) * DEG, el = (cam.el ?? 12) * DEG, dist = cam.dist ?? 85;
    const target = new THREE.Vector3(-t[0], t[1], t[2]); // F->world mirror
    camera.position.set(target.x + dist * Math.sin(az) * Math.cos(el), target.y + dist * Math.sin(el), target.z - dist * Math.cos(az) * Math.cos(el));
    camera.up.set(0, 1, 0);
    camera.lookAt(target);
  }
  return camera;
}

async function renderSheet(spec) {
  const built = await buildAttachable(spec.attachable);
  const standalone = !!spec.standalone;
  const player = standalone ? null : buildPlayer();
  const world = new THREE.Group(); world.scale.x = -1;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(spec.bg ?? 0x343b4a);
  scene.add(world);
  const grid = new THREE.GridHelper(64, 16, 0x667085, 0x4a5262); world.add(grid);
  scene.add(new THREE.AmbientLight(0xffffff, 1.6));
  const dl = new THREE.DirectionalLight(0xffffff, 1.4); dl.position.set(-40, 80, -60); scene.add(dl);
  if (standalone) {
    world.add(built.skel.root); grid.visible = false;
  } else {
    world.add(player.root);
    const hand = player.bones.get('rightitem');
    const P = hand.def.pivot;
    const attachRoot = new THREE.Group(); attachRoot.matrixAutoUpdate = false;
    attachRoot.matrix.copy(new M4().makeTranslation(P[0], P[1] - 24 + (spec.bindDy || 0), P[2]));
    attachRoot.add(built.skel.root); hand.g.add(attachRoot);
    if (spec.noAttach) attachRoot.visible = false;
  }

  const tw = spec.tileW || 420, th = spec.tileH || 420, cols = spec.cols || 4;
  const rows = Math.ceil(spec.tiles.length / cols);
  const sheet = document.createElement('canvas'); sheet.width = tw * cols; sheet.height = th * rows;
  const ctx = sheet.getContext('2d');
  renderer.setSize(tw, th, false);
  const logs = [];
  for (let i = 0; i < spec.tiles.length; i++) {
    const tile = { view: spec.view, ...spec.tiles[i] };
    let { pAcc, aAcc, ids } = evaluateFrame(spec.attachable, built, tile);
    if (spec.noAnim) { aAcc = {}; ids = []; }
    const holdSpec = tile.hold || (spec.hold && spec.hold[tile.view || 'third']);
    if (holdSpec && player) {
      const sol = solveHold(player, tile.view || 'third', holdSpec);
      aAcc['root'] = sol;
      if (!tile.quiet) console.log('HOLD', tile.view || 'third', JSON.stringify(holdSpec), '=>', JSON.stringify(sol));
    }
    if (tile.weaponPose) {
      const w = aAcc['weapon'] || (aAcc['weapon'] = ident());
      const wp = tile.weaponPose;
      if (wp.rot) w.rot = w.rot.map((x, i) => x + wp.rot[i]);
      if (wp.pos) w.pos = w.pos.map((x, i) => x + wp.pos[i]);
    }
    if (player) player.pose(pAcc);
    built.skel.pose(aAcc);
    world.updateMatrixWorld(true);
    // hide parts that are not visible in first person
    const fp = tile.view === 'first';
    grid.visible = !fp;
    if (player) player.root.traverse((o) => { if (o.isMesh && o.userData.isPlayer) o.visible = fp ? (!!spec.showArm && o.userData.bone === 'rightarm') : true; });
    const camera = placeCamera(tile.cam || spec.cam || {}, tile.view || 'third', tw / th);
    renderer.render(scene, camera);
    ctx.drawImage(renderer.domElement, (i % cols) * tw, Math.floor(i / cols) * th);
    ctx.font = '14px monospace'; ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
    const label = tile.label || '';
    ctx.strokeText(label, (i % cols) * tw + 8, Math.floor(i / cols) * th + 18); ctx.fillText(label, (i % cols) * tw + 8, Math.floor(i / cols) * th + 18);
    logs.push(ids.join(','));
  }
  return { png: sheet.toDataURL('image/png'), logs };
}

window.RIG = { setup, renderSheet };
window.RIG_READY = true;
