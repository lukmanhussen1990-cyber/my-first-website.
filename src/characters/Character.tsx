// One reusable blocky character builder. Different specs give different people:
// colours, outfit, hair, hats, glasses, mustache, accessories. Pose + face drive the animation.
import React from 'react';
import * as THREE from 'three';
import {useCurrentFrame} from 'remotion';
import {plastic, rbox, sphere, cyl, torus, cone, circle, goldMat} from '../lib/materials';
import {faceMaterial, EXPRESSIONS, Expression, FaceParts, FaceStyle, DEFAULT_STYLE, MouthKind, EyeKind, featureXY} from './faceTexture';
import {Pose, REST} from './poses';
import {hash} from '../lib/random';
import {V3} from '../lib/anim';
import {Bucket} from '../props/Bucket';
import {Crown} from '../props/HandProps';

export type HairKind = 'messy' | 'baldSides' | 'bun' | 'short' | 'long' | 'ponytail' | 'afro' | 'spiky' | 'buzz' | 'pigtails' | 'curly' | 'none';
export type HatKind = 'cap' | 'nightcap' | 'beanie' | 'none';
export type OutfitKind = 'hoodie' | 'cardigan' | 'overalls' | 'dress' | 'tshirt' | 'pajamas' | 'shirt';

export type CharSpec = {
	name: string;
	seed: number;
	scale: number;
	skin: string;
	face?: Partial<FaceStyle>;
	bodyW?: number;
	bodyD?: number;
	headSize?: number;
	limbW?: number;
	legH?: number;
	hair: HairKind;
	hairColor: string;
	hat?: HatKind;
	hatColor?: string;
	outfit: OutfitKind;
	top: string;
	top2?: string;
	sleeve?: 'long' | 'short' | 'none';
	pants: string;
	shorts?: boolean;
	shoes: string;
	boots?: boolean;
	glasses?: 'round' | 'square' | null;
	glassesColor?: string;
	mustache?: string | null;
	backBucket?: boolean;
	emblem?: string | null;
};

export type CharacterProps = {
	spec: CharSpec;
	pose?: Pose;
	expr?: Expression;
	face?: Partial<FaceParts>;
	/** 0..1 how open the mouth is (lip flap) */
	talk?: number;
	blink?: boolean;
	look?: [number, number];
	position?: V3;
	/** yaw in radians */
	rotation?: number;
	holdR?: React.ReactNode;
	holdL?: React.ReactNode;
	holdRUpright?: boolean;
	holdLUpright?: boolean;
	lod?: 'high' | 'low';
	cape?: string | null;
	capeSwing?: number;
	crown?: boolean;
	nightcap?: boolean;
	headOnly?: boolean;
	shadow?: boolean;
	frameOffset?: number;
	headExtra?: React.ReactNode;
	children?: React.ReactNode;
};

// ------------------------------------------------------------------ helpers
const darken = (hex: string, k: number) => '#' + new THREE.Color(hex).multiplyScalar(1 - k).getHexString();
const lighten = (hex: string, k: number) => '#' + new THREE.Color(hex).lerp(new THREE.Color('#ffffff'), k).getHexString();

type Dims = {
	legH: number; legW: number; legD: number;
	torsoW: number; torsoH: number; torsoD: number;
	armW: number; armD: number; armH: number;
	headW: number; headH: number; headD: number; headR: number; hs: number;
};

export function dims(spec: CharSpec): Dims {
	const bw = spec.bodyW ?? 1;
	const lw = spec.limbW ?? 1;
	const hs = spec.headSize ?? 1;
	return {
		legH: spec.legH ?? 2.0, legW: 0.98 * lw, legD: 0.98,
		torsoW: 2.0 * bw, torsoH: 2.0, torsoD: 1.0 * (spec.bodyD ?? 1),
		armW: 0.98 * lw, armD: 0.98, armH: 2.0,
		headW: 1.3 * hs, headH: 1.22 * hs, headD: 1.22 * hs, headR: 0.34 * hs, hs,
	};
}

/** world height of the top of the head (unscaled by spec.scale) */
export const charHeight = (spec: CharSpec) => {
	const d = dims(spec);
	return d.legH + d.torsoH + d.headH + 0.03;
};

export function faceStyleOf(spec: CharSpec): FaceStyle {
	return {...DEFAULT_STYLE, skin: spec.skin, ...(spec.face ?? {})};
}

/** convert a point in the 512 face-texture space to local head coordinates (base head, before headSize) */
export function facePoint(px: number, py: number): [number, number] {
	const W = 1.3, H = 1.22, r = 0.34;
	const arc = (Math.PI * r) / 4;
	const tw = W - 2 * r + 2 * arc;
	const th = H - 2 * r + 2 * arc;
	return [(px / 512 - 0.5) * tw, (0.5 - py / 512) * th];
}

const OPEN_EYES: EyeKind[] = ['dot', 'wide', 'sad', 'sparkle', 'half', 'side', 'angry', 'tired'];
export function isBlinking(frame: number, seed: number) {
	const period = 96 + Math.floor(hash(seed, 91) * 44);
	const off = Math.floor(hash(seed, 92) * period);
	const f = (((frame + off) % period) + period) % period;
	return f < 3;
}

