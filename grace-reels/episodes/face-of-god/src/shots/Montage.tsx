// S3 "Moses had already seen fire, plagues, and a sea split in two": three quick memories joined by
// whip cuts. The FIRE badge fills on "fire", the SEA badge on "sea".
import {easeOut, lerp, seg, smooth} from '../lib/ease';
import {B} from '../lib/timeline';
import type {CamState, ShotDef, Vec3} from '../render/types';
import {Dust} from '../world/atmosphere';
import {DesertBush, PlagueWorld, SeaWorld} from '../world/Montage';

const mix3 = (a: Vec3, b: Vec3, m: number): Vec3 => [lerp(a[0], b[0], m), lerp(a[1], b[1], m), lerp(a[2], b[2], m)];

// ---------------- the burning bush ----------------
const bushCam = (t: number): CamState => {
	const p = easeOut(seg(t, B.s3 - 0.2, B.whipPlagues));
	return {pos: mix3([-1.4, 1.55, 6.6], [-0.45, 1.1, 3.6], p), target: [0, 0.9, 0], fov: 40, drift: 0.8};
};
const flareAt = (t: number) => (t < B.fire ? 0 : Math.exp(-(t - B.fire) / 0.5)) + smooth(seg(t, B.fire - 0.12, B.fire)) * 0.3;
export const BUSH: ShotDef = {
	id: 'BUSH',
	start: B.s3 - 0.3,
	end: B.whipPlagues + 0.3,
	Content: ({t, lite}) => (
		<>
			<DesertBush t={t} fire={0.75 + 0.25 * smooth(seg(t, B.s3, B.fire))} flare={flareAt(t)} lite={lite} />
			<Dust count={40} center={[0, 1.6, 0]} size={[2.2, 2.4, 2]} t={t} color="#ffb060" px={4} rise={0.5} seed={21} swirl={1.5} />
		</>
	),
	camera: bushCam,
	grade: (t) => ({exposure: 1.02, contrast: 1.08, saturation: 1.05, gain: [1.06, 0.98, 0.9], vignette: 0.5, bloom: 0.6 + 0.2 * flareAt(t), bloomThreshold: 0.85, grain: 0.02}),
	fog: () => ({color: '#e8b98a', near: 60, far: 420}),
};

// ---------------- frogs and hail ----------------
const plagueCam = (t: number): CamState => {
	const p = seg(t, B.whipPlagues - 0.2, B.whipSea + 0.2);
	return {pos: [0.1, lerp(0.5, 0.42, p), lerp(3.3, 2.7, p)], target: [0, 0.45, -1], fov: 50, drift: 1, shake: 0.25};
};
export const PLAGUES: ShotDef = {
	id: 'PLAGUES',
	start: B.whipPlagues - 0.3,
	end: B.whipSea + 0.3,
	Content: ({t}) => <PlagueWorld t={t} t0={B.whipPlagues} frogs={B.frogs} />,
	camera: plagueCam,
	grade: () => ({exposure: 1.0, contrast: 1.15, saturation: 0.95, gain: [1.05, 0.92, 0.9], vignette: 0.6, bloom: 0.5, bloomThreshold: 0.85, grain: 0.025}),
	fog: () => ({color: '#5a2e2a', near: 20, far: 160}),
};

// ---------------- the sea splits ----------------
const openAt = (t: number) => easeOut(seg(t, B.split - 0.06, B.split + 0.7));
const seaCam = (t: number): CamState => {
	const p = seg(t, B.whipSea - 0.2, B.s4 + 0.2);
	return {pos: [0, lerp(1.4, 2.0, p), lerp(7.5, 4.2, p)], target: [0, lerp(1.6, 2.6, openAt(t)), -24], fov: 46, drift: 0.8, shake: 0.4 * smooth(seg(t, B.split - 0.05, B.split + 0.2)) * (1 - seg(t, B.split + 0.2, B.split + 0.8))};
};
export const SEA: ShotDef = {
	id: 'SEA',
	start: B.whipSea - 0.3,
	end: B.s4 + 0.3,
	Content: ({t}) => (
		<>
			<SeaWorld t={t} open={openAt(t)} water={1 - openAt(t)} />
			<Dust count={90} center={[0, 3.5, -4]} size={[9, 7, 12]} t={t} color="#e8f6ff" px={4} rise={-0.2} seed={31} swirl={2} opacity={0.5 + 0.8 * smooth(seg(t, B.split - 0.1, B.split + 0.3))} />
		</>
	),
	camera: seaCam,
	grade: () => ({exposure: 1.02, contrast: 1.1, saturation: 1.05, gain: [0.95, 1.0, 1.05], vignette: 0.55, bloom: 0.6, bloomThreshold: 0.82, grain: 0.02}),
	fog: () => ({color: '#3b3150', near: 30, far: 200}),
};
