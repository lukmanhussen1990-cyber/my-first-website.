// Scenario: mocked entity state over time (properties timeline, motion profile, look target,
// death, query overrides) and the query.* implementation built on top of it.

import fs from 'node:fs';
import { readJsonLoose } from './resources.mjs';

const TICK = 0.05; // Minecraft tick (s)

// value spec: number | boolean | string | [[t, v], ...] (piecewise linear for numbers, step for others)
export function sampleSpec(spec, t, def = 0) {
  if (spec === undefined || spec === null) return def;
  if (!Array.isArray(spec)) return spec;
  if (spec.length === 0) return def;
  if (!Array.isArray(spec[0])) return spec; // plain array value
  if (t <= spec[0][0]) return spec[0][1];
  for (let i = 0; i < spec.length - 1; i++) {
    const [t0, v0] = spec[i];
    const [t1, v1] = spec[i + 1];
    if (t >= t0 && t < t1) {
      if (typeof v0 === 'number' && typeof v1 === 'number' && t1 > t0) return v0 + (v1 - v0) * ((t - t0) / (t1 - t0));
      return v0;
    }
  }
  return spec[spec.length - 1][1];
}

export const DISTANCE_MODELS = ['walk_anim', 'meters'];

class Motion {
  constructor(cfg, startT) {
    this.cfg = cfg || {};
    this.t = startT;
    this.headingDeg = Number(this.cfg.heading_deg) || 0; // three.js yaw (CCW from above), 0 = facing -Z
    this.pos = [0, 0]; // three.js world x,z in blocks
    this.dist = 0; // horizontal distance (blocks)
    this.speed = 0;
    this.turn = 0;
    this.walkMul = this.cfg.walk_animation_speed ?? 1;
    // Java/Bedrock walk-animation accumulator (ActorWalkAnimationComponent)
    this.nextTick = startT + TICK;
    this.lastTickPos = [0, 0];
    this.walkSpeed = 0;
    this.walkSpeedO = 0;
    this.walkPos = 0;
    this.walkPosO = 0;
    this.lastTickT = startT;
  }
  speedAt(t) { return Math.max(0, Number(sampleSpec(this.cfg.speed, t, 0)) || 0); }
  turnAt(t) { return Number(sampleSpec(this.cfg.turn_deg_s, t, 0)) || 0; }
  advance(t1) {
    while (this.t < t1 - 1e-12) {
      const tEnd = Math.min(t1, this.nextTick);
      let tt = this.t;
      while (tt < tEnd - 1e-12) {
        const h = Math.min(1 / 480, tEnd - tt);
        const tm = tt + h / 2;
        const sp = this.speedAt(tm);
        const tr = this.turnAt(tm);
        // Minecraft yaw rate positive = clockwise from above = three.js yaw decreasing
        this.headingDeg -= tr * h;
        const a = (this.headingDeg * Math.PI) / 180;
        this.pos[0] += -Math.sin(a) * sp * h;
        this.pos[1] += -Math.cos(a) * sp * h;
        this.dist += sp * h;
        tt += h;
      }
      this.t = tEnd;
      if (this.t >= this.nextTick - 1e-12) {
        const dx = this.pos[0] - this.lastTickPos[0];
        const dz = this.pos[1] - this.lastTickPos[1];
        const d = Math.sqrt(dx * dx + dz * dz);
        const f = Math.min(d * 4, 1);
        this.walkSpeedO = this.walkSpeed;
        this.walkSpeed += (f - this.walkSpeed) * 0.4;
        this.walkPosO = this.walkPos;
        this.walkPos += this.walkSpeed * this.walkMul;
        this.lastTickPos = [this.pos[0], this.pos[1]];
        this.lastTickT = this.nextTick;
        this.nextTick += TICK;
      }
    }
    this.speed = this.speedAt(t1);
    this.turn = this.turnAt(t1);
  }
  frameAlpha() { return Math.max(0, Math.min(1, (this.t - this.lastTickT) / TICK)); }
}

export class Scenario {
  constructor(json = {}, overrides = {}) {
    this.json = json;
    this.name = json.name || 'scenario';
    this.entity = overrides.entity || json.entity || null;
    this.duration = Number(overrides.duration ?? json.duration ?? 2);
    this.fps = Number(overrides.fps ?? json.fps ?? 10);
    this.warmup = Number(overrides.warmup ?? json.warmup ?? 0);
    this.seed = Number(json.seed ?? 1);
    this.entityScale = Number(json.entity_scale ?? 1);
    this.props = { ...(json.props || {}) };
    this.propsTimeline = normaliseTimeline(json.props_timeline);
    this.motionCfg = { ...(json.motion || {}) };
    this.distanceModel = overrides.distanceModel || this.motionCfg.distance_model || 'walk_anim';
    if (!DISTANCE_MODELS.includes(this.distanceModel)) throw new Error(`distance_model must be one of ${DISTANCE_MODELS.join(', ')}`);
    this.yawSpeedUnit = this.motionCfg.yaw_speed_unit || 'deg_per_s';
    this.look = json.look || {};
    this.deathTime = json.death_time ?? null;
    this.queryOverrides = json.queries || {};
    this.environment = { trees: true, tree_count: 36, tree_radius: 48, ground: true, ...(json.environment || {}) };
    this.camera = json.camera || null;
    this.motion = new Motion(this.motionCfg, -this.warmup);
  }

