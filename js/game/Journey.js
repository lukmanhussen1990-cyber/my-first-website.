// The drive, scripted along the road's arc length: environment curves,
// roadside props, events and captions.

import { PropSchedule } from '../world/props.js';

export const JOURNEY = {
  start: 40,
  length: 11000,
  stopAt: 11050,
  clockStart: 13, // minutes past midnight
  clockRate: 6, // story minutes per real minute
};

// Environment keyframes over progress (0..1). Values are smoothly interpolated.
export const ENV = {
  fog: [[0, 0.0045], [0.15, 0.006], [0.3, 0.011], [0.45, 0.017], [0.6, 0.022], [0.76, 0.02], [0.86, 0.011], [1, 0.006]],
  rain: [[0, 0], [0.22, 0], [0.3, 0.16], [0.42, 0.3], [0.48, 0.6], [0.6, 0.5], [0.72, 0.85], [0.78, 1.0], [0.84, 0.55], [0.9, 0.15], [0.96, 0]],
  clouds: [[0, 0.25], [0.3, 0.5], [0.5, 0.9], [0.75, 1], [0.9, 0.55], [1, 0.4]],
  dread: [[0, 0], [0.2, 0.08], [0.4, 0.25], [0.5, 0.48], [0.62, 0.6], [0.72, 0.78], [0.8, 0.9], [0.86, 0.4], [0.95, 0.1], [1, 0]],
  insects: [[0, 1], [0.3, 0.8], [0.44, 0.45], [0.5, 0], [0.84, 0], [0.92, 0.7], [1, 0.8]],
  cruise: [[0, 22], [0.4, 21], [0.55, 18.5], [0.75, 17], [0.86, 20], [0.97, 15], [1, 0]],
  interference: [[0, 0], [0.38, 0], [0.42, 0.45], [0.5, 0.75], [0.6, 0.55], [0.72, 0.9], [0.84, 0.05], [1, 0]],
  town: [[0, 0.1], [0.8, 0.12], [0.9, 0.6], [1, 1]],
};

export const WITNESS_LIST = [
  { id: 'eyes', label: 'Eyes in the trees, too high off the ground' },
  { id: 'lights', label: 'Lights hanging over the ridge' },
  { id: 'car', label: 'An empty car, hazards still blinking' },
  { id: 'figure', label: 'Someone standing at the edge of the trees' },
  { id: 'fogshape', label: 'Something crossing inside the fog' },
  { id: 'runner', label: 'Something keeping pace between the trees' },
  { id: 'follow', label: 'Headlights behind us that never caught up' },
  { id: 'ghost', label: 'The seat beside you, in the mirror' },
  { id: 'sign', label: 'Hollow Pines, 14 miles. Again.' },
  { id: 'figure2', label: 'It was closer the second time. It was not alone.' },
];

// Story beats along the road (metres of arc length).
export const BEATS = [
  { s: 120, type: 'caption', text: 'The driver hasn’t said a word since you got in.' },
  { s: 520, type: 'oncoming', lead: 380 },
  { s: 640, type: 'caption', text: 'Forty-one miles of forest to Hollow Pines.' },
  { s: 1700, type: 'eyeshine' },
  { s: 2950, type: 'strangeLights' },
  { s: 3400, type: 'caption', text: 'The radio fades in and out between the hills.' },
  { s: 4250, type: 'abandonedCar', at: 4450 },
  { s: 5000, type: 'oncoming', lead: 420, late: true },
  { s: 5300, type: 'figure', at: 5520, d: -13.5 },
  { s: 5850, type: 'caption', text: 'No other cars for a long time now.' },
  { s: 6420, type: 'fogBank', at: 6640 },
  { s: 7000, type: 'runner' },
  { s: 7350, type: 'following' },
  { s: 7800, type: 'mirrorGhost' },
  { s: 7950, type: 'repeatSign', at: 8080 },
  { s: 8250, type: 'figure2', at: 8460 },
  { s: 8750, type: 'lightsDie' },
  { s: 9450, type: 'clockJump' },
  { s: 9500, type: 'caption', text: 'The clock on the dash says 02:41. That can’t be right.' },
  { s: 10050, type: 'caption', text: 'Lights, finally.' },
  { s: 10300, type: 'oncoming', lead: 360 },
  { s: 10850, type: 'arrive' },
];

/** Build every roadside prop for the journey (deterministic per seed). */
export function buildSchedule(seed = 1) {
  const S = new PropSchedule();
  const sign = (s, spec, d = 6.5, extra = {}) => S.add({ s, type: 'sign', d, params: { spec, ...extra } });
  // Crossroads where the car waits at the start.
  S.add({ s: 78, type: 'beacon', d: 7.2, id: 'beacon' });
  S.add({ s: 56, type: 'streetlight', d: -6.6 });
  S.add({ s: 128, type: 'streetlight', d: 6.6 });
  sign(170, { kind: 'green', lines: [['HOLLOW PINES', '41'], ['CEDAR FALLS', '58']] }, 6.8, { w: 2.6, h: 1.25 });
  sign(330, { kind: 'shield', text: '9' }, 6.2);
  sign(345, { kind: 'white', lines: ['SPEED', 'LIMIT', '55'] }, 6.3);
  sign(1180, { kind: 'diamond', symbol: 'curveLeft' }, 6.2);
  sign(1520, { kind: 'diamond', symbol: 'deer' }, 6.2);
  S.add({ s: 2160, type: 'cabin', d: -46, id: 'cabin1' });
  S.add({ s: 2700, type: 'poles', params: { count: 8, spacing: 46, d: 8.6 } });
  sign(3300, { kind: 'diamond', symbol: 'curveRight' }, 6.2);
  // A stretch of old sodium lamps, one failing.
  [3930, 4020, 4110, 4200].forEach((s, i) => S.add({
    s, type: 'streetlight', d: i % 2 ? -6.6 : 6.6, id: `old-${i}`,
    params: { flicker: i === 1 ? 'erratic' : 'none', intensity: 760 },
  }));
  sign(4700, { kind: 'white', lines: ['NO SERVICES', 'NEXT 38 MILES'] }, 6.4, { w: 1.6, h: 1.0 });
  S.add({ s: 4900, type: 'poles', params: { count: 6, spacing: 46, d: -8.4 } });
  sign(6100, { kind: 'green', lines: [['HOLLOW PINES', '14']] }, 6.8, { w: 2.4, h: 0.85 });
  sign(8080, { kind: 'green', lines: [['HOLLOW PINES', '14']] }, 6.8, { w: 2.4, h: 0.85 });
  // A row of lamps that will die one by one as the car approaches.
  for (let i = 0; i < 5; i++) {
    S.add({ s: 8820 + i * 80, type: 'streetlight', d: 6.6, id: `die-${i}`, params: { intensity: 820 } });
  }
  sign(9950, { kind: 'green', lines: [['WELCOME TO'], ['HOLLOW PINES']] }, 6.8, { w: 2.6, h: 1.25 });
  S.add({ s: 10180, type: 'cabin', d: -32 });
  S.add({ s: 10420, type: 'cabin', d: 30 });
  S.add({ s: 10520, type: 'cabin', d: -38 });
  [10600, 10700, 10800, 10900, 11000, 11120].forEach((s, i) => S.add({ s, type: 'streetlight', d: i % 2 ? -6.6 : 6.6 }));
  S.add({ s: 11060, type: 'station', d: 17, id: 'station' });
  void seed;
  return S;
}
