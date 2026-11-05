import React, {useMemo} from 'react';
import * as THREE from 'three';
import {V3, clamp, rnd} from '../lib/anim';
import {boxGeo, coneGeo, cylGeo, litTex, planeGeo, plastic, rboxGeo, sphGeo, torusGeo, unlit} from '../three/cache';
import {Box, Cyl, Glow, Plane, RBox, Sph, TextPlane} from '../three/prims';
import {canvasTex, roundRect, textTex} from '../three/textures';
import {POPPINS} from '../lib/fonts';
import {getDogFace} from '../characters/dogFace';
import {Mic} from '../characters/Person';

/* ---------- Nature ---------- */

export const Tree: React.FC<{position: V3; scale?: number; kind?: 'round' | 'pine' | 'tall'; color?: string; night?: boolean}> = ({position, scale = 1, kind = 'round', color, night}) => {
	const trunk = plastic(night ? '#3a2a22' : '#8a5a3a', {rough: 0.8});
	if (kind === 'round') {
		const leaf = plastic(color ?? '#5cbf4a', {rough: 0.7});
		const leaf2 = plastic(color ?? '#4fae3f', {rough: 0.7});
		return (
			<group position={position} scale={scale}>
				<mesh geometry={cylGeo(0.35, 0.45, 3.2, 10)} material={trunk} position={[0, 1.6, 0]} castShadow receiveShadow />
				<mesh geometry={sphGeo(1.9, 16, 12)} material={leaf} position={[0, 4.3, 0]} castShadow receiveShadow />
				<mesh geometry={sphGeo(1.3, 14, 10)} material={leaf2} position={[1.2, 3.8, 0.4]} castShadow />
				<mesh geometry={sphGeo(1.2, 14, 10)} material={leaf2} position={[-1.1, 3.9, -0.3]} castShadow />
				<mesh geometry={sphGeo(1.1, 14, 10)} material={leaf} position={[0.2, 5.4, -0.4]} castShadow />
			</group>
		);
	}
	const leaf = plastic(color ?? (night ? '#1c3a3a' : '#2f8a4a'), {rough: 0.8});
	const h = kind === 'tall' ? 2.2 : 1;
	return (
		<group position={position} scale={scale}>
			<mesh geometry={cylGeo(0.35, 0.55, 6 * h, 8)} material={trunk} position={[0, 3 * h, 0]} castShadow receiveShadow />
			{[0, 1, 2, 3].map((i) => (
				<mesh key={i} geometry={coneGeo(2.6 - i * 0.5, 3.2, 8)} material={leaf} position={[0, 3 * h + 1 + i * 1.7 * h, 0]} castShadow receiveShadow />
			))}
		</group>
	);
};

export const Bush: React.FC<{position: V3; scale?: number; color?: string}> = ({position, scale = 1, color = '#4fb548'}) => (
	<group position={position} scale={scale}>
		<mesh geometry={sphGeo(0.9, 12, 10)} material={plastic(color, {rough: 0.8})} position={[0, 0.6, 0]} castShadow />
		<mesh geometry={sphGeo(0.7, 12, 10)} material={plastic(color, {rough: 0.8})} position={[0.8, 0.45, 0.1]} castShadow />
		<mesh geometry={sphGeo(0.65, 12, 10)} material={plastic(color, {rough: 0.8})} position={[-0.75, 0.45, -0.1]} castShadow />
	</group>
);

export const Flowers: React.FC<{position: V3; w?: number; seed?: string}> = ({position, w = 4, seed = 'f'}) => (
	<group position={position}>
		<RBox s={[w, 0.6, 1.2]} color="#9a6a4a" position={[0, 0.3, 0]} />
		<Box s={[w - 0.2, 0.1, 1.0]} color="#5a3a26" position={[0, 0.62, 0]} />
		{Array.from({length: Math.round(w * 2)}).map((_, i) => (
			<mesh key={i} geometry={sphGeo(0.17, 8, 6)} material={plastic(['#ff5c8a', '#ffd23a', '#ffffff', '#ff7a3a', '#b46cff'][Math.floor(rnd(`${seed}${i}`) * 5)])} position={[-w / 2 + 0.3 + (i * (w - 0.6)) / Math.max(1, Math.round(w * 2) - 1), 0.82, (rnd(`${seed}z${i}`) - 0.5) * 0.6]} />
		))}
	</group>
);

/* ---------- Street furniture ---------- */

export const Bench: React.FC<{position: V3; yaw?: number; color?: string}> = ({position, yaw = 0, color = '#c8763a'}) => {
	const wood = plastic(color, {rough: 0.6});
	const iron = plastic('#2c2f3a', {rough: 0.4, metal: 0.4});
	return (
		<group position={position} rotation={[0, yaw, 0]}>
			{[-0.35, 0, 0.35].map((z, i) => (
				<mesh key={i} geometry={rboxGeo(5, 0.16, 0.32, 0.05)} material={wood} position={[0, 1.55, z]} castShadow receiveShadow />
			))}
			{[0, 1].map((i) => (
				<mesh key={`b${i}`} geometry={rboxGeo(5, 0.32, 0.14, 0.05)} material={wood} position={[0, 2.15 + i * 0.5, -0.62]} castShadow />
			))}
			{[-2.1, 2.1].map((x) => (
				<group key={x}>
					<mesh geometry={boxGeo(0.16, 1.5, 1.1)} material={iron} position={[x, 0.75, 0]} castShadow />
					<mesh geometry={boxGeo(0.16, 1.3, 0.16)} material={iron} position={[x, 2.2, -0.62]} />
				</group>
			))}
		</group>
	);
};

