// Scenes 25-32: dragging the throne home, the forest break, the whole town waiting, Grandpa's flush,
// everyone crying, the basement of a thousand thrones, the toilet shop, the Flush King.
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {Stage, LOOKS, Look, mixLooks} from '../lib/Stage';
import {CameraRig} from '../lib/CameraRig';
import {Character, CharSpec} from '../characters/Character';
import {KID, GRANDPA, BUCKET_MAN, TEACHER, makePerson} from '../characters/presets';
import * as P from '../characters/poses';
import {CountryRoad, Forest} from '../world/Wilds';
import {TownSquare, STAGE_TOP, ToiletShop} from '../world/Square';
import {Basement, Torch} from '../world/CastleInside';
import {TownStreet, ClockTower} from '../world/Town';
import {GoldenThrone, SEAT_HEIGHT} from '../props/GoldenThrone';
import {Backpack} from '../props/Furniture';
import {PaperSheet} from '../props/HandProps';
import {Bucket} from '../props/Bucket';

import {MagicSwirl, LightRays, Confetti, Sparkles, Dust} from '../props/Effects';
import {SkyDisc, Stars, Cloud} from '../world/Nature';
import {plastic, rbox, cyl, glowMat, box} from '../lib/materials';
import {newspaperTex} from '../lib/textures';
import {SceneDef, SceneProps, shotIndex, W, amp} from './kit';
import {easeInOut, easeOut, easeIn, clamp, lerp, keys, V3} from '../lib/anim';
import {hash} from '../lib/random';
import {registerWhip, wf, LEAD} from '../timing';
import {AbsoluteFill} from 'remotion';

const flash = (from: number, len: number, color = '#fff3c8', strength = 0.55) => (f: number) => {
	const k = clamp((f - from) / len);
	if (k <= 0 || k >= 1) return null;
	return <AbsoluteFill style={{background: color, opacity: Math.sin(k * Math.PI) * strength, mixBlendMode: 'screen'}} />;
};

const WornPack: React.FC = () => (
	<group position={[0, -1.15, -0.55]}>
		<Backpack open={0} scale={0.8} />
		<group position={[0, 1.75, -0.1]} rotation={[0.25, 0, 0]}>
			<Bucket scale={0.55} handle={-1.0} />
		</group>
	</group>
);

/** a taut rope between two points */
const Rope: React.FC<{a: V3; b: V3}> = ({a, b}) => {
	const va = new THREE.Vector3(...a);
	const vb = new THREE.Vector3(...b);
	const mid = va.clone().add(vb).multiplyScalar(0.5);
	const dir = vb.clone().sub(va);
	const len = dir.length();
	const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
	return <mesh geometry={cyl(0.07, 0.07, 1, 8)} material={plastic('#c8a15a', {rough: 0.8})} position={mid} quaternion={q} scale={[1, len, 1]} castShadow />;
};

const DAYCYCLE = (k: number): Look => {
	if (k < 0.3) return mixLooks(LOOKS.day, LOOKS.sunset, k / 0.3);
	if (k < 0.5) return mixLooks(LOOKS.sunset, LOOKS.night, (k - 0.3) / 0.2);
	if (k < 0.75) return mixLooks(LOOKS.night, LOOKS.morning, (k - 0.5) / 0.25);
	return mixLooks(LOOKS.morning, LOOKS.day, (k - 0.75) / 0.25);
};

