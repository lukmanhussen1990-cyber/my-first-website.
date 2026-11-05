import React from 'react';
import * as THREE from 'three';
import {V3, rnd} from '../lib/anim';
import {boxGeo, circleGeo, cylGeo, litTex, planeGeo, plastic, sphGeo, unlit} from '../three/cache';

const RING = new THREE.RingGeometry(8.2, 8.6, 48);
import {Box, Cyl, Glow, Plane, RBox, Sph, TextPlane} from '../three/prims';
import {canvasTex, noiseTex} from '../three/textures';
import {BookStack, Desk, GiantChair, InkPad, NamePlate, PaperPile} from './props';

/* View through a window: a painted town skyline (drawn in code). */
const skylineTex = (night: boolean) =>
	canvasTex(`skyline|${night}`, 512, 384, (ctx, w, h) => {
		const g = ctx.createLinearGradient(0, 0, 0, h);
		if (night) {
			g.addColorStop(0, '#0b1240');
			g.addColorStop(1, '#2a3a8a');
		} else {
			g.addColorStop(0, '#4aa8f0');
			g.addColorStop(1, '#cdeeff');
		}
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, w, h);
		if (night) {
			ctx.fillStyle = '#fff6d8';
			ctx.beginPath();
			ctx.arc(w * 0.78, h * 0.22, 26, 0, Math.PI * 2);
			ctx.fill();
		} else {
			ctx.fillStyle = 'rgba(255,255,255,0.95)';
			[[0.2, 0.2], [0.65, 0.12], [0.85, 0.3]].forEach(([x, y]) => {
				ctx.beginPath();
				ctx.ellipse(w * x, h * y, 50, 20, 0, 0, Math.PI * 2);
				ctx.ellipse(w * x + 30, h * y - 10, 34, 22, 0, 0, Math.PI * 2);
				ctx.fill();
			});
		}
		let s = 7;
		const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
		for (let i = 0; i < 14; i++) {
			const bw = 30 + r() * 40;
			const bh = 60 + r() * 140;
			const x = (i / 14) * w;
			ctx.fillStyle = night ? ['#1a2050', '#232a60', '#1c1f48'][i % 3] : ['#ffb3c7', '#9fe6cf', '#ffe28a', '#a9c8ff', '#e1c4ff'][i % 5];
			ctx.fillRect(x, h - bh, bw, bh);
			ctx.fillStyle = night ? '#ffd27a' : 'rgba(255,255,255,0.7)';
			for (let y = h - bh + 10; y < h - 10; y += 20) for (let xx = x + 6; xx < x + bw - 8; xx += 14) if (r() > (night ? 0.5 : 0.2)) ctx.fillRect(xx, y, 7, 9);
		}
		ctx.fillStyle = night ? '#16301e' : '#6cc04a';
		ctx.fillRect(0, h - 18, w, 18);
	});

const Window: React.FC<{position: V3; w: number; h: number; night?: boolean; curtains?: string; blinds?: boolean}> = ({position, w, h, night = false, curtains, blinds}) => (
	<group position={position}>
		<mesh geometry={planeGeo(w, h)} material={unlit('#ffffff', {map: skylineTex(night), transparent: false})} />
		<Box s={[w + 0.6, 0.4, 0.5]} color="#ffffff" position={[0, h / 2, 0.15]} />
		<Box s={[w + 0.6, 0.4, 0.8]} color="#ffffff" position={[0, -h / 2, 0.3]} />
		<Box s={[0.3, h, 0.3]} color="#ffffff" position={[0, 0, 0.1]} />
		<Box s={[w, 0.25, 0.3]} color="#ffffff" position={[0, 0, 0.1]} />
		<Box s={[0.3, h, 0.4]} color="#ffffff" position={[-w / 2, 0, 0.1]} />
		<Box s={[0.3, h, 0.4]} color="#ffffff" position={[w / 2, 0, 0.1]} />
		{blinds
			? Array.from({length: Math.floor(h / 0.55)}).map((_, i) => <Box key={i} s={[w, 0.22, 0.05]} color="#8a8478" position={[0, h / 2 - 0.3 - i * 0.55, 0.35]} rotation={[0.6, 0, 0]} cast={false} />)
			: null}
		{curtains ? (
			<>
				<RBox s={[2.2, h + 1.6, 0.4]} r={0.15} color={curtains} position={[-w / 2 - 0.9, -0.2, 0.6]} />
				<RBox s={[2.2, h + 1.6, 0.4]} r={0.15} color={curtains} position={[w / 2 + 0.9, -0.2, 0.6]} />
				<Box s={[w + 5, 0.2, 0.2]} mat={plastic('#ffcc3a', {metal: 0.7, rough: 0.3})} position={[0, h / 2 + 0.9, 0.7]} />
			</>
		) : null}
	</group>
);

