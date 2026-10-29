import React, {useId} from 'react';
import {C, OUTLINE} from './palette';
import {jitter, sid} from './anim';

// Peg figures. Local origin = between the feet, on the ground line.
// Everything is drawn front-on, faceless or with a dark beard face.

export type Pose =
  | 'stand'
  | 'walk'
  | 'kneel'
  | 'pray' // kneeling, hands together
  | 'sit'
  | 'lie'
  | 'armsUp'
  | 'armsOpen'
  | 'armsOut' // arms raised outwards (calming the storm)
  | 'shake'
  | 'hold'
  | 'point'
  | 'pointLeft'
  | 'jump'
  | 'reach';

type Pt = [number, number];

const NS = {vectorEffect: 'non-scaling-stroke' as const};

interface BodyStyle {
  fill: string;
  line: string;
  head: string;
  belt: string;
  cross?: boolean;
}

interface BodyProps {
  pose: Pose;
  frame: number;
  walkPhase?: number; // radians
  tremble?: number; // 0..1
  seed?: string;
  wrap?: boolean;
  beard?: boolean;
  wrapColor?: string;
  armSwing?: number; // extra 0..1 animation for shake/point
  lineW?: number;
  faceColor?: string;
  style: BodyStyle;
}

const SHOULDER_Y = -306;
const HEM_Y = -54;
const HEAD_R = 46;

const robePath = (top: number, hem: number, topW: number, hemW: number, r = 26) =>
  `M ${-topW} ${top + r} Q ${-topW} ${top} ${-topW + r} ${top} L ${topW - r} ${top} Q ${topW} ${top} ${topW} ${top + r}` +
  ` L ${hemW} ${hem - 6} Q ${hemW} ${hem} ${hemW - 6} ${hem} L ${-hemW + 6} ${hem} Q ${-hemW} ${hem} ${-hemW} ${hem - 6} Z`;

const armsFor = (pose: Pose, frame: number, swing: number): [Pt[], Pt[]] => {
  const sh = SHOULDER_Y + 24;
  const L: Pt = [-50, sh];
  const R: Pt = [50, sh];
  const restL: Pt[] = [[-61, sh - 4], [-76, -150]];
  const restR: Pt[] = [[61, sh - 4], [76, -150]];
  switch (pose) {
    case 'pray':
    case 'kneel':
      return [
        [L, [-46, sh + 70], [-3, sh + 40]],
        [R, [46, sh + 70], [3, sh + 40]],
      ];
    case 'armsOpen':
      return [
        [L, [-175, sh + 34]],
        [R, [175, sh + 34]],
      ];
    case 'armsOut':
      return [
        [L, [-150, sh - 90 - swing * 20]],
        [R, [150, sh - 90 - swing * 20]],
      ];
    case 'armsUp':
    case 'jump':
      return [
        [L, [-105, sh - 140]],
        [R, [105, sh - 140]],
      ];
    case 'hold':
      return [
        [L, [-118, sh + 105]],
        [R, [118, sh + 105]],
      ];
    case 'shake': {
      const s = Math.sin(frame * 1.3) * 12 * swing;
      return [restL, [R, [168 + s, sh + 60 + s * 0.5]]];
    }
    case 'point':
      return [restL, [R, [185, sh - 6 - swing * 30]]];
    case 'pointLeft':
      return [[L, [-185, sh - 6 - swing * 30]], restR];
    case 'reach':
      return [
        [L, [-150, sh + 40]],
        [R, [150, sh + 40]],
      ];
    default:
      return [restL, restR];
  }
};

