import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {project} from '../../../src/shared/three/shot';
import {clamp, ease, lerp, smoothstep} from '../../../src/shared/math';
import {BRAND, SANS, SERIF} from '../../../src/shared/text/brand';
import {Caption, CommentBox, EndCard, FontGate, Header, Label, ScriptureCard, Tag, markKeywords} from '../../../src/shared/text/Overlay';
import {FPS, TL, sceneAt, scene, wordAt, wordsOf, type Page} from './timeline';
import type {SceneDef} from './sceneKit';
import {SceneView, W, H} from './View';
import {BLUE, LandingNumber, NumberLabel, Odometer, OpeningTitle, Scoreboard} from './texts';
import {LANDS, S01} from './scenes/S01Window';
import {S02} from './scenes/S02Sofa';
import {Montage} from './Montage';
import {S04, S05, cutsS5} from './scenes/S04S05Court';
import {AGE_CUTS, S06, S07} from './scenes/S06S07Window';
import {S08L, S08R, S09, S10, S11, S12} from './scenes/S08to12';

export const SCENES: Record<string, SceneDef> = {S1: S01, S2: S02, S4: S04, S5: S05, S6: S06, S7: S07, S9: S09, S10: S10, S11: S11, S12: S12};

// ---------- 3D layer ----------
const World: React.FC<{T: number}> = ({T}) => {
	const span = sceneAt(T);
	const t = T - span.start;
	const d = span.end - span.start;
	if (span.id === 'S14') {
		// the end card covers the world; then Daniel's beam fades back in for the loop
		const loopStart = TL.storyEnd + TL.endCard;
		if (T < loopStart) return null;
		const k = clamp((T - loopStart) / TL.loop);
		return (
			<div style={{position: 'absolute', inset: 0, opacity: ease.inOut(k)}}>
				<SceneView def={S01} t={0} d={scene('S1').end} T={0} />
			</div>
		);
	}
	if (span.id === 'S3') return <Montage t={t} d={d} />;
	if (span.id === 'S8') {
		return (
			<>
				<div style={{position: 'absolute', left: 0, top: 0, width: 540, height: H, overflow: 'hidden'}}>
					<SceneView def={S08L} t={t} d={d} T={T} width={540} height={H} />
				</div>
				<div style={{position: 'absolute', left: 540, top: 0, width: 540, height: H, overflow: 'hidden'}}>
					<SceneView def={S08R} t={t} d={d} T={T} width={540} height={H} />
				</div>
				<div style={{position: 'absolute', left: 538, top: 0, width: 4, height: H, background: `linear-gradient(180deg, rgba(242,181,68,0), ${BRAND.gold} 22%, ${BLUE} 78%, rgba(111,168,255,0))`}} />
			</>
		);
	}
	if (span.id === 'S13') {
		return <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 46%, #3A2818 0%, #1E150F 55%, #120D0A 100%)'}} />;
	}
	const def = SCENES[span.id];
	if (!def) return <div style={{position: 'absolute', inset: 0, background: '#2A2420'}} />;
	return <SceneView def={def} t={t} d={d} T={T} />;
};

// ---------- text layer ----------
const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, '');
const pageAt = (T: number) => TL.pages.find((p) => T >= p.start && T < p.end);
const capWords = (p: Page) => {
	const ws = wordsOf(p);
	const marked = markKeywords(ws.map((w) => w.tok));
	return ws.map((w, i) => ({text: marked[i].text, key: marked[i].key, start: w.start}));
};
const cardKeyTimes = (p: Page) => {
	const ws = wordsOf(p);
	const keys = (p.card!.text.match(/\*([^*]+)\*/g) || []).map((k) => norm(k.replace(/\*/g, '').split(/\s+/)[0]));
	let from = 0;
	return keys.map((k) => {
		const idx = ws.findIndex((w, i) => i >= from && norm(w.tok) === k);
		if (idx >= 0) from = idx + 1;
		return idx >= 0 ? ws[idx].start : p.start;
	});
};

// the phone counter: 0 -> 37 -> 86 -> 100, landing on the word "100"
const raceAt = (T: number) => {
	const s2 = scene('S2').start;
	const land = wordAt('S2', '100').start;
	const t0 = s2 + 0.12;
	const ks: [number, number][] = [
		[t0, 0],
		[lerp(t0, land, 0.3), 37],
		[lerp(t0, land, 0.68), 86],
		[land, 100],
	];
	if (T <= ks[0][0]) return {v: 0, speed: 0};
	if (T >= land) return {v: 100, speed: 0};
	let i = 0;
	while (T > ks[i + 1][0]) i++;
	const [a, va] = ks[i];
	const [b, vb] = ks[i + 1];
	const u = (T - a) / (b - a);
	const e = i === ks.length - 2 ? ease.out(u) : u;
	const v = lerp(va, vb, e);
	const dv = ((vb - va) / (b - a)) * (i === ks.length - 2 ? 3 * (1 - u) * (1 - u) : 1);
	return {v, speed: clamp(dv / 70)};
};

