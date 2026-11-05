import React from 'react';
import {GIRL, MOM, OLD_MAYOR, POLICE, townsperson} from '../characters/cast';
import {Dog} from '../characters/Dog';
import {Me} from '../characters/Me';
import {Flashlight, Person, Pose} from '../characters/Person';
import {V3, easeOut, keys, lerp, lerp3, rnd, seg, smooth} from '../lib/anim';
import {Cam} from '../three/Cam';
import {litTex, plastic} from '../three/cache';
import {Glow, Lights, Sky} from '../three/prims';
import {BookStack, Paper, SpeechBubble, newspaperTex} from '../sets/props';
import {Chair, DarkOffice, MeetingRoom} from '../sets/Rooms';
import {Beam, BigTree, FogBank, ForestEdge, PineForest} from '../sets/Outdoors';
import {DARK_FX, FOREST_FX, NIGHT_FX, SP, ShotDef, TownKit} from './common';

const MEETING_FX = {bg: '#e8dcc6', bloom: 0.45, env: 0.5, contrast: 0.08};
const MAYOR_H = 5.3; // old mayor head-centre height when standing on the floor

/* ---------- Old mayor's dark office ---------- */

const DarkLight: React.FC = () => (
	<>
		<Lights preset="dark" center={[0, 3, -3]} />
		<spotLight position={[8, 14, 6]} intensity={30} angle={0.5} penumbra={0.8} color="#6a7aff" distance={40} />
	</>
);

/* 10. "Well, everyone except the old mayor." — newspaper slam */
const S10: React.FC<SP> = ({t, p, gt}) => {
	const slam = 0.5;
	const u = seg(t, 0.2, slam, (x) => x * x);
	const paperPos: V3 = t < slam ? lerp3([0, 5.6, -4.2], [0, 3.24, -2.6], u) : [0, 3.24, -2.6];
	const paperRot: V3 = t < slam ? [lerp(-0.3, 0, u), 0, lerp(0.25, 0.04, u)] : [0, 0, 0.04];
	const armsUp = t < slam;
	return (
		<>
			<DarkLight />
			<DarkOffice />
			<Person look={OLD_MAYOR} t={t} seed={7} expr="angry" position={[0, 0, -5.4]} pose={{armL: armsUp ? [-2.0 + u * 1.0, 0, 0.25] : [-0.9, 0, 0.1], armR: armsUp ? [-2.0 + u * 1.0, 0, -0.25] : [-0.9, 0, -0.1], lean: armsUp ? 0 : 0.18}} />
			<group position={paperPos} rotation={paperRot}>
				<Paper position={[0, 0, 0]} w={3.0} tex={newspaperTex()} glow={0.55} />
			</group>
			<Cam pos={lerp3([0.4, 9.2, 3.4], [0.3, 8.6, 2.6], smooth(p))} look={[0, 3.8, -3.2]} frameY={0.5} fov={42} t={gt} shake={t > slam && t < slam + 0.2 ? 0.7 : 0} />
		</>
	);
};

/* 10a. Grumpy close-up in lamp light */
const S10a: React.FC<SP> = ({t, p, gt}) => (
	<>
		<DarkLight />
		<DarkOffice />
		<Paper position={[0, 3.24, -2.6]} rotation={[0, 0.04, 0]} w={3.0} tex={newspaperTex()} glow={0.55} />
		<Person look={OLD_MAYOR} t={t} seed={7} expr="angry" position={[0, 0, -5.4]} pose={{armL: [-0.9, 0, 0.1], armR: [-0.9, 0, -0.1], lean: 0.18, headPitch: -0.12}} />
		<Cam pos={lerp3([1.0, 5.4, -0.8], [0.8, 5.5, -1.6], smooth(p))} look={[0, 5.5, -5.0]} frameY={0.38} fov={32} t={gt} />
	</>
);

/* ---------- Town meeting ---------- */

const MEET_DOG: V3 = [0, 4.8, -10.6];
const MEET_DOG_HEAD: V3 = [0, 4.8 + 2.84, -10.1];

