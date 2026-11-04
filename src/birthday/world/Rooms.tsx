// Interiors and close sets: Grandpa's porch, our attic, our kitchen, the dusty bakery inside,
// and the same bakery long ago (the scene inside the old photo).
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {plastic, rbox, box, cyl, sphere, plane, glowMat, cone, torus, circle} from '../../lib/materials';
import {woodTex, noiseTex, tilesTex, sidingTex, canvasTex} from '../../lib/textures';
import {hash, mulberry32} from '../../lib/random';
import {V3} from '../../lib/anim';
import {RockingChair} from '../props/Things';
import {Web, quietSpec} from './Town';
import {House} from '../../world/Town';
import {RoundTree, Bush} from '../../world/Nature';
import {BeamCone} from '../../props/Effects';
import {POPPINS} from '../../lib/fonts';

const wood = (c: string, rep: [number, number] = [1, 1], seed = 3) => plastic('#ffffff', {map: woodTex(c, rep, 6, seed), rough: 0.7});

// ================================================================== Grandpa's porch
/** porch deck top height */
export const PORCH_Y = 0.8;
export const CHAIR_AT: V3 = [2.2, PORCH_Y, 2.4];
export const Porch: React.FC<{rock?: number; chair?: boolean; lit?: boolean; children?: React.ReactNode; sitter?: React.ReactNode}> = ({rock = 0, chair = true, lit = true, children, sitter}) => {
	const siding = plastic('#ffffff', {map: sidingTex('#d9cbb5', [1, 1], 22), rough: 0.6});
	const trim = plastic('#f4efe6', {rough: 0.5});
	const deck = wood('#9a7656', [3, 1], 5);
	return (
		<group>
			{/* lawn + street beyond */}
			<mesh geometry={plane(300, 300)} material={plastic('#ffffff', {map: noiseTex('#8daa5a', 0.1, 4, [40, 40]), rough: 0.95})} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow />
			<mesh geometry={plane(300, 11)} material={plastic('#6a6e78', {rough: 0.85})} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0, 20]} receiveShadow />
			{/* house front wall (house body extends to -z) */}
			<mesh geometry={box(18, 12, 10)} material={siding} position={[0, 6, -5]} castShadow receiveShadow />
			<mesh geometry={box(19, 0.5, 11)} material={plastic('#5a4a44', {rough: 0.6})} position={[0, 12.2, -5]} castShadow />
			{/* door + glowing window */}
			<group position={[-2.6, PORCH_Y, 0.02]}>
				<mesh geometry={rbox(2.8, 4.8, 0.3, 0.06)} material={trim} position={[0, 2.4, 0]} castShadow />
				<mesh geometry={rbox(2.2, 4.3, 0.2, 0.05)} material={plastic('#7a5a44', {rough: 0.5})} position={[0, 2.2, 0.12]} />
				<mesh geometry={rbox(1.2, 0.9, 0.05, 0.03)} material={lit ? glowMat('#ffcf8a', 1.4) : plastic('#bfe6ff')} position={[0, 3.4, 0.24]} />
				<mesh geometry={sphere(0.12, 10, 8)} material={plastic('#d9b25a', {metal: 0.8, rough: 0.3})} position={[0.8, 2.2, 0.28]} />
			</group>
			<group position={[4.4, PORCH_Y + 3.0, 0.02]}>
				<mesh geometry={rbox(3.6, 3.0, 0.3, 0.06)} material={trim} castShadow />
				<mesh geometry={plane(3.1, 2.5)} material={lit ? glowMat('#ffc777', 1.7) : plastic('#9fd6ff')} position={[0, 0, 0.16]} />
				<mesh geometry={box(0.1, 2.5, 0.08)} material={trim} position={[0, 0, 0.2]} />
				<mesh geometry={box(3.1, 0.1, 0.08)} material={trim} position={[0, 0, 0.2]} />
			</group>
			{/* deck, steps */}
			<mesh geometry={box(16, PORCH_Y, 6)} material={deck} position={[0, PORCH_Y / 2, 3]} castShadow receiveShadow />
			{[0, 1].map((i) => (
				<mesh key={i} geometry={box(3.4, PORCH_Y / 2, 0.8)} material={deck} position={[-2.6, PORCH_Y / 4 + (1 - i) * 0 + (i === 0 ? 0 : 0), 6.4 + i * 0.8]} scale={[1, i === 0 ? 1 : 0.5, 1]} castShadow receiveShadow />
			))}
			{/* posts, railing, roof */}
			{[-7.6, -4.6, -0.6, 7.6].map((x) => (
				<mesh key={x} geometry={rbox(0.4, 5.9, 0.4, 0.06)} material={trim} position={[x, PORCH_Y + 2.95, 5.6]} castShadow />
			))}
			{[[-7.6, -4.6], [-0.6, 7.6]].map(([a, b], i) => (
				<group key={i}>
					<mesh geometry={box(b - a, 0.18, 0.22)} material={trim} position={[(a + b) / 2, PORCH_Y + 1.8, 5.6]} castShadow />
					{Array.from({length: Math.round((b - a) / 0.5)}).map((_, k) => (
						<mesh key={k} geometry={box(0.12, 1.7, 0.12)} material={trim} position={[a + 0.25 + k * 0.5, PORCH_Y + 0.9, 5.6]} castShadow />
					))}
				</group>
			))}
			<mesh geometry={rbox(17, 0.35, 7, 0.08)} material={plastic('#5a4a44', {rough: 0.6})} position={[0, PORCH_Y + 6.1, 2.9]} rotation={[0.08, 0, 0]} castShadow />
			{/* the chair */}
			{chair ? (
				<group position={CHAIR_AT} rotation={[0, -0.32, 0]}>
					<RockingChair rock={rock}>{sitter}</RockingChair>
				</group>
			) : null}
			{/* a little side table with a cup */}
			<group position={[5.6, PORCH_Y, 1.8]}>
				<mesh geometry={cyl(0.7, 0.7, 0.12, 20)} material={wood('#8a5a36')} position={[0, 1.6, 0]} castShadow />
				<mesh geometry={cyl(0.12, 0.16, 1.55, 10)} material={wood('#8a5a36')} position={[0, 0.78, 0]} castShadow />
				<mesh geometry={cyl(0.18, 0.15, 0.36, 14)} material={plastic('#e9e4da', {rough: 0.3})} position={[0.1, 1.84, 0.1]} castShadow />
			</group>
			{/* across the street */}
			{[-24, 0, 24].map((x, i) => (
				<House key={x} spec={quietSpec(30 + i)} position={[x, 0, 38]} rotation={Math.PI} lit="night" bucket={false} detail="low" />
			))}
			<RoundTree position={[-11, 0, 9]} seed={4} leaf="#7c9a48" trunk="#6e4a30" />
			<RoundTree position={[13, 0, 12]} seed={9} leaf="#7c9a48" trunk="#6e4a30" scale={1.1} />
			<Bush position={[-9.2, 0, 3.5]} color="#5f8a40" />
			<Bush position={[9.4, 0, 3.0]} color="#5f8a40" scale={0.9} />
			{children}
		</group>
	);
};

