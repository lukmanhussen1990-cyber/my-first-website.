/* ============================= GAME STATE ================================ */
const G = {
  mode: "title",            /* title | play | levelup | sheet | pause | dead | board | howto */
  t: 0, runT: 0, dt: 0, animT: 0,
  cam: { x: 0, y: 0, sx: 0, sy: 0, trauma: 0 },
  P: null, mons: [], bolts: [], fx: [], nums: [], drops: [],
  hitstop: 0, spawnT: 0, surgeT: 70, seed: 0, flashCol: null, flashT: 0,
  codex: Store.read("codex", {}),
  stats: null, pendingLevels: 0, cards: [], rerolls: 0,
  lastRun: Store.read("lastRun", null)
};

function newStats() {
  return { kills: 0, byType: {}, bestCombo: 0, dmgDealt: 0, dmgTaken: 0, chests: 0, obelisks: 0, shrines: 0, biomes: {}, dist: 0 };
}

function newPlayer() {
  return {
    x: 0, y: 0, vx: 0, vy: 0, r: 5.5, dir: "down", animT: 0, frame: 0, moving: false,
    hp: 60, maxHp: 60, sp: 40, maxSp: 40, spRegen: 20, spHold: 0, tiredT: 0,
    level: 1, xp: 0, xpNext: 26, totalXp: 0,
    weapon: "sword", tiers: { sword: 1, spear: 1, wand: 1 },
    /* modifiers, all mutated by boons */
    dmgMul: 1, wdmg: { sword: 1, spear: 1, wand: 1 }, atkSpeed: 1, stamCost: 1,
    critChance: 0.05, critMul: 1.8, moveSpeed: 1, lifesteal: 0, xpMul: 1, magnetR: 30,
    thorns: 0, armor: 0, knockMul: 1, stagger: 0, rangeBonus: 0, killStam: 0,
    burn: 0, chill: 0, chain: 0, wardMax: 0, ward: 0, wardT: 0,
    dashMax: 1, dash: 1, dashRate: 1, dashT: 0, dashing: 0, dashDir: { x: 0, y: 1 },
    atk: null, atkCd: 0, chainIdx: 0, chainT: 0,
    iframes: 0, hurtFlash: 0, knockX: 0, knockY: 0, knockT: 0,
    combo: 0, comboT: 0, boons: [], alive: true, healPulse: 0, levelPulse: 0
  };
}
const BASE_SPEED = 62;

function upgradeWeapon(P, key) {
  if (P.tiers[key] >= 5) { P.wdmg[key] *= 1.2; return false; }
  P.tiers[key]++;
  if (key === P.weapon || P.tiers[key] >= 4) buildHeroArt(Math.max(P.tiers.sword, P.tiers.spear, P.tiers.wand));
  return true;
}

/* ------------------------------ camera ---------------------------------- */
function addShake(v) { G.cam.trauma = Math.min(1, G.cam.trauma + v); }
function updateCamera(dt) {
  const P = G.P;
  const tx = P.x - Display.W / 2, ty = P.y - Display.H / 2 + (Input.touch ? Display.H * 0.10 : 0);
  const k = 1 - Math.pow(0.0016, dt);
  G.cam.x = lerp(G.cam.x, tx, k);
  G.cam.y = lerp(G.cam.y, ty, k);
  G.cam.x = clamp(G.cam.x, 0, World.W * TS - Display.W);
  G.cam.y = clamp(G.cam.y, 0, World.H * TS - Display.H);
  G.cam.trauma = Math.max(0, G.cam.trauma - dt * 1.7);
  const s = G.cam.trauma * G.cam.trauma * 7;
  G.cam.sx = (Math.random() * 2 - 1) * s;
  G.cam.sy = (Math.random() * 2 - 1) * s;
}

/* ------------------------------ effects --------------------------------- */
function particle(x, y, opt) {
  if (G.fx.length > 620) return;
  G.fx.push({
    x, y, vx: opt.vx || 0, vy: opt.vy || 0, life: opt.life || 0.5, max: opt.life || 0.5,
    r: opt.r || 1.5, col: opt.col || "#ffffff", grav: opt.grav || 0, type: opt.type || "dot",
    drag: opt.drag == null ? 0.9 : opt.drag, rot: opt.rot || 0, spin: opt.spin || 0, z: opt.z || 0
  });
}
function burst(x, y, n, col, opt) {
  opt = opt || {};
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, s = (opt.speed || 60) * (0.35 + Math.random() * 0.9);
    particle(x, y, {
      vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.75, life: (opt.life || 0.42) * (0.6 + Math.random() * 0.8),
      r: opt.r || (1 + Math.random() * 1.6), col: Array.isArray(col) ? col[(Math.random() * col.length) | 0] : col,
      grav: opt.grav == null ? 120 : opt.grav, type: opt.type || "dot", drag: opt.drag
    });
  }
}
function ring(x, y, col, r0, r1, life) {
  G.fx.push({ x, y, life, max: life, col, type: "ring", r: r0, r1: r1, vx: 0, vy: 0, grav: 0, drag: 1 });
}
function popNum(x, y, text, col, size, crit) {
  if (G.nums.length > 90) G.nums.shift();
  G.nums.push({
    x: x + (Math.random() * 8 - 4), y, text, col, size: size || 7, crit: !!crit,
    vx: (Math.random() * 26 - 13), vy: -54 - Math.random() * 18, life: crit ? 1.0 : 0.78, max: crit ? 1.0 : 0.78, t: 0
  });
}
function screenFlash(col, t) { G.flashCol = col; G.flashT = t; }
function hitstop(s) { G.hitstop = Math.max(G.hitstop, s); }

function updateFx(dt) {
  for (let i = G.fx.length - 1; i >= 0; i--) {
    const f = G.fx[i];
    f.life -= dt;
    if (f.life <= 0) { G.fx.splice(i, 1); continue; }
    if (f.type === "ring") continue;
    f.x += f.vx * dt; f.y += f.vy * dt;
    f.vy += f.grav * dt;
    const d = Math.pow(f.drag, dt * 60);
    f.vx *= d; f.vy *= d;
    f.rot += f.spin * dt;
  }
  for (let i = G.nums.length - 1; i >= 0; i--) {
    const n = G.nums[i];
    n.t += dt; n.life -= dt;
    if (n.life <= 0) { G.nums.splice(i, 1); continue; }
    n.x += n.vx * dt; n.y += n.vy * dt;
    n.vy += 120 * dt; n.vx *= Math.pow(0.9, dt * 60);
  }
  if (G.flashT > 0) G.flashT -= dt;
}

