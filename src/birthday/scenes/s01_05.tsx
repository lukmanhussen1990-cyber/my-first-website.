// Scenes 1-5: the quiet town, years going by, lonely Grandpa, the attic, the old photo.
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {Stage, LOOKS, Look} from '../../lib/Stage';
import {CameraRig} from '../../lib/CameraRig';
import {Character} from '../../characters/Character';
import * as P from '../../characters/poses';
import {ME, GP, townsperson} from '../cast';
import {QuietStreet, SunsetSky} from '../world/Town';
import {Porch, CHAIR_AT, PORCH_Y, Attic, Kitchen, KITCHEN} from '../world/Rooms';
import {WallCalendar, PhotoCard, oldPhotoMaterial, CardBox, OldTrunk} from '../props/Things';
import {PhotoPortal, makePhotoRT, PHOTO_CAM} from '../world/Photo';
import {Dust, GlowPoints} from '../../props/Effects';
import {WalkingStick} from '../../props/HandProps';
import {plastic, rbox, plane, basicMat} from '../../lib/materials';
import {SceneDef, SceneProps} from '../kit';
import {W, shotIndex, amp} from '../timing';
import {V3, clamp, lerp, lerp3, easeInOut, easeOut, keys} from '../../lib/anim';
import {hash} from '../../lib/random';
import {QUALITY} from '../../lib/quality';
import {Spot} from '../Spot';

// ------------------------------------------------------------------ looks
export const SUNSET: Look = {...LOOKS.sunset, sunDir: [-0.42, 0.2, -0.88], sun: 2.8, hemi: 1.05, ambient: 0.22, fogNear: 40, fogFar: 190, skyMid: '#f39a62', skyBottom: '#ffd88a'};
export const SUNSET_FRONT: Look = {...SUNSET, sunDir: [-0.55, 0.24, 0.8], sun: 2.6};
export const KITCHEN_EVE: Look = {...LOOKS.interiorDay, hemiSky: '#ffe9cf', hemiGround: '#b98a5a', hemi: 0.9, ambient: 0.28, sunColor: '#ffbf7a', sun: 1.6, sunDir: [0.2, 0.55, 0.9]};
export const ATTIC_LOOK: Look = {...LOOKS.interiorDay, hemiSky: '#8a7a6a', hemiGround: '#3a2a1e', hemi: 0.45, ambient: 0.12, sunColor: '#ffcf8a', sun: 1.0, sunDir: [0.0, 0.8, -0.6], env: 0.3};

/** linear camera move helper: k 0..1 */
const cam = (a: {pos: V3; target: V3; fov: number}, b: {pos: V3; target: V3; fov: number}, k: number) => ({pos: lerp3(a.pos, b.pos, k), target: lerp3(a.target, b.target, k), fov: lerp(a.fov, b.fov, k)});

/** someone walking along z at a steady pace */
const Walker: React.FC<{seed: number; x: number; z0: number; dir: 1 | -1; t: number; speed?: number; kid?: boolean; elder?: boolean; low?: boolean; expr?: any}> = ({seed, x, z0, dir, t, speed = 1.9, kid, elder, low, expr = 'blank'}) => {
	const spec = townsperson(seed, {kid, elder});
	const pose = elder ? P.elderWalk(t + seed) : P.walk(t + seed * 0.37, kid ? 0.85 : 0.68, 0.75);
	return <Character spec={spec} position={[x, 0.3, z0 + dir * speed * t]} rotation={dir > 0 ? 0 : Math.PI} pose={pose} expr={expr} lod={low ? 'low' : 'high'} holdR={elder ? <group rotation={[0, 0, 0]}><WalkingStick length={2.0} /></group> : undefined} holdRUpright={elder} />;
};

// ===================================================================== S1  0.0 - 3.4
// "Nobody in my town knows what a birthday is." – slow crane from above the roofs down to the quiet street
const S1: React.FC<SceneProps> = ({f, dur}) => {
	const t = f / 30;
	const k = easeInOut(clamp(f / dur));
	const c = cam({pos: [6, 34, 62], target: [0, 4, -40], fov: 40}, {pos: [3.0, 5.6, 28], target: [-0.5, 4.4, -24], fov: 44}, k);
	return (
		<Stage look={SUNSET} focus={[0, 0, 10]} shadowSize={34}>
			<SunsetSky sunDir={SUNSET.sunDir} />
			<QuietStreet time="sunset" />
			<Walker seed={3} x={7.2} z0={4} dir={-1} t={t} low />
			<Walker seed={8} x={-7.2} z0={-6} dir={1} t={t} speed={1.5} elder low />
			<Walker seed={12} x={7.0} z0={-22} dir={1} t={t} low />
			<CameraRig {...c} sway={0.5} />
		</Stage>
	);
};

