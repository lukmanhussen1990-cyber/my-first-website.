'use strict';
/* ------------------------------------------------------------------
   Characters: small isometric figures + big busts for portraits.
   Flat shapes, round heads, small bodies, no outlines.
------------------------------------------------------------------- */
const CH = {
  you: {
    name: 'YOU', skin: '#e8b38b', backHair: '#3a2a22', hat: 'beanie', hatC: '#30406b', hatC2: '#283660',
    top: 'hoodie', topC: '#d43d3d', topC2: '#b33030', pants: '#2c4b88', shoes: '#ebebf0', bg: '#4d1f24', brow: '#3b2a22',
  },
  larry: {
    name: 'LARRY', skin: '#f3c592', hair: 'messy', hairC: '#6a4126',
    top: 'hoodie', topC: '#e5a92f', topC2: '#c98f1f', pants: '#76603f', shorts: true, socks: '#f2f2f2', shoes: '#3c3c48',
    build: 1.1, bg: '#2f4a3c', brow: '#5a3620', freckles: true,
  },
  officer: {
    name: 'OFFICER', skin: '#c88c62', hair: 'side', hairC: '#4c301f', glasses: true,
    top: 'uniform', topC: '#283659', topC2: '#202c4b', pants: '#1f2a48', shoes: '#15171e', bg: '#3b4a66', brow: '#3a2416',
  },
  detective: {
    name: 'DETECTIVE', skin: '#d39b74', hair: 'bald', hairC: '#9a9aa0', mustache: '#45454b',
    top: 'suit', topC: '#434858', topC2: '#363a48', tie: '#a83434', shirt: '#ececee', pants: '#33374a', shoes: '#18181d',
    bg: '#38404f', brow: '#3c3c40', wrinkles: true,
  },
  cop: {
    name: 'COP', skin: '#8f5b3d', hairC: '#1c1714', hat: 'cap', hatC: '#1e2745', hatC2: '#151c35',
    top: 'uniform', topC: '#283659', topC2: '#202c4b', pants: '#1f2a48', shoes: '#15171e', brow: '#1d120c',
  },
};