export const StreetLamp: React.FC<{position: V3; on?: boolean; light?: boolean; color?: string}> = ({position, on = false, light = false, color = '#ffc977'}) => (
	<group position={position}>
		<mesh geometry={cylGeo(0.14, 0.2, 7, 10)} material={plastic('#2c3242', {metal: 0.5, rough: 0.35})} position={[0, 3.5, 0]} castShadow />
		<mesh geometry={cylGeo(0.35, 0.4, 0.3, 10)} material={plastic('#2c3242', {metal: 0.5, rough: 0.35})} position={[0, 0.15, 0]} />
		<mesh geometry={cylGeo(0.5, 0.3, 0.9, 8)} material={plastic(on ? '#fff2cc' : '#e8eef8', {emissive: on ? color : '#000000', ei: on ? 3 : 0, rough: 0.2})} position={[0, 7.3, 0]} />
		<mesh geometry={coneGeo(0.62, 0.45, 8)} material={plastic('#2c3242', {metal: 0.5})} position={[0, 7.95, 0]} />
		{on ? <Glow position={[0, 7.3, 0]} size={4.5} color={color} opacity={0.65} /> : null}
		{on && light ? <pointLight position={[0, 6.8, 0]} intensity={30} distance={22} decay={1.6} color={color} /> : null}
	</group>
);

/** String of party bulbs hanging between two points. */
export const StringLights: React.FC<{a: V3; b: V3; n?: number; sag?: number; on?: boolean; t?: number}> = ({a, b, n = 12, sag = 1.2, on = true, t = 0}) => {
	const cols = ['#ffd27a', '#ff8a8a', '#8ad0ff', '#a8ff9a', '#ffb0ff'];
	const pts = Array.from({length: n}).map((_, i) => {
		const u = (i + 0.5) / n;
		return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u - Math.sin(u * Math.PI) * sag, a[2] + (b[2] - a[2]) * u] as V3;
	});
	return (
		<group>
			{pts.map((p, i) => {
				const c = cols[i % cols.length];
				const tw = on ? 0.75 + 0.25 * Math.sin(t * 3 + i * 1.3) : 0;
				return (
					<group key={i}>
						<mesh geometry={sphGeo(0.16, 8, 6)} material={plastic(c, {emissive: c, ei: on ? 2.6 : 0.1})} position={p} />
						{on ? <Glow position={p} size={1.4} color={c} opacity={0.5 * tw} /> : null}
					</group>
				);
			})}
			{pts.slice(1).map((p, i) => {
				const q = pts[i];
				const mid: V3 = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2 + 0.12, (p[2] + q[2]) / 2];
				const len = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
				const dir = new THREE.Vector3(p[0] - q[0], p[1] - q[1], p[2] - q[2]).normalize();
				const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
				return <mesh key={`w${i}`} geometry={boxGeo(len, 0.03, 0.03)} material={plastic('#222')} position={mid} quaternion={quat} />;
			})}
		</group>
	);
};

export const Banner: React.FC<{text: string; position: V3; w?: number; yaw?: number; bg?: string; color?: string; poles?: boolean; h?: number}> = ({text, position, w = 12, yaw = 0, bg = '#2a5bd7', color = '#ffffff', poles = true, h}) => {
	const hh = h ?? w / 4;
	return (
		<group position={position} rotation={[0, yaw, 0]}>
			<Plane w={w} h={hh} map={textTex(text, {w: 1024, h: Math.round((1024 * hh) / w), bg, color, stroke: 'rgba(0,0,0,0.25)', strokeW: 10, radius: 30, border: '#ffffff', borderW: 14})} glow={0.35} double />
			{poles ? (
				<>
					<Cyl r={0.15} h={hh + 6} color="#e8e8ee" position={[-w / 2 - 0.15, -(6 - hh / 2) / 2 - hh / 2 + hh / 2 - 3 + hh / 2, 0]} />
					<Cyl r={0.15} h={hh + 6} color="#e8e8ee" position={[w / 2 + 0.15, -(6 - hh / 2) / 2 - hh / 2 + hh / 2 - 3 + hh / 2, 0]} />
				</>
			) : null}
		</group>
	);
};

/* ---------- Vehicles ---------- */

const Wheel: React.FC<{position: V3}> = ({position}) => (
	<group position={position} rotation={[0, 0, Math.PI / 2]}>
		<mesh geometry={cylGeo(0.75, 0.75, 0.6, 16)} material={plastic('#1d1d22', {rough: 0.8})} castShadow />
		<mesh geometry={cylGeo(0.38, 0.38, 0.62, 12)} material={plastic('#c8ccd6', {metal: 0.6, rough: 0.3})} />
	</group>
);

export const Bus: React.FC<{position: V3; yaw?: number; children?: React.ReactNode; night?: boolean}> = ({position, yaw = 0, children, night}) => {
	const glass = plastic('#9fd8ff', {rough: 0.08, metal: 0.1, transparent: true, opacity: 0.35});
	return (
		<group position={position} rotation={[0, yaw, 0]}>
			<RBox s={[5.2, 5.2, 15]} r={0.5} color="#ffc21a" position={[0, 3.3, 0]} />
			<Box s={[5.25, 0.5, 15.05]} color="#e8eef8" position={[0, 1.4, 0]} />
			<Box s={[5.25, 0.25, 15.05]} color="#2a62d8" position={[0, 2.9, 0]} />
			{/* side windows */}
			{[-1, 1].map((s) =>
				[-5, -2.4, 0.2, 2.8].map((z) => <Box key={`${s}${z}`} s={[0.06, 1.7, 2.2]} mat={plastic('#2a3a4a', {rough: 0.1, emissive: night ? '#ffcf7a' : '#000000', ei: night ? 1.2 : 0})} position={[s * 2.62, 4.3, z]} cast={false} />),
			)}
			{/* windshield (see-through so the driver shows) */}
			<mesh geometry={boxGeo(4.6, 2.2, 0.08)} material={glass} position={[0, 4.4, 7.52]} />
			<Box s={[4.8, 0.3, 0.3]} color="#2a2a30" position={[0, 3.2, 7.55]} />
			<TextPlane text="CITY BUS" w={3.4} opts={{w: 512, h: 96, bg: '#1d1d22', color: '#ffd23a'}} position={[0, 6.1, 7.53]} glow={0.8} />
			{[-1, 1].map((s) => (
				<mesh key={s} geometry={sphGeo(0.32, 10, 8)} material={plastic('#fff6d0', {emissive: '#fff2c0', ei: night ? 3 : 0.4})} position={[s * 1.8, 1.9, 7.55]} />
			))}
			<Wheel position={[-2.6, 0.75, 4.6]} />
			<Wheel position={[2.6, 0.75, 4.6]} />
			<Wheel position={[-2.6, 0.75, -4.8]} />
			<Wheel position={[2.6, 0.75, -4.8]} />
			{children}
		</group>
	);
};

