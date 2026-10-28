// The code-drawn characters as cut-out rigs: one textured plane per part (head, neck, torso, skirt,
// arms, hands, legs, feet, hair, beard, brows, mouth), parented at their joints and rotated by the pose.
// Every part gets the screen-space outline and the two-tone cel shading from the sprite shader; the cel
// light is turned into each part's own frame so the shadow side always faces away from the scene light.
// Hands and mouths swap between drawn variants; eyelids are painted in code for the blinks; every part
// casts a shadow with its own silhouette (alpha-tested depth material).
import {useMemo} from 'react';
import * as THREE from 'three';
import rigsJson from './rigs.json';
import {hash} from '../lib/random';
import {canvasTexture, meta, tex} from '../lib/textures';
import {applyLook, makeSpriteMaterial, SpriteLook} from '../render/spriteMaterial';
import {CharacterRoot} from './Character';

type Variant = {sprite: string; pivot: [number, number]};
type PartDef = {sprite: string; pivot: [number, number]; parent: string | null; at?: [number, number]; z: number; variants?: Record<string, Variant>};
export type ViewRig = {
	scale: number;
	heightPx: number;
	root: string;
	sole: [number, number];
	order: string[];
	parts: Record<string, PartDef>;
	eyes: {c: [number, number]; w: number; h: number}[];
	skin: string;
};
export type CharId = 'farmer' | 'jesus' | 'servantA' | 'servantB' | 'servantC' | 'enemy' | 'saul' | 'paul' | 'soldier' | 'reaper';
export type View = 'side' | 'tq' | 'back' | 'macro';
export const RIGS = rigsJson as unknown as Record<CharId, Partial<Record<View, ViewRig>>>;

export type PartWarp = {hem?: [number, number, number]; wave?: [number, number, number, number]; tilt?: [number, number, number, number]; breath?: number};
export type Pose = {
	angles?: Record<string, number>; // degrees, counter-clockwise on screen for a figure facing right
	offsets?: Record<string, [number, number]>; // extra shift in the parent's image px (x right, y down)
	lift?: [number, number]; // whole body shift in px (x right, y up)
	variants?: Record<string, string>; // e.g. {hand_near: 'open', mouth: 'talk'}
	hide?: string[];
	warps?: Record<string, PartWarp>;
	shut?: number; // force the eyes shut (0..1)
	// props held or worn: a prop sprite placed in a part's image px (its grip point at `at`), turned by `angle` degrees
	props?: {part: string; sprite: string; at?: [number, number]; angle?: number; scale?: number; behind?: boolean; opacity?: number}[];
};

// figure px at scale 1 per metre (a 1960 px figure is 1.78 m)
export const PX_PER_M = 1100;

// 0 = open, 1 = shut. Seeded intervals of 2.4–4.6 s; each blink closes fast and opens a bit slower.
export const blinkAt = (t: number, seed: number) => {
	let tb = -12 + hash(seed, 0) * 2;
	for (let k = 0; tb < t + 0.2; k++) {
		const d = t - tb;
		if (d >= 0 && d < 0.15) return d < 0.05 ? d / 0.05 : 1 - (d - 0.05) / 0.1;
		tb += 2.4 + hash(seed, k + 1) * 2.2;
	}
	return 0;
};

const lidTexture = () =>
	canvasTexture('wwLid', 128, 128, (ctx) => {
		ctx.fillStyle = '#ffffff';
		ctx.beginPath();
		ctx.ellipse(64, 60, 60, 60, 0, 0, Math.PI * 2);
		ctx.fill();
		ctx.strokeStyle = '#2b1d12';
		ctx.lineWidth = 9;
		ctx.lineCap = 'round';
		ctx.beginPath();
		ctx.moveTo(10, 74);
		ctx.quadraticCurveTo(64, 104, 118, 70);
		ctx.stroke();
	});

const SEGS: Record<string, [number, number]> = {torso: [4, 24], skirt: [6, 24], hair: [4, 12], hair_back: [6, 16], beard: [4, 10]};
const NO_OUTLINE = new Set(['mouth', 'brow_near', 'brow_far']);

type Mesh = {mesh: THREE.Mesh; mat: ReturnType<typeof makeSpriteMaterial>; w: number; h: number; pivot: [number, number]};

const makeMesh = (sprite: string, pivot: [number, number], seg: [number, number]): Mesh => {
	const m = meta(sprite);
	const geo = new THREE.PlaneGeometry(m.w, m.h, seg[0], seg[1]);
	const mat = makeSpriteMaterial(tex(sprite), m.w, m.h);
	const mesh = new THREE.Mesh(geo, mat);
	mesh.frustumCulled = false;
	mesh.customDepthMaterial = new THREE.MeshDepthMaterial({depthPacking: THREE.RGBADepthPacking, map: tex(sprite), alphaTest: 0.5});
	mesh.position.set(m.w / 2 - pivot[0], -(m.h / 2 - pivot[1]), 0);
	return {mesh, mat, w: m.w, h: m.h, pivot};
};

