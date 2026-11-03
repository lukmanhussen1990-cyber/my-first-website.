// Scenes 18-24: Stinky Hill, the bucket pile, packing, the long walk, the Swamp of Smells,
// the climb, the dark castle hall, the Golden Throne, WHOOSH and happy tears.
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {Stage, LOOKS, Look, mixLooks} from '../lib/Stage';
import {CameraRig} from '../lib/CameraRig';
import {Character} from '../characters/Character';
import {KID, GRANDPA} from '../characters/presets';
import * as P from '../characters/poses';
import {GrandpaHome, BED_POS} from '../world/GrandpaHome';
import {StinkyHill, BucketPile, Swamp, CountryRoad, hillY, HILL} from '../world/Wilds';
import {CastleHall, BeamTo} from '../world/CastleInside';
import {GoldenThrone, StoneStand, STAND_TOP} from '../props/GoldenThrone';
import {StinkCloud} from '../props/StinkCloud';
import {Backpack, ChipBag} from '../props/Furniture';
import {Flashlight} from '../props/HandProps';
import {Bucket} from '../props/Bucket';
import {Dust, MagicSwirl, Sparkles, LightRays} from '../props/Effects';
import {SkyDisc, Cloud} from '../world/Nature';
import {plastic, rbox} from '../lib/materials';
import {SceneDef, SceneProps, shotIndex, W, amp} from './kit';
import {easeInOut, easeOut, easeOutBack, clamp, lerp, keys, V3} from '../lib/anim';
import {registerWhip, wf, LEAD} from '../timing';
import {AbsoluteFill} from 'remotion';

const SPOOKY: Look = {
	skyTop: '#2b2152', skyMid: '#6d5c9e', skyBottom: '#bfdc8e', fog: '#93a67e', fogNear: 70, fogFar: 300,
	hemiSky: '#c8d8a8', hemiGround: '#3a4a2a', hemi: 0.95, ambient: 0.16,
	sunColor: '#efffd8', sun: 2.0, sunDir: [-0.45, 0.65, 0.45], shadowIntensity: 0.6, env: 0.4, exposure: 1.0,
};
const SWAMP: Look = {...LOOKS.swamp, fogNear: 10, fogFar: 70};
const SUNSET: Look = {...LOOKS.sunset, sunDir: [-0.3, 0.22, -0.9], fogNear: 60, fogFar: 260};
const DARK: Look = {...LOOKS.castle, hemi: 0.42, ambient: 0.1, fogNear: 14, fogFar: 70};
const DIM_ROOM = {...LOOKS.interiorNight, hemi: 0.75, ambient: 0.22};

const flash = (from: number, len: number, color = '#fff3c8', strength = 0.55) => (f: number) => {
	const k = clamp((f - from) / len);
	if (k <= 0 || k >= 1) return null;
	return <AbsoluteFill style={{background: color, opacity: Math.sin(k * Math.PI) * strength, mixBlendMode: 'screen'}} />;
};

// the kid's backpack, worn: with the bucket tied on top
const WornPack: React.FC = () => (
	<group position={[0, -1.15, -0.55]}>
		<Backpack open={0} scale={0.8} />
		<group position={[0, 1.75, -0.1]} rotation={[0.25, 0, 0]}>
			<Bucket scale={0.55} handle={-1.0} />
		</group>
	</group>
);

// ===================================================================== S18
// "In the old castle on top of Stinky Hill." far shot of the castle on the hill, stink clouds above
const S18: React.FC<SceneProps> = ({f, dur}) => {
	const k = easeInOut(clamp(f / dur));
	return (
		<Stage look={SPOOKY} focus={[0, 20, 0]} shadowSize={50}>
			<StinkyHill frame={f} pile={false} />
			<mesh geometry={rbox(400, 0.5, 400, 0.1)} material={plastic('#5f9a42', {rough: 0.95})} position={[0, -0.3, 0]} receiveShadow />
			<Cloud position={[-90, 70, -160]} scale={6} seed={41} color="#cfc6e8" />
			<Cloud position={[80, 85, -200]} scale={7} seed={42} color="#cfc6e8" />
			<CameraRig pos={[lerp(42, 32, k), lerp(16, 19, k), lerp(175, 145, k)]} target={[0, 25, 0]} fov={38} sway={0.6} />
		</Stage>
	);
};