/* ------------------------------ drops ----------------------------------- */
function dropItem(x, y, kind, amount) {
  G.drops.push({
    x, y, kind, amount, life: 26, t: 0,
    vx: (Math.random() * 2 - 1) * 46, vy: (Math.random() * 2 - 1) * 46 - 20, z: 4 + Math.random() * 5, vz: 34 + Math.random() * 26
  });
}
function updateDrops(dt) {
  const P = G.P;
  const mag = P.magnetR;
  for (let i = G.drops.length - 1; i >= 0; i--) {
    const d = G.drops[i];
    d.t += dt; d.life -= dt;
    if (d.life <= 0) { G.drops.splice(i, 1); continue; }
    /* little hop when they land */
    if (d.z > 0 || d.vz !== 0) { d.vz -= 220 * dt; d.z += d.vz * dt; if (d.z <= 0) { d.z = 0; d.vz = d.vz < -30 ? -d.vz * 0.35 : 0; } }
    const dd = dist(d.x, d.y, P.x, P.y);
    if (dd < mag && d.t > 0.22) {
      const pull = clamp((mag - dd) / mag, 0, 1) * 420 + 60;
      const a = Math.atan2(P.y - d.y, P.x - d.x);
      d.vx = lerp(d.vx, Math.cos(a) * pull, 0.22);
      d.vy = lerp(d.vy, Math.sin(a) * pull, 0.22);
    } else {
      d.vx *= Math.pow(0.86, dt * 60); d.vy *= Math.pow(0.86, dt * 60);
    }
    d.x += d.vx * dt; d.y += d.vy * dt;
    if (dd < 9 && d.t > 0.15) { collect(d); G.drops.splice(i, 1); }
  }
}
function collect(d) {
  const P = G.P;
  if (d.kind === "xp") {
    gainXp(d.amount);
    Sound.play("pickup");
    particle(d.x, d.y, { col: "#ffcf5c", life: .3, r: 2 });
  } else if (d.kind === "heart") {
    const amt = Math.min(d.amount, P.maxHp - P.hp);
    P.hp = Math.min(P.maxHp, P.hp + d.amount);
    if (amt > 0) popNum(P.x, P.y - 18, "+" + Math.round(amt), "#8ef07a", 8);
    P.healPulse = 0.45; Sound.play("heal");
    burst(P.x, P.y - 6, 8, ["#8ef07a", "#ffffff"], { speed: 40, life: .5, grav: -30 });
  } else if (d.kind === "stam") {
    P.sp = Math.min(P.maxSp, P.sp + d.amount);
    popNum(P.x, P.y - 18, "+" + Math.round(d.amount), "#39d4c8", 7);
    Sound.play("pickup");
  } else if (d.kind === "coin") {
    gainXp(d.amount);
    Sound.play("coin");
  }
}

/* ------------------------------ progression ------------------------------ */
function xpForLevel(l) { return Math.round(22 + Math.pow(l, 1.72) * 15); }
function gainXp(n) {
  const P = G.P;
  n = n * P.xpMul * (1 + Math.min(P.combo, 30) * 0.02);
  P.xp += n; P.totalXp += n;
  while (P.xp >= P.xpNext) {
    P.xp -= P.xpNext;
    P.level++;
    P.xpNext = xpForLevel(P.level);
    /* innate growth so a base weapon never becomes useless for a player who
       spends every boon on survivability — boons and tiers are the upside */
    P.dmgMul = 1 + (P.level - 1) * 0.06;
    G.pendingLevels++;
  }
}
function pickCards(P, n) {
  const pool = [];
  for (const b of BOONS) {
    const taken = P.boons.filter(x => x === b.id).length;
    if (taken >= b.max) continue;
    if (b.req && !b.req(P)) continue;
    let w = RAR_W[b.rar];
    if (b.fav && b.fav === P.weapon) w *= 2.1;             /* favour what you use */
    if (b.fav && b.fav !== P.weapon) w *= 0.55;
    if (b.id === "vigor" && P.hp / P.maxHp < 0.4) w *= 2;  /* throw a lifeline */
    pool.push({ b, w });
  }
  const rng = makeRng((Math.random() * 1e9) | 0);
  const out = [];
  for (let i = 0; i < n && pool.length; i++) {
    const pick = rng.weighted(pool);
    out.push(pick.b);
    pool.splice(pool.indexOf(pick), 1);
  }
  return out;
}
function applyBoon(b) {
  const P = G.P;
  P.boons.push(b.id);
  b.apply(P);
  G.pendingLevels--;
  P.levelPulse = 0.7;
  Sound.play("upgrade");
  ring(P.x, P.y, "#ffcf5c", 6, 46, 0.5);
  burst(P.x, P.y - 6, 22, ["#ffcf5c", "#fff3d0", "#ffffff"], { speed: 90, life: .7, grav: -20 });
}

/* ------------------------------ combat ---------------------------------- */
function nearestMonster(x, y, maxD, exclude) {
  let best = null, bd = maxD * maxD;
  for (const m of G.mons) {
    if (m.dead || m === exclude) continue;
    const d = dist2(x, y, m.x, m.y);
    if (d < bd) { bd = d; best = m; }
  }
  return best;
}

