/* ================================ RENDER ================================= */
let _vignette = null, _vigKey = "";
function vignette() {
  const key = Display.W + "x" + Display.H;
  if (_vignette && _vigKey === key) return _vignette;
  const cv = document.createElement("canvas");
  cv.width = Display.W; cv.height = Display.H;
  const g = cv.getContext("2d");
  const grd = g.createRadialGradient(Display.W / 2, Display.H / 2, Math.min(Display.W, Display.H) * 0.30,
    Display.W / 2, Display.H / 2, Math.max(Display.W, Display.H) * 0.78);
  grd.addColorStop(0, "rgba(0,0,0,0)");
  grd.addColorStop(1, "rgba(6,4,16,0.55)");
  g.fillStyle = grd; g.fillRect(0, 0, cv.width, cv.height);
  _vignette = cv; _vigKey = key;
  return cv;
}

const drawList = [];
function pushDraw(y, img, x, top, opt) { drawList.push({ y, img, x, top, opt: opt || null }); }

function shadow(g, x, y, rx, ry, a) {
  g.save();
  g.globalAlpha = a == null ? 0.30 : a;
  g.fillStyle = "#000000";
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, TAU);
  g.fill();
  g.restore();
}

function render() {
  const g = ctx, P = G.P;
  const ox = Math.round(-(G.cam.x + G.cam.sx)), oy = Math.round(-(G.cam.y + G.cam.sy));
  const VW = Display.W, VH = Display.H;

  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = "#0a1430";
  g.fillRect(0, 0, VW, VH);
  if (!P) return;

  const tx0 = Math.floor((-ox) / TS) - 1, ty0 = Math.floor((-oy) / TS) - 1;
  const tx1 = Math.ceil((-ox + VW) / TS) + 1, ty1 = Math.ceil((-oy + VH) / TS) + 1;

  /* --- static ground, from the chunk cache --- */
  const CH = World.CH, CS = CH * TS;
  const cx0 = Math.floor(tx0 / CH), cx1 = Math.floor(tx1 / CH);
  const cy0 = Math.floor(ty0 / CH), cy1 = Math.floor(ty1 / CH);
  for (let cy = cy0; cy <= cy1; cy++)
    for (let cx = cx0; cx <= cx1; cx++)
      g.drawImage(World.chunkAt(cx, cy), cx * CS + ox, cy * CS + oy);

  /* --- animated tiles (water, lava) --- */
  const wf = Math.floor(G.animT * 4.5) % 4;
  for (let ty = ty0; ty <= ty1; ty++)
    for (let tx = tx0; tx <= tx1; tx++) {
      const t = World.tileAt(tx, ty);
      if (!TILE_ANIM[t]) continue;
      g.drawImage(ART.tiles[TILE_ART_KEY[t]][wf], tx * TS + ox, ty * TS + oy);
    }

  /* --- collect everything that sorts by depth --- */
  drawList.length = 0;

  for (let ty = ty0; ty <= ty1; ty++)
    for (let tx = tx0; tx <= tx1; tx++) {
      const pi = World.propAt(tx, ty);
      if (!pi) continue;
      const pr = PROPS[pi];
      const img = ART.props[pr.art];
      let sx = tx * TS + TS / 2 - img.width / 2;
      if (pr.sway) sx += Math.round(Math.sin(G.t * 1.6 + tx * 0.7 + ty * 0.4) * (pr.sway === 2 ? 1 : 0.6));
      const baseY = ty * TS + TS + pr.oy - img.height;
      pushDraw(ty * TS + TS + (pr.solid ? 2 : 0), img, sx, baseY, pr.solid ? { shadow: 0 } : null);
    }

  for (const L of World.landmarks) {
    if (L.x < -ox - 40 || L.x > -ox + VW + 40 || L.y < -oy - 60 || L.y > -oy + VH + 40) continue;
    let img;
    const f = Math.floor(G.animT * 5) % 4;
    if (L.kind === "shrine") img = ART.props.shrine[f];
    else if (L.kind === "obelisk") img = L.used ? ART.props.obeliskUsed : ART.props.obelisk[f];
    else img = L.used ? ART.props.chestOpen : ART.props.chest;
    pushDraw(L.y + 8, img, Math.round(L.x - img.width / 2), Math.round(L.y + 8 - img.height), { glow: !L.used && L.kind !== "chest" });
  }

  for (const m of G.mons) {
    if (m.x < -ox - 60 || m.x > -ox + VW + 60 || m.y < -oy - 70 || m.y > -oy + VH + 60) continue;
    const set = ART.mon[m.def.art];
    const img = (m.face < 0 ? set.l : set.r)[m.frame];
    const bob = (m.def.art === "nightwing" || m.def.art === "emberwisp" || m.def.art === "gloomwraith") ? Math.round(Math.sin(m.bob) * 2) : 0;
    pushDraw(m.y + 6, img, Math.round(m.x - img.width / 2), Math.round(m.y + 6 - img.height + bob), { mon: m });
  }

  /* the hero */
  {
    const set = ART.hero[P.dir] || ART.hero.down;
    const img = set[P.frame];
    pushDraw(P.y + 5, img, Math.round(P.x - img.width / 2), Math.round(P.y + 5 - img.height), { player: true });
  }

  drawList.sort((a, b) => a.y - b.y);

  /* ground shadows first, so nothing casts onto a sprite in front */
  for (const d of drawList) {
    if (d.opt && d.opt.mon) shadow(g, Math.round(d.opt.mon.x + ox), Math.round(d.opt.mon.y + oy + 4), d.opt.mon.def.r + 2, (d.opt.mon.def.r + 2) * 0.42);
    else if (d.opt && d.opt.player) shadow(g, Math.round(P.x + ox), Math.round(P.y + oy + 3), 6, 2.6);
  }

  /* anything drawn after the hero that covers him goes translucent, so a tree
     or an obelisk can never swallow the player sprite */
  const pRect = { x: P.x - 8, y: P.y - 15, w: 16, h: 20 };
  let passedPlayer = false;

  for (const d of drawList) {
    const o = d.opt;
    if (o && o.mon) { drawMonster(g, o.mon, d.img, d.x + ox, d.top + oy); continue; }
    if (o && o.player) { passedPlayer = true; drawPlayer(g, d.img, d.x + ox, d.top + oy); continue; }
    let faded = false;
    if (passedPlayer && d.img.height > 18 &&
        d.x < pRect.x + pRect.w && d.x + d.img.width > pRect.x &&
        d.top < pRect.y + pRect.h && d.top + d.img.height > pRect.y) {
      faded = true; g.save(); g.globalAlpha = 0.45;
    }
    if (o && o.glow) {
      g.save();
      g.globalAlpha = 0.30 + Math.sin(G.t * 3) * 0.12;
      g.globalCompositeOperation = "lighter";
      g.drawImage(d.img, d.x + ox, d.top + oy - 1);
      g.restore();
    }
    g.drawImage(d.img, d.x + ox, d.top + oy);
    if (faded) g.restore();
  }

  /* --- projectiles --- */
  const bf = Math.floor(G.animT * 12) % 2;
  for (const b of G.bolts) {
    const img = ART.bolts[b.kind || "fire"][bf];
    g.save();
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = 0.5;
    g.drawImage(img, Math.round(b.x + ox - img.width / 2), Math.round(b.y + oy - img.height / 2));
    g.restore();
    g.drawImage(img, Math.round(b.x + ox - img.width / 2), Math.round(b.y + oy - img.height / 2));
  }

  /* --- pickups --- */
  const pf = Math.floor(G.animT * 6) % 2;
  for (const d of G.drops) {
    let img;
    if (d.kind === "xp") img = ART.icons.xp[pf];
    else if (d.kind === "heart") img = ART.icons.heart;
    else if (d.kind === "stam") img = ART.icons.stam;
    else img = ART.icons.coin;
    const bob = Math.sin(G.t * 5 + d.t * 3) * 1.2;
    const dy = Math.round(d.y + oy - d.z - bob - img.height / 2);
    shadow(g, Math.round(d.x + ox), Math.round(d.y + oy + 2), 3.4, 1.6, 0.22);
    if (d.life < 5 && Math.floor(d.life * 8) % 2 === 0) { /* blink out */ }
    else {
      g.save(); g.globalCompositeOperation = "lighter"; g.globalAlpha = .45;
      g.drawImage(img, Math.round(d.x + ox - img.width / 2), dy);
      g.restore();
      g.drawImage(img, Math.round(d.x + ox - img.width / 2), dy);
    }
  }

  /* --- particles --- */
  for (const f of G.fx) {
    const a = clamp(f.life / f.max, 0, 1);
    if (f.type === "ring") {
      const t = 1 - a, r = lerp(f.r, f.r1, t * t < 1 ? Math.sqrt(t) : 1);
      g.save();
      g.globalAlpha = a * 0.85;
      g.strokeStyle = f.col; g.lineWidth = Math.max(1, 2 * a);
      g.beginPath(); g.ellipse(Math.round(f.x + ox), Math.round(f.y + oy), r, r * 0.55, 0, 0, TAU); g.stroke();
      g.restore();
      continue;
    }
    g.globalAlpha = a;
    g.fillStyle = f.col;
    const s = Math.max(1, Math.round(f.r * (0.5 + a * 0.7)));
    g.fillRect(Math.round(f.x + ox - s / 2), Math.round(f.y + oy - s / 2), s, s);
  }
  g.globalAlpha = 1;

  /* --- floating numbers --- */
  for (const n of G.nums) {
    const a = clamp(n.life / n.max, 0, 1);
    const pop = n.t < 0.10 ? lerp(0.4, 1.15, n.t / 0.10) : n.t < 0.18 ? lerp(1.15, 1, (n.t - 0.10) / 0.08) : 1;
    const size = Math.max(5, n.size * pop);
    g.save();
    g.globalAlpha = a;
    g.font = "bold " + size.toFixed(1) + "px ui-monospace, monospace";
    g.textAlign = "center"; g.textBaseline = "middle";
    const px = Math.round(n.x + ox), py = Math.round(n.y + oy);
    g.lineWidth = 3; g.strokeStyle = "rgba(10,7,22,.9)";
    g.strokeText(n.text, px, py);
    if (n.crit) { g.shadowColor = n.col; g.shadowBlur = 8; }
    g.fillStyle = n.col;
    g.fillText(n.text, px, py);
    g.restore();
  }

  /* --- full-screen washes --- */
  g.drawImage(vignette(), 0, 0);
  if (G.flashT > 0 && G.flashCol) {
    g.save(); g.globalAlpha = clamp(G.flashT * 3, 0, 1);
    g.fillStyle = G.flashCol; g.fillRect(0, 0, VW, VH); g.restore();
  }
  if (P.hurtFlash > 0) {
    g.save(); g.globalAlpha = clamp(P.hurtFlash, 0, 1) * 0.5;
    g.fillStyle = "rgba(200,20,40,1)";
    g.fillRect(0, 0, VW, 5); g.fillRect(0, VH - 5, VW, 5);
    g.fillRect(0, 0, 5, VH); g.fillRect(VW - 5, 0, 5, VH);
    g.restore();
  }
  if (!P.alive) { g.save(); g.globalAlpha = 0.5; g.fillStyle = "#3a0a12"; g.fillRect(0, 0, VW, VH); g.restore(); }
}