export const Car: React.FC<{position: V3; yaw?: number; color?: string; children?: React.ReactNode; police?: boolean; t?: number}> = ({position, yaw = 0, color = '#ff5a5a', children, police, t = 0}) => {
	const blink = Math.sin(t * 14) > 0;
	return (
		<group position={position} rotation={[0, yaw, 0]}>
			<RBox s={[4.2, 1.6, 8]} r={0.5} color={police ? '#1d2a5c' : color} position={[0, 1.5, 0]} />
			{police ? <Box s={[4.25, 0.7, 3.2]} color="#ffffff" position={[0, 1.6, 0]} /> : null}
			<RBox s={[3.6, 1.5, 4.2]} r={0.45} color={police ? '#1d2a5c' : color} position={[0, 2.8, -0.4]} />
			<Box s={[3.3, 1.1, 0.05]} mat={plastic('#9fd8ff', {rough: 0.08, transparent: true, opacity: 0.4})} position={[0, 2.85, 1.72]} rotation={[-0.25, 0, 0]} />
			{[-1, 1].map((s) => (
				<Box key={s} s={[0.05, 1.0, 3.2]} mat={plastic('#2a3a4a', {rough: 0.1})} position={[s * 1.81, 2.85, -0.4]} cast={false} />
			))}
			<Wheel position={[-2.0, 0.75, 2.6]} />
			<Wheel position={[2.0, 0.75, 2.6]} />
			<Wheel position={[-2.0, 0.75, -2.6]} />
			<Wheel position={[2.0, 0.75, -2.6]} />
			{police ? (
				<group position={[0, 3.75, -0.4]}>
					<Box s={[2.6, 0.18, 0.7]} color="#d8d8de" />
					<mesh geometry={rboxGeo(1.1, 0.4, 0.6, 0.1)} material={plastic('#ff2a2a', {emissive: '#ff2020', ei: blink ? 6 : 0.4})} position={[-0.65, 0.25, 0]} />
					<mesh geometry={rboxGeo(1.1, 0.4, 0.6, 0.1)} material={plastic('#2a5aff', {emissive: '#2050ff', ei: blink ? 0.4 : 6})} position={[0.65, 0.25, 0]} />
					<Glow position={[-0.65, 0.3, 0]} size={blink ? 9 : 2} color="#ff3030" opacity={blink ? 0.9 : 0.3} />
					<Glow position={[0.65, 0.3, 0]} size={blink ? 2 : 9} color="#3060ff" opacity={blink ? 0.3 : 0.9} />
					<pointLight position={[-0.65, 1, 0]} color="#ff2a2a" intensity={blink ? 60 : 4} distance={30} decay={1.4} />
					<pointLight position={[0.65, 1, 0]} color="#2a5aff" intensity={blink ? 4 : 60} distance={30} decay={1.4} />
				</group>
			) : null}
			{children}
		</group>
	);
};

/* ---------- Buildings ---------- */

export const House: React.FC<{position: V3; yaw?: number; color?: string; roof?: string; night?: boolean; w?: number; seed?: string}> = ({position, yaw = 0, color = '#7ab8e8', roof = '#c84a3a', night, w = 9, seed = 'h'}) => {
	const glow = night ? '#ffcf7a' : '#000000';
	const winM = plastic(night ? '#ffe2a0' : '#bfe6ff', {rough: 0.15, emissive: glow, ei: night ? 1.8 : 0});
	const prism = useMemo(() => {
		const sh = new THREE.Shape();
		sh.moveTo(-w / 2 - 0.6, 0);
		sh.lineTo(w / 2 + 0.6, 0);
		sh.lineTo(0, 3.6);
		sh.closePath();
		const g = new THREE.ExtrudeGeometry(sh, {depth: 9.2, bevelEnabled: false});
		g.translate(0, 0, -4.6);
		return g;
	}, [w]);
	return (
		<group position={position} rotation={[0, yaw, 0]}>
			<RBox s={[w, 7, 8]} r={0.15} color={color} position={[0, 3.5, 0]} />
			<mesh geometry={prism} material={plastic(roof, {rough: 0.6})} position={[0, 7, 0]} castShadow receiveShadow />
			<Box s={[1.8, 3.2, 0.2]} color="#8a4a2a" position={[0, 1.6, 4.05]} />
			{[-2.6, 2.6].map((x) => (
				<group key={x}>
					<Box s={[1.8, 1.7, 0.12]} mat={winM} position={[x, 2.5, 4.04]} cast={false} />
					<Box s={[1.8, 1.7, 0.12]} mat={winM} position={[x, 5.3, 4.04]} cast={false} />
					<Box s={[2.1, 0.2, 0.3]} color="#ffffff" position={[x, 1.6, 4.1]} />
					<Box s={[2.1, 0.2, 0.3]} color="#ffffff" position={[x, 4.4, 4.1]} />
				</group>
			))}
			<Box s={[1.8, 1.7, 0.12]} mat={rnd(seed) > 0.4 ? winM : plastic('#2a3a5a')} position={[0, 5.3, 4.04]} cast={false} />
			<Box s={[1.4, 3, 1.4]} color="#9a9aa2" position={[w / 2 - 1.5, 9.6, -1]} />
		</group>
	);
};

const awningTex = (c1: string, c2: string) =>
	canvasTex(`awn|${c1}|${c2}`, 256, 64, (ctx, w, h) => {
		for (let i = 0; i < 8; i++) {
			ctx.fillStyle = i % 2 ? c1 : c2;
			ctx.fillRect((i * w) / 8, 0, w / 8 + 1, h);
		}
		ctx.fillStyle = 'rgba(0,0,0,0.12)';
		ctx.fillRect(0, h * 0.8, w, h * 0.2);
	});