// ===================================================================== S19
// "Nobody who went there ever came back... because nobody can hold it that long."
const S19: React.FC<SceneProps> = ({f, g}) => {
	const cut = W(19, 161) - 3; // "because"
	const shot = shotIndex(f, [cut]);
	const t = f / 30;
	if (shot === 0) {
		const shrugK = clamp((f - W(19, 158) + 6) / 8);
		const pose = P.mixPose(P.idle(t), P.shrug(1), easeOut(shrugK));
		return (
			<Stage look={DIM_ROOM} sky={false} fog={false} focus={[0, 0, -6]} shadowSize={8}>
				<GrandpaHome night={false} curtains={1} />
				<Character spec={GRANDPA} position={[0.5, 0, -6.4]} rotation={0.1} pose={pose} expr={shrugK > 0.3 ? 'smug' : 'neutral'} face={shrugK > 0.3 ? {brows: 'sad', mouth: 'flat'} : undefined} talk={amp(g) * 0.75} />
				<pointLight position={[1.5, 3.4, -3.5]} intensity={12} distance={9} color="#ffcf8a" />
				<CameraRig pos={[1.4, 4.2, 1.6]} target={[0.5, 3.6, -6.4]} fov={46} sway={0.7} />
			</Stage>
		);
	}
	const fs = f - cut;
	const k = easeInOut(clamp(fs / 60));
	return (
		<Stage look={SPOOKY} focus={[6, 0, 47]} shadowSize={14}>
			<StinkyHill frame={f} />
			<mesh geometry={rbox(400, 0.5, 400, 0.1)} material={plastic('#5f9a42', {rough: 0.95})} position={[0, -0.3, 0]} receiveShadow />
			<StinkCloud frame={f} position={[2.5, 4.2, 47]} scale={1.2} seed={77} />
			<CameraRig pos={[lerp(17, 14.5, k), lerp(2.2, 2.8, k), lerp(64, 60, k)]} target={[4.0, 9.5, 38]} fov={54} sway={0.7} />
		</Stage>
	);
};