function damageMonster(m, dmg, opt) {
  opt = opt || {};
  const P = G.P;
  if (m.dead) return 0;
  let crit = opt.noCrit ? false : Math.random() < P.critChance;
  let amount = dmg * (crit ? P.critMul : 1);
  amount = Math.max(1, Math.round(amount));
  m.hp -= amount;
  m.flash = 0.14;
  m.stagger = Math.max(m.stagger || 0, 0.12 + P.stagger);
  G.stats.dmgDealt += amount;

  /* a passive creature that gets hit stops being passive */
  if (m.def.passive && !m.angry) {
    m.angry = true; m.state = "chase"; m.stateT = 0;
    popNum(m.x, m.y - m.def.r - 12, "!", "#ff7a5c", 8);
  }

  if (opt.knock) {
    const a = opt.angle == null ? Math.atan2(m.y - P.y, m.x - P.x) : opt.angle;
    m.knockX = Math.cos(a) * opt.knock; m.knockY = Math.sin(a) * opt.knock;
    m.knockT = 0.16;
  }
  /* status effects from boons */
  if (P.burn > 0 && !opt.noStatus) { m.burnT = 3; m.burnDps = (dmg * P.burn) / 3; }
  if (P.chill > 0 && !opt.noStatus) { m.chillT = 2.2; m.chillAmt = P.chill; }

  popNum(m.x, m.y - m.def.r - 10, String(amount), crit ? "#ffcf5c" : "#ffffff", crit ? 11 : 7, crit);
  const hitAng = opt.angle == null ? Math.atan2(m.y - P.y, m.x - P.x) : opt.angle;
  for (let i = 0; i < (crit ? 12 : 6); i++) {
    const a = hitAng + (Math.random() - .5) * 1.5, s = 60 + Math.random() * 110;
    particle(m.x, m.y - 4, { vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20, life: .3 + Math.random() * .25, r: crit ? 2 : 1.5, col: crit ? "#ffcf5c" : (m.def.passive ? "#8ef07a" : "#ff7a5c"), grav: 220 });
  }
  if (crit) { hitstop(0.055); addShake(0.30); ring(m.x, m.y - 4, "#ffcf5c", 3, 20, 0.24); Sound.play("crit"); }
  else { hitstop(0.022); addShake(0.10); Sound.play("hit", Math.min(3, amount / 12)); }

  if (P.lifesteal > 0) {
    const heal = amount * P.lifesteal;
    if (P.hp < P.maxHp) {
      P.hp = Math.min(P.maxHp, P.hp + heal);
      if (heal >= 1) popNum(P.x, P.y - 20, "+" + Math.round(heal), "#8ef07a", 6);
    }
  }
  /* arc storm jumps to a neighbour */
  if (P.chain > 0 && !opt.isChain) {
    const other = nearestMonster(m.x, m.y, 58, m);
    if (other) {
      lightningFx(m.x, m.y - 4, other.x, other.y - 4);
      damageMonster(other, dmg * P.chain, { isChain: true, noStatus: true, noCrit: true });
    }
  }
  if (m.hp <= 0) killMonster(m);
  return amount;
}

function lightningFx(x0, y0, x1, y1) {
  const steps = 6;
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    particle(lerp(x0, x1, t) + (Math.random() - .5) * 7, lerp(y0, y1, t) + (Math.random() - .5) * 7,
      { col: i % 2 ? "#ffe95c" : "#ffffff", life: .18, r: 1.6, grav: 0, drag: 1 });
  }
}

function killMonster(m) {
  const P = G.P;
  m.dead = true;
  G.stats.kills++;
  G.stats.byType[m.type] = (G.stats.byType[m.type] || 0) + 1;
  P.combo++; P.comboT = 3.2;
  G.stats.bestCombo = Math.max(G.stats.bestCombo, P.combo);
  if (P.killStam) P.sp = Math.min(P.maxSp, P.sp + P.killStam);

  const xp = Math.round(m.def.xp * m.xpMul);
  const motes = clamp(Math.round(xp / 5), 1, 7);
  for (let i = 0; i < motes; i++) dropItem(m.x, m.y - 3, "xp", xp / motes);
  if (Math.random() < (m.def.elite ? 0.95 : 0.10)) dropItem(m.x, m.y - 3, "heart", m.def.elite ? 26 : 12);
  if (Math.random() < 0.12) dropItem(m.x, m.y - 3, "stam", 16);

  const col = m.def.passive ? ["#8ef07a", "#ffffff", "#57d68a"] : ["#ff7a5c", "#ffcf5c", "#ffffff"];
  burst(m.x, m.y - 4, m.def.elite ? 34 : 15, col, { speed: m.def.elite ? 140 : 95, life: .65, r: m.def.elite ? 2.4 : 1.8 });
  ring(m.x, m.y - 3, m.def.elite ? "#ffcf5c" : "#ffffff", 3, m.def.elite ? 54 : 26, m.def.elite ? .5 : .3);
  hitstop(m.def.elite ? 0.14 : 0.05);
  addShake(m.def.elite ? 0.7 : 0.22);
  Sound.play("kill");
  if (P.combo > 1) Sound.play("combo", P.combo);
  if (m.def.elite) { screenFlash("rgba(255,207,92,.35)", 0.2); toast("Elite felled — " + m.def.name); }

  if (!G.codex[m.type]) {
    G.codex[m.type] = 1;
    Store.write("codex", G.codex);
    toast("Codex entry: " + m.def.name);
  }
  if (P.combo >= 5 && P.combo % 5 === 0) toast(P.combo + " chain! XP bonus rising");
}

function damagePlayer(amount, srcX, srcY, source) {
  const P = G.P;
  if (P.iframes > 0 || !P.alive || P.dashing > 0) return;
  if (P.ward > 0) {
    P.ward--; P.wardT = 14 / Math.max(1, P.dashRate);
    P.iframes = 0.7;
    ring(P.x, P.y - 6, "#9fd8ff", 4, 30, 0.3);
    popNum(P.x, P.y - 22, "WARD", "#9fd8ff", 8);
    Sound.play("block"); addShake(0.2);
    return;
  }
  amount = Math.max(1, Math.round(amount - P.armor));
  P.hp -= amount;
  G.stats.dmgTaken += amount;
  P.iframes = 0.72; P.hurtFlash = 0.35;
  P.combo = 0; P.comboT = 0;
  const a = Math.atan2(P.y - srcY, P.x - srcX);
  P.knockX = Math.cos(a) * 120; P.knockY = Math.sin(a) * 120; P.knockT = 0.15;
  popNum(P.x, P.y - 20, "-" + amount, "#ff5566", 9);
  burst(P.x, P.y - 6, 10, ["#ff5566", "#ffffff"], { speed: 80, life: .4 });
  addShake(0.45); hitstop(0.05);
  screenFlash("rgba(255,60,80,.30)", 0.18);
  Sound.play("hurt");
  /* bramble hide */
  if (P.thorns > 0 && source && !source.dead) damageMonster(source, P.thorns, { noCrit: true, noStatus: true });
  if (P.hp <= 0) { P.hp = 0; playerDies(); }
}

