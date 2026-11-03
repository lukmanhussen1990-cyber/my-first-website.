// The cast. All built from the same Character builder with different specs.
import {CharSpec, HairKind, OutfitKind} from './Character';
import {hash, pick} from '../lib/random';

export const KID: CharSpec = {
	name: 'kid',
	seed: 11,
	scale: 0.8,
	skin: '#ffcfa1',
	headSize: 1.14,
	legH: 1.8,
	face: {eyeScale: 1.12},
	hair: 'messy',
	hairColor: '#1d1c23',
	outfit: 'hoodie',
	top: '#27c25a',
	sleeve: 'long',
	pants: '#3f6fd8',
	shoes: '#f7f7f7',
};

export const GRANDPA: CharSpec = {
	name: 'grandpa',
	seed: 23,
	scale: 0.95,
	skin: '#f4c497',
	headSize: 1.06,
	bodyW: 1.06,
	face: {brow: '#f2f2f2', browWidth: 15, wrinkles: true, mouthY: 30, eyeGap: 70, blush: '#ff8f8f'},
	hair: 'baldSides',
	hairColor: '#f3f3f3',
	glasses: 'round',
	glassesColor: '#5b3a1c',
	mustache: '#f7f7f7',
	outfit: 'cardigan',
	top: '#8b5a36',
	top2: '#f4e7c9',
	sleeve: 'long',
	pants: '#6f7684',
	shoes: '#3b2a1e',
};

export const BUCKET_MAN: CharSpec = {
	name: 'bucketman',
	seed: 37,
	scale: 1.3,
	skin: '#e3a777',
	bodyW: 1.22,
	bodyD: 1.12,
	limbW: 1.12,
	headSize: 1.0,
	face: {brow: '#3a2416', browWidth: 18, stubble: true},
	hair: 'short',
	hairColor: '#5a3820',
	hat: 'cap',
	hatColor: '#2b62d9',
	outfit: 'overalls',
	top: '#ff8a1c',
	top2: '#f5f1e6',
	sleeve: 'short',
	pants: '#ff8a1c',
	shoes: '#4a2e1c',
	boots: true,
	backBucket: true,
};

export const TEACHER: CharSpec = {
	name: 'teacher',
	seed: 51,
	scale: 0.98,
	skin: '#c68a5c',
	face: {lashes: true, lip: '#a01e40', brow: '#2a1810'},
	hair: 'bun',
	hairColor: '#3a2418',
	glasses: 'square',
	glassesColor: '#3a1a4a',
	outfit: 'dress',
	top: '#8f45d8',
	top2: '#ffffff',
	sleeve: 'long',
	pants: '#c68a5c',
	shoes: '#2a2230',
};

// ------------------------------------------------------------- townspeople & classmates
export const SKINS = ['#ffdcb6', '#f6c393', '#eaa97c', '#d0915f', '#b0703f', '#8d5431', '#6c3d22', '#ffd0a6'];
const HAIR_COLORS = ['#1d1c23', '#3e2616', '#6e4220', '#c8893a', '#e7c26a', '#b2381c', '#2a2a2a', '#7a4a2a'];
const SHIRTS = ['#ff5a5a', '#ffb32e', '#ffe14a', '#4ad16a', '#2fd3c3', '#4a8cff', '#8a5cff', '#ff6fc8', '#ffffff', '#ff8a3a', '#5ad1ff'];
const PANTS = ['#3d4a8a', '#2d2d3a', '#7a5a3a', '#4a6a3a', '#5a5a66', '#c8b48a', '#3f6fd8', '#8a3a4a'];
const SHOES = ['#2a2a2a', '#f7f7f7', '#7a4a2a', '#ff5a5a', '#3a5aff'];
const HAIRS_KID: HairKind[] = ['short', 'messy', 'ponytail', 'pigtails', 'afro', 'curly', 'spiky', 'long', 'buzz'];
const HAIRS_ADULT: HairKind[] = ['short', 'long', 'ponytail', 'afro', 'curly', 'buzz', 'bun', 'baldSides', 'short'];

export function makePerson(seed: number, opts: {kid?: boolean; pajamas?: boolean; elder?: boolean} = {}): CharSpec {
	const h = (n: number) => hash(seed * 31 + n, 777);
	const kid = !!opts.kid;
	const hair = opts.elder ? pick(['baldSides', 'short', 'bun'] as HairKind[], seed, 5) : pick(kid ? HAIRS_KID : HAIRS_ADULT, seed, 3);
	let outfit: OutfitKind = pick(['tshirt', 'tshirt', 'shirt', 'hoodie', 'dress', 'tshirt'] as OutfitKind[], seed, 7);
	if (opts.pajamas) outfit = 'pajamas';
	const top = pick(SHIRTS, seed, 11);
	let top2 = pick(['#ffffff', '#ffe9a8', '#bfe3ff', '#ffd1e6'], seed, 13);
	if (opts.pajamas) top2 = '#ffffff';
	const skin = pick(SKINS, seed, 17);
	return {
		name: 'person' + seed,
		seed,
		scale: kid ? 0.78 + h(1) * 0.06 : 0.92 + h(2) * 0.12,
		skin,
		headSize: kid ? 1.12 : 1.0,
		legH: kid ? 1.8 : 2.0,
		bodyW: kid ? 1 : 0.95 + h(3) * 0.15,
		face: {lashes: outfit === 'dress' || hair === 'ponytail' || hair === 'pigtails' || hair === 'long', freckles: h(4) > 0.8},
		hair,
		hairColor: opts.elder ? '#e8e8e8' : pick(HAIR_COLORS, seed, 19),
		outfit,
		top: opts.pajamas ? pick(['#7fb2ff', '#ff9ec4', '#a8e6a1', '#ffd36e', '#c7a8ff'], seed, 23) : top,
		top2,
		sleeve: outfit === 'tshirt' ? 'short' : 'long',
		pants: outfit === 'dress' ? skin : pick(PANTS, seed, 29),
		shorts: !opts.pajamas && outfit === 'tshirt' && h(5) > 0.7,
		shoes: opts.pajamas ? '#f2e6d8' : pick(SHOES, seed, 31),
		emblem: outfit === 'tshirt' && h(6) > 0.5 ? pick(['#ffffff', '#ffe14a', '#2a2a2a'], seed, 37) : null,
		glasses: h(7) > 0.86 ? 'round' : null,
		glassesColor: '#2a2a2a',
		hat: opts.pajamas && h(8) > 0.5 ? 'nightcap' : 'none',
		hatColor: pick(['#7fb2ff', '#ff9ec4', '#ffd36e'], seed, 41),
	};
}
