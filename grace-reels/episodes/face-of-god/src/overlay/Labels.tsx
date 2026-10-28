// Verse tags with a thin leader line that sticks to a point in the 3D scene (projected every frame).
import {clamp, easeOut, seg, smooth} from '../lib/ease';
import {B} from '../lib/timeline';
import {projectToScreen} from '../render/camera';
import {activeShots} from '../render/Director';
import type {ShotDef, Transition, Vec3} from '../render/types';
import {C, SAFE, SANS} from './theme';

type LabelDef = {text: string; from: number; to: number; anchor: string; dx: number; dy: number};

export const LABELS: LabelDef[] = [
	{text: 'A clift of the rock · Exodus 33:22', from: B.labelClift, to: B.gloryRush - 0.1, anchor: 'cleft', dx: -380, dy: -250},
	{text: 'Exodus 33:23', from: B.labelBack, to: B.dawn - 0.1, anchor: 'peek', dx: -40, dy: -230},
	{text: 'He didn’t know', from: B.labelKnow, to: B.s9 - 0.05, anchor: 'shiningFace', dx: -300, dy: 230},
	{text: 'Exodus 34:33', from: B.labelVeil, to: B.keyChange - 0.1, anchor: 'veil', dx: -260, dy: -200},
]

const TAG_H = 46;
const estWidth = (s: string) => s.length * 18.5 + 34;

// Where an anchor is on screen right now (handles transitions by following the dominant shot).
const anchorAt = (shots: ShotDef[], transitions: Transition[], t: number, key: string): {x: number; y: number} | null => {
	const a = activeShots(shots, transitions, t);
	const order = a.b && a.wB > 0.5 ? [a.b, a.a] : [a.a, a.b];
	for (const s of order) {
		const p: Vec3 | undefined = s?.anchors?.(t)?.[key];
		if (s && p) return projectToScreen(s.camera(t), t, p);
	}
	return null;
};

export const Labels: React.FC<{t: number; shots: ShotDef[]; transitions: Transition[]}> = ({t, shots, transitions}) => (
	<>
		{LABELS.map((l) => {
			if (t < l.from || t > l.to + 0.3) return null;
			const pt = anchorAt(shots, transitions, t, l.anchor);
			if (!pt) return null;
			const inP = seg(t, l.from, l.from + 0.35, easeOut);
			const out = smooth((t - l.to) / 0.3);
			const w = estWidth(l.text);
			const x = clamp(pt.x + l.dx, SAFE.left, SAFE.right - w);
			const y = clamp(pt.y + l.dy, 720, SAFE.bottom - TAG_H - 40);
			// leader from the tag's nearest bottom/top edge point to the anchor dot
			const ex = clamp(pt.x, x + 16, x + w - 16);
			const ey = pt.y > y ? y + TAG_H : y;
			const lx = ex + (pt.x - ex) * inP;
			const ly = ey + (pt.y - ey) * inP;
			const opacity = smooth(inP / 0.6) * (1 - out);
			return (
				<div key={l.text} style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, opacity}}>
					<svg width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
						<line x1={ex} y1={ey} x2={lx} y2={ly} stroke="white" strokeWidth={2} strokeLinecap="round" opacity={0.9} style={{filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))'}} />
						<circle cx={pt.x} cy={pt.y} r={5 * smooth((inP - 0.6) / 0.4)} fill="white" opacity={0.95} />
						<circle cx={pt.x} cy={pt.y} r={10 * smooth((inP - 0.6) / 0.4)} fill="none" stroke="white" strokeWidth={1.5} opacity={0.5} />
					</svg>
					<div
						style={{
							position: 'absolute',
							left: x,
							top: y,
							height: TAG_H,
							padding: '0 17px',
							display: 'flex',
							alignItems: 'center',
							borderRadius: 6,
							background: C.tag,
							boxShadow: '0 6px 18px rgba(0,0,0,0.3)',
							fontFamily: SANS,
							fontWeight: 600,
							fontSize: 24,
							letterSpacing: '0.12em',
							textTransform: 'uppercase',
							color: '#FFFFFF',
							whiteSpace: 'nowrap',
							transform: `translateY(${10 * (1 - inP)}px) scale(${0.92 + 0.08 * inP})`,
							transformOrigin: '50% 100%',
						}}
					>
						{l.text}
					</div>
				</div>
			);
		})}
	</>
);
