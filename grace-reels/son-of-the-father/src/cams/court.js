// Camera + blocking for the 'court' set: the stone pavement (Gabbatha) before the governor's palace in Jerusalem at
// Passover. Shots S1 (hero orbit + speed ramp), S2 (Barabbas in chains), S3 (crane-up over the city), S4 (low angle
// on Pilate, the two men led forward), S5 (over Jesus' shoulder), S7 (over Pilate's shoulder: he presents them), S7b
// (the hushed crowd, whispers), S8 (the shout), S9 (freeze, drain to dark, spotlights), S10 (the swap), S12 (at the
// gate he looks back; rack focus to the hill), S13 (light breaks over the hill), S14a (push-in on Barabbas), LOOP.
// Geography (set-local, metres; +x north, +z east): the palace + judgment seat on the NORTH side facing south; the two
// men stand before it facing north; the crowd fills the SOUTH half; the low sun is in the SOUTH (behind the crowd, so
// it rim-lights Jesus seen from the seat); the main axis runs EAST-WEST: the east gate (Barabbas walks out into the warm
// light) -> the pavement -> the open west side (a stair down; Jesus is led away) -> the lower city -> the west wall ->
// the hill far away outside it. In a 9:16 frame that axis keeps gate, men and hill in one narrow view (S10, S12).
// COURT holds the shared layout (the set builds from it, the overlay anchors use it).

export const COURT = {
  J: [4.4, 0, 0.85],               // Jesus' mark (faces the judgment seat, +x)
  B: [4.4, 0, -0.85],              // Barabbas' mark
  face: Math.PI / 2,               // yaw of "facing +x" (direction (sin, cos))
  seat: [9.7, 1.6, 0],             // Pilate's chair on the dais (dais top y 1.6), he faces south (-x)
  dais: { x0: 8.1, x1: 10.9, z: 2.2, h: 1.6 },
  palace: { front: 10.9, back: 17.0, h: 1.2 },
  court: { x0: -16, x1: 10.9, z0: -21.5, z1: 21.5 },
  crowd: { x0: -14.2, x1: 1.9, z0: -18.8, z1: 18.8 },
  gate: [4.4, 0, 21.5],            // the east gate (arch half-width 2.6)
  westStair: { x0: 2.3, x1: 6.5, down: 3.0 },
  hill: [14, 0, -215],             // Golgotha, outside the west wall
  hillTop: 22,
  temple: [-30, 0, 290],
};

