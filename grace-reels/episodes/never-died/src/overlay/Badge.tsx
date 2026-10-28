// Round portrait badge cut from a character's three-quarter view (used by the tracker and the call to action).
import {Img, staticFile} from 'remotion';
import {clamp, smooth} from '../lib/ease';
import {C, SANS, SERIF} from './theme';

export type Face = {src: string; box: [number, number, number, number]; w: number; h: number; name: string};

export const FACES: Record<'enoch' | 'elijah', Face> = {
	enoch: {src: 'sprites/enoch/threequarter.png', box: [125, 15, 365, 255], w: 415, h: 1015, name: 'Enoch'},
	elijah: {src: 'sprites/elijah/threequarter.png', box: [215, 5, 485, 275], w: 553, h: 1019, name: 'Elijah'},
};

// Overshooting pop (1 -> 1+amt -> 1) after `x` seconds.
export const pop = (x: number, amt = 0.28) => (x <= 0 ? 1 : 1 + amt * Math.exp(-x * 6.5) * Math.sin(x * 14));

export const Badge: React.FC<{
	face: Face;
	size: number;
	fill: number; // seconds since the badge filled (<= 0: still empty)
	appear: number; // 0..1 entrance
	showName?: boolean;
}> = ({face, size, fill, appear, showName = false}) => {
	const filled = fill > 0;
	const f = clamp(fill / 0.25);
	const scale = (0.4 + 0.6 * smooth(appear)) * (filled ? pop(fill) : 1);
	const [x0, y0, x1] = face.box;
	const k = size / (x1 - x0);
	const burst = filled && fill < 0.9 ? fill / 0.9 : 0;
	return (
		<div style={{position: 'relative', width: size, height: size, transform: `scale(${scale})`, opacity: smooth(appear)}}>
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
					background: filled ? '#4a3626' : 'rgba(20,15,10,0.55)',
					boxShadow: filled ? `0 0 ${24 * Math.exp(-fill * 1.5) + 8}px rgba(242,181,68,${0.35 + 0.5 * Math.exp(-fill * 1.5)})` : '0 2px 10px rgba(0,0,0,0.35)',
				}}
			>
				<Img
					src={staticFile(face.src)}
					style={{position: 'absolute', left: -x0 * k, top: -y0 * k, width: face.w * k, height: face.h * k, opacity: f, transform: `scale(${1.15 - 0.15 * f})`, transformOrigin: `${(x0 + (x1 - x0) / 2) * k}px ${(y0 + (x1 - x0) / 2) * k}px`}}
				/>
				{f < 1 && (
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
							fontSize: size * 0.55,
							color: C.cream,
							opacity: 0.8 * (1 - f),
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
			{showName && (
				<div
					style={{
						position: 'absolute',
						top: size + size * 0.12,
						left: '50%',
						transform: 'translateX(-50%)',
						fontFamily: SANS,
						fontWeight: 600,
						fontSize: Math.max(14, size * 0.17),
						letterSpacing: '0.16em',
						textTransform: 'uppercase',
						color: C.cream,
						opacity: 0.85 * f,
						whiteSpace: 'nowrap',
						textShadow: '0 1px 6px rgba(0,0,0,0.5)',
					}}
				>
					{face.name}
				</div>
			)}
		</div>
	);
};
