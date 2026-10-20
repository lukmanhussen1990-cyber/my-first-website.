// Character performances: pure functions of time -> pose parameters.
import { clamp, lerp, smoothstep } from './lib/util.js';

const win = (t, a, b, ramp = 0.25) => smoothstep(a - ramp, a, t) * (1 - smoothstep(b, b + ramp, t));
// Deterministic blinks at a few moments (quick close/open).
function blinkAt(t, times) {
  let b = 0;
  for (const bt of times) { const d = Math.abs(t - bt); if (d < 0.09) b = Math.max(b, 1 - d / 0.09); }
  return b;
}

export function makeJohnActing(TL, words) {
  const E = TL.events;
  const blinks = [1.2, 3.6, 7.1, 9.9, 13.2, 16.9, 20.4, 22.1, 25.0, 31.5, 33.6, 39.6, 43.6, 49.6, 53.2, 55.45];
  // mouth flaps for John's line from its word timings (absolute times)
  const j1 = words?.j1 || [];
  const talkAt = (t) => {
    let v = 0;
    for (const w of j1) {
      if (t >= w.start - 0.02 && t <= w.end + 0.04) {
        const u = (t - w.start) / Math.max(0.08, w.end - w.start);
        const syl = Math.max(1, Math.round((w.end - w.start) / 0.17));
        v = Math.max(v, Math.abs(Math.sin(u * Math.PI * syl)) * 0.85 + 0.1);
      }
    }
    return v;
  };
  return (t) => {
    const p = { time: t, blink: blinkAt(t, blinks), smile: 1, brow: 0, armL: [1.25, -0.25, -1.15], armR: [1.25, 0.25, -1.15] };
    // happy head bob in the yard
    p.headNod = 0.06 * Math.sin(t * 2.2) * win(t, 0, 4.1);
    // tipping in: surprised
    const fall = win(t, E.car_roll + 0.3, E.car_land + 0.8, 0.2);
    p.brow += fall * 1; p.talk = fall * 0.55; p.smile = 1 - fall * 0.6;
    // spinning tyres: gripping, shaking, determined
    const spin = win(t, E.spin_start, E.spin_end, 0.2);
    p.headNod = (p.headNod || 0) + spin * 0.05 * Math.sin(t * 60);
    p.brow -= spin * 0.6;
    // drill snap: delighted
    const drillJoy = win(t, E.drill_snap, E.drill_go + 0.8, 0.2);
    p.brow += drillJoy * 0.9; p.smile += drillJoy * 0.35;
    // tunnel crumbling: worried glance back
    const worry = win(t, E.crumble_start, E.rings_start + 0.3, 0.3);
    p.brow -= worry * 0.9; p.lookSide = -worry * 0.5; p.headTurn = -worry * 0.25; p.smile -= worry * 0.4;
    // heat: sweating, red cheeks, panting
    const heat = win(t, E.sweat - 0.5, E.frost + 0.6, 0.6);
    p.sweat = heat; p.blush = heat * 0.85; p.brow -= heat * 0.7;
    p.talk = Math.max(p.talk, heat * (0.25 + 0.15 * Math.sin(t * 9)));
    p.smile -= heat * 0.5;
    // half-turns toward the window (and the camera) while he cooks
    const facing = win(t, E.sweat - 0.6, E.thumbs_up + 1.2, 0.4);
    p.headTurn = (p.headTurn || 0) + facing * 0.22; p.lookSide = (p.lookSide || 0) + facing * 0.18;
    // thumbs up: near (left) arm raised toward the window
    const thumbs = win(t, E.thumbs_up, E.thumbs_up + 1.05, 0.2);
    if (thumbs > 0) {
      // near hand up by the window, forearm toward the roof, thumb up; looks at us
      // fist beside his face (to the right on screen), forearm up, thumb straight up
      p.armL = [lerp(1.25, 2.53, thumbs), lerp(-0.25, -0.34, thumbs), lerp(-1.15, 1.31, thumbs)];
      p.handL = [0, 0, 2.44 * thumbs]; p.thumbL = 0;
      p.headTurn = (p.headTurn || 0) + thumbs * 0.3; p.lookSide = (p.lookSide || 0) + thumbs * 0.12;
      p.smile += thumbs * 0.8; p.brow += thumbs * 0.6; p.talk = Math.max(0, p.talk - thumbs);
      p.sweat = Math.max(0, p.sweat - thumbs);
    }
    // core: wide-eyed, then the thruster blast
    const awe = win(t, E.core_reveal + 0.5, E.thrusters, 0.4);
    p.brow += awe * 0.8; p.talk = Math.max(p.talk, awe * 0.35);
    const blast = win(t, E.thrusters, E.zoom_end + 0.6, 0.1);
    p.talk = Math.max(p.talk, blast * 0.9); p.brow += blast * 1.0; p.bodyLean = -blast * 0.12;
    // hologram: look at it, tap it with the far (right) hand
    const holo = win(t, E.holo_pop, E.beach_lock + 1.2, 0.3);
    p.lookUp = (p.lookUp || 0) - holo * 0.12; p.headNod = (p.headNod || 0) - holo * 0.05;
    p.headTurn = (p.headTurn || 0) + holo * 0.22;
    // leans in and taps the globe with the near hand
    const tap = win(t, E.holo_tap - 0.4, E.holo_tap + 0.3, 0.22);
    const poke = Math.exp(-Math.pow((t - E.holo_tap) / 0.09, 2));
    if (tap > 0) {
      p.armL = [lerp(1.25, 2.2, tap), lerp(-0.25, 0.585, tap), lerp(-1.15, 0.45 - 0.27 * poke, tap)];
      p.bodyLean = (p.bodyLean || 0) - 0.2 * tap;
    }
    const lock = win(t, E.beach_lock, E.surface_rise, 0.25);
    p.smile += lock * 0.5; p.brow += lock * 0.4;
    // burst out: whoa
    const whoa = win(t, E.sand_bulge, E.land + 0.3, 0.2);
    p.talk = Math.max(p.talk, whoa * 0.8); p.brow += whoa;
    // landed: dizzy, leans out of the door, goggles crooked, asks his question
    const dizzy = smoothstep(E.land + 0.2, E.land + 1.2, t);
    p.dizzy = dizzy; p.eyeRoll = dizzy * 0.5 * Math.sin(t * 3.0); p.lookSide = (p.lookSide || 0) + dizzy * 0.2 * Math.cos(t * 3.0);
    p.goggleSlip = dizzy * 0.38; p.goggleTilt = dizzy * 0.22;
    const lean = smoothstep(E.door_open + 0.25, E.john_lean + 0.5, t);
    // turn toward the open door (car -z), lean out and forward, look at the tourist (to his right)
    // turn toward the open door and lean into the opening (head clear of the raised door)
    p.bodyTurn = lean * 1.0; p.bodyRoll = -lean * 0.45; p.bodyZ = -lean * 0.18; p.bodyX = 0; p.bodyY = lean * 0.05;
    p.bodyLean = (p.bodyLean || 0) + lean * 0.05;
    p.headTurn = (p.headTurn || 0) - lean * 0.12;
    p.lookSide = (p.lookSide || 0) - lean * 0.35;
    if (lean > 0) p.armL = [lerp(p.armL[0], 0.6, lean), lerp(p.armL[1], -0.9, lean), lerp(p.armL[2], -0.5, lean)];
    p.smile = lerp(p.smile, 0.85, dizzy);
    const talk = talkAt(t);
    if (t > E.john_talk - 0.3) p.talk = talk;
    if (t > E.land) p.brow = lerp(p.brow, 0.35, dizzy);
    p.smile = clamp(p.smile, 0.3, 1.6); p.brow = clamp(p.brow, -1, 1);
    return p;
  };
}

