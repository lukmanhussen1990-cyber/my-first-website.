// Love-scene silhouettes, drawn as flat shapes into a mask, then lit with a gold rim.
// Local units: origin on the ground, y up is negative.  No faces on anyone.
(function () {
  const { smoothPath, taper, ellipse, circle, chain } = L;
  const TAU = Math.PI * 2;
  const S = {};

  // ------------------------------------------------------------------ mother
  // Standing in a long dress and khimar, head bowed over the baby cradled in her arms.
  const momSkirt = smoothPath([
    [-112, 0, 's'], [-94, -60], [-76, -140], [-62, -220], [-54, -292], [36, -292], [38, -210], [52, -124],
    [66, -44], [82, 0, 's'],
  ]);
  const momUpper = smoothPath([
    [-58, -236], [-64, -276], [-62, -320], [-56, -362], [-48, -396], [-36, -424], [-30, -446], [-16, -466],
    [4, -477], [24, -473], [40, -459], [50, -441], [53, -423], [46, -407], [33, -400], [40, -388], [52, -368],
    [50, -338], [42, -300], [34, -262], [30, -236],
  ]);
  const momArm = taper([[-14, -388], [-12, -350], [-2, -322], [36, -316], [76, -326], [108, -342]],
    [34, 32, 30, 28, 24, 20]);
  const momHand = taper([[18, -388], [36, -380], [64, -376], [86, -382]], [26, 24, 22, 18]);
  const babyBundle = ellipse(66, -352, 60, 29, -0.3);
  const babyHead = circle(120, -383, 22);

  S.mother = {
    bbox: [-125, -500, 160, 12],
    light: [-0.55, -1],
    draw(ctx, t) {
      const ph = t * TAU * 0.38;
      const rock = Math.sin(ph) * 0.04;
      ctx.save();
      ctx.fill(momSkirt);
      ctx.translate(0, -262); ctx.rotate(rock); ctx.translate(0, 262);
      ctx.fill(momUpper);
      ctx.save();
      ctx.translate(66, -352); ctx.rotate(rock * 0.8); ctx.translate(-66, 352);
      ctx.fill(momArm);
      ctx.fill(babyBundle); ctx.fill(babyHead);
      ctx.fill(momHand);
      ctx.restore();
      ctx.restore();
    },
  };

  // ------------------------------------------------------------- bird + nest
  // Tree with a nest on its main branch; nest group is scaled up so the birds read clearly.
  const trunk = taper([[-210, 12], [-205, -110], [-194, -240], [-180, -360], [-170, -470], [-162, -560], [-156, -640]],
    [62, 48, 40, 34, 28, 20, 10]);
  const roots = smoothPath([[-262, 4], [-232, -16], [-190, -16], [-158, 4], [-200, 8]]);
  const branchMain = taper([[-184, -380], [-120, -404], [-50, -418], [20, -426], [100, -436], [180, -452], [250, -476]],
    [30, 24, 20, 17, 14, 10, 5]);
  const branchUp = taper([[-168, -500], [-110, -560], [-50, -600], [10, -626], [60, -640]], [20, 15, 11, 8, 4]);
  const branchLeft = taper([[-176, -440], [-230, -490], [-290, -520], [-340, -530]], [18, 13, 9, 4]);
  const twig1 = taper([[150, -446], [175, -490], [190, -520]], [9, 6, 3]);
  const twig2 = taper([[-60, -416], [-80, -450], [-95, -475]], [8, 5, 3]);
  const leaves = [
    [250, -476, -0.3, 46], [222, -472, 0.6, 40], [190, -520, -0.9, 42], [176, -500, 0.5, 34],
    [60, -640, -0.4, 44], [30, -634, 0.7, 38], [0, -622, -1.2, 36], [-40, -604, 0.4, 34],
    [-340, -530, 0.2, 44], [-312, -526, -1.0, 38], [-280, -514, 0.9, 34], [-95, -475, -1.3, 36],
    [-120, -560, -0.9, 34], [-156, -640, -0.6, 40], [-150, -630, 0.9, 34],
  ];
  const leafPath = (len) => smoothPath([[0, 0, 's'], [len * 0.3, -len * 0.2], [len * 0.7, -len * 0.18], [len, 0, 's'], [len * 0.7, len * 0.16], [len * 0.3, len * 0.18]]);
  const leafPaths = {};
  const nest = smoothPath([
    [-60, -24], [-52, -33], [-30, -37], [0, -38], [30, -37], [52, -33], [60, -24], [56, -10], [42, 2], [20, 9],
    [0, 11], [-20, 9], [-42, 2], [-56, -10],
  ]);
  const nestTwigs = [[[-58, -28], [-74, -38]], [[57, -27], [73, -40]], [[-34, -35], [-40, -48]], [[30, -36], [40, -48]],
    [[-50, -6], [-68, -2]], [[50, -4], [68, 2]], [[0, -37], [-4, -48]]];

  function chick(ctx, x, t, ph, dir) {
    const up = 6 + 6 * Math.sin(t * 2.3 + ph);
    const hx = x + dir * 3 + Math.sin(t * 1.7 + ph) * 2, hy = -60 - up;
    ctx.fill(ellipse(x, -36, 13, 10, 0));
    ctx.fill(taper([[x, -38], [(x + hx) / 2, (hy - 38) / 2], [hx, hy]], [14, 11, 10]));
    ctx.fill(circle(hx, hy, 10));
    // gaping beak, pointing up toward the mother
    const open = 0.18 + 0.55 * Math.max(0, Math.sin(t * 9 + ph * 3));
    const base = -Math.PI / 2 + dir * 0.55;
    ctx.save();
    ctx.translate(hx + Math.cos(base) * 7, hy + Math.sin(base) * 7);
    for (const s of [-1, 1]) {
      ctx.save(); ctx.rotate(base + s * open / 2);
      ctx.beginPath(); ctx.moveTo(-1, -4.5); ctx.lineTo(13, 0); ctx.lineTo(-1, 4.5); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  function motherBird(ctx, t) {
    // perched on the right rim, leaning in to feed
    const feed = Math.max(0, Math.sin(t * 1.6));
    const dip = feed * 7;
    ctx.save();
    ctx.translate(0, 0);
    // legs
    ctx.fill(taper([[46, -36], [50, -50]], [4, 5]));
    ctx.fill(taper([[56, -36], [60, -50]], [4, 5]));
    // tail
    ctx.fill(smoothPath([[78, -70], [104, -98, 's'], [114, -92, 's'], [88, -58]]));
    // body
    ctx.fill(ellipse(62, -64, 30, 19, -0.5));
    // wing tip over the body
    ctx.fill(smoothPath([[46, -76], [76, -86], [98, -86, 's'], [80, -70], [56, -62]]));
    // head + neck, dipping toward the chicks
    const hx = 34 - dip * 0.5, hy = -86 + dip;
    ctx.fill(taper([[52, -74], [hx + 4, hy + 4]], [24, 20]));
    ctx.fill(circle(hx, hy, 13));
    const open = 0.08 + 0.3 * feed;
    const base = Math.PI + 0.35 + dip * 0.02;
    ctx.save();
    ctx.translate(hx + Math.cos(base) * 10, hy + Math.sin(base) * 10);
    for (const s of [-1, 1]) {
      ctx.save(); ctx.rotate(base + s * open / 2);
      ctx.beginPath(); ctx.moveTo(-1, -5); ctx.lineTo(16, 0); ctx.lineTo(-1, 5); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    ctx.restore();
  }

  S.bird = {
    bbox: [-380, -690, 320, 20],
    light: [-0.5, -1],
    draw(ctx, t) {
      ctx.fill(trunk); ctx.fill(roots); ctx.fill(branchMain); ctx.fill(branchUp); ctx.fill(branchLeft);
      ctx.fill(twig1); ctx.fill(twig2);
      for (const [x, y, a, len] of leaves) {
        const p = leafPaths[len] || (leafPaths[len] = leafPath(len));
        ctx.save(); ctx.translate(x, y); ctx.rotate(a + Math.sin(t * 1.1 + x * 0.05) * 0.06); ctx.fill(p); ctx.restore();
      }
      // nest group, scaled up
      ctx.save();
      ctx.translate(40, -436); ctx.scale(2.0, 2.0);
      chick(ctx, -34, t, 0.0, 1);
      chick(ctx, -10, t, 2.1, 1);
      chick(ctx, 14, t, 4.0, 1);
      ctx.fill(nest);
      ctx.lineCap = 'round'; ctx.lineWidth = 3;
      for (const [a, b] of nestTwigs) { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
      motherBird(ctx, t);
      ctx.restore();
    },
  };

  // --------------------------------------------------------------------- cat
  const catTorso = smoothPath([
    [-128, -116], [-112, -138], [-64, -148], [0, -146], [50, -146], [86, -150], [112, -162], [130, -150],
    [126, -116], [108, -88], [64, -70], [0, -66], [-66, -70], [-110, -86],
  ]);
  const catHead = smoothPath([
    [124, -162], [128, -184], [132, -196], [134, -224, 's'], [148, -204], [160, -204], [172, -224, 's'],
    [176, -198], [184, -182], [194, -168], [190, -154], [176, -144], [154, -140], [134, -146],
  ]);

  function catLeg(ctx, root, a1, a2, w1, w2, l1, l2) {
    const j = chain(root, [[l1, a1], [l2, a2]]);
    ctx.fill(taper(j, [w1, (w1 + w2) / 2, w2]));
    ctx.fill(ellipse(j[2][0] + 4, j[2][1] - 3, 10, 6, 0));
  }

  S.cat = {
    bbox: [-200, -280, 240, 14],
    light: [-0.5, -1],
    draw(ctx, t, o) {
      const dist = o.walk || 0;
      const phi = dist / 118 * TAU;
      const bob = -2.5 * Math.abs(Math.sin(phi));
      // far legs first (slightly offset), then body, then near legs
      const legs = (far) => {
        const off = far ? 12 : 0, ph = far ? Math.PI : 0;
        // front
        let s = phi + ph;
        let a1 = -0.38 * Math.sin(s), lift = Math.pow(Math.max(0, Math.cos(s)), 1.5);
        catLeg(ctx, [86 + off, -100 + bob], a1, a1 + 0.9 * lift, 24, 14, 50, 46);
        // hind
        s = phi + ph + Math.PI * 0.95;
        a1 = 0.32 - 0.36 * Math.sin(s); lift = Math.pow(Math.max(0, Math.cos(s)), 1.5);
        catLeg(ctx, [-92 + off, -104 + bob], a1, -0.28 + 0.9 * lift * 0.6, 32, 14, 52, 52);
      };
      ctx.save();
      legs(true);
      ctx.translate(0, bob);
      ctx.fill(catTorso);
      // tail: graceful upward curve with a slow sway
      const sw = Math.sin(t * 1.3) * 10;
      ctx.fill(taper([[-120, -126], [-150, -148], [-166, -186], [-168 + sw * 0.3, -226], [-156 + sw, -254], [-136 + sw, -262]],
        [20, 17, 15, 13, 11, 9]));
      ctx.fill(taper([[96, -128], [118, -150], [136, -160]], [56, 50, 40]));
      ctx.fill(catHead);
      // kitten held by the scruff, dangling and swaying with the walk
      ctx.save();
      ctx.translate(178, -150);
      ctx.rotate(Math.sin(phi * 0.5 + 0.6) * 0.12);
      ctx.fill(circle(10, 16, 14));
      ctx.fill(smoothPath([[6, 4, 's'], [12, -8, 's'], [16, 4]]));
      ctx.fill(smoothPath([[14, 6, 's'], [22, -6, 's'], [22, 10]]));
      ctx.fill(ellipse(-2, 42, 16, 27, 0.18));
      ctx.fill(taper([[-8, 56], [-12, 74], [-10, 82]], [9, 7, 6]));
      ctx.fill(taper([[4, 58], [6, 74], [8, 82]], [9, 7, 6]));
      ctx.fill(taper([[8, 34], [16, 50], [18, 58]], [8, 6, 5]));
      ctx.fill(taper([[-14, 62], [-22, 76], [-30, 84], [-38, 86]], [7, 6, 5, 4]));
      ctx.restore();
      ctx.restore();
      legs(false);
    },
  };

  // ------------------------------------------------------------- horse + foal
  // Mare facing left, head lowered to her foal lying by her front feet.
  const horseBody = smoothPath([
    [-150, -244], [-132, -286], [-100, -314], [-66, -324], [-20, -312], [30, -306], [90, -316], [140, -326],
    [176, -316], [196, -290], [198, -258], [188, -230], [170, -206], [148, -192], [120, -184], [80, -172],
    [20, -164], [-40, -166], [-84, -170], [-118, -184], [-142, -208],
  ]);
  const horseNeck = smoothPath([
    [-60, -326], [-108, -328], [-156, -312], [-196, -284], [-224, -254], [-240, -232], [-212, -200],
    [-190, -220], [-166, -238], [-148, -248], [-130, -240],
  ]);
  const horseHead = smoothPath([
    [-242, -236], [-254, -204], [-262, -164], [-268, -128], [-274, -104], [-270, -88], [-256, -82],
    [-242, -88], [-236, -110], [-226, -136], [-206, -160], [-196, -180], [-200, -204],
  ]);
  const horseEars = [smoothPath([[-240, -232], [-236, -262, 's'], [-226, -234]]),
    smoothPath([[-230, -226], [-222, -254, 's'], [-216, -226]])];
  const forelock = smoothPath([[-244, -230], [-258, -216, 's'], [-248, -212]]);
  const horseMane = (t) => {
    const top = [[-80, -334], [-116, -337], [-152, -324], [-186, -300], [-214, -270], [-234, -244]];
    const pts = [[-60, -328]];
    top.forEach((p, i) => pts.push([p[0] + Math.sin(t * 1.4 + i) * 1.5, p[1] - 6 - (i % 2) * 5]));
    pts.push([-236, -232], [-208, -262], [-178, -292], [-146, -312], [-110, -322], [-76, -326]);
    return smoothPath(pts);
  };
  // leg bones in local "hanging down" coordinates (y along the bone)
  const bones = {};
  const boneP = (len, w0, w1) => bones[[len, w0, w1]] || (bones[[len, w0, w1]] = smoothPath([
    [-w0 / 2, -4], [w0 / 2, -4], [w1 / 2 + (w0 - w1) * 0.2, len * 0.45], [w1 / 2, len + 3], [-w1 / 2, len + 3],
    [-w1 / 2 - (w0 - w1) * 0.25, len * 0.45]]));
  const hoofP = smoothPath([[-9, -2], [9, -2], [8, 14], [12, 26, 's'], [-14, 26, 's'], [-12, 14]]);
  function bone(ctx, j, a, path) { ctx.save(); ctx.translate(j[0], j[1]); ctx.rotate(a); ctx.fill(path); ctx.restore(); }
  const step = (j, a, len) => [j[0] - Math.sin(a) * len, j[1] + Math.cos(a) * len];
  function frontLeg(ctx, elbow, a1, a2, a3) {
    bone(ctx, elbow, a1, boneP(82, 42, 24));
    const knee = step(elbow, a1, 82);
    ctx.fill(circle(knee[0], knee[1], 13));
    bone(ctx, knee, a2, boneP(64, 22, 20));
    const fet = step(knee, a2, 64);
    ctx.fill(circle(fet[0], fet[1], 12.5));
    bone(ctx, fet, a3, hoofP);
  }
  function hindLeg(ctx, stifle) {
    bone(ctx, stifle, -0.36, boneP(98, 58, 26));
    const hock = step(stifle, -0.36, 98);
    ctx.fill(circle(hock[0], hock[1], 14));
    ctx.fill(ellipse(hock[0] + 10, hock[1] - 6, 10, 8, 0));
    bone(ctx, hock, 0.04, boneP(70, 24, 20));
    const fet = step(hock, 0.04, 70);
    ctx.fill(circle(fet[0], fet[1], 12.5));
    bone(ctx, fet, 0.18, hoofP);
  }
  const foalBody = ellipse(-246, -34, 66, 30, 0.04);
  const foalHead = smoothPath([[-330, -128], [-346, -118], [-362, -104], [-374, -92], [-376, -80], [-366, -74],
    [-352, -80], [-336, -88], [-318, -98], [-312, -116]]);
  const foalNeck = taper([[-282, -44], [-306, -80], [-326, -112]], [40, 30, 24]);
  const foalEar = smoothPath([[-330, -124], [-322, -148, 's'], [-316, -122]]);

  S.horse = {
    bbox: [-390, -370, 240, 16],
    light: [-0.45, -1],
    foal: [-262, -60],
    draw(ctx, t, o) {
      const lift = o.lift || 0;               // 0 standing .. 1 hoof lifted and held
      // foal (lying at her front feet)
      ctx.fill(foalBody);
      ctx.fill(taper([[-292, -16], [-322, -8], [-342, -4]], [20, 14, 11]));
      ctx.fill(taper([[-206, -14], [-188, -6], [-170, -3]], [24, 16, 11]));
      ctx.fill(taper([[-182, -46], [-172, -36]], [10, 7]));
      ctx.save();
      const nod = Math.sin(t * 0.9) * 0.04;
      ctx.translate(-282, -44); ctx.rotate(nod); ctx.translate(282, 44);
      ctx.fill(foalNeck); ctx.fill(foalHead); ctx.fill(foalEar);
      ctx.restore();
      // far legs
      frontLeg(ctx, [-90, -190], -0.02, 0.0, 0.2);
      hindLeg(ctx, [150, -214]);
      // body, neck, head
      ctx.fill(horseBody); ctx.fill(horseNeck); ctx.fill(horseMane(t));
      ctx.save();
      const hn = Math.sin(t * 0.8) * 0.025;
      ctx.translate(-226, -226); ctx.rotate(hn); ctx.translate(226, 226);
      ctx.fill(horseHead); horseEars.forEach((e) => ctx.fill(e)); ctx.fill(forelock);
      ctx.restore();
      const sw = Math.sin(t * 0.9) * 6;
      ctx.fill(taper([[190, -300], [212, -288], [226, -250], [230 + sw * 0.4, -200], [226 + sw, -150], [216 + sw * 1.3, -112]],
        [26, 34, 34, 30, 20, 8]));
      // near legs: hind, then the front leg that lifts away from the foal
      hindLeg(ctx, [128, -218]);
      frontLeg(ctx, [-112, -190], L.lerp(0.0, 0.78, lift), L.lerp(0.0, -0.5, lift), L.lerp(0.18, -1.0, lift));
    },
  };

  // --------------------------------------------------------- lit renderer
  const NAVY_TOP = '#16224a', NAVY_BOT = '#0a1128';
  let mask, body, rim;
  function ensure(w, h) {
    if (!mask || mask.width < w || mask.height < h) {
      const W = Math.max(w, mask ? mask.width : 0), H = Math.max(h, mask ? mask.height : 0);
      mask = L.canvas(W, H); body = L.canvas(W, H); rim = L.canvas(W, H);
    }
  }

  // Draws silhouette `sil` with its local origin at screen (x, y), `scale` px per unit.
  S.render = function (ctx, gctx, sil, t, x, y, scale, alpha, o = {}) {
    if (alpha <= 0.002) return;
    const [x0, y0, x1, y1] = sil.bbox;
    const pad = 16;
    const w = Math.ceil((x1 - x0) * scale + pad * 2), h = Math.ceil((y1 - y0) * scale + pad * 2);
    ensure(w, h);
    const mc = mask.getContext('2d'), bc = body.getContext('2d'), rc = rim.getContext('2d');
    for (const c of [mc, bc, rc]) { c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, w + 2, h + 2); }
    mc.setTransform(scale, 0, 0, scale, pad - x0 * scale, pad - y0 * scale);
    mc.fillStyle = '#fff'; mc.strokeStyle = '#fff';
    sil.draw(mc, t, o);
    mc.setTransform(1, 0, 0, 1, 0, 0);

    // body: dark navy with a slight vertical gradient
    bc.drawImage(mask, 0, 0, w, h, 0, 0, w, h);
    bc.globalCompositeOperation = 'source-in';
    const g = bc.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, NAVY_TOP); g.addColorStop(1, NAVY_BOT);
    bc.fillStyle = g; bc.fillRect(0, 0, w, h);

    // rim: mask minus mask shifted away from the light
    const [lx, ly] = sil.light;
    const rimW = (o.rim || 1) * Math.max(2.4, 4.2 * scale);
    rc.drawImage(mask, 0, 0, w, h, 0, 0, w, h);
    rc.globalCompositeOperation = 'destination-out';
    rc.drawImage(mask, 0, 0, w, h, -lx * rimW, -ly * rimW, w, h);
    rc.globalCompositeOperation = 'source-in';
    rc.fillStyle = '#F5CF83'; rc.fillRect(0, 0, w, h);

    const sx = x + x0 * scale - pad, sy = y + y0 * scale - pad;
    ctx.save();
    ctx.globalAlpha = o.bodyAlpha == null ? alpha : o.bodyAlpha;
    ctx.drawImage(body, 0, 0, w, h, sx, sy, w, h);
    ctx.globalCompositeOperation = 'lighter';
    const ra = (o.rimA == null ? alpha : o.rimA) * (o.rimAlpha == null ? 1 : o.rimAlpha);
    ctx.globalAlpha = ra * 0.85;
    ctx.filter = 'blur(0.8px)';
    ctx.drawImage(rim, 0, 0, w, h, sx, sy, w, h);
    ctx.globalAlpha = ra * 0.35;
    ctx.filter = `blur(${(rimW * 0.9).toFixed(1)}px)`;
    ctx.drawImage(rim, 0, 0, w, h, sx + lx * rimW * 0.6, sy + ly * rimW * 0.6, w, h);
    ctx.filter = 'none';
    ctx.restore();
    if (gctx) {
      gctx.save();
      gctx.globalCompositeOperation = 'lighter';
      gctx.globalAlpha = alpha * 0.9 * (o.glow == null ? 1 : o.glow);
      gctx.drawImage(rim, 0, 0, w, h, sx, sy, w, h);
      gctx.drawImage(rim, 0, 0, w, h, sx, sy, w, h);
      gctx.restore();
    }
  };

  window.SIL = S;
})();
