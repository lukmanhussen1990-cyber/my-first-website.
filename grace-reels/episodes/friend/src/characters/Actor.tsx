// A character played from GPT pose images (rig method 2): the pose sprite with mesh warps for breath,
// lean and head tilt, a blink painted in code over the eye, and a quick two-frame smear when it switches
// to another pose. All a pure function of time.
import {useMemo} from 'react';
import * as THREE from 'three';
import eyesJson from '../../public/sprites/eyes.json';
import {hash} from '../lib/random';
import {canvasTexture, meta} from '../lib/textures';
import type {SpriteLook} from '../render/spriteMaterial';
import {CharacterRoot, PoseSprite, pxPerM, SpriteWarp} from './Character';

type Eye = {eye: [number, number]; size: [number, number]; skin: string};
const EYES = eyesJson as unknown as Record<string, Eye>;

// 0 = open, 1 = shut. Seeded intervals of 2.6–4.8 s; each blink closes fast and opens a bit slower.
export const blinkAt = (t: number, seed: number) => {
	let tb = -12 + hash(seed, 0) * 2;
	for (let k = 0; tb < t + 0.2; k++) {
		const d = t - tb;
		if (d >= 0 && d < 0.16) return d < 0.05 ? d / 0.05 : 1 - (d - 0.05) / 0.11;
		tb += 2.6 + hash(seed, k + 1) * 2.2;
	}
	return 0;
};

const lidTexture = () =>
	canvasTexture('lid', 64, 64, (ctx) => {
		ctx.fillStyle = '#ffffff';
		ctx.beginPath();
		ctx.ellipse(32, 30, 30, 30, 0, 0, Math.PI * 2);
		ctx.fill();
		// the closed-eye line, in the outline brown (the lid is tinted with the skin colour)
		ctx.strokeStyle = '#2a1a10';
		ctx.globalCompositeOperation = 'source-over';
		ctx.lineWidth = 5;
		ctx.lineCap = 'round';
		ctx.beginPath();
		ctx.moveTo(6, 36);
		ctx.quadraticCurveTo(32, 50, 58, 34);
		ctx.stroke();
	});

// Where a sprite pixel ends up after the same tilt/lean warp the shader applies (y-down sprite pixels in,
// y-up pixels relative to the image centre out).
const warpPoint = (px: number, py: number, w: number, h: number, warp?: SpriteWarp): [number, number] => {
	let x = px - w / 2;
	let y = h / 2 - py;
	const v = py / h;
	const tl = warp?.tilt;
	if (tl && tl[0] !== 0) {
		const edge = tl[3];
		const wgt = v < edge - 0.025 ? 1 : v > edge + 0.025 ? 0 : (edge + 0.025 - v) / 0.05;
		const a = tl[0] * wgt;
		const pivx = (tl[1] - 0.5) * w;
		const pivy = (0.5 - tl[2]) * h;
		const dx = x - pivx;
		const dy = y - pivy;
		x = pivx + Math.cos(a) * dx - Math.sin(a) * dy;
		y = pivy + Math.sin(a) * dx + Math.cos(a) * dy;
	}
	x += (warp?.lean ?? 0) * (1 - v);
	return [x, y];
};