export function blocking(plan, H) {
  const E = plan.ev, S = Object.fromEntries(plan.shots.map((s) => [s.id, s]));
  const { J, B } = COURT;
  // S1 speed ramp: the world runs at full speed, then slows to 0.22x (slow motion) around ev.rampSlow
  const T1 = 1.1, T2 = 1.7, R2 = 0.22;
  const s1Time = (t) => {
    if (t < T1) return t;
    if (t < T2) { const u = t - T1; return T1 + u - (1 - R2) * u * u / (2 * (T2 - T1)); }
    return T1 + (T2 - T1) - (1 - R2) * (T2 - T1) / 2 + R2 * (t - T2);
  };
  // S1 orbit: angular speed w(t) (fast -> slow); the azimuth ends in front of Him (camera on the +x side)
  const W = [[0, 0.8], [0.35, 0.8], [1.1, 0.55], [1.7, 0.05], [99, 0.05]];
  const wAt = (t) => { for (let i = 0; i < W.length - 1; i++) if (t <= W[i + 1][0]) { const [a, wa] = W[i], [b, wb] = W[i + 1]; return wa + (wb - wa) * H.clamp((t - a) / (b - a)); } return 0.05; };
  const integ = (a, b) => { let s = 0; const n = 80; for (let i = 0; i < n; i++) s += wAt(a + (b - a) * (i + 0.5) / n); return s * (b - a) / n; };
  const R0 = integ(0, S.S1.t1);
  // from the north-west round to the front (Barabbas, west of Him, stays out of the frame the whole way)
  const orbitA = (t) => (t >= 0 ? Math.PI / 2 + (R0 - integ(0, t)) : Math.PI / 2 + R0 - 0.8 * t);
  // piecewise-linear walks at a speed (m/s) -> [x, 0, z, heading yaw, moving]
  const path = (pts, t0, speed) => (t) => {
    let d = Math.max(0, (t - t0) * speed);
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], L = Math.hypot(b[0] - a[0], b[2] - a[2]);
      if (d <= L || i === pts.length - 2) { const k = H.clamp(d / L); return [H.lerp(a[0], b[0], k), 0, H.lerp(a[2], b[2], k), Math.atan2(b[0] - a[0], b[2] - a[2]), t > t0 && d < L]; }
      d -= L;
    }
    return [pts[0][0], 0, pts[0][2], 0, false];
  };
  const bWalk = path([B, [3.15, 0, 1.4], [3.0, 0, 12], [3.6, 0, 20]], E.barabbasWalks, 0.62);
  const jLed = path([J, [5.05, 0, -4], [5.1, 0, -14], [4.6, 0, -21.5]], E.jesusLed, 0.8);
  const gateWalk = path([[4.15, 0, 18.4], [3.9, 0, 23.6]], S.S12.t0 - 0.4, 0.75);    // S12: out through the gate, stops
  const s4 = (t) => { const u = H.clamp((t - S.S4.t0 + 0.2) / (S.S4.t1 - S.S4.t0 + 0.4)); return 2.1 * (1 - u); };
  const s4z = (z) => z * 0.38;                                                     // side by side, close together
  return {
    s1Time, orbitA, wAt, bWalk, jLed, gateWalk,
    // positions of the two men: [x, 0, z, facing yaw, moving]
    jesusAt(t, shot) {
      if (shot === 'S4') return [J[0] + s4(t), 0, s4z(J[2]), -Math.PI / 2, true];
      if (shot === 'S10' && t >= E.jesusLed) { const p = jLed(t); return [p[0], 0, p[2], p[3], p[4]]; }
      if (shot === 'S5') return [J[0], 0, J[2], -Math.PI / 2, false];     // He has turned to look at the people
      return [J[0], 0, J[2], COURT.face, false];
    },
    barabbasAt(t, shot) {
      if (shot === 'S4') return [B[0] + s4(t), 0, s4z(B[2]), -Math.PI / 2, true];
      if (shot === 'S10') {
        if (t >= E.barabbasWalks) { const p = bWalk(t); return [p[0], 0, p[2], p[3], p[4]]; }
        return [B[0], 0, B[2], 0, false];                                 // turned toward the gate to be released
      }
      if (shot === 'S12' || shot === 'S14a') {
        if (shot === 'S12' && t < E.turnBack) { const p = gateWalk(t); return [p[0], 0, p[2], p[3], true]; }
        return [3.9, 0, 23.6, 0, false];
      }
      return [B[0], 0, B[2], COURT.face, false];
    },
    // crowd energy 0 calm .. 0.5 chanting .. 1 exploding (S9 holds the frozen value)
    crowdK(t, shot) {
      if (shot === 'S1' || shot === 'LOOP' || shot === 'S2') return 0.82;
      if (shot === 'S3') return 0.3;
      if (shot === 'S4' || shot === 'S5') return 0.34;
      if (shot === 'S7') return H.lerp(0.3, 0.06, H.smooth(H.invLerp(E.hush, E.hush + 0.8, t)));
      if (shot === 'S7b') return 0.04;
      if (shot === 'S8' || shot === 'S9') {
        const tt = Math.min(t, E.freeze);
        return H.clamp(0.06 + 0.38 * H.smooth(H.invLerp(E.shoutRise - 0.45, E.shoutRise + 0.3, tt)) + 0.62 * H.smooth(H.invLerp(E.shout - 0.12, E.shout + 0.06, tt)));
      }
      if (shot === 'S10') return 0.22;
      return 0.15;
    },
    // world time for the crowd / dust / wind (S1 slow motion, S9 frozen, S10 slow, LOOP = S1 before frame 0)
    worldTime(t, shot) {
      if (shot === 'S1') return s1Time(t);
      if (shot === 'LOOP') return s1Time(t - plan.dur);
      if (shot === 'S9') return E.freeze;
      if (shot === 'S10') return E.freeze + 3 + (t - S.S10.t0) * 0.45;
      return t;
    },
    // the crowd parts for Barabbas in S10 (0..1)
    lane: (t) => H.smooth(H.invLerp(E.shacklesLand - 0.4, E.barabbasWalks + 1.2, t)),
  };
}

