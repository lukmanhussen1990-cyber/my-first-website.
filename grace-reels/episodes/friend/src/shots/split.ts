// S12's split screen: the warm room (left of the divider) slides in beside the night garden (right),
// holds half and half, grows as "He washes the feet" is said, and fills the screen just before
// "enemies". Shared by the transition (Reel.tsx) and the room camera, which keeps its subject centred
// in whatever part of the screen it has.
import {easeInOut, easeOut, seg} from '../lib/ease';
import {B} from '../lib/timeline';

export const SPLIT_IN = B.s12;
export const SPLIT_OUT = B.s13 - 0.3;
export const divider = (t: number) => {
	const slide = seg(t, SPLIT_IN, SPLIT_IN + 0.55, easeOut);
	const grow = seg(t, B.warmTakesOver - 0.3, B.warmTakesOver + 0.4, easeInOut);
	const fill = seg(t, SPLIT_OUT - 1.0, SPLIT_OUT, easeInOut);
	return -0.05 + 0.55 * slide + 0.22 * grow + 0.33 * fill;
};
