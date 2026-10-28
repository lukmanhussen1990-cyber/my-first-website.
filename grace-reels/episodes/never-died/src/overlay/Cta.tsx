// S10 call to action and S11 end card (2D screens drawn over a dark background).
import {clamp, easeOut, easeOutBack, seg, smooth} from '../lib/ease';
import {hash} from '../lib/random';
import {B, COMMENT_TEXT} from '../lib/timeline';
import {Badge, FACES} from './Badge';
import {Logo} from './Logo';
import {C, SAFE, SANS, SERIF} from './theme';

const CTA_IN = B.s10 - 0.15;
const END_IN = B.s11;

// Faint gold rings slowly widening from the centre of the badges.
const Rings: React.FC<{t: number; cx: number; cy: number}> = ({t, cx, cy}) => (
	<svg width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0}}>
		{Array.from({length: 7}, (_, i) => {
			const r = 140 + ((i * 120 + (t - CTA_IN) * 28) % 840);
			return <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={C.gold} strokeWidth={1.5} opacity={0.12 * (1 - r / 980)} />;
		})}
	</svg>
);

const Heart: React.FC<{x: number; y: number; size: number; color: string; opacity: number; rot: number}> = ({x, y, size, color, opacity, rot}) => (
	<svg width={size} height={size} viewBox="0 0 24 24" style={{position: 'absolute', left: x - size / 2, top: y - size / 2, opacity, transform: `rotate(${rot}deg)`}}>
		<path d="M12 21s-7.5-4.6-9.6-9.1C.9 8.6 2.9 5 6.4 5c2.1 0 3.5 1.2 4.3 2.4h2.6C14.1 6.2 15.5 5 17.6 5c3.5 0 5.5 3.6 4 6.9C19.5 16.4 12 21 12 21z" fill={color} />
	</svg>
);

