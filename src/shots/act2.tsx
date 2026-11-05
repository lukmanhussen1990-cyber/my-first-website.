import React from 'react';
import {BAKER, BUS_DRIVER, townsperson} from '../characters/cast';
import {Dog} from '../characters/Dog';
import {Person} from '../characters/Person';
import {V3, easeOut, keys, lerp, lerp3, rnd, seg, smooth} from '../lib/anim';
import {Cam} from '../three/Cam';
import {plastic, rboxGeo, torusGeo} from '../three/cache';
import {Clouds, Lights, RBox, Sky} from '../three/prims';
import {Bus, FlyingBalls, Paper, Table, TennisBall, lawTex} from '../sets/props';
import {OFFICE_DESK_Y, OFFICE_DOG, MayorOffice} from '../sets/Rooms';
import {Park} from '../sets/Outdoors';
import {SHOPS} from '../sets/Town';
import {FUR, CREAM} from '../characters/Dog';
import {Crowd, DAY_FX, MORNING_FX, OFFICE_FX, SP, ShotDef, TownKit, Zzz, cheer} from './common';

const DOG_HEAD_OFFICE: V3 = [OFFICE_DOG[0], OFFICE_DOG[1] + 2.84, OFFICE_DOG[2] + 0.5];

/** Paw goes up and slams down at each stamp time (0..1 raise amount). */
const pawAt = (t: number, stamps: number[]) => {
	let v = 0;
	for (const s of stamps) {
		if (t >= s - 0.42 && t < s) v = Math.max(v, Math.sin(((t - (s - 0.42)) / 0.42) * Math.PI * 0.5) * 1);
		if (t >= s - 0.1 && t < s) v = Math.max(0, 1 - (t - (s - 0.1)) / 0.1);
	}
	return v;
};
const shakeAt = (t: number, stamps: number[], k = 0.6) => Math.max(0, ...stamps.map((s) => (t >= s && t < s + 0.18 ? (1 - (t - s) / 0.18) * k : 0)));

const OfficeLight: React.FC = () => (
	<>
		<Sky preset="day" />
		<Lights preset="office" center={[0, 6, -4]} size={16} />
		<pointLight position={[0, 14, 6]} intensity={60} distance={40} color="#fff2dc" />
	</>
);

/* 6. "On his first day," — Biscuit trots up the Town Hall steps in the morning */
const S06: React.FC<SP> = ({t, p, gt}) => {
	const z = lerp(9, 1.2, p);
	const y = Math.max(0, Math.min(3, ((5 - z) / 5.6) * 3));
	return (
		<>
			<TownKit t={t} time="morning" center={[0, 3, 0]} size={24} sunDir={[0.5, 0.45, 0.75]} />
			<Dog t={t} pose="walk" emotion="proud" position={[0, y, z]} yaw={Math.PI} speed={1.3} fx={0.6} />
			<Cam pos={[2.2, 5.2, -2.4]} look={[0, y + 2.8, z - 1.4]} frameY={0.38} fov={36} t={gt} />
		</>
	);
};

/* 6b. "Biscuit sat on a stack of books so he could reach his desk." — crane up to reveal */
const S06b: React.FC<SP> = ({t, p, gt}) => (
	<>
		<OfficeLight />
		<MayorOffice />
		<Dog t={t} pose="sit" emotion="proud" position={OFFICE_DOG} fx={0.7} />
		<Cam pos={lerp3([9, 3.0, 3], [8, 10.4, 5], easeOut(p))} look={lerp3([0, 4.8, -6.6], DOG_HEAD_OFFICE, smooth(p))} frameY={0.4} fov={40} t={gt} />
	</>
);

