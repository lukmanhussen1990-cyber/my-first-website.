import type {Look, Pose} from '../../../src/shared/rig/paperdoll';

// Character bible, drawn in code. Jesus: shoulder-length dark brown hair, short beard, warm
// brown skin, off-white robe, soft blue-grey sash, sandals, no halo, simple style face.
export const JESUS: Look = {
	skin: '#A0653E',
	hair: '#4A2C1A',
	hairStyle: 'shoulder',
	beard: 'short',
	robe: '#EEE6D5',
	sleeves: 'long',
	sash: '#8695A6',
	sandals: '#6A4327',
	build: 1.02,
	brow: '#2A1910',
};

// thin, middle-aged, plain grey robe, short beard with a little grey
export const MAN: Look = {
	skin: '#B57D55',
	hair: '#352519',
	hairStyle: 'short',
	beard: 'short',
	beardColor: '#45372C',
	grey: 0.5,
	robe: '#8D8C86',
	sleeves: 'elbow',
	rope: '#5E5B53',
	build: 0.84,
	height: 0.97,
};

// generic watchers: plain robes, arms folded, side-eye; no symbols of any group
export const WATCHERS: Look[] = [
	{skin: '#8E5A35', hair: '#8F8A84', hairStyle: 'bald', grey: 1, beard: 'full', beardColor: '#A39D95', robe: '#7F6446', sleeves: 'long', rope: '#5B4632', build: 1.05},
	{skin: '#A86E45', hair: '#2E2016', hairStyle: 'short', beard: 'none', robe: '#B08A4A', sleeves: 'long', build: 0.86},
	{skin: '#7B4B2D', hair: '#24170F', hairStyle: 'short', beard: 'full', robe: '#5E6440', sleeves: 'long', build: 1.28, head: 'cloth', headColor: '#C9B48F', headBand: '#7D6A4C'},
	{skin: '#B48057', hair: '#3A281B', hairStyle: 'curly', beard: 'short', robe: '#5F6670', sleeves: 'long', build: 1.0},
	{skin: '#9A633E', hair: '#2B1C12', hairStyle: 'short', beard: 'short', robe: '#8A6A4C', sleeves: 'long', build: 1.06, head: 'wrap', headColor: '#D8CBA8'},
];

// generic traders in colourful simple robes
export const MERCHANTS: Look[] = [
	{skin: '#9C653F', hair: '#2A1B11', hairStyle: 'short', beard: 'full', robe: '#B5543A', sleeves: 'elbow', rope: '#7A3A28', head: 'wrap', headColor: '#E2D2A8', build: 1.12},
	{skin: '#B3794F', hair: '#33231A', hairStyle: 'curly', beard: 'short', robe: '#C89A3A', sleeves: 'elbow', sash: '#7A5A2A', build: 0.95},
	{skin: '#83512F', hair: '#22160E', hairStyle: 'short', beard: 'short', robe: '#3F7F7A', sleeves: 'elbow', rope: '#2C5652', head: 'wrap', headColor: '#C89A3A', build: 1.0},
	{skin: '#A76B43', hair: '#3B2A1E', hairStyle: 'bald', grey: 1, beard: 'full', beardColor: '#8E877F', robe: '#6E4562', sleeves: 'elbow', sash: '#C9A46A', build: 1.18},
	{skin: '#9E6942', hair: '#291A10', hairStyle: 'short', beard: 'none', robe: '#B9733E', sleeves: 'cap', rope: '#6E4426', head: 'wrap', headColor: '#3F7F7A', build: 0.9},
];

// generic mocking crowd: mixed muted robes, no weapons, no armour, no symbols
export const CROWD: Look[] = [
	{skin: '#9A623C', hair: '#2A1B11', hairStyle: 'short', beard: 'full', robe: '#7D6B5A', sleeves: 'long', build: 1.1},
	{skin: '#B27A50', hair: '#3B2416', hairStyle: 'long', beard: 'none', robe: '#9A7B56', sleeves: 'long', head: 'cloth', headColor: '#B9A47E', build: 0.9, height: 0.94},
	{skin: '#7F4E2E', hair: '#23170F', hairStyle: 'curly', beard: 'short', robe: '#6B7B6E', sleeves: 'long', build: 1.0},
	{skin: '#A8714A', hair: '#332217', hairStyle: 'short', beard: 'short', robe: '#8E6A5E', sleeves: 'elbow', head: 'wrap', headColor: '#D4C49C', build: 1.04},
	{skin: '#B98458', hair: '#2E1E14', hairStyle: 'bun', beard: 'none', robe: '#5D5A66', sleeves: 'long', build: 0.88, height: 0.93},
	{skin: '#8C5734', hair: '#8F8880', hairStyle: 'bald', grey: 1, beard: 'full', beardColor: '#9C958D', robe: '#A08A6A', sleeves: 'long', build: 1.15},
];

// a young adult in a hoodie (S14)
export const MODERN: Look = {
	skin: '#8A573A',
	hair: '#20150E',
	hairStyle: 'curly',
	beard: 'none',
	outfit: 'hoodie',
	robe: '#D59E38',
	pants: '#2E4A6B',
	shoes: '#F1EEE6',
	build: 0.95,
};

// ---- poses used across scenes ----
export const P = {
	stand: {near: {sh: 0.1, el: 0.16}, far: {sh: -0.06, el: 0.2}} as Pose,
	whipLow: {near: {sh: 0.28, el: 0.12, hand: 'fist'}, far: {sh: -0.18, el: 0.3, hand: 'relaxed'}, hold: {item: 'whip', swing: 0.1}, brow: {inner: 8, outer: -2}, eyes: 'narrow'} as Pose,
	whipHigh: {lean: 0.12, stride: 0.5, near: {sh: 2.75, el: 0.35, hand: 'fist'}, far: {sh: 1.35, el: -0.1, hand: 'flat'}, hold: {item: 'whip', swing: -0.6}, brow: {inner: 8, outer: -2}, eyes: 'narrow', sway: 0.6} as Pose,
	heal: {lean: 0.06, near: {sh: 1.32, el: 0.05, hand: 'open'}, far: {sh: 0.1, el: 0.3}, gaze: [0.2, 0.1]} as Pose,
	calm: {near: {sh: 0.22, el: 1.32, hand: 'relaxed', fore: 0.8}, far: {sh: 0.18, el: 1.36, hand: 'hidden', fore: 0.7}, headTilt: 0.1, gaze: [0, 0.3]} as Pose,
	armsFolded: {near: {sh: 0.2, el: 1.5, hand: 'hidden', fore: 0.62}, far: {sh: 0.12, el: 1.5, hand: 'hidden', fore: 0.55}, eyes: 'narrow', gaze: [-0.9, 0], brow: {inner: 5, outer: -1}} as Pose,
	withered: {near: {sh: 0.32, el: 1.78, hand: 'curled', wrist: 0.5, fore: 0.85}, far: {sh: 0.05, el: 0.3}, lean: 0.12, headTilt: 0.16, gaze: [0, 0.5], shoulderLift: 1} as Pose,
	point: {lean: 0.08, near: {sh: 1.45, el: 0.05, hand: 'point'}, far: {sh: 0.3, el: 1.6}, headTilt: -0.18, eyes: 'happy'} as Pose,
	jumpBack: {lean: -0.22, stride: -0.4, near: {sh: 2.3, el: 0.6, hand: 'flat'}, far: {sh: 2.0, el: 0.5, hand: 'flat'}, eyes: 'wide', sway: -0.6, brow: {inner: -8, outer: -6}} as Pose,
};
