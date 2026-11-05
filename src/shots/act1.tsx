import React from 'react';
import {GIRL, OLD_MAYOR, REPORTER, townsperson} from '../characters/cast';
import {Dog} from '../characters/Dog';
import {Me} from '../characters/Me';
import {CameraProp, Person} from '../characters/Person';
import {V3, easeOut, keys, keys3, lerp, lerp3, rnd, seg, smooth} from '../lib/anim';
import {POPPINS} from '../lib/fonts';
import {Cam} from '../three/Cam';
import {boxGeo, litTex, planeGeo, plastic, rboxGeo} from '../three/cache';
import {Box, Lights, RBox, Sky} from '../three/prims';
import {canvasTex, noiseTex} from '../three/textures';
import {BallotBox, Banner, Flash, Podium, ResultsBoard, Table, VotingBooth} from '../sets/props';
import {Crowd, DAY_FX, SP, ShotDef, TownKit, Zzz, cheer, laughPose, sleepStand} from './common';

/* Podium layout on the Town Hall steps */
const PODIUM: V3 = [0, 3, -1.8];
const DOG_AT_PODIUM: V3 = [0, 5.4, -3.8];
const DOG_HEAD_PODIUM: V3 = [0, 8.2, -2.4];
const MAYOR_AT_PODIUM: V3 = [0, 3, -3.4];
const MAYOR_HEAD_PODIUM: V3 = [0, 8.3, -3.3];

const PHOTOGRAPHERS: {pos: V3; flashAt: number[]}[] = [
	{pos: [-5.5, 0, 9], flashAt: [0.15, 1.05, 2.2]},
	{pos: [5, 0, 8.5], flashAt: [0.45, 1.6, 2.65]},
	{pos: [-2.2, 0, 11], flashAt: [0.75, 1.9]},
	{pos: [8.5, 0, 11.5], flashAt: [1.25, 2.45]},
	{pos: [-8.8, 0, 12], flashAt: [0.3, 1.4, 2.9]},
];
const flashK = (gt: number, times: number[]) => Math.max(0, ...times.map((ft) => (gt >= ft && gt < ft + 0.22 ? 1 - (gt - ft) / 0.22 : 0)));

const PressScene: React.FC<{t: number; gt: number; dog?: boolean; mayor?: boolean; mayorTalk?: boolean; crowd?: boolean; press?: boolean}> = ({t, gt, dog = true, mayor = false, mayorTalk, crowd = true, press = true}) => (
	<TownKit t={t} center={[0, 3, 0]} size={30} fountain={false}>
		<Podium position={PODIUM} mics={10} />
		{dog ? (
			<>
				<RBox s={[2.6, 2.4, 2.8]} r={0.15} color="#d42a3a" position={[0, 4.2, -4.0]} />
				<Dog t={t} pose="stand" emotion="proud" position={DOG_AT_PODIUM} medal={false} />
			</>
		) : null}
		{mayor ? <Person look={OLD_MAYOR} t={t} expr="bored" talking={mayorTalk} position={MAYOR_AT_PODIUM} seed={7} pose={{armL: [-0.6, 0, 0.2], armR: [-0.7, 0, -0.2], headPitch: 0.05}} /> : null}
		<Banner text={dog ? 'CONGRATS MAYOR BISCUIT!' : 'MAYOR SPEECH TODAY'} position={[0, 18.4, -1.1]} w={14} h={2.2} poles={false} bg={dog ? '#d42a3a' : '#5a6070'} />
		{(press ? PHOTOGRAPHERS : []).map((ph, i) => (
			<group key={i}>
				<Person look={i === 0 ? REPORTER : townsperson(40 + i)} t={t} seed={40 + i} position={ph.pos} yaw={Math.PI + (ph.pos[0] > 0 ? 0.25 : -0.25)} expr="happy" pose={{armL: [-1.4, 0, -0.3], armR: [-1.4, 0, 0.3], headPitch: -0.1}} />
				<CameraProp position={[ph.pos[0] + (ph.pos[0] > 0 ? -0.4 : 0.4), 4.9, ph.pos[2] - 1.3]} rotation={[0.1, Math.PI + (ph.pos[0] > 0 ? 0.25 : -0.25), 0]} />
				{dog ? <Flash position={[ph.pos[0] + (ph.pos[0] > 0 ? -0.5 : 0.5), 5.0, ph.pos[2] - 1.8]} k={flashK(gt, ph.flashAt)} /> : null}
			</group>
		))}
		{crowd ? <Crowd t={t} n={14} seed={3} origin={[0, 0, 16]} cols={7} spacing={[3.2, 3.4]} yaw={Math.PI} expr={dog ? 'laugh' : 'bored'} pose={dog ? (i) => cheer(t, i) : undefined} /> : null}
	</TownKit>
);