/* 6c. "And he started making new rules." — paw-stamping papers */
const STAMPS_6C = [0.75, 1.45, 2.15, 2.85];
const S06c: React.FC<SP> = ({t, p, gt}) => (
	<>
		<OfficeLight />
		<MayorOffice />
		<Paper position={[0.8, OFFICE_DESK_Y + 0.03, -4.4]} rotation={[0, 0.1, 0]} w={2.2} tex={lawTex(t > STAMPS_6C[0] ? 1 : 0, 'MORE\nTREATS', 'RULE')} />
		<Dog t={t} pose="sit" emotion="brave" position={OFFICE_DOG} paw={pawAt(t, STAMPS_6C)} fx={0.8} />
		<Cam pos={lerp3([2.6, 9.4, 3.2], [2.0, 9.6, 2.2], smooth(p))} look={DOG_HEAD_OFFICE} frameY={0.36} fov={34} t={gt} shake={shakeAt(t, STAMPS_6C, 0.25)} />
	</>
);

/* Rule papers: top-down on the desk, a paw slams the stamp down. */
const RuleShot = (title: string, body: string, stampT: number): React.FC<SP> => {
	const C: React.FC<SP> = ({t, p, gt}) => {
		const slide = easeOut(seg(t, 0, 0.25));
		const pawY = keys(t, [
			[stampT - 0.45, 12],
			[stampT - 0.12, 10.5],
			[stampT, 7.05],
			[stampT + 0.25, 7.1],
			[stampT + 0.6, 11.5],
		]);
		const stamped = t >= stampT ? 1 : 0;
		return (
			<>
				<OfficeLight />
				<MayorOffice />
				<Paper position={[lerp(-6, 0, slide), OFFICE_DESK_Y + 0.04, -2.9]} rotation={[0, lerp(0.6, 0.04, slide), 0]} w={3.2} tex={lawTex(stamped, body, title)} glow={0.45} />
				{/* the paw coming down */}
				<group position={[0.15, pawY, -2.3]}>
					<mesh geometry={rboxGeo(1.3, 3.6, 1.3, 0.2)} material={plastic(FUR, {rough: 0.75})} position={[0, 2.0, -0.5]} rotation={[0.25, 0, 0]} castShadow />
					<mesh geometry={rboxGeo(1.45, 0.75, 1.55, 0.25)} material={plastic(CREAM, {rough: 0.8})} castShadow />
				</group>
				<Cam pos={[0.2, 14.2, 0.9]} look={[0, OFFICE_DESK_Y, -2.7]} frameY={0.4} fov={36} t={gt} sway={0.02} shake={shakeAt(t, [stampT], 0.8)} />
			</>
		);
	};
	return C;
};
const S07 = RuleShot('RULE #1', 'NAP TIME\nFOR EVERYONE\nAT 2 PM', 0.82);
const S08 = RuleShot('RULE #2', 'FREE\nBELLY RUBS\nAT TOWN HALL', 0.78);
const S09 = RuleShot('RULE #3', 'EVERY FRIDAY\nIS\nFETCH DAY', 0.84);

/* 7b. "nap time for everyone at 2pm." — clock hits 2:00 exactly on "2pm" */
const S07b: React.FC<SP> = ({t, p, gt}) => {
	const hit = 40.38 - 38.84;
	const mins = t < hit ? lerp(56.5, 60, easeOut(t / hit)) : 60;
	const h = mins >= 60 ? 2 : 1;
	const m = mins >= 60 ? 0 : mins;
	const bounce = t > hit ? Math.sin((t - hit) * 30) * Math.exp(-(t - hit) * 8) * 0.6 : 0;
	return (
		<>
			<TownKit t={t} center={[0, 20, -10]} size={30} clock={[h, m + bounce]} />
			<Cam pos={lerp3([3, 17, 20], [1, 23.5, 6], easeOut(p))} look={[0, 26.6, -8.8]} frameY={0.4} fov={36} t={gt} shake={t > hit && t < hit + 0.2 ? 0.15 : 0} />
		</>
	);
};

