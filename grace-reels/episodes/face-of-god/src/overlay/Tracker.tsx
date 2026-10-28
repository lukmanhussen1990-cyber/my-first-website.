// "12 DISCIPLES" tracker under the captions: twelve dots fill gold one by one with a soft tick;
// the twelfth is darker and shows a tiny silver coin.
import {clamp, easeOutBack, seg, smooth} from '../lib/ease';
import {B} from '../lib/timeline';
import {C, SAFE, SANS} from './theme';

const Y = 650;
const DOT = 30;
const GAP = 14;

const Coin: React.FC<{size: number}> = ({size}) => (
	<svg width={size} height={size} viewBox="0 0 20 20">
		<circle cx={10} cy={10} r={8.5} fill="#c9ccd1" stroke="#5f646b" strokeWidth={1.6} />
		<circle cx={10} cy={10} r={5.2} fill="none" stroke="#8d929a" strokeWidth={1.2} strokeDasharray="1.2 1.6" />
		<circle cx={8} cy={7.5} r={1.6} fill="#eef0f2" />
	</svg>
);

export const Tracker: React.FC<{t: number}> = ({t}) => {
	const appear = seg(t, B.trackerIn, B.trackerIn + 0.35);
	const out = smooth((t - (B.trackerOut - 0.35)) / 0.35);
	const vis = appear * (1 - out);
	if (vis <= 0.001) return null;
	return (
		<div style={{position: 'absolute', left: SAFE.left, top: Y - DOT / 2 - 34, opacity: vis}}>
			<div style={{fontFamily: SANS, fontWeight: 700, fontSize: 20, letterSpacing: '0.2em', color: C.gold, textShadow: '0 1px 8px rgba(0,0,0,0.55)', marginBottom: 10, whiteSpace: 'nowrap'}}>
				12 DISCIPLES
			</div>
			<div style={{display: 'flex', gap: GAP, alignItems: 'center'}}>
				{B.dots.map((at, i) => {
					const x = t - at;
					const filled = x >= 0;
					const judas = i === 11;
					const pop = filled ? 1 + 0.35 * Math.exp(-x * 9) * Math.sin(x * 22 + 0.2) : 1;
					const intro = easeOutBack(clamp((t - (B.trackerIn + i * 0.02)) / 0.3), 2);
					return (
						<div key={i} style={{position: 'relative', width: DOT, height: DOT, transform: `scale(${pop * intro})`}}>
							<div
								style={{
									position: 'absolute',
									inset: 0,
									borderRadius: '50%',
									border: filled ? 'none' : `2.5px solid rgba(242,181,68,0.7)`,
									background: filled ? (judas ? '#5a4632' : C.gold) : 'rgba(20,15,10,0.35)',
									boxShadow: filled && !judas ? `0 0 ${14 * Math.exp(-x * 2) + 4}px rgba(242,181,68,0.6)` : '0 1px 6px rgba(0,0,0,0.4)',
									boxSizing: 'border-box',
								}}
							/>
							{judas && filled && (
								<div style={{position: 'absolute', left: 5, top: 5, opacity: smooth(x / 0.15)}}>
									<Coin size={20} />
								</div>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
};
