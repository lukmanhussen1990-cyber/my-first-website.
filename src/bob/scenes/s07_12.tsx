// Scenes 7-12: me (the only colour in town), everyone stares, roll call, the teacher stops, the mirror and the boing.
import React from 'react';
import {Stage} from '../../lib/Stage';
import {CameraRig} from '../../lib/CameraRig';
import {Character} from '../../characters/Character';
import * as P from '../../characters/poses';
import {BobCrowd, BobInst} from '../BobCrowd';
import {BOB, BOB_KID, ME, ME_GREY, bobOfHeight, BOB_SHIRT} from '../cast';
import {robotWalk, ROBOT_SPEED} from '../moves';
import {LOOK_GREY, streetHouse} from '../world';
import {Classroom, seat, ME_SEAT, DESK_X, DESK_Z, Bedroom, MIRROR_POS} from '../rooms';
import {StreetSet, walkerGrid, cam} from './common';
import {SceneDef, SceneProps} from '../kit';
import {W, shotIndex, amp, speaking, wf} from '../timing';
import {V3, clamp, lerp, easeInOut, easeOut, easeOutElastic, keys} from '../../lib/anim';
import {MIRROR} from '../props';

const COLS = [-7.4, -5.0, 5.0, 7.4];

// ===================================================================== S7
// "I'm the only one who isn't Bob." – I step out of our door into the grey street
const MY_HOUSE = streetHouse(2);
const S7: React.FC<SceneProps> = ({f, dur}) => {
	const t = f / 30;
	const k = easeInOut(clamp(f / dur));
	const walkK = clamp(f / 60);
	const me: V3 = [MY_HOUSE.p[0] + 4.6 + walkK * 3.4, 0.0, MY_HOUSE.p[2] + 0.3];
	const pose = robotWalk(t);
	const crowd = walkerGrid([-6.0, -3.6], 8, -10, 4.2, -1).map((p) => ({...p, pos: [p.pos[0], p.pos[1], p.pos[2] - ROBOT_SPEED * t] as V3}));
	return (
		<StreetSet focus={[me[0], 0, me[2]]} shadow={18}>
			<BobCrowd spec={BOB} people={crowd.filter((p) => p.pos[2] < 20)} pose={() => pose} />
			<Character spec={ME} position={me} rotation={Math.PI / 2} pose={f < 60 ? P.walk(t, 0.8, 0.9) : P.idle(t, 1)} expr={f > 40 ? 'proud' : 'happy'} />
			<CameraRig pos={[lerp(2.6, 1.0, k), lerp(2.4, 2.8, k), lerp(MY_HOUSE.p[2] + 9.5, MY_HOUSE.p[2] + 7.0, k)]} target={[me[0] - 0.5, 3.0, me[2]]} fov={40} sway={0.5} />
		</StreetSet>
	);
};