export const Bookshelf: React.FC<{position: V3; yaw?: number; seed?: string}> = ({position, yaw = 0, seed = 'sh'}) => (
	<group position={position} rotation={[0, yaw, 0]}>
		<RBox s={[6, 11, 1.6]} r={0.1} color="#6a3a20" position={[0, 5.5, 0]} />
		{[1.5, 4.0, 6.5, 9.0].map((y) => (
			<group key={y}>
				<Box s={[5.4, 0.2, 1.4]} color="#4a2410" position={[0, y - 0.95, 0.15]} />
				{Array.from({length: 11}).map((_, i) => {
					const hh = 1.2 + rnd(`${seed}${y}${i}`) * 0.5;
					return <Box key={i} s={[0.42, hh, 1.1]} color={['#d42a3a', '#2a5bd7', '#22aa55', '#ffcc22', '#9b5de5', '#ff7a1a'][Math.floor(rnd(`${seed}c${y}${i}`) * 6)]} position={[-2.4 + i * 0.48, y - 0.85 + hh / 2, 0.3]} />;
				})}
			</group>
		))}
	</group>
);

export const Flag: React.FC<{position: V3; color?: string}> = ({position, color = '#2a5bd7'}) => (
	<group position={position}>
		<Cyl r={0.12} h={11} mat={plastic('#ffcc3a', {metal: 0.7, rough: 0.3})} position={[0, 5.5, 0]} />
		<Sph r={0.3} mat={plastic('#ffcc3a', {metal: 0.7, rough: 0.3})} position={[0, 11.1, 0]} />
		<Cyl r={0.9} r2={1.1} h={0.5} color="#3a2414" position={[0, 0.25, 0]} />
		<RBox s={[0.12, 3.6, 5]} r={0.05} color={color} position={[0, 8.8, 2.6]} rotation={[0.1, 0, 0.05]} />
		<Plane w={2.2} h={2.2} map={canvasTex(`flagpaw|${color}`, 128, 128, (ctx, w) => {
			ctx.fillStyle = '#ffffff';
			ctx.beginPath();
			ctx.ellipse(w / 2, w * 0.6, w * 0.17, w * 0.14, 0, 0, Math.PI * 2);
			ctx.fill();
			[[-0.2, 0.38], [-0.07, 0.3], [0.07, 0.3], [0.2, 0.38]].forEach(([x, y]) => {
				ctx.beginPath();
				ctx.ellipse(w * (0.5 + x), w * y, w * 0.06, w * 0.08, 0, 0, Math.PI * 2);
				ctx.fill();
			});
		})} position={[0.08, 8.8, 2.6]} rotation={[0.1, Math.PI / 2, 0.05]} glow={0.3} />
	</group>
);

/* ---------- Mayor's office (Biscuit) ---------- */
// Desk top height:
export const OFFICE_DESK_Y = 6.82;
export const OFFICE_DOG: V3 = [0, 6.83, -6.0];

