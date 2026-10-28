// S14 call to action (over a dark warm background) and S15 end card.
import {clamp, easeOut, easeOutBack, seg, smooth} from '../lib/ease';
import {hash} from '../lib/random';
import {B, COMMENT_TEXT} from '../lib/timeline';
import {Logo} from './Logo';
import {C, SAFE, SANS, SERIF} from './theme';

const END_IN = B.s15;

const Heart: React.FC<{x: number; y: number; size: number; color: string; opacity: number; rot: number}> = ({x, y, size, color, opacity, rot}) => (
	<svg width={size} height={size} viewBox="0 0 24 24" style={{position: 'absolute', left: x - size / 2, top: y - size / 2, opacity, transform: `rotate(${rot}deg)`}}>
		<path d="M12 21s-7.5-4.6-9.6-9.1C.9 8.6 2.9 5 6.4 5c2.1 0 3.5 1.2 4.3 2.4h2.6C14.1 6.2 15.5 5 17.6 5c3.5 0 5.5 3.6 4 6.9C19.5 16.4 12 21 12 21z" fill={color} />
	</svg>
);

const BOX_Y = 1250;

// S14: the question is in the captions; a comment types itself and hearts float up from it.
export const CallToAction: React.FC<{t: number}> = ({t}) => {
	const out = seg(t, END_IN - 0.25, END_IN + 0.1);
	if (t < B.s14 - 0.1 || out >= 1) return null;
	const typed = [...COMMENT_TEXT].slice(0, clamp(Math.floor((t - B.typingStart) * B.typingCps), 0, [...COMMENT_TEXT].length)).join('');
	const cursorOn = Math.floor(t * 2.2) % 2 === 0 || (t > B.typingStart && t < B.typingEnd);
	const boxIn = seg(t, B.typingStart - 0.45, B.typingStart - 0.05);
	const tap = Math.exp(-Math.max(0, t - B.typingEnd) * 6) * (t > B.typingEnd ? 1 : 0);
	return (
		<div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, opacity: 1 - out}}>
			{/* the comment box typing an answer */}
			<div
				style={{
					position: 'absolute',
					left: SAFE.left + 6,
					top: BOX_Y + 30 * (1 - easeOut(boxIn)),
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
				<div style={{flex: 1, fontFamily: SERIF, fontStyle: 'italic', fontWeight: 500, fontSize: 46, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden'}}>
					{typed}
					<span style={{display: 'inline-block', width: 3, height: 46, marginLeft: 4, verticalAlign: '-6px', background: C.ink, opacity: cursorOn ? 0.9 : 0}} />
				</div>
				{/* send arrow, tapped when the comment is done */}
				<div style={{width: 64, height: 64, borderRadius: 32, marginRight: 24, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: t > B.typingEnd ? C.deepGold : 'rgba(30,26,22,0.12)', transform: `scale(${1 - 0.15 * tap})`}}>
					<svg width={30} height={30} viewBox="0 0 24 24">
						<path d="M4 12 L20 4 L14 20 L11.5 13 Z" fill={t > B.typingEnd ? C.cream : 'rgba(30,26,22,0.45)'} />
					</svg>
				</div>
			</div>
			{/* hearts floating up from the box */}
			{Array.from({length: 9}, (_, k) => {
				const born = B.hearts + k * 0.18;
				const age = t - born;
				if (age < 0 || age > 2.2) return null;
				// up the right edge
				const x = 905 + (hash(91, k) - 0.5) * 90 + Math.sin(age * 3 + k) * 18;
				const y = BOX_Y - age * 240;
				const size = 34 + hash(92, k) * 26;
				return <Heart key={k} x={x} y={y} size={size * (0.6 + 0.4 * easeOutBack(clamp(age / 0.3), 2))} color={k % 3 === 0 ? C.cream : k % 3 === 1 ? C.gold : '#e8a3a0'} opacity={clamp(age / 0.15) * (1 - clamp((age - 1.3) / 0.7))} rot={(hash(93, k) - 0.5) * 30} />;
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
