// Our mark: a slim gold cross moving forward, with three motion lines behind it.
// `draw` (0..1) animates the strokes drawing themselves (cross first, then the motion lines).
import {clamp} from '../lib/ease';
import {C} from './theme';

const STROKES = [
	{d: 'M60 8 V92', at: 0, len: 0.42},
	{d: 'M42 34 H78', at: 0.3, len: 0.25},
	{d: 'M12 44 H33', at: 0.55, len: 0.18},
	{d: 'M18 56 H36', at: 0.66, len: 0.18},
	{d: 'M24 68 H39', at: 0.77, len: 0.18},
];

export const Logo: React.FC<{size: number; draw?: number; color?: string; glow?: number; style?: React.CSSProperties}> = ({
	size,
	draw = 1,
	color = C.gold,
	glow = 0,
	style,
}) => (
	<svg width={size} height={size} viewBox="0 0 100 100" style={{overflow: 'visible', ...style}}>
		{glow > 0 && (
			<defs>
				<filter id="logoGlow" x="-50%" y="-50%" width="200%" height="200%">
					<feGaussianBlur stdDeviation={3 + 4 * glow} />
				</filter>
			</defs>
		)}
		{(glow > 0 ? [true, false] : [false]).map((blur) => (
			<g key={String(blur)} filter={blur ? 'url(#logoGlow)' : undefined} opacity={blur ? 0.8 * glow : 1}>
				{STROKES.map((s, i) => {
					const p = clamp((draw - s.at) / s.len);
					return (
						<path
							key={i}
							d={s.d}
							pathLength={1}
							stroke={color}
							strokeWidth={i < 2 ? 7 : 5.5}
							strokeLinecap="round"
							fill="none"
							strokeDasharray="1 1"
							strokeDashoffset={1 - p}
							opacity={p > 0 ? 1 : 0}
						/>
					);
				})}
			</g>
		))}
	</svg>
);
