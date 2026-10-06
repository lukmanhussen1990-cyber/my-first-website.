// In-engine test for the PAS horde entity JSON on Bedrock Dedicated Server
// 1.21.0.26 (preview). Run through tools/entities/engine_test/run_engine_test.py,
// which installs this pack together with addon/behavior_pack/entities and
// loot_tables into a scratch world. Not part of the add-on.
import { world, system, BlockPermutation } from "@minecraft/server";

const Y = 100; // platform level; entities stand at Y+1
const results = [];
const log = (name, ok, detail = "") => {
  results.push(ok);
  console.warn(`PASTEST|${name}|${ok ? "PASS" : "FAIL"}|${detail}`);
};
const info = (msg) => console.warn(`PASINFO|${msg}`);
const wait = (t) => new Promise((r) => system.runTimeout(r, t));
let dim;
const cmd = (c) => {
  try {
    return dim.runCommand(c);
  } catch (e) {
    info(`command failed: ${c} -> ${e}`);
  }
};
const spawn = (id, x, z, y = Y + 1) => dim.spawnEntity(id, { x: x + 0.5, y, z: z + 0.5 });
const hp = (e) => (e.isValid() ? e.getComponent("minecraft:health").currentValue : -1);
const val = (e, c) => {
  const comp = e.getComponent(c);
  return comp ? comp.value : undefined;
};
const hunting = (e) => e.hasComponent("minecraft:behavior.nearest_attackable_target");

// highest horizontal ray (from 3 blocks west) that hits the entity = hitbox height
function boxHeight(e) {
  const l = e.location;
  let top = 0;
  for (let h = 0.02; h < 3; h += 0.02) {
    const hits = dim.getEntitiesFromRay({ x: l.x - 3, y: l.y + h, z: l.z }, { x: 1, y: 0, z: 0 }, { maxDistance: 6 });
    if (hits.some((x) => x.entity.id === e.id)) top = h;
  }
  return Math.round(top * 100) / 100;
}
function boxWidth(e) {
  const l = e.location;
  let lo = null, hi = null;
  for (let dz = -1.5; dz <= 1.5; dz += 0.02) {
    const hits = dim.getEntitiesFromRay({ x: l.x - 3, y: l.y + 0.1, z: l.z + dz }, { x: 1, y: 0, z: 0 }, { maxDistance: 6 });
    if (hits.some((x) => x.entity.id === e.id)) { if (lo === null) lo = dz; hi = dz; }
  }
  return lo === null ? 0 : Math.round((hi - lo) * 100) / 100;
}

function fill(x1, y1, z1, x2, y2, z2, block) {
  cmd(`fill ${x1} ${y1} ${z1} ${x2} ${y2} ${z2} ${block}`);
}

function door(x, y, z, open) {
  const lower = BlockPermutation.resolve("minecraft:wooden_door", {
    direction: 3, upper_block_bit: false, open_bit: open, door_hinge_bit: false,
  });
  const upper = BlockPermutation.resolve("minecraft:wooden_door", {
    direction: 3, upper_block_bit: true, open_bit: open, door_hinge_bit: false,
  });
  dim.getBlock({ x, y, z }).setPermutation(lower);
  dim.getBlock({ x, y: y + 1, z }).setPermutation(upper);
}

// closed stone room, inner area x0+1..x0+5, z0+1..z0+5, door in the south wall (z0+6) at x0+3
function room(x0, z0, open) {
  fill(x0, Y + 1, z0, x0 + 6, Y + 3, z0 + 6, "stone");
  fill(x0 + 1, Y + 1, z0 + 1, x0 + 5, Y + 3, z0 + 5, "air");
  fill(x0, Y + 4, z0, x0 + 6, Y + 4, z0 + 6, "stone");
  door(x0 + 3, Y + 1, z0 + 6, open);
}

// pit: 3x3 floor at Y+1 surrounded by 5-high walls
function pit(x0, z0) {
  fill(x0, Y + 1, z0, x0 + 4, Y + 5, z0 + 4, "stone");
  fill(x0 + 1, Y + 1, z0 + 1, x0 + 3, Y + 5, z0 + 3, "air");
}

