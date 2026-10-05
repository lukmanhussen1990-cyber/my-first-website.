// Night Passenger — entry point: builds the world, runs the loop, wires input,
// audio and the overlays together.

import * as THREE from 'three';
import { QUALITY, CAR } from './config.js';
import { U } from './world/shared.js';
import { Road } from './world/Road.js';
import { World } from './world/World.js';
import { Sky } from './world/Sky.js';
import { Lights } from './world/Lights.js';
import { Weather } from './world/Weather.js';
import { CarRig } from './car/CarRig.js';
import { createNightEnvironment } from './car/materials.js';
import { Pipeline } from './render/Pipeline.js';
import { Director } from './game/Director.js';
import { Witness } from './game/Witness.js';
import { Input } from './game/Input.js';
import { UI } from './game/UI.js';
import { buildSchedule, JOURNEY, WITNESS_LIST } from './game/Journey.js';

/** Silent stand-in so the game still runs where Web Audio is unavailable. */
class SilentAudio {
  get ready() { return false; }
  get radioLabel() { return '96.4 FM · NIGHT DRIVE'; }
  async start() {}
  setPaused() {}
  setMasterVolume() {}
  update() {}
  bump() {}
  wiperStroke() {}
  thunder() {}
  passBy() {}
  stinger() {}
  engineFalter() {}
  windowMotor() {}
  click() {}
  radioPower() {}
  radioNext() { return 'OFF'; }
  setBuzz() {}
}

async function createAudio() {
  try {
    const mod = await import('./audio/AudioEngine.js');
    return new mod.AudioEngine();
  } catch (err) {
    console.warn('Audio engine unavailable, continuing silently.', err);
    return new SilentAudio();
  }
}

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

class Game {
  constructor(canvas, ui, qualityName, seed) {
    this.canvas = canvas;
    this.ui = ui;
    this.qualityName = qualityName;
    this.q = QUALITY[qualityName];
    this.seed = seed;
    this.state = 'loading';
    this.renderScale = 1;
    this.frameTimes = [];
    this.lastAdjust = 0;
    this.muted = false;
    this.volume = Number(UI.load('np-volume', 0.85));
  }

  async init() {
    const { ui, q } = this;
    ui.progress(0.05, 'Warming up the engine…');
    const renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
    if (!renderer.capabilities.isWebGL2) throw new Error('This drive needs WebGL 2, which this browser or device does not provide.');
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.autoClear = true;
    renderer.setClearColor(0x000000, 1);
    this.renderer = renderer;

    const scene = new THREE.Scene();
    this.scene = scene;
    const camera = new THREE.PerspectiveCamera(56, 16 / 9, 0.05, 4000);
    this.camera = camera;

    await nextFrame();
    ui.progress(0.15, 'Drawing the road…');
    const road = new Road(this.seed);
    road.ensure(JOURNEY.stopAt + 1500);
    this.road = road;
    const schedule = buildSchedule(this.seed);
    this.schedule = schedule;

    await nextFrame();
    ui.progress(0.25, 'Raising the moon…');
    const sky = new Sky(scene, this.seed);
    this.sky = sky;
    const lights = new Lights(scene, q, sky);
    this.lights = lights;
    const envMap = createNightEnvironment(renderer, sky.moonDir);

    await nextFrame();
    ui.progress(0.35, 'Climbing into the back seat…');
    const car = new CarRig({ scene, road, quality: q, envMap, camera });
    car.s = JOURNEY.start;
    this.car = car;

    await nextFrame();
    ui.progress(0.45, 'Growing the forest…');
    const world = new World({ scene, road, quality: q, schedule });
    this.world = world;
    car.update(0.016, { cruise: 0 });
    for (let i = 0; i < 8; i++) {
      world.update(car.s, 60);
      ui.progress(0.45 + i * 0.04);
      await nextFrame();
    }
    world.prime(car.s);

    this.weather = new Weather(scene, car, q);
    this.pipeline = new Pipeline(renderer, scene, camera, q, { car, lights });
    this.witness = new Witness(camera, (out) => car.mirror.glass.getWorldPosition(out));
    this.audio = await createAudio();

    this.ctx = {
      scene, road, car, lights, sky, weather: this.weather, audio: this.audio, witness: this.witness,
      pipeline: this.pipeline, envMap, ui, schedule, camera,
    };
    this.director = new Director(this.ctx);
    this.input = new Input(this.canvas, { onAction: (a) => this.action(a) });
    this.input.sensitivity = Number(UI.load('np-sens', 1));
    this.input.invertY = UI.load('np-invert', '0') === '1';

    // Sound hooks.
    car.onBump = (s) => this.audio.bump(s);
    car.wipers.onStroke = (d) => this.audio.wiperStroke(d * 0.5);
    this.weather.onThunder = (d) => this.audio.thunder(d);
    this.witness.onSeen = (id) => {
      const item = WITNESS_LIST.find((w) => w.id === id);
      if (item) this.ui.note(item.label);
      this.audio.stinger('notice');
    };

    this.resize();
    window.addEventListener('resize', () => this.resize());

    ui.progress(0.9, 'Compiling shaders…');
    await nextFrame();
    this.update(0.016);
    this.pipeline.render(this.renderCtx());
    await nextFrame();
    ui.progress(1, 'Ready.');
    this.state = 'title';
    this.last = performance.now();
    // ?debug stops the loop so frames can be stepped and captured one at a time.
    this.debug = new URLSearchParams(location.search).has('debug');
    if (!this.debug) this.renderer.setAnimationLoop((t) => this.tick(t));
  }

