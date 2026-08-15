/* ============================ CHARACTER ART ============================== */
/* The hero is assembled from parametric parts so all four facings and the
   whole walk cycle come out of one description. Gear colour shifts with the
   equipped weapon tier, so upgrades are visible on the sprite itself. */

const HERO = {
  skin: "#ffd2a6", skin2: "#d9975f", hair: "#c9601f", hair2: "#f0a04c",
  tunic: "#3fa0f0", tunic2: "#2166b8", pants: "#2a3f7a", scarf: "#ff5a6e",
  belt: "#8b5a2b", boot: "#6b4020", eye: "#20142e"
};
const TIER_TRIM = ["#c8ccd8", "#d99a4a", "#9fd8ff", "#ffcf5c", "#d68cff"];

function heroSprite(dir, frame, trim) {
  /* 16 wide x 20 tall, feet planted at y = 19 */
  return spr(16, 20, (p, rng) => {
    const H = HERO;
    const step = (frame === 1 || frame === 3);
    const bob = step ? 1 : 0;                       /* body lifts on step frames */
    const swing = frame === 1 ? 1 : frame === 3 ? -1 : 0;
    const Y = (v) => v - bob;

    /* ---- legs (planted, so they don't bob) ---- */
    const legs = [
      { x: 4, lift: frame === 1 ? 1 : 0 },
      { x: 9, lift: frame === 3 ? 1 : 0 }
    ];
    for (const L of legs) {
      p.rect(L.x, 14, 3, 5 - L.lift, H.pants);
      p.rect(L.x, 14, 1, 5 - L.lift, darken(H.pants, 22));
      p.rect(L.x, 19 - L.lift, 3, 1, H.boot);
    }

    if (dir === "side") {
      /* ---- body, seen from the side: narrower, one arm forward ---- */
      p.rect(5, Y(9), 6, 6, H.tunic);
      p.dither(H.tunic2, .5, 5, Y(9), 3, 6);
      p.rect(5, Y(14), 6, 1, H.belt);
      p.rect(5, Y(8), 6, 2, H.scarf);
      /* scarf tail streaming behind */
      p.rect(2, Y(9), 3, 2, H.scarf); p.rect(1, Y(10), 2, 1, darken(H.scarf, 24));
      /* back arm then front arm, swinging opposite the legs */
      p.rect(6, Y(10) - swing, 2, 4, H.tunic2);
      p.rect(9, Y(10) + swing, 2, 4, H.tunic);
      p.rect(9, Y(14) + swing, 2, 2, H.skin);
      /* head */
      p.ell(8, Y(5), 3.6, 3.6, H.skin);
      p.rect(9, Y(4), 3, 2, H.skin);                 /* nose/brow line forward */
      p.ell(8, Y(3.4), 3.8, 2.6, H.hair);
      p.rect(4, Y(3), 3, 4, H.hair);                 /* hair down the back */
      p.rect(4, Y(2), 4, 1, H.hair2);
      p.set(10, Y(5), H.eye); p.set(10, Y(6), H.skin2);
      p.rect(5, Y(2), 2, 1, H.hair2);
    } else if (dir === "up") {
      p.rect(4, Y(9), 8, 6, H.tunic);
      p.dither(H.tunic2, .45, 4, Y(9), 8, 6);
      p.rect(4, Y(14), 8, 1, H.belt);
      p.rect(4, Y(8), 8, 2, H.scarf);
      p.rect(3, Y(10) - swing, 2, 4, H.tunic2);
      p.rect(11, Y(10) + swing, 2, 4, H.tunic2);
      /* back of the head: all hair */
      p.ell(8, Y(5), 4.2, 3.8, H.hair);
      p.rect(4, Y(5), 8, 3, H.hair);
      p.rect(5, Y(2), 6, 2, H.hair2);
      p.speckle(H.hair2, 5, rng);
    } else { /* down */
      p.rect(4, Y(9), 8, 6, H.tunic);
      p.dither(H.tunic2, .4, 8, Y(9), 4, 6);
      p.rect(4, Y(14), 8, 1, H.belt);
      p.rect(7, Y(14), 2, 1, trim);                  /* belt buckle takes the tier colour */
      p.rect(4, Y(8), 8, 2, H.scarf);
      p.rect(5, Y(9), 6, 1, lighten(H.scarf, 26));
      /* arms */
      p.rect(3, Y(10) - swing, 2, 3, H.tunic2);
      p.rect(11, Y(10) + swing, 2, 3, H.tunic2);
      p.rect(3, Y(13) - swing, 2, 2, H.skin);
      p.rect(11, Y(13) + swing, 2, 2, H.skin);
      /* head + face */
      p.ell(8, Y(5.4), 4, 3.8, H.skin);
      p.rect(4, Y(6), 8, 2, H.skin);
      p.ell(8, Y(3.2), 4.2, 2.6, H.hair);
      p.rect(4, Y(2), 8, 2, H.hair);
      p.rect(5, Y(1), 6, 1, H.hair2);
      p.rect(4, Y(4), 2, 2, H.hair);                 /* sideburns frame the face */
      p.rect(10, Y(4), 2, 2, H.hair);
      p.set(6, Y(6), H.eye); p.set(6, Y(5), H.eye);
      p.set(9, Y(6), H.eye); p.set(9, Y(5), H.eye);
      p.set(7, Y(7), H.skin2); p.set(8, Y(7), H.skin2);
    }
    p.outline(PAL.ink, true).rim(30, 26);
  }, 4000 + dir.charCodeAt(0) * 31 + frame);
}

