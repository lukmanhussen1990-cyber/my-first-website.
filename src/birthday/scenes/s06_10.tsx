// Scenes 6-10: asking Mom and the neighbours, the back of the photo, the old bakery, the broken window, the book.
import React, {useMemo} from 'react';
import {Stage, LOOKS, Look} from '../../lib/Stage';
import {CameraRig} from '../../lib/CameraRig';
import {Character} from '../../characters/Character';
import * as P from '../../characters/poses';
import {ME, MOM, townsperson} from '../cast';
import {QuietStreet, SunsetSky, BakeryOutside, BAKERY_POS, BAKERY, BROKEN_WIN, quietHouseDoor} from '../world/Town';
import {Kitchen, BakeryRoom, SHOP_COUNTER, SHOP_COUNTER_TOP} from '../world/Rooms';
import {PhotoCard, oldPhotoMaterial, OldBook} from '../props/Things';
import {PhotoPortal, makePhotoRT} from '../world/Photo';
import {Dust, Sparkles, GlowPoints} from '../../props/Effects';
import {BeamTo} from '../../world/CastleInside';
import {SceneDef, SceneProps} from '../kit';
import {W, shotIndex, amp, speaking, wf} from '../timing';
import {V3, clamp, lerp, lerp3, easeInOut, easeOut} from '../../lib/anim';
import {QUALITY} from '../../lib/quality';
import {SUNSET, KITCHEN_EVE, PovPhoto} from './s01_05';
import {Spot} from '../Spot';

const usePhoto = () => {
	const dpr = QUALITY.dpr;
	const rt = useMemo(() => makePhotoRT(Math.round(1024 * dpr), Math.round(768 * dpr)), [dpr]);
	const mat = useMemo(() => oldPhotoMaterial(rt.texture), [rt]);
	return {rt, mat};
};
const PHOTO_LOCAL: V3 = [0, 3.2, 1.85];

// ===================================================================== S6
// "I asked mom what it was. She didn't know. I asked the neighbors. Nobody knew."
const S6: React.FC<SceneProps> = ({f, g}) => {
	const cB = W(6, 79) - 4; // "I asked the neighbors"
	const shot = shotIndex(f, [cB]);
	const t = f / 30;
	const {rt, mat} = usePhoto();
	const talk = speaking(g, 70, 75) ? amp(g) : 0;
	if (shot === 0) {
		const fShrug = W(6, 76) - 2; // "She didn't know"
		const me: V3 = [0.6, 0, -0.6];
		const mom: V3 = [-1.4, 0, -2.0];
		const k = easeInOut(clamp(f / cB));
		const shrugT = (f - fShrug) / 30;
		const momPose = f < fShrug ? P.withPose(P.idle(t, 2), {lean: 0.12, head: [0.22, 0, 0]}) : P.shrug(shrugT);
		return (
			<Stage look={KITCHEN_EVE} sky={false} fog={false} focus={[0, 2, -1]} shadowSize={10}>
				<PhotoPortal rt={rt} frame={f + 400} />
				<Kitchen />
				<Character spec={MOM} position={mom} rotation={0.28} pose={momPose} expr={f < fShrug ? 'curious' : 'confused'} look={f < fShrug ? [0.5, 0.6] : [0.5, 0]} />
				<Character spec={ME} position={me} rotation={-1.55} pose={P.holdPhoto(t, 0.75)} expr="curious" talk={talk} look={[0, -0.3]}>
					<group position={[0, 3.45, 1.95]} rotation={[-0.15, 0, 0]}>
						<PhotoCard front={mat} w={1.5} h={1.12} />
					</group>
				</Character>
				<CameraRig pos={[lerp(-7.4, -6.6, k), lerp(4.7, 4.5, k), lerp(8.6, 7.6, k)]} target={[-0.4, 3.85, -1.3]} fov={32} sway={0.5} />
			</Stage>
		);
	}
	// at the neighbours' door: everyone shrugs
	const fs = f - cB;
	const fNobody = W(6, 83) - 3;
	const k = easeInOut(clamp(fs / (84)));
	const door = quietHouseDoor(2);
	const dz = door.p[2];
	const shrugAt = (d: number) => (f < fNobody + d ? P.idle(t, d) : P.shrug((f - fNobody - d) / 30));
	return (
		<Stage look={SUNSET} focus={[-12, 0, dz]} shadowSize={14}>
			<SunsetSky sunDir={SUNSET.sunDir} />
			<PhotoPortal rt={rt} frame={f + 400} />
			<QuietStreet time="sunset" zFrom={40} zTo={-70} doorOpen={(i) => (i === 2 ? 1 : 0)} />
			<Character spec={townsperson(41, {elder: true})} position={[-14.0, 0.5, dz + 0.3]} rotation={Math.PI / 2} pose={shrugAt(0)} expr={f < fNobody ? 'curious' : 'confused'} look={[0, 0.4]} />
			<Character spec={townsperson(44)} position={[-13.6, 0.5, dz - 1.9]} rotation={Math.PI / 2 + 0.25} pose={shrugAt(6)} expr={f < fNobody + 6 ? 'curious' : 'confused'} look={[0.5, 0.4]} />
			<Character spec={townsperson(47, {kid: true})} position={[-11.3, 0, dz - 2.6]} rotation={0.9} pose={shrugAt(10)} expr="confused" look={[0.5, 0]} />
			<Character spec={townsperson(49, {kid: true})} position={[-11.0, 0, dz + 2.7]} rotation={2.3} pose={shrugAt(14)} expr="confused" look={[-0.5, 0]} />
			<Character spec={ME} position={[-10.1, 0, dz + 0.1]} rotation={-Math.PI / 2} pose={P.holdPhoto(t, 0.9)} expr={f < fNobody ? 'curious' : 'sad'} talk={speaking(g, 79, 82) ? amp(g) : 0}>
				<group position={[0, 3.6, 1.95]} rotation={[-0.25, 0, 0]}>
					<PhotoCard front={mat} w={1.5} h={1.12} />
				</group>
			</Character>
			<CameraRig pos={[lerp(-1.0, -2.0, k), lerp(5.0, 4.8, k), lerp(dz + 9.2, dz + 8.2, k)]} target={[-12.4, 3.3, dz - 0.2]} fov={38} sway={0.5} />
		</Stage>
	);
};