/* ---------- small isometric person ----------
 st: {x,y,s, face:-1..1 (screen direction the front faces), back:bool,
      pose:'stand'|'walk'|'sit', phase, dir:[dx,dy] (walk direction on screen),
      arms:'down'|'behind'|'table'|'point'|'phone'|'slap', armT,
      eyes:'normal'|'wide'|'closed'|'shifty'|'sad', look:[x,y], brows:'neutral'|'worried'|'angry'|'raised',
      mouth:'flat'|'smile'|'frown'|'o'|'nervous'|'talk', talk:0..1, blink:0..1, sweat:0..1,
      lean:0..1, headTurn (extra face offset), headDown:0..1, tears:0..1, alpha, squash }
*/
function drawPerson(ctx, ch, st) {
  const s = st.s || 1, face = st.face || 0, back = !!st.back, pose = st.pose || 'stand';
  const b = ch.build || 1;
  ctx.save();
  ctx.translate(st.x, st.y);
  ctx.scale(s, s);
  if (st.alpha !== undefined) ctx.globalAlpha *= st.alpha;
  if (st.squash) ctx.scale(1 + st.squash * 0.12, 1 - st.squash * 0.1);

  const sit = pose === 'sit';
  const walk = pose === 'walk';
  const ph = st.phase || 0;
  const dir = st.dir || [face >= 0 ? C30 : -C30, back ? -S30 : S30];
  const bob = walk ? -1.8 * Math.abs(Math.cos(ph)) + 1.0 : 0;
  const sk = sit ? (st.sitK === undefined ? 1 : clamp(st.sitK)) : 0; // stand -> sit blend
  const hipY = lerp(-56, -44, sk);
  const lift = 12 * sk; // whole upper body offset (hips are lower when sitting)
  if (st.onlyHead) {
    drawSmallHead(ctx, ch, st, 0, -129);
    ctx.restore();
    return;
  }

  // shadow
  if (!st.noShadow) shadowBlob(ctx, sit ? dir[0] * 6 : 0, 0, 27 * b, 10, 0.34);

  // --- legs ---
  const legC = ch.pants;
  const legW = 9.5 * b;
  const drawLeg = (hx, hy, fx, fy, kneeX, kneeY) => {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (ch.shorts && kneeX === undefined) {
      // shorts to the knee then skin + socks
      const kx = lerp(hx, fx, 0.42), ky = lerp(hy, fy, 0.42);
      line(ctx, hx, hy, kx, ky, legC, legW + 1.5);
      line(ctx, kx, ky, fx, fy, ch.skin, legW - 2.5);
      line(ctx, lerp(kx, fx, 0.55), lerp(ky, fy, 0.55), fx, fy, ch.socks, legW - 1.5);
    } else if (kneeX !== undefined) {
      line(ctx, hx, hy, kneeX, kneeY, legC, legW + 0.5);
      if (ch.shorts) {
        line(ctx, kneeX, kneeY, fx, fy, ch.skin, legW - 2.5);
        line(ctx, lerp(kneeX, fx, 0.5), lerp(kneeY, fy, 0.5), fx, fy, ch.socks, legW - 1.5);
      } else line(ctx, kneeX, kneeY, fx, fy, legC, legW);
    } else line(ctx, hx, hy, fx, fy, legC, legW);
  };
  const shoe = (fx, fy) => {
    const off = back ? -dir[0] * 1.5 : face * 2.2;
    ellipse(ctx, fx + off, fy + 1.5, 7.2 * b, 4.2, ch.shoes);
    ellipse(ctx, fx + off, fy + 2.8, 7.2 * b, 1.6, shade(ch.shoes, 0.25));
  };
  const drawLegs = () => {
    if (sit) {
      for (const side of [-1, 1]) {
        const hx = side * lerp(5.3, 5.5, sk) * b, hy = hipY + 2 * sk;
        const sfx = side * 6.2 * b, sfy = -3; // standing foot
        const kx = lerp((hx + sfx) / 2, hx + dir[0] * 17, sk), ky = lerp((hy + sfy) / 2, hy + dir[1] * 17 + 1, sk);
        const fx = lerp(sfx, hx + dir[0] * 19, sk), fy = lerp(sfy, -3 + (back ? -6 : 0), sk);
        drawLeg(hx, hy, fx, fy, kx, ky);
        shoe(fx, fy);
      }
    } else if (st.kneesIn) {
      // knees pressed together (potty dance)
      for (const side of [-1, 1]) {
        const hx = side * 5.3 * b, hy = hipY;
        const kx = side * 1.5, ky = -30;
        const fx = side * 9 * b, fy = -3;
        drawLeg(hx, hy, fx, fy, kx, ky);
        shoe(fx, fy);
      }
    } else {
      const stride = walk ? 7.5 : 0;
      for (const side of [-1, 1]) {
        const sw = walk ? Math.sin(ph) * stride * side : 0;
        const lf = walk ? Math.max(0, Math.cos(ph) * side) * 4.5 : 0;
        const fx = side * 6.2 * b + dir[0] * sw;
        const fy = -3 + dir[1] * sw - lf;
        drawLeg(side * 5.3 * b, hipY + bob, fx, fy);
        shoe(fx, fy);
      }
    }
  };
  drawLegs();

  // upper body transform (lean / bob)
  ctx.save();
  ctx.translate(0, bob + lift);
  if (st.lean) {
    // rotate the upper body around the hips toward the facing direction
    ctx.translate(0, -54);
    ctx.rotate(st.lean * 0.3 * Math.sign(dir[0] || 1));
    ctx.translate(0, 54);
  }
  if (walk) { ctx.translate(0, hipY); ctx.rotate(Math.sin(ph) * 0.025); ctx.translate(0, -hipY); }

  const torsoTop = -106, torsoBot = -52, tw2 = 19 * b;
  const shoulderY = -98;
  const hand = (side) => {
    // returns [x,y] of the hand for this side
    let hx = side * 21 * b, hy = -62;
    const arms = st.arms || 'down';
    if (walk) { const sw = -Math.sin(ph) * 6 * side; hx += dir[0] * sw; hy += dir[1] * sw; }
    if (arms === 'behind') { hx = side * 9; hy = -70; }
    if (arms === 'table') { hx = side * 12 + dir[0] * 20; hy = -66 + dir[1] * 12; }
    if (arms === 'phone') { hx = side * 6 + face * 6; hy = -84; }
    if (arms === 'point' && side === (back ? (dir[0] < 0 ? -1 : 1) : (face >= 0 ? 1 : -1))) {
      const k = st.armT === undefined ? 1 : st.armT;
      hx = lerp(hx, side * 14 + dir[0] * 36, k); hy = lerp(hy, -96 + dir[1] * 30, k);
    }
    if (arms === 'slap' && side === (back ? (dir[0] < 0 ? -1 : 1) : 1)) {
      const k = st.armT || 0; // 0 rest, 0.5 raised, 1 slammed
      const up = Math.sin(clamp(k) * Math.PI);
      hx = side * 12 + dir[0] * (16 + 12 * k); hy = -66 + dir[1] * 12 - up * 34;
    }
    return [hx, hy];
  };
  const drawArm = (side) => {
    const [hx, hy] = hand(side);
    const sx = side * 15.5 * b, sy = shoulderY;
    line(ctx, sx, sy, hx, hy, side * (back ? -1 : 1) * (face || 1) > 0 ? ch.topC2 : ch.topC, 9);
    circle(ctx, hx, hy + 1, 4.8, ch.skin);
  };
  // arms behind the torso
  if ((st.arms || 'down') === 'behind') { drawArm(-1); drawArm(1); }

  // --- torso ---
  ctx.save();
  rrectPath(ctx, -tw2, torsoTop, tw2 * 2, torsoBot - torsoTop, 12 * b);
  ctx.fillStyle = ch.topC; ctx.fill();
  ctx.clip();
  // side shading
  const shadeSide = back ? 1 : (face >= 0 ? -1 : 1);
  ctx.fillStyle = rgba('#000000', 0.12);
  if (shadeSide > 0) ctx.fillRect(tw2 * 0.45, torsoTop, tw2, 80); else ctx.fillRect(-tw2 * 1.45, torsoTop, tw2, 80);
  if (!back) {
    const fo = face * 4;
    if (ch.top === 'hoodie') {
      rrect(ctx, -11 + fo, -73, 22, 13, 5, rgba('#000000', 0.12));
      line(ctx, -3.2 + fo, -103, -3.8 + fo, -88, '#f5e9e2', 1.7);
      line(ctx, 3.2 + fo, -103, 3.8 + fo, -88, '#f5e9e2', 1.7);
    } else if (ch.top === 'uniform') {
      path(ctx, [[-7 + fo, torsoTop], [fo, -94], [7 + fo, torsoTop]]); ctx.fillStyle = ch.topC2; ctx.fill();
      fillPoly(ctx, [[-11 + fo, -93], [-6 + fo, -93], [-6 + fo, -86], [-8.5 + fo, -84], [-11 + fo, -86]], '#e3b341');
      ctx.fillStyle = ch.topC2; ctx.fillRect(-tw2, -58, tw2 * 2, 5);
      ctx.fillStyle = '#c9a03a'; ctx.fillRect(-2.5 + fo, -58, 5, 5);
    } else if (ch.top === 'suit') {
      path(ctx, [[-8 + fo, torsoTop], [fo, -80], [8 + fo, torsoTop]]); ctx.fillStyle = ch.shirt; ctx.fill();
      path(ctx, [[-2.2 + fo, -103], [2.2 + fo, -103], [3 + fo, -84], [fo, -80], [-3 + fo, -84]]); ctx.fillStyle = ch.tie; ctx.fill();
      line(ctx, -8 + fo, torsoTop, -1 + fo, -80, ch.topC2, 2.5);
      line(ctx, 8 + fo, torsoTop, 1 + fo, -80, ch.topC2, 2.5);
    }
  } else if (ch.top === 'hoodie') {
    ellipse(ctx, 0, -98, 13, 9, rgba('#000000', 0.13));
  } else if (ch.top === 'suit') {
    line(ctx, 0, -70, 0, -52, rgba('#000000', 0.18), 1.5);
    rrect(ctx, -9, -109, 18, 7, 3, ch.shirt);
    rrect(ctx, -12, -104, 24, 6, 3, ch.topC2);
  }
  ctx.restore();
  // hood behind neck (front view)
  if (ch.top === 'hoodie' && !back) ellipse(ctx, face * 2, torsoTop + 2, 13.5, 5, ch.topC2);

  // arms in front
  const arms = st.arms || 'down';
  if (arms !== 'behind') { drawArm(-1); drawArm(1); }
  if (arms === 'phone') {
    rrect(ctx, -6 + face * 6, -98, 12, 18, 2.5, '#1a1d26');
    rrect(ctx, -4.8 + face * 6, -96.6, 9.6, 15, 1.5, st.phoneGlow ? '#cfe6ff' : '#2b3550');
    circle(ctx, -4 + face * 6, -84, 4.6, ch.skin); circle(ctx, 4 + face * 6, -84, 4.6, ch.skin);
  }

  // --- neck + head ---
  ctx.fillStyle = shade(ch.skin, 0.12); ctx.fillRect(-4.5, -112, 9, 9);
  const headDown = st.headDown || 0;
  const hx = (st.tilt || 0) * 3 + (back ? 0 : face * 1.5), hy = -129 + headDown * 3;
  drawSmallHead(ctx, ch, st, hx, hy);
  ctx.restore(); // upper body

  ctx.restore();
}

