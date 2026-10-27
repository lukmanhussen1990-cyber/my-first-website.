// All shots of the reel, in order. Each shot: {id, beat, at (start time, s), look, frame(ctx), sfx, labels, blur}.
import { shots01_04 } from './b01_04.js';
import { shots05_10 } from './b05_10.js';
import { shots11_13 } from './b11_13.js';
import { shots14_18 } from './b14_18.js';
import { shots19_26 } from './b19_26.js';

export function buildShots(T, W) {
  return [
    ...shots01_04(T, W),
    ...shots05_10(T, W),
    ...shots11_13(T, W),
    ...shots14_18(T, W),
    ...shots19_26(T, W),
  ];
}
