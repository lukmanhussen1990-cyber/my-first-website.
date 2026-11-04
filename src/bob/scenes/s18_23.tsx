// Scenes 18-23: the yellow scarf, colour spreads through the whole town, new names, Grandpa keeps Bob.
import React from 'react';
import {Stage} from '../../lib/Stage';
import {CameraRig} from '../../lib/CameraRig';
import {Character, CharSpec} from '../../characters/Character';
import * as P from '../../characters/poses';
import {BobCrowd, BobInst} from '../BobCrowd';
import {Dog} from '../Dog';
import {BOB, BOB_KID, ME, GRANDPA_BOB, SHY_GIRL, BRIGHT_SHIRTS, BRIGHT_PANTS, BRIGHT_HAIR, BOB_SHIRT, BOB_PANTS, BOB_HAIR, BOB_SHOES} from '../cast';
import {robotWalk, ROBOT_SPEED, freeMove} from '../moves';
import {LOOK_GREY, townLook, TownSquareBob, BobHouse, mix, Shop} from '../world';
import {Classroom, seat, DESK_X, DESK_Z, ME_SEAT} from '../rooms';
import {WildHat, Scarf, NameTag, Marker, Splash} from '../props';
import {oldPerson} from '../oldtown';
import {Confetti, Sparkles, GlowPoints} from '../../props/Effects';
import {WalkingStick} from '../../props/HandProps';
import {StreetSet, walkerGrid, cam} from './common';
import {SceneDef, SceneProps} from '../kit';
import {W, shotIndex, amp, speaking, wf} from '../timing';
import {V3, clamp, lerp, easeInOut, easeOut, easeOutBack} from '../../lib/anim';
import {hash, pick} from '../../lib/random';
import {plastic, rbox} from '../../lib/materials';
import {Table} from '../../birthday/props/Things';

const SCHOOL_LOOK = {...LOOK_GREY, sunDir: [-0.7, 0.6, 0.3] as [number, number, number], sun: 2.0, hemi: 1.0, ambient: 0.3};
const DOOR: V3 = [10, 0, 14.6];
const sitP = (t: number) => P.withPose(P.sit(t, 0, 0), {armL: [-1.2, 0, -0.12], armR: [-1.2, 0, 0.12]});
const seatedKids = (): BobInst[] =>
	DESK_X.flatMap((x, c) => DESK_Z.map((z, r) => ({c, r})))
		.filter((s) => !(s.c === ME_SEAT.c && s.r === ME_SEAT.r))
		.map((s) => ({pos: seat(s.c, s.r), yaw: Math.PI}));

/** bright colours for Bob i, mixed in by k */
const brightOf = (i: number, k: number) => ({
	shirt: mix(BOB_SHIRT, pick(BRIGHT_SHIRTS, i, 21), k),
	pants: mix(BOB_PANTS, pick(BRIGHT_PANTS, i, 22), k),
	hair: mix(BOB_HAIR, pick(BRIGHT_HAIR, i, 23), k),
	shoes: mix(BOB_SHOES, pick(['#f7f7f7', '#ff3b5c', '#2f80ff', '#ffcc00', '#2a2a2a'], i, 24), k),
});
/** a little burst of colour where someone changes */
const Pops: React.FC<{f: number; spots: {p: V3; at: number; color: string}[]}> = ({f, spots}) => (
	<GlowPoints
		count={spots.length * 14}
		tex="star"
		color="#ffffff"
		fn={(i) => {
			const s = spots[Math.floor(i / 14)];
			const j = i % 14;
			const a = (f - s.at) / 30;
			if (a < 0 || a > 0.7) return [0, -99, 0, 0, 0];
			const ang = (j / 14) * Math.PI * 2;
			const r = 0.6 + a * 4;
			return [s.p[0] + Math.cos(ang) * r, s.p[1] + 3.6 + Math.sin(ang) * r * 0.8, s.p[2] + Math.sin(ang * 2) * 0.3, 0.5 - a * 0.5, 1 - a / 0.7];
		}}
	/>
);

