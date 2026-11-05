import React from 'react';
import * as THREE from 'three';
import {V3, rnd} from '../lib/anim';
import {coneGeo, cylGeo, litTex, planeGeo, plastic, rboxGeo, sphGeo, torusGeo} from '../three/cache';
import {canvasTex, roundRect} from '../three/textures';
import {Expr, FaceStyle, faceTex} from './faces';

/* One reusable Roblox-style blocky person. Different looks = different colours/parts. */

export type Hair = 'messy' | 'combover' | 'pigtails' | 'long' | 'short' | 'bun' | 'afro' | 'bald' | 'ponytail' | 'spiky' | 'bob';
export type Front = 'hoodie' | 'suit' | 'dress' | 'tee' | 'apron' | 'police' | 'jacket' | 'none' | 'driver' | 'reporter';
export type Hat = 'driver' | 'police' | 'chef' | 'cap' | null;

export type Look = {
	skin: string;
	shirt: string;
	pants: string;
	shoes: string;
	hair: Hair;
	hairColor: string;
	face: FaceStyle;
	front?: Front;
	accent?: string; // tie / stripes / apron colour
	sleeves?: 'long' | 'short';
	skirt?: string | null;
	scale?: V3; // body proportions
	headScale?: number;
	hat?: Hat;
	sunglasses?: boolean;
	headphones?: boolean;
	chain?: 'gold' | 'silver' | 'mayor' | null;
	backpack?: boolean;
	glasses?: boolean;
	hatColor?: string;
};

export type Pose = {
	walk?: number; // walk phase (radians); legs/arms swing
	walkAmp?: number;
	run?: boolean;
	armL?: V3; // explicit arm rotations (x forward/back, y, z sideways)
	armR?: V3;
	legL?: V3;
	legR?: V3;
	sit?: boolean; // sitting on a seat (thighs forward)
	kneel?: number; // 0..1
	lean?: number; // body pitch forward
	twist?: number; // torso yaw
	headPitch?: number;
	headYaw?: number;
	headTilt?: number;
	bob?: number; // vertical offset
	bodyRoll?: number;
};

export type PersonProps = {
	look: Look;
	t: number;
	expr?: Expr;
	talking?: boolean;
	pose?: Pose;
	position?: V3;
	yaw?: number;
	scale?: number;
	seed?: number;
	hold?: 'teddy' | 'mic' | 'camera' | 'flashlight' | 'newspaper' | 'paper' | 'ball' | 'pen' | null;
	holdR?: React.ReactNode;
	blinkOff?: boolean;
	lod?: 'high' | 'low';
	faceGlow?: number;
};

const BLACK = '#17171c';

/* ---------- Torso front textures ---------- */

