// Client-entity animation runtime: scripts (initialize / pre_animation / animate / scale),
// animations (format 1.8.0) and animation controllers (format 1.10.0) with Molang evaluated
// every frame. Produces an additive pose (Bedrock sign convention, deltas from bind pose).

import { evaluate, evalNum, toNum, makeRng } from './molang.mjs';

const lc = (s) => String(s).toLowerCase();

function asList(x) {
  if (x === undefined || x === null) return [];
  return Array.isArray(x) ? x : [x];
}

// [name, weightExprOrNull] from "name" | {name: expr}
function entryOf(e) {
  if (typeof e === 'string') return [lc(e), null];
  const [k, v] = Object.entries(e)[0];
  return [lc(k), v];
}

function animLength(def) {
  if (def.animation_length !== undefined) return Number(def.animation_length) || 0;
  let max = 0;
  const scanKeys = (obj) => {
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      for (const k of Object.keys(obj)) { const n = Number(k); if (Number.isFinite(n)) max = Math.max(max, n); }
    }
  };
  for (const b of Object.values(def.bones || {})) for (const ch of ['rotation', 'position', 'scale']) scanKeys(b[ch]);
  scanKeys(def.timeline);
  scanKeys(def.sound_effects);
  scanKeys(def.particle_effects);
  return max;
}

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

function isKeyframeObject(ch) {
  return ch && typeof ch === 'object' && !Array.isArray(ch) && Object.keys(ch).every((k) => Number.isFinite(Number(k)));
}

export class EntityRuntime {
  // res: ResourcePacks; desc: client entity description; opts: {warn, boneKeys:Set, seed}
  constructor(res, desc, opts = {}) {
    this.res = res;
    this.desc = desc || {};
    this.warnSet = new Map();
    this.warnFn = opts.warn || null;
    this.boneKeys = opts.boneKeys || null;
    this.bindRot = opts.bindRot || null; // Map boneKey -> bind rotation (for `this`)
    this.variables = new Map();
    this.animStates = new Map();
    this.ctrlStates = new Map();
    this.events = [];
    this.rng = makeRng(opts.seed ?? 1);
    this.animMap = new Map();
    for (const [k, v] of Object.entries(this.desc.animations || {})) this.animMap.set(lc(k), lc(v));
    // legacy "animation_controllers": [{short: id}] (always run)
    this.legacyControllers = [];
    for (const e of asList(this.desc.animation_controllers)) {
      for (const [k, v] of Object.entries(e)) { this.animMap.set(lc(k), lc(v)); this.legacyControllers.push(lc(k)); }
    }
    this.scripts = this.desc.scripts || {};
    this.initialized = false;
    this.extraAnimate = []; // [[nameOrId, weight]] added by CLI (e.g. --animate)
    this.poseOverrides = new Map(); // boneKey -> {rot,pos,scl} absolute deltas added last
    this.ctrlStateLog = new Map();
  }

  warn(msg) {
    const n = this.warnSet.get(msg) || 0;
    this.warnSet.set(msg, n + 1);
    if (n === 0 && this.warnFn) this.warnFn(msg);
  }

  warnings() { return [...this.warnSet.entries()].map(([m, n]) => ({ message: m, count: n })); }

  _ctx(extra = {}) {
    const base = this.frameQuery;
    const ctx = {
      variables: this.variables,
      rng: this.rng,
      warn: (m) => this.warn(m),
      thisValue: extra.thisValue ?? 0,
      temps: extra.temps,
      query: (name, args) => {
        if (extra.local && Object.prototype.hasOwnProperty.call(extra.local, name)) return extra.local[name];
        if (name === 'anim_time' || name === 'all_animations_finished' || name === 'any_animation_finished') {
          return extra.local && extra.local[name] !== undefined ? extra.local[name] : 0;
        }
        return base ? base(name, args) : undefined;
      },
    };
    return ctx;
  }