// ===================================================================== S25
// "I dragged it all the way home. It took four days." dragging the gold toilet down a long road, day -> night -> day
const Dragging: React.FC<{f: number; z: number; t: number}> = ({f, z, t}) => {
	const tz = z + 6.2;
	const wob = Math.sin(t * 6.5) * 0.05;
	return (
		<>
			<Character spec={KID} position={[0.6, 0, z]} rotation={Math.PI} pose={P.drag(t)} expr="tired" backItem={<WornPack />} />
			<GoldenThrone frame={f} position={[0.6, Math.abs(Math.sin(t * 6.5)) * 0.06, tz]} rotation={Math.PI + wob} glow={0.5} light={false} sparkles={false} />
			<Rope a={[0.6, 1.75, z + 1.15]} b={[0.6, 1.05, tz - 1.15]} />
		</>
	);
};
const S25: React.FC<SceneProps> = ({f}) => {
	const cut = W(25, 228) - 3; // "It took four days"
	const shot = shotIndex(f, [cut]);
	const t = f / 30;
	const z = 10 - f * 0.06;
	if (shot === 0) {
		return (
			<Stage look={LOOKS.day} focus={[0, 0, z + 3]} shadowSize={14}>
				<CountryRoad z0={40} z1={-200} />
				<SkyDisc position={[-120, 90, -220]} size={9} color="#fff4c8" />
				<Cloud position={[60, 60, -200]} scale={5} seed={3} />
				<Dragging f={f} z={z} t={t} />
				<CameraRig pos={[5.2, 3.0, z - 7.5]} target={[0.6, 2.0, z + 2.6]} fov={50} sway={0.8} />
			</Stage>
		);
	}
	const fs = f - cut;
	const k = clamp(fs / (shotLen25 - 4));
	const k2 = (k * 2) % 1;
	const look = DAYCYCLE(k2);
	const sunA = k2 * Math.PI * 1.6 - 0.3;
	const night = k2 > 0.35 && k2 < 0.68;
	return (
		<Stage look={look} focus={[0, 0, z]} shadowSize={20}>
			<CountryRoad z0={40} z1={-200} />
			<SkyDisc position={[-170 * Math.cos(sunA), 150 * Math.sin(sunA) + 10, -230]} size={10} color={night ? '#e8eeff' : '#fff1c4'} intensity={2} />
			{night ? <Stars count={200} /> : null}
			<Dragging f={f} z={z} t={t} />
			<CameraRig pos={[18, 14, z + 22]} target={[0.6, 1.5, z + 2]} fov={44} sway={0.6} />
		</Stage>
	);
};
const shotLen25 = 117 - (W(25, 228) - 3);

// ===================================================================== S26
// "I used it twice on the way." sitting on the Golden Throne in a forest, calmly reading a newspaper
const S26: React.FC<SceneProps> = ({f, dur}) => {
	const t = f / 30;
	const k = easeInOut(clamp(f / dur));
	const paper = useMemo(() => newspaperTex(), []);
	const hip = (KID.legH ?? 2) * KID.scale;
	return (
		<Stage look={{...LOOKS.day, sunDir: [-0.5, 0.75, 0.4]}} focus={[0, 0, 0]} shadowSize={10}>
			<Forest />
			<GoldenThrone frame={f} position={[0, 0, 0]} glow={0.6} light={false} sparkles />
			<Character spec={KID} position={[0, SEAT_HEIGHT + 0.06 - hip, 0.1]} rotation={0} pose={P.withPose(P.sit(t, 2, 0), {...P.reading(t), head: [0.18, 0, 0]})} expr="smug" face={{eyes: 'half', mouth: 'smile'}} />
			<group position={[0, 2.25, 1.55]} rotation={[-0.25, 0, 0]}>
				<PaperSheet map={paper} />
			</group>
			<Backpack position={[2.4, 0, 1.2]} rotation={[0, -0.6, 0]} scale={0.8} open={0} />
			<Bucket position={[2.4, 1.85, 1.1]} scale={0.55} handle={-1} />
			<CameraRig pos={[lerp(-2.8, -2.0, k), lerp(3.2, 3.0, k), lerp(9.0, 7.4, k)]} target={[0, 2.5, 0.4]} fov={46} sway={0.6} />
		</Stage>
	);
};

// ===================================================================== the square & crowd
const DUSK: Look = {...mixLooks(LOOKS.sunset, LOOKS.night, 0.55), exposure: 1.05};
const CLASS_KIDS: CharSpec[] = Array.from({length: 8}).map((_, i) => makePerson(700 + i, {kid: true}));
type Person = {spec: CharSpec; p: V3; yaw: number; ring: number; id: number; partner?: number};
const CROWD: Person[] = (() => {
	const out: Person[] = [];
	let id = 0;
	const rings: [number, number][] = [[8.2, 12], [11.6, 15], [15.2, 16]];
	rings.forEach(([r, n], ri) => {
		for (let i = 0; i < n; i++) {
			const th = -2.75 + (i / (n - 1)) * 5.5 + (ri % 2) * 0.12;
			if (Math.abs(th) < 0.32) continue; // aisle toward +z
			const x = Math.sin(th) * r;
			const z = Math.cos(th) * r;
			let spec = makePerson(900 + id, {kid: hash(id, 5) > 0.7, elder: hash(id, 6) > 0.92});
			out.push({spec, p: [x, 0, z], yaw: Math.atan2(-x, -z), ring: ri, id});
			id++;
		}
	});
	// special guests in the front row
	out[2] = {...out[2], spec: BUCKET_MAN};
	out[8] = {...out[8], spec: TEACHER};
	[0, 1, 3, 4, 5, 6, 7, 9].forEach((ix, k) => (out[ix] = {...out[ix], spec: CLASS_KIDS[k % CLASS_KIDS.length]}));
	return out;
})();

