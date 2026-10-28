// "WHAT MOSES SAW" under the captions: FIRE and SEA fill during the montage; FACE stays a glowing "?"
// (brighter when Jesus says "me") until it fills with Jesus' face.
import {seg, smooth} from '../lib/ease';
import {B} from '../lib/timeline';
import {Badge} from './Badge';
import {C, SAFE, SANS} from './theme';

const SIZE = 84;
const Y = 650;

export const Tracker: React.FC<{t: number}> = ({t}) => {
	const appear = seg(t, B.badgesIn, B.badgesIn + 0.35);
	// it steps aside for the end card
	const out = smooth((t - (B.s15 - 0.3)) / 0.3);
	const vis = appear * (1 - out);
	if (vis <= 0.001) return null;
	const glow = Math.max(0, Math.min(1, (t - (B.faceGlow - 0.2)) / 0.4)) * (1 - smooth((t - B.faceFill) / 0.3)) + 0.25 * (0.5 + 0.5 * Math.sin(t * 3.1));
	return (
		<div style={{position: 'absolute', left: SAFE.left, top: Y - SIZE / 2, height: SIZE, display: 'flex', alignItems: 'flex-start', gap: 22, opacity: vis}}>
			<div
				style={{
					fontFamily: SANS,
					fontWeight: 700,
					fontSize: 22,
					lineHeight: 1.25,
					letterSpacing: '0.18em',
					color: C.gold,
					textShadow: '0 1px 8px rgba(0,0,0,0.6)',
					transform: `translateX(${-14 * (1 - smooth(appear))}px)`,
					whiteSpace: 'nowrap',
					marginTop: 18,
				}}
			>
				WHAT
				<br />
				MOSES SAW
			</div>
			<Badge kind="fire" name="FIRE" size={SIZE} fill={t - B.fire} appear={seg(t, B.badgesIn + 0.05, B.badgesIn + 0.4)} />
			<Badge kind="sea" name="SEA" size={SIZE} fill={t - B.sea} appear={seg(t, B.badgesIn + 0.15, B.badgesIn + 0.5)} />
			<Badge kind="face" name="FACE" size={SIZE} fill={t - B.faceFill} appear={seg(t, B.badgesIn + 0.25, B.badgesIn + 0.6)} glow={glow} />
		</div>
	);
};
