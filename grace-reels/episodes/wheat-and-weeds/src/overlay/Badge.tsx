// Round badges for the "WHAT MOSES SAW" tracker: FIRE and SEA fill with a drawn icon, FACE is a glowing
// "?" until it fills with Jesus' face.
import {Img, staticFile} from 'remotion';
import {clamp, smooth} from '../lib/ease';
import {C, SANS, SERIF} from './theme';

// Jesus' face, cut from the close-up (the sprite is 638 x 1016; box = x0, y0, x1, y1 of a square)
export const JESUS_FACE = {src: 'sprites/jesus/closeup.png', box: [22, 140, 330, 448] as [number, number, number, number], w: 638, h: 1016};

// Overshooting pop (1 -> 1+amt -> 1) after `x` seconds.
export const pop = (x: number, amt = 0.28) => (x <= 0 ? 1 : 1 + amt * Math.exp(-x * 6.5) * Math.sin(x * 14));

const Flame: React.FC<{size: number}> = ({size}) => (
	<svg width={size} height={size} viewBox="0 0 40 40">
		<defs>
			<linearGradient id="fl" x1="0" y1="1" x2="0" y2="0">
				<stop offset="0" stopColor="#d9531e" />
				<stop offset="0.55" stopColor="#f28a2a" />
				<stop offset="1" stopColor="#ffd36a" />
			</linearGradient>
		</defs>
		<path d="M20 4 C24 11 31 14 31 23 C31 30 26 35 20 35 C14 35 9 30 9 24 C9 18 13 16 14 11 C17 14 17 17 18 19 C20 15 21 10 20 4 Z" fill="url(#fl)" stroke="#2B1D12" strokeWidth={1.6} strokeLinejoin="round" />
		<path d="M20 20 C22 23 25 25 25 28.5 C25 31.5 22.8 33.5 20 33.5 C17.2 33.5 15 31.5 15 28.8 C15 26 17.5 24.5 20 20 Z" fill="#ffe7a3" />
	</svg>
);

const Waves: React.FC<{size: number}> = ({size}) => (
	<svg width={size} height={size} viewBox="0 0 40 40">
		<path d="M4 26 C9 20 13 20 17 24 C20 27 23 27 26 24 C29 21 33 20 36 23 L36 34 L4 34 Z" fill="#2e7f8a" stroke="#2B1D12" strokeWidth={1.6} strokeLinejoin="round" />
		<path d="M4 18 C9 12 13 12 17 16 C20 19 23 19 26 16 C29 13 33 12 36 15" fill="none" stroke="#5fa7b0" strokeWidth={3.2} strokeLinecap="round" />
		<path d="M8 27.5 C11 25.5 13.5 25.5 16 27.5" fill="none" stroke="#e8f1f8" strokeWidth={2} strokeLinecap="round" />
	</svg>
);

export type BadgeKind = 'fire' | 'sea' | 'face';

export const Badge: React.FC<{
	kind: BadgeKind;
	size: number;
	fill: number; // seconds since the badge filled (<= 0: still empty)
	appear: number; // 0..1 entrance
	glow?: number; // extra glow on the empty "?" (FACE)
	name: string;
}> = ({kind, size, fill, appear, glow = 0, name}) => {
	const filled = fill > 0;
	const f = clamp(fill / 0.25);
	const scale = (0.4 + 0.6 * smooth(appear)) * (filled ? pop(fill) : 1);
	const burst = filled && fill < 0.9 ? fill / 0.9 : 0;
	const [x0, y0, x1] = JESUS_FACE.box;
	const k = size / (x1 - x0);
	const qGlow = 0.6 + 0.4 * glow;
	return (
		<div style={{position: 'relative', width: size, height: size + 30, opacity: smooth(appear)}}>
			<div style={{position: 'relative', width: size, height: size, transform: `scale(${scale})`}}>
				{burst > 0 && (
					<div
						style={{
							position: 'absolute',
							left: size / 2,
							top: size / 2,
							width: size * (1 + burst * 1.4),
							height: size * (1 + burst * 1.4),
							transform: 'translate(-50%, -50%)',
							borderRadius: '50%',
							border: `${3 * (1 - burst) + 1}px solid ${C.gold}`,
							opacity: 1 - burst,
						}}
					/>
				)}
				<div
					style={{
						position: 'absolute',
						inset: 0,
						borderRadius: '50%',
						overflow: 'hidden',
						background: filled ? (kind === 'face' ? '#e9d2a8' : '#3a2a1c') : 'rgba(20,15,10,0.55)',
						boxShadow: filled
							? `0 0 ${24 * Math.exp(-fill * 1.5) + 8}px rgba(242,181,68,${0.35 + 0.5 * Math.exp(-fill * 1.5)})`
							: kind === 'face'
								? `0 0 ${10 + 22 * glow}px rgba(255,214,120,${0.25 + 0.5 * glow})`
								: '0 2px 10px rgba(0,0,0,0.35)',
					}}
				>
					{kind === 'face' && (
						<Img
							src={staticFile(JESUS_FACE.src)}
							style={{
								position: 'absolute',
								left: -x0 * k,
								top: -y0 * k,
								width: JESUS_FACE.w * k,
								height: JESUS_FACE.h * k,
								opacity: f,
								transform: `scale(${1.15 - 0.15 * f})`,
								transformOrigin: `${(x0 + (x1 - x0) / 2) * k}px ${(y0 + (x1 - x0) / 2) * k}px`,
							}}
						/>
					)}
					{kind !== 'face' && f > 0 && (
						<div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: f, transform: `scale(${0.6 + 0.4 * f})`}}>
							{kind === 'fire' ? <Flame size={size * 0.72} /> : <Waves size={size * 0.72} />}
						</div>
					)}
					{kind === 'face' && f < 1 && (
						<div
							style={{
								position: 'absolute',
								inset: 0,
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								fontFamily: SERIF,
								fontStyle: 'italic',
								fontWeight: 600,
								fontSize: size * 0.58,
								color: '#FFE7B0',
								opacity: qGlow * (1 - f),
								textShadow: `0 0 ${8 + 18 * glow}px rgba(255,214,120,${0.6 + 0.4 * glow})`,
							}}
						>
							?
						</div>
					)}
				</div>
				<div
					style={{
						position: 'absolute',
						inset: 0,
						borderRadius: '50%',
						border: filled ? `${Math.max(3, size * 0.045)}px solid ${C.gold}` : `${Math.max(2.5, size * 0.035)}px dashed rgba(242,181,68,0.75)`,
					}}
				/>
			</div>
			<div
				style={{
					position: 'absolute',
					top: size + 8,
					left: '50%',
					transform: 'translateX(-50%)',
					fontFamily: SANS,
					fontWeight: 700,
					fontSize: 17,
					letterSpacing: '0.18em',
					color: filled ? C.gold : C.cream,
					opacity: filled ? 0.95 : 0.7,
					whiteSpace: 'nowrap',
					textShadow: '0 1px 6px rgba(0,0,0,0.6)',
				}}
			>
				{name}
			</div>
		</div>
	);
};