function playerDies() {
  const P = G.P;
  P.alive = false;
  burst(P.x, P.y - 6, 40, ["#ff5566", "#ffffff", "#ffcf5c"], { speed: 140, life: 1.1, r: 2.2 });
  ring(P.x, P.y - 6, "#ff5566", 4, 90, 0.8);
  addShake(1); screenFlash("rgba(255,40,60,.5)", 0.5);
  Sound.play("die");
  setTimeout(() => endRun(), 900);
}

/* ------------------------------ attacking -------------------------------- */
function tryAttack() {
  const P = G.P;
  if (P.atkCd > 0 || P.atk || !P.alive) return;
  const W = WEAPONS[P.weapon], st = weaponStats(P, P.weapon);
  if (P.sp < st.stam) {
    /* A failed swing must NOT extend the regen hold — otherwise holding the
       attack button keeps resetting it and stamina can never come back. */
    if (P.tiredT <= 0) { P.tiredT = 0.8; popNum(P.x, P.y - 20, "tired", "#39d4c8", 6); }
    return;
  }
  P.sp -= st.stam; P.spHold = 0.24;

  /* Aim: a swing snaps to a foe you are already roughly pointed at. Without
     this every attack fires down the movement axis, which means running past
     a monster whiffs even though the blade passed straight through it. */
  let ang;
  const mv = Input.moveVec();
  const facing = { down: Math.PI / 2, up: -Math.PI / 2, left: Math.PI, right: 0 }[P.dir];
  const target = nearestMonster(P.x, P.y, W.kind === "cast" ? 190 : st.range + 30);
  const aimAt = target ? Math.atan2(target.y - 4 - (P.y - 4), target.x - P.x) : null;
  if (mv.m > 0.2) {
    const moveAng = Math.atan2(mv.y, mv.x);
    ang = (aimAt != null && Math.abs(angDiff(moveAng, aimAt)) < 1.05) ? aimAt : moveAng;
  } else {
    ang = aimAt != null ? aimAt : facing;
  }
  faceAngle(P, ang);

  if (P.chainT <= 0) P.chainIdx = 0;
  const spin = P.weapon === "sword" && P.tiers.sword >= 4 && P.chainIdx === 2;

  P.atk = {
    w: P.weapon, ang, t: 0, dur: st.cd * 0.92, st, hits: new Set(),
    spin, idx: P.chainIdx, fired: false
  };
  P.atkCd = st.cd;
  P.chainIdx = (P.chainIdx + 1) % 3; P.chainT = 0.7;

  if (W.kind === "cast") Sound.play("cast");
  else if (P.weapon === "spear") { Sound.play("thrust"); if (st.lunge) { P.knockX = Math.cos(ang) * 190; P.knockY = Math.sin(ang) * 190; P.knockT = 0.13; } }
  else Sound.play("swing");
}

function faceAngle(P, ang) {
  const d = ((ang % TAU) + TAU) % TAU;
  if (d > Math.PI * 0.25 && d <= Math.PI * 0.75) P.dir = "down";
  else if (d > Math.PI * 0.75 && d <= Math.PI * 1.25) P.dir = "left";
  else if (d > Math.PI * 1.25 && d <= Math.PI * 1.75) P.dir = "up";
  else P.dir = "right";
}

function updateAttack(dt) {
  const P = G.P;
  if (P.atkCd > 0) P.atkCd -= dt;
  if (P.chainT > 0) P.chainT -= dt;
  if (!P.atk) return;
  const A = P.atk, st = A.st, W = WEAPONS[A.w];
  const prev = A.t; A.t += dt;
  const prog = clamp(A.t / A.dur, 0, 1);

  if (W.kind === "cast") {
    if (!A.fired && A.t >= W.windup) {
      A.fired = true;
      const kind = BOLT_KIND_BY_TIER[clamp(P.tiers.wand - 1, 0, 4)];
      const n = st.bolts;
      for (let i = 0; i < n; i++) {
        const spread = n === 1 ? 0 : (i - (n - 1) / 2) * 0.26;
        const tgt = nearestMonster(P.x, P.y, 200);
        G.bolts.push({
          x: P.x + Math.cos(A.ang) * 8, y: P.y - 6 + Math.sin(A.ang) * 8,
          vx: Math.cos(A.ang + spread) * 190, vy: Math.sin(A.ang + spread) * 190,
          dmg: st.dmg, friendly: true, kind, life: 1.5, r: 4,
          pierce: st.pierce, hits: new Set(), homing: st.homing, target: tgt, knock: st.knock
        });
      }
      burst(P.x + Math.cos(A.ang) * 8, P.y - 6 + Math.sin(A.ang) * 8, 6, ["#d68cff", "#ffffff"], { speed: 40, life: .3, grav: 0 });
    }
  } else {
    /* melee: the blade sweeps, hitting whatever it passes through */
    const active = prog > 0.10 && prog < 0.72;
    if (active) {
      const sweep = A.spin ? TAU : st.arc;
      const start = A.ang - sweep / 2;
      const p0 = clamp((prev / A.dur - 0.10) / 0.62, 0, 1), p1 = clamp((prog - 0.10) / 0.62, 0, 1);
      const a0 = start + sweep * p0, a1 = start + sweep * p1;
      const reach = st.range + (A.w === "spear" ? Math.sin(prog * Math.PI) * 12 : 0);
      A.bladeAng = a1; A.reach = reach;
      let hits = 0;
      for (const m of G.mons) {
        if (m.dead || A.hits.has(m)) continue;
        const d = dist(P.x, P.y - 4, m.x, m.y - 4);
        if (d > reach + m.def.r) continue;
        const ma = Math.atan2(m.y - 4 - (P.y - 4), m.x - P.x);
        const tol = (A.w === "spear" ? 0.34 : 0.5);
        let inArc;
        if (A.spin) inArc = true;
        else {
          const dm = angDiff(a1, ma);
          inArc = Math.abs(dm) < tol || (Math.abs(angDiff(a0, ma)) < tol) ||
            (Math.sign(angDiff(a0, ma)) !== Math.sign(angDiff(a1, ma)) && Math.abs(angDiff(a0, a1)) < 1.2);
        }
        if (!inArc) continue;
        A.hits.add(m);
        damageMonster(m, st.dmg, { knock: st.knock, angle: ma });
        hits++;
        if (hits >= st.pierce && A.w === "spear") break;
      }
      /* blade trail */
      if (Math.random() < 0.8) {
        const ta = a1, tr = reach * (0.55 + Math.random() * 0.42);
        particle(P.x + Math.cos(ta) * tr, P.y - 4 + Math.sin(ta) * tr,
          { col: A.spin ? "#ffcf5c" : "#ffffff", life: .16, r: 1.4, grav: 0, drag: .8 });
      }
    }
  }
  if (A.t >= A.dur) P.atk = null;
}

