/**
 * Input abstraction: keyboard, gamepad and on-screen touch controls all feed
 * the same per-controller shape so the game never asks where a press came from.
 */

import { clamp, normalise } from './math.js';

class Button {
  constructor() {
    this.down = false;
    this.pressed = false; // went down this frame
    this.released = false; // came up this frame
    this.heldFor = 0; // seconds
    this.heldOnRelease = 0; // how long it was held, sampled at release
  }

  set(down, dt) {
    if (down && !this.down) {
      this.pressed = true;
      this.heldFor = 0;
    } else if (!down && this.down) {
      this.released = true;
      this.heldOnRelease = this.heldFor;
    }
    this.down = down;
    if (down) this.heldFor += dt;
    else this.heldFor = 0;
  }

  clearEdges() {
    this.pressed = false;
    this.released = false;
  }
}

export class Controller {
  constructor(name) {
    this.name = name;
    this.x = 0;
    this.y = 0;
    this.pass = new Button();
    this.shoot = new Button();
    this.through = new Button();
    this.sprint = new Button();
  }

  get buttons() {
    return [this.pass, this.shoot, this.through, this.sprint];
  }

  get hasDirection() {
    return Math.abs(this.x) > 0.15 || Math.abs(this.y) > 0.15;
  }

  clearEdges() {
    for (const b of this.buttons) b.clearEdges();
  }

  reset() {
    this.x = 0;
    this.y = 0;
    for (const b of this.buttons) {
      b.down = false;
      b.heldFor = 0;
      b.clearEdges();
    }
  }
}

const KEYMAP = [
  {
    up: ['KeyW'],
    down: ['KeyS'],
    left: ['KeyA'],
    right: ['KeyD'],
    // Arrow keys double up for player one so either hand position works.
    altUp: ['ArrowUp'],
    altDown: ['ArrowDown'],
    altLeft: ['ArrowLeft'],
    altRight: ['ArrowRight'],
    pass: ['Space'],
    shoot: ['KeyF', 'KeyJ'],
    through: ['KeyG', 'KeyK'],
    sprint: ['ShiftLeft', 'ShiftRight'],
  },
  {
    up: ['ArrowUp'],
    down: ['ArrowDown'],
    left: ['ArrowLeft'],
    right: ['ArrowRight'],
    pass: ['Period', 'Numpad1'],
    shoot: ['Slash', 'Numpad2'],
    through: ['Comma', 'Numpad3'],
    sprint: ['ShiftRight', 'Numpad0'],
  },
];

