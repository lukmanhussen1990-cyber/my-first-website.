// @ts-check
// Runs every active effect one step per game tick. Effects are generator
// functions: `yield` waits one tick, `yield n` waits n ticks. A shared block
// budget spreads big terrain edits over several ticks so phones don't freeze.
import { system } from "@minecraft/server";

/** @typedef {Generator<number | undefined, void, unknown>} Effect */

const MAX_ACTIVE = 12;
const MAX_AGE = 20 * 60 * 2; // hard stop after two minutes
const BUDGET_PER_TICK = 900; // ~1 per block looked at, +3 per block changed

/** Work units left this tick, shared by all effects. */
export const budget = { left: BUDGET_PER_TICK };

/** @type {{effect: Effect, wait: number, age: number, label: string}[]} */
const active = [];

/**
 * Starts an effect. Returns false when too many are already running.
 * @param {Effect} effect @param {string} label
 */
export function startEffect(effect, label) {
  if (active.length >= MAX_ACTIVE) return false;
  active.push({ effect, wait: 0, age: 0, label });
  return true;
}

export function activeCount() {
  return active.length;
}

/** Cancels everything that is running. Returns how many effects were stopped. */
export function stopAll() {
  const n = active.length;
  for (const fx of active.splice(0)) {
    try {
      fx.effect.return(undefined);
    } catch {
      // already finished
    }
  }
  return n;
}

system.runInterval(() => {
  budget.left = BUDGET_PER_TICK;
  if (active.length === 0) return;
  for (const fx of active.slice()) {
    fx.age++;
    if (fx.wait > 0) {
      fx.wait--;
      continue;
    }
    let done = fx.age > MAX_AGE;
    if (!done) {
      try {
        const step = fx.effect.next();
        done = step.done === true;
        fx.wait = typeof step.value === "number" && step.value > 1 ? step.value - 1 : 0;
      } catch (e) {
        console.warn(`[Destruction Mod] ${fx.label} stopped: ${e}`);
        done = true;
      }
    }
    if (done) {
      const i = active.indexOf(fx);
      if (i >= 0) active.splice(i, 1);
    }
  }
}, 1);
