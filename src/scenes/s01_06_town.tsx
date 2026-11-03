// Scenes 1-6: the town in the morning, the tiny bathroom, the clock tower, the Bucket Man.
import React from 'react';
import * as THREE from 'three';
import {Stage, LOOKS, mixLooks} from '../lib/Stage';
import {CameraRig} from '../lib/CameraRig';
import {Character} from '../characters/Character';
import {KID, BUCKET_MAN, makePerson} from '../characters/presets';
import * as P from '../characters/poses';
import {TownStreet, ClockTower, House, houseSpec, LampPost} from '../world/Town';
import {Cloud, SkyDisc, RoundTree} from '../world/Nature';
import {Bucket} from '../props/Bucket';
import {HandBell} from '../props/HandProps';
import {ComicText, LightRays} from '../props/Effects';
import {Sink, Mirror, Towel, Sign} from '../props/Furniture';
import {plastic, rbox, box, plane, glowMat, sphere, cyl} from '../lib/materials';
import {tilesTex, noiseTex} from '../lib/textures';
import {SceneDef, SceneProps, shotIndex, W, amp} from './kit';
import {keys, keys3, easeInOut, easeOut, clamp, lerp, V3} from '../lib/anim';
import {registerWhip, wf, LEAD} from '../timing';

const MORNING = LOOKS.morning;

const SkyBits: React.FC<{sun?: V3}> = ({sun = [-120, 38, -260]}) => (
	<>
		<SkyDisc position={sun} size={9} color="#fff4c8" halo="#ffd08a" intensity={2.2} />
		<Cloud position={[-60, 55, -200]} scale={4} seed={1} />
		<Cloud position={[70, 62, -230]} scale={5} seed={2} />
		<Cloud position={[10, 75, -300]} scale={6} seed={3} />
		<Cloud position={[-110, 48, -120]} scale={3.5} seed={4} />
	</>
);

// ===================================================================== S1
// "My town doesn't have toilets." wide glide down the morning street, then me, shocked, holding up a bucket
const S1: React.FC<SceneProps> = ({f}) => {
	const cut = W(1, 4) - 2; // "toilets"
	const shot = shotIndex(f, [cut]);
	const t = f / 30;
	if (shot === 0) {
		const k = easeInOut(clamp(f / cut));
		return (
			<Stage look={MORNING} focus={[0, 0, 0]} shadowSize={40}>
				<TownStreet lit="day" zFrom={45} zTo={-115} />
				<ClockTower position={[0, 0, -150]} />
				<SkyBits />
				{[0, 1, 2].map((i) => (
					<Character key={i} spec={makePerson(300 + i)} position={[i % 2 ? 7.4 : -7.2, 0.3, 10 - i * 18]} rotation={i % 2 ? Math.PI : 0} pose={P.walk(t + i, 0.9)} lod="low" />
				))}
				<CameraRig pos={[lerp(2, 0.5, k), lerp(19, 7.5, k), lerp(60, 34, k)]} target={[0, lerp(2, 4, k), lerp(-40, -20, k)]} fov={52} sway={0.6} />
			</Stage>
		);
	}
	const fs = f - cut;
	const push = easeOut(clamp(fs / 36));
	return (
		<Stage look={MORNING} focus={[0, 0, 20]} shadowSize={14}>
			<TownStreet lit="day" zFrom={45} zTo={-60} />
			<SkyBits />
			<Character spec={KID} position={[0.8, 0.3, 20]} rotation={0.05} pose={P.holdUp(t, 0.75)} expr="shocked" />
			<Bucket position={[0.8, 2.05, 21.5]} rotation={[-0.4, 0.15, 0]} scale={0.85} handle={0.2} />
			<CameraRig pos={[1.6 - push * 0.3, 2.9, lerp(28.4, 27.0, push)]} target={[0.8, 3.15, 20]} fov={44} sway={1} />
		</Stage>
	);
};

