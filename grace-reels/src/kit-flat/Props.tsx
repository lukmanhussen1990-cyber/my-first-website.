import React from 'react';
import {random} from 'remotion';
import {C, OUTLINE} from './palette';
import {FONT_CAPTION, FONT_SERIF} from './fonts';

const NS = {vectorEffect: 'non-scaling-stroke' as const};
const line = (w = OUTLINE) => ({
  stroke: C.ink,
  strokeWidth: w,
  strokeLinejoin: 'round' as const,
  strokeLinecap: 'round' as const,
  ...NS,
});

/** Round tree: a cluster of circles with little curved marks. Origin = trunk base. */
export const Tree: React.FC<{x: number; y: number; scale?: number; fill?: string; seed?: string; sway?: number}> = ({
  x,
  y,
  scale = 1,
  fill = C.treeFill,
  seed = 't',
  sway = 0,
}) => {
  const blobs: [number, number, number][] = [
    [-70, -250, 78],
    [62, -262, 84],
    [-8, -330, 92],
    [-90, -170, 62],
    [80, -170, 66],
  ];
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      <path d="M -20 0 L -14 -190 L 14 -190 L 20 0 Z" fill={C.trunk} {...line()} />
      <g transform={`rotate(${sway} 0 -150)`}>
        {blobs.map(([bx, by, r], i) => (
          <circle key={`o${i}`} cx={bx} cy={by} r={r} fill={fill} {...line()} />
        ))}
        {blobs.map(([bx, by, r], i) => {
          const a = random(`${seed}${i}`) * 0.6 - 0.3;
          return (
            <g key={`m${i}`} transform={`translate(${bx + r * 0.1},${by - r * 0.15}) rotate(${a * 60})`}>
              <path d="M -16 4 Q 0 -8 16 4" fill="none" stroke={C.treeLine} strokeWidth={3} strokeLinecap="round" {...NS} />
              <path d="M -10 16 Q 0 8 10 16" fill="none" stroke={C.treeLine} strokeWidth={3} strokeLinecap="round" {...NS} />
            </g>
          );
        })}
      </g>
    </g>
  );
};

/** Flat wooden fishing boat. Origin = centre of the gunwale. Draw figures first, then the boat. */
export const Boat: React.FC<{x: number; y: number; rotate?: number; scale?: number; net?: boolean; mast?: boolean}> = ({
  x,
  y,
  rotate = 0,
  scale = 1,
  net = true,
  mast = true,
}) => (
  <g transform={`translate(${x},${y}) rotate(${rotate}) scale(${scale})`}>
    <path
      d="M -300 -6 L 300 -6 Q 270 70 200 104 L -200 104 Q -270 70 -300 -6 Z"
      fill={C.wood}
      {...line()}
    />
    <path d="M -282 30 Q 0 40 282 30" fill="none" stroke={C.woodLine} strokeWidth={3} {...NS} />
    <path d="M -255 66 Q 0 74 255 66" fill="none" stroke={C.woodLine} strokeWidth={3} {...NS} />
    <rect x={-310} y={-16} width={620} height={16} rx={6} fill={C.woodDark} {...line(OUTLINE * 0.8)} />
    {net ? (
      <g>
        <path d="M -260 -4 Q -300 60 -330 160 L -250 170 Q -232 80 -230 -4 Z" fill="none" stroke={C.net} strokeWidth={2.5} {...NS} />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <line key={`h${i}`} x1={-262 - i * 12} y1={14 + i * 26} x2={-232 - i * 3} y2={14 + i * 26} stroke={C.net} strokeWidth={2} {...NS} />
        ))}
        {[0, 1, 2].map((i) => (
          <line key={`v${i}`} x1={-252 + i * 8} y1={0} x2={-312 + i * 24} y2={165} stroke={C.net} strokeWidth={2} {...NS} />
        ))}
      </g>
    ) : null}
    {mast ? null : null}
  </g>
);

