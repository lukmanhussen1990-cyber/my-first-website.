// Tiny synchronous event bus shared through ctx.events.
export function createEvents() {
  const map = new Map();
  return {
    on(name, fn) {
      if (!map.has(name)) map.set(name, new Set());
      map.get(name).add(fn);
      return () => map.get(name).delete(fn);
    },
    off(name, fn) { map.get(name)?.delete(fn); },
    emit(name, data) {
      const set = map.get(name);
      if (set) for (const fn of set) fn(data);
    },
  };
}
