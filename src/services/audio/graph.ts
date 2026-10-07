/*
 * The mixing graph shared by every sound:
 *
 *   sfx voices ──► sfxBus ───┐
 *        │ └──► echo (ping-pong-ish feedback delay) ──► sfxBus
 *        └────► sfxWet ──┐   │
 *   ambience ──► musicBus ┼──┼──► master ──► compressor ──► soft clip ──► destination
 *        └────► musicWet ┘   │
 *              (pre-verb EQ) ─► convolver reverb ─► return ─┘
 *
 * Works with any BaseAudioContext, so the same graph can be rendered offline.
 * Live, the heavy one-time buffers (full white-noise loop, reverb impulse,
 * ambience beds) are built after the unlocking gesture, a few milliseconds at
 * a time (`warmUp`, `loadBeds`), so the first tap never stalls: until they
 * land, transients loop a short noise seed and the reverb is simply dry.
 */
import {
  driveCurve,
  dropsBuffer,
  dropsJob,
  idle,
  impulseJob,
  impulseResponse,
  noiseBuffer,
  noiseJob,
  runSliced,
  softClipCurve,
} from './dsp';

const IR_SECONDS = 2.2;
const WHITE_SECONDS = 2;
/** Noise seed generated inside the unlocking gesture — enough for any click or swish. */
const WHITE_SEED_SECONDS = 0.25;

export interface Beds {
  pink: AudioBuffer;
  brown: AudioBuffer;
  drops: AudioBuffer;
}

export interface Graph {
  ctx: BaseAudioContext;
  /** Master volume (settings.volume). */
  master: GainNode;
  comp: DynamicsCompressorNode;
  /** UI / game effects (settings.sound). */
  sfxBus: GainNode;
  /** Ambient soundscape (settings.music). */
  musicBus: GainNode;
  /** Reverb sends — gated together with their bus so muting also mutes the wet. */
  sfxWet: GainNode;
  musicWet: GainNode;
  /** Feedback-delay send for sfx (radar ping). */
  echo: GainNode;
  /** Shared hall reverb (its buffer may arrive after start-up — see `warmUp`). */
  reverb: ConvolverNode;
  /** 2 s of white noise, reused by every transient (a short seed until `warmUp` swaps it). */
  white: AudioBuffer;
  /** Ambience beds — generated on first use. */
  beds: Beds | null;
}

/**
 * Build the mixing graph. `lazy` keeps the build tiny for a user gesture: the
 * convolver starts empty (dry) and the white-noise loop is a short seed; the
 * caller completes both off the critical path with `warmUp`.
 */