/* ------------------------------ projectiles ------------------------------ */
function updateBolts(dt) {
  const P = G.P;
  for (let i = G.bolts.length - 1; i >= 0; i--) {
    const b = G.bolts[i];
    b.life -= dt;
    if (b.life <= 0) { boltPop(b); G.bolts.splice(i, 1); continue; }
    if (b.friendly && b.homing) {
      if (!b.target || b.target.dead) b.target = nearestMonster(b.x, b.y, 130);
      if (b.target) {
        const want = Math.atan2(b.target.y - 4 - b.y, b.target.x - b.x);
        const cur = Math.atan2(b.vy, b.vx);
        const na = cur + clamp(angDiff(cur, want), -b.homing * dt * 3, b.homing * dt * 3);
        const sp = Math.hypot(b.vx, b.vy);
        b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
      }
    }
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (World.blocked(b.x, b.y, 2)) { boltPop(b); G.bolts.splice(i, 1); continue; }

    if (b.friendly) {
      for (const m of G.mons) {
        if (m.dead || b.hits.has(m)) continue;
        if (dist2(b.x, b.y, m.x, m.y - 4) < (m.def.r + b.r) * (m.def.r + b.r)) {
          b.hits.add(m);
          damageMonster(m, b.dmg, { knock: b.knock, angle: Math.atan2(b.vy, b.vx) });
          if (b.hits.size >= b.pierce) { boltPop(b); G.bolts.splice(i, 1); break; }
        }
      }
    } else {
      if (dist2(b.x, b.y, P.x, P.y - 4) < (P.r + b.r) * (P.r + b.r)) {
        damagePlayer(b.dmg, b.x, b.y, b.owner);
        boltPop(b); G.bolts.splice(i, 1); continue;
      }
    }
    if (Math.random() < 0.55) {
      const c = b.friendly ? { arcane: "#d68cff", fire: "#ff8a3c", frost: "#6cc5ff", spark: "#ffe95c" }[b.kind] : "#ff8a3c";
      particle(b.x, b.y, { col: c, life: .22, r: 1.4, grav: 0, drag: .82 });
    }
  }
}
function boltPop(b) {
  const c = b.friendly ? { arcane: "#d68cff", fire: "#ff8a3c", frost: "#6cc5ff", spark: "#ffe95c" }[b.kind] : "#ff8a3c";
  burst(b.x, b.y, 7, [c, "#ffffff"], { speed: 60, life: .28, grav: 0, r: 1.5 });
}

/* ------------------------------ monsters --------------------------------- */
function spawnMonster(type, x, y, elite) {
  const def = MONSTERS[type];
  const P = G.P;
  const lvl = P.level;
  const scale = 1 + (lvl - 1) * 0.10;
  const eliteM = elite ? 3.2 : 1;
  const m = {
    type, def, x, y, vx: 0, vy: 0,
    hp: Math.round(def.hp * scale * eliteM), maxHp: Math.round(def.hp * scale * eliteM),
    dmg: def.dmg * (1 + (lvl - 1) * 0.09) * (elite ? 1.5 : 1),
    xpMul: (1 + (lvl - 1) * 0.10) * (elite ? 3 : 1),
    elite: !!elite || !!def.elite,
    state: def.passive ? "wander" : "idle", stateT: 0, angry: false,
    animT: Math.random() * 2, frame: 0, face: 1, flash: 0, stagger: 0,
    knockX: 0, knockY: 0, knockT: 0, atkCd: Math.random() * 0.8,
    burnT: 0, burnDps: 0, chillT: 0, chillAmt: 0,
    wanderA: Math.random() * TAU, wanderT: 0, bob: Math.random() * TAU, dead: false,
    stuckT: 0, checkT: 3, lastDp: 1e9
  };
  G.mons.push(m);
  return m;
}

