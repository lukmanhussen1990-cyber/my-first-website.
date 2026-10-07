/*
 * Live engine: owns the AudioContext, the voice pool, settings sync, the
 * ambience state machine and page-lifecycle handling. Everything degrades to
 * a silent no-op when Web Audio is unavailable.
 *
 * Start-up cost: `unlock()` runs inside the user's first tap, so it only builds
 * the node graph and a short white-noise seed. The full noise loop, the reverb
 * impulse and the ambience beds are generated afterwards in small slices
 * (graph.ts), and the soundscape starts once its beds exist.
 */
import { getSettings } from '../../state/settings';
import type { Ambience, Sfx } from '../audio';
import { Soundscape } from './ambience';
import { approach, clamp } from './dsp';
import { buildGraph, loadBeds, warmUp, type Graph } from './graph';
import { SFX, SFX_GAIN } from './sfx';
import { Voice } from './voice';

const MAX_VOICES = 24;
const RETRIGGER_MS = 30;
/** A sound queued while the context was still starting is dropped if older than this. */
const STALE_MS = 250;

interface Active {
  v: Voice;
  wall: number;
  queued: boolean;
}

let ctx: AudioContext | null = null;
let graph: Graph | null = null;
let unsupported = false;
let lastResumeAt = -Infinity;
let wanted: Ambience | null = null;
/** The soundscape — kept while it fades out after a stop, so a quick restart can revive it. */
let scape: Soundscape | null = null;
let bedsLoading: Promise<unknown> | null = null;
/** Soundscapes created so far (a revived one is not new) — for tests. */
let generation = 0;
const active: Active[] = [];
const lastPlayed = new Map<string, number>();

type ContextCtor = typeof AudioContext;

function contextCtor(): ContextCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: ContextCtor; webkitAudioContext?: ContextCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

const noop = () => {};

/** Run a context method that returns a promise on modern engines and nothing on very old WebKit. */
function settle(call: () => Promise<void> | undefined): void {
  try {
    const p = call();
    if (p && typeof p.catch === 'function') p.catch(noop);
  } catch {
    /* invalid state (closed context) — nothing to do */
  }
}

function resume(): void {
  if (!ctx || ctx.state === 'closed') return;
  lastResumeAt = performance.now();
  const c = ctx;
  settle(() => c.resume());
}

/** True when a sound scheduled now will actually be heard (or about to be). */
function audible(c: AudioContext): boolean {
  if (c.state === 'running') return true;
  if (c.state === 'closed' || document.hidden) return false;
  // Still starting inside a user gesture: queue it, it plays once resumed.
  const ua = (navigator as { userActivation?: UserActivation }).userActivation;
  return Boolean(ua?.isActive) || performance.now() - lastResumeAt < 150;
}

function onStateChange(): void {
  if (!ctx) return;
  if (ctx.state === 'running') {
    const now = performance.now();
    for (const a of [...active]) {
      if (!a.queued) continue;
      if (now - a.wall > STALE_MS) a.v.dispose();
      else a.queued = false;
    }
    reconcileAmbience();
  }
}

function onVisibility(): void {
  if (!ctx) return;
  if (document.hidden) {
    const c = ctx;
    if (c.state === 'running') settle(() => c.suspend());
  } else {
    resume();
  }
}

/** Any later gesture re-arms a context that the OS or browser suspended (iOS interruptions). */
function onGesture(): void {
  if (ctx && ctx.state !== 'running' && !document.hidden) resume();
}

const GESTURES = ['pointerup', 'touchend', 'keydown'] as const;

function installLifecycle(): void {
  document.addEventListener('visibilitychange', onVisibility);
  for (const type of GESTURES) window.addEventListener(type, onGesture, { capture: true, passive: true });
}

function removeLifecycle(): void {
  document.removeEventListener('visibilitychange', onVisibility);
  for (const type of GESTURES) window.removeEventListener(type, onGesture, { capture: true });
}

function applySettings(immediate: boolean): void {
  if (!ctx || !graph) return;
  const s = getSettings();
  const t = ctx.currentTime;
  const set = (param: AudioParam, value: number, tc: number) => {
    if (immediate) {
      param.cancelScheduledValues(t);
      param.setValueAtTime(value, t);
    } else {
      approach(param, t, value, tc);
    }
  };
  const vol = clamp(Number.isFinite(s.volume) ? s.volume : 0.8, 0, 1);
  set(graph.master.gain, vol * vol, 0.06); // perceptual taper
  const fx = s.sound ? 1 : 0;
  set(graph.sfxBus.gain, fx, 0.03);
  set(graph.sfxWet.gain, fx, 0.03);
  const mu = s.music ? 1 : 0;
  set(graph.musicBus.gain, mu, 0.35);
  set(graph.musicWet.gain, mu, 0.35);
}

function reconcileAmbience(): void {
  if (!ctx || !graph) return;
  const kind = wanted && getSettings().music ? wanted : null;
  if (!kind) {
    scape?.stop(); // fades out; released by itself unless revived meanwhile
    return;
  }
  if (scape?.revive(kind)) return;
  scape = null;
  if (!graph.beds) {
    // First soundscape: build its noise beds off the critical path, then come back.
    const g = graph;
    bedsLoading ??= loadBeds(g).then(
      () => {
        if (graph === g) reconcileAmbience();
      },
      () => {
        bedsLoading = null;
      },
    );
    return;
  }
  scape = new Soundscape(graph, kind);
  generation++;
}

