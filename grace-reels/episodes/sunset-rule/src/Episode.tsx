import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {ApplyCamera, ShotContext, project, type Shot} from '../../../src/shared/three/shot';
import {Post, type PostSettings} from '../../../src/shared/three/Post';
import {sunAt, sunDirection, sunriseAt, type SunState} from '../../../src/shared/sun';
import {clamp, ease, lerp, smoothstep} from '../../../src/shared/math';
import {BRAND, SANS, SERIF} from '../../../src/shared/text/brand';
import {Caption, CommentBox, EndCard, FontGate, Header, Label, ScriptureCard, Stamp, SunLine, Tag, markKeywords} from '../../../src/shared/text/Overlay';
import {FPS, TL, sceneAt, scene, sunTime, wordsOf, type Page} from './timeline';
import type {SceneDef} from './sceneKit';
import {S01} from './scenes/S01Hook';
import {S02, S03, S04, S05} from './scenes/S02to05Synagogue';
import {S06, S07, S08} from './scenes/S06to08Temple';
import {S09, S10, S11L, S11R, S12} from './scenes/S09to12';
import {S13BG, S14, S15, SEND_T, SUNRISE_VIEW} from './scenes/S13to16';

export const SCENES: Record<string, SceneDef> = {S1: S01, S2: S02, S3: S03, S4: S04, S5: S05, S6: S06, S7: S07, S8: S08, S9: S09, S10: S10, S12: S12, S13: S13BG, S14, S15};

const W = 1080;
const H = 1920;

// One 3D view of a scene: also used for the split screen and the flashback grid.
export const SceneView: React.FC<{def: SceneDef; t: number; d: number; T: number; width?: number; height?: number; sunT?: number; sunState?: SunState; post?: (p: PostSettings) => PostSettings}> = ({
	def,
	t,
	d,
	T,
	width = W,
	height = H,
	sunT,
	sunState,
	post,
}) => {
	const frame = useCurrentFrame();
	const sun = sunState ?? sunAt(sunT ?? sunTime(T));
	const sunDir = sunDirection(sun.elevationDeg, def.sunAz);
	const cam = def.camera(t, d);
	const shot: Shot = {t, T, frame, cam, sun, sunDir, W: width, H: height};
	const p = def.post(t, d, sun);
	const Content = def.Content;
	return (
		<ThreeCanvas
			width={width}
			height={height}
			shadows
			flat
			// follow the render scale (--scale) so previews really render fewer pixels
			dpr={typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1}
			gl={{antialias: false, powerPreference: 'high-performance'}}
			camera={{fov: cam.fov, position: cam.pos, near: 0.1, far: 2000}}
		>
			<ShotContext.Provider value={shot}>
				<ApplyCamera />
				<Content t={t} d={d} />
				<Post settings={post ? post(p) : p} />
			</ShotContext.Provider>
		</ThreeCanvas>
	);
};

const spanOf = (id: string) => scene(id);

// ---------- 3D layer ----------
const GRID: {def: SceneDef; id: string; t: number; x: number; y: number}[] = [
	{def: S01, id: 'S1', t: 1.3, x: 96, y: 770},
	{def: S03, id: 'S3', t: 1.7, x: 564, y: 770},
	{def: S06, id: 'S6', t: 2.9, x: 96, y: 1110},
	{def: S09, id: 'S9', t: 3.3, x: 564, y: 1110},
];
const GW = 420;
const GH = 300;