// ===================================================================== S18
// "But the day after, one girl came to school wearing a yellow scarf."
const S18: React.FC<SceneProps> = ({f, g}) => {
	const cB = W(18, 203) - 4; // one girl
	const shot = shotIndex(f, [cB]);
	const t = f / 30;
	const kids = seatedKids();
	if (shot === 0) {
		const k = easeInOut(clamp(f / cB));
		return (
			<Stage look={SCHOOL_LOOK} sky={false} fog={false} focus={[0, 0, 6]} shadowSize={14}>
				<Classroom />
				<BobCrowd spec={BOB_KID} people={kids} pose={() => sitP(t)} />
				<Character spec={ME} position={seat(ME_SEAT.c, ME_SEAT.r)} rotation={Math.PI} pose={sitP(t + 1)} expr="lonely" headExtra={<WildHat t={t} />} />
				<CameraRig pos={[lerp(6.6, 6.2, k), lerp(4.6, 4.4, k), lerp(7.2, 8.0, k)]} target={[seat(ME_SEAT.c, ME_SEAT.r)[0], 3.9, seat(ME_SEAT.c, ME_SEAT.r)[2]]} fov={38} sway={0.3} />
			</Stage>
		);
	}
	// the shy girl Bob walks in with a yellow scarf: a little pop of colour
	const fs = f - cB;
	const popAt = W(18, 210) - cB; // "yellow"
	const walkK = clamp(fs / 50);
	const gp: V3 = [DOOR[0] - 0.4, 0, DOOR[2] - 0.6 - walkK * 2.4];
	const k = easeInOut(clamp(fs / 80));
	return (
		<Stage look={SCHOOL_LOOK} sky={false} fog={false} focus={[6, 0, 10]} shadowSize={12}>
			<Classroom />
			<BobCrowd spec={BOB_KID} people={kids} pose={() => sitP(t)} />
			<Character spec={ME} position={seat(ME_SEAT.c, ME_SEAT.r)} rotation={Math.PI - 0.8} pose={sitP(t + 1)} expr={fs > popAt + 6 ? 'bigSmile' : 'curious'} headExtra={<WildHat t={t} />} />
			<Character spec={SHY_GIRL} position={gp} rotation={Math.PI - 0.5} pose={walkK < 1 ? P.walk(t, 0.55, 0.55) : P.withPose(P.idle(t, 4), {armL: [-0.5, 0, -0.25], armR: [-0.5, 0, 0.25]})} expr="shy" chestItem={fs >= popAt ? <Scarf t={t} /> : undefined} />
			{fs >= popAt - 1 ? <Sparkles frame={f} count={26} radius={1.4} height={2} position={[gp[0], 3.0, gp[2]]} color="#ffe14a" size={0.6} /> : null}
			<Pops f={fs} spots={[{p: gp, at: popAt, color: '#ffd21f'}]} />
			<CameraRig pos={[gp[0] - lerp(3.6, 3.0, k), lerp(4.0, 3.9, k), gp[2] - lerp(5.6, 4.6, k)]} target={[gp[0], 3.4, gp[2]]} fov={38} sway={0.3} />
		</Stage>
	);
};

