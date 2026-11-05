import React from 'react';
import {CREAM, Dog, FUR} from '../characters/Dog';
import {GIRL, MOM, OLD_MAYOR, townsperson} from '../characters/cast';
import {Me} from '../characters/Me';
import {Person} from '../characters/Person';
import {V3, easeOut, keys, lerp, lerp3, rnd, seg, smooth} from '../lib/anim';
import {Cam} from '../three/Cam';
import {plastic, rboxGeo} from '../three/cache';
import {Glow, Lights, Sky} from '../three/prims';
import {sparkleTex} from '../three/textures';
import {Confetti, Paper, lawTex} from '../sets/props';
import {MayorOffice, OFFICE_DESK_Y, OFFICE_DOG} from '../sets/Rooms';
import {ForestEdge} from '../sets/Outdoors';
import {BALCONY_Y} from '../sets/Town';
import {Crowd, FOREST_FX, MORNING_FX, OFFICE_FX, SP, ShotDef, TownKit, cheer} from './common';

const LAW = 'EVERYONE\nGETS A HUG\nTODAY';
const MAYOR_H = 5.3;

const NightEdge: React.FC<{t: number; gt: number; children?: React.ReactNode}> = ({t, gt, children}) => (
	<>
		<Sky preset="night" stars moon={[-200, 300, -600]} />
		<Lights preset="forest" center={[0, 0, 0]} size={30} />
		<pointLight position={[2, 7, 6]} intensity={45} distance={22} color="#ffe2b8" />
		<ForestEdge t={gt}>
			{/* the reunited family + me watching */}
			<Person look={GIRL} t={t} seed={33} expr="happy" hold="teddy" position={[-4.2, 0, 1.2]} yaw={0.6} scale={0.66} pose={{armL: [-0.9, 0, 0.5], armR: [-0.9, 0, -0.5]}} />
			<Person look={MOM} t={t} seed={12} expr="happy" position={[-6.0, 0, 1.6]} yaw={0.7} pose={{armL: [-0.2, 0, 0.2]}} />
			{[0, 1, 2].map((i) => (
				<Person key={i} look={townsperson(520 + i)} t={t} seed={520 + i} expr="neutral" position={[-5 + i * 3.2, 0, -8 - (i % 2)]} yaw={0.2} />
			))}
			{children}
		</ForestEdge>
		<Me position={[-7.6, 0, -3.2]} yaw={0.9} t={t} glow={0.6} />
	</>
);

const DOG_SIT: V3 = [0, 0, -1.6];

/* 16. "The old mayor didn't say anything." */
const S16: React.FC<SP> = ({t, p, gt}) => (
	<>
		<NightEdge t={t} gt={gt}>
			<Dog t={t} pose="sit" emotion="normal" position={DOG_SIT} medal fx={0} />
			<Person look={OLD_MAYOR} t={t} seed={7} expr="neutral" position={[4.5, 0, 2.5]} yaw={-2.31} blinkOff={t > 1.2} />
		</NightEdge>
		<Cam pos={lerp3([0.4, 5.6, -1.4], [0.9, 5.5, -0.9], smooth(p))} look={[4.5, MAYOR_H, 2.5]} frameY={0.36} fov={32} t={gt} />
	</>
);

/* 16b. "He just walked up to Biscuit," */
const S16b: React.FC<SP> = ({t, p, gt}) => {
	const q = lerp3([4.5, 0, 2.5], [1.4, 0, 1.2], p);
	return (
		<>
			<NightEdge t={t + 2} gt={gt}>
				<Dog t={t} pose="sit" emotion="normal" position={DOG_SIT} medal fx={0} headYaw={0.4} />
				<Person look={OLD_MAYOR} t={t} seed={7} expr="neutral" position={q} yaw={-2.4} pose={{walk: t * 7, walkAmp: 0.4}} />
			</NightEdge>
			<Cam pos={lerp3([-7.5, 6.4, -6.5], [-6.5, 6.2, -5.5], smooth(p))} look={[2, 3.4, 0.6]} frameY={0.45} fov={42} t={gt} />
		</>
	);
};

/* 16c. "knelt down," — low angle */
const S16c: React.FC<SP> = ({t, p, gt}) => (
	<>
		<NightEdge t={t + 4} gt={gt}>
			<Dog t={t} pose="sit" emotion="normal" position={DOG_SIT} medal fx={0} headYaw={0.5} />
			<Person look={OLD_MAYOR} t={t} seed={7} expr="neutral" position={[1.4, 0, 1.2]} yaw={-2.68} pose={{kneel: easeOut(seg(t, 0.05, 0.7)), lean: 0.15 * seg(t, 0.2, 0.8)}} />
		</NightEdge>
		<Cam pos={lerp3([-2.6, 1.1, -2.4], [-2.3, 1.2, -1.9], smooth(p))} look={[1.4, 4.4, 1.2]} frameY={0.34} fov={40} t={gt} />
	</>
);

