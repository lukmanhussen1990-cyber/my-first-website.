import React from 'react';
import {C, CAPTION_Y, KeywordTone, OUTLINE} from './palette';
import {FONT_CAPTION, FONT_SERIF} from './fonts';
import {cloudCircles} from './Fx';
import {clamp} from './anim';

const NS = {vectorEffect: 'non-scaling-stroke' as const};

/** Scene label: heavy serif caps, cream ring + dark outline (like the reference). */
export const Label: React.FC<{
  x: number;
  y: number;
  text: string;
  tone?: 'gold' | 'red' | 'cream';
  size?: number;
  scale?: number;
  opacity?: number;
  anchor?: 'middle' | 'start' | 'end';
  spacing?: number;
}> = ({x, y, text, tone = 'gold', size = 56, scale = 1, opacity = 1, anchor = 'middle', spacing = 1}) => {
  const fill = tone === 'cream' ? C.cream : C[tone];
  const common = {
    x: 0,
    y: 0,
    textAnchor: anchor,
    fontFamily: FONT_SERIF,
    fontWeight: 900,
    fontSize: size,
    letterSpacing: spacing,
    strokeLinejoin: 'round' as const,
  };
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`} opacity={opacity}>
      <text {...common} fill={C.ink} stroke={C.ink} strokeWidth={size * 0.2}>
        {text}
      </text>
      <text {...common} fill={fill} stroke={C.labelRing} strokeWidth={size * 0.085}>
        {text}
      </text>
      <text {...common} fill={fill}>
        {text}
      </text>
    </g>
  );
};

/** Small letter-spaced serif caps for verse references. */
export const VerseRef: React.FC<{
  x: number;
  y: number;
  text: string;
  color?: string;
  size?: number;
  opacity?: number;
  ring?: boolean;
  anchor?: 'middle' | 'start' | 'end';
}> = ({x, y, text, color = C.cream, size = 30, opacity = 1, ring = true, anchor = 'middle'}) => (
  <g opacity={opacity}>
    {ring ? (
      <text x={x} y={y} textAnchor={anchor} fontFamily={FONT_SERIF} fontWeight={700} fontSize={size} letterSpacing={size * 0.16}
        fill={C.ink} stroke={C.ink} strokeWidth={size * 0.22} strokeLinejoin="round" opacity={0.55}>
        {text}
      </text>
    ) : null}
    <text x={x} y={y} textAnchor={anchor} fontFamily={FONT_SERIF} fontWeight={700} fontSize={size} letterSpacing={size * 0.16} fill={color}>
      {text}
    </text>
  </g>
);

/** Small red number badge (1, 2, 3) for repeated lines. */
export const Badge: React.FC<{x: number; y: number; n: number | string; scale?: number}> = ({x, y, n, scale = 1}) => (
  <g transform={`translate(${x},${y}) scale(${scale})`}>
    <circle r={21} fill={C.red} stroke={C.labelRing} strokeWidth={4} {...NS} />
    <text x={0} y={9} textAnchor="middle" fontFamily={FONT_SERIF} fontWeight={900} fontSize={26} fill={C.labelRing}>
      {n}
    </text>
  </g>
);

/**
 * Speech bubble: cream box, thin outline, dotted inner border, tail, serif
 * caps. Origin = bubble centre. `tail` = tip position relative to centre.
 */
export const SpeechBubble: React.FC<{
  x: number;
  y: number;
  lines: string[];
  tone?: 'red' | 'gold' | 'green';
  size?: number;
  width?: number;
  tail?: {x: number; y: number};
  scale?: number;
  opacity?: number;
  badge?: number;
}> = ({x, y, lines, tone = 'red', size = 36, width, tail = {x: -30, y: 110}, scale = 1, opacity = 1, badge}) => {
  const longest = Math.max(...lines.map((l) => l.length));
  const w = width ?? Math.max(220, longest * size * 0.7 + 72);
  const lh = size * 1.12;
  const h = lines.length * lh + 46;
  const col = C[tone];
  const edge = mixHex(C.ink, col, 0.45);
  const baseY = tail.y > 0 ? h / 2 : -h / 2;
  const bx = clamp(tail.x * 0.5, -w / 2 + 40, w / 2 - 70);
  const tailPts = `${bx - 4},${baseY - Math.sign(tail.y) * 6} ${bx + 46},${baseY - Math.sign(tail.y) * 6} ${tail.x},${tail.y}`;
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`} opacity={opacity}>
      <polygon points={tailPts} fill={C.cream} stroke={edge} strokeWidth={3.5} strokeLinejoin="round" {...NS} />
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={22} fill={C.cream} stroke={edge} strokeWidth={3.5} {...NS} />
      <polygon points={tailPts} fill={C.cream} transform={`translate(0,${-Math.sign(tail.y) * 2.5}) scale(1,0.995)`} />
      <rect
        x={-w / 2 + 10}
        y={-h / 2 + 10}
        width={w - 20}
        height={h - 20}
        rx={14}
        fill="none"
        stroke={col}
        strokeOpacity={0.55}
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray="0.1 9"
        {...NS}
      />
      {lines.map((l, i) => (
        <text
          key={i}
          x={0}
          y={-((lines.length - 1) * lh) / 2 + i * lh + size * 0.36}
          textAnchor="middle"
          fontFamily={FONT_SERIF}
          fontWeight={700}
          fontSize={size}
          letterSpacing={size * 0.04}
          fill={col}
        >
          {l}
        </text>
      ))}
      {badge !== undefined ? <Badge x={-w / 2 + 4} y={-h / 2 + 4} n={badge} /> : null}
    </g>
  );
};

