// Scripted events along the drive. Each event is created when the car reaches
// its beat, updated every frame while it returns true, then disposed.

import * as THREE from 'three';
import { ROAD } from '../config.js';
import { clamp, smoothstep, damp, lerp } from '../core/math.js';
import { createCarModel, createFigure, glow } from './models.js';

const _f = {};
function roadPoint(road, s, d, out = new THREE.Vector3()) {
  const fr = road.sample(s, _f);
  const x = fr.x + fr.rx * d;
  const z = fr.z + fr.rz * d;
  const i = clamp(Math.round(s / ROAD.ds), 0, road.n - 1);
  out.set(x, road.surfaceY(i, d, x, z), z);
  return { pos: out, theta: fr.theta, rx: fr.rx, rz: fr.rz, fx: fr.fx, fz: fr.fz, grade: fr.grade };
}

class Event {
  constructor(ctx, beat) {
    this.ctx = ctx;
    this.beat = beat;
    this.t = 0;
    this.objects = [];
    this.glows = [];
  }

  add(obj) {
    this.ctx.scene.add(obj);
    this.objects.push(obj);
    return obj;
  }

  addGlow(g) {
    this.ctx.lights.eventGlows.push(g);
    this.glows.push(g);
    return g;
  }

  dispose() {
    for (const o of this.objects) this.ctx.scene.remove(o);
    const eg = this.ctx.lights.eventGlows;
    for (const g of this.glows) {
      const i = eg.indexOf(g);
      if (i >= 0) eg.splice(i, 1);
    }
  }
}

/** A car coming the other way with its lights on. */
class Oncoming extends Event {
  constructor(ctx, beat) {
    super(ctx, beat);
    const { car } = ctx;
    this.model = createCarModel({ paint: beat.late ? 0x20262e : 0x7a7c7e, envMap: ctx.envMap });
    this.model.setHeadlights(1);
    this.model.setTail(1);
    this.add(this.model.group);
    this.s = car.s + beat.lead;
    this.v = 23;
    this.sound = false;
    this.spot = ctx.lights.eventSpot;
    this.spot.color.set(0xfff0dc);
    this.spot.angle = 0.42;
    this.spot.penumbra = 0.5;
    this.spot.distance = 140;
    this.heads = [new THREE.Vector3(), new THREE.Vector3()];
    this.dir = new THREE.Vector3();
    this.heads.forEach((p) => this.addGlow({ pos: p, dir: this.dir, color: new THREE.Color(0xfff0dc), intensity: 0, cone: Math.cos(0.5), pen: Math.cos(0.15), range: 90 }));
  }

  update(dt) {
    const { road, car, audio } = this.ctx;
    this.t += dt;
    this.s -= this.v * dt;
    const rp = roadPoint(road, this.s, -1.85);
    const g = this.model.group;
    g.position.copy(rp.pos);
    g.rotation.set(-Math.atan(rp.grade), rp.theta + Math.PI, 0, 'YXZ');
    g.updateMatrixWorld();
    this.heads[0].set(-0.6, 0.74, -2.4).applyMatrix4(g.matrixWorld);
    this.heads[1].set(0.6, 0.74, -2.4).applyMatrix4(g.matrixWorld);
    this.dir.set(-rp.fx, -0.03, -rp.fz).normalize();
    const fadeIn = smoothstep(0, 1.5, this.t);
    this.spot.position.copy(this.heads[0]).lerp(this.heads[1], 0.5);
    this.spot.target.position.copy(this.spot.position).addScaledVector(this.dir, 30);
    this.spot.intensity = 6500 * fadeIn;
    for (const gl of this.glows) gl.intensity = 2600 * fadeIn;
    const rel = this.s - car.s;
    if (!this.sound && rel < 75) {
      audio.passBy({ side: -1, duration: 2.6, loudness: 0.75 });
      this.sound = true;
    }
    return rel > -140;
  }

  dispose() {
    super.dispose();
    this.spot.intensity = 0;
  }
}