export const Mast: React.FC<{x: number; y: number; rotate?: number; h?: number}> = ({x, y, rotate = 0, h = 420}) => (
  <g transform={`translate(${x},${y}) rotate(${rotate})`}>
    <line x1={0} y1={0} x2={0} y2={-h} {...line(OUTLINE * 0.9)} />
    <line x1={0} y1={-h} x2={-150} y2={-20} stroke={C.ink} strokeWidth={2.5} {...NS} />
    <line x1={0} y1={-h} x2={150} y2={-20} stroke={C.ink} strokeWidth={2.5} {...NS} />
  </g>
);

export const Pillow: React.FC<{x: number; y: number; rotate?: number}> = ({x, y, rotate = 0}) => (
  <g transform={`translate(${x},${y}) rotate(${rotate})`}>
    <path d="M -58 -22 Q 0 -34 58 -22 Q 70 0 58 22 Q 0 34 -58 22 Q -70 0 -58 -22 Z" fill="#EDE3CF" {...line(OUTLINE * 0.8)} />
    <path d="M -30 -6 Q 0 2 30 -6" fill="none" stroke={C.paperLine} strokeWidth={2.5} {...NS} />
  </g>
);

/** Flat stone with an optional serif word on it. Origin = bottom centre. */
export const Stone: React.FC<{x: number; y: number; text?: string; color?: string; scale?: number}> = ({
  x,
  y,
  text,
  color = C.red,
  scale = 1,
}) => (
  <g transform={`translate(${x},${y}) scale(${scale})`}>
    <path
      d="M -120 0 Q -132 -54 -86 -84 Q -20 -112 60 -100 Q 128 -86 124 -30 Q 122 0 100 0 Z"
      fill={C.stoneLight}
      {...line()}
    />
    <path d="M -84 -64 Q -40 -88 6 -86" fill="none" stroke="#FFFFFF" strokeWidth={4} opacity={0.35} strokeLinecap="round" {...NS} />
    {text ? (
      <text
        x={0}
        y={-30}
        textAnchor="middle"
        fontFamily={FONT_SERIF}
        fontWeight={900}
        fontSize={44}
        letterSpacing={2}
        fill={color}
      >
        {text}
      </text>
    ) : null}
  </g>
);

/** Wooden signpost. Origin = foot of the post. */
export const Signpost: React.FC<{x: number; y: number; text: string; color?: string; scale?: number; children?: React.ReactNode}> = ({
  x,
  y,
  text,
  color = C.red,
  scale = 1,
  children,
}) => (
  <g transform={`translate(${x},${y}) scale(${scale})`}>
    <rect x={-13} y={-330} width={26} height={330} fill={C.woodDark} {...line()} />
    <path d="M -210 -440 L 180 -452 L 240 -398 L 186 -340 L -206 -330 Z" fill={C.plank} {...line()} />
    <path d="M -192 -422 L 172 -432 L 214 -397 L 176 -358 L -190 -350 Z" fill="none" stroke={C.plankLine} strokeWidth={2.5} {...NS} />
    <text
      x={-10}
      y={-372}
      textAnchor="middle"
      fontFamily={FONT_SERIF}
      fontWeight={900}
      fontSize={52}
      letterSpacing={2}
      fill={color}
      transform="rotate(-1.5 0 -390)"
    >
      {text}
    </text>
    {children}
  </g>
);