  static fromFile(file, overrides) {
    return new Scenario(readJsonLoose(file), overrides);
  }

  propsAt(t) {
    const p = { ...this.props };
    for (const e of this.propsTimeline) if (e.t <= t + 1e-9) Object.assign(p, e.set);
    return p;
  }

  advance(t) { this.motion.advance(t); }

  // Molang query provider at time t (scenario time; life_time = t + warmup)
  makeQuery(t, dt) {
    const m = this.motion;
    const props = this.propsAt(t);
    const alive = this.deathTime === null || t < this.deathTime;
    const fa = m.frameAlpha();
    const headingMc = -m.headingDeg; // Minecraft-style body yaw relative to start (clockwise +)
    const ov = this.queryOverrides;
    return (name, args) => {
      if (Object.prototype.hasOwnProperty.call(ov, name)) return sampleSpec(ov[name], t, 0);
      switch (name) {
        case 'property':
        case 'actor_property': {
          const key = String(args[0] ?? '');
          if (!Object.prototype.hasOwnProperty.call(props, key)) return undefined;
          const v = props[key];
          if (typeof v === 'boolean') return v ? 1 : 0;
          return v;
        }
        case 'has_property':
        case 'has_actor_property': return Object.prototype.hasOwnProperty.call(props, String(args[0] ?? '')) ? 1 : 0;
        case 'delta_time': return dt;
        case 'life_time': return t + this.warmup;
        case 'time_stamp': return Math.floor((t + this.warmup) * 20);
        case 'frame_alpha': return fa;
        case 'ground_speed': return m.speed;
        case 'modified_move_speed': return (m.walkSpeedO + (m.walkSpeed - m.walkSpeedO) * fa) * m.walkMul;
        case 'modified_distance_moved':
          if (this.distanceModel === 'meters') return m.dist;
          return m.walkPosO + (m.walkPos - m.walkPosO) * fa;
        case 'walk_distance': return m.dist;
        case 'yaw_speed': return this.yawSpeedUnit === 'deg_per_tick' ? m.turn / 20 : m.turn;
        case 'is_moving': return m.speed > 0.01 ? 1 : 0;
        case 'is_on_ground': return 1;
        case 'is_in_water': case 'is_in_water_or_rain': case 'is_in_lava': case 'is_on_fire': case 'is_baby':
        case 'is_sneaking': case 'is_sprinting': case 'is_swimming': case 'is_riding': case 'is_sleeping':
        case 'is_gliding': case 'is_jumping': case 'is_first_person': case 'is_invisible':
          return name === 'is_invisible' && this.json.invisible ? 1 : 0;
        case 'is_alive': return alive ? 1 : 0;
        case 'health': return alive ? 1000 : 0;
        case 'death_ticks': return alive ? 0 : Math.min(20, (t - this.deathTime) * 20);
        case 'target_x_rotation': return Number(sampleSpec(this.look.target_x_rotation, t, 0)) || 0;
        case 'target_y_rotation': return Number(sampleSpec(this.look.target_y_rotation, t, 0)) || 0;
        case 'has_target': return this.look.has_target === undefined ? 1 : Number(sampleSpec(this.look.has_target, t, 1));
        case 'body_y_rotation': return headingMc;
        case 'head_y_rotation': return headingMc + (Number(sampleSpec(this.look.target_y_rotation, t, 0)) || 0);
        case 'head_x_rotation': return Number(sampleSpec(this.look.target_x_rotation, t, 0)) || 0;
        case 'vertical_speed': return 0;
        case 'position': {
          const axis = Math.round(Number(args[0]) || 0);
          if (axis === 0) return m.pos[0];
          if (axis === 1) return 0;
          return m.pos[1];
        }
        case 'variant': case 'mark_variant': case 'skin_id': return 0;
        case 'scale': return this.entityScale;
        default: return undefined;
      }
    };
  }

  // entity transform in three.js world (blocks)
  entityTransform() {
    return { pos: [this.motion.pos[0], 0, this.motion.pos[1]], yawDeg: this.motion.headingDeg, dist: this.motion.dist, speed: this.motion.speed };
  }
}

function normaliseTimeline(tl) {
  if (!tl) return [];
  let arr;
  if (Array.isArray(tl)) arr = tl.map((e) => ({ t: Number(e.t ?? e.time ?? 0), set: e.set || e.props || {} }));
  else arr = Object.entries(tl).map(([k, v]) => ({ t: Number(k), set: v }));
  return arr.sort((a, b) => a.t - b.t);
}

export function loadScenario(fileOrNull, overrides) {
  if (!fileOrNull) return new Scenario({}, overrides);
  if (!fs.existsSync(fileOrNull)) throw new Error(`scenario not found: ${fileOrNull}`);
  return Scenario.fromFile(fileOrNull, overrides);
}