function updateMonsters(dt) {
  const P = G.P;
  for (let i = G.mons.length - 1; i >= 0; i--) {
    const m = G.mons[i];
    if (m.dead) { G.mons.splice(i, 1); continue; }
    const def = m.def;
    m.animT += dt; m.bob += dt * 3;
    m.frame = Math.floor(m.animT * (def.speed > 40 ? 9 : 6)) % 4;
    if (m.flash > 0) m.flash -= dt;
    if (m.stagger > 0) m.stagger -= dt;
    if (m.atkCd > 0) m.atkCd -= dt;

    /* despawn stragglers far behind the player so the world stays lively */
    const dp = dist(m.x, m.y, P.x, P.y);
    if (dp > 900) { G.mons.splice(i, 1); continue; }
    /* ...and recycle any hostile that has been walled off and making no
       headway, so the population budget always buys real encounters */
    m.checkT -= dt;
    if (m.checkT <= 0) {
      m.checkT = 3;
      const hostileNow = !def.passive || m.angry;
      if (hostileNow && dp > 170 && dp > m.lastDp - 24) m.stuckT += 3; else m.stuckT = 0;
      m.lastDp = dp;
      if (m.stuckT >= 9) { G.mons.splice(i, 1); continue; }
    }

    if (m.burnT > 0) {
      m.burnT -= dt;
      m.hp -= m.burnDps * dt;
      if (Math.random() < dt * 14) particle(m.x + (Math.random() * 8 - 4), m.y - 4, { col: "#ff8a3c", life: .35, r: 1.4, grav: -60, drag: 1 });
      if (m.hp <= 0) { killMonster(m); continue; }
    }
    if (m.chillT > 0) {
      m.chillT -= dt;
      if (Math.random() < dt * 5) particle(m.x + (Math.random() * 8 - 4), m.y - 4, { col: "#9fd8ff", life: .4, r: 1.2, grav: -20, drag: 1 });
    }
    const slow = m.chillT > 0 ? (1 - m.chillAmt) : 1;

    if (m.knockT > 0) {
      m.knockT -= dt;
      World.moveCircle(m, m.knockX * dt, m.knockY * dt, def.r * 0.7);
      m.knockX *= Math.pow(0.03, dt); m.knockY *= Math.pow(0.03, dt);
      continue;
    }
    if (m.stagger > 0 && !def.rooted) continue;

    const hostile = !def.passive || m.angry;
    const speed = def.speed * slow;
    let mvx = 0, mvy = 0;

    if (!hostile) {
      /* wander, and skitter away if the player crowds them */
      if (def.skittish && dp < def.det) {
        const a = Math.atan2(m.y - P.y, m.x - P.x) + Math.sin(G.t * 3) * 0.4;
        mvx = Math.cos(a) * speed * 1.5; mvy = Math.sin(a) * speed * 1.5;
        m.state = "flee";
      } else {
        m.wanderT -= dt;
        if (m.wanderT <= 0) { m.wanderT = 0.9 + Math.random() * 2.2; m.wanderA = Math.random() * TAU; m.idling = Math.random() < 0.4; }
        if (!m.idling && !def.rooted) { mvx = Math.cos(m.wanderA) * speed * 0.45; mvy = Math.sin(m.wanderA) * speed * 0.45; }
        m.state = "wander";
      }
    } else {
      if (m.state === "idle") m.state = "prowl";
      m.stateT += dt;

      if (m.state === "prowl") {
        /* Out past its senses a hunter drifts toward you at half pace; inside
           `det` it locks on and commits. Keeps far-off monsters from all
           beelining at once while still feeding pressure into the fight. */
        if (def.rooted) { mvx = mvy = 0; }
        else {
          const a = Math.atan2(P.y - 4 - m.y, P.x - m.x) + Math.sin(G.t * 0.6 + m.bob) * 0.5;
          mvx = Math.cos(a) * speed * 0.55; mvy = Math.sin(a) * speed * 0.55;
        }
        if (dp < def.det) {
          m.state = "chase"; m.stateT = 0;
          popNum(m.x, m.y - def.r - 12, "!", "#ff7a5c", 8);
        }
      } else if (m.state === "chase") {
        let a = Math.atan2(P.y - 4 - m.y, P.x - m.x);
        if (def.erratic) a += Math.sin(G.t * 4 + m.bob) * 0.7;
        if (def.ranged) {
          /* hold the preferred band */
          if (dp < def.keepAt * 0.8) a += Math.PI;
          else if (dp < def.keepAt * 1.1) a += Math.PI / 2;
        }
        mvx = Math.cos(a) * speed; mvy = Math.sin(a) * speed;
        if (def.rooted) { mvx = mvy = 0; }
        const inRange = def.ranged ? (dp < def.atkR && dp > 30) : dp < def.atkR + P.r;
        if (inRange && m.atkCd <= 0) { m.state = "windup"; m.stateT = 0; m.aimA = Math.atan2(P.y - 4 - m.y, P.x - m.x); }
        else if (dp > def.det * 2.4 && !m.angry) { m.state = "prowl"; m.stateT = 0; }
      } else if (m.state === "windup") {
        const wu = def.elite ? 0.55 : def.lunger ? 0.34 : 0.28;
        if (def.lunger || def.elite) { mvx = mvy = 0; }
        else { mvx = Math.cos(m.aimA) * speed * 0.2; mvy = Math.sin(m.aimA) * speed * 0.2; }
        if (m.stateT >= wu) {
          m.state = "strike"; m.stateT = 0;
          m.aimA = Math.atan2(P.y - 4 - m.y, P.x - m.x);
          monsterStrike(m);
        }
      } else if (m.state === "strike") {
        if (def.lunger) { mvx = Math.cos(m.aimA) * speed * 2.6; mvy = Math.sin(m.aimA) * speed * 2.6; }
        if (m.stateT > (def.lunger ? 0.3 : 0.16)) { m.state = "recover"; m.stateT = 0; }
      } else if (m.state === "recover") {
        if (m.stateT > 0.3) { m.state = "chase"; m.stateT = 0; m.atkCd = def.atkCd * (0.8 + Math.random() * 0.4); }
      }
    }

    if (mvx || mvy) {
      if (def.phaser || def.flier) { m.x += mvx * dt; m.y += mvy * dt; }  /* wraiths phase, fliers fly */
      else {
        const ok = World.moveCircle(m, mvx * dt, mvy * dt, def.r * 0.7);
        if (!ok && !hostile) m.wanderT = 0;
        if (!ok && hostile) { m.wanderA = Math.random() * TAU; m.x += Math.cos(m.wanderA) * 6 * dt; }
      }
      if (Math.abs(mvx) > 1) m.face = mvx < 0 ? -1 : 1;
    }
    /* keep monsters out of the void if they phase or get shoved */
    m.x = clamp(m.x, TS, World.W * TS - TS); m.y = clamp(m.y, TS, World.H * TS - TS);

    /* contact damage for chargers while lunging */
    if (def.lunger && m.state === "strike" && dist(m.x, m.y, P.x, P.y - 4) < def.r + P.r + 2) {
      damagePlayer(m.dmg, m.x, m.y, m);
      m.state = "recover"; m.stateT = 0;
    }
  }
}

