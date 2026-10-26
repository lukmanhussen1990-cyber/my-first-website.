// The chariot of fire and its two horses, drawn as a silhouette on a canvas every frame
// (red = coverage, green = depth shade). The fire shader turns it into flames.
// Gallop timing matches the hoof sounds in tools/synth/sfx.mjs: a 3-beat stride of 0.45 s
// with hits at 0, 0.085 and 0.17 s; the second horse runs 0.21 s later.
import {easeInOut, lerp} from '../lib/ease';

export const STRIDE = 0.45;
export const HORSE_OFFSETS = [0, 0.21];
export const TEAM_PX = 185; // canvas pixels per metre
export const TEAM_W = 1024;
export const TEAM_H = 512;
export const TEAM_X0 = -2.55; // team-frame metres at the canvas left edge
export const TEAM_Y0 = -0.12; // team-frame metres at the canvas bottom edge
export const TEAM_SIZE: [number, number] = [TEAM_W / TEAM_PX, TEAM_H / TEAM_PX];
export const TEAM_CENTER: [number, number] = [TEAM_X0 + TEAM_SIZE[0] / 2, TEAM_Y0 + TEAM_SIZE[1] / 2];

const LAND = {hindFar: 0, hindNear: 0.189, foreFar: 0.189, foreNear: 0.378};

const frac = (x: number) => ((x % 1) + 1) % 1;

// Upper-leg angle (deg, + = forward) and knee fold (deg, - = folds back) for a leg landing at phase `land`.
const leg = (phase: number, land: number, fore: boolean) => {
	const r = frac(phase - land);
	if (r < 0.32) return {up: lerp(24, -30, r / 0.32), bend: fore ? -6 : 8};
	const s = (r - 0.32) / 0.68;
	return {up: lerp(-30, 24, easeInOut(s)), bend: (fore ? -80 : 55) * Math.sin(Math.PI * s)};
};

type Ctx = CanvasRenderingContext2D;
const P = (x: number, y: number): [number, number] => [(x - TEAM_X0) * TEAM_PX, TEAM_H - (y - TEAM_Y0) * TEAM_PX];

const limb = (ctx: Ctx, x: number, y: number, a1: number, a2: number, l1: number, l2: number, w1: number, w2: number) => {
	const r1 = (a1 * Math.PI) / 180;
	const kx = x + Math.sin(r1) * l1;
	const ky = y - Math.cos(r1) * l1;
	const r2 = ((a1 + a2) * Math.PI) / 180;
	const hx = kx + Math.sin(r2) * l2;
	const hy = ky - Math.cos(r2) * l2;
	ctx.lineCap = 'round';
	ctx.lineWidth = w1 * TEAM_PX;
	ctx.beginPath();
	ctx.moveTo(...P(x, y));
	ctx.lineTo(...P(kx, ky));
	ctx.stroke();
	ctx.lineWidth = w2 * TEAM_PX;
	ctx.beginPath();
	ctx.moveTo(...P(kx, ky));
	ctx.lineTo(...P(hx, hy));
	ctx.stroke();
	// hoof
	ctx.beginPath();
	ctx.ellipse(...P(hx + Math.sin(r2) * 0.03, hy - Math.cos(r2) * 0.03), 0.075 * TEAM_PX, 0.06 * TEAM_PX, -r2, 0, Math.PI * 2);
	ctx.fill();
};

const ellipse = (ctx: Ctx, x: number, y: number, rx: number, ry: number, rot = 0) => {
	ctx.beginPath();
	ctx.ellipse(...P(x, y), rx * TEAM_PX, ry * TEAM_PX, -rot, 0, Math.PI * 2);
	ctx.fill();
};

