// Shot plan of the slippery short: per shot a camera path, lens blur, the room state and the cards (characters, the
// fish, props, effects) as a pure function of time. Every reaction lands on its word (timeline.ts at()).
import { Pen, bodyFront, Outfit, Expr, FrontOpts, INK, fxPuff, fxBurst, fxSplash } from "./toon";
import { drawFish, FishExpr, FISH_CW, FISH_CH, drawBag, drawReceipt, drawCrab, drawWorm, drawUrchin, drawFlakes, drawSack, drawTorch,
  fxSand, fxBubbles, fxFlakeFall, fxBeam, fxRay } from "./art";
import { V3, at, camPath, CamOut, SETX, smooth, easeOut, lerp, lerp3, pop, clamp01, FPS } from "./timeline";

export const SU = 0.00216; // metres per character design unit (1000 units = 2.16 m)
export type Kind = "lit" | "fx" | "soft" | "add" | "blob";
export type Card = {
  key: string; cw: number; ch: number; draw: (p: Pen) => void; pos: V3; w: number;
  ay?: number; mirror?: boolean; roll?: number; kind?: Kind; sx?: number; flat?: boolean; res?: number;
};
export type RoomState = {
  tableBowl: boolean; container: "none" | "bowl" | "medium" | "giant"; medium: number; giant: number; lidY: number | null;
  sand: "none" | "bed" | "mound"; bags: (k: number) => number; bowlReef: boolean;
};
export type Plan = { cam: (t: number, t0: number) => CamOut; dof: { cInf: (t: number) => number; focus?: (t: number) => V3 }; cards: (t: number, T: number) => Card[]; room?: (t: number) => RoomState };

const R = (x: number, y: number, z: number): V3 => [x + SETX.room, y, z];
const S = (x: number, y: number, z: number): V3 => [x + SETX.store, y, z];
const F = (x: number, y: number, z: number): V3 => [x + SETX.reef, y, z];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

// ---------------- cast ----------------
const SKIN = "#fbf5ee";
const GUY: Outfit = { jacket: "#f2b134", pants: "#3b5b9a", boots: "#5a3b2a", hat: "hair", hair: "#6b4226", skin: SKIN };
const GUY_PJ: Outfit = { jacket: "#7193dc", pants: "#7193dc", boots: "#eef1f7", hat: "hair", hair: "#6b4226", skin: SKIN };
const WIFE: Outfit = { jacket: "#8e5ac9", pants: "#3b3f52", boots: "#5a3b2a", hat: "hair", hair: "#3a2418", dress: "#c25a7a", skin: SKIN };
const CLERK: Outfit = { jacket: "#2f8f5b", pants: "#3b3f52", boots: INK, hat: "cap", cap: "#2f8f5b", moustache: "#4a3020", build: "stout", skin: SKIN };

/** blinks every 0.5-2.3 s, 4 frames long (deterministic per seed) */
const blinkAt = (t: number, seed: number) => {
  let tb = 0.4 + (seed % 5) * 0.21;
  for (let i = 0; tb < t + 1; i++) {
    if (t >= tb && t < tb + 4 / FPS) return 1;
    tb += 0.5 + 1.8 * Math.abs(Math.sin(seed * 12.9898 + i * 78.233));
  }
  return 0;
};
type Hold = { name: string; fn: (p: Pen, hx: number, hy: number, u: number) => void };
const H_BAG: Hold = { name: "bag", fn: (p, hx, hy) => { const g = p.g; g.save(); g.translate(hx - 105, hy - 15); g.scale(0.5, 0.5); drawBag(new Pen(g), "happy"); g.restore(); } };
const held = (name: string, cw: number, s: number, dx: number, dy: number, d: (p: Pen) => void, flip = false): Hold => ({
  name, fn: (p, hx, hy) => { const g = p.g; g.save(); g.translate(hx + dx, hy + dy); if (flip) { g.scale(-s, s); g.translate(-cw, 0); } else g.scale(s, s); d(new Pen(g)); g.restore(); },
});
const H_FLAKES = held("flakes", 200, 0.42, -40, -70, drawFlakes);
const H_CRAB = held("crab", 300, 0.42, -60, -60, drawCrab);
const H_WORM = held("worm", 300, 0.42, -40, -40, (p) => drawWorm(p, 0));
const H_URCHIN = held("urchin", 260, 0.42, -54, -60, drawUrchin);
const H_SACK = held("sack", 360, 0.62, -130, -60, drawSack);
const H_TORCH = held("torch", 260, 0.45, -20, -26, drawTorch, true);

