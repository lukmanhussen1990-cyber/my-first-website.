// The summit of Sinai in the storm: S1 the opening (fast push-in into slow motion), S2 "you will die"
// (tilt up into the light, then a hard cut), the dark close-up in near silence, S4 the ask (low angle)
// and S5 the answer (from the rolling clouds down to Moses bowed low).
import eyesJson from '../../public/sprites/eyes.json';
import {Actor} from '../characters/Actor';
import {pxPerM} from '../characters/Character';
import {easeInOut, easeOut, lerp, seg, smooth} from '../lib/ease';
import {meta} from '../lib/textures';
import {B} from '../lib/timeline';
import {cameraBasis} from '../render/camera';
import type {SpriteLook} from '../render/spriteMaterial';
import type {CamState, Grade, ShotDef, Vec3} from '../render/types';
import {Dust} from '../world/atmosphere';
import {HOLE_DIR, HOLE_POS, LEDGE, SinaiLook, SinaiWorld} from '../world/Sinai';
import {flashAt, slowmo} from '../world/storm';

const EYES = eyesJson as unknown as Record<string, {eye: [number, number]}>;

const add = (a: Vec3, b: Vec3, k = 1): Vec3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const mix3 = (a: Vec3, b: Vec3, m: number): Vec3 => [lerp(a[0], b[0], m), lerp(a[1], b[1], m), lerp(a[2], b[2], m)];
const norm = (v: Vec3): Vec3 => {
	const l = Math.hypot(...v);
	return [v[0] / l, v[1] / l, v[2] / l];
};

// A lightning bolt placed in a shot's picture: screen x (-1..1) and the top/bottom screen y, far away.
const boltIn = (cam: CamState, t: number, x: number, yTop: number, yBot: number, dist = 260): [Vec3, Vec3] => {
	const c = cameraBasis(cam, t);
	const tv = Math.tan((cam.fov * Math.PI) / 360);
	const th = tv * (1080 / 1920);
	const at = (sx: number, sy: number): Vec3 => {
		const d = c.fwd.clone().add(c.right.clone().multiplyScalar(sx * th)).add(c.up.clone().multiplyScalar(sy * tv)).normalize().multiplyScalar(dist);
		return [c.pos.x + d.x, c.pos.y + d.y, c.pos.z + d.z];
	};
	return [at(x, yTop), at(x + 0.08, yBot)];
};

const flashOf = (t: number, flashes: [number, Vec3, Vec3][]) => flashes.reduce((m, [at]) => Math.max(m, flashAt(t, at)), 0);

// Storm light on Moses: cool overall, warm light and a bright rim on the side facing the opening.
const stormLook = (light: number, flash: number, extra: SpriteLook = {}): SpriteLook => ({
	tint: flash > 0.02 ? `rgb(${Math.round(170 + 60 * Math.min(1, flash))}, ${Math.round(180 + 55 * Math.min(1, flash))}, ${Math.round(214 + 40 * Math.min(1, flash))})` : '#aab4d6',
	grad: {dir: [1, 0.35], color: '#ffd894', amount: 0.55 * light, soft: 0.45},
	rimLight: 0.5 * light,
	rimColor: '#ffe7aa',
	rimDir: [0.75, 0.6],
	...extra,
});

// Wind in the robe, beard and hair (stronger and faster than any breeze; follows slow motion).
const windWarp = (st: number, k = 1) => ({
	wave: [k * (3 + 1.6 * Math.sin(st * 1.7)), 15, st * 13, 0.0] as [number, number, number, number],
	hem: [k * 6 * Math.sin(st * 2.3 + 0.4), 0.5, 1] as [number, number, number],
	breath: 0.006 * Math.sin(st * 2.4),
});

const stormGrade = (t: number, flash: number, g: Partial<Grade> = {}): Partial<Grade> => ({
	exposure: 1.02,
	contrast: 1.14,
	saturation: 0.95,
	gain: [0.93, 0.97, 1.08],
	vignette: 0.55,
	bloom: 0.75,
	bloomThreshold: 0.8,
	flash: 0.22 * Math.min(1, flash),
	flashColor: [0.72, 0.8, 1.0],
	grain: 0.022,
	...g,
});
const stormFog = () => ({color: '#1b2238', near: 40, far: 420});

const rainBox = (cam: CamState): {center: Vec3; size: Vec3} => ({center: mix3(cam.pos, cam.target, 0.45), size: [9, 9, 9]});