/** Small house. `glow` 0..1 = window light, `door` 0 = open (warm doorway) … 1 = closed. */
export const House: React.FC<{x: number; y: number; scale?: number; glow?: number; door?: number}> = ({x, y, scale = 1, glow = 1, door = 1}) => (
  <g transform={`translate(${x},${y}) scale(${scale})`}>
    <rect x={-110} y={-170} width={220} height={170} fill={C.house} {...line()} />
    <path d="M -140 -164 L 0 -270 L 140 -164 Z" fill={C.roof} {...line()} />
    <rect x={20} y={-120} width={58} height={62} rx={6} fill={glow > 0.05 ? C.window : '#6E6A72'} {...line(OUTLINE * 0.8)} />
    <rect x={20} y={-120} width={58} height={62} rx={6} fill="#6E6A72" opacity={1 - glow} />
    <rect x={-80} y={-100} width={60} height={100} fill="#F6C977" {...line(OUTLINE * 0.8)} opacity={glow} />
    <rect x={-80} y={-100} width={60 * Math.max(0.12, door)} height={100} fill={C.woodDark} {...line(OUTLINE * 0.8)} />
  </g>
);

/** Small hill (dark silhouette, like the reference's last scene). Origin = foot at right. */
export const Hill: React.FC<{x: number; y: number; w?: number; h?: number; fill?: string}> = ({
  x,
  y,
  w = 520,
  h = 300,
  fill = '#47486A',
}) => (
  <path
    d={`M ${x - w} ${y + 4} L ${x - w} ${y - h} Q ${x - w * 0.4} ${y - h - 16} ${x - w * 0.18} ${y - h * 0.62} Q ${x - 40} ${y - h * 0.25} ${x} ${y + 4} Z`}
    fill={fill}
    {...line()}
  />
);

/** Flat layered campfire on a coal pile. Origin = centre of the coal pile base. */
export const Fire: React.FC<{x: number; y: number; frame: number; scale?: number}> = ({x, y, frame, scale = 1}) => {
  const flame = (fx: number, h: number, w: number, fill: string, i: number) => {
    const s = 1 + Math.sin(frame / 3.1 + i * 1.7) * 0.07 + Math.sin(frame / 5.3 + i) * 0.05;
    return (
      <path
        key={`${fill}${i}`}
        transform={`translate(${fx},0) scale(1,${s})`}
        d={`M ${-w} -20 C ${-w} ${-h * 0.45}, ${-w * 0.2} ${-h * 0.62}, 0 ${-h} C ${w * 0.2} ${-h * 0.62}, ${w} ${-h * 0.45}, ${w} -20 Q 0 6 ${-w} -20 Z`}
        fill={fill}
        {...line(OUTLINE * 0.75)}
      />
    );
  };
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      {flame(-44, 150, 34, C.flameOuter, 0)}
      {flame(46, 165, 36, C.flameOuter, 1)}
      {flame(0, 230, 44, C.flameOuter, 2)}
      {flame(-24, 140, 26, C.flameMid, 3)}
      {flame(24, 150, 26, C.flameMid, 4)}
      {flame(0, 120, 22, C.flameInner, 5)}
      <ellipse cx={-118} cy={-10} rx={36} ry={18} fill={C.stone} {...line(OUTLINE * 0.75)} />
      <ellipse cx={118} cy={-10} rx={36} ry={18} fill={C.stone} {...line(OUTLINE * 0.75)} />
      <path d="M -110 0 Q -96 -62 0 -66 Q 96 -62 110 0 Z" fill={C.coal} {...line(OUTLINE * 0.75)} />
      {[
        [-60, -18],
        [-28, -38],
        [8, -22],
        [40, -42],
        [66, -16],
        [-4, -52],
        [-76, -34],
      ].map(([ex, ey], i) => (
        <circle
          key={i}
          cx={ex}
          cy={ey}
          r={8}
          fill={i % 2 ? C.emberGold : C.ember}
          opacity={0.75 + 0.25 * Math.sin(frame / 6 + i * 2)}
        />
      ))}
    </g>
  );
};