// ===================================================================== S19
// "Then 10 people changed, then 100, then the whole town."
const TEN: BobInst[] = Array.from({length: 10}).map((_, i) => ({pos: [(i - 4.5) * 2.8, 0, 6 + (i % 2) * 1.6] as V3, yaw: 0}));
const HUNDRED: BobInst[] = (() => {
	const out: BobInst[] = [];
	for (let r = 0; r < 9; r++) for (let c = 0; c < 12; c++) out.push({pos: [(c - 5.5) * 2.9 + (r % 2) * 0.4, 0, 2 + r * 3.0] as V3, yaw: Math.PI});
	return out;
})();
const S19: React.FC<SceneProps> = ({f, g}) => {
	const cB = W(19, 216) - 4; // then 100
	const cC = W(19, 218) - 4; // then the whole town
	const shot = shotIndex(f, [cB, cC]);
	const t = f / 30;
	if (shot === 0) {
		const at = (i: number) => 8 + ((i * 3) % 10) * 3.4;
		const kOf = (i: number) => easeOut(clamp((f - at(i)) / 5));
		const k = easeInOut(clamp(f / cB));
		return (
			<StreetSet focus={[0, 0, 6]} shadow={16} zFrom={10} zTo={-60}>
				<Shop name="BOB SCHOOL" position={[0, 0, -6]} rotation={0} k={0} seed={3} />
				<BobCrowd spec={BOB_KID} people={TEN} pose={(i) => (kOf(i) > 0.5 ? P.jumpJoy(t + i * 0.13, i) : P.idle(t, 0))} colorsOf={(i) => brightOf(i, kOf(i))} faces={['bob', 'bigSmile']} faceOf={(i) => (kOf(i) > 0.5 ? 1 : 0)} />
				<Pops f={f} spots={TEN.map((p, i) => ({p: p.pos, at: at(i), color: '#fff'}))} />
				<CameraRig pos={[lerp(-2, 1, k), 4.4, lerp(19, 17, k)]} target={[0, 3.0, 6]} fov={44} sway={0.4} />
			</StreetSet>
		);
	}
	if (shot === 1) {
		const fs = f - cB;
		const at = (i: number) => {
			const p = HUNDRED[i].pos;
			return 2 + Math.hypot(p[0], p[2] - 12) * 1.1 + hash(i, 4) * 6;
		};
		const kOf = (i: number) => easeOut(clamp((fs - at(i)) / 5));
		const k = easeInOut(clamp(fs / (cC - cB)));
		return (
			<Stage look={townLook(clamp(fs / 40) * 0.4)} focus={[0, 0, 10]} shadowSize={26}>
				<TownSquareBob k={0} hour={9} minute={10} />
				<BobCrowd spec={BOB} people={HUNDRED} pose={(i) => (kOf(i) > 0.5 ? P.cheer(t + i * 0.07, i) : P.idle(t, 0))} colorsOf={(i) => brightOf(i, kOf(i))} faces={['bob', 'happy', 'bigSmile']} faceOf={(i) => (kOf(i) > 0.5 ? 1 + (i % 2) : 0)} />
				<CameraRig pos={[lerp(-6, -3, k), lerp(16, 14, k), lerp(-10, -8, k)]} target={[0, 2, 14]} fov={48} sway={0.4} />
			</Stage>
		);
	}
	// the whole town: a wave of colour runs down the street
	const fs = f - cC;
	const front = 40 - fs * 4.2; // z of the wave front
	const field = (x: number, z: number) => clamp((z - front) / 10 + 0.5);
	const kSky = clamp(fs / 48);
	const pose = (i: number) => freeMove(t, i);
	const walkers = walkerGrid([-7.4, -5.0, -2.5, 2.5, 5.0, 7.4], 20, -140, 8.5, -1);
	const kAt = (i: number) => field(walkers[i].pos[0], walkers[i].pos[2]);
	return (
		<StreetSet k={kSky} color={field} focus={[0, 0, front]} shadow={30}>
			<BobCrowd spec={BOB} people={walkers} pose={(i) => (kAt(i) > 0.5 ? pose(i) : robotWalk(t))} colorsOf={(i) => brightOf(i + 7, kAt(i))} faces={['bob', 'happy', 'laugh']} faceOf={(i) => (kAt(i) > 0.5 ? 1 + (i % 2) : 0)} />
			{Array.from({length: 8}).map((_, i) => (
				<Splash key={i} color={pick(['#ff4d6d', '#ffd23f', '#3ad1ff', '#7cff6b', '#c77dff', '#ff9e3d'], i, 3)} k={clamp((40 - i * 12 - front) / 6)} size={4 + hash(i, 2) * 2} seed={i + 3} position={[(i % 2 ? 1 : -1) * 12.9, 4 + hash(i, 5) * 3, 40 - i * 12]} rotation={[0, (i % 2 ? -1 : 1) * Math.PI / 2, 0]} />
			))}
			<CameraRig pos={[0, lerp(18, 22, kSky), front + 26]} target={[0, 2, front - 8]} fov={50} sway={0.4} />
		</StreetSet>
	);
};

