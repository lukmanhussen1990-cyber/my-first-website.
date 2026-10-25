import { idle, walk, kneel, sit, lookUp, HEAD_IN_HANDS, blinkAt } from './chars.js';
import { noise1, hash } from './util.js';

// Named actions built on the base pose functions. All pure functions of (t, seed, opts).
export const POSES = {
  stand: (t, s, o) => idle(t, s, o),
  lookUp: (t, s, o) => lookUp(t, s, o),
  walk: (t, s, o) => walk(t, s, o),

  phoneUp(t, s, o = {}) {
    const p = lookUp(t, s, { brow: 'awe', ...o });
    const j = (noise1(t * 0.8, s) - 0.5) * 0.08;
    p.armF = { sh: 2.45 + j, el: 0.35 }; p.phoneUp = 1;
    return p;
  },
  showHands(t, s, o = {}) {
    const p = idle(t, s, { brow: 'soft', ...o });
    const b = Math.sin(t * 1.1 + s) * 0.03;
    p.armF = { sh: 1.08 + b, el: 0.42 }; p.armB = { sh: 0.98 - b, el: 0.5 };
    p.palms = 1; p.lean = 0.04; p.head.tilt = -0.06;
    p.face.mouth = o.mouth ?? 'smile';
    return p;
  },
  crossArms(t, s, o = {}) {
    const p = idle(t, s, { brow: 'doubt', ...o });
    p.armF = { to: 'chest', off: [-2.5, -4.5], bend: -1 }; p.armB = { to: 'chest', off: [3.0, -3.0], bend: -1 };
    p.lean = -0.05; p.head.tilt = -0.08 + (noise1(t * 0.3, s) - 0.5) * 0.06;
    return p;
  },
  staffRaise(t, s, o = {}) {
    const p = idle(t, s, { brow: 'neutral', ...o });
    p.armF = { sh: 0.75, el: 0.75 }; p.armB = { sh: 1.5 + Math.sin(t * 0.8) * 0.06, el: 0.35 };
    p.head.tilt = 0.12;
    return p;
  },
  kneelFear(t, s, o = {}) {
    const p = kneel(t, s, { brow: 'fear', mouth: 'o', ...o });
    p.lean = 0.28; p.head.tilt = 0.32; p.look = [0.3, 1];
    p.armF = { sh: 1.9, el: 1.05 }; p.armB = { sh: 1.7, el: 1.2 };
    return p;
  },
  cower(t, s, o = {}) {
    const p = idle(t, s, { brow: 'fear', mouth: 'open', ...o });
    p.lean = -0.22; p.head.tilt = 0.18;
    p.armF = { sh: 2.0, el: 1.15 }; p.armB = { sh: 1.75, el: 1.3 };
    p.legF = { hip: 0.3, knee: 0.15 }; p.legB = { hip: -0.38, knee: 0.3 };
    return p;
  },
  point(t, s, o = {}) {
    const p = lookUp(t, s, { brow: 'awe', tilt: 0.35, ...o });
    p.armF = { sh: 2.15, el: 0.06 };
    return p;
  },
  reach(t, s, o = {}) {
    const p = idle(t, s, { brow: 'worried', ...o });
    p.armF = { sh: 1.42, el: 0.12 }; p.lean = 0.14;
    return p;
  },
  dance(t, s, o = {}) {
    const ph = t * 2 * Math.PI * (o.freq ?? 1.25) + hash(s) * 6.28;
    const p = idle(t, s, { brow: 'joy', mouth: hash(s + 1) < 0.5 ? 'open' : 'smile', ...o });
    p.armF = { sh: 2.65 + 0.28 * Math.sin(ph), el: 0.35 + 0.2 * Math.sin(ph * 2) };
    p.armB = { sh: 2.45 - 0.32 * Math.sin(ph), el: 0.4 };
    p.legF = { hip: 0.3 * Math.max(0, Math.sin(ph)), knee: 0.5 * Math.max(0, Math.sin(ph)) + 0.05 };
    p.legB = { hip: -0.25 * Math.max(0, -Math.sin(ph)), knee: 0.5 * Math.max(0, -Math.sin(ph)) + 0.05 };
    p.bob = Math.abs(Math.sin(ph)) * 1.6 - 0.8;
    p.head.tilt = 0.22 + 0.1 * Math.sin(ph + 1);
    p.lean = -0.06 + 0.06 * Math.sin(ph * 0.5);
    return p;
  },
  headInHands(t, s, o = {}) {
    const p = sit(t, s, { seat: o.seat ?? 25, ...o });
    HEAD_IN_HANDS(p);
    p.lean += Math.sin(t * 1.4) * 0.015; // slow, heavy breathing
    return p;
  },
  liftHead(t, s, o = {}) { // seated, looking up into the light, hands resting on knees
    const p = sit(t, s, { seat: o.seat ?? 25, brow: 'awe', ...o });
    p.lean = 0.14; p.head.tilt = 0.5; p.look = [0.2, 1];
    p.armF = { sh: 0.95, el: 0.45 }; p.armB = { sh: 0.85, el: 0.55 };
    p.face.mouth = o.mouth ?? null;
    return p;
  },
  puppet(t, s, o = {}) { // kneeling, wrists hauled up by strings, head hanging
    const p = kneel(t, s, { brow: 'fear', ...o });
    const j = (noise1(t * 2.2, s) - 0.5);
    p.armF = { sh: 2.78 + j * 0.12, el: 0.18 }; p.armB = { sh: 2.6 - j * 0.1, el: 0.28 };
    p.head.tilt = -0.3 + j * 0.08; p.lean = 0.06;
    p.face.mouth = o.mouth ?? 'o';
    return p;
  },
  pray(t, s, o = {}) {
    const p = kneel(t, s, { brow: 'soft', ...o });
    p.armF = { to: 'chest', off: [7.5, 4], bend: 1 }; p.armB = { to: 'chest', off: [6.8, 4.5], bend: 1 };
    p.head.tilt = -0.18; p.face.blink = 1; p.lean = 0.1;
    return p;
  },
  holdHand(t, s, o = {}) {
    const p = lookUp(t, s, { brow: 'worried', tilt: 0.4, ...o });
    p.armB = { sh: 0.45, el: -0.05 };
    return p;
  },
  thomasKneel(t, s, o = {}) { // fallen to his knees, looking up at Jesus, hands open
    const p = kneel(t, s, { brow: 'awe', ...o });
    p.lean = 0.18; p.head.tilt = 0.32; p.look = [0.4, 0.8];
    p.armF = { sh: 1.25, el: 0.65 }; p.armB = { sh: 1.1, el: 0.7 };
    p.face.mouth = o.mouth ?? 'o';
    return p;
  },
  standAfar(t, s, o = {}) { // shrinking back: weight on back foot, arm raised to shield eyes
    const p = idle(t, s, { brow: 'fear', ...o });
    p.lean = -0.16; p.head.tilt = 0.22;
    p.armF = { sh: 2.2, el: 1.35 };
    p.legF = { hip: 0.22, knee: 0.1 }; p.legB = { hip: -0.26, knee: 0.18 };
    return p;
  },
};
export { blinkAt };