export const Shop: React.FC<{position: V3; yaw?: number; name: string; color: string; awning: [string, string]; night?: boolean; w?: number; h?: number; children?: React.ReactNode}> = ({position, yaw = 0, name, color, awning, night, w = 11, h = 9, children}) => {
	const winM = plastic(night ? '#ffe2a0' : '#bfe6ff', {rough: 0.1, emissive: night ? '#ffc870' : '#2a4a6a', ei: night ? 1.6 : 0.15});
	return (
		<group position={position} rotation={[0, yaw, 0]}>
			<RBox s={[w, h, 8]} r={0.12} color={color} position={[0, h / 2, 0]} />
			<Box s={[w + 0.4, 0.6, 8.4]} color="#ffffff" position={[0, h + 0.3, 0]} />
			{/* shop window + door */}
			<Box s={[w * 0.5, 3.4, 0.15]} mat={winM} position={[-w * 0.17, 2.4, 4.02]} cast={false} />
			<Box s={[w * 0.54, 0.3, 0.4]} color="#ffffff" position={[-w * 0.17, 0.6, 4.1]} />
			<Box s={[2, 3.8, 0.2]} color="#7a4a2a" position={[w * 0.3, 1.9, 4.04]} />
			<mesh geometry={sphGeo(0.12, 8, 6)} material={plastic('#ffd23a', {metal: 0.6})} position={[w * 0.3 + 0.6, 1.9, 4.2]} />
			{/* striped awning */}
			<mesh geometry={boxGeo(w * 0.9, 0.14, 2.4)} material={litTex(awningTex(awning[0], awning[1]), 0.25, {transparent: false})} position={[0, 4.6, 5.0]} rotation={[0.35, 0, 0]} castShadow />
			<TextPlane text={name} w={w * 0.8} opts={{w: 1024, h: 200, bg: '#ffffff', color: awning[0], radius: 40, border: awning[0], borderW: 14}} position={[0, h - 1.6, 4.06]} glow={night ? 0.9 : 0.35} />
			{/* upstairs windows */}
			{[-w * 0.3, 0, w * 0.3].map((x) => (
				<Box key={x} s={[1.6, 1.6, 0.12]} mat={winM} position={[x, h - 3.6, 4.03]} cast={false} />
			))}
			{children}
		</group>
	);
};

/* ---------- Event props ---------- */

const sealTex = () =>
	canvasTex('seal', 256, 256, (ctx, w) => {
		ctx.fillStyle = '#ffcc3a';
		ctx.beginPath();
		ctx.arc(w / 2, w / 2, w * 0.46, 0, Math.PI * 2);
		ctx.fill();
		ctx.strokeStyle = '#a06a10';
		ctx.lineWidth = 10;
		ctx.stroke();
		ctx.fillStyle = '#a06a10';
		// paw print
		ctx.beginPath();
		ctx.ellipse(w / 2, w * 0.6, w * 0.15, w * 0.12, 0, 0, Math.PI * 2);
		ctx.fill();
		[[-0.17, 0.4], [-0.06, 0.32], [0.06, 0.32], [0.17, 0.4]].forEach(([x, y]) => {
			ctx.beginPath();
			ctx.ellipse(w * (0.5 + x), w * y, w * 0.05, w * 0.065, 0, 0, Math.PI * 2);
			ctx.fill();
		});
	});

export const Podium: React.FC<{position: V3; yaw?: number; mics?: number; t?: number}> = ({position, yaw = 0, mics = 9}) => {
	const wood = plastic('#8a4e2c', {rough: 0.45, clearcoat: 0.4});
	const micCols = ['#d42a2a', '#2a5bd7', '#ffcc22', '#22aa55', '#ff7a1a', '#9b5de5', '#111111', '#ffffff', '#00b4d8', '#ff4f9a'];
	return (
		<group position={position} rotation={[0, yaw, 0]}>
			<RBox s={[3.4, 3.6, 2.0]} r={0.15} mat={wood} position={[0, 1.8, 0]} />
			<RBox s={[3.8, 0.25, 2.4]} r={0.08} mat={wood} position={[0, 3.65, 0.05]} rotation={[0.18, 0, 0]} />
			<mesh geometry={planeGeo(1.5, 1.5)} material={litTex(sealTex(), 0.4)} position={[0, 2.0, 1.01]} />
			{Array.from({length: mics}).map((_, i) => {
				const u = mics === 1 ? 0 : i / (mics - 1) - 0.5;
				return <Mic key={i} position={[u * 2.8, 3.82 + (i % 2) * 0.1, 0.85 + (i % 3) * 0.12]} rotation={[0.75 + (i % 2) * 0.1, 0, -u * 0.9]} color={micCols[i % micCols.length]} scale={0.8} />;
			})}
		</group>
	);
};

export const VotingBooth: React.FC<{position: V3; yaw?: number; color?: string; curtain?: number}> = ({position, yaw = 0, color = '#2a5bd7', curtain = 1}) => (
	<group position={position} rotation={[0, yaw, 0]}>
		<RBox s={[3.2, 6.2, 0.2]} color="#e8eef8" position={[0, 3.1, -1.5]} />
		<RBox s={[0.2, 6.2, 3]} color="#e8eef8" position={[-1.6, 3.1, 0]} />
		<RBox s={[0.2, 6.2, 3]} color="#e8eef8" position={[1.6, 3.1, 0]} />
		<RBox s={[3.4, 0.4, 3.2]} color={color} position={[0, 6.3, 0]} />
		<TextPlane text="VOTE" w={2.6} opts={{w: 512, h: 160, bg: color, color: '#ffffff'}} position={[0, 6.3, 1.62]} glow={0.5} />
		<Box s={[2.9 * curtain, 4.6, 0.08]} mat={plastic('#d42a3a', {rough: 0.7})} position={[-1.45 + 1.45 * curtain, 3.6, 1.45]} />
		<Box s={[2.9, 0.12, 0.12]} color="#cfd3dc" position={[0, 5.95, 1.45]} />
	</group>
);

