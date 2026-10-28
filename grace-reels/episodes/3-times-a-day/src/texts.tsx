import React from 'react';
import {BRAND, SANS, SERIF} from '../../../src/shared/text/brand';
import {clamp, ease, lerp, smoothstep} from '../../../src/shared/math';

export const BLUE = '#6FA8FF';

// ---------- opening numbers ----------
// A gold number that lands with weight: drops in a touch big, squashes, settles, glows.
export const LandingNumber: React.FC<{text: string; T: number; at: number; color?: string; glow?: string; y?: number; size?: number}> = ({text, T, at, color = BRAND.gold, glow = 'rgba(242,181,68,0.75)', y = 1050, size = 260}) => {
	const k = clamp((T - at) / 0.2);
	if (T < at) return null;
	const s = k < 1 ? lerp(1.42, 0.94, ease.in(k)) : 0.94 + 0.06 * ease.out(clamp((T - at - 0.2) / 0.14));
	const squash = k >= 1 ? 1 - 0.07 * Math.exp(-(T - at - 0.2) * 18) : 1;
	const pulse = Math.exp(-(T - at) * 5);
	return (
		<div style={{position: 'absolute', left: 0, right: 0, top: y - size * 0.62, height: size * 1.24, display: 'flex', justifyContent: 'center', alignItems: 'center', pointerEvents: 'none'}}>
			<div
				style={{
					fontFamily: SERIF,
					fontWeight: 700,
					fontSize: size,
					fontVariantNumeric: 'lining-nums',
					lineHeight: 1,
					color,
					opacity: clamp(k * 3),
					transform: `scale(${s / Math.sqrt(squash)}, ${s * squash})`,
					transformOrigin: '50% 80%',
					textShadow: `0 0 ${30 + pulse * 70}px ${glow}, 0 10px 34px rgba(0,0,0,0.45)`,
				}}
			>
				{text}
			</div>
		</div>
	);
};

export const NumberLabel: React.FC<{text: string; T: number; at: number; y?: number; color?: string; icon?: 'phone' | null; opacity?: number}> = ({text, T, at, y = 1196, color = '#FFFFFF', icon = null, opacity = 1}) => {
	const k = ease.out(clamp((T - at) / 0.3));
	if (T < at) return null;
	return (
		<div style={{position: 'absolute', left: 0, right: 0, top: y, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, opacity: k * opacity, transform: `translateY(${(1 - k) * 14}px)`}}>
			{icon === 'phone' ? (
				<svg width={26} height={40} viewBox="0 0 26 40">
					<rect x={2} y={2} width={22} height={36} rx={5} fill="none" stroke={color} strokeWidth={3} />
					<rect x={9} y={32} width={8} height={2.5} rx={1.2} fill={color} />
				</svg>
			) : null}
			<span style={{fontFamily: SANS, fontWeight: 600, fontSize: 26, letterSpacing: '0.32em', color, textShadow: '0 1px 10px rgba(0,0,0,0.6)'}}>{text}</span>
		</div>
	);
};

