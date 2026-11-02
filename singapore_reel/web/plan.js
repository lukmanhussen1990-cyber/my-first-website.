// Shot plan (times in seconds, from the user's voiceover). Hard cuts between shots.
// `say` = what the voice says; the picture must show it. `events` = sync points for sound + animation.
export const PLAN = [
  { id: 's01', t0: 0.00, t1: 1.95, say: 'You just pooped in the street.', desc: 'YOU frozen on the spotless street, poop at his sneakers', events: { pop: 0.62 } },
  { id: 's02', t0: 1.95, t1: 3.20, say: 'In Singapore.', desc: 'wide establishing street shot, YOU small in the middle' },
  { id: 's03', t0: 3.20, t1: 4.45, say: 'One of the cleanest…', desc: 'cleaning robot polishing the spotless sidewalk', events: { ding: 3.92 } },
  { id: 's04', t0: 4.45, t1: 5.75, say: '…cities in the world.', desc: 'aerial view of the gleaming skyline by the water' },
  { id: 's05', t0: 5.75, t1: 7.25, say: 'The street is so clean…', desc: 'low camera along the mirror pavement, no-littering sign' },
  { id: 's06', t0: 7.25, t1: 8.45, say: '…it shines.', desc: 'close-up of the poop on the mirror pavement, sparkles everywhere except the poop', events: { ding: 7.45 } },
  { id: 's07', t0: 8.45, t1: 10.30, say: 'So, everyone notices.', desc: 'pedestrians all turn their heads', events: { punch: 9.45 } },
  { id: 's08', t0: 10.30, t1: 11.50, say: 'A man stops.', desc: 'office man frozen mid-step, coffee splashes', events: { splash: 10.62 } },
  { id: 's09', t0: 11.50, t1: 13.30, say: 'A lady drops her shopping bag.', desc: 'bag falls in slow motion, oranges roll', events: { drop: 12.62, roll: 12.916 } },
  { id: 's10', t0: 13.30, t1: 14.70, say: 'A kid points.', desc: 'kid points, huge open mouth', events: { punch: 13.9 } },
  { id: 's11', t0: 14.70, t1: 16.55, say: 'Then you hear footsteps.', desc: 'YOU close-up, turns his head, sweat', events: { step: [15.7, 16.25] } },
  { id: 's12', t0: 16.55, t1: 18.05, say: 'Heavy footsteps.', desc: 'ground-level boots stepping on the mirror pavement', events: { step: [16.55, 17.0, 17.45, 17.9] } },
  { id: 's13', t0: 18.05, t1: 19.30, say: 'An officer.', desc: 'low angle, slow tilt up from boots to his serious face', events: { boom: 18.2, plant: 18.3 } },
  { id: 's14', t0: 19.30, t1: 20.40, say: 'He looks at it.', desc: 'officer close-up looking down', events: { sting: 19.46 } },
  { id: 's15', t0: 20.40, t1: 21.60, say: 'He looks at you.', desc: 'officer eyes straight into camera', events: { sting: 20.55 } },
  { id: 's16', t0: 21.60, t1: 23.30, say: 'He pulls out a notebook.', desc: 'hands pull a notebook from the chest pocket', events: { flap: 22.3 } },
  { id: 's17', t0: 23.30, t1: 24.70, say: "What you don't know:", desc: 'dramatic close-up of YOU, vignette', events: { dun: 23.32 } },
  { id: 's18', t0: 24.70, t1: 26.60, say: 'in Singapore, you can get fined…', desc: 'spotless public toilet, red warning light' },
  { id: 's19', t0: 26.60, t1: 28.70, say: '…just for not flushing a public toilet.', desc: 'flush button + red warning triangle', events: { beep: [26.75, 27.3, 27.85, 28.4] } },
  { id: 's20', t0: 28.70, t1: 30.70, say: 'Just for not flushing.', desc: 'red siren light spinning above the stall' },
  { id: 's21', t0: 30.70, t1: 32.60, say: "And you didn't even use a toilet.", desc: 'back on the street: the poop, stink lines, YOU hands on head', events: { scratch: 30.72 } },
  { id: 's22', t0: 32.60, t1: 33.90, say: 'He starts writing.', desc: 'pen scribbling in the notebook', events: { scribble: [32.85, 33.85] } },
  { id: 's23', t0: 33.90, t1: 35.05, say: 'And writing.', desc: 'writing super fast, pages flying', events: { scribble: [33.95, 35.0] } },
  { id: 's24', t0: 35.05, t1: 36.65, say: 'The receipt starts printing.', desc: 'handheld printer, receipt comes out', events: { print: 35.3 } },
  { id: 's25', t0: 36.65, t1: 38.15, say: "It's still printing.", desc: 'receipt hangs to his knees, YOU in shock' },
  { id: 's26', t0: 38.15, t1: 39.55, say: 'It touches the ground.', desc: 'receipt piles in loops on the pavement' },
  { id: 's27', t0: 39.55, t1: 41.10, say: 'It rolls down the street.', desc: 'receipt unrolls down the road past cars and a bus', events: { horn: 40.1 } },
  { id: 's28', t0: 41.10, t1: 42.80, say: 'It reaches the airport.', desc: 'receipt end on the runway, stops at the plane nose wheel', events: { arrive: 42.29 } },
  { id: 's29', t0: 42.80, t1: 46.00, say: 'Enjoy your trip to Singapore.', desc: 'sunset skyline, receipt ribbon across the city, plane takes off, stink lines', events: { takeoff: 42.9, ding: 45.15 } },
];

export function shotAt(t) {
  for (const s of PLAN) if (t >= s.t0 && t < s.t1) return s;
  return PLAN[PLAN.length - 1];
}