  _runScripts(list, extra = {}) {
    const temps = new Map();
    for (const s of asList(list)) {
      if (typeof s !== 'string') continue;
      const trimmed = s.trim();
      if (trimmed.startsWith('/') || trimmed.startsWith('@')) continue; // commands / events (BP only)
      evaluate(s, this._ctx({ ...extra, temps }));
    }
  }

  // Advance one frame. frame = {t, dt, query}
  // Returns {pose: Map, entityScale}
  step(frame) {
    this.t = frame.t;
    this.dt = frame.dt;
    this.frameQuery = frame.query;
    this.pose = new Map();
    this.frameEvents = [];
    if (!this.initialized) {
      this._runScripts(this.scripts.initialize);
      this.initialized = true;
    }
    this._runScripts(this.scripts.pre_animation);
    let entityScale = 1;
    if (this.scripts.scale !== undefined) entityScale = evalNum(this.scripts.scale, this._ctx());
    const active = new Set();
    this.active = active;
    for (const name of this.legacyControllers) this._runRef(name, 1, `ctrl:${name}`);
    for (const e of asList(this.scripts.animate)) {
      const [name, wexpr] = entryOf(e);
      const w = wexpr === null ? 1 : evalNum(wexpr, this._ctx());
      this._runRef(name, w, `animate:${name}`);
    }
    for (const [name, w] of this.extraAnimate) this._runRef(lc(name), w, `extra:${name}`);
    // drop states of animations that were not evaluated this frame (they restart next time)
    for (const k of [...this.animStates.keys()]) if (!active.has(k)) this.animStates.delete(k);
    for (const [bone, p] of this.poseOverrides) {
      const acc = this._acc(bone);
      for (let i = 0; i < 3; i++) { acc.rot[i] += p.rot?.[i] ?? 0; acc.pos[i] += p.pos?.[i] ?? 0; acc.scl[i] *= p.scl?.[i] ?? 1; }
    }
    return { pose: this.pose, entityScale, events: this.frameEvents };
  }

  _acc(bone) {
    let a = this.pose.get(bone);
    if (!a) { a = { rot: [0, 0, 0], pos: [0, 0, 0], scl: [1, 1, 1] }; this.pose.set(bone, a); }
    return a;
  }

  _resolve(name) {
    const id = this.animMap.get(name) || name;
    if (this.res.controllers.has(id)) return { kind: 'controller', id };
    if (this.res.animations.has(id)) return { kind: 'animation', id };
    return { kind: 'missing', id };
  }

  _runRef(name, weight, key) {
    const r = this._resolve(name);
    if (r.kind === 'controller') return this._runController(r.id, weight, key);
    if (r.kind === 'animation') return this._runAnimation(r.id, weight, key);
    this.warn(`animation/controller '${name}' not found (resolved id '${r.id}')`);
    return null;
  }