// ===================================================================== S2
// "People just get older. One year, then another, and nobody says anything."
const Bench: React.FC = () => {
	const m = plastic('#8a6a4a', {rough: 0.7});
	const iron = plastic('#3a3a40', {rough: 0.5, metal: 0.4});
	return (
		<group>
			<mesh geometry={rbox(5.6, 0.2, 1.6, 0.05)} material={m} position={[0, 1.42, 0]} castShadow receiveShadow />
			<mesh geometry={rbox(5.6, 1.1, 0.16, 0.05)} material={m} position={[0, 2.3, -0.72]} rotation={[-0.12, 0, 0]} castShadow />
			{[-2.4, 2.4].map((x) => (
				<group key={x}>
					<mesh geometry={rbox(0.16, 1.4, 1.4, 0.04)} material={iron} position={[x, 0.7, 0]} castShadow />
				</group>
			))}
		</group>
	);
};

const S2: React.FC<SceneProps> = ({f, g}) => {
	const cB = W(2, 13) - 2; // "One year"
	const cC = W(2, 17) - 3; // "and nobody says anything"
	const shot = shotIndex(f, [cB, cC]);
	const t = f / 30;
	if (shot === 0) {
		// people pass by on the sidewalk without a smile
		const k = easeInOut(clamp(f / cB));
		return (
			<Stage look={SUNSET} focus={[6, 0, -4]} shadowSize={16}>
				<SunsetSky sunDir={SUNSET.sunDir} />
				<QuietStreet time="sunset" zFrom={40} zTo={-100} />
				<Walker seed={21} x={6.6} z0={-9} dir={1} t={t} speed={1.7} />
				<Walker seed={22} x={7.8} z0={-1} dir={-1} t={t} speed={1.4} elder />
				<Walker seed={23} x={6.8} z0={-19} dir={1} t={t} speed={1.9} />
				<Walker seed={24} x={7.4} z0={-17.5} dir={1} t={t} speed={1.9} kid />
				<Walker seed={25} x={-7.0} z0={-2} dir={1} t={t} speed={1.6} low />
				<CameraRig pos={[lerp(1.8, 2.3, k), 4.1, lerp(19.5, 18.0, k)]} target={[lerp(7.0, 7.2, k), 3.1, lerp(-5, -3.5, k)]} fov={34} sway={0.6} />
			</Stage>
		);
	}
	if (shot === 1) {
		// the wall calendar: months and years flip by
		const fs = f - cB;
		const len = cC - cB;
		const page = clamp(fs / len) * 6.2;
		const k = easeInOut(clamp(fs / len));
		const calPos: V3 = [KITCHEN.left + 0.12, 6.9, -1.2];
		return (
			<Stage look={KITCHEN_EVE} sky={false} fog={false} focus={[-6, 3, -1]} shadowSize={12}>
				<Kitchen />
				<group position={calPos} rotation={[0, Math.PI / 2, 0]}>
					<WallCalendar page={page} year={2019} />
				</group>
				<CameraRig pos={[lerp(-3.4, -3.9, k), 5.7, lerp(-0.4, -0.7, k)]} target={[calPos[0], 5.45, -1.2]} fov={40} sway={0.35} />
			</Stage>
		);
	}
	// two neighbours pass each other on the sidewalk without a word
	const fs = f - cC;
	const k = easeInOut(clamp(fs / 60));
	const ts = fs / 30;
	return (
		<Stage look={SUNSET} focus={[6, 0, -14]} shadowSize={16}>
			<SunsetSky sunDir={SUNSET.sunDir} />
			<QuietStreet time="sunset" zFrom={40} zTo={-100} />
			<Walker seed={33} x={6.5} z0={-17.4} dir={1} t={ts} speed={1.5} />
			<Walker seed={34} x={7.9} z0={-11.4} dir={-1} t={ts} speed={1.5} elder />
			<Walker seed={35} x={-7.0} z0={-30} dir={1} t={ts} speed={1.6} low />
			<CameraRig pos={[lerp(1.2, 1.8, k), lerp(4.4, 4.2, k), lerp(-1.0, -2.2, k)]} target={[7.1, 3.2, -14.4]} fov={34} sway={0.45} />
		</Stage>
	);
};