// One horse; (bx, by) = body centre in team metres; local offsets rotate with the body pitch.
const horse = (ctx: Ctx, bx: number, by: number, phase: number, rear: number, t: number, shade: number, seed: number) => {
	const pitch = (7 * Math.sin(2 * Math.PI * (phase - 0.15)) + rear * 24) * (Math.PI / 180);
	const bob = 0.05 * Math.cos(4 * Math.PI * phase) + rear * 0.18;
	const c = Math.cos(pitch);
	const s = Math.sin(pitch);
	// rotate around the hindquarters when rearing
	const pivot: [number, number] = [-0.5, 0];
	const L = (x: number, y: number): [number, number] => {
		const dx = x - pivot[0];
		const dy = y - pivot[1];
		return [bx + pivot[0] + dx * c - dy * s, by + bob + pivot[1] + dx * s + dy * c];
	};
	const deg = (pitch * 180) / Math.PI;
	ctx.fillStyle = ctx.strokeStyle = `rgb(255,${shade},0)`;
	// far legs first (a touch darker)
	const legs: [string, number, number, boolean, number][] = [
		['hindFar', -0.5, -0.12, false, 0.82],
		['foreFar', 0.52, -0.16, true, 0.82],
		['hindNear', -0.58, -0.1, false, 1],
		['foreNear', 0.58, -0.14, true, 1],
	];
	for (const [name, lx, ly, fore, k] of legs) {
		const g = leg(phase, LAND[name as keyof typeof LAND], fore);
		const rearLift = fore ? rear * 55 : -rear * 10;
		ctx.fillStyle = ctx.strokeStyle = `rgb(255,${Math.round(shade * k)},0)`;
		const [x, y] = L(lx, ly);
		limb(ctx, x, y, g.up + rearLift + deg, g.bend - (fore ? rear * 40 : 0), 0.46, 0.5, fore ? 0.17 : 0.2, 0.1);
	}
	ctx.fillStyle = ctx.strokeStyle = `rgb(255,${shade},0)`;
	// body: barrel, chest, haunch
	ellipse(ctx, ...L(0, 0), 0.74, 0.3, pitch);
	ellipse(ctx, ...L(0.56, 0.05), 0.33, 0.35, pitch);
	ellipse(ctx, ...L(-0.56, 0.06), 0.37, 0.36, pitch);
	// neck and head (counter-swing against the body pitch)
	const neckA = pitch * -0.5 + 0.05 * Math.sin(2 * Math.PI * (phase + 0.3));
	const nb = L(0.66, 0.22);
	const nt: [number, number] = [nb[0] + Math.cos(1.0 + neckA) * 0.62, nb[1] + Math.sin(1.0 + neckA) * 0.62];
	ctx.lineCap = 'round';
	ctx.lineWidth = 0.34 * TEAM_PX;
	ctx.beginPath();
	ctx.moveTo(...P(...nb));
	ctx.lineTo(...P(...nt));
	ctx.stroke();
	const headA = -0.75 + neckA * 0.6 - rear * 0.3;
	const muzzle: [number, number] = [nt[0] + Math.cos(headA) * 0.42, nt[1] + Math.sin(headA) * 0.42];
	ctx.lineWidth = 0.22 * TEAM_PX;
	ctx.beginPath();
	ctx.moveTo(...P(...nt));
	ctx.lineTo(...P(...muzzle));
	ctx.stroke();
	ellipse(ctx, muzzle[0], muzzle[1], 0.12, 0.1, headA);
	// ears
	ctx.beginPath();
	ctx.moveTo(...P(nt[0] - 0.06, nt[1] + 0.08));
	ctx.lineTo(...P(nt[0] - 0.02, nt[1] + 0.26));
	ctx.lineTo(...P(nt[0] + 0.08, nt[1] + 0.1));
	ctx.fill();
	// mane: flame tongues along the neck
	for (let k = 0; k < 6; k++) {
		const f = k / 5;
		const mx = lerp(nb[0] - 0.12, nt[0] - 0.05, f);
		const my = lerp(nb[1] + 0.12, nt[1] + 0.1, f);
		const flick = 0.1 * Math.sin(t * 13 + k * 1.7 + seed);
		ctx.beginPath();
		ctx.moveTo(...P(mx - 0.08, my));
		ctx.quadraticCurveTo(...P(mx - 0.2, my + 0.12), ...P(mx - 0.32 + flick, my + 0.22 + 0.06 * Math.sin(t * 9 + k)));
		ctx.quadraticCurveTo(...P(mx - 0.06, my + 0.12), ...P(mx + 0.08, my));
		ctx.fill();
	}
	// tail: a long flowing flame
	const tb = L(-0.88, 0.2);
	const wave = Math.sin(t * 7 + seed) * 0.12;
	ctx.beginPath();
	ctx.moveTo(...P(tb[0] + 0.05, tb[1] + 0.1));
	ctx.bezierCurveTo(...P(tb[0] - 0.4, tb[1] + 0.35 + wave), ...P(tb[0] - 0.75, tb[1] + 0.1 - wave), ...P(tb[0] - 1.05, tb[1] + 0.2 + wave));
	ctx.bezierCurveTo(...P(tb[0] - 0.7, tb[1] - 0.12 - wave), ...P(tb[0] - 0.35, tb[1] - 0.05), ...P(tb[0] + 0.05, tb[1] - 0.1));
	ctx.fill();
};

const chariot = (ctx: Ctx, wheel: number, t: number) => {
	ctx.fillStyle = ctx.strokeStyle = 'rgb(255,200,0)';
	ctx.lineCap = 'round';
	// pole and traces to the horses
	ctx.lineWidth = 0.07 * TEAM_PX;
	ctx.beginPath();
	ctx.moveTo(...P(-1.05, 0.62));
	ctx.quadraticCurveTo(...P(-0.2, 0.95), ...P(0.62, 1.12));
	ctx.stroke();
	// car: open at the back, tall curved guard at the front
	ctx.beginPath();
	ctx.moveTo(...P(-2.2, 0.5));
	ctx.lineTo(...P(-1.05, 0.5));
	ctx.quadraticCurveTo(...P(-0.95, 0.95), ...P(-1.2, 1.18));
	ctx.quadraticCurveTo(...P(-1.6, 1.12 + 0.02 * Math.sin(t * 11)), ...P(-2.0, 0.92));
	ctx.lineTo(...P(-2.2, 0.82));
	ctx.closePath();
	ctx.fill();
	// wheel: rim, hub, six spokes turning
	const [wx, wy] = [-1.6, 0.44];
	ctx.lineWidth = 0.075 * TEAM_PX;
	ctx.beginPath();
	ctx.arc(...P(wx, wy), 0.43 * TEAM_PX, 0, Math.PI * 2);
	ctx.stroke();
	ctx.lineWidth = 0.05 * TEAM_PX;
	for (let k = 0; k < 6; k++) {
		const a = wheel + (k * Math.PI) / 3;
		ctx.beginPath();
		ctx.moveTo(...P(wx, wy));
		ctx.lineTo(...P(wx + Math.cos(a) * 0.42, wy + Math.sin(a) * 0.42));
		ctx.stroke();
	}
	ellipse(ctx, wx, wy, 0.09, 0.09);
};

export type TeamPose = {phases: [number, number]; rear: number; wheel: number; t: number};

export const drawTeam = (ctx: Ctx, pose: TeamPose) => {
	ctx.clearRect(0, 0, TEAM_W, TEAM_H);
	chariot(ctx, pose.wheel, pose.t);
	horse(ctx, 1.5, 1.32, pose.phases[1], pose.rear, pose.t, 150, 2.1); // far horse
	horse(ctx, 1.12, 1.2, pose.phases[0], pose.rear, pose.t, 255, 0.4); // near horse
};
