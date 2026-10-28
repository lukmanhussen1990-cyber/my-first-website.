// Builds every scene once, then window.renderFrame(t) poses the whole stage
// for time t (seconds). render.js calls it once per video frame.
(async function main() {
  await Promise.all([
    '700 70px Cinzel', '400 70px Cinzel', '400 70px Amiri', '700 190px "Aref Ruqaa"',
  ].map(f => document.fonts.load(f, 'أصحاب الغار ﷺ Qissa')));

  const TL = window.TL = TLB.build(window.WORDS);
  initSharedDefs();
  const cam = el('g', {}, document.getElementById('world'));
  const sets = {
    title: setTitle(cam, TL), caveIn: setCaveIn(cam, TL), caveOut: setCaveOutNight(cam, TL),
    dawn: setCaveOutDawn(cam, TL), home1: setHomeFirst(cam, TL), home2: setHomeSecond(cam, TL), valley: setValley(cam, TL),
  };
  buildFrame(cam);
  const SET_OF = { hook: 'caveIn', title: 'title', storm: 'caveOut', rock: 'caveOut', inside: 'caveIn', first: 'home1',
    dua1: 'caveIn', second: 'home2', dua2: 'caveIn', third: 'valley', dua3: 'caveIn', moral: 'dawn', end: 'dawn' };
  OV.init(TL);

  const sceneAt = t => TL.scenes.find(s => t >= s.s && t < s.e) || TL.scenes[TL.scenes.length - 1];

  function shake(t) {
    const { E } = TL;
    let a = 0;
    const v = t - E.thud;
    if (v >= 0 && v < 0.9) a += 16 * Math.exp(-5 * v);
    for (const m of [E.dua1Move, E.dua2Move, E.dua3Move]) if (t > m[0] && t < m[1]) a += 2.5;
    if (t > E.rollStart && t < E.thud) a += 2 * seg(t, E.rollStart, E.thud);
    return [a * Math.sin(t * 53), a * 0.8 * Math.sin(t * 41 + 1.3)];
  }

  window.renderFrame = t => {
    const sc = sceneAt(t);
    const active = SET_OF[sc.id];
    for (const k in sets) show(sets[k].g, k === active);
    sets[active].update(t, sc);
    // gentle push-in on every scene; storm+rock and moral+end are each one continuous shot
    const span = sc.id === 'moral' || sc.id === 'end' ? [TL.S.moral.s, TL.S.end.e]
      : sc.id === 'storm' || sc.id === 'rock' ? [TL.S.storm.s, TL.S.rock.e] : [sc.s, sc.e];
    const z = 1 + (sc.id === 'title' ? 0.025 : 0.035) * smooth(seg(t, ...span));
    const [sx, sy] = shake(t);
    setT(cam, `translate(${(540 + sx).toFixed(2)} ${(1040 + sy).toFixed(2)}) scale(${z.toFixed(5)}) translate(-540 -1040)`);
    OV.update(t, sc);
  };

  // Cover: the hook frame with the title on it.
  window.renderCover = () => {
    window.renderFrame(3.9);
    OV.hideCaptions();
    document.getElementById('fx').style.display = 'none';
    const c = document.createElement('div');
    c.id = 'cover';
    c.innerHTML = `<div class="cv-small">QISSA THEATRE</div><div class="cv-ar">أصحاب الغار</div><div class="cv-en">The Three Men in the Cave</div>`;
    document.getElementById('root').insertBefore(c, document.getElementById('grain'));
  };

  window.READY = true;
})();
