// Scenes 1-6: the town of Bobs, Mom/Dad/Teacher Bob, the dog, all the same, 12 o'clock, the giant CRUNCH.
import React from 'react';
import {Stage} from '../../lib/Stage';
import {CameraRig} from '../../lib/CameraRig';
import {Character} from '../../characters/Character';
import * as P from '../../characters/poses';
import {BobCrowd, BobInst} from '../BobCrowd';
import {Dog} from '../Dog';
import {BOB, BOB_KID, bobOfHeight} from '../cast';
import {robotWalk, ROBOT_SPEED, eatPose} from '../moves';
import {TownSquareBob, BobHouse, townLook, LOOK_GREY, ClockTowerBob, CLOCK_Y, Car} from '../world';
import {Classroom} from '../rooms';
import {Sandwich} from '../props';
import {StreetSet, walkerGrid, cam} from './common';
import {SceneDef, SceneProps} from '../kit';
import {W, shotIndex, wf} from '../timing';
import {V3, clamp, lerp, easeInOut, easeOut, keys} from '../../lib/anim';
import {hash} from '../../lib/random';

const COLS = [-7.4, -5.0, -2.5, 2.5, 5.0, 7.4];

// ===================================================================== S1
// "In my town, everyone is named Bob." – the whole street walks in perfect sync; the camera pushes down the street
const S1: React.FC<SceneProps> = ({f, dur}) => {
	const t = f / 30;
	const k = easeInOut(clamp(f / dur));
	const pose = robotWalk(t);
	const people = walkerGrid(COLS, 12, 22, 4.2, 1).map((p) => ({...p, pos: [p.pos[0], p.pos[1], p.pos[2] + ROBOT_SPEED * t] as V3}));
	const c = cam({pos: [0, 15, 52], target: [0, 3, -20], fov: 42}, {pos: [0, 6.2, 34], target: [0, 3.6, -10], fov: 44}, k);
	return (
		<StreetSet focus={[0, 0, 10]} shadow={30}>
			<BobCrowd spec={BOB} people={people} pose={() => pose} />
			<CameraRig {...c} sway={0.5} />
		</StreetSet>
	);
};

// ===================================================================== S2
// "My mom is Bob, my dad is Bob, my teacher is Bob." – one quick shot each, all with the very same face
const S2: React.FC<SceneProps> = ({f, g}) => {
	const cB = W(2, 11) - 4; // my dad
	const cC = W(2, 15) - 4; // my teacher
	const shot = shotIndex(f, [cB, cC]);
	const t = f / 30;
	const wave = Math.max(0, Math.sin(t * 9)) * 0.25;
	if (shot === 0) {
		// Mom Bob at our front door, waving
		const k = easeOut(clamp(f / cB));
		return (
			<Stage look={LOOK_GREY} focus={[0, 0, 4]} shadowSize={10}>
				<BobHouse position={[0, 0, 0]} k={0} seed={3} mailbox={false} />
				<Character spec={bobOfHeight(0.94, 'mom')} position={[0.2, 0.4, 5.2]} rotation={0} pose={P.withPose(P.idle(t, 1), {armR: [-0.2, 0, -2.6 + wave]})} expr="bob" />
				<CameraRig pos={[lerp(1.6, 1.2, k), 4.2, lerp(13.5, 12.2, k)]} target={[0.2, 3.9, 5]} fov={34} sway={0.4} />
			</Stage>
		);
	}
	if (shot === 1) {
		// Dad Bob next to the car, briefcase in hand
		const fs = f - cB;
		const k = easeOut(clamp(fs / (cC - cB)));
		return (
			<Stage look={LOOK_GREY} focus={[0, 0, 4]} shadowSize={10}>
				<BobHouse position={[-2, 0, -4]} k={0} seed={3} mailbox={false} />
				<Car position={[4.2, 0, 4.5]} rotation={0.2} />
				<Character spec={bobOfHeight(1.04, 'dad')} position={[0.5, 0, 5.4]} rotation={-0.2} pose={P.withPose(P.idle(t, 2), {armL: [-0.2, 0, 0.12]})} expr="bob"
					holdL={
						<group position={[0, -0.35, 0]}>
							<mesh>
								<boxGeometry args={[0.35, 1.0, 1.3]} />
								<meshStandardMaterial color="#5a5248" roughness={0.5} />
							</mesh>
						</group>
					}
				/>
				<CameraRig pos={[lerp(-1.6, -1.2, k), 4.4, lerp(14, 12.6, k)]} target={[0.4, 4.0, 5.2]} fov={34} sway={0.4} />
			</Stage>
		);
	}
	// Teacher Bob at the chalkboard, pointing
	const fs = f - cC;
	const k = easeOut(clamp(fs / 46));
	return (
		<Stage look={{...LOOK_GREY, sunDir: [-0.3, 0.8, 0.5]}} sky={false} fog={false} focus={[0, 0, -8]} shadowSize={10}>
			<Classroom />
			<Character spec={bobOfHeight(1.0, 'teacher')} position={[-2.0, 0, -9.4]} rotation={0.25} pose={P.withPose(P.idle(t, 3), {armL: [-0.3, 0, 1.5], head: [0, 0.15, 0]})} expr="bob"
				holdL={
					<group position={[0, -0.1, 0]} rotation={[0, 0, Math.PI / 2]}>
						<mesh position={[0, 0.8, 0]}>
							<cylinderGeometry args={[0.04, 0.05, 1.8, 6]} />
							<meshStandardMaterial color="#8a6a4a" />
						</mesh>
					</group>
				}
			/>
			<CameraRig pos={[lerp(-0.6, -1.0, k), 4.4, lerp(-0.2, -1.4, k)]} target={[-2.2, 4.0, -9.4]} fov={36} sway={0.4} />
		</Stage>
	);
};