const frontTex = (front: Front, shirt: string, accent: string) =>
	canvasTex(`front|${front}|${shirt}|${accent}`, 256, 256, (ctx, w, h) => {
		ctx.clearRect(0, 0, w, h);
		const star = (x: number, y: number, R: number, color: string) => {
			ctx.fillStyle = color;
			ctx.beginPath();
			for (let i = 0; i < 10; i++) {
				const a = (i * Math.PI) / 5 - Math.PI / 2;
				const r = i % 2 ? R * 0.45 : R;
				ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
			}
			ctx.closePath();
			ctx.fill();
		};
		switch (front) {
			case 'hoodie':
				// open zip hoodie over a white tee, white drawstrings, star on chest
				ctx.fillStyle = '#f2f2f4';
				ctx.fillRect(w * 0.36, 0, w * 0.28, h);
				ctx.strokeStyle = '#d8d8de';
				ctx.lineWidth = 3;
				ctx.beginPath();
				ctx.moveTo(w * 0.36, 0);
				ctx.lineTo(w * 0.36, h);
				ctx.moveTo(w * 0.64, 0);
				ctx.lineTo(w * 0.64, h);
				ctx.stroke();
				ctx.strokeStyle = '#ffffff';
				ctx.lineWidth = 5;
				ctx.beginPath();
				ctx.moveTo(w * 0.33, h * 0.05);
				ctx.lineTo(w * 0.33, h * 0.45);
				ctx.moveTo(w * 0.67, h * 0.05);
				ctx.lineTo(w * 0.67, h * 0.4);
				ctx.stroke();
				star(w * 0.82, h * 0.3, w * 0.075, '#ffffff');
				// silver chain
				ctx.strokeStyle = '#c9ccd6';
				ctx.lineWidth = 3;
				ctx.beginPath();
				ctx.moveTo(w * 0.4, 0);
				ctx.quadraticCurveTo(w * 0.5, h * 0.42, w * 0.6, 0);
				ctx.stroke();
				ctx.fillStyle = '#c9ccd6';
				ctx.fillRect(w * 0.485, h * 0.2, w * 0.03, h * 0.06);
				// pockets
				ctx.strokeStyle = 'rgba(255,255,255,0.12)';
				ctx.lineWidth = 3;
				ctx.strokeRect(w * 0.06, h * 0.68, w * 0.24, h * 0.22);
				ctx.strokeRect(w * 0.7, h * 0.68, w * 0.24, h * 0.22);
				break;
			case 'suit': {
				// grey suit: white shirt V, dark tie, lapels, buttons
				ctx.fillStyle = '#ffffff';
				ctx.beginPath();
				ctx.moveTo(w * 0.32, 0);
				ctx.lineTo(w * 0.68, 0);
				ctx.lineTo(w * 0.5, h * 0.55);
				ctx.closePath();
				ctx.fill();
				ctx.fillStyle = accent;
				ctx.beginPath();
				ctx.moveTo(w * 0.46, h * 0.04);
				ctx.lineTo(w * 0.54, h * 0.04);
				ctx.lineTo(w * 0.56, h * 0.42);
				ctx.lineTo(w * 0.5, h * 0.52);
				ctx.lineTo(w * 0.44, h * 0.42);
				ctx.closePath();
				ctx.fill();
				ctx.strokeStyle = 'rgba(0,0,0,0.3)';
				ctx.lineWidth = 6;
				ctx.beginPath();
				ctx.moveTo(w * 0.3, 0);
				ctx.lineTo(w * 0.5, h * 0.58);
				ctx.lineTo(w * 0.7, 0);
				ctx.stroke();
				ctx.fillStyle = 'rgba(0,0,0,0.35)';
				[0.68, 0.82].forEach((y) => {
					ctx.beginPath();
					ctx.arc(w * 0.5, h * y, 6, 0, Math.PI * 2);
					ctx.fill();
				});
				ctx.fillStyle = '#ffffff';
				ctx.fillRect(w * 0.12, h * 0.22, w * 0.12, h * 0.05);
				break;
			}
			case 'dress':
				ctx.fillStyle = 'rgba(255,255,255,0.85)';
				ctx.beginPath();
				ctx.ellipse(w * 0.5, 0, w * 0.22, h * 0.14, 0, 0, Math.PI);
				ctx.fill();
				ctx.fillStyle = accent;
				for (let i = 0; i < 9; i++) {
					ctx.beginPath();
					ctx.arc(w * (0.15 + (i % 3) * 0.35), h * (0.35 + Math.floor(i / 3) * 0.25), 9, 0, Math.PI * 2);
					ctx.fill();
				}
				ctx.fillStyle = 'rgba(0,0,0,0.12)';
				ctx.fillRect(0, h * 0.86, w, h * 0.14);
				break;
			case 'apron':
				ctx.fillStyle = '#ffffff';
				roundRect(ctx, w * 0.18, h * 0.12, w * 0.64, h * 0.95, 20);
				ctx.fill();
				ctx.fillStyle = accent;
				ctx.fillRect(w * 0.18, h * 0.55, w * 0.64, h * 0.05);
				break;
			case 'police':
				ctx.fillStyle = '#ffd34d';
				star(w * 0.75, h * 0.3, w * 0.07, '#ffd34d');
				ctx.fillStyle = 'rgba(0,0,0,0.25)';
				ctx.fillRect(w * 0.48, 0, w * 0.04, h);
				ctx.fillRect(0, h * 0.82, w, h * 0.08);
				break;
			case 'driver':
				ctx.fillStyle = accent;
				ctx.fillRect(w * 0.47, 0, w * 0.06, h);
				ctx.fillStyle = '#ffd34d';
				ctx.fillRect(w * 0.15, h * 0.25, w * 0.18, h * 0.08);
				break;
			case 'reporter':
				ctx.fillStyle = '#ffffff';
				ctx.beginPath();
				ctx.moveTo(w * 0.36, 0);
				ctx.lineTo(w * 0.64, 0);
				ctx.lineTo(w * 0.5, h * 0.4);
				ctx.closePath();
				ctx.fill();
				ctx.fillStyle = '#ffffff';
				roundRect(ctx, w * 0.66, h * 0.22, w * 0.2, h * 0.14, 6);
				ctx.fill();
				ctx.fillStyle = '#d42a2a';
				ctx.fillRect(w * 0.68, h * 0.25, w * 0.16, h * 0.04);
				break;
			case 'jacket':
				ctx.fillStyle = accent;
				ctx.fillRect(w * 0.4, 0, w * 0.2, h);
				ctx.fillStyle = 'rgba(0,0,0,0.2)';
				ctx.fillRect(w * 0.49, 0, w * 0.02, h);
				break;
			case 'tee':
				ctx.fillStyle = accent;
				ctx.beginPath();
				ctx.arc(w * 0.5, h * 0.45, w * 0.16, 0, Math.PI * 2);
				ctx.fill();
				break;
			default:
				break;
		}
	});