/** Animal eyes catching the headlights. One pair sits much too high. */
class Eyeshine extends Event {
  constructor(ctx, beat) {
    super(ctx, beat);
    const { road } = ctx;
    const defs = [
      { s: 70, d: -21, h: 1.05 }, { s: 84, d: -25, h: 0.95 }, { s: 96, d: 23, h: 1.2 },
      { s: 118, d: -18, h: 2.45, high: true }, { s: 130, d: 27, h: 1.1 },
    ];
    this.pairs = defs.map((p) => {
      const rp = roadPoint(road, beat.s + p.s, p.d);
      const group = new THREE.Group();
      group.position.copy(rp.pos).add(new THREE.Vector3(0, p.h, 0));
      const a = glow(p.high ? 0xffe2b8 : 0xd9ffe4, 0.09, 4);
      const b = glow(p.high ? 0xffe2b8 : 0xd9ffe4, 0.09, 4);
      a.position.set(rp.fx * 0.06, 0, rp.fz * 0.06);
      b.position.set(-rp.fx * 0.06, 0, -rp.fz * 0.06);
      group.add(a, b);
      this.add(group);
      return { ...p, group, sprites: [a, b], blink: 0, gone: false };
    });
    const high = this.pairs.find((p) => p.high);
    ctx.witness.add({ id: 'eyes', position: () => high.group.position, radius: 0.6, maxDist: 110, hold: 0.4, active: () => !high.gone && high.vis > 0.2 });
  }

  update(dt) {
    const { car } = this.ctx;
    this.t += dt;
    const inv = new THREE.Matrix4().copy(car.group.matrixWorld).invert();
    let alive = false;
    for (const p of this.pairs) {
      const local = p.group.position.clone().applyMatrix4(inv);
      const dist = local.length();
      const dir = local.clone().normalize();
      const inBeam = smoothstep(0.84, 0.95, -dir.z) * (1 - smoothstep(60, 95, dist));
      if (!p.gone && local.z > -14) p.gone = true; // turned away as we came close
      p.blink -= dt;
      if (p.blink < -2 - Math.random() * 3) p.blink = 0.18;
      const vis = p.gone ? 0 : inBeam * (p.blink > 0 ? 0 : 1);
      p.vis = damp(p.vis || 0, vis, p.gone ? 6 : 14, dt);
      for (const s of p.sprites) s.material.opacity = p.vis;
      if (local.z < 30) alive = true;
    }
    return alive || this.t < 3;
  }

  dispose() {
    super.dispose();
    this.ctx.witness.remove('eyes');
  }
}

/** Three pale lights hovering over the ridge, then gone. */
class StrangeLights extends Event {
  constructor(ctx, beat) {
    super(ctx, beat);
    const { road, car, sky } = ctx;
    const ahead = road.sample(car.s + 650, {});
    this.base = new THREE.Vector3(ahead.x + ahead.rx * 330, car.position.y + 105, ahead.z + ahead.rz * 330);
    this.orbs = [0, 1, 2].map((i) => {
      const s = glow(0xd2ecff, 18, 6);
      s.userData.off = new THREE.Vector3((i - 1) * 32, Math.sin(i * 2.1) * 8, Math.cos(i * 1.7) * 10);
      return this.add(s);
    });
    const dir = this.base.clone().sub(car.position).setY(0).normalize();
    sky.uniforms.uStrangeDir.value.copy(dir);
    this.sky = sky;
    ctx.witness.add({ id: 'lights', position: () => this.base, radius: 60, maxDist: 3000, hold: 0.6, minAngle: 0.09, active: () => this.vis > 0.3 });
    this.vis = 0;
  }