function drawSmallHead(ctx, ch, st, hx, hy) {
  const face = st.face || 0, back = !!st.back;
  const R = 21 * (ch.build ? Math.sqrt(ch.build) : 1);
  const fo = face * 6.8 + (st.headTurn || 0) * 6;
  const hd = st.headDown || 0;
  // ears
  if (!back) {
    circle(ctx, hx - R * 0.96 - face * 2.2, hy + 3, 4.8, shade(ch.skin, 0.08));
    circle(ctx, hx + R * 0.96 - face * 2.2, hy + 3, 4.8, shade(ch.skin, 0.08));
  }
  circle(ctx, hx, hy, R, ch.skin);
  // bald / fringe from back
  if (back) {
    // ears are visible from behind too
    circle(ctx, hx - R * 0.97, hy + 2, 4.6, shade(ch.skin, 0.14)); circle(ctx, hx + R * 0.97, hy + 2, 4.6, shade(ch.skin, 0.14));
    circle(ctx, hx, hy, R, ch.skin);
    ctx.save(); ctx.beginPath(); ctx.arc(hx, hy, R, 0, TAU); ctx.clip();
    if (ch.hair === 'bald') {
      ctx.fillStyle = shade(ch.hairC, 0.12);
      ctx.beginPath(); ctx.moveTo(hx - R, hy - 3); ctx.quadraticCurveTo(hx, hy - 9, hx + R, hy - 3); ctx.lineTo(hx + R, hy + R); ctx.lineTo(hx - R, hy + R); ctx.closePath(); ctx.fill();
      ellipse(ctx, hx, hy + R * 0.95, R * 0.55, R * 0.3, shade(ch.skin, 0.1));
    } else {
      const hc = ch.hairC || ch.backHair || '#2e2220';
      ctx.fillStyle = hc; ctx.fillRect(hx - R, hy - R, R * 2, R * 1.45);
      ctx.beginPath(); ctx.ellipse(hx, hy + R * 0.45, R * 0.75, R * 0.22, 0, 0, Math.PI); ctx.fill();
    }
    ctx.restore();
    drawHairSmall(ctx, ch, hx, hy, R, 0, true);
    return;
  }
  // face features
  const ey = hy + 2 + hd * 3;
  const eyes = st.eyes || 'normal';
  const look = st.look || [0, hd * 0.8];
  const bl = clamp(Math.max(st.blink || 0, eyes === 'closed' ? 1 : 0));
  for (const side of [-1, 1]) {
    const ex = hx + fo + side * 7.2;
    if (eyes === 'wide' && bl < 0.5) {
      circle(ctx, ex, ey, 4.6, '#ffffff');
      ctx.beginPath(); ctx.arc(ex, ey, 4.6, 0, TAU); ctx.strokeStyle = 'rgba(30,30,30,0.6)'; ctx.lineWidth = 0.9; ctx.stroke();
      circle(ctx, ex + look[0] * 1.6, ey + look[1] * 1.4, 1.9, '#161616');
    } else if (bl > 0.6 || eyes === 'closed') {
      ctx.beginPath(); ctx.arc(ex, ey - 1.2, 3.2, 0.15 * Math.PI, 0.85 * Math.PI); ctx.strokeStyle = '#2a1d18'; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.stroke();
    } else {
      const ry = 3.0 * (1 - bl * 0.85);
      ellipse(ctx, ex + look[0] * 1.8, ey + look[1] * 1.2, 2.4, ry, '#1d1b20');
      if (eyes === 'sad' || st.tears) {
        // glossy eyes
        circle(ctx, ex + look[0] * 1.8 - 0.7, ey - 0.9, 0.8, 'rgba(255,255,255,0.9)');
      }
    }
  }
  // brows
  const brows = st.brows || 'neutral';
  const by = hy - 5.5 + (ch.hat === 'beanie' ? 1.5 : 0) - (brows === 'raised' ? 2.5 : 0);
  for (const side of [-1, 1]) {
    let ang = 0;
    if (brows === 'worried') ang = side * 0.42;
    if (brows === 'angry') ang = -side * 0.4;
    const bx = hx + fo + side * 7.2;
    ctx.save(); ctx.translate(bx, by); ctx.rotate(ang);
    line(ctx, -3.6, 0, 3.6, 0, ch.brow || '#2b2120', 1.9);
    ctx.restore();
  }
  // mouth
  const my = hy + 11.5 + hd * 2;
  const mx = hx + fo * 1.05;
  const mouth = st.mouth || 'flat';
  const tk = st.talk || 0;
  if (tk > 0.05 || mouth === 'talk') {
    ellipse(ctx, mx, my, 3.6 + tk * 1.2, 0.9 + tk * 3.4, '#4a1f22');
  } else if (mouth === 'smile') {
    ctx.beginPath(); ctx.arc(mx, my - 3, 4.2, 0.2 * Math.PI, 0.8 * Math.PI); ctx.strokeStyle = '#3a2420'; ctx.lineWidth = 1.6; ctx.stroke();
  } else if (mouth === 'frown') {
    ctx.beginPath(); ctx.arc(mx, my + 3.5, 4, 1.2 * Math.PI, 1.8 * Math.PI); ctx.strokeStyle = '#3a2420'; ctx.lineWidth = 1.6; ctx.stroke();
  } else if (mouth === 'o') {
    ellipse(ctx, mx, my, 2.6, 3.3, '#4a1f22');
  } else if (mouth === 'nervous') {
    ctx.beginPath();
    for (let i = 0; i <= 8; i++) { const xx = mx - 5 + i * 1.25; const yy = my + (i % 2 ? -1 : 1) * 0.9; if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy); }
    ctx.strokeStyle = '#3a2420'; ctx.lineWidth = 1.3; ctx.lineJoin = 'round'; ctx.stroke();
  } else {
    line(ctx, mx - 3.4, my, mx + 3.4, my, '#3a2420', 1.6);
  }
  if (ch.mustache) {
    ctx.beginPath(); ctx.ellipse(mx, my - 3.3, 6.3, 2.4, 0, Math.PI, 0); ctx.lineTo(mx + 6.3, my - 2); ctx.ellipse(mx, my - 2.2, 6.3, 1.2, 0, 0, Math.PI); ctx.fillStyle = ch.mustache; ctx.fill();
  }
  if (ch.glasses) {
    ctx.strokeStyle = '#18181b'; ctx.lineWidth = 1.5;
    for (const side of [-1, 1]) { rrectPath(ctx, hx + fo + side * 7.2 - 4.6, ey - 3.9, 9.2, 7.6, 2.4); ctx.stroke(); }
    line(ctx, hx + fo - 2.6, ey - 1, hx + fo + 2.6, ey - 1, '#18181b', 1.3);
  }
  // sweat drops
  if (st.sweat > 0.01) {
    const k = st.sweat;
    const sy = hy - 8 + ((st.sweatT || 0) % 1) * 10;
    drop(ctx, hx + R * 0.78 - fo * 0.2, sy, 3.4 + k * 1.2, '#c4ebff', clamp(k * 2));
    if (k > 0.55) drop(ctx, hx - R * 0.72 - fo * 0.2, hy - 4 + ((st.sweatT || 0) * 0.7 % 1) * 9, 3, '#c4ebff', clamp((k - 0.55) * 3));
  }
  if (st.tears > 0.01) {
    for (const side of [-1, 1]) {
      const ex = hx + fo + side * 7.2;
      ctx.strokeStyle = `rgba(150,215,255,${0.85 * st.tears})`; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(ex, ey + 3); ctx.quadraticCurveTo(ex + side * 1.5, ey + 9, ex + side * 0.5, ey + 16); ctx.stroke();
    }
  }
  drawHairSmall(ctx, ch, hx, hy, R, fo, false);
}

