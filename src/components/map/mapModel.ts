/*
 * Pure helpers for the survival map: pin kinds, the player's position,
 * zone counts and the label-side layout. No React, no DOM.
 */
import { getChallenge } from '../../data/challenges';
import type { Challenge, PlayerProgress, Zone } from '../../data/types';
import { ZONES } from '../../data/zones';
import { zoneStatus } from '../../state/selectors';

/** Artwork size (src/assets/art/map-city.webp). */
export const MAP_W = 1800;
export const MAP_H = 2400;
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 2.4;

/** What a plotted zone pin shows. `discovered` = revealed hidden zone not yet played. */
export type PinKind = 'locked' | 'available' | 'completed' | 'discovered';

export const PIN_LABEL: Record<PinKind, string> = {
  locked: 'Locked',
  available: 'Available',
  completed: 'Completed',
  discovered: 'Discovered',
};

export const PIN_TONE: Record<PinKind, 'red' | 'amber' | 'green' | 'neutral'> = {
  locked: 'neutral',
  available: 'amber',
  completed: 'green',
  discovered: 'red',
};

export function zoneChallenges(z: Zone): Challenge[] {
  return z.challengeIds.map((id) => getChallenge(id)).filter((c): c is Challenge => !!c);
}

/** Pin kind for a zone, or null when the zone is still hidden (not plotted). */
export function pinKind(z: Zone, p: PlayerProgress): PinKind | null {
  const st = zoneStatus(z, p);
  if (st === 'hidden') return null;
  if (z.hidden) {
    const played = z.challengeIds.some((id) => (p.challenges[id]?.attempts ?? 0) > 0);
    if (!played) return 'discovered';
  }
  return st;
}

/** The player's current location: the zone of the most recent trial, else the crossing. */
export function currentZoneId(p: PlayerProgress): string {
  for (const h of p.history) {
    const zone = ZONES.find((z) => z.id === getChallenge(h.challengeId)?.zoneId);
    if (zone && zoneStatus(zone, p) !== 'hidden') return zone.id;
  }
  return 'crossing';
}

export function zonesCleared(p: PlayerProgress): { cleared: number; total: number } {
  return { cleared: ZONES.filter((z) => zoneStatus(z, p) === 'completed').length, total: ZONES.length };
}

/** The next hidden zone still waiting to be found (lowest level first). */
export function nextHiddenZone(p: PlayerProgress): Zone | undefined {
  return ZONES.filter((z) => z.hidden && !p.revealedZones.includes(z.id)).sort((a, b) => a.unlockLevel - b.unlockLevel)[0];
}

/* ── Label layout ─────────────────────────────────────────────────
 * Each pin has a fixed marker over its anchor and a label chip that sits to
 * the right or the left — or folds away when neither side is clean (classic
 * map label culling: the marker always stays, zoom in and the label returns).
 * Slots are solved in screen space whenever the camera comes to rest (never
 * per frame): chips must not run off the visible viewport, sit under the
 * floating HUD, overlap each other or hide other markers. A switching cost
 * keeps labels where they are unless moving them clearly helps.
 */

/** Pin geometry in CSS px relative to the anchor point (see ZonePin.module.css). */
export const PIN_GEOM = {
  markerHalfW: 17,
  markerTop: -54,
  chipTop: -50,
  chipBottom: -16,
  /** chip starts this far past the anchor (it tucks under the marker) */
  chipInset: 4,
};

/** Highest zone on the art (fraction of its height) — the camera keeps headroom for its marker. */
export const TOP_ANCHOR = Math.min(...ZONES.map((z) => z.y)) / 100;

export type LabelSide = 'right' | 'left';

export interface LabelSlot {
  side: LabelSide;
  /** label folded away (marker only) */
  hidden: boolean;
}

export interface Box {
  l: number;
  r: number;
  t: number;
  b: number;
}

const overlap = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));

export interface LayoutPin {
  id: string;
  /** anchor in viewport px */
  x: number;
  y: number;
  /** measured chip width */
  w: number;
  /** higher keeps its label first */
  priority: number;
}

export interface LayoutFrame {
  /** visible viewport size in px */
  w: number;
  h: number;
  /** screen areas covered by floating UI (viewport px) */
  obstacles?: Box[];
}

const EDGE_PAD = 6;
/** per px of chip cut off by the viewport edge — clipped text reads as broken */
const OFF_EDGE = 300;
/** per px² of chip over another chip (text on text), another marker, or the HUD */
const OVER_CHIP = 2.5;
const OVER_MARKER = 1.5;
const OVER_HUD = 2;
/** folding a label away: worth it only when both sides are clearly bad */
const HIDE_BASE = 2000;
const HIDE_PER_PRIORITY = 300;
/** moving a label that is already placed */
const SWITCH = 700;
/** pins this far outside the viewport still take part (their chips can reach in) */
const NEAR = 180;
/** search budget (nodes) — past it the best answer found so far stands (≥ the greedy one) */
const BUDGET = 30_000;

const RIGHT = 0;
const LEFT = 1;
const HIDDEN = 2;