/** Shared peg body used by both ordinary figures and Jesus. */
export const PegBody: React.FC<BodyProps> = ({
  pose,
  frame,
  walkPhase = 0,
  tremble = 0,
  seed = 'p',
  wrap,
  beard,
  wrapColor,
  armSwing = 0,
  lineW = OUTLINE,
  faceColor,
  style,
}) => {
  const kneeling = pose === 'kneel' || pose === 'pray';
  const drop = kneeling ? 66 : 0; // kneeling figures sit lower
  const hem = kneeling ? -3 : HEM_Y;
  const hemW = kneeling ? 94 : 78;
  const top = SHOULDER_Y + drop;

  const walking = pose === 'walk';
  const legA = walking ? Math.sin(walkPhase) * 0.36 : pose === 'jump' ? 0.32 : 0;
  const bodyBob = walking ? -Math.abs(Math.cos(walkPhase)) * 6 : 0;

  const tx = tremble * jitter(`${seed}x`, frame, 2) * 3.2;
  const ty = tremble * jitter(`${seed}y`, frame, 2) * 1.6;

  const [armL, armR] = armsFor(pose, frame, armSwing);
  const shiftArm = (pts: Pt[]) => pts.map(([x, y]) => [x, y + drop] as Pt);
  const poly = (pts: Pt[]) => pts.map((p) => p.join(',')).join(' ');

  const headY = top - HEAD_R + 8;
  const stroke = {stroke: style.line, strokeWidth: lineW, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const, ...NS};

  const legLen = 60;
  const leg = (side: -1 | 1, a: number) => {
    const hx = side * 22;
    const hy = HEM_Y - 6;
    return (
      <line
        x1={hx}
        y1={hy}
        x2={hx + Math.sin(a) * legLen}
        y2={hy + Math.cos(a) * legLen}
        {...stroke}
      />
    );
  };

  const r = HEAD_R;
  const faceTop = headY + r * 0.12;
  const facePath =
    `M ${-r * 0.74} ${faceTop + 6} Q 0 ${faceTop - 12} ${r * 0.74} ${faceTop + 6}` +
    ` Q ${r * 0.74} ${headY + r * 0.95} ${r * 0.5} ${headY + r * 1.35} L 0 ${headY + r * 2.45}` +
    ` L ${-r * 0.5} ${headY + r * 1.35} Q ${-r * 0.74} ${headY + r * 0.95} ${-r * 0.74} ${faceTop + 6} Z`;

  return (
    <g transform={`translate(${tx},${ty + bodyBob})`}>
      {!kneeling && pose !== 'sit' && pose !== 'lie' ? (
        <g>
          {leg(-1, legA)}
          {leg(1, -legA)}
        </g>
      ) : null}
      <path d={robePath(top, hem, 58, hemW, 30)} fill={style.fill} {...stroke} />
      <path
        d={`M ${-hemW + 12} ${top + (hem - top) * 0.66} Q 0 ${top + (hem - top) * 0.66 + 9} ${hemW - 12} ${top + (hem - top) * 0.66}`}
        fill="none"
        stroke={style.belt}
        strokeWidth={lineW * 0.5}
        strokeLinecap="round"
        {...NS}
      />
      {style.cross ? (
        <g stroke={style.line} strokeWidth={lineW * 0.62} strokeLinecap="round" {...NS}>
          <line x1={0} y1={top + 40} x2={0} y2={top + 108} />
          <line x1={-17} y1={top + 62} x2={17} y2={top + 62} />
        </g>
      ) : null}
      <polyline points={poly(shiftArm(armL))} fill="none" {...stroke} />
      <polyline points={poly(shiftArm(armR))} fill="none" {...stroke} />
      <g>
        <circle cx={0} cy={headY} r={HEAD_R} fill={wrap ? wrapColor ?? style.fill : style.head} {...stroke} />
        {beard ? (
          <path d={facePath} fill={faceColor ?? C.face} stroke={style.line} strokeWidth={lineW * 0.42} strokeLinejoin="round" {...NS} />
        ) : null}
      </g>
      {tremble > 0.05 ? <TrembleMarks frame={frame} top={top} amount={tremble} line={style.line} /> : null}
    </g>
  );
};