function drawPlayer(g, img, x, y) {
  const P = G.P;
  /* weapon behind the body when swinging away from the camera */
  const behind = P.atk && (P.dir === "up");
  if (P.atk && behind) drawWeapon(g);
  g.save();
  if (P.iframes > 0 && Math.floor(G.t * 22) % 2 === 0) g.globalAlpha = 0.45;
  if (P.hurtFlash > 0.22) g.drawImage(flashOf(img), x, y);
  else g.drawImage(img, x, y);
  g.restore();
  if (P.healPulse > 0) {
    g.save(); g.globalCompositeOperation = "lighter"; g.globalAlpha = P.healPulse * 0.7;
    g.drawImage(tintOf(img, "#8ef07a", 1), x, y); g.restore();
  }
  if (P.levelPulse > 0) {
    g.save(); g.globalCompositeOperation = "lighter"; g.globalAlpha = P.levelPulse * 0.8;
    g.drawImage(tintOf(img, "#ffcf5c", 1), x, y); g.restore();
  }
  if (P.atk && !behind) drawWeapon(g);
  /* ward shimmer */
  if (P.ward > 0) {
    const ox = Math.round(-(G.cam.x + G.cam.sx)), oy = Math.round(-(G.cam.y + G.cam.sy));
    g.save();
    g.globalAlpha = 0.35 + Math.sin(G.t * 4) * 0.12;
    g.strokeStyle = "#9fd8ff"; g.lineWidth = 1;
    g.beginPath(); g.ellipse(P.x + ox, P.y + oy - 7, 11, 13, 0, 0, TAU); g.stroke();
    g.restore();
  }
}

