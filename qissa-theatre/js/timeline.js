// Scene and event timing, derived from the force-aligned narration.
// Runs in the browser (window.TL) and in Node (for the sound-effects mix).
(function (root) {
  const OFFSET = 0.5; // narration starts half a second into the reel
  const FPS = 30;
  const SCENE_IDS = ['hook', 'title', 'storm', 'rock', 'inside', 'first', 'dua1',
    'second', 'dua2', 'third', 'dua3', 'moral', 'end'];

  function build(tokens) {
    const words = tokens.map((t, i) => Object.assign({}, t, { i, s: t.s + OFFSET, e: t.e + OFFSET }));
    const lines = [];
    for (const w of words) {
      const L = lines[w.line] || (lines[w.line] = { n: w.line, s: w.s, e: w.e, words: [] });
      L.words.push(w);
      L.s = Math.min(L.s, w.s);
      L.e = Math.max(L.e, w.e);
    }
    const norm = s => s.toLowerCase().replace(/[^a-z]/g, '');
    const at = (line, text, nth = 0) => {
      const w = lines[line].words.filter(x => norm(x.text) === norm(text))[nth];
      if (!w) throw new Error(`word "${text}" not found in line ${line}`);
      return w;
    };
    const bound = k => k === 11 ? at(12, 'done').e // let the men hop out into the light
      : Math.max(lines[k].e + 0.12, lines[k + 1].s - 0.3);
    const END = +(lines[13].e + 2.6).toFixed(2);
    const scenes = SCENE_IDS.map((id, k) => ({
      id, n: k + 1, s: k === 0 ? 0 : bound(k), e: k === 12 ? END : bound(k + 1),
    }));
    const S = Object.fromEntries(scenes.map(s => [s.id, s]));

    // Caption groups: consecutive words sharing line + group index.
    const groups = [];
    for (const w of words) {
      const g = groups[groups.length - 1];
      if (g && g.line === w.line && g.group === w.group) g.words.push(w);
      else groups.push({ line: w.line, group: w.group, words: [w] });
    }
    for (const g of groups) {
      g.s = g.words[0].s - 0.12;
      g.e = g.words[g.words.length - 1].e;
    }
    groups.forEach((g, i) => {
      const next = groups[i + 1];
      g.hide = next ? Math.min(next.s, g.e + 1.6) : END + 1;
    });

    const E = {}; // named event times
    E.drops = [0.12, 0.5, 0.88];
    E.titleOpen = [S.title.s, S.title.s + 1.15];
    E.walkIn = [S.storm.s + 0.05, at(3, 'cave').e + 0.25];
    E.flashes = [S.storm.s + 0.35, at(3, 'storm').s, at(3, 'ran').s + 0.25, S.rock.s + 0.4, at(4, 'mountain').s];
    E.rollStart = at(4, 'huge').s - 0.1;
    E.thud = at(4, 'sealed').s + 0.05;
    E.slitClose = [S.rock.e - 0.75, S.rock.e];
    E.dua1Raise = at(7, 'allah').s - 0.35;
    E.dua1Move = [at(7, 'moved').s - 0.2, at(7, 'little').e];
    E.dua2Raise = at(9, 'allah').s - 0.35;
    E.dua2Move = [at(9, 'moved').s - 0.2, at(9, 'more').e + 0.35];
    E.dua3Raise = at(11, 'allah').s - 0.35;
    E.dua3Move = [at(11, 'rock').s, at(11, 'away').e + 0.25];
    E.hopOut = [at(11, 'away').e - 0.3, S.dua3.e + 0.2];
    E.moonCross = [S.first.s + 0.8, at(6, 'morning').s - 0.8];
    E.sunRise = [at(6, 'morning').s - 1.2, at(6, 'morning').e + 1.2];
    E.childCry = at(6, 'night').s;
    E.fearAllah = [at(8, 'fear').s, at(8, 'allah', 1).e];
    E.turnAway = at(8, 'walked').s - 0.25;
    E.walkOut = [at(8, 'walked').s + 0.05, at(8, 'too').e - 0.2];
    E.goldGlint = at(8, 'gold').s;
    E.workerLeave = [at(10, 'worker').s, at(10, 'wage').e];
    E.herd = [at(10, 'grew').s - 0.1, at(10, 'herd').e + 0.2];
    E.workerBack = [at(10, 'later').s - 0.1, at(10, 'back').e + 0.1];
    E.offer = [at(10, 'all').s - 0.25, at(10, 'yours').e + 0.4];
    E.leadAway = [at(10, 'took').s - 0.35, S.third.e + 0.4];
    E.curtain = [S.end.s, S.end.s + 1.5];
    // water drips in the dark cave scenes
    E.drips = [];
    for (const id of ['hook', 'inside', 'dua1', 'dua2']) {
      for (let t = S[id].s + 1.3; t < S[id].e - 0.6; t += 2.7) E.drips.push(+t.toFixed(2));
    }
    E.end = END;

    return { OFFSET, FPS, END, words, lines, groups, scenes, S, E, at };
  }

  const api = { build, OFFSET, FPS, SCENE_IDS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TLB = api;
})(typeof window !== 'undefined' ? window : globalThis);
