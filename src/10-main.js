/* ================================= RUN ==================================== */
function newRun(seed) {
  G.seed = seed == null ? ((Math.random() * 1e9) | 0) : seed;
  World.generate(G.seed);
  G.P = newPlayer();
  G.P.x = World.spawn.x; G.P.y = World.spawn.y;
  G.mons.length = 0; G.bolts.length = 0; G.fx.length = 0; G.nums.length = 0; G.drops.length = 0;
  G.stats = newStats();
  G.runT = 0; G.spawnT = 0.6; G.surgeT = 80; G.pendingLevels = 0; G.rerollsUsed = 0;
  G.hitstop = 0; G.flashT = 0;
  _hudGhost = { hp: 1, t: 0 };
  G.cam.x = G.P.x - Display.W / 2; G.cam.y = G.P.y - Display.H / 2;
  G.cam.trauma = 0;
  syncWeaponPod();
  syncHud();
  /* a few neighbours so the world feels inhabited from the first second */
  for (let i = 0; i < 8; i++) {
    const pt = findSpawnPoint(120, 260);
    if (!pt) continue;
    const table = spawnTableFor(pt.t, 1);
    if (!table.length) continue;
    const rng = makeRng((Math.random() * 1e9) | 0);
    spawnMonster(rng.weighted(table).k, pt.x, pt.y, false);
  }
}
function startRun() {
  newRun(null);
  setMode("play");
  toast("Seed #" + G.seed + " — " + BIOME_NAME[World.biomeAt(G.P.x, G.P.y)]);
  Sound.init(); Sound.resume();
}

/* ================================= LOOP =================================== */
let lastT = 0, acc = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  if (!lastT) lastT = ts;
  let dt = (ts - lastT) / 1000;
  lastT = ts;
  if (dt > 0.1) dt = 0.1;                 /* never simulate a huge catch-up step */
  G.t += dt;
  G.animT += dt;

  if (G.mode === "play") {
    if (G.hitstop > 0) {
      G.hitstop -= dt;
    } else {
      G.dt = dt;
      G.runT += dt;
      updatePlayer(dt);
      updateMonsters(dt);
      updateBolts(dt);
      updateDrops(dt);
      updateLandmarks(dt);
      updateSpawner(dt);
      updateSurge(dt);
    }
    updateFx(dt);
    updateCamera(dt);
    syncHud();
    if (G.pendingLevels > 0 && G.P.alive) openLevelUp();
  } else if (G.mode === "levelup") {
    updateFx(dt);
    updateCamera(dt * 0.4);
  } else if (G.mode === "title") {
    /* slow attract drift around the starting shrine */
    const a = G.t * 0.14;
    G.cam.x = clamp(World.spawn.x - Display.W / 2 + Math.cos(a) * 44, 0, World.W * TS - Display.W);
    G.cam.y = clamp(World.spawn.y - Display.H / 2 + Math.sin(a) * 30, 0, World.H * TS - Display.H);
    updateFx(dt);
  } else {
    updateFx(dt);
  }

  Input.endFrame();
  render();
}