const MeetingScene: React.FC<{t: number; dogEmo?: 'normal' | 'shocked' | 'sad'; turn?: number}> = ({t, dogEmo = 'normal', turn = 0}) => (
	<MeetingRoom>
		{/* Biscuit on a chair + books behind the long table */}
		<Chair position={[0, 1.2, -11.6]} color="#2a5bd7" />
		<BookStack position={[0, 3.35, -11.1]} n={3} seed="mt" w={2.2} />
		<Dog t={t} pose="sit" emotion={dogEmo} position={MEET_DOG} fx={1} />
		{/* rows of seated townspeople, facing the stage (-z) */}
		{[0, 4.2, 8.4, 12.6].map((z, r) =>
			[-12.4, -9.2, -6.0, -2.8, 2.8, 6.0, 9.2, 12.4].map((x, c) => {
				const i = r * 8 + c;
				const look = Math.atan2(x, 0) * 0 + (x < 0 ? 1 : -1) * 0.9 * turn;
				return (
					<group key={i}>
						<Chair position={[x, 0, z]} yaw={Math.PI} color={['#c0392b', '#2a5bd7', '#22aa55'][r % 3]} />
						{rnd(`seat${i}`) > 0.2 ? <Person look={townsperson(300 + i)} t={t} seed={300 + i} expr={turn > 0.5 ? 'shocked' : 'neutral'} position={[x, 0.15, z + 0.2]} yaw={Math.PI} pose={{sit: true, headYaw: look}} /> : null}
					</group>
				);
			}),
		)}
	</MeetingRoom>
);

/* 10b. "He stomped into the town meeting and shouted," */
const S10b: React.FC<SP> = ({t, p, gt}) => {
	const z = lerp(16, 3, p);
	const ph = t * Math.PI * 2 * 1.3;
	const stomp = Math.max(0, -Math.cos(ph * 2)) > 0.97 ? 0.35 : 0;
	return (
		<>
			<Lights preset="meeting" center={[0, 3, 0]} size={26} />
			<MeetingScene t={t} turn={seg(t, 0.4, 1.2)} />
			<Person look={OLD_MAYOR} t={t} seed={7} expr="angry" position={[0, 0, z]} yaw={Math.PI} pose={{walk: ph, walkAmp: 0.75, armL: [Math.sin(ph) * 0.7, 0, 0.25], armR: [-Math.sin(ph) * 0.7, 0, -0.25], lean: 0.1}} />
			<Cam pos={lerp3([5, 8.0, -4], [4.2, 7.6, -3.0], smooth(p))} look={[0, 4.6, z]} frameY={0.42} fov={40} t={gt} shake={stomp} />
		</>
	);
};

/* 10c. "A dog can't run a town!" — angry shouting close-up */
const S10c: React.FC<SP> = ({t, p, gt}) => (
	<>
		<Lights preset="meeting" center={[0, 3, 0]} size={26} />
		<MeetingScene t={t + 3} turn={1} />
		<Person look={OLD_MAYOR} t={t} seed={7} expr="angry" talking position={[0, 0, 2.2]} yaw={Math.PI} pose={{armL: [-0.4, 0, 0.5 + Math.sin(t * 6) * 0.2], armR: [-1.2 + Math.sin(t * 7) * 0.3, 0, -0.4], lean: 0.12}} />
		<Cam pos={lerp3([0.8, 4.3, -2.6], [0.6, 4.4, -1.8], smooth(p))} look={[0, MAYOR_H, 2.2]} frameY={0.38} fov={34} t={gt} shake={0.12} />
	</>
);

/* 10d. "Kick him out!" — over the shoulder, pointing at Biscuit */
const S10d: React.FC<SP> = ({t, p, gt}) => (
	<>
		<Lights preset="meeting" center={[0, 3, -6]} size={26} />
		<MeetingScene t={t + 5} dogEmo="shocked" turn={1} />
		<Person look={OLD_MAYOR} t={t} seed={7} expr="angry" talking position={[0.6, 0, 2.2]} yaw={Math.PI} pose={{armR: [-1.62, 0, 0.1], armL: [-0.2, 0, 0.3], lean: 0.08}} />
		<Cam pos={lerp3([2.8, 6.6, 6.4], [2.4, 6.9, 5.2], smooth(p))} look={MEET_DOG_HEAD} frameY={0.36} fov={28} t={gt} />
	</>
);

