// S8 · Centuries later, on a mountain: Jesus shines in white (a simple shining figure: no halo, no face
// detail); Moses and Elijah appear and talk with Him. Peter, James and John watch as silhouettes.
import {useMemo} from 'react';
import * as THREE from 'three';
import {CharacterRoot, PoseSprite, STANDING_PX} from '../characters/Character';
import {elijahWalk} from '../characters/motion';
import {Rig} from '../characters/Rig';
import {RIGS, rigInfo} from '../characters/rig';
import {easeInOut, keys, pulse, seg} from '../lib/ease';
import {softDot} from '../lib/textures';
import {B, SCENE} from '../lib/timeline';
import {orbit} from '../render/camera';
import type {CamState, ShotDef} from '../render/types';
import {Dust, LightBeam} from '../world/atmosphere';
import {GLORY} from '../world/mood';
import {mountainHeight, MountainWorld} from '../world/MountainWorld';
import {camAngles} from './Jordan';

const START = SCENE.S8.start - 0.6;
const END = SCENE.S9.start + 0.6;
const J: [number, number] = [0, -0.5];
const MO: [number, number] = [-1.3, -0.25];
const EL: [number, number] = [1.3, -0.25];
const h = (p: [number, number]) => mountainHeight(p[0], p[1]);

const appear = (t: number) => seg(t, B.figuresAppear, B.figuresAppear + 0.7, easeInOut);
const shine = (t: number) => pulse(t, B.jesusShine, 0.25, 1.4);

const camera8 = (t: number): CamState => {
	const rise = seg(t, START, B.centuries + 1.0, easeInOut);
	return orbit(
		[0, 1.75 + 0.3 * rise, -0.4],
		keys(t, [[START, 17.5], [B.centuries + 1, 16], [B.figuresAppear, 15.2], [B.jesusShine, 13.4], [END, 12.8]]),
		-2 + 9 * rise,
		keys(t, [[START, -3], [END, 2]]),
		keys(t, [[START, 30], [END, 29]]),
		{drift: 0.7},
	);
};

const Aura: React.FC<{position: [number, number, number]; size: [number, number]; opacity: number; order: number}> = ({position, size, opacity, order}) => {
	const mat = useMemo(() => new THREE.MeshBasicMaterial({map: softDot(), color: '#fff3d6', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false}), []);
	mat.opacity = opacity;
	return (
		<mesh position={position} scale={[size[0], size[1], 1]} material={mat} renderOrder={order}>
			<planeGeometry args={[1, 1]} />
		</mesh>
	);
};