// A pose image with an optional blink, planted on its foot point (pixel units; use inside CharacterRoot).
export const PoseWithBlink: React.FC<{
	sprite: string;
	t: number;
	blinkSeed?: number | null;
	shut?: number; // force the eyes closed (0..1), e.g. Judas closing his eyes for the kiss
	look?: SpriteLook;
	warp?: SpriteWarp;
	renderOrder?: number;
	anchor?: [number, number];
	segs?: [number, number];
}> = ({sprite, t, blinkSeed, shut = 0, look, warp, renderOrder = 0, anchor, segs}) => {
	const m = meta(sprite);
	const eye = EYES[sprite];
	const lid = useMemo(() => {
		const mat = new THREE.MeshBasicMaterial({map: lidTexture(), transparent: true, depthWrite: false, fog: false});
		const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
		mesh.frustumCulled = false;
		return {mat, mesh};
	}, []);
	const opacity = look?.opacity ?? 1;
	const closed = eye && blinkSeed !== null && opacity > 0.5 && !(look?.sil ?? 0) ? Math.max(shut, blinkSeed === undefined ? 0 : blinkAt(t, blinkSeed)) : 0;
	const [ax, ay] = anchor ?? m.foot;
	let lidNode: React.ReactNode = null;
	if (eye && closed > 0.02) {
		const [ex, ey] = warpPoint(eye.eye[0], eye.eye[1], m.w, m.h, warp);
		const [lw, lh] = eye.size;
		// skin colour times the shot's tint, so the lid matches the lit face
		const c = new THREE.Color(eye.skin).multiply(new THREE.Color(look?.tint ?? '#ffffff'));
		lid.mat.color.copy(c);
		lid.mat.opacity = opacity;
		lid.mesh.scale.set(lw, lh * closed, 1);
		lid.mesh.renderOrder = renderOrder + 0.5;
		// the lid comes down from the top of the eye
		lidNode = <primitive object={lid.mesh} position={[ex + m.w / 2 - ax, ey - m.h / 2 + ay + (lh * (1 - closed)) / 2, 0.2]} />;
	}
	return (
		<>
			<PoseSprite sprite={sprite} look={look} warp={warp} renderOrder={renderOrder} anchor={anchor} segs={segs} />
			{lidNode}
		</>
	);
};

// Which pose is showing at time t for a list of [time, pose] keys, with a 2-frame cross-switch.
export const poseAt = (t: number, keys: [number, string][], smear = 0.067) => {
	let i = 0;
	while (i + 1 < keys.length && t >= keys[i + 1][0]) i++;
	const cur = keys[i];
	const next = keys[i + 1];
	if (next && t > next[0] - smear) return {a: cur[1], b: next[1], m: (t - (next[0] - smear)) / smear};
	return {a: cur[1], b: null as string | null, m: 0};
};

// A whole character in the world: position (feet), facing, poses over time, warps, look and blinks.
// Each pose keeps its own sheet scale (pxPerM table), so switching poses never changes his size.
export const Actor: React.FC<{
	position: [number, number, number];
	t: number;
	poses: [number, string][];
	facing?: number;
	look?: SpriteLook;
	warp?: SpriteWarp | ((pose: string) => SpriteWarp);
	blinkSeed?: number | null;
	shut?: number;
	renderOrder?: number;
	shadow?: {w: number; d: number; opacity: number; offset?: [number, number]} | null;
	yaw?: number;
	lean?: number;
	scale?: number;
	smear?: number;
}> = ({position, t, poses, facing = 1, look, warp, blinkSeed, shut, renderOrder = 0, shadow = null, yaw = 0, lean = 0, scale = 1, smear = 0.067}) => {
	const p = poseAt(t, poses, smear);
	const w = (s: string) => (typeof warp === 'function' ? warp(s) : warp);
	const show = (s: string, op: number, blur: number, order: number) => (
		<CharacterRoot key={s} position={position} pxPerM={pxPerM(s) / scale} facing={facing} yaw={yaw} lean={lean} shadow={null}>
			<PoseWithBlink sprite={s} t={t} blinkSeed={blinkSeed} shut={shut} look={{...look, opacity: (look?.opacity ?? 1) * op, blur: (look?.blur ?? 0) + blur}} warp={w(s)} renderOrder={order} />
		</CharacterRoot>
	);
	return (
		<>
			{shadow && (
				<CharacterRoot position={position} pxPerM={1} shadow={shadow} shadowOrder={renderOrder - 1}>
					<group />
				</CharacterRoot>
			)}
			{p.b ? (
				<>
					{show(p.a, 1 - p.m, 4 * Math.sin(Math.PI * p.m), renderOrder)}
					{show(p.b, p.m, 4 * Math.sin(Math.PI * p.m), renderOrder + 0.1)}
				</>
			) : (
				show(p.a, 1, 0, renderOrder)
			)}
		</>
	);
};
