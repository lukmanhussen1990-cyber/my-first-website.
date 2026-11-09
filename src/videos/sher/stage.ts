// Shot plan of the riddle short: cameras, lens blur, boat position and cards (farmer, lion, goat, grass, bubbles,
// effects) per shot, as pure functions of time.
import { Pen, bodyFront, Outfit, FrontOpts, fxPuff, fxBurst, fxStars } from "../slippery/toon";
import { fxPanic } from "../slippery/art";
import { camPath, CamOut, smooth, smoother, easeOut, lerp, lerp3, pop, clamp01 } from "../slippery/timeline";
import type { Card, Kind } from "../slippery/stage";
import { drawLion, LionExpr, LION_CW, LION_CH, drawGoat, GoatExpr, GOAT_CW, GOAT_CH, drawGrass, GRASS_CW, GRASS_CH, drawBubble, BUBBLE_CW, BUBBLE_CH,
  drawQuestion, drawPause, drawBadge7 } from "./art";
import { V3, at, TRIPS, Who, FPS } from "./timeline";
import { BANK_Y as B, BRIDGE_X } from "./sets";

export type Plan = { cam: (t: number, t0: number) => CamOut; dof: { cInf: (t: number) => number; focus?: (t: number) => V3 }; cards: (t: number, T: number) => Card[]; boat?: (t: number) => [number, number, number] };
export const SU = 0.00216;
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

// ---------------- cast ----------------
const SKIN = "#fbf5ee";
const FARMER: Outfit = { jacket: "#f4efe4", pants: "#efe6d2", boots: "#7a4f33", hat: "turban", cap: "#f08a2c", moustache: "#3a2418", skin: SKIN };
const FARMER2: Outfit = { jacket: "#7bc46a", pants: "#efe6d2", boots: "#7a4f33", hat: "turban", cap: "#d94a6a", moustache: "#3a2418", skin: SKIN };
const blinkAt = (t: number, seed: number) => {
  let tb = 0.4 + (seed % 5) * 0.21;
  for (let i = 0; tb < t + 1; i++) { if (t >= tb && t < tb + 4 / FPS) return 1; tb += 0.5 + 1.8 * Math.abs(Math.sin(seed * 12.9898 + i * 78.233)); }
  return 0;
};
type Hold = { name: string; fn: (p: Pen, hx: number, hy: number, u: number) => void };
const H_POLE: Hold = { name: "pole", fn: (p, hx, hy) => { p.band([[hx + 30, hy - 330], [hx - 40, hy + 470]], "#b98a4a", 14, 4, "round"); p.dot(hx, hy, 13); } };
const person = (who: string, o: Outfit, seed: number, pos: V3, t: number, op: Omit<FrontOpts, "hold" | "holdUp"> & { hold?: Hold }, blob = true): Card[] => {
  const blink = op.blink ?? blinkAt(t, seed);
  const opts: FrontOpts = { ...op, seed, blink, hold: op.hold?.fn };
  if (op.phase !== undefined) opts.phase = Math.round(op.phase * 16) / 16;
  const key = [who, op.expr, op.mode, op.facing, blink, op.wave, op.hold?.name, op.armsUp, op.facepalm, op.phase !== undefined ? Math.round(op.phase * 16) : ""].join("|");
  const c: Card[] = [{ key, cw: 600, ch: 1000, draw: (p) => bodyFront(p, o, opts), pos, w: 600 * SU, ay: 0.025 }];
  if (blob && op.mode !== "sit") c.push(contact(pos, 0.8));
  return c;
};
const contact = (pos: V3, w: number): Card => ({ key: "blob", cw: 128, ch: 128, draw: (p) => {
  const g = p.g, gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (const [r, c] of [[0, "#8a7f8f"], [0.45, "#a39aa8"], [0.75, "#d8d2da"], [1, "#ffffff"]] as const) gr.addColorStop(r, c);
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
}, pos: [pos[0], pos[1] + 0.012, pos[2]], w, flat: true, kind: "blob" });
const LION_W = 1.45, GOAT_W = 1.0, GRASS_W = 0.42;
const lion = (pos: V3, expr: LionExpr, mirror: boolean, step = 0): Card[] => [{ key: `lion|${expr}|${Math.round(step * 8)}`, cw: LION_CW, ch: LION_CH, draw: (p) => drawLion(p, expr, Math.round(step * 8) / 8), pos, w: LION_W, ay: 0.06, mirror }, contact(pos, 1.5)];
const goat = (pos: V3, expr: GoatExpr, mirror: boolean, step = 0): Card[] => [{ key: `goat|${expr}|${Math.round(step * 8)}`, cw: GOAT_CW, ch: GOAT_CH, draw: (p) => drawGoat(p, expr, Math.round(step * 8) / 8), pos, w: GOAT_W, ay: 0.06, mirror }, contact(pos, 1.0)];
const grass = (pos: V3, left = 1): Card[] => [{ key: `grass|${Math.round(left * 10)}`, cw: GRASS_CW, ch: GRASS_CH, draw: (p) => drawGrass(p, Math.round(left * 10) / 10), pos, w: GRASS_W, ay: 0.08 }, contact(pos, 0.5)];
const fx = (key: string, cw: number, ch: number, draw: (p: Pen) => void, pos: V3, w: number, kind: Kind = "fx", ay = 0.5): Card => ({ key, cw, ch, draw, pos, w, kind, ay });
const timed = (t: number, t0: number, d: number) => (t < t0 || t >= t0 + d ? null : (t - t0) / d);
const puff = (t: number, t0: number, pos: V3, w: number): Card[] => { const u = timed(t, t0, 0.5); return u === null ? [] : [fx(`puff|${Math.round(u * 12)}`, 300, 300, (p) => fxPuff(p, Math.round(u * 12) / 12), pos, w, "soft")]; };
const burst = (t: number, t0: number, pos: V3, w: number, col = "#ffe46b"): Card[] => { const u = timed(t, t0, 0.35); return u === null ? [] : [fx(`burst|${col}|${Math.round(u * 10)}`, 500, 500, (p) => fxBurst(p, Math.round(u * 10) / 10, col), pos, w)]; };
const popIn = (c: Card[], s: number): Card[] => s <= 0 ? [] : c.map((k) => (k.kind === "blob" ? k : { ...k, w: k.w * s }));