function drawHairSmall(ctx, ch, hx, hy, R, fo, back) {
  if (ch.hat === 'beanie') {
    const bandTop = hy - 13, bandBot = hy - 6.5 + (back ? 6 : 0);
    ctx.beginPath(); ctx.arc(hx, bandTop + 1, R + 1.6, Math.PI, 0); ctx.closePath(); ctx.fillStyle = ch.hatC; ctx.fill();
    rrect(ctx, hx - R - 2.2, bandTop, (R + 2.2) * 2, bandBot - bandTop, 3.5, ch.hatC2);
    if (back) { ctx.save(); ctx.beginPath(); ctx.arc(hx, hy, R, 0, TAU); ctx.clip(); ctx.fillStyle = ch.hatC; ctx.fillRect(hx - R, bandTop, R * 2, bandBot - bandTop + 1); ctx.restore(); rrect(ctx, hx - R - 2.2, bandTop + 4, (R + 2.2) * 2, 7, 3.5, ch.hatC2); }
  } else if (ch.hat === 'cap') {
    fillPoly(ctx, [[hx - R - 2, hy - 8], [hx - R + 1, hy - 24], [hx + R - 1, hy - 24], [hx + R + 2, hy - 8]], ch.hatC);
    ellipse(ctx, hx + fo * 0.5, hy - 7, R + 4, 3.4, ch.hatC2);
    if (!back) fillPoly(ctx, [[hx + fo * 0.5 - 3, hy - 20], [hx + fo * 0.5 + 3, hy - 20], [hx + fo * 0.5 + 3, hy - 14], [hx + fo * 0.5, hy - 12], [hx + fo * 0.5 - 3, hy - 14]], '#e3b341');
  } else if (ch.hair === 'messy') {
    ctx.fillStyle = ch.hairC;
    ctx.beginPath(); ctx.arc(hx, hy - 3, R + 1.8, Math.PI * 1.02, Math.PI * 1.98); ctx.closePath(); ctx.fill();
    const spikes = [[-18, -14], [-12, -24], [-5, -27], [3, -28], [10, -25], [16, -19]];
    ctx.beginPath(); ctx.moveTo(hx - R - 1.5, hy - 6);
    spikes.forEach(([x, y], i) => { ctx.lineTo(hx + x, hy + y - 4); ctx.lineTo(hx + x + 3.5, hy + y + 4); });
    ctx.lineTo(hx + R + 1.5, hy - 6); ctx.closePath(); ctx.fill();
    // cowlick
    ctx.beginPath(); ctx.moveTo(hx + 2, hy - R - 2); ctx.quadraticCurveTo(hx + 4, hy - R - 11, hx + 10, hy - R - 8); ctx.strokeStyle = ch.hairC; ctx.lineWidth = 2.2; ctx.stroke();
    if (!back) {
      // fringe tufts
      for (const [x, w] of [[-9, 7], [-1, 8], [7, 7]]) fillPoly(ctx, [[hx + fo * 0.6 + x - w / 2, hy - 10], [hx + fo * 0.6 + x + w / 2, hy - 10], [hx + fo * 0.6 + x + 1, hy - 3.5]], ch.hairC);
    } else {
      ctx.save(); ctx.beginPath(); ctx.arc(hx, hy, R, 0, TAU); ctx.clip(); ctx.fillRect(hx - R, hy - 10, R * 2, 16); ctx.restore();
    }
  } else if (ch.hair === 'side') {
    ctx.fillStyle = ch.hairC;
    ctx.beginPath(); ctx.arc(hx, hy - 2, R + 1.5, Math.PI, 0); ctx.closePath(); ctx.fill();
    if (!back) { ctx.beginPath(); ctx.moveTo(hx - R - 1, hy - 3); ctx.quadraticCurveTo(hx - 4 + fo, hy - 16, hx + R + 1, hy - 7); ctx.lineTo(hx + R, hy - 14); ctx.lineTo(hx - R, hy - 12); ctx.closePath(); ctx.fill(); }
    else { ctx.save(); ctx.beginPath(); ctx.arc(hx, hy, R, 0, TAU); ctx.clip(); ctx.fillRect(hx - R, hy - 4, R * 2, 14); ctx.restore(); }
  } else if (ch.hair === 'bald') {
    if (!back) {
      ctx.fillStyle = ch.hairC;
      for (const side of [-1, 1]) { ctx.beginPath(); ctx.ellipse(hx + side * (R - 1.5) - fo * 0.3, hy - 2, 3, 5.5, side * 0.2, 0, TAU); ctx.fill(); }
      ellipse(ctx, hx - 5 + fo * 0.4, hy - R + 5, 6, 2.6, 'rgba(255,255,255,0.28)', -0.3);
    } else {
      ellipse(ctx, hx - 4, hy - R + 6, 6, 2.6, 'rgba(255,255,255,0.22)', -0.3);
    }
  }
}