function talkMouth(base: MouthKind, talk: number): MouthKind {
	if (talk < 0.15) return base;
	const big = talk > 0.55;
	if (base === 'shout' || base === 'wail') return base;
	if (base === 'whisper') return big ? 'o' : 'whisper';
	if (base === 'smile' || base === 'bigSmile' || base === 'grin' || base === 'smirk') return big ? 'happyTalk2' : 'happyTalk1';
	return big ? 'talk2' : 'talk1';
}

const tmpQ1 = new THREE.Quaternion();
const tmpQ2 = new THREE.Quaternion();
const tmpE = new THREE.Euler();
function uprightRotation(pose: Pose, arm: V3): V3 {
	tmpQ1.setFromEuler(tmpE.set(pose.lean, pose.turn, pose.tilt));
	tmpQ2.setFromEuler(tmpE.set(arm[0], arm[1], arm[2]));
	tmpQ1.multiply(tmpQ2).invert();
	tmpE.setFromQuaternion(tmpQ1);
	return [tmpE.x, tmpE.y, tmpE.z];
}

// A mesh part
const P: React.FC<{
	g: THREE.BufferGeometry;
	m: THREE.Material | THREE.Material[];
	p?: V3;
	r?: V3;
	s?: V3 | number;
	cast?: boolean;
}> = ({g, m, p, r, s, cast = true}) => <mesh geometry={g} material={m} position={p} rotation={r} scale={s} castShadow={cast} receiveShadow />;