  // ------------------------------------------------------------ animations
  _runAnimation(id, weight, key, opts = {}) {
    const entry = this.res.animations.get(id);
    const def = entry.def;
    if (!(weight > 0) && !opts.keepAlive) {
      this.animStates.delete(key);
      return;
    }
    this.active.add(key);
    let st = this.animStates.get(key);
    const length = animLength(def);
    const loop = def.loop === true || def.loop === 'true' ? 'loop' : (def.loop === 'hold_on_last_frame' ? 'hold' : 'once');
    if (!st) {
      st = { time: 0, prevTime: -1e-9, finished: false, loops: 0, startT: this.t, startDelay: evalNum(def.start_delay ?? 0, this._ctx()) };
      this.animStates.set(key, st);
    } else {
      st.prevTime = st.time;
      if (def.anim_time_update !== undefined) {
        st.time = evalNum(def.anim_time_update, this._ctx({ local: { anim_time: st.time } }));
      } else st.time += this.dt;
    }
    let sampleT = st.time - (st.startDelay || 0);
    if (sampleT < 0) return;
    let wrapped = false;
    if (loop === 'loop' && length > 0) {
      if (def.anim_time_update === undefined) {
        if (st.time >= length) { st.time -= Math.floor(st.time / length) * length; st.finished = true; wrapped = true; }
        sampleT = st.time;
      } else {
        if (sampleT >= length) st.finished = true;
        sampleT = ((sampleT % length) + length) % length;
      }
    } else if (length >= 0 && sampleT >= length) {
      st.finished = true;
      if (length === 0 && loop === 'once') this.warn(`animation ${id} is not looping and has length 0: it only affects the first frame after it starts (add "loop": true for continuous Molang animations)`);
      if (loop === 'once' && sampleT > length + 1e-9 && st.reportedEnd) return;
      st.reportedEnd = true;
      sampleT = length;
    }
    // timeline / effects
    const prevSample = wrapped ? -1e-9 : Math.min(st.prevTime - (st.startDelay || 0), sampleT);
    this._fireKeyed(def.timeline, prevSample, sampleT, wrapped, length, (v) => this._runScripts(asList(v)));
    this._fireKeyed(def.sound_effects, prevSample, sampleT, wrapped, length, (v) => {
      for (const e of asList(v)) this.frameEvents.push({ type: 'sound', effect: e.effect, source: id });
    });
    this._fireKeyed(def.particle_effects, prevSample, sampleT, wrapped, length, (v) => {
      for (const e of asList(v)) {
        if (e.pre_effect_script) this._runScripts([e.pre_effect_script]);
        this.frameEvents.push({ type: 'particle', effect: e.effect, locator: e.locator, source: id });
      }
    });
    let w = weight;
    if (def.blend_weight !== undefined) w *= evalNum(def.blend_weight, this._ctx({ local: { anim_time: sampleT } }));
    if (!(w > 0) && !(w < 0)) return;
    const local = { anim_time: sampleT };
    for (const [boneName, chans] of Object.entries(def.bones || {})) {
      const bone = lc(boneName);
      if (this.boneKeys && !this.boneKeys.has(bone)) { this.warn(`animation ${id} targets unknown bone '${boneName}'`); continue; }
      const acc = this._acc(bone);
      if (def.override_previous_animation) { acc.rot = [0, 0, 0]; acc.pos = [0, 0, 0]; acc.scl = [1, 1, 1]; }
      if (chans.rotation !== undefined) {
        const bind = this.bindRot ? (this.bindRot.get(bone) || [0, 0, 0]) : [0, 0, 0];
        const v = this._channel(chans.rotation, sampleT, local, [bind[0] + acc.rot[0], bind[1] + acc.rot[1], bind[2] + acc.rot[2]], `${id}/${boneName}/rotation`);
        for (let i = 0; i < 3; i++) acc.rot[i] += w * v[i];
      }
      if (chans.position !== undefined) {
        const v = this._channel(chans.position, sampleT, local, acc.pos.slice(), `${id}/${boneName}/position`);
        for (let i = 0; i < 3; i++) acc.pos[i] += w * v[i];
      }
      if (chans.scale !== undefined) {
        const v = this._channel(chans.scale, sampleT, local, acc.scl.slice(), `${id}/${boneName}/scale`, true);
        for (let i = 0; i < 3; i++) acc.scl[i] *= 1 + (v[i] - 1) * w;
      }
    }
  }

  _fireKeyed(obj, prev, now, wrapped, length, fn) {
    if (!obj || typeof obj !== 'object') return;
    for (const [k, v] of Object.entries(obj)) {
      const kt = Number(k);
      if (!Number.isFinite(kt)) continue;
      if (wrapped) {
        if (kt > prev || kt <= now) fn(v);
      } else if (kt > prev && kt <= now) fn(v);
    }
  }