// The phone's counter: rolls like an odometer, motion-blurred while it races.
// value(t) is a float; whole digits roll past one another.
export const Odometer: React.FC<{value: number; speed: number; plus?: number; y?: number; size?: number; T: number; at: number}> = ({value, speed, plus = 0, y = 1050, size = 260, T, at}) => {
	if (T < at) return null;
	const appear = ease.out(clamp((T - at) / 0.12));
	const digits = value >= 99.5 ? 3 : value >= 9.5 ? 2 : 1;
	const cols = [];
	const dh = size * 1.0;
	for (let i = digits - 1; i >= 0; i--) {
		const place = Math.pow(10, i);
		// each column turns continuously only while the column below it rolls over
		const raw = value / place;
		const whole = Math.floor(raw);
		const frac = raw - whole;
		const lower = i === 0 ? frac : Math.max(0, (value % place) - (place - 1)) / 1;
		const pos = (whole % 10) + (i === 0 ? frac : clamp(lower));
		cols.push(
			<div key={i} style={{position: 'relative', width: size * 0.56, height: dh, overflow: 'hidden'}}>
				<div style={{position: 'absolute', left: 0, right: 0, top: -pos * dh, filter: speed > 0.05 ? `url(#vblur${Math.min(6, Math.round(speed * 6))})` : undefined}}>
					{Array.from({length: 11}, (_, n) => (
						<div key={n} style={{height: dh, lineHeight: `${dh}px`, textAlign: 'center'}}>
							{n % 10}
						</div>
					))}
				</div>
			</div>,
		);
	}
	return (
		<div style={{position: 'absolute', left: 0, right: 0, top: y - dh / 2, height: dh, display: 'flex', justifyContent: 'center', opacity: appear}}>
			<svg width={0} height={0} style={{position: 'absolute'}}>
				<defs>
					{[1, 2, 3, 4, 5, 6].map((n) => (
						<filter key={n} id={`vblur${n}`} x="-10%" y="-50%" width="120%" height="200%">
							<feGaussianBlur stdDeviation={`0 ${n * 7}`} />
						</filter>
					))}
				</defs>
			</svg>
			<div style={{display: 'flex', fontFamily: SERIF, fontWeight: 700, fontSize: size, fontVariantNumeric: 'lining-nums', color: BLUE, textShadow: '0 0 46px rgba(111,168,255,0.8), 0 10px 34px rgba(0,0,0,0.5)'}}>
				{cols}
				<div style={{width: size * 0.5 * plus, overflow: 'visible', lineHeight: `${dh}px`, opacity: plus, transform: `scale(${lerp(1.5, 1, ease.out(plus))})`}}>+</div>
			</div>
		</div>
	);
};

// S2 title: WHY IS PRAYER / SO HARD NOW?
export const OpeningTitle: React.FC<{T: number; at: number; y?: number}> = ({T, at, y = 1300}) => {
	if (T < at) return null;
	const a = ease.out(clamp((T - at) / 0.28));
	const b = ease.out(clamp((T - at - 0.12) / 0.28));
	const line = (op: number): React.CSSProperties => ({fontFamily: SERIF, fontWeight: 700, fontSize: 96, lineHeight: 1.08, letterSpacing: '0.03em', opacity: op, transform: `translateY(${(1 - op) * 18}px)`, textShadow: '0 6px 30px rgba(0,0,0,0.6)'});
	return (
		<div style={{position: 'absolute', left: 0, right: 0, top: y - 104, textAlign: 'center'}}>
			<div style={{...line(a), color: '#FFFFFF'}}>WHY IS PRAYER</div>
			<div style={{...line(b), color: BRAND.gold}}>SO HARD NOW?</div>
		</div>
	);
};

// the two-row scoreboard under the captions (big and centred in S13)
export const Scoreboard: React.FC<{prayer: string; phone: string; k?: number; big?: number; glow?: number; opacity?: number}> = ({prayer, phone, k = 1, big = 0, glow = 0, opacity = 1}) => {
	const size = lerp(30, 84, big);
	const x = lerp(72, 540, big);
	const y = lerp(652, 820, big);
	const row = (label: string, value: string, color: string, g: number): React.ReactNode => (
		<div style={{display: 'flex', alignItems: 'center', gap: size * 0.42, justifyContent: big > 0.5 ? 'center' : 'flex-start'}}>
			<div style={{width: size * 0.36, height: size * 0.36, borderRadius: size, background: color, boxShadow: `0 0 ${10 + g * 40}px ${color}`}} />
			<span style={{fontFamily: SANS, fontWeight: 700, fontSize: size, letterSpacing: '0.12em', color, textShadow: `0 0 ${g * 36}px ${color}, 0 2px 10px rgba(0,0,0,0.6)`}}>
				{label}: {value}
			</span>
		</div>
	);
	return (
		<div style={{position: 'absolute', left: x, top: y, transform: `translate(${-50 * big}%, 0) translateX(${(1 - ease.out(k)) * -40}px)`, opacity: ease.out(k) * opacity, display: 'flex', flexDirection: 'column', gap: size * 0.32, background: `rgba(20,16,13,${0.38 * (1 - big)})`, padding: `${lerp(14, 0, big)}px ${lerp(20, 0, big)}px`, borderRadius: 16}}>
			{row('PRAYER', prayer, BRAND.gold, glow)}
			{row('PHONE', phone, BLUE, 0)}
		</div>
	);
};

void smoothstep;
