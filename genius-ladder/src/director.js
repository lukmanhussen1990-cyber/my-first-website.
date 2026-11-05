// Turns the editable TIMELINE into per-frame state: actors, props, camera, captions, SFX words.
import { compileTracks, sampleAll, noise1, lerp, clamp, hash } from './anim.js';
import { poseValues } from './poses.js';
import { CONFIG } from './config.js';

const expandPose = (k) => (k.pose ? { ...poseValues(k.pose), ...(k.j || {}) } : { ...(k.j || {}) });

// Rough fallback when the TTS step has not been run: ~14 characters per second.
function estimateCaptionStarts(caps) {
  const lens = caps.map((c) => c.replace(/[^A-Za-z]/g, '').length + 2);
  const total = lens.reduce((a, b) => a + b, 0);
  const dur = total / 14;
  let acc = 0;
  return { dur, starts: lens.map((l) => { const s = (acc / total) * dur; acc += l; return s; }) };
}

export function autoCaps(text) {
  const words = text.toUpperCase().split(/\s+/).filter(Boolean);
  const out = [];
  for (let i = 0; i < words.length; i += 3) out.push(words.slice(i, i + 3).join(' '));
  return out;
}

export function compileTimeline(TIMELINE, voTiming = {}) {
  const fps = CONFIG.fps;
  let t0 = 0;
  const beats = TIMELINE.map((b) => {
    const beat = { ...b, start: t0, end: t0 + b.dur };
    t0 += b.dur;
    return beat;
  });
  const total = t0;

  // ---- actor/prop key tracks: beat-local times -> absolute times
  const keyLists = {};
  for (const b of beats) {
    for (const [name, keys] of Object.entries(b.keys || {})) {
      const list = (keyLists[name] ||= []);
      const sorted = [...keys].sort((a, c) => a.t - c.t);
      // a hard cut at every beat start: hold each property's first in-beat value from t=0
      const seen = new Set();
      const holds = {};
      for (const k of sorted) {
        const props = { ...expandPose(k), ...k };
        for (const [p, v] of Object.entries(props)) {
          if (['t', 'e', 'j'].includes(p) || seen.has(p)) continue;
          seen.add(p);
          if (k.t > 0) holds[p] = v;
        }
      }
      if (Object.keys(holds).length) list.push({ t: b.start, e: 'step', ...holds });
      for (const k of sorted) list.push({ ...k, t: b.start + k.t, e: k.t === 0 ? 'step' : k.e });
    }
  }
  const tracks = {};
  for (const [name, list] of Object.entries(keyLists)) tracks[name] = compileTracks(list, expandPose);

  // ---- shots
  const shots = [];
  for (const b of beats) {
    const ss = [...(b.shots || [])].sort((a, c) => a.at - c.at);
    ss.forEach((s, i) => {
      const start = b.start + s.at;
      const end = i + 1 < ss.length ? b.start + ss[i + 1].at : b.end;
      shots.push({ ...s, start, end, beat: b.id });
    });
  }

  // ---- impacts: freeze frames + camera shake
  const freezes = [], shakes = [];
  for (const b of beats) for (const im of b.impacts || []) {
    const at = b.start + im.at;
    const fz = (im.freeze ?? 4) / fps;
    if (fz > 0) freezes.push({ start: at, end: at + fz });
    shakes.push({ start: at + fz, dur: im.shake ?? 0.4, amp: im.amp ?? 0.08, seed: at * 13.7 });
  }

  // ---- captions (synced to the narration timing produced by scripts/tts.mjs)
  const captions = [];
  const voClips = [];
  for (const b of beats) {
    (b.vo || []).forEach((seg, si) => {
      const caps = seg.caps || autoCaps(seg.text);
      const key = `${b.id}#${si}`;
      const timing = voTiming[key] || estimateCaptionStarts(caps);
      const segStart = b.start + seg.at;
      voClips.push({ key, start: segStart, dur: timing.dur, file: timing.file });
      caps.forEach((text, i) => captions.push({ text, start: segStart + timing.starts[i], segEnd: segStart + timing.dur, beatEnd: b.end, style: seg.style || b.captionStyle }));
    });
  }
  captions.sort((a, c) => a.start - c.start);
  captions.forEach((c, i) => {
    const next = captions[i + 1];
    c.end = Math.min(next ? next.start : Infinity, c.beatEnd, c.segEnd + 1.2);
  });

  // ---- sfx words + sounds, particle bursts
  const sfx = [];
  const bursts = [];
  for (const b of beats) {
    (b.sfx || []).forEach((e, i) => sfx.push({ ...e, t0: b.start + e.at, seed: hash(b.start + i) * 100, beat: b.id }));
    (b.bursts || []).forEach((e) => bursts.push({ ...e, at: b.start + e.at }));
  }

  return { beats, total, tracks, shots, freezes, shakes, captions, voClips, sfx, bursts, frames: Math.round(total * fps) };
}

// content time: everything (actors, props, camera push) holds during a freeze
export function contentTime(tl, t) {
  for (const f of tl.freezes) if (t >= f.start && t < f.end) return f.start;
  return t;
}

export function sampleActors(tl, ct) {
  const out = {};
  for (const [name, tracks] of Object.entries(tl.tracks)) out[name] = sampleAll(tracks, ct);
  return out;
}

export function activeShot(tl, t) {
  let s = tl.shots[0];
  for (const sh of tl.shots) if (sh.start <= t + 1e-6) s = sh;
  return s;
}

export function shakeAt(tl, t) {
  let x = 0, y = 0, roll = 0;
  for (const s of tl.shakes) {
    const u = (t - s.start) / s.dur;
    if (u < 0 || u > 1) continue;
    const a = s.amp * Math.pow(1 - u, 2);
    x += a * noise1(t * 38, s.seed);
    y += a * noise1(t * 41, s.seed + 5);
    roll += a * 0.6 * noise1(t * 33, s.seed + 9);
  }
  return { x, y, roll };
}

export function inFreeze(tl, t) {
  return tl.freezes.some((f) => t >= f.start && t < f.end);
}

export function activeCaption(tl, t) {
  for (const c of tl.captions) if (t >= c.start && t < c.end) return c;
  return null;
}

export { lerp, clamp };