/* 7c. "The whole town." — everyone asleep */
const S07c: React.FC<SP> = ({t, p, gt}) => {
	const bakery = SHOPS[0];
	return (
		<>
			<TownKit t={t} center={[-10, 0, 18]} size={36} clock={[2, 1]}>
				{/* sleepers on the benches */}
				{[[-14, 13, Math.PI / 2], [14, 13, -Math.PI / 2], [-14, 33, Math.PI / 2], [14, 33, -Math.PI / 2]].map(([x, z, r], i) => (
					<group key={i}>
						<Person look={townsperson(90 + i)} t={t} seed={90 + i} expr="sleep" position={[x + (r > 0 ? 0.35 : -0.35), 0, z]} yaw={r} pose={{sit: true, bob: -0.4, headTilt: 0.4 * (i % 2 ? 1 : -1), headPitch: 0.25}} scale={0.95} />
						<Zzz position={[x, 7, z]} t={t + i * 0.4} s={1.3} />
					</group>
				))}
				{/* baker asleep on the counter in front of the bakery */}
				<Table position={[bakery.pos[0] + 6.5, 0, bakery.pos[2]]} w={2.6} d={6} h={2.8} cloth="#ffffff" />
				<Person look={BAKER} t={t} seed={98} expr="sleep" position={[bakery.pos[0] + 4.6, 0, bakery.pos[2]]} yaw={Math.PI / 2} pose={{lean: 0.7, headPitch: 0.3, armL: [-1.6, 0, 0.2], armR: [-1.6, 0, -0.2]}} />
				<Zzz position={[bakery.pos[0] + 7, 6.5, bakery.pos[2] + 1]} t={t} s={1.4} />
				{/* sleepers standing / sitting on the ground */}
				<Crowd t={t} n={5} seed={95} origin={[-2, 0, 30]} cols={5} spacing={[4, 3]} expr="sleep" pose={(i) => (i % 2 ? {sit: true, legL: [-1.5, 0, 0.1], legR: [-1.5, 0, -0.1], headTilt: 0.4, bob: -2.0} : {headTilt: 0.35, headPitch: 0.3, lean: 0.06})} />
				{[-6, 2, 10].map((x, i) => (
					<Zzz key={i} position={[x - 2, 6.5, 31]} t={t + i * 0.5} s={1.2} />
				))}
			</TownKit>
			<Cam pos={lerp3([16, 15, 50], [14, 13, 47], smooth(p))} look={[-8, 3, 18]} frameY={0.46} fov={44} t={gt} />
		</>
	);
};

/* 7d. Biscuit snoring on his desk */
const S07d: React.FC<SP> = ({t, gt}) => (
	<>
		<OfficeLight />
		<MayorOffice />
		<Dog t={t} pose="sleep" emotion="sleepy" position={[OFFICE_DOG[0], OFFICE_DOG[1], OFFICE_DOG[2] + 0.4]} fx={1} />
		<Cam pos={[1.6, 9.2, 1.4]} look={[0, 8.0, -4.6]} frameY={0.4} fov={34} t={gt} />
	</>
);

/* 7e. "Even the bus driver." */
const S07e: React.FC<SP> = ({t, p, gt}) => (
	<>
		<TownKit t={t} center={[0, 0, 50]} size={24} clock={[2, 2]} fountain={false}>
			<Bus position={[0, 0, 50]} yaw={Math.PI / 2}>
				<RBox s={[1.6, 2.6, 0.4]} r={0.1} color="#2a3a5a" position={[-1.1, 2.6, 4.6]} />
				<Person look={BUS_DRIVER} t={t} seed={66} expr="sleep" position={[-1.1, 0.25, 5.2]} pose={{sit: true, headTilt: 0.45, headPitch: 0.35, armL: [-1.1, 0, 0.1], armR: [-1.1, 0, -0.1]}} scale={0.9} />
				<mesh geometry={torusGeo(0.75, 0.1, 8, 24)} material={plastic('#222228')} position={[-1.1, 4.0, 6.4]} rotation={[-0.9, 0, 0]} />
				<Zzz position={[-0.4, 5.6, 6.6]} t={t} s={1.0} />
			</Bus>
		</TownKit>
		<Cam pos={lerp3([17.5, 5.2, 53], [16.0, 5.3, 52.4], smooth(p))} look={[7, 4.6, 51.1]} frameY={0.42} fov={34} t={gt} />
	</>
);