const Opening: React.FC<{T: number}> = ({T}) => {
	const span = sceneAt(T);
	if (span.id === 'S1') {
		const n = LANDS.filter((l) => T >= l).length;
		return (
			<>
				{n > 0 ? <LandingNumber key={n} text={String(n)} T={T} at={LANDS[n - 1]} /> : null}
				<NumberLabel text="TIMES A DAY" T={T} at={wordAt('S1', 'times').start} />
			</>
		);
	}
	if (span.id === 'S2') {
		const {v, speed} = raceAt(T);
		const land = wordAt('S2', '100').start;
		const plus = ease.out(clamp((T - land - 0.04) / 0.2));
		const titleAt = wordAt('S2', 'day').end + 0.08;
		const lift = ease.inOut(clamp((T - titleAt) / 0.4));
		return (
			<>
				<div style={{position: 'absolute', inset: 0, transform: `translateY(${-lift * 120}px) scale(${1 - lift * 0.12})`, transformOrigin: '50% 1050px'}}>
					<Odometer value={v} speed={speed} plus={plus} T={T} at={span.start + 0.05} />
					<NumberLabel text="TIMES A DAY" T={T} at={wordAt('S2', 'times').start} color="#CFE0FF" icon="phone" />
				</div>
				<OpeningTitle T={T} at={titleAt} />
			</>
		);
	}
	return null;
};

// S8: thin glowing lines pulled from the phone into the eyes
const AttentionLines: React.FC<{t: number; d: number; T: number}> = ({t, d, T}) => {
	const a = S08R.anchors!(t, d);
	const cam = S08R.camera(t, d);
	const ph = project(cam, a.phone, 540, H);
	const ey = project(cam, a.eye, 540, H);
	const on = smoothstep(0.3, 0.8, t);
	const pull = smoothstep(wordAt('S8', 'attention').start - 0.4, wordAt('S8', 'attention').start + 0.2, T);
	const lines = [-38, -12, 14, 40];
	return (
		<svg width={1080} height={H} style={{position: 'absolute', left: 0, top: 0, opacity: on}}>
			<defs>
				<filter id="lglow" x="-50%" y="-50%" width="200%" height="200%">
					<feGaussianBlur stdDeviation="5" />
				</filter>
			</defs>
			{lines.map((off, i) => {
				const x0 = 540 + ph.x;
				const y0 = ph.y + off * 0.4;
				const x1 = 540 + ey.x;
				const y1 = ey.y;
				const mx = (x0 + x1) / 2 + off * (1.2 - pull * 0.8);
				const my = (y0 + y1) / 2 + off * 0.6;
				const dpath = `M ${x0} ${y0} Q ${mx} ${my} ${x1} ${y1}`;
				const dash = 18;
				const flow = -((t * 120 + i * 13) % (dash * 2.4));
				return (
					<g key={i}>
						<path d={dpath} fill="none" stroke={BLUE} strokeWidth={9} opacity={0.35 + 0.3 * pull} filter="url(#lglow)" />
						<path d={dpath} fill="none" stroke="#D8E8FF" strokeWidth={2.6} strokeDasharray={`${dash} ${dash * 1.4}`} strokeDashoffset={flow} opacity={0.9} />
					</g>
				);
			})}
		</svg>
	);
};

// S4: a quick gold count of the princes on "a hundred and twenty"
const PrincesCounter: React.FC<{T: number}> = ({T}) => {
	const at = wordAt('S4', 'hundred').start - 0.1;
	const end = wordAt('S4', 'busiest').start - 0.3;
	if (T < at || T > end + 0.3) return null;
	const k = ease.out(clamp((T - at) / 0.75));
	const fade = 1 - smoothstep(end, end + 0.3, T);
	const a = ease.out(clamp((T - at) / 0.2));
	return (
		<div style={{position: 'absolute', left: 520, right: 60, top: 640, textAlign: 'center', opacity: a * fade}}>
			<div style={{fontFamily: SERIF, fontWeight: 700, fontSize: 150, lineHeight: 1, fontVariantNumeric: 'lining-nums', color: BRAND.gold, textShadow: '0 0 40px rgba(242,181,68,0.6), 0 8px 30px rgba(0,0,0,0.5)'}}>{Math.round(120 * k)}</div>
			<div style={{marginTop: 10, fontFamily: SANS, fontWeight: 600, fontSize: 26, letterSpacing: '0.32em', color: '#FFFFFF', textShadow: '0 1px 10px rgba(0,0,0,0.6)'}}>PRINCES</div>
		</div>
	);
};

