/* ══════════════════════════════════════════════════════════
   input.js — keyboard, touch/swipe and gamepad, funnelled
   into a single action queue the game drains each frame.
   ══════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const SS = (window.SS = window.SS || {});

  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'jump', KeyW: 'jump', Space: 'jump',
    ArrowDown: 'roll', KeyS: 'roll',
    ShiftLeft: 'board', ShiftRight: 'board', KeyH: 'board',
    Escape: 'pause', KeyP: 'pause',
    KeyM: 'mute',
    Enter: 'confirm',
  };

  const Input = {
    queue: [],
    held: Object.create(null),
    lastTap: 0,
    _touch: null,
    _fired: false,
    _padPrev: {},
    onAny: null,   // callback fired on the very first interaction (audio unlock)

    init(el) {
      window.addEventListener('keydown', (e) => {
        const a = KEYMAP[e.code];
        if (!a) return;
        if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
        if (e.repeat) return;
        this.held[a] = true;
        this.push(a);
      });

      window.addEventListener('keyup', (e) => {
        const a = KEYMAP[e.code];
        if (a) this.held[a] = false;
      });

      window.addEventListener('blur', () => {
        this.held = Object.create(null);
        this.push('blur');
      });

      /* ── touch ── */
      const opts = { passive: false };
      el.addEventListener('touchstart', (e) => {
        const t = e.changedTouches[0];
        this._touch = { x: t.clientX, y: t.clientY, t: performance.now(), id: t.identifier };
        this._fired = false;
        this.first();
        e.preventDefault();
      }, opts);

      el.addEventListener('touchmove', (e) => {
        if (!this._touch || this._fired) { e.preventDefault(); return; }
        const t = [].slice.call(e.changedTouches).find((x) => x.identifier === this._touch.id);
        if (t) this.swipe(t.clientX - this._touch.x, t.clientY - this._touch.y, 26);
        e.preventDefault();
      }, opts);

      el.addEventListener('touchend', (e) => {
        if (!this._touch) return;
        const t = [].slice.call(e.changedTouches).find((x) => x.identifier === this._touch.id);
        if (t && !this._fired) {
          const dx = t.clientX - this._touch.x, dy = t.clientY - this._touch.y;
          if (!this.swipe(dx, dy, 22)) {
            // tap → jump; double tap → hoverboard
            const now = performance.now();
            if (now - this.lastTap < 280) { this.push('board'); this.lastTap = 0; }
            else { this.push('jump'); this.lastTap = now; }
          }
        }
        this._touch = null;
        e.preventDefault();
      }, opts);

      el.addEventListener('touchcancel', () => { this._touch = null; }, opts);

      /* mouse as a swipe surface too (desktop testing / trackpads) */
      let md = null;
      el.addEventListener('mousedown', (e) => { md = { x: e.clientX, y: e.clientY }; this.first(); });
      window.addEventListener('mouseup', (e) => {
        if (!md) return;
        const dx = e.clientX - md.x, dy = e.clientY - md.y;
        if (!this.swipe(dx, dy, 30)) this.push('jump');
        md = null;
      });

      window.addEventListener('pointerdown', () => this.first(), { once: false });
    },

    first() {
      if (this.onAny) { const f = this.onAny; this.onAny = null; f(); }
    },

    /** Returns true when a direction was emitted. */
    swipe(dx, dy, thresh) {
      const ax = Math.abs(dx), ay = Math.abs(dy);
      if (Math.max(ax, ay) < thresh) return false;
      this._fired = true;
      if (ax > ay) this.push(dx > 0 ? 'right' : 'left');
      else this.push(dy > 0 ? 'roll' : 'jump');
      return true;
    },

    push(a) {
      this.first();
      if (this.queue.length < 8) this.queue.push(a);
    },

    /** Poll gamepad #0 and translate to edge-triggered actions. */
    pollPad() {
      if (!navigator.getGamepads) return;
      const pads = navigator.getGamepads();
      const p = pads && pads[0];
      if (!p) return;
      const b = p.buttons, ax = p.axes;
      const state = {
        left: (b[14] && b[14].pressed) || ax[0] < -0.55,
        right: (b[15] && b[15].pressed) || ax[0] > 0.55,
        jump: (b[0] && b[0].pressed) || (b[12] && b[12].pressed) || ax[1] < -0.6,
        roll: (b[1] && b[1].pressed) || (b[13] && b[13].pressed) || ax[1] > 0.6,
        board: (b[2] && b[2].pressed) || (b[5] && b[5].pressed),
        pause: b[9] && b[9].pressed,
      };
      for (const k in state) {
        if (state[k] && !this._padPrev[k]) this.push(k);
      }
      this._padPrev = state;
    },

    drain() {
      this.pollPad();
      const q = this.queue;
      this.queue = [];
      return q;
    },

    clear() { this.queue.length = 0; },
  };

  SS.Input = Input;
})();