/* 8b. "free belly rubs at the town hall." — roll over, belly rub, hearts */
const S08b: React.FC<SP> = ({t, p, gt}) => (
	<>
		<TownKit t={t} center={[0, 3, 0]} size={24}>
			<Crowd t={t} n={6} seed={71} origin={[6, 0, 9]} cols={1} spacing={[0, 2.8]} yaw={-0.5} expr="happy" />
		</TownKit>
		<Dog t={t} pose="roll" emotion="love" position={[0, 3, -2.2]} yaw={0.7} fx={1} />
		<Person look={townsperson(73)} t={t} seed={73} expr="laugh" position={[-2.6, 3, 0.2]} yaw={1.2} pose={{kneel: 1, lean: 0.35, armR: [-1.0 + Math.sin(t * 9) * 0.25, 0, -0.2], armL: [-0.9 + Math.sin(t * 9 + 1.5) * 0.25, 0, 0.2]}} />
		<Cam pos={lerp3([5.2, 7.4, 6.6], [4.4, 7.0, 5.4], smooth(p))} look={[0, 4.3, -1.0]} frameY={0.42} fov={36} t={gt} />
	</>
);

/* 8c. "The line went all the way around the block." — aerial crane up */
const LINE: V3[] = [
	[0, 0, 4],
	[0, 0, 40],
	[27, 0, 40],
	[27, 0, -34],
	[-27, 0, -34],
	[-27, 0, 40],
	[-6, 0, 40],
];
const linePoints = (spacing: number) => {
	const pts: {p: V3; yaw: number}[] = [];
	for (let i = 0; i < LINE.length - 1; i++) {
		const a = LINE[i];
		const b = LINE[i + 1];
		const L = Math.hypot(b[0] - a[0], b[2] - a[2]);
		const yaw = Math.atan2(a[0] - b[0], a[2] - b[2]);
		for (let d = i === 0 ? 0 : spacing; d < L; d += spacing) pts.push({p: [a[0] + ((b[0] - a[0]) * d) / L, 0, a[2] + ((b[2] - a[2]) * d) / L], yaw});
	}
	return pts;
};
const S08c: React.FC<SP> = ({t, p, gt}) => (
	<>
		<TownKit t={t} center={[0, 0, 0]} size={70} fountain={false}>
			{linePoints(3.1).map(({p: q, yaw}, i) => (
				<Person key={i} look={townsperson(200 + i)} t={t} seed={200 + i} lod="low" position={[q[0] + (rnd(`lj${i}`) - 0.5) * 0.6, 0, q[2] + (rnd(`lk${i}`) - 0.5) * 0.6]} yaw={yaw} pose={{bob: Math.abs(Math.sin(t * 4 + i)) * 0.15}} />
			))}
		</TownKit>
		<Dog t={t} pose="roll" emotion="love" position={[0, 3, -2.2]} yaw={0.4} fx={0} scale={1.1} />
		<Cam pos={lerp3([34, 16, 66], [44, 58, 78], easeOut(p))} look={lerp3([0, 3, 4], [0, 0, 2], p)} frameY={0.5} fov={48} t={gt} sway={0.1} />
	</>
);