/* ============================== MONSTERS ================================= */
/* Every monster is generated from shapes + a palette, so recolouring one for
   a different biome (or an elite) costs nothing. */

function eyePair(p, cx, cy, gap, c, pupil, angry) {
  p.rect(cx - gap - 1, cy, 2, 2, c); p.rect(cx + gap, cy, 2, 2, c);
  p.set(cx - gap - 1, cy + (angry ? 1 : 0), pupil); p.set(cx + gap + 1, cy + (angry ? 1 : 0), pupil);
  if (angry) { p.set(cx - gap - 1, cy - 1, PAL.ink); p.set(cx + gap + 1, cy - 1, PAL.ink); }
}

const MONSTER_ART = {
  /* ---------------- passive ---------------- */
  gelmite(frame, col) { /* wobbling slime */
    const c = col || "#57d68a";
    return spr(18, 16, (p, rng) => {
      const w = [0, 1, 0, -1][frame % 4];
      p.blob(9, 10 + (w > 0 ? 0 : 0), 6.5 + w * 0.7, 5 - w * 0.5, c, rng, .12);
      p.rect(3, 13, 12, 2, c);
      p.ell(6, 7, 2.2, 1.6, lighten(c, 70), null);
      eyePair(p, 9, 9, 2, "#ffffff", PAL.ink, false);
      p.set(9, 12, darken(c, 30));
      p.dither(darken(c, 22), .35, 0, 11, 18, 5);
      p.outline(PAL.ink, true).rim(30, 24);
    }, 100 + frame);
  },
  sporling(frame, col) { /* hopping mushroom */
    const cap = col || "#e8564a";
    return spr(16, 17, (p, rng) => {
      const hop = frame % 2 ? 1 : 0;
      const Y = (v) => v - hop;
      p.rect(6, Y(10), 4, 5, "#f0e0c0");
      p.rect(6, Y(10), 1, 5, "#d0bc98");
      p.ell(8, Y(7), 6.5, 4.4, cap);
      p.rect(2, Y(7), 12, 3, cap);
      p.ell(6, Y(5), 2, 1.4, lighten(cap, 46));
      for (let i = 0; i < 4; i++) p.ell(rng.int(3, 12), Y(rng.int(5, 8)), 1.4, 1.1, "#fff3d0");
      p.set(6, Y(11), PAL.ink); p.set(9, Y(11), PAL.ink);
      p.set(7, Y(13), "#d08a90"); p.set(8, Y(13), "#d08a90");
      p.outline(PAL.ink, true).rim(28, 22);
    }, 120 + frame);
  },
  prikkle(frame, col) { /* prickly desert critter */
    const g = col || "#4fae5e";
    return spr(16, 17, (p, rng) => {
      const w = frame % 2 ? 1 : 0;
      p.ell(8, 9 - w, 5, 5.4, g);
      p.rect(3, 9 - w, 10, 4, g);
      p.rect(4, 14, 2, 2, "#8b6a3a"); p.rect(10, 14, 2, 2, "#8b6a3a");
      for (let y = 5; y < 14; y += 3) { p.set(2, y - w, "#f0e8b0"); p.set(13, y + 1 - w, "#f0e8b0"); p.set(8, y - 3 - w, "#f0e8b0"); }
      p.dither(darken(g, 26), .35, 9, 0, 7, 17);
      eyePair(p, 8, 8 - w, 2, "#ffffff", PAL.ink, false);
      p.outline(PAL.ink, true).rim(28, 22);
    }, 140 + frame);
  },
  fennec(frame, col) { /* skittish little fox */
    const c = col || "#e8a24a";
    return spr(18, 15, (p, rng) => {
      const w = frame % 2 ? 1 : 0;
      p.ell(9, 9, 5.4, 3.6, c);
      p.ell(13, 7, 3, 2.8, c);                        /* head */
      p.line(14, 5, 15, 2, c); p.line(12, 5, 11, 2, c);
      p.rect(14, 3, 2, 3, c); p.rect(11, 3, 2, 3, c); /* ears */
      p.set(15, 4, "#ffb0b8"); p.set(12, 4, "#ffb0b8");
      p.rect(3, 6 - w, 4, 3, lighten(c, 26));         /* tail */
      p.rect(2, 5 - w, 3, 2, "#fff0d8");
      p.rect(6, 12, 2, 2, darken(c, 30)); p.rect(11, 12, 2, 2, darken(c, 30));
      p.rect(11, 9, 5, 2, "#fff0d8");
      p.set(14, 7, PAL.ink); p.set(16, 8, PAL.ink);
      p.outline(PAL.ink, true).rim(28, 22);
    }, 160 + frame);
  },
  /* ---------------- aggressive ---------------- */
  nightwing(frame, col) { /* bat */
    const c = col || "#8a5cd0";
    return spr(20, 14, (p, rng) => {
      const flap = [0, -2, -3, -2][frame % 4];
      p.ell(10, 8, 3.2, 3.4, c);
      p.rect(7, 4 + flap, 3, 3, darken(c, 20)); p.rect(4, 5 + flap, 3, 3, darken(c, 20));
      p.rect(1, 6 + flap, 3, 3, darken(c, 34));
      p.rect(10, 4 + flap, 3, 3, darken(c, 20)); p.rect(13, 5 + flap, 3, 3, darken(c, 20));
      p.rect(16, 6 + flap, 3, 3, darken(c, 34));
      p.rect(8, 3, 1, 2, c); p.rect(11, 3, 1, 2, c);  /* ears */
      p.set(9, 7, "#ff5566"); p.set(11, 7, "#ff5566");
      p.rect(9, 10, 1, 2, "#ffffff"); p.rect(11, 10, 1, 2, "#ffffff");
      p.outline(PAL.ink, true).rim(26, 20);
    }, 200 + frame);
  },
  rattleknight(frame, col) { /* skeleton with a shield */
    const b = col || "#e8e4d0";
    return spr(18, 20, (p, rng) => {
      const step = frame % 2;
      p.rect(6, 15 + step, 2, 4, b); p.rect(10, 15 - step, 2, 4, b);
      p.rect(5, 18 + step, 4, 1, b); p.rect(9, 18 - step, 4, 1, b);
      p.rect(6, 9, 6, 6, b);
      for (let y = 10; y < 15; y += 2) p.rect(6, y, 6, 1, darken(b, 40));
      p.ell(9, 6, 3.4, 3.2, b);
      p.rect(7, 6, 1, 2, PAL.ink); p.rect(10, 6, 1, 2, PAL.ink);
      p.set(7, 6, "#ff7a3c"); p.set(10, 6, "#ff7a3c");
      p.rect(8, 9, 2, 1, PAL.ink);
      p.rect(3, 9, 4, 7, "#7a6a4a"); p.frameRect(3, 9, 4, 7, "#5a4a30");  /* shield */
      p.set(4, 12, "#c8b070");
      p.rect(12, 10, 2, 5, b);
      p.outline(PAL.ink, true).rim(26, 22);
    }, 220 + frame);
  },
  grimhound(frame, col) { /* wolf */
    const c = col || "#6a6f86";
    return spr(22, 15, (p, rng) => {
      const w = frame % 2 ? 1 : 0;
      p.ell(11, 8, 6.4, 3.6, c);
      p.rect(15, 5, 6, 4, c);                          /* head */
      p.rect(19, 7, 3, 2, darken(c, 14));              /* muzzle */
      p.rect(15, 3, 2, 3, c); p.rect(18, 3, 2, 3, c);  /* ears */
      p.rect(4, 5 - w, 4, 2, c); p.rect(2, 4 - w, 3, 2, lighten(c, 16)); /* tail */
      p.rect(6, 11 + w, 2, 3, darken(c, 18)); p.rect(10, 11 - w, 2, 3, darken(c, 18));
      p.rect(13, 11 + w, 2, 3, darken(c, 18)); p.rect(16, 11 - w, 2, 3, darken(c, 18));
      p.rect(6, 6, 10, 2, lighten(c, 18));
      p.set(18, 6, "#ff5566"); p.set(20, 6, "#ff5566");
      p.set(20, 9, "#ffffff"); p.set(21, 8, "#ffffff");
      p.outline(PAL.ink, true).rim(26, 22);
    }, 240 + frame);
  },
  emberwisp(frame, col) { /* floating caster */
    const c = col || "#6a3fb0";
    return spr(16, 20, (p, rng) => {
      const f = [0, 1, 2, 1][frame % 4];
      const Y = (v) => v - f;
      /* tattered robe */
      for (let y = 0; y < 12; y++) {
        const w = 2 + y * 0.42;
        p.rect(8 - w, Y(6) + y, w * 2, 1, y > 8 && ((y + f) % 2) ? darken(c, 26) : c);
      }
      p.ell(8, Y(6), 4.2, 3.6, darken(c, 12));
      p.ell(8, Y(7), 3, 2.4, "#120b22");               /* hood shadow */
      p.set(7, Y(7), "#ffb03c"); p.set(9, Y(7), "#ffb03c");
      /* the flame it carries */
      const fl = ["#ffb03c", "#ff7a2c", "#ffd06c"][frame % 3];
      p.ell(13, Y(11), 2, 2.6, fl);
      p.ell(13, Y(10), 1, 1.4, "#fff0c0");
      p.speckle(lighten(c, 30), 6, rng);
      p.outline(PAL.ink, true).rim(24, 18);
    }, 260 + frame);
  },
  gloomwraith(frame, col) { /* fast phasing spectre */
    const c = col || "#4ad2c8";
    return spr(16, 20, (p, rng) => {
      const f = [0, 1, 2, 1][frame % 4];
      p.ell(8, 6 - f, 4, 4.2, c);
      for (let y = 0; y < 12; y++) {
        const w = 4 - y * 0.22, a = 1 - y / 15;
        p.rect(8 - w, 9 - f + y, w * 2, 1, c, a * (((y + f) % 3) ? 1 : .5));
      }
      p.rect(6, 5 - f, 2, 2, "#ffffff"); p.rect(9, 5 - f, 2, 2, "#ffffff");
      p.set(6, 6 - f, "#ff3c6e"); p.set(10, 6 - f, "#ff3c6e");
      p.outline(darken(c, 60), true);
      p.rim(26, 10);
    }, 280 + frame);
  },
  stonewarden(frame, col) { /* elite golem */
    const c = col || "#7e7a92";
    return spr(26, 26, (p, rng) => {
      const step = frame % 2;
      p.rect(6, 20 + step, 5, 5, darken(c, 16)); p.rect(15, 20 - step, 5, 5, darken(c, 16));
      p.blob(13, 13, 8, 7, c, rng, .16);
      p.rect(5, 8, 16, 10, c);
      p.rect(2, 9 + step, 5, 9, darken(c, 10)); p.rect(19, 9 - step, 5, 9, darken(c, 10));
      p.blob(13, 6, 5.4, 4.4, lighten(c, 10), rng, .2);
      p.rect(9, 5, 3, 2, "#ffb03c"); p.rect(14, 5, 3, 2, "#ffb03c");
      p.speckle(darken(c, 30), 26, rng);
      p.speckle(lighten(c, 26), 16, rng);
      /* glowing core */
      p.ell(13, 13, 2.4, 2.4, "#ffcf5c"); p.ell(13, 13, 1.2, 1.2, "#fff3d0");
      p.outline(PAL.ink, true).rim(30, 26);
    }, 300 + frame);
  },
  thornmaw(frame, col) { /* aggressive carnivorous plant */
    const c = col || "#c8365c";
    return spr(18, 20, (p, rng) => {
      const open = frame % 2 ? 3 : 0;
      p.rect(7, 12, 4, 7, "#3f8438");
      p.rect(4, 15, 3, 2, "#3f8438"); p.rect(11, 16, 3, 2, "#3f8438");
      p.ell(9, 8 - open * .3, 5.4, 4.4 + open * .2, c);
      p.rect(4, 8, 11, 3, c);
      /* maw */
      p.ell(9, 9 + open * .2, 3, 1.6 + open * .5, "#3a0f1c");
      for (let i = 0; i < 4; i++) {
        p.set(6 + i * 2, 8 + open * .2, "#ffffff");
        p.set(6 + i * 2, 10 + open, "#ffffff");
      }
      p.speckle(lighten(c, 34), 8, rng);
      p.outline(PAL.ink, true).rim(28, 22);
    }, 320 + frame);
  }
};

