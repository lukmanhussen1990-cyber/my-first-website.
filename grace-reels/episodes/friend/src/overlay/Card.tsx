// Cream scripture cards: the exact KJV words centred in italic serif, keywords in deep-gold capitals that
// light up when the voice says them, the reference in small spaced capitals. They drift slowly while held.
import {clamp, easeOutBack, seg, smooth} from '../lib/ease';
import {B, word} from '../lib/timeline';
import {C, SAFE, SANS, SERIF} from './theme';

type CardDef = {from: number; to: number; text: string; ref: string; keyAt: number; top: number};

// **words** mark a keyword (one or more words).
export const CARDS: CardDef[] = [
	{
		from: B.pouchGlint + 0.35,
		to: B.s6 + 0.4,
		text: '“For he knew who should **betray** him; therefore said he, Ye are not all clean.”',
		ref: 'John 13:11',
		keyAt: B.betray,
		top: 1060,
	},
	{
		from: B.coinsLanded - 0.4,
		to: B.chainDrop - 0.05,
		text: '“If the ox shall push a manservant or a maidservant; he shall give unto their master **thirty shekels of silver**…”',
		ref: 'Exodus 21:32',
		keyAt: B.shekels,
		top: 500,
	},
	{
		from: B.cardMatthewIn - 0.2,
		to: B.s12 + 0.35,
		text: '“And Jesus said unto him, **Friend**, wherefore art thou come?…”',
		ref: 'Matthew 26:50',
		keyAt: word('12a', 'friend').start,
		top: 1060,
	},
	{
		from: B.cardRomansIn,
		to: B.cardRomansOut,
		text: '“For if, when we were **enemies**, we were reconciled to God by the death of his Son…”',
		ref: 'Romans 5:10',
		keyAt: B.enemies,
		top: 760,
	},
];

// Warm paper: a faint fibre grain over a cream wash.
const GRAIN = `url("data:image/svg+xml;utf8,${encodeURIComponent(
	"<svg xmlns='http://www.w3.org/2000/svg' width='320' height='320'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' seed='7' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.42  0 0 0 0 0.3  0 0 0 0 0.16  0 0 0 0.6 0'/></filter><rect width='320' height='320' filter='url(#n)' opacity='0.14'/></svg>",
)}")`;

const KeyWord: React.FC<{text: string; k: number; glow: number}> = ({text, k, glow}) => (
	<span style={{position: 'relative', display: 'inline-block', fontStyle: 'normal', fontWeight: 700, color: C.deepGold, letterSpacing: '0.02em', textShadow: `0 0 ${16 * glow}px rgba(242,181,68,${0.9 * glow})`}}>
		{text.toUpperCase()}
		<span style={{position: 'absolute', left: 0, bottom: 4, height: 4, borderRadius: 2, width: `${100 * k}%`, background: C.gold, opacity: 0.85}} />
	</span>
);

export const ScriptureCard: React.FC<{t: number; card: CardDef}> = ({t, card}) => {
	if (t < card.from || t > card.to) return null;
	const inP = seg(t, card.from, card.from + 0.55);
	const out = seg(t, card.to - 0.45, card.to);
	const life = (t - card.from) / (card.to - card.from);
	const lift = 46 * (1 - easeOutBack(inP, 1.4)) - 24 * out;
	// a slow push while it is held, and a gentle float
	const scale = (0.95 + 0.05 * easeOutBack(inP, 1.4)) * (1 + 0.025 * life);
	const float = Math.sin((t - card.from) * 1.1) * 3;
	const tilt = Math.sin((t - card.from) * 0.7) * 0.35;
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
				padding: '50px 56px 40px',
				borderRadius: 16,
				background: `${GRAIN}, radial-gradient(ellipse 90% 80% at 50% 38%, #F8F3E9 0%, ${C.cream} 55%, #E9DDC8 100%)`,
				boxShadow: '0 24px 60px rgba(10,6,2,0.42), 0 4px 14px rgba(10,6,2,0.22), inset 0 0 0 1px rgba(154,91,12,0.12)',
				opacity: smooth(inP / 0.5) * (1 - out),
				transform: `translateY(${lift + float}px) scale(${scale}) rotate(${tilt}deg)`,
				transformOrigin: '50% 60%',
				textAlign: 'center',
			}}
		>
			<div style={{fontFamily: SERIF, fontStyle: 'italic', fontWeight: 500, fontSize: 60, lineHeight: 1.16, color: C.ink}}>
				{parts.map((p, i) => {
					if (i % 2 === 0) return <span key={i}>{p}</span>;
					// a keyword phrase: each word is its own block so a long phrase can wrap; the underline runs
					// across the words one after another
					const ws = p.split(' ');
					const k = clamp((t - card.keyAt) / 0.35) * ws.length;
					return (
						<span key={i}>
							{ws.map((w, j) => (
								<span key={j}>
									<KeyWord text={w} k={clamp(k - j)} glow={glow} />
									{j < ws.length - 1 ? ' ' : ''}
								</span>
							))}
						</span>
					);
				})}
			</div>
			<div style={{marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18}}>
				<span style={{width: 46, height: 2, background: C.deepGold, opacity: 0.55}} />
				<span style={{fontFamily: SANS, fontWeight: 600, fontSize: 20, letterSpacing: '0.24em', textTransform: 'uppercase', color: '#7A6248', whiteSpace: 'nowrap'}}>{card.ref} · KJV</span>
				<span style={{width: 46, height: 2, background: C.deepGold, opacity: 0.55}} />
			</div>
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