export function buildGraph(ctx: BaseAudioContext, destination: AudioNode = ctx.destination, lazy = false): Graph {
  // Final safety: a soft clipper that is transparent at normal levels and
  // guarantees the output never exceeds full scale when many sounds stack.
  const clip = ctx.createWaveShaper();
  clip.curve = softClipCurve();
  clip.oversample = '2x';
  clip.connect(destination);
  const trim = ctx.createGain();
  trim.gain.value = 0.9 * 0.5; // ×0.5 maps the clipper's ±2 input domain
  trim.connect(clip);

  // Gentle glue + safety: catches stacked transients without pumping the bed.
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.knee.value = 12;
  comp.ratio.value = 3.5;
  comp.attack.value = 0.004;
  comp.release.value = 0.24;
  comp.connect(trim);

  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(comp);

  const sfxBus = ctx.createGain();
  sfxBus.gain.value = 0;
  sfxBus.connect(master);
  const musicBus = ctx.createGain();
  musicBus.gain.value = 0;
  musicBus.connect(master);

  // Reverb: band-limit what goes in so the tail stays dark and never muddy.
  const verbHp = ctx.createBiquadFilter();
  verbHp.type = 'highpass';
  verbHp.frequency.value = 160;
  const verbLp = ctx.createBiquadFilter();
  verbLp.type = 'lowpass';
  verbLp.frequency.value = 5200;
  const reverb = ctx.createConvolver();
  if (!lazy) reverb.buffer = impulseResponse(ctx, IR_SECONDS);
  const verbReturn = ctx.createGain();
  verbReturn.gain.value = 0.85;
  verbHp.connect(verbLp).connect(reverb).connect(verbReturn).connect(master);

  const sfxWet = ctx.createGain();
  sfxWet.gain.value = 0;
  sfxWet.connect(verbHp);
  const musicWet = ctx.createGain();
  musicWet.gain.value = 0;
  musicWet.connect(verbHp);

  // Echo: 340 ms feedback delay, each repeat darker and slightly saturated.
  const echo = ctx.createGain();
  const delay = ctx.createDelay(1);
  delay.delayTime.value = 0.34;
  const fbLp = ctx.createBiquadFilter();
  fbLp.type = 'lowpass';
  fbLp.frequency.value = 2600;
  const fbHp = ctx.createBiquadFilter();
  fbHp.type = 'highpass';
  fbHp.frequency.value = 280;
  const fbSat = ctx.createWaveShaper();
  fbSat.curve = driveCurve(1.2);
  const feedback = ctx.createGain();
  feedback.gain.value = 0.5;
  const echoOut = ctx.createGain();
  echoOut.gain.value = 0.62;
  const echoWet = ctx.createGain();
  echoWet.gain.value = 0.5;
  echo.connect(delay);
  delay.connect(fbLp).connect(fbHp).connect(fbSat).connect(feedback).connect(delay);
  delay.connect(echoOut).connect(sfxBus);
  echoOut.connect(echoWet).connect(sfxWet);

  return {
    ctx,
    master,
    comp,
    sfxBus,
    musicBus,
    sfxWet,
    musicWet,
    echo,
    reverb,
    white: noiseBuffer(ctx, lazy ? WHITE_SEED_SECONDS : WHITE_SECONDS, 'white'),
    beds: null,
  };
}

/**
 * Complete a lazy graph: the full white-noise loop and the reverb impulse are
 * generated in slices; the impulse is then handed to the convolver while the
 * page is idle (its FFT set-up is the one step that cannot be split).
 */
export async function warmUp(g: Graph): Promise<void> {
  if (g.white.duration < WHITE_SECONDS) g.white = await runSliced(noiseJob(g.ctx, WHITE_SECONDS, 'white'));
  if (g.reverb.buffer) return;
  const ir = await runSliced(impulseJob(g.ctx, IR_SECONDS));
  await idle();
  if (!g.reverb.buffer) g.reverb.buffer = ir;
}

// Ambience bed loops: pink / brown / rain drops (≈ 1.7 MB at 48 kHz, generated once).
const BED_SPEC = { pink: 3.3, brown: 2.9, drops: 2.7, dropsPerSecond: 70 } as const;

/** Ambience beds, generated synchronously (offline rendering). */
export function beds(g: Graph): Beds {
  g.beds ??= {
    pink: noiseBuffer(g.ctx, BED_SPEC.pink, 'pink'),
    brown: noiseBuffer(g.ctx, BED_SPEC.brown, 'brown'),
    drops: dropsBuffer(g.ctx, BED_SPEC.drops, BED_SPEC.dropsPerSecond),
  };
  return g.beds;
}

/** Ambience beds, generated a few milliseconds at a time (live start-up). */
export async function loadBeds(g: Graph): Promise<Beds> {
  if (!g.beds) {
    const pink = await runSliced(noiseJob(g.ctx, BED_SPEC.pink, 'pink'));
    const brown = await runSliced(noiseJob(g.ctx, BED_SPEC.brown, 'brown'));
    const drops = await runSliced(dropsJob(g.ctx, BED_SPEC.drops, BED_SPEC.dropsPerSecond));
    g.beds ??= { pink, brown, drops };
  }
  return g.beds;
}
