// Runs the journey: environment curves, story beats, events, captions, the
// dashboard clock, cinematic grading, audio state and the ending.

import * as THREE from 'three';
import { JOURNEY, ENV, BEATS, WITNESS_LIST } from './Journey.js';
import { track, clamp, damp, smoothstep, lerp } from '../core/math.js';
import { createEvent } from './events.js';

const RANDOM_EVENTS = ['oncoming', 'eyeshine', 'figure', 'runner', 'following', 'fogBank', 'strangeLights', 'abandonedCar'];

export class Director {
  constructor(ctx) {
    this.ctx = ctx;
    ctx.director = this;
    this.started = false;
    this.ended = false;
    this.endless = false;
    this.beatIndex = 0;
    this.events = [];
    this.fogBank = null;
    this.cruiseCap = 99;
    this.gpsLost = false;
    this.clockOffset = 0;
    this.elapsed = 0;
    this.flickerT = 0;
    this.arriving = false;
    this.stopTimer = 0;
    this.windOffset = new THREE.Vector3();
    this.nextLightning = 25;
    this.veil = 0;
    this.veilTarget = 0;
    this.nextVeil = 10;
    this.endlessTimer = 40;
    this.endlessEnv = 0;
    this.focus = 18;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.layers.enableAll();
    this.focusTimer = 0;
    this.interiorFocus = null;
    this.env = {
      tau: 0, rain: 0, dread: 0, insects: 1, fog: 0.005, clouds: 0.3, interference: 0, town: 0.1,
    };
    this.fogParams = {
      density: 0.005,
      heightFall: 0.075,
      noise: 0.75,
      windOffset: this.windOffset,
      maxDist: 230,
      bank: { density: 0 },
      headScatter: 1,
      moonScatter: 1,
      ambient: new THREE.Vector3(0.0016, 0.0022, 0.0036),
    };
  }

  get progress() {
    return clamp((this.ctx.car.s - JOURNEY.start) / JOURNEY.length, 0, 1);
  }

  start() {
    this.started = true;
    this.ctx.ui.titleCard('00:13', 'Route 9, north of Marrow Creek');
  }

  /** Dashboard and headlights stutter for `duration` seconds. */
  flicker(duration) {
    this.flickerT = Math.max(this.flickerT, duration);
  }