function crownSprite() {
  return spr(12, 7, (p) => {
    const g = "#ffcf5c";
    p.rect(1, 4, 10, 2, g);
    p.rect(1, 1, 2, 4, g); p.rect(5, 0, 2, 5, g); p.rect(9, 1, 2, 4, g);
    p.set(5, 2, "#ff5566"); p.set(1, 3, "#6cc5ff"); p.set(10, 3, "#6cc5ff");
    p.outline(PAL.ink, true).rim(30, 10);
  });
}

/* =============================== WEAPONS ================================= */
/* Weapon sprites point right (+x) and are rotated at draw time. */
function swordSprite(tier) {
  const t = TIER_TRIM[clamp(tier - 1, 0, 4)];
  return spr(22, 9, (p, rng) => {
    p.rect(2, 4, 4, 2, "#7a4a20");                     /* grip */
    p.rect(6, 2, 2, 6, tier >= 4 ? "#ffcf5c" : "#a08050"); /* guard */
    p.rect(8, 4, 11, 2, t);
    p.rect(8, 4, 11, 1, lighten(t, 46));
    p.line(19, 5, 21, 5, t); p.set(20, 4, lighten(t, 30));
    p.set(4, 5, "#c8a060");
    if (tier >= 3) { p.rect(10, 4, 6, 1, "#ffffff", .7); }
    if (tier >= 5) { for (let i = 0; i < 5; i++) p.set(rng.int(9, 18), rng.int(4, 5), "#ffffff", .8); }
    p.outline(PAL.ink, true);
  }, 600 + tier);
}
function spearSprite(tier) {
  const t = TIER_TRIM[clamp(tier - 1, 0, 4)];
  return spr(30, 9, (p, rng) => {
    p.rect(1, 4, 20, 2, "#8b5a2b");
    p.rect(1, 4, 20, 1, "#a87240");
    p.rect(19, 3, 2, 4, tier >= 4 ? "#ffcf5c" : "#9a8060");
    for (let i = 0; i < 8; i++) {
      const w = 3 - Math.floor(i / 3);
      p.rect(21 + i, 4 - (w > 2 ? 1 : 0), 1, 2 + (w > 2 ? 2 : 0), t);
    }
    p.rect(21, 3, 5, 1, lighten(t, 46));
    if (tier >= 3) p.rect(22, 4, 4, 1, "#ffffff", .6);
    if (tier >= 5) for (let i = 0; i < 4; i++) p.set(rng.int(21, 28), rng.int(3, 6), "#ffffff", .8);
    p.outline(PAL.ink, true);
  }, 620 + tier);
}
function wandSprite(tier) {
  const t = TIER_TRIM[clamp(tier - 1, 0, 4)];
  const orb = ["#6cc5ff", "#8ef07a", "#ff9a4a", "#ffcf5c", "#d68cff"][clamp(tier - 1, 0, 4)];
  return spr(18, 11, (p, rng) => {
    p.rect(1, 5, 11, 2, "#6b4020");
    p.rect(1, 5, 11, 1, "#8a5a30");
    p.rect(11, 3, 2, 6, t);
    p.ell(14, 5, 3.2, 3.4, orb);
    p.ell(13, 4, 1.4, 1.2, "#ffffff", .9);
    for (let i = 0; i < 4; i++) p.set(rng.int(11, 17), rng.int(1, 9), lighten(orb, 40), .7);
    p.outline(PAL.ink, true);
  }, 640 + tier);
}