// ---------------------------------------------------------------- hair (base head space)
function Hair({kind, color, seed, lod}: {kind: HairKind; color: string; seed: number; lod: 'high' | 'low'}) {
	const m = plastic(color, {rough: 0.55});
	const parts: React.ReactNode[] = [];
	const k = (n: number) => hash(n, seed);
	const cap = (h = 0.5, y = 0.5) => <P key="cap" g={rbox(1.42, h, 1.4, 0.22)} m={m} p={[0, y, -0.03]} />;
	const back = (h = 0.95, y = 0.05) => <P key="back" g={rbox(1.4, h, 0.34, 0.15)} m={m} p={[0, y, -0.55]} />;
	const sides = (h = 0.62) =>
		[-1, 1].map((sd) => <P key={'side' + sd} g={rbox(0.2, h, 1.0, 0.09)} m={m} p={[sd * 0.67, 0.22, -0.1]} />);
	switch (kind) {
		case 'messy': {
			parts.push(cap(0.5, 0.52), back(), ...sides());
			// fringe chunks hanging over the forehead
			const fx = [-0.5, -0.24, 0.02, 0.27, 0.5];
			fx.forEach((x, i) => {
				parts.push(
					<P key={'f' + i} g={rbox(0.36 + k(i) * 0.08, 0.36, 0.3, 0.1)} m={m} p={[x, 0.5 + k(i + 10) * 0.05, 0.53]} r={[-0.42 - k(i + 20) * 0.2, 0, (k(i + 30) - 0.5) * 0.6]} />,
				);
			});
			// messy blocks on top
			const n = lod === 'low' ? 4 : 8;
			for (let i = 0; i < n; i++) {
				const x = (k(i + 40) - 0.5) * 1.0;
				const z = (k(i + 50) - 0.6) * 1.0;
				parts.push(
					<P key={'t' + i} g={rbox(0.36 + k(i + 60) * 0.12, 0.4, 0.36, 0.1)} m={m} p={[x, 0.76 + k(i + 70) * 0.1, z]} r={[(k(i + 80) - 0.5) * 1.2, k(i + 90) * 1.5, (k(i + 100) - 0.5) * 1.2]} />,
				);
			}
			// tuft sticking up at the back
			parts.push(<P key="tuft" g={rbox(0.3, 0.45, 0.3, 0.1)} m={m} p={[0.15, 0.9, -0.35]} r={[-0.5, 0.3, 0.4]} />);
			break;
		}
		case 'baldSides': {
			[-1, 1].forEach((sd) => {
				parts.push(<P key={'puff' + sd} g={rbox(0.34, 0.52, 0.78, 0.16)} m={m} p={[sd * 0.69, 0.03, -0.1]} />);
				parts.push(<P key={'puff2' + sd} g={rbox(0.26, 0.36, 0.4, 0.12)} m={m} p={[sd * 0.72, 0.2, -0.32]} r={[0, 0, sd * 0.2]} />);
			});
			parts.push(<P key="pback" g={rbox(1.3, 0.48, 0.32, 0.16)} m={m} p={[0, 0.0, -0.6]} />);
			break;
		}
		case 'bun': {
			parts.push(cap(0.46, 0.52), back(0.9, 0.08), ...sides(0.6));
			parts.push(<P key="bun" g={sphere(0.34, 20, 14)} m={m} p={[0, 0.88, -0.3]} />);
			parts.push(<P key="bunband" g={torus(0.2, 0.05, 8, 20)} m={plastic('#d94a8c')} p={[0, 0.66, -0.26]} r={[Math.PI / 2 - 0.5, 0, 0]} cast={false} />);
			parts.push(<P key="swoop" g={rbox(0.95, 0.22, 0.26, 0.1)} m={m} p={[-0.14, 0.52, 0.56]} r={[-0.2, 0, 0.14]} />);
			break;
		}
		case 'short': {
			parts.push(cap(0.46, 0.53), back(0.85, 0.1), ...sides(0.5));
			[-0.35, 0, 0.35].forEach((x, i) =>
				parts.push(<P key={'sf' + i} g={rbox(0.42, 0.24, 0.24, 0.09)} m={m} p={[x, 0.5, 0.57]} r={[-0.3, 0, (k(i) - 0.5) * 0.3]} />),
			);
			break;
		}
		case 'buzz': {
			parts.push(<P key="buzz" g={rbox(1.37, 0.42, 1.36, 0.2)} m={m} p={[0, 0.5, -0.03]} />);
			parts.push(<P key="bb" g={rbox(1.36, 0.75, 0.2, 0.08)} m={m} p={[0, 0.2, -0.6]} />);
			break;
		}
		case 'long': {
			parts.push(cap(0.5, 0.52));
			parts.push(<P key="lback" g={rbox(1.45, 1.75, 0.34, 0.15)} m={m} p={[0, -0.3, -0.55]} />);
			[-1, 1].forEach((sd) => parts.push(<P key={'lside' + sd} g={rbox(0.22, 1.35, 0.85, 0.1)} m={m} p={[sd * 0.7, -0.1, -0.08]} />));
			parts.push(<P key="lfr" g={rbox(1.2, 0.24, 0.26, 0.1)} m={m} p={[0.08, 0.5, 0.56]} r={[-0.25, 0, -0.1]} />);
			break;
		}
		case 'ponytail': {
			parts.push(cap(0.46, 0.53), back(0.85, 0.12), ...sides(0.5));
			parts.push(<P key="pt" g={cyl(0.2, 0.12, 1.1, 12)} m={m} p={[0, 0.05, -0.92]} r={[0.5, 0, 0]} />);
			parts.push(<P key="ptb" g={torus(0.17, 0.05, 8, 16)} m={plastic('#ff4f8b')} p={[0, 0.42, -0.75]} r={[Math.PI / 2 + 0.5, 0, 0]} cast={false} />);
			parts.push(<P key="pfr" g={rbox(1.1, 0.22, 0.24, 0.1)} m={m} p={[0, 0.5, 0.56]} r={[-0.25, 0, 0]} />);
			break;
		}
		case 'pigtails': {
			parts.push(cap(0.46, 0.53), back(0.85, 0.12), ...sides(0.5));
			[-1, 1].forEach((sd) => {
				parts.push(<P key={'pg' + sd} g={sphere(0.3, 16, 12)} m={m} p={[sd * 0.86, 0.05, -0.2]} />);
				parts.push(<P key={'pgt' + sd} g={sphere(0.1, 10, 8)} m={plastic('#ffd23a')} p={[sd * 0.66, 0.15, -0.2]} cast={false} />);
			});
			parts.push(<P key="pgf" g={rbox(1.1, 0.22, 0.24, 0.1)} m={m} p={[0, 0.5, 0.56]} r={[-0.25, 0, 0]} />);
			break;
		}
		case 'afro': {
			parts.push(<P key="afro" g={sphere(0.95, 24, 18)} m={m} p={[0, 0.42, -0.22]} s={[1.08, 0.9, 0.86]} />);
			break;
		}
		case 'curly': {
			parts.push(cap(0.46, 0.52));
			for (let i = 0; i < 9; i++) {
				const a = (i / 9) * Math.PI * 2;
				parts.push(<P key={'c' + i} g={sphere(0.27, 12, 10)} m={m} p={[Math.sin(a) * 0.62, 0.62 + k(i) * 0.12, Math.cos(a) * 0.55 - 0.08]} />);
			}
			break;
		}
		case 'spiky': {
			parts.push(<P key="scap" g={rbox(1.38, 0.32, 1.36, 0.14)} m={m} p={[0, 0.56, -0.02]} />, back(0.8, 0.12));
			for (let i = 0; i < 6; i++) {
				const x = (i % 3 - 1) * 0.42;
				const z = i < 3 ? 0.25 : -0.3;
				parts.push(<P key={'sp' + i} g={cone(0.24, 0.6, 4)} m={m} p={[x, 0.95, z]} r={[(k(i) - 0.5) * 0.5, 0.78, (k(i + 5) - 0.5) * 0.6]} />);
			}
			break;
		}
		case 'none':
			break;
	}
	return <>{parts}</>;
}

