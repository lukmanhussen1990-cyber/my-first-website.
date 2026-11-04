// The Birthday cast, all from the same Character builder.
import {CharSpec, HairKind, OutfitKind} from '../characters/Character';
import {GRANDPA} from '../characters/presets';
import {hash, pick} from '../lib/random';

/** me: messy brown block hair, red hoodie, blue jeans, white shoes */
export const ME: CharSpec = {
	name: 'me',
	seed: 11,
	scale: 0.8,
	skin: '#ffcfa1',
	headSize: 1.14,
	legH: 1.8,
	face: {eyeScale: 1.12},
	hair: 'messy',
	hairColor: '#6a3d1e',
	outfit: 'hoodie',
	top: '#d8343a',
	sleeve: 'long',
	pants: '#3f6fd8',
	shoes: '#f7f7f7',
};

/** Grandpa, 90: bald top, white side hair, big white mustache, round glasses, brown cardigan */
export const GP: CharSpec = {...GRANDPA, name: 'grandpa90', face: {...GRANDPA.face, wrinkles: true}};

/** Mom: long black hair, yellow top, apron */
export const MOM: CharSpec = {
	name: 'mom',
	seed: 41,
	scale: 0.97,
	skin: '#f1bf92',
	face: {lashes: true, lip: '#9a2a3a', brow: '#1d1416'},
	hair: 'long',
	hairColor: '#17141a',
	outfit: 'shirt',
	top: '#f5c542',
	sleeve: 'long',
	pants: '#4d5a7a',
	shoes: '#5a3a26',
	apron: '#fbf3e6',
	apronTrim: '#e2848f',
};

// ------------------------------------------------------------- quiet townspeople
// soft, muted colours: the town is plain until the party
const SKINS = ['#ffdcb6', '#f6c393', '#eaa97c', '#d0915f', '#b0703f', '#8d5431', '#6c3d22', '#ffd0a6'];
const HAIR = ['#1d1c23', '#3e2616', '#6e4220', '#9a6a3a', '#c9a46a', '#2a2a2a', '#7a4a2a', '#5a5a5a'];
const TOPS = ['#8a9bb0', '#a88f74', '#7f8f7a', '#b5a58a', '#9c7f86', '#6f7f99', '#c2b8a3', '#8c6e5a', '#a3a7ad', '#b59c6b'];
const PANTS = ['#4a4f5e', '#5a4a3a', '#3d4a5a', '#6a6255', '#2f3340', '#7a6e5c'];
const SHOES = ['#2a2a2a', '#5a3a26', '#3a3a44', '#7a5a3a'];
const HAIRS_KID: HairKind[] = ['short', 'messy', 'ponytail', 'pigtails', 'curly', 'long', 'buzz', 'afro'];
const HAIRS_ADULT: HairKind[] = ['short', 'long', 'ponytail', 'curly', 'buzz', 'bun', 'baldSides', 'short', 'afro'];

export function townsperson(seed: number, opts: {kid?: boolean; elder?: boolean} = {}): CharSpec {
	const h = (n: number) => hash(seed * 31 + n, 913);
	const kid = !!opts.kid;
	const hair = opts.elder ? pick(['baldSides', 'short', 'bun'] as HairKind[], seed, 5) : pick(kid ? HAIRS_KID : HAIRS_ADULT, seed, 3);
	const outfit: OutfitKind = pick(['tshirt', 'shirt', 'hoodie', 'dress', 'cardigan', 'shirt'] as OutfitKind[], seed, 7);
	const skin = pick(SKINS, seed, 17);
	const top = pick(TOPS, seed, 11);
	return {
		name: 'towns' + seed,
		seed: seed + 100,
		scale: kid ? 0.76 + h(1) * 0.06 : 0.92 + h(2) * 0.12,
		skin,
		headSize: kid ? 1.12 : 1.0,
		legH: kid ? 1.8 : 2.0,
		bodyW: kid ? 1 : 0.95 + h(3) * 0.15,
		face: {lashes: outfit === 'dress' || hair === 'ponytail' || hair === 'pigtails' || hair === 'long', freckles: h(4) > 0.82},
		hair,
		hairColor: opts.elder ? '#e8e8e8' : pick(HAIR, seed, 19),
		outfit,
		top,
		top2: pick(['#f4efe4', '#e6dccb', '#d9dfe6'], seed, 13),
		sleeve: outfit === 'tshirt' ? 'short' : 'long',
		pants: outfit === 'dress' ? skin : pick(PANTS, seed, 29),
		shoes: pick(SHOES, seed, 31),
		glasses: h(7) > 0.85 ? 'round' : null,
		glassesColor: '#2a2a2a',
		hat: 'none',
	};
}

/** party hat colours */
export const HAT_COLS = ['#ff6b8a', '#ffc93c', '#4cc3ff', '#7ad36b', '#b38cff', '#ff9a4c'];
export const hatColor = (i: number) => HAT_COLS[((i % HAT_COLS.length) + HAT_COLS.length) % HAT_COLS.length];
