// Cream scripture card: the exact KJV words, keywords in deep gold capitals that light up when spoken.
import {clamp, easeOutBack, seg, smooth} from '../lib/ease';
import {B} from '../lib/timeline';
import {C, SAFE, SANS, SERIF} from './theme';

type CardDef = {from: number; to: number; text: string; ref: string; keyAt: number; top: number};

// **word** marks a keyword.
export const CARDS: CardDef[] = [
	{
		from: B.cardHebrewsIn - 0.15,
		to: B.cardHebrewsOut + 0.8,
		text: '“By faith Enoch was **translated** that he should not see death…”',
		ref: 'Hebrews 11:5 · KJV',
		keyAt: B.badge1,
		top: 770,
	},
	{
		from: B.cardJohnIn,
		to: B.cardJohnOut,
		text: '“And whosoever liveth and believeth in me shall **never die**. Believest thou this?”',
		ref: 'John 11:26 · KJV',
		keyAt: B.neverDie,
		top: 880,
	},
];

export const ScriptureCard: React.FC<{t: number; card: CardDef}> = ({t, card}) => {
	if (t < card.from || t > card.to) return null;
	const inP = seg(t, card.from, card.from + 0.55);
	const out = seg(t, card.to - 0.45, card.to);
	const lift = 46 * (1 - easeOutBack(inP, 1.4)) - 24 * out;
	const scale = 0.95 + 0.05 * easeOutBack(inP, 1.4);
	const float = Math.sin((t - card.from) * 1.3) * 3;
	const k = clamp((t - card.keyAt) / 0.35);
	const glow = t > card.keyAt ? Math.exp(-(t - card.keyAt) * 1.6) : 0;
	const parts = card.text.split(/\*\*(.+?)\*\*/);
	return (
		<div
			style={{
				position: 'absolute',
				left: SAFE.left,
				top: card.top,
				width: SAFE.right - SAFE.left,
				boxSizing: 'border-box',
				padding: '46px 50px 38px 64px',
				borderRadius: 18,
				background: C.cream,
				boxShadow: '0 24px 60px rgba(10,6,2,0.38), 0 4px 14px rgba(10,6,2,0.2)',
				opacity: smooth(inP / 0.5) * (1 - out),
				transform: `translateY(${lift + float}px) scale(${scale})`,
				transformOrigin: '50% 60%',
			}}
		>
			<div style={{position: 'absolute', left: 26, top: 44, bottom: 44, width: 6, borderRadius: 3, background: C.deepGold}} />
			<div style={{fontFamily: SERIF, fontStyle: 'italic', fontWeight: 500, fontSize: 60, lineHeight: 1.16, color: C.ink}}>
				{parts.map((p, i) =>
					i % 2 === 1 ? (
						<span key={i} style={{position: 'relative', display: 'inline-block', fontStyle: 'normal', fontWeight: 700, color: C.deepGold, letterSpacing: '0.02em', textShadow: `0 0 ${16 * glow}px rgba(242,181,68,${0.9 * glow})`}}>
							{p.toUpperCase()}
							<span style={{position: 'absolute', left: 0, bottom: 4, height: 4, borderRadius: 2, width: `${100 * k}%`, background: C.gold, opacity: 0.85}} />
						</span>
					) : (
						<span key={i}>{p}</span>
					),
				)}
			</div>
			<div style={{marginTop: 22, fontFamily: SANS, fontWeight: 600, fontSize: 20, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#7A6248'}}>{card.ref}</div>
		</div>
	);
};

export const Cards: React.FC<{t: number}> = ({t}) => (
	<>
		{CARDS.map((c) => (
			<ScriptureCard key={c.ref} t={t} card={c} />
		))}
	</>
);