// ===================================================================== S2
// "Not one. Not even a tiny one." tiny bathroom, only a bucket in the corner. push-in.
const Bathroom: React.FC<{frame: number}> = ({frame}) => {
	const wallTiles = plastic('#ffffff', {map: tilesTex('#8fe0d8', '#f4fbfa', [3, 2], 4), rough: 0.35});
	const upper = plastic('#fff1b8', {rough: 0.8});
	const floor = plastic('#ffffff', {map: tilesTex('#5a6fd6', '#e8ecff', [3, 3], 2, 9), rough: 0.4});
	// room: x -4..4, z -4.5..4.5, y 0..9 (open toward +z for the camera)
	return (
		<group>
			<mesh geometry={plane(8, 9)} material={floor} rotation={[-Math.PI / 2, 0, 0]} receiveShadow />
			{/* back wall */}
			<mesh geometry={box(8, 4, 0.3)} material={wallTiles} position={[0, 2, -4.6]} receiveShadow />
			<mesh geometry={box(8, 5, 0.3)} material={upper} position={[0, 6.5, -4.6]} receiveShadow />
			{/* side walls */}
			{[-1, 1].map((sd) => (
				<group key={sd}>
					<mesh geometry={box(0.3, 4, 9.2)} material={wallTiles} position={[sd * 4.1, 2, 0]} receiveShadow />
					<mesh geometry={box(0.3, 5, 9.2)} material={upper} position={[sd * 4.1, 6.5, 0]} receiveShadow />
					<mesh geometry={box(0.34, 0.25, 9.2)} material={plastic('#5a6fd6')} position={[sd * 4.05, 4.0, 0]} />
				</group>
			))}
			<mesh geometry={box(8, 0.25, 0.34)} material={plastic('#5a6fd6')} position={[0, 4.0, -4.45]} />
			<mesh geometry={box(8.6, 0.3, 9.6)} material={plastic('#fffaf0')} position={[0, 9.1, 0]} />
			{/* tiny high window */}
			<group position={[1.6, 6.8, -4.42]}>
				<mesh geometry={plane(1.6, 1.6)} material={glowMat('#cfeeff', 1.5)} />
				<mesh geometry={box(1.9, 0.2, 0.3)} material={plastic('#ffffff')} position={[0, 0.85, 0]} />
				<mesh geometry={box(1.9, 0.2, 0.3)} material={plastic('#ffffff')} position={[0, -0.85, 0]} />
				<mesh geometry={box(0.2, 1.9, 0.3)} material={plastic('#ffffff')} position={[0.85, 0, 0]} />
				<mesh geometry={box(0.2, 1.9, 0.3)} material={plastic('#ffffff')} position={[-0.85, 0, 0]} />
				<mesh geometry={box(0.12, 1.6, 0.2)} material={plastic('#ffffff')} />
			</group>
			{/* sink + mirror + towel */}
			<Sink position={[-3.0, 0, -1.6]} />
			<group rotation={[0, Math.PI / 2, 0]} position={[-3.92, 5.6, -1.6]}>
				<Mirror />
			</group>
			<mesh geometry={sphere(0.25, 12, 10)} material={plastic('#ffd23f', {rough: 0.3})} position={[-2.4, 3.42, -1.2]} />
			<mesh geometry={sphere(0.16, 10, 8)} material={plastic('#ffd23f', {rough: 0.3})} position={[-2.4, 3.72, -1.05]} />
			<group rotation={[0, -Math.PI / 2, 0]} position={[3.92, 5.4, 0.5]}>
				<Towel />
			</group>
			{/* the "toilet": a bucket in the corner, with a sign */}
			<Bucket position={[2.6, 0, -3.3]} rotation={[0, -0.5, 0]} handle={1.2} />
			<Sign position={[2.4, 5.0, -4.42]} text="TOILET" w={2.6} h={0.8} bg="#3d5af1" />
			<mesh geometry={rbox(0.25, 1.5, 0.1, 0.05)} material={plastic('#3d5af1')} position={[2.6, 3.9, -4.4]} />
			<pointLight position={[0, 8.5, 0]} intensity={30} distance={22} color="#fff2d6" decay={1.4} />
			<pointLight position={[2.6, 4, -1]} intensity={12 + Math.sin(frame * 0.2) * 0} distance={8} color="#fff0c8" decay={1.5} />
		</group>
	);
};