const Content: React.FC<{t: number; lite: boolean}> = ({t, lite}) => {
	const c = camera8(t);
	const a = camAngles(c);
	const mood = GLORY;
	const ap = appear(t);
	const sh = shine(t);
	const talk = seg(t, B.figuresAppear + 0.8, B.figuresAppear + 1.2);
	const poseE = elijahWalk(0, {amount: 0, t, talk: talk * 0.9});
	const jPx = STANDING_PX['jesus/front'] / 1.78;
	const mPx = STANDING_PX['moses/side'] / 1.75;
	const dPx = STANDING_PX.disciples / 1.72;
	const sil = {sil: 1, silColor: '#3a2c24', rim: 1.4, rimColor: '#fff2cc', rimDir: [0, 1] as [number, number], tint: '#ffffff'};
	return (
		<>
			<MountainWorld t={t} mood={mood} lite={lite} />
			<LightBeam position={[J[0], h(J) - 0.3, J[1]]} height={60} rTop={5} rBottom={1.0} intensity={0.05 + 0.07 * sh} core={0.4} t={t} color="#fff1cf" />
			<Aura position={[J[0], h(J) + 0.95, J[1] - 0.2]} size={[1.9 + 0.6 * sh, 3.0 + 0.6 * sh]} opacity={0.26 + 0.14 * sh} order={95} />
			<CharacterRoot position={[J[0], h(J), J[1]]} pxPerM={jPx} yaw={a.yaw} lean={a.pitch} shadow={{w: 0.9, d: 0.34, opacity: 0.18}} shadowOrder={8}>
				<PoseSprite sprite="jesus/front" renderOrder={100} look={{tint: '#ffffff', light: 0.06, glow: 0.1, lightColor: '#fff6e2'}} warp={{breath: 0.005 * Math.sin(t * 1.8)}} />
			</CharacterRoot>
			{ap > 0 && (
				<>
					<CharacterRoot position={[MO[0], h(MO), MO[1]]} pxPerM={mPx} yaw={a.yaw} lean={a.pitch} shadow={{w: 0.85, d: 0.32, opacity: 0.2 * ap}} shadowOrder={8}>
						<PoseSprite sprite="moses/side" renderOrder={110} look={{tint: mood.tint, opacity: ap, light: 0.9 * (1 - ap) + 0.06, lightColor: '#fff4dc', glow: 0.4 * (1 - ap)}} warp={{breath: 0.006 * Math.sin(t * 1.6 + 1), lean: 4 * Math.sin(t * 0.9) * talk}} />
					</CharacterRoot>
					<CharacterRoot position={[EL[0], h(EL), EL[1]]} pxPerM={rigInfo('elijah').heightPx / RIGS.elijah.heightM} facing={-1} yaw={a.yaw} lean={a.pitch} shadow={{w: 0.95, d: 0.34, opacity: 0.2 * ap}} shadowOrder={8}>
						<Rig blinkTime={t} name="elijah" pose={poseE} renderOrder={120} look={{tint: mood.tint, opacity: ap, light: 0.9 * (1 - ap) + 0.06, lightColor: '#fff4dc', glow: 0.4 * (1 - ap)}} />
					</CharacterRoot>
				</>
			)}
			{/* Peter, James and John on the lower ground, dark against the light, kept to the sides */}
			<CharacterRoot position={[-1.75, mountainHeight(-1.75, 2.6), 2.6]} pxPerM={dPx} yaw={a.yaw} lean={a.pitch} shadow={null}>
				<PoseSprite sprite="disciples/peter" renderOrder={400} look={sil} warp={{breath: 0.006 * Math.sin(t * 2)}} />
			</CharacterRoot>
			<CharacterRoot position={[-0.95, mountainHeight(-0.95, 3.1), 3.1]} pxPerM={dPx} yaw={a.yaw} lean={a.pitch} shadow={null}>
				<PoseSprite sprite="disciples/james" renderOrder={401} look={sil} />
			</CharacterRoot>
			<CharacterRoot position={[1.65, mountainHeight(1.65, 2.9), 2.9]} pxPerM={dPx} facing={-1} yaw={a.yaw} lean={a.pitch} shadow={null}>
				<PoseSprite sprite="disciples/john" renderOrder={402} look={sil} />
			</CharacterRoot>
			<Dust count={lite ? 50 : 140} center={[0, 2.5, -0.5]} size={[7, 5, 3]} t={t} rise={0.05} px={6} opacity={0.7 + 0.6 * sh} seed={31} color="#fff1c8" />
		</>
	);
};

export const S8: ShotDef = {
	id: 'S8',
	start: START,
	end: END,
	Content,
	camera: camera8,
	fog: () => ({color: GLORY.fog, near: GLORY.fogNear, far: GLORY.fogFar}),
	grade: (t) => ({
		exposure: 1.0 + 0.03 * shine(t),
		saturation: 1.0,
		contrast: 1.05,
		gain: [1.02, 1.0, 0.97],
		bloom: 0.42 + 0.12 * shine(t),
		bloomThreshold: 0.95,
		vignette: 0.32,
		flash: pulse(t, B.jesusShine, 0.2, 0.8) * 0.05,
	}),
	anchors: () => ({summit: [J[0], h(J) + 2.0, J[1]], elijah8: [EL[0] - 0.05, h(EL) + 1.95, EL[1]]}),
};