/* 1. "My dog just became the mayor…" — low angle push-in to the podium */
const S01: React.FC<SP> = ({t, p, gt}) => (
	<>
		<PressScene t={t} gt={gt} />
		<Cam pos={lerp3([0.9, 6.0, 15], [0.5, 7.2, 9.5], smooth(p))} look={DOG_HEAD_PODIUM} frameY={0.35} fov={36} t={gt} />
	</>
);

/* 1b. "…of my town." — proud close-up with sparkles */
const S01b: React.FC<SP> = ({t, p, gt}) => (
	<>
		<PressScene t={t + 1.5} gt={gt} />
		<Cam pos={lerp3([2.4, 8.4, 6.2], [1.8, 8.5, 4.9], smooth(p))} look={DOG_HEAD_PODIUM} frameY={0.36} fov={32} t={gt} />
	</>
);

/* 2. "And honestly," — me, talking to camera in the plaza */
const S02: React.FC<SP> = ({t, p, gt}) => (
	<>
		<TownKit t={t} center={[8, 0, 12]} size={30}>
			<Podium position={PODIUM} mics={10} />
			<Crowd t={t} n={10} seed={5} origin={[-6, 0, 2]} cols={5} expr="happy" yaw={0.3} />
		</TownKit>
		<Me position={[8, 1.6, 12]} t={t} view="close" talking={t > 0.1} />
		<Cam pos={lerp3([8.4, 5.4, 19.6], [8.3, 5.3, 18.6], smooth(p))} look={[8, 4.85, 12]} frameY={0.36} fov={32} t={gt} />
	</>
);

/* 2b. "he's doing better than the last guy." — whip to the old mayor at the podium */
const S02b: React.FC<SP> = ({t, p, gt}) => (
	<>
		<PressScene t={t} gt={gt} dog={false} mayor mayorTalk />
		<Cam pos={lerp3([3.0, 7.6, 10], [2.4, 7.9, 8.2], smooth(p))} look={MAYOR_HEAD_PODIUM} frameY={0.34} fov={34} t={gt} />
	</>
);

/* 3. "The last mayor was so boring." — droning close-up */
const S03: React.FC<SP> = ({t, p, gt}) => (
	<>
		<PressScene t={t + 2} gt={gt} dog={false} mayor mayorTalk />
		<Cam pos={lerp3([1.6, 8.7, 3.6], [1.2, 8.6, 2.6], smooth(p))} look={MAYOR_HEAD_PODIUM} frameY={0.38} fov={30} t={gt} />
	</>
);

/* 3b. Crowd: bored faces, one yawns */
const S03b: React.FC<SP> = ({t, p, gt}) => (
	<>
		<PressScene t={t + 4} gt={gt} dog={false} mayor mayorTalk />
		<Crowd t={t} n={6} seed={11} origin={[0, 0, 8]} cols={6} spacing={[2.9, 3]} yaw={Math.PI} expr={(i) => (i === 2 && t > 0.5 ? 'shocked' : 'bored')} pose={(i) => (i === 2 && t > 0.5 ? {headPitch: -0.3, armL: [-2.6, 0, 0.3]} : {headTilt: Math.sin(t + i) * 0.1})} />
		<Cam pos={lerp3([-1.5, 9.4, -1.2], [1.5, 9.2, -0.8], smooth(p))} look={[0, 4.4, 10]} frameY={0.42} fov={42} t={gt} />
	</>
);

