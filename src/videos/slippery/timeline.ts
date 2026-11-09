// Timeline of the slippery dick short: the user's voice (voice/voice.wav, 53.7 s) with word times from forced
// alignment (words.json), shots cut on words, cameras (cuts on big jumps, smootherstep glides, a slow creep on every
// hold, flip kicks on impacts), lens blur per shot, and the one-word captions.
import RAW from "./words.json";
import { LookId } from "./looks";

export const FPS = 30;
export const TOTAL = 1620; // 54.0 s: voice ends at 53.7 s
export type V3 = [number, number, number];
export type Word = { w: string; s: number; e: number };
export const WORDS: Word[] = (RAW as { w: string; s: number; e: number }[]).map((x) => ({ w: x.w, s: x.s, e: x.e }));
const norm = (w: string) => w.toLowerCase().replace(/[^a-z']/g, "");
/** start time (s) of the n-th occurrence of a word (1-based) */
export const at = (w: string, n = 1) => {
  let k = 0;
  for (const x of WORDS) if (norm(x.w) === w && ++k === n) return x.s;
  throw new Error(`word ${w} #${n} not in words.json`);
};
export const endOf = (w: string, n = 1) => {
  let k = 0;
  for (const x of WORDS) if (norm(x.w) === w && ++k === n) return x.e;
  throw new Error(`word ${w} #${n} not in words.json`);
};

// ---------------- captions: one word at a time (short function words ride with the next word) ----------------
const RIDE = new Set(["a", "the", "i", "in", "to", "of", "at", "it", "and", "or", "my", "so", "is", "it's"]);
export type Chunk = { text: string; s: number; e: number };
export const CHUNKS: Chunk[] = (() => {
  const out: Chunk[] = [];
  for (let i = 0; i < WORDS.length; i++) {
    const w = WORDS[i], nx = WORDS[i + 1];
    if (RIDE.has(norm(w.w)) && !/[.,?!]$/.test(w.w) && nx && nx.s - w.e < 0.2 && norm(nx.w).length > 2) {
      out.push({ text: `${w.w} ${nx.w}`, s: w.s, e: nx.e }); i++;
    } else out.push({ text: w.w, s: w.s, e: w.e });
  }
  // each chunk stays up until the next one starts, unless the pause is long
  for (let i = 0; i < out.length; i++) {
    const nx = out[i + 1];
    out[i].e = nx ? (nx.s - out[i].e < 0.7 ? nx.s : out[i].e + 0.3) : out[i].e + 0.4;
  }
  return out;
})();
export const captionAt = (t: number) => CHUNKS.find((c) => t >= c.s && t < c.e) ?? null;

// ---------------- sets ----------------
export type SetId = "store" | "room" | "reef";
export const SETX: Record<SetId, number> = { store: -60, room: 0, reef: 60 };

// ---------------- shots (cut on words) ----------------
export type ShotDef = { id: number; a: number; b: number; set: SetId; look: LookId; name: string };
const f = (s: number) => Math.round(s * FPS);
const CUTS: [number, SetId, LookId, string][] = [
  [0, "store", "store", "bag"],                           // You have slippery dick.
  [at("i", 1) - 0.05, "store", "store", "counter"],       // I told the guy at the pet store, I want the slippery dick, and now I'm in
  [at("fucking", 1) - 0.1, "store", "store", "receipt"],  // fucking debt.
  [at("first") - 0.1, "room", "room", "jump"],            // First, it jumped out of the bowl and onto the fucking carpet.
  [at("so", 1) - 0.1, "room", "room", "tanks"],           // So I bought a lid. Then a bigger tank. Then a bigger fucking tank.
  [at("won't") - 0.16, "room", "room", "food"],           // It won't eat just anything. It wants crabs, worms and sea urchins.
  [at("fancy") - 0.15, "room", "room", "smug"],           // Fancy little fucker.
  [at("needs") - 0.14, "room", "room", "stress"],         // It needs deep soft sand or it gets so stressed it can die.
  [at("so", 3) - 0.08, "room", "room", "sand"],           // So I bought sand. So much fucking sand.
  [at("why") - 0.1, "room", "room", "couch"],             // Why the fuck is this fish so high maintenance?
  [at("you", 2) - 0.08, "reef", "reef", "reef"],          // You see, in the wild, slippery dicks roam reefs from North Carolina to Brazil,
  [at("every") - 0.1, "reef", "reefNight", "bury"],       // and every night they bury themselves in the sand.
  [at("you", 3) - 0.1, "room", "room", "bowlreef"],       // You can't fit that in a fucking bowl.
  [at("so", 6) - 0.1, "room", "night", "nighttank"],      // So now I've got a giant tank, a mountain of sand, and a fish that hides in it all night.
  [at("my") - 0.12, "room", "night", "wife"],             // My wife asks, how's your slippery dick?
  [at("expensive") - 0.12, "room", "night", "tired"],     // Expensive. It's fucking expensive.
  [at("who") - 0.11, "room", "night", "yell"],            // Who the fuck named this fucking fish?
];
export const SHOTS: ShotDef[] = CUTS.map(([s, set, look, name], i) => ({ id: i + 1, a: f(s), b: i + 1 < CUTS.length ? f(CUTS[i + 1][0]) : TOTAL, set, look, name }));
export const shotByName = (n: string) => SHOTS.find((s) => s.name === n)!;
/** crossfades (frames) into these shot ids; the hook ends on a 4-frame white flash */
export const XFADE: Record<number, number> = { 12: 10 };
export const FLASH_AT = SHOTS[1].a;
export const shotAt = (fr: number) => SHOTS.find((s) => fr >= s.a && fr < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (fr: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && fr >= s.a - x / 2 && fr < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (fr - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(fr).id, alpha: 1 }];
};

// ---------------- easing / camera grammar ----------------
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const smoother = (x: number) => { const u = clamp01(x); return u * u * u * (u * (u * 6 - 15) + 10); };
export const easeOut = (x: number) => 1 - (1 - clamp01(x)) ** 3;
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const lerp3 = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
/** pop-in scale with a small overshoot (0 -> 1.12 -> 1), u = time since the pop in seconds */
export const pop = (u: number, d = 0.28) => (u <= 0 ? 0 : u >= d ? 1 : (() => { const x = u / d; return x < 0.6 ? 1.12 * smooth(x / 0.6) : 1.12 - 0.12 * smooth((x - 0.6) / 0.4); })());

export type CamKey = { t: number; pos: V3; look: V3; fov?: number; roll?: number; d?: number };
export type CamOut = { pos: V3; look: V3; fov: number; roll: number };
/** keys: each key's t is when the glide TO it starts (d seconds, smootherstep); creep = dolly toward the look point per
 *  second (fraction of the distance; ~0.15-0.3 %/frame); kicks = impact times (flip-shake decaying over 7 frames) */
export const camPath = (keys: CamKey[], creep = 0.05, kicks: [number, number][] = []) => (t: number, t0: number): CamOut => {
  let c: CamOut = { pos: keys[0].pos, look: keys[0].look, fov: keys[0].fov ?? 40, roll: keys[0].roll ?? 0 };
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i], u = smoother((t - k.t) / (k.d ?? 0.7));
    if (u <= 0) break;
    c = { pos: lerp3(c.pos, k.pos, u), look: lerp3(c.look, k.look, u), fov: lerp(c.fov, k.fov ?? c.fov, u), roll: lerp(c.roll, k.roll ?? c.roll, u) };
  }
  const k = Math.min(0.35, creep * Math.max(0, t - t0));
  const pos = lerp3(c.pos, c.look, k);
  let kx = 0, ky = 0;
  for (const [tk, amp] of kicks) {
    const n = Math.floor((t - tk) * FPS + 1e-6);
    if (n >= 0 && n < 7) { const a = amp * (n % 2 ? -1 : 1) * (1 - n / 7) ** 2; kx += a; ky += a * 0.6; }
  }
  if (kx || ky) {
    const fx = c.look[0] - pos[0], fz = c.look[2] - pos[2], l = Math.hypot(fx, fz) || 1, d = Math.hypot(fx, c.look[1] - pos[1], fz);
    const rx = -fz / l, rz = fx / l, s = d * 0.02;
    return { pos: [pos[0] + rx * kx * s, pos[1] + ky * s, pos[2] + rz * kx * s], look: [c.look[0] + rx * kx * s, c.look[1] + ky * s, c.look[2] + rz * kx * s], fov: c.fov, roll: c.roll };
  }
  return { ...c, pos };
};