// ===================================================================== S20
// "So I packed my bag. Snacks. A flashlight. And my bucket... just in case." items jump into the backpack
const PACK: V3 = [BED_POS[0], 1.95, BED_POS[2] + 1.6];
const jump = (f: number, at: number, from: V3, rot0: number) => {
	const k = clamp((f - at) / 12);
	const p: V3 = [lerp(from[0], PACK[0], k), lerp(from[1], PACK[1] + 1.4, k) + Math.sin(k * Math.PI) * 2.6, lerp(from[2], PACK[2], k)];
	return {p, r: rot0 + k * Math.PI * 2, k};
};
const PackingSet: React.FC<{f: number; t: number; meExpr: any; mePose: P.Pose; showItems: boolean}> = ({f, t, meExpr, mePose, showItems}) => {
	const sn = jump(f, W(20, 173) - 5, [BED_POS[0] + 4.5, 2.2, BED_POS[2] + 3.5], 0);
	const fl = jump(f, W(20, 175) - 5, [BED_POS[0] - 4.2, 2.6, BED_POS[2] + 3.2], 1);
	const bu = jump(f, W(20, 178) - 5, [BED_POS[0] + 3.8, 0.0, BED_POS[2] + 5.0], 2);
	const sink = (k: number) => (k >= 1 ? 0.0 : 1);
	return (
		<>
			<GrandpaHome night={false} curtains={0} />
			<Backpack position={PACK} rotation={[0, 0, 0]} open={1} scale={0.9} />
			{showItems ? (
				<>
					{sn.k < 1 ? <ChipBag position={sn.p} rotation={[sn.r, sn.r * 0.5, 0]} /> : null}
					{fl.k < 1 ? (
						<group position={fl.p} rotation={[fl.r, 0, 0.4]}>
							<Flashlight />
						</group>
					) : null}
					{bu.k < 1 ? <Bucket position={[bu.p[0], bu.p[1], bu.p[2]]} rotation={[bu.r * 0.5, 0, 0.3]} scale={0.6} handle={0} /> : <Bucket position={[PACK[0], PACK[1] + 1.45, PACK[2]]} scale={0.6} handle={0.4} />}
					{sink(sn.k) === 0 ? null : null}
				</>
			) : null}
			<Character spec={KID} position={[BED_POS[0] + 0.3, 0, BED_POS[2] + 5.4]} rotation={Math.PI} pose={mePose} expr={meExpr} />
		</>
	);
};
const S20: React.FC<SceneProps> = ({f}) => {
	const cB = W(20, 173) - 8; // "Snacks"
	const cC = W(20, 179) - 3; // "just in case"
	const shot = shotIndex(f, [cB, cC]);
	const t = f / 30;
	const look = {...LOOKS.interiorDay, sunDir: [0.1, 0.7, -0.9] as V3};
	if (shot === 0) {
		const k = easeOut(clamp(f / cB));
		return (
			<Stage look={look} sky={false} fog={false} focus={[BED_POS[0], 0, BED_POS[2] + 3]} shadowSize={10}>
				<PackingSet f={f} t={t} meExpr="determined" mePose={P.withPose(P.idle(t), {armL: [-1.1, 0, -0.3], armR: [-1.1, 0, 0.3], lean: 0.15})} showItems={false} />
				<CameraRig pos={[lerp(BED_POS[0] + 5.5, BED_POS[0] + 4.6, k), 5.0, BED_POS[2] - 1.8]} target={[BED_POS[0] + 0.3, 3.0, BED_POS[2] + 4.2]} fov={48} sway={0.8} />
			</Stage>
		);
	}
	if (shot === 1) {
		const fs = f - cB;
		const k = easeInOut(clamp(fs / 70));
		return (
			<Stage look={look} sky={false} fog={false} focus={[BED_POS[0], 0, BED_POS[2] + 2]} shadowSize={8}>
				<PackingSet f={f} t={t} meExpr="happy" mePose={P.withPose(P.idle(t), {armL: [-0.9, 0, -0.3], armR: [-0.9, 0, 0.3]})} showItems />
				<CameraRig pos={[lerp(BED_POS[0] + 2.4, BED_POS[0] + 1.6, k), lerp(5.6, 5.2, k), lerp(BED_POS[2] + 7.6, BED_POS[2] + 6.8, k)]} target={[PACK[0], PACK[1] + 1.4, PACK[2]]} fov={50} sway={0.6} />
			</Stage>
		);
	}
	const fs = f - cC;
	const k = easeOut(clamp(fs / 25));
	const me: V3 = [BED_POS[0] + 0.3, 0, BED_POS[2] + 5.4];
	return (
		<Stage look={look} sky={false} fog={false} focus={[me[0], 0, me[2]]} shadowSize={8}>
			<GrandpaHome night={false} curtains={0} />
			<Character spec={KID} position={me} rotation={0.35} pose={P.withPose(P.idle(t), {armL: [-0.3, 0, 0.15], armR: [-0.3, 0, -0.15]})} expr="smug" backItem={<WornPack />} />
			<CameraRig pos={[lerp(me[0] + 3.6, me[0] + 2.6, k), 3.7, lerp(me[2] + 5.4, me[2] + 4.4, k)]} target={[me[0] - 0.2, 3.1, me[2]]} fov={44} sway={0.7} />
		</Stage>
	);
};

