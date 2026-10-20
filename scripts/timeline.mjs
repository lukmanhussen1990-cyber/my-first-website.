// Build build/timeline.json from the story + the real lengths/word timings of the cached voice lines.
// Every scene lasts: preroll + its voice lines (+ LINE_GAP between them) + SCENE_PADDING,
// or a fixed `duration` for scenes without narration. Renderer and audio mix both read this file.
import fs from 'node:fs';
import { SCENES, LINES, FPS, WIDTH, HEIGHT, SCENE_PADDING, LINE_GAP } from '../src/story.js';
import { P } from './config.mjs';

const STIR_PERIOD = 1.2; // seconds per stirring circle (animation + spoon sfx share it)
const LAUGH_LEN = 2.6;

function loadLine(id) {
  const f = P('audio', 'vo', `${id}.json`);
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  if (process.env.ALLOW_MISSING_VO === '1') {
    console.warn(`  ! ${id} has no cached audio yet - using a 2.2s placeholder (preview only)`);
    const words = LINES[id].text.split(/\s+/);
    return { id, duration: 2.2, missing: true, words: words.map((w, i) => ({ word: w, start: (i * 2.0) / words.length, end: ((i + 1) * 2.0) / words.length })) };
  }
  throw new Error(`voice line ${id} is not cached (run npm run voice)`);
}

export function buildTimeline() {
  let t = 0;
  const scenes = [];
  for (const sc of SCENES) {
    const start = t;
    let cur = start + (sc.preroll || 0);
    const lines = sc.lines.map((id, i) => {
      if (i > 0) cur += LINE_GAP;
      const meta = loadLine(id);
      const L = {
        id, speaker: LINES[id].speaker, fx: LINES[id].fx || null, text: LINES[id].text,
        start: +cur.toFixed(3), duration: meta.duration, end: +(cur + meta.duration).toFixed(3),
        missing: !!meta.missing, fallback: !!meta.fallback, displayText: meta.displayText || null,
        words: meta.words.map((w) => ({ word: w.word, start: +(cur + w.start).toFixed(3), end: +(cur + w.end).toFixed(3) })),
      };
      cur += meta.duration;
      return L;
    });
    const end = sc.lines.length ? Math.max(cur + SCENE_PADDING, start + (sc.minDuration || 0)) : start + sc.duration;
    const at = (spec) => {
      if (!spec) return null;
      if (spec.time !== undefined) return +(start + spec.time).toFixed(3);
      const L = lines.find((l) => l.id === spec.line);
      return L.words[Math.min(spec.word, L.words.length - 1)].start;
    };
    const lineById = (id) => lines.find((l) => l.id === id);
    scenes.push({
      id: sc.id, key: sc.key, start: +start.toFixed(3), end: +end.toFixed(3), duration: +(end - start).toFixed(3),
      lines,
      caption: sc.caption ? { text: sc.caption.text, red: sc.caption.red, start: at(sc.caption.at), end: +end.toFixed(3) } : null,
      bubble: sc.bubble ? {
        text: lineById(sc.bubble.line).displayText || sc.bubble.text, speaker: sc.bubble.speaker,
        start: +(lineById(sc.bubble.line).start - 0.08).toFixed(3),
        end: +(sc.key === 'turn' ? (lines[1] ? lines[1].start + 0.6 : end) : end).toFixed(3),
        words: lineById(sc.bubble.line).words,
      } : null,
      scare: sc.scare ? (sc.scare.at !== undefined ? +(start + sc.scare.at).toFixed(3) : at(sc.scare)) : null,
      choice: !!sc.choice,
    });
    t = end;
  }
  const S = Object.fromEntries(scenes.map((s) => [s.key, s]));
  const duration = +t.toFixed(3);

  // Cartoon gags -> canned laughter bursts (scene-relative times). None during tension beats.
  const gagPlan = { normal: [0.15, 3.7], dinner: [2.4], phone: [5.6], who: [0.7], humming: [4.0], turn: [3.6], choice: [1.6, 4.8], twist: [0.15] };
  const laughs = [];
  for (const [key, rel] of Object.entries(gagPlan)) for (const r of rel) {
    const s = S[key];
    if (!s) continue;
    laughs.push({ gag: +(s.start + r).toFixed(3), start: +(s.start + r + 0.45).toFixed(3), duration: LAUGH_LEN, intensity: key === 'normal' ? 1 : 0.85 });
  }

  const L05 = S.humming.lines.find((l) => l.id === 'L05');
  const word = (L, i) => L.words[i];
  const events = {
    stirPeriod: STIR_PERIOD,
    humStart: S.dinner.start - 0.6,
    humStop: S.humming.start - 0.05,
    stirStop: word(L05, 4).start, // "stirring" -> the spoon stops while he says it
    clockInsert: [word(L05, 6).start - 0.15, S.humming.end],
    phoneBuzz: [S.phone.start + 0.05, S.phone.start + 1.25],
    phoneCard: S.phone.lines[1].start - 0.25,
    droneStart: S.who.start,
    silence: [S.texting.start, S.texting.lines[0].start + 0.02],
    doorbell: S.doorbell.start + 0.02,
    scares: scenes.filter((s) => s.scare !== null).map((s) => s.scare),
    armLift: [S.shadow.start + 0.25, S.shadow.start + 1.7],
    turn: [S.turn.start + 0.0, S.turn.start + 1.0],
    freeze: S.twist.start,
    staticFlash: S.twist.start + 0.42,
    feedOn: S.twist.start + 0.52,
    popcorn: [S.normal.start + 2.35, S.normal.start + 5.9],
    knocks: S.doorbell.lines[0].fallback ? [S.doorbell.lines[0].end + 0.35] : [],
    laughs,
  };
  return { fps: FPS, width: WIDTH, height: HEIGHT, duration, frames: Math.round(duration * FPS), scenes, events };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const tl = buildTimeline();
  fs.mkdirSync(P('build'), { recursive: true });
  fs.writeFileSync(P('build', 'timeline.json'), JSON.stringify(tl, null, 2));
  for (const s of tl.scenes) console.log(`  scene ${String(s.id).padStart(2)} ${s.key.padEnd(9)} ${s.start.toFixed(2)} -> ${s.end.toFixed(2)}  (${s.duration.toFixed(2)}s)`);
  console.log(`  total ${tl.duration.toFixed(2)}s, ${tl.frames} frames`);
}