// ===================================================================== S8
// "I have curly orange hair, I wear a red jacket, and when I walk down the street,"
const S8: React.FC<SceneProps> = ({f, g}) => {
	const cB = W(8, 64) - 4; // I wear a red jacket
	const cC = W(8, 69) - 4; // and when I walk down the street
	const shot = shotIndex(f, [cB, cC]);
	const t = f / 30;
	const me: V3 = [-6.6, 0.3, 10];
	if (shot === 0) {
		const k = easeInOut(clamp(f / cB));
		const shake = Math.sin(t * 9) * 0.22 * clamp(f / 10);
		return (
			<StreetSet focus={[me[0], 0, me[2]]} shadow={10}>
				<Character spec={ME} position={me} rotation={0.3} pose={P.withPose(P.idle(t, 1), {head: [-0.05, shake * 0.6, shake]})} expr="happy" talk={speaking(g, 59, 63) ? amp(g) * 0.4 : 0} />
				<CameraRig pos={[me[0] + lerp(1.6, 1.3, k), lerp(4.5, 4.4, k), me[2] + lerp(3.6, 3.0, k)]} target={[me[0], 4.05, me[2]]} fov={34} sway={0.3} />
			</StreetSet>
		);
	}
	if (shot === 1) {
		const fs = f - cB;
		const k = easeInOut(clamp(fs / (cC - cB)));
		const tug = Math.sin(clamp(fs / 18) * Math.PI) * 0.5;
		return (
			<StreetSet focus={[me[0], 0, me[2]]} shadow={10}>
				<Character spec={ME} position={me} rotation={0.2} pose={P.withPose(P.idle(t, 1), {lean: -0.06, armL: [-1.7 - tug * 0.3, 0, -0.62], armR: [-1.7 - tug * 0.3, 0, 0.62], head: [-0.12, 0, 0]})} expr="proud" />
				<CameraRig pos={[me[0] + lerp(-1.4, -1.0, k), lerp(2.9, 3.1, k), me[2] + lerp(4.2, 3.6, k)]} target={[me[0], 2.8, me[2]]} fov={34} sway={0.3} />
			</StreetSet>
		);
	}
	// tracking: I walk down the middle of the street, the Bobs march past the other way
	const fs = f - cC;
	const ts = fs / 30;
	const mz = 6 - ts * 2.0;
	const pose = robotWalk(t);
	const crowd = walkerGrid([-6.0, -3.2, 3.2, 6.0], 9, mz + 30, 4.2, 1).map((p) => ({...p, pos: [p.pos[0], p.pos[1], p.pos[2] + ROBOT_SPEED * ts] as V3}));
	return (
		<StreetSet focus={[0, 0, mz]} shadow={16}>
			<BobCrowd spec={BOB} people={crowd} pose={() => pose} />
			<Character spec={ME} position={[0, 0, mz]} rotation={Math.PI} pose={P.walk(t, 0.9, 1)} expr="happy" />
			<CameraRig pos={[0.8, 3.2, mz - 7.5]} target={[0, 3.0, mz]} fov={42} sway={0.5} />
		</StreetSet>
	);
};

// ===================================================================== S9
// "everyone stares." – every Bob stops, and every head turns to me at the same moment
const STARE_CROWD: BobInst[] = (() => {
	const out: BobInst[] = [];
	for (let r = 0; r < 6; r++) for (const x of [-7.4, -5.0, -2.6, 2.6, 5.0, 7.4]) out.push({pos: [x, Math.abs(x) > 5.2 ? 0.3 : 0, -6.5 - r * 3.6] as V3, yaw: 0});
	for (let r = 0; r < 3; r++) for (const x of [-6.2, 6.2]) out.push({pos: [x, 0.3, 2 + r * 4] as V3, yaw: Math.PI});
	return out;
})();
const ME_STREET: V3 = [0, 0, -2];
const S9: React.FC<SceneProps> = ({f}) => {
	const turn = easeOut(clamp((f - 4) / 7));
	const people = STARE_CROWD.map((p) => {
		const toMe = Math.atan2(ME_STREET[0] - p.pos[0], ME_STREET[2] - p.pos[2]);
		let d = toMe - p.yaw;
		while (d > Math.PI) d -= Math.PI * 2;
		while (d < -Math.PI) d += Math.PI * 2;
		return {...p, yaw: p.yaw + d * turn};
	});
	const frozen = P.withPose(robotWalk(0.27), {head: [-0.04, 0, 0]});
	const k = easeOut(clamp(f / 40));
	return (
		<StreetSet focus={[0, 0, -10]} shadow={22}>
			<BobCrowd spec={BOB} people={people} pose={() => frozen} faces={['stare']} look={[0, 0]} blink={false} />
			<Character spec={ME} position={ME_STREET} rotation={Math.PI} pose={P.idle(f / 30, 1)} expr="worried" />
			<CameraRig pos={[lerp(3.4, 3.0, k), lerp(3.4, 3.6, k), ME_STREET[2] + lerp(5.2, 4.4, k)]} target={[-0.6, 4.0, -13]} fov={38} sway={0.3} />
		</StreetSet>
	);
};

// ===================================================================== S10 + S11: roll call
const SCHOOL_LOOK = {...LOOK_GREY, sunDir: [-0.7, 0.6, 0.3] as V3, sun: 2.0, hemi: 1.0, ambient: 0.3};
const allSeats = (() => {
	const out: {c: number; r: number}[] = [];
	for (let r = 0; r < DESK_Z.length; r++) for (let c = 0; c < DESK_X.length; c++) out.push({c, r});
	return out;
})();
const kidsExcept = (skip: {c: number; r: number}[]): BobInst[] =>
	allSeats.filter((s) => !(s.c === ME_SEAT.c && s.r === ME_SEAT.r) && !skip.some((x) => x.c === s.c && x.r === s.r)).map((s) => ({pos: seat(s.c, s.r), yaw: Math.PI}));