export type PuppetLook = SpriteLook & {lightDir?: [number, number]; celAmount?: number; celColor?: THREE.ColorRepresentation};

// Parts are stacked toward the camera in draw order (px), so a figure that writes depth stays in order.
const Z_STEP = 1.5;

export const Puppet: React.FC<{
	id: CharId;
	view: View;
	pose: Pose;
	look?: PuppetLook;
	facing?: number;
	t: number;
	blinkSeed?: number | null;
	renderOrder?: number;
	castShadow?: boolean;
}> = ({id, view, pose, look = {}, facing = 1, t, blinkSeed = null, renderOrder = 0, castShadow = true}) => {
	const rig = RIGS[id][view];
	if (!rig) throw new Error(`no rig ${id}/${view}`);
	const parts = useMemo(() => {
		const out: Record<string, {base: Mesh; variants: Record<string, Mesh>}> = {};
		for (const [name, def] of Object.entries(rig.parts)) {
			const seg = SEGS[name] ?? [1, 1];
			const base = makeMesh(def.sprite, def.pivot, seg);
			const variants: Record<string, Mesh> = {};
			for (const [k, v] of Object.entries(def.variants ?? {})) variants[k] = makeMesh(v.sprite, v.pivot, seg);
			out[name] = {base, variants};
		}
		return out;
	}, [rig]);
	const lids = useMemo(
		() =>
			rig.eyes.map(() => {
				const mat = new THREE.MeshBasicMaterial({map: lidTexture(), transparent: true, depthWrite: false});
				const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
				mesh.frustumCulled = false;
				return {mesh, mat};
			}),
		[rig],
	);

	// accumulated rotation of each part (degrees) for turning the cel light into its frame
	const worldAngle: Record<string, number> = {};
	const angleOf = (name: string): number => {
		if (worldAngle[name] !== undefined) return worldAngle[name];
		const def = rig.parts[name];
		const own = pose.angles?.[name] ?? 0;
		worldAngle[name] = own + (def.parent ? angleOf(def.parent) : 0);
		return worldAngle[name];
	};
	const L = look.lightDir ?? [-0.6, 0.8];
	const lx = L[0] * facing;
	const ly = L[1];

	const shut = Math.max(pose.shut ?? 0, blinkSeed === null || (look.sil ?? 0) > 0 || (look.opacity ?? 1) < 0.5 ? 0 : blinkAt(t, blinkSeed));
	const skin = new THREE.Color(rig.skin).multiply(new THREE.Color(look.tint ?? '#ffffff'));

	rig.order.forEach((name, i) => {
		const p = parts[name];
		const a = (-angleOf(name) * Math.PI) / 180;
		const dir: [number, number] = [lx * Math.cos(a) - ly * Math.sin(a), lx * Math.sin(a) + ly * Math.cos(a)];
		const want = pose.variants?.[name];
		const all = [p.base, ...Object.values(p.variants)];
		const active = want && p.variants[want] ? p.variants[want] : p.base;
		const w = pose.warps?.[name];
		for (const m of all) {
			const on = m === active && !pose.hide?.includes(name);
			m.mesh.visible = on && (look.opacity ?? 1) > 0.002;
			if (!on) continue;
			m.mesh.position.z = i * Z_STEP;
			applyLook(m.mat, {
				solid: true,
				...look,
				outline: NO_OUTLINE.has(name) ? 0 : look.outline ?? 5,
				cel: {dir, amount: look.celAmount ?? 0.85, color: look.celColor ?? '#b4a2b6', radius: 46 * rig.scale, bias: 4.2},
			});
			const u = m.mat.uniforms;
			u.uHem.value.set(w?.hem?.[0] ?? 0, w?.hem?.[1] ?? 0.6, w?.hem?.[2] ?? 1, 0);
			u.uWave.value.set(w?.wave?.[0] ?? 0, w?.wave?.[1] ?? 6, w?.wave?.[2] ?? 0, w?.wave?.[3] ?? 0);
			u.uTilt.value.set(w?.tilt?.[0] ?? 0, w?.tilt?.[1] ?? 0.5, w?.tilt?.[2] ?? 0.2, w?.tilt?.[3] ?? 0.2);
			u.uBreath.value.set(w?.breath ?? 0, 0.45, 0, 0);
			m.mesh.renderOrder = renderOrder + i * 0.01;
			m.mesh.castShadow = castShadow;
		}
	});
	lids.forEach((l, k) => {
		const e = rig.eyes[k];
		l.mesh.visible = shut > 0.02 && !pose.hide?.includes('head');
		l.mat.color.copy(skin);
		l.mat.opacity = look.opacity ?? 1;
		const iw = e.w * 2.25;
		const ih = e.h * 2.35;
		l.mesh.scale.set(iw, ih * Math.max(0.02, shut), 1);
		l.mesh.renderOrder = renderOrder + rig.order.indexOf('head') * 0.01 + 0.005;
	});

	const node = (name: string): React.ReactNode => {
		const def = rig.parts[name];
		const parent = def.parent ? rig.parts[def.parent] : null;
		const off = pose.offsets?.[name] ?? [0, 0];
		const pos: [number, number, number] = parent && def.at ? [def.at[0] - parent.pivot[0] + off[0], -(def.at[1] - parent.pivot[1] + off[1]), 0] : [0, 0, 0];
		const p = parts[name];
		const kids = Object.entries(rig.parts).filter(([, d]) => d.parent === name).map(([n]) => n);
		return (
			<group key={name} position={pos} rotation-z={((pose.angles?.[name] ?? 0) * Math.PI) / 180}>
				<primitive object={p.base.mesh} />
				{Object.values(p.variants).map((m, k) => (
					<primitive key={k} object={m.mesh} />
				))}
				{(pose.props ?? [])
					.filter((pr) => pr.part === name)
					.map((pr, k) => (
						<PropSprite
							key={`prop${k}`}
							prop={pr}
							partPivot={def.pivot}
							scale={rig.scale}
							order={renderOrder + rig.order.indexOf(name) * 0.01 + (pr.behind ? -0.004 : 0.004)}
							z={(rig.order.indexOf(name) + (pr.behind ? -0.5 : 0.5)) * Z_STEP}
							look={look}
						/>
					))}
				{name === 'head' &&
					lids.map((l, k) => {
						const e = rig.eyes[k];
						const ih = e.h * 2.35;
						// the lid comes down from the top of the eye
						return <primitive key={`lid${k}`} object={l.mesh} position={[e.c[0] - def.pivot[0], -(e.c[1] - def.pivot[1]) + (ih / 2) * (1 - Math.max(0.02, shut)) - ih * 0.04, rig.order.indexOf('head') * Z_STEP + Z_STEP * 0.5]} />;
					})}
				{kids.map(node)}
			</group>
		);
	};
	const lift = pose.lift ?? [0, 0];
	return <group position={[-rig.sole[0] + lift[0], rig.sole[1] + lift[1], 0]}>{node(rig.root)}</group>;
};