export const CallToAction: React.FC<{t: number}> = ({t}) => {
	const inP = seg(t, CTA_IN, CTA_IN + 0.5);
	const out = seg(t, END_IN - 0.25, END_IN + 0.1);
	if (inP <= 0 || out >= 1) return null;
	const badgeY = 900;
	const typed = clamp(Math.floor((t - B.typingStart) * B.typingCps), 0, COMMENT_TEXT.length);
	const cursorOn = Math.floor(t * 2.2) % 2 === 0 || (t > B.typingStart && t < B.typingEnd);
	const boxIn = seg(t, B.typingStart - 0.5, B.typingStart - 0.05);
	return (
		<div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, opacity: smooth(inP) * (1 - out)}}>
			<div style={{position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 85% 60% at 50% 46%, #3a2719 0%, #2a1c13 45%, #1a120c 100%)'}} />
			<Rings t={t} cx={540} cy={badgeY} />
			{/* the two men, complete */}
			{(['enoch', 'elijah'] as const).map((k, i) => {
				const p = seg(t, CTA_IN + 0.15 + i * 0.12, CTA_IN + 0.6 + i * 0.12);
				const x = i === 0 ? 330 : 750;
				return (
					<div key={k} style={{position: 'absolute', left: x - 110, top: badgeY - 110 + 40 * (1 - easeOutBack(p, 1.3)), opacity: smooth(p)}}>
						<Badge face={FACES[k]} size={220} fill={5} appear={1} />
						<div style={{position: 'absolute', top: 236, left: '50%', transform: 'translateX(-50%)', fontFamily: SERIF, fontStyle: 'italic', fontWeight: 600, fontSize: 44, color: C.cream, whiteSpace: 'nowrap'}}>
							{FACES[k].name}
						</div>
						<div style={{position: 'absolute', top: 296, left: '50%', transform: 'translateX(-50%)', fontFamily: SANS, fontWeight: 600, fontSize: 17, letterSpacing: '0.2em', color: C.gold, opacity: 0.8, whiteSpace: 'nowrap'}}>
							{i === 0 ? 'GENESIS 5:24' : '2 KINGS 2:11'}
						</div>
					</div>
				);
			})}
			<div style={{position: 'absolute', left: 0, width: 1080, top: badgeY - 214, textAlign: 'center', fontFamily: SANS, fontWeight: 700, fontSize: 24, letterSpacing: '0.24em', color: C.gold, opacity: smooth(seg(t, CTA_IN + 0.3, CTA_IN + 0.8))}}>
				2 MEN WHO NEVER DIED
			</div>
			{/* the comment box typing a question */}
			<div
				style={{
					position: 'absolute',
					left: SAFE.left + 6,
					top: 1250 + 30 * (1 - easeOut(boxIn)),
					width: SAFE.right - SAFE.left - 12,
					height: 112,
					borderRadius: 56,
					background: C.cream,
					boxShadow: '0 16px 40px rgba(0,0,0,0.45)',
					display: 'flex',
					alignItems: 'center',
					opacity: smooth(boxIn),
				}}
			>
				<div style={{width: 64, height: 64, borderRadius: 32, marginLeft: 24, marginRight: 20, background: `radial-gradient(circle at 35% 35%, #ffd27a, ${C.gold} 55%, #b9822a)`, flex: 'none'}} />
				<div style={{fontFamily: SERIF, fontStyle: 'italic', fontWeight: 500, fontSize: 46, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden'}}>
					{COMMENT_TEXT.slice(0, typed)}
					<span style={{display: 'inline-block', width: 3, height: 46, marginLeft: 4, verticalAlign: '-6px', background: C.ink, opacity: cursorOn ? 0.9 : 0}} />
				</div>
			</div>
			{/* hearts floating up from the box */}
			{Array.from({length: 9}, (_, k) => {
				const born = B.hearts + k * 0.2;
				const age = t - born;
				if (age < 0 || age > 2.2) return null;
				const x = 760 + (hash(91, k) - 0.5) * 300 + Math.sin(age * 3 + k) * 26;
				const y = 1260 - age * 260;
				const size = 34 + hash(92, k) * 26;
				return <Heart key={k} x={x} y={y} size={size * (0.6 + 0.4 * easeOutBack(clamp(age / 0.3), 2))} color={k % 3 === 0 ? C.cream : k % 3 === 1 ? C.gold : '#e8a3a0'} opacity={clamp(age / 0.15) * (1 - clamp((age - 1.4) / 0.8))} rot={(hash(93, k) - 0.5) * 30} />;
			})}
		</div>
	);
};

export const EndCard: React.FC<{t: number}> = ({t}) => {
	const inP = seg(t, END_IN - 0.2, END_IN + 0.15);
	const out = seg(t, B.loopOut, B.total);
	if (inP <= 0 || out >= 1) return null;
	const draw = seg(t, B.logoDraw, B.logoDraw + 1.25);
	const text1 = seg(t, B.logoDraw + 0.9, B.logoDraw + 1.4);
	const text2 = seg(t, B.logoDraw + 1.15, B.logoDraw + 1.65);
	const text3 = seg(t, B.logoDraw + 1.4, B.logoDraw + 1.9);
	const glow = draw >= 1 ? Math.exp(-(t - B.logoDraw - 1.25) * 2) : 0;
	return (
		<div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, opacity: smooth(inP) * (1 - out), background: C.night}}>
			<div style={{position: 'absolute', left: 540 - 110, top: 690}}>
				<Logo size={220} draw={draw} glow={0.4 + glow} />
			</div>
			<div style={{position: 'absolute', width: 1080, top: 960, textAlign: 'center', fontFamily: SANS, fontWeight: 600, fontSize: 44, letterSpacing: '0.24em', color: C.cream, opacity: smooth(text1), transform: `translateY(${12 * (1 - easeOut(text1))}px)`}}>
				GRACE IN MOTION
			</div>
			<div style={{position: 'absolute', width: 1080, top: 1036, textAlign: 'center', fontFamily: SANS, fontWeight: 600, fontSize: 30, letterSpacing: '0.08em', color: C.gold, opacity: smooth(text2), transform: `translateY(${12 * (1 - easeOut(text2))}px)`}}>
				@GraceINMotion616
			</div>
			<div style={{position: 'absolute', width: 1080, top: 1106, textAlign: 'center', fontFamily: SERIF, fontStyle: 'italic', fontWeight: 500, fontSize: 44, color: C.cream, opacity: 0.85 * smooth(text3), transform: `translateY(${12 * (1 - easeOut(text3))}px)`}}>
				Hard questions. Bible answers.
			</div>
		</div>
	);
};
