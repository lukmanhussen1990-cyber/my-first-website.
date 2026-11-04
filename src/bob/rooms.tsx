// Bob interiors: the classroom of identical Bob kids, my bedroom with a real mirror.
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {Reflector} from 'three/examples/jsm/objects/Reflector.js';
import {plastic, rbox, box, cyl, plane, glowMat} from '../lib/materials';
import {woodTex, noiseTex, tilesTex, canvasTex} from '../lib/textures';
import {V3} from '../lib/anim';
import {POPPINS} from '../lib/fonts';
import {MIRROR} from './props';
import {QUALITY} from '../lib/quality';

// ================================================================== classroom
export const DESK_X = [-8, -4, 0, 4, 8];
export const DESK_Z = [-3, 1.5, 6, 10.5];
/** where the kid at column c, row r sits (chair position, facing -z) */
export const seat = (c: number, r: number): V3 => [DESK_X[c], 0, DESK_Z[r] + 1.1];
export const ME_SEAT = {c: 3, r: 3};

const chalkTex = () =>
	canvasTex('bobChalk', 1024, 400, (ctx, w, h) => {
		ctx.fillStyle = '#3f4a44';
		ctx.fillRect(0, 0, w, h);
		ctx.fillStyle = 'rgba(255,255,255,0.88)';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.font = `800 120px ${POPPINS}, sans-serif`;
		ctx.fillText('ROLL CALL', w / 2, h * 0.38);
		ctx.font = `700 64px ${POPPINS}, sans-serif`;
		ctx.fillText('Bob  Bob  Bob  Bob  Bob', w / 2, h * 0.74);
	});

export const Classroom: React.FC<{k?: number}> = ({k = 0}) => {
	const wall = plastic('#ffffff', {map: noiseTex('#d4cec4', 0.04, 7, [4, 2]), rough: 0.85});
	const floor = plastic('#ffffff', {map: tilesTex('#c8c2b6', '#b8b2a6', [8, 8], 4, 2), rough: 0.7});
	const deskM = plastic('#ffffff', {map: woodTex('#b9ab98', [1, 1], 4, 5), rough: 0.6});
	const metal = plastic('#8e8e94', {rough: 0.4, metal: 0.5});
	return (
		<group>
			<mesh geometry={plane(44, 34)} material={floor} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow />
			<mesh geometry={box(44, 12, 0.3)} material={wall} position={[0, 6, -12]} receiveShadow />
			<mesh geometry={box(0.3, 12, 34)} material={wall} position={[-14, 6, 0]} receiveShadow />
			<mesh geometry={box(0.3, 12, 34)} material={wall} position={[14, 6, 0]} receiveShadow />
			<mesh geometry={box(44, 12, 0.3)} material={wall} position={[0, 6, 16]} receiveShadow />
			<mesh geometry={box(44, 0.3, 34)} material={plastic('#e6e2da', {rough: 0.9})} position={[0, 12, 0]} />
			{/* chalkboard */}
			<group position={[0, 6.2, -11.8]}>
				<mesh geometry={rbox(14.6, 5.6, 0.3, 0.08)} material={plastic('#8a7a66', {rough: 0.6})} castShadow />
				<mesh geometry={plane(14, 5.0)} material={plastic('#ffffff', {map: chalkTex(), rough: 0.9})} position={[0, 0, 0.16]} />
			</group>
			{/* windows on the left wall */}
			{[-6, 2, 10].map((z) => (
				<group key={z} position={[-13.8, 6.2, z]} rotation={[0, Math.PI / 2, 0]}>
					<mesh geometry={rbox(4.2, 4.4, 0.3, 0.06)} material={plastic('#e7e3dc')} />
					<mesh geometry={plane(3.8, 4.0)} material={glowMat('#e6eef2', 1.25)} position={[0, 0, 0.16]} />
					<mesh geometry={box(0.12, 4.0, 0.1)} material={plastic('#e7e3dc')} position={[0, 0, 0.2]} />
				</group>
			))}
			{/* teacher's desk */}
			<group position={[3.5, 0, -8.6]}>
				<mesh geometry={rbox(5, 0.25, 2.4, 0.05)} material={deskM} position={[0, 2.6, 0]} castShadow receiveShadow />
				<mesh geometry={box(4.8, 2.5, 0.15)} material={deskM} position={[0, 1.3, 1.1]} castShadow />
				<mesh geometry={box(0.15, 2.5, 2.2)} material={deskM} position={[-2.35, 1.3, 0]} castShadow />
				<mesh geometry={box(0.15, 2.5, 2.2)} material={deskM} position={[2.35, 1.3, 0]} castShadow />
			</group>
			{/* student desks + chairs */}
			{DESK_X.map((x) =>
				DESK_Z.map((z) => (
					<group key={x + ',' + z}>
						<mesh geometry={rbox(2.6, 0.16, 1.6, 0.04)} material={deskM} position={[x, 2.0, z]} castShadow receiveShadow />
						{[-1, 1].map((sx) => (
							<mesh key={sx} geometry={cyl(0.06, 0.06, 1.95, 6)} material={metal} position={[x + sx * 1.1, 0.98, z]} />
						))}
						<mesh geometry={rbox(1.5, 0.14, 1.3, 0.04)} material={deskM} position={[x, 1.05, z + 1.25]} castShadow receiveShadow />
						<mesh geometry={rbox(1.5, 1.2, 0.12, 0.04)} material={deskM} position={[x, 1.75, z + 1.92]} castShadow />
						<mesh geometry={cyl(0.06, 0.06, 1.0, 6)} material={metal} position={[x, 0.5, z + 1.25]} />
					</group>
				)),
			)}
		</group>
	);
};