// ================================================================== our attic
export const ATTIC = {halfW: 9, L0: 10, L1: -12, ridge: 10};
const atticWall = () => plastic('#ffffff', {map: woodTex('#7a5a3e', [2, 2], 8, 13), rough: 0.85});
export const Attic: React.FC = () => {
	const {halfW, L0, L1, ridge} = ATTIC;
	const len = L0 - L1;
	const cz = (L0 + L1) / 2;
	const slope = Math.atan2(ridge - 1.2, halfW);
	const slopeLen = Math.hypot(halfW, ridge - 1.2);
	const floor = wood('#8a6a4a', [3, 4], 21);
	const beam = plastic('#5e432e', {rough: 0.8});
	const gable = useMemo(() => {
		const s = new THREE.Shape();
		s.moveTo(-halfW - 0.5, 0);
		s.lineTo(halfW + 0.5, 0);
		s.lineTo(halfW + 0.5, 1.2);
		s.lineTo(0, ridge + 0.3);
		s.lineTo(-halfW - 0.5, 1.2);
		s.lineTo(-halfW - 0.5, 0);
		const hole = new THREE.Path();
		hole.absarc(0, 6.4, 1.15, 0, Math.PI * 2, true);
		s.holes.push(hole);
		return new THREE.ShapeGeometry(s, 24);
	}, []);
	return (
		<group>
			<mesh geometry={box(2 * halfW + 1, 0.3, len)} material={floor} position={[0, -0.15, cz]} receiveShadow />
			{[-1, 1].map((sd) => (
				<mesh key={sd} geometry={box(0.25, slopeLen, len)} material={atticWall()} position={[sd * (halfW / 2), 1.2 + (ridge - 1.2) / 2, cz]} rotation={[0, 0, sd * (Math.PI / 2 - slope)]} castShadow receiveShadow />
			))}
			{[-1, 1].map((sd) => (
				<mesh key={'kw' + sd} geometry={box(0.3, 1.2, len)} material={atticWall()} position={[sd * halfW, 0.6, cz]} receiveShadow />
			))}
			<mesh geometry={gable} material={atticWall()} position={[0, 0, L1]} receiveShadow castShadow />
			<mesh geometry={gable} material={atticWall()} position={[0, 0, L0]} rotation={[0, Math.PI, 0]} receiveShadow />
			{/* round window frame + warm sky glass */}
			<mesh geometry={torus(1.2, 0.16, 8, 32)} material={beam} position={[0, 6.4, L1 + 0.1]} />
			<mesh geometry={box(2.3, 0.12, 0.12)} material={beam} position={[0, 6.4, L1 + 0.1]} />
			<mesh geometry={box(0.12, 2.3, 0.12)} material={beam} position={[0, 6.4, L1 + 0.1]} />
			<mesh geometry={circle(1.15, 32)} material={glowMat('#ffd9a0', 2.2)} position={[0, 6.4, L1 - 0.1]} />
			{/* rafters + ridge beam */}
			{Array.from({length: 9}).map((_, i) => {
				const z = L1 + 1.5 + i * 2.5;
				return (
					<group key={i}>
						{[-1, 1].map((sd) => (
							<mesh key={sd} geometry={box(0.35, slopeLen, 0.35)} material={beam} position={[sd * (halfW / 2 - 0.2), 1.2 + (ridge - 1.2) / 2 - 0.3, z]} rotation={[0, 0, sd * (Math.PI / 2 - slope)]} castShadow />
						))}
						<mesh geometry={box(2 * halfW - 4, 0.3, 0.3)} material={beam} position={[0, 6.2, z]} castShadow />
					</group>
				);
			})}
			<mesh geometry={box(0.4, 0.4, len)} material={beam} position={[0, ridge - 0.25, cz]} />
			{/* the light beam through the round window */}
			<group position={[0, 6.4, L1 + 0.2]} rotation={[-Math.PI / 2 + 0.62, 0, 0.0]}>
				<BeamCone length={9.5} radius={2.1} color="#ffd9a0" opacity={0.2} />
			</group>
			{/* an old lamp, a covered chair, a rocking horse */}
			<group position={[-5.5, 0, -6]}>
				<mesh geometry={rbox(2.6, 2.6, 2.4, 0.5)} material={plastic('#e9e3d6', {rough: 1})} position={[0, 1.3, 0]} castShadow receiveShadow />
				<mesh geometry={rbox(2.6, 2.4, 0.9, 0.4)} material={plastic('#e9e3d6', {rough: 1})} position={[0, 3.1, -0.8]} castShadow />
			</group>
			<group position={[6, 0, -1]}>
				<mesh geometry={cyl(0.5, 0.6, 0.2, 14)} material={plastic('#5a4a3a')} position={[0, 0.1, 0]} />
				<mesh geometry={cyl(0.07, 0.07, 3.2, 8)} material={plastic('#5a4a3a')} position={[0, 1.7, 0]} />
				<mesh geometry={cyl(0.6, 1.0, 1.0, 14, true)} material={plastic('#c9b48a', {rough: 0.9, side: THREE.DoubleSide})} position={[0, 3.5, 0]} />
			</group>
		</group>
	);
};