/* 11. "Biscuit put his ears down." — sad close-up */
const S11: React.FC<SP> = ({t, p, gt}) => (
	<>
		<Lights preset="meeting" center={[0, 5, -9]} size={20} />
		<MeetingScene t={t + 7} dogEmo="sad" turn={1} />
		<Cam pos={lerp3([0.9, 8.0, -3.8], [0.7, 7.9, -4.8], smooth(p))} look={MEET_DOG_HEAD} frameY={0.37} fov={32} t={gt} />
	</>
);

/* 11b. "I think he understood." — me, sad */
const S11b: React.FC<SP> = ({t, p, gt}) => (
	<>
		<Lights preset="meeting" center={[-16, 4, 4]} size={20} />
		<MeetingScene t={t + 9} dogEmo="sad" turn={1} />
		<Me position={[-17.5, 1.6, 4]} t={t} view="close" mood="sad" glow={0.4} />
		<Cam pos={lerp3([-16.9, 5.3, 10.8], [-17.0, 5.2, 10.0], smooth(p))} look={[-17.5, 4.85, 4]} frameY={0.36} fov={32} t={gt} />
	</>
);

/* ---------- Night ---------- */

/* 12. "But that same night," */
const S12: React.FC<SP> = ({t, p, gt}) => (
	<>
		<TownKit t={t} time="night" center={[0, 0, 0]} size={60} />
		<Cam pos={lerp3([-34, 14, 74], [-28, 12, 64], smooth(p))} look={[0, 9, 0]} frameY={0.45} fov={46} t={gt} sway={0.06} />
	</>
);

const Searcher: React.FC<{i: number; t: number; pos: V3; yaw: number; aim: V3; police?: boolean; light?: boolean; sweep?: number}> = ({i, t, pos, yaw, aim, police, light = true, sweep = 0}) => {
	const pose: Pose = {armR: [-1.45, 0, -0.1], headPitch: 0.05};
	const tip: V3 = [pos[0] + Math.sin(yaw) * 1.6 - Math.cos(yaw) * 0.5, 3.9, pos[2] + Math.cos(yaw) * 1.6 + Math.sin(yaw) * 0.5];
	const tgt: V3 = [aim[0] + Math.sin(t * 1.1 + i) * sweep, aim[1], aim[2]];
	return (
		<>
			<Person look={police ? POLICE : townsperson(400 + i)} t={t} seed={400 + i} expr="worried" position={pos} yaw={yaw} pose={pose} holdR={<Flashlight rotation={[Math.PI / 2, 0, 0]} />} />
			<Beam from={tip} to={tgt} light={light} len={30} />
		</>
	);
};

const NightEdgeLights: React.FC = () => (
	<>
		<Sky preset="night" stars moon={[-200, 300, -600]} />
		<Lights preset="forest" center={[0, 0, 0]} size={40} />
	</>
);

/* 12b. "a little girl got lost in the forest." — worried mom, police lights, flashlights */
const S12b: React.FC<SP> = ({t, p, gt}) => (
	<>
		<NightEdgeLights />
		<ForestEdge t={gt}>
			<Person look={MOM} t={t} seed={12} expr="worried" talking position={[0, 0, 2]} yaw={Math.PI} pose={{armL: [-0.6, 0, 0.6], armR: [-0.6, 0, -0.6]}} />
			<Searcher i={0} t={t} pos={[-5, 0, 5]} yaw={Math.PI - 0.2} aim={[-6, 2, -30]} police light={false} sweep={4} />
			<Searcher i={1} t={t} pos={[5.5, 0, 6]} yaw={Math.PI + 0.25} aim={[8, 2, -30]} sweep={4} />
			<Searcher i={2} t={t} pos={[10, 0, 10]} yaw={Math.PI + 0.3} aim={[14, 2, -30]} light={false} sweep={3} />
		</ForestEdge>
		<Cam pos={lerp3([-1.5, 4.8, -10], [-1.2, 4.9, -8.4], smooth(p))} look={[0, 4.6, 2]} frameY={0.4} fov={38} t={gt} />
	</>
);

