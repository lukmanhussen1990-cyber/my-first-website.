import React, {useLayoutEffect, useState} from 'react';
import {useDelayRender} from 'remotion';
import {BRAND, FONT_FACES, SANS, SERIF} from './brand';
import {clamp, ease, lerp, smoothstep} from '../math';

// HTML/SVG overlay pieces. Text never goes into images or WebGL.

export const FontGate: React.FC<{children: React.ReactNode}> = ({children}) => {
	const {delayRender, continueRender} = useDelayRender();
	const [handle] = useState(() => delayRender('fonts'));
	useLayoutEffect(() => {
		Promise.all(FONT_FACES.map((f) => document.fonts.load(f)))
			.then(() => document.fonts.ready)
			.then(() => continueRender(handle));
	}, [continueRender, handle]);
	return <>{children}</>;
};

// Logo: a slim gold cross with three short motion lines on its left. draw 0..1 traces it.
export const Logo: React.FC<{size: number; draw?: number; color?: string}> = ({size, draw = 1, color = BRAND.gold}) => {
	const dash = (len: number, k: number) => ({strokeDasharray: len, strokeDashoffset: len * (1 - clamp(k))});
	return (
		<svg width={size} height={size} viewBox="0 0 100 100" fill="none" stroke={color} strokeLinecap="round">
			<path d="M60 10 V90" strokeWidth={7} style={dash(80, draw * 1.6)} />
			<path d="M38 34 H82" strokeWidth={7} style={dash(44, draw * 1.6 - 0.45)} />
			<path d="M8 44 H26" strokeWidth={5} style={dash(18, draw * 2.2 - 1.0)} />
			<path d="M14 56 H34" strokeWidth={5} style={dash(20, draw * 2.2 - 1.1)} />
			<path d="M20 68 H38" strokeWidth={5} style={dash(18, draw * 2.2 - 1.2)} />
		</svg>
	);
};

export const Header: React.FC<{title: string; opacity?: number}> = ({title, opacity = 1}) => (
	<div style={{position: 'absolute', left: 72, right: 72, top: 132, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: 0.78 * opacity}}>
		<div style={{display: 'flex', alignItems: 'center', gap: 14}}>
			<Logo size={34} />
			<span style={{fontFamily: SANS, fontWeight: 600, fontSize: 22, letterSpacing: '0.18em', color: '#FFFFFF', textShadow: '0 1px 6px rgba(0,0,0,0.35)'}}>GRACE IN MOTION</span>
		</div>
		<span style={{fontFamily: SANS, fontWeight: 600, fontSize: 22, letterSpacing: '0.18em', color: '#FFFFFF', textShadow: '0 1px 6px rgba(0,0,0,0.35)', marginRight: 120}}>{title}</span>
	</div>
);

// ---------- word-synced caption ----------
export type CapWord = {text: string; start: number; key: boolean};

// parse "*keyword*" markers that may span tokens
export const markKeywords = (tokens: string[]) => {
	let inKey = false;
	return tokens.map((tok) => {
		const opens = tok.includes('*') && !inKey;
		let t = tok;
		let key = inKey;
		if (opens) {
			key = true;
			inKey = (t.match(/\*/g) || []).length % 2 === 1;
		} else if (inKey && t.includes('*')) {
			inKey = false;
		}
		t = t.replace(/\*/g, '');
		return {text: t, key};
	});
};

const splitPunct = (w: string) => {
	const m = w.match(/^([“"(…]*)(.*?)([”".,:;!?…)]*)$/);
	return m ? [m[1], m[2], m[3]] : ['', w, ''];
};