function boltSprite(kind, frame) {
  const cols = { arcane: ["#d68cff", "#ffffff"], fire: ["#ff8a3c", "#ffe9a8"], frost: ["#6cc5ff", "#ffffff"], spark: ["#ffe95c", "#ffffff"] };
  const c = cols[kind] || cols.arcane;
  return spr(12, 12, (p, rng) => {
    const r = 3 + (frame % 2 ? .6 : 0);
    p.ell(6, 6, r + 1.6, r + 1.6, c[0], null);
    p.ell(6, 6, r, r, c[0]);
    p.ell(5, 5, r * .5, r * .5, c[1]);
    for (let i = 0; i < 5; i++) p.set(rng.int(1, 10), rng.int(1, 10), c[1], .55);
    p.outline(darken(c[0], 55), true);
  }, 660 + frame + kind.charCodeAt(0));
}

/* ================================= UI ART =============================== */
function icoBook() {
  return spr(16, 16, (p) => {
    p.rect(2, 2, 12, 12, "#8a3c4a"); p.rect(2, 2, 12, 1, "#c05a68");
    p.rect(7, 2, 2, 12, "#5a2430");
    p.rect(3, 4, 4, 8, "#f0e6c8"); p.rect(9, 4, 4, 8, "#f0e6c8");
    for (let y = 5; y < 12; y += 2) { p.rect(4, y, 2, 1, "#a89878"); p.rect(10, y, 2, 1, "#a89878"); }
    p.rect(11, 3, 2, 4, "#ffcf5c");
    p.outline(PAL.ink, true);
  });
}
function icoPause() {
  return spr(16, 16, (p) => {
    p.rect(4, 3, 3, 10, "#e8e2c8"); p.rect(9, 3, 3, 10, "#e8e2c8");
    p.outline(PAL.ink, true).rim(20, 16);
  });
}
function icoHeart(small) {
  const s = small ? 10 : 14;
  return spr(s, s, (p) => {
    const c = "#ff5566", k = s / 14;
    p.ell(s * .32, s * .35, 3 * k, 3 * k, c); p.ell(s * .68, s * .35, 3 * k, 3 * k, c);
    for (let y = 0; y < s * .55; y++) { const w = (s * .46) * (1 - y / (s * .55)); p.rect(s / 2 - w, s * .42 + y, w * 2, 1, c); }
    p.ell(s * .3, s * .3, 1.2 * k, 1 * k, "#ffb0b8");
    p.outline(PAL.ink, true);
  });
}
function icoDrop(c) {
  return spr(12, 12, (p) => {
    p.ell(6, 7.5, 3.4, 3.4, c);
    for (let y = 0; y < 5; y++) { const w = 1 + y * .55; p.rect(6 - w, 2 + y, w * 2, 1, c); }
    p.ell(4.6, 6.6, 1, 1.2, "#ffffff", .8);
    p.outline(PAL.ink, true);
  });
}
function icoCoin() {
  return spr(12, 12, (p) => {
    p.ell(6, 6, 4.4, 4.4, "#e0a41c"); p.ell(6, 6, 3.2, 3.4, "#ffcf5c");
    p.rect(5, 4, 2, 5, "#e0a41c");
    p.ell(4.5, 4.5, 1, .9, "#fff3d0");
    p.outline(PAL.ink, true);
  });
}

