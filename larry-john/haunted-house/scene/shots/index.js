// All shots of the reel, in order. Each shot: {id, beat, at (start time, s), look, frame(ctx), sfx, labels, blur}.
import { shots01_04 } from './b01_04.js';
import { shots05_10 } from './b05_10.js';

export function buildShots(T, W) {
  return [
    ...shots01_04(T, W),
    ...shots05_10(T, W),
  ];
}