/** Cloud-shaped thought bubble with two trailing dots towards `tip`. */
export const ThoughtBubble: React.FC<{
  x: number;
  y: number;
  w?: number;
  tip: {x: number; y: number};
  fill?: string;
  scale?: number;
  opacity?: number;
  children?: React.ReactNode;
}> = ({x, y, w = 300, tip, fill = C.cloud, scale = 1, opacity = 1, children}) => {
  const cs = cloudCircles(w);
  const d1 = {x: tip.x * 0.42, y: tip.y * 0.42 + w * 0.12};
  const d2 = {x: tip.x * 0.78, y: tip.y * 0.78};
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`} opacity={opacity}>
      <circle cx={d2.x} cy={d2.y} r={11} fill={fill} stroke={C.ink} strokeWidth={OUTLINE * 0.8} {...NS} />
      <circle cx={d1.x} cy={d1.y} r={19} fill={fill} stroke={C.ink} strokeWidth={OUTLINE * 0.8} {...NS} />
      {cs.map(([cx, cy, r], i) => (
        <circle key={`s${i}`} cx={cx} cy={cy} r={r} fill={C.ink} stroke={C.ink} strokeWidth={OUTLINE * 1.7} {...NS} />
      ))}
      {cs.map(([cx, cy, r], i) => (
        <circle key={`f${i}`} cx={cx} cy={cy} r={r} fill={fill} />
      ))}
      <g transform={`translate(0,${w * 0.03})`}>{children}</g>
    </g>
  );
};

// --- Captions -------------------------------------------------------------

export interface CaptionWord {
  text: string;
  start: number; // seconds
  end: number;
  tone?: KeywordTone;
}

const TONE_RGB: Record<string, [number, number, number]> = {
  ink: [28, 27, 31],
  gold: [200, 149, 46],
  red: [180, 67, 47],
  blue: [61, 100, 148],
  green: [47, 122, 104],
};

/**
 * Word-synced caption page (HTML overlay). Upcoming words show as a pale
 * ghost; the spoken word turns solid with a 3-frame fade.
 */
export const Caption: React.FC<{
  words: CaptionWord[];
  frame: number;
  fps: number;
  opacity?: number;
  y?: number;
  size?: number;
  maxWidth?: number;
}> = ({words, frame, fps, opacity = 1, y = CAPTION_Y, size = 66, maxWidth = 840}) => (
  <div
    style={{
      position: 'absolute',
      left: 540 - maxWidth / 2,
      width: maxWidth,
      top: y,
      transform: 'translateY(-50%)',
      textAlign: 'center',
      fontFamily: FONT_CAPTION,
      fontWeight: 700,
      fontSize: size,
      lineHeight: 1.26,
      letterSpacing: -0.4,
      opacity,
    }}
  >
    {words.map((w, i) => {
      const t = clamp((frame - w.start * fps) / 3);
      const rgb = TONE_RGB[w.tone ?? 'ink'];
      const ghost = w.tone ? 0.3 : 0.22;
      const a = ghost + (1 - ghost) * t;
      return (
        <span key={i} style={{color: `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`}}>
          {w.text}
          {i < words.length - 1 ? ' ' : ''}
        </span>
      );
    })}
  </div>
);

// local hex mixer (kept here to avoid a cycle with Scenery)
const mixHex = (a: string, b: string, t: number) => {
  const p = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const A = p(a);
  const B = p(b);
  return `#${A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
};