const World: React.FC<{T: number}> = ({T}) => {
	const span = sceneAt(T);
	const t = T - span.start;
	const d = span.end - span.start;
	if (span.id === 'S11') {
		return (
			<>
				<div style={{position: 'absolute', left: 0, top: 0, width: 540, height: H, overflow: 'hidden'}}>
					<SceneView def={S11L} t={t} d={d} T={T} width={540} height={H} />
				</div>
				<div style={{position: 'absolute', left: 540, top: 0, width: 540, height: H, overflow: 'hidden'}}>
					<SceneView def={S11R} t={t} d={d} T={T} width={540} height={H} />
				</div>
				<div style={{position: 'absolute', left: 538, top: 0, width: 4, height: H, background: `linear-gradient(180deg, rgba(242,181,68,0), ${BRAND.gold} 20%, ${BRAND.gold} 80%, rgba(242,181,68,0))`}} />
			</>
		);
	}
	if (span.id === 'S13') {
		return (
			<>
				<SceneView def={S13BG} t={t} d={d} T={T} />
				{GRID.map((g, i) => {
					const at = 0.55 + i * 0.32;
					const k = ease.outBack(clamp((t - at) / 0.28));
					if (t < at) return null;
					const T0 = spanOf(g.id).start + g.t;
					const gd = spanOf(g.id).end - spanOf(g.id).start;
					return (
						<div key={i} style={{position: 'absolute', left: g.x, top: g.y, width: GW, height: GH, transform: `scale(${lerp(0.82, 1, k)}) rotate(${(i % 2 ? 1.2 : -1.2) * (1 - k * 0.5)}deg)`, opacity: clamp(k * 1.4), border: '6px solid #F3ECDF', borderRadius: 10, boxShadow: '0 14px 40px rgba(0,0,0,0.5)', overflow: 'hidden', background: '#000'}}>
							<SceneView def={g.def} t={g.t} d={gd} T={T0} width={GW - 12} height={GH - 12} />
						</div>
					);
				})}
			</>
		);
	}
	if (span.id === 'S16') {
		const loopStart = TL.storyEnd + TL.endCard;
		if (T < loopStart) return null;
		const k = clamp((T - loopStart) / TL.loop);
		const toNoon = smoothstep(0.45, 0.95, k);
		return (
			<>
				<SceneView def={SUNRISE_VIEW} t={k} d={1} T={T} sunState={sunriseAt(ease.out(k / 0.6))} />
				<div style={{position: 'absolute', inset: 0, opacity: toNoon}}>
					<SceneView def={S01} t={0} d={spanOf('S1').end} T={0} />
				</div>
			</>
		);
	}
	return <SceneView def={SCENES[span.id]} t={t} d={d} T={T} />;
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
const wordAt = (sceneId: string, tok: string) => TL.words.find((w) => w.scene === sceneId && norm(w.tok).startsWith(tok))!;

const Hook: React.FC<{T: number; page: Page}> = ({T, page}) => {
	// "JESUS GOT / ANGRY" punches in huge on two lines, then flies up into the caption (1.8 -> 2.2 s)
	const fly = ease.inOut(clamp((T - 1.8) / 0.4));
	if (fly >= 1) return <Caption words={capWords(page)} T={T} />;
	const punch = ease.outBack(clamp((T - 0.05) / 0.22), 2.2);
	const big = 1 - fly;
	return (
		<div style={{position: 'absolute', left: 0, top: 0, width: W, height: H}}>
			<div style={{position: 'absolute', left: 0, right: 0, top: 200, height: 560, background: 'linear-gradient(180deg, rgba(20,16,13,0), rgba(20,16,13,0.45) 30%, rgba(20,16,13,0.4) 70%, rgba(20,16,13,0))', opacity: 0.9}} />
			<div
				style={{
					position: 'absolute',
					left: lerp(540, 72, fly),
					top: lerp(300, 250, fly),
					transform: `translate(${lerp(-50, 0, fly)}%, 0) scale(${lerp(1.3, 1, punch) * lerp(1, 0.52, fly)})`,
					transformOrigin: '0% 0%',
					fontFamily: SERIF,
					fontWeight: 700,
					fontSize: 128,
					lineHeight: 0.98,
					letterSpacing: '0.03em',
					color: '#FFFFFF',
					textAlign: big > 0.5 ? 'center' : 'left',
					whiteSpace: 'nowrap',
					textShadow: '0 6px 26px rgba(0,0,0,0.55)',
					opacity: clamp(punch * 1.5) * (fly > 0.85 ? 1 - (fly - 0.85) / 0.15 : 1),
				}}
			>
				JESUS GOT
				{fly < 0.5 ? <br /> : ' '}
				<span style={{color: BRAND.gold, fontSize: lerp(150, 128, fly)}}>ANGRY</span>
			</div>
			{fly > 0.85 ? <Caption words={capWords(page)} T={T} opacity={(fly - 0.85) / 0.15} /> : null}
		</div>
	);
};

const PhoneUI: React.FC<{t: number}> = ({t}) => {
	const inK = ease.out(clamp((t - 0.1) / 0.45));
	const push = lerp(0.96, 1.06, ease.inOut(clamp(t / 3)));
	const sent = ease.inOut(clamp((t - SEND_T) / 0.4));
	const press = smoothstep(SEND_T - 0.15, SEND_T, t) * (1 - smoothstep(SEND_T, SEND_T + 0.2, t));
	return (
		<div style={{position: 'absolute', left: 575, top: 800, width: 380, height: 630, transform: `translateY(${(1 - inK) * 120}px) scale(${push})`, opacity: inK, transformOrigin: '50% 100%'}}>
			<div style={{position: 'absolute', inset: 0, background: '#1E1A16', borderRadius: 54, boxShadow: '0 26px 60px rgba(0,0,0,0.55)'}} />
			<div style={{position: 'absolute', left: 16, top: 16, right: 16, bottom: 16, borderRadius: 40, overflow: 'hidden', background: '#F3ECDF'}}>
				<div style={{height: 96, background: '#E8DCC8', display: 'flex', alignItems: 'center', gap: 16, padding: '0 26px'}}>
					<div style={{width: 52, height: 52, borderRadius: 26, background: 'linear-gradient(135deg, #8695A6, #4F6E86)'}} />
					<div style={{width: 150, height: 14, borderRadius: 7, background: '#B9AC98'}} />
				</div>
				<div style={{margin: '28px 26px 0', width: 210, height: 64, borderRadius: 26, background: '#E0D4C0'}} />
				<div style={{margin: '14px 26px 0', width: 150, height: 52, borderRadius: 24, background: '#E0D4C0'}} />
				{/* the draft flies from the input field into a sent bubble */}
				<div style={{position: 'absolute', right: lerp(110, 26, sent), top: lerp(552, 290, sent), padding: '20px 26px', borderRadius: 30, background: sent > 0.05 ? BRAND.gold : 'transparent', fontFamily: SANS, fontWeight: 600, fontSize: 32, color: BRAND.ink}}>
					I forgive you.
				</div>
				<div style={{position: 'absolute', left: 20, right: 20, bottom: 22, height: 82, borderRadius: 41, background: '#FFFFFF', border: '2px solid #D8CCB8', zIndex: -1}} />
				<div style={{position: 'absolute', right: 30, bottom: 32, width: 62, height: 62, borderRadius: 31, background: BRAND.deepGold, transform: `scale(${1 - press * 0.18})`, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
					<svg width={30} height={30} viewBox="0 0 24 24">
						<path d="M3 12 L21 3 L14 21 L11 13 Z" fill="#F3ECDF" />
					</svg>
				</div>
				{sent > 0.9 ? <div style={{position: 'absolute', right: 34, top: 392, fontFamily: SANS, fontWeight: 500, fontSize: 22, color: '#7A6A58', opacity: clamp((sent - 0.9) * 10)}}>Sent ✓</div> : null}
			</div>
		</div>
	);
};

const NoticeTags: React.FC<{T: number}> = ({T}) => {
	const a = smoothstep(wordAt('S8', 'for').start - 0.1, wordAt('S8', 'for').start + 0.25, T);
	const b = smoothstep(wordAt('S8', 'gods').start - 0.1, wordAt('S8', 'gods').start + 0.25, T);
	const c = smoothstep(wordAt('S8', 'hurting').start - 0.1, wordAt('S8', 'hurting').start + 0.25, T);
	const never = wordAt('S8', 'never').start;
	const e = smoothstep(never - 0.6, never - 0.3, T);
	const stamp = (T - never + 0.05) / 0.16;
	const redGold = `linear-gradient(90deg, ${BRAND.red}, ${BRAND.deepGold})`;
	return (
		<div style={{position: 'absolute', left: 470, top: 830, width: 520}}>
			<div style={{opacity: a, transform: `translateX(${(1 - a) * 40}px)`}}>
				<Tag bg={redGold} size={28}>ANGRY FOR:</Tag>
			</div>
			<div style={{display: 'flex', gap: 12, marginTop: 14, flexWrap: 'wrap'}}>
				<div style={{opacity: b, transform: `translateY(${(1 - b) * 16}px)`}}>
					<Tag bg="rgba(243,236,223,0.95)" color={BRAND.ink} size={26}>GOD’S HOUSE</Tag>
				</div>
				<div style={{opacity: c, transform: `translateY(${(1 - c) * 16}px)`}}>
					<Tag bg="rgba(243,236,223,0.95)" color={BRAND.ink} size={26}>HURTING PEOPLE</Tag>
				</div>
			</div>
			<div style={{marginTop: 60, opacity: e, transform: `translateX(${(1 - e) * 40}px)`}}>
				<Tag size={28}>ANGRY FOR HIMSELF:</Tag>
			</div>
			<div style={{marginTop: 18, marginLeft: 30}}>
				<Stamp text="NEVER" k={stamp} />
			</div>
		</div>
	);
};

const SplitTags: React.FC<{T: number}> = ({T}) => {
	const a = smoothstep(wordAt('S11', 'angry').start - 0.1, wordAt('S11', 'angry').start + 0.3, T);
	const b = smoothstep(wordAt('S11', 'forgiving').start - 0.1, wordAt('S11', 'forgiving').start + 0.3, T);
	return (
		<>
			<div style={{position: 'absolute', left: 40, top: 1240, width: 470, display: 'flex', justifyContent: 'center', opacity: a, transform: `translateY(${(1 - a) * 20}px)`}}>
				<Tag bg={BRAND.red} size={26}>ANGRY FOR OTHERS</Tag>
			</div>
			<div style={{position: 'absolute', left: 560, top: 1240, width: 470, display: 'flex', justifyContent: 'center', opacity: b, transform: `translateY(${(1 - b) * 20}px)`}}>
				<Tag bg={BRAND.gold} color={BRAND.ink} size={22}>FORGIVING FOR HIMSELF</Tag>
			</div>
		</>
	);
};

const Texts: React.FC<{T: number}> = ({T}) => {
	const span = sceneAt(T);
	const t = T - span.start;
	const d = span.end - span.start;
	const sunT = sunTime(T);
	const sun = sunAt(Math.min(sunT, 1));
	const page = pageAt(T);
	const def = SCENES[span.id];
	const anchor = (key: string) => {
		const a = def?.anchors?.(t, d)?.[key];
		return a ? project(def.camera(t, d), a, W, H) : {x: 540, y: 900, visible: true};
	};
	if (span.id === 'S16') {
		const k = (T - span.start) / TL.endCard;
		const loopStart = TL.storyEnd + TL.endCard;
		const fade = 1 - smoothstep(loopStart, loopStart + 0.3, T);
		return (
			<div style={{position: 'absolute', inset: 0, opacity: fade}}>
				<EndCard k={k} handle="@GraceINMotion616" tagline="Hard questions. Bible answers." />
			</div>
		);
	}
	const fullCard = page?.kind === 'card' && page.card?.full;
	return (
		<>
			{page?.kind === 'hook' ? <Hook T={T} page={page} /> : null}
			{page?.kind === 'caption' ? <Caption words={capWords(page)} T={T} /> : null}
			{page?.kind === 'card' ? (
				<ScriptureCard
					text={page.card!.text}
					reference={page.card!.ref}
					keyTimes={cardKeyTimes(page)}
					T={T}
					appear={page.start}
					top={fullCard ? 330 : 250}
					size={fullCard ? 66 : 58}
					float={Math.sin((T - page.start) * 0.9) * 6}
				/>
			) : null}
			<Header title="THE SUNSET RULE" />
			<SunLine
				sunT={sunT}
				color={sun.icon}
				reveal={span.id === 'S13' ? smoothstep(wordAt('S13', 'setting').start - 0.3, wordAt('S13', 'setting').start + 0.2, T) : 0}
				sink={span.id === 'S14' || span.id === 'S15' ? smoothstep(0.955, 0.99, sunT) : 0}
				opacity={fullCard ? 0 : 1}
			/>
			{span.id === 'S2' ? <Label text="MARK 3:2" anchor={anchor('watchers')} dx={150} dy={-170} opacity={smoothstep(1.0, 1.4, t)} /> : null}
			{span.id === 'S3' ? <Label text="WITH ANGER · MARK 3:5" anchor={anchor('face')} dx={-40} dy={430} opacity={smoothstep(1.4, 1.8, t)} /> : null}
			{span.id === 'S4' ? <Label text="AND GRIEVED" anchor={anchor('face')} dx={-160} dy={470} opacity={smoothstep(wordAt('S4', 'grieved').start - 0.2, wordAt('S4', 'grieved').start + 0.2, T)} /> : null}
			{span.id === 'S5' ? <Label text="“STRETCH FORTH THINE HAND” · MARK 3:5" anchor={anchor('hand')} dx={60} dy={-230} opacity={smoothstep(0.2, 0.6, t) * (1 - smoothstep(d - 1.1, d - 0.8, t))} /> : null}
			{span.id === 'S6' ? <Label text="JOHN 2:15" anchor={anchor('jesus')} dx={170} dy={-150} opacity={smoothstep(1.4, 1.8, t)} /> : null}
			{span.id === 'S8' ? <NoticeTags T={T} /> : null}
			{span.id === 'S11' ? <SplitTags T={T} /> : null}
			{span.id === 'S14' ? <PhoneUI t={t} /> : null}
			{span.id === 'S15' ? <CommentBox text="TODAY 🙏" typed={clamp((t - 0.5) / 0.9)} hearts={clamp((t - 1.2) / 1.0)} top={1180} /> : null}
		</>
	);
};

export const SunsetRule: React.FC = () => {
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