// ===================================================================== S3
// "My grandpa is 90 years old, and he has never had a cake. Not once."
const GP_LOCAL_Z = -0.35;
const SittingGrandpa: React.FC<{t: number; expr: any; look?: [number, number]; rock: number}> = ({t, expr, look, rock}) => (
	<>
		<Character spec={GP} position={[0, 0, GP_LOCAL_Z]} pose={P.withPose(P.sitRock(t, 0, rock), {head: [0.04 + Math.sin(t * 0.7) * 0.02, 0, 0]})} expr={expr} look={look} />
		<group position={[2.6, 0, 0.9]} rotation={[0.1, 0, -0.22]}>
			<group position={[0, 2.05, 0]}>
				<WalkingStick length={2.1} />
			</group>
		</group>
	</>
);
/** Grandpa's head on the porch (world) */
const GP_HEAD: V3 = [CHAIR_AT[0] + Math.sin(-0.32) * GP_LOCAL_Z + 0.02, 5.2, CHAIR_AT[2] + Math.cos(-0.32) * GP_LOCAL_Z];

const S3: React.FC<SceneProps> = ({f}) => {
	const cB = W(3, 27) - 2; // "and he has never had a cake"
	const cNot = W(3, 34); // "Not once"
	const shot = shotIndex(f, [cB]);
	const t = f / 30;
	const rock = Math.sin(t * 1.25) * 0.05;
	if (shot === 0) {
		const k = easeInOut(clamp(f / cB));
		return (
			<Stage look={SUNSET_FRONT} focus={[2, 0, 3]} shadowSize={14}>
				<SunsetSky sunDir={SUNSET_FRONT.sunDir} />
				<Porch rock={rock} sitter={<SittingGrandpa t={t} expr="warm" look={[-0.5, 0]} rock={rock} />} />
				<CameraRig pos={[lerp(9.6, 8.4, k), lerp(6.4, 6.1, k), lerp(18.0, 15.6, k)]} target={[lerp(2.6, 2.4, k), 4.5, 2.2]} fov={34} sway={0.5} />
			</Stage>
		);
	}
	const fs = f - cB;
	const k = easeInOut(clamp(fs / (102 - 0)));
	const lonely = f >= cNot - 3;
	return (
		<Stage look={SUNSET_FRONT} focus={[2, 0, 3]} shadowSize={10}>
			<SunsetSky sunDir={SUNSET_FRONT.sunDir} />
			<Porch rock={rock * 0.6} sitter={<SittingGrandpa t={t} expr={lonely ? 'lonely' : 'warm'} look={lonely ? [0, 1] : [-0.5, 0]} rock={rock * 0.6} />} />
			<CameraRig pos={[lerp(GP_HEAD[0] - 3.4, GP_HEAD[0] - 2.2, k), lerp(5.6, 5.3, k), lerp(GP_HEAD[2] + 7.6, GP_HEAD[2] + 4.9, k)]} target={[GP_HEAD[0] + 0.1, lerp(4.9, 5.0, k), GP_HEAD[2]]} fov={34} sway={0.4} />
		</Stage>
	);
};

// ===================================================================== S4 + S5: attic and the photo
const ME_ATTIC: V3 = [1.4, 0, -3.6];
/** photo in my hands (character-local, unscaled) */
const PHOTO_LOCAL: V3 = [0, 3.2, 1.85];

const usePhotoRT = (w: number, h: number) => {
	const dpr = QUALITY.dpr;
	return useMemo(() => makePhotoRT(Math.round(w * dpr), Math.round(h * dpr)), [w, h, dpr]);
};

const AtticSet: React.FC<{f: number}> = ({f}) => (
	<>
		<Attic />
		<group position={[ME_ATTIC[0] + 0.3, 0, ME_ATTIC[2] - 2.6]}>
			<CardBox open={1} seed={1} />
		</group>
		<group position={[-2.6, 0, -7.4]} rotation={[0, 0.3, 0]}>
			<CardBox w={2.6} h={1.9} d={2} seed={2} />
			<group position={[0.2, 1.9, 0]} rotation={[0, -0.2, 0]}>
				<CardBox w={1.8} h={1.3} d={1.5} color="#a87c50" seed={3} />
			</group>
		</group>
		<group position={[5.2, 0, -8]} rotation={[0, -0.4, 0]}>
			<OldTrunk />
		</group>
		<group position={[-5.8, 0, 1.5]} rotation={[0, 0.8, 0]}>
			<CardBox w={2} h={1.5} d={1.7} color="#9c7a52" seed={4} />
		</group>
		<Dust frame={f} count={220} box={[10, 9, 12]} position={[0, 0, -5]} color="#ffe2b0" size={0.09} />
		<Spot from={[0, 6.4, -11.6]} to={[ME_ATTIC[0], 0.5, ME_ATTIC[2] + 0.5]} angle={0.42} intensity={140} />
	</>
);