export function makeTouristActing(TL) {
  const E = TL.events;
  const blinks = [45.6, 47.0, 50.2, 52.9, 54.6, 55.35];
  return (t) => {
    const p = { blink: blinkAt(t, blinks), eyeWide: 1, surprise: 0, brow: 0 };
    // licking the ice cream before the car appears
    const lick = 0.5 + 0.5 * Math.sin((t - 45) * 2.4);
    const calm = 1 - smoothstep(E.burst - 0.1, E.burst + 0.1, t);
    p.headTilt = -0.12 * lick * calm; p.headNod = -0.1 * lick * calm;
    p.armR = [1.9 + 0.15 * lick * calm, 0.25, -2.0];
    // startled by the burst: jump, wide eyes, hat hops
    const jolt = smoothstep(E.burst, E.burst + 0.15, t);
    p.eyeWide = 1 + 0.3 * jolt; p.surprise = jolt; p.brow = jolt;
    p.hatHop = 0.12 * Math.max(0, Math.sin(clamp((t - E.burst) / 0.45) * Math.PI));
    p.hatLift = 0.15 * Math.max(0, Math.sin(clamp((t - E.burst) / 0.5) * Math.PI));
    // follows the flying car with her eyes
    const follow = smoothstep(E.burst, E.burst + 0.3, t) * (1 - smoothstep(E.land, E.land + 0.4, t));
    p.lookUp = follow * 0.45; p.headNod = (p.headNod || 0) + follow * 0.25; p.lean = -follow * 0.06;
    // scoop falls: the arm jerks, then she looks down at the empty cone
    const jerk = Math.max(0, Math.sin(clamp((t - E.scoop_fall + 0.05) / 0.3) * Math.PI));
    p.armR = [p.armR[0] - jerk * 0.25, p.armR[1], p.armR[2] + jerk * 0.3];
    const look = smoothstep(E.plop - 0.1, E.plop + 0.3, t) * (1 - smoothstep(E.door_open - 0.3, E.door_open + 0.2, t));
    p.headNod = (p.headNod || 0) - look * 0.35; p.lookUp = (p.lookUp || 0) - look * 0.4;
    // then turns to John
    const watch = smoothstep(E.door_open - 0.2, E.door_open + 0.4, t);
    p.headTurn = watch * 0.35; p.lookSide = watch * 0.25;
    p.surprise = Math.max(0, p.surprise - watch * 0.6);
    return p;
  };
}