/* Deep forest set */
const DeepForest: React.FC<{t: number; girl?: boolean; children?: React.ReactNode}> = ({t, girl = true, children}) => (
	<>
		<Sky preset="night" stars moon={[-120, 260, -500]} />
		<Lights preset="forest" center={[0, 0, -62]} size={30} />
		<mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -60]} receiveShadow material={plastic('#1e3326', {rough: 0.95})}>
			<planeGeometry args={[400, 400]} />
		</mesh>
		<PineForest n={60} radius={60} clear={7} seed="deep" center={[0, 0, -66]} />
		<BigTree position={[0, 0, -70]} />
		<FogBank t={t} n={26} area={[50, 40]} center={[0, 0, -55]} y={1.5} opacity={0.3} />
		{/* moonlight shafts */}
		<Beam from={[-8, 40, -80]} to={[-2, 0, -64]} light={false} len={44} width={5} color="#9fb4ff" k={0.7} />
		<Beam from={[12, 40, -70]} to={[6, 0, -50]} light={false} len={44} width={4} color="#9fb4ff" k={0.5} />
		<pointLight position={[0, 6, -60]} intensity={25} distance={20} color="#8fa8ff" />
		{girl ? null : null}
		{children}
	</>
);

const GIRL_SIT: V3 = [0.6, 0, -66.6];

/* 12c. "It was dark." */
const S12c: React.FC<SP> = ({t, p, gt}) => (
	<>
		<DeepForest t={t} />
		<Cam pos={lerp3([1, 4, -36], [0.6, 3.8, -41], smooth(p))} look={[0, 3.2, -66]} frameY={0.5} fov={44} t={gt} sway={0.08} />
	</>
);

/* 12d. "It was cold." — the girl under the big tree, shivering */
const GirlSitting: React.FC<{t: number; expr: 'worried' | 'happy' | 'laugh'; shiver?: boolean; yaw?: number}> = ({t, expr, shiver = true, yaw = 0}) => {
	const sx = shiver ? Math.sin(t * 60) * 0.025 : 0;
	return <Person look={GIRL} t={t} seed={33} expr={expr} hold="teddy" position={[GIRL_SIT[0] + sx, GIRL_SIT[1], GIRL_SIT[2]]} yaw={yaw} scale={0.66} pose={{sit: true, bob: -2.0, armL: [-0.9, 0, 0.5], armR: [-0.9, 0, -0.5], headPitch: expr === 'worried' ? 0.15 : -0.1}} />;
};
const S12d: React.FC<SP> = ({t, p, gt}) => (
	<>
		<DeepForest t={t + 2} />
		<GirlSitting t={t} expr="worried" />
		<pointLight position={[2, 3, -63]} intensity={14} distance={10} color="#9fb4ff" />
		<Cam pos={lerp3([1.4, 2.6, -60.6], [1.1, 2.4, -61.6], smooth(p))} look={[GIRL_SIT[0], 1.9, GIRL_SIT[2]]} frameY={0.38} fov={34} t={gt} />
	</>
);

/* 12e. "And nobody could find her." — beams sweeping through fog */
const S12e: React.FC<SP> = ({t, p, gt}) => (
	<>
		<DeepForest t={t + 4} />
		<Searcher i={3} t={t} pos={[-4, 0, -36]} yaw={Math.PI - 0.15} aim={[-8, 1, -70]} sweep={10} />
		<Searcher i={4} t={t} pos={[5, 0, -34]} yaw={Math.PI + 0.2} aim={[8, 1, -70]} sweep={10} light={false} />
		<Searcher i={5} t={t} pos={[1, 0, -30]} yaw={Math.PI} aim={[0, 1, -70]} sweep={12} light={false} police />
		<Cam pos={lerp3([2, 5.5, -22], [1.5, 5.4, -25], smooth(p))} look={[0, 3.5, -45]} frameY={0.48} fov={42} t={gt} />
	</>
);

/* 13. "Biscuit put his nose to the ground" */
const S13: React.FC<SP> = ({t, p, gt}) => (
	<>
		<NightEdgeLights />
		<ForestEdge t={gt}>
			<Searcher i={6} t={t} pos={[3.5, 0, 0]} yaw={Math.PI + 0.5} aim={[0.5, 0, -7]} light />
		</ForestEdge>
		<Dog t={t} pose="sniff" emotion="brave" position={[lerp(0.8, -0.4, p), 0, lerp(-5.5, -7, p)]} yaw={Math.PI - 0.6} medal fx={1} />
		<Cam pos={lerp3([-3.4, 2.2, -12.5], [-3.0, 2.0, -12.0], smooth(p))} look={[0.4, 1.7, -6.8]} frameY={0.38} fov={34} t={gt} />
	</>
);