const S4: React.FC<SceneProps> = ({f, g}) => {
	const t = f / 30;
	const rt = usePhotoRT(1024, 768);
	const photoMat = useMemo(() => oldPhotoMaterial(rt.texture), [rt]);
	const fFound = W(4, 40); // "found"
	const fBlow = W(4, 43) - 2; // "photo": blow the dust off
	const lift = easeInOut(clamp((f - (fFound - 12)) / 18));
	const blow = clamp((f - fBlow) / 10);
	const dusty = 1 - easeOut(clamp((f - fBlow - 2) / 12));
	const k = easeInOut(clamp(f / 88));
	const base = P.idle(t, 3);
	const pose = P.mixPose(P.withPose(base, {lean: 0.3, head: [0.35, 0, 0], armL: [-0.7, 0, -0.2], armR: [-0.7, 0, 0.2]}), P.holdPhoto(t, 0.5), lift);
	const blowing = f >= fBlow && f < fBlow + 14;
	return (
		<Stage look={ATTIC_LOOK} sky={false} fog={false} focus={[0, 0, -4]} shadowSize={12}>
			<PhotoPortal rt={rt} frame={f} />
			<AtticSet f={f} />
			<Character
				spec={ME}
				position={ME_ATTIC}
				rotation={Math.PI}
				pose={blowing ? P.blowCandles(0.4, pose) : pose}
				expr={blowing ? 'blowing' : lift > 0.5 ? 'curious' : 'curious'}
				puff={blowing ? Math.sin(clamp((f - fBlow) / 14) * Math.PI) : 0}
				look={lift > 0.5 ? [0, 0.6] : [0.3, 0.8]}
			>
				<group position={lerp3([0, 1.6, 1.3], PHOTO_LOCAL, lift)} rotation={[lerp(-1.2, 0.18, lift), Math.PI, 0]}>
					<PhotoCard front={photoMat} w={1.5} h={1.12} dusty={dusty} note={false} />
				</group>
			</Character>
			{f >= fBlow ? (
				<GlowPoints
					count={60}
					additive={false}
					color="#e8dcc4"
					fn={(i) => {
						const a = (f - fBlow) / 30;
						const ang = hash(i, 3) * Math.PI * 2;
						const sp = 0.6 + hash(i, 4) * 1.6;
						const x = ME_ATTIC[0] + Math.cos(ang) * 0.5 * sp * a * 2;
						const y = 2.6 + Math.sin(ang) * 0.4 * sp * a * 2 + a * 0.5;
						const z = ME_ATTIC[2] - 1.6 - a * sp * 1.4;
						return [x, y, z, 0.18 + a * 0.4, Math.max(0, 0.7 - a * 0.6)];
					}}
				/>
			) : null}
			<CameraRig pos={[lerp(-1.8, ME_ATTIC[0] + 3.2, k), lerp(6.6, 4.7, k), lerp(8.5, ME_ATTIC[2] - 3.8, k)]} target={[lerp(0.6, ME_ATTIC[0], k), lerp(3.4, 3.35, k), lerp(-6, ME_ATTIC[2] - 0.7, k)]} fov={lerp(46, 38, k)} sway={0.5} />
		</Stage>
	);
};