// ---------------- S1 the opening ----------------
const HOOK_T: Vec3 = [0.6, 1.5, 0.3];
const HOOK_DIR = norm([-0.42, -0.1, 0.9]);
const hookCam = (t: number): CamState => {
	const fast = easeOut(seg(t, 0, B.rampEnd));
	const slow = seg(t, B.rampEnd, B.s2);
	const d = lerp(7.4, 4.6, fast) - 0.25 * slow;
	const target: Vec3 = add(HOOK_T, [0.27, 0.06 * fast + 0.04 * slow, 0.13]);
	return {pos: add(target, HOOK_DIR, d), target, fov: 40, roll: -0.03, drift: 0.6, shake: 0.35 * flashAt(t, B.lightning1) + 0.2 * flashAt(t, B.lightning2)};
};
const HOOK_FLASHES: [number, Vec3, Vec3][] = [
	[B.lightning1, ...boltIn(hookCam(B.lightning1), B.lightning1, -0.62, 0.9, -0.15)],
	[B.lightning2, ...boltIn(hookCam(B.lightning2), B.lightning2, 0.55, 0.55, -0.25, 300)],
];
const HookContent: React.FC<{t: number; lite: boolean}> = ({t, lite}) => {
	const st = slowmo(t, B.rampEnd, 0.32);
	const flash = flashOf(t, HOOK_FLASHES);
	const look: SinaiLook = {hole: 1.15 + 0.1 * Math.sin(st * 2), glory: 1, flashes: HOOK_FLASHES, rain: 1, storm: 1};
	return (
		<>
			<SinaiWorld t={st} look={look} rainBox={rainBox(hookCam(t))} lite={lite} />
			<Actor position={LEDGE} t={st} poses={[[-10, 'moses/raise']]} yaw={Math.atan2(HOOK_DIR[0], HOOK_DIR[2])} look={stormLook(1, flash)} warp={windWarp(st)} blinkSeed={3} renderOrder={10} />
			<Dust count={45} center={[LEDGE[0] + 0.6, 1.8, LEDGE[2] - 0.4]} size={[4, 3.2, 2.4]} t={st} color="#ffd98a" px={5} rise={0.16} seed={4} swirl={1} />
		</>
	);
};
export const HOOK: ShotDef = {
	id: 'HOOK',
	start: -1,
	end: B.s2 + 0.2,
	Content: HookContent,
	camera: hookCam,
	grade: (t) => stormGrade(t, flashOf(t, HOOK_FLASHES)),
	fog: stormFog,
	rays: () => ({at: HOLE_POS, strength: 0.85}),
};

// ---------------- S2 you will die ----------------
const DIE_DIR = norm([-0.3, -0.18, 0.94]);
const DIE_HEAD: Vec3 = [0.85, 1.52, 0.3];
const LIGHT_AIM: Vec3 = add(LEDGE, HOLE_DIR, 40);
const dieCam = (t: number): CamState => {
	const push = seg(t, B.s2, B.hardCut);
	const tilt = easeInOut(seg(t, B.tiltUp, B.hardCut - 0.05));
	const target = mix3(DIE_HEAD, LIGHT_AIM, tilt * 0.78);
	return {pos: add(DIE_HEAD, DIE_DIR, 3.1 - 0.5 * push), target, fov: 40 + 6 * tilt, roll: 0.02, drift: 0.7, shake: 0.25 * flashAt(t, B.lightning3) + 0.6 * smooth(seg(t, B.hardCut - 0.7, B.hardCut))};
};
const DIE_FLASHES: [number, Vec3, Vec3][] = [[B.lightning3, ...boltIn(dieCam(B.lightning3), B.lightning3, -0.55, 0.95, -0.1)]];
const DieContent: React.FC<{t: number; lite: boolean}> = ({t, lite}) => {
	const swell = smooth(seg(t, B.swellStart, B.hardCut));
	const flash = flashOf(t, DIE_FLASHES);
	const tilt = easeInOut(seg(t, B.tiltUp, B.hardCut - 0.05));
	const look: SinaiLook = {hole: 0.7 + 0.2 * swell, glory: 1 + 0.6 * swell, flashes: DIE_FLASHES, rain: 1, storm: 1, rays3d: 1 - 0.85 * tilt};
	return (
		<>
			<SinaiWorld t={t} look={look} rainBox={rainBox(dieCam(t))} lite={lite} />
			<Actor
				position={LEDGE}
				t={t}
				poses={[[-10, 'moses/shield']]}
				yaw={Math.atan2(DIE_DIR[0], DIE_DIR[2])}
				look={stormLook(1 + swell, flash, {light: 0.35 * swell, lightColor: '#fff0cc'})}
				warp={windWarp(t, 1 + 0.4 * swell)}
				blinkSeed={5}
				renderOrder={10}
			/>
			<Dust count={40} center={[LEDGE[0] + 0.5, 1.9, LEDGE[2] - 0.4]} size={[3, 3, 2.4]} t={t} color="#ffe0a0" px={5} rise={0.18} seed={6} swirl={1} opacity={0.7 + swell} />
		</>
	);
};
export const DIE: ShotDef = {
	id: 'DIE',
	start: B.s2 - 0.2,
	end: B.hardCut + 0.1,
	Content: DieContent,
	camera: dieCam,
	grade: (t) => {
		const swell = smooth(seg(t, B.swellStart, B.hardCut));
		return stormGrade(t, flashOf(t, DIE_FLASHES), {exposure: 1.0 + 0.12 * swell, bloom: 0.7 + 0.25 * swell, bloomThreshold: 0.85, flash: 0.22 * flashOf(t, DIE_FLASHES) + 0.12 * swell ** 3, flashColor: [1, 0.85, 0.6], vignette: 0.6});
	},
	fog: stormFog,
	rays: (t) => ({at: HOLE_POS, strength: 0.6 + 0.35 * smooth(seg(t, B.swellStart, B.hardCut))}),
	};

	// ---------------- after the hard cut: a still, dark close-up in near silence ----------------