  _evalVec(v, local, thisVals, isScale) {
    const one = (x, i) => {
      const r = evaluate(x, this._ctx({ local, thisValue: thisVals[i] }));
      const n = toNum(r);
      if (!Number.isFinite(n)) { this.warn(`non-finite channel value from '${String(x).slice(0, 80)}'`); return isScale ? 1 : 0; }
      return n;
    };
    if (Array.isArray(v)) {
      if (v.length === 1) { const s = one(v[0], 0); return [s, s, s]; }
      return [one(v[0], 0), one(v[1], 1), one(v[2], 2)];
    }
    const s = one(v, 0);
    return [s, s, s];
  }

  _channel(ch, t, local, thisVals, label, isScale = false) {
    if (!isKeyframeObject(ch)) return this._evalVec(ch, local, thisVals, isScale);
    const keys = Object.keys(ch).map((k) => ({ t: Number(k), v: ch[k] })).sort((a, b) => a.t - b.t);
    if (keys.length === 0) return isScale ? [1, 1, 1] : [0, 0, 0];
    const pre = (k) => (k.v && typeof k.v === 'object' && !Array.isArray(k.v) ? (k.v.pre ?? k.v.post) : k.v);
    const post = (k) => (k.v && typeof k.v === 'object' && !Array.isArray(k.v) ? (k.v.post ?? k.v.pre) : k.v);
    const mode = (k) => (k.v && typeof k.v === 'object' && !Array.isArray(k.v) ? (k.v.lerp_mode || 'linear') : 'linear');
    const ev = (val) => this._evalVec(val, local, thisVals, isScale);
    if (t <= keys[0].t) return ev(pre(keys[0]));
    const last = keys[keys.length - 1];
    if (t >= last.t) return ev(post(last));
    let i = 0;
    while (i < keys.length - 1 && !(t >= keys[i].t && t < keys[i + 1].t)) i++;
    const a = keys[i];
    const b = keys[i + 1];
    const alpha = (t - a.t) / (b.t - a.t);
    const ma = mode(a);
    if (ma === 'step') return ev(post(a));
    const va = ev(post(a));
    const vb = ev(pre(b));
    if (ma === 'catmullrom' || mode(b) === 'catmullrom') {
      const p0 = i > 0 ? ev(post(keys[i - 1])) : va;
      const p3 = i + 2 < keys.length ? ev(pre(keys[i + 2])) : vb;
      return [0, 1, 2].map((j) => catmull(p0[j], va[j], vb[j], p3[j], alpha));
    }
    return [0, 1, 2].map((j) => va[j] + (vb[j] - va[j]) * alpha);
  }

  // ------------------------------------------------------------ controllers
  _stateAnimKey(key, state, name) { return `${key}/${state}/${name}`; }

  _finishedFlags(key, stateName, stateDef) {
    const entries = asList(stateDef.animations).map(entryOf);
    if (entries.length === 0) return { all: 1, any: 0 };
    let all = true;
    let any = false;
    for (const [name] of entries) {
      const r = this._resolve(name);
      const k = this._stateAnimKey(key, stateName, name);
      let fin = false;
      if (r.kind === 'animation') {
        const st = this.animStates.get(k);
        fin = !!(st && st.finished);
      } else if (r.kind === 'controller') fin = true;
      all = all && fin;
      any = any || fin;
    }
    return { all: all ? 1 : 0, any: any ? 1 : 0 };
  }

  _enterState(id, key, cs, name) {
    const ctrl = this.res.controllers.get(id).def;
    const def = (ctrl.states || {})[name];
    if (!def) { this.warn(`controller ${id}: missing state '${name}'`); return; }
    cs.state = name;
    cs.enteredAt = this.t;
    // restart the state's animations
    const prefix = `${key}/${name}/`;
    for (const k of [...this.animStates.keys()]) if (k.startsWith(prefix)) this.animStates.delete(k);
    this._runScripts(def.on_entry);
    for (const e of asList(def.sound_effects)) this.frameEvents.push({ type: 'sound', effect: e.effect, source: `${id}:${name}` });
    for (const e of asList(def.particle_effects)) {
      if (e.pre_effect_script) this._runScripts([e.pre_effect_script]);
      this.frameEvents.push({ type: 'particle', effect: e.effect, locator: e.locator, source: `${id}:${name}` });
    }
    let log = this.ctrlStateLog.get(id);
    if (!log) { log = []; this.ctrlStateLog.set(id, log); }
    log.push({ t: this.t, state: name });
  }

