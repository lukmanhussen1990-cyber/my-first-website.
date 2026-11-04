// The old photo: a happy day in the bakery long ago (party hats, a cake with fire on top, everyone smiling).
// The little scene is built from the same blocks as everything else and rendered into a texture,
// which is then shown on the photo card with an old-photo look (sepia, faded, grain, white border).
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {createPortal, useFrame} from '@react-three/fiber';
import {Stage, LOOKS} from '../../lib/Stage';
import {Character} from '../../characters/Character';
import * as P from '../../characters/poses';
import {townsperson, hatColor} from '../cast';
import {BakeryRoom} from './Rooms';
import {Table} from '../props/Things';
import {CakeStand, Candles} from '../props/Cake';
import {plastic, cyl} from '../../lib/materials';
import {V3} from '../../lib/anim';
import {Expression} from '../../characters/faceTexture';

export const OLD_TABLE: V3 = [0, 0, 2.9];
const OLD_CAKE_Y = 2.3 + 0.73;
const OLD_CANDLES: V3[] = Array.from({length: 9}).map((_, i) => {
	if (i === 8) return [0, 0.72, 0] as V3;
	const a = (i / 8) * Math.PI * 2;
	return [Math.cos(a) * 0.5, 0.72, Math.sin(a) * 0.5] as V3;
});

const PEOPLE: {seed: number; p: V3; yaw: number; kid?: boolean; expr: Expression; arms?: 'up' | 'clap' | 'hug'}[] = [
	{seed: 501, p: [-3.2, 0, 1.15], yaw: 0.25, expr: 'bigSmile', arms: 'hug'},
	{seed: 502, p: [-1.1, 0, 0.95], yaw: 0.08, expr: 'laugh'},
	{seed: 503, p: [1.1, 0, 0.95], yaw: -0.08, expr: 'bigSmile', arms: 'up'},
	{seed: 504, p: [3.2, 0, 1.15], yaw: -0.25, expr: 'happy', arms: 'hug'},
	{seed: 505, p: [-3.6, 0, 3.4], yaw: 0.55, kid: true, expr: 'excited', arms: 'clap'},
	{seed: 506, p: [3.6, 0, 3.4], yaw: -0.55, kid: true, expr: 'bigSmile', arms: 'up'},
	{seed: 507, p: [0, 0, 0.6], yaw: 0, expr: 'proud'},
];

/** the happy day in the photo (bakery local coordinates) */
export const OldParty: React.FC<{frame: number}> = ({frame}) => {
	const look = {...LOOKS.interiorDay, hemiSky: '#fff1dc', hemi: 1.1, ambient: 0.32, sun: 1.6, sunDir: [0.3, 0.8, 0.6] as V3};
	return (
		<Stage look={look} sky={false} fog={false} focus={[0, 2, 1.5]} shadowSize={9}>
			<BakeryRoom old frontWall={false} />
			<group position={OLD_TABLE}>
				<Table w={5.6} d={2.4} h={2.3} cloth="#fbf3e4" />
				<group position={[0, 2.33 + 0.73, 0]}>
					<CakeStand r={1.15} />
					<mesh geometry={cyl(0.85, 0.85, 0.7, 36)} material={plastic('#fffaf3', {rough: 0.6})} position={[0, 0.35, 0]} castShadow />
					<Candles positions={OLD_CANDLES} frame={frame} height={0.42} radius={0.05} seed={8} light lightPos={[0, 1.6, 0.4]} flameSize={1.8} />
				</group>
			</group>
			{PEOPLE.map((pp, i) => {
				const spec = townsperson(pp.seed, {kid: pp.kid});
				let pose = P.idle(i * 0.37, i);
				if (pp.arms === 'up') pose = P.withPose(pose, {armR: [-0.3, 0, -2.3]});
				if (pp.arms === 'clap') pose = P.withPose(pose, {armL: [-1.2, 0, -0.45], armR: [-1.2, 0, 0.45]});
				if (pp.arms === 'hug') pose = P.withPose(pose, {armL: [-0.3, 0, pp.p[0] > 0 ? 0.5 : 0.3], armR: [-0.3, 0, pp.p[0] > 0 ? -0.3 : -0.5]});
				return <Character key={i} spec={spec} position={pp.p} rotation={pp.yaw} pose={pose} expr={pp.expr} blink={false} partyHat={hatColor(i + 1)} partyHatTilt={i % 2 ? 0.2 : -0.2} />;
			})}
			<pointLight position={[0, 7, 6]} color="#ffe2b0" intensity={22} distance={30} decay={1.3} />
		</Stage>
	);
};

/** the photo camera: a group portrait */
export const PHOTO_CAM = {pos: [0, 4.3, 13.5] as V3, target: [0, 3.15, 1.8] as V3, fov: 30};

export function makePhotoRT(w = 1024, h = 768) {
	return new THREE.WebGLRenderTarget(w, h, {samples: 4, type: THREE.HalfFloatType});
}

/** renders <OldParty> into rt every frame (before the main scene), from cam (or the photo camera) */
export const PhotoPortal: React.FC<{rt: THREE.WebGLRenderTarget; frame: number; cam?: {pos: V3; target: V3; fov: number}}> = ({rt, frame, cam = PHOTO_CAM}) => {
	const scene = useMemo(() => new THREE.Scene(), []);
	const camera = useMemo(() => new THREE.PerspectiveCamera(30, 4 / 3, 0.05, 600), []);
	camera.aspect = rt.width / rt.height;
	camera.fov = cam.fov;
	camera.position.set(...cam.pos);
	camera.up.set(0, 1, 0);
	camera.lookAt(new THREE.Vector3(...cam.target));
	camera.updateProjectionMatrix();
	camera.updateMatrixWorld();
	useFrame(({gl}) => {
		const prev = gl.getRenderTarget();
		gl.setRenderTarget(rt);
		gl.setClearColor('#000000', 1);
		gl.clear(true, true, true);
		gl.render(scene, camera);
		gl.setRenderTarget(prev);
	}, 0);
	return <>{createPortal(<OldParty frame={frame} />, scene)}</>;
};