const sitPose = (t: number) => P.withPose(P.sit(t, 0, 0), {armL: [-1.2, 0, -0.12], armR: [-1.2, 0, 0.12]});
const TEACHER = bobOfHeight(1.0, 'teacher');
const TEACH_POS: V3 = [0.5, 0, -7.6];
const Clipboard: React.FC = () => (
	<group position={[0, -0.25, 0.25]} rotation={[0.9, 0, 0]}>
		<mesh>
			<boxGeometry args={[0.9, 1.2, 0.06]} />
			<meshStandardMaterial color="#9a7a55" roughness={0.6} />
		</mesh>
		<mesh position={[0, -0.05, 0.035]}>
			<planeGeometry args={[0.8, 1.0]} />
			<meshStandardMaterial color="#f4f1ea" roughness={0.8} />
		</mesh>
	</group>
);
/** one featured kid ("here!") */
const HERE_KIDS = [{c: 1, r: 1}, {c: 3, r: 1}, {c: 0, r: 2}];

const RollCall: React.FC<{g: number; t: number; featured?: {c: number; r: number}; hand?: number; talkKid?: number; teacherPose?: P.Pose; teacherTalk?: number; teacherExpr?: any; children?: React.ReactNode}> = ({
	g,
	t,
	featured,
	hand = 0,
	talkKid = 0,
	teacherPose,
	teacherTalk = 0,
	teacherExpr = 'bob',
	children,
}) => {
	const kids = kidsExcept(featured ? [featured] : []);
	const pose = sitPose(t);
	return (
		<Stage look={SCHOOL_LOOK} sky={false} fog={false} focus={[0, 0, 2]} shadowSize={16}>
			<Classroom />
			<BobCrowd spec={BOB_KID} people={kids} pose={() => pose} />
			{featured ? (
				<Character spec={BOB_KID} position={seat(featured.c, featured.r)} rotation={Math.PI} pose={P.withPose(sitPose(t), {armR: [-0.2, 0, -2.75 * hand]})} expr="bob" talk={talkKid} />
			) : null}
			<Character spec={ME} position={seat(ME_SEAT.c, ME_SEAT.r)} rotation={Math.PI} pose={sitPose(t + 1)} expr="worried" />
			<Character spec={TEACHER} position={TEACH_POS} rotation={0} pose={teacherPose ?? P.idle(t, 3)} expr={teacherExpr} talk={teacherTalk} holdL={<Clipboard />} />
			{children}
		</Stage>
	);
};