// ---------------- the answer: positions from the trip table ----------------
const NEAR_BOAT = -0.75, FAR_BOAT = -5.85, BOAT_X = 0.3;
const SPOT: Record<"lion" | "goat" | "grass", { near: V3; far: V3 }> = {
  lion: { near: [-1.0, B, 1.3], far: [-0.75, B, -7.6] },
  goat: { near: [-0.15, B, 0.8], far: [0.15, B, -8.0] },
  grass: { near: [0.9, B, 1.25], far: [0.85, B, -7.5] },
};
export const boatZ = (t: number) => {
  let z = NEAR_BOAT;
  for (const tr of TRIPS) {
    if (t < tr.a) break;
    const u = smoother((t - tr.a) / (tr.b - tr.a));
    z = tr.toFar ? lerp(NEAR_BOAT, FAR_BOAT, u) : lerp(FAR_BOAT, NEAR_BOAT, u);
  }
  return z;
};
const boatPos = (t: number): V3 => [BOAT_X, 0.04 + 0.03 * Math.sin(t * 2.2), boatZ(t)];
/** where an animal / the grass is at time t (bank spot, hopping in or out, or riding the boat) */
const whereIs = (who: "lion" | "goat" | "grass", t: number): V3 => {
  let side: "near" | "far" = "near";
  for (const tr of TRIPS) {
    if (tr.who !== who) continue;
    const from = SPOT[who][tr.toFar ? "near" : "far"], to = SPOT[who][tr.toFar ? "far" : "near"];
    if (t < tr.a - 0.35) break;
    const seat = (tt: number) => add([BOAT_X - 0.45, 0, boatZ(tt)], [0, 0.1, -0.05]);
    if (t < tr.a) { const u = (t - (tr.a - 0.35)) / 0.35, p = lerp3(from, seat(tr.a), u); p[1] += 0.35 * Math.sin(Math.PI * u); return p; }
    if (t < tr.b) return seat(t);
    if (t < tr.b + 0.35) { const u = (t - tr.b) / 0.35, p = lerp3(seat(tr.b), to, u); p[1] += 0.35 * Math.sin(Math.PI * u); return p; }
    side = tr.toFar ? "far" : "near";
  }
  return SPOT[who][side];
};
const farmerInBoat = (t: number): V3 => add(boatPos(t), [0.55, 0.06, 0.08]);
const answerCards = (t: number, ex: Partial<{ lion: LionExpr; goat: GoatExpr; farmer: FrontOpts["expr"] }> = {}): Card[] => [
  ...person("farmer", FARMER, 4, farmerInBoat(t), t, { mode: "stand", facing: 0, expr: ex.farmer ?? "neutral", hold: H_POLE }, false),
  ...lion(whereIs("lion", t), ex.lion ?? "neutral", true),
  ...goat(whereIs("goat", t), ex.goat ?? "neutral", false),
  ...grass(whereIs("grass", t)),
];
const WIDE = (t0: number, extra: Parameters<typeof camPath>[0] = []) => camPath([{ t: t0, pos: [0.3, 4.2, 8.0], look: [0.0, 0.2, -3.4], fov: 40 }, ...extra], 0.012);
const FARCAM = camPath([{ t: 0, pos: [0.05, 1.65, -1.7], look: [-0.05, 0.75, -7.6], fov: 40 }], 0.03);