const ALL = [
  ["pas:parasite", ["pas_horde", "pas_parasite", "monster", "mob", "arthropod"], 12],
  ["pas:infected_villager", ["pas_horde", "pas_infected", "pas_infected_villager", "monster", "mob"], 24],
  ["pas:infected_cow", ["pas_horde", "pas_infected", "pas_infected_cow", "monster", "mob"], 14],
  ["pas:infected_pig", ["pas_horde", "pas_infected", "pas_infected_pig", "monster", "mob"], 14],
  ["pas:infected_sheep", ["pas_horde", "pas_infected", "pas_infected_sheep", "monster", "mob"], 12],
  ["pas:infected_chicken", ["pas_horde", "pas_infected", "pas_infected_chicken", "monster", "mob"], 6],
  ["pas:infected_human", ["pas_horde", "pas_infected", "pas_infected_human", "monster", "mob"], 26],
];

async function run() {
  dim = world.getDimension("overworld");
  cmd("tickingarea add 0 0 0 159 0 159 pastest true");
  cmd("gamerule domobspawning false");
  cmd("gamerule dodaylightcycle false");
  cmd("gamerule doweathercycle false");
  cmd("time set noon");
  cmd("weather clear");
  cmd("difficulty normal");
  for (let i = 0; i < 60; i++) {
    await wait(20);
    try {
      if (dim.getBlock({ x: 150, y: Y, z: 150 }) && dim.getBlock({ x: 0, y: Y, z: 0 })) break;
    } catch (e) { /* not loaded yet */ }
  }
  info("chunks loaded at tick " + system.currentTick);
  fill(0, Y, 0, 159, Y, 159, "stone");
  for (let z = 0; z < 160; z += 20) fill(0, Y + 1, z, 159, Y + 8, z + 19, "air");

  // ---------------- T1 static checks (arena 10,10) ----------------
  const ents = {};
  ALL.forEach(([id], i) => { ents[id] = spawn(id, 2 + i * 3, 10); });
  await wait(5);
  for (const [id, fams, maxHp] of ALL) {
    const e = ents[id];
    const tf = e.getComponent("minecraft:type_family");
    const got = tf ? tf.getTypeFamilies().slice().sort() : [];
    log(`${id} families`, JSON.stringify(got) === JSON.stringify(fams.slice().sort()), JSON.stringify(got));
    const h = e.getComponent("minecraft:health");
    log(`${id} health`, h.currentValue === maxHp && h.effectiveMax === maxHp, `${h.currentValue}/${h.effectiveMax}`);
    if (id === "pas:parasite") info(`script hasComponent(nat)=${hunting(e)} getComponent(movement)=${String(e.getComponent("minecraft:movement"))}`);
    log(`${id} adult by default`, !e.hasComponent("minecraft:is_baby"));
  }
  const v = ents["pas:infected_villager"];
  log("villager defaults 0/0/0", val(v, "minecraft:variant") === 0 && val(v, "minecraft:mark_variant") === 0 && val(v, "minecraft:skin_id") === 0,
    `${val(v, "minecraft:variant")}/${val(v, "minecraft:mark_variant")}/${val(v, "minecraft:skin_id")}`);
  v.triggerEvent("pas:set_variant_5"); v.triggerEvent("pas:set_mark_3"); v.triggerEvent("pas:set_skin_2");
  await wait(3);
  log("villager set 5/3/2", val(v, "minecraft:variant") === 5 && val(v, "minecraft:mark_variant") === 3 && val(v, "minecraft:skin_id") === 2,
    `${val(v, "minecraft:variant")}/${val(v, "minecraft:mark_variant")}/${val(v, "minecraft:skin_id")}`);
  v.triggerEvent("pas:set_variant_14"); v.triggerEvent("pas:set_mark_6"); v.triggerEvent("pas:set_skin_5");
  await wait(3);
  log("villager reset 14/6/5", val(v, "minecraft:variant") === 14 && val(v, "minecraft:mark_variant") === 6 && val(v, "minecraft:skin_id") === 5,
    `${val(v, "minecraft:variant")}/${val(v, "minecraft:mark_variant")}/${val(v, "minecraft:skin_id")}`);
  v.triggerEvent("pas:set_variant_0"); v.triggerEvent("pas:set_mark_0"); v.triggerEvent("pas:set_skin_0");
  await wait(3);
  log("villager back to 0/0/0", val(v, "minecraft:variant") === 0 && val(v, "minecraft:mark_variant") === 0 && val(v, "minecraft:skin_id") === 0,
    `${val(v, "minecraft:variant")}/${val(v, "minecraft:mark_variant")}/${val(v, "minecraft:skin_id")}`);
  v.triggerEvent("pas:set_variant_9");
  await wait(3);
  log("villager variant 9 then same again", val(v, "minecraft:variant") === 9);
  v.triggerEvent("pas:set_variant_9");
  await wait(3);
  log("villager variant 9 repeat", val(v, "minecraft:variant") === 9, `${val(v, "minecraft:variant")}`);

  const cow = ents["pas:infected_cow"];
  cow.triggerEvent("pas:set_variant_2");
  await wait(3);
  log("cow variant 2", val(cow, "minecraft:variant") === 2, `${val(cow, "minecraft:variant")}`);
  cow.triggerEvent("pas:set_variant_1");
  await wait(3);
  log("cow variant 1", val(cow, "minecraft:variant") === 1, `${val(cow, "minecraft:variant")}`);

  const sh = ents["pas:infected_sheep"];
  log("sheep default color 0, unsheared", val(sh, "minecraft:color") === 0 && !sh.hasComponent("minecraft:is_sheared"));
  sh.triggerEvent("pas:set_color_14");
  await wait(3);
  log("sheep color 14", val(sh, "minecraft:color") === 14, `${val(sh, "minecraft:color")}`);
  sh.triggerEvent("pas:set_color_3");
  sh.triggerEvent("pas:set_sheared");
  await wait(3);
  log("sheep color 3 + sheared", val(sh, "minecraft:color") === 3 && sh.hasComponent("minecraft:is_sheared"), `${val(sh, "minecraft:color")}`);

  for (const id of ["pas:infected_villager", "pas:infected_cow", "pas:infected_pig", "pas:infected_sheep", "pas:infected_chicken"]) {
    const e = spawn(id, 30, 30);
    e.triggerEvent("pas:make_baby");
    await wait(3);
    log(`${id} make_baby`, e.hasComponent("minecraft:is_baby") && val(e, "minecraft:scale") === 0.5,
      `is_baby=${e.hasComponent("minecraft:is_baby")} scale=${val(e, "minecraft:scale")}`);
    e.remove();
  }

  const par = ents["pas:parasite"];
  log("parasite base scale 1", val(par, "minecraft:scale") === 1, `${val(par, "minecraft:scale")}`);
  par.triggerEvent("pas:born");
  await wait(3);
  const s1 = val(par, "minecraft:scale");
  await wait(25);
  const s2 = val(par, "minecraft:scale");
  await wait(30);
  const s3 = val(par, "minecraft:scale");
  log("parasite born flourish 0.5 -> 0.75 -> full size", s1 === 0.5 && s2 === 0.75 && boxHeight(par) > 0.55, `${s1} ${s2} ${s3} h=${boxHeight(par)}`);

  info(`parasite after flourish: height=${boxHeight(par)} width=${boxWidth(par)} scaleComp=${val(par, "minecraft:scale")}`);
  // hitbox measurements (scale vs collision box)
  // expected collision box (w, h); ray sampling is 0.02 steps so allow 0.05
  const near = (a, b) => Math.abs(a - b) <= 0.05;
  for (const [id, baby, ew, eh] of [["pas:infected_pig", false, 0.9, 0.9], ["pas:infected_pig", true, 0.45, 0.45], ["minecraft:pig", false, 0.9, 0.9],
    ["pas:infected_cow", true, 0.45, 0.65], ["pas:infected_cow", false, 0.9, 1.3], ["pas:infected_villager", true, 0.3, 0.95],
    ["pas:infected_chicken", false, 0.6, 0.8], ["pas:infected_human", false, 0.6, 1.9], ["pas:parasite", false, 0.8, 0.6]]) {
    const e = spawn(id, 30, 40);
    if (id.startsWith("pas:")) e.triggerEvent("pas:become_dormant");
    if (baby) e.triggerEvent("pas:make_baby");
    if (id === "minecraft:pig" && baby) e.triggerEvent("minecraft:entity_born");
    await wait(4);
    const bh = boxHeight(e), bw = boxWidth(e);
    log(`HITBOX ${id}${baby ? " baby" : ""} = ${ew} x ${eh}`, near(bw, ew) && near(bh, eh), `measured width=${bw} height=${bh} scale=${val(e, "minecraft:scale")}`);
    e.remove();
  }
  const nb = spawn("pas:parasite", 30, 44);
  nb.triggerEvent("pas:become_dormant");
  nb.triggerEvent("pas:born");
  await wait(4);
  log("HITBOX newborn parasite = 0.4 x 0.3", near(boxWidth(nb), 0.4) && near(boxHeight(nb), 0.3), `width=${boxWidth(nb)} height=${boxHeight(nb)}`);
  await wait(60);
  log("HITBOX parasite after flourish = 0.8 x 0.6", near(boxWidth(nb), 0.8) && near(boxHeight(nb), 0.6), `width=${boxWidth(nb)} height=${boxHeight(nb)} scaleComponent=${val(nb, "minecraft:scale")}`);
  nb.remove();

  // friendly fire
  const p2 = ents["pas:infected_human"];
  const before = hp(par);
  let dealt;
  try { dealt = par.applyDamage(4, { cause: "entityAttack", damagingEntity: p2 }); } catch (e) { dealt = String(e); }
  await wait(2);
  log("horde->horde damage cancelled", hp(par) === before, `before=${before} after=${hp(par)} applyDamage=${dealt}`);
  const vcow = spawn("minecraft:cow", 20, 20);
  await wait(3);
  const cb = hp(vcow);
  vcow.applyDamage(4, { cause: "entityAttack", damagingEntity: par });
  await wait(2);
  log("control: horde->vanilla cow damage applies", hp(vcow) < cb, `before=${cb} after=${hp(vcow)}`);
  vcow.remove();
  par.applyDamage(2);
  await wait(2);
  log("sourceless damage applies to horde", hp(par) === before - 2, `${hp(par)}`);

  // fall damage
  const fallers = [["pas:parasite", true], ["pas:infected_chicken", true], ["pas:infected_pig", false]].map(([id, immune], i) => {
    const e = spawn(id, 40 + i * 4, 40, Y + 21);
    e.triggerEvent("pas:become_dormant");
    return [id, immune, e];
  });
  await wait(80);
  for (const [id, immune, e] of fallers) {
    const full = ALL.find((a) => a[0] === id)[2];
    const h = hp(e);
    log(`${id} fall from 20 blocks ${immune ? "no damage" : "takes damage"}`, immune ? h === full : h < full, `hp=${h}/${full}`);
    if (e.isValid()) e.remove();
  }
  for (const id of Object.keys(ents)) ents[id].triggerEvent("pas:become_dormant");

  // ---------------- behavioural batches (9 slots, 65 apart; cleaned between batches) ----------------
  const SLOTS = [[15, 15], [80, 15], [145, 15], [15, 80], [80, 80], [145, 80], [15, 145], [80, 145], [145, 145]];
  const clean = async () => {
    for (const e of dim.getEntities({ excludeTypes: ["minecraft:player"] })) { try { e.remove(); } catch (x) { /* */ } }
    for (let z = 0; z < 160; z += 20) fill(0, Y + 1, z, 159, Y + 8, z + 19, "air");
    await wait(5);
  };
  const disp = (e, a) => (e.isValid() ? Math.hypot(e.location.x - a.x, e.location.z - a.z) : -1);
  const inRoom = (e, x0, z0) => e.isValid() && e.location.x > x0 + 1 && e.location.x < x0 + 6 && e.location.z > z0 + 1 && e.location.z < z0 + 6;
  await clean();

  // ===== batch 1 =====
  {
    const [a, b, c, d, e5, f, g, h, i9] = SLOTS;
    const t2p = spawn("pas:parasite", a[0], a[1]); const t2c = spawn("minecraft:cow", a[0] + 6, a[1]);
    const t3p = spawn("pas:parasite", b[0], b[1]); const t3c = spawn("minecraft:cow", b[0] + 6, b[1]); t3c.addTag("pas_incubating");
    const t3d = spawn("minecraft:cow", b[0] - 6, b[1]); t3d.addTag("pas_infected_player");
    const t5a = spawn("pas:parasite", c[0], c[1]); const t5b = spawn("pas:infected_cow", c[0] + 2, c[1]); const t5c = spawn("pas:infected_human", c[0] - 2, c[1]);
    room(d[0] - 3, d[1] - 3, false);
    const t6c = spawn("minecraft:cow", d[0], d[1]); const t6h = spawn("pas:infected_human", d[0], d[1] + 8); const t6v = spawn("pas:infected_villager", d[0] + 1, d[1] + 8);
    room(e5[0] - 3, e5[1] - 3, true);
    const t6oc = spawn("minecraft:cow", e5[0], e5[1]); const t6oh = spawn("pas:infected_human", e5[0], e5[1] + 8);
    pit(f[0] - 2, f[1] - 2);
    const t7p = spawn("pas:parasite", f[0], f[1]); const t7c = spawn("minecraft:cow", f[0], f[1] + 9);
    pit(g[0] - 2, g[1] - 2);
    const t7g = spawn("pas:infected_pig", g[0], g[1]); const t7gc = spawn("minecraft:cow", g[0], g[1] + 9);
    const t8h = spawn("pas:infected_human", h[0], h[1]);
    const t8z = spawn("minecraft:zombie", i9[0], i9[1]);
    await wait(3);
    t8h.triggerEvent("pas:become_dormant");
    const t7y0 = t7p.location.y, t7gy0 = t7g.location.y;
    let t7maxY = t7y0, t7gmaxY = t7gy0, burnSeen = false, humanBurn = false;
    for (let k = 0; k < 30; k++) {
      await wait(20);
      if (t7p.isValid()) t7maxY = Math.max(t7maxY, t7p.location.y);
      if (t7g.isValid()) t7gmaxY = Math.max(t7gmaxY, t7g.location.y);
      if (t8z.isValid() && t8z.getComponent("minecraft:onfire")) burnSeen = true;
      if (t8h.isValid() && t8h.getComponent("minecraft:onfire")) humanBurn = true;
    }
    log("T2 parasite attacks vanilla cow", hp(t2c) < 10, `cow hp=${hp(t2c)}`);
    log("T3 parasite ignores cows tagged pas_incubating / pas_infected_player", hp(t3c) === 10 && hp(t3d) === 10, `hp=${hp(t3c)} ${hp(t3d)}`);
    log("T5 horde does not fight horde", hp(t5a) === 12 && hp(t5b) === 14 && hp(t5c) === 26, `${hp(t5a)} ${hp(t5b)} ${hp(t5c)}`);
    log("T6 closed door keeps infected human+villager out", hp(t6c) === 10 && !inRoom(t6h, d[0] - 3, d[1] - 3) && !inRoom(t6v, d[0] - 3, d[1] - 3),
      `cow hp=${hp(t6c)} human ${t6h.location.x.toFixed(1)},${t6h.location.z.toFixed(1)} villager ${t6v.location.x.toFixed(1)},${t6v.location.z.toFixed(1)}`);
    log("T6b control: open door lets infected human in", hp(t6oc) < 10, `cow hp=${hp(t6oc)}`);
    log("T7 parasite climbs pit walls", t7maxY > t7y0 + 2.5, `maxY=${t7maxY.toFixed(2)} start=${t7y0.toFixed(2)} cow hp=${hp(t7c)}`);
    log("T7b control: infected pig stays in pit", t7gmaxY < t7gy0 + 1.5 && hp(t7gc) === 10, `maxY=${t7gmaxY.toFixed(2)} cow hp=${hp(t7gc)}`);
    log("T8 infected human does not burn in sun", !humanBurn && hp(t8h) === 26, `hp=${hp(t8h)} burned=${humanBurn}`);
    log("T8b control: vanilla zombie burns", burnSeen || hp(t8z) < 20, `burned=${burnSeen} hp=${hp(t8z)}`);
    await clean();
  }

  // ===== batch 2: dormancy =====
  {
    const ids = ["pas:parasite", "pas:infected_villager", "pas:infected_cow", "pas:infected_chicken", "pas:infected_human", "pas:infected_sheep"];
    const V = ids.map((id, k) => [id, spawn(id, SLOTS[k][0], SLOTS[k][1]), spawn("minecraft:cow", SLOTS[k][0] + 12, SLOTS[k][1])]);
    const lone = spawn("pas:parasite", SLOTS[6][0], SLOTS[6][1]);
    const evs = dim.spawnEntity("pas:parasite<pas:become_dormant>", { x: SLOTS[7][0] + 0.5, y: Y + 1, z: SLOTS[7][1] + 0.5 });
    const evc = spawn("minecraft:cow", SLOTS[7][0] + 8, SLOTS[7][1]);
    await wait(30); // they start chasing
    for (const [, p] of V) p.triggerEvent("pas:become_dormant");
    lone.triggerEvent("pas:become_dormant");
    await wait(10);
    const st = V.map(([, p]) => p.location), lst = lone.location, est = evs.location;
    const tr = [];
    for (let k = 0; k < 15; k++) { await wait(20); tr.push(disp(V[0][1], st[0]).toFixed(2)); }
    V.forEach(([id, p, c], k) => info(`DORMANT ${id}: moved=${disp(p, st[k]).toFixed(2)} cow hp=${hp(c)}`));
    info(`DORMANT trace pas:parasite: ${tr.join(" ")}`);
    log("D1 dormant parasite without a target stays put", disp(lone, lst) < 0.3, `moved=${disp(lone, lst).toFixed(2)}`);
    log("D2 dormant entities never attack", V.every(([, , c]) => hp(c) === 10), V.map(([, , c]) => hp(c)).join(","));
    log("D3 dormant: walkers stop dead, parasite creep < 8 blocks",
      V.every(([id, p], k) => disp(p, st[k]) < (id === "pas:parasite" ? 8 : 0.5)), V.map(([, p], k) => disp(p, st[k]).toFixed(2)).join(","));
    log("D4 spawn with <pas:become_dormant>: frozen, no attack", disp(evs, est) < 0.3 && hp(evc) === 10, `moved=${disp(evs, est).toFixed(2)} cow=${hp(evc)}`);
    for (const [, p] of V) { p.triggerEvent("pas:become_active"); p.triggerEvent("pas:become_active"); }
    evs.triggerEvent("pas:become_active");
    await wait(400);
    V.forEach(([id, , c]) => log(`D5 ${id} hunts again after become_active x2`, hp(c) < 10, `cow hp=${hp(c)}`));
    log("D6 <pas:become_dormant>-spawned parasite hunts after become_active", hp(evc) < 10, `cow hp=${hp(evc)}`);
    await clean();
  }

  // ===== batch 3: other species attack, spawn-event without entity_spawned =====
  {
    const s0 = SLOTS[0], s1 = SLOTS[1], s2 = SLOTS[2], s3 = SLOTS[3], s4 = SLOTS[4];
    const ch = spawn("pas:infected_chicken", s0[0], s0[1]); const chp = spawn("minecraft:pig", s0[0] + 6, s0[1]);
    const shp = spawn("pas:infected_sheep", s1[0], s1[1]); const shc = spawn("minecraft:chicken", s1[0] + 6, s1[1]);
    const vil = spawn("pas:infected_villager", s2[0], s2[1]); const vs = spawn("minecraft:sheep", s2[0] + 6, s2[1]);
    const ic = spawn("pas:infected_cow", s3[0], s3[1]); const iv = spawn("minecraft:villager_v2", s3[0] + 6, s3[1]);
    const nv = dim.spawnEntity("pas:infected_pig<pas:make_baby>", { x: s4[0] + 0.5, y: Y + 1, z: s4[1] + 0.5 }); const nvc = spawn("minecraft:cow", s4[0] + 6, s4[1]);
    await wait(400);
    log("T9 infected chicken attacks pig", hp(chp) < 10, `pig hp=${hp(chp)}`);
    log("T9 infected sheep attacks chicken", hp(shc) < 4, `chicken hp=${hp(shc)}`);
    log("T9 infected villager attacks sheep", hp(vs) < 8, `sheep hp=${hp(vs)}`);
    log("T9 infected cow attacks villager", hp(iv) < 20, `villager hp=${hp(iv)}`);
    log("T13 spawn with <pas:make_baby> replaces entity_spawned (baby, no pas:hunting)", hp(nvc) === 10 && nv.isValid() && nv.hasComponent("minecraft:is_baby"),
      `cow hp=${hp(nvc)} baby=${nv.isValid() && nv.hasComponent("minecraft:is_baby")}`);
    await clean();
  }
  // ===== batch 4: loot =====
  {
    const expect = {
      "pas:parasite": ["minecraft:string"],
      "pas:infected_villager": ["minecraft:rotten_flesh"],
      "pas:infected_cow": ["minecraft:rotten_flesh", "minecraft:leather"],
      "pas:infected_pig": ["minecraft:rotten_flesh", "minecraft:bone"],
      "pas:infected_sheep": ["minecraft:rotten_flesh", "minecraft:white_wool", "minecraft:red_wool", "minecraft:wool"],
      "pas:infected_chicken": ["minecraft:feather", "minecraft:rotten_flesh"],
      "pas:infected_human": ["minecraft:rotten_flesh", "minecraft:bone"],
    };
    let k = 0;
    for (const [id, items] of Object.entries(expect)) {
      const [sx, sz] = SLOTS[k++];
      const seen = new Set();
      for (let n = 0; n < 6; n++) {
        const e = spawn(id, sx + n * 2, sz);
        if (id === "pas:infected_sheep" && n % 2) e.triggerEvent("pas:set_color_14");
        await wait(2);
        e.kill();
      }
      await wait(30);
      for (const it of dim.getEntities({ type: "minecraft:item", location: { x: sx + 5, y: Y + 1, z: sz }, maxDistance: 12 })) {
        const st = it.getComponent("minecraft:item").itemStack;
        seen.add(st.typeId);
      }
      const got = [...seen];
      log(`L ${id} drops thematic loot`, got.length > 0 && got.every((t) => items.includes(t)), got.join(","));
    }
    await clean();
    // sheared sheep and babies: no wool / small loot
    const [sx, sz] = SLOTS[0];
    const seen = new Set();
    for (let n = 0; n < 6; n++) {
      const e = spawn("pas:infected_sheep", sx + n * 2, sz);
      e.triggerEvent("pas:set_sheared");
      await wait(2);
      e.kill();
    }
    await wait(30);
    for (const it of dim.getEntities({ type: "minecraft:item", location: { x: sx + 5, y: Y + 1, z: sz }, maxDistance: 12 })) seen.add(it.getComponent("minecraft:item").itemStack.typeId);
    log("L sheared infected sheep drops no wool", ![...seen].some((t) => t.includes("wool")), [...seen].join(","));
    await clean();
  }

  // ===== peaceful difficulty =====
  for (const [id] of ALL) spawn(id, SLOTS[4][0] + Math.random() * 6, SLOTS[4][1]);
  spawn("minecraft:zombie", SLOTS[5][0], SLOTS[5][1]);
  await wait(10);
  const hordeBefore = dim.getEntities({ families: ["pas_horde"] }).length;
  cmd("difficulty peaceful");
  await wait(100);
  const horde = dim.getEntities({ families: ["pas_horde"] }).length;
  const zombies = dim.getEntities({ type: "minecraft:zombie" }).length;
  log("P horde survives peaceful difficulty", horde === hordeBefore && hordeBefore === ALL.length, `horde before=${hordeBefore} after=${horde} vanilla zombies after=${zombies}`);
  cmd("difficulty normal");
  const pass = results.filter((x) => x).length;
  console.warn(`PASTEST_DONE|${pass}/${results.length}`);
}

world.afterEvents.worldInitialize.subscribe(() => {
  system.runTimeout(() => {
    run().catch((e) => console.warn(`PASTEST_DONE|ERROR ${e} ${e && e.stack}`));
  }, 40);
});