// ===================================================================== S7
// "But on the back of the photo, it said where it was taken." – I turn the photo over: hand-written note
const S7: React.FC<SceneProps> = ({f, dur}) => {
	const t = f / 30;
	const {rt, mat} = usePhoto();
	const fFlip = W(7, 88) - 8; // "back"
	const flip = easeInOut(clamp((f - fFlip) / 16));
	const k = easeInOut(clamp(f / dur));
	const eye: V3 = [-6.0, 3.95, 14];
	const look: V3 = [-4.4, 2.75, 14];
	return (
		<Stage look={SUNSET} focus={[eye[0], 0, eye[2]]} shadowSize={10}>
			<SunsetSky sunDir={SUNSET.sunDir} />
			<PhotoPortal rt={rt} frame={f + 500} />
			<QuietStreet time="sunset" zFrom={40} zTo={-70} />
			<PovPhoto eye={eye} target={look} front={mat} t={t} flip={flip} />
			<CameraRig pos={eye} target={look} fov={lerp(54, 46, k)} sway={0.2} />
		</Stage>
	);
};

// ===================================================================== S8
// "The old bakery at the end of our street. It's been closed for years."
const S8: React.FC<SceneProps> = ({f, g}) => {
	const cB = W(8, 107) - 4; // "It's been closed for years"
	const shot = shotIndex(f, [cB]);
	const t = f / 30;
	const bz = BAKERY_POS[2] + BAKERY.D / 2; // bakery front
	if (shot === 0) {
		const k = easeInOut(clamp(f / cB));
		return (
			<Stage look={SUNSET} focus={[0, 0, bz + 18]} shadowSize={26}>
				<SunsetSky sunDir={SUNSET.sunDir} />
				<QuietStreet time="sunset" zFrom={-40} zTo={-130} />
				<BakeryOutside />
				<Character spec={ME} position={[0.8, 0, bz + 34 - t * 1.6]} rotation={Math.PI} pose={P.walk(t, 0.55, 0.6)} expr="curious" />
				<Dust frame={f} count={90} box={[18, 9, 10]} position={[0, 0, bz + 2]} color="#ffd9a0" size={0.14} />
				<CameraRig pos={[lerp(3.0, 2.4, k), lerp(5.2, 4.8, k), lerp(bz + 47, bz + 42, k)]} target={[0, lerp(6.6, 6.2, k), bz - 2]} fov={40} sway={0.5} />
			</Stage>
		);
	}
	const fs = f - cB;
	const k = easeInOut(clamp(fs / 54));
	return (
		<Stage look={SUNSET} focus={[0, 4, bz]} shadowSize={14}>
			<SunsetSky sunDir={SUNSET.sunDir} />
			<QuietStreet time="sunset" zFrom={-70} zTo={-130} />
			<BakeryOutside />
			<Dust frame={f} count={110} box={[14, 9, 6]} position={[0, 1, bz + 2]} color="#ffd9a0" size={0.12} />
			<CameraRig pos={[lerp(5.4, 4.2, k), lerp(6.2, 7.0, k), lerp(bz + 13, bz + 10, k)]} target={[lerp(-0.6, -0.2, k), lerp(6.0, 7.2, k), bz]} fov={42} sway={0.4} />
		</Stage>
	);
};