/* ---------- Hair ---------- */

const HairMesh: React.FC<{hair: Hair; color: string; hs: number}> = ({hair, color, hs}) => {
	const m = plastic(color, {rough: 0.55, clearcoat: 0.2});
	const W = 1.42 * hs;
	const top = 0.66 * hs;
	switch (hair) {
		case 'bald':
			return null;
		case 'combover':
			return (
				<group>
					<mesh geometry={rboxGeo(1.44 * hs, 0.5 * hs, 1.1 * hs, 0.15)} material={m} position={[0, 0.0, -0.18 * hs]} castShadow />
					{[-0.25, -0.05, 0.15, 0.35].map((x, i) => (
						<mesh key={i} geometry={rboxGeo(0.07, 0.05, 1.05 * hs, 0.02)} material={m} position={[x * hs, top - 0.035, 0.05]} rotation={[0, 0.85, 0.05 * i]} />
					))}
				</group>
			);
		case 'messy': {
			// messy black block hair: a cap + angled spikes + bangs
			const spikes: [V3, V3, V3][] = [
				[[-0.55, 0.62, 0.35], [0.5, 0.3, 0.6], [0.5, 0.3, 0.5]],
				[[0.45, 0.66, 0.4], [0.4, -0.3, -0.5], [0.5, 0.3, 0.5]],
				[[0, 0.8, 0.1], [0.3, 0.2, 0.1], [0.7, 0.35, 0.8]],
				[[-0.75, 0.3, 0.1], [0, 0, 0.9], [0.45, 0.3, 0.7]],
				[[0.78, 0.25, 0.05], [0, 0, -0.95], [0.45, 0.3, 0.7]],
				[[-0.3, 0.72, -0.4], [-0.5, 0.4, 0.3], [0.5, 0.3, 0.6]],
				[[0.35, 0.7, -0.45], [-0.4, -0.5, -0.4], [0.5, 0.3, 0.6]],
				[[0, 0.35, -0.75], [-1.0, 0, 0], [0.9, 0.3, 0.6]],
				[[-0.85, 0.65, -0.2], [0.2, 0.3, 1.1], [0.35, 0.25, 0.55]],
				[[0.9, 0.62, -0.15], [0.2, -0.3, -1.1], [0.35, 0.25, 0.55]],
			];
			return (
				<group scale={hs}>
					<mesh geometry={rboxGeo(1.5, 0.62, 1.42, 0.25)} material={m} position={[0, 0.48, -0.05]} castShadow />
					<mesh geometry={rboxGeo(1.48, 1.0, 0.5, 0.2)} material={m} position={[0, 0.05, -0.5]} castShadow />
					{/* bangs over the forehead */}
					{[-0.42, -0.12, 0.18, 0.45].map((x, i) => (
						<mesh key={i} geometry={coneGeo(0.2, 0.62, 5)} material={m} position={[x, 0.25 - (i % 2) * 0.06, 0.62]} rotation={[0.25, 0, Math.PI + (i - 1.5) * 0.25]} castShadow />
					))}
					{spikes.map(([p, r, s], i) => (
						<mesh key={`s${i}`} geometry={rboxGeo(s[0], s[1], s[2], 0.1)} material={m} position={p} rotation={r} castShadow />
					))}
					<mesh geometry={coneGeo(0.22, 0.6, 5)} material={m} position={[-0.72, -0.05, 0.38]} rotation={[0.2, 0, 0.15]} castShadow />
					<mesh geometry={coneGeo(0.22, 0.6, 5)} material={m} position={[0.72, -0.05, 0.38]} rotation={[0.2, 0, -0.15]} castShadow />
				</group>
			);
		}
		case 'pigtails':
			return (
				<group>
					<mesh geometry={rboxGeo(W, 0.6 * hs, 1.42 * hs, 0.25)} material={m} position={[0, 0.42 * hs, -0.04]} castShadow />
					<mesh geometry={rboxGeo(W, 0.9 * hs, 0.5 * hs, 0.2)} material={m} position={[0, 0.05, -0.48 * hs]} castShadow />
					<mesh geometry={rboxGeo(1.3 * hs, 0.28 * hs, 0.3 * hs, 0.1)} material={m} position={[0, 0.55 * hs, 0.55 * hs]} castShadow />
					{[-1, 1].map((s) => (
						<group key={s} position={[s * 0.85 * hs, 0.2 * hs, -0.1]}>
							<mesh geometry={sphGeo(0.13 * hs, 12, 8)} material={plastic('#ff5fa2')} />
							<mesh geometry={rboxGeo(0.42 * hs, 0.95 * hs, 0.42 * hs, 0.18)} material={m} position={[s * 0.18 * hs, -0.42 * hs, 0]} rotation={[0, 0, s * 0.25]} castShadow />
						</group>
					))}
				</group>
			);
		case 'long':
			return (
				<group>
					<mesh geometry={rboxGeo(W, 0.6 * hs, 1.42 * hs, 0.25)} material={m} position={[0, 0.42 * hs, -0.04]} castShadow />
					<mesh geometry={rboxGeo(1.5 * hs, 1.9 * hs, 0.5 * hs, 0.2)} material={m} position={[0, -0.4 * hs, -0.5 * hs]} castShadow />
					<mesh geometry={rboxGeo(0.3 * hs, 1.5 * hs, 1.1 * hs, 0.12)} material={m} position={[-0.68 * hs, -0.2 * hs, -0.05]} castShadow />
					<mesh geometry={rboxGeo(0.3 * hs, 1.5 * hs, 1.1 * hs, 0.12)} material={m} position={[0.68 * hs, -0.2 * hs, -0.05]} castShadow />
					<mesh geometry={rboxGeo(1.0 * hs, 0.3 * hs, 0.3 * hs, 0.1)} material={m} position={[-0.25 * hs, 0.52 * hs, 0.55 * hs]} rotation={[0, 0, 0.25]} castShadow />
				</group>
			);
		case 'bob':
			return (
				<group>
					<mesh geometry={rboxGeo(W, 0.6 * hs, 1.42 * hs, 0.25)} material={m} position={[0, 0.42 * hs, -0.04]} castShadow />
					<mesh geometry={rboxGeo(1.52 * hs, 1.0 * hs, 1.2 * hs, 0.2)} material={m} position={[0, 0.0, -0.18 * hs]} castShadow />
				</group>
			);
		case 'bun':
			return (
				<group>
					<mesh geometry={rboxGeo(W, 0.55 * hs, 1.42 * hs, 0.25)} material={m} position={[0, 0.45 * hs, -0.04]} castShadow />
					<mesh geometry={sphGeo(0.38 * hs, 16, 12)} material={m} position={[0, 0.85 * hs, -0.35 * hs]} castShadow />
				</group>
			);
		case 'ponytail':
			return (
				<group>
					<mesh geometry={rboxGeo(W, 0.6 * hs, 1.42 * hs, 0.25)} material={m} position={[0, 0.42 * hs, -0.04]} castShadow />
					<mesh geometry={rboxGeo(0.4 * hs, 1.1 * hs, 0.4 * hs, 0.15)} material={m} position={[0, -0.1 * hs, -0.85 * hs]} rotation={[0.3, 0, 0]} castShadow />
				</group>
			);
		case 'afro':
			return <mesh geometry={sphGeo(1.0 * hs, 20, 14)} material={m} position={[0, 0.35 * hs, -0.2 * hs]} scale={[1, 0.85, 1]} castShadow />;
		case 'spiky':
			return (
				<group>
					<mesh geometry={rboxGeo(W, 0.5 * hs, 1.42 * hs, 0.2)} material={m} position={[0, 0.45 * hs, -0.04]} castShadow />
					{[-0.45, -0.15, 0.15, 0.45].map((x, i) => (
						<mesh key={i} geometry={coneGeo(0.2 * hs, 0.5 * hs, 5)} material={m} position={[x * hs, 0.8 * hs, 0.1 - (i % 2) * 0.2]} rotation={[-0.2, 0, (i - 1.5) * 0.25]} castShadow />
					))}
				</group>
			);
		default:
			// short
			return (
				<group>
					<mesh geometry={rboxGeo(W, 0.5 * hs, 1.42 * hs, 0.22)} material={m} position={[0, 0.47 * hs, -0.04]} castShadow />
					<mesh geometry={rboxGeo(W, 0.7 * hs, 0.4 * hs, 0.15)} material={m} position={[0, 0.15 * hs, -0.52 * hs]} castShadow />
				</group>
			);
	}
};

