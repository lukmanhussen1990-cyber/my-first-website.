// The field meter under the captions: WHEAT (gold) and WEEDS (charcoal with a gold edge) counting up on
// rolling odometer digits. In S7 a "PULL ALL WEEDS" button appears, a hand cursor reaches for it and a
// deep-gold NAY stamp slams down on it. At "all have sinned" the weeds roll over to ALL. At the end the
// meter becomes READY? with YES and NOT YET.
import {clamp, easeInOut, easeOut, easeOutBack, lerp, seg, smooth} from '../lib/ease';
import {B} from '../lib/timeline';
import {C, SAFE, SANS, SERIF} from './theme';

const Y = 650;
const ROW = 40; // odometer line height

const wheatValue = (t: number) => lerp(0, 1200, easeOut(seg(t, B.wheatStart, B.s4, (x) => x))) + lerp(0, 3600, smooth(seg(t, B.growStart, B.s6, (x) => x)));
const weedsValue = (t: number) => lerp(0, 1300, smooth(seg(t, B.weedsStart, B.s6, (x) => x)));

export const WheatIcon: React.FC<{size: number}> = ({size}) => (
	<svg width={size} height={size} viewBox="0 0 32 32">
		<path d="M16 30 V9" stroke="#2B1D12" strokeWidth={3.2} strokeLinecap="round" />
		<path d="M16 30 V9" stroke={C.gold} strokeWidth={1.6} strokeLinecap="round" />
		{[0, 1, 2, 3].map((k) => (
			<g key={k}>
				<ellipse cx={12.6} cy={10.5 + k * 4.2} rx={2.4} ry={3.6} transform={`rotate(-28 12.6 ${10.5 + k * 4.2})`} fill={C.gold} stroke="#2B1D12" strokeWidth={1.1} />
				<ellipse cx={19.4} cy={10.5 + k * 4.2} rx={2.4} ry={3.6} transform={`rotate(28 19.4 ${10.5 + k * 4.2})`} fill={C.gold} stroke="#2B1D12" strokeWidth={1.1} />
			</g>
		))}
		<ellipse cx={16} cy={6.6} rx={2.2} ry={3.4} fill={C.gold} stroke="#2B1D12" strokeWidth={1.1} />
	</svg>
);

export const WeedIcon: React.FC<{size: number}> = ({size}) => (
	<svg width={size} height={size} viewBox="0 0 32 32">
		<path d="M16 30 C16 22 15 16 16 8" stroke={C.gold} strokeWidth={3.4} strokeLinecap="round" fill="none" />
		<path d="M16 30 C16 22 15 16 16 8" stroke="#2a2430" strokeWidth={1.8} strokeLinecap="round" fill="none" />
		{[0, 1, 2, 3, 4].map((k) => (
			<path key={k} d={`M16 ${9 + k * 3.6} l${k % 2 ? 5 : -5} -3.4`} stroke={C.gold} strokeWidth={3.2} strokeLinecap="round" />
		))}
		{[0, 1, 2, 3, 4].map((k) => (
			<path key={`d${k}`} d={`M16 ${9 + k * 3.6} l${k % 2 ? 5 : -5} -3.4`} stroke="#2a2430" strokeWidth={1.7} strokeLinecap="round" />
		))}
		<path d="M10 30 Q14 25 13 21 M22 30 Q18 25 19 21" stroke="#2a2430" strokeWidth={1.6} fill="none" strokeLinecap="round" />
	</svg>
);

// One rolling digit column showing the continuous value `v` (0..10).
const Digit: React.FC<{v: number; color: string; stroke?: string}> = ({v, color, stroke}) => {
	const d = ((v % 10) + 10) % 10;
	return (
		<span style={{display: 'inline-block', height: ROW, overflow: 'hidden', verticalAlign: 'top'}}>
			<span style={{display: 'flex', flexDirection: 'column', transform: `translateY(${-d * ROW}px)`}}>
				{[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n, i) => (
					<span key={i} style={{height: ROW, lineHeight: `${ROW}px`, color, WebkitTextStroke: stroke, fontVariantNumeric: 'tabular-nums'}}>
						{n}
					</span>
				))}
			</span>
		</span>
	);
};