// ===================================================================== S3
// "Even my dog is Bob." – low close-up on Bob the dog: tiny grey shirt, tiny flat haircut, the Bob face
const S3: React.FC<SceneProps> = ({f, dur}) => {
	const k = easeInOut(clamp(f / dur));
	const tilt = keys(f, [[0, 0], [24, 0], [30, 0.28], [44, 0.28], [50, 0]]);
	return (
		<Stage look={LOOK_GREY} focus={[0, 0, 4]} shadowSize={8}>
			<BobHouse position={[0, 0, -2]} k={0} seed={3} mailbox={false} />
			<Dog position={[0.3, 0.4, 5.6]} rotation={0} headTilt={tilt} wag={1} />
			<CameraRig pos={[lerp(0.8, 0.5, k), lerp(1.5, 1.7, k), lerp(10.6, 9.3, k)]} target={[0.3, 1.9, 6.2]} fov={36} sway={0.35} />
		</Stage>
	);
};

// ===================================================================== S4
// "Everyone has the same haircut, the same gray shirt, the same face." – the camera slides past a row of identical Bobs
const ROW: BobInst[] = Array.from({length: 16}).map((_, i) => ({pos: [0, 0, 18 - i * 2.9] as V3, yaw: Math.PI / 2}));
const S4: React.FC<SceneProps> = ({f}) => {
	const cB = W(4, 29) - 4; // the same gray shirt
	const cC = W(4, 33) - 4; // the same face
	const shot = shotIndex(f, [cB, cC]);
	const t = f / 30;
	const pose = P.idle(t * 0.7, 0);
	const start = shot === 0 ? 0 : shot === 1 ? cB : cC;
	const end = shot === 0 ? cB : shot === 1 ? cC : 132;
	const k = easeInOut(clamp((f - start) / (end - start)));
	// everybody blinks at exactly the same moment in the face shot
	const blinkNow = shot === 2 && f - cC >= 18 && f - cC < 22;
	let c;
	if (shot === 0) c = cam({pos: [2.2, 6.2, 29], target: [0, 5.2, 6], fov: 30}, {pos: [2.0, 6.0, 26], target: [0, 5.1, 2], fov: 30}, k); // haircuts in a line
	else if (shot === 1) c = cam({pos: [2.6, 3.5, 27], target: [0, 3.2, 4], fov: 30}, {pos: [2.4, 3.4, 24], target: [0, 3.1, 0], fov: 30}, k); // shirts in a line
	else c = cam({pos: [6.4, 4.8, 21], target: [0, 4.62, 10], fov: 32}, {pos: [6.4, 4.8, 15], target: [0, 4.62, 4], fov: 32}, k); // the faces, a line of them
	return (
		<StreetSet focus={[0, 0, 4]} shadow={24} zFrom={10} zTo={-60} cars={false}>
			<BobCrowd spec={BOB} people={ROW} pose={() => pose} faces={blinkNow ? [{eyes: 'blink', brows: 'normal', mouth: 'tiny', blush: 0.55}] : ['bob']} blink={false} />
			<CameraRig {...c} sway={0.25} />
		</StreetSet>
	);
};