export function camera(plan, Bk, shot, t, H) {
  const E = plan.ev, lt = t - shot.t0, len = shot.t1 - shot.t0, u = H.clamp(lt / len);
  const at = (p) => H.at('court', p);
  const { J, B } = COURT;
  switch (shot.id) {
    case 'S1': case 'LOOP': {
      // fast orbit -> slow motion, low angle, ends on His calm face (He lifts His eyes at ev.eyesLift)
      const tt = shot.id === 'LOOP' ? t - plan.dur : t;
      const a = Bk.orbitA(tt);
      const k = H.smooth(H.invLerp(-0.2, 2.2, tt));
      const d = H.lerp(4.4, 3.35, k) - 0.12 * H.clamp((tt - 2.2) / 2.8);
      const camY = H.lerp(1.2, 0.62, k);
      const look = at([J[0], H.lerp(1.5, 1.52, k), J[2] - 0.02]);
      const pos = at([J[0] + Math.sin(a) * d, camY, J[2] + Math.cos(a) * d]);
      const w = Bk.wAt(Math.max(0, tt));
      return { pos, look, fov: 30, focus: Math.hypot(pos[0] - look[0], pos[2] - look[2]) + 0.05, mblur: w > 0.3 ? 6 : 0 };
    }
    case 'S2': {
      // Barabbas in chains: medium close-up, slightly low, backlit by the low sun; slow creep in
      const look = at([B[0], 1.48 + 0.02 * u, B[2] + 0.02]);
      const dist = 3.7 - 0.3 * H.easeInOut(u);
      return { pos: H.sph(look, Math.PI / 2 + 0.3 - 0.05 * u, -0.1, dist), look, fov: 30, focus: dist };
    }
    case 'S3': {
      // crane-up over Jerusalem: from beside the judgment seat over the crowd to the city, the temple smoking in the haze
      const k = H.easeInOut(u);
      const ky = H.easeInOut(H.clamp(u * 1.08));
      const pos = at([H.lerp(-6, -8, k), H.lerp(2.4, 30, ky), H.lerp(-20.5, -16, k)]);
      const look = at([H.lerp(-6, -10, k), H.lerp(2.0, 23, ky), H.lerp(2, 120, k)]);
      return { pos, look, fov: 32, focus: H.lerp(12, 160, k) };
    }
    case 'S4': {
      // low angle behind the two men: Pilate high on the judgment seat; they are led forward to their marks
      const look = at([9.6, 2.75 - 0.05 * u, 0.0]);
      const pos = at([1.0 + 0.3 * u, 0.5, 0.02 * u]);
      return { pos, look, fov: 30, focus: 5.2 };
    }
    case 'S5': {
      // over Jesus' shoulder: He has turned to look at the people (south); soft light on their faces
      const look = at([J[0] - 6, 1.5, J[2] - 0.45]);
      const pos = at([J[0] + 1.2 - 0.1 * u, 1.8 - 0.02 * u, J[2] + 0.19]);
      return { pos, look, fov: 31, focus: 6.4 };
    }
    case 'S7': {
      // over Pilate's shoulder: he stands and raises a hand toward each man below; the crowd beyond, the sun ahead
      const look = at([3.4, 1.3 - 0.05 * u, 0.0]);
      const pos = at([11.75 - 0.2 * u, 4.0, 0.0]);
      return { pos, look, fov: 31, focus: 7.6 };
    }
    case 'S7b': {
      // in front of the hushed crowd: faces turned to the judgment seat, whispers pass through the front rows
      const look = at([0.82, 1.5, -2.27]);
      const dist = 3.9 - 0.3 * H.easeInOut(u);
      return { pos: H.sph(look, Math.PI / 2 + 0.12 - 0.05 * u, 0.04, dist), look, fov: 30, focus: dist };
    }
    case 'S8': {
      // in front of Jesus: He stands perfectly still on the right, the crowd erupts behind Him; shake on the shout
      const look = at([J[0] - 16, 1.95, J[2] + 0.5]);
      let pos = at([J[0] + 6.0 - 0.25 * u, 1.22, J[2] + 0.5]);
      const sh = H.smooth(H.invLerp(E.shout - 0.05, E.shout + 0.05, t)) * Math.exp(-2.2 * Math.max(0, t - E.shout));
      const n = (s) => H.noise2(t * 22, s, 5);
      pos = H.add(pos, [n(1) * 0.07 * sh, n(2) * 0.07 * sh, n(3) * 0.09 * sh]);
      return { pos, look: H.add(look, [0, n(5) * 0.05 * sh, n(4) * 0.05 * sh]), roll: n(6) * 0.012 * sh, fov: 32, focus: 6.0 - 0.25 * u, locked: sh > 0.02 };
    }
    case 'S9': {
      // the world freezes and drains to dark: both men under spotlights, the name card above them; slow push-in
      const k = H.easeInOut(u);
      const look = at([J[0], H.lerp(2.35, 2.3, k), 0.0]);
      const dist = H.lerp(10.2, 9.0, k);
      return { pos: H.sph(look, Math.PI / 2, H.lerp(0.02, 0.03, k), dist), look, fov: 30, focus: dist - 0.1, locked: true };
    }
    case 'S10': {
      // the swap (slow motion): close on the shackles -> they fall -> the camera rises and pulls back east while
      // Barabbas walks toward it into the warm light and Jesus is led away west, toward the far hill
      const bp = Bk.barabbasAt(t, 'S10');
      const k = H.easeInOut(H.invLerp(E.shacklesLand - 0.2, E.shacklesLand + 4.8, t));
      const tilt = H.smooth(H.invLerp(E.shacklesFall - 0.1, E.shacklesLand + 0.1, t));
      const lookNear = at([B[0] + 0.02, H.lerp(1.0, 0.22, tilt), B[2] + 0.12]);
      const lookFar = at([6.4, 6.2, -59.5]);
      const look = H.mixv(lookNear, lookFar, k);
      const posNear = at([B[0] + 0.55, H.lerp(1.08, 0.66, tilt), B[2] + 1.6]);
      const posFar = at([3.4, 3.2, 15.5]);
      const pos = H.mixv(posNear, posFar, k);
      return { pos, look, fov: H.lerp(30, 30, k), focus: H.lerp(1.6, Math.hypot(bp[0] - 3.4, bp[2] - 15.5) + 0.3, k) };
    }
    case 'S12': {
      // outside the east gate: Barabbas walks out toward us, stops, turns back; rack focus to the far hill where a
      // tiny figure carries the beam up the path (far away only)
      const bp = Bk.barabbasAt(t, 'S12');
      const look = at([H.lerp(3.2, 3.0, u), H.lerp(3.1, 3.6, u), -120]);
      const pos = at([4.0, 1.66, 26.5 - 0.2 * u]);
      const near = Math.hypot(bp[0] - pos[0], bp[2] - pos[2]) + 0.1, far = 240;
      const rk = H.smooth(H.invLerp(E.rackFocus - 0.2, E.rackFocus + 1.1, t));
      return { pos, look, fov: 22, focus: near * Math.pow(far / near, rk) };
    }
    case 'S13': {
      // the hill under the storm; warm light breaks through the clouds above it (the 1 Peter 3:18 card above)
      const k = H.easeInOut(u);
      const hp = COURT.hill;
      const look = at([hp[0] - 2, COURT.hillTop + H.lerp(12, 14, k), hp[2]]);
      const pos = at([H.lerp(7, 7.5, k), H.lerp(9, 10, k), H.lerp(-112, -120, k)]);
      return { pos, look, fov: 34, focus: 98 };
    }
    case 'S14a': {
      // push-in on Barabbas's face at the gate (warm light) -> match cut on the same pose to the modern street
      const bp = Bk.barabbasAt(t, 'S14a');
      const look = at([bp[0], 1.62, bp[2] + 0.05]);
      const dist = H.lerp(2.6, 1.75, H.easeInOut(u));
      return { pos: H.sph(look, 0.42, 0.0, dist), look, fov: 30, focus: dist };
    }
    default: { const look = at([0, 1.5, 0]); return { pos: H.sph(look, Math.PI / 2, 0.1, 12), look, fov: 30 }; }
  }
}

// overlay label anchors (world points); the overlay calls anchorAt(plan, 'court', name, t)
export const anchors = {
  jesusHead: (plan, B, t, H) => H.at('court', [COURT.J[0], 1.86, COURT.J[2]]),
  barabbasHead: (plan, B, t, H) => H.at('court', [COURT.B[0], 1.93, COURT.B[2]]),
  crowd: (plan, B, t, H) => H.at('court', [-6, 2.2, 2]),
  pilateHead: (plan, B, t, H) => H.at('court', [COURT.seat[0], COURT.seat[1] + 1.42, COURT.seat[2]]),
  whisper: (plan, B, t, H) => H.at('court', [0.9, 1.92, -0.6]),
  hill: (plan, B, t, H) => H.at('court', [COURT.hill[0], COURT.hillTop + 2, COURT.hill[2]]),
};