export const Caption: React.FC<{words: CapWord[]; T: number; top?: number; size?: number; opacity?: number; scrim?: number; color?: string}> = ({
	words,
	T,
	top = 250,
	size = 66,
	opacity = 1,
	scrim = 1,
	color = '#FFFFFF',
}) => (
	<div style={{position: 'absolute', left: 0, right: 0, top: top - 70, height: 470, opacity}}>
		{/* soft scrim so the words always read */}
		<div style={{position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, background: 'linear-gradient(180deg, rgba(20,16,13,0) 0%, rgba(20,16,13,0.42) 30%, rgba(20,16,13,0.38) 70%, rgba(20,16,13,0) 100%)', opacity: scrim}} />
		<div style={{position: 'absolute', left: 72, right: 72, top: 70, fontFamily: SERIF, fontStyle: 'italic', fontWeight: 500, fontSize: size, lineHeight: 1.15, color, textShadow: '0 2px 14px rgba(0,0,0,0.45)'}}>
			{words.map((w, i) => {
				const ghost = T >= w.start - 0.15 && T < w.start;
				const shown = T >= w.start;
				const k = clamp((T - w.start) / 0.12);
				const op = shown ? lerp(0.25, 1, ease.out(k)) : ghost ? 0.25 : 0;
				const rise = shown ? (1 - ease.out(k)) * 8 : 8;
				const pop = w.key && shown ? 1 + 0.12 * Math.sin(clamp((T - w.start) / 0.22) * Math.PI) : 1;
				const [pre, core, post] = splitPunct(w.text);
				return (
					<span key={i} style={{display: 'inline-block', opacity: op, transform: `translateY(${rise}px)`, marginRight: '0.22em', whiteSpace: 'pre'}}>
						{pre}
						{w.key ? (
							<span style={{display: 'inline-block', fontStyle: 'normal', fontWeight: 700, color: BRAND.gold, transform: `scale(${pop})`, transformOrigin: '50% 70%', letterSpacing: '0.01em'}}>{core.toUpperCase()}</span>
						) : (
							core
						)}
						{post}
					</span>
				);
			})}
		</div>
	</div>
);

// ---------- the sun line: a sun icon sliding with sunTime ----------
export const SunLine: React.FC<{sunT: number; color: string; reveal?: number; sink?: number; opacity?: number}> = ({sunT, color, reveal = 0, sink = 0, opacity = 1}) => {
	const x0 = 72;
	const w = 600;
	const x = x0 + w * clamp(sunT);
	return (
		<div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, pointerEvents: 'none', opacity}}>
			<div style={{position: 'absolute', left: x0, top: 690, width: w, height: 2, background: 'linear-gradient(90deg, rgba(255,241,201,0.55), rgba(255,150,70,0.55), rgba(217,68,44,0.55))'}} />
			<div style={{position: 'absolute', left: x - 15, top: 691 - 15 + sink * 30, width: 30, height: 30, borderRadius: 15, background: color, boxShadow: `0 0 22px 8px ${color}`, opacity: 1 - sink * 0.92}} />
			{reveal > 0 ? (
				<>
					<div style={{position: 'absolute', left: x0, top: 712, fontFamily: SANS, fontWeight: 600, fontSize: 22, letterSpacing: '0.18em', color: '#FFF1C9', opacity: reveal, textShadow: '0 1px 8px rgba(0,0,0,0.6)'}}>NOON</div>
					<div style={{position: 'absolute', left: x0 + w + 24, top: 678, fontFamily: SANS, fontWeight: 600, fontSize: 22, letterSpacing: '0.18em', color: '#FFFFFF', opacity: reveal, textShadow: '0 1px 8px rgba(0,0,0,0.7)'}}>SUNSET</div>
				</>
			) : null}
		</div>
	);
};

// ---------- label with a leader line that sticks to a projected anchor ----------
export const Label: React.FC<{text: string; anchor: {x: number; y: number}; dx?: number; dy?: number; opacity?: number}> = ({text, anchor, dx = 0, dy = -150, opacity = 1}) => {
	// keep the whole tag inside the frame (approximate width from the text)
	const half = (text.length * 17.5 + 44) / 2;
	const bx = clamp(anchor.x + dx, 72 + half, 1008 - half);
	const by = clamp(anchor.y + dy, 760, 1400);
	return (
		<div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, opacity}}>
			<svg width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0}}>
				<line x1={bx} y1={by + 22} x2={anchor.x} y2={anchor.y} stroke="rgba(255,255,255,0.9)" strokeWidth={2} />
				<circle cx={anchor.x} cy={anchor.y} r={5} fill={BRAND.gold} />
			</svg>
			<div style={{position: 'absolute', left: bx, top: by, transform: 'translate(-50%, 0)', background: BRAND.tag, color: '#FFFFFF', fontFamily: SANS, fontWeight: 600, fontSize: 24, letterSpacing: '0.14em', padding: '12px 22px', borderRadius: 26, whiteSpace: 'nowrap', borderBottom: `3px solid ${BRAND.gold}`}}>
				{text}
			</div>
		</div>
	);
};