// An odometer: each column rolls on its own share of the value; columns snap when the one below passes 9.
const Odometer: React.FC<{value: number; digits: number; color: string; stroke?: string}> = ({value, digits, color, stroke}) => {
	const cols: React.ReactNode[] = [];
	const v = Math.max(0, value);
	const lead = Math.max(1, Math.floor(Math.log10(Math.max(1, v))) + 1);
	for (let k = Math.min(digits, lead) - 1; k >= 0; k--) {
		const p = Math.pow(10, k);
		// the column turns smoothly only while the lower columns roll from 9 to 0
		const lower = v % p;
		const whole = Math.floor(v / p);
		const frac = k === 0 ? v - Math.floor(v) : clamp((lower - (p - 1)) / 1);
		cols.push(<Digit key={`d${k}`} v={(whole % 10) + frac} color={color} stroke={stroke} />);
		if (k % 3 === 0 && k > 0) cols.push(<span key={`c${k}`} style={{color, WebkitTextStroke: stroke}}>,</span>);
	}
	return <span style={{display: 'inline-flex', alignItems: 'flex-start'}}>{cols}</span>;
};

// letters rolling in to replace the weed count ("ALL")
const RollWord: React.FC<{word: string; k: number; color: string; stroke?: string}> = ({word, k, color, stroke}) => (
	<span style={{display: 'inline-flex'}}>
		{[...word].map((ch, i) => {
			const p = easeOutBack(clamp(k * 1.6 - i * 0.25), 1.4);
			return (
				<span key={i} style={{display: 'inline-block', height: ROW, overflow: 'hidden'}}>
					<span style={{display: 'inline-block', lineHeight: `${ROW}px`, transform: `translateY(${(1 - p) * ROW}px)`, color, WebkitTextStroke: stroke}}>{ch}</span>
				</span>
			);
		})}
	</span>
);

const label: React.CSSProperties = {fontFamily: SANS, fontWeight: 700, fontSize: 28, letterSpacing: '0.14em', lineHeight: `${ROW}px`, whiteSpace: 'nowrap'};
const WEED_STROKE = `1.2px ${C.gold}`;

export const FieldMeter: React.FC<{t: number}> = ({t}) => {
	const appear = seg(t, B.meterIn, B.meterIn + 0.4);
	const toReady = seg(t, B.readyIn - 0.1, B.readyIn + 0.35);
	const out = smooth((t - (B.s14 - 0.3)) / 0.3);
	if (appear <= 0.001 || out >= 1) return null;
	const all = seg(t, B.counterAll, B.counterAll + 0.6, (x) => x);
	const pulse = (at: number) => (t > at ? 1 + 0.18 * Math.exp(-(t - at) * 7) * Math.sin(Math.min(Math.PI, (t - at) * 18)) : 1);
	const meterVis = smooth(appear) * (1 - toReady);
	return (
		<>
			{meterVis > 0.001 && (
				<div
					style={{
						position: 'absolute',
						left: SAFE.left,
						top: Y - ROW / 2,
						display: 'flex',
						alignItems: 'center',
						gap: 34,
						opacity: meterVis,
						transform: `translateY(${-16 * toReady}px)`,
						textShadow: '0 2px 10px rgba(0,0,0,0.65)',
					}}
				>
					<div style={{display: 'flex', alignItems: 'center', gap: 10, transform: `scale(${pulse(B.wheatStart)})`, transformOrigin: '0 50%'}}>
						<WheatIcon size={36} />
						<span style={{...label, color: C.gold}}>WHEAT</span>
						<span style={{...label, color: C.cream, minWidth: 110}}>
							<Odometer value={wheatValue(t)} digits={4} color={C.cream} />
						</span>
					</div>
					<div style={{display: 'flex', alignItems: 'center', gap: 10, transform: `scale(${pulse(B.weedsStart) * pulse(B.counterAll)})`, transformOrigin: '0 50%'}}>
						<WeedIcon size={36} />
						<span style={{...label, color: '#2a2430', WebkitTextStroke: WEED_STROKE}}>WEEDS</span>
						<span style={{...label, minWidth: 110}}>
							{all > 0 ? (
								<RollWord word="ALL" k={all} color="#2a2430" stroke={WEED_STROKE} />
							) : (
								<Odometer value={weedsValue(t)} digits={4} color="#2a2430" stroke={WEED_STROKE} />
							)}
						</span>
					</div>
				</div>
			)}
			<PullButton t={t} />
			<Ready t={t} />
		</>
	);
};