type PersonOpts = Omit<FrontOpts, "hold" | "holdUp"> & { hold?: Hold; holdUp?: Hold };
const person = (who: string, o: Outfit, seed: number, pos: V3, t: number, op: PersonOpts, blob = true): Card[] => {
  const blink = op.blink ?? blinkAt(t, seed);
  const opts: FrontOpts = { ...op, seed, blink, hold: op.hold?.fn, holdUp: op.holdUp?.fn };
  const key = [who, op.expr, op.mode, op.facing, typeof blink === "number" ? blink.toFixed(2) : blink, op.wave, op.hold?.name, op.holdUp?.name, op.armsUp, op.facepalm,
    op.phase !== undefined ? Math.round(op.phase * 16) : "", op.headTilt ?? "", op.look ?? ""].join("|");
  if (op.phase !== undefined) opts.phase = Math.round(op.phase * 16) / 16;
  const cards: Card[] = [{ key, cw: 600, ch: 1000, draw: (p) => bodyFront(p, o, opts), pos, w: 600 * SU, ay: 0.025 }];
  if (blob && op.mode !== "sit") cards.push(contact(pos, 0.75));
  return cards;
};
const contact = (pos: V3, w: number): Card => ({ key: "blob", cw: 128, ch: 128, draw: (p) => {
  const g = p.g, gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (const [r, c] of [[0, "#8a7f8f"], [0.45, "#a39aa8"], [0.75, "#d8d2da"], [1, "#ffffff"]] as const) gr.addColorStop(r, c);
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
}, pos: [pos[0], pos[1] + 0.015, pos[2]], w, flat: true, kind: "blob" });

type FishOpt = { expr?: FishExpr; mirror?: boolean; roll?: number; w?: number; t?: number; sweat?: boolean; blink?: number; sx?: number };
const fish = (id: string, pos: V3, o: FishOpt): Card => {
  const tail = Math.round(Math.sin((o.t ?? 0) * 7 + id.length) * 3) / 3, blink = o.blink ?? blinkAt(o.t ?? 0, id.length + 3);
  const expr = o.expr ?? "neutral";
  return { key: `fish|${expr}|${blink}|${tail}|${o.sweat ? 1 : 0}`, cw: FISH_CW, ch: FISH_CH, draw: (p) => drawFish(p, { expr, tail, blink, sweat: o.sweat }),
    pos, w: o.w ?? 0.5, ay: 0.5, mirror: o.mirror, roll: o.roll, sx: o.sx };
};
const fx = (key: string, cw: number, ch: number, draw: (p: Pen) => void, pos: V3, w: number, kind: Kind = "fx", ay = 0.5, roll = 0, mirror = false): Card =>
  ({ key, cw, ch, draw, pos, w, kind, ay, roll, mirror });