// ---------------------------------------------------------------- the character
export const Character: React.FC<CharacterProps> = (props) => {
	const frame = useCurrentFrame() + (props.frameOffset ?? 0);
	const {spec} = props;
	const lod = props.lod ?? 'high';
	const pose = props.pose ?? REST;
	const D = dims(spec);
	const st = faceStyleOf(spec);
	const shadow = props.shadow ?? true;

	// ---- face
	let parts: FaceParts = {...EXPRESSIONS[props.expr ?? 'neutral'], ...(props.face ?? {})};
	if (props.look) parts = {...parts, lookX: props.look[0], lookY: props.look[1]};
	parts = {...parts, mouth: talkMouth(parts.mouth, props.talk ?? 0)};
	if (props.blink !== false && OPEN_EYES.includes(parts.eyes) && isBlinking(frame, spec.seed)) parts = {...parts, eyes: 'blink'};
	if (parts.lookX !== undefined) parts.lookX = Math.round(parts.lookX * 2) / 2;
	if (parts.lookY !== undefined) parts.lookY = Math.round(parts.lookY * 2) / 2;
	const faceMat = faceMaterial(st, parts, Math.floor(frame / 2) % 8);

	const skin = plastic(spec.skin, {rough: 0.45});
	const topM = plastic(spec.top, {rough: 0.5});
	const top2M = plastic(spec.top2 ?? '#ffffff', {rough: 0.5});
	const pantsM = plastic(spec.pants, {rough: 0.55});
	const shoeM = plastic(spec.shoes, {rough: 0.42});
	const headMats = [skin, skin, skin, skin, faceMat, skin];

	const hy = D.headH / 2 + 0.03; // head centre above neck
	const hs = D.hs;

	// ---- head (with hair, hats, glasses, mustache)
	const [ex, ey] = facePoint(...featureXY(st, 256 + st.eyeGap, 236 + st.eyeY));
	const [, my] = facePoint(...featureXY(st, 256, (236 + st.eyeY + 322 + st.mouthY) / 2 + 8));
	const talkBob = (props.talk ?? 0) > 0.15 ? Math.sin(frame * 1.7) * 0.015 : 0;
	const hat = props.nightcap ? 'nightcap' : spec.hat ?? 'none';
	const head = (
		<group position={[0, hy, 0]}>
			<P g={rbox(D.headW, D.headH, D.headD, D.headR, 4)} m={headMats} />
			<group scale={hs}>
				<Hair kind={hat === 'cap' && spec.hair !== 'none' ? 'buzz' : spec.hair} color={spec.hairColor} seed={spec.seed} lod={lod} />
				{hat === 'cap' ? (
					<group>
						<P g={rbox(1.44, 0.4, 1.42, 0.2)} m={plastic(spec.hatColor ?? '#2f63d6', {rough: 0.5})} p={[0, 0.6, -0.02]} />
						<P g={sphere(0.74, 24, 12)} m={plastic(spec.hatColor ?? '#2f63d6', {rough: 0.5})} p={[0, 0.74, -0.03]} s={[0.98, 0.42, 0.97]} />
						<P g={rbox(1.18, 0.08, 0.78, 0.04)} m={plastic(darken(spec.hatColor ?? '#2f63d6', 0.12), {rough: 0.5})} p={[0, 0.44, 0.92]} r={[0.2, 0, 0]} />
						<P g={cyl(0.085, 0.085, 0.07, 12)} m={plastic(darken(spec.hatColor ?? '#2f63d6', 0.3))} p={[0, 1.05, -0.03]} cast={false} />
						<mesh geometry={circle(0.2, 24)} material={capLogoMat()} position={[0, 0.66, 0.725]} />
					</group>
				) : null}
				{hat === 'nightcap' ? (
					<group position={[0, 0.62, -0.05]} rotation={[-0.35, 0, -0.5]}>
						<P g={cone(0.72, 1.6, 20)} m={plastic(spec.hatColor ?? '#6fa8ff', {rough: 0.6})} p={[0, 0.7, 0]} />
						<P g={torus(0.68, 0.12, 8, 24)} m={plastic('#ffffff', {rough: 0.8})} p={[0, -0.05, 0]} r={[Math.PI / 2, 0, 0]} />
						<P g={sphere(0.18, 12, 10)} m={plastic('#ffffff', {rough: 0.8})} p={[0, 1.5, 0]} />
					</group>
				) : null}
				{hat === 'beanie' ? <P g={rbox(1.46, 0.6, 1.44, 0.28)} m={plastic(spec.hatColor ?? '#e04a4a', {rough: 0.7})} p={[0, 0.6, -0.02]} /> : null}
				{props.crown ? (
					<group position={[0, 0.66, -0.02]} rotation={[-0.08, 0, 0.08]}>
						<Crown scale={0.92} />
					</group>
				) : null}
				{spec.glasses ? <Glasses kind={spec.glasses} color={spec.glassesColor ?? '#3a2a1a'} ex={ex} ey={ey} /> : null}
				{spec.mustache ? (
					<group position={[0, my + talkBob, 0.62]}>
						{[-1, 1].map((sd) => (
							<group key={sd}>
								<P g={rbox(0.42, 0.2, 0.16, 0.08)} m={plastic(spec.mustache!, {rough: 0.7})} p={[sd * 0.17, -0.02, 0.04]} r={[0, sd * 0.18, -sd * 0.28]} />
								<P g={sphere(0.085, 10, 8)} m={plastic(spec.mustache!, {rough: 0.7})} p={[sd * 0.37, -0.1, 0.0]} />
							</group>
						))}
						<P g={rbox(0.24, 0.17, 0.17, 0.07)} m={plastic(spec.mustache, {rough: 0.7})} p={[0, 0.02, 0.06]} />
					</group>
				) : null}
				{props.headExtra}
			</group>
		</group>
	);

	if (props.headOnly) {
		return (
			<group position={props.position} rotation={[0, props.rotation ?? 0, 0]} scale={spec.scale}>
				<group rotation={pose.head}>{head}</group>
			</group>
		);
	}

	// ---- limbs
	const sleeveFrac = spec.sleeve === 'short' ? 0.34 : spec.sleeve === 'none' ? 0 : 0.8;
	const arm = (side: 1 | -1, rot: V3, hold: React.ReactNode, upright: boolean | undefined) => {
		const x = side * (D.torsoW / 2 + D.armW / 2 + 0.01);
		const y = D.torsoH - D.armW / 2;
		const top = D.armW / 2;
		const len = D.armH;
		const sl = len * sleeveFrac;
		const skinLen = len - sl + 0.04;
		const sleeveColor = spec.outfit === 'overalls' ? spec.top2 ?? '#ffffff' : spec.top;
		const sleeveM = spec.outfit === 'pajamas' ? pajamaMat(spec.top, spec.top2 ?? '#ffffff') : plastic(sleeveColor, {rough: 0.5});
		return (
			<group position={[x, y, 0]} rotation={rot}>
				{sl > 0 ? <P g={rbox(D.armW + 0.04, sl, D.armD + 0.04, 0.1)} m={sleeveM} p={[0, top - sl / 2, 0]} /> : null}
				{spec.outfit === 'hoodie' && lod === 'high' ? (
					<P g={rbox(D.armW + 0.08, 0.15, D.armD + 0.08, 0.06)} m={plastic(darken(spec.top, 0.12), {rough: 0.55})} p={[0, top - sl + 0.07, 0]} cast={false} />
				) : null}
				<P g={rbox(D.armW, skinLen, D.armD, 0.1)} m={skin} p={[0, top - len + skinLen / 2, 0]} />
				{hold ? (
					<group position={[0, top - len + 0.12, 0]} rotation={upright ? uprightRotation(pose, rot) : [0, 0, 0]}>
						{hold}
					</group>
				) : null}
			</group>
		);
	};

	const leg = (side: 1 | -1, rot: V3) => {
		const shoeH = spec.boots ? 0.62 : 0.4;
		const pantsLen = spec.shorts ? 0.85 : D.legH - shoeH + 0.06;
		const pantsM2 = spec.outfit === 'pajamas' ? pajamaMat(spec.top, spec.top2 ?? '#ffffff') : pantsM;
		return (
			<group position={[side * (D.legW / 2 + 0.005), 0, 0]} rotation={rot}>
				<P g={rbox(D.legW, pantsLen, D.legD, 0.1)} m={pantsM2} p={[0, -pantsLen / 2, 0]} />
				{spec.shorts ? <P g={rbox(D.legW - 0.04, D.legH - pantsLen - shoeH + 0.1, D.legD - 0.04, 0.1)} m={skin} p={[0, -pantsLen - (D.legH - pantsLen - shoeH) / 2 + 0.03, 0]} /> : null}
				<P g={rbox(D.legW + 0.06, shoeH, D.legD + 0.2, 0.12)} m={shoeM} p={[0, -D.legH + shoeH / 2, 0.09]} />
				{lod === 'high' && spec.shoes.toLowerCase() === '#f7f7f7' ? (
					<P g={rbox(D.legW + 0.09, 0.09, D.legD + 0.23, 0.04)} m={plastic('#c9ced6', {rough: 0.6})} p={[0, -D.legH + 0.045, 0.09]} cast={false} />
				) : null}
			</group>
		);
	};

	// ---- torso + outfit details (torso space: y=0 at hips)
	const T = D.torsoH;
	const fz = D.torsoD / 2;
	const torsoMat = spec.outfit === 'overalls' ? top2M : spec.outfit === 'pajamas' ? pajamaMat(spec.top, spec.top2 ?? '#ffffff') : topM;
	const outfit: React.ReactNode[] = [];
	switch (spec.outfit) {
		case 'hoodie': {
			const dk = plastic(darken(spec.top, 0.12), {rough: 0.55});
			outfit.push(<P key="hood" g={rbox(D.torsoW * 0.66, 0.5, 0.62, 0.2)} m={topM} p={[0, T + 0.04, -fz + 0.1]} r={[-0.25, 0, 0]} />);
			outfit.push(<P key="neck" g={rbox(D.torsoW * 0.5, 0.12, D.torsoD * 0.8, 0.05)} m={dk} p={[0, T + 0.02, 0.03]} cast={false} />);
			outfit.push(<P key="band" g={rbox(D.torsoW + 0.04, 0.2, D.torsoD + 0.04, 0.07)} m={dk} p={[0, 0.1, 0]} cast={false} />);
			if (lod === 'high') {
				outfit.push(<P key="pocket" g={rbox(D.torsoW * 0.62, 0.55, 0.08, 0.06)} m={dk} p={[0, 0.58, fz + 0.01]} cast={false} />);
				[-1, 1].forEach((sd) => {
					outfit.push(<P key={'str' + sd} g={cyl(0.035, 0.035, 0.62, 8)} m={plastic('#ffffff', {rough: 0.5})} p={[sd * 0.2, T - 0.36, fz + 0.04]} cast={false} />);
					outfit.push(<P key={'agl' + sd} g={cyl(0.045, 0.045, 0.09, 8)} m={plastic('#d8dde4', {rough: 0.4})} p={[sd * 0.2, T - 0.7, fz + 0.04]} cast={false} />);
				});
			}
			break;
		}
		case 'cardigan': {
			const dk = plastic(darken(spec.top, 0.15), {rough: 0.6});
			outfit.push(<P key="shirt" g={rbox(0.52, T - 0.04, 0.05, 0.02)} m={top2M} p={[0, T / 2, fz + 0.0]} cast={false} />);
			[-1, 1].forEach((sd) => {
				outfit.push(<P key={'edge' + sd} g={rbox(0.1, T, 0.07, 0.03)} m={dk} p={[sd * 0.3, T / 2, fz + 0.01]} cast={false} />);
				outfit.push(<P key={'collar' + sd} g={rbox(0.32, 0.2, 0.06, 0.04)} m={top2M} p={[sd * 0.17, T - 0.12, fz + 0.03]} r={[0, 0, sd * 0.65]} cast={false} />);
				if (lod === 'high') outfit.push(<P key={'pk' + sd} g={rbox(0.46, 0.42, 0.06, 0.04)} m={dk} p={[sd * 0.66, 0.5, fz + 0.01]} cast={false} />);
			});
			[1.45, 1.0, 0.55].forEach((y, i) =>
				outfit.push(<P key={'btn' + i} g={cyl(0.075, 0.075, 0.05, 12)} m={plastic('#4a2a14', {rough: 0.3})} p={[0.3, y, fz + 0.055]} r={[Math.PI / 2, 0, 0]} cast={false} />),
			);
			break;
		}
		case 'overalls': {
			const o = plastic(spec.top, {rough: 0.5});
			const od = plastic(darken(spec.top, 0.15), {rough: 0.55});
			outfit.push(<P key="waist" g={rbox(D.torsoW + 0.05, 0.78, D.torsoD + 0.05, 0.1)} m={o} p={[0, 0.39, 0]} />);
			outfit.push(<P key="bib" g={rbox(D.torsoW * 0.6, 0.9, 0.08, 0.06)} m={o} p={[0, 1.18, fz + 0.02]} />);
			outfit.push(<P key="bibp" g={rbox(D.torsoW * 0.32, 0.36, 0.05, 0.05)} m={od} p={[0, 1.18, fz + 0.07]} cast={false} />);
			[-1, 1].forEach((sd) => {
				const sx = sd * D.torsoW * 0.22;
				outfit.push(<P key={'sf' + sd} g={rbox(0.2, 0.42, 0.06, 0.03)} m={o} p={[sx, T - 0.2, fz + 0.02]} cast={false} />);
				outfit.push(<P key={'st' + sd} g={rbox(0.2, 0.06, D.torsoD + 0.08, 0.03)} m={o} p={[sx, T + 0.01, 0]} cast={false} />);
				outfit.push(<P key={'sb' + sd} g={rbox(0.2, 1.3, 0.06, 0.03)} m={o} p={[sx, T - 0.62, -fz - 0.02]} cast={false} />);
				outfit.push(<P key={'gb' + sd} g={cyl(0.08, 0.08, 0.05, 12)} m={goldMat(0.1)} p={[sx, T - 0.4, fz + 0.07]} r={[Math.PI / 2, 0, 0]} cast={false} />);
			});
			break;
		}
		case 'dress': {
			const dk = plastic(darken(spec.top, 0.2), {rough: 0.5});
			outfit.push(<P key="belt" g={rbox(D.torsoW + 0.04, 0.16, D.torsoD + 0.04, 0.05)} m={dk} p={[0, 0.5, 0]} cast={false} />);
			[-1, 1].forEach((sd) =>
				outfit.push(<P key={'col' + sd} g={rbox(0.36, 0.2, 0.06, 0.05)} m={top2M} p={[sd * 0.2, T - 0.1, fz + 0.03]} r={[0, 0, sd * 0.5]} cast={false} />),
			);
			if (lod === 'high') {
				for (let i = 0; i < 7; i++) {
					const a = ((i - 3) / 3) * 0.9;
					outfit.push(<P key={'pearl' + i} g={sphere(0.055, 10, 8)} m={plastic('#ffffff', {rough: 0.2})} p={[Math.sin(a) * 0.42, T - 0.35 - Math.cos(a) * 0.12, fz + 0.04]} cast={false} />);
				}
			}
			break;
		}
		case 'tshirt': {
			if (spec.emblem && lod === 'high') outfit.push(<P key="emb" g={cyl(0.32, 0.32, 0.04, 20)} m={plastic(spec.emblem, {rough: 0.5})} p={[0, T * 0.62, fz + 0.01]} r={[Math.PI / 2, 0, 0]} cast={false} />);
			outfit.push(<P key="tneck" g={rbox(D.torsoW * 0.42, 0.1, D.torsoD * 0.7, 0.04)} m={plastic(darken(spec.top, 0.15))} p={[0, T + 0.0, 0.02]} cast={false} />);
			break;
		}
		case 'shirt': {
			[-1, 1].forEach((sd) =>
				outfit.push(<P key={'scol' + sd} g={rbox(0.38, 0.2, 0.06, 0.05)} m={plastic(lighten(spec.top, 0.5))} p={[sd * 0.2, T - 0.1, fz + 0.03]} r={[0, 0, sd * 0.55]} cast={false} />),
			);
			if (lod === 'high') [1.5, 1.1, 0.7, 0.3].forEach((y, i) => outfit.push(<P key={'sb' + i} g={sphere(0.05, 8, 6)} m={plastic('#ffffff')} p={[0, y, fz + 0.03]} cast={false} />));
			break;
		}
		case 'pajamas':
			break;
	}

	// skirt (attached to hips so it does not swing with the legs)
	const skirt =
		spec.outfit === 'dress' ? (
			<group position={[0, -0.5, 0]} scale={[1, 1, (D.torsoD + 0.2) / (D.torsoW + 0.1)]}>
				<mesh
					geometry={cyl((D.torsoW / 2 + 0.04) / 0.7071, (D.torsoW / 2 + 0.36) / 0.7071, 1.2, 4, false)}
					material={topM}
					rotation={[0, Math.PI / 4, 0]}
					castShadow={shadow}
					receiveShadow
				/>
			</group>
		) : null;

	// cape (king)
	const cape = props.cape ? (
		<group>
			<group position={[0, T - 0.02, -fz - 0.06]} rotation={[0.12 + (props.capeSwing ?? 0), 0, 0]}>
				<P g={rbox(D.torsoW + 0.5, 3.3, 0.08, 0.04)} m={plastic(props.cape, {rough: 0.45})} p={[0, -1.6, -0.04]} />
				<P g={rbox(D.torsoW + 0.52, 0.12, 0.1, 0.03)} m={goldMat(0.2)} p={[0, -3.22, -0.04]} cast={false} />
			</group>
			{/* ermine collar */}
			<P g={rbox(D.torsoW + 0.55, 0.3, D.torsoD + 0.4, 0.14)} m={plastic('#fbfbf7', {rough: 0.85})} p={[0, T - 0.05, -0.05]} />
			{[-0.7, -0.25, 0.25, 0.7].map((x, i) => (
				<P key={'sp' + i} g={rbox(0.07, 0.12, 0.03, 0.02)} m={plastic('#111111')} p={[x * (D.torsoW / 2), T - 0.05, fz + 0.16]} cast={false} />
			))}
		</group>
	) : null;

	const backBucket = spec.backBucket ? (
		<group>
			{/* giant bucket strapped high on the back: its rim shows behind the head from the front */}
			<group position={[0, 0.75, -fz - 1.3]} rotation={[0.2, 0, 0]}>
				<Bucket scale={2.45} handle={-1.25} />
			</group>
			{[-1, 1].map((sd) => (
				<group key={sd}>
					<P g={rbox(0.17, 1.3, 0.05, 0.02)} m={plastic('#6b4226', {rough: 0.6})} p={[sd * D.torsoW * 0.36, T - 0.62, fz + 0.075]} cast={false} />
					<P g={rbox(0.17, 0.05, D.torsoD + 0.16, 0.02)} m={plastic('#6b4226', {rough: 0.6})} p={[sd * D.torsoW * 0.36, T + 0.03, 0]} cast={false} />
				</group>
			))}
			{/* belt across the bucket */}
			<P g={rbox(D.torsoW * 0.9, 0.16, 0.06, 0.02)} m={plastic('#6b4226', {rough: 0.6})} p={[0, T * 0.45, -fz - 0.03]} cast={false} />
		</group>
	) : null;

	return (
		<group position={props.position} rotation={[0, props.rotation ?? 0, 0]} scale={spec.scale}>
			<group position={[0, D.legH + pose.y, pose.fwd]}>
				{leg(1, pose.legL)}
				{leg(-1, pose.legR)}
				{skirt}
				<group rotation={[pose.lean, pose.turn, pose.tilt]}>
					<P g={rbox(D.torsoW, T, D.torsoD, 0.12)} m={torsoMat} p={[0, T / 2, 0]} />
					{outfit}
					{arm(1, pose.armL, props.holdL, props.holdLUpright)}
					{arm(-1, pose.armR, props.holdR, props.holdRUpright)}
					{backBucket}
					{cape}
					<group position={[0, T, 0]} rotation={pose.head}>
						{head}
					</group>
				</group>
			</group>
			{props.children}
		</group>
	);
};