// ===================================================================== S20
// "Red shirts, blue hair, purple houses, nobody walked the same anymore."
const S20: React.FC<SceneProps> = ({f, g}) => {
	const cB = W(20, 224) - 4; // blue hair
	const cC = W(20, 226) - 4; // purple houses
	const cD = W(20, 228) - 4; // nobody walked the same anymore
	const shot = shotIndex(f, [cB, cC, cD]);
	const t = f / 30;
	const colourful = (i: number) => brightOf(i + 3, 1);
	if (shot === 0 || shot === 1) {
		// close-ups: red shirts, then blue hair
		const red = shot === 0;
		const people: BobInst[] = Array.from({length: 5}).map((_, i) => ({pos: [(i - 2) * 2.7, 0.3, 7] as V3, yaw: 0}));
		const fs = f - (red ? 0 : cB);
		const k = easeOut(clamp(fs / 22));
		return (
			<StreetSet k={1} focus={[0, 0, 7]} shadow={12} zFrom={10} zTo={-60}>
				<BobCrowd spec={BOB} people={people} pose={(i) => freeMove(t, i + (red ? 2 : 4))} colorsOf={(i) => ({...colourful(i), shirt: red ? ['#ff2d3c', '#e8212e', '#ff4d5e', '#d61c2a', '#ff3b4a'][i] : colourful(i).shirt, hair: red ? colourful(i).hair : ['#2f80ff', '#1f6bff', '#3b9cff', '#2468e8', '#4aa8ff'][i]})} faces={['happy', 'laugh', 'bigSmile']} faceOf={(i) => i % 3} />
				<CameraRig pos={[lerp(-2, 1, k), red ? 3.9 : 5.6, red ? 16 : 12]} target={[lerp(-1, 0.5, k), red ? 3.4 : 5.2, 7]} fov={red ? 40 : 36} sway={0.3} />
			</StreetSet>
		);
	}
	if (shot === 2) {
		// purple houses
		const fs = f - cC;
		const k = easeOut(clamp(fs / 22));
		return (
			<StreetSet k={1} zFrom={30} zTo={-80} focus={[0, 0, 0]} shadow={16}>
				<BobHouse position={[0, 0, -2]} k={1} seed={8} mailbox={false} />
				<Splash color="#9b4dff" k={k} size={9} seed={11} position={[0, 7, 2.1]} />
				<CameraRig pos={[lerp(-3, 1, k), lerp(6, 5, k), 20]} target={[0, 7, -2]} fov={40} sway={0.3} />
			</StreetSet>
		);
	}
	// everyone walks their own way
	const fs = f - cD;
	const people = walkerGrid([-7.4, -5.0, -2.5, 2.5, 5.0, 7.4], 9, 14, 5.2, 1).map((p, i) => ({...p, yaw: hash(i, 3) * Math.PI * 2, pos: [p.pos[0] + Math.sin(t * (0.5 + hash(i, 5)) + i) * 1.5, p.pos[1], p.pos[2] + Math.cos(t * 0.7 + i) * 1.2] as V3}));
	const k = easeInOut(clamp(fs / 69));
	return (
		<StreetSet k={1} focus={[0, 0, 0]} shadow={24}>
			<BobCrowd spec={BOB} people={people} pose={(i) => freeMove(t, i)} colorsOf={(i) => brightOf(i, 1)} faces={['happy', 'laugh', 'bigSmile']} faceOf={(i) => i % 3} />
			<CameraRig pos={[lerp(3, -3, k), lerp(5, 6, k), 26]} target={[0, 3, 0]} fov={44} sway={0.4} />
		</StreetSet>
	);
};

