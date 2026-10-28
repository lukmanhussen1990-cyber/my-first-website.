import type {Look, Pose} from '../../../src/shared/rig/paperdoll';

// Character bible, drawn in code.
// Daniel: kind calm face, rich deep-blue robe with gold trim, a simple gold sash. The same robe
// at every age (S7); only the hair and beard change. Old Daniel has a short white beard.
const DANIEL_BASE: Omit<Look, 'hair' | 'hairStyle'> = {
	skin: '#A86F47',
	robe: '#1F3A78',
	sleeves: 'long',
	trim: '#D9A441',
	sash: '#C9962F',
	sandals: '#5E3D24',
	build: 1.0,
};
export const DANIEL_OLD: Look = {...DANIEL_BASE, hair: '#ECE7DE', hairStyle: 'short', beard: 'short', beardColor: '#F3EFE7', brow: '#D9D2C6'};
export const DANIEL_MID: Look = {...DANIEL_BASE, hair: '#3B2A1E', hairStyle: 'short', beard: 'short', beardColor: '#4A3A2E', grey: 0.45};
export const DANIEL_YOUNG: Look = {...DANIEL_BASE, hair: '#2A1B12', hairStyle: 'short', beard: 'short', beardColor: '#2E2016', build: 0.94};

// King Darius: purple and gold, a tall crown, dignified
export const DARIUS: Look = {
	skin: '#9C6540',
	hair: '#22160E',
	hairStyle: 'short',
	beard: 'full',
	beardColor: '#1E140D',
	head: 'crown',
	headColor: '#D8A64A',
	robe: '#5B2A6E',
	sleeves: 'long',
	trim: '#E0B04E',
	sash: '#D8A64A',
	build: 1.12,
};

// The other two leaders over the princes (generic court men)
export const LEADERS: Look[] = [
	{skin: '#94603C', hair: '#2A1B11', hairStyle: 'short', beard: 'full', robe: '#8A3B32', sleeves: 'long', trim: '#C9A04E', head: 'wrap', headColor: '#E2D2A8', build: 1.05},
	{skin: '#B07A52', hair: '#33231A', hairStyle: 'short', beard: 'short', robe: '#2F6A64', sleeves: 'long', trim: '#C9A04E', head: 'wrap', headColor: '#C89A3A', build: 0.98},
];

// Princes and officials: generic court men in colourful robes; no symbols of any real group
export const PRINCES: Look[] = [
	{skin: '#9C653F', hair: '#2A1B11', hairStyle: 'short', beard: 'full', robe: '#B5543A', sleeves: 'long', sash: '#7A3A28', head: 'wrap', headColor: '#E2D2A8', build: 1.08},
	{skin: '#B3794F', hair: '#33231A', hairStyle: 'short', beard: 'short', robe: '#C89A3A', sleeves: 'long', sash: '#7A5A2A', build: 0.95},
	{skin: '#83512F', hair: '#22160E', hairStyle: 'short', beard: 'short', robe: '#3F7F7A', sleeves: 'long', sash: '#2C5652', head: 'wrap', headColor: '#C89A3A', build: 1.0},
	{skin: '#A76B43', hair: '#3B2A1E', hairStyle: 'bald', grey: 1, beard: 'full', beardColor: '#8E877F', robe: '#6E4562', sleeves: 'long', sash: '#C9A46A', build: 1.15},
	{skin: '#9E6942', hair: '#291A10', hairStyle: 'short', beard: 'full', robe: '#B9733E', sleeves: 'long', sash: '#6E4426', head: 'wrap', headColor: '#3F7F7A', build: 0.92},
	{skin: '#8C5734', hair: '#2E1E14', hairStyle: 'short', beard: 'short', robe: '#4E6A8E', sleeves: 'long', sash: '#C9A46A', head: 'cloth', headColor: '#D9C9A0', build: 1.02},
];
// the jealous officials (S5): same court dress, narrowed eyes when they whisper
export const OFFICIALS: Look[] = [PRINCES[0], PRINCES[3], PRINCES[4]];

// A young adult in a grey hoodie and jeans
export const MODERN: Look = {
	skin: '#8A573A',
	hair: '#20150E',
	hairStyle: 'curly',
	beard: 'none',
	outfit: 'hoodie',
	robe: '#8C9096',
	pants: '#35557E',
	shoes: '#F1EEE6',
	build: 0.95,
};

// ---- poses ----
export const P = {
	stand: {near: {sh: 0.1, el: 0.16}, far: {sh: -0.06, el: 0.2}} as Pose,
	// kneeling at the window, hands raised gently, face lifted
	pray: {kneel: 1, near: {sh: 0.5, el: 1.95, hand: 'open', wrist: -0.85}, far: {sh: 0.42, el: 2.0, hand: 'open', wrist: -0.8}, headTilt: -0.12, gaze: [0.4, -0.35], eyes: 'closed'} as Pose,
	// kneeling with the hands folded (the modern person's first prayer)
	prayFolded: {kneel: 1, near: {sh: 0.5, el: 1.45, hand: 'relaxed', fore: 0.82}, far: {sh: 0.42, el: 1.5, hand: 'hidden', fore: 0.75}, headTilt: 0.16, eyes: 'closed'} as Pose,
	walk: (ph: number): Pose => ({stride: Math.sin(ph) * 0.55, near: {sh: -Math.sin(ph) * 0.35, el: 0.25}, far: {sh: Math.sin(ph) * 0.3, el: 0.25}, sway: Math.sin(ph) * 0.4}),
	throne: {sit: true, near: {sh: 0.9, el: -0.5, hand: 'relaxed'}, far: {sh: 0.7, el: -0.4, hand: 'relaxed'}, headTilt: -0.04} as Pose,
	courtStand: {near: {sh: 0.22, el: 1.25, hand: 'relaxed', fore: 0.8}, far: {sh: 0.16, el: 1.3, hand: 'hidden', fore: 0.72}} as Pose,
	whisper: {lean: 0.16, near: {sh: 0.9, el: 1.7, hand: 'flat', fore: 0.8}, far: {sh: 0.2, el: 0.4}, eyes: 'narrow', brow: {inner: 6, outer: -2}, headTilt: 0.08} as Pose,
	// slouched on the sofa, phone up, thumb flicking (flick 0..1)
	scroll: (flick: number): Pose => ({sit: true, lean: -0.2, near: {sh: 0.95, el: 1.25, hand: 'fist', wrist: -0.1 + flick * 0.12}, far: {sh: 0.85, el: 1.32, hand: 'fist'}, hold: {item: 'phone', lift: -0.2}, headTilt: 0.34, gaze: [0.4, 0.55], eyes: 'narrow', lid: 0.35}),
};