/* 3c. "His speeches were so long," — the speech paper rolls down the steps and across the plaza */
const PAPER_PATH: V3[] = [
	[0, 6.7, -0.75],
	[0, 3.03, -0.75],
	[0, 3.03, -0.6],
	[0, 2.43, -0.6],
	[0, 2.43, 0.8],
	[0, 1.83, 0.8],
	[0, 1.83, 2.2],
	[0, 1.23, 2.2],
	[0, 1.23, 3.6],
	[0, 0.63, 3.6],
	[0, 0.63, 5.0],
	[0, 0.04, 5.0],
	[0, 0.04, 44],
];
const speechTex = () =>
	canvasTex('speech', 128, 512, (ctx, w, h) => {
		ctx.fillStyle = '#fffaf0';
		ctx.fillRect(0, 0, w, h);
		ctx.fillStyle = '#9a9aa8';
		for (let y = 12; y < h; y += 22) ctx.fillRect(14, y, w - 28 - ((y * 7) % 30), 7);
	});
const SpeechPaper: React.FC<{len: number}> = ({len}) => {
	const segs: React.ReactNode[] = [];
	let acc = 0;
	let tip: V3 = PAPER_PATH[0];
	for (let i = 0; i < PAPER_PATH.length - 1 && acc < len; i++) {
		const a = PAPER_PATH[i];
		const b = PAPER_PATH[i + 1];
		const L = Math.hypot(b[1] - a[1], b[2] - a[2]);
		const use = Math.min(L, len - acc);
		const u = use / L;
		const e: V3 = [0, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
		const vertical = Math.abs(b[1] - a[1]) > Math.abs(b[2] - a[2]);
		const mid: V3 = [0, (a[1] + e[1]) / 2, (a[2] + e[2]) / 2];
		segs.push(<mesh key={i} geometry={boxGeo(1.4, vertical ? Math.max(0.01, use) : 0.02, vertical ? 0.02 : Math.max(0.01, use))} material={plastic('#fffaf0', {map: speechTex(), rough: 0.8})} position={mid} receiveShadow castShadow />);
		acc += use;
		tip = e;
	}
	return (
		<group>
			{segs}
			<mesh geometry={rboxGeo(1.45, 0.5, 0.5, 0.24)} material={plastic('#fffaf0')} position={[0, tip[1] + 0.25, tip[2]]} castShadow />
		</group>
	);
};
const S03c: React.FC<SP> = ({t, p, gt}) => (
	<>
		<PressScene t={t + 6} gt={gt} dog={false} mayor mayorTalk crowd={false} press={false} />
		<SpeechPaper len={lerp(6, 52, easeOut(seg(p, 0.05, 1)))} />
		<Cam pos={lerp3([13, 9, 12], [15, 12, 20], smooth(p))} look={lerp3([0, 3.5, 1], [0, 1, 14], smooth(p))} frameY={0.45} fov={44} t={gt} />
	</>
);

/* 3d. "people fell asleep standing up." — sleepy crowd, one tips over */
const S03d: React.FC<SP> = ({t, p, gt}) => {
	const tip = seg(t, 0.9, 1.6, (x) => x * x);
	return (
		<>
			<PressScene t={t + 8} gt={gt} dog={false} mayor mayorTalk crowd={false} press={false} />
			<SpeechPaper len={52} />
			<Crowd t={t} n={8} seed={12} origin={[-2, 0, 10]} cols={4} spacing={[3.0, 3.4]} yaw={Math.PI} expr="sleep" pose={(i) => sleepStand(t, i)} />
			{[[-6.5, 5.6, 10], [-0.5, 5.8, 10.3], [2.8, 5.6, 13.4], [-3.8, 5.7, 13.2]].map((q, i) => (
				<Zzz key={i} position={q as V3} t={t + i * 0.3} />
			))}
			<group position={[6, 0, 11]} rotation={[0, 0, -tip * 1.45]}>
				<Person look={townsperson(77)} t={t} seed={77} expr="sleep" yaw={Math.PI} pose={sleepStand(t, 1)} />
			</group>
			<Cam pos={lerp3([3.5, 6.2, 1.5], [2.8, 6.0, 3.0], smooth(p))} look={[1.2, 4.2, 12]} frameY={0.42} fov={42} t={gt} />
		</>
	);
};

/* 4. "So before the vote," — Town Hall establishing wide, crane up */
const S04: React.FC<SP> = ({t, p, gt}) => (
	<>
		<TownKit t={t} center={[0, 0, 0]} size={60}>
			<Banner text="VOTE SATURDAY!" position={[-8, 9, 30]} w={12} bg="#2a5bd7" />
			<Crowd t={t} n={10} seed={21} origin={[8, 0, 20]} cols={5} spacing={[4, 4]} expr="happy" pose={(i) => ({walk: t * 5 + i, walkAmp: 0.4})} />
		</TownKit>
		<Cam pos={lerp3([-16, 5, 66], [-12, 12, 58], smooth(p))} look={[-2, 13, -6]} frameY={0.42} fov={48} t={gt} sway={0.08} />
	</>
);

/* 4b. "someone wrote my dog's name on the list." — hand writing BISCUIT */
const listTex = (prog: number) => {
	const q = Math.round(Math.min(1, Math.max(0, prog)) * 24) / 24;
	return canvasTex(`list|${q}`, 768, 1024, (ctx, w, h) => {
		ctx.fillStyle = '#fffdf4';
		ctx.fillRect(0, 0, w, h);
		ctx.strokeStyle = '#a8c8ff';
		ctx.lineWidth = 3;
		for (let y = 200; y < h; y += 90) {
			ctx.beginPath();
			ctx.moveTo(40, y);
			ctx.lineTo(w - 40, y);
			ctx.stroke();
		}
		ctx.fillStyle = '#d42a3a';
		ctx.font = `800 70px ${POPPINS}, sans-serif`;
		ctx.textAlign = 'center';
		ctx.fillText('MAYOR VOTE', w / 2, 120);
		ctx.textAlign = 'left';
		ctx.fillStyle = '#2a2a3a';
		ctx.font = `600 58px ${POPPINS}, sans-serif`;
		ctx.fillText('1. Old Mayor', 70, 265);
		ctx.fillText('2.', 70, 355);
		ctx.save();
		ctx.beginPath();
		ctx.rect(150, 280, 560 * q, 120);
		ctx.clip();
		ctx.fillStyle = '#1f3ad0';
		ctx.font = `italic 800 74px ${POPPINS}, sans-serif`;
		ctx.fillText('BISCUIT', 160, 358);
		ctx.restore();
		if (q >= 1) {
			ctx.strokeStyle = '#ff4f7a';
			ctx.lineWidth = 6;
			ctx.beginPath();
			ctx.arc(640, 335, 30, 0, Math.PI * 2);
			ctx.stroke();
		}
	});
};
const S04b: React.FC<SP> = ({t, p, gt}) => {
	const prog = seg(t, 0.25, 2.1, (x) => x);
	const penX = -1.35 + prog * 2.7;
	const penBob = Math.sin(t * 30) * 0.05;
	return (
		<>
			<Sky preset="day" />
			<Lights preset="day" center={[0, 0, 0]} size={8} />
			<mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={plastic('#ffffff', {map: noiseTex('woodT', '#c08050', '#8a5030', 'wood', 3), rough: 0.5})}>
				<planeGeometry args={[30, 30]} />
			</mesh>
			{/* clipboard */}
			<RBox s={[4.4, 0.12, 5.8]} r={0.05} color="#9a6a3a" position={[0, 0.06, 0]} />
			<mesh geometry={planeGeo(3.9, 5.2)} material={litTex(listTex(prog), 0.3, {transparent: false})} position={[0, 0.14, 0.15]} rotation={[-Math.PI / 2, 0, 0]} />
			<RBox s={[1.6, 0.3, 0.5]} r={0.08} mat={plastic('#c8ccd6', {metal: 0.8, rough: 0.25})} position={[0, 0.25, -2.65]} />
			{/* hand + pencil */}
			<group position={[penX + 0.25, 0.75 + penBob, -0.1]} rotation={[0, 0, 0.35]} scale={0.6}>
				<Box s={[0.12, 1.7, 0.12]} color="#ffcc22" position={[-0.35, -0.2, 0.2]} rotation={[0.25, 0, -0.35]} />
				<RBox s={[0.75, 0.6, 0.75]} r={0.12} color="#e8b48a" position={[0, 0.25, 0.4]} />
				<RBox s={[0.85, 2.6, 0.85]} r={0.12} color="#3a6ad0" position={[0.6, 1.6, 0.8]} rotation={[0.5, 0, -0.3]} />
			</group>
			<Cam pos={lerp3([0.4, 8.6, 4.6], [0.3, 7.8, 3.9], smooth(p))} look={[0, 0, -0.4]} frameY={0.4} fov={38} t={gt} sway={0.02} />
		</>
	);
};

/* 4c. "Biscuit." — head tilt, ears bounce (before he was mayor: no outfit) */
const S04c: React.FC<SP> = ({t, gt}) => (
	<>
		<TownKit t={t} center={[6, 0, 26]} size={20} fountain={false} />
		<Dog t={t} pose="sit" emotion="happy" position={[6, 0, 26]} sash={false} hat={false} bowtie={false} headTilt={Math.sin(Math.min(1, t * 2.5) * Math.PI * 0.5) * 0.35} fx={0} />
		<Cam pos={[6.6, 3.4, 33.8]} look={[6, 2.9, 26.5]} frameY={0.36} fov={30} t={gt} />
	</>
);

/* 4d. "As a joke." — people giggling */
const S04d: React.FC<SP> = ({t, p, gt}) => (
	<>
		<TownKit t={t} center={[-6, 0, 20]} size={20} fountain={false} />
		<Crowd t={t} n={3} seed={31} origin={[-6, 0, 20]} cols={3} spacing={[2.9, 3]} expr="laugh" pose={(i) => laughPose(t, i)} />
		<Cam pos={lerp3([-5.4, 5.8, 33], [-5.6, 5.6, 31.5], smooth(p))} look={[-6, 4.6, 20]} frameY={0.42} fov={36} t={gt} />
	</>
);

/* 5. "Then voting day came." — booths + line */
const VotingSet: React.FC<{t: number}> = ({t}) => (
	<>
		<Banner text="VOTE TODAY!" position={[0, 9.5, 8]} w={14} bg="#d42a3a" />
		{[-8, 0, 8].map((x, i) => (
			<VotingBooth key={x} position={[x, 0, 10]} color={['#2a5bd7', '#22aa55', '#ff7a1a'][i]} curtain={0.7 + 0.3 * Math.sin(t * 2 + i)} />
		))}
		<Table position={[0, 0, 20]} w={7} d={3} cloth="#2a5bd7" />
		<BallotBox position={[0, 2.72, 20]} />
	</>
);
const S05: React.FC<SP> = ({t, p, gt}) => (
	<>
		<TownKit t={t} center={[0, 0, 14]} size={30} fountain={false}>
			<VotingSet t={t} />
			<Crowd t={t} n={8} seed={41} origin={[-12, 0, 18]} cols={1} spacing={[0, 2.6]} yaw={Math.PI / 2 - 0.2} expr={(i) => (i % 3 ? 'happy' : 'laugh')} pose={(i) => ({walk: i * 0.7 + t * 2, walkAmp: 0.15})} />
			<Crowd t={t} n={6} seed={42} origin={[12, 0, 26]} cols={3} spacing={[3, 3]} yaw={-Math.PI / 2} expr="happy" talking />
		</TownKit>
		<Cam pos={lerp3([17, 10, 50], [14, 11, 46], smooth(p))} look={[0, 4.5, 16]} frameY={0.45} fov={44} t={gt} />
	</>
);

/* 5b. "Everyone laughed." */
const S05b: React.FC<SP> = ({t, p, gt}) => (
	<>
		<TownKit t={t} center={[0, 0, 26]} size={20} fountain={false}>
			<VotingSet t={t} />
		</TownKit>
		<Crowd t={t} n={4} seed={51} origin={[0, 0, 27]} cols={4} spacing={[2.8, 3]} expr="laugh" pose={(i) => (i === 1 ? {armR: [-1.5, 0, 0.2], ...laughPose(t, i), armL: [-0.4, 0, 0.6]} : laughPose(t, i))} />
		<Cam pos={lerp3([1, 5.8, 38], [0.6, 5.6, 36.5], smooth(p))} look={[0, 4.7, 27]} frameY={0.42} fov={38} t={gt} />
	</>
);

/* 5c. "And then everyone voted for him." — ballots dropping into the box */
const ballotTex = () =>
	canvasTex('ballot', 256, 192, (ctx, w, h) => {
		ctx.fillStyle = '#ffffff';
		ctx.fillRect(0, 0, w, h);
		ctx.strokeStyle = '#2a2a3a';
		ctx.lineWidth = 4;
		ctx.strokeRect(20, 30, 36, 36);
		ctx.strokeRect(20, 110, 36, 36);
		ctx.fillStyle = '#2a2a3a';
		ctx.font = `600 32px ${POPPINS}, sans-serif`;
		ctx.fillText('Old Mayor', 70, 60);
		ctx.fillText('Biscuit', 70, 140);
		ctx.strokeStyle = '#1f3ad0';
		ctx.lineWidth = 8;
		ctx.beginPath();
		ctx.moveTo(16, 106);
		ctx.lineTo(60, 150);
		ctx.moveTo(60, 106);
		ctx.lineTo(16, 150);
		ctx.stroke();
	});
const S05c: React.FC<SP> = ({t, p, gt}) => (
	<>
		<TownKit t={t} center={[0, 0, 20]} size={14} fountain={false}>
			<VotingSet t={t} />
		</TownKit>
		{Array.from({length: 7}).map((_, i) => {
			const t0 = i * 0.3;
			const u = seg(t, t0, t0 + 0.55, (x) => x * x);
			if (t < t0 - 0.2 || u >= 1) return null;
			const x = (rnd(`bx${i}`) - 0.5) * 0.3;
			return (
				<group key={i} position={[x, lerp(7.6, 4.6, u), 20 + (rnd(`bz${i}`) - 0.5) * 0.1]} rotation={[Math.PI / 2 - 0.05, 0, (rnd(`br${i}`) - 0.5) * 0.4 * (1 - u)]}>
					<mesh geometry={planeGeo(1.2, 0.9)} material={litTex(ballotTex(), 0.35, {transparent: false, side: 2})} />
				</group>
			);
		})}
		{[0, 1, 2].map((i) => (
			<group key={`h${i}`} position={[lerp(-2.5, 2.5, i / 2), 8.3 + Math.max(0, Math.sin(t * 5 + i)) * 0.4, 20.6]}>
				<RBox s={[0.8, 2.4, 0.8]} r={0.12} color={['#ff6b6b', '#4d96ff', '#6bcb77'][i]} position={[0, 1.2, 0]} />
				<RBox s={[0.7, 0.4, 0.7]} r={0.12} color={['#f6d3b3', '#9a6440', '#d7a175'][i]} />
			</group>
		))}
		<Crowd t={t} n={5} seed={55} origin={[0, 0, 15]} cols={5} spacing={[3, 3]} yaw={0} expr="happy" />
		<Cam pos={lerp3([2.6, 5.4, 28], [2.1, 5.2, 26.4], smooth(p))} look={[0, 5.2, 20]} frameY={0.42} fov={36} t={gt} />
	</>
);

/* 5d. "Biscuit got 4,000 votes." — results board flips up */
export const RESULTS_AT: V3 = [0, 0, 14];
const countA = (t: number) => {
	const u = easeOut(seg(t, 0.35, 2.0, (x) => x));
	const v = 4000 * u;
	return u >= 1 ? 4000 : Math.round(v / 37) * 37;
};
const ResultsScene: React.FC<{t: number; a: number; b: number; glow?: number; crowdExpr?: 'shocked' | 'laugh'; crowdT?: number}> = ({t, a, b, glow = 0, crowdExpr = 'shocked'}) => (
	<TownKit t={t} center={[0, 0, 18]} size={30} fountain={false}>
		<ResultsBoard position={RESULTS_AT} a={a} b={b} glowA={glow} />
		<Crowd t={t} n={14} seed={61} origin={[0, 0, 27]} cols={7} spacing={[3.0, 3.4]} yaw={Math.PI} expr={crowdExpr} pose={crowdExpr === 'laugh' ? (i) => cheer(t, i) : (i) => ({armL: [-0.3, 0, 0.9], armR: [-0.3, 0, -0.9], headPitch: -0.15 + i * 0})} />
	</TownKit>
);
const S05d: React.FC<SP> = ({t, p, gt}) => (
	<>
		<ResultsScene t={t} a={countA(t)} b={0} glow={seg(t, 1.9, 2.3)} />
		<Cam pos={lerp3([0.4, 8.0, 44], [0.2, 8.0, 38], smooth(p))} look={[0, 7.4, 14]} frameY={0.33} fov={42} t={gt} />
	</>
);

/* 5e. "The old mayor got 12." */
const S05e: React.FC<SP> = ({t, p, gt}) => (
	<>
		<ResultsScene t={t + 3} a={4000} b={Math.round(12 * easeOut(seg(t, 0.1, 0.5)))} glow={0.6} />
		<Person look={OLD_MAYOR} t={t} seed={7} expr={t > 0.55 ? 'shocked' : 'bored'} position={[-2.6, 0, 18.5]} yaw={0.35} pose={t > 0.55 ? {armL: [-0.4, 0, 1.0], armR: [-0.4, 0, -1.0], bob: 0.1} : undefined} />
		<Cam pos={lerp3([1.8, 5.8, 25.5], [1.4, 5.6, 24.5], smooth(p))} look={[0.4, 4.6, 15]} frameY={0.3} fov={40} t={gt} />
	</>
);

/* 5f. crowd shocked → cheers */
const S05f: React.FC<SP> = ({t, p, gt}) => (
	<>
		<ResultsScene t={t + 5} a={4000} b={12} glow={1} crowdExpr={t > 0.32 ? 'laugh' : 'shocked'} />
		<Cam pos={lerp3([0, 7.6, 15.4], [0, 7.2, 16.4], smooth(p))} look={[0, 4.6, 29]} frameY={0.45} fov={46} t={gt} />
	</>
);

/* 5g. Biscuit shocked → happy */
const S05g: React.FC<SP> = ({t, gt}) => (
	<>
		<TownKit t={t} center={[3, 0, 22]} size={20} fountain={false}>
			<ResultsBoard position={RESULTS_AT} a={4000} b={12} glowA={1} />
		</TownKit>
		<Dog t={t} pose="sit" emotion={t > 0.32 ? 'happy' : 'shocked'} position={[3, Math.abs(Math.sin(Math.max(0, t - 0.32) * 9)) * 0.35, 22]} yaw={0.15} sash={false} hat={false} bowtie={false} />
		<Cam pos={[3.9, 3.9, 30.6]} look={[3.1, 3.0, 22.6]} frameY={0.36} fov={34} t={gt} />
	</>
);

export const ACT1: ShotDef[] = [
	{id: 's01', start: 0, end: 1.5, C: S01, fx: DAY_FX, flash: ({gt}) => Math.max(...PHOTOGRAPHERS.map((ph) => flashK(gt, ph.flashAt))) * 0.35},
	{id: 's01b', start: 1.5, end: 3.06, C: S01b, fx: DAY_FX, flash: ({gt}) => Math.max(...PHOTOGRAPHERS.map((ph) => flashK(gt, ph.flashAt))) * 0.35},
	{id: 's02', start: 3.06, end: 4.14, C: S02, fx: DAY_FX},
	{id: 's02b', start: 4.14, end: 6.56, C: S02b, fx: DAY_FX, whipIn: true},
	{id: 's03', start: 6.56, end: 8.5, C: S03, fx: DAY_FX},
	{id: 's03b', start: 8.5, end: 10.0, C: S03b, fx: DAY_FX},
	{id: 's03c', start: 10.0, end: 12.0, C: S03c, fx: DAY_FX},
	{id: 's03d', start: 12.0, end: 14.02, C: S03d, fx: DAY_FX},
	{id: 's04', start: 14.02, end: 15.46, C: S04, fx: DAY_FX},
	{id: 's04b', start: 15.46, end: 17.98, C: S04b, fx: DAY_FX},
	{id: 's04c', start: 17.98, end: 18.78, C: S04c, fx: DAY_FX},
	{id: 's04d', start: 18.78, end: 19.98, C: S04d, fx: DAY_FX},
	{id: 's05', start: 19.98, end: 21.48, C: S05, fx: DAY_FX},
	{id: 's05b', start: 21.48, end: 22.68, C: S05b, fx: DAY_FX},
	{id: 's05c', start: 22.68, end: 24.76, C: S05c, fx: DAY_FX},
	{id: 's05d', start: 24.76, end: 28.02, C: S05d, fx: DAY_FX},
	{id: 's05e', start: 28.02, end: 29.4, C: S05e, fx: DAY_FX},
	{id: 's05f', start: 29.4, end: 30.05, C: S05f, fx: DAY_FX, whipIn: true},
	{id: 's05g', start: 30.05, end: 30.82, C: S05g, fx: DAY_FX},
];

export {GIRL, keys, keys3};