export const MayorOffice: React.FC<{papers?: boolean; children?: React.ReactNode}> = ({papers = true, children}) => {
	const wall = plastic('#f4e4c8', {rough: 0.7});
	return (
		<group>
			<mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={plastic('#ffffff', {map: noiseTex('wood1', '#b9784a', '#7a4a2a', 'wood', 6), rough: 0.5})}>
				<planeGeometry args={[40, 40]} />
			</mesh>
			<mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -2]} receiveShadow geometry={circleGeo(9, 48)} material={plastic('#b8242e', {rough: 0.9})} />
			<mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, -2]} receiveShadow geometry={RING} material={plastic('#ffcc3a', {rough: 0.6})} />
			{/* walls */}
			<mesh geometry={boxGeo(40, 18, 0.5)} material={wall} position={[0, 9, -14]} receiveShadow />
			<mesh geometry={boxGeo(0.5, 18, 40)} material={wall} position={[-16, 9, 0]} receiveShadow />
			<mesh geometry={boxGeo(0.5, 18, 40)} material={wall} position={[16, 9, 0]} receiveShadow />
			<mesh geometry={boxGeo(40, 3.2, 0.6)} material={plastic('#8a5030', {rough: 0.5})} position={[0, 1.6, -13.8]} />
			<mesh geometry={boxGeo(0.6, 3.2, 40)} material={plastic('#8a5030', {rough: 0.5})} position={[-15.8, 1.6, 0]} />
			<mesh geometry={boxGeo(0.6, 3.2, 40)} material={plastic('#8a5030', {rough: 0.5})} position={[15.8, 1.6, 0]} />
			<Window position={[0, 10, -13.7]} w={11} h={8} curtains="#b8242e" />
			<Bookshelf position={[-15.0, 0, -6]} yaw={Math.PI / 2} />
			<Flag position={[11, 0, -11]} />
			<TextPlane text="MAYOR'S OFFICE" w={8} opts={{w: 1024, h: 160, bg: '#2a3a6a', color: '#ffcc3a', radius: 30}} position={[-9, 15, -13.7]} glow={0.4} />
			{/* furniture */}
			<GiantChair position={[0, 0, -8.0]} />
			<BookStack position={[0, 3.5, -6.6]} n={6} seed="desk" w={2.6} />
			<Desk position={[0, 0, -3]} w={13} h={OFFICE_DESK_Y - 0.2} d={5} />
			<NamePlate position={[0, OFFICE_DESK_Y, -0.9]} text="MAYOR BISCUIT" />
			{papers ? (
				<>
					<PaperPile position={[-4.2, OFFICE_DESK_Y + 0.02, -3.4]} n={14} seed="p1" />
					<PaperPile position={[-2.4, OFFICE_DESK_Y + 0.02, -2.6]} n={8} seed="p2" />
					<PaperPile position={[4.6, OFFICE_DESK_Y + 0.02, -3.6]} n={18} seed="p3" />
				</>
			) : null}
			<InkPad position={[2.6, OFFICE_DESK_Y + 0.02, -3.0]} />
			<group position={[-5.6, OFFICE_DESK_Y, -4.6]}>
				<Cyl r={0.5} r2={0.4} h={1.2} color="#2a5bd7" position={[0, 0.6, 0]} />
				{[-0.15, 0.1, 0.25].map((x, i) => (
					<Box key={i} s={[0.1, 1.6, 0.1]} color={['#ffcc22', '#d42a3a', '#22aa55'][i]} position={[x, 1.3, 0]} rotation={[0, 0, (i - 1) * 0.15]} />
				))}
			</group>
			{children}
		</group>
	);
};

/* ---------- Old mayor's dark office ---------- */

export const DarkOffice: React.FC<{lamp?: number; children?: React.ReactNode}> = ({lamp = 1, children}) => {
	const wall = plastic('#3c3550', {rough: 0.8});
	return (
		<group>
			<mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={plastic('#ffffff', {map: noiseTex('wood2', '#5a3a2a', '#3a2418', 'wood', 6), rough: 0.6})}>
				<planeGeometry args={[40, 40]} />
			</mesh>
			<mesh geometry={boxGeo(40, 18, 0.5)} material={wall} position={[0, 9, -12]} receiveShadow />
			<mesh geometry={boxGeo(0.5, 18, 40)} material={wall} position={[-14, 9, 0]} receiveShadow />
			<mesh geometry={boxGeo(0.5, 18, 40)} material={wall} position={[14, 9, 0]} receiveShadow />
			<Window position={[5, 9.5, -11.7]} w={7} h={7} night blinds />
			<Glow position={[5, 9.5, -11]} size={10} color="#6a8aff" opacity={0.18} />
			{/* framed portrait of the old mayor (drawn) */}
			<group position={[-6, 10, -11.6]}>
				<RBox s={[4.6, 5.6, 0.3]} r={0.1} mat={plastic('#ffcc3a', {metal: 0.6, rough: 0.4})} />
				<Plane w={3.8} h={4.8} position={[0, 0, 0.17]} map={canvasTex('portrait', 256, 320, (ctx, w, h) => {
					ctx.fillStyle = '#4a3a5a';
					ctx.fillRect(0, 0, w, h);
					ctx.fillStyle = '#f0c9a2';
					ctx.beginPath();
					ctx.ellipse(w / 2, h * 0.42, w * 0.26, h * 0.2, 0, 0, Math.PI * 2);
					ctx.fill();
					ctx.fillStyle = '#7c8089';
					ctx.fillRect(w * 0.18, h * 0.62, w * 0.64, h * 0.4);
					ctx.fillStyle = '#1d1410';
					ctx.fillRect(w * 0.38, h * 0.38, 10, 12);
					ctx.fillRect(w * 0.58, h * 0.38, 10, 12);
					ctx.fillStyle = '#5a5a5a';
					ctx.fillRect(w * 0.38, h * 0.5, w * 0.24, 8);
				})} glow={0.2} />
			</group>
			<Desk position={[0, 0, -3]} w={11} h={4.6} d={4.6} color="#4a2a18" />
			{/* banker's lamp */}
			<group position={[3.6, 4.8, -4]}>
				<Cyl r={0.5} h={0.2} mat={plastic('#ffcc3a', {metal: 0.7, rough: 0.3})} position={[0, 0.1, 0]} />
				<Cyl r={0.08} h={1.4} mat={plastic('#ffcc3a', {metal: 0.7, rough: 0.3})} position={[0, 0.8, 0]} />
				<mesh geometry={cylGeo(0.35, 0.9, 0.6, 16, true)} material={plastic('#1f7a4a', {clearcoat: 0.6, side: THREE.DoubleSide})} position={[0, 1.6, 0.2]} rotation={[0.2, 0, 0]} />
				<mesh geometry={sphGeo(0.25, 10, 8)} material={plastic('#fff2c0', {emissive: '#ffd27a', ei: 4 * lamp})} position={[0, 1.4, 0.25]} />
				<pointLight position={[0, 1.2, 0.6]} intensity={70 * lamp} distance={22} decay={1.6} color="#ffc070" castShadow shadow-mapSize={[1024, 1024]} />
				<Glow position={[0, 1.4, 0.3]} size={3} color="#ffc070" opacity={0.6 * lamp} />
			</group>
			<GiantChair position={[0, 0, -7.5]} color="#3a1a20" scale={0.75} />
			{children}
		</group>
	);
};