const S2: React.FC<SceneProps> = ({f}) => {
	const cut = W(2, 7) - 3; // "Not even"
	const shot = shotIndex(f, [cut]);
	const look = {...LOOKS.interiorDay, sun: 1.2, hemi: 0.6};
	if (shot === 0) {
		const k = easeInOut(clamp(f / cut));
		return (
			<Stage look={look} sky={false} focus={[0, 0, 0]} shadowSize={8}>
				<Bathroom frame={f} />
				{/* doorway frame in the foreground */}
				<mesh geometry={box(0.6, 9, 0.6)} material={plastic('#ffffff')} position={[-3.4, 4.5, 5.6]} />
				<mesh geometry={box(0.6, 9, 0.6)} material={plastic('#ffffff')} position={[3.4, 4.5, 5.6]} />
				<CameraRig pos={[0.4, lerp(5.6, 5.2, k), lerp(9.8, 9.2, k)]} target={[0.4, 3.2, -2]} fov={58} sway={0.8} />
			</Stage>
		);
	}
	const fs = f - cut;
	const k = easeOut(clamp(fs / 40));
	return (
		<Stage look={look} sky={false} focus={[2, 0, -3]} shadowSize={6}>
			<Bathroom frame={f} />
			<pointLight position={[2.6, 3.0, -1.0]} intensity={18 * k} distance={6} color="#fff3c4" decay={1.4} />
			<CameraRig pos={[lerp(0.8, 1.9, k), lerp(1.6, 1.2, k), lerp(4.0, -0.6, k)]} target={[2.6, 0.75, -3.3]} fov={46} sway={0.7} />
		</Stage>
	);
};

// ===================================================================== S3
// "Every morning at 6 AM, the Bucket Man walks down our street." clock tower at 6:00, then low angle Bucket Man
const S3: React.FC<SceneProps> = ({f, g}) => {
	const cut = W(3, 17) - 3; // "the Bucket Man"
	const shot = shotIndex(f, [cut]);
	const t = f / 30;
	if (shot === 0) {
		// minute hand sweeps to 12 just as "6 AM" is said
		const six = W(3, 15);
		const minute = keys(f, [[0, 56.5], [six, 60]], easeOut) % 60;
		const hour = minute < 30 ? 6 : 5;
		const k = easeInOut(clamp(f / cut));
		const look = mixLooks(MORNING, LOOKS.sunset, 0.35);
		return (
			<Stage look={look} focus={[0, 20, -150]} shadowSize={20}>
				<ClockTower position={[0, 0, -150]} hour={hour} minute={minute} />
				<TownStreet lit="day" zFrom={-100} zTo={-140} />
				<SkyDisc position={[-30, 30, -260]} size={10} color="#fff1c4" halo="#ffb070" intensity={2.4} />
				<LightRays frame={f} position={[-30, 30, -255]} size={120} color="#ffcf8a" opacity={0.25} />
				<Cloud position={[40, 60, -230]} scale={5} seed={5} />
				<CameraRig pos={[lerp(6, 4, k), lerp(8, 9.5, k), lerp(-112, -118, k)]} target={[0, 23, -150]} fov={40} sway={0.6} />
			</Stage>
		);
	}
	const fs = f - cut;
	const z = -6 + fs * 0.075;
	const bellSwing = Math.sin(t * 18) * 0.6;
	const ringA = W(3, 18) - 4 - cut;
	const ringB = W(3, 21) + 2 - cut;
	const ringOn = (fs >= ringA && fs < ringA + 14) || (fs >= ringB && fs < ringB + 14);
	return (
		<Stage look={MORNING} focus={[0, 0, z]} shadowSize={18}>
			<TownStreet lit="day" zFrom={45} zTo={-110} />
			<ClockTower position={[0, 0, -150]} />
			<SkyBits sun={[60, 30, -260]} />
			<Character spec={BUCKET_MAN} position={[0, 0, z]} pose={P.withPose(P.walk(t, 0.85), P.ringBell(t))} expr="happy" holdR={<HandBell swing={bellSwing} />} />
			{ringOn ? <ComicText text="RING!" position={[-3.4, 9.2, z + 1]} scale={1.5} rot={0.2} /> : null}
			<CameraRig pos={[2.2, 1.3, z + 16]} target={[0, 4.6, z]} fov={46} sway={1} />
		</Stage>
	);
};
registerWhip(wf(24) - LEAD, 1); // S3 -> S4 whip