/* ---------- big bust (portraits, close-ups) ----------
 ex: {face, look:[x,y], blink, eyes:'normal'|'wide'|'squint'|'half'|'closed'|'teary',
      brows:'neutral'|'worried'|'angry'|'raised'|'skeptic', mouth:'flat'|'smile'|'frown'|'o'|'nervous'|'talk'|'grit'|'squish',
      talk:0..1, sweat:[{x,y,s,a}], tears:0..1, blush:0..1, squish:0..1, gulp:0..1, t }
*/
function drawBust(ctx, ch, ex, R) {
  ex = ex || {};
  const face = ex.face || 0, fo = face * 0.13 * R;
  const t = ex.t || 0;
  ctx.save();
  // ---- shoulders / clothes ----
  const bodyTop = 0.82 * R;
  ctx.beginPath();
  ctx.moveTo(-1.55 * R, 2.9 * R);
  ctx.bezierCurveTo(-1.55 * R, 1.55 * R, -1.15 * R, bodyTop + 0.12 * R, -0.45 * R, bodyTop);
  ctx.lineTo(0.45 * R, bodyTop);
  ctx.bezierCurveTo(1.15 * R, bodyTop + 0.12 * R, 1.55 * R, 1.55 * R, 1.55 * R, 2.9 * R);
  ctx.closePath(); ctx.fillStyle = ch.topC; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = 'rgba(0,0,0,0.13)'; ctx.fillRect(0.55 * R, 0, 2 * R, 3 * R);
  if (ch.top === 'hoodie') {
    ellipse(ctx, fo * 0.4, bodyTop + 0.08 * R, 0.78 * R, 0.3 * R, ch.topC2);
    for (const side of [-1, 1]) {
      line(ctx, fo * 0.4 + side * 0.2 * R, bodyTop + 0.2 * R, fo * 0.4 + side * 0.24 * R, bodyTop + 0.95 * R, '#f6ece6', 0.06 * R);
      circle(ctx, fo * 0.4 + side * 0.24 * R, bodyTop + 0.98 * R, 0.045 * R, '#d9cfc8');
    }
  } else if (ch.top === 'uniform') {
    fillPoly(ctx, [[-0.42 * R, bodyTop], [fo * 0.3, bodyTop + 0.55 * R], [0.42 * R, bodyTop]], ch.topC2);
    fillPoly(ctx, [[-0.42 * R, bodyTop], [-0.12 * R, bodyTop + 0.42 * R], [-0.5 * R, bodyTop + 0.25 * R]], shade(ch.topC, 0.25));
    fillPoly(ctx, [[0.42 * R, bodyTop], [0.12 * R, bodyTop + 0.42 * R], [0.5 * R, bodyTop + 0.25 * R]], shade(ch.topC, 0.25));
    // badge
    const bx = 0.62 * R, by = bodyTop + 0.55 * R;
    fillPoly(ctx, [[bx - 0.13 * R, by - 0.12 * R], [bx + 0.13 * R, by - 0.12 * R], [bx + 0.13 * R, by + 0.06 * R], [bx, by + 0.17 * R], [bx - 0.13 * R, by + 0.06 * R]], '#e6b844');
    circle(ctx, bx, by - 0.01 * R, 0.05 * R, '#b78b25');
    // shoulder patch
    rrect(ctx, -1.3 * R, bodyTop + 0.35 * R, 0.3 * R, 0.36 * R, 0.08 * R, '#3c4b74');
  } else if (ch.top === 'suit') {
    fillPoly(ctx, [[-0.4 * R, bodyTop], [fo * 0.3, bodyTop + 1.05 * R], [0.4 * R, bodyTop]], ch.shirt);
    fillPoly(ctx, [[-0.09 * R + fo * 0.3, bodyTop + 0.05 * R], [0.09 * R + fo * 0.3, bodyTop + 0.05 * R], [0.13 * R + fo * 0.3, bodyTop + 0.8 * R], [fo * 0.3, bodyTop + 0.98 * R], [-0.13 * R + fo * 0.3, bodyTop + 0.8 * R]], ch.tie);
    fillPoly(ctx, [[-0.12 * R + fo * 0.3, bodyTop], [0.12 * R + fo * 0.3, bodyTop], [0.08 * R + fo * 0.3, bodyTop + 0.13 * R], [-0.08 * R + fo * 0.3, bodyTop + 0.13 * R]], shade(ch.tie, 0.2));
    // lapels
    fillPoly(ctx, [[-0.4 * R, bodyTop], [fo * 0.3 - 0.05 * R, bodyTop + 1.0 * R], [-0.55 * R, bodyTop + 0.55 * R]], ch.topC2);
    fillPoly(ctx, [[0.4 * R, bodyTop], [fo * 0.3 + 0.05 * R, bodyTop + 1.0 * R], [0.55 * R, bodyTop + 0.55 * R]], ch.topC2);
  }
  ctx.restore();
  // neck
  ctx.fillStyle = shade(ch.skin, 0.1);
  ctx.fillRect(-0.27 * R + fo * 0.2, 0.55 * R, 0.54 * R, 0.4 * R + (ex.gulp || 0) * 0.02 * R);
  if (ex.gulp) ellipse(ctx, fo * 0.2, 0.78 * R + (1 - ex.gulp) * 0.1 * R, 0.09 * R, 0.07 * R * ex.gulp, shade(ch.skin, 0.2));

  // ---- head ----
  const sq = ex.squish || 0;
  ctx.save();
  if (sq) ctx.scale(1 + sq * 0.12, 1 - sq * 0.06);
  // side fringe for bald heads sits behind the ears
  if (ch.hair === 'bald') for (const side of [-1, 1]) { ctx.beginPath(); ctx.ellipse(side * 0.9 * R - fo * 0.3, -0.06 * R, 0.2 * R, 0.36 * R, side * 0.15, 0, TAU); ctx.fillStyle = ch.hairC; ctx.fill(); }
  // ears
  for (const side of [-1, 1]) {
    circle(ctx, side * 0.97 * R - fo * 0.3, 0.14 * R, 0.21 * R, shade(ch.skin, 0.06));
    circle(ctx, side * 0.99 * R - fo * 0.3, 0.14 * R, 0.1 * R, shade(ch.skin, 0.18));
  }
  ctx.beginPath(); ctx.ellipse(0, 0, R, R * 1.02, 0, 0, TAU); ctx.fillStyle = ch.skin; ctx.fill();
  // soft side shade
  ctx.save(); ctx.clip();
  ctx.fillStyle = 'rgba(0,0,0,0.07)'; ctx.beginPath(); ctx.ellipse(0.55 * R, 0.15 * R, 0.6 * R, 1.1 * R, 0, 0, TAU); ctx.fill();
  if (ch.wrinkles) { ctx.strokeStyle = rgba(shade(ch.skin, 0.35), 0.45); ctx.lineWidth = 0.025 * R; for (const yy of [-0.55, -0.46]) { ctx.beginPath(); ctx.moveTo(-0.32 * R + fo, yy * R); ctx.quadraticCurveTo(fo, (yy - 0.04) * R, 0.32 * R + fo, yy * R); ctx.stroke(); } }
  if (ch.freckles) for (const [x, y] of [[-0.5, 0.36], [-0.42, 0.42], [-0.56, 0.45], [0.5, 0.36], [0.42, 0.42], [0.56, 0.45]]) circle(ctx, x * R + fo, y * R, 0.022 * R, rgba('#b8743f', 0.6));
  ctx.restore();

  // blush
  const blush = Math.max(ex.blush || 0, sq * 0.8);
  if (blush > 0) for (const side of [-1, 1]) ellipse(ctx, side * 0.55 * R + fo, 0.36 * R, 0.17 * R * (1 + sq * 0.3), 0.09 * R, `rgba(240,110,110,${0.35 * blush})`);

  // ---- eyes ----
  const eyes = ex.eyes || 'normal';
  const look = ex.look || [0, 0];
  const bl = clamp(Math.max(ex.blink || 0, eyes === 'closed' ? 1 : 0, eyes === 'half' ? 0.45 : 0, eyes === 'squint' ? 0.38 : 0));
  const wide = eyes === 'wide' ? 1 : 0;
  const ey = 0.1 * R;
  for (const side of [-1, 1]) {
    const cx = side * 0.36 * R + fo;
    const rx = (0.185 + wide * 0.05) * R, ry = (0.215 + wide * 0.06) * R;
    if (bl >= 0.97) {
      ctx.beginPath(); ctx.ellipse(cx, ey + 0.02 * R, rx, ry * 0.45, 0, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.strokeStyle = '#2a1e1b'; ctx.lineWidth = 0.045 * R; ctx.lineCap = 'round'; ctx.stroke();
      continue;
    }
    ctx.save();
    ctx.beginPath(); ctx.ellipse(cx, ey, rx, ry, 0, 0, TAU); ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.clip();
    const pr = (0.098 - wide * 0.028) * R;
    const px = cx + look[0] * 0.075 * R, py = ey + look[1] * 0.07 * R + 0.01 * R;
    circle(ctx, px, py, pr, '#17161a');
    circle(ctx, px - pr * 0.35, py - pr * 0.4, pr * 0.32, '#ffffff');
    if (eyes === 'teary' || (ex.tears || 0) > 0.3) {
      circle(ctx, px + pr * 0.35, py + pr * 0.35, pr * 0.18, '#ffffff');
      ctx.fillStyle = 'rgba(140,205,255,0.35)'; ctx.fillRect(cx - rx, ey + ry * 0.35, rx * 2, ry);
    }
    // eyelid
    if (bl > 0.01) {
      const lidY = ey - ry + 2 * ry * bl;
      ctx.fillStyle = shade(ch.skin, 0.04); ctx.fillRect(cx - rx - 2, ey - ry - 2, rx * 2 + 4, lidY - (ey - ry) + 2);
      ctx.beginPath(); ctx.moveTo(cx - rx, lidY); ctx.lineTo(cx + rx, lidY); ctx.strokeStyle = '#2a1e1b'; ctx.lineWidth = 0.04 * R; ctx.stroke();
    }
    ctx.restore();
    ctx.beginPath(); ctx.ellipse(cx, ey, rx, ry, 0, 0, TAU); ctx.strokeStyle = 'rgba(40,30,30,0.75)'; ctx.lineWidth = 0.028 * R; ctx.stroke();
  }
  // ---- brows ----
  const brows = ex.brows || 'neutral';
  const browY = -0.17 * R - (brows === 'raised' ? 0.1 * R : 0) - wide * 0.07 * R;
  for (const side of [-1, 1]) {
    let ang = 0, dy = 0;
    if (brows === 'worried') ang = side * 0.4;
    if (brows === 'angry') { ang = -side * 0.38; dy = 0.04 * R; }
    if (brows === 'skeptic') { ang = side < 0 ? -0.2 : 0.15; dy = side < 0 ? 0.03 * R : -0.09 * R; }
    ctx.save(); ctx.translate(side * 0.36 * R + fo, browY + dy); ctx.rotate(ang);
    line(ctx, -0.15 * R, 0, 0.15 * R, 0, ch.brow || '#2b2120', (ch.hair === 'bald' ? 0.1 : 0.07) * R);
    ctx.restore();
  }
  // ---- nose ----
  if (sq > 0.2) {
    ellipse(ctx, fo, 0.33 * R, 0.17 * R * (0.6 + sq * 0.6), 0.1 * R, tint(ch.skin, 0.35));
    circle(ctx, fo - 0.06 * R, 0.35 * R, 0.025 * R, shade(ch.skin, 0.35)); circle(ctx, fo + 0.06 * R, 0.35 * R, 0.025 * R, shade(ch.skin, 0.35));
  } else {
    ctx.beginPath(); ctx.moveTo(fo + 0.03 * R, 0.16 * R); ctx.quadraticCurveTo(fo + 0.13 * R, 0.33 * R, fo - 0.03 * R, 0.35 * R);
    ctx.strokeStyle = shade(ch.skin, 0.3); ctx.lineWidth = 0.04 * R; ctx.lineCap = 'round'; ctx.stroke();
  }
  // ---- mouth ----
  const mx = fo * 1.1, my = 0.57 * R;
  const mouth = ex.mouth || 'flat';
  const tk = clamp(ex.talk || 0);
  ctx.lineCap = 'round';
  if (ch.mustache) {
    // mustache sits above the mouth
  }
  if (mouth === 'talk' || tk > 0.04) {
    const rx = (0.15 + tk * 0.05) * R, ry = (0.03 + tk * 0.15) * R;
    ctx.save(); ctx.beginPath(); ctx.ellipse(mx, my + ry * 0.3, rx, ry, 0, 0, TAU); ctx.fillStyle = '#4b1c1f'; ctx.fill(); ctx.clip();
    ctx.fillStyle = '#f4f1ee'; ctx.fillRect(mx - rx, my + ry * 0.3 - ry, rx * 2, ry * 0.45);
    ellipse(ctx, mx, my + ry * 1.05, rx * 0.65, ry * 0.5, '#d9656b');
    ctx.restore();
  } else if (mouth === 'smile') {
    ctx.beginPath(); ctx.arc(mx, my - 0.12 * R, 0.2 * R, 0.2 * Math.PI, 0.8 * Math.PI); ctx.strokeStyle = '#3c2421'; ctx.lineWidth = 0.045 * R; ctx.stroke();
  } else if (mouth === 'frown') {
    ctx.beginPath(); ctx.arc(mx, my + 0.16 * R, 0.17 * R, 1.22 * Math.PI, 1.78 * Math.PI); ctx.strokeStyle = '#3c2421'; ctx.lineWidth = 0.045 * R; ctx.stroke();
  } else if (mouth === 'o') {
    ellipse(ctx, mx, my + 0.02 * R, 0.09 * R, 0.12 * R, '#4b1c1f');
  } else if (mouth === 'nervous') {
    ctx.beginPath();
    const n = 10, w = 0.42 * R;
    for (let i = 0; i <= n; i++) { const xx = mx - w / 2 + (w * i) / n; const yy = my + Math.sin(i * 1.6 + t * 9) * 0.025 * R; if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy); }
    ctx.strokeStyle = '#3c2421'; ctx.lineWidth = 0.04 * R; ctx.lineJoin = 'round'; ctx.stroke();
  } else if (mouth === 'grit') {
    rrect(ctx, mx - 0.2 * R, my - 0.06 * R, 0.4 * R, 0.13 * R, 0.04 * R, '#f6f3ef', '#3c2421', 0.03 * R);
    line(ctx, mx - 0.18 * R, my + 0.005 * R, mx + 0.18 * R, my + 0.005 * R, 'rgba(60,36,33,0.7)', 0.018 * R);
  } else if (mouth === 'squish') {
    ellipse(ctx, mx, my + 0.02 * R, 0.2 * R, 0.07 * R, '#4b1c1f');
    ellipse(ctx, mx, my - 0.04 * R, 0.22 * R, 0.035 * R, tint(ch.skin, 0.3));
  } else {
    line(ctx, mx - 0.15 * R, my, mx + 0.15 * R, my, '#3c2421', 0.045 * R);
  }
  if (ch.mustache) {
    ctx.beginPath();
    ctx.moveTo(mx - 0.36 * R, my - 0.02 * R);
    ctx.quadraticCurveTo(mx - 0.3 * R, my - 0.2 * R, mx, my - 0.17 * R);
    ctx.quadraticCurveTo(mx + 0.3 * R, my - 0.2 * R, mx + 0.36 * R, my - 0.02 * R);
    ctx.quadraticCurveTo(mx + 0.2 * R, my - 0.08 * R, mx, my - 0.06 * R);
    ctx.quadraticCurveTo(mx - 0.2 * R, my - 0.08 * R, mx - 0.36 * R, my - 0.02 * R);
    ctx.fillStyle = ch.mustache; ctx.fill();
  }
  // ---- glasses ----
  if (ch.glasses) {
    ctx.strokeStyle = '#1a1a1d'; ctx.lineWidth = 0.055 * R;
    for (const side of [-1, 1]) {
      rrectPath(ctx, side * 0.36 * R + fo - 0.25 * R, ey - 0.2 * R, 0.5 * R, 0.38 * R, 0.1 * R); ctx.stroke();
      ctx.save(); ctx.clip(); line(ctx, side * 0.36 * R + fo - 0.2 * R, ey + 0.15 * R, side * 0.36 * R + fo + 0.05 * R, ey - 0.2 * R, 'rgba(255,255,255,0.28)', 0.06 * R); ctx.restore();
    }
    line(ctx, fo - 0.11 * R, ey - 0.04 * R, fo + 0.11 * R, ey - 0.04 * R, '#1a1a1d', 0.05 * R);
  }
  // ---- tears ----
  const tears = ex.tears || 0;
  if (tears > 0.01) {
    for (const side of [-1, 1]) {
      const cx = side * 0.36 * R + fo;
      ctx.strokeStyle = `rgba(150,215,255,${0.8 * tears})`; ctx.lineWidth = 0.07 * R; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx + side * 0.05 * R, ey + 0.2 * R);
      ctx.bezierCurveTo(cx + side * 0.12 * R, ey + 0.45 * R, cx + side * 0.02 * R, ey + 0.6 * R, cx + side * 0.1 * R, ey + 0.85 * R); ctx.stroke();
      const dp = ((t * 1.3 + (side > 0 ? 0.5 : 0)) % 1);
      drop(ctx, cx + side * 0.11 * R, ey + 0.8 * R + dp * 0.5 * R, 0.07 * R, '#bfe6ff', tears * (1 - dp));
    }
  }
  // ---- sweat ----
  for (const sw of (ex.sweat || [])) drop(ctx, sw.x * R, sw.y * R, (sw.s || 0.12) * R, '#c8ecff', sw.a === undefined ? 1 : sw.a);

  // ---- hair / hat ----
  drawBigHair(ctx, ch, R, fo);
  ctx.restore();
  ctx.restore();
}