// A held prop (sickle, scroll, sheaf, quill): its own sprite with the same outline and cel look.
const PropSprite: React.FC<{prop: NonNullable<Pose['props']>[number]; partPivot: [number, number]; scale: number; order: number; z: number; look: PuppetLook}> = ({prop, partPivot, scale, order, z, look}) => {
	const m = meta(prop.sprite) as ReturnType<typeof meta> & {pivot?: [number, number]};
	const grip = m.pivot ?? [m.w / 2, m.h / 2];
	const mm = useMemo(() => makeMesh(prop.sprite, grip, [1, 1]), [prop.sprite]);
	applyLook(mm.mat, {solid: true, ...look, opacity: (look.opacity ?? 1) * (prop.opacity ?? 1), outline: look.outline ?? 5, cel: {dir: look.lightDir ?? [-0.6, 0.8], amount: (look.celAmount ?? 0.85) * 0.8, color: look.celColor ?? '#b4a2b6', radius: 30, bias: 4}});
	mm.mesh.renderOrder = order;
	mm.mesh.visible = (look.opacity ?? 1) * (prop.opacity ?? 1) > 0.002;
	const at = prop.at ?? partPivot;
	const s = (prop.scale ?? 1) * scale;
	return (
		<group position={[at[0] - partPivot[0], -(at[1] - partPivot[1]), z]} rotation-z={((prop.angle ?? 0) * Math.PI) / 180} scale={[s, s, 1]}>
			<primitive object={mm.mesh} />
		</group>
	);
};

// A whole person standing in the world: feet on `position`, facing ±1 (drawn facing right), turned
// by `yaw` toward the camera, about `heightM` tall.
export const Person: React.FC<{
	id: CharId;
	view: View;
	position: [number, number, number];
	pose: Pose;
	t: number;
	facing?: number;
	yaw?: number;
	lean?: number;
	heightM?: number;
	look?: PuppetLook;
	blinkSeed?: number | null;
	renderOrder?: number;
	shadow?: {w: number; d: number; opacity: number; offset?: [number, number]} | null;
	castShadow?: boolean;
}> = ({id, view, position, pose, t, facing = 1, yaw = 0, lean = 0, heightM, look, blinkSeed = null, renderOrder = 0, shadow = {w: 0.8, d: 0.32, opacity: 0.3}, castShadow = true}) => {
	const rig = RIGS[id][view]!;
	const hM = heightM ?? rig.heightPx / rig.scale / PX_PER_M;
	return (
		<CharacterRoot position={position} pxPerM={rig.heightPx / hM} facing={facing} yaw={yaw} lean={lean} shadow={shadow} shadowOrder={renderOrder - 1}>
			<Puppet id={id} view={view} pose={pose} look={look} facing={facing} t={t} blinkSeed={blinkSeed} renderOrder={renderOrder} castShadow={castShadow} />
		</CharacterRoot>
	);
};