/** iOS / iPadOS 16.4+: mix with the player's own music and honour the silent switch, like a game should. */
function configureAudioSession(): void {
  try {
    const session = (navigator as { audioSession?: { type: string } }).audioSession;
    if (session && session.type === 'auto') session.type = 'ambient';
  } catch {
    /* not supported */
  }
}

/** Free voices whose end event never arrived (defensive; should not happen). */
function prune(now: number): void {
  for (const a of [...active]) if (a.v.end < now - 1) a.v.dispose();
}

/* ── Public engine API (wrapped by services/audio.ts) ───────────────────── */

export function unlock(): void {
  if (unsupported) return;
  if (!ctx) {
    const Ctor = contextCtor();
    if (!Ctor) {
      unsupported = true;
      return;
    }
    configureAudioSession();
    try {
      ctx = new Ctor({ latencyHint: 'interactive' });
      graph = buildGraph(ctx, ctx.destination, true);
    } catch {
      unsupported = true;
      const c = ctx;
      if (c) settle(() => c.close());
      ctx = null;
      graph = null;
      return;
    }
    ctx.addEventListener('statechange', onStateChange);
    applySettings(true);
    installLifecycle();
    warmUp(graph).catch(noop);
  }
  if (ctx.state !== 'running' && !document.hidden) resume();
  reconcileAmbience();
}

export function play(sfx: Sfx, opts?: { volume?: number; pitch?: number }): void {
  if (!ctx || !graph || !getSettings().sound) return;
  const design = SFX[sfx];
  if (!design || !audible(ctx)) return;

  const finite = (x: number | undefined, fallback: number) => (x !== undefined && Number.isFinite(x) ? x : fallback);
  const pitch = clamp(finite(opts?.pitch, 1), 0.25, 4);
  const key = pitch === 1 ? sfx : `${sfx}@${pitch.toFixed(3)}`;
  const wall = performance.now();
  const prev = lastPlayed.get(key);
  if (prev !== undefined && wall - prev < RETRIGGER_MS) return;
  if (lastPlayed.size > 64) lastPlayed.clear();
  lastPlayed.set(key, wall);

  const level = clamp(finite(opts?.volume, 1), 0, 2) * SFX_GAIN[sfx];
  if (level <= 0) return;

  const now = ctx.currentTime;
  const running = ctx.state === 'running';
  prune(now);
  // Sounds queued behind a context that never started are dropped once stale
  // (they would be on resume anyway), so a stuck context cannot accumulate nodes.
  if (!running) for (const a of [...active]) if (a.queued && wall - a.wall > STALE_MS) a.v.dispose();
  // Voice cap: steal the oldest with a very short fade (or at once if it is not sounding yet —
  // a release fade would never complete on a suspended clock).
  while (active.length >= MAX_VOICES) {
    const oldest = active.shift();
    if (!oldest) break;
    oldest.v.onDispose = null;
    if (oldest.queued || !running) oldest.v.dispose();
    else oldest.v.release(0.02, now);
  }

  const v = new Voice(graph, graph.sfxBus, graph.sfxWet, now + 0.004, pitch, level);
  try {
    design(v);
  } catch (err) {
    v.dispose();
    if (import.meta.env.DEV) console.warn(`[audio] failed to build "${sfx}"`, err);
    return;
  }
  const entry: Active = { v, wall, queued: !running };
  active.push(entry);
  v.onDispose = () => {
    const i = active.indexOf(entry);
    if (i >= 0) active.splice(i, 1);
  };
  v.seal();
  if (sfx === 'heartbeat') scape?.duckHeartbeat();
}

export function startAmbience(kind: Ambience): void {
  wanted = kind;
  reconcileAmbience();
}

export function stopAmbience(): void {
  wanted = null;
  reconcileAmbience();
}

export function sync(): void {
  applySettings(false);
  reconcileAmbience();
}

/** Snapshot for debugging and tests. */
export function inspect(): {
  supported: boolean;
  state: AudioContextState | 'none';
  voices: number;
  ambience: Ambience | null;
  wanted: Ambience | null;
  reverb: boolean;
  beds: boolean;
  layers: Soundscape['layers'] | null;
  generation: number;
} {
  return {
    supported: !unsupported && contextCtor() !== null,
    state: ctx?.state ?? 'none',
    voices: active.length,
    ambience: scape?.active ? scape.kind : null,
    wanted,
    reverb: Boolean(graph?.reverb.buffer),
    beds: Boolean(graph?.beds),
    layers: scape?.layers ?? null,
    generation,
  };
}

// Dev-only console / test hook (stripped from production builds).
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { __btAudio?: unknown }).__btAudio = { inspect, unlock, play, startAmbience, stopAmbience, sync };
}

// Dev HMR: never leave an orphaned AudioContext running behind a hot update.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    removeLifecycle();
    scape?.dispose();
    scape = null;
    const c = ctx;
    if (c) settle(() => c.close());
  });
}
