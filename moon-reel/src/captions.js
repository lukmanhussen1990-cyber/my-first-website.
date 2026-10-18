import { C } from './core/overlay.js';

// All on-screen captions. Times come from events.json so audio hits stay in sync.
export function buildCaptions(E) {
  return [
    {
      t0: E.hook_line1,
      t1: 3.86,
      y: 385,
      out: 'zoom',
      outDur: 0.24,
      lines: [
        { parts: [['WHAT IF THE ', C.white], ['MOON', C.yellow]], size: 80, anim: 'pop', stagger: 0.07 },
        { parts: [['DISAPPEARED?', C.red]], size: 122, at: E.hook_line2 - E.hook_line1, anim: 'slam', glow: 0.55 },
      ],
      maxWidth: 980,
    },
    {
      t0: E.gone_text,
      t1: E.s2_dive + 0.12,
      y: 385,
      out: 'zoom',
      lines: [
        { parts: [['THE ', C.white], ['MOON', C.yellow], [' IS', C.white]], size: 92, anim: 'pop', stagger: 0.06 },
        { parts: [['GONE!', C.red]], size: 196, at: 0.34, anim: 'slam', glow: 0.5 },
      ],
    },
    {
      t0: E.nights_text,
      t1: E.s3_exit + 0.1,
      y: 365,
      out: 'up',
      lines: [
        { parts: [['NIGHTS BECOME', C.white]], size: 90, anim: 'pop', stagger: 0.07 },
        { parts: [['DARKER', C.yellow]], size: 178, at: 0.34, anim: 'slam', glow: 0.35 },
      ],
    },
    {
      t0: E.tides_text,
      t1: E.s5_start - 0.12,
      y: 370,
      out: 'up',
      lines: [
        { parts: [['EARTH\u2019S ', C.white], ['TIDES', C.yellow]], size: 98, anim: 'pop', stagger: 0.07 },
        { parts: [['BECOME ', C.white], ['WEAKER', C.yellow]], size: 98, at: 0.28, anim: 'pop', stagger: 0.07 },
      ],
    },
    {
      t0: E.wild_text,
      t1: E.s6_start - 0.12,
      y: 365,
      out: 'up',
      lines: [
        { parts: [['WILDLIFE LOSES AN', C.white]], size: 78, anim: 'pop', stagger: 0.06 },
        { parts: [['IMPORTANT ', C.white], ['NATURAL CUE', C.yellow]], size: 78, at: 0.3, anim: 'pop', stagger: 0.06 },
      ],
      maxWidth: 960,
    },
    {
      t0: E.rot_text,
      t1: E.s7_start - 0.12,
      y: 365,
      out: 'up',
      lines: [
        { parts: [['EARTH\u2019S ', C.white], ['ROTATION', C.yellow]], size: 92, anim: 'pop', stagger: 0.07 },
        { parts: [['COULD CHANGE', C.white]], size: 104, at: 0.3, anim: 'pop', stagger: 0.07 },
      ],
    },
    {
      t0: E.flyaway_text,
      t1: E.orbit_text - 0.2,
      y: 380,
      out: 'zoom',
      lines: [
        { parts: [['BUT EARTH WON\u2019T', C.white]], size: 92, anim: 'pop', stagger: 0.07 },
        { parts: [['FLY AWAY!', C.red]], size: 168, at: 0.4, anim: 'slam', glow: 0.45 },
      ],
    },
    {
      t0: E.orbit_text,
      t1: E.s8_start - 0.1,
      y: 380,
      out: 'up',
      lines: [
        { parts: [['EARTH WILL KEEP', C.white]], size: 92, anim: 'pop', stagger: 0.07 },
        { parts: [['ORBITING THE SUN', C.green]], size: 104, at: 0.32, anim: 'slam', glow: 0.4 },
      ],
    },
    {
      t0: E.final_text,
      t1: E.end + 1,
      y: 400,
      out: 'fade',
      lines: [
        { parts: [['WOULD YOU', C.white]], size: 104, anim: 'pop', stagger: 0.09 },
        { parts: [['MISS THE ', C.yellow], ['MOON?', C.yellow]], size: 124, at: 0.42, anim: 'slam', glow: 0.5 },
      ],
    },
  ];
}
