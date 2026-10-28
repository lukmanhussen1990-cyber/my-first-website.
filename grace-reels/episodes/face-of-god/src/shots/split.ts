// S12's split screen: Moses hidden in the dark cleft (left of the divider) and Jesus on the hillside in
// warm light (right). The hillside slides in from the right, holds half and half while "Moses had to
// hide in a rock to see God's back" is said, then takes the whole screen. Shared by the transition
// (Reel.tsx) and both cameras, which keep their subject centred in whatever part of the screen they have.
import {easeInOut, easeOut, seg} from '../lib/ease';
import {B} from '../lib/timeline';

export const SPLIT_IN = B.splitIn;
export const SPLIT_OUT = B.splitOut;
export const divider = (t: number) => 1.05 - 0.55 * seg(t, SPLIT_IN, SPLIT_IN + 0.55, easeOut) - 0.56 * seg(t, SPLIT_OUT - 0.8, SPLIT_OUT, easeInOut);
// the centre of each side's share of the screen, in NDC x (-1..1)
export const leftCentre = (t: number) => divider(t) - 1;
export const rightCentre = (t: number) => Math.min(1, divider(t));