function drawWeapon(g) {
  const P = G.P, A = P.atk;
  if (!A) return;
  const ox = Math.round(-(G.cam.x + G.cam.sx)), oy = Math.round(-(G.cam.y + G.cam.sy));
  const prog = clamp(A.t / A.dur, 0, 1);
  const key = A.w;
  const img = ART.weapons[key][clamp(P.tiers[key] - 1, 0, 4)];
  let ang, push;
  if (key === "wand") {
    ang = A.ang; push = 6 + Math.sin(prog * Math.PI) * 5;
  } else {
    const sweep = A.spin ? TAU : A.st.arc;
    const e = prog < 0.12 ? (prog / 0.12) * 0.12 : prog;       /* quick wind-up, then the sweep */
    ang = A.ang - sweep / 2 + sweep * clamp((e - 0.10) / 0.62, 0, 1);
    push = key === "spear" ? 8 + Math.sin(clamp((prog - 0.05) / 0.5, 0, 1) * Math.PI) * 16 : 9;
  }
  const px = P.x + ox + Math.cos(ang) * push;
  const py = P.y + oy - 6 + Math.sin(ang) * push;
  g.save();
  g.translate(px, py);
  g.rotate(ang);
  g.drawImage(img, -6, -Math.round(img.height / 2));
  g.restore();

  /* arc smear */
  if (key !== "wand" && prog > 0.10 && prog < 0.74) {
    const sweep = A.spin ? TAU : A.st.arc;
    const start = A.ang - sweep / 2;
    const cur = start + sweep * clamp((prog - 0.10) / 0.62, 0, 1);
    g.save();
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = 0.5 * (1 - Math.abs(prog - 0.4) / 0.4);
    g.strokeStyle = A.spin ? "#ffcf5c" : "#ffffff";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(P.x + ox, P.y + oy - 5, A.st.range * 0.82, cur - sweep * 0.32, cur);
    g.stroke();
    g.restore();
  }
}

