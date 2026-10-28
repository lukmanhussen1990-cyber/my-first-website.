import {useMemo} from 'react';
import * as THREE from 'three';
import {blobShadow, meta, tex} from '../lib/textures';
import {applyLook, makeSpriteMaterial, SpriteLook} from '../render/spriteMaterial';

// Places a character in the world: feet on `position`, height in metres, facing ±1 (sprites face right),
// optional yaw and lean (the camera's pitch) so the cut-out keeps facing the camera without foreshortening.
// Children work in sprite pixels (y up, feet at 0).
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

export const BlobShadow: React.FC<{w: number; d: number; opacity: number; offset?: [number, number]; renderOrder?: number}> = ({
	w,
	d,
	opacity,
	offset = [0, 0],
	renderOrder = 0,
}) => {
	const mat = useMemo(
		() => new THREE.MeshBasicMaterial({map: blobShadow(), color: '#2a1a0c', transparent: true, depthWrite: false, opacity, fog: true}),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[],
	);
	mat.opacity = opacity;
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
}> = ({sprite, look, warp, renderOrder = 0, segs = [6, 24], anchor}) => {
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
	const [ax, ay] = anchor ?? m.foot;
	return <primitive object={mesh} position={[m.w / 2 - ax, ay - m.h / 2, 0]} />;
};

// Standing height in pixels for each sheet, so every pose of a character shares one scale.
export const STANDING_PX: Record<string, number> = {
	'elijah/side': 992,
	'elijah/threequarter': 995,
	'elijah/poses': 596,
	'elisha/side': 1008,
	'elisha/poses': 618,
	'enoch/side': 983,
	'enoch/threequarter': 989,
	'moses/side': 983,
	'jesus/front': 989,
	disciples: 618,
};