const HatMesh: React.FC<{hat: Hat; hs: number; color?: string}> = ({hat, hs, color}) => {
	if (!hat) return null;
	const y = 0.66 * hs;
	if (hat === 'chef')
		return (
			<group position={[0, y, 0]}>
				<mesh geometry={cylGeo(0.62 * hs, 0.6 * hs, 0.35 * hs, 24)} material={plastic('#ffffff')} position={[0, 0.15 * hs, 0]} castShadow />
				<mesh geometry={sphGeo(0.72 * hs, 20, 14)} material={plastic('#ffffff')} position={[0, 0.65 * hs, 0]} scale={[1, 0.7, 1]} castShadow />
			</group>
		);
	const c = color ?? (hat === 'police' ? '#1d2a5c' : hat === 'driver' ? '#2a4a8a' : '#e0383a');
	return (
		<group position={[0, y, 0]}>
			<mesh geometry={cylGeo(0.74 * hs, 0.74 * hs, 0.36 * hs, 24)} material={plastic(c)} position={[0, 0.12 * hs, 0]} castShadow />
			<mesh geometry={rboxGeo(1.2 * hs, 0.07, 0.6 * hs, 0.03)} material={plastic(hat === 'cap' ? c : BLACK, {clearcoat: 0.4})} position={[0, -0.02, 0.7 * hs]} rotation={[0.12, 0, 0]} castShadow />
			{hat !== 'cap' ? <mesh geometry={rboxGeo(0.3 * hs, 0.2 * hs, 0.06, 0.03)} material={plastic('#ffd34d', {metal: 0.6, rough: 0.3})} position={[0, 0.16 * hs, 0.75 * hs]} /> : null}
		</group>
	);
};

