// Cream scripture cards: the exact KJV words centred in italic serif, keywords in deep-gold capitals that
// light up when the voice says them, the reference in small spaced capitals. They drift slowly while held.
import {clamp, easeOutBack, seg, smooth} from '../lib/ease';
import {B, word} from '../lib/timeline';
import {C, SAFE, SANS, SERIF} from './theme';

// keyAt: when each keyword phrase is said (one time per **phrase**, in order)
type CardDef = {from: number; to: number; text: string; ref: string; keyAt: number[]; top: number};

// **words** mark a keyword (one or more words).
export const CARDS: CardDef[] = [
	{
		from: B.cardGloryIn,
		to: B.cardGloryOut,
		text: '“And he said, I beseech thee, shew me thy **glory**.”',
		ref: 'Exodus 33:18',
		keyAt: [B.glory],
		top: 1120,
	},
	{
		from: B.cardLiveIn,
		to: B.cardLiveOut,
		text: '“…Thou canst not see my face: for there shall no man see me, and **live**.”',
		ref: 'Exodus 33:20',
		keyAt: [B.live],
		top: 760,
	},
	{
		from: B.cardShoneIn,
		to: B.cardShoneOut,
		text: '“…Moses wist not that the skin of his face **shone**… and they were **afraid** to come nigh him.”',
		ref: 'Exodus 34:29–30',
		keyAt: [word('09b', 'shone').start, B.gasp2],
		top: 760,
	},
	{
		from: B.cardJohnIn,
		to: B.cardJohnOut,
		text: '“…hast thou not known me, Philip? he that hath seen **me** hath seen the **Father**…”',
		ref: 'John 14:9',
		keyAt: [B.me, B.father],
		top: 1000,
	},
	{
		from: B.cardFaceIn,
		to: B.cardFaceOut,
		text: '“…to give the light of the knowledge of the glory of God in the **face of Jesus Christ**.”',
		ref: '2 Corinthians 4:6',
		keyAt: [word('14', 'face').start],
		top: 1070,
	},
]

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
					// across the words one after another when the voice says it
					const at = card.keyAt[(i - 1) / 2] ?? card.keyAt[0];
					const glow = t > at ? Math.exp(-(t - at) * 1.6) : 0;
					const ws = p.split(' ');
					const k = clamp((t - at) / 0.35) * ws.length;
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