// ---------- cream scripture card ----------
export const ScriptureCard: React.FC<{text: string; reference: string; keyTimes: number[]; T: number; appear: number; top?: number; size?: number; width?: number; float?: number}> = ({
	text,
	reference,
	keyTimes,
	T,
	appear,
	top = 250,
	size = 60,
	width = 936,
	float = 0,
}) => {
	const k = clamp((T - appear) / 0.45);
	const parts = text.split(/(\*[^*]+\*)/g).filter(Boolean);
	let keyIdx = 0;
	return (
		<div
			style={{
				position: 'absolute',
				left: (1080 - width) / 2,
				top: top + float,
				width,
				opacity: ease.out(k),
				transform: `translateY(${(1 - ease.out(k)) * 24}px) scale(${lerp(0.97, 1, ease.out(k))})`,
				background: BRAND.cream,
				borderRadius: 18,
				boxShadow: '0 18px 50px rgba(20,12,6,0.35), 0 2px 0 rgba(255,255,255,0.6) inset',
				padding: '46px 54px 40px',
				textAlign: 'center',
				boxSizing: 'border-box',
			}}
		>
			<div style={{position: 'absolute', left: 0, top: 22, bottom: 22, width: 6, borderRadius: 3, background: BRAND.deepGold}} />
			<div style={{fontFamily: SERIF, fontStyle: 'italic', fontWeight: 500, fontSize: size, lineHeight: 1.18, color: BRAND.ink}}>
				{parts.map((p, i) => {
					if (p.startsWith('*')) {
						const at = keyTimes[keyIdx++] ?? appear;
						const lit = smoothstep(at - 0.05, at + 0.2, T);
						return (
							<span key={i} style={{fontStyle: 'normal', fontWeight: 700, color: lit > 0.5 ? BRAND.deepGold : '#6A5A48', letterSpacing: '0.01em', transform: `scale(${1 + 0.06 * Math.sin(lit * Math.PI)})`, display: 'inline-block'}}>
								{p.slice(1, -1).toUpperCase()}
							</span>
						);
					}
					return <span key={i}>{p}</span>;
				})}
			</div>
			<div style={{marginTop: 28, fontFamily: SANS, fontWeight: 600, fontSize: 22, letterSpacing: '0.22em', color: BRAND.deepGold}}>{reference}</div>
		</div>
	);
};

// ---------- tags and the NEVER stamp ----------
export const Tag: React.FC<{children: React.ReactNode; bg?: string; color?: string; size?: number; style?: React.CSSProperties}> = ({children, bg = BRAND.tag, color = '#FFFFFF', size = 30, style}) => (
	<div style={{display: 'inline-block', background: bg, color, fontFamily: SANS, fontWeight: 600, fontSize: size, letterSpacing: '0.12em', padding: '14px 26px', borderRadius: 999, whiteSpace: 'nowrap', ...style}}>{children}</div>
);