/* ---------- Props held in hand ---------- */

export const Teddy: React.FC<{position?: V3; rotation?: V3; scale?: number}> = ({position, rotation, scale = 1}) => {
	const brown = plastic('#a8693a', {rough: 0.85});
	const light = plastic('#e8c49a', {rough: 0.85});
	return (
		<group position={position} rotation={rotation} scale={scale}>
			<mesh geometry={sphGeo(0.42, 18, 14)} material={brown} position={[0, 0, 0]} scale={[1, 1.1, 0.9]} castShadow />
			<mesh geometry={sphGeo(0.24, 14, 10)} material={light} position={[0, -0.02, 0.33]} />
			<mesh geometry={sphGeo(0.34, 18, 14)} material={brown} position={[0, 0.62, 0.05]} castShadow />
			<mesh geometry={sphGeo(0.13, 12, 8)} material={brown} position={[-0.26, 0.88, 0]} />
			<mesh geometry={sphGeo(0.13, 12, 8)} material={brown} position={[0.26, 0.88, 0]} />
			<mesh geometry={sphGeo(0.14, 12, 8)} material={light} position={[0, 0.55, 0.32]} />
			<mesh geometry={sphGeo(0.05, 8, 6)} material={plastic('#1a1010')} position={[0, 0.6, 0.45]} />
			<mesh geometry={sphGeo(0.045, 8, 6)} material={plastic('#1a1010')} position={[-0.12, 0.72, 0.3]} />
			<mesh geometry={sphGeo(0.045, 8, 6)} material={plastic('#1a1010')} position={[0.12, 0.72, 0.3]} />
			<mesh geometry={sphGeo(0.15, 12, 8)} material={brown} position={[-0.4, 0.15, 0.1]} />
			<mesh geometry={sphGeo(0.15, 12, 8)} material={brown} position={[0.4, 0.15, 0.1]} />
			<mesh geometry={sphGeo(0.17, 12, 8)} material={brown} position={[-0.22, -0.4, 0.15]} />
			<mesh geometry={sphGeo(0.17, 12, 8)} material={brown} position={[0.22, -0.4, 0.15]} />
			<mesh geometry={rboxGeo(0.3, 0.12, 0.08, 0.03)} material={plastic('#ff4f7a')} position={[0, 0.32, 0.3]} />
		</group>
	);
};

export const Mic: React.FC<{position?: V3; rotation?: V3; color?: string; scale?: number}> = ({position, rotation, color = '#d42a2a', scale = 1}) => (
	<group position={position} rotation={rotation} scale={scale}>
		<mesh geometry={cylGeo(0.07, 0.09, 0.7, 12)} material={plastic('#222228', {clearcoat: 0.5})} castShadow />
		<mesh geometry={sphGeo(0.17, 16, 12)} material={plastic('#9a9aa6', {metal: 0.7, rough: 0.35})} position={[0, 0.45, 0]} castShadow />
		<mesh geometry={rboxGeo(0.26, 0.2, 0.26, 0.04)} material={plastic(color)} position={[0, 0.2, 0]} castShadow />
	</group>
);

export const Flashlight: React.FC<{position?: V3; rotation?: V3; on?: boolean}> = ({position, rotation, on = true}) => (
	<group position={position} rotation={rotation}>
		<mesh geometry={cylGeo(0.1, 0.1, 0.6, 12)} material={plastic('#ffcc22', {clearcoat: 0.4})} castShadow />
		<mesh geometry={cylGeo(0.16, 0.11, 0.18, 12)} material={plastic('#333338')} position={[0, 0.35, 0]} />
		{on ? <mesh geometry={cylGeo(0.14, 0.14, 0.02, 12)} material={plastic('#fffbe0', {emissive: '#fff6c0', ei: 4})} position={[0, 0.45, 0]} /> : null}
	</group>
);

