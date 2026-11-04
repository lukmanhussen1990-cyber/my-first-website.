// The Bob cast: everyone is a Bob (same hair, same grey t-shirt, same face), except me.
import {CharSpec} from '../characters/Character';

export const BOB_SKIN = '#efcfae';
export const BOB_HAIR = '#7a5a3e';
export const BOB_SHIRT = '#9b9ba0';
export const BOB_PANTS = '#7c7d83';
export const BOB_SHOES = '#222226';

/** Bob: flat brown side-part hair, grey t-shirt, grey pants, black shoes, the Bob face */
export const BOB: CharSpec = {
	name: 'bob',
	seed: 7,
	scale: 1.0,
	skin: BOB_SKIN,
	hair: 'bobFlat',
	hairColor: BOB_HAIR,
	outfit: 'tshirt',
	top: BOB_SHIRT,
	sleeve: 'short',
	pants: BOB_PANTS,
	shoes: BOB_SHOES,
};
export const bobOfHeight = (scale: number, name = 'bob'): CharSpec => ({...BOB, name: name + scale, scale});
/** kid Bob (classmates) */
export const BOB_KID: CharSpec = {...BOB, name: 'bobKid', scale: 0.8, headSize: 1.12, legH: 1.8};
/** the shy girl Bob (the first one to change) */
export const SHY_GIRL: CharSpec = {...BOB_KID, name: 'shyGirl', seed: 19, face: {lashes: true}};

/** me: curly orange hair of bumpy blocks, red jacket, dark blue jeans, white shoes */
export const ME: CharSpec = {
	name: 'me',
	seed: 11,
	scale: 0.8,
	skin: '#ffd2a8',
	headSize: 1.14,
	legH: 1.8,
	face: {eyeScale: 1.12, freckles: true},
	hair: 'curlyBumpy',
	hairColor: '#ff7a14',
	outfit: 'jacket',
	top: '#e3262c',
	top2: '#f4f4f4',
	sleeve: 'long',
	pants: '#22386e',
	shoes: '#f7f7f7',
};
/** me in the grey shirt (trying to fit in) */
export const ME_GREY: CharSpec = {...ME, name: 'meGrey', outfit: 'tshirt', top: BOB_SHIRT, sleeve: 'short', pants: BOB_PANTS, shoes: BOB_SHOES};

/** Grandpa Bob: Bob outfit but white hair, round glasses, grey cardigan, walking stick */
export const GRANDPA_BOB: CharSpec = {
	...BOB,
	name: 'grandpaBob',
	seed: 23,
	scale: 0.95,
	headSize: 1.04,
	face: {wrinkles: true, brow: '#e8e8e8', browWidth: 12},
	hairColor: '#f1f1f1',
	glasses: 'round',
	glassesColor: '#4a4a52',
	outfit: 'cardigan',
	top: '#8f8f95',
	top2: '#d9d9de',
	sleeve: 'long',
	pants: '#6e6f75',
};

/** colourful clothes for the end (everyone changes) */
export const BRIGHT_SHIRTS = ['#ff4d5e', '#3b8cff', '#2ec27e', '#ffc93c', '#b56cff', '#ff8a2a', '#1fc7d4', '#ff6fb5', '#8ad13b', '#ffffff'];
export const BRIGHT_PANTS = ['#2b3f8f', '#5a2d82', '#1f6f5c', '#8a3a2a', '#2d2d38', '#c27a2a', '#3b5bd6', '#a33a6a'];
export const BRIGHT_HAIR = ['#3b8cff', '#ff4d9e', '#7a3fe0', '#2ec27e', '#ffd23a', '#ff6a2a', '#1d1c23', '#e8e8e8', '#c84a2a', '#7a5a3e'];