export const BallotBox: React.FC<{position: V3; yaw?: number; scale?: number}> = ({position, yaw = 0, scale = 1}) => (
	<group position={position} rotation={[0, yaw, 0]} scale={scale}>
		<RBox s={[2.4, 2.2, 2.0]} r={0.1} color="#2a5bd7" position={[0, 1.1, 0]} />
		<Box s={[1.4, 0.06, 0.2]} color="#0c1a3a" position={[0, 2.21, 0]} />
		<TextPlane text={'BALLOT\nBOX'} w={2.0} opts={{w: 512, h: 300, bg: '#ffffff', color: '#2a5bd7', radius: 30}} position={[0, 1.15, 1.01]} glow={0.4} />
	</group>
);

export const Table: React.FC<{position: V3; w?: number; d?: number; h?: number; color?: string; cloth?: string}> = ({position, w = 6, d = 3, h = 2.6, color = '#c08050', cloth}) => (
	<group position={position}>
		<RBox s={[w, 0.25, d]} r={0.06} color={cloth ?? color} position={[0, h, 0]} />
		{cloth ? <Box s={[w, h - 0.1, 0.06]} color={cloth} position={[0, h / 2, d / 2]} /> : null}
		{[-1, 1].map((sx) => [-1, 1].map((sz) => <Box key={`${sx}${sz}`} s={[0.22, h, 0.22]} color="#7a5030" position={[sx * (w / 2 - 0.3), h / 2, sz * (d / 2 - 0.3)]} />))}
	</group>
);

/* Split-flap style results board. a/b are the vote counts to show (already animated by the shot). */
const digitTex = (ch: string) =>
	canvasTex(`dig|${ch}`, 128, 176, (ctx, w, h) => {
		ctx.fillStyle = '#16181f';
		roundRect(ctx, 4, 4, w - 8, h - 8, 14);
		ctx.fill();
		ctx.fillStyle = '#23262f';
		ctx.fillRect(4, 4, w - 8, h / 2 - 6);
		ctx.font = `800 130px ${POPPINS}, sans-serif`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillStyle = '#ffffff';
		ctx.fillText(ch, w / 2, h / 2 + 8);
		ctx.fillStyle = '#000000';
		ctx.fillRect(4, h / 2 - 2, w - 8, 4);
	});

const FlapNumber: React.FC<{value: number; digits: number; position: V3; flip?: number; color?: string}> = ({value, digits, position, flip = 0}) => {
	const s = Math.max(0, Math.round(value)).toString().padStart(digits, ' ');
	const W = 1.0;
	return (
		<group position={position}>
			{s.split('').map((ch, i) => (
				<group key={i} position={[(i - (digits - 1) / 2) * (W + 0.12), 0, 0]}>
					<mesh geometry={planeGeo(W, W * 1.375)} material={litTex(digitTex(ch === ' ' ? '' : ch), 0.6, {transparent: false})} rotation={[i === digits - 1 ? Math.sin(flip * Math.PI) * 0.0 + flip * 0 : 0, 0, 0]} />
				</group>
			))}
		</group>
	);
};

export const ResultsBoard: React.FC<{position: V3; yaw?: number; a: number; b: number; glowA?: number}> = ({position, yaw = 0, a, b, glowA = 0}) => (
	<group position={position} rotation={[0, yaw, 0]}>
		<RBox s={[12, 10, 0.8]} r={0.3} color="#1f3a8a" position={[0, 6.5, 0]} />
		<RBox s={[11.2, 1.8, 0.3]} r={0.15} color="#ffcc22" position={[0, 10.3, 0.45]} />
		<TextPlane text="RESULTS" w={8} opts={{w: 1024, h: 200, color: '#1f3a8a'}} position={[0, 10.3, 0.62]} glow={0.6} />
		<TextPlane text="BISCUIT" w={4.6} opts={{w: 768, h: 160, color: '#ffffff', align: 'left'}} position={[-3.2, 7.6, 0.42]} glow={0.7} />
		<TextPlane text="OLD MAYOR" w={4.6} opts={{w: 768, h: 160, color: '#ffffff', align: 'left'}} position={[-3.2, 4.2, 0.42]} glow={0.7} />
		<FlapNumber value={a} digits={4} position={[2.9, 7.6, 0.45]} />
		<FlapNumber value={b} digits={4} position={[2.9, 4.2, 0.45]} />
		{glowA > 0 ? <Glow position={[2.9, 7.6, 1]} size={10 * glowA} color="#ffe27a" opacity={0.45 * glowA} /> : null}
		<Box s={[0.5, 2, 0.5]} color="#2c3242" position={[-4, 1, 0]} />
		<Box s={[0.5, 2, 0.5]} color="#2c3242" position={[4, 1, 0]} />
	</group>
);

/* ---------- Office props ---------- */

export const Desk: React.FC<{position: V3; w?: number; h?: number; d?: number; color?: string}> = ({position, w = 12, h = 4.2, d = 5, color = '#7a4426'}) => {
	const wood = plastic(color, {rough: 0.4, clearcoat: 0.5});
	const dark = plastic('#5a2e18', {rough: 0.5});
	return (
		<group position={position}>
			<RBox s={[w, 0.4, d]} r={0.1} mat={wood} position={[0, h, 0]} />
			<RBox s={[w - 0.4, h - 0.2, 0.25]} r={0.06} mat={dark} position={[0, (h - 0.2) / 2, d / 2 - 0.3]} />
			<RBox s={[3, h - 0.2, d - 0.4]} r={0.08} mat={wood} position={[-w / 2 + 1.6, (h - 0.2) / 2, 0]} />
			<RBox s={[3, h - 0.2, d - 0.4]} r={0.08} mat={wood} position={[w / 2 - 1.6, (h - 0.2) / 2, 0]} />
			{[1.1, 2.3, 3.4].map((y) => (
				<group key={y}>
					<Box s={[2.6, 0.9, 0.06]} color="#8a4e2c" position={[-w / 2 + 1.6, y, d / 2 - 0.15]} />
					<Box s={[0.5, 0.12, 0.12]} mat={plastic('#ffcc3a', {metal: 0.8, rough: 0.3})} position={[-w / 2 + 1.6, y, d / 2 - 0.05]} />
					<Box s={[2.6, 0.9, 0.06]} color="#8a4e2c" position={[w / 2 - 1.6, y, d / 2 - 0.15]} />
					<Box s={[0.5, 0.12, 0.12]} mat={plastic('#ffcc3a', {metal: 0.8, rough: 0.3})} position={[w / 2 - 1.6, y, d / 2 - 0.05]} />
				</group>
			))}
		</group>
	);
};