// ================================================================== our kitchen
export const KITCHEN = {back: -6, left: -10, right: 10, front: 9};
export const COUNTER_TOP = 3.0;
const wallpaperTex = () =>
	canvasTex('kitchenWall', 256, 256, (ctx, w, h) => {
		ctx.fillStyle = '#efe3cf';
		ctx.fillRect(0, 0, w, h);
		ctx.fillStyle = 'rgba(200,160,120,0.18)';
		for (let x = 0; x < w; x += 32) ctx.fillRect(x, 0, 12, h);
	}, {repeat: [8, 3]});

export const Kitchen: React.FC<{night?: boolean; mess?: number; children?: React.ReactNode}> = ({night = false, mess = 0, children}) => {
	const {back, left, right, front} = KITCHEN;
	const wall = plastic('#ffffff', {map: wallpaperTex(), rough: 0.8});
	const floor = plastic('#ffffff', {map: tilesTex('#d8c7a8', '#c4b190', [6, 6], 4, 3), rough: 0.7});
	const cab = plastic('#9cb4a6', {rough: 0.5});
	const top = plastic('#f1ece2', {rough: 0.35, envInt: 1.1});
	return (
		<group>
			<mesh geometry={plane(right - left + 4, front - back + 6)} material={floor} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, (front + back) / 2]} receiveShadow />
			<mesh geometry={box(right - left, 12, 0.3)} material={wall} position={[0, 6, back - 0.15]} receiveShadow />
			<mesh geometry={box(0.3, 12, front - back)} material={wall} position={[left - 0.15, 6, (front + back) / 2]} receiveShadow />
			<mesh geometry={box(0.3, 12, front - back)} material={wall} position={[right + 0.15, 6, (front + back) / 2]} receiveShadow />
			<mesh geometry={box(right - left, 0.3, front - back)} material={plastic('#f6efe4', {rough: 0.9})} position={[0, 12, (front + back) / 2]} />
			{/* window over the counter */}
			<group position={[-3, 6.8, back + 0.05]}>
				<mesh geometry={rbox(4.6, 3.6, 0.3, 0.06)} material={plastic('#ffffff', {rough: 0.5})} />
				<mesh geometry={plane(4, 3)} material={night ? glowMat('#2a3a7a', 0.9) : glowMat('#ffc98a', 1.9)} position={[0, 0, 0.16]} />
				<mesh geometry={box(0.12, 3, 0.1)} material={plastic('#ffffff')} position={[0, 0, 0.2]} />
				<mesh geometry={box(4, 0.12, 0.1)} material={plastic('#ffffff')} position={[0, 0, 0.2]} />
			</group>
			{/* counter + cabinets along the back */}
			<mesh geometry={rbox(12, COUNTER_TOP - 0.2, 2.4, 0.06)} material={cab} position={[-3.5, (COUNTER_TOP - 0.2) / 2, back + 1.25]} castShadow receiveShadow />
			<mesh geometry={rbox(12.3, 0.22, 2.6, 0.05)} material={top} position={[-3.5, COUNTER_TOP - 0.1, back + 1.3]} castShadow receiveShadow />
			{[-8.5, -6, -3.5, -1, 1.5].map((x) => (
				<mesh key={x} geometry={rbox(2.3, 2.3, 0.08, 0.04)} material={plastic('#8aa596', {rough: 0.5})} position={[x, 1.4, back + 2.47]} />
			))}
			{/* wall cabinets */}
			{[-8, -5.5, 1, 3.5].map((x) => (
				<mesh key={'w' + x} geometry={rbox(2.3, 2.6, 1.2, 0.05)} material={cab} position={[x, 8.6, back + 0.6]} castShadow />
			))}
			{/* shelf with jars */}
			<mesh geometry={box(4, 0.15, 0.8)} material={wood('#9a6a42')} position={[7.5, 7.0, back + 0.4]} />
			{[0, 1, 2, 3].map((i) => (
				<mesh key={i} geometry={cyl(0.3, 0.3, 0.8, 12)} material={plastic(['#e8c47a', '#d9a066', '#f0e2c4', '#c98a5a'][i], {rough: 0.3, transparent: true, opacity: 0.9})} position={[6.2 + i * 0.9, 7.5, back + 0.4]} />
			))}
			{/* hanging lamp over the table */}
			<mesh geometry={cyl(0.03, 0.03, 3.4, 4)} material={plastic('#3a3a3a')} position={[-1, 10.3, 2]} />
			<mesh geometry={cyl(0.5, 1.3, 0.9, 20, true)} material={plastic('#e7b34f', {rough: 0.5, side: THREE.DoubleSide})} position={[-1, 8.3, 2]} />
			<mesh geometry={sphere(0.35, 12, 8)} material={glowMat('#fff0c8', 3)} position={[-1, 8.0, 2]} />
			<pointLight position={[-1, 7.6, 2]} color="#ffd8a0" intensity={night ? 34 : 14} distance={20} decay={1.5} castShadow={false} />
			{/* flour mess (after the explosion) */}
			{mess > 0 ? (
				<group>
					{Array.from({length: 16}).map((_, i) => (
						<mesh key={i} geometry={circle(0.6 + hash(i, 2) * 1.2, 16)} material={plastic('#fbf8f2', {rough: 1, transparent: true, opacity: 0.85 * mess, depthWrite: false})} position={[(hash(i, 3) - 0.5) * 16, 0.02 + i * 0.001, back + 3 + hash(i, 4) * 10]} rotation={[-Math.PI / 2, 0, 0]} />
					))}
				</group>
			) : null}
			{children}
		</group>
	);
};

