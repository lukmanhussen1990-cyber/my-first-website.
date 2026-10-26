// Helpers for paper-cut people in a set: build, place (world -> set-local), shadow puppets, finish.
import { Person } from './rig.js';
import { silhouetteMat } from './materials.js';

export function person(group, opts) { const p = new Person(opts); group.add(p.root); return p; }
export function puppet(group, opts, color = '#22142a', opacity = 0.5) {
  const mat = silhouetteMat(color, opacity);
  const p = new Person({ ...opts, silhouette: mat }); p.mat = mat; group.add(p.root); return p;
}
export function place(p, origin, w) { p.root.position.set(w[0] - origin[0], w[1] - origin[1], w[2] - origin[2]); }
// billboard + thin outline for every visible person
export function finish(persons, cam, lean = 0.3) { for (const p of persons) if (p.root.visible) { p.billboard(cam, lean); p.autoOutline(cam); } }
// speed / acceleration of a pure 1D position function (finite differences)
export function kin(fn, t, h = 1 / 60) { const a = fn(t - h), b = fn(t), c = fn(t + h); return { v: (c - a) / (2 * h), acc: (c - 2 * b + a) / (h * h) }; }
