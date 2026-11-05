// Tiny keyframe engine: easing curves + per-property tracks.
// Keys look like { t: 1.25, e: 'snap', x: 0, y: 1.2, pose: 'stand', face: 'smug' }.
// Every property becomes its own track, so a key only needs the values that change.
// Numbers and number-arrays interpolate; strings/booleans/null hold (step).

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const DEG = Math.PI / 180;

export const EASE = {
  linear: (t) => t,
  step: () => 0, // hold previous value, jump on the key
  in: (t) => t * t * t,
  out: (t) => 1 - Math.pow(1 - t, 3),
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  // very short, very hard transition: the stiff "puppet" move
  snap: (t) => (t < 0.5 ? 16 * Math.pow(t, 5) : 1 - Math.pow(-2 * t + 2, 5) / 2),
  // overshoot then settle (pose pops)
  back: (t) => {
    const c1 = 1.9, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  // gravity fall: accelerates into the key
  fall: (t) => t * t,
  // bounce-free elastic settle
  elastic: (t) =>
    t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
};

export function ease(name, t) {
  const f = EASE[name] || EASE.inOut;
  return f(clamp(t));
}

function mix(a, b, k) {
  if (typeof a === 'number' && typeof b === 'number') return lerp(a, b, k);
  if (Array.isArray(a) && Array.isArray(b)) return a.map((v, i) => lerp(v, b[i] ?? v, k));
  return k >= 1 ? b : a; // non-numeric: hold until the key is reached
}

/**
 * Build per-property tracks from a key list.
 * @param keys      [{t, e?, ...props}]
 * @param expand    optional fn(key) -> extra props (used to expand pose names into joint angles)
 * @param defaultEase ease used when a key has no `e`
 */
export function compileTracks(keys, expand, defaultEase = 'inOut') {
  const tracks = {};
  const sorted = [...keys].sort((a, b) => a.t - b.t);
  for (const k of sorted) {
    const e = k.e || defaultEase;
    const props = { ...(expand ? expand(k) : {}), ...k };
    for (const [name, value] of Object.entries(props)) {
      if (name === 't' || name === 'e' || name === 'pose' || name === 'j') continue;
      (tracks[name] ||= []).push({ t: k.t, v: value, e });
    }
    if (k.pose !== undefined) (tracks.pose ||= []).push({ t: k.t, v: k.pose, e: 'step' });
  }
  return tracks;
}

export function sampleTrack(track, t, fallback) {
  if (!track || !track.length) return fallback;
  if (t <= track[0].t) return track[0].v;
  const last = track[track.length - 1];
  if (t >= last.t) return last.v;
  // binary search for the segment
  let lo = 0, hi = track.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (track[mid].t <= t) lo = mid; else hi = mid;
  }
  const a = track[lo], b = track[hi];
  const span = b.t - a.t;
  if (span <= 1e-6) return b.v;
  const k = ease(b.e, (t - a.t) / span);
  return mix(a.v, b.v, k);
}

export function sampleAll(tracks, t, defaults = {}) {
  const out = { ...defaults };
  for (const [name, track] of Object.entries(tracks)) out[name] = sampleTrack(track, t, defaults[name]);
  return out;
}

// Deterministic pseudo-random (frame renders must be reproducible).
export function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}
// smooth 1D value noise in [-1, 1]
export function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hash(i + seed * 57.3), hash(i + 1 + seed * 57.3), u) * 2 - 1;
}
