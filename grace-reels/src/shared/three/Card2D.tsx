import React, {useLayoutEffect, useMemo} from 'react';
import * as THREE from 'three';
import {camBasis, useShot, type Vec3} from './shot';

// A flat paper-cut card in the 3D world, drawn every frame by `draw` (canvas px, y down).
// `light` is the sun direction in the card's 2D space, so drawings shade like the figures.
export const Card2D: React.FC<{
	at: Vec3;
	size: [number, number];
	res?: number;
	draw: (g: CanvasRenderingContext2D, w: number, h: number, light: [number, number], screenPxPerCanvasPx: number) => void;
	billboard?: boolean;
	rotation?: Vec3;
	tint?: THREE.Color | null;
	shadow?: boolean;
	renderOrder?: number;
}> = ({at, size, res = 1024, draw, billboard = true, rotation, tint, shadow = false, renderOrder = 0}) => {
	const shot = useShot();
	const ch = res;
	const cw = Math.round((res * size[0]) / size[1]);
	const {canvas, tex, mat, depthMat} = useMemo(() => {
		const canvas = document.createElement('canvas');
		canvas.width = cw;
		canvas.height = ch;
		const tex = new THREE.CanvasTexture(canvas);
		tex.colorSpace = THREE.SRGBColorSpace;
		tex.anisotropy = 8;
		const mat = new THREE.MeshBasicMaterial({map: tex, alphaTest: 0.5, side: THREE.DoubleSide, fog: true});
		const depthMat = new THREE.MeshDepthMaterial({depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5});
		return {canvas, tex, mat, depthMat};
	}, [cw, ch]);
	useLayoutEffect(() => () => {
		tex.dispose();
		mat.dispose();
		depthMat.dispose();
	}, [tex, mat, depthMat]);
	const cam = shot.cam;
	const basis = camBasis(cam);
	const dist = Math.max(0.2, new THREE.Vector3(...at).sub(new THREE.Vector3(...cam.pos)).dot(basis.fwd));
	const pxPerM = shot.H / 2 / (Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * dist);
	let lx = shot.sunDir.dot(basis.right);
	let ly = -shot.sunDir.dot(basis.up);
	const l = Math.hypot(lx, ly) || 1;
	lx /= l;
	ly /= l;
	useLayoutEffect(() => {
		const g = canvas.getContext('2d')!;
		g.setTransform(1, 0, 0, 1, 0, 0);
		g.clearRect(0, 0, cw, ch);
		draw(g, cw, ch, [lx, ly], pxPerM * (size[1] / ch));
		g.setTransform(1, 0, 0, 1, 0, 0);
		tex.needsUpdate = true;
		mat.color.copy(tint ?? shot.sun.figureTint);
	});
	const rotY = Math.atan2(cam.pos[0] - at[0], cam.pos[2] - at[2]);
	return (
		<group position={at} rotation={billboard ? [0, rotY, 0] : rotation}>
			<mesh material={mat} customDepthMaterial={depthMat} castShadow={shadow} renderOrder={renderOrder}>
				<planeGeometry args={size} />
			</mesh>
		</group>
	);
};