function drawBigHair(ctx, ch, R, fo) {
  if (ch.hat === 'beanie') {
    ctx.fillStyle = ch.hatC;
    ctx.beginPath(); ctx.ellipse(0, -0.6 * R, 1.06 * R, 0.6 * R, 0, Math.PI, 0); ctx.closePath(); ctx.fill();
    // ribbing lines
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, -0.6 * R, 1.06 * R, 0.6 * R, 0, Math.PI, 0); ctx.clip();
    ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 0.03 * R;
    for (let i = -4; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(i * 0.22 * R + fo * 0.3, -0.6 * R); ctx.quadraticCurveTo(i * 0.16 * R, -0.98 * R, i * 0.08 * R, -1.22 * R); ctx.stroke(); }
    ctx.restore();
    rrect(ctx, -1.1 * R, -0.7 * R, 2.2 * R, 0.33 * R, 0.14 * R, ch.hatC2);
  } else if (ch.hair === 'messy') {
    ctx.fillStyle = ch.hairC;
    ctx.beginPath(); ctx.ellipse(0, -0.3 * R, 1.06 * R, 0.82 * R, 0, Math.PI * 1.02, Math.PI * 1.98); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-1.05 * R, -0.25 * R);
    const sp = [[-0.95, -0.75], [-0.75, -1.05], [-0.45, -1.22], [-0.1, -1.28], [0.25, -1.24], [0.58, -1.1], [0.85, -0.82], [1.0, -0.5]];
    sp.forEach(([x, y], i) => { ctx.lineTo(x * R, y * R); const nx = sp[i + 1] ? (x + sp[i + 1][0]) / 2 : 1.05; const ny = sp[i + 1] ? (y + sp[i + 1][1]) / 2 + 0.16 : -0.25; ctx.lineTo(nx * R, ny * R); });
    ctx.lineTo(1.05 * R, -0.25 * R); ctx.closePath(); ctx.fill();
    // fringe
    for (const [x, w, d] of [[-0.55, 0.42, 0.5], [-0.15, 0.45, 0.62], [0.28, 0.4, 0.5], [0.62, 0.3, 0.35]]) {
      fillPoly(ctx, [[(x - w / 2) * R + fo * 0.5, -0.62 * R], [(x + w / 2) * R + fo * 0.5, -0.62 * R], [x * R + 0.08 * R + fo * 0.5, (-0.62 + d) * R]], ch.hairC);
    }
    ctx.beginPath(); ctx.moveTo(0.05 * R, -1.18 * R); ctx.quadraticCurveTo(0.12 * R, -1.6 * R, 0.42 * R, -1.48 * R); ctx.strokeStyle = ch.hairC; ctx.lineWidth = 0.1 * R; ctx.lineCap = 'round'; ctx.stroke();
  } else if (ch.hair === 'side') {
    ctx.fillStyle = ch.hairC;
    ctx.beginPath(); ctx.ellipse(0, -0.25 * R, 1.06 * R, 0.85 * R, 0, Math.PI, 0); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-1.04 * R, -0.2 * R); ctx.quadraticCurveTo(-0.3 * R + fo, -0.75 * R, 1.04 * R, -0.42 * R); ctx.lineTo(1.0 * R, -0.75 * R); ctx.lineTo(-1.0 * R, -0.7 * R); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.beginPath(); ctx.ellipse(-0.35 * R, -0.85 * R, 0.4 * R, 0.12 * R, -0.2, 0, TAU); ctx.fill();
  } else if (ch.hair === 'bald') {
    ellipse(ctx, -0.3 * R + fo * 0.4, -0.78 * R, 0.32 * R, 0.12 * R, 'rgba(255,255,255,0.3)', -0.35);
  }
}