// ===================================================================== S21 + S22: new names
const NAME_LOOK = townLook(1);
const ROSA: CharSpec = {...oldPerson(21, [0, 0, 0], 0).spec, name: 'rosa', hair: 'ponytail', hairColor: '#ff3d8a', outfit: 'dress', top: '#ffb000', pants: '#f1c193', skin: '#f1c193', face: {lashes: true}};
const MAX: CharSpec = {...oldPerson(22, [0, 0, 0], 0).spec, name: 'max', hair: 'spiky', hairColor: '#2f80ff', outfit: 'hoodie', top: '#2ec27e', pants: '#2b3f8f'};
const CAPTAIN: CharSpec = {...oldPerson(23, [0, 0, 0], 0).spec, name: 'captain', hair: 'curly', hairColor: '#e8e8e8', outfit: 'overalls', top: '#8f4dff', top2: '#ffe14a', pants: '#8f4dff', glasses: 'round'};
const CaptainHat: React.FC = () => (
	<group position={[0, 1.08, 0]}>
		<mesh geometry={rbox(1.5, 0.55, 1.4, 0.2)} material={plastic('#1d2a5a', {rough: 0.5})} castShadow />
		<mesh geometry={rbox(1.0, 0.08, 0.6, 0.03)} material={plastic('#121a3a')} position={[0, -0.22, 0.75]} rotation={[0.25, 0, 0]} />
		<mesh geometry={rbox(0.36, 0.3, 0.06, 0.03)} material={plastic('#ffd21f', {metal: 0.8, rough: 0.3})} position={[0, 0.05, 0.66]} />
	</group>
);
const Tagged: React.FC<{spec: CharSpec; name: string; written: number; t: number; extra?: React.ReactNode; pose?: P.Pose}> = ({spec, name, written, t, extra, pose}) => (
	<Character spec={spec} position={[0, 0, 0]} rotation={0} pose={pose ?? P.withPose(P.idle(t, 3), {lean: -0.04})} expr={written > 0.9 ? 'bigSmile' : 'happy'} chestItem={<group position={[0.35, 0, 0.04]}><NameTag name={name} written={written} scale={0.9} /></group>} headExtra={extra} />
);
const S21: React.FC<SceneProps> = ({f, g}) => {
	const cB = W(21, 239) - 4; // Rosa
	const cC = W(21, 240) - 4; // Max
	const cD = W(21, 241) - 4; // Captain Sparkles
	const cE = W(21, 243) - 4; // My dog picked Pickles
	const shot = shotIndex(f, [cB, cC, cD, cE]);
	const t = f / 30;
	const write = (start: number) => easeInOut(clamp((f - start - 2) / 14));
	if (shot === 0) {
		// the name-tag table in the square, everyone in line
		const k = easeInOut(clamp(f / cB));
		const line: BobInst[] = Array.from({length: 14}).map((_, i) => ({pos: [-2 + (i % 2) * 1.4, 0, 6 + i * 2.2] as V3, yaw: Math.PI}));
		return (
			<Stage look={NAME_LOOK} focus={[0, 0, 6]} shadowSize={18}>
				<TownSquareBob k={1} hour={10} minute={0} shopNames={['TOY SHOP', 'CAFE LUNA', 'ROSA BAKES', 'SCHOOL', 'HAT HAVEN', 'PICKLE POPS']} />
				<group position={[0, 0, 2]}>
					<Table w={6} d={2.4} h={2.3} cloth="#ffffff" />
					{[-2, -1, 0, 1, 2].map((x) => (
						<group key={x} position={[x, 2.34, 0.3]} rotation={[-Math.PI / 2, 0, 0.1 * x]}>
							<NameTag name="" scale={0.85} />
						</group>
					))}
					<group position={[1.4, 2.4, -0.2]} rotation={[0, 0, 1.4]}>
						<Marker />
					</group>
				</group>
				<BobCrowd spec={BOB} people={line} pose={(i) => P.idle(t, i)} colorsOf={(i) => brightOf(i + 11, 1)} faces={['happy', 'bigSmile']} faceOf={(i) => i % 2} />
				<CameraRig pos={[lerp(2.2, 1.6, k), lerp(7.2, 6.4, k), lerp(-1.8, -1.0, k)]} target={[0.2, 2.3, 2.4]} fov={44} sway={0.3} />
			</Stage>
		);
	}
	const closeUp = (spec: CharSpec, name: string, start: number, extra?: React.ReactNode, sparkle?: boolean) => {
		const fs = f - start;
		const k = easeOut(clamp(fs / 20));
		return (
			<Stage look={NAME_LOOK} focus={[0, 0, 0]} shadowSize={8}>
				<TownSquareBob k={1} hour={10} minute={0} />
				<group position={[0, 0, 6]}>
					<Tagged spec={spec} name={name} written={write(start)} t={t} extra={extra} />
					{sparkle ? <Sparkles frame={f} count={40} radius={2.2} height={5} color="#ffe14a" size={0.6} /> : null}
				</group>
				<CameraRig pos={[lerp(1.0, 0.7, k), 3.9 * spec.scale, 6 + lerp(6.6, 5.8, k)]} target={[0.15, 3.75 * spec.scale, 6]} fov={42} sway={0.25} />
			</Stage>
		);
	};
	if (shot === 1) return closeUp(ROSA, 'Rosa', cB);
	if (shot === 2) return closeUp(MAX, 'Max', cC);
	if (shot === 3) return closeUp(CAPTAIN, 'Captain Sparkles', cD, <CaptainHat />, true);
	// Pickles!
	const fs = f - cE;
	const k = easeOut(clamp(fs / 30));
	return (
		<Stage look={NAME_LOOK} focus={[0, 0, 6]} shadowSize={8}>
			<TownSquareBob k={1} hour={10} minute={0} />
			<Dog position={[0, 0, 6]} rotation={0} expr="bigSmile" wag={2} shirt="#2ec27e" hair="#7a5a3e" tag={<group position={[0, 0, 0.02]}><NameTag name="Pickles" written={easeInOut(clamp((fs - 4) / 14))} scale={0.62} /></group>} headTilt={Math.sin(t * 3) * 0.15} />
			<Sparkles frame={f} count={20} radius={1.6} height={3} position={[0, 0.5, 6]} color="#9dff8a" size={0.5} />
			<CameraRig pos={[lerp(1.2, 0.8, k), 2.0, 6 + lerp(6.2, 5.0, k)]} target={[0, 1.7, 6.5]} fov={36} sway={0.25} />
		</Stage>
	);
};