// ===================================================================== S21
// "I walked for two days. I crossed the Swamp of Smells."
const DAYCYCLE = (k: number): Look => {
	const day = LOOKS.day;
	const sunset = LOOKS.sunset;
	const night = LOOKS.night;
	if (k < 0.3) return mixLooks(day, sunset, k / 0.3);
	if (k < 0.5) return mixLooks(sunset, night, (k - 0.3) / 0.2);
	if (k < 0.75) return mixLooks(night, LOOKS.morning, (k - 0.5) / 0.25);
	return mixLooks(LOOKS.morning, day, (k - 0.75) / 0.25);
};
const S21: React.FC<SceneProps> = ({f}) => {
	const cut = W(21, 187) - 3; // "I crossed the Swamp of Smells"
	const shot = shotIndex(f, [cut]);
	const t = f / 30;
	if (shot === 0) {
		const k = clamp(f / cut);
		const look = DAYCYCLE(k);
		const z = 10 - f * 0.12;
		const sunA = k * Math.PI * 1.6 - 0.3;
		return (
			<Stage look={look} focus={[0, 0, z]} shadowSize={16}>
				<CountryRoad z0={40} z1={-160} />
				<SkyDisc position={[-160 * Math.cos(sunA), 150 * Math.sin(sunA) + 10, -200]} size={10} color={k > 0.35 && k < 0.7 ? '#e8eeff' : '#fff1c4'} intensity={2} />
				<Character spec={KID} position={[0.6, 0, z]} rotation={Math.PI} pose={P.walk(t, 1.1)} expr="determined" backItem={<WornPack />} />
				<CameraRig pos={[9.5, 3.4, z - 3.5]} target={[0.4, 2.4, z - 1]} fov={50} sway={0.7} />
			</Stage>
		);
	}
	const fs = f - cut;
	const z = 18 - fs * 0.09;
	return (
		<Stage look={SWAMP} focus={[0, 0, z]} shadowSize={14}>
			<Swamp frame={f} />
			<Character spec={KID} position={[0.3, 0.3, z]} rotation={Math.PI} pose={P.holdNoseWalk(fs / 30)} expr="disgusted" backItem={<WornPack />} />
			<CameraRig pos={[2.8, 4.6, z - 11.5]} target={[0.2, 2.6, z + 1]} fov={54} sway={0.8} />
		</Stage>
	);
};

// ===================================================================== S22
// "I climbed Stinky Hill." climbing a steep hill at sunset, tired
const pathPoint = (tp: number): V3 => {
	const ang = 1.6 + tp * Math.PI * 2.1;
	const rr = (1 - tp * 0.82) * 0.92;
	const x = Math.cos(ang) * HILL.r * rr;
	const z = Math.sin(ang) * HILL.rz * rr;
	return [x, hillY(x, z) + 0.3, z];
};
const S22: React.FC<SceneProps> = ({f, dur}) => {
	const t = f / 30;
	const tp = 0.78 + (f / dur) * 0.03;
	const me = pathPoint(tp);
	const ahead = pathPoint(tp + 0.02);
	const yaw = Math.atan2(ahead[0] - me[0], ahead[2] - me[2]);
	const behind = pathPoint(tp - 0.05);
	// camera a little down-slope and outward, safely above the ground
	const out = Math.hypot(me[0], me[2]);
	const ox = (me[0] / out) * 5;
	const oz = (me[2] / out) * 5;
	const cx = behind[0] + ox;
	const cz = behind[2] + oz;
	const camPos: V3 = [cx, hillY(cx, cz) + 1.8, cz];
	return (
		<Stage look={SUNSET} focus={me} shadowSize={14}>
			<StinkyHill frame={f} pile={false} sunset />
			<SkyDisc position={[-60, 40, -260]} size={14} color="#ffd08a" halo="#ff9a5a" intensity={2.4} />
			<Character spec={KID} position={me} rotation={yaw} pose={P.climb(t)} expr="tired" backItem={<WornPack />} />
			<CameraRig pos={camPos} target={[me[0], me[1] + 3.2, me[2]]} fov={54} sway={0.9} />
		</Stage>
	);
};

