import React, {useLayoutEffect, useMemo} from 'react';
import * as THREE from 'three';
import {drawFigure, type FigureInfo, type Look, type Pose} from '../rig/paperdoll';
import {camBasis, useShot, type Vec3} from './shot';
import {clamp} from '../math';

// FU windows: what part of the figure the canvas covers (x0, y0, x1, y1), feet at y = 0.
export const WINDOWS = {
	full: [-600, -1480, 600, 70] as const,
	portrait: [-330, -1090, 330, -540] as const,
	bust: [-420, -1120, 420, -330] as const,
};
type Win = readonly [number, number, number, number];

type Props = {
	look: Look;
	pose: Pose;
	at: Vec3;
	height?: number; // metres for 1000 FU
	facing?: 1 | -1;
	win?: Win;
	res?: number; // canvas height in px
	shadow?: boolean;
	outlinePx?: number;
	tint?: THREE.Color | null;
	brightness?: number;
	renderOrder?: number;
	yaw?: number; // fixed billboard yaw instead of facing the camera
	depthTest?: boolean;
	info?: (i: FigureInfo & {toWorld: (p: [number, number]) => Vec3}) => void;
};

const OUTLINE_PX = 5;

// A paper-cut figure standing in the 3D world: a camera-facing card drawn every frame, plus
// an invisible sun-facing twin that casts a shadow in the shape of the figure.
export const Figure: React.FC<Props> = ({
	look,
	pose,
	at,
	height = 1.75,
	facing = 1,
	win = WINDOWS.full,
	res = 1024,
	shadow = true,
	outlinePx = OUTLINE_PX,
	tint,
	brightness = 1,
	renderOrder = 0,
	yaw,
	depthTest = true,
	info,
}) => {
	const shot = useShot();
	const u = (height * (look.height ?? 1)) / (1000 * (look.height ?? 1)); // metres per FU
	const [x0, y0, x1, y1] = win;
	const wFU = x1 - x0;
	const hFU = y1 - y0;
	const ch = Math.round(res);
	const cw = Math.round((res * wFU) / hFU);

	const {canvas, tex, mat, shadowMat, depthMat, geo} = useMemo(() => {
		const canvas = document.createElement('canvas');
		canvas.width = cw;
		canvas.height = ch;
		const tex = new THREE.CanvasTexture(canvas);
		tex.colorSpace = THREE.SRGBColorSpace;
		tex.anisotropy = 8;
		tex.generateMipmaps = true;
		tex.minFilter = THREE.LinearMipmapLinearFilter;
		const mat = new THREE.MeshBasicMaterial({map: tex, alphaTest: 0.5, side: THREE.DoubleSide, fog: true});
		const shadowMat = new THREE.MeshBasicMaterial({colorWrite: false, depthWrite: false, side: THREE.DoubleSide});
		const depthMat = new THREE.MeshDepthMaterial({depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5, side: THREE.DoubleSide});
		const geo = new THREE.PlaneGeometry(1, 1);
		return {canvas, tex, mat, shadowMat, depthMat, geo};
	}, [cw, ch]);

	useLayoutEffect(() => () => {
		tex.dispose();
		mat.dispose();
		shadowMat.dispose();
		depthMat.dispose();
		geo.dispose();
	}, [tex, mat, shadowMat, depthMat, geo]);

	const cam = shot.cam;
	const basis = camBasis(cam);
	const mid = new THREE.Vector3(at[0], at[1] + height * 0.5, at[2]);
	const dist = Math.max(0.3, mid.clone().sub(new THREE.Vector3(...cam.pos)).dot(basis.fwd));
	const screenPxPerM = shot.H / 2 / (Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * dist);
	const olFU = outlinePx / (screenPxPerM * u);
	const sd = shot.sunDir;
	let lx = sd.dot(basis.right);
	let ly = -sd.dot(basis.up);
	const l = Math.hypot(lx, ly) || 1;
	lx = (lx / l) * facing;
	ly = ly / l;
	const toCam = new THREE.Vector3(...cam.pos).sub(mid).normalize();
	const front = sd.dot(toCam);
	const dusk = clamp((2 - shot.sun.elevationDeg) / 6);
	const shadeAmt = (0.75 + 0.75 * (1 - front) * 0.5) * (1 - dusk * 0.5);

	let figInfo: FigureInfo | null = null;
	useLayoutEffect(() => {
		const g = canvas.getContext('2d')!;
		g.setTransform(1, 0, 0, 1, 0, 0);
		g.clearRect(0, 0, cw, ch);
		const s = ch / hFU;
		g.setTransform(facing * s, 0, 0, s, -x0 * s, -y0 * s);
		figInfo = drawFigure(g, look, pose, {ol: olFU, light: [lx, ly], shade: shadeAmt});
		g.setTransform(1, 0, 0, 1, 0, 0);
		tex.needsUpdate = true;
		const tc = (tint ?? shot.sun.figureTint).clone().multiplyScalar(brightness);
		mat.color.copy(tc);
		mat.depthTest = depthTest;
		if (info && figInfo) {
			const rotY = yaw ?? Math.atan2(cam.pos[0] - at[0], cam.pos[2] - at[2]);
			const right = new THREE.Vector3(Math.cos(rotY), 0, -Math.sin(rotY));
			const toWorld = (p: [number, number]): Vec3 => {
				const w = new THREE.Vector3(...at).addScaledVector(right, p[0] * facing * u);
				w.y -= p[1] * u;
				return [w.x, w.y, w.z];
			};
			info({...figInfo, toWorld});
		}
	});

	const rotY = yaw ?? Math.atan2(cam.pos[0] - at[0], cam.pos[2] - at[2]);
	const sunYaw = Math.atan2(sd.x, sd.z);
	const pw = wFU * u;
	const ph = hFU * u;
	const cx = ((x0 + x1) / 2) * u;
	const cy = (-(y0 + y1) / 2) * u;
	const sunUp = shot.sun.elevationDeg > -1;

	return (
		<group position={at}>
			<group rotation={[0, rotY, 0]}>
				<mesh geometry={geo} material={mat} position={[cx * facing, cy, 0]} scale={[pw, ph, 1]} renderOrder={renderOrder} />
			</group>
			{shadow && sunUp ? (
				<group rotation={[0, sunYaw, 0]}>
					<mesh geometry={geo} material={shadowMat} customDepthMaterial={depthMat} castShadow position={[cx * facing, cy, 0]} scale={[pw, ph, 1]} />
				</group>
			) : null}
		</group>
	);
};