const Texts: React.FC<{T: number}> = ({T}) => {
	const span = sceneAt(T);
	const t = T - span.start;
	const d = span.end - span.start;
	const page = pageAt(T);
	const def = SCENES[span.id];
	const anchor = (key: string) => {
		const a = def?.anchors?.(t, d)?.[key];
		return a ? project(def.camera(t, d), a, W, H) : {x: 540, y: 900, visible: true};
	};
	if (span.id === 'S14') {
		const k = (T - span.start) / TL.endCard;
		const loopStart = TL.storyEnd + TL.endCard;
		const fade = 1 - smoothstep(loopStart, loopStart + 0.35, T);
		return (
			<div style={{position: 'absolute', inset: 0, opacity: fade}}>
				<EndCard k={k} handle="@GraceINMotion616" tagline="Hard questions. Bible answers." />
			</div>
		);
	}
	const cardUp = page?.kind === 'card';
	const scoreFrom = scene('S3').start;
	const scoreK = clamp((T - scoreFrom - 0.35) / 0.35);
	const scoreOn = span.id !== 'S1' && span.id !== 'S2' && span.id !== 'S13';
	return (
		<>
			<Opening T={T} />
			{page?.kind === 'caption' ? <Caption words={capWords(page)} T={T} /> : null}
			{page?.kind === 'card' ? (
				<ScriptureCard text={page.card!.text} reference={page.card!.ref} keyTimes={cardKeyTimes(page)} T={T} appear={page.start} top={250} size={page.card!.text.length > 100 ? 50 : 56} float={Math.sin((T - page.start) * 0.9) * 6} />
			) : null}
			<Header title="3 TIMES A DAY" />
			{scoreOn ? <Scoreboard prayer="3" phone="100+" k={scoreK} opacity={cardUp ? 0 : 1} glow={span.id === 'S12' ? smoothstep(0.3, 1.0, t) * (0.8 + 0.2 * Math.sin(t * 5)) : 0} /> : null}
			{span.id === 'S4' ? <PrincesCounter T={T} /> : null}
			{span.id === 'S4' ? <Label text="DANIEL 6:3 · OVER THE WHOLE REALM" anchor={anchor('daniel')} dx={0} dy={-200} opacity={smoothstep(wordAt('S4', 'busiest').start - 0.25, wordAt('S4', 'busiest').start + 0.15, T)} /> : null}
			{span.id === 'S5' && t >= cutsS5().seal && t < cutsS5().den ? <Label text="DANIEL 6:7" anchor={anchor('scroll')} dx={140} dy={-260} opacity={smoothstep(cutsS5().seal + 0.15, cutsS5().seal + 0.45, t)} /> : null}
			{span.id === 'S7' ? <div style={{position: 'absolute', inset: 0, background: '#FFE9C2', opacity: AGE_CUTS.reduce((a, c) => a + 0.55 * Math.exp(-Math.abs(t - c) * 22), 0), pointerEvents: 'none'}} /> : null}
			{span.id === 'S7' ? <Label text="ALREADY PRAYING" anchor={anchor('daniel')} dx={-60} dy={-220} opacity={smoothstep(wordAt('S7', 'already').start - 0.3, wordAt('S7', 'already').start + 0.1, T)} /> : null}
			{span.id === 'S8' ? <AttentionLines t={t} d={d} T={T} /> : null}
			{span.id === 'S8' ? (
				<div style={{position: 'absolute', left: 0, right: 0, top: 1240, display: 'flex', justifyContent: 'center', opacity: smoothstep(wordAt('S8', 'attention').start - 0.2, wordAt('S8', 'attention').start + 0.15, T)}}>
					<Tag bg="rgba(111,168,255,0.92)" color={BRAND.ink} size={30}>ATTENTION</Tag>
				</div>
			) : null}
			{span.id === 'S13' ? (
				<>
					<Scoreboard prayer="?" phone="100+" k={1} big={ease.inOut(clamp((t - 0.1) / 0.6))} glow={0.4 + 0.3 * Math.sin(t * 4)} />
					<CommentBox text="3 🙏" typed={clamp((T - wordAt('S13', 'number').start - 0.2) / 0.5)} hearts={clamp((T - wordAt('S13', 'number').start - 0.6) / 1.2)} top={1180} />
				</>
			) : null}
		</>
	);
};

export const ThreeTimesADay: React.FC = () => {
	const frame = useCurrentFrame();
	const T = frame / FPS;
	return (
		<FontGate>
			<AbsoluteFill style={{backgroundColor: BRAND.night}}>
				<World T={T} />
				<Texts T={T} />
			</AbsoluteFill>
		</FontGate>
	);
};