const GP_SPOT: V3 = [0, 0, 6];
const crowdAround = (): BobInst[] => Array.from({length: 18}).map((_, i) => {
	const a = Math.PI + ((i / 17) - 0.5) * Math.PI * 1.1;
	const r = 5 + (i % 3) * 2.4;
	return {pos: [Math.sin(a) * r, 0, GP_SPOT[2] + Math.cos(a) * r] as V3, yaw: a + Math.PI};
});
/** Grandpa's name tag: BOB, written by hand */
const GrandpaTag: React.FC<{tap?: number}> = ({tap = 0}) => (
	<group position={[0.4, 0, 0.05]} rotation={[0, 0, -0.05]} scale={1 + tap * 0.06}>
		<NameTag name="Bob" written={1} scale={0.95} />
	</group>
);
const S22: React.FC<SceneProps> = ({f, g, dur}) => {
	const t = f / 30;
	const k = easeInOut(clamp(f / dur));
	return (
		<Stage look={NAME_LOOK} focus={GP_SPOT} shadowSize={14}>
			<TownSquareBob k={1} hour={10} minute={0} shopNames={['TOY SHOP', 'CAFE LUNA', 'ROSA BAKES', 'SCHOOL', 'HAT HAVEN', 'PICKLE POPS']} />
			<BobCrowd spec={BOB} people={crowdAround()} pose={(i) => freeMove(t, i + 5)} colorsOf={(i) => brightOf(i + 20, 1)} faces={['happy', 'bigSmile']} faceOf={(i) => i % 2} />
			<Character spec={GRANDPA_BOB} position={GP_SPOT} rotation={0} pose={P.withPose(P.elderIdle(t), {head: [0.42, 0, 0]})} expr="curious" look={[0, 1]} chestItem={<GrandpaTag />} holdR={<WalkingStick length={2.0} />} holdRUpright />
			<CameraRig pos={[lerp(2.4, 1.8, k), lerp(5.6, 5.2, k), GP_SPOT[2] + lerp(7.4, 6.2, k)]} target={[GP_SPOT[0], 3.4, GP_SPOT[2]]} fov={36} sway={0.3} />
		</Stage>
	);
};