type CrowdMood = 'cheer' | 'watch' | 'silent' | 'cry' | 'awe';
const Crowd: React.FC<{t: number; mood: CrowdMood; skip?: number[]}> = ({t, mood, skip = []}) => (
	<>
		{CROWD.map((c, i) => {
			if (skip.includes(i)) return null;
			let pose: P.Pose = P.idle(t, i);
			let expr: any = 'happy';
			let rot = c.yaw;
			let pos = c.p;
			if (mood === 'cheer') {
				pose = hash(i, 3) > 0.35 ? P.cheer(t, i) : P.jumpJoy(t, i);
				expr = hash(i, 4) > 0.5 ? 'bigSmile' : 'laugh';
			} else if (mood === 'watch' || mood === 'awe') {
				pose = P.idle(t, i);
				expr = mood === 'awe' ? 'awe' : 'neutral';
			} else if (mood === 'silent') {
				pose = P.REST;
				expr = hash(i, 4) > 0.5 ? 'shocked' : 'neutral';
			} else if (mood === 'cry') {
				// pairs hug: odd index turns toward the previous one
				const pairWith = i % 2 === 1 ? i - 1 : i + 1;
				const o = CROWD[pairWith];
				if (o && hash(Math.floor(i / 2), 7) > 0.35) {
					const mid: V3 = [(c.p[0] + o.p[0]) / 2, 0, (c.p[2] + o.p[2]) / 2];
					rot = Math.atan2(o.p[0] - c.p[0], o.p[2] - c.p[2]);
					const d = Math.hypot(o.p[0] - c.p[0], o.p[2] - c.p[2]);
					const s = Math.max(0, (d - 1.7) / 2) / d;
					pos = [c.p[0] + (o.p[0] - c.p[0]) * s, 0, c.p[2] + (o.p[2] - c.p[2]) * s];
					pose = P.hug(t, i);
				} else {
					pose = P.withPose(P.idle(t, i), {head: [0.2, 0, 0]});
				}
				expr = hash(i, 9) > 0.4 ? 'crying' : 'happyCry';
			}
			return <Character key={i} spec={c.spec} position={pos} rotation={rot} pose={pose} expr={expr} lod={c.ring > 0 ? 'low' : 'high'} />;
		})}
	</>
);

// ===================================================================== S27
// "When I got back, the whole town was waiting." the square full of people, cheering as I arrive
const S27: React.FC<SceneProps> = ({f}) => {
	const t = f / 30;
	const z = 17 - f * 0.07;
	const cheering = f > W(27, 243) - 8;
	return (
		<Stage look={DUSK} focus={[0, 0, 8]} shadowSize={24}>
			<TownSquare lit="night" />
			<Crowd t={t} mood={cheering ? 'cheer' : 'watch'} />
			<Dragging f={f} z={z} t={t} />
			<CameraRig pos={[2.6, 4.4, z + 10.5]} target={[0, 3.0, z - 8]} fov={54} sway={0.8} />
		</Stage>
	);
};