/* 16d. "and gave him a belly rub." — he smiles for the first time */
const S16d: React.FC<SP> = ({t, p, gt}) => (
	<>
		<NightEdge t={t + 6} gt={gt}>
			<Dog t={t} pose="roll" emotion="love" position={[0, 0, -1.2]} yaw={-0.9} fx={1} />
			<Person look={OLD_MAYOR} t={t} seed={7} expr={t > 0.35 ? 'smile' : 'neutral'} position={[1.6, 0, 1.0]} yaw={-2.51} pose={{kneel: 1, lean: 0.35, armR: [-1.05 + Math.sin(t * 9) * 0.25, 0, 0.1], armL: [-0.95 + Math.sin(t * 9 + 1.6) * 0.22, 0, -0.1]}} />
		</NightEdge>
		<Cam pos={lerp3([-3.4, 6.8, -6.4], [-3.0, 6.6, -5.6], smooth(p))} look={[0.5, 2.6, -0.3]} frameY={0.36} fov={40} t={gt} />
	</>
);

/* 17. "The next morning," — sunrise over the town */
const S17: React.FC<SP> = ({t, p, gt}) => (
	<>
		<TownKit t={t} time="sunrise" center={[0, 0, 0]} size={60} sunDir={[-0.55, 0.35, -0.75]} />
		<Cam pos={lerp3([24, 7, 72], [20, 10, 64], smooth(p))} look={[-8, 16, -40]} frameY={0.5} fov={46} t={gt} sway={0.06} />
	</>
);

/* 17b. "Biscuit signed his first law" */
const S17b: React.FC<SP> = ({t, p, gt}) => (
	<>
		<Sky preset="sunrise" />
		<Lights preset="morning" center={[0, 6, -4]} size={16} sunDir={[-0.5, 0.6, 0.6]} />
		<pointLight position={[0, 14, 6]} intensity={55} distance={40} color="#ffe6c8" />
		<MayorOffice />
		<Paper position={[0.6, OFFICE_DESK_Y + 0.04, -3.6]} rotation={[0, 0.05, 0]} w={2.4} tex={lawTex(0, LAW)} glow={0.45} />
		<Dog t={t} pose="sit" emotion="proud" position={OFFICE_DOG} medal paw={seg(t, 1.2, 1.85) * 0.9} fx={0.8} />
		<Cam pos={lerp3([2.8, 10.2, 3.2], [2.2, 10.0, 2.2], smooth(p))} look={[0.2, 9.0, -5.0]} frameY={0.36} fov={36} t={gt} />
	</>
);

/* 17c/18. The paw stamps NEW LAW; then the reveal */
const LawDesk: React.FC<{t: number; stampT: number; gt: number; camH: number; sparkle?: number}> = ({t, stampT, gt, camH, sparkle = 0}) => {
	const pawY = keys(t, [
		[stampT - 0.3, 11],
		[stampT, 7.05],
		[stampT + 0.3, 7.1],
		[stampT + 0.7, 12],
	]);
	const shake = t >= stampT && t < stampT + 0.2 ? (1 - (t - stampT) / 0.2) * 0.9 : 0;
	return (
		<>
			<Sky preset="sunrise" />
			<Lights preset="morning" center={[0, 6, -3]} size={14} sunDir={[-0.5, 0.6, 0.6]} />
			<pointLight position={[0, 14, 2]} intensity={60} distance={40} color="#fff0dc" />
			<MayorOffice />
			<Paper position={[0, OFFICE_DESK_Y + 0.04, -2.9]} rotation={[0, 0.03, 0]} w={3.2} tex={lawTex(t >= stampT ? 1 : 0, LAW)} glow={0.5} />
			{pawY < 11.9 ? (
				<group position={[0.1, pawY, -2.1]} scale={0.75}>
					<mesh geometry={rboxGeo(1.3, 3.6, 1.3, 0.2)} material={plastic(FUR, {rough: 0.75})} position={[0, 2.0, -0.5]} rotation={[0.25, 0, 0]} castShadow />
					<mesh geometry={rboxGeo(1.45, 0.75, 1.55, 0.25)} material={plastic(CREAM, {rough: 0.8})} castShadow />
				</group>
			) : null}
			{sparkle > 0
				? Array.from({length: 8}).map((_, i) => {
						const a = (i / 8) * Math.PI * 2;
						const tw = 0.5 + 0.5 * Math.sin(t * 7 + i * 1.3);
						return (
							<sprite key={i} position={[Math.cos(a) * 2.3, OFFICE_DESK_Y + 0.6, -2.9 + Math.sin(a) * 2.8]} scale={[0.6 + tw * 0.6, 0.6 + tw * 0.6, 1]}>
								<spriteMaterial map={sparkleTex()} transparent opacity={sparkle * (0.4 + tw * 0.6)} depthWrite={false} blending={2} />
							</sprite>
						);
					})
				: null}
			<Cam pos={[0.2, camH, 1.0]} look={[0, OFFICE_DESK_Y, -2.8]} frameY={0.42} fov={42} t={gt} sway={0.02} shake={shake} />
		</>
	);
};
const S17c: React.FC<SP> = ({t, gt}) => <LawDesk t={t} stampT={0.2} gt={gt} camH={15.2} />;
const S18: React.FC<SP> = ({t, p, gt}) => <LawDesk t={t + 2} stampT={0} gt={gt} camH={lerp(15.2, 12.4, easeOut(p))} sparkle={seg(t, 0.2, 0.6)} />;