  /** Debug: advance the simulation without rendering. */
  step(dt = 1 / 30, frames = 1) {
    for (let i = 0; i < frames; i++) this.update(dt);
  }

  /** Debug: render one frame and return it as a data URL. `free` = { pos, look } in car space. */
  snap(free = null) {
    const cam = this.camera;
    if (free) {
      const toWorld = (v) => new THREE.Vector3(...v).applyMatrix4(this.car.group.matrixWorld);
      this.car.headPivot.remove(cam);
      this.scene.add(cam);
      cam.position.copy(toWorld(free.pos));
      cam.up.set(0, 1, 0);
      cam.lookAt(toWorld(free.look));
      cam.updateMatrixWorld();
    }
    this.pipeline.render(this.renderCtx());
    const url = this.canvas.toDataURL('image/jpeg', 0.9);
    if (free) {
      this.scene.remove(cam);
      this.car.headPivot.add(cam);
      cam.position.set(0, 0, 0);
      cam.rotation.set(this.input.pitch, this.input.yaw, 0);
    }
    return url;
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const pr = Math.min(window.devicePixelRatio || 1, 2) * this.q.pixelRatio * this.renderScale;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.camera.aspect = w / h;
    // Keep a sensible horizontal field of view on tall screens.
    this.camera.fov = w / h < 1 ? 70 : 56;
    this.camera.updateProjectionMatrix();
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.pipeline.setSize(size.x, size.y);
  }

  renderCtx() {
    const car = this.car;
    return {
      groundY: car.position.y,
      moonDir: this.sky.moonDir,
      speed: car.v,
      wetGlass: 1,
      dashReflect: 0.4 * car.dashFlicker,
      fog: this.director.fogParams,
    };
  }

  begin() {
    if (this.state !== 'title') return;
    this.state = 'playing';
    this.audio.start().then(() => this.audio.setMasterVolume(this.volume)).catch(() => {});
    this.director.start();
    this.input.enabled = true;
    this.input.requestLock();
    this.ui.show(null);
    setTimeout(() => this.ui.hint('Move the mouse to look around  ·  Q / E to lean  ·  W to lean forward', 8), 5800);
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.enabled = false;
    this.input.releaseLock();
    this.audio.setPaused(true);
    this.ui.show('pause');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.input.enabled = true;
    this.input.requestLock();
    this.audio.setPaused(false);
    this.ui.show(null);
    this.last = performance.now();
  }