function drawMonster(g, m, img, x, y) {
  const telegraph = m.state === "windup";
  g.save();
  if (telegraph && Math.floor(G.t * 18) % 2 === 0) {
    g.drawImage(tintOf(img, "#ff5566", 0.75), x, y);
  } else if (m.flash > 0) {
    g.drawImage(flashOf(img), x, y);
  } else {
    if (m.def.phaser) g.globalAlpha = 0.78;
    g.drawImage(img, x, y);
  }
  g.restore();

  if (m.elite) {
    const c = ART.crown;
    const cox = Math.round(-(G.cam.x + G.cam.sx));
    g.drawImage(c, Math.round(m.x + cox - c.width / 2), y - 5);
  }
  /* health pip bar once a monster has been hurt */
  if (m.hp < m.maxHp) {
    const ox = Math.round(-(G.cam.x + G.cam.sx)), oy = Math.round(-(G.cam.y + G.cam.sy));
    const w = Math.max(12, m.def.r * 2 + 6);
    const bx = Math.round(m.x + ox - w / 2), by = Math.round(m.y + oy - m.def.r * 2 - 8);
    g.fillStyle = "rgba(10,7,22,.85)"; g.fillRect(bx - 1, by - 1, w + 2, 4);
    g.fillStyle = m.elite ? "#ffcf5c" : m.def.passive ? "#8ef07a" : "#ff5566";
    g.fillRect(bx, by, Math.round(w * clamp(m.hp / m.maxHp, 0, 1)), 2);
  }
  /* status pips */
  if (m.burnT > 0 || m.chillT > 0) {
    const ox = Math.round(-(G.cam.x + G.cam.sx)), oy = Math.round(-(G.cam.y + G.cam.sy));
    let sx = Math.round(m.x + ox - 4);
    if (m.burnT > 0) { g.fillStyle = "#ff8a3c"; g.fillRect(sx, Math.round(m.y + oy - m.def.r * 2 - 13), 3, 3); sx += 4; }
    if (m.chillT > 0) { g.fillStyle = "#9fd8ff"; g.fillRect(sx, Math.round(m.y + oy - m.def.r * 2 - 13), 3, 3); }
  }
}
