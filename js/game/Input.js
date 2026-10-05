// Mouse / touch look with smoothing, keyboard lean and actions.

import { clamp, damp } from '../core/math.js';

const YAW_LIMIT = 2.35;
const PITCH_MIN = -0.95;
const PITCH_MAX = 0.62;

export class Input {
  constructor(canvas, { onAction } = {}) {
    this.canvas = canvas;
    this.onAction = onAction || (() => {});
    this.yaw = 0.12;
    this.pitch = -0.05;
    this.targetYaw = 0.12;
    this.targetPitch = -0.05;
    this.sensitivity = 1;
    this.invertY = false;
    this.enabled = false;
    this.keys = new Set();
    this.locked = false;
    this.drag = null;
    this.leanX = 0;
    this.leanY = 0;

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked && this.enabled) this.onAction('unlock');
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      if (this.locked) this._look(e.movementX, e.movementY, 0.0022);
      else if (this.drag) {
        this._look(e.clientX - this.drag.x, e.clientY - this.drag.y, 0.004);
        this.drag = { x: e.clientX, y: e.clientY };
      }
    });
    canvas.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      if (!this.locked) {
        this.requestLock();
        this.drag = { x: e.clientX, y: e.clientY };
      }
    });
    window.addEventListener('mouseup', () => { this.drag = null; });
    // Touch: drag to look.
    canvas.addEventListener('touchstart', (e) => {
      if (!this.enabled || !e.touches.length) return;
      const t = e.touches[0];
      this.drag = { x: t.clientX, y: t.clientY };
    }, { passive: true });
    canvas.addEventListener('touchmove', (e) => {
      if (!this.enabled || !this.drag || !e.touches.length) return;
      const t = e.touches[0];
      this._look(t.clientX - this.drag.x, t.clientY - this.drag.y, 0.005);
      this.drag = { x: t.clientX, y: t.clientY };
    }, { passive: true });
    canvas.addEventListener('touchend', () => { this.drag = null; });

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      this.keys.add(k);
      const actions = { r: 'radio', v: 'window', c: 'captions', h: 'hud', m: 'mute', f: 'fullscreen', p: 'pause', escape: 'pause' };
      if (actions[k]) {
        if (k === 'escape' && this.locked) return; // the browser exits pointer lock -> 'unlock'
        this.onAction(actions[k]);
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }

  requestLock() {
    if (this.locked || !this.canvas.requestPointerLock) return;
    try {
      const r = this.canvas.requestPointerLock();
      if (r && r.catch) r.catch(() => {});
    } catch {
      // Pointer lock is optional; dragging still works.
    }
  }

  releaseLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  _look(dx, dy, scale) {
    const s = scale * this.sensitivity;
    this.targetYaw = clamp(this.targetYaw - dx * s, -YAW_LIMIT, YAW_LIMIT);
    this.targetPitch = clamp(this.targetPitch - dy * s * (this.invertY ? -1 : 1), PITCH_MIN, PITCH_MAX);
  }

  update(dt) {
    const k = this.keys;
    if (this.enabled) {
      const kx = (k.has('arrowleft') ? 1 : 0) - (k.has('arrowright') ? 1 : 0);
      const ky = (k.has('arrowup') ? 1 : 0) - (k.has('arrowdown') ? 1 : 0);
      if (kx || ky) {
        this.targetYaw = clamp(this.targetYaw + kx * dt * 1.4, -YAW_LIMIT, YAW_LIMIT);
        this.targetPitch = clamp(this.targetPitch + ky * dt * 1.0, PITCH_MIN, PITCH_MAX);
      }
    }
    const lx = this.enabled ? (k.has('d') || k.has('e') ? 1 : 0) - (k.has('a') || k.has('q') ? 1 : 0) : 0;
    const ly = this.enabled ? (k.has('s') ? 1 : 0) - (k.has('w') ? 1 : 0) : 0;
    this.leanX = damp(this.leanX, lx, 5, dt);
    this.leanY = damp(this.leanY, ly, 5, dt);
    // Cinematic smoothing on the head turn.
    this.yaw = damp(this.yaw, this.targetYaw, 11, dt);
    this.pitch = damp(this.pitch, this.targetPitch, 11, dt);
  }
}