export const GiantChair: React.FC<{position: V3; yaw?: number; color?: string; scale?: number}> = ({position, yaw = 0, color = '#b8242e', scale = 1}) => {
	const leather = plastic(color, {rough: 0.35, clearcoat: 0.5});
	const gold = plastic('#ffcc3a', {metal: 0.8, rough: 0.3});
	return (
		<group position={position} rotation={[0, yaw, 0]} scale={scale}>
			<RBox s={[5, 1.0, 4.5]} r={0.35} mat={leather} position={[0, 3.0, 0]} />
			<RBox s={[5, 9, 1.0]} r={0.4} mat={leather} position={[0, 7.5, -2.0]} />
			<RBox s={[0.8, 2.2, 4.2]} r={0.3} mat={leather} position={[-2.7, 4.0, 0]} />
			<RBox s={[0.8, 2.2, 4.2]} r={0.3} mat={leather} position={[2.7, 4.0, 0]} />
			<Cyl r={0.3} h={2.5} mat={gold} position={[0, 1.25, 0]} />
			<Cyl r={2} r2={2.2} h={0.25} mat={gold} position={[0, 0.12, 0]} />
			<Sph r={0.45} mat={gold} position={[-2.2, 12.1, -2]} />
			<Sph r={0.45} mat={gold} position={[2.2, 12.1, -2]} />
		</group>
	);
};

export const BookStack: React.FC<{position: V3; n?: number; seed?: string; w?: number}> = ({position, n = 6, seed = 'bk', w = 2.6}) => {
	const cols = ['#d42a3a', '#2a5bd7', '#22aa55', '#ffcc22', '#9b5de5', '#ff7a1a', '#1aa6b7'];
	let y = 0;
	return (
		<group position={position}>
			{Array.from({length: n}).map((_, i) => {
				const h = 0.42 + rnd(`${seed}h${i}`) * 0.2;
				const yy = y + h / 2;
				y += h;
				const c = cols[Math.floor(rnd(`${seed}c${i}`) * cols.length)];
				return (
					<group key={i} position={[(rnd(`${seed}x${i}`) - 0.5) * 0.3, yy, 0]} rotation={[0, (rnd(`${seed}r${i}`) - 0.5) * 0.3, 0]}>
						<RBox s={[w, h, w * 0.75]} r={0.05} color={c} />
						<Box s={[w - 0.1, h - 0.12, w * 0.75 + 0.02]} color="#fff8e6" position={[0.06, 0, 0]} cast={false} />
					</group>
				);
			})}
		</group>
	);
};

export const BOOKSTACK_H = (n: number, seed = 'bk') => Array.from({length: n}).reduce<number>((a, _, i) => a + 0.42 + rnd(`${seed}h${i}`) * 0.2, 0);

export const PaperPile: React.FC<{position: V3; n?: number; seed?: string; w?: number}> = ({position, n = 8, seed = 'pp', w = 1.6}) => (
	<group position={position}>
		{Array.from({length: n}).map((_, i) => (
			<Box key={i} s={[w, 0.07, w * 1.3]} color={i % 3 === 0 ? '#fffdf5' : '#f4f1e6'} position={[(rnd(`${seed}x${i}`) - 0.5) * 0.25, 0.04 + i * 0.075, (rnd(`${seed}z${i}`) - 0.5) * 0.25]} rotation={[0, (rnd(`${seed}r${i}`) - 0.5) * 0.4, 0]} />
		))}
	</group>
);

export const InkPad: React.FC<{position: V3}> = ({position}) => (
	<group position={position}>
		<RBox s={[1.6, 0.25, 1.1]} r={0.06} color="#1f2a5a" position={[0, 0.125, 0]} />
		<Box s={[1.35, 0.04, 0.85]} color="#141a3a" position={[0, 0.26, 0]} />
	</group>
);

export const NamePlate: React.FC<{position: V3; text: string; yaw?: number}> = ({position, text, yaw = 0}) => (
	<group position={position} rotation={[0, yaw, 0]}>
		<Box s={[3.4, 0.7, 0.5]} color="#3a2414" position={[0, 0.35, 0]} rotation={[-0.3, 0, 0]} />
		<TextPlane text={text} w={3.1} opts={{w: 1024, h: 200, bg: '#ffcc3a', color: '#3a2414', radius: 20}} position={[0, 0.4, 0.27]} rotation={[-0.3, 0, 0]} glow={0.4} />
	</group>
);

/* Paw-print shape drawn on canvas. */
export const drawPaw = (ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: string) => {
	ctx.fillStyle = color;
	ctx.beginPath();
	ctx.ellipse(cx, cy + s * 0.18, s * 0.3, s * 0.25, 0, 0, Math.PI * 2);
	ctx.fill();
	[[-0.33, -0.12, -0.35], [-0.12, -0.32, -0.1], [0.12, -0.32, 0.1], [0.33, -0.12, 0.35]].forEach(([x, y, r]) => {
		ctx.beginPath();
		ctx.ellipse(cx + x * s, cy + y * s, s * 0.11, s * 0.15, r, 0, Math.PI * 2);
		ctx.fill();
	});
};

/** Paper with "NEW LAW" title, body text and an optional paw-print stamp (0..1 strength). */
export const lawTex = (stamp: number, body: string, title = 'NEW LAW') => {
	const q = Math.round(clamp(stamp) * 5) / 5;
	return canvasTex(`law|${q}|${body}|${title}`, 768, 1024, (ctx, w, h) => {
		ctx.fillStyle = '#fffaf0';
		ctx.fillRect(0, 0, w, h);
		ctx.strokeStyle = '#d9b45a';
		ctx.lineWidth = 16;
		ctx.strokeRect(24, 24, w - 48, h - 48);
		ctx.textAlign = 'center';
		ctx.fillStyle = '#b8242e';
		ctx.font = `800 120px ${POPPINS}, sans-serif`;
		ctx.fillText(title, w / 2, 190);
		ctx.fillStyle = '#d9b45a';
		ctx.fillRect(w * 0.2, 230, w * 0.6, 8);
		ctx.fillStyle = '#2a2a3a';
		ctx.font = `800 72px ${POPPINS}, sans-serif`;
		body.split('\n').forEach((l, i) => ctx.fillText(l, w / 2, 360 + i * 92));
		ctx.font = `600 34px ${POPPINS}, sans-serif`;
		ctx.fillStyle = '#7a7a8a';
		ctx.fillText('signed: Mayor Biscuit', w / 2, h - 90);
		if (q > 0) {
			ctx.globalAlpha = q;
			drawPaw(ctx, w / 2, h - 300, 230, '#1f2a6a');
			ctx.globalAlpha = 1;
		}
	});
};