// ================================================================== my bedroom with a real mirror
export const MIRROR_POS: V3 = [0, 0, -3.5];
const MirrorGlass: React.FC = () => {
	const {w, h, y} = MIRROR;
	const res = Math.round(900 * QUALITY.dpr);
	const refl = useMemo(() => new Reflector(new THREE.PlaneGeometry(w, h), {textureWidth: res, textureHeight: Math.round((res * h) / w), color: 0xdfe4e8, clipBias: 0.003}), [res]);
	return <primitive object={refl} position={[0, y, 0.0]} />;
};

export const Bedroom: React.FC<{children?: React.ReactNode}> = ({children}) => {
	const wall = plastic('#ffffff', {map: noiseTex('#cfc9be', 0.04, 9, [3, 2]), rough: 0.85});
	const floor = plastic('#ffffff', {map: woodTex('#a99a86', [3, 3], 6, 4), rough: 0.7});
	return (
		<group>
			<mesh geometry={plane(30, 30)} material={floor} rotation={[-Math.PI / 2, 0, 0]} receiveShadow />
			<mesh geometry={box(30, 11, 0.3)} material={wall} position={[0, 5.5, -10]} receiveShadow />
			<mesh geometry={box(30, 11, 0.3)} material={wall} position={[0, 5.5, 10]} receiveShadow />
			<mesh geometry={box(0.3, 11, 20)} material={wall} position={[-10, 5.5, 0]} receiveShadow />
			<mesh geometry={box(0.3, 11, 20)} material={wall} position={[10, 5.5, 0]} receiveShadow />
			<mesh geometry={box(30, 0.3, 20)} material={plastic('#e3dfd8')} position={[0, 11, 0]} />
			{/* bed with a grey blanket */}
			<group position={[-6.5, 0, 4]}>
				<mesh geometry={rbox(4.4, 1.2, 7, 0.2)} material={plastic('#a5a09a', {rough: 0.6})} position={[0, 0.6, 0]} castShadow receiveShadow />
				<mesh geometry={rbox(4.2, 0.6, 5.2, 0.25)} material={plastic('#b9b6b0', {rough: 0.9})} position={[0, 1.45, 0.8]} castShadow />
				<mesh geometry={rbox(3.4, 0.6, 1.3, 0.25)} material={plastic('#e9e6e0', {rough: 0.9})} position={[0, 1.5, -2.6]} castShadow />
				<mesh geometry={rbox(4.4, 3.2, 0.4, 0.1)} material={plastic('#8f8a83', {rough: 0.6})} position={[0, 1.6, -3.5]} castShadow />
			</group>
			{/* dresser + window */}
			<mesh geometry={rbox(4, 3.4, 2, 0.08)} material={plastic('#9c958b', {rough: 0.6})} position={[6.5, 1.7, -8.6]} castShadow receiveShadow />
			<group position={[-3, 6.2, -9.8]}>
				<mesh geometry={rbox(4.4, 4.0, 0.3, 0.06)} material={plastic('#e7e3dc')} />
				<mesh geometry={plane(4.0, 3.6)} material={glowMat('#e8eef2', 1.3)} position={[0, 0, 0.16]} />
				<mesh geometry={box(0.12, 3.6, 0.1)} material={plastic('#e7e3dc')} position={[0, 0, 0.2]} />
			</group>
			{/* a little bit of me in this grey room: an orange rug and a red ball */}
			<mesh geometry={cyl(2.6, 2.6, 0.06, 36)} material={plastic('#ff8a3a', {rough: 0.95})} position={[1.5, 0.03, 2.5]} receiveShadow />
			<mesh geometry={rbox(0.9, 0.9, 0.9, 0.42)} material={plastic('#e3262c', {rough: 0.35})} position={[4.5, 0.45, 3.5]} castShadow />
			{/* the standing mirror */}
			<group position={MIRROR_POS}>
				<MirrorGlass />
				<group position={[0, 0, -0.06]}>
					{/* frame + stand (behind the glass) */}
					<mesh geometry={rbox(MIRROR.w + 0.3, 0.2, 0.2, 0.06)} material={plastic('#8a8f96', {rough: 0.35, metal: 0.3})} position={[0, MIRROR.y + MIRROR.h / 2 + 0.05, 0]} castShadow />
					<mesh geometry={rbox(MIRROR.w + 0.3, 0.2, 0.2, 0.06)} material={plastic('#8a8f96', {rough: 0.35, metal: 0.3})} position={[0, MIRROR.y - MIRROR.h / 2 - 0.05, 0]} castShadow />
					<mesh geometry={rbox(0.2, MIRROR.h + 0.3, 0.2, 0.06)} material={plastic('#8a8f96', {rough: 0.35, metal: 0.3})} position={[-MIRROR.w / 2 - 0.05, MIRROR.y, 0]} castShadow />
					<mesh geometry={rbox(0.2, MIRROR.h + 0.3, 0.2, 0.06)} material={plastic('#8a8f96', {rough: 0.35, metal: 0.3})} position={[MIRROR.w / 2 + 0.05, MIRROR.y, 0]} castShadow />
					<mesh geometry={box(MIRROR.w, MIRROR.h, 0.06)} material={plastic('#6a6e74')} position={[0, MIRROR.y, -0.06]} />
					{[-1, 1].map((sd) => (
						<mesh key={sd} geometry={rbox(0.16, MIRROR.y - MIRROR.h / 2 + 0.1, 0.16, 0.05)} material={plastic('#8a8f96', {rough: 0.35, metal: 0.3})} position={[sd * (MIRROR.w / 2 - 0.2), (MIRROR.y - MIRROR.h / 2) / 2, -0.3]} rotation={[-0.15, 0, 0]} castShadow />
					))}
					<mesh geometry={rbox(MIRROR.w + 0.6, 0.14, 1.2, 0.05)} material={plastic('#8a8f96', {rough: 0.35, metal: 0.3})} position={[0, 0.07, -0.4]} castShadow receiveShadow />
				</group>
			</group>
			<pointLight position={[0, 9.5, 2]} color="#fff2dc" intensity={22} distance={26} decay={1.4} />
			{children}
		</group>
	);
};