// ---------------------------------------------------------------- glasses
const Glasses: React.FC<{kind: 'round' | 'square'; color: string; ex: number; ey: number}> = ({kind, color, ex, ey}) => {
	const fm = plastic(color, {rough: 0.3, metal: 0.2});
	const lens = plastic('#cfe9ff', {transparent: true, opacity: 0.22, rough: 0.05, metal: 0.1, envInt: 2, depthWrite: false});
	const z = 0.655;
	const r = 0.165;
	return (
		<group>
			{[-1, 1].map((sd) => (
				<group key={sd} position={[sd * ex, ey, z]}>
					{kind === 'round' ? (
						<>
							<P g={torus(r, 0.032, 8, 28)} m={fm} cast={false} />
							<mesh geometry={circle(r, 24)} material={lens} position={[0, 0, -0.005]} renderOrder={5} />
						</>
					) : (
						<>
							<P g={rbox(0.44, 0.06, 0.06, 0.02)} m={fm} p={[0, 0.15, 0]} cast={false} />
							<P g={rbox(0.44, 0.06, 0.06, 0.02)} m={fm} p={[0, -0.15, 0]} cast={false} />
							<P g={rbox(0.06, 0.34, 0.06, 0.02)} m={fm} p={[-0.2, 0, 0]} cast={false} />
							<P g={rbox(0.06, 0.34, 0.06, 0.02)} m={fm} p={[0.2, 0, 0]} cast={false} />
							<mesh geometry={rbox(0.38, 0.26, 0.01, 0.004, 1)} material={lens} position={[0, 0, -0.01]} renderOrder={5} />
						</>
					)}
					{/* hinge piece to the side of the head + temple */}
					<P g={rbox(0.66 - ex - (kind === 'round' ? r : 0.22), 0.04, 0.04, 0.015)} m={fm} p={[sd * ((0.66 - ex + (kind === 'round' ? r : 0.22)) / 2), 0.02, -0.01]} cast={false} />
					<P g={rbox(0.045, 0.045, 0.62, 0.015)} m={fm} p={[sd * (0.67 - ex), 0.02, -0.33]} cast={false} />
				</group>
			))}
			<P g={cyl(0.025, 0.025, Math.max(0.02, 2 * ex - (kind === 'round' ? 2 * r : 0.44)), 8)} m={fm} p={[0, ey + 0.03, z]} r={[0, 0, Math.PI / 2]} cast={false} />
		</group>
	);
};