/* 13b. "and ran into the trees." */
const S13b: React.FC<SP> = ({t, p, gt}) => {
	const z = lerp(-8, -30, p);
	return (
		<>
			<NightEdgeLights />
			<ForestEdge t={gt}>
				<FogBank t={t} n={22} area={[40, 30]} center={[0, 0, -28]} y={1.2} opacity={0.3} />
				<Beam from={[-6, 4, -2]} to={[-1, 0.5, -24]} light={false} len={30} />
				<Beam from={[6, 4, -1]} to={[2, 0.5, -26]} light len={30} />
			</ForestEdge>
			<Dog t={t} pose="run" emotion="brave" position={[0, 0, z]} yaw={Math.PI} medal fx={0.8} />
			<Cam pos={[4.8, 2.4, z + 6.5 + p * 4]} look={[0, 2.2, z - 1]} frameY={0.45} fov={40} t={gt} sway={0.1} />
		</>
	);
};

/* 14. "We waited." — me and the mom at the forest edge */
const S14: React.FC<SP> = ({t, p, gt}) => (
	<>
		<NightEdgeLights />
		<ForestEdge t={gt}>
			<Person look={MOM} t={t} seed={12} expr="worried" position={[2.0, 0, 3.8]} yaw={Math.PI} pose={{armL: [-0.5, 0, 0.5], armR: [-0.5, 0, -0.5]}} />
			<Searcher i={7} t={t} pos={[7, 0, 6]} yaw={Math.PI + 0.3} aim={[9, 2, -30]} police light={false} />
			<Searcher i={8} t={t} pos={[-7, 0, 7]} yaw={Math.PI - 0.3} aim={[-9, 2, -30]} light={false} />
		</ForestEdge>
		<Me position={[-1.8, 0, 3.8]} yaw={Math.PI} t={t} glow={0.32} />
		<pointLight position={[0, 6, -2]} intensity={30} distance={14} color="#b0c4ff" />
		<Cam pos={lerp3([0.4, 4.6, -7.2], [0.3, 4.5, -6.0], smooth(p))} look={[0, 4.4, 3.8]} frameY={0.42} fov={38} t={gt} />
	</>
);

/* 14b. "One hour. Two hours." — clock spins at night */
const S14b: React.FC<SP> = ({t, p, gt}) => {
	const hrs = 9 + 2 * easeOut(seg(t, 0.1, 2.3, (x) => x));
	const h = Math.floor(hrs);
	return (
		<>
			<TownKit t={t} time="night" center={[0, 20, -10]} size={30} clock={[h, (hrs - h) * 60]} />
			<Cam pos={lerp3([0.6, 25.4, 6], [0.4, 25.8, 2.5], smooth(p))} look={[0, 26.6, -8.8]} frameY={0.42} fov={34} t={gt} />
		</>
	);
};

/* 14c. "Then we heard a bark." — Biscuit finds her, licks her face, she smiles */
const DOG_FIND: V3 = [-1.9, 0, -65.6];
const S14c: React.FC<SP> = ({t, p, gt}) => {
	const lick = t > 0.7 && t < 1.6 ? Math.abs(Math.sin((t - 0.7) * 9)) : 0;
	return (
		<>
			<DeepForest t={t + 6} />
			<GirlSitting t={t} expr={t > 0.95 ? 'laugh' : 'worried'} shiver={t < 0.9} yaw={-0.35} />
			<Dog t={t} pose="stand" emotion={t > 0.95 ? 'happy' : 'brave'} position={DOG_FIND} yaw={1.05} lick={lick} headPitch={0.12} medal fx={1} />
			<SpeechBubble text="WOOF!" position={[-2.6, 5.4, -65.2]} w={2.6} k={easeOut(seg(t, 0.0, 0.18)) * (t < 0.9 ? 1 : Math.max(0, 1 - (t - 0.9) * 5))} />
			<pointLight position={[0, 4, -60]} intensity={30} distance={14} color="#ffe2b0" />
			<Cam pos={lerp3([-0.6, 3.6, -58.2], [-0.5, 3.4, -59.2], smooth(p))} look={[-0.6, 2.4, -66]} frameY={0.42} fov={36} t={gt} />
		</>
	);
};