const DARK_EYE: Vec3 = [0.66, 1.45, 0.3];
const DARK_DIR = norm([-0.25, -0.04, 0.97]);
// place the bust so that its eye sits on DARK_EYE (the sprite faces the camera, turned by DARK_YAW)
const DARK_YAW = Math.atan2(DARK_DIR[0], DARK_DIR[2]);
const DARK_POS: Vec3 = (() => {
	const m = meta('moses/bust');
	const e = EYES['moses/bust'].eye;
	const k = pxPerM('moses/bust');
	const dx = (e[0] - m.foot[0]) / k;
	const dy = (m.foot[1] - e[1]) / k;
	return [DARK_EYE[0] - dx * Math.cos(DARK_YAW), DARK_EYE[1] - dy, DARK_EYE[2] + dx * Math.sin(DARK_YAW)];
})();
const darkCam = (t: number): CamState => {
	const p = seg(t, B.hardCut, B.s3);
	// the eye a little right of centre and above the middle (the caption block is at the top)
	return {pos: add(DARK_EYE, DARK_DIR, 1.12 - 0.08 * p), target: add(DARK_EYE, [-0.07, -0.1, 0]), fov: 38, drift: 0.25};
};
const DarkContent: React.FC<{t: number; lite: boolean}> = ({t, lite}) => {
	const look: SinaiLook = {hole: 0.08, glory: 0.05, flashes: [], rain: 0.12, storm: 0.35, swirl: 0.3};
	return (
		<>
			<SinaiWorld t={t * 0.3} look={look} lite={lite} />
			<Actor
				position={DARK_POS}
				t={t}
				poses={[[-10, 'moses/bust']]}
				yaw={DARK_YAW}
				look={{tint: '#7d86ad', rimLight: 1.1, rimColor: '#d8e2ff', rimDir: [1, 0.25], grad: {dir: [1, 0.1], color: '#b4c0ee', amount: 0.55, soft: 0.35}}}
				warp={{breath: 0.004 * Math.sin(t * 1.4)}}
				blinkSeed={null}
				renderOrder={10}
			/>
		</>
	);
};
export const DARK: ShotDef = {
	id: 'DARK',
	start: B.hardCut - 0.1,
	end: B.s3 + 0.4,
	Content: DarkContent,
	camera: darkCam,
	grade: () => ({exposure: 0.9, contrast: 1.22, saturation: 0.8, desat: 0.25, gain: [0.9, 0.95, 1.1], vignette: 0.95, bloom: 0.25, grain: 0.03}),
	fog: stormFog,
};