/* boon icons — small symbolic glyphs, one per upgrade family */
function boonIcon(kind) {
  return spr(16, 16, (p, rng) => {
    const K = kind;
    if (K === "hp") { const c = "#ff5566"; p.ell(5.4, 6, 3.2, 3.2, c); p.ell(10.6, 6, 3.2, 3.2, c); for (let y = 0; y < 7; y++) { const w = 5.4 * (1 - y / 7); p.rect(8 - w, 7 + y, w * 2, 1, c); } p.set(4, 5, "#ffb0b8"); }
    else if (K === "sp") { const c = "#39d4c8"; p.ell(8, 9, 4, 4, c); for (let y = 0; y < 6; y++) { const w = 1 + y * .6; p.rect(8 - w, 3 + y, w * 2, 1, c); } p.set(6, 8, "#ffffff"); }
    else if (K === "sword") { p.rect(3, 11, 4, 2, "#7a4a20"); p.line(6, 11, 13, 3, "#c8ccd8"); p.line(7, 12, 14, 4, "#eef2ff"); p.rect(4, 8, 5, 2, "#a08050"); }
    else if (K === "spear") { p.line(3, 13, 12, 4, "#8b5a2b"); p.rect(11, 2, 3, 4, "#c8ccd8"); p.set(12, 1, "#eef2ff"); }
    else if (K === "wand") { p.line(3, 13, 10, 6, "#6b4020"); p.ell(11.5, 4.5, 3.2, 3.2, "#d68cff"); p.set(10, 3, "#ffffff"); }
    else if (K === "crit") { const c = "#ffcf5c"; p.ellRing(8, 8, 6, 6, c); p.ell(8, 8, 2, 2, "#ff5566"); p.rect(1, 7, 3, 2, c); p.rect(12, 7, 3, 2, c); p.rect(7, 1, 2, 3, c); p.rect(7, 12, 2, 3, c); }
    else if (K === "speed") { const c = "#8ef07a"; p.rect(5, 3, 5, 3, c); p.rect(4, 6, 7, 4, c); p.rect(3, 10, 5, 3, c); for (let i = 0; i < 3; i++) p.rect(11, 4 + i * 4, 4, 1, "#ffffff", .8); }
    else if (K === "lifesteal") { p.ell(5, 6, 3, 3, "#ff5566"); p.ell(10, 6, 3, 3, "#ff5566"); for (let y = 0; y < 6; y++) { const w = 5 * (1 - y / 6); p.rect(7.5 - w, 7 + y, w * 2, 1, "#ff5566"); } p.line(2, 2, 13, 13, "#ffffff"); }
    else if (K === "magnet") { const c = "#6cc5ff"; p.rect(3, 3, 3, 8, c); p.rect(10, 3, 3, 8, c); p.rect(3, 3, 10, 3, c); p.rect(3, 11, 3, 2, "#ff5566"); p.rect(10, 11, 3, 2, "#ff5566"); }
    else if (K === "xp") { const c = "#ffcf5c"; for (let y = 0; y < 5; y++) { const w = 1.6 + y * 1.1; p.rect(8 - w, 2 + y, w * 2, 1, c); } for (let y = 0; y < 6; y++) { const w = 6.2 - y * 1.05; p.rect(8 - w, 7 + y, w * 2, 1, darken(c, 20)); } p.rect(5, 4, 1, 4, "#fff3d0"); }
    else if (K === "shield") { const c = "#9fd8ff"; p.rect(3, 2, 10, 7, c); for (let y = 0; y < 6; y++) { const w = 5 * (1 - y / 6); p.rect(8 - w, 9 + y, w * 2, 1, c); } p.rect(7, 4, 2, 6, "#2f74cf"); p.rect(5, 5, 6, 2, "#2f74cf"); }
    else if (K === "thorns") { const c = "#e8e4d0"; p.ellRing(8, 8, 4, 4, "#8a3c4a"); for (let i = 0; i < 8; i++) { const a = i * TAU / 8; p.line(8 + Math.cos(a) * 4, 8 + Math.sin(a) * 4, 8 + Math.cos(a) * 7, 8 + Math.sin(a) * 7, c); } }
    else if (K === "dash") { const c = "#b6a6ff"; p.rect(6, 6, 6, 4, c); p.rect(11, 4, 3, 8, c); for (let i = 0; i < 3; i++) p.rect(1, 5 + i * 3, 4, 1, "#ffffff", .8); }
    else if (K === "trance") { const c = "#39d4c8"; p.ellRing(8, 8, 6, 6, c); p.line(8, 2, 8, 14, c); p.ell(8, 8, 2.4, 2.4, "#ffcf5c"); }
    else if (K === "fire") { const c = "#ff8a3c"; for (let y = 0; y < 9; y++) { const w = 4.6 * Math.sin((y / 9) * Math.PI * .9); p.rect(8 - w, 5 + y, w * 2, 1, c); } p.ell(8, 11, 2, 2.4, "#ffe9a8"); p.rect(7, 2, 2, 4, c); }
    else if (K === "frost") { const c = "#9fd8ff"; for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; p.line(8 - Math.cos(a) * 6, 8 - Math.sin(a) * 6, 8 + Math.cos(a) * 6, 8 + Math.sin(a) * 6, c); } p.ell(8, 8, 1.6, 1.6, "#ffffff"); }
    else if (K === "chain") { const c = "#ffe95c"; p.line(9, 1, 5, 7, c); p.line(5, 7, 9, 8, c); p.line(9, 8, 5, 15, c); p.line(10, 1, 6, 7, c); p.line(10, 8, 6, 15, c); }
    else if (K === "armor") { const c = "#a8a4c0"; p.rect(4, 3, 8, 6, c); p.rect(2, 4, 3, 4, c); p.rect(11, 4, 3, 4, c); for (let y = 0; y < 5; y++) { const w = 4 * (1 - y / 5); p.rect(8 - w, 9 + y, w * 2, 1, c); } p.rect(7, 5, 2, 5, "#6a6f86"); }
    else { p.ellRing(8, 8, 5, 5, "#ffcf5c"); p.ell(8, 8, 2, 2, "#ffcf5c"); }
    p.outline(PAL.ink, true).rim(26, 20);
  }, 800 + kind.length * 17 + kind.charCodeAt(0));
}