// small scenes inside thought bubbles
const sketchBoat = (p: Pen, who: "lion" | "grass") => {
  p.poly([[150, 330], [550, 330], [500, 400], [200, 400]], "#a8723f", 8);
  const g = p.g; g.save();
  if (who === "lion") { g.translate(210, 150); g.scale(0.42, 0.42); drawLion(new Pen(g), "neutral"); }
  else { g.translate(300, 170); g.scale(0.42, 0.42); drawGrass(new Pen(g)); }
  g.restore();
};
const sketchGoatGrass = (p: Pen) => { const g = p.g; g.save(); g.translate(160, 140); g.scale(0.5, 0.5); drawGoat(new Pen(g), "chew"); g.restore(); g.save(); g.translate(150, 210); g.scale(0.38, 0.38); drawGrass(new Pen(g), 0.3); g.restore(); };
const sketchLionGoat = (p: Pen) => { const g = p.g; g.save(); g.translate(110, 160); g.scale(0.45, 0.45); drawLion(new Pen(g), "chomp"); g.restore(); g.save(); g.translate(380, 190); g.scale(0.42, 0.42); drawGoat(new Pen(g), "shock"); g.restore(); };

// ---------------- word times ----------------
const tSher1 = at("शेर", 1), tBakri1 = at("बकरी", 1), tGhas1 = at("घास", 1), tAur2 = at("और", 2), tEk3 = at("एक", 3), tSher3 = at("शेर", 3), tKha1 = at("खा", 1), tKha2 = at("खा", 2);
const tLekin1 = at("लेकिन", 1), tLekin2 = at("लेकिन", 2), tVideo = at("वीडियो"), tJawab = at("जवाब"), tSaat = at("सात"), tKi3 = at("कि", 3), tPul = at("पुल");