// ---------------------------------------------------------------- pajama stripes
const pjCache = new Map<string, THREE.MeshStandardMaterial>();
function pajamaMat(a: string, b: string) {
	const key = a + b;
	let m = pjCache.get(key);
	if (!m) {
		const c = document.createElement('canvas');
		c.width = 64;
		c.height = 64;
		const ctx = c.getContext('2d')!;
		ctx.fillStyle = a;
		ctx.fillRect(0, 0, 64, 64);
		ctx.fillStyle = b;
		for (let x = 0; x < 64; x += 16) ctx.fillRect(x, 0, 6, 64);
		const t = new THREE.CanvasTexture(c);
		t.colorSpace = THREE.SRGBColorSpace;
		t.wrapS = t.wrapT = THREE.RepeatWrapping;
		t.repeat.set(2, 1);
		m = new THREE.MeshStandardMaterial({map: t, roughness: 0.6});
		pjCache.set(key, m);
	}
	return m;
}

// ---------------------------------------------------------------- Bucket Man cap logo
let capLogo: THREE.MeshStandardMaterial | null = null;
function capLogoMat() {
	if (!capLogo) {
		const c = document.createElement('canvas');
		c.width = 128;
		c.height = 128;
		const ctx = c.getContext('2d')!;
		ctx.fillStyle = '#ffffff';
		ctx.beginPath();
		ctx.arc(64, 64, 62, 0, Math.PI * 2);
		ctx.fill();
		// little bucket icon
		ctx.fillStyle = '#8f9aa6';
		ctx.beginPath();
		ctx.moveTo(34, 50);
		ctx.lineTo(94, 50);
		ctx.lineTo(86, 100);
		ctx.lineTo(42, 100);
		ctx.closePath();
		ctx.fill();
		ctx.strokeStyle = '#5d6772';
		ctx.lineWidth = 6;
		ctx.beginPath();
		ctx.arc(64, 52, 26, Math.PI, 0);
		ctx.stroke();
		const t = new THREE.CanvasTexture(c);
		t.colorSpace = THREE.SRGBColorSpace;
		capLogo = new THREE.MeshStandardMaterial({map: t, transparent: true, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2});
	}
	return capLogo;
}