// ===================================================================== S23
// "And there, inside the castle, under all the dust and spiderwebs... was the Golden Throne."
const THRONE_Z = -38;
const FlashKid: React.FC<{pos: V3; yaw: number; t: number; aimY?: number; expr?: any}> = ({pos, yaw, t, aimY = 0, expr = 'shocked'}) => (
	<Character
		spec={KID}
		position={pos}
		rotation={yaw}
		pose={P.withPose(P.walk(t, 0.55, 0.6), {armR: [-1.45 + aimY, 0, 0.05], armL: [-0.4, 0, 0.3]})}
		expr={expr}
		backItem={<WornPack />}
		holdR={
			<group rotation={[Math.PI / 2, 0, 0]}>
				<Flashlight on />
			</group>
		}
	/>
);
/** flashlight spot + visible beam from a world point toward a target */
const Beam: React.FC<{from: V3; to: V3}> = ({from, to}) => {
	const target = useMemo(() => new THREE.Object3D(), []);
	target.position.set(...to);
	target.updateMatrixWorld();
	return (
		<>
			<primitive object={target} />
			<spotLight position={from} target={target} angle={0.32} penumbra={0.55} intensity={90} distance={60} decay={1.3} color="#fff4d2" />
			<BeamTo from={from} to={to} radius={2.6} opacity={0.22} color="#fff2c8" />
		</>
	);
};
const S23: React.FC<SceneProps> = ({f}) => {
	const cB = W(23, 202) - 3; // "under all the dust and spiderwebs"
	const cC = W(23, 208) - 3; // "was the Golden Throne"
	const shot = shotIndex(f, [cB, cC]);
	const t = f / 30;
	const throne = (glow: number) => (
		<>
			<StoneStand position={[0, 0, THRONE_Z]} />
			<GoldenThrone frame={f} position={[0, STAND_TOP, THRONE_Z]} glow={glow} light={glow > 0.2} sparkles={glow > 0.3} />
		</>
	);
	if (shot === 0) {
		const z = 6 - f * 0.05;
		const sweep = Math.sin(t * 1.6) * 7;
		const from: V3 = [1.2, 2.75, z - 1.7];
		return (
			<Stage look={DARK} sky={false} focus={[0, 0, z - 10]} shadowSize={16}>
				<CastleHall />
				{throne(0.08)}
				<FlashKid pos={[0, 0, z]} yaw={Math.PI + sweep * 0.02} t={t} />
				<Beam from={from} to={[sweep, 1.5, z - 22]} />
				<Dust frame={f} count={220} box={[22, 14, 30]} position={[0, 0, z - 18]} color="#fff3d6" size={0.11} />
				<CameraRig pos={[-3.0, 6.4, z + 9.5]} target={[0.6, 3.2, z - 10]} fov={54} sway={0.8} />
			</Stage>
		);
	}
	if (shot === 1) {
		const fs = f - cB;
		const z = 6 - f * 0.05;
		const sweepX = lerp(-11, -4, easeInOut(clamp(fs / 60)));
		const from: V3 = [1.2, 2.75, z - 1.7];
		return (
			<Stage look={DARK} sky={false} focus={[-6, 8, -8]} shadowSize={14}>
				<CastleHall />
				{throne(0.08)}
				<FlashKid pos={[0, 0, z]} yaw={Math.PI + 0.35} t={t} aimY={-0.5} />
				<Beam from={from} to={[sweepX, 12.5, -6]} />
				<Dust frame={f} count={260} box={[14, 12, 14]} position={[-6, 6, -6]} color="#fff3d6" size={0.12} />
				<CameraRig pos={[lerp(-2.0, -2.6, clamp(fs / 70)), 9.5, 4.5]} target={[-6.6, 13, -6]} fov={50} sway={0.8} />
			</Stage>
		);
	}
	const fs = f - cC;
	const glow = 0.1 + easeOut(clamp((fs - 8) / 18)) * 1.2;
	const z = 6 - f * 0.05;
	const awe = W(23, 211) - cC; // "Throne"
	if (fs < awe + 4) {
		const k = easeOut(clamp(fs / 50));
		const from: V3 = [1.2, 2.75, z - 1.7];
		return (
			<Stage look={DARK} sky={false} focus={[0, 0, THRONE_Z + 8]} shadowSize={14}>
				<CastleHall />
				{throne(glow)}
				<FlashKid pos={[0, 0, z]} yaw={Math.PI} t={t} />
				<Beam from={from} to={[0, STAND_TOP + 1.6, THRONE_Z]} />
				<LightRays frame={f} position={[0, 4.5, THRONE_Z - 2]} size={22 * glow} opacity={0.35 * clamp(glow - 0.2)} />
				<Dust frame={f} count={160} box={[16, 10, 16]} position={[0, 0, THRONE_Z + 6]} color="#ffe6a0" size={0.1} />
				<CameraRig pos={[lerp(2.6, 1.6, k), lerp(1.4, 1.9, k), lerp(THRONE_Z + 14, THRONE_Z + 9.5, k)]} target={[0, STAND_TOP + 2.0, THRONE_Z]} fov={48} sway={0.6} />
			</Stage>
		);
	}
	// my face lit gold, in awe
	const me: V3 = [0, 0, THRONE_Z + 7];
	return (
		<Stage look={DARK} sky={false} focus={[0, 0, THRONE_Z + 6]} shadowSize={10}>
			<CastleHall />
			{throne(1.2)}
			<Character spec={KID} position={me} rotation={Math.PI} pose={P.withPose(P.idle(t), {armR: [-0.8, 0, 0.1]})} expr="awe" backItem={<WornPack />} holdR={<group rotation={[Math.PI / 2, 0, 0]}><Flashlight on /></group>} />
			<pointLight position={[0, 3.5, THRONE_Z + 3.5]} intensity={22} distance={10} color="#ffc94a" />
			<CameraRig pos={[0.4, 3.45, THRONE_Z + 3.6]} target={[0, 3.35, me[2]]} fov={44} sway={0.5} />
		</Stage>
	);
};

