// Entry point. ?mode=sheet draws the character sheet; otherwise builds the reel
// and exposes window.renderAt(t) (deterministic: output depends only on t).
const params = new URLSearchParams(location.search);
const mode = params.get('mode') || 'reel';

async function fonts() {
  await Promise.all([
    document.fonts.load('italic 500 58px "Cormorant Garamond"'), document.fonts.load('italic 600 58px "Cormorant Garamond"'),
    document.fonts.load('600 50px Cinzel'), document.fonts.load('700 50px Cinzel'),
    document.fonts.load('600 20px Inter'), document.fonts.load('700 20px Inter'),
  ]);
  await document.fonts.ready;
}

async function boot() {
  try {
    await fonts();
    if (mode === 'sheet') {
      const { drawSheet } = await import('./sheet.js');
      drawSheet(document.getElementById('sheet'));
      window.reelInfo = () => ({ events: [], scenes: [], total: 0 });
    } else {
      const { Reel } = await import('./reel.js');
      const [timings, script] = await Promise.all([
        fetch('build/timings.json').then((r) => r.json()),
        fetch('script/script.json').then((r) => r.json()),
      ]);
      const reel = new Reel(timings, script);
      window.__reel = reel;
      window.__THREE = await import('three');
      await reel.init();
      window.renderAt = (t) => reel.renderAt(t);
      window.reelInfo = () => reel.info();
      // cover: the hook question set large over the dusk city-sky shot
      window.makeCover = (t) => {
        reel.renderAt(t);
        for (const id of ['captions', 'band', 'qmark']) document.getElementById(id).style.display = 'none';
        document.getElementById('topshade').style.opacity = 0.75;
        const c = document.createElement('div');
        c.id = 'cover';
        c.style.cssText = 'position:absolute;left:70px;top:395px;width:940px;color:#f4eee0;font-family:"Cormorant Garamond";font-style:italic;font-weight:600;font-size:104px;line-height:1.08;text-shadow:0 4px 30px rgba(10,5,2,0.6),0 2px 4px rgba(10,5,2,0.4);';
        c.innerHTML = 'Why doesn\'t God just appear in the <span style="font-family:Cinzel;font-style:normal;font-weight:700;font-size:0.86em;color:#e5534b;text-shadow:0 0 30px rgba(229,83,75,0.55),0 3px 12px rgba(10,5,2,0.5)">SKY</span><br>so everyone believes?';
        const k = document.createElement('div');
        k.style.cssText = 'position:absolute;left:72px;top:330px;font-family:Inter;font-weight:700;font-size:24px;letter-spacing:0.3em;color:rgba(239,224,186,0.9);text-shadow:0 1px 8px rgba(0,0,0,0.5);';
        k.textContent = 'HONEST QUESTIONS · THE SKY';
        document.getElementById('stage').append(c);
      };
    }
    window.__ready = true;
  } catch (e) {
    console.error(e);
    window.__error = String(e && e.stack ? e.stack : e);
  }
}
boot();