// ===================================================================== S28
// "Grandpa went first. He sat down... pressed the button... WHOOSH."
const THRONE_AT: V3 = [0, STAGE_TOP, 0];
const gpHip = 2 * GRANDPA.scale;
const GP_SIT: V3 = [0, STAGE_TOP + SEAT_HEIGHT + 0.08 - gpHip, 0.18];
const LightColumn: React.FC<{k: number}> = ({k}) => {
	const h = 80 * easeOut(clamp(k * 2.5));
	const fade = 1 - clamp((k - 0.6) / 0.4);
	const mat = useMemo(() => {
		const m = new THREE.MeshBasicMaterial({color: new THREE.Color('#ffd24a').multiplyScalar(2.5), transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending});
		m.toneMapped = false;
		return m;
	}, []);
	mat.opacity = 0.75 * fade;
	if (k <= 0 || fade <= 0) return null;
	return (
		<group position={[0, STAGE_TOP + 2, 0]}>
			<mesh material={mat} position={[0, h / 2, 0]} renderOrder={12}>
				<cylinderGeometry args={[2.0, 2.8, Math.max(h, 0.1), 32, 1, true]} />
			</mesh>
			<mesh material={mat} position={[0, h / 2, 0]} renderOrder={12}>
				<cylinderGeometry args={[0.9, 1.2, Math.max(h, 0.1), 24, 1, true]} />
			</mesh>
		</group>
	);
};
const S28: React.FC<SceneProps> = ({f}) => {
	const cB = W(28, 251) - 3; // "He sat down"
	const cC = W(28, 254) - 3; // "pressed the button"
	const cD = W(28, 257) - 3; // "WHOOSH"
	const shot = shotIndex(f, [cB, cC, cD]);
	const t = f / 30;
	const press = keys(f, [[W(28, 256) - 4, 0], [W(28, 256) + 2, 1], [cD + 30, 1]], easeOut);
	const throne = (glow: number) => <GoldenThrone frame={f} position={THRONE_AT} glow={glow} press={press} />;
	if (shot === 0) {
		const k = clamp(f / cB);
		const gp: V3 = [lerp(3.4, 0.9, k), STAGE_TOP, lerp(3.4, 1.6, k)];
		return (
			<Stage look={DUSK} focus={[0, 0, 4]} shadowSize={20}>
				<TownSquare lit="night" />
				<Crowd t={t} mood="watch" />
				{throne(1)}
				<Character spec={GRANDPA} position={gp} rotation={Math.atan2(-gp[0], -gp[2])} pose={P.walk(t, 0.75, 0.7)} expr="happy" />
				<CameraRig pos={[lerp(-6, -5, k), 5.5, lerp(17, 15, k)]} target={[0.8, 3.4, 1]} fov={50} sway={0.8} />
			</Stage>
		);
	}
	if (shot === 1) {
		const fs = f - cB;
		const k = easeOut(clamp(fs / 25));
		return (
			<Stage look={DUSK} focus={[0, 0, 2]} shadowSize={12}>
				<TownSquare lit="night" />
				<Crowd t={t} mood="awe" />
				{throne(1)}
				<Character spec={GRANDPA} position={GP_SIT} rotation={0} pose={P.withPose(P.sit(t, 1, 0), {armL: [-0.5, 0, 0.15], armR: [-0.5, 0, -0.15]})} expr="happy" face={{eyes: 'closed', mouth: 'smile'}} />
				<CameraRig pos={[lerp(2.5, 1.6, k), STAGE_TOP + 4.2, lerp(9, 7.4, k)]} target={[0, STAGE_TOP + 3.6, 0]} fov={46} sway={0.6} />
			</Stage>
		);
	}
	if (shot === 2) {
		const fs = f - cC;
		const handY = keys(f, [[cC, 1.4], [W(28, 256) - 4, 1.0], [W(28, 256) + 2, 0.35]], easeInOut);
		const by = STAGE_TOP + 3.0;
		const bz = -1.12;
		return (
			<Stage look={DUSK} focus={[0, 3, 0]} shadowSize={6}>
				<TownSquare lit="night" />
				{throne(1.2)}
				<group position={[0.15, by + handY, bz + 0.25]} rotation={[0.25, 0, 0.15]}>
					<mesh geometry={rbox(0.9, 0.75, 0.9, 0.12)} material={plastic(GRANDPA.skin, {rough: 0.45})} position={[0, 0.38, 0]} castShadow />
					<mesh geometry={rbox(1.0, 1.9, 1.0, 0.12)} material={plastic(GRANDPA.top, {rough: 0.5})} position={[0, 1.7, 0]} castShadow />
				</group>
				<CameraRig pos={[-1.6, by + 1.0, bz + 2.8]} target={[0, by + 0.3, bz]} fov={46} sway={0.5} />
			</Stage>
		);
	}
	const fs = f - cD;
	const k = clamp(fs / 40);
	return (
		<Stage look={DUSK} focus={[0, 0, 4]} shadowSize={20}>
			<TownSquare lit="night" />
			<Crowd t={t} mood="awe" />
			{throne(2)}
			<Character spec={GRANDPA} position={GP_SIT} rotation={0} pose={P.withPose(P.sit(t, 1, 0), {armL: [-0.5, 0, 0.15], armR: [-0.5, 0, -0.15], head: [-0.25, 0, 0]})} expr="happy" face={{eyes: 'closed', mouth: 'bigSmile'}} />
			<LightColumn k={k + 0.05} />
			<MagicSwirl k={k} position={[0, STAGE_TOP + 1, 0]} radius={3} height={14} count={240} />
			<pointLight position={[0, STAGE_TOP + 6, 2]} intensity={60} distance={40} color="#ffd24a" />
			<CameraRig pos={[2.5, 1.4, 16]} target={[0, 9, 0]} fov={56} sway={0.6} shake={0.4} />
		</Stage>
	);
};