export class InputManager {
  constructor(target = window) {
    this.keys = new Set();
    this.controllers = [new Controller('P1'), new Controller('P2')];
    this.touch = {
      active: false,
      x: 0,
      y: 0,
      pass: false,
      shoot: false,
      through: false,
      sprint: false,
    };
    this.twoPlayer = false;
    this.enabled = true;
    this.gamepadIndices = [];
    this.anyKeyCallbacks = new Set();

    target.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (SWALLOWED.has(e.code)) e.preventDefault();
      for (const cb of this.anyKeyCallbacks) cb(e);
    });
    target.addEventListener('keyup', (e) => this.keys.delete(e.code));
    target.addEventListener('blur', () => this.keys.clear());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.keys.clear();
    });
  }

  onAnyKey(cb) {
    this.anyKeyCallbacks.add(cb);
    return () => this.anyKeyCallbacks.delete(cb);
  }

  isDown(codes) {
    if (!codes) return false;
    for (const code of codes) if (this.keys.has(code)) return true;
    return false;
  }

  update(dt) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const activePads = [];
    for (const pad of pads) if (pad && pad.connected) activePads.push(pad);

    for (let i = 0; i < this.controllers.length; i++) {
      const c = this.controllers[i];
      if (!this.enabled || (i === 1 && !this.twoPlayer)) {
        c.reset();
        continue;
      }
      const map = KEYMAP[i];
      let x = 0;
      let y = 0;
      if (this.isDown(map.left) || (!this.twoPlayer && this.isDown(map.altLeft))) x -= 1;
      if (this.isDown(map.right) || (!this.twoPlayer && this.isDown(map.altRight))) x += 1;
      if (this.isDown(map.up) || (!this.twoPlayer && this.isDown(map.altUp))) y -= 1;
      if (this.isDown(map.down) || (!this.twoPlayer && this.isDown(map.altDown))) y += 1;

      let pass = this.isDown(map.pass);
      let shoot = this.isDown(map.shoot);
      let through = this.isDown(map.through);
      let sprint = this.isDown(map.sprint);

      const pad = activePads[i];
      if (pad) {
        const ax = pad.axes[0] || 0;
        const ay = pad.axes[1] || 0;
        if (Math.hypot(ax, ay) > 0.22) {
          x += ax;
          y += ay;
        }
        const dpad = (idx) => pad.buttons[idx] && pad.buttons[idx].pressed;
        if (dpad(12)) y -= 1;
        if (dpad(13)) y += 1;
        if (dpad(14)) x -= 1;
        if (dpad(15)) x += 1;
        pass = pass || dpad(0);
        shoot = shoot || dpad(1) || dpad(2);
        through = through || dpad(3);
        sprint = sprint || dpad(7) || dpad(5);
      }

      if (i === 0 && this.touch.active) {
        x += this.touch.x;
        y += this.touch.y;
        pass = pass || this.touch.pass;
        shoot = shoot || this.touch.shoot;
        through = through || this.touch.through;
        sprint = sprint || this.touch.sprint;
      }

      const mag = Math.hypot(x, y);
      if (mag > 1) {
        [x, y] = normalise(x, y);
      }
      c.x = clamp(x, -1, 1);
      c.y = clamp(y, -1, 1);
      c.pass.set(pass, dt);
      c.shoot.set(shoot, dt);
      c.through.set(through, dt);
      c.sprint.set(sprint, dt);
    }
  }

  clearEdges() {
    for (const c of this.controllers) c.clearEdges();
  }
}

const SWALLOWED = new Set([
  'Space',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Slash',
  'Numpad0',
  'Numpad1',
  'Numpad2',
  'Numpad3',
]);

/**
 * Wires an on-screen stick and buttons for touch devices. The stick is
 * "floating": it appears wherever the left half of the screen is first touched.
 */
export function attachTouchControls(root, input) {
  const stick = root.querySelector('[data-touch-stick]');
  const knob = root.querySelector('[data-touch-knob]');
  if (!stick || !knob) return;

  const RADIUS = 56;
  let pointerId = null;
  let originX = 0;
  let originY = 0;

  const setKnob = (dx, dy) => {
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  };

  const stickArea = root.querySelector('[data-touch-area]');
  stickArea.addEventListener('pointerdown', (e) => {
    if (pointerId !== null) return;
    pointerId = e.pointerId;
    stickArea.setPointerCapture(e.pointerId);
    originX = e.clientX;
    originY = e.clientY;
    const rect = root.getBoundingClientRect();
    stick.style.left = `${e.clientX - rect.left}px`;
    stick.style.top = `${e.clientY - rect.top}px`;
    stick.classList.add('is-active');
    input.touch.active = true;
  });

  const move = (e) => {
    if (e.pointerId !== pointerId) return;
    const dx = e.clientX - originX;
    const dy = e.clientY - originY;
    const mag = Math.hypot(dx, dy);
    const scale = mag > RADIUS ? RADIUS / mag : 1;
    setKnob(dx * scale, dy * scale);
    input.touch.x = clamp(dx / RADIUS, -1, 1);
    input.touch.y = clamp(dy / RADIUS, -1, 1);
  };

  const end = (e) => {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    input.touch.x = 0;
    input.touch.y = 0;
    setKnob(0, 0);
    stick.classList.remove('is-active');
  };

  stickArea.addEventListener('pointermove', move);
  stickArea.addEventListener('pointerup', end);
  stickArea.addEventListener('pointercancel', end);

  for (const btn of root.querySelectorAll('[data-touch-button]')) {
    const action = btn.dataset.touchButton;
    const set = (v) => {
      input.touch[action] = v;
      input.touch.active = true;
      btn.classList.toggle('is-pressed', v);
    };
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      btn.setPointerCapture(e.pointerId);
      set(true);
    });
    btn.addEventListener('pointerup', () => set(false));
    btn.addEventListener('pointerleave', () => set(false));
    btn.addEventListener('pointercancel', () => set(false));
  }
}