// ================================================================== the bakery, inside (dusty) and long ago (the photo)
export const SHOP = {halfW: 9, back: -6, front: 6, H: 10};
export const SHOP_COUNTER: V3 = [0, 0, -0.8];
export const SHOP_COUNTER_TOP = 2.9;

const breadTex = () => plastic('#c98a4a', {rough: 0.7});
const Loaves: React.FC<{y: number; w: number; seed: number; z: number}> = ({y, w, seed, z}) => {
	const r = mulberry32(seed);
	const n = Math.floor(w / 0.9);
	return (
		<group>
			{Array.from({length: n}).map((_, i) => {
				const kind = Math.floor(r() * 3);
				const x = -w / 2 + 0.45 + i * 0.9;
				return kind === 0 ? (
					<mesh key={i} geometry={sphere(0.38, 12, 8)} material={breadTex()} position={[x, y + 0.25, z]} scale={[1.2, 0.7, 0.9]} castShadow />
				) : kind === 1 ? (
					<mesh key={i} geometry={rbox(0.8, 0.45, 0.55, 0.2)} material={plastic('#d9a35a', {rough: 0.7})} position={[x, y + 0.23, z]} castShadow />
				) : (
					<mesh key={i} geometry={torus(0.26, 0.12, 8, 16)} material={plastic('#b87a3a', {rough: 0.7})} position={[x, y + 0.13, z]} rotation={[Math.PI / 2, 0, 0]} castShadow />
				);
			})}
		</group>
	);
};