// ---------------- S4 the ask: low angle ----------------
const ASK_T: Vec3 = [1.15, 1.2, 0.2];
const ASK_FROM: Vec3 = [-1.75, 0.22, 3.7];
const askCam = (t: number): CamState => {
	const p = seg(t, B.s4, B.s5);
	const pos = mix3(ASK_FROM, [-1.3, 0.32, 3.1], p);
	return {pos, target: add(ASK_T, [0, 0.12 * p, 0]), fov: 44, roll: 0.025, drift: 0.7, shake: 0.2 * flashAt(t, B.lightning4)};
};
const ASK_FLASHES: [number, Vec3, Vec3][] = [
	[B.lightning4, ...boltIn(askCam(B.lightning4), B.lightning4, -0.6, 0.92, 0.1, 300)],
	[B.lightning5, ...boltIn(askCam(B.lightning5), B.lightning5, 0.45, 0.95, 0.2, 320)],
];
const AskContent: React.FC<{t: number; lite: boolean}> = ({t, lite}) => {
	const flash = flashOf(t, ASK_FLASHES);
	const lift = smooth(seg(t, B.glory - 0.2, B.glory + 0.4));
	const look: SinaiLook = {hole: 1.0 + 0.35 * lift, glory: 0.85 + 0.3 * lift, flashes: ASK_FLASHES, rain: 0.85, storm: 1};
	return (
		<>
			<SinaiWorld t={t} look={look} rainBox={rainBox(askCam(t))} lite={lite} />
			<Actor position={LEDGE} t={t} poses={[[-10, 'moses/kneel_ask']]} yaw={Math.atan2(ASK_FROM[0] - LEDGE[0], ASK_FROM[2] - LEDGE[2])} look={stormLook(0.9 + 0.3 * lift, flash)} warp={windWarp(t, 0.9)} blinkSeed={7} renderOrder={10} />
			<Dust count={35} center={[LEDGE[0] + 0.3, 1.6, LEDGE[2] - 0.3]} size={[3, 2.6, 2]} t={t} color="#ffd98a" px={5} rise={0.14} seed={8} swirl={1} opacity={0.8} />
		</>
	);
};
export const ASK: ShotDef = {
	id: 'ASK',
	start: B.s4 - 0.2,
	end: B.s5 + 0.2,
	Content: AskContent,
	camera: askCam,
	grade: (t) => stormGrade(t, flashOf(t, ASK_FLASHES)),
	fog: stormFog,
	rays: (t) => ({at: HOLE_POS, strength: 0.6 + 0.4 * smooth(seg(t, B.glory - 0.2, B.glory + 0.4))}),
};

// ---------------- S5 the answer: from the rolling clouds down to Moses bowed low ----------------
const ANS_FROM: Vec3 = [-3.4, 2.4, 7.6];
const ansCam = (t: number): CamState => {
	const down = easeInOut(seg(t, B.cardLiveIn - 0.2, B.cardLiveIn + 1.6));
	const push = seg(t, B.s5, B.s6);
	const sky: Vec3 = add(add(LEDGE, HOLE_DIR, 40), [-16, -4, 6]);
	const target = mix3(sky, [0.9, 1.15, 0.2], down);
	const pos = mix3(ANS_FROM, [0.9, 0.55, 0.2], 0.18 * push);
	return {pos, target, fov: 42, drift: 0.6, shake: 0.2 * flashAt(t, B.lightning6)};
};
const ANS_FLASHES: [number, Vec3, Vec3][] = [[B.lightning6, ...boltIn(ansCam(B.lightning6), B.lightning6, -0.5, 0.9, -0.3, 300)]];
const AnswerContent: React.FC<{t: number; lite: boolean}> = ({t, lite}) => {
	const flash = flashOf(t, ANS_FLASHES);
	// the light behind the clouds pulses with the thunder, then dims on "live"
	const pulse = 0.55 + 0.25 * Math.sin(t * 2.6) - 0.2 * smooth(seg(t, B.live, B.live + 0.6));
	const look: SinaiLook = {hole: pulse, glory: 0.45 * pulse, flashes: ANS_FLASHES, rain: 0.55, storm: 0.85, swirl: 2.4};
	return (
		<>
			<SinaiWorld t={t} look={look} rainBox={rainBox(ansCam(t))} lite={lite} />
			<Actor position={LEDGE} t={t} poses={[[-10, 'moses/bow']]} yaw={Math.atan2(ANS_FROM[0] - LEDGE[0], ANS_FROM[2] - LEDGE[2])} look={stormLook(0.5, flash)} warp={windWarp(t, 0.6)} renderOrder={10} />
		</>
	);
};
export const ANSWER: ShotDef = {
	id: 'ANSWER',
	start: B.s5 - 0.2,
	end: B.s6 + 0.2,
	Content: AnswerContent,
	camera: ansCam,
	grade: (t) => stormGrade(t, flashOf(t, ANS_FLASHES), {exposure: 0.95, desat: 0.12, vignette: 0.65}),
	fog: stormFog,
};