/** a timed effect: u = 0..1 over d seconds from t0 (null outside) */
const timed = (t: number, t0: number, d: number) => (t < t0 || t >= t0 + d ? null : (t - t0) / d);
const puff = (t: number, t0: number, pos: V3, w: number, d = 0.5): Card[] => {
  const u = timed(t, t0, d);
  return u === null ? [] : [fx(`puff|${Math.round(u * 12)}`, 300, 300, (p) => fxPuff(p, Math.round(u * 12) / 12), pos, w, "soft")];
};
const sandPuff = (t: number, t0: number, pos: V3, w: number, d = 0.6): Card[] => {
  const u = timed(t, t0, d);
  return u === null ? [] : [fx(`sand|${Math.round(u * 12)}`, 300, 300, (p) => fxSand(p, Math.round(u * 12) / 12), pos, w, "soft")];
};
const burst = (t: number, t0: number, pos: V3, w: number, col = "#ffe46b"): Card[] => {
  const u = timed(t, t0, 0.35);
  return u === null ? [] : [fx(`burst|${col}|${Math.round(u * 10)}`, 500, 500, (p) => fxBurst(p, Math.round(u * 10) / 10, col), pos, w)];
};

const ROOM_BASE: RoomState = { tableBowl: false, container: "giant", medium: 0, giant: 1, lidY: null, sand: "none", bags: () => 0, bowlReef: false };
const ALL_BAGS = () => 1;

// ---------------- word times used below ----------------
const tWant = at("want"), tSlip2 = at("slippery", 2), tDebt = at("debt"), tJump = at("jumped"), tLand = at("bowl") + 0.04;
const tLid = at("lid"), tMed = at("bigger", 1), tGiant = at("bigger", 2), tWont = at("won't"), tCrabs = at("crabs"), tWorms = at("worms"), tSea = at("sea");
const tLittle = at("little"), tStress = at("stressed"), tDie = at("die"), tMuch = at("much"), tSand3 = at("sand", 3), tFuck1 = at("fuck", 1);
const tBury = at("bury"), tBowl2 = at("bowl", 2), tMountain = at("mountain"), tFish2 = at("fish", 2), tHides = at("hides"), tHows = at("how's");
const tIts = at("it's"), tFuck2 = at("fuck", 2), tFish3 = at("fish", 3), tSo3 = at("so", 3), tSo4 = at("so", 4);

