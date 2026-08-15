/* ============================== LEADERBOARD ==============================
   Runs publish two things when they end: the player's level and total XP.

   There is no leaderboard service baked into this file, because a single
   HTML file has nowhere private to keep one. Instead the board talks to an
   endpoint you configure — a ChatGPT Sites page, a worker, a gist proxy,
   anything that speaks the tiny JSON contract printed in the Setup tab.
   With no endpoint set, scores still persist locally and every run produces
   a shareable run code.
   ========================================================================= */
const Board = {
  cfg: Object.assign({ url: "", room: "phantasy-codex", name: "" }, Store.read("board", {}) || {}),
  local: Store.read("scores", []) || [],
  remote: [],
  status: "",
  lastPublished: null,

  saveCfg() { Store.write("board", this.cfg); },

  entryFor(P, stats, runT) {
    return {
      v: 1,
      board: this.cfg.room || "phantasy-codex",
      name: (this.cfg.name || "Wayfarer").slice(0, 14),
      level: P.level,
      xp: Math.round(P.totalXp),
      kills: stats.kills,
      time: Math.round(runT),
      build: buildTitle(P),
      weapon: WEAPONS[P.weapon].name,
      seed: G.seed,
      at: Date.now()
    };
  },

  addLocal(e) {
    this.local.push(e);
    this.local.sort((a, b) => b.xp - a.xp || b.level - a.level);
    this.local = this.local.slice(0, 30);
    Store.write("scores", this.local);
    Store.write("lastRun", e);
    G.lastRun = e;
  },

  runCode(e) {
    try {
      const compact = { n: e.name, l: e.level, x: e.xp, k: e.kills, t: e.time, b: e.build, s: e.seed };
      return "PCA1." + btoa(unescape(encodeURIComponent(JSON.stringify(compact)))).replace(/=+$/, "");
    } catch (err) { return "PCA1.(unavailable)"; }
  },

  async publish(e) {
    this.lastPublished = e;
    this.addLocal(e);
    if (!this.cfg.url) { this.status = "Saved on this device. Add an endpoint in Setup to share it."; return { ok: false, local: true }; }
    try {
      const res = await fetch(this.cfg.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(e)
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      this.status = "Published to the shared board.";
      this.fetchTop();
      return { ok: true };
    } catch (err) {
      this.status = "Could not reach the endpoint (" + (err && err.message ? err.message : "network error") + "). Saved locally.";
      return { ok: false, error: String(err) };
    }
  },

  async fetchTop() {
    if (!this.cfg.url) { this.remote = []; this.status = "No endpoint configured."; return []; }
    try {
      const sep = this.cfg.url.indexOf("?") >= 0 ? "&" : "?";
      const res = await fetch(this.cfg.url + sep + "board=" + encodeURIComponent(this.cfg.room || "phantasy-codex") + "&limit=25", { method: "GET" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      const arr = Array.isArray(data) ? data : (data.scores || data.entries || data.results || []);
      this.remote = arr.map(r => ({
        name: String(r.name == null ? "?" : r.name).slice(0, 14),
        level: Number(r.level) || 0,
        xp: Number(r.xp) || 0,
        build: r.build ? String(r.build).slice(0, 40) : "",
        time: Number(r.time) || 0
      })).filter(r => r.level > 0).sort((a, b) => b.xp - a.xp).slice(0, 25);
      this.status = this.remote.length ? "Shared board — " + this.remote.length + " runs." : "Endpoint reachable, but the board is empty.";
      return this.remote;
    } catch (err) {
      this.remote = [];
      this.status = "Could not read the endpoint (" + (err && err.message ? err.message : "network error") + ").";
      return [];
    }
  }
};

const EP_CONTRACT =
  "<b>Contract.</b> <code>POST</code> the run as JSON " +
  "<code>{board,name,level,xp,kills,time,build,seed}</code> — store it. " +
  "<code>GET ?board=&lt;name&gt;&amp;limit=25</code> — reply with a JSON array (or " +
  "<code>{scores:[…]}</code>) of <code>{name,level,xp,build,time}</code>. " +
  "Your endpoint must send permissive CORS headers, otherwise the browser blocks the call.";

/* ================================== UI =================================== */
const UI = {
  overlays: ["titleScreen", "howto", "levelup", "sheet", "pause", "gameover", "board"],
  boardReturn: "title"
};
function showOverlay(id) {
  for (const o of UI.overlays) $(o).classList.toggle("on", o === id);
  $("hud").style.display = (id === null && G.mode === "play") ? "" : ($("hud").style.display);
}
function hideOverlays() { for (const o of UI.overlays) $(o).classList.remove("on"); }

function setMode(m) {
  G.mode = m;
  const playing = m === "play";
  $("hud").style.visibility = (playing || m === "levelup") ? "visible" : "hidden";
  $("touch").style.visibility = (playing && Input.touch) ? "visible" : "hidden";
  if (m === "play") hideOverlays();
  else if (m === "title") showOverlay("titleScreen");
  else if (m === "howto") showOverlay("howto");
  else if (m === "levelup") showOverlay("levelup");
  else if (m === "sheet") showOverlay("sheet");
  else if (m === "pause") showOverlay("pause");
  else if (m === "dead") showOverlay("gameover");
  else if (m === "board") showOverlay("board");
}

/* --------------------------------- toast -------------------------------- */
function toast(msg) {
  const box = $("toast");
  const el = document.createElement("div");
  el.className = "tmsg";
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity .4s, transform .4s";
    el.style.opacity = "0"; el.style.transform = "translateY(-6px)";
    setTimeout(() => el.remove(), 420);
  }, 2200);
  while (box.children.length > 3) box.firstChild.remove();
}

/* --------------------------------- HUD ---------------------------------- */
let _hudGhost = { hp: 1, t: 0 };
function syncHud() {
  const P = G.P;
  if (!P) return;
  const hpPct = clamp(P.hp / P.maxHp, 0, 1) * 100;
  $("hpFill").style.width = hpPct + "%";
  $("hpTxt").textContent = Math.ceil(P.hp) + " / " + P.maxHp;
  if (hpPct > _hudGhost.hp * 100) _hudGhost.hp = hpPct / 100;
  $("hpGhost").style.width = (_hudGhost.hp * 100) + "%";
  $("hpGhost").style.opacity = (_hudGhost.hp * 100 - hpPct) > 0.5 ? "0.45" : "0";
  $("spFill").style.width = clamp(P.sp / P.maxSp, 0, 1) * 100 + "%";
  $("spTxt").textContent = Math.ceil(P.sp) + " / " + P.maxSp;
  $("xpFill").style.width = clamp(P.xp / P.xpNext, 0, 1) * 100 + "%";
  $("xpTxt").textContent = "XP " + Math.floor(P.xp) + " / " + P.xpNext;
  $("lvlNum").textContent = P.level;
  const cb = $("comboBox");
  cb.classList.toggle("on", P.combo >= 2);
  $("comboN").textContent = "x" + P.combo;
  /* the dark sweep shows how much of the next charge is still missing;
     with a charge in hand there is nothing to mask */
  const dashMask = P.dash > 0 ? 0 : clamp(P.dashT / 1.5, 0, 1);
  $("dashCd").style.setProperty("--cd", (360 * dashMask) + "deg");
  const b = World.biomeAt(P.x, P.y);
  $("codexPeek").textContent = BIOME_NAME[b] + "  ·  " + G.stats.kills + " felled";
}
function syncWeaponPod() {
  const P = G.P;
  if (!P) return;
  const key = P.weapon;
  $("podIcon").src = ART.weapons[key][clamp(P.tiers[key] - 1, 0, 4)].toDataURL();
  $("podName").textContent = WEAPONS[key].name;
  $("podTier").textContent = "Tier " + roman(P.tiers[key]);
  $("atkIcon").src = ART.boons[WEAPONS[key].icon].toDataURL();
}

/* ------------------------------ level up -------------------------------- */
function openLevelUp() {
  const P = G.P;
  G.cards = pickCards(P, 3);
  G.rerolls = Math.floor(P.level / 4) - (G.rerollsUsed || 0);
  $("luTitle").textContent = "LEVEL " + P.level;
  $("luSub").textContent = G.pendingLevels > 1 ? "Choose a boon (" + G.pendingLevels + " pending)" : "Choose a boon";
  renderCards();
  setMode("levelup");
  Sound.play("levelup");
  screenFlash("rgba(255,207,92,.35)", 0.3);
}
function renderCards() {
  const box = $("cards");
  box.innerHTML = "";
  for (const b of G.cards) {
    const el = document.createElement("div");
    el.className = "panel card " + b.rar;
    const taken = G.P.boons.filter(x => x === b.id).length;
    el.innerHTML =
      '<div class="crar">' + b.rar + (taken ? " · " + taken + "/" + b.max : "") + "</div>" +
      '<img alt="" src="' + ART.boons[b.icon].toDataURL() + '">' +
      '<div class="cname">' + b.name + "</div>" +
      '<div class="cdesc">' + b.desc + "</div>";
    on(el, "click", () => { applyBoon(b); afterChoice(); });
    box.appendChild(el);
  }
  const rr = $("btnReroll");
  rr.textContent = "Reroll (" + Math.max(0, G.rerolls) + ")";
  rr.style.display = G.rerolls > 0 ? "" : "none";
}
function afterChoice() {
  syncWeaponPod();
  if (G.pendingLevels > 0) openLevelUp();
  else { setMode("play"); G.rerollsUsed = 0; }
}

/* --------------------------- character sheet ---------------------------- */
function openSheet() {
  const P = G.P;
  $("sheetPortrait").src = ART.hero.portrait.toDataURL();
  $("buildTitle").textContent = buildTitle(P);
  $("sheetSub").textContent = "Level " + P.level + " · " + fmtNum(P.totalXp) + " total XP · " + WEAPONS[P.weapon].name;
  $("sxpFill").style.width = clamp(P.xp / P.xpNext, 0, 1) * 100 + "%";
  $("sxpTxt").textContent = Math.floor(P.xp) + " / " + P.xpNext;

  const st = weaponStats(P, P.weapon);
  const rows = [
    ["Health", Math.ceil(P.hp) + " / " + P.maxHp],
    ["Stamina", Math.ceil(P.sp) + " / " + P.maxSp],
    ["Stamina regen", P.spRegen.toFixed(1) + "/s"],
    ["Move speed", Math.round(P.moveSpeed * 100) + "%"],
    ["Attack power", Math.round(st.dmg)],
    ["Attack speed", (1 / st.cd).toFixed(2) + "/s"],
    ["Crit chance", Math.round(P.critChance * 100) + "%"],
    ["Crit damage", Math.round(P.critMul * 100) + "%"],
    ["Damage reduction", P.armor ? P.armor : "—"],
    ["Lifesteal", Math.round(P.lifesteal * 100) + "%"],
    ["XP gain", Math.round(P.xpMul * 100) + "%"],
    ["Dashes", P.dash + " / " + P.dashMax],
    ["Ward", P.wardMax ? P.ward + " / " + P.wardMax : "—"],
    ["Thorns", P.thorns ? P.thorns : "—"]
  ];
  $("sheetStats").innerHTML = rows.map(r => '<div class="stat"><span>' + r[0] + "</span><b>" + r[1] + "</b></div>").join("");

  $("sheetWeapons").innerHTML = WEAPON_ORDER.map(k => {
    const s = weaponStats(P, k), t = P.tiers[k];
    const pips = [1, 2, 3, 4, 5].map(i => '<div class="pip' + (i <= t ? " on" : "") + '"></div>').join("");
    return '<div class="wrow"' + (k === P.weapon ? ' style="border-color:var(--gold)"' : "") + ">" +
      '<img alt="" src="' + ART.weapons[k][clamp(t - 1, 0, 4)].toDataURL() + '">' +
      '<div class="wmeta"><div class="wt">' + WEAPONS[k].name + (k === P.weapon ? " · equipped" : "") + "</div>" +
      '<div class="wd">' + Math.round(s.dmg) + " dmg · " + s.stam.toFixed(0) + " stam · " + WEAPONS[k].trait(t) + "</div></div>" +
      '<div class="pips">' + pips + "</div></div>";
  }).join("");

  const counts = {};
  for (const id of P.boons) counts[id] = (counts[id] || 0) + 1;
  const keys = Object.keys(counts);
  $("sheetPerks").innerHTML = keys.length
    ? keys.map(id => {
      const b = BOONS.find(x => x.id === id);
      return '<div class="perk"><img alt="" src="' + ART.boons[b.icon].toDataURL() + '">' + b.name +
        (counts[id] > 1 ? " <b>x" + counts[id] + "</b>" : "") + "</div>";
    }).join("")
    : "<small>None yet — level up to earn boons.</small>";

  const S = G.stats;
  $("sheetRun").innerHTML = [
    ["Monsters felled", S.kills],
    ["Best chain", "x" + S.bestCombo],
    ["Damage dealt", fmtNum(S.dmgDealt)],
    ["Damage taken", fmtNum(S.dmgTaken)],
    ["Shrines used", S.shrines],
    ["Obelisks", S.obelisks],
    ["Caches opened", S.chests],
    ["Survived", fmtTime(G.runT)],
    ["Distance", fmtNum(S.dist / TS) + " tiles"],
    ["World seed", "#" + G.seed]
  ].map(r => '<div class="stat"><span>' + r[0] + "</span><b>" + r[1] + "</b></div>").join("");

  $("sheetCodex").innerHTML = MON_KEYS.map(k => {
    const M = MONSTERS[k], seen = !!G.codex[k];
    const n = (G.stats.byType[k] || 0);
    return '<div class="codexcell' + (seen ? "" : " locked") + '">' +
      '<img alt="" src="' + ART.mon[M.art].r[0].toDataURL() + '">' +
      "<b>" + (seen ? M.name : "???") + "</b>" +
      "<span>" + (seen ? (M.passive ? "passive" : M.elite ? "elite" : "hostile") + (n ? " · " + n : "") : "undiscovered") + "</span></div>";
  }).join("");

  setMode("sheet");
  Sound.play("open");
}

/* ------------------------------ leaderboard ----------------------------- */
function lbRow(i, e, me) {
  return '<div class="lbrow' + (me ? " me" : "") + '">' +
    '<div class="lbrank">' + (i + 1) + "</div>" +
    '<div class="lbname">' + escapeHtml(e.name) + (e.build ? ' <small style="opacity:.7">' + escapeHtml(e.build) + "</small>" : "") + "</div>" +
    '<div class="lblvl">Lv ' + e.level + "</div>" +
    '<div class="lbxp">' + fmtNum(e.xp) + " XP</div></div>";
}
function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function renderBoard() {
  const last = Board.lastPublished || G.lastRun;
  $("localList").innerHTML = Board.local.length
    ? Board.local.map((e, i) => lbRow(i, e, last && e.at === last.at)).join("")
    : '<p><small>No runs recorded on this device yet.</small></p>';
  $("globalList").innerHTML = Board.remote.length
    ? Board.remote.map((e, i) => lbRow(i, e, last && e.name === last.name && e.xp === last.xp)).join("")
    : '<p><small>' + (Board.cfg.url ? "Nothing on the shared board yet." : "No shared endpoint configured — open <b>Setup</b> to connect one, or play on with local scores.") + "</small></p>";
  $("globalStatus").textContent = Board.status;
  $("epUrl").value = Board.cfg.url || "";
  $("epRoom").value = Board.cfg.room || "";
  $("epContract").innerHTML = EP_CONTRACT;
  $("runCode").textContent = last ? Board.runCode(last) : "— finish a run to generate a code —";
  const dot = Board.cfg.url ? '<span class="statusdot ok"></span>Endpoint set.' : '<span class="statusdot"></span>No endpoint configured.';
  $("epStatus").innerHTML = dot;
}
function openBoard(from) {
  UI.boardReturn = from || G.mode;
  renderBoard();
  setMode("board");
  Sound.play("open");
  if (Board.cfg.url) Board.fetchTop().then(() => { if (G.mode === "board") renderBoard(); });
}
function switchTab(name) {
  for (const t of document.querySelectorAll(".tab")) t.classList.toggle("on", t.dataset.tab === name);
  $("tabGlobal").style.display = name === "global" ? "" : "none";
  $("tabLocal").style.display = name === "local" ? "" : "none";
  $("tabSetup").style.display = name === "setup" ? "" : "none";
}

/* ------------------------------- run end -------------------------------- */
function endRun() {
  const P = G.P;
  G.mode = "dead";
  $("goLvl").textContent = P.level;
  $("goXp").textContent = fmtNum(P.totalXp);
  $("goKills").textContent = G.stats.kills;
  $("goTime").textContent = fmtTime(G.runT);
  $("goBuild").textContent = buildTitle(P) + " · best chain x" + G.stats.bestCombo + " · seed #" + G.seed;
  $("goName").value = Board.cfg.name || "";
  $("pubStatus").innerHTML = '<span class="statusdot"></span>Not published yet.';
  setMode("dead");
}
async function publishRun() {
  const P = G.P;
  Board.cfg.name = ($("goName").value || "Wayfarer").trim().slice(0, 14) || "Wayfarer";
  Board.saveCfg();
  const entry = Board.entryFor(P, G.stats, G.runT);
  $("pubStatus").innerHTML = '<span class="statusdot"></span>Publishing…';
  $("btnPublish").disabled = true;
  const res = await Board.publish(entry);
  $("btnPublish").disabled = false;
  $("pubStatus").innerHTML = '<span class="statusdot ' + (res.ok ? "ok" : "err") + '"></span>' +
    escapeHtml(Board.status) + " Level " + entry.level + ", " + fmtNum(entry.xp) + " XP.";
  updateBestLine();
}
function updateBestLine() {
  const best = Board.local[0];
  $("bestLine").textContent = best
    ? "Best run on this device: level " + best.level + " · " + fmtNum(best.xp) + " XP · " + best.build
    : "No runs yet — the codex is blank.";
}