export const CameraProp: React.FC<{position?: V3; rotation?: V3}> = ({position, rotation}) => (
	<group position={position} rotation={rotation}>
		<mesh geometry={rboxGeo(0.7, 0.48, 0.38, 0.06)} material={plastic('#26262c', {clearcoat: 0.3})} castShadow />
		<mesh geometry={cylGeo(0.17, 0.19, 0.3, 16)} material={plastic('#3a3a44')} position={[0, 0, 0.3]} rotation={[Math.PI / 2, 0, 0]} />
		<mesh geometry={cylGeo(0.12, 0.12, 0.02, 16)} material={plastic('#6aa0ff', {metal: 0.5, rough: 0.1})} position={[0, 0, 0.46]} rotation={[Math.PI / 2, 0, 0]} />
		<mesh geometry={rboxGeo(0.3, 0.14, 0.2, 0.03)} material={plastic('#eeeeee')} position={[0.12, 0.32, 0]} />
	</group>
);

/* ---------- The person ---------- */

export const Person: React.FC<PersonProps> = ({look, t, expr = 'neutral', talking = false, pose = {}, position, yaw = 0, scale = 1, seed = 1, hold = null, holdR, blinkOff, lod = 'high', faceGlow = 0.25}) => {
	const [sx, sy, sz] = look.scale ?? [1, 1, 1];
	const hs = look.headScale ?? 1;
	if (lod === 'low') {
		// Cheap version for big far-away crowds: a few blocks + a shared face.
		const sw = Math.sin(pose.walk ?? 0) * 0.4;
		return (
			<group position={position} rotation={[0, yaw, 0]} scale={scale}>
				<group scale={[sx, sy, sz]} position={[0, pose.bob ?? 0, 0]}>
					<mesh geometry={rboxGeo(2.0, 2.0, 1.0, 0.14)} material={plastic(look.shirt, {rough: 0.6})} position={[0, 3.0, 0]} castShadow />
					<mesh geometry={rboxGeo(0.95, 2.0, 0.95, 0.1)} material={plastic(look.pants, {rough: 0.65})} position={[-0.5, 1.0, 0]} rotation={[sw, 0, 0]} castShadow />
					<mesh geometry={rboxGeo(0.95, 2.0, 0.95, 0.1)} material={plastic(look.pants, {rough: 0.65})} position={[0.5, 1.0, 0]} rotation={[-sw, 0, 0]} castShadow />
					<mesh geometry={rboxGeo(0.95, 2.0, 0.95, 0.1)} material={plastic(look.shirt, {rough: 0.6})} position={[-1.5, 3.0, 0]} castShadow />
					<mesh geometry={rboxGeo(0.95, 2.0, 0.95, 0.1)} material={plastic(look.shirt, {rough: 0.6})} position={[1.5, 3.0, 0]} castShadow />
					<mesh geometry={rboxGeo(1.32, 1.3, 1.25, 0.4, 3)} material={plastic(look.skin, {rough: 0.5})} position={[0, 4.72, 0]} castShadow />
					<mesh geometry={rboxGeo(1.42, 0.5, 1.42, 0.2)} material={plastic(look.hairColor, {rough: 0.55})} position={[0, 5.2, -0.04]} castShadow />
					<mesh geometry={planeGeo(1.2, 1.2)} position={[0, 4.7, 0.63]} material={litTex(faceTex('man', 'happy', false, false), 0.25)} />
				</group>
			</group>
		);
	}
	const skin = plastic(look.skin, {rough: 0.5, clearcoat: 0.15});
	const shirt = plastic(look.shirt, {rough: 0.6});
	const pants = plastic(look.pants, {rough: 0.65});
	const shoes = plastic(look.shoes, {rough: 0.45});
	const sleeve = look.sleeves ?? 'long';

	// Blink every few seconds (seeded so people don't blink together).
	const period = 2.6 + rnd(`bp${seed}`) * 2.2;
	const blink = !blinkOff && ((t + rnd(`bo${seed}`) * period) % period) < 0.13;
	const mouthOpen = talking && Math.sin(t * 15 + seed) + 0.6 * Math.sin(t * 23.7 + seed * 2) > 0.1;

	const wph = pose.walk ?? 0;
	const amp = pose.walkAmp ?? (pose.walk !== undefined ? (pose.run ? 1.0 : 0.55) : 0);
	const swing = Math.sin(wph) * amp;
	const bob = (pose.walk !== undefined ? Math.abs(Math.cos(wph)) * (pose.run ? 0.22 : 0.08) : 0) + (pose.bob ?? 0);

	const kneel = pose.kneel ?? 0;
	const sit = pose.sit ?? false;
	const legL: V3 = pose.legL ?? (sit ? [-1.5, 0, 0.05] : kneel > 0 ? [-1.5 * kneel, 0, 0] : [swing, 0, 0]);
	const legR: V3 = pose.legR ?? (sit ? [-1.5, 0, -0.05] : kneel > 0 ? [0.25 * kneel, 0, 0] : [-swing, 0, 0]);
	const armL: V3 = pose.armL ?? [-swing * 0.9, 0, 0.06];
	const armR: V3 = pose.armR ?? [swing * 0.9, 0, -0.06];
	const lowered = sit ? 0 : kneel * 1.05;

	const front = look.front ?? 'none';
	const ftex = front !== 'none' ? frontTex(front, look.shirt, look.accent ?? '#c0303a') : null;

	const Arm: React.FC<{side: -1 | 1; rot: V3}> = ({side, rot}) => (
		<group position={[side * 1.5, 3.85, 0]} rotation={rot}>
			{sleeve === 'short' ? (
				<>
					<mesh geometry={rboxGeo(0.95, 0.85, 0.95, 0.12)} material={shirt} position={[0, -0.42, 0]} castShadow receiveShadow />
					<mesh geometry={rboxGeo(0.9, 1.15, 0.9, 0.12)} material={skin} position={[0, -1.4, 0]} castShadow receiveShadow />
				</>
			) : (
				<>
					<mesh geometry={rboxGeo(0.95, 1.75, 0.95, 0.12)} material={shirt} position={[0, -0.88, 0]} castShadow receiveShadow />
					<mesh geometry={rboxGeo(0.86, 0.32, 0.86, 0.12)} material={skin} position={[0, -1.84, 0]} castShadow receiveShadow />
					{look.front === 'hoodie' ? (
						<>
							<mesh geometry={rboxGeo(0.04, 1.6, 0.13, 0.015)} material={plastic('#f4f4f6')} position={[side * 0.48, -0.85, 0.16]} />
							<mesh geometry={rboxGeo(0.04, 1.6, 0.13, 0.015)} material={plastic('#f4f4f6')} position={[side * 0.48, -0.85, -0.12]} />
						</>
					) : null}
				</>
			)}
			{side === 1 && holdR ? <group position={[0, -2.0, 0.2]}>{holdR}</group> : null}
		</group>
	);

	const Leg: React.FC<{side: -1 | 1; rot: V3}> = ({side, rot}) => (
		<group position={[side * 0.5, 2.0, 0]} rotation={rot}>
			<mesh geometry={rboxGeo(0.97, 1.75, 0.97, 0.1)} material={pants} position={[0, -0.9, 0]} castShadow receiveShadow />
			<mesh geometry={rboxGeo(1.0, 0.32, 1.12, 0.1)} material={shoes} position={[0, -1.85, 0.06]} castShadow receiveShadow />
			{look.shoes === '#16161b' || look.shoes === BLACK ? <mesh geometry={rboxGeo(1.02, 0.1, 1.14, 0.04)} material={plastic('#f2f2f2')} position={[0, -1.98, 0.06]} /> : null}
		</group>
	);

	const fTex = faceTex(look.face, expr, blink, mouthOpen);

	return (
		<group position={position} rotation={[0, yaw, 0]} scale={scale}>
			<group position={[0, bob - lowered, 0]} scale={[sx, sy, sz]}>
				<Leg side={-1} rot={legL} />
				<Leg side={1} rot={legR} />
				<group rotation={[pose.lean ?? 0, pose.twist ?? 0, pose.bodyRoll ?? 0]} position={[0, 2.0, 0]}>
					<group position={[0, -2.0, 0]}>
						{/* torso */}
						<mesh geometry={rboxGeo(2.0, 2.0, 1.0, 0.14)} material={shirt} position={[0, 3.0, 0]} castShadow receiveShadow />
						{ftex ? <mesh geometry={planeGeo(1.94, 1.94)} material={litTex(ftex, 0.2)} position={[0, 3.0, 0.505]} /> : null}
						{look.skirt ? <mesh geometry={cylGeo(1.15, 1.55, 1.1, 8)} material={plastic(look.skirt, {rough: 0.6})} position={[0, 1.65, 0]} rotation={[0, Math.PI / 8, 0]} castShadow /> : null}
						{look.front === 'hoodie' ? <mesh geometry={rboxGeo(1.7, 0.55, 0.45, 0.18)} material={shirt} position={[0, 4.02, -0.38]} castShadow /> : null}
						{look.chain === 'mayor'
							? Array.from({length: 15}).map((_, i) => {
									const u = i / 14;
									const x = (u - 0.5) * 1.3;
									const y = 3.98 - (1 - Math.pow((u - 0.5) * 2, 2)) * 0.55;
									return <mesh key={`ch${i}`} geometry={sphGeo(0.075, 10, 8)} material={plastic('#ffc93a', {metal: 0.85, rough: 0.25})} position={[x, y, 0.53]} />;
								})
							: null}
						{look.chain === 'mayor' ? <mesh geometry={cylGeo(0.22, 0.22, 0.06, 20)} material={plastic('#ffc93a', {metal: 0.85, rough: 0.25, emissive: '#5a3c00', ei: 0.4})} position={[0, 3.3, 0.55]} rotation={[Math.PI / 2, 0, 0]} /> : null}
						{look.backpack ? (
							<>
								<mesh geometry={rboxGeo(1.6, 1.8, 0.7, 0.2)} material={plastic(BLACK)} position={[0, 3.0, -0.85]} castShadow />
								<mesh geometry={rboxGeo(0.2, 1.9, 0.08, 0.03)} material={plastic('#222226')} position={[-0.62, 3.05, 0.52]} />
								<mesh geometry={rboxGeo(0.22, 0.1, 0.1, 0.02)} material={plastic('#b8bcc8', {metal: 0.7, rough: 0.3})} position={[-0.62, 3.3, 0.56]} />
							</>
						) : null}
						<Arm side={-1} rot={armL} />
						<Arm side={1} rot={armR} />
						{/* neck + head */}
						<group position={[0, 4.0, 0]} rotation={[pose.headPitch ?? 0, pose.headYaw ?? 0, pose.headTilt ?? 0]}>
							<group position={[0, 0.72 * hs, 0]}>
								<mesh geometry={rboxGeo(1.32 * hs, 1.3 * hs, 1.25 * hs, 0.4 * hs, 4)} material={skin} castShadow receiveShadow />
								{lod === 'high' || true ? (
									<mesh geometry={planeGeo(1.25 * hs, 1.25 * hs)} position={[0, -0.02 * hs, 0.63 * hs]} renderOrder={2}>
										<meshStandardMaterial map={fTex} transparent alphaTest={0.05} roughness={0.6} emissiveMap={fTex} emissive="#ffffff" emissiveIntensity={faceGlow} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
									</mesh>
								) : null}
								<HairMesh hair={look.hair} color={look.hairColor} hs={hs} />
								<HatMesh hat={look.hat ?? null} hs={hs} color={look.hatColor} />
								{look.sunglasses ? (
									<group position={[0, 0.88 * hs, 0.32 * hs]} rotation={[-0.45, 0, -0.08]}>
										<mesh geometry={rboxGeo(1.2 * hs, 0.28 * hs, 0.12 * hs, 0.06)} material={plastic('#f6f6f8', {clearcoat: 0.6})} castShadow />
										<mesh geometry={rboxGeo(0.46 * hs, 0.17 * hs, 0.05, 0.03)} material={plastic('#0c0c10', {rough: 0.1, clearcoat: 1})} position={[-0.28 * hs, 0, 0.05 * hs]} />
										<mesh geometry={rboxGeo(0.46 * hs, 0.17 * hs, 0.05, 0.03)} material={plastic('#0c0c10', {rough: 0.1, clearcoat: 1})} position={[0.28 * hs, 0, 0.05 * hs]} />
									</group>
								) : null}
								{look.glasses ? (
									<group position={[0, 0.1 * hs, 0.66 * hs]}>
										<mesh geometry={torusGeo(0.17 * hs, 0.025, 6, 20)} material={plastic('#3a2a1a')} position={[-0.24 * hs, 0, 0]} />
										<mesh geometry={torusGeo(0.17 * hs, 0.025, 6, 20)} material={plastic('#3a2a1a')} position={[0.24 * hs, 0, 0]} />
									</group>
								) : null}
							</group>
							{look.headphones ? (
								<group position={[0, -0.05, 0.05]}>
									<mesh geometry={torusGeo(0.66, 0.06, 8, 24, Math.PI)} material={plastic('#f2f2f4', {clearcoat: 0.5})} position={[0, 0.1, 0.05]} rotation={[Math.PI / 2 + 0.35, 0, Math.PI]} />
									{[-1, 1].map((s) => (
										<group key={s} position={[s * 0.62, 0.12, 0.42]} rotation={[0, s * 0.6, 0]} scale={0.72}>
											<mesh geometry={cylGeo(0.36, 0.36, 0.26, 20)} material={plastic('#f4f4f6', {clearcoat: 0.6})} rotation={[0, 0, Math.PI / 2]} castShadow />
											<mesh geometry={planeGeo(0.42, 0.42)} material={litTex(canvasTex('hpstar', 128, 128, (ctx, w) => {
												ctx.fillStyle = '#111';
												ctx.beginPath();
												for (let i = 0; i < 10; i++) {
													const a = (i * Math.PI) / 5 - Math.PI / 2;
													const r = i % 2 ? w * 0.18 : w * 0.42;
													ctx.lineTo(w / 2 + Math.cos(a) * r, w / 2 + Math.sin(a) * r);
												}
												ctx.closePath();
												ctx.fill();
											}), 0.2)} position={[s * 0.135, 0, 0]} rotation={[0, s * Math.PI / 2, 0]} />
										</group>
									))}
								</group>
							) : null}
						</group>
						{/* held props */}
						{hold === 'teddy' ? <Teddy position={[0, 2.95, 1.05]} scale={1.15} rotation={[0.1, 0, 0]} /> : null}
						{hold === 'newspaper' ? null : null}
					</group>
				</group>
			</group>
		</group>
	);
};
