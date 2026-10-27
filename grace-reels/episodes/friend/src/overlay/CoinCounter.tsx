// S6: a big odometer in silver that rolls up with every coin counted into Judas's palm, landing on 30.
import {clamp, easeOut, seg, smooth} from '../lib/ease';
import {B} from '../lib/timeline';
import {SANS, SERIF} from './theme';

const DIGIT_H = 150;
const SILVER = 'linear-gradient(180deg, #ffffff 0%, #dfe3e8 35%, #9aa0a8 62%, #e6e9ed 100%)';

// The shown value: each coin rolls the ones wheel up one place in a quick tick.
const valueAt = (t: number) => {
	let n = 0;
	while (n < B.coins.length && t >= B.coins[n]) n++;
	if (n === 0) return 0;
	const last = B.coins[n - 1];
	const gap = n < B.coins.length ? B.coins[n] - last : 0.1;
	return n - 1 + easeOut(clamp((t - last) / Math.min(0.08, gap * 0.9)));
};

const Wheel: React.FC<{v: number}> = ({v}) => {
	// v: continuous digit position (0..10); the strip shows 0..9 and 0 again
	const pos = ((v % 10) + 10) % 10;
	const y = -pos * DIGIT_H;
	return (
		<div style={{position: 'relative', width: 104, height: DIGIT_H, overflow: 'hidden'}}>
			<div style={{position: 'absolute', left: 0, top: y, width: 104}}>
				{[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d, i) => (
					<div key={i} style={{height: DIGIT_H, lineHeight: `${DIGIT_H}px`, textAlign: 'center', fontFamily: SERIF, fontWeight: 700, fontSize: 168, background: SILVER, WebkitBackgroundClip: 'text', color: 'transparent', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.55))'}}>
						{d}
					</div>
				))}
			</div>
		</div>
	);
};

export const CoinCounter: React.FC<{t: number}> = ({t}) => {
	const inP = seg(t, B.coins[0] - 0.35, B.coins[0] - 0.05);
	const out = seg(t, B.s7 - 0.1, B.s7 + 0.3);
	if (inP <= 0 || out >= 1) return null;
	const v = valueAt(t);
	const ones = v % 10;
	// the tens wheel turns only while the ones wheel goes from 9 to 10
	const tens = Math.floor(v / 10) + clamp((v % 10) - 9);
	const done = t >= B.silver;
	const hit = done ? Math.exp(-(t - B.silver) * 5) : 0;
	return (
		<div style={{position: 'absolute', left: 540, top: 1265, transform: `translate(-50%, -50%) scale(${1 + 0.12 * hit})`, opacity: smooth(inP) * (1 - out), textAlign: 'center'}}>
			<div style={{display: 'flex', gap: 2, padding: '6px 22px', borderRadius: 20, background: 'rgba(16,12,10,0.55)', boxShadow: `0 10px 30px rgba(0,0,0,0.45), 0 0 ${40 * hit}px rgba(255,255,255,${0.5 * hit})`}}>
				<Wheel v={tens} />
				<Wheel v={ones} />
			</div>
			<div style={{marginTop: 8, fontFamily: SANS, fontWeight: 600, fontSize: 20, letterSpacing: '0.24em', color: '#d9dde2', textShadow: '0 1px 6px rgba(0,0,0,0.6)'}}>PIECES OF SILVER</div>
		</div>
	);
};