// ===================================================================== S4
// "BUCKETS OUT!" extreme close-up, camera shake
const S4: React.FC<SceneProps> = ({f, g}) => {
	const t = f / 30;
	const punch = easeOut(clamp(f / 6));
	return (
		<Stage look={MORNING} focus={[0, 5, 0]} shadowSize={10}>
			<TownStreet lit="day" zFrom={20} zTo={-80} />
			<SkyBits />
			<Character spec={BUCKET_MAN} position={[0, 0, 0]} pose={P.shoutPose(t)} expr="shout" talk={Math.max(0.6, amp(g))} holdR={<HandBell swing={Math.sin(t * 20) * 0.6} />} />
			<CameraRig pos={[0.3, 6.75, lerp(7.2, 5.4, punch)]} target={[0, 6.55, 0]} fov={44} sway={0.5} shake={1.4} />
		</Stage>
	);
};

// ===================================================================== S5
// "And everyone runs outside with their bucket." doors burst open, neighbours in pajamas run out
const S5: React.FC<SceneProps> = ({f}) => {
	const cut = W(5, 28) - 2; // "runs"
	const shot = shotIndex(f, [cut]);
	const t = f / 30;
	if (shot === 0) {
		const open = clamp((f - 6) / 5);
		const run = Math.max(0, f - 9) / 30;
		const spec = houseSpec(41);
		return (
			<Stage look={MORNING} focus={[0, 0, 4]} shadowSize={14}>
				<House spec={spec} position={[0, 0, 0]} doorOpen={open} lit="day" />
				<RoundTree position={[-9, 0, 6]} seed={3} />
				<SkyBits />
				<mesh geometry={plane(80, 80)} material={plastic('#79cf5f', {rough: 0.9})} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow />
				{f > 8 ? (
					<Character spec={makePerson(510, {pajamas: true})} position={[0.2, 0.5, 4.6 + run * 7]} pose={P.panicRun(run)} expr="shocked" holdL={<Bucket position={[0, -1.45, 0]} handle={0} />} holdLUpright />
				) : null}
				<CameraRig pos={[1.2, 2.4, 15]} target={[0, 3.6, 3]} fov={46} shake={f > 6 && f < 14 ? 0.6 : 0} sway={1} />
			</Stage>
		);
	}
	const fs = f - cut;
	const runners = [0, 1, 2, 3, 4, 5, 6, 7];
	return (
		<Stage look={MORNING} focus={[0, 0, -10]} shadowSize={30}>
			<TownStreet lit="day" zFrom={30} zTo={-80} doorOpen={(i) => (i < 8 ? 1 : 0)} />
			<SkyBits />
			<Character spec={BUCKET_MAN} position={[0.5, 0, -24]} rotation={0} pose={P.withPose(P.idle(t), P.ringBell(t))} expr="happy" holdR={<HandBell swing={Math.sin(t * 18) * 0.5} />} />
			{runners.map((i) => {
				const side = i % 2 ? 1 : -1;
				const z0 = 18 - Math.floor(i / 2) * 15 - 2;
				const p = clamp((fs + i * 4) / 60);
				const x = lerp(side * 13, side * 2.5, easeOut(p));
				const spec = makePerson(520 + i, {pajamas: true, kid: i === 3 || i === 6});
				return (
					<Character key={i} spec={spec} position={[x, 0.3, z0 - p * 6]} rotation={side > 0 ? -Math.PI / 2 - 0.5 : Math.PI / 2 + 0.5} pose={P.panicRun(fs / 30 + i * 0.13)} expr={i % 3 === 0 ? 'shocked' : 'worried'} lod="low"
						holdL={<Bucket position={[0, -1.45, 0]} handle={0} />} holdLUpright />
				);
			})}
			<CameraRig pos={[3, 9.5, 34]} target={[0, 2.5, -8]} fov={50} sway={1} />
		</Stage>
	);
};