export const Stamp: React.FC<{text: string; k: number}> = ({text, k}) => {
	// slams in: big + transparent -> settles with a small overshoot
	const s = k <= 0 ? 2.2 : k < 1 ? lerp(2.2, 0.94, ease.in(k)) : 0.94 + 0.06 * Math.min(1, (k - 1) * 4);
	return (
		<div style={{display: 'inline-block', transform: `rotate(-7deg) scale(${s})`, opacity: k <= 0 ? 0 : Math.min(1, k * 1.6)}}>
			<svg width={330} height={120} viewBox="0 0 330 120">
				<defs>
					<filter id="rough">
						<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n" />
						<feDisplacementMap in="SourceGraphic" in2="n" scale="5" />
					</filter>
				</defs>
				<g filter="url(#rough)">
					<rect x={8} y={8} width={314} height={104} rx={10} fill="none" stroke={BRAND.deepGold} strokeWidth={8} />
					<text x={165} y={84} textAnchor="middle" fontFamily={SANS} fontWeight={700} fontSize={68} letterSpacing="8" fill={BRAND.deepGold}>
						{text}
					</text>
				</g>
			</svg>
		</div>
	);
};

// ---------- comment box typing ----------
export const CommentBox: React.FC<{text: string; typed: number; hearts: number; top?: number}> = ({text, typed, hearts, top = 1120}) => {
	const chars = Array.from(text);
	const n = Math.floor(clamp(typed) * chars.length + 0.0001);
	return (
		<div style={{position: 'absolute', left: 120, right: 120, top}}>
			<div style={{background: BRAND.cream, borderRadius: 999, padding: '26px 34px', display: 'flex', alignItems: 'center', gap: 22, boxShadow: '0 16px 40px rgba(0,0,0,0.35)'}}>
				<div style={{width: 46, height: 46, borderRadius: 23, background: 'linear-gradient(135deg, #F2B544, #9A5B0C)'}} />
				<div style={{fontFamily: SANS, fontWeight: 600, fontSize: 40, color: BRAND.ink, letterSpacing: '0.04em'}}>
					{chars.slice(0, n).join('')}
					<span style={{opacity: Math.floor(typed * 20) % 2 ? 1 : 0.2}}>|</span>
				</div>
			</div>
			{Array.from({length: 7}, (_, i) => {
				const h = clamp(hearts * 1.4 - i * 0.12);
				if (h <= 0) return null;
				return (
					<div key={i} style={{position: 'absolute', right: 40 + (i % 3) * 34, top: -20 - h * (160 + i * 30), fontSize: 40 + (i % 2) * 12, opacity: 1 - h, transform: `translateX(${Math.sin(i * 2 + h * 6) * 18}px)`}}>
						<svg width={44} height={40} viewBox="0 0 24 22">
							<path d="M12 21 C 5 15 1 11.5 1 7 C 1 3.5 3.6 1 6.8 1 C 9 1 10.9 2.3 12 4.2 C 13.1 2.3 15 1 17.2 1 C 20.4 1 23 3.5 23 7 C 23 11.5 19 15 12 21 Z" fill={i % 2 ? BRAND.gold : '#E2533C'} />
						</svg>
					</div>
				);
			})}
		</div>
	);
};

// ---------- end card ----------
export const EndCard: React.FC<{k: number; handle: string; tagline: string}> = ({k, handle, tagline}) => {
	const a = (from: number, dur = 0.25) => ease.out(clamp((k - from) / dur));
	return (
		<div style={{position: 'absolute', inset: 0, background: BRAND.night, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 34}}>
			<div style={{position: 'absolute', width: 700, height: 700, borderRadius: 350, background: 'radial-gradient(circle, rgba(242,181,68,0.14), rgba(242,181,68,0) 65%)', top: 420}} />
			<div style={{marginTop: -180}}>
				<Logo size={220} draw={clamp(k / 0.45)} />
			</div>
			<div style={{fontFamily: SANS, fontWeight: 600, fontSize: 46, letterSpacing: '0.26em', color: BRAND.cream, opacity: a(0.3)}}>GRACE IN MOTION</div>
			<div style={{fontFamily: SANS, fontWeight: 500, fontSize: 34, letterSpacing: '0.06em', color: BRAND.gold, opacity: a(0.42)}}>{handle}</div>
			<div style={{fontFamily: SERIF, fontStyle: 'italic', fontWeight: 500, fontSize: 52, color: BRAND.cream, opacity: a(0.55), marginTop: 12}}>{tagline}</div>
		</div>
	);
};