/** Flat flame icon (used inside a thought bubble — never a scary fire). */
export const FlameIcon: React.FC<{x: number; y: number; scale?: number; frame: number}> = ({x, y, scale = 1, frame}) => {
  const s = 1 + Math.sin(frame / 3.4) * 0.05;
  return (
    <g transform={`translate(${x},${y}) scale(${scale}) scale(1,${s})`}>
      <path
        d="M 0 -78 C 22 -50 52 -34 50 4 C 48 38 22 52 0 52 C -22 52 -48 38 -50 4 C -52 -26 -30 -34 -22 -60 C -12 -44 -6 -42 0 -78 Z"
        fill={C.flameOuter}
        {...line(OUTLINE * 0.8)}
      />
      <path
        d="M 0 -26 C 14 -8 28 4 26 22 C 24 40 12 46 0 46 C -12 46 -24 40 -26 22 C -27 6 -14 -6 0 -26 Z"
        fill={C.flameInner}
        stroke={C.ink}
        strokeWidth={3}
        {...NS}
      />
    </g>
  );
};

/** Insurance document with a red stamp. Origin = centre. */
export const InsuranceDoc: React.FC<{
  x: number;
  y: number;
  rotate?: number;
  scale?: number;
  stamp?: number; // 0..1 stamp-in progress (scale from 1.6 → 1)
  stampText?: string;
}> = ({x, y, rotate = -4, scale = 1, stamp = 0, stampText = 'PRAYED'}) => {
  const st = stamp <= 0 ? 0 : stamp;
  const stampScale = 1.7 - 0.7 * Math.min(1, st);
  return (
    <g transform={`translate(${x},${y}) rotate(${rotate}) scale(${scale})`}>
      <rect x={-200} y={-250} width={400} height={500} rx={14} fill={C.paper} {...line()} />
      <path d="M 130 -250 L 200 -180" stroke={C.paperLine} strokeWidth={3} {...NS} />
      <text x={0} y={-160} textAnchor="middle" fontFamily={FONT_SERIF} fontWeight={900} fontSize={50} letterSpacing={1}
        fill={C.red} stroke={C.ink} strokeWidth={3} paintOrder="stroke" style={{paintOrder: 'stroke'}}>
        FIRE
      </text>
      <text x={0} y={-104} textAnchor="middle" fontFamily={FONT_SERIF} fontWeight={900} fontSize={50} letterSpacing={1}
        fill={C.red} stroke={C.ink} strokeWidth={3} style={{paintOrder: 'stroke'}}>
        INSURANCE
      </text>
      <line x1={-150} y1={-78} x2={150} y2={-78} stroke={C.red} strokeWidth={3} {...NS} />
      {[-44, -10, 24].map((ly, i) => (
        <line key={i} x1={-150} y1={ly} x2={i === 2 ? 60 : 150} y2={ly} stroke={C.paperLine} strokeWidth={8} strokeLinecap="round" />
      ))}
      <text x={-150} y={84} fontFamily={FONT_CAPTION} fontWeight={800} fontSize={25} letterSpacing={1} fill={C.captionInk}>
        POLICY HOLDER:
      </text>
      <text x={-150} y={126} fontFamily={FONT_CAPTION} fontWeight={800} fontSize={38} fill={C.green}>
        YOU
      </text>
      <line x1={-150} y1={146} x2={30} y2={146} stroke={C.paperLine} strokeWidth={3} {...NS} />
      {st > 0 ? (
        <g transform={`translate(38,196) rotate(-9) scale(${stampScale * 0.82})`} opacity={Math.min(1, st * 2.5)}>
          <rect x={-128} y={-46} width={256} height={92} rx={10} fill="none" stroke={C.red} strokeWidth={7} />
          <rect x={-116} y={-34} width={232} height={68} rx={6} fill="none" stroke={C.red} strokeWidth={2.5} />
          <text x={-22} y={16} textAnchor="middle" fontFamily={FONT_SERIF} fontWeight={900} fontSize={42} letterSpacing={2} fill={C.red}>
            {stampText}
          </text>
          <path d="M 70 -2 L 82 12 L 104 -16" fill="none" stroke={C.red} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      ) : null}
    </g>
  );
};
