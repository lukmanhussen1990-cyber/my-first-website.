// "2 MEN" tracker under the captions: two empty badges that fill with each man's face when he is taken.
import {seg, smooth} from '../lib/ease';
import {B} from '../lib/timeline';
import {Badge, FACES} from './Badge';
import {C, SAFE, SANS} from './theme';

const SIZE = 84;
const Y = 650;

export const Tracker: React.FC<{t: number; hide?: number}> = ({t, hide = 0}) => {
	const appear = seg(t, B.trackerIn, B.trackerIn + 0.35);
	const vis = appear * (1 - hide);
	if (vis <= 0.001) return null;
	return (
		<div style={{position: 'absolute', left: SAFE.left, top: Y - SIZE / 2, height: SIZE, display: 'flex', alignItems: 'center', gap: 20, opacity: vis}}>
			<div
				style={{
					fontFamily: SANS,
					fontWeight: 700,
					fontSize: 24,
					letterSpacing: '0.18em',
					color: C.gold,
					textShadow: '0 1px 8px rgba(0,0,0,0.55)',
					transform: `translateX(${-14 * (1 - smooth(appear))}px)`,
					whiteSpace: 'nowrap',
				}}
			>
				2 MEN
			</div>
			<Badge face={FACES.enoch} size={SIZE} fill={t - B.badge1} appear={seg(t, B.trackerIn + 0.05, B.trackerIn + 0.4)} />
			<Badge face={FACES.elijah} size={SIZE} fill={t - B.badge2} appear={seg(t, B.trackerIn + 0.15, B.trackerIn + 0.5)} />
		</div>
	);
};
