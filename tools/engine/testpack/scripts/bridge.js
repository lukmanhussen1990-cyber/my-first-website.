// Client side of the engine-harness bridge (see tools/engine/bridge/pastest_bridge.js,
// which runs inside the add-on's script context of the *installed* test copy).
import { world, system } from "@minecraft/server";

let nextId = 1;
const waiting = new Map();
const parts = new Map();

function settle(msg) {
  const w = waiting.get(msg.id);
  if (!w) return;
  waiting.delete(msg.id);
  system.clearRun(w.timer);
  if (msg.ok) w.resolve(msg.value);
  else w.reject(new Error(`bridge ${w.op}: ${msg.error}`));
}

system.afterEvents.scriptEventReceive.subscribe(
  (ev) => {
    if (ev.id === "pastest:res") {
      try {
        settle(JSON.parse(ev.message));
      } catch (e) {
        console.warn(`PASINFO|bridge|bad response ${e}`);
      }
    } else if (ev.id === "pastest:resp") {
      const p = JSON.parse(ev.message);
      const list = parts.get(p.id) ?? [];
      list[p.part] = p.data;
      parts.set(p.id, list);
      if (list.filter((x) => x !== undefined).length === p.of) {
        parts.delete(p.id);
        settle(JSON.parse(list.join("")));
      }
    }
  },
  { namespaces: ["pastest"] },
);

/** Send a request to the bridge; resolves with its value, rejects on error or after `timeout` ticks. */
export function bridgeCall(op, payload = {}, timeout = 60) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = system.runTimeout(() => {
      waiting.delete(id);
      reject(new Error(`bridge ${op}: no reply in ${timeout} ticks (bridge not installed?)`));
    }, timeout);
    waiting.set(id, { resolve, reject, timer, op });
    try {
      world.getDimension("overworld").runCommand(`scriptevent pastest:req ${JSON.stringify({ id, op, ...payload })}`);
    } catch (e) {
      waiting.delete(id);
      system.clearRun(timer);
      reject(new Error(`bridge ${op}: ${e}`));
    }
  });
}

/** True when the bridge answers a ping. */
export async function bridgeAvailable() {
  try {
    await bridgeCall("ping", {}, 40);
    return true;
  } catch {
    return false;
  }
}