/* pickup sprites */
function pickupSprite(kind, frame) {
  if (kind === "heart") return icoHeart(false);
  if (kind === "stam") return icoDrop("#39d4c8");
  if (kind === "coin") return icoCoin();
  return spr(10, 10, (p, rng) => {  /* xp mote */
    const c = "#ffcf5c";
    const r = 2.6 + (frame % 2 ? .5 : 0);
    p.ell(5, 5, r + 1.4, r + 1.4, c, null);
    p.ell(5, 5, r, r, "#fff3d0");
    p.outline(darken(c, 40), true);
  }, 880 + frame);
}

/* title banner: a small generated scene */
function titleArt() {
  const W = 160, H = 74;
  return spr(W, H, (p, rng) => {
    /* sky gradient by dithered bands */
    const sky = ["#1b1240", "#2a1c5c", "#43276e", "#6b3a78", "#a8547a", "#e0865c"];
    for (let y = 0; y < H; y++) {
      const b = Math.min(sky.length - 1, Math.floor((y / H) * sky.length));
      p.rect(0, y, W, 1, sky[b]);
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const b = (y / H) * sky.length;
      if (b % 1 > .55 && ((x + y) & 1) === 0) p.set(x, y, sky[Math.min(sky.length - 1, Math.floor(b) + 1)]);
    }
    /* stars */
    for (let i = 0; i < 34; i++) p.set(rng.int(0, W - 1), rng.int(0, 30), "#ffffff", rng.range(.3, .9));
    /* moon */
    p.ell(132, 15, 8, 8, "#ffe9a8"); p.ell(129, 12, 2, 2, "#e0c880"); p.ell(134, 18, 1.6, 1.6, "#e0c880");
    /* distant peaks */
    for (let x = 0; x < W; x++) {
      const h = 20 + Math.sin(x * .07) * 7 + fbm(x / 18, 3, 21, 3) * 14;
      for (let y = H - h; y < H; y++) p.set(x, y, "#2a2450");
    }
    for (let x = 0; x < W; x++) {
      const h = 12 + Math.sin(x * .11 + 2) * 5 + fbm(x / 12, 9, 44, 3) * 10;
      for (let y = H - h; y < H; y++) p.set(x, y, "#1d1a3c");
    }
    /* hill the hero stands on */
    for (let x = 0; x < W; x++) {
      const h = 10 + Math.sin((x - 40) * .045) * 4;
      for (let y = H - h; y < H; y++) p.set(x, y, y < H - h + 2 ? "#3f8438" : "#255028");
    }
    /* pine silhouettes */
    for (let i = 0; i < 9; i++) {
      const bx = rng.int(4, W - 6), by = H - 10 - rng.int(0, 3);
      for (let k = 0; k < 3; k++) for (let j = 0; j < 5; j++) {
        const w = 1 + k + j * .5;
        p.rect(bx - w / 2, by - 12 + k * 4 + j, w, 1, "#16301c");
      }
      p.rect(bx, by - 1, 1, 3, "#16301c");
    }
    /* the hero, tiny, back to us */
    const hx = 46, hy = H - 22;
    p.rect(hx, hy + 12, 3, 6, "#14102a"); p.rect(hx + 4, hy + 12, 3, 6, "#14102a");
    p.rect(hx - 1, hy + 5, 9, 8, "#1a2c5a");
    p.ell(hx + 3.5, hy + 3, 4, 3.6, "#14102a");
    p.rect(hx - 5, hy + 5, 5, 4, "#8a2436");     /* cloak in the wind */
    p.rect(hx - 8, hy + 6, 4, 3, "#6a1a2a");
    p.line(hx + 8, hy + 10, hx + 15, hy - 2, "#c8ccd8");  /* raised sword */
    p.rect(hx + 14, hy - 4, 2, 3, "#eef2ff");
    /* monsters watching from the dark */
    p.ell(112, H - 8, 4, 3, "#57d68a"); p.set(111, H - 9, "#ffffff"); p.set(114, H - 9, "#ffffff");
    p.ell(20, H - 7, 3.4, 2.6, "#8a5cd0"); p.set(19, H - 8, "#ff5566"); p.set(21, H - 8, "#ff5566");
    /* fireflies */
    for (let i = 0; i < 12; i++) p.set(rng.int(0, W - 1), rng.int(H - 26, H - 4), "#ffe95c", rng.range(.4, 1));
    p.frameRect(0, 0, W, H, "#5b4a94");
  }, 31337);
}
