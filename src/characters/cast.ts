import {rnd} from '../lib/anim';
import {Hair, Look} from './Person';

/* The cast. Everyone is built by the same Person builder with different looks. */

// Me (the owner / narrator) — matched to the user's avatar.
export const OWNER: Look = {
	skin: '#f3d2b0',
	shirt: '#16161b',
	pants: '#1b1b20',
	shoes: '#16161b',
	hair: 'messy',
	hairColor: '#121216',
	face: 'owner',
	front: 'hoodie',
	sunglasses: true,
	headphones: true,
	backpack: true,
};

// The old mayor: tall, thin, grey suit, gold chain, bald with a comb-over, thin mustache.
export const OLD_MAYOR: Look = {
	skin: '#f0c9a2',
	shirt: '#7c8089',
	pants: '#6b6f78',
	shoes: '#2a2220',
	hair: 'combover',
	hairColor: '#b9b9bd',
	face: 'mayor',
	front: 'suit',
	accent: '#7a1d2a',
	chain: 'mayor',
	scale: [0.86, 1.12, 0.9],
};

// The lost little girl: two pigtails, pink dress, teddy bear.
export const GIRL: Look = {
	skin: '#c98c5c',
	shirt: '#ff7eb6',
	pants: '#c98c5c',
	shoes: '#ff4f8f',
	hair: 'pigtails',
	hairColor: '#3b2416',
	face: 'girl',
	front: 'dress',
	accent: '#ffffff',
	skirt: '#ff7eb6',
	sleeves: 'short',
	headScale: 1.12,
};

// Her mom: long hair, green top.
export const MOM: Look = {
	skin: '#c98c5c',
	shirt: '#3fb56a',
	pants: '#33427a',
	shoes: '#5a3a26',
	hair: 'long',
	hairColor: '#2a1a12',
	face: 'mom',
	front: 'tee',
	accent: '#2f9a58',
};

export const REPORTER: Look = {
	skin: '#ffd8b8',
	shirt: '#2a5bd7',
	pants: '#2a2f45',
	shoes: '#1c1c22',
	hair: 'bob',
	hairColor: '#e8b440',
	face: 'woman',
	front: 'reporter',
};

export const BAKER: Look = {
	skin: '#e8b48a',
	shirt: '#f2f2f2',
	pants: '#5a5f7a',
	shoes: '#3a2a20',
	hair: 'short',
	hairColor: '#5a3a22',
	face: 'man',
	front: 'apron',
	accent: '#e86a8a',
	hat: 'chef',
	sleeves: 'short',
};

export const BUS_DRIVER: Look = {
	skin: '#9a6440',
	shirt: '#3a6ad0',
	pants: '#2a3350',
	shoes: '#1c1c22',
	hair: 'short',
	hairColor: '#1a1210',
	face: 'man',
	front: 'driver',
	accent: '#1d2a5c',
	hat: 'driver',
};

export const POLICE: Look = {
	skin: '#e8b48a',
	shirt: '#24356e',
	pants: '#1c2448',
	shoes: '#111116',
	hair: 'short',
	hairColor: '#3a2618',
	face: 'man',
	front: 'police',
	hat: 'police',
};

const SKINS = ['#f6d3b3', '#eebd94', '#d7a175', '#c98c5c', '#9a6440', '#6b4128', '#f5cd7d'];
const SHIRTS = ['#ff6b6b', '#ffb03a', '#ffd93d', '#6bcb77', '#4d96ff', '#9b5de5', '#f15bb5', '#00bbf9', '#ff8fab', '#3ddbd9', '#ffffff', '#e76f51'];
const PANTS = ['#2a3350', '#3a5a9a', '#5a4a3a', '#333338', '#6b8e23', '#7a5aa8', '#c0c0c8'];
const HAIRS: Hair[] = ['short', 'bob', 'bun', 'afro', 'ponytail', 'spiky', 'long', 'short', 'bald'];
const HAIR_COLORS = ['#1a1210', '#3b2416', '#6a4426', '#d9a441', '#b5462a', '#2a2a2a', '#e8e0d0'];

/** Random-but-seeded townsperson. */
export const townsperson = (seed: number): Look => {
	const r = (k: string) => rnd(`tp${seed}${k}`);
	const pick = <T,>(arr: T[], k: string) => arr[Math.floor(r(k) * arr.length)];
	const hair = pick(HAIRS, 'h');
	const fem = ['bob', 'bun', 'ponytail', 'long'].includes(hair);
	return {
		skin: pick(SKINS, 's'),
		shirt: pick(SHIRTS, 'c'),
		pants: pick(PANTS, 'p'),
		shoes: pick(['#1c1c22', '#ffffff', '#7a4a2a', '#d23a3a'], 'f'),
		hair,
		hairColor: pick(HAIR_COLORS, 'hc'),
		face: fem ? 'woman' : 'man',
		front: pick(['tee', 'jacket', 'none', 'tee'] as const, 'fr'),
		accent: pick(SHIRTS, 'a'),
		sleeves: r('sl') > 0.5 ? 'short' : 'long',
		hat: r('hat') > 0.85 ? 'cap' : null,
		hatColor: pick(SHIRTS, 'hcol'),
		glasses: r('gl') > 0.8,
		scale: [0.95 + r('w') * 0.12, 0.92 + r('y') * 0.14, 1],
	};
};