// ===================================================================== S29
// "Nobody said anything. Then Grandpa started crying. Then EVERYONE started crying."
const S29: React.FC<SceneProps> = ({f}) => {
	const cB = W(29, 261) - 3; // "Then Grandpa started crying"
	const cC = W(29, 265) - 3; // "Then EVERYONE started crying"
	const shot = shotIndex(f, [cB, cC]);
	const t = f / 30;
	const throne = <GoldenThrone frame={f} position={THRONE_AT} glow={0.9} />;
	const gpSit = (expr: any, pose?: P.Pose) => <Character spec={GRANDPA} position={GP_SIT} rotation={0} pose={pose ?? P.withPose(P.sit(t, 1, 0), {armL: [-0.5, 0, 0.15], armR: [-0.5, 0, -0.15]})} expr={expr} />;
	if (shot === 0) {
		const k = easeInOut(clamp(f / cB));
		return (
			<Stage look={DUSK} focus={[0, 0, 4]} shadowSize={24}>
				<TownSquare lit="night" />
				<Crowd t={0} mood="silent" />
				{throne}
				{gpSit('neutral')}
				<CameraRig pos={[0.5, lerp(9, 8, k), lerp(-12, -10.5, k)]} target={[0, 2.5, 8]} fov={54} sway={0.3} />
			</Stage>
		);
	}
	if (shot === 1) {
		const fs = f - cB;
		const k = easeOut(clamp(fs / 50));
		return (
			<Stage look={DUSK} focus={[0, 0, 0]} shadowSize={10}>
				<TownSquare lit="night" />
				<Crowd t={t} mood="silent" />
				{throne}
				{gpSit('crying', P.withPose(P.sit(t, 1, 0), {armL: [-0.5, 0, 0.15], armR: [-0.5, 0, -0.15], head: [-0.1, 0, Math.sin(t * 3) * 0.06], y: Math.abs(Math.sin(t * 7)) * 0.05}))}
				<CameraRig pos={[0.6, STAGE_TOP + 4.6, lerp(5.6, 4.6, k)]} target={[0, STAGE_TOP + 4.2, 0]} fov={44} sway={0.6} />
			</Stage>
		);
	}
	const fs = f - cC;
	const k = easeInOut(clamp(fs / 90));
	return (
		<Stage look={DUSK} focus={[0, 0, 6]} shadowSize={24}>
			<TownSquare lit="night" />
			<Crowd t={t} mood="cry" />
			{throne}
			{gpSit('crying')}
			<CameraRig pos={[lerp(-6, -9, k), lerp(5, 11, k), lerp(20, 26, k)]} target={[0, 2.5, 6]} fov={50} sway={0.6} />
		</Stage>
	);
};