/* 14d. "It was Biscuit." — hero shot out of the fog */
const S14d: React.FC<SP> = ({t, p, gt}) => {
	const z = lerp(-17, -13.5, p);
	return (
		<>
			<NightEdgeLights />
			<ForestEdge t={gt}>
				<FogBank t={t} n={24} area={[40, 20]} center={[0, 0, -18]} y={1.0} opacity={0.32} />
				<Beam from={[-5, 3.6, 2]} to={[0, 2, z]} light len={24} />
				<Beam from={[5, 3.6, 3]} to={[0.5, 2.5, z]} light={false} len={24} />
			</ForestEdge>
			<Glow position={[0, 4, z - 3]} size={12} color="#bcd0ff" opacity={0.45} />
			<Dog t={t} pose="walk" emotion="proud" position={[0, 0, z]} speed={0.6} medal fx={0.8} />
			<Cam pos={[0.6, 1.3, -6.2]} look={[0, 2.9, z + 1.4]} frameY={0.36} fov={40} t={gt} />
		</>
	);
};

/* 15. "And the little girl was holding on to his collar." */
const WalkOut: React.FC<{t: number; z: number; expr: 'happy' | 'laugh'}> = ({t, z, expr}) => {
	const ph = t * Math.PI * 2 * 1.2;
	return (
		<>
			<Dog t={t} pose="walk" emotion="happy" position={[-0.9, 0, z]} speed={0.8} medal fx={0.7} />
			<Person look={GIRL} t={t} seed={33} expr={expr} hold="teddy" position={[0.75, 0, z + 0.7]} scale={0.66} pose={{walk: ph, walkAmp: 0.45, armL: [-0.35, 0, 0.75], armR: [-0.9, 0, -0.5]}} />
		</>
	);
};
const S15: React.FC<SP> = ({t, p, gt}) => {
	const z = lerp(-15, -9, p);
	return (
		<>
			<NightEdgeLights />
			<ForestEdge t={gt}>
				<FogBank t={t} n={18} area={[40, 16]} center={[0, 0, -20]} y={1.0} opacity={0.25} />
				<Beam from={[-4, 3.6, 2]} to={[0, 1.5, z]} light len={20} />
			</ForestEdge>
			<WalkOut t={t} z={z} expr="happy" />
			<Cam pos={[2.8, 3.4, z + 8.6]} look={[0, 2.2, z + 0.6]} frameY={0.42} fov={36} t={gt} />
		</>
	);
};

/* 15b. close-up: her smile + teddy, Biscuit beside */
const S15b: React.FC<SP> = ({t, p, gt}) => {
	const z = lerp(-9, -7.6, p);
	return (
		<>
			<NightEdgeLights />
			<ForestEdge t={gt}>
				<Beam from={[-4, 3.6, 3]} to={[0, 2, z]} light len={18} />
			</ForestEdge>
			<WalkOut t={t + 2} z={z} expr="laugh" />
			<Cam pos={[1.9, 2.9, z + 4.6]} look={[0.3, 2.4, z + 0.7]} frameY={0.4} fov={36} t={gt} />
		</>
	);
};

/* 15c. "Her mom ran to her" */
const S15c: React.FC<SP> = ({t, p, gt}) => {
	const z = lerp(14, 2, easeOut(p));
	return (
		<>
			<NightEdgeLights />
			<ForestEdge t={gt}>
				<Person look={MOM} t={t} seed={12} expr="cryHappy" position={[0.5, 0, z]} yaw={Math.PI} pose={{walk: t * 15, run: true, lean: 0.15}} />
				<Searcher i={9} t={t} pos={[-6, 0, 10]} yaw={Math.PI - 0.2} aim={[-2, 1, -8]} />
			</ForestEdge>
			<Me position={[5, 0, 11]} yaw={Math.PI + 0.3} t={t} glow={0.32} />
			<Cam pos={[0.8, 3.2, -9]} look={[0.5, 4.2, z]} frameY={0.42} fov={36} t={gt} />
		</>
	);
};

