// Q.01 THE MOUNTAIN: the single source of truth for timing.
// Scenes, overlays and every sound cue are derived from the narration words in timeline.json,
// so the Remotion scenes (src/) and the audio tools (tools/audio/) always agree.
// Plain ES module on purpose: imported by TypeScript (webpack) and by Node scripts.

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9']/g, "");

export function buildCues(tl) {
  const beat = (id) => {
    const b = tl.beats.find((x) => x.id === id);
    if (!b) throw new Error(`no beat ${id}`);
    return b;
  };
  // word(beatId, "text", nth) -> word object from the timeline
  const word = (beatId, text, nth = 0) => {
    const hits = tl.words.filter((w) => w.beat === beatId && norm(w.text) === norm(text));
    if (!hits[nth]) throw new Error(`no word "${text}" #${nth} in ${beatId}`);
    return hits[nth];
  };
  const at = (beatId, text, nth = 0) => word(beatId, text, nth).start;
  const end = tl.endCardStart;

  // ---------------------------------------------------------------- scenes
  // transition = how the scene is entered
  const scenes = [
    { id: "S1", start: 0, end: beat("b03").start - 0.22, mood: "dawn", transition: "none" },
    { id: "S2", start: beat("b03").start - 0.22, end: beat("b04").start - 0.22, mood: "night", transition: "card" },
    { id: "S3", start: beat("b04").start - 0.22, end: beat("b05").start - 0.22, mood: "dawn", transition: "card-out" },
    { id: "S4", start: beat("b05").start - 0.22, end: beat("b06").start - 0.36, mood: "journey", transition: "flare" },
    { id: "S5", start: beat("b06").start - 0.36, end: beat("b08").start - 0.24, mood: "climb", transition: "dust" },
    { id: "S6", start: beat("b08").start - 0.24, end: beat("b10").start - 0.2, mood: "climb", transition: "whoosh-cut" },
    { id: "S7", start: beat("b10").start - 0.2, end: beat("b11").start - 0.22, mood: "glory", transition: "flare" },
    { id: "S8", start: beat("b11").start - 0.22, end: at("b12", "another") - 0.04, mood: "glory", transition: "orbit" },
    { id: "S9", start: at("b12", "another") - 0.04, end: beat("b13").start - 0.25, mood: "golgotha", transition: "match-cut" },
    { id: "S10", start: beat("b13").start - 0.25, end: beat("b15").start - 0.24, mood: "golgotha", transition: "thunder" },
    { id: "S11", start: beat("b15").start - 0.24, end: beat("b17").start - 0.25, mood: "lamb", transition: "continuous" },
    { id: "S12", start: beat("b17").start - 0.25, end, mood: "cta", transition: "dust" },
    { id: "S13", start: end, end: tl.durationSeconds, mood: "cta", transition: "fade" },
  ];
  const scene = (id) => {
    const s = scenes.find((x) => x.id === id);
    if (!s) throw new Error(`no scene ${id}`);
    return s;
  };

  // ---------------------------------------------------------------- overlays
  const hook = { flyStart: 1.45, flyEnd: 1.95 };

  const labels = [
    { text: "ABRAHAM", anchor: "abraham.head", scene: "S1", start: at("b02", "father") },
    { text: "ISAAC", anchor: "isaac.head", scene: "S1", start: at("b02", "told") },
    { text: "LAND OF MORIAH · GENESIS 22:2", anchor: "moriah.peak", scene: "S4", start: at("b05", "mountain") - 0.1 },
    { text: "I", anchor: "abraham.head", scene: "S5", start: at("b06", "i") },
    { text: "THE LAD", anchor: "isaac.head", scene: "S5", start: at("b06", "lad") },
    { text: "HEBREWS 11:19", anchor: "abraham.head", scene: "S5", start: at("b07", "believed") },
    { text: "THE WOOD · GENESIS 22:6", anchor: "isaac.wood", scene: "S6", start: at("b08", "wood") },
    { text: "LAY NOT THINE HAND UPON THE LAD · GENESIS 22:12", anchor: "abraham.hand", scene: "S7", start: at("b10", "stopped"), until: beat("b11").start + 1.0 },
    { text: "IN HIS PLACE · GENESIS 22:13", anchor: "ram.head", scene: "S8", start: at("b11", "place") - 0.25 },
    { text: "GOLGOTHA · JOHN 19:17", anchor: "jesus.head", scene: "S9", start: at("b12", "wood") },
    { text: "BEHOLD THE LAMB OF GOD · JOHN 1:29", anchor: "cross.top", scene: "S11", start: at("b16", "lamb") },
  ].map((l) => {
    const s = scene(l.scene);
    // the "I" / "THE LAD" pair gives way to the Hebrews label; others live until their scene ends
    // the "I" / "THE LAD" pair gives way to the Hebrews label; `until` lets a label ride into the next scene
    if (l.until) return { ...l, end: l.until };
    const until = l.text === "I" || l.text === "THE LAD" ? beat("b07").start + 1.6 : s.end - 0.12;
    return { ...l, end: Math.min(until, s.end - 0.12) };
  });

  const cards = [
    { beat: "b03", style: "full", quote: "Take now thy son, thine only son Isaac, whom thou LOVEST…", ref: "GENESIS 22:2 · KJV", start: scene("S2").start, end: scene("S2").end },
    { beat: "b06", style: "floating", quote: "…I and the lad will go yonder and worship, and COME AGAIN to you.", ref: "GENESIS 22:5 · KJV", start: at("b06", "i") - 0.35, end: beat("b07").start - 0.12 },
    { beat: "b09", style: "floating", quote: "…My son, God will provide himself a LAMB…", ref: "GENESIS 22:8 · KJV", start: beat("b09").start - 0.3, end: scene("S6").end - 0.05 },
    { beat: "b14", style: "full", quote: "He that SPARED NOT his own Son, but delivered him up for us all…", ref: "ROMANS 8:32 · KJV", start: beat("b14").start - 0.3, end: scene("S10").end + 0.1 },
  ];

  const search = {
    start: scene("S3").start + 0.05,
    text: "why did god ask abraham to sacrifice isaac",
    typeStart: scene("S3").start + 0.3,
    typeEnd: scene("S3").start + 2.0,
    suggestions: ["why did god ask abraham to sacrifice isaac", "why did god test abraham", "did abraham know god would provide"],
    suggestionsAt: scene("S3").start + 2.15,
    end: scene("S3").end,
  };

  const counter = {
    appear: at("b04", "three"),
    dots: [at("b04", "three"), at("b04", "three") + 0.12, at("b04", "three") + 0.24],
    fills: [at("b06", "come"), at("b08", "detail"), at("b11", "detail")],
    hide: beat("b12").start - 0.1,
  };

  const days = {
    start: scene("S4").start,
    // gentle time-lapse: one day-night cycle per 0.6 s (well under the 3 Hz flash guideline)
    marks: [scene("S4").start, scene("S4").start + 0.6, scene("S4").start + 1.2],
    end: scene("S4").end,
  };

  const title = { main: "JEHOVAH-JIREH", sub: "THE LORD WILL PROVIDE · GENESIS 22:14", start: beat("b11").end + 0.12, end: scene("S8").end };
  const goldRing = { start: at("b11", "ram") - 0.1 };
  const beam = { start: at("b10", "god"), burst: at("b10", "stopped") };
  const handRaise = { start: at("b10", "at"), top: at("b10", "god") };
  const headTurn = { start: at("b08", "asked") - 0.1, end: at("b09", "provide") };
  const lightBreak = { start: scene("S11").start + 0.1 };
  const timeLapse = { start: beat("b12").start, end: scene("S8").end };

  const cta = {
    faithAt: at("b17", "faith") - 0.1,
    loveAt: at("b17", "love") - 0.1,
    boxAt: at("b17", "which") - 0.1,
    text: "God's love, because…",
    typeStart: at("b17", "which") + 0.15,
    typeEnd: at("b17", "comments") - 0.2,
    heartsStart: at("b17", "tell"),
  };

  const endCard = { start: end, logoDone: end + 1.1, loopStart: tl.durationSeconds - 0.6, end: tl.durationSeconds };

  // ---------------------------------------------------------------- sound
  // gains in dB relative to a nominal effect level; the mixer ducks effects under words
  const sfx = [
    { t: hook.flyStart - 0.05, name: "whoosh", gain: -6, dur: 0.6 },
    ...labels.map((l) => ({ t: l.start, name: "pop", gain: l.text.length > 12 ? -10 : -8 })),
    ...cards.map((c) => ({ t: c.start, name: "paper", gain: c.style === "full" ? -5 : -8 })),
    { t: scene("S3").start, name: "paper", gain: -9 },
    ...Array.from({ length: search.text.length }, (_, i) => ({
      t: search.typeStart + (i / search.text.length) * (search.typeEnd - search.typeStart), name: "key", gain: -14, seed: i,
    })),
    { t: search.suggestionsAt, name: "tick", gain: -12 },
    ...counter.dots.map((t, i) => ({ t, name: "pop", gain: -10, pitch: 1 + i * 0.12 })),
    ...counter.fills.map((t) => ({ t, name: "pop", gain: -9, pitch: 1.3 })),
    { t: scene("S4").start - 0.25, name: "whoosh", gain: -5, dur: 0.8 },
    { t: scene("S4").start, name: "flare", gain: -10 },
    ...days.marks.slice(1).map((t) => ({ t: t - 0.1, name: "whoosh", gain: -13, dur: 0.35 })),
    { t: at("b05", "mountain") - 0.6, name: "riser", gain: -7, dur: beat("b06").start - (at("b05", "mountain") - 0.6) },
    { t: beat("b06").start - 0.02, name: "thump", gain: -9 },
    { t: scene("S6").start - 0.2, name: "whoosh", gain: -8, dur: 0.6 },
    { t: scene("S7").start - 0.2, name: "flare", gain: -12 },
    { t: at("b10", "stopped"), name: "boom", gain: -3 },
    { t: scene("S8").start - 0.15, name: "whoosh", gain: -7, dur: 1.0 },
    { t: title.start, name: "shimmer", gain: -9, dur: 2.4 },
    { t: scene("S9").start - 0.4, name: "thunder", gain: -9, dur: 4.0 },
    { t: scene("S10").start - 0.1, name: "thunder", gain: -6, dur: 5.0 },
    { t: lightBreak.start, name: "shimmer", gain: -6, dur: 3.5 },
    { t: scene("S12").start - 0.2, name: "whoosh", gain: -10, dur: 0.8 },
    { t: cta.faithAt, name: "pop", gain: -8 },
    { t: cta.loveAt, name: "pop", gain: -7, pitch: 1.15 },
    { t: cta.boxAt, name: "tick", gain: -11 },
    ...Array.from({ length: cta.text.length }, (_, i) => ({
      t: cta.typeStart + (i / cta.text.length) * (cta.typeEnd - cta.typeStart), name: "key", gain: -15, seed: 100 + i,
    })),
    ...[0, 0.45, 0.8, 1.3, 1.7].map((d, i) => ({ t: cta.heartsStart + d, name: "pop", gain: -17, pitch: 1.6 + i * 0.1 })),
    { t: endCard.start + 0.1, name: "shimmer", gain: -10, dur: 2.2 },
    // the 3-5 biggest keywords get a gentle chime
    { t: at("b06", "come"), name: "chime", gain: -9, note: "A5" },
    { t: at("b11", "place"), name: "chime", gain: -9, note: "F#5" },
    { t: at("b14", "spared"), name: "chime", gain: -10, note: "D5" },
    { t: at("b16", "jesus"), name: "chime", gain: -7, note: "D6" },
  ].sort((a, b) => a.t - b.t);

  const ambience = [
    { name: "dawn", start: -0.5, end: scene("S2").start + 0.3, gain: -16 },
    { name: "night", start: scene("S2").start, end: scene("S3").start + 0.3, gain: -22 },
    { name: "wind", start: scene("S3").start, end: scene("S4").start + 0.4, gain: -26 },
    { name: "journey", start: scene("S4").start - 0.1, end: scene("S5").start + 2.5, gain: -17 },
    { name: "wind", start: scene("S5").start, end: scene("S6").start + 0.5, gain: -21 },
    { name: "climb", start: scene("S6").start, end: beat("b10").start + 0.6, gain: -18 },
    { name: "fire", start: scene("S6").start, end: scene("S6").end + 0.2, gain: -19 },
    { name: "glory", start: at("b10", "god"), end: scene("S8").end, gain: -24 },
    { name: "storm", start: scene("S9").start, end: scene("S11").start + 1.0, gain: -20 },
    { name: "wind", start: scene("S11").start, end: scene("S12").start + 0.5, gain: -27 },
    { name: "dawn", start: endCard.loopStart - 0.4, end: tl.durationSeconds + 0.5, gain: -16 },
  ];

  // music sections: the score follows the story (D major, about 70 BPM)
  const music = {
    key: "D",
    bpm: 70,
    sections: [
      { name: "intro", start: 0, end: scene("S4").start, mood: "quiet, curious, dawn" },
      { name: "journey", start: scene("S4").start, end: beat("b06").start, mood: "sand and ochre, gentle motion, riser into the twist" },
      { name: "twist", start: beat("b06").start, end: scene("S6").start, mood: "low tension, wonder" },
      { name: "climb", start: scene("S6").start, end: at("b10", "god") - 0.55, mood: "slow soft low pulse, building" },
      { name: "silence", start: at("b10", "god") - 0.55, end: at("b10", "god") - 0.02, mood: "near silence (0.5 s)" },
      { name: "glory", start: at("b10", "god") - 0.02, end: title.start, mood: "warm choir pad, glory white-gold" },
      { name: "years", start: title.start, end: scene("S9").start, mood: "shimmer, cooling" },
      { name: "golgotha", start: scene("S9").start, end: scene("S11").start, mood: "cold grey, sparse, thins out at 'God did not stop it'" },
      { name: "lamb", start: scene("S11").start, end: scene("S12").start, mood: "warm major chord, light breaks, peak on 'Jesus'" },
      { name: "cta", start: scene("S12").start, end: endCard.start, mood: "gentle, warm, lower energy" },
      { name: "end", start: endCard.start, end: tl.durationSeconds, mood: "gentle ending that loops cleanly back to the intro" },
    ],
    hits: {
      boom: at("b10", "stopped"),
      thinOut: at("b13", "and"),
      peak: at("b16", "jesus"),
    },
  };

  return {
    scenes, scene, beat, word, at, hook, labels, cards, search, counter, days, title, goldRing, beam,
    handRaise, headTurn, lightBreak, timeLapse, cta, endCard, sfx, ambience, music,
  };
}
