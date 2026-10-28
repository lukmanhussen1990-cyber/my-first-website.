import {useMemo} from 'react';
import * as THREE from 'three';
import {blobShadow, meta, tex} from '../lib/textures';
import {applyLook, makeSpriteMaterial, SpriteLook} from '../render/spriteMaterial';

// Places a character in the world: feet on `position`, scale in sprite pixels per metre, facing ±1
// (sprites face right), optional yaw and lean (the camera's pitch) so the cut-out keeps facing the
// camera without foreshortening. Children work in sprite pixels (y up, feet at 0).
export const CharacterRoot: React.FC<{
	position: [number, number, number];
	pxPerM: number;
	facing?: number;
	yaw?: number;
	tilt?: number;
	lean?: number;
	shadow?: {w: number; d: number; opacity: number; offset?: [number, number]} | null;
	shadowOrder?: number;
	children: React.ReactNode;
}> = ({position, pxPerM, facing = 1, yaw = 0, tilt = 0, lean = 0, shadow = {w: 0.95, d: 0.38, opacity: 0.32}, shadowOrder = 0, children}) => {
	const s = 1 / pxPerM;
	return (
		<group position={position} rotation-y={yaw}>
			{shadow && <BlobShadow {...shadow} renderOrder={shadowOrder} />}
			<group rotation-x={-lean}>
				<group rotation-z={tilt} scale={[s * facing, s, s]}>
					{children}
				</group>
			</group>
		</group>
	);
};

export const BlobShadow: React.FC<{w: number; d: number; opacity: number; offset?: [number, number]; renderOrder?: number; color?: string}> = ({
	w,
	d,
	opacity,
	offset = [0, 0],
	renderOrder = 0,
	color = '#1a1020',
}) => {
	const mat = useMemo(
		() => new THREE.MeshBasicMaterial({map: blobShadow(), color, transparent: true, depthWrite: false, opacity, fog: false}),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[],
	);
	mat.opacity = opacity;
	mat.color.set(color);
	return (
		<mesh position={[offset[0], 0.012, offset[1]]} rotation-x={-Math.PI / 2} material={mat} renderOrder={renderOrder}>
			<planeGeometry args={[w, d]} />
		</mesh>
	);
};

export type SpriteWarp = {
	breath?: number;
	lean?: number;
	tilt?: [number, number, number, number];
	hem?: [number, number, number];
	wave?: [number, number, number, number];
};

// One pose image with its foot point at the local origin (pixel units).
export const PoseSprite: React.FC<{
	sprite: string;
	look?: SpriteLook;
	warp?: SpriteWarp;
	renderOrder?: number;
	segs?: [number, number];
	anchor?: [number, number]; // pixel in the sprite that sits on the origin (default: foot point)
	visible?: boolean;
}> = ({sprite, look, warp, renderOrder = 0, segs = [6, 24], anchor, visible = true}) => {
	const m = meta(sprite);
	const {mesh, mat} = useMemo(() => {
		const geo = new THREE.PlaneGeometry(m.w, m.h, segs[0], segs[1]);
		const material = makeSpriteMaterial(tex(sprite), m.w, m.h);
		const me = new THREE.Mesh(geo, material);
		me.frustumCulled = false;
		return {mesh: me, mat: material};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [sprite]);
	applyLook(mat, look);
	const u = mat.uniforms;
	u.uBreath.value.set(warp?.breath ?? 0, 0.42, 0, 0);
	u.uLean.value = warp?.lean ?? 0;
	u.uTilt.value.set(warp?.tilt?.[0] ?? 0, warp?.tilt?.[1] ?? 0.5, warp?.tilt?.[2] ?? 0.2, warp?.tilt?.[3] ?? 0.2);
	u.uHem.value.set(warp?.hem?.[0] ?? 0, warp?.hem?.[1] ?? 0.6, warp?.hem?.[2] ?? 1, 0);
	u.uWave.value.set(warp?.wave?.[0] ?? 0, warp?.wave?.[1] ?? 6, warp?.wave?.[2] ?? 0, warp?.wave?.[3] ?? 0);
	mesh.renderOrder = renderOrder;
	mesh.visible = visible && (look?.opacity ?? 1) > 0.002;
	const [ax, ay] = anchor ?? m.foot;
	return <primitive object={mesh} position={[m.w / 2 - ax, ay - m.h / 2, 0]} />;
};

// Pixels per metre for every sheet, so each pose of a character shares one scale
// (standing height: Jesus 1.80 m, Judas 1.75 m; seated and close-up sheets matched by eye).
export const PX_PER_M: Record<string, number> = {
	'jesus/side': 559,
	'jesus/threequarter': 559,
	'jesus/back': 555,
	'jesus/stand': 399,
	'jesus/robe_off': 399,
	'jesus/towel_tie': 399,
	'jesus/pour': 399,
	'jesus/kiss_stand': 462,
	'jesus/kneel_wash': 462,
	'jesus/kneel_lookup': 462,
	'jesus/laugh_sit': 462,
	'judas/side': 569,
	'judas/threequarter': 569,
	'judas/back': 563,
	'judas/palm': 398,
	'judas/walk': 398,
	'judas/lean': 398,
	'judas/sit_stiff': 398,
	'judas/sit_away': 398,
	kiss: 1500,
	disciples: 372,
	crowd: 262,
	'guests/seated': 470,
	'guests/g5': 323,
};
export const pxPerM = (sprite: string) =>
	PX_PER_M[sprite] ?? PX_PER_M[sprite.split('/')[0]] ?? (sprite.startsWith('guests/') ? PX_PER_M['guests/seated'] : 500);