/* 15d. "and hugged her so tight." */
const S15d: React.FC<SP> = ({t, p, gt}) => (
	<>
		<NightEdgeLights />
		<ForestEdge t={gt}>
			<Searcher i={10} t={t} pos={[-6, 0, 6]} yaw={Math.PI - 0.4} aim={[-1, 1, -4]} />
			{[0, 1, 2, 3].map((i) => (
				<Person key={i} look={townsperson(500 + i)} t={t} seed={500 + i} expr="laugh" position={[3 + i * 2.6, 0, 7 + (i % 2) * 2]} yaw={Math.PI + 0.3} pose={{armL: [0, 0, 2.6 + Math.sin(t * 9 + i) * 0.25], armR: [0, 0, -2.6], bob: Math.abs(Math.sin(t * 7 + i)) * 0.3}} />
			))}
		</ForestEdge>
		<Me position={[-3.2, 0, 4]} yaw={Math.PI + 0.5} t={t} glow={0.32} bob={Math.abs(Math.sin(t * 7)) * 0.2} />
		<Person look={GIRL} t={t} seed={33} expr="laugh" hold="teddy" position={[0, 0, -1.2]} scale={0.66} pose={{armL: [-0.9, 0, 0.5], armR: [-0.9, 0, -0.5]}} />
		<Person look={MOM} t={t} seed={12} expr="cryHappy" position={[0, 0, 0.2]} yaw={Math.PI} pose={{kneel: 1, lean: 0.3, armL: [-1.45, 0, -0.55], armR: [-1.45, 0, 0.55]}} />
		<Dog t={t} pose="sit" emotion="happy" position={[-2.4, 0, -1.6]} yaw={0.5} medal fx={1} />
		<Cam pos={lerp3([3.4, 4.2, -7.0], [2.8, 4.0, -6.2], smooth(p))} look={[-0.4, 2.6, -0.6]} frameY={0.42} fov={38} t={gt} />
	</>
);

export const ACT3: ShotDef[] = [
	{id: 's10', start: 56.3, end: 57.7, C: S10, fx: DARK_FX},
	{id: 's10a', start: 57.7, end: 59.4, C: S10a, fx: DARK_FX},
	{id: 's10b', start: 59.4, end: 62.0, C: S10b, fx: MEETING_FX},
	{id: 's10c', start: 62.0, end: 63.88, C: S10c, fx: MEETING_FX},
	{id: 's10d', start: 63.88, end: 64.96, C: S10d, fx: MEETING_FX, whipIn: true},
	{id: 's11', start: 64.96, end: 66.78, C: S11, fx: MEETING_FX},
	{id: 's11b', start: 66.78, end: 68.38, C: S11b, fx: MEETING_FX},
	{id: 's12', start: 68.38, end: 69.88, C: S12, fx: NIGHT_FX},
	{id: 's12b', start: 69.88, end: 72.26, C: S12b, fx: FOREST_FX},
	{id: 's12c', start: 72.26, end: 73.34, C: S12c, fx: FOREST_FX},
	{id: 's12d', start: 73.34, end: 74.56, C: S12d, fx: FOREST_FX},
	{id: 's12e', start: 74.56, end: 76.28, C: S12e, fx: FOREST_FX},
	{id: 's13', start: 76.28, end: 78.08, C: S13, fx: FOREST_FX},
	{id: 's13b', start: 78.08, end: 80.44, C: S13b, fx: FOREST_FX},
	{id: 's14', start: 80.44, end: 81.52, C: S14, fx: FOREST_FX},
	{id: 's14b', start: 81.52, end: 83.94, C: S14b, fx: NIGHT_FX},
	{id: 's14c', start: 83.94, end: 85.82, C: S14c, fx: FOREST_FX},
	{id: 's14d', start: 85.82, end: 86.84, C: S14d, fx: FOREST_FX},
	{id: 's15', start: 86.84, end: 88.9, C: S15, fx: FOREST_FX},
	{id: 's15b', start: 88.9, end: 90.34, C: S15b, fx: FOREST_FX},
	{id: 's15c', start: 90.34, end: 91.6, C: S15c, fx: FOREST_FX},
	{id: 's15d', start: 91.6, end: 93.44, C: S15d, fx: FOREST_FX},
];

export {litTex, keys, rnd};
