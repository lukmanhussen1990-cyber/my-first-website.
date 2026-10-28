// One source of truth for every animation hit and sound cue, in seconds.
// Imported by the Remotion scenes and by tools/synth (music and sound effects), so pictures and sounds
// land on the same frame. Everything is derived from timeline.json (built from the voice clips).

const r3 = (x) => Math.round(x * 1000) / 1000;
const norm = (s) => s.toLowerCase().replace(/’/g, "'").replace(/[^a-z0-9']/g, '').replace(/^'+|'+$/g, '');

// Walk cycles: one full cycle = two steps; a foot lands at phase 0 and 0.5.
export const WALKS = {
  judas: { period: 1.0, phase: 0.1 },
};

export function footsteps(walk, start, stop) {
  const { period, phase } = WALKS[walk];
  const out = [];
  for (let k = 0; ; k++) {
    const t = start + (phase + k * 0.5) * period;
    if (t > stop) break;
    if (t >= start) out.push(r3(t));
  }
  return out;
}

// n times from t0 to t1 whose gaps shrink linearly to `ratio` times the first gap (an accelerating count).
function accel(n, t0, t1, ratio = 0.45) {
  const m = n - 1;
  const g0 = (2 * (t1 - t0)) / (m * (1 + ratio));
  const out = [t0];
  for (let i = 1; i < n; i++) out.push(out[i - 1] + g0 * (1 + ((ratio - 1) * (i - 1)) / Math.max(1, m - 1)));
  return out.map(r3);
}

export function computeBeats(tl) {
  const c = tl.cues;
  const scene = Object.fromEntries(tl.scenes.map((s) => [s.id, s]));
  const sent = Object.fromEntries(tl.sentences.map((s) => [s.sid, s]));
  const word = (sid, text, nth = 0) => tl.words.filter((w) => w.sid === sid && norm(w.text) === text)[nth];

  const b = {
    total: tl.durationInSeconds,
    // ---- S1 hook: the kiss in slow motion, then the rewind ----
    s1: 0,
    hookTitleIn: 0.06,
    hookTitleFly: 1.8,
    kissTouch: c.kiss,                 // the slow lean reaches Jesus' cheek on "kiss"
    hookWord: c.oneWord,
    // ---- S2 rewind into the upper room ----
    s2: scene.S2.start,
    rewindStart: scene.S2.start - 0.06,
    rewindPeak: c.goBack + 0.02,
    rewindLand: c.fewHours + 0.06,
    tagIn: c.fewHours + 0.1,
    tagOut: c.towel - 0.2,
    // ---- S3 the towel ----
    s3: scene.S3.start,
    jesusRise: c.thatNight,
    robeOff: word('03', 'jesus').start + 0.05,
    towelTie: c.towel,
    pourStart: c.knelt - 0.05,
    pourEnd: c.washed - 0.15,
    kneel: c.washed - 0.35,
    washStart: c.washed,
    // ---- S4 twelve: the tracker fills one dot per disciple; the 12th lands on "Judas" ----
    s4: scene.S4.start,
    trackerIn: scene.S4.start - 0.05,
    peterStation: scene.S4.start + 0.05,
    johnStation: word('04a', 'twelve').end + 0.02,
    judasStation: c.judasFeet - 0.25,
    trackerOut: scene.S5.start + 1.4,
    // ---- S5 Judas ----
    s5: scene.S5.start,
    touch: word('05', 'jesus').start,
    pouchGlint: c.alreadyKnew,
    lookUp: word('05', 'knew').start + 0.1,
    lookAway: word('05', 'knew').start + 0.45,
    cardJohnIn: c.forHeKnew - 0.3,
    betray: c.betray,
    cardJohnOut: scene.S6.start - 0.1,
    // ---- S6 the deal (flashback) ----
    s6: scene.S6.start,
    labelDeal: scene.S6.start + 0.25,
    silver: c.silver,
    // ---- S7 but notice: coins fly onto the scale; the slave's chain balances it on "slave" ----
    s7: scene.S7.start,
    butNotice: c.butNotice,
    coinsFly: c.butNotice + 0.1,
    coinsLanded: c.butNotice + 1.35,
    cardExodusIn: c.theLaw - 0.15,
    shekels: word('07', 'thirty').start,
    cardExodusOut: word('07', 'was').start - 0.1,
    chainDrop: c.price,
    chainLand: c.price + 0.32,
    scaleLevel: c.slave + 0.05,
    labelSlave: c.slave + 0.05,
    // ---- S8 worth: one coin spins, wobbles faster and falls flat; rack focus to Judas ----
    s8: scene.S8.start,
    spinStart: scene.S8.start + 0.05,
    wobble: c.worth - 0.2,
    coinFlat: c.worthEnd - 0.04,
    rackJudas: c.worthEnd + 0.15,
    // ---- S9 the garden ----
    s9: scene.S9.start,
    labelGarden: c.garden + 0.75,
    swordsUp: c.swords,
    // ---- S10 the kiss ----
    s10: scene.S10.start,
    walkUp: c.walkedUp - 0.05,
    hail: c.hail,
    kissLean: c.kissed - 0.75,
    kissTouch2: c.kissed + 0.1,
    // ---- S11 friend ----
    s11: scene.S11.start,
    freeze: sent['11a'].end - 0.05,
    friendWord: c.friend1,
    cardMatthewIn: sent['11b'].end + 0.12,
    cardMatthewOut: scene.S12.start - 0.12,
    // ---- S12 the same night: split screen; D major from "That's who Jesus is" ----
    s12: scene.S12.start,
    keyChange: c.keyChange,
    labelSameNight: c.keyChange + 0.2,
    warmTakesOver: c.washesFeet,
    // ---- S13 enemies: warm light rises behind the olive trees ----
    s13: scene.S13.start,
    cardRomansIn: scene.S13.start + 0.1,
    enemies: c.enemies,
    cardRomansOut: scene.S14.start - 0.12,
    // ---- S14 friend of sinners ----
    s14: scene.S14.start,
    labelSinners: word('15a', 'friend').start,
    laugh: word('15a', 'friend').start + 0.2,
    right: c.right,
    // ---- S15 call to action ----
    s15: scene.S15.start,
    yes: c.yesOrNo,
    no: word('16b', 'no').start,
    typingStart: sent['16b'].end + 0.12,
    typingCps: 15,
    commentText: 'Not yet… but I want to 🙏',
    // ---- S16 end card, then the loop back to the kiss ----
    s16: scene.S16.start,
    logoDraw: scene.S16.start + 0.12,
    loopOut: tl.durationInSeconds - 0.6,
  };
  b.typingEnd = b.typingStart + [...b.commentText].length / b.typingCps;
  b.hearts = b.typingEnd - 0.35;

  // Tracker: 11 quick dots over "All twelve", the 12th (dark, with a coin) on "Judas".
  b.dots = [...accel(11, b.s4 + 0.12, c.including + 0.05, 1), r3(c.judasFeet)];
  // The coins counted into Judas's palm: 30, speeding up, the last one on "silver".
  b.coins = accel(30, b.s6 + 0.55, c.silver, 0.4);
  // The coins fly onto the left pan one after another (they land in this order).
  b.coinLand = accel(30, b.coinsFly + 0.38, b.coinsLanded, 0.6);
  // Slow heartbeat: S1 under the kiss, S10–S11 when everything else falls silent.
  const beat = (t0, t1, period) => {
    const out = [];
    for (let t = t0; t < t1; t += period) out.push(r3(t));
    return out;
  };
  b.heart = [...beat(0.32, b.s2 - 0.3, 1.12), ...beat(b.hail - 0.2, b.friendWord - 0.2, 1.08)];
  b.steps = {
    judas: footsteps('judas', b.walkUp, b.kissLean - 0.1),
  };
  for (const k of Object.keys(b)) if (typeof b[k] === 'number') b[k] = r3(b[k]);
  return b;
}
