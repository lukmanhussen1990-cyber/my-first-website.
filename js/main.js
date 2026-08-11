/* ══════════════════════════════════════════════════════════
   main.js — boot
   ══════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const SS = window.SS;

  function boot() {
    const save = SS.Save.load();
    const opt = save.opt;

    /* renderer */
    SS.R.quality = opt.quality;
    SS.R.init(document.getElementById('game'));
    SS.FX.setQuality(opt.quality);

    /* progression */
    SS.Missions.load(save);

    /* audio flags — the context itself waits for a gesture */
    SS.Audio.sfxOn = opt.sfx;
    SS.Audio.musicOn = opt.music;

    /* ui */
    SS.UI.init();
    SS.UI.syncSettings();
    SS.UI.updateTitle();
    SS.UI.show('title');

    /* input */
    SS.Input.init(document.getElementById('game'));
    SS.Input.onAny = function () {
      SS.Audio.init();
      SS.Audio.resume();
      SS.Audio.setSfx(opt.sfx);
      SS.Audio.setMusic(opt.music);
    };
    /* any UI click also unlocks audio */
    document.addEventListener('pointerdown', () => SS.Input.first(), { capture: true });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && SS.Game.state === 'playing') SS.Game.pause();
    });

    window.addEventListener('contextmenu', (e) => {
      if (e.target && e.target.id === 'game') e.preventDefault();
    });

    SS.Game.init();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