  action(a) {
    const { ui, audio, car } = this;
    if (a === 'unlock' || a === 'pause') {
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused' && a === 'pause') this.resume();
      return;
    }
    if (this.state !== 'playing') return;
    switch (a) {
      case 'radio': {
        const label = audio.radioNext();
        audio.click();
        ui.toast(label);
        break;
      }
      case 'window':
        car.windowTarget = car.windowTarget > 0.5 ? 0 : 1;
        audio.windowMotor(1.6);
        ui.toast(car.windowTarget ? 'Window down' : 'Window up');
        break;
      case 'captions':
        ui.setCaptions(!ui.captionsOn);
        ui.toast(ui.captionsOn ? 'Captions on' : 'Captions off');
        break;
      case 'hud':
        ui.toggleHud();
        break;
      case 'mute':
        this.muted = !this.muted;
        audio.setMasterVolume(this.muted ? 0 : this.volume);
        ui.toast(this.muted ? 'Sound off' : 'Sound on');
        break;
      case 'fullscreen':
        if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
        else document.exitFullscreen?.();
        break;
      default:
    }
  }

  setVolume(v) {
    this.volume = v;
    UI.save('np-volume', v);
    if (!this.muted) this.audio.setMasterVolume(v);
  }

  update(dt) {
    const { car, director, world, lights, weather, sky, input, witness } = this;
    U.uTime.value += dt;
    input.update(dt);
    car.setLook(input.yaw, input.pitch);
    car.setLean(input.leanX, input.leanY);
    director.update(dt);
    car.update(dt, { cruise: director.cruise });
    world.update(car.s, 3);
    car.group.updateMatrixWorld(true);

    // Shared uniforms for retro-reflectors and the road.
    const h0 = car.headlights[0].getWorldPosition(new THREE.Vector3());
    const h1 = car.headlights[1].getWorldPosition(new THREE.Vector3());
    U.uHeadPos.value.copy(h0).lerp(h1, 0.5);
    U.uHeadDir.value.copy(car.forward);
    U.uHeadOn.value = car.lightsFlicker;
    U.uCarPos.value.copy(car.position);

    lights.update(dt, {
      carPos: car.position,
      carForward: U.uHeadDir.value,
      worldLamps: world.lamps,
      cloudVeil: director.veil,
      lightning: weather.lightning,
    });
    const near = lights.street.map((s) => s.lamp).filter(Boolean);
    weather.update(dt, { rain: director.env.rain, wind: new THREE.Vector2(0.6, 0.25), lamps: near });
    car.wipers.setModeForRain(weather.rainLevel);
    const camPos = this.camera.getWorldPosition(new THREE.Vector3());
    sky.update({ position: camPos }, car.position.y - 20);
    witness.update(dt);
    this._updateWindowPane();
    this._updateBuzz();
  }

  _updateWindowPane() {
    // The open rear window slides down into the door.
    const pane = this.pipeline.comp.u;
    const base = CAR.panes.rearRight.corners;
    const drop = this.car.windowOpen * 0.34;
    pane.uPane.value[4 * 4 + 2].set(base[2][0], base[2][1] - drop, base[2][2]);
    pane.uPane.value[4 * 4 + 3].set(base[3][0], base[3][1] - drop, base[3][2]);
    pane.uPaneInfo.value[4].w = this.car.windowOpen > 0.97 ? 0 : 1;
  }

  _updateBuzz() {
    // The failing sodium lamp hums and crackles as we pass under it.
    let level = 0;
    let pan = 0;
    const car = this.car;
    for (const lamp of this.world.lamps) {
      if (lamp.flicker !== 'erratic' && lamp.flicker !== 'dying') continue;
      const d = lamp.pos.distanceTo(car.position);
      if (d > 70) continue;
      const k = (1 - d / 70) * lamp.level;
      if (k > level) {
        level = k;
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(car.group.quaternion);
        pan = Math.max(-1, Math.min(1, lamp.pos.clone().sub(car.position).normalize().dot(right)));
      }
    }
    this.audio.setBuzz(level, pan);
  }

