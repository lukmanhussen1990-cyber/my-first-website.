// The gold frame around the myth painting (the painting itself is a live 3D inset) and the red X stamp.
import {clamp, easeIn, seg} from '../lib/ease';
import {B} from '../lib/timeline';
import {mythRect} from '../shots/S5Myth';
import {C} from './theme';

const FRAME = 26;

// Two tapered brush strokes; points run along each stroke with a varying half-width.
const brush = (x0: number, y0: number, x1: number, y1: number, w: number, wobble: number) => {
	const n = 18;
	const dx = x1 - x0;
	const dy = y1 - y0;
	const len = Math.hypot(dx, dy);
	const nx = -dy / len;
	const ny = dx / len;
	const left: string[] = [];
	const right: string[] = [];
	for (let i = 0; i <= n; i++) {
		const f = i / n;
		const half = w * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, f * 1.15))) * (1 + 0.12 * Math.sin(f * 17 + wobble));
		const x = x0 + dx * f + nx * 6 * Math.sin(f * 5 + wobble);
		const y = y0 + dy * f + ny * 6 * Math.sin(f * 5 + wobble);
		left.push(`${(x + nx * half).toFixed(1)},${(y + ny * half).toFixed(1)}`);
		right.unshift(`${(x - nx * half * 0.85).toFixed(1)},${(y - ny * half * 0.85).toFixed(1)}`);
	}
	return `M${left.join(' L')} L${right.join(' L')} Z`;
};

const STROKE_A = brush(-215, -230, 222, 236, 46, 1.3);
const STROKE_B = brush(228, -222, -210, 240, 43, 4.1);
const SPLATS: [number, number, number][] = [
	[-250, -268, 11], [262, 270, 9], [281, -251, 7], [-236, 282, 12], [40, -300, 6], [-300, 30, 7], [305, -20, 8], [10, 312, 5],
];

export const MythFrame: React.FC<{t: number}> = ({t}) => {
	const r = mythRect(t);
	if (!r) return null;
	const stampP = seg(t, B.redX, B.redX + 0.09, easeIn);
	const settle = t > B.redX + 0.09 ? 1 + 0.05 * Math.exp(-(t - B.redX - 0.09) * 14) * Math.cos((t - B.redX) * 40) : 1;
	const stampScale = (1.9 - 0.9 * stampP) * settle;
	const ink = t >= B.redX ? clamp((t - B.redX) / 0.06) : 0;
	const splat = t > B.redX + 0.08 ? clamp((t - B.redX - 0.08) / 0.1) : 0;
	return (
		<div
			style={{
				position: 'absolute',
				left: r.cx - r.w / 2 - FRAME,
				top: r.cy - r.h / 2 - FRAME,
				width: r.w,
				height: r.h,
				border: `${FRAME}px solid transparent`,
				borderImage: 'linear-gradient(135deg, #e7c47c 0%, #8a5d28 22%, #d8b06a 45%, #6e4719 68%, #e1bd72 85%, #7c5422 100%) 1',
				boxShadow: '0 22px 50px rgba(0,0,0,0.5), 0 0 0 3px #3b2610, inset 0 0 0 3px #3b2610, inset 0 0 0 7px rgba(232,200,130,0.65)',
				transform: `rotate(${r.rot}deg)`,
				opacity: r.opacity,
			}}
		>
			{ink > 0 && (
				<svg
					width={640}
					height={640}
					viewBox="-320 -320 640 640"
					style={{position: 'absolute', left: r.w / 2 - 320, top: r.h / 2 - 320, overflow: 'visible', transform: `rotate(-4deg) scale(${stampScale})`, opacity: ink}}
				>
					<defs>
						<filter id="roughX" x="-20%" y="-20%" width="140%" height="140%">
							<feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves={3} seed={7} result="n" />
							<feDisplacementMap in="SourceGraphic" in2="n" scale={16} xChannelSelector="R" yChannelSelector="G" />
						</filter>
					</defs>
					<g filter="url(#roughX)" style={{filter: 'drop-shadow(0 6px 10px rgba(60,0,0,0.35))'}}>
						<path d={STROKE_A} fill={C.red} />
						<path d={STROKE_B} fill={C.red} />
						{SPLATS.map(([x, y, rr], i) => (
							<circle key={i} cx={x * (0.85 + 0.15 * splat)} cy={y * (0.85 + 0.15 * splat)} r={rr * splat} fill={C.red} />
						))}
					</g>
				</svg>
			)}
		</div>
	);
};