  update(dt) {
    this.t += dt;
    const t = this.t;
    const rise = smoothstep(21, 24, t);
    this.vis = smoothstep(0, 3, t) * (1 - rise);
    this.orbs.forEach((o, i) => {
      const off = o.userData.off;
      o.position.copy(this.base).add(off).add(new THREE.Vector3(Math.sin(t * 0.4 + i) * 6, Math.sin(t * 0.7 + i * 2) * 4 + rise * 400 * (1 + i * 0.3), Math.cos(t * 0.3 + i) * 6));
      const blink = i === 1 ? (Math.sin(t * 5.3) > 0.6 ? 0.25 : 1) : 1;
      o.material.opacity = this.vis * blink;
    });
    this.sky.uniforms.uStrangeGlow.value = this.vis * 0.8;
    return t < 25;
  }

  dispose() {
    super.dispose();
    this.sky.uniforms.uStrangeGlow.value = 0;
    this.ctx.witness.remove('lights');
  }
}

/** An empty car on the shoulder, driver's door open, hazards blinking. */
class AbandonedCar extends Event {
  constructor(ctx, beat) {
    super(ctx, beat);
    const { road } = ctx;
    this.model = createCarModel({ paint: 0x46564a, envMap: ctx.envMap, doorOpen: true });
    const rp = roadPoint(road, beat.at, 5.5);
    const g = this.model.group;
    g.position.copy(rp.pos).add(new THREE.Vector3(0, -0.05, 0));
    g.rotation.set(0.0, rp.theta + 0.1, 0.035, 'YXZ');
    this.add(g);
    g.updateMatrixWorld();
    this.model.setDome(1);
    this.hazPos = [new THREE.Vector3(-0.84, 0.66, 2.32), new THREE.Vector3(0.84, 0.66, 2.32), new THREE.Vector3(-0.84, 0.66, -2.3)]
      .map((v) => v.applyMatrix4(g.matrixWorld));
    this.points = ctx.lights.eventPoints;
    this.points[0].position.copy(this.hazPos[0]);
    this.points[1].position.copy(this.hazPos[1]);
    for (const p of this.points) {
      p.color.set(0xff8a14);
      p.distance = 26;
    }
    this.hazGlows = this.hazPos.map((p) => this.addGlow({ pos: p, color: new THREE.Color(0xff8a14), intensity: 0, range: 30 }));
    this.domeGlow = this.addGlow({ pos: new THREE.Vector3(0, 1.2, 0.2).applyMatrix4(g.matrixWorld), color: new THREE.Color(0xffb060), intensity: 2.5, range: 8 });
    ctx.witness.add({ id: 'car', position: () => g.position, radius: 2.5, maxDist: 160, hold: 0.5 });
    this.at = beat.at;
  }

  update(dt) {
    this.t += dt;
    const on = (this.t * 1.45) % 1 < 0.5 ? 1 : 0;
    const level = on ? 1 : 0.02;
    this.model.setHazard(level);
    this.points.forEach((p) => { p.intensity = 14 * level; });
    this.hazGlows.forEach((g) => { g.intensity = 34 * level; });
    return this.ctx.car.s < this.at + 220;
  }

  dispose() {
    super.dispose();
    this.points.forEach((p) => { p.intensity = 0; });
    this.ctx.witness.remove('car');
  }
}

/** The figure standing at the treeline, head turning to follow the car. */
class Figure extends Event {
  constructor(ctx, beat, { second = false } = {}) {
    super(ctx, beat);
    const { road } = ctx;
    this.second = second;
    this.at = beat.at;
    const d = beat.d ?? (second ? 7.2 : -13.5);
    this.fig = createFigure({ pale: true, height: second ? 2.12 : 2.05 });
    const rp = roadPoint(road, beat.at, d);
    const g = this.fig.group;
    g.position.copy(rp.pos);
    // Face the road, turned slightly toward the oncoming car.
    g.rotation.y = rp.theta + (d < 0 ? -Math.PI / 2 + 0.45 : Math.PI / 2 - 0.45);
    this.add(g);
    this.others = [];
    if (second) {
      // More of them, deeper in the trees: only lightning shows them.
      [[22, 10], [29, -14], [36, 26], [25, 40]].forEach(([dd, ds]) => {
        const f = createFigure({ pale: false, height: 2.0 + Math.random() * 0.25 });
        const p = roadPoint(road, beat.at + ds, dd);
        f.group.position.copy(p.pos);
        f.group.rotation.y = p.theta + Math.PI / 2 - 0.2;
        f.group.visible = false;
        this.add(f.group);
        this.others.push(f);
      });
    }
    this.headWorld = new THREE.Vector3();
    const id = second ? 'figure2' : 'figure';
    ctx.witness.add({ id, position: () => this.headWorld, radius: 0.7, maxDist: 150, hold: 0.45, active: () => g.visible });
    this.id = id;
    this.flickered = false;
    this.struck = false;
  }