const slotOf = (st: number, prev?: LabelSlot): LabelSlot =>
  st === HIDDEN ? { side: prev?.side ?? 'right', hidden: true } : { side: st === LEFT ? 'left' : 'right', hidden: false };
const stateOf = (slot: LabelSlot): number => (slot.hidden ? HIDDEN : slot.side === 'left' ? LEFT : RIGHT);

export function layoutLabels(pins: LayoutPin[], frame: LayoutFrame, current: Record<string, LabelSlot> = {}): Record<string, LabelSlot> {
  const g = PIN_GEOM;
  const out: Record<string, LabelSlot> = { ...current };
  // only pins on or near the screen are solved; the rest keep their slot
  const live = pins
    .filter((p) => p.x > -NEAR - p.w && p.x < frame.w + NEAR + p.w && p.y > -NEAR && p.y < frame.h + NEAR - g.markerTop)
    .sort((a, b) => b.priority - a.priority || a.y - b.y);
  const n = live.length;
  if (n === 0) return out;

  const markers: Box[] = live.map((p) => ({ l: p.x - g.markerHalfW, r: p.x + g.markerHalfW, t: p.y + g.markerTop, b: p.y }));
  const chips: [Box, Box][] = live.map((p) => [
    { l: p.x - g.chipInset, r: p.x + p.w - g.chipInset, t: p.y + g.chipTop, b: p.y + g.chipBottom },
    { l: p.x - p.w + g.chipInset, r: p.x + g.chipInset, t: p.y + g.chipTop, b: p.y + g.chipBottom },
  ]);
  const obstacles = frame.obstacles ?? [];

  // own cost of each state: a small bias to the right, staying put, covering other
  // markers or the HUD, and being cut off by the viewport edge; or folding away
  const own = live.map((p, i) => {
    const was = current[p.id];
    const costs = [0, 0, HIDE_BASE + p.priority * HIDE_PER_PRIORITY];
    for (let side = 0; side < 2; side++) {
      const box = chips[i][side];
      let c = side * 40;
      for (let j = 0; j < n; j++) if (j !== i) c += overlap(box, markers[j]) * OVER_MARKER;
      for (const o of obstacles) c += overlap(box, o) * OVER_HUD;
      if (box.r > frame.w - EDGE_PAD) c += (box.r - frame.w + EDGE_PAD) * OFF_EDGE;
      if (box.l < EDGE_PAD) c += (EDGE_PAD - box.l) * OFF_EDGE;
      costs[side] = c;
    }
    if (was) for (let st = 0; st < 3; st++) if (st !== stateOf(was)) costs[st] += SWITCH;
    return costs;
  });
  // pairwise chip overlaps (a folded label overlaps nothing): pair[((i * 2 + si) * n + j) * 2 + sj], i < j
  const pair = new Float64Array(n * n * 4);
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      for (let si = 0; si < 2; si++)
        for (let sj = 0; sj < 2; sj++) pair[((i * 2 + si) * n + j) * 2 + sj] = overlap(chips[i][si], chips[j][sj]) * OVER_CHIP;
  const pairCost = (i: number, si: number, j: number, sj: number) => {
    if (si === HIDDEN || sj === HIDDEN) return 0;
    return i < j ? pair[((i * 2 + si) * n + j) * 2 + sj] : pair[((j * 2 + sj) * n + i) * 2 + si];
  };

  // greedy start (pins are in priority order)
  const greedy: number[] = [];
  let greedyCost = 0;
  for (let i = 0; i < n; i++) {
    let bestSt = 0;
    let bestC = Infinity;
    for (let st = 0; st < 3; st++) {
      let c = own[i][st];
      for (let j = 0; j < i; j++) c += pairCost(i, st, j, greedy[j]);
      if (c < bestC) {
        bestC = c;
        bestSt = st;
      }
    }
    greedy.push(bestSt);
    greedyCost += bestC;
  }

  // exact branch-and-bound over right / left / hidden, seeded with the greedy answer;
  // bound = cost so far + the cheapest own cost of every pin still to place (pairs are ≥ 0)
  const rest = new Float64Array(n + 1);
  for (let i = n - 1; i >= 0; i--) rest[i] = rest[i + 1] + Math.min(own[i][0], own[i][1], own[i][2]);
  let best = greedyCost;
  let bestStates = greedy.slice();
  const states: number[] = new Array(n).fill(0);
  let nodes = 0;
  const dfs = (i: number, partial: number) => {
    if (partial + rest[i] >= best || ++nodes > BUDGET) return;
    if (i === n) {
      best = partial;
      bestStates = states.slice();
      return;
    }
    // try the greedy pick first: tight bounds early
    for (let k = 0; k < 3; k++) {
      const st = (greedy[i] + k) % 3;
      let c = own[i][st];
      for (let j = 0; j < i; j++) c += pairCost(i, st, j, states[j]);
      states[i] = st;
      dfs(i + 1, partial + c);
    }
  };
  dfs(0, 0);

  live.forEach((p, i) => (out[p.id] = slotOf(bestStates[i], current[p.id])));
  return out;
}

export const PIN_PRIORITY: Record<PinKind, number> = { available: 4, discovered: 3, completed: 2, locked: 1 };