// ===================================================================== S24
// "I pressed the button. WHOOSH. I cried a little."
const S24: React.FC<SceneProps> = ({f}) => {
	const cB = W(24, 216) - 3; // "WHOOSH"
	const cC = W(24, 217) - 3; // "I cried a little"
	const shot = shotIndex(f, [cB, cC]);
	const t = f / 30;
	const pressAt = W(24, 215) - 2; // "button"
	const press = keys(f, [[pressAt - 4, 0], [pressAt + 2, 1], [cC, 1], [cC + 10, 0]], easeOut);
	const throneBase = (glow: number) => (
		<>
			<StoneStand position={[0, 0, THRONE_Z]} />
			<GoldenThrone frame={f} position={[0, STAND_TOP, THRONE_Z]} glow={glow} press={press} />
		</>
	);
	if (shot === 0) {
		// insert: my hand pressing the big button
		const handY = keys(f, [[0, 1.6], [pressAt - 4, 1.2], [pressAt + 2, 0.35]], easeInOut);
		const bx = 0;
		const by = STAND_TOP + 3.0;
		const bz = THRONE_Z - 1.12;
		return (
			<Stage look={DARK} sky={false} focus={[0, 3, THRONE_Z]} shadowSize={6}>
				<CastleHall webs={false} />
				{throneBase(1.2)}
				<group position={[bx + 0.15, by + handY, bz + 0.25]} rotation={[0.25, 0, -0.15]}>
					<mesh geometry={rbox(0.78, 0.7, 0.78, 0.12)} material={plastic(KID.skin, {rough: 0.45})} position={[0, 0.35, 0]} castShadow />
					<mesh geometry={rbox(0.86, 1.8, 0.86, 0.12)} material={plastic(KID.top, {rough: 0.5})} position={[0, 1.6, 0]} castShadow />
					<mesh geometry={rbox(0.92, 0.15, 0.92, 0.05)} material={plastic('#1fa34c', {rough: 0.5})} position={[0, 0.72, 0]} />
				</group>
				<CameraRig pos={[1.8, by + 0.9, bz + 2.6]} target={[bx, by + 0.3, bz]} fov={46} sway={0.5} />
			</Stage>
		);
	}
	if (shot === 1) {
		const fs = f - cB;
		const k = clamp(fs / 50);
		return (
			<Stage look={DARK} sky={false} focus={[0, 0, THRONE_Z + 4]} shadowSize={14}>
				<CastleHall webs={false} />
				{throneBase(1.8)}
				<MagicSwirl k={k} position={[0, STAND_TOP + 0.8, THRONE_Z]} radius={2.8} height={12} count={240} />
				<LightRays frame={f} position={[0, 5, THRONE_Z - 2]} size={36} opacity={0.5} />
				<Character spec={KID} position={[2.6, STAND_TOP, THRONE_Z + 1.8]} rotation={-2.4} pose={P.withPose(P.idle(t), {armL: [-0.8, 0, 0.6], armR: [-0.8, 0, -0.6]})} expr="awe" backItem={<WornPack />} />
				<pointLight position={[0, 6, THRONE_Z + 3]} intensity={40} distance={30} color="#ffd24a" />
				<CameraRig pos={[lerp(-4, -5.5, k), lerp(3, 2.2, k), lerp(THRONE_Z + 13, THRONE_Z + 15, k)]} target={[0, 5, THRONE_Z]} fov={52} sway={0.5} shake={0.3} />
			</Stage>
		);
	}
	const fs = f - cC;
	const k = easeOut(clamp(fs / 40));
	const me: V3 = [2.6, STAND_TOP, THRONE_Z + 1.8];
	return (
		<Stage look={DARK} sky={false} focus={[me[0], STAND_TOP, me[2]]} shadowSize={8}>
			<CastleHall webs={false} />
			{throneBase(1.2)}
			<Character spec={KID} position={me} rotation={0.4} pose={P.withPose(P.idle(t), {head: [0.12, 0, Math.sin(t * 3) * 0.05]})} expr="happyCry" backItem={<WornPack />} />
			<pointLight position={[me[0] - 1, STAND_TOP + 4, me[2] + 2.5]} intensity={20} distance={9} color="#ffc94a" />
			<Sparkles frame={f} count={30} radius={3} height={5} position={[me[0], STAND_TOP, me[2]]} seed={9} />
			<CameraRig pos={[me[0] + 1.6, STAND_TOP + 3.5, lerp(me[2] + 4.4, me[2] + 3.5, k)]} target={[me[0], STAND_TOP + 3.3, me[2]]} fov={44} sway={0.5} />
		</Stage>
	);
};
registerWhip(wf(193) - LEAD, 1); // S21 -> S22

export const QUEST_SCENES: SceneDef[] = [
	{Comp: S18, post: () => ({bloom: 0.75, threshold: 0.85, vignette: 0.45})},
	{Comp: S19, post: (f) => (f < W(19, 161) - 3 ? {bloom: 0.6, threshold: 0.85, vignette: 0.5} : {bloom: 0.7, threshold: 0.85, vignette: 0.5})},
	{Comp: S20, post: () => ({bloom: 0.45, threshold: 0.9})},
	{Comp: S21, post: () => ({bloom: 0.7, threshold: 0.85, vignette: 0.45})},
	{Comp: S22, post: () => ({bloom: 0.9, threshold: 0.8, vignette: 0.45})},
	{Comp: S23, post: () => ({bloom: 1.0, threshold: 0.78, vignette: 0.6})},
	{Comp: S24, post: (f) => ({bloom: f >= W(24, 216) - 3 && f < W(24, 217) ? 1.3 : 1.0, threshold: 0.78, vignette: 0.55}), overlay: flash(W(24, 216) - 2, 9)},
];