/* 18b. Everybody hugging in the square */
const HugPair: React.FC<{t: number; i: number; pos: V3; yaw: number}> = ({t, i, pos, yaw}) => {
	const hug = {armL: [-1.4, 0, -0.55] as V3, armR: [-1.4, 0, 0.55] as V3, lean: 0.12, bob: Math.abs(Math.sin(t * 5 + i)) * 0.08};
	return (
		<group position={pos} rotation={[0, yaw, 0]}>
			<Person look={townsperson(600 + i * 2)} t={t} seed={600 + i * 2} expr="happy" position={[0, 0, -0.75]} pose={hug} />
			<Person look={townsperson(601 + i * 2)} t={t} seed={601 + i * 2} expr="laugh" position={[0, 0, 0.75]} yaw={Math.PI} pose={hug} />
		</group>
	);
};
const S18b: React.FC<SP> = ({t, p, gt}) => (
	<>
		<TownKit t={t} time="morning" center={[0, 0, 18]} size={36} sunDir={[0.4, 0.6, 0.7]} fountain={false}>
			{[[-8, 0, 14], [0, 0, 20], [8, 0, 15], [-5, 0, 26], [6, 0, 27], [-12, 0, 22], [12, 0, 23]].map((q, i) => (
				<HugPair key={i} t={t} i={i} pos={q as V3} yaw={Math.PI / 2 + (rnd(`hp${i}`) - 0.5) * 0.9} />
			))}
			<Confetti t={gt} n={220} area={[40, 30]} top={20} center={[0, 0, 20]} />
		</TownKit>
		<Cam pos={lerp3([1, 12, 40], [0.8, 11.5, 37], smooth(p))} look={[0, 3, 20]} frameY={0.46} fov={44} t={gt} />
	</>
);

/* 18c. "Even the old mayor." — balcony ending */
const S18c: React.FC<SP> = ({t, p, gt}) => {
	const by = BALCONY_Y;
	return (
		<>
			<TownKit t={t} time="morning" center={[0, 8, 6]} size={36} sunDir={[0.4, 0.6, 0.7]} fountain={false}>
				<Crowd t={t} n={28} seed={71} origin={[0, 0, 7]} cols={7} spacing={[3.6, 3.6]} yaw={Math.PI} expr="laugh" pose={(i) => cheer(t, i)} />
				<Confetti t={gt} n={260} area={[40, 34]} top={30} center={[0, 0, 8]} />
			</TownKit>
			<Dog t={t} pose="stand" emotion="happy" position={[0, by, -3.6]} medal fx={1} />
			<Me position={[-2.7, by, -3.4]} yaw={0.55} t={t} glow={0.45} lean={-0.12} />
			<Person look={OLD_MAYOR} t={t} seed={7} expr="laugh" position={[2.6, by, -3.2]} yaw={-0.9} pose={{kneel: 0.55, lean: 0.25, armL: [-1.4, 0, -0.5], armR: [-1.4, 0, 0.55]}} />
			<Glow position={[0, by + 3, -3]} size={10} color="#ffe2a8" opacity={0.25} />
			<Cam pos={lerp3([0.8, by + 3.8, 6.5], [6, by + 7, 36], easeOut(seg(t, 0.5, 2.3)))} look={lerp3([0, by + 2.9, -3.4], [0, by - 2, -1], easeOut(seg(t, 0.5, 2.3)))} frameY={0.38} fov={lerp(36, 46, smooth(seg(t, 0.5, 2.3)))} t={gt} />
		</>
	);
};

export const ACT4: ShotDef[] = [
	{id: 's16', start: 93.44, end: 95.7, C: S16, fx: FOREST_FX},
	{id: 's16b', start: 95.7, end: 97.5, C: S16b, fx: FOREST_FX},
	{id: 's16c', start: 97.5, end: 98.52, C: S16c, fx: FOREST_FX},
	{id: 's16d', start: 98.52, end: 100.0, C: S16d, fx: FOREST_FX},
	{id: 's17', start: 100.0, end: 101.02, C: S17, fx: MORNING_FX},
	{id: 's17b', start: 101.02, end: 102.9, C: S17b, fx: OFFICE_FX},
	{id: 's17c', start: 102.9, end: 103.72, C: S17c, fx: OFFICE_FX},
	{id: 's18', start: 103.72, end: 105.54, C: S18, fx: OFFICE_FX},
	{id: 's18b', start: 105.54, end: 106.26, C: S18b, fx: MORNING_FX},
	{id: 's18c', start: 106.26, end: 200, C: S18c, fx: MORNING_FX},
];