const S10: React.FC<SceneProps> = ({f, g}) => {
	const cuts = [W(10, 85) - 4, W(10, 86) - 4, W(10, 87) - 4, W(10, 88) - 4, W(10, 89) - 4, W(10, 90) - 4];
	const shot = shotIndex(f, cuts);
	const t = f / 30;
	const talkT = speaking(g, 81, 84) || speaking(g, 85, 85) || speaking(g, 87, 87) || speaking(g, 89, 89) ? amp(g) : 0;
	if (shot === 0) {
		const k = easeInOut(clamp(f / cuts[0]));
		return (
			<RollCall g={g} t={t} teacherTalk={talkT} teacherPose={P.withPose(P.idle(t, 3), {armL: [-1.1, 0, -0.2]})}>
				<CameraRig pos={[lerp(11, 9.5, k), lerp(9.2, 8.4, k), lerp(-9.5, -8.6, k)]} target={[-1, 2.2, 4]} fov={46} sway={0.4} />
			</RollCall>
		);
	}
	const kidShot = shot % 2 === 0; // 2, 4, 6 = kids
	const n = Math.floor((shot - 1) / 2); // which pair
	const fs = f - cuts[shot - 1];
	const featured = HERE_KIDS[Math.min(2, n)];
	if (!kidShot) {
		// the teacher points: "Bob."
		const kp = seat(featured.c, featured.r);
		const yawTo = Math.atan2(kp[0] - TEACH_POS[0], kp[2] - TEACH_POS[2]);
		const pointPose = P.withPose(P.idle(t, 3), {turn: yawTo * 0.5, armR: [-1.55, 0, -0.05], armL: [-1.1, 0, -0.2], head: [0, yawTo * 0.5, 0]});
		return (
			<RollCall g={g} t={t} featured={featured} teacherPose={pointPose} teacherTalk={talkT}>
				<CameraRig pos={[TEACH_POS[0] + (n % 2 ? -2.2 : 2.4), 4.6, TEACH_POS[2] + 4.2 + fs * 0.01]} target={[TEACH_POS[0], 4.5, TEACH_POS[2]]} fov={34} sway={0.3} />
			</RollCall>
		);
	}
	// the kid: "here!" (hand up) – the same kid every time, of course
	const kp = seat(featured.c, featured.r);
	const hand = easeOut(clamp(fs / 5));
	return (
		<RollCall g={g} t={t} featured={featured} hand={hand} talkKid={talkT > 0 ? talkT : 0} teacherPose={P.idle(t, 3)}>
			<CameraRig pos={[kp[0] + 1.7, 4.5, kp[2] - 3.0]} target={[kp[0], 3.6, kp[2]]} fov={38} sway={0.25} />
		</RollCall>
	);
};

const S11: React.FC<SceneProps> = ({f, g}) => {
	const cB = W(11, 96) - 4; // "and she just stops"
	const shot = shotIndex(f, [cB]);
	const t = f / 30;
	const mp = seat(ME_SEAT.c, ME_SEAT.r);
	const yawToMe = Math.atan2(mp[0] - TEACH_POS[0], mp[2] - TEACH_POS[2]);
	if (shot === 0) {
		// her finger sweeps down the rows... and lands on me
		const sweep = easeInOut(clamp(f / (cB - 6)));
		const yaw = lerp(-0.6, yawToMe, sweep);
		const pointPose = P.withPose(P.idle(t, 3), {turn: yaw * 0.6, armR: [-1.55, 0, -0.05], armL: [-1.1, 0, -0.2], head: [0, yaw * 0.4, 0]});
		return (
			<RollCall g={g} t={t} teacherPose={pointPose} teacherTalk={0}>
				<CameraRig pos={[TEACH_POS[0] - 1.4, 5.6, TEACH_POS[2] - 3.4]} target={[lerp(-4, mp[0], sweep), 3.2, lerp(4, mp[2], sweep)]} fov={36} sway={0.3} />
			</RollCall>
		);
	}
	// she just stops. (frozen, confused)
	const fs = f - cB;
	const k = easeInOut(clamp(fs / 70));
	const frozen = P.withPose(P.idle(0.4, 3), {turn: yawToMe * 0.6, armR: [-1.55, 0, -0.05], armL: [-1.1, 0, -0.2], head: [0.05, yawToMe * 0.4, 0.12]});
	return (
		<RollCall g={g} t={t} teacherPose={frozen} teacherExpr="confused">
			<CameraRig pos={[TEACH_POS[0] + lerp(2.6, 2.1, k), 4.75, TEACH_POS[2] + lerp(5.0, 3.9, k)]} target={[TEACH_POS[0] + 0.2, 4.55, TEACH_POS[2]]} fov={32} sway={0.2} />
		</RollCall>
	);
};