/* 9b. "every Friday is fetch day." — park full of tennis balls */
const throwPose = (t: number, i: number) => ({armR: [-2.4 + Math.sin(t * 4 + i) * 1.2, 0, -0.1] as V3, bob: Math.abs(Math.sin(t * 4 + i)) * 0.1});
const ParkScene: React.FC<{t: number; slow?: number}> = ({t, slow = 1}) => (
	<>
		<Sky preset="day" />
		<Clouds n={14} radius={420} y={140} />
		<Lights preset="day" center={[0, 0, 0]} size={40} />
		<Park>
			<FlyingBalls t={t} n={46} area={44} slow={slow} />
			<Crowd t={t} n={10} seed={81} origin={[-13, 0, -8]} cols={5} spacing={[5.5, 9]} expr={(i) => (i % 2 ? 'laugh' : 'happy')} pose={(i) => throwPose(t, i)} />
			{Array.from({length: 30}).map((_, i) => (
				<TennisBall key={i} position={[(rnd(`gb${i}`) - 0.5) * 40, 0.35, (rnd(`gz${i}`) - 0.5) * 30]} />
			))}
		</Park>
	</>
);
const S09b: React.FC<SP> = ({t, p, gt}) => (
	<>
		<ParkScene t={t} />
		<Dog t={t} pose="run" emotion="happy" position={[lerp(-8, 6, p), 0, 6]} yaw={Math.PI / 2} fx={0.5} />
		<Cam pos={lerp3([0, 8, 34], [0, 8.6, 30], smooth(p))} look={[0, 4.5, -6]} frameY={0.45} fov={44} t={gt} />
	</>
);

/* 9c. "And the weird thing?" — slow-motion run with a ball */
const S09c: React.FC<SP> = ({t, p, gt}) => {
	const z = -4 + t * 1.6;
	return (
		<>
			<ParkScene t={t * 0.3 + 3} slow={0.3} />
			<Dog t={t} pose="run" emotion="happy" position={[0, 0, z]} speed={0.33} fx={0.4} mouthItem={<TennisBall position={[0, 0, 0]} r={0.36} />} />
			<Cam pos={[1.4, 2.4, z + 9.4]} look={[0, 3.0, z + 1.4]} frameY={0.37} fov={34} t={gt} sway={0.08} />
		</>
	);
};

/* 9d. "Everyone was happier than ever." */
const S09d: React.FC<SP> = ({t, p, gt}) => (
	<>
		<ParkScene t={t + 2} />
		<Crowd t={t} n={7} seed={85} origin={[0, 0, -2]} cols={7} spacing={[3.0, 3]} expr="laugh" pose={(i) => cheer(t, i)} />
		<Dog t={t} pose="jump" emotion="happy" position={[0, 0, 4]} speed={1.1} fx={1} />
		<Cam pos={lerp3([0.5, 5.4, 19], [0.3, 5.6, 17], smooth(p))} look={[0, 4.6, 1]} frameY={0.42} fov={40} t={gt} />
	</>
);

export const ACT2: ShotDef[] = [
	{id: 's06', start: 30.82, end: 32.12, C: S06, fx: MORNING_FX},
	{id: 's06b', start: 32.12, end: 34.52, C: S06b, fx: OFFICE_FX},
	{id: 's06c', start: 34.52, end: 37.66, C: S06c, fx: OFFICE_FX},
	{id: 's07', start: 37.66, end: 38.84, C: S07, fx: OFFICE_FX},
	{id: 's07b', start: 38.84, end: 40.9, C: S07b, fx: DAY_FX},
	{id: 's07c', start: 40.9, end: 41.7, C: S07c, fx: DAY_FX},
	{id: 's07d', start: 41.7, end: 42.44, C: S07d, fx: OFFICE_FX},
	{id: 's07e', start: 42.44, end: 43.98, C: S07e, fx: DAY_FX},
	{id: 's08', start: 43.98, end: 45.18, C: S08, fx: OFFICE_FX},
	{id: 's08b', start: 45.18, end: 47.28, C: S08b, fx: DAY_FX},
	{id: 's08c', start: 47.28, end: 49.8, C: S08c, fx: DAY_FX},
	{id: 's09', start: 49.8, end: 51.02, C: S09, fx: OFFICE_FX},
	{id: 's09b', start: 51.02, end: 52.62, C: S09b, fx: DAY_FX},
	{id: 's09c', start: 52.62, end: 54.22, C: S09c, fx: DAY_FX},
	{id: 's09d', start: 54.22, end: 56.3, C: S09d, fx: DAY_FX},
];