/* =============================== WIRING ================================== */
function wire() {
  on($("btnStart"), "click", () => { Sound.play("select"); startRun(); });
  on($("btnHowto"), "click", () => { Sound.play("open"); setMode("howto"); });
  on($("btnHowtoBack"), "click", () => setMode("title"));
  on($("btnBoard"), "click", () => openBoard("title"));
  on($("btnSheetBack"), "click", () => setMode(G.P && G.P.alive && G.runT > 0 ? "play" : "title"));
  on($("btnSheet"), "click", () => { if (G.mode === "play") openSheet(); });
  on($("btnPause"), "click", () => { if (G.mode === "play") doPause(); });
  on($("btnResume"), "click", () => setMode("play"));
  on($("btnPauseSheet"), "click", () => openSheet());
  on($("btnPauseBoard"), "click", () => openBoard("pause"));
  on($("btnQuit"), "click", () => { endRun(); });
  on($("btnSound"), "click", () => {
    Sound.init(); Sound.setEnabled(!Sound.enabled);
    $("btnSound").textContent = "Sound: " + (Sound.enabled ? "On" : "Off");
    if (Sound.enabled) Sound.play("select");
  });
  on($("btnReroll"), "click", () => {
    if (G.rerolls <= 0) return;
    G.rerollsUsed = (G.rerollsUsed || 0) + 1;
    G.rerolls--;
    G.cards = pickCards(G.P, 3);
    renderCards();
    Sound.play("select");
  });
  on($("btnRetry"), "click", () => { Sound.play("select"); startRun(); });
  on($("btnGoBoard"), "click", () => openBoard("dead"));
  on($("btnGoTitle"), "click", () => { updateBestLine(); setMode("title"); });
  on($("btnPublish"), "click", () => publishRun());
  on($("btnBoardBack"), "click", () => setMode(UI.boardReturn === "dead" ? "dead" : UI.boardReturn === "pause" ? "pause" : "title"));
  on($("btnRefresh"), "click", async () => {
    $("globalStatus").textContent = "Loading…";
    await Board.fetchTop();
    renderBoard();
  });
  for (const t of document.querySelectorAll(".tab")) on(t, "click", () => { switchTab(t.dataset.tab); Sound.play("select"); });
  on($("btnSaveEp"), "click", () => {
    Board.cfg.url = $("epUrl").value.trim();
    Board.cfg.room = ($("epRoom").value.trim() || "phantasy-codex");
    Board.saveCfg();
    Board.status = Board.cfg.url ? "Endpoint saved." : "Endpoint cleared — scores stay on this device.";
    renderBoard();
    Sound.play("select");
  });
  on($("btnTestEp"), "click", async () => {
    Board.cfg.url = $("epUrl").value.trim();
    Board.cfg.room = ($("epRoom").value.trim() || "phantasy-codex");
    Board.saveCfg();
    $("epStatus").innerHTML = '<span class="statusdot"></span>Testing…';
    await Board.fetchTop();
    const ok = Board.remote.length > 0 || /reachable/.test(Board.status);
    /* refresh the lists first — renderBoard resets the status line, so the
       verdict has to be written after it, not before */
    renderBoard();
    $("epStatus").innerHTML = '<span class="statusdot ' + (ok ? "ok" : "err") + '"></span>' + escapeHtml(Board.status);
  });
  on($("btnCopyCode"), "click", async () => {
    const txt = $("runCode").textContent;
    try {
      await navigator.clipboard.writeText(txt);
      toast("Run code copied.");
      $("btnCopyCode").textContent = "Copied!";
      setTimeout(() => { $("btnCopyCode").textContent = "Copy run code"; }, 1400);
    } catch (e) {
      /* clipboard is blocked in some embeds — select it instead */
      const r = document.createRange(); r.selectNodeContents($("runCode"));
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      $("btnCopyCode").textContent = "Select & copy manually";
    }
  });

  /* keyboard shortcuts that live outside the player update */
  on(window, "keydown", (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      if (G.mode === "play") openSheet();
      else if (G.mode === "sheet") setMode(G.runT > 0 && G.P.alive ? "play" : "title");
    } else if (e.key === "Escape") {
      if (G.mode === "play") doPause();
      else if (G.mode === "pause") setMode("play");
      else if (G.mode === "sheet") setMode(G.runT > 0 && G.P.alive ? "play" : "title");
      else if (G.mode === "board") setMode(UI.boardReturn === "dead" ? "dead" : UI.boardReturn === "pause" ? "pause" : "title");
      else if (G.mode === "howto") setMode("title");
    } else if (e.key === "Enter" && (G.mode === "title" || G.mode === "dead")) {
      startRun();
    } else if (G.mode === "levelup" && ["1", "2", "3"].indexOf(e.key) >= 0) {
      const i = parseInt(e.key, 10) - 1;
      if (G.cards[i]) { applyBoon(G.cards[i]); afterChoice(); }
    }
  });

  on(window, "resize", () => { Display.resize(); _vignette = null; });
  on(window, "orientationchange", () => setTimeout(() => { Display.resize(); _vignette = null; }, 200));
  on(document, "visibilitychange", () => { if (document.hidden && G.mode === "play") doPause(); });
  on(window, "contextmenu", (e) => { if (e.target && e.target.closest && e.target.closest("#stage")) e.preventDefault(); });
}
function doPause() {
  setMode("pause");
  $("btnSound").textContent = "Sound: " + (Sound.enabled ? "On" : "Off");
  Sound.play("open");
}

/* ================================= BOOT =================================== */
function boot() {
  Display.resize();
  buildArt();
  Input.init();
  wire();

  $("titleArt").src = ART.title.toDataURL();
  $("icoSheet").src = ART.icons.book.toDataURL();
  $("icoPause").src = ART.icons.pause.toDataURL();

  newRun(null);                 /* a live world behind the title screen */
  setMode("title");

  /* handy for debugging and for anyone who wants to poke at a run */
  window.PCA = {
    G, World, ART, Board, MONSTERS, BOONS, WEAPONS, Display,
    startRun, newRun, gainXp, spawnMonster, damageMonster, damagePlayer,
    openSheet, openBoard, openLevelUp, setMode, weaponStats, buildTitle, findSpawnPoint
  };
  updateBestLine();
  switchTab("global");
  requestAnimationFrame(frame);
}

if (document.readyState === "loading") on(document, "DOMContentLoaded", boot);
else boot();

})();