  update(dt) {
    const { car, audio, weather } = this.ctx;
    this.t += dt;
    const g = this.fig.group;
    g.updateMatrixWorld();
    this.headWorld.setFromMatrixPosition(this.fig.headPivot.matrixWorld);
    // Head tracks the car.
    const local = car.position.clone().applyMatrix4(new THREE.Matrix4().copy(g.matrixWorld).invert());
    const yaw = clamp(Math.atan2(-local.x, -local.z), -1.3, 1.3);
    this.fig.headPivot.rotation.y = damp(this.fig.headPivot.rotation.y, yaw, 3, dt);
    this.fig.headPivot.rotation.x = -0.08;
    const rel = this.at - car.s;
    if (this.second && !this.struck && rel < 48) {
      this.struck = true;
      weather.strike(0.12);
    }
    if (!this.flickered && rel < 12) {
      this.flickered = true;
      this.ctx.director.flicker(1.7);
      audio.engineFalter(1.3);
      audio.stinger('glitch');
    }
    for (const o of this.others) o.group.visible = weather.lightning > 0.12;
    // Gone once we have passed.
    if (rel < -30) g.visible = false;
    return rel > -160;
  }

  dispose() {
    super.dispose();
    this.ctx.witness.remove(this.id);
  }
}

/** A wall of fog drifting across the road; something walks through it. */
class FogBank extends Event {
  constructor(ctx, beat) {
    super(ctx, beat);
    this.at = beat.at;
    this.drift = -34;
    this.shape = createFigure({ pale: false, height: 2.3 });
    this.add(this.shape.group);
    this.walk = -10;
    this.shapePos = new THREE.Vector3();
    ctx.witness.add({ id: 'fogshape', position: () => this.shapePos, radius: 1.2, maxDist: 90, hold: 0.45, active: () => this.shape.group.visible && this.visible });
    this.visible = false;
  }

  update(dt) {
    const { road, car, director } = this.ctx;
    this.t += dt;
    this.drift += 2.4 * dt;
    const rp = roadPoint(road, this.at, this.drift);
    const fade = smoothstep(0, 4, this.t) * (1 - smoothstep(this.at + 40, this.at + 110, car.s));
    director.fogBank = {
      density: 0.11 * fade,
      center: rp.pos.clone().add(new THREE.Vector3(0, 2, 0)),
      fwd: new THREE.Vector3(rp.fx, 0, rp.fz),
      right: new THREE.Vector3(rp.rx, 0, rp.rz),
      size: new THREE.Vector3(38, 10, 24),
    };
    director.cruiseCap = car.s > this.at - 170 && car.s < this.at + 70 ? 10.5 : 99;
    // The crossing shape, walking slowly from left to right ahead of the car.
    const crossAt = this.at + 8;
    if (car.s > crossAt - 95) {
      this.walk += 1.15 * dt;
      const wp = roadPoint(road, crossAt, this.walk);
      this.shape.group.position.copy(wp.pos);
      this.shape.group.rotation.y = wp.theta - Math.PI / 2;
      this.shape.group.position.y += Math.abs(Math.sin(this.t * 2.2)) * 0.03;
      this.shape.group.visible = this.walk < 11;
      this.visible = true;
    } else {
      this.shape.group.visible = false;
    }
    this.shapePos.copy(this.shape.group.position).add(new THREE.Vector3(0, 1.4, 0));
    return car.s < this.at + 140;
  }