export const PLANS: Record<string, Plan> = {
  hook: {
    cam: camPath([{ t: 0, pos: [0.1, 1.5, 10.5], look: [0.1, 1.0, 3.0], fov: 40 }, { t: tAur2 - 0.05, d: 1.4, pos: [0.6, 3.6, 9.4], look: [0.2, 0.3, -4.0] }], 0.02),
    dof: { cInf: (t) => (t < tAur2 ? 7 : 2), focus: () => [0.1, 1.2, 3.0] },
    boat: (t) => boatPos(t),
    cards: (t) => [
      ...person("farmer", FARMER, 4, [0.1, B, 3.0], t, { mode: "stand", facing: 0, expr: t < tSher1 ? "smile" : "grin" }),
      ...popIn(lion([-0.95, B, 2.55], "neutral", true), pop(t - tSher1)),
      ...popIn(goat([0.95, B, 3.3], "happy", false), pop(t - tBakri1)),
      ...popIn(grass([1.4, B, 3.05]), pop(t - tGhas1)),
      ...puff(t, tSher1, [-0.95, B + 0.3, 2.6], 1.2), ...puff(t, tBakri1, [0.95, B + 0.3, 3.35], 1.0), ...puff(t, tGhas1, [1.4, B + 0.2, 3.1], 0.7),
    ],
  },
  boat: {
    cam: camPath([{ t: 0, pos: [2.8, 2.1, 3.6], look: [0.55, 0.85, -0.8], fov: 40 }], 0.04, [[tEk3, 0.6]]),
    dof: { cInf: () => 8, focus: () => [0.6, 1.0, -0.7] },
    boat: (t) => boatPos(t),
    cards: (t) => [
      ...person("farmer", FARMER, 4, farmerInBoat(t), t, { mode: "stand", facing: 0, expr: t < tEk3 ? "nervous" : "stern", ...(t >= tEk3 ? { wave: 1 } : { hold: H_POLE }) }, false),
      ...popIn(goat([BOAT_X - 0.45, 0.14, -0.8], "happy", false), pop(t - tEk3)),
      ...lion([-1.0, B, 1.3], t > tEk3 + 0.2 ? "bored" : "neutral", true),
    ],
  },
  lionGoat: {
    cam: camPath([{ t: 0, pos: [0.0, 1.15, 7.6], look: [0.05, 0.6, 2.0], fov: 40 }], 0.04, [[tKha1, 1.2]]),
    dof: { cInf: () => 8, focus: () => [0, 0.6, 2.0] },
    cards: (t) => {
      const lunge = smooth((t - tKha1 + 0.1) / 0.2), jump = timed(t, tKha1, 0.5);
      return [
        ...lion([-0.75 + 0.45 * lunge, B, 2.0], t >= tKha1 - 0.1 ? "chomp" : t >= tSher3 ? "hungry" : "neutral", true),
        ...goat([0.75 + 0.25 * lunge, B + (jump !== null ? 0.45 * Math.sin(Math.PI * jump) : 0), 2.05], t >= tSher3 ? (t >= tKha1 ? "shock" : "nervous") : "neutral", false),
        ...burst(t, tKha1, [0.35, B + 0.6, 2.2], 0.9),
      ];
    },
  },
  goatGrass: {
    cam: camPath([{ t: 0, pos: [0.05, 1.05, 6.2], look: [0.05, 0.55, 2.0], fov: 40 }], 0.05),
    dof: { cInf: () => 9, focus: () => [0.1, 0.5, 2.0] },
    cards: (t) => {
      const eat = clamp01((t - tKha2 + 0.6) / 1.6);
      return [...goat([-0.15, B, 2.0], eat > 0 ? "chew" : "smug", true), ...grass([0.55, B, 2.05], 1 - 0.8 * eat)];
    },
  },
  think1: {
    cam: camPath([{ t: 0, pos: [0.3, 1.75, 5.4], look: [0.3, 1.75, 2.0], fov: 40 }], 0.04),
    dof: { cInf: () => 6, focus: () => [0.2, 1.5, 2.0] },
    cards: (t) => [
      ...person("farmer", FARMER, 4, [0.0, B, 2.0], t, { mode: "stand", facing: 1, expr: t >= tLekin1 + 0.6 ? "shock" : "nervous" }),
      ...popIn([fx(`bub1|${t < tLekin1 ? 0 : 1}`, BUBBLE_CW, BUBBLE_CH, (p) => drawBubble(p, t < tLekin1 ? (q) => sketchBoat(q, "lion") : sketchGoatGrass), [0.62, 2.55, 2.0], 1.25)], pop(t - (at("किसान", 2) + 0.3))),
    ],
  },
  think2: {
    cam: camPath([{ t: 0, pos: [0.3, 1.75, 5.4], look: [0.3, 1.75, 2.0], fov: 40 }], 0.04),
    dof: { cInf: () => 6, focus: () => [0.2, 1.5, 2.0] },
    cards: (t) => [
      ...person("farmer", FARMER, 4, [0.0, B, 2.0], t, { mode: "stand", facing: 1, expr: t >= tLekin2 + 0.6 ? "shock" : "nervous" }),
      fx(`bub2|${t < tLekin2 ? 0 : 1}`, BUBBLE_CW, BUBBLE_CH, (p) => drawBubble(p, t < tLekin2 ? (q) => sketchBoat(q, "grass") : sketchLionGoat), [0.62, 2.55, 2.0], 1.25),
    ],
  },
  dizzy: {
    cam: (t, t0) => { const c = camPath([{ t: 0, pos: [0.0, 1.6, 4.4], look: [0.0, 1.45, 2.0], fov: 40 }], 0.06)(t, t0); return { ...c, roll: 0.1 * Math.sin((t - t0) * 6) }; },
    dof: { cInf: () => 8, focus: () => [0, 1.4, 2.0] },
    cards: (t) => [
      ...person("farmer", FARMER, 4, [0.0, B, 2.0], t, { mode: "stand", facing: 0, expr: "dazed" }),
      fx(`stars|${Math.round(((t * 1.2) % 1) * 16)}`, 420, 210, (p) => fxStars(p, Math.round(((t * 1.2) % 1) * 16) / 16), [0, 2.3, 2.05], 0.9),
    ],
  },
  ask: {
    cam: camPath([{ t: 0, pos: [0.0, 1.45, 4.8], look: [0.0, 1.3, 2.0], fov: 40 }], 0.04, [[tVideo, 0.8]]),
    dof: { cInf: () => 7, focus: () => [0, 1.3, 2.0] },
    cards: (t) => {
      const out: Card[] = [...person("farmer", FARMER, 4, [0.0, B, 2.0], t, { mode: "stand", facing: 0, expr: "nervous", armsUp: true })];
      [[-0.55, 2.2], [0.6, 2.35], [0.05, 2.75]].forEach(([x, y], i) => out.push(...popIn([fx("q", 220, 320, drawQuestion, [x, y + 0.05 * Math.sin(t * 3 + i), 2.1], 0.28)], pop(t - (at("तो", 3) + 0.2 + i * 0.25)))));
      out.push(...popIn([fx("pause", 300, 300, drawPause, [0, 1.3, 2.9], 0.55)], pop(t - tVideo + 0.05)));
      return out;
    },
  },
  wide1: {
    cam: camPath([{ t: 0, pos: [0.2, 1.7, 5.0], look: [0.0, 0.8, 0.0], fov: 40 }, { t: tJawab + 0.1, d: 1.3, pos: [0.3, 4.2, 8.0], look: [0.0, 0.2, -3.4] }], 0.01),
    dof: { cInf: () => 0 }, boat: (t) => boatPos(t),
    cards: (t) => answerCards(t),
  },
  nearLionGrass: {
    cam: camPath([{ t: 0, pos: [-0.05, 1.1, 6.2], look: [-0.05, 0.6, 1.25], fov: 40 }], 0.04),
    dof: { cInf: () => 7, focus: () => [0, 0.6, 1.25] }, boat: (t) => boatPos(t),
    cards: (t) => [...lion(whereIs("lion", t), t > at("नहीं", 2) - 0.2 ? "yawn" : "bored", true), ...grass(whereIs("grass", t))],
  },
  wide2: { cam: WIDE(0), dof: { cInf: () => 0 }, boat: (t) => boatPos(t), cards: (t) => answerCards(t) },
  farLionGoat: {
    cam: FARCAM, dof: { cInf: () => 7, focus: () => [-0.5, 0.7, -7.6] }, boat: (t) => boatPos(t),
    cards: (t) => answerCards(t, { lion: "hungry", goat: "nervous", farmer: "nervous" }),
  },
  wide3: { cam: WIDE(0), dof: { cInf: () => 0 }, boat: (t) => boatPos(t), cards: (t) => answerCards(t) },
  farLionGrass: {
    cam: FARCAM, dof: { cInf: () => 7, focus: () => [-0.5, 0.7, -7.6] }, boat: (t) => boatPos(t),
    cards: (t) => answerCards(t, { lion: t > at("मतलब") - 0.3 ? "yawn" : "bored", farmer: "smile" }),
  },
  wide4: { cam: WIDE(0), dof: { cInf: () => 0 }, boat: (t) => boatPos(t), cards: (t) => answerCards(t, { farmer: "smile" }) },
  allSafe: {
    cam: FARCAM, dof: { cInf: () => 6, focus: () => [-0.2, 0.7, -7.4] }, boat: () => [BOAT_X, 0.04, FAR_BOAT],
    cards: (t) => [
      ...person("farmer", FARMER, 4, [0.45, B, -7.1], t, { mode: "stand", facing: 0, expr: "relief_open", armsUp: true }),
      ...lion(SPOT.lion.far, "happy", true), ...goat(SPOT.goat.far, "happy", false), ...grass(SPOT.grass.far),
      ...burst(t, at("सब") + 0.05, [0.0, 1.8, -7.2], 1.4, "#ffd84a"), ...burst(t, at("सब") + 0.3, [0.9, 2.0, -7.1], 1.0, "#ff8fb0"),
    ],
  },
  tired: {
    cam: camPath([{ t: 0, pos: [0.25, 1.15, -3.9], look: [0.2, 0.7, -7.3], fov: 40 }], 0.04, [[tSaat, 0.6]]),
    dof: { cInf: () => 7, focus: () => [0.4, 0.7, -7.0] }, boat: () => [BOAT_X, 0.04, FAR_BOAT],
    cards: (t) => [
      ...person("farmer", FARMER, 4, [0.3, B + 0.02, -7.0], t, { mode: "sit", facing: 0, expr: "dazed" }),
      fx("panic", 300, 300, fxPanic, [0.3, 1.25, -6.95], 0.6),
      ...lion(SPOT.lion.far, "bored", true), ...goat(SPOT.goat.far, "neutral", false), ...grass(SPOT.grass.far),
      ...popIn([fx("badge7", 300, 300, drawBadge7, [0.5, 1.75, -6.9], 0.42)], pop(t - tSaat + 0.05)),
    ],
  },
  bridge: {
    cam: camPath([{ t: 0, pos: [-0.4, 1.5, -5.5], look: [0.6, 1.0, -7.0], fov: 40 }, { t: tKi3 - 0.2, d: 1.0, pos: [-0.4, 1.6, -5.5], look: [BRIDGE_X, 1.1, -3.2], fov: 30 }], 0.0),
    dof: { cInf: () => 0 }, boat: () => [BOAT_X, 0.04, FAR_BOAT],
    cards: (t) => {
      const z = 1.2 - 1.6 * (t - at("फिर", 3)), out: Card[] = [
        ...person("farmer", FARMER, 4, [0.6, B + 0.02, -7.0], t, { mode: "sit", facing: 0, expr: "dazed" }),
        ...person("farmer2", FARMER2, 7, [BRIDGE_X - 0.4, 1.1, z], t, { mode: "stroll", phase: (t * 1.6) % 1, facing: 0, expr: "whistle" }, false),
        ...lion([BRIDGE_X + 0.5, 1.1, z + 1.3], "happy", true, (t * 1.6) % 1), ...goat([BRIDGE_X - 0.3, 1.1, z + 2.4], "happy", true, (t * 1.6) % 1),
        { key: "grass|10", cw: GRASS_CW, ch: GRASS_CH, draw: (p: Pen) => drawGrass(p, 1), pos: [BRIDGE_X - 0.15, 1.1, z + 0.4] as V3, w: GRASS_W, ay: 0.08 },
      ];
      return out;
    },
  },
  shock: {
    cam: camPath([{ t: 0, pos: [0.75, 1.5, -5.2], look: [0.7, 1.35, -7.0], fov: 40 }], 0.08, [[tPul, 1.4]]),
    dof: { cInf: () => 10, focus: () => [0.7, 1.3, -7.0] }, boat: () => [BOAT_X, 0.04, FAR_BOAT],
    cards: (t) => [...person("farmer", FARMER, 4, [0.7, B, -7.0], t, { mode: "stand", facing: 0, expr: "shock", armsUp: true }), ...burst(t, tPul, [0.7, 2.3, -6.9], 1.0)],
  },
};
export { easeOut };