  _runController(id, weight, key) {
    const ctrl = this.res.controllers.get(id).def;
    const states = ctrl.states || {};
    let cs = this.ctrlStates.get(key);
    if (!cs) {
      cs = { state: null, blend: null };
      this.ctrlStates.set(key, cs);
      const init = ctrl.initial_state || 'default';
      this._enterState(id, key, cs, states[init] ? init : Object.keys(states)[0]);
    } else {
      const sdef = states[cs.state] || {};
      const flags = this._finishedFlags(key, cs.state, sdef);
      for (const tr of asList(sdef.transitions)) {
        const [target, expr] = Object.entries(tr)[0];
        const v = evaluate(expr, this._ctx({ local: { all_animations_finished: flags.all, any_animation_finished: flags.any } }));
        if (toNum(v) !== 0 || (typeof v === 'string' && v.length)) {
          if (!states[target]) { this.warn(`controller ${id}: transition to missing state '${target}'`); break; }
          this._runScripts(sdef.on_exit);
          const blendT = typeof sdef.blend_transition === 'number' ? sdef.blend_transition
            : (sdef.blend_transition && typeof sdef.blend_transition === 'object'
              ? Math.max(0, ...Object.keys(sdef.blend_transition).map(Number).filter(Number.isFinite)) : 0);
          const prev = cs.state;
          cs.blend = blendT > 0 ? { state: prev, total: blendT, remaining: blendT } : null;
          this._enterState(id, key, cs, target);
          break;
        }
      }
    }
    const sdef = states[cs.state] || {};
    // state variables (remap curves)
    for (const [vname, vdef] of Object.entries(sdef.variables || {})) {
      const input = evalNum(vdef.input ?? 0, this._ctx());
      let out = input;
      if (vdef.remap_curve) {
        const pts = Object.entries(vdef.remap_curve).map(([k, v]) => [Number(k), Number(v)]).sort((a, b) => a[0] - b[0]);
        if (pts.length) {
          if (input <= pts[0][0]) out = pts[0][1];
          else if (input >= pts[pts.length - 1][0]) out = pts[pts.length - 1][1];
          else for (let i = 0; i < pts.length - 1; i++) if (input >= pts[i][0] && input < pts[i + 1][0]) out = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * (input - pts[i][0]) / (pts[i + 1][0] - pts[i][0]);
        }
      }
      const vkey = lc(vname).replace(/^(v|variable)\./, '');
      this.variables.set(vkey, out);
    }
    // blending out the previous state
    let inW = 1;
    if (cs.blend) {
      cs.blend.remaining -= this.dt;
      if (cs.blend.remaining <= 0) cs.blend = null;
      else {
        const outW = cs.blend.remaining / cs.blend.total;
        inW = 1 - outW;
        const pdef = states[cs.blend.state] || {};
        for (const e of asList(pdef.animations)) {
          const [name, wexpr] = entryOf(e);
          const w = wexpr === null ? 1 : evalNum(wexpr, this._ctx());
          this._runRef(name, weight * w * outW, this._stateAnimKey(key, cs.blend.state, name));
        }
      }
    }
    for (const e of asList(sdef.animations)) {
      const [name, wexpr] = entryOf(e);
      const w = wexpr === null ? 1 : evalNum(wexpr, this._ctx());
      this._runRef(name, weight * w * inW, this._stateAnimKey(key, cs.state, name));
    }
  }

  controllerStates() {
    const out = {};
    for (const [k, cs] of this.ctrlStates) out[k] = cs.state;
    return out;
  }
}
