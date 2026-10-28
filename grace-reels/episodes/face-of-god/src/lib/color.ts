import {clamp} from './ease';

// Blend two #rrggbb colours (m = 0 gives a, 1 gives b).
export const lerpHex = (a: string, b: string, m: number) => {
	const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
	const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
	return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * clamp(m)).toString(16).padStart(2, '0')).join('');
};