/* ---------- Town meeting room ---------- */

export const MeetingRoom: React.FC<{children?: React.ReactNode}> = ({children}) => {
	const wall = plastic('#e8dcc6', {rough: 0.7});
	return (
		<group>
			<mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={plastic('#ffffff', {map: noiseTex('wood3', '#c48a5a', '#8a5a3a', 'wood', 8), rough: 0.5})}>
				<planeGeometry args={[60, 60]} />
			</mesh>
			<mesh geometry={boxGeo(60, 20, 0.5)} material={wall} position={[0, 10, -16]} receiveShadow />
			<mesh geometry={boxGeo(0.5, 20, 60)} material={wall} position={[-22, 10, 0]} receiveShadow />
			<mesh geometry={boxGeo(0.5, 20, 60)} material={wall} position={[22, 10, 0]} receiveShadow />
			<mesh geometry={boxGeo(60, 3, 0.6)} material={plastic('#7a4a2a')} position={[0, 1.5, -15.8]} />
			{/* windows on side walls */}
			{[-8, 4, 16].map((z) => (
				<group key={z}>
					<mesh geometry={planeGeo(5, 7)} material={unlit('#ffffff', {map: skylineTex(false)})} position={[-21.7, 9, z]} rotation={[0, Math.PI / 2, 0]} />
					<mesh geometry={planeGeo(5, 7)} material={unlit('#ffffff', {map: skylineTex(false)})} position={[21.7, 9, z]} rotation={[0, -Math.PI / 2, 0]} />
				</group>
			))}
			<TextPlane text="TOWN MEETING" w={18} opts={{w: 1024, h: 180, bg: '#2a5bd7', color: '#ffffff', radius: 40, border: '#ffcc22', borderW: 14}} position={[0, 15, -15.7]} glow={0.45} />
			<Flag position={[-14, 0, -14]} />
			<Flag position={[14, 0, -14]} color="#d42a3a" />
			{/* stage + long table */}
			<RBox s={[30, 1.2, 9]} r={0.1} color="#8a5030" position={[0, 0.6, -11]} />
			<RBox s={[18, 0.3, 3.2]} r={0.08} color="#f2f2f6" position={[0, 4.6, -9.6]} />
			<Box s={[18, 3.3, 0.1]} color="#2a5bd7" position={[0, 2.95, -8.0]} />
			<TextPlane text="MAYOR" w={3.6} opts={{w: 512, h: 128, bg: '#ffcc22', color: '#1d2a5c', radius: 20}} position={[0, 3.2, -7.9]} glow={0.45} />
			{children}
		</group>
	);
};

/** Simple chair for seated townspeople. */
export const Chair: React.FC<{position: V3; yaw?: number; color?: string}> = ({position, yaw = 0, color = '#c0392b'}) => (
	<group position={position} rotation={[0, yaw, 0]}>
		<RBox s={[2.4, 0.3, 2.2]} r={0.08} color={color} position={[0, 2.0, 0]} />
		<RBox s={[2.4, 2.6, 0.3]} r={0.08} color={color} position={[0, 3.3, -1.0]} />
		{[-1, 1].map((sx) => [-1, 1].map((sz) => <Box key={`${sx}${sz}`} s={[0.16, 2.0, 0.16]} color="#2c2f3a" position={[sx * 1.0, 1.0, sz * 0.9]} />))}
	</group>
);