  _adapt(dt) {
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 90) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes.length = 0;
    const now = performance.now();
    if (now - this.lastAdjust < 2500) return;
    let next = this.renderScale;
    if (avg > 1 / 42) next = Math.max(0.5, this.renderScale * 0.88);
    else if (avg < 1 / 75 && this.renderScale < 1) next = Math.min(1, this.renderScale * 1.08);
    if (Math.abs(next - this.renderScale) > 0.01) {
      this.renderScale = next;
      this.lastAdjust = now;
      this.resize();
    }
  }

  tick(now) {
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    if (this.state !== 'paused') this.update(dt);
    this.pipeline.render(this.renderCtx());
    if (this.state === 'playing') this._adapt(dt);
  }
}

function pickQuality() {
  const saved = UI.load('np-quality', null);
  if (saved && QUALITY[saved]) return saved;
  const touch = (navigator.maxTouchPoints || 0) > 1 && window.innerWidth < 1100;
  return touch ? 'low' : 'high';
}

function wireOverlays(game, ui) {
  const qButtons = document.querySelectorAll('[data-q]');
  const markQuality = () => qButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.q === game.qualityName)));
  markQuality();
  qButtons.forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.q === game.qualityName) return;
    UI.save('np-quality', b.dataset.q);
    // Lights and shadows are baked into the shaders, so a fresh start applies it cleanly.
    location.reload();
  }));
  document.getElementById('btn-start').addEventListener('click', () => game.begin());
  document.getElementById('btn-resume').addEventListener('click', () => game.resume());
  document.getElementById('btn-restart').addEventListener('click', () => location.reload());
  document.getElementById('btn-again').addEventListener('click', () => {
    UI.save('np-seed', String((Math.random() * 1e6) | 0));
    location.reload();
  });
  document.getElementById('btn-endless').addEventListener('click', () => {
    game.director.continueEndless();
    game.state = 'playing';
    game.input.enabled = true;
    game.input.requestLock();
    ui.show(null);
  });
  const vol = document.getElementById('opt-volume');
  vol.value = String(game.volume);
  vol.addEventListener('input', () => game.setVolume(Number(vol.value)));
  const sens = document.getElementById('opt-sens');
  sens.value = String(game.input.sensitivity);
  sens.addEventListener('input', () => {
    game.input.sensitivity = Number(sens.value);
    UI.save('np-sens', sens.value);
  });
  const inv = document.getElementById('opt-invert');
  inv.checked = game.input.invertY;
  inv.addEventListener('change', () => {
    game.input.invertY = inv.checked;
    UI.save('np-invert', inv.checked ? '1' : '0');
  });
  const cap = document.getElementById('opt-captions');
  cap.checked = ui.captionsOn;
  cap.addEventListener('change', () => ui.setCaptions(cap.checked));
  // Ending hands control back.
  const origShowEnd = ui.showEnd.bind(ui);
  ui.showEnd = (summary) => {
    game.state = 'end';
    game.input.enabled = false;
    game.input.releaseLock();
    origShowEnd(summary);
  };
}

async function start() {
  const ui = new UI();
  const canvas = document.getElementById('view');
  try {
    if (document.fonts && document.fonts.load) {
      await Promise.race([
        Promise.all([
          document.fonts.load('700 64px "Overpass"'),
          document.fonts.load('600 32px "Overpass Mono"'),
        ]),
        new Promise((r) => setTimeout(r, 2500)),
      ]);
    }
    const seed = Number(UI.load('np-seed', 1)) || 1;
    const game = new Game(canvas, ui, pickQuality(), seed);
    await game.init();
    wireOverlays(game, ui);
    ui.hideLoading();
    ui.show('title');
    window.__game = game;
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      ui.showError('The graphics context was lost. Reload the page to continue the drive.');
    });
  } catch (err) {
    console.error(err);
    ui.showError(err && err.message ? err.message : String(err));
  }
}

const hot = window.claude && window.claude.hot;
if (hot && hot.ready) hot.ready(() => start());
else start();