// ===================================================================== S23
// "I'm keeping Bob. I actually like Bob. And you know what? That's okay too."
const S23: React.FC<SceneProps> = ({f, g}) => {
	const cB = W(23, 260) - 4; // And you know what? That's okay too.
	const shot = shotIndex(f, [cB]);
	const t = f / 30;
	if (shot === 0) {
		const k = easeInOut(clamp(f / cB));
		const talk = speaking(g, 253, 259) ? amp(g) : 0;
		const tap = Math.max(0, Math.sin(clamp((f - 30) / 14) * Math.PI));
		return (
			<Stage look={NAME_LOOK} focus={GP_SPOT} shadowSize={10}>
				<TownSquareBob k={1} hour={10} minute={1} />
				<BobCrowd spec={BOB} people={crowdAround()} pose={(i) => freeMove(t, i + 5)} colorsOf={(i) => brightOf(i + 20, 1)} faces={['happy', 'bigSmile']} faceOf={(i) => i % 2} />
				<Character spec={GRANDPA_BOB} position={GP_SPOT} rotation={0} pose={P.withPose(P.elderIdle(t), {armL: [-1.1 * tap - 0.2, 0, -0.55 * tap], head: [-0.08, 0, 0.05]})} expr={talk > 0.1 ? 'happy' : 'proud'} talk={talk} chestItem={<GrandpaTag tap={tap} />} holdR={<WalkingStick length={2.0} />} holdRUpright />
				<CameraRig pos={[lerp(1.2, 0.8, k), 4.6, GP_SPOT[2] + lerp(5.6, 4.6, k)]} target={[GP_SPOT[0], 4.0, GP_SPOT[2]]} fov={36} sway={0.25} />
			</Stage>
		);
	}
	// the whole colourful town celebrates, everyone their own way; me in my wild hat
	const fs = f - cB;
	const k = easeInOut(clamp(fs / 98));
	const crowd: BobInst[] = (() => {
		const out: BobInst[] = [];
		for (let r = 0; r < 7; r++) for (let c = 0; c < 11; c++) out.push({pos: [(c - 5) * 3.1 + (r % 2) * 1.2 + hash(r * 11 + c, 3) * 0.8, 0, -2 - r * 3.2] as V3, yaw: hash(r * 11 + c, 4) * 1.2 - 0.6});
		return out;
	})();
	return (
		<Stage look={NAME_LOOK} focus={[0, 0, 0]} shadowSize={26}>
			<TownSquareBob k={1} hour={10} minute={2} ring={clamp(fs / 40)} shopNames={['TOY SHOP', 'CAFE LUNA', 'ROSA BAKES', 'SCHOOL', 'HAT HAVEN', 'PICKLE POPS']} />
			<BobCrowd spec={BOB} people={crowd} pose={(i) => freeMove(t, i)} colorsOf={(i) => brightOf(i + 40, 1)} faces={['happy', 'laugh', 'bigSmile']} faceOf={(i) => i % 3} />
			<Character spec={ME} position={[0, 0, 7]} rotation={0} pose={P.jumpJoy(t, 1)} expr="excited" headExtra={<WildHat t={t} wobble={0.6} />} />
			<Character spec={GRANDPA_BOB} position={[-3.4, 0, 5.4]} rotation={0.3} pose={P.withPose(P.elderIdle(t), {armL: [-0.3, 0, 1.6 + Math.sin(t * 6) * 0.3]})} expr="bigSmile" chestItem={<GrandpaTag />} holdR={<WalkingStick length={2.0} />} holdRUpright />
			<Character spec={SHY_GIRL} position={[3.4, 0, 5.2]} rotation={-0.3} pose={P.cheer(t, 2)} expr="excited" chestItem={<Scarf t={t} />} />
			<Dog position={[1.6, 0, 8.6]} rotation={-0.2} expr="bigSmile" wag={2} shirt="#2ec27e" />
			<Confetti frame={g} start={wf(260) - 10} count={340} area={[30, 16, 22]} position={[0, 2, 2]} seed={6} />
			<CameraRig pos={[lerp(1.2, 0, k), lerp(3.6, 9, k), lerp(17, 26, k)]} target={[0, lerp(3.8, 4.4, k), 2]} fov={46} sway={0.4} />
		</Stage>
	);
};

export const SCENES_18_23: SceneDef[] = [
	{Comp: S18},
	{Comp: S19, post: () => ({bloom: 0.8, threshold: 0.82})},
	{Comp: S20, post: () => ({bloom: 0.8, threshold: 0.84})},
	{Comp: S21, post: () => ({bloom: 0.75, threshold: 0.84})},
	{Comp: S22},
	{Comp: S23, post: () => ({bloom: 0.85, threshold: 0.8})},
];