export const PLANS: Record<string, Plan> = {
  // ---- You have slippery dick. (pet store, the bag held up next to his grin)
  bag: {
    cam: camPath([{ t: 0, pos: S(0.62, 1.3, 3.75), look: S(0.62, 1.22, 1.0), fov: 40 }], 0.07),
    dof: { cInf: () => 12, focus: () => S(0.5, 1.3, 1.0) },
    cards: (t) => [
      ...person("guy", GUY, 3, S(0.4, 0, 1.0), t, { mode: "stand", expr: "grin", wave: 1, holdUp: H_BAG }),
      ...person("clerk", CLERK, 2, S(-0.6, 0, -1.6), t, { mode: "stand", expr: "neutral", facing: 1 }, false),
    ],
  },
  // ---- I told the guy at the pet store, I want the slippery dick, and now I'm in
  counter: {
    cam: camPath([{ t: 0, pos: S(-2.2, 1.6, 3.2), look: S(-0.4, 1.05, -0.8), fov: 42 }], 0.04),
    dof: { cInf: () => 7, focus: () => S(-1.15, 1.2, 0.35) },
    cards: (t) => [
      ...person("guy", GUY, 3, S(-1.15, 0, 0.35), t, { mode: "stand", facing: 1, expr: t >= tWant - 0.08 ? "grin" : "smile", ...(t >= tWant - 0.08 && t < tSlip2 + 1.0 ? { wave: 1 } : {}) }),
      ...person("clerk", CLERK, 2, S(0.15, 0, -1.6), t, { mode: "stand", facing: -1, expr: t >= tSlip2 && t < tSlip2 + 1.5 ? "smile" : "neutral" }, false),
    ],
  },
  // ---- fucking debt. (the till spits out a receipt down to the floor)
  receipt: {
    cam: camPath([{ t: 0, pos: S(1.95, 1.5, 1.05), look: S(0.85, 1.1, -0.55), fov: 40 }], 0.05, [[tDebt, 1.2]]),
    dof: { cInf: () => 10, focus: () => S(1.0, 1.2, -0.5) },
    cards: (t) => {
      const len = Math.round(20 * easeOut((t - tDebt + 0.06) / 0.3)) / 20;
      return [
        ...person("guy", GUY, 3, S(0.05, 0, 0.5), t, { mode: "stand", facing: 1, expr: t >= tDebt ? "shock" : "nervous" }),
        ...(len > 0 ? [{ key: `receipt|${len}`, cw: 220, ch: 1000, draw: (p: Pen) => drawReceipt(p, len), pos: S(1.0, 1.21, -0.32), w: 0.26, ay: 1 } as Card] : []),
        ...burst(t, tDebt - 0.04, S(1.0, 1.5, -0.45), 0.6),
      ];
    },
  },
  // ---- First, it jumped out of the bowl and onto the fucking carpet.
  jump: {
    cam: camPath([{ t: 0, pos: R(-0.3, 1.2, 1.7), look: R(-1.75, 0.55, -1.25), fov: 40 }], 0.05, [[tLand, 1.2]]),
    dof: { cInf: () => 8, focus: () => R(-1.6, 0.6, -1.15) },
    room: () => ({ ...ROOM_BASE, tableBowl: true, container: "none", giant: 0 }),
    cards: (t) => {
      const out: Card[] = [...person("guy", GUY, 3, R(-2.3, 0.4, -1.8), t, { mode: "sit", facing: 1, expr: t >= tJump + 0.15 ? "shock" : "smile" })];
      const S0: V3 = R(-1.6, 0.62, -1.15), E0: V3 = R(-1.2, 0.08, -0.5);
      if (t < tJump) out.push(fish("f", add(S0, [0.03 * Math.sin(t * 2), 0.015 * Math.sin(t * 3), 0]), { expr: "happy", w: 0.19, t, mirror: Math.sin(t * 0.9) > 0 }));
      else if (t < tLand) {
        const u = (t - tJump) / (tLand - tJump), p = lerp3(S0, E0, u);
        p[1] += 0.7 * 4 * u * (1 - u) + (1 - u) * 0 ;
        out.push(fish("f", p, { expr: "shock", w: 0.22, t, roll: -Math.PI * 2.2 * u, mirror: true }));
      } else {
        const k = Math.floor((t - tLand) / 0.2), v = ((t - tLand) / 0.2) % 1;
        out.push(fish("f", add(E0, [0, 0.07 * Math.sin(Math.PI * v), 0]), { expr: "angry", w: 0.22, t, roll: (k % 2 ? 1 : -1) * 1.15, mirror: true }));
      }
      out.push(...((): Card[] => { const u = timed(t, tJump - 0.03, 0.55); return u === null ? [] : [fx(`splash|${Math.round(u * 12)}`, 800, 800, (p) => fxSplash(p, Math.round(u * 12) / 12), R(-1.6, 0.72, -1.12), 0.5)]; })());
      out.push(...puff(t, tLand, R(-1.2, 0.1, -0.45), 0.6));
      return out;
    },
  },
  // ---- So I bought a lid. Then a bigger tank. Then a bigger fucking tank.
  tanks: {
    cam: camPath([
      { t: 0, pos: R(1.05, 1.35, 1.05), look: R(2.6, 0.98, -2.5), fov: 40 },
      { t: tMed - 0.05, d: 0.6, pos: R(0.6, 1.45, 1.9), look: R(2.6, 1.05, -2.5) },
      { t: tGiant - 0.05, d: 0.8, pos: R(-1.0, 1.7, 3.8), look: R(2.4, 1.45, -2.4), fov: 42 },
    ], 0.03, [[tLid, 0.6], [tMed, 0.6], [tGiant, 1.4]]),
    dof: { cInf: (t) => (t < tGiant ? 7 : 2), focus: () => R(2.6, 1.0, -2.5) },
    room: (t) => ({ ...ROOM_BASE, container: t < tMed ? "bowl" : t < tGiant ? "medium" : "giant", medium: pop(t - tMed), giant: pop(t - tGiant, 0.35),
      lidY: t < tMed ? Math.max(0, 0.55 * (1 - smooth((t - tLid + 0.32) / 0.32))) + (t > tLid && t < tLid + 0.2 ? 0.03 * Math.sin(((t - tLid) / 0.2) * Math.PI) : 0) : null }),
    cards: (t) => {
      const out: Card[] = [...person("guy", GUY, 3, R(1.3, 0, -1.6), t, { mode: "stand", facing: 1, expr: t < tMed ? "grin" : t < tGiant ? "nervous" : "shock", armsUp: t >= tGiant + 0.1 })];
      if (t < tMed) out.push(fish("f", R(2.6, 0.9, -2.55), { expr: "happy", w: 0.18, t, mirror: Math.sin(t) > 0 }));
      else if (t < tGiant) out.push(fish("f", R(2.6 + 0.15 * Math.sin(t), 1.02, -2.55), { expr: "happy", w: 0.3, t, mirror: Math.cos(t) > 0 }));
      else out.push(fish("f", R(3.0, 1.62, -2.55), { expr: "smug", w: 0.5, t }));
      out.push(...puff(t, tMed, R(2.6, 1.0, -2.3), 1.2), ...puff(t, tGiant, R(2.6, 1.4, -2.0), 3.2, 0.6));
      return out;
    },
  },
  // ---- It won't eat just anything. It wants crabs, worms and sea urchins.
  food: {
    cam: camPath([{ t: 0, pos: R(0.2, 1.45, 0.9), look: R(1.25, 1.3, -2.0), fov: 40 }], 0.04),
    dof: { cInf: () => 8, focus: () => R(0.85, 1.3, -1.5) },
    room: () => ({ ...ROOM_BASE }),
    cards: (t) => {
      const hold = t < tCrabs ? H_FLAKES : t < tWorms ? H_CRAB : t < tSea ? H_WORM : H_URCHIN;
      const away = t >= tWont + 0.25 && t < tSea + 0.1;
      const out: Card[] = [
        ...person("guy", GUY, 3, R(0.8, 0, -1.5), t, { mode: "stand", facing: 1, expr: t >= tSea ? "grin" : "nervous", hold }),
        fish("f", R(1.8 + (away ? 0.25 : 0), 1.45 + 0.02 * Math.sin(t * 2), -2.5), { expr: t >= tSea + 0.1 ? "happy" : away ? "smug" : "neutral", w: 0.5, t, mirror: away }),
      ];
      if (t < tCrabs - 0.3) out.push(fx(`flakes|${Math.round(((t * 0.8) % 1) * 24)}`, 200, 300, (p) => fxFlakeFall(p, Math.round(((t * 0.8) % 1) * 24) / 24), R(1.55, 1.85, -2.3), 0.4));
      for (const tk of [tCrabs, tWorms, tSea]) out.push(...puff(t, tk - 0.03, R(1.1, 1.15, -1.35), 0.35, 0.3));
      return out;
    },
  },
  // ---- Fancy little fucker.
  smug: {
    cam: camPath([{ t: 0, pos: R(1.62, 1.5, -1.5), look: R(1.95, 1.48, -2.5), fov: 36 }], 0.07),
    dof: { cInf: () => 14, focus: () => R(1.95, 1.48, -2.5) },
    room: () => ({ ...ROOM_BASE }),
    cards: (t) => {
      const out: Card[] = [fish("f", R(1.95, 1.48 + 0.015 * Math.sin(t * 3), -2.5), { expr: t < tLittle ? "chew" : "smug", w: 0.5, t, blink: t > tLittle + 0.75 && t < tLittle + 0.9 ? 1 : 0 })];
      if (t < tLittle) out.push({ key: "urchinBit", cw: 260, ch: 260, draw: drawUrchin, pos: R(1.95 - 0.235, 1.46, -2.48), w: 0.1, ay: 0.5 });
      out.push(fx(`bub|${Math.round((t % 2) * 15)}`, 200, 400, (p) => fxBubbles(p, Math.round((t % 2) * 15) / 30, 1), R(1.7, 1.75, -2.48), 0.25, "soft"));
      return out;
    },
  },
  // ---- It needs deep soft sand or it gets so stressed it can die.
  stress: {
    cam: camPath([{ t: 0, pos: R(1.15, 1.25, 0.3), look: R(2.25, 1.0, -2.5), fov: 40 }], 0.05, [[tDie, 1.0]]),
    dof: { cInf: () => 8, focus: () => R(2.3, 1.0, -2.5) },
    room: () => ({ ...ROOM_BASE }),
    cards: (t) => {
      const shake = 0.004 + 0.018 * smooth((t - tStress) / 0.5), dead = t >= tDie;
      const flip = dead ? Math.PI * smooth((t - tDie) / 0.25) : 0;
      return [
        fish("f", R(2.35 + shake * Math.sin(t * 90), 1.0 + (dead ? 0.3 * easeOut((t - tDie) / 0.9) : 0), -2.5), { expr: dead ? "dead" : "nervous", w: 0.5, t, roll: flip }),
        ...person("guy", GUY, 3, R(1.0, 0, -1.25), t, { mode: "stand", facing: 1, expr: dead ? "shock" : "nervous", armsUp: dead }),
      ];
    },
  },
  // ---- So I bought sand. So much fucking sand.
  sand: {
    cam: camPath([
      { t: 0, pos: R(-1.2, 1.5, 2.5), look: R(1.2, 1.0, -1.0), fov: 42 },
      { t: tSo4 - 0.05, d: 0.9, pos: R(-3.0, 2.05, 4.2), look: R(2.1, 1.45, -1.2), fov: 44 },
    ], 0.03, [[tSand3, 1.3]]),
    dof: { cInf: (t) => (t < tSo4 ? 6 : 0), focus: (t) => R(lerp(-0.6, 1.0, clamp01((t - tSo3) / 1.3)), 1.1, -0.5) },
    room: (t) => ({ ...ROOM_BASE, bags: (k) => pop(t - (tSo4 + 0.05 + k * 0.024), 0.22) }),
    cards: (t) => {
      const u = clamp01((t - (tSo3 - 0.1)) / 1.3), walking = u > 0 && u < 1;
      return [...person("guy", GUY, 3, R(lerp(-0.6, 1.0, u), 0, lerp(-0.3, -0.7, u)), t, {
        mode: walking ? "stroll" : "stand", phase: walking ? (t * 1.6) % 1 : undefined, facing: 1, expr: t >= tSo4 ? "dazed" : "pained", hold: t < tSo4 + 0.3 ? H_SACK : undefined,
      })];
    },
  },
  // ---- Why the fuck is this fish so high maintenance?
  couch: {
    cam: camPath([{ t: 0, pos: R(-3.1, 1.05, 0.5), look: R(-1.65, 0.85, -2.0), fov: 40 }], 0.06, [[tFuck1, 0.8]]),
    dof: { cInf: () => 8, focus: () => R(-1.9, 0.9, -1.8) },
    room: () => ({ ...ROOM_BASE, sand: "bed", bags: ALL_BAGS }),
    cards: (t) => [
      ...person("guy", GUY, 3, R(-1.9, 0.4, -1.8), t, { mode: "sit", facing: 0, expr: "pained", facepalm: true }),
      fish("f", R(1.7, 1.6, -2.5), { expr: "smug", w: 0.5, t }),
    ],
  },
  // ---- You see, in the wild, slippery dicks roam reefs from North Carolina to Brazil,
  reef: {
    cam: camPath([
      { t: 0, pos: F(-7, 1.15, 2.4), look: F(-3.6, 0.65, -3), fov: 42 },
      { t: at("you", 2) - 0.07, d: 4.7, pos: F(1.8, 1.35, 1.9), look: F(5.0, 0.75, -3) },
    ], 0),
    dof: { cInf: () => 4, focus: (t) => F(-4 + 1.6 * (t - at("you", 2)), 0.7, -1.4) },
    cards: (t, T) => {
      const out: Card[] = [];
      for (let i = 0; i < 6; i++) {
        const x = -6.2 + (i % 3) * 0.9 + Math.floor(i / 3) * 0.5 + 1.6 * T, y = 0.55 + 0.35 * ((i * 7) % 3) / 2 + 0.06 * Math.sin(t * 2 + i), z = -0.9 - (i % 3) * 1.1 - Math.floor(i / 3) * 0.4;
        out.push(fish("s" + i, F(x, y, z), { expr: i === 1 ? "happy" : "neutral", w: 0.58, t: t + i, mirror: true, blink: 0 }));
      }
      for (const [x, z] of [[-4, -3], [-0.5, -4.5], [3, -3.5], [6, -5]]) out.push(fx("ray", 200, 1000, fxRay, F(x, 3.2, z), 1.4, "add", 0.5, 0.25));
      out.push(fx(`bub|${Math.round((t % 2) * 15)}`, 200, 400, (p) => fxBubbles(p, Math.round((t % 2) * 15) / 30, 2), F(-1 + 1.6 * T * 0.6, 1.2, -1.0), 0.5, "soft"));
      return out;
    },
  },
  // ---- and every night they bury themselves in the sand.
  bury: {
    cam: camPath([{ t: 0, pos: F(2.6, 0.62, 2.0), look: F(3.0, 0.22, -1.6), fov: 40 }], 0.04),
    dof: { cInf: () => 6, focus: () => F(3.0, 0.25, -1.2) },
    cards: (t) => {
      const out: Card[] = [];
      for (let i = 0; i < 4; i++) {
        const td = tBury - 0.12 + i * 0.17, u = t - td, x0 = 1.7 + i * 0.7 + 0.2 * (t - at("every")), z = -0.9 - (i % 2) * 0.7, y0 = 0.42 + 0.1 * (i % 2);
        if (u > 1.0) continue;
        const roll = u > 0 ? -1.25 * smooth(u / 0.22) : 0, y = u > 0 ? y0 - 1.0 * smooth((u - 0.08) / 0.5) : y0 + 0.03 * Math.sin(t * 3 + i);
        out.push(fish("b" + i, F(x0 + (u > 0 ? 0.25 * smooth(u / 0.5) : 0), y, z), { expr: "neutral", w: 0.42, t: t + i, mirror: true, roll, blink: 0 }));
        out.push(...sandPuff(t, td + 0.22, F(x0 + 0.3, 0.12, z + 0.05), 0.7, 0.7));
      }
      return out;
    },
  },
  // ---- You can't fit that in a fucking bowl.
  bowlreef: {
    cam: camPath([{ t: 0, pos: R(-0.95, 0.98, -0.1), look: R(-1.62, 0.62, -1.15), fov: 40 }], 0.06, [[tBowl2, 1.0]]),
    dof: { cInf: () => 11, focus: () => R(-1.6, 0.62, -1.15) },
    room: () => ({ ...ROOM_BASE, tableBowl: true, bowlReef: true, sand: "bed", bags: ALL_BAGS }),
    cards: (t) => [
      fish("f", R(-1.58, 0.68, -1.1), { expr: "angry", w: 0.2, t, roll: 0.45, sx: 0.8 }),
      ...person("guy", GUY, 3, R(-2.45, 0, -1.8), t, { mode: "stand", facing: 1, expr: "stern", wave: 1 }),
      ...sandPuff(t, tBowl2 - 0.03, R(-1.45, 0.5, -1.05), 0.45, 0.5),
    ],
  },
  // ---- So now I've got a giant tank, a mountain of sand, and a fish that hides in it all night.
  nighttank: {
    cam: camPath([
      { t: 0, pos: R(0.9, 1.55, 1.4), look: R(2.6, 1.55, -2.5), fov: 40 },
      { t: tMountain - 0.25, d: 0.8, pos: R(0.55, 1.6, 2.1), look: R(2.75, 1.45, -2.4) },
      { t: tFish2 - 0.3, d: 0.8, pos: R(-0.3, 1.5, 1.7), look: R(1.9, 1.25, -1.9) },
    ], 0.03),
    dof: { cInf: () => 6, focus: (t) => (t < tFish2 ? R(2.6, 1.5, -2.4) : R(1.3, 1.3, -1.4)) },
    room: () => ({ ...ROOM_BASE, sand: "mound", bags: ALL_BAGS }),
    cards: (t) => {
      const lit = t >= tFish2 - 0.35;
      const out: Card[] = [...person("guypj", GUY_PJ, 3, R(1.25, 0, -1.35), t, { mode: "stand", facing: 1, expr: "stern", hold: H_TORCH })];
      if (lit) out.push(fx("beam", 600, 300, fxBeam, R(2.05, 1.18, -1.85), 1.4, "add", 0.5, 0, true));
      const u = timed(t, tHides - 0.05, 0.6);
      if (u !== null) out.push(fish("tail", R(2.85, 2.08 + 0.12 * Math.sin(Math.PI * u), -2.55), { expr: "neutral", w: 0.45, t, roll: Math.PI / 2, blink: 0 }));
      return out;
    },
  },
  // ---- My wife asks, how's your slippery dick?
  wife: {
    cam: camPath([{ t: 0, pos: R(-2.3, 1.45, 0.9), look: R(-4.15, 1.25, -1.1), fov: 40 }], 0.05),
    dof: { cInf: () => 9, focus: () => R(-4.05, 1.3, -1.1) },
    room: () => ({ ...ROOM_BASE, sand: "mound", bags: ALL_BAGS }),
    cards: (t) => person("wife", WIFE, 5, R(-4.0, 0, -1.1), t, { mode: "stand", facing: 1, expr: t >= tHows ? "smile" : "smile_closed" }),
  },
  // ---- Expensive. It's fucking expensive.
  tired: {
    cam: camPath([
      { t: 0, pos: R(0.5, 1.42, 0.45), look: R(0.43, 1.32, -1.0), fov: 40 },
      { t: tIts - 0.1, d: 1.3, pos: R(0.48, 1.44, 0.0), look: R(0.43, 1.36, -1.0) },
    ], 0.03),
    dof: { cInf: () => 12, focus: () => R(0.4, 1.35, -1.0) },
    room: () => ({ ...ROOM_BASE, sand: "mound", bags: ALL_BAGS }),
    cards: (t) => [
      ...person("guypj", GUY_PJ, 3, R(0.4, 0, -1.0), t, { mode: "stand", facing: 0, expr: "neutral", blink: Math.max(0.6, blinkAt(t, 3)), headTilt: -4 }),
      { key: "receipt|1", cw: 220, ch: 1000, draw: (p: Pen) => drawReceipt(p, 1), pos: R(0.72, 1.3, -0.93), w: 0.24, ay: 1, roll: 0.06 },
    ],
  },
  // ---- Who the fuck named this fucking fish?
  yell: {
    cam: camPath([{ t: 0, pos: R(1.65, 0.7, 0.85), look: R(1.75, 1.75, -1.45), fov: 46, roll: 0.07 }], 0.05, [[tFuck2, 1.2], [tFish3, 0.8]]),
    dof: { cInf: () => 7, focus: () => R(1.6, 1.4, -1.45) },
    room: () => ({ ...ROOM_BASE, sand: "mound", bags: ALL_BAGS }),
    cards: (t) => {
      const out: Card[] = [...person("guypj", GUY_PJ, 3, R(1.6, 0, -1.45), t, { mode: "stand", facing: 0, expr: "shock", armsUp: true })];
      const u = t - (tFish3 - 0.15);
      if (u > 0) out.push(fish("pop", R(2.05, 1.86 + 0.18 * easeOut(u / 0.3), -2.55), { expr: "smug", w: 0.45, t, roll: -Math.PI / 2 }));
      return out;
    },
  },
};
