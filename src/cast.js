// Every recurring character, defined once so they stay consistent across scenes.
import { Person, SKIN, HAIR, CLOTH } from './characters.js';
import { mulberry32 } from './util.js';

export const BEARD_GREY = '#a7a197';
export const BEARD_WHITE = '#f1ede4';

export const CAST = {
  noah: { seed: 11, height: 1.8, skin: '#a86a3c', hair: 'bald', hairColor: BEARD_GREY, beard: 'long', beardColor: BEARD_GREY,
    outfit: 'tunic', hem: 0.42, cloth: '#7a5232', belt: '#cdb07a', sleeve: '#6a4628', prop: 'hammer', age: 'old', build: 1.08 },
  wife: { seed: 12, height: 1.64, skin: '#b07444', hair: 'veil', hairColor: '#6a5a4a', wrap: CLOTH.rose, outfit: 'robe', cloth: CLOTH.olive, belt: '#d7b484', female: true },
  shem: { seed: 13, height: 1.78, skin: '#9a5e34', hair: 'short', hairColor: HAIR.black, beard: 'short', beardColor: HAIR.black, outfit: 'tunic', cloth: CLOTH.slate, belt: '#d7b484' },
  ham: { seed: 14, height: 1.8, skin: '#6e4428', hair: 'curly', hairColor: HAIR.black, beard: 'short', beardColor: HAIR.black, outfit: 'tunic', cloth: CLOTH.rust, belt: '#e2c79a' },
  japheth: { seed: 15, height: 1.76, skin: '#c08350', hair: 'short', hairColor: HAIR.brown, beard: 'short', beardColor: HAIR.brown, outfit: 'tunic', cloth: CLOTH.teal, belt: '#d7b484' },
  shemWife: { seed: 16, height: 1.62, skin: '#a86a3c', hair: 'veil', hairColor: HAIR.black, wrap: CLOTH.cream, outfit: 'robe', cloth: CLOTH.plum, belt: '#d7b484', female: true },
  hamWife: { seed: 17, height: 1.63, skin: '#7a4a2a', hair: 'veil', hairColor: HAIR.black, wrap: CLOTH.ochre, outfit: 'robe', cloth: CLOTH.wine, belt: '#e2c79a', female: true },
  japhethWife: { seed: 18, height: 1.6, skin: '#d29e6e', hair: 'long', hairColor: HAIR.auburn, outfit: 'robe', cloth: CLOTH.sand, belt: '#9b3d1f', female: true },
  // S17 — the young woman who stops at the door
  seeker: { seed: 31, height: 1.66, skin: '#b07444', hair: 'long', hairColor: '#3a281c', outfit: 'modern', hem: 0.72, cloth: '#c46a3a', legs: '#2b2f3a', shoes: '#efe6da', prop: 'phone', female: true, jacketLine: true },
};

export const FAMILY = ['noah', 'wife', 'shem', 'ham', 'japheth', 'shemWife', 'hamWife', 'japhethWife'];

export function make(name, extra = {}) { return new Person({ ...CAST[name], ...extra }); }

// Mocking townspeople: richly dressed, cups, sashes, children copying adults
const RICH = [CLOTH.wine, CLOTH.gold, CLOTH.indigo, CLOTH.plum, CLOTH.brick, CLOTH.teal, CLOTH.ochre, CLOTH.cream, CLOTH.rose, CLOTH.moss];
const SASH = ['#d9b45a', '#e7dcc4', '#9b3d1f', '#3e4a78', '#c99a3a'];
export function crowdPerson(i, opts = {}) {
  const r = mulberry32(1000 + i * 31);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const kid = opts.kid ?? (i % 6 === 5);
  const female = opts.female ?? (r() < 0.45);
  const hairPool = female ? ['long', 'bun', 'veil', 'wrap'] : ['short', 'curly', 'wrap', 'bald', 'short'];
  const hair = pick(hairPool);
  const old = !kid && r() < 0.18;
  const o = {
    seed: 200 + i,
    height: kid ? 1.12 + r() * 0.15 : (female ? 1.58 : 1.7) + r() * 0.14,
    skin: pick(SKIN), hair, hairColor: old ? HAIR.grey : pick([HAIR.black, HAIR.black, HAIR.brown, HAIR.auburn, HAIR.blonde]),
    wrap: pick([CLOTH.cream, CLOTH.ochre, CLOTH.wine, CLOTH.indigo, CLOTH.sand]),
    beard: !female && !kid && r() < 0.5 ? (old ? 'long' : 'short') : 'none',
    outfit: female ? 'robe' : (kid ? 'tunic' : pick(['robe', 'tunic', 'tunic'])),
    cloth: pick(RICH), belt: pick(['#d7b484', '#c99a3a', '#e7dcc4', '#9b3d1f']),
    sash: !kid && r() < 0.4 ? pick(SASH) : null,
    prop: kid ? null : (r() < 0.35 ? 'cup' : null),
    kid, female, build: kid ? 0.95 : 0.95 + r() * 0.15,
  };
  o.beardColor = o.hairColor;
  if (old) o.age = 'old';
  return new Person({ ...o, ...opts });
}

// Modern commuters (S17)
const JACKET = ['#3a3a40', '#3d5778', '#c99a3a', '#56693a', '#7a4a62', '#8f8678', '#9b3d1f', '#2f4a4a'];
const PANTS = ['#2b2f3a', '#3d5778', '#4a4036', '#1f2228', '#6b6252'];
export function commuter(i, opts = {}) {
  const r = mulberry32(5000 + i * 17);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const female = r() < 0.5;
  const o = {
    seed: 600 + i, height: (female ? 1.6 : 1.72) + r() * 0.12, skin: pick(SKIN),
    hair: female ? pick(['long', 'bun', 'short']) : pick(['short', 'curly', 'cap', 'short']),
    hairColor: pick([HAIR.black, HAIR.brown, HAIR.blonde, HAIR.black]), wrap: pick(['#2a2a30', '#9b3d1f', '#3d5778']),
    beard: !female && r() < 0.3 ? 'short' : 'none',
    outfit: 'modern', hem: 0.7 + r() * 0.12, cloth: pick(JACKET), legs: pick(PANTS), shoes: pick(['#1c1c1c', '#efe6da', '#5a3a22']),
    prop: r() < 0.8 ? 'phone' : 'bag', jacketLine: r() < 0.6, belt: null, female,
  };
  o.beardColor = o.hairColor;
  return new Person({ ...o, ...opts });
}