// ===================================================================== S12: the mirror
// "So I tried to be like them. I put on a gray shirt, I pushed my hair down flat. It popped right back up."
const ME_MIRROR: V3 = [MIRROR_POS[0], 0, MIRROR_POS[2] + 2.6];
const ROOM_LOOK = {...LOOK_GREY, sunDir: [0.4, 0.7, 0.6] as V3, sun: 1.4, hemi: 1.0, ambient: 0.3, env: 0.4};
const ShirtInHands: React.FC = () => (
	<group position={[0, -0.25, 0.3]}>
		<mesh>
			<boxGeometry args={[1.8, 1.5, 0.1]} />
			<meshStandardMaterial color={BOB_SHIRT} roughness={0.7} />
		</mesh>
	</group>
);
const S12: React.FC<SceneProps> = ({f, g}) => {
	const cB = W(12, 107) - 4; // I put on a gray shirt
	const cC = W(12, 113) - 4; // I pushed my hair down flat
	const cD = W(12, 119) - 3; // It popped right back up
	const shot = shotIndex(f, [cB, cC, cD]);
	const t = f / 30;
	const over = (k: number, near = 1) => (
		<CameraRig pos={[ME_MIRROR[0] + lerp(1.9, 1.6, k), lerp(4.1, 4.0, k), ME_MIRROR[2] + lerp(1.6, 1.1, k) * near]} target={[MIRROR_POS[0] - 0.25, MIRROR.y + 0.55, MIRROR_POS[2]]} fov={lerp(40, 36, k)} sway={0.3} />
	);
	if (shot === 0) {
		const k = easeInOut(clamp(f / cB));
		return (
			<Stage look={ROOM_LOOK} sky={false} fog={false} focus={[0, 0, -1]} shadowSize={8}>
				<Bedroom>
					<Character spec={ME} position={ME_MIRROR} rotation={Math.PI} pose={P.withPose(P.idle(t, 1), {armL: [-1.0, 0, -0.35], armR: [-1.0, 0, 0.35]})} expr="sad" look={[0, 0.3]} holdL={<ShirtInHands />} />
				</Bedroom>
				{over(k, 1.3)}
			</Stage>
		);
	}
	if (shot === 1) {
		const fs = f - cB;
		const k = easeInOut(clamp(fs / (cC - cB)));
		return (
			<Stage look={ROOM_LOOK} sky={false} fog={false} focus={[0, 0, -1]} shadowSize={8}>
				<Bedroom>
					<Character spec={ME_GREY} position={ME_MIRROR} rotation={Math.PI} pose={P.withPose(P.idle(t, 1), {armL: [-0.15, 0, 0.3], armR: [-0.15, 0, -0.3]})} expr="worried" />
				</Bedroom>
				{over(k)}
			</Stage>
		);
	}
	if (shot === 2) {
		// pushing my hair down flat
		const fs = f - cC;
		const squash = easeInOut(clamp((fs - 6) / 30));
		const k = easeInOut(clamp(fs / (cD - cC)));
		return (
			<Stage look={ROOM_LOOK} sky={false} fog={false} focus={[0, 0, -1]} shadowSize={8}>
				<Bedroom>
					<Character spec={ME_GREY} position={ME_MIRROR} rotation={Math.PI} pose={P.withPose(P.idle(t, 1), {armL: [-0.4, 0, 2.55 - squash * 0.25], armR: [-0.4, 0, -2.55 + squash * 0.25], head: [0.05, 0, 0]})} expr="determined" hairSquash={squash} />
				</Bedroom>
				{over(k, 0.85)}
			</Stage>
		);
	}
	// BOING. the hair springs right back up
	const fs = f - cD;
	const spring = 1 - easeOutElastic(clamp((fs - 6) / 26));
	const k = easeOut(clamp(fs / 50));
	return (
		<Stage look={ROOM_LOOK} sky={false} fog={false} focus={[0, 0, -1]} shadowSize={8}>
			<Bedroom>
				<Character spec={ME_GREY} position={ME_MIRROR} rotation={Math.PI} pose={P.withPose(P.idle(t, 1), {armL: [-0.1, 0, 0.12], armR: [-0.1, 0, -0.12], head: [0.12, 0, 0]})} expr={fs > 14 ? 'sad' : 'shocked'} hairSquash={fs < 6 ? 1 : spring} />
			</Bedroom>
			<CameraRig pos={[MIRROR_POS[0] + 0.6, 3.9, MIRROR_POS[2] + lerp(0.25, 0.35, k)]} target={[ME_MIRROR[0], 3.8, ME_MIRROR[2]]} fov={44} sway={0.2} shake={fs > 6 && fs < 14 ? 0.5 : 0} />
		</Stage>
	);
};

export const SCENES_7_12: SceneDef[] = [{Comp: S7}, {Comp: S8}, {Comp: S9}, {Comp: S10}, {Comp: S11}, {Comp: S12}];