  clockText() {
    const minutes = JOURNEY.clockStart + (this.elapsed / 60) * JOURNEY.clockRate + this.clockOffset;
    const h = Math.floor(minutes / 60) % 24;
    const m = Math.floor(minutes % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  _beat(beat) {
    const { ui, audio } = this.ctx;
    switch (beat.type) {
      case 'caption':
        ui.caption(beat.text, 6);
        return;
      case 'clockJump':
        this.clockOffset += 94;
        this.gpsLost = false;
        this.flicker(1.2);
        audio.stinger('glitch');
        return;
      case 'arrive':
        this.arriving = true;
        return;
      default: {
        const ev = createEvent(this.ctx, beat);
        if (ev) this.events.push(ev);
      }
    }
  }

  _spawnRandom() {
    const car = this.ctx.car;
    const type = RANDOM_EVENTS[Math.floor(Math.random() * RANDOM_EVENTS.length)];
    const s = car.s;
    const beat = { type, s, at: s + 220, lead: 400, d: Math.random() < 0.5 ? -13 : 9 };
    if (this.events.some((e) => e.beat.type === type)) return;
    const ev = createEvent(this.ctx, beat);
    if (ev) this.events.push(ev);
  }

  continueEndless() {
    this.endless = true;
    this.ended = false;
    this.arriving = false;
    this.stopTimer = 0;
    this.endlessTimer = 25;
    this.ctx.pipeline.look.fade = 0;
  }

  update(dt) {
    const ctx = this.ctx;
    const { car, weather, sky, pipeline, audio, ui, witness, lights } = ctx;
    if (this.started && !this.ended) this.elapsed += dt;
    let tau = this.progress;
    const E = this.env;
    if (this.endless) {
      // Slowly cycle between calm and the worst of the night.
      this.endlessEnv += dt / 240;
      tau = 0.3 + 0.45 * (0.5 - 0.5 * Math.cos(this.endlessEnv * Math.PI * 2));
    }
    E.tau = tau;
    E.fog = track(ENV.fog, tau);
    E.rain = track(ENV.rain, tau);
    E.clouds = track(ENV.clouds, tau);
    E.dread = track(ENV.dread, tau);
    E.insects = track(ENV.insects, tau);
    E.interference = track(ENV.interference, tau);
    E.town = this.endless ? 0.1 : track(ENV.town, tau);
    if (!this.started) {
      E.dread = 0;
      E.interference = 0;
    }

    // Story beats.
    if (this.started && !this.endless) {
      while (this.beatIndex < BEATS.length && car.s >= BEATS[this.beatIndex].s) {
        this._beat(BEATS[this.beatIndex]);
        this.beatIndex++;
      }
    }
    if (this.endless) {
      this.endlessTimer -= dt;
      if (this.endlessTimer <= 0) {
        this._spawnRandom();
        this.endlessTimer = 45 + Math.random() * 60;
      }
    }
    this.events = this.events.filter((e) => {
      const alive = e.update(dt);
      if (!alive) e.dispose();
      return alive;
    });

    // Cruise speed.
    let cruise = this.started ? track(ENV.cruise, tau) : 0;
    if (this.endless) cruise = 20;
    cruise = Math.min(cruise, this.cruiseCap, 23 - weather.rainLevel * 3.5);
    if (this.arriving && !this.endless) {
      const left = JOURNEY.stopAt - car.s;
      cruise = Math.min(cruise, Math.max(0, left * 0.22));
      car.laneBias = lerp(car.laneBias || 0, 1.6, smoothstep(160, 30, left));
      if (left < 2 || car.v < 0.25) this.stopTimer += dt;
      if (this.stopTimer > 2.2 && !this.ended) {
        this.ended = true;
        audio.stinger('arrival');
        ui.caption('Hollow Pines. 02:58.', 5);
        setTimeout(() => ui.showEnd(this.summary()), 3200);
      }
    } else if (this.endless) {
      car.laneBias = damp(car.laneBias || 0, 0, 0.5, dt);
    }
    this.cruise = cruise;

    // Wind, fog and weather.
    const gust = 0.5 + 0.5 * Math.sin(this.elapsed * 0.13) * Math.sin(this.elapsed * 0.071);
    const wind = new THREE.Vector2(0.55 + gust * 0.6, 0.25);
    this.windOffset.x += wind.x * dt * 0.0045;
    this.windOffset.z += wind.y * dt * 0.0045;
    this.windOffset.y += dt * 0.0012;
    const fp = this.fogParams;
    fp.density = E.fog;
    fp.noise = 0.65 + E.dread * 0.25;
    fp.bank = this.fogBank || { density: 0 };
    fp.headScatter = 1.0;
    fp.moonScatter = 1.0;
    fp.maxDist = 230;
    fp.ambient.set(0.0012, 0.0017, 0.0028).multiplyScalar(1 + E.town * 0.8);
    if (E.town > 0.3) fp.ambient.add(new THREE.Vector3(0.0016, 0.0009, 0.0004).multiplyScalar(E.town));

    // Clouds drifting over the moon now and then; more often as the night turns.
    this.nextVeil -= dt;
    if (this.nextVeil <= 0) {
      this.veilTarget = this.veilTarget > 0.5 ? 0 : Math.min(1, 0.4 + E.clouds * 0.6);
      this.nextVeil = this.veilTarget > 0.5 ? 10 + Math.random() * 18 : 14 + Math.random() * 30 * (1 - E.clouds);
    }
    this.veil = damp(this.veil, Math.max(this.veilTarget, smoothstep(0.85, 1, E.clouds) * 0.7), 0.35, dt);
    sky.uniforms.uCloudCover.value = E.clouds;
    sky.uniforms.uMoonVeil.value = this.veil;
    sky.uniforms.uTownGlow.value = E.town;
    const townDir = car.road.sample(car.s + 900, {});
    sky.uniforms.uTownDir.value.set(townDir.x - car.position.x, 0, townDir.z - car.position.z).normalize();
    sky.setHaze(E.fog * 30);

    // Lightning in the heavy rain.
    if (this.started && weather.rainLevel > 0.6) {
      this.nextLightning -= dt;
      if (this.nextLightning <= 0) {
        weather.strike(0.4 + Math.random() * 0.6);
        this.nextLightning = 14 + Math.random() * 26;
      }
    }

    // Electrical flicker.
    if (this.flickerT > 0) {
      this.flickerT -= dt;
      const r = Math.random();
      car.dashFlicker = r < 0.35 ? 0.05 : r < 0.6 ? 0.5 : 1;
      car.lightsFlicker = Math.random() < 0.25 ? 0.25 : 0.9 + Math.random() * 0.1;
    } else {
      car.dashFlicker = 1;
      car.lightsFlicker = 1;
    }

    // Dashboard.
    const route = [];
    const inv = new THREE.Matrix4().copy(car.group.matrixWorld).invert();
    const v = new THREE.Vector3();
    for (let k = -20; k <= 340; k += 20) {
      const p = car.road.sample(car.s + k, {});
      v.set(p.x, car.position.y, p.z).applyMatrix4(inv);
      route.push([v.x, -v.z]);
    }
    const milesLeft = Math.max(0, 41 * (1 - tau) - (tau > 0.55 && tau < 0.86 ? -2 : 0));
    car.dash.update(dt, {
      speed: car.v,
      rpm: car.telemetry.rpm,
      clock: this.clockText(),
      temp: 7 - E.rain * 2,
      dest: this.endless ? 0 : milesLeft,
      route,
      radio: audio.radioLabel || '96.4 FM · NIGHT DRIVE',
      glitch: Math.max(this.flickerT > 0 ? 0.8 : 0, this.gpsLost ? 0.15 : 0, E.interference > 0.7 ? (E.interference - 0.7) : 0),
      gpsLost: this.gpsLost,
    });

    // Cinematic grade follows the mood.
    const L = pipeline.look;
    L.exposure = damp(L.exposure, 1.65 - E.dread * 0.15 + E.town * 0.1, 1, dt);
    L.grain = 0.03 + E.dread * 0.035;
    L.saturation = 0.9 - E.dread * 0.22;
    L.vignette = 0.5 + E.dread * 0.25;
    L.chroma = 0.01 + E.dread * 0.012;
    L.flash = weather.lightning * 0.6;

    // Autofocus: whatever you are studying, else the cabin, else the road.
    this.focusTimer -= dt;
    if (this.focusTimer <= 0) {
      this.focusTimer = 0.1;
      this.interiorFocus = this._interiorHit();
    }
    let focus = 16;
    if (witness.current) focus = witness.current.dist;
    else if (this.interiorFocus) focus = this.interiorFocus;
    this.focus = damp(this.focus, focus, 5, dt);
    L.focus = this.focus;

    // Audio.
    audio.update(dt, {
      speed: car.v,
      rpm: car.telemetry.rpm,
      throttle: car.telemetry.throttle,
      rain: weather.rainLevel,
      wetness: weather.wetness,
      windowOpen: car.windowOpen || 0,
      dread: E.dread,
      insects: E.insects,
      gust,
      radioInterference: E.interference,
      fog: clamp(E.fog * 40, 0, 1),
      muffle: this.fogBank ? clamp(this.fogBank.density * 4, 0, 0.6) : 0,
    });
    void lights;
  }

  _interiorHit() {
    const { camera, car } = this.ctx;
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    this.raycaster.far = 3;
    const hits = this.raycaster.intersectObject(car.interior.group, true);
    for (const h of hits) {
      if (h.object.material && h.object.material.colorWrite === false) continue;
      return Math.max(0.25, h.distance);
    }
    return null;
  }

  summary() {
    const seen = this.ctx.witness.seen;
    return {
      items: WITNESS_LIST.map((w) => ({ ...w, seen: seen.has(w.id) })),
      count: WITNESS_LIST.filter((w) => seen.has(w.id)).length,
      total: WITNESS_LIST.length,
      time: this.elapsed,
    };
  }
}