// ===================================================================== S9
// "So I squeezed in through a broken window."
const S9: React.FC<SceneProps> = ({f, dur}) => {
	const t = f / 30;
	const win: V3 = [BAKERY_POS[0] + BROKEN_WIN[0], 0, BAKERY_POS[2] + BROKEN_WIN[2]];
	// walk up (0-18), crouch + lean in (18-40), slide in (40-76)
	const walkK = easeOut(clamp(f / 18));
	const crouch = easeInOut(clamp((f - 14) / 22));
	const slide = easeInOut(clamp((f - 38) / 40));
	const z = lerp(win[2] + 4.2, win[2] + 2.4, walkK) - slide * 3.6;
	const pose = crouch < 0.02 ? P.walk(t, 0.6, 0.6) : P.mixPose(P.walk(t, 0.6, 0.6 * (1 - crouch)), P.squeeze(t, 1), crouch);
	const k = easeInOut(clamp(f / dur));
	return (
		<Stage look={SUNSET} focus={[win[0], 0, win[2]]} shadowSize={10}>
			<SunsetSky sunDir={SUNSET.sunDir} />
			<QuietStreet time="sunset" zFrom={-85} zTo={-130} />
			<BakeryOutside />
			<Character spec={ME} position={[win[0] - 0.1, crouch * 0.6, z]} rotation={Math.PI} pose={pose} expr="determined" />
			<Dust frame={f} count={60} box={[6, 4, 4]} position={[win[0], 0.5, win[2] + 2]} color="#ffd9a0" size={0.1} />
			<CameraRig pos={[lerp(win[0] + 7.6, win[0] + 6.4, k), lerp(4.0, 3.4, k), lerp(win[2] + 9.0, win[2] + 7.2, k)]} target={[win[0] - 0.4, 1.9, win[2] + 0.6]} fov={38} sway={0.45} />
		</Stage>
	);
};

// ===================================================================== S10
// "Inside, everything was dust and spiderwebs. And on the counter, there was one old book. It said cake."
const INSIDE: Look = {...LOOKS.castle, skyTop: '#1a1612', skyMid: '#1a1612', skyBottom: '#1a1612', hemiSky: '#6a6a7e', hemiGround: '#2a2018', hemi: 0.42, ambient: 0.1, sunColor: '#ffcf8a', sun: 0.0, env: 0.18, exposure: 1.05};
const BOOK: V3 = [1.0, SHOP_COUNTER_TOP + 0.02, SHOP_COUNTER[2] - 0.1];

const BakeryInside: React.FC<{f: number; bookGlow: number; book?: boolean}> = ({f, bookGlow, book = true}) => (
	<>
		<BakeryRoom />
		{book ? (
			<group position={BOOK} rotation={[0, 0.25, 0]}>
				<OldBook glow={bookGlow} />
			</group>
		) : null}
		{/* sun shafts through the boards */}
		<BeamTo from={[-5.5, 5.4, 6]} to={[-3.6, 0, 1.6]} radius={0.9} color="#ffd9a0" opacity={0.12} />
		<BeamTo from={[-1.5, 4.6, 6]} to={[-0.4, 0, 1.0]} radius={0.8} color="#ffd9a0" opacity={0.1} />
		<BeamTo from={[3.0, 6.3, 6]} to={[BOOK[0], BOOK[1], BOOK[2]]} radius={0.95} color="#ffe0a8" opacity={0.2} />
		<Spot from={[3.0, 6.3, 6.3]} to={BOOK} angle={0.2} penumbra={0.5} intensity={150} distance={20} color="#ffd9a0" />
		<Spot from={[-5.5, 5.4, 6.3]} to={[-3.6, 0, 1.6]} angle={0.25} penumbra={0.7} intensity={60} distance={16} color="#ffd9a0" shadow={false} />
		<pointLight position={[0, 6, 2]} color="#8a90b0" intensity={6} distance={20} decay={1.5} />
		<Dust frame={f} count={260} box={[16, 8, 10]} position={[0, 0.2, 0]} color="#ffe6c0" size={0.08} />
		{bookGlow > 0 ? <Sparkles frame={f} count={26} radius={1.0} height={1.6} position={[BOOK[0], BOOK[1], BOOK[2]]} color="#ffe28a" size={0.5} /> : null}
	</>
);