  dispose() {
    super.dispose();
    this.ctx.director.fogBank = null;
    this.ctx.director.cruiseCap = 99;
    this.ctx.witness.remove('fogshape');
  }
}

/** Something dark running alongside the car between the trees. */
class Runner extends Event {
  constructor(ctx, beat) {
    super(ctx, beat);
    this.fig = createFigure({ pale: false, height: 2.25 });
    this.add(this.fig.group);
    this.pos = new THREE.Vector3();
    ctx.witness.add({ id: 'runner', position: () => this.pos, radius: 1.6, maxDist: 80, hold: 0.4, active: () => this.t > 1 && this.t < 11 });
  }

  update(dt) {
    const { road, car } = this.ctx;
    this.t += dt;
    const t = this.t;
    const lead = t < 6 ? lerp(42, 9, smoothstep(0, 6, t)) : lerp(9, -45, smoothstep(6, 12, t));
    const d = 16.5 + Math.sin(t * 0.9) * 2;
    const rp = roadPoint(road, car.s + lead, d);
    const g = this.fig.group;
    g.position.copy(rp.pos);
    g.position.y += Math.abs(Math.sin(t * 7.5)) * 0.18;
    g.rotation.set(-0.32, rp.theta, Math.sin(t * 7.5) * 0.06, 'YXZ');
    this.pos.copy(g.position).add(new THREE.Vector3(0, 1.3, 0));
    return t < 12.5;
  }

  dispose() {
    super.dispose();
    this.ctx.witness.remove('runner');
  }
}

/** Headlights far behind us, closing in... then switched off. */
class Following extends Event {
  constructor(ctx, beat) {
    super(ctx, beat);
    this.sprites = [glow(0xfff1d8, 1.1, 5), glow(0xfff1d8, 1.1, 5)];
    this.sprites.forEach((s) => this.add(s));
    this.pos = [new THREE.Vector3(), new THREE.Vector3()];
    this.dir = new THREE.Vector3();
    this.pos.forEach((p) => this.addGlow({ pos: p, dir: this.dir, color: new THREE.Color(0xfff1d8), intensity: 0, cone: Math.cos(0.55), pen: Math.cos(0.2), range: 70 }));
    this.mid = new THREE.Vector3();
    ctx.witness.add({ id: 'follow', position: () => this.mid, radius: 3, maxDist: 400, hold: 0.5, mirror: true, active: () => this.level > 0.4 });
    this.level = 0;
  }

  update(dt) {
    const { road, car } = this.ctx;
    this.t += dt;
    const t = this.t;
    const gap = lerp(290, 95, smoothstep(0, 22, t));
    this.level = smoothstep(0, 2, t) * (1 - smoothstep(24, 24.4, t));
    const s = car.s - gap;
    for (let i = 0; i < 2; i++) {
      const rp = roadPoint(road, s, 1.75 + (i ? 0.62 : -0.62), this.pos[i]);
      this.pos[i].y += 0.72;
      this.dir.set(rp.fx, -0.03, rp.fz);
      this.sprites[i].position.copy(this.pos[i]);
      this.sprites[i].material.opacity = this.level;
    }
    this.mid.copy(this.pos[0]).lerp(this.pos[1], 0.5);
    for (const g of this.glows) g.intensity = 1500 * this.level;
    return t < 26;
  }

  dispose() {
    super.dispose();
    this.ctx.witness.remove('follow');
  }
}

/** The driver adjusts the mirror. For a moment, you are not alone back here. */
class MirrorGhost extends Event {
  constructor(ctx, beat) {
    super(ctx, beat);
    this.mirror = ctx.car.mirror;
    this.ghost = ctx.car.ghost;
    this.baseYaw = this.mirror.anchor.rotation.y;
    this.mirrorPos = new THREE.Vector3();
    this.seenAt = -1;
    ctx.witness.add({
      id: 'ghost', position: () => this.mirrorPos, radius: 0.12, maxDist: 3, hold: 0.35,
      active: () => this.ghost.visible,
      onSeen: () => { this.seenAt = this.t; },
    });
    ctx.car.driver.look('mirror', 1.8);
  }