/* ---------- portrait frame with speech tail ---------- */
// p: {x,y (center), size, rot, ch, ex, tail:[tx,ty] screen target or null, pop:0..1 (scale anim), alpha, label}
function drawPortrait(ctx, p) {
  const sz = p.size || 190, a = p.alpha === undefined ? 1 : p.alpha;
  if (a <= 0.01) return;
  ctx.save(); ctx.globalAlpha *= a;
  // tail first (behind frame)
  if (p.tail) {
    const [tx, ty] = p.tail;
    const dx = tx - p.x, dy = ty - p.y, L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L, ny = dx / L, bw = sz * 0.13;
    const sc = p.pop === undefined ? 1 : p.pop;
    const bx = p.x + dx * 0.15, by = p.y + dy * 0.15;
    const ex = lerp(bx, tx, clamp(sc)), ey = lerp(by, ty, clamp(sc));
    ctx.beginPath(); ctx.moveTo(bx + nx * bw, by + ny * bw); ctx.lineTo(ex, ey); ctx.lineTo(bx - nx * bw, by - ny * bw); ctx.closePath();
    ctx.fillStyle = '#f4f1ea'; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  ctx.translate(p.x, p.y);
  const sc = p.pop === undefined ? 1 : p.pop;
  ctx.scale(sc, sc);
  ctx.rotate(p.rot || 0);
  // drop shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-sz / 2 + 6, -sz / 2 + 8, sz, sz);
  ctx.fillStyle = '#f4f1ea'; ctx.fillRect(-sz / 2, -sz / 2, sz, sz);
  const inset = sz * 0.055;
  const iw = sz - inset * 2;
  ctx.save();
  ctx.beginPath(); ctx.rect(-iw / 2, -iw / 2, iw, iw); ctx.clip();
  const bg = ctx.createLinearGradient(0, -iw / 2, 0, iw / 2);
  bg.addColorStop(0, tint(p.ch.bg || '#3b4a66', 0.12)); bg.addColorStop(1, shade(p.ch.bg || '#3b4a66', 0.25));
  ctx.fillStyle = bg; ctx.fillRect(-iw / 2, -iw / 2, iw, iw);
  ctx.translate(0, iw * 0.02 + (p.dy || 0));
  drawBust(ctx, p.ch, p.ex, iw * 0.3);
  ctx.restore();
  // inner border shade
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1.2; ctx.strokeRect(-iw / 2, -iw / 2, iw, iw);
  if (p.label) {
    ctx.font = "700 13px 'Courier Prime', monospace"; ctx.textAlign = 'center'; ctx.fillStyle = '#2c2a28';
    ctx.fillText(p.label, 0, sz / 2 + 18);
  }
  ctx.restore();
}