// ---- S7: the button, the cursor and the NAY stamp ----
const BTN = {x: 540 - 48, y: 820, w: 520, h: 104};

const Cursor: React.FC<{x: number; y: number; press: number; opacity: number}> = ({x, y, press, opacity}) => (
	<svg width={64} height={64} viewBox="0 0 32 32" style={{position: 'absolute', left: x - 12, top: y - 3, opacity, transform: `scale(${1 - 0.12 * press})`, transformOrigin: '12px 3px', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.45))'}}>
		<path d="M12 2.5 C13.6 2.5 14.6 3.6 14.6 5.2 V14 L15.6 13.2 C17 12.4 18.6 13 19.2 14.4 C20.6 13.6 22.3 14.3 22.8 15.8 C24.2 15.2 25.9 16 26.2 17.6 L26.4 22 C26.4 26.4 23.2 29.5 18.8 29.5 H17.2 C14.6 29.5 12.6 28.4 11.1 26.3 L6.4 19.6 C5.6 18.4 6 16.9 7.2 16.2 C8.3 15.6 9.6 15.9 10.3 16.9 L9.4 15.4 V5.2 C9.4 3.6 10.4 2.5 12 2.5 Z" fill="#FFFFFF" stroke="#1E1A16" strokeWidth={1.4} strokeLinejoin="round" />
	</svg>
);

const PullButton: React.FC<{t: number}> = ({t}) => {
	const inP = seg(t, B.buttonIn, B.buttonIn + 0.35);
	const out = seg(t, B.buttonOut, B.buttonOut + 0.4);
	if (inP <= 0 || out >= 1) return null;
	// the hand comes in from the lower right, settles on the button, then backs away after the stamp
	const come = easeInOut(seg(t, B.cursorIn, B.cursorHover, (x) => x));
	const leave = easeInOut(seg(t, B.nay + 0.25, B.nay + 0.75, (x) => x));
	const cx = lerp(lerp(930, BTN.x + BTN.w * 0.6, come), 990, leave);
	const cy = lerp(lerp(1230, BTN.y + BTN.h * 0.55, come), 1260, leave);
	const hover = smooth((t - B.cursorHover + 0.1) / 0.2) * (1 - smooth((t - B.nay) / 0.1));
	// a nervous little press that never quite clicks, just before the NAY
	const press = clamp(Math.sin(Math.PI * seg(t, B.nay - 0.35, B.nay - 0.05, (x) => x)));
	const stamp = seg(t, B.nay - 0.05, B.nay + 0.12, (x) => x);
	const stampScale = stamp <= 0 ? 0 : lerp(2.1, 1, easeOut(stamp)) * (stamp >= 1 ? 1 + 0.05 * Math.exp(-(t - B.nay - 0.12) * 8) * Math.sin((t - B.nay) * 40) : 1);
	const dim = smooth((t - B.nay) / 0.15);
	const shake = t > B.nay && t < B.nay + 0.3 ? Math.sin((t - B.nay) * 70) * 6 * (1 - (t - B.nay) / 0.3) : 0;
	return (
		<div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, opacity: smooth(inP) * (1 - out)}}>
			<div
				style={{
					position: 'absolute',
					left: BTN.x - BTN.w / 2 + shake,
					top: BTN.y,
					width: BTN.w,
					height: BTN.h,
					borderRadius: BTN.h / 2,
					background: `rgba(30,26,22,${0.9 - 0.25 * dim})`,
					boxShadow: `0 14px 34px rgba(0,0,0,0.45), 0 0 0 ${2 + 3 * hover}px rgba(242,181,68,${0.35 + 0.5 * hover})`,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					gap: 18,
					transform: `scale(${(0.92 + 0.08 * easeOutBack(inP, 1.8)) * (1 + 0.03 * hover - 0.03 * press)})`,
				}}
			>
				<WeedIcon size={44} />
				<span style={{fontFamily: SANS, fontWeight: 700, fontSize: 34, letterSpacing: '0.12em', color: '#FFFFFF', opacity: 1 - 0.45 * dim}}>PULL ALL WEEDS</span>
			</div>
			{stamp > 0 && (
				<div style={{position: 'absolute', left: BTN.x, top: BTN.y + BTN.h / 2, transform: `translate(-50%, -50%) rotate(-9deg) scale(${stampScale})`, opacity: smooth(stamp / 0.3)}}>
					<svg width={420} height={190} viewBox="0 0 420 190" style={{overflow: 'visible', filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.35))'}}>
						<defs>
							<filter id="rough" x="-10%" y="-10%" width="120%" height="120%">
								<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" result="n" />
								<feDisplacementMap in="SourceGraphic" in2="n" scale="7" />
							</filter>
						</defs>
						<g filter="url(#rough)">
							<rect x={10} y={10} width={400} height={170} rx={22} fill="rgba(154,91,12,0.12)" stroke={C.deepGold} strokeWidth={12} />
							<rect x={30} y={30} width={360} height={130} rx={12} fill="none" stroke={C.deepGold} strokeWidth={4} />
							<text x={210} y={128} textAnchor="middle" fontFamily={SERIF} fontWeight={700} fontSize={118} letterSpacing={18} fill={C.deepGold}>
								NAY
							</text>
						</g>
					</svg>
				</div>
			)}
			{t > B.cursorIn && <Cursor x={cx} y={cy} press={press} opacity={smooth((t - B.cursorIn) / 0.2) * (1 - leave)} />}
		</div>
	);
};