const shopSignTex = () =>
	canvasTex('shopSignOld', 1024, 256, (ctx, w, h) => {
		ctx.fillStyle = '#7a4a2a';
		ctx.fillRect(0, 0, w, h);
		ctx.fillStyle = '#ffe2a8';
		ctx.font = `800 160px ${POPPINS}, sans-serif`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText('BAKERY', w / 2, h / 2 + 8);
	});

/** the bakery room. old = the happy day in the photo (full shelves, warm), otherwise dusty and empty */
export const BakeryRoom: React.FC<{old?: boolean; frontWall?: boolean}> = ({old = false, frontWall = true}) => {
	const {halfW, back, front, H} = SHOP;
	const wallCol = old ? '#f3dcb8' : '#8a8070';
	const wall = plastic('#ffffff', {map: noiseTex(wallCol, old ? 0.06 : 0.16, 31, [3, 3], 400), rough: 0.9});
	const floor = wood(old ? '#b07a4a' : '#6e5a46', [3, 3], 41);
	const shelfM = wood(old ? '#a0703f' : '#5e4a38', [1, 1], 43);
	const counterM = wood(old ? '#8a5a34' : '#5a4636', [2, 1], 45);
	return (
		<group>
			<mesh geometry={plane(2 * halfW, front - back)} material={floor} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, (front + back) / 2]} receiveShadow />
			<mesh geometry={box(2 * halfW, H, 0.3)} material={wall} position={[0, H / 2, back - 0.15]} receiveShadow />
			{[-1, 1].map((sd) => (
				<mesh key={sd} geometry={box(0.3, H, front - back)} material={wall} position={[sd * (halfW + 0.15), H / 2, (front + back) / 2]} receiveShadow />
			))}
			<mesh geometry={box(2 * halfW, 0.3, front - back)} material={plastic(old ? '#f7ead2' : '#6a6256', {rough: 0.9})} position={[0, H, (front + back) / 2]} />
			{/* front wall with the boarded window (light leaks through the gaps) */}
			{!old ? (
				<group>
					<mesh geometry={box(2 * halfW, 1.2, 0.3)} material={wall} position={[0, 0.6, front + 0.15]} />
					<mesh geometry={box(2 * halfW, 3.6, 0.3)} material={wall} position={[0, H - 1.8, front + 0.15]} />
					{Array.from({length: 7}).map((_, i) => (
						<mesh key={i} geometry={box(2 * halfW, 0.62, 0.3)} material={wood('#4e3e30', [2, 1], 50 + i)} position={[0, 1.6 + i * 0.72, front + 0.15]} castShadow />
					))}
					{Array.from({length: 7}).map((_, i) => (
						<mesh key={'g' + i} geometry={box(2 * halfW, 0.1, 0.05)} material={glowMat('#ffd9a0', 2.4)} position={[0, 1.95 + i * 0.72, front + 0.3]} />
					))}
				</group>
			) : frontWall ? (
				<mesh geometry={box(2 * halfW, H, 0.3)} material={wall} position={[0, H / 2, front + 0.15]} />
			) : null}
			{/* shelves on the back wall */}
			{[-5, 0, 5].map((x) => (
				<group key={x} position={[x, 0, back + 0.8]}>
					{[1.2, 3.2, 5.2, 7.2].map((y) => (
						<mesh key={y} geometry={box(4.4, 0.18, 1.3)} material={shelfM} position={[0, y, 0]} castShadow receiveShadow />
					))}
					{[-1, 1].map((sd) => (
						<mesh key={sd} geometry={box(0.2, 7.6, 1.3)} material={shelfM} position={[sd * 2.2, 3.8, 0]} castShadow />
					))}
					{old ? [1.2, 3.2, 5.2].map((y, k) => <Loaves key={k} y={y + 0.09} w={4.2} seed={x * 10 + k + 99} z={0} />) : null}
					{!old ? <Web position={[1.9, 6.9, 0.66]} rotation={[0, 0, Math.PI]} size={1.6} seed={x + 40} /> : null}
				</group>
			))}
			{/* counter with a glass case */}
			<group position={SHOP_COUNTER}>
				<mesh geometry={rbox(8, SHOP_COUNTER_TOP - 0.15, 2, 0.05)} material={counterM} position={[0, (SHOP_COUNTER_TOP - 0.15) / 2, 0]} castShadow receiveShadow />
				<mesh geometry={rbox(8.3, 0.18, 2.3, 0.05)} material={plastic(old ? '#e9dcc6' : '#8a8274', {rough: 0.5})} position={[0, SHOP_COUNTER_TOP - 0.08, 0]} castShadow receiveShadow />
				{!old ? <mesh geometry={box(8.1, 0.02, 2.1)} material={plastic('#bdb5a6', {rough: 1, transparent: true, opacity: 0.6})} position={[0, SHOP_COUNTER_TOP + 0.02, 0]} /> : null}
			</group>
			{/* hanging lamps (off and dusty, or warm and bright long ago) */}
			{[-4, 4].map((x) => (
				<group key={x} position={[x, H - 2.2, 0]}>
					<mesh geometry={cyl(0.02, 0.02, 2.2, 4)} material={plastic('#2a2a2a')} position={[0, 1.1, 0]} />
					<mesh geometry={cyl(0.35, 0.9, 0.7, 18, true)} material={plastic(old ? '#d9a35a' : '#5a5246', {rough: 0.6, side: THREE.DoubleSide})} />
					<mesh geometry={sphere(0.25, 10, 8)} material={old ? glowMat('#fff0c8', 3) : plastic('#7a7468', {rough: 0.6})} position={[0, -0.25, 0]} />
				</group>
			))}
			{old ? (
				<group>
					<group position={[0, 8.6, back + 0.2]}>
						<mesh geometry={rbox(7.4, 1.6, 0.2, 0.06)} material={plastic('#5a3a22')} />
						<mesh geometry={plane(7, 1.4)} material={plastic('#ffffff', {map: shopSignTex(), rough: 0.7})} position={[0, 0, 0.11]} />
					</group>
				</group>
			) : (
				<group>
					<Web position={[-halfW + 0.9, H - 0.9, back + 0.4]} rotation={[0, 0.4, Math.PI / 2]} size={2.6} seed={11} />
					<Web position={[halfW - 0.9, H - 0.9, back + 0.4]} rotation={[0, -0.4, Math.PI]} size={2.6} seed={12} />
					<Web position={[halfW - 0.4, H - 1.1, front - 1.2]} rotation={[0, -Math.PI / 2, Math.PI]} size={2.6} seed={14} />
					<Web position={[-3.9, SHOP_COUNTER_TOP + 0.85, SHOP_COUNTER[2] + 0.9]} rotation={[0, 0, Math.PI / 2 + 0.2]} size={1.6} seed={15} opacity={0.8} />
					{/* an old empty cake stand and a dusty chair */}
					<group position={[-3, SHOP_COUNTER_TOP, -0.9]}>
						<mesh geometry={cyl(0.8, 0.8, 0.06, 20)} material={plastic('#9a9284', {rough: 0.6})} position={[0, 0.6, 0]} />
						<mesh geometry={cyl(0.1, 0.18, 0.6, 10)} material={plastic('#9a9284', {rough: 0.6})} position={[0, 0.3, 0]} />
					</group>
				</group>
			)}
		</group>
	);
};