function monsterStrike(m) {
  const P = G.P, def = m.def;
  if (def.ranged) {
    const a = m.aimA;
    G.bolts.push({
      x: m.x, y: m.y - 4, vx: Math.cos(a) * 118, vy: Math.sin(a) * 118,
      dmg: m.dmg, friendly: false, kind: "fire", life: 2.4, r: 4, hits: new Set(), pierce: 1, owner: m
    });
    Sound.play("cast");
    burst(m.x, m.y - 4, 5, ["#ff8a3c"], { speed: 40, life: .3, grav: 0 });
    return;
  }
  if (def.slam) {
    ring(m.x, m.y, "#ffcf5c", 6, def.atkR + 16, 0.35);
    burst(m.x, m.y, 20, ["#a8a4c0", "#ffcf5c"], { speed: 130, life: .55, r: 2 });
    addShake(0.5); Sound.play("kill");
    if (dist(m.x, m.y, P.x, P.y - 4) < def.atkR + P.r + 8) damagePlayer(m.dmg, m.x, m.y, m);
    return;
  }
  if (def.lunger) return;   /* damage lands during the lunge itself */
  if (dist(m.x, m.y, P.x, P.y - 4) < def.atkR + P.r + 4) damagePlayer(m.dmg, m.x, m.y, m);
  else Sound.play("swing");
  burst(m.x + Math.cos(m.aimA) * 8, m.y - 4 + Math.sin(m.aimA) * 8, 4, ["#ffffff"], { speed: 50, life: .2, grav: 0 });
}

/* ------------------------------ spawning --------------------------------- */
function difficultyTier() { return clamp(1 + Math.floor(G.P.level / 5), 1, 3); }
function monsterCap() { return clamp(16 + Math.floor(G.P.level * 1.6), 16, 46); }

/* A spawn is only useful if the monster can actually walk to the player.
   Without this check, whole packs spawn across a lake, jam against the shore
   and eat the population budget while the world looks empty. */
function pathClear(x0, y0, x1, y1) {
  const steps = 12;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
    if (!World.walkableTile(Math.floor(x / TS), Math.floor(y / TS))) return false;
  }
  return true;
}
function findSpawnPoint(minR, maxR) {
  const P = G.P;
  let fallback = null;
  for (let i = 0; i < 30; i++) {
    const a = Math.random() * TAU, r = minR + Math.random() * (maxR - minR);
    const x = P.x + Math.cos(a) * r, y = P.y + Math.sin(a) * r;
    const tx = Math.floor(x / TS), ty = Math.floor(y / TS);
    if (!World.walkableTile(tx, ty)) continue;
    const pt = { x, y, t: World.tileAt(tx, ty) };
    if (pathClear(P.x, P.y, x, y)) return pt;
    if (!fallback) fallback = pt;
  }
  return fallback;
}

function updateSpawner(dt) {
  G.spawnT -= dt;
  if (G.spawnT > 0) return;
  G.spawnT = 0.42;
  if (G.mons.length >= monsterCap()) return;

  /* spawn just past the edge of view so monsters walk in, never pop in */
  const minR = Math.max(Display.W, Display.H) * 0.55 + 20;
  const pt = findSpawnPoint(minR, minR + 150);
  if (!pt) return;
  const table = spawnTableFor(pt.t, difficultyTier());
  if (!table.length) return;
  const rng = makeRng((Math.random() * 1e9) | 0);
  const pick = rng.weighted(table);
  const elite = MONSTERS[pick.k].elite ? true : (G.P.level >= 6 && Math.random() < 0.035);
  const m = spawnMonster(pick.k, pt.x, pt.y, elite);
  /* a small pack for social hunters */
  if (!m.def.elite && !elite && m.def.tier >= 2 && Math.random() < 0.3) {
    const n = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n && G.mons.length < monsterCap(); i++) {
      const p2 = findSpawnPoint(minR, minR + 90);
      if (p2 && MONSTERS[pick.k].biomes.indexOf(p2.t) >= 0) spawnMonster(pick.k, p2.x, p2.y, false);
    }
  }
}

function updateSurge(dt) {
  G.surgeT -= dt;
  if (G.surgeT > 0) return;
  G.surgeT = 95 + Math.random() * 45;
  if (G.P.level < 3) return;
  const n = 4 + Math.floor(G.P.level / 4);
  let spawned = 0;
  for (let i = 0; i < n * 3 && spawned < n; i++) {
    const pt = findSpawnPoint(90, 190);
    if (!pt) continue;
    const table = spawnTableFor(pt.t, difficultyTier());
    if (!table.length) continue;
    const rng = makeRng((Math.random() * 1e9) | 0);
    const m = spawnMonster(rng.weighted(table).k, pt.x, pt.y, Math.random() < 0.14);
    ring(m.x, m.y, "#d68cff", 2, 22, 0.4);
    burst(m.x, m.y, 8, ["#d68cff", "#ffffff"], { speed: 60, life: .5 });
    spawned++;
  }
  if (spawned) { toast("A surge of monsters stirs!"); Sound.play("spawn"); screenFlash("rgba(180,110,255,.22)", 0.3); }
}

/* ------------------------------ landmarks -------------------------------- */
function updateLandmarks(dt) {
  const P = G.P;
  for (const L of World.landmarks) {
    L.t += dt;
    if (dist2(L.x, L.y, P.x, P.y) > 20 * 20) continue;
    if (L.kind === "shrine" && !L.used && P.hp < P.maxHp) {
      L.used = true; G.stats.shrines++;
      const heal = Math.round(P.maxHp * 0.5);
      P.hp = Math.min(P.maxHp, P.hp + heal);
      P.sp = P.maxSp; P.healPulse = 0.6;
      popNum(P.x, P.y - 22, "+" + heal, "#8ef07a", 10);
      ring(P.x, P.y - 6, "#8ef07a", 4, 42, 0.5);
      burst(P.x, P.y - 6, 20, ["#8ef07a", "#ffffff"], { speed: 70, life: .8, grav: -40 });
      Sound.play("heal"); toast("The shrine restores you.");
    } else if (L.kind === "obelisk" && !L.used) {
      L.used = true; G.stats.obelisks++;
      const opts = WEAPON_ORDER.filter(w => P.tiers[w] < 5);
      const key = opts.length ? opts[(Math.random() * opts.length) | 0] : P.weapon;
      upgradeWeapon(P, key);
      ring(P.x, P.y - 6, "#ffcf5c", 4, 52, 0.6);
      burst(P.x, P.y - 6, 26, ["#ffcf5c", "#ffffff"], { speed: 90, life: .9, grav: -30 });
      screenFlash("rgba(255,207,92,.30)", 0.25);
      Sound.play("upgrade");
      toast(WEAPONS[key].name + " tempered to Tier " + roman(P.tiers[key]) + "!");
      hitstop(0.08);
    } else if (L.kind === "chest" && !L.used) {
      L.used = true; G.stats.chests++;
      const n = 3 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) dropItem(L.x, L.y - 4, "coin", 12 + Math.random() * 14);
      dropItem(L.x, L.y - 4, "heart", 18);
      if (Math.random() < 0.5) dropItem(L.x, L.y - 4, "stam", 20);
      burst(L.x, L.y - 6, 16, ["#ffcf5c", "#ffffff"], { speed: 80, life: .7, grav: 60 });
      Sound.play("coin"); toast("A cache of treasure!");
    }
  }
}

