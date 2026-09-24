// STUB — UI agent replaces the internals (keep the API from ARCHITECTURE.md). Keyboard only.
export function createInput(ctx) {
  const keys = new Set();
  const state = {
    moveX: 0, moveY: 0, look: { dx: 0, dy: 0 },
    held: { attack: false, charge: false, jump: false, dodge: false, musou: false },
    pressed: { attack: false, charge: false, jump: false, dodge: false, musou: false, pause: false, camReset: false, help: false },
  };
  const bind = { KeyJ: 'attack', KeyK: 'charge', Space: 'jump', KeyL: 'dodge', KeyI: 'musou', Escape: 'pause', KeyP: 'pause', KeyR: 'camReset', KeyH: 'help' };
  addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys.add(e.code);
    const b = bind[e.code];
    if (b) { state.pressed[b] = true; if (b in state.held) state.held[b] = true; e.preventDefault(); }
  });
  addEventListener('keyup', (e) => {
    keys.delete(e.code);
    const b = bind[e.code];
    if (b && b in state.held) state.held[b] = false;
  });
  const api = {
    state, mode: 'keyboard',
    update(dt) {
      state.moveX = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
      state.moveY = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
      state.look.dx += ((keys.has('KeyE') ? 1 : 0) - (keys.has('KeyQ') ? 1 : 0)) * 2.2 * dt;
    },
    endFrame() { for (const k in state.pressed) state.pressed[k] = false; state.look.dx = 0; state.look.dy = 0; },
    setEnabled() {}, setMusouReady() {},
  };
  return api;
}