const TrembleMarks: React.FC<{frame: number; top: number; amount: number; line: string}> = ({frame, top, amount, line}) => {
  const on = Math.floor(frame / 4) % 2 === 0;
  const o = on ? 0 : 6;
  const arc = (side: -1 | 1, y: number, k: number) => (
    <path
      key={`${side}-${y}-${k}`}
      d={`M ${side * (96 + k * 16 + o)} ${y - 18} Q ${side * (108 + k * 16 + o)} ${y} ${side * (96 + k * 16 + o)} ${y + 18}`}
      fill="none"
      stroke={line}
      strokeWidth={3}
      strokeLinecap="round"
      opacity={amount}
      vectorEffect="non-scaling-stroke"
    />
  );
  return (
    <g>
      {[-1, 1].map((s) => [arc(s as -1 | 1, top + 30, 0), arc(s as -1 | 1, top + 30, 1)])}
    </g>
  );
};

export interface PegPersonProps {
  x: number;
  y: number;
  scale?: number;
  robe?: string;
  wrap?: boolean;
  beard?: boolean;
  wrapColor?: string;
  pose?: Pose;
  frame: number;
  walkPhase?: number;
  tremble?: number;
  armSwing?: number;
  seed?: string;
  rotate?: number;
  opacity?: number;
  faceColor?: string;
}

export const PegPerson: React.FC<PegPersonProps> = ({
  x,
  y,
  scale = 1,
  robe = C.robeBlue,
  wrap = false,
  beard = false,
  wrapColor,
  pose = 'stand',
  frame,
  walkPhase,
  tremble = 0,
  armSwing,
  seed = 'peg',
  rotate = 0,
  opacity = 1,
  faceColor,
}) => (
  <g transform={`translate(${x},${y}) rotate(${rotate}) scale(${scale})`} opacity={opacity}>
    <PegBody
      faceColor={faceColor}
      pose={pose}
      frame={frame}
      walkPhase={walkPhase}
      tremble={tremble}
      seed={seed}
      wrap={wrap}
      beard={beard}
      wrapColor={wrapColor ?? robe}
      armSwing={armSwing}
      style={{fill: robe, line: C.ink, head: robe, belt: C.ink}}
    />
  </g>
);

export interface JesusProps {
  x: number;
  y: number;
  scale?: number;
  pose?: Pose;
  frame: number;
  walkPhase?: number;
  glow?: number; // 0..1.5
  armSwing?: number;
  rotate?: number;
  opacity?: number;
}

/** Jesus: cream figure, gold outline, gold cross, no face, no halo ring. */
export const Jesus: React.FC<JesusProps> = ({
  x,
  y,
  scale = 1,
  pose = 'stand',
  frame,
  walkPhase,
  glow = 1,
  armSwing,
  rotate = 0,
  opacity = 1,
}) => {
  const id = sid(useId());
  const breathe = 1 + Math.sin(frame / 22) * 0.04;
  return (
    <g transform={`translate(${x},${y}) rotate(${rotate}) scale(${scale})`} opacity={opacity}>
      <defs>
        <radialGradient id={`jg${id}`}>
          <stop offset="0%" stopColor={C.jesusGlow} stopOpacity={0.75} />
          <stop offset="45%" stopColor={C.jesusGlow} stopOpacity={0.32} />
          <stop offset="100%" stopColor={C.jesusGlow} stopOpacity={0} />
        </radialGradient>
      </defs>
      {glow > 0 ? (
        <ellipse
          cx={0}
          cy={-230}
          rx={300 * breathe}
          ry={330 * breathe}
          fill={`url(#jg${id})`}
          opacity={Math.min(1, glow)}
          transform={glow > 1 ? `scale(${glow})` : undefined}
          style={{mixBlendMode: 'screen'}}
        />
      ) : null}
      <PegBody
        pose={pose}
        frame={frame}
        walkPhase={walkPhase}
        armSwing={armSwing}
        seed="jesus"
        lineW={OUTLINE * 0.9}
        style={{fill: C.jesusFill, line: C.jesusLine, head: C.jesusFill, belt: C.jesusLine, cross: true}}
      />
    </g>
  );
};

/** Walk phase helper: ~2 steps per second at 30 fps. */
export const walkPhaseAt = (frame: number, start = 0) => ((frame - start) / 30) * Math.PI * 2;