export const Paper: React.FC<{position: V3; rotation?: V3; w?: number; tex: THREE.Texture; glow?: number}> = ({position, rotation, w = 3, tex, glow = 0.35}) => (
	<group position={position} rotation={rotation}>
		<Box s={[w, 0.03, (w * 4) / 3]} color="#fffaf0" />
		<mesh geometry={planeGeo(w, (w * 4) / 3)} material={litTex(tex, glow, {transparent: false})} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} />
	</group>
);

/** Newspaper front page; the photo of Biscuit uses the user's dog face image. */
export const newspaperTex = () =>
	canvasTex(`news|${getDogFace() ? 1 : 0}`, 1024, 1300, (ctx, w, h) => {
		ctx.fillStyle = '#f3efe3';
		ctx.fillRect(0, 0, w, h);
		ctx.fillStyle = '#1a1a1a';
		ctx.textAlign = 'center';
		ctx.font = `800 64px ${POPPINS}, serif`;
		ctx.fillText('THE TOWN TIMES', w / 2, 90);
		ctx.fillRect(40, 115, w - 80, 6);
		ctx.font = `800 118px ${POPPINS}, sans-serif`;
		ctx.fillText('DOG MAYOR', w / 2, 250);
		ctx.fillText('LOVED BY ALL', w / 2, 370);
		ctx.fillRect(40, 400, w - 80, 4);
		const img = getDogFace()?.image as HTMLImageElement | undefined;
		ctx.fillStyle = '#cfc8b4';
		ctx.fillRect(60, 430, 520, 430);
		if (img) {
			ctx.filter = 'grayscale(0.2) contrast(1.05)';
			ctx.drawImage(img, 70, 440, 500, 410);
			ctx.filter = 'none';
		}
		ctx.fillStyle = '#9a9488';
		for (let i = 0; i < 16; i++) ctx.fillRect(610, 440 + i * 26, 360 - (i % 4 === 3 ? 120 : 0), 12);
		for (let c = 0; c < 3; c++) for (let i = 0; i < 14; i++) ctx.fillRect(60 + c * 315, 900 + i * 26, 290 - (i % 5 === 4 ? 100 : 0), 12);
		ctx.font = `600 30px ${POPPINS}, sans-serif`;
		ctx.fillStyle = '#3a3a3a';
		ctx.fillText('Approval rating: 100%  •  Belly rubs: free', w / 2, 880);
	});

/* ---------- Particles ---------- */

/** Confetti: instanced little cards falling and spinning, deterministic from t. */
export const Confetti: React.FC<{t: number; n?: number; area?: [number, number]; top?: number; center?: V3; fall?: number}> = ({t, n = 260, area = [30, 20], top = 22, center = [0, 0, 0], fall = 3.2}) => {
	const geo = planeGeo(0.32, 0.5);
	const mat = useMemo(() => new THREE.MeshStandardMaterial({side: THREE.DoubleSide, roughness: 0.5, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.15}), []);
	const mesh = useMemo(() => {
		const m = new THREE.InstancedMesh(geo, mat, n);
		const cols = ['#ff4f7a', '#ffd23a', '#3ad1ff', '#7aff6a', '#b46cff', '#ff8a3a', '#ffffff'];
		for (let i = 0; i < n; i++) m.setColorAt(i, new THREE.Color(cols[i % cols.length]));
		m.frustumCulled = false;
		return m;
	}, [geo, mat, n]);
	const o = new THREE.Object3D();
	for (let i = 0; i < n; i++) {
		const sp = 0.6 + rnd(`cf${i}`) * 0.8;
		const y = top - (((t * fall * sp + rnd(`cy${i}`) * top) % top) + 0);
		o.position.set(center[0] + (rnd(`cx${i}`) - 0.5) * area[0] + Math.sin(t * 2 + i) * 0.6, center[1] + y, center[2] + (rnd(`cz${i}`) - 0.5) * area[1]);
		o.rotation.set(t * (2 + rnd(`cr${i}`) * 4) + i, t * 3 + i * 0.7, t * (1 + rnd(`cq${i}`) * 3));
		o.updateMatrix();
		mesh.setMatrixAt(i, o.matrix);
	}
	mesh.instanceMatrix.needsUpdate = true;
	if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
	return <primitive object={mesh} />;
};

const ballTex = () =>
	canvasTex('tennis', 256, 128, (ctx, w, h) => {
		ctx.fillStyle = '#d8f03a';
		ctx.fillRect(0, 0, w, h);
		ctx.strokeStyle = '#ffffff';
		ctx.lineWidth = 8;
		ctx.beginPath();
		for (let x = 0; x <= w; x += 4) {
			const y = h / 2 + Math.sin((x / w) * Math.PI * 4) * h * 0.28;
			x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
		}
		ctx.stroke();
	});

export const TennisBall: React.FC<{position: V3; r?: number; spin?: number}> = ({position, r = 0.35, spin = 0}) => (
	<mesh geometry={sphGeo(r, 16, 12)} material={plastic('#ffffff', {map: ballTex(), rough: 0.85, emissive: '#3a4a00', ei: 0.3})} position={position} rotation={[spin, spin * 0.7, 0]} castShadow />
);