// ===================================================================== S5
// "And every day at 12 o'clock," – low angle on the clock tower; the hands click to 12 and the bell swings
const TOWER: V3 = [0, 0, -14];
const S5: React.FC<SceneProps> = ({f, g, dur}) => {
	const k = easeInOut(clamp(f / dur));
	const hit = wf(41) - 2; // "o'clock"
	const minute = g < hit ? 59 + clamp((g - (hit - 26)) / 26) * 0.6 : 0;
	const hour = g < hit ? 11 + minute / 60 : 12;
	const ring = clamp((g - hit) / 30);
	return (
		<Stage look={LOOK_GREY} focus={[0, 10, -14]} shadowSize={20}>
			<TownSquareBob hour={hour} minute={minute} ring={ring} />
			<CameraRig pos={[lerp(5, 3.5, k), lerp(2.0, 3.0, k), lerp(16, 6, k)]} target={[0, lerp(CLOCK_Y - 1, CLOCK_Y + 0.5, k), TOWER[2]]} fov={lerp(46, 38, k)} sway={0.4} shake={g >= hit && g < hit + 6 ? 0.4 : 0} />
		</Stage>
	);
};

// ===================================================================== S6
// "everyone eats the same sandwich at the same time. Crunch." – one giant synchronized bite
const SQUARE_CROWD: BobInst[] = (() => {
	const out: BobInst[] = [];
	for (let r = 0; r < 8; r++) for (let c = 0; c < 11; c++) out.push({pos: [(c - 5) * 2.9 + (r % 2) * 0.4, 0, 2 + r * 3.0] as V3, yaw: Math.PI});
	return out;
})();
const KIDS_IN_SQUARE: BobInst[] = Array.from({length: 10}).map((_, i) => ({pos: [(i - 4.5) * 2.9 + 1.4, 0, 0.0] as V3, yaw: Math.PI}));
const S6: React.FC<SceneProps> = ({f, g}) => {
	const cB = 57;
	const cC = W(6, 51) - 10; // just before "Crunch"
	const shot = shotIndex(f, [cB, cC]);
	const kEat = (g - wf(42)) / 30; // seconds since "everyone eats"
	const biteT = (wf(51) - wf(42)) / 30;
	const e = eatPose(kEat, biteT);
	const sand = () => e.sandwich;
	const crunch = g >= wf(51) && g < wf(51) + 8;
	if (shot === 0) {
		const k = easeInOut(clamp(f / cB));
		return (
			<Stage look={LOOK_GREY} focus={[0, 0, 8]} shadowSize={26}>
				<TownSquareBob hour={12} minute={1} ring={0} />
				<BobCrowd spec={BOB} people={SQUARE_CROWD} pose={() => e.pose} sandwich={sand} />
				<BobCrowd spec={BOB_KID} people={KIDS_IN_SQUARE} pose={() => e.pose} sandwich={sand} />
				<CameraRig pos={[lerp(-3, -2, k), lerp(9.5, 8.6, k), lerp(-9, -6.5, k)]} target={[0, 3.4, 10]} fov={46} sway={0.4} />
			</Stage>
		);
	}
	if (shot === 1) {
		const fs = f - cB;
		const k = easeInOut(clamp(fs / (cC - cB)));
		return (
			<Stage look={LOOK_GREY} focus={[0, 0, 4]} shadowSize={14}>
				<TownSquareBob hour={12} minute={1} ring={0} />
				<BobCrowd spec={BOB} people={SQUARE_CROWD} pose={() => e.pose} sandwich={sand} />
				<BobCrowd spec={BOB_KID} people={KIDS_IN_SQUARE} pose={() => e.pose} sandwich={sand} />
				<CameraRig pos={[lerp(-6.5, -3.5, k), 4.9, -4.4]} target={[lerp(-3.5, -0.5, k), 4.2, 2.6]} fov={38} sway={0.3} />
			</Stage>
		);
	}
	// CRUNCH: low wide angle, everyone bites at once, the camera jolts
	const fs = f - cC;
	const k = easeOut(clamp(fs / 40));
	return (
		<Stage look={LOOK_GREY} focus={[0, 0, 8]} shadowSize={24}>
			<TownSquareBob hour={12} minute={1} ring={0} />
			<BobCrowd spec={BOB} people={SQUARE_CROWD} pose={() => e.pose} sandwich={sand} />
			<BobCrowd spec={BOB_KID} people={KIDS_IN_SQUARE} pose={() => e.pose} sandwich={sand} />
			<CameraRig pos={[0.5, lerp(1.6, 1.9, k), lerp(-5.5, -6.5, k)]} target={[0, 4.4, 12]} fov={lerp(54, 58, k)} sway={0.3} shake={crunch ? 1.2 : 0} />
		</Stage>
	);
};

export const SCENES_1_6: SceneDef[] = [{Comp: S1}, {Comp: S2}, {Comp: S3}, {Comp: S4}, {Comp: S5}, {Comp: S6}];