const S10: React.FC<SceneProps> = ({f, g}) => {
	const cB = W(10, 126) - 4; // "And on the counter"
	const cC = W(10, 134) - 4; // "book" -> "It said cake"
	const shot = shotIndex(f, [cB, cC]);
	const t = f / 30;
	const glowOn = easeOut(clamp((f - (W(10, 132) - 4)) / 20)); // "one old book"
	if (shot === 0) {
		const k = easeInOut(clamp(f / cB));
		const me: V3 = [lerp(5.0, 2.6, easeOut(clamp(f / 70))), 0, lerp(3.4, 2.6, k)];
		return (
			<Stage look={INSIDE} sky={false} fog={false} focus={[0, 0, 0]} shadowSize={12} sunShadow={false}>
				<BakeryInside f={f} bookGlow={0} />
				<Character spec={ME} position={me} rotation={-1.9 + Math.sin(t * 1.2) * 0.3} pose={f < 70 ? P.walk(t, 0.45, 0.45) : P.idle(t, 1)} expr="awe" look={[Math.sin(t * 1.5) * 0.5, -0.6]} />
				<CameraRig pos={[lerp(-6.6, -5.6, k), lerp(6.4, 5.8, k), lerp(-3.4, -2.2, k)]} target={[lerp(1.0, 1.6, k), 3.0, lerp(3.0, 2.6, k)]} fov={46} sway={0.5} />
			</Stage>
		);
	}
	if (shot === 1) {
		const fs = f - cB;
		const k = easeInOut(clamp(fs / (cC - cB)));
		const me: V3 = [lerp(3.6, 2.5, easeOut(clamp(fs / 50))), 0, lerp(2.6, 1.6, easeOut(clamp(fs / 50)))];
		return (
			<Stage look={INSIDE} sky={false} fog={false} focus={[0, 0, 0]} shadowSize={10} sunShadow={false}>
				<BakeryInside f={f} bookGlow={glowOn} />
				<Character spec={ME} position={me} rotation={-2.5} pose={fs < 50 ? P.walk(t, 0.45, 0.4) : P.idle(t, 1)} expr="awe" look={[-0.5, 0.5]} />
				<CameraRig pos={[lerp(-3.6, -2.9, k), lerp(3.9, 3.7, k), lerp(1.4, 0.9, k)]} target={[BOOK[0] + 0.3, BOOK[1] + 0.25, BOOK[2]]} fov={lerp(42, 36, k)} sway={0.35} />
			</Stage>
		);
	}
	// "It said cake": I hold the book up, the cover faces us
	const fs = f - cC;
	const k = easeInOut(clamp(fs / 71));
	const lift = easeInOut(clamp(fs / 18));
	const me: V3 = [1.3, 0, 1.4];
	return (
		<Stage look={INSIDE} sky={false} fog={false} focus={[0, 0, 0]} shadowSize={10} sunShadow={false}>
			<BakeryInside f={f} bookGlow={1} book={false} />
			<Character spec={ME} position={me} rotation={0} pose={P.mixPose(P.idle(t, 1), P.withPose(P.holdFront(t, 1), {armL: [-1.15, 0, -0.38], armR: [-1.15, 0, 0.38], head: [0.06, 0, 0]}), lift)} expr={fs > 30 ? 'excited' : 'awe'}>
				<group position={lerp3([0, 2.2, 1.5], [0, 2.75, 1.95], lift)} rotation={[Math.PI / 2 - 0.12, 0, 0]}>
					<group position={[0, -0.13, 0]}>
						<OldBook glow={1} />
					</group>
				</group>
			</Character>
			<Sparkles frame={f} count={30} radius={1.3} height={2.4} position={[me[0], 2.0, me[2] + 1.5]} color="#ffe28a" size={0.55} />
			<pointLight position={[me[0], 4.2, me[2] + 2.4]} color="#ffd9a0" intensity={7} distance={8} decay={1.5} />
			<CameraRig pos={[lerp(1.2, 1.35, k), lerp(3.6, 3.5, k), lerp(5.7, 5.3, k)]} target={[me[0], 2.95, me[2]]} fov={50} sway={0.35} />
		</Stage>
	);
};

export const SCENES_6_10: SceneDef[] = [{Comp: S6}, {Comp: S7}, {Comp: S8}, {Comp: S9}, {Comp: S10, post: () => ({bloom: 0.7, threshold: 0.85})}];