// ---- S13: READY? YES / NOT YET ----
const Ready: React.FC<{t: number}> = ({t}) => {
	const inP = seg(t, B.readyIn, B.readyIn + 0.4);
	const out = smooth((t - (B.s14 - 0.3)) / 0.3);
	if (inP <= 0 || out >= 1) return null;
	const btns = seg(t, B.buttonsIn, B.buttonsIn + 0.35);
	const tap = (at: number) => (t > at ? Math.exp(-(t - at) * 6) : 0);
	const ring = (at: number) => (t > at && t < at + 0.6 ? (t - at) / 0.6 : -1);
	const Pill: React.FC<{text: string; at: number; gold: boolean; delay: number}> = ({text, at, gold, delay}) => {
		const a = easeOutBack(clamp(btns * 1.4 - delay), 1.8);
		const r = ring(at);
		return (
			<div style={{position: 'relative', transform: `scale(${(0.6 + 0.4 * a) * (1 - 0.1 * tap(at))})`, opacity: clamp(a * 1.5)}}>
				<div
					style={{
						padding: '0 38px',
						height: 84,
						borderRadius: 42,
						display: 'flex',
						alignItems: 'center',
						fontFamily: SANS,
						fontWeight: 700,
						fontSize: 32,
						letterSpacing: '0.14em',
						background: gold ? C.gold : 'rgba(20,16,13,0.85)',
						color: gold ? C.ink : C.gold,
						border: gold ? 'none' : `3px solid ${C.gold}`,
						boxShadow: `0 12px 30px rgba(0,0,0,0.45), 0 0 ${30 * tap(at)}px rgba(242,181,68,${0.8 * tap(at)})`,
						whiteSpace: 'nowrap',
					}}
				>
					{text}
				</div>
				{r >= 0 && <div style={{position: 'absolute', inset: -6 - 30 * r, borderRadius: 60, border: `3px solid rgba(242,181,68,${0.8 * (1 - r)})`}} />}
			</div>
		);
	};
	return (
		<div style={{position: 'absolute', left: SAFE.left, width: SAFE.right - SAFE.left, top: Y - 70, opacity: smooth(inP) * (1 - out), display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26}}>
			<div style={{fontFamily: SERIF, fontWeight: 700, fontSize: 84, letterSpacing: '0.06em', color: C.cream, textShadow: '0 4px 24px rgba(0,0,0,0.7)', transform: `translateY(${18 * (1 - easeOut(inP))}px)`}}>READY?</div>
			<div style={{display: 'flex', gap: 30}}>
				<Pill text="YES" at={B.yesTap} gold delay={0} />
				<Pill text="NOT YET" at={B.notYetTap} gold={false} delay={0.25} />
			</div>
		</div>
	);
};
