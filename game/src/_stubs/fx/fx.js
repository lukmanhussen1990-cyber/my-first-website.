// FROZEN STUB SNAPSHOT (used by `node build.mjs --stubs`). Do not edit.
export function createFX(ctx) {
  const noopTrail = { push() {}, stop() {} };
  return {
    update() {},
    hitSpark() {}, debris() {}, dust() {}, shockwave() {}, slash() {},
    createTrail() { return noopTrail; },
    musouAura() {}, impactFlash() {},
    projectile(from, to) { return { done: true, pos: to.clone() }; },
  };
}