/** Lots of tennis balls flying in arcs (deterministic). */
export const FlyingBalls: React.FC<{t: number; n?: number; area?: number; slow?: number}> = ({t, n = 40, area = 30, slow = 1}) => (
	<group>
		{Array.from({length: n}).map((_, i) => {
			const per = 1.6 + rnd(`bp${i}`) * 1.4;
			const ph = ((t * slow) / per + rnd(`bo${i}`)) % 1;
			const x0 = (rnd(`bx${i}`) - 0.5) * area;
			const z0 = (rnd(`bz${i}`) - 0.5) * area * 0.8;
			const dx = (rnd(`bdx${i}`) - 0.5) * 16;
			const dz = (rnd(`bdz${i}`) - 0.5) * 10;
			const hgt = 5 + rnd(`bh${i}`) * 9;
			return <TennisBall key={i} position={[x0 + dx * ph, 0.35 + 4 * hgt * ph * (1 - ph), z0 + dz * ph]} spin={t * 6 + i} />;
		})}
	</group>
);

/* ---------- Misc ---------- */

export const Clock: React.FC<{hours: number; minutes: number; r?: number; position?: V3; rotation?: V3; night?: boolean}> = ({hours, minutes, r = 2.6, position, rotation, night}) => {
	const face = canvasTex('clockface', 512, 512, (ctx, w) => {
		ctx.fillStyle = '#fffaf0';
		ctx.beginPath();
		ctx.arc(w / 2, w / 2, w * 0.49, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = '#1a1a2a';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.font = `800 54px ${POPPINS}, sans-serif`;
		for (let i = 1; i <= 12; i++) {
			const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
			ctx.fillText(String(i), w / 2 + Math.cos(a) * w * 0.38, w / 2 + Math.sin(a) * w * 0.38 + 3);
		}
		for (let i = 0; i < 60; i++) {
			const a = (i / 60) * Math.PI * 2;
			const r1 = w * (i % 5 === 0 ? 0.43 : 0.455);
			ctx.lineWidth = i % 5 === 0 ? 6 : 2;
			ctx.strokeStyle = '#1a1a2a';
			ctx.beginPath();
			ctx.moveTo(w / 2 + Math.cos(a) * r1, w / 2 + Math.sin(a) * r1);
			ctx.lineTo(w / 2 + Math.cos(a) * w * 0.475, w / 2 + Math.sin(a) * w * 0.475);
			ctx.stroke();
		}
	});
	const mA = -((minutes / 60) * Math.PI * 2);
	const hA = -(((hours % 12) / 12) * Math.PI * 2 + (minutes / 60) * (Math.PI / 6));
	const hand = plastic('#1a1a2a', {rough: 0.3});
	return (
		<group position={position} rotation={rotation}>
			<mesh geometry={cylGeo(r * 1.1, r * 1.1, 0.3, 40)} material={plastic('#ffcc3a', {metal: 0.7, rough: 0.3})} rotation={[Math.PI / 2, 0, 0]} />
			<mesh geometry={planeGeo(r * 2, r * 2)} material={night ? unlit('#ffe6b0', {map: face, transparent: true}) : litTex(face, 0.45)} position={[0, 0, 0.16]} />
			<group position={[0, 0, 0.22]} rotation={[0, 0, hA]}>
				<mesh geometry={boxGeo(r * 0.09, r * 0.55, 0.06)} material={hand} position={[0, r * 0.25, 0]} />
			</group>
			<group position={[0, 0, 0.26]} rotation={[0, 0, mA]}>
				<mesh geometry={boxGeo(r * 0.06, r * 0.82, 0.06)} material={hand} position={[0, r * 0.38, 0]} />
			</group>
			<mesh geometry={cylGeo(r * 0.08, r * 0.08, 0.1, 12)} material={plastic('#ffcc3a', {metal: 0.7})} position={[0, 0, 0.3]} rotation={[Math.PI / 2, 0, 0]} />
		</group>
	);
};

/** Camera flash burst: bright sprite + light, strength 0..1. */
export const Flash: React.FC<{position: V3; k: number}> = ({position, k}) =>
	k > 0.01 ? (
		<group>
			<Glow position={position} size={6 * k} color="#ffffff" opacity={k} />
			<pointLight position={position} intensity={120 * k} distance={30} decay={1.5} color="#ffffff" />
		</group>
	) : null;

export const Fence: React.FC<{position: V3; len?: number; yaw?: number; color?: string}> = ({position, len = 10, yaw = 0, color = '#ffffff'}) => (
	<group position={position} rotation={[0, yaw, 0]}>
		{Array.from({length: Math.round(len / 0.8)}).map((_, i) => (
			<Box key={i} s={[0.3, 1.8, 0.15]} color={color} position={[-len / 2 + i * 0.8, 0.9, 0]} />
		))}
		<Box s={[len, 0.2, 0.1]} color={color} position={[-0.4, 1.3, 0.1]} />
		<Box s={[len, 0.2, 0.1]} color={color} position={[-0.4, 0.6, 0.1]} />
	</group>
);

export const SpeechBubble: React.FC<{text: string; position: V3; w?: number; k?: number}> = ({text, position, w = 3, k = 1}) => {
	const tex = canvasTex(`bub3|${text}`, 512, 300, (ctx, W, H) => {
		ctx.fillStyle = '#ffffff';
		ctx.strokeStyle = '#1a1a1a';
		ctx.lineWidth = 12;
		roundRect(ctx, 14, 14, W - 28, H - 90, 90);
		ctx.fill();
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(W * 0.4, H - 82);
		ctx.lineTo(W * 0.33, H - 12);
		ctx.lineTo(W * 0.55, H - 82);
		ctx.closePath();
		ctx.fill();
		ctx.stroke();
		ctx.fillRect(W * 0.39, H - 100, W * 0.17, 24);
		ctx.font = `800 ${text.length > 6 ? 78 : 100}px ${POPPINS}, sans-serif`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillStyle = '#1a1a1a';
		ctx.fillText(text, W / 2, (H - 76) / 2 + 10);
	});
	return k > 0.01 ? (
		<sprite position={position} scale={[w * k, ((w * 300) / 512) * k, 1]}>
			<spriteMaterial map={tex} transparent depthWrite={false} />
		</sprite>
	) : null;
};

export {Glow, TextPlane, Box, RBox, Cyl, Sph, Plane, textTex, torusGeo};