// ===================================================================== S6
// "Every house has a bucket. Big families have five." buckets at every door; family of five, tallest to smallest
const FAMILY = [
	makePerson(601, {}),
	makePerson(602, {}),
	makePerson(603, {kid: true}),
	makePerson(604, {kid: true}),
	makePerson(605, {kid: true}),
];
FAMILY[0] = {...FAMILY[0], scale: 1.12, hair: 'short', top: '#3d7bff', outfit: 'shirt', pants: '#2d2d3a', skin: '#c68a5c', hairColor: '#1d1c23'};
FAMILY[1] = {...FAMILY[1], scale: 1.02, hair: 'long', top: '#ff6fc8', outfit: 'dress', pants: '#c68a5c', skin: '#c68a5c', hairColor: '#3e2616', face: {lashes: true}};
FAMILY[2] = {...FAMILY[2], scale: 0.86, hair: 'afro', top: '#ffb32e', outfit: 'tshirt', skin: '#c68a5c', hairColor: '#1d1c23'};
FAMILY[3] = {...FAMILY[3], scale: 0.74, hair: 'pigtails', top: '#2fd3c3', outfit: 'dress', pants: '#c68a5c', skin: '#c68a5c', hairColor: '#1d1c23'};
FAMILY[4] = {...FAMILY[4], scale: 0.6, headSize: 1.25, hair: 'spiky', top: '#ff5a5a', outfit: 'tshirt', skin: '#c68a5c', hairColor: '#1d1c23'};

const S6: React.FC<SceneProps> = ({f}) => {
	const cut = W(6, 38) - 3; // "Big families"
	const shot = shotIndex(f, [cut]);
	const t = f / 30;
	if (shot === 0) {
		const k = f / cut;
		return (
			<Stage look={MORNING} focus={[-12, 0, 10 - k * 20]} shadowSize={22}>
				<TownStreet lit="day" zFrom={40} zTo={-70} trees={false} />
				<SkyBits />
				<CameraRig pos={[-4.5, 3.2, 30 - k * 22]} target={[-14.5, 1.4, 14 - k * 22]} fov={48} sway={0.8} />
			</Stage>
		);
	}
	const fs = f - cut;
	const five = W(6, 41) - cut;
	const push = easeInOut(clamp(fs / 50));
	const spec = houseSpec(77);
	return (
		<Stage look={MORNING} focus={[0, 0, 6]} shadowSize={14}>
			<House spec={spec} position={[0, 0, -2]} lit="day" bucket={false} />
			<mesh geometry={plane(90, 90)} material={plastic('#79cf5f', {rough: 0.9})} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow />
			<RoundTree position={[-10, 0, 2]} seed={8} />
			<RoundTree position={[10, 0, 0]} seed={9} />
			<SkyBits />
			{FAMILY.map((s, i) => {
				// shoulder to shoulder, tallest to smallest
				const xs = [-4.1, -1.85, 0.25, 2.05, 3.65];
				const hop = fs > five + i * 2 ? Math.max(0, Math.sin(((fs - five - i * 2) / 30) * Math.PI * 3)) * 0.25 * Math.exp(-(fs - five) / 25) : 0;
				return (
					<Character key={i} spec={s} position={[xs[i], hop, 7.0]} rotation={-0.04 * (i - 2)} pose={P.holdFront(t, i)} expr={i === 4 ? 'bigSmile' : 'proud'}
						holdR={<group position={[0.55, -0.1, 0.35]}><Bucket position={[0, -0.6, 0]} handle={0} scale={0.8} /></group>} />
				);
			})}
			<CameraRig pos={[0.3, lerp(3.3, 3.0, push), lerp(31, 28.5, push)]} target={[0, 3.6, 7]} fov={38} sway={0.8} />
		</Stage>
	);
};

export const TOWN_SCENES: SceneDef[] = [
	{Comp: S1, post: () => ({bloom: 0.55, threshold: 0.88})},
	{Comp: S2, post: () => ({bloom: 0.5, threshold: 0.86, vignette: 0.45})},
	{Comp: S3, post: (f) => ({bloom: f < W(3, 17) - 3 ? 0.85 : 0.55, threshold: 0.85})},
	{Comp: S4, post: () => ({bloom: 0.5, threshold: 0.9, vignette: 0.5})},
	{Comp: S5, post: () => ({bloom: 0.5, threshold: 0.9})},
	{Comp: S6, post: () => ({bloom: 0.5, threshold: 0.9})},
];