/** first-person view: my two arms holding the photo in front of my eyes (eye -> target is the view direction) */
export const PovPhoto: React.FC<{eye: V3; target: V3; front: THREE.Material; t: number; flip?: number}> = ({eye, target, front, t, flip = 0}) => {
	const d = new THREE.Vector3(target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]);
	const yaw = Math.atan2(-d.x, -d.z);
	const pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
	const sleeve = plastic(ME.top, {rough: 0.5});
	const skin = plastic(ME.skin, {rough: 0.45});
	const bob = Math.sin(t * 1.6) * 0.012;
	const seg = (a: V3, b: V3, w: number, m: THREE.Material, key: string) => {
		const va = new THREE.Vector3(...a);
		const vb = new THREE.Vector3(...b);
		const dir = vb.clone().sub(va);
		const len = dir.length();
		const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
		const mid = va.clone().add(vb).multiplyScalar(0.5);
		return <mesh key={key} geometry={rbox(w, len, w, 0.08)} material={m} position={[mid.x, mid.y, mid.z]} quaternion={q} castShadow={false} />;
	};
	return (
		<group position={eye} rotation={new THREE.Euler(pitch, yaw, 0, 'YXZ')}>
			<group position={[0, 0.22 + bob, -2.15]} rotation={[0.12, flip * Math.PI, 0]}>
				<PhotoCard front={front} w={1.2} h={0.9} />
			</group>
			{[-1, 1].map((sd) => (
				<group key={sd}>
					{seg([sd * 1.0, -1.6, -0.6], [sd * 0.63, -0.12 + bob, -2.02], 0.44, sleeve, 'a')}
					{seg([sd * 0.63, -0.12 + bob, -2.02], [sd * 0.58, 0.16 + bob, -2.16], 0.34, skin, 'h')}
				</group>
			))}
		</group>
	);
};

// S5: "People were wearing funny little hats. They were standing around a cake, and the cake had fire on top. And everyone was smiling."
const FullScreenPhoto: React.FC<{rt: THREE.WebGLRenderTarget}> = ({rt}) => {
	const mat = useMemo(() => oldPhotoMaterial(rt.texture, 0.0), [rt]);
	const h = 2 * 10 * Math.tan((50 / 2) * (Math.PI / 180));
	const w = (h * 1080) / 1920;
	return (
		<>
			<mesh geometry={plane(w, h)} material={mat} />
			<CameraRig pos={[0, 0, 10]} target={[0, 0, 0]} fov={50} sway={0} />
		</>
	);
};

const S5: React.FC<SceneProps> = ({f, g}) => {
	const cB = W(5, 53) - 3; // "They were standing around a cake"
	const cC = W(5, 66) - 3; // "And everyone was smiling"
	const shot = shotIndex(f, [cB, cC]);
	const t = f / 30;
	const rtSmall = usePhotoRT(1024, 768);
	const rtFull = usePhotoRT(1080, 1920);
	const photoMat = useMemo(() => oldPhotoMaterial(rtSmall.texture), [rtSmall]);
	if (shot === 0) {
		// over my shoulder: the photo in my hands, slow push in
		const k = easeInOut(clamp(f / cB));
		const eye: V3 = [ME_ATTIC[0], 3.6, ME_ATTIC[2] - 0.45];
		const look: V3 = [ME_ATTIC[0], 2.55, ME_ATTIC[2] - 2.2];
		return (
			<Stage look={ATTIC_LOOK} sky={false} fog={false} focus={[0, 0, -4]} shadowSize={12}>
				<PhotoPortal rt={rtSmall} frame={f + 200} />
				<AtticSet f={f + 90} />
				<PovPhoto eye={eye} target={look} front={photoMat} t={t} />
				<CameraRig pos={eye} target={look} fov={lerp(56, 46, k)} sway={0.25} />
			</Stage>
		);
	}
	// inside the photo: we move through the frozen happy day (flames still flicker)
	const fs = f - (shot === 1 ? cB : cC);
	let c;
	if (shot === 1) {
		const k = easeInOut(clamp(fs / (cC - cB)));
		c = cam({pos: [0, 3.95, 12.5], target: [0, 3.6, 1.8], fov: 50}, {pos: [0.3, 4.15, 6.6], target: [0, 3.75, 2.9], fov: 40}, k);
	} else {
		const k = easeInOut(clamp(fs / 60));
		c = cam({pos: [-2.4, 4.9, 7.6], target: [-1.9, 4.5, 1.0], fov: 44}, {pos: [2.4, 4.9, 7.6], target: [1.9, 4.5, 1.0], fov: 44}, k);
	}
	return (
		<>
			<PhotoPortal rt={rtFull} frame={f + 200} cam={c} />
			<FullScreenPhoto rt={rtFull} />
		</>
	);
};

export const SCENES_1_5: SceneDef[] = [{Comp: S1}, {Comp: S2}, {Comp: S3}, {Comp: S4}, {Comp: S5, post: () => ({bloom: 0.55, vignette: 0.5})}];