// ===================================================================== S30
// "Oh, and the castle basement? It had a thousand more."
const S30: React.FC<SceneProps> = ({f}) => {
	const cut = W(30, 274) - 3; // "It had a thousand more"
	const shot = shotIndex(f, [cut]);
	const look: Look = {...LOOKS.castle, hemi: 0.55, ambient: 0.14, fog: '#2a1a10', fogNear: 30, fogFar: 140, hemiSky: '#ffcf8a'};
	if (shot === 0) {
		const k = easeInOut(clamp(f / cut));
		return (
			<Stage look={look} sky={false} focus={[0, 0, 0]} shadowSize={20}>
				<Basement frame={f} />
				{/* front wall with the doorway */}
				<mesh geometry={box(17, 16, 1)} material={plastic('#4a403a', {rough: 0.9})} position={[-13.5, 8, 13]} />
				<mesh geometry={box(17, 16, 1)} material={plastic('#4a403a', {rough: 0.9})} position={[13.5, 8, 13]} />
				<mesh geometry={box(10, 6, 1)} material={plastic('#4a403a', {rough: 0.9})} position={[0, 13, 13]} />
				<Torch position={[-5.6, 6, 13.6]} frame={f} light />
				<Torch position={[5.6, 6, 13.6]} frame={f} seed={4} />
				<Dust frame={f} count={120} box={[12, 9, 8]} position={[0, 0, 15]} color="#ffd890" size={0.1} />
				<CameraRig pos={[0.3, lerp(4.2, 5.2, k), lerp(26, 17, k)]} target={[0, 4.2, 0]} fov={52} sway={0.6} />
			</Stage>
		);
	}
	const fs = f - cut;
	const k = easeInOut(clamp(fs / 57));
	return (
		<Stage look={look} sky={false} focus={[0, 0, lerp(0, -40, k)]} shadowSize={30}>
			<Basement frame={f} />
			<CameraRig pos={[lerp(-3, 3, k), lerp(11, 8, k), lerp(10, -30, k)]} target={[0, 0.5, lerp(-14, -60, k)]} fov={56} sway={0.4} />
		</Stage>
	);
};

// ===================================================================== S31
// "Now every house has a Golden Throne. The Bucket Man runs a toilet shop."
const S31: React.FC<SceneProps> = ({f}) => {
	const cut = W(31, 286) - 3; // "The Bucket Man runs a toilet shop"
	const shot = shotIndex(f, [cut]);
	const t = f / 30;
	if (shot === 0) {
		const k = easeInOut(clamp(f / cut));
		return (
			<Stage look={LOOKS.night} focus={[0, 0, -10]} shadowSize={40}>
				<TownStreet lit="gold" lights zFrom={40} zTo={-110} />
				<ClockTower position={[0, 0, -150]} lit="night" />
				<Stars />
				<SkyDisc position={[90, 120, -260]} size={7} color="#e8eeff" intensity={1.6} />
				<CameraRig pos={[lerp(-2, 2, k), lerp(15, 11, k), lerp(52, 34, k)]} target={[0, 4, -20]} fov={52} sway={0.5} />
			</Stage>
		);
	}
	const fs = f - cut;
	const k = easeOut(clamp(fs / 50));
	return (
		<Stage look={{...LOOKS.interiorDay, sunDir: [0.3, 0.8, 0.5]}} sky={false} fog={false} focus={[0, 0, -8]} shadowSize={18}>
			<ToiletShop />
			<Character spec={BUCKET_MAN} position={[0, 0, -13.6]} rotation={0} pose={P.withPose(P.idle(t), {armR: [-2.6 + Math.sin(t * 8) * 0.25, 0, -0.5], armL: [-0.6, 0, 0.25]})} expr="bigSmile" />
			<CameraRig pos={[lerp(1.6, 0.8, k), 6.2, lerp(21, 17, k)]} target={[0, 7.2, -13]} fov={48} sway={0.6} />
		</Stage>
	);
};