  update(dt) {
    const { car, audio } = this.ctx;
    this.t += dt;
    const t = this.t;
    const adjust = smoothstep(0.6, 1.9, t) * (1 - smoothstep(15, 16.5, t));
    this.mirror.anchor.rotation.y = lerp(this.baseYaw, -0.02, adjust);
    car.driver.stare = smoothstep(2, 3.2, t) * (1 - smoothstep(14, 15, t));
    this.mirror.glass.getWorldPosition(this.mirrorPos);
    const show = t > 3.2 && t < 13 && (this.seenAt < 0 || t - this.seenAt < 0.9);
    if (show && !this.ghost.visible) audio.stinger('swell');
    if (!show && this.ghost.visible && this.seenAt >= 0) {
      audio.stinger('glitch');
      this.ctx.director.flicker(0.6);
    }
    this.ghost.visible = show;
    return t < 17;
  }

  dispose() {
    super.dispose();
    this.ghost.visible = false;
    this.mirror.anchor.rotation.y = this.baseYaw;
    this.ctx.car.driver.stare = 0;
    this.ctx.witness.remove('ghost');
  }
}

/** The same distance sign again; the navigation loses its fix. */
class RepeatSign extends Event {
  constructor(ctx, beat) {
    super(ctx, beat);
    const rp = roadPoint(ctx.road, beat.at, 6.8);
    this.pos = rp.pos.clone().add(new THREE.Vector3(0, 2.6, 0));
    ctx.witness.add({ id: 'sign', position: () => this.pos, radius: 1.4, maxDist: 150, hold: 0.5 });
    ctx.director.gpsLost = true;
    this.at = beat.at;
  }

  update() {
    return this.ctx.car.s < this.at + 60;
  }

  dispose() {
    this.ctx.witness.remove('sign');
  }
}

/** A row of streetlights that die as the car approaches each one. */
class LightsDie extends Event {
  constructor(ctx, beat) {
    super(ctx, beat);
    this.items = [0, 1, 2, 3, 4].map((i) => ({ entry: ctx.schedule.get(`die-${i}`), state: 0, t: 0 }));
  }

  update(dt) {
    const { car, audio } = this.ctx;
    let last = 0;
    for (const it of this.items) {
      const lamp = it.entry?.lamps?.[0];
      last = Math.max(last, it.entry.s);
      if (!lamp) continue;
      if (it.state === 0 && car.s > it.entry.s - 85) {
        it.state = 1;
        lamp.flicker = 'dying';
        audio.stinger('glitch');
      } else if (it.state === 1) {
        it.t += dt;
        if (it.t > 0.7) {
          lamp.enabled = false;
          it.state = 2;
        }
      }
    }
    return car.s < last + 40;
  }
}

export function createEvent(ctx, beat) {
  switch (beat.type) {
    case 'oncoming': return new Oncoming(ctx, beat);
    case 'eyeshine': return new Eyeshine(ctx, beat);
    case 'strangeLights': return new StrangeLights(ctx, beat);
    case 'abandonedCar': return new AbandonedCar(ctx, beat);
    case 'figure': return new Figure(ctx, beat);
    case 'figure2': return new Figure(ctx, beat, { second: true });
    case 'fogBank': return new FogBank(ctx, beat);
    case 'runner': return new Runner(ctx, beat);
    case 'following': return new Following(ctx, beat);
    case 'mirrorGhost': return new MirrorGhost(ctx, beat);
    case 'repeatSign': return new RepeatSign(ctx, beat);
    case 'lightsDie': return new LightsDie(ctx, beat);
    default: return null;
  }
}
