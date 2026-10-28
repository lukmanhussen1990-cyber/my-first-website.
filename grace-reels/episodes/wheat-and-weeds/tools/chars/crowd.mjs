// The crowd on the beach (S2): men, women and children of many skin tones and clothes, made from the
// same parametric person as the main cast (seeded, so the crowd is the same on every build).
import {rng} from './geom.mjs';

const SKINS = ['#c98b5a', '#b8743f', '#9c5c33', '#7e4a2b', '#d19a6a', '#a8673e', '#8c5432'];
const CLOTH = ['#7f8f55', '#b0583a', '#cdb38a', '#6f7f9a', '#9b6b8a', '#c08a4a', '#8a5634', '#5e7a6e', '#d6c7a6', '#a04a3a', '#7a6aa0', '#c9a24a', '#4f6f8f'];
const HAIR = ['#1a1410', '#2a1d14', '#3b2416', '#4a3424', '#8a857e', '#b6b0a6'];

export const crowdSpecs = () => {
	const r = rng(99);
	const pick = (a) => a[Math.floor(r() * a.length)];
	const out = [];
	for (let i = 0; i < 16; i++) {
		const kind = i % 5 === 2 ? 'child' : i % 3 === 1 ? 'woman' : 'man';
		const robe = pick(CLOTH);
		const base = {id: `p${i}`, seed: 100 + i, skin: pick(SKINS), build: 0.9 + r() * 0.3, nose: 0.85 + r() * 0.35};
		if (kind === 'child') {
			const girl = r() > 0.5;
			out.push({
				...base, height: 1180 + r() * 220, child: 0.65, build: 0.85, hair: girl ? 'scarf' : pick(['short', 'curly']), wrapColor: pick(CLOTH), hairColor: pick(HAIR.slice(0, 4)),
				beard: 'none', robe: {color: robe, length: 'calf', sleeves: 'short', belt: {color: '#5a4026', width: 1.4}},
			});
		} else if (kind === 'woman') {
			out.push({
				...base, height: 1760 + r() * 140, build: 0.9, hair: 'scarf', wrapColor: pick(CLOTH), hairColor: pick(HAIR), beard: 'none', jaw: 0.92, nose: 0.85,
				robe: {color: robe, length: 'ankle', sleeves: 'long', belt: {color: pick(CLOTH), width: 1.6, tail: r() > 0.5}},
			});
		} else {
			const hair = pick(['short', 'curly', 'cloth', 'fringe', 'short']);
			const hc = hair === 'fringe' ? pick(HAIR.slice(3)) : pick(HAIR);
			out.push({
				...base, height: 1820 + r() * 200, belly: r() * 0.4, hair, wrapColor: pick(CLOTH), bandColor: '#3a3a44', hairColor: hc, beardColor: hc,
				beard: pick(['short', 'full', 'short', 'stubble']), robe: {color: robe, length: pick(['ankle', 'calf', 'knee']), sleeves: pick(['long', 'elbow']), belt: {color: '#5a4026', width: 1.6, tail: r() > 0.5}},
			});
		}
	}
	return out;
};