/* ------------------------------ player step ------------------------------ */
function updatePlayer(dt) {
  const P = G.P;
  if (!P.alive) return;
  if (P.iframes > 0) P.iframes -= dt;
  if (P.hurtFlash > 0) P.hurtFlash -= dt;
  if (P.healPulse > 0) P.healPulse -= dt;
  if (P.levelPulse > 0) P.levelPulse -= dt;
  if (P.spHold > 0) P.spHold -= dt;
  if (P.tiredT > 0) P.tiredT -= dt;
  if (P.comboT > 0) { P.comboT -= dt; if (P.comboT <= 0) P.combo = 0; }
  if (P.wardMax > 0 && P.ward < P.wardMax) {
    P.wardT -= dt;
    if (P.wardT <= 0) { P.ward++; P.wardT = 14 / Math.max(1, P.dashRate); ring(P.x, P.y - 6, "#9fd8ff", 3, 22, 0.3); }
  }
  /* Stamina always recovers; it just trickles while you are mid-swing and
     comes back properly the moment you let the pressure off. */
  P.sp = Math.min(P.maxSp, P.sp + P.spRegen * (P.spHold > 0 ? 0.35 : 1) * dt);
  if (P.dash < P.dashMax) { P.dashT -= dt * P.dashRate; if (P.dashT <= 0) { P.dash++; P.dashT = 1.5; } }

  const mv = Input.moveVec();
  let speed = BASE_SPEED * P.moveSpeed;
  if (P.atk) speed *= WEAPONS[P.atk.w].moveMul;

  /* dash */
  if (P.dashing > 0) {
    P.dashing -= dt;
    const ds = 250;
    World.moveCircle(P, P.dashDir.x * ds * dt, P.dashDir.y * ds * dt, P.r);
    if (Math.random() < 0.9) particle(P.x, P.y - 4, { col: "#b6a6ff", life: .28, r: 2, grav: 0, drag: .85 });
    P.iframes = Math.max(P.iframes, 0.05);
  } else if (P.knockT > 0) {
    P.knockT -= dt;
    World.moveCircle(P, P.knockX * dt, P.knockY * dt, P.r);
    P.knockX *= Math.pow(0.02, dt); P.knockY *= Math.pow(0.02, dt);
  } else if (mv.m > 0.02) {
    World.moveCircle(P, mv.x * speed * dt, mv.y * speed * dt, P.r);
    G.stats.dist += speed * dt;
    if (!P.atk) faceAngle(P, Math.atan2(mv.y, mv.x));
    P.moving = true;
    P.animT += dt * (2.2 + mv.m * 5.2);
    /* footfall puffs */
    if (Math.random() < dt * 7) particle(P.x + (Math.random() * 6 - 3), P.y + 1, { col: "rgba(255,255,255,.5)", life: .3, r: 1.2, grav: -10, drag: .9 });
  } else { P.moving = false; P.animT += dt * 1.6; }
  P.frame = P.moving ? (Math.floor(P.animT) % 4) : 0;

  if (Input.dashHit() && P.dash > 0 && P.dashing <= 0 && P.sp >= 8) {
    const d = mv.m > 0.1 ? mv : { x: { down: 0, up: 0, left: -1, right: 1 }[P.dir], y: { down: 1, up: -1, left: 0, right: 0 }[P.dir] };
    const mag = Math.hypot(d.x, d.y) || 1;
    P.dashDir = { x: d.x / mag, y: d.y / mag };
    P.dashing = 0.18; P.dash--; P.dashT = 1.5; P.sp -= 8;
    Sound.play("dash"); addShake(0.08);
    for (let i = 0; i < 8; i++) particle(P.x, P.y - 4, { vx: -P.dashDir.x * 60 + (Math.random() * 40 - 20), vy: -P.dashDir.y * 60 + (Math.random() * 40 - 20), col: "#b6a6ff", life: .35, r: 1.6, grav: 0 });
  }
  if (Input.attackHeld()) tryAttack();
  if (Input.swapHit()) cycleWeapon(1);
  if (Input.hit("1")) setWeapon("sword");
  if (Input.hit("2")) setWeapon("spear");
  if (Input.hit("3")) setWeapon("wand");

  updateAttack(dt);

  /* cactus and lava sting on contact */
  const bt = World.biomeAt(P.x, P.y);
  if (bt === T.LAVA && P.iframes <= 0) damagePlayer(8, P.x, P.y + 10, null);
}
function setWeapon(k) {
  const P = G.P;
  if (P.weapon === k) return;
  P.weapon = k; P.chainIdx = 0;
  Sound.play("select");
  syncWeaponPod();
  particle(P.x, P.y - 8, { col: "#ffcf5c", life: .3, r: 2 });
}
function cycleWeapon(d) {
  const i = WEAPON_ORDER.indexOf(G.P.weapon);
  setWeapon(WEAPON_ORDER[(i + d + WEAPON_ORDER.length) % WEAPON_ORDER.length]);
}
function roman(n) { return ["I", "II", "III", "IV", "V"][clamp(n - 1, 0, 4)]; }