// ===================================================================== S32
// "And the kids don't call me Weird Bucket Boy anymore. They call me... the Flush King."
const kidHip = (KID.legH ?? 2) * KID.scale;
const KING_POS: V3 = [0, STAGE_TOP + 1.5, 0.05];
const S32: React.FC<SceneProps> = ({f, dur}) => {
	const cB = W(32, 303) - 3; // "They call me..."
	const cC = W(32, 307) - 3; // "the Flush King"
	const shot = shotIndex(f, [cB, cC]);
	const t = f / 30;
	const throne = <GoldenThrone frame={f} position={THRONE_AT} glow={1.2} lidOpen={0} />;
	const king = (
		<Character
			spec={KID}
			position={KING_POS}
			rotation={0}
			pose={shot === 2 ? P.cheer(t) : P.withPose(P.idle(t), {armL: [0.2, 0, 0.75], armR: [0.2, 0, -0.75], head: [-0.1, 0, 0]})}
			expr={shot === 2 ? 'bigSmile' : 'proud'}
			crown
			cape="#d62839"
			capeSwing={Math.sin(t * 2.2) * 0.08 + 0.05}
		/>
	);
	if (shot === 0) {
		const k = easeOut(clamp(f / cB));
		// the classmates, now cheering in awe
		return (
			<Stage look={DUSK} focus={[0, 0, 8]} shadowSize={18}>
				<TownSquare lit="night" />
				<Crowd t={t} mood="awe" />
				{throne}
				{king}
				{CLASS_KIDS.slice(0, 6).map((s, i) => {
					const x = (i - 2.5) * 2.0;
					const z = 6.2 + (i % 2) * 1.2;
					return <Character key={'ck' + i} spec={s} position={[x, 0, z]} rotation={Math.PI + x * 0.05} pose={i % 2 ? P.clap(t, i) : P.cheer(t, i)} expr={i % 3 === 0 ? 'awe' : 'excited'} />;
				})}
				<CameraRig pos={[lerp(1.5, 1.0, k), 2.2, lerp(-1.0, 0.5, k)]} target={[0, 3.6, 8]} fov={56} sway={0.7} />
			</Stage>
		);
	}
	if (shot === 1) {
		const fs = f - cB;
		const k = easeOut(clamp(fs / 34));
		return (
			<Stage look={DUSK} focus={[0, 0, 0]} shadowSize={12}>
				<TownSquare lit="night" />
				<Crowd t={t} mood="awe" />
				{throne}
				{king}
				<LightRays frame={f} position={[0, 7, -3]} size={26} opacity={0.35} />
				<CameraRig pos={[lerp(1.8, 1.0, k), 1.4, lerp(7.5, 6.0, k)]} target={[0, 5.4, 0]} fov={52} sway={0.5} />
			</Stage>
		);
	}
	const fs = f - cC;
	const k = easeInOut(clamp(fs / 70));
	return (
		<Stage look={DUSK} focus={[0, 0, 4]} shadowSize={26}>
			<TownSquare lit="night" />
			<Crowd t={t} mood="cheer" />
			{throne}
			{king}
			<Confetti frame={f} start={cC - 2} count={320} area={[30, 22, 26]} position={[0, 0, 2]} />
			<LightRays frame={f} position={[0, 7, -3]} size={30} opacity={0.4} />
			<CameraRig pos={[lerp(2, 4, k), lerp(4, 9, k), lerp(11, 21, k)]} target={[0, lerp(5.5, 4, k), 0]} fov={52} sway={0.6} />
		</Stage>
	);
};
registerWhip(wf(269) - LEAD, 1); // S29 -> S30
registerWhip(wf(303) - LEAD - 0, -1); // "They call me..." reveal

export const RETURN_SCENES: SceneDef[] = [
	{Comp: S25, post: () => ({bloom: 0.6, threshold: 0.85})},
	{Comp: S26, post: () => ({bloom: 0.6, threshold: 0.85})},
	{Comp: S27, post: () => ({bloom: 0.9, threshold: 0.8, vignette: 0.4})},
	{Comp: S28, post: (f) => ({bloom: f >= W(28, 257) - 3 ? 1.3 : 0.9, threshold: 0.8, vignette: 0.4}), overlay: flash(W(28, 257) - 2, 10)},
	{Comp: S29, post: () => ({bloom: 0.9, threshold: 0.8, vignette: 0.42})},
	{Comp: S30, post: () => ({bloom: 1.0, threshold: 0.78, vignette: 0.5})},
	{Comp: S31, post: (f) => (f < W(31, 286) - 3 ? {bloom: 1.2, threshold: 0.75, vignette: 0.4} : {bloom: 0.55, threshold: 0.88})},
	{Comp: S32, post: () => ({bloom: 1.0, threshold: 0.8, vignette: 0.4})},
];
