import React, {useId} from 'react';
import {OUTLINE} from '../lib/theme';
import {noise1} from '../lib/anim';
import {P, addv, capsule, down, f, poly, rot, smoothClosed, smoothOpen, tf} from './geom';
import {PropShape, PropKind} from './props';

// ------------------------------------------------------------------ types
export type Pose = {
  lean?: number; // torso lean from vertical, deg (+ = forward)
  head?: number; // head tilt relative to torso, deg (+ = nod forward)
  hipF?: number; hipB?: number; // thigh angle from straight down (+ = forward)
  kneeF?: number; kneeB?: number; // knee flexion (+ = shin folds back)
  shF?: number; shB?: number; // upper-arm angle in world (+ = forward)
  elF?: number; elB?: number; // elbow flexion (+ = forearm folds forward/up)
  mode?: 'stand' | 'sit' | 'cross';
  seat?: number; // seat height for 'sit'
  breath?: number; // seconds, drives breathing
};
export type Face = {
  brow?: 'neutral' | 'sad' | 'raised' | 'happy' | 'worried' | 'kind' | 'sly' | 'brave';
  mouth?: 'smile' | 'bigSmile' | 'open' | 'sad' | 'o' | 'neutral' | 'talk' | 'sly' | 'whisper' | 'soft';
  mouthOpen?: number;
  eyes?: number; // openness 0..1 (blink)
  eyeStyle?: 'normal' | 'happy' | 'down' | 'wide' | 'closed';
  lookX?: number;
  lookY?: number;
  tears?: boolean;
};
export type Look = {
  skin: string; skinShade: string;
  garment: 'robe' | 'tunic' | 'hoodie' | 'coat';
  cloth: string; clothShade: string;
  belt?: string; beltShade?: string; beltW?: number; beltEnds?: boolean;
  under?: string;
  head: 'scarf' | 'wrap' | 'long' | 'short' | 'curly' | 'bald' | 'beanie' | 'veil';
  headCol?: string; headShade?: string;
  hair?: string; hairShade?: string;
  beard?: 'none' | 'short' | 'long' | 'stubble';
  beardCol?: string; beardStreak?: string;
  mantle?: string; mantleShade?: string;
  pants?: string; pantsShade?: string; shoe?: string; shoeShade?: string;
  patch?: string;
  stripes?: string[];
  wrinkles?: boolean;
  blush?: boolean;
  thin?: number;
  wreath?: boolean;
  child?: boolean;
};
export type Hold = {kind: PropKind; fill?: number; t?: number; angle?: number};
export type PersonProps = {
  look: Look;
  pose: Pose;
  face?: Face;
  t?: number;
  seed?: number;
  flip?: boolean;
  x?: number;
  y?: number;
  scale?: number;
  front?: Hold; // prop in the near hand
  back?: Hold; // prop in the far hand
  onBack?: Hold; // carried on the back (bundle)
  cradle?: Hold; // baby held at the chest with both arms
  sway?: number; // secondary motion strength
  walk?: number; // walk phase (radians) for follow-through
  light?: number; // -1 light from left, 1 from right
  lineW?: number;
  shadow?: boolean;
  opacity?: number;
};

// ------------------------------------------------------------------ constants (units; figure ≈ 575 tall)
const L1 = 132, L2 = 132, TORSO = 172, NECK = 20, UA = 98, FA = 90;
const MOUTH_DARK = '#4A1C12';
const EYE = '#24150E';

// Shaded fill: base colour with a one-tone shadow on the side away from the light.
const Shade: React.FC<{id: string; d: string; base: string; shade: string; light: number; lw: number; off?: number; stroke?: boolean}> = ({
  id, d, base, shade, light, lw, off = 10, stroke = true,
}) => (
  <g>
    <clipPath id={id}>
      <path d={d} />
    </clipPath>
    <g clipPath={`url(#${id})`}>
      <path d={d} fill={shade} />
      <path d={d} fill={base} transform={`translate(${f(off * light)},${f(-off * 0.45)})`} />
    </g>
    {stroke && <path d={d} fill="none" stroke={OUTLINE} strokeWidth={lw} strokeLinejoin="round" />}
  </g>
);

export const Person: React.FC<PersonProps> = (props) => {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const {look, pose, face = {}, t = 0, seed = 1, flip = false, x = 0, y = 0, scale = 1} = props;
  const light = (props.light ?? -1) * (flip ? -1 : 1);
  const lw = props.lineW ?? 5.5 / Math.max(0.35, scale);
  const sway = props.sway ?? 1;
  const walk = props.walk ?? 0;
  const thin = look.thin ?? 1;
  const mode = pose.mode ?? 'stand';

  // ---- breathing & secondary motion
  const br = Math.sin(((pose.breath ?? t) * Math.PI * 2) / 3.6);
  const windA = noise1(seed + 40, t * 0.8) * 6 * sway;
  const follow = Math.sin(walk - 0.9) * 7 * sway; // hem / scarf lag behind the stride

  // ---- skeleton (shared with handPoint so props can sit exactly in a hand)
  const R = computeRig(pose, thin, br);
  const {P0, kF, kB, aF, aB, hF, hB, up, shoulderC, neckBase, headAng, headC, torsoLen} = R;
  const {shF, shB, elbF, elbB, wrF, wrB, handF, handB, foreAF, foreAB} = R;
  const lean = pose.lean ?? 0;
  void up; void shoulderC;

  // ---- colours
  const skin = look.skin, skinS = look.skinShade;
  const cloth = look.cloth, clothS = look.clothShade;
  const id = (s: string) => `${uid}${s}`;
  const els: React.ReactNode[] = [];
  const push = (n: React.ReactNode) => els.push(n);

  // ---- ground shadow
  if (props.shadow !== false && mode !== 'sit') {
    push(<ellipse key="gs" cx={f((aF[0] + aB[0]) / 2)} cy={-2} rx={mode === 'cross' ? 110 : 80} ry={14} fill="rgba(40,20,8,0.28)" />);
  }

  // ---- things carried on the back
  if (props.onBack) push(<g key="onback" transform={`translate(${f(shB[0] - 30)},${f(shB[1] + 40)}) rotate(${f(lean)})`}><PropShape kind={props.onBack.kind} lw={lw} t={t} /></g>);

  // ---- scarf / hair tail (behind body), with follow-through
  const tailSwing = windA + follow * 0.8 - lean * 0.4;
  if (look.head === 'scarf' || look.head === 'veil' || look.head === 'long' || look.head === 'wrap') {
    const base = addv(headC, rot([-44, 22], headAng));
    const len = look.head === 'wrap' ? 40 : look.head === 'long' ? 70 : 150;
    const wdt = look.head === 'wrap' ? 12 : look.head === 'long' ? 34 : 40;
    const sw = tailSwing;
    const pts: P[] = [
      base, addv(base, [-wdt * 0.6 + sw * 0.2, len * 0.35]), addv(base, [-wdt * 0.5 + sw * 0.6, len * 0.75]),
      addv(base, [-wdt * 0.1 + sw, len]), addv(base, [wdt * 0.5 + sw * 0.9, len * 0.95]), addv(base, [wdt * 0.6 + sw * 0.4, len * 0.5]), addv(base, [wdt, 0]),
    ];
    const col = look.head === 'long' ? look.hair ?? '#3B2A1E' : look.headCol ?? cloth;
    const colS = look.head === 'long' ? look.hairShade ?? '#2A1C14' : look.headShade ?? clothS;
    push(<Shade key="tail" id={id('tail')} d={smoothClosed(pts)} base={colS} shade={colS} light={light} lw={lw} />);
    if (look.head === 'veil') {
      const vb = addv(headC, rot([-30, -40], headAng));
      const vp: P[] = [vb, addv(vb, [-60 + sw * 0.3, 80]), addv(vb, [-50 + sw, 200]), addv(vb, [10 + sw, 210]), addv(vb, [30, 60])];
      push(<path key="veil" d={smoothClosed(vp)} fill="rgba(250,244,230,0.75)" stroke={OUTLINE} strokeWidth={lw * 0.8} />);
    }
  }

  // ---- far arm (darker)
  const sleeveCol = look.garment === 'tunic' ? skin : cloth;
  const sleeveS = look.garment === 'tunic' ? skinS : clothS;
  const armB = () => {
    if (props.cradle) return;
    const ua = capsule(shB, elbB, 17 * thin, 14 * thin);
    const fa = capsule(elbB, wrB, 14 * thin, 11 * thin);
    const upperCol = look.garment === 'tunic' ? cloth : sleeveCol;
    push(<path key="bua" d={ua} fill={look.garment === 'tunic' ? clothS : sleeveS} stroke={OUTLINE} strokeWidth={lw} />);
    push(<path key="bfa" d={fa} fill={sleeveS} stroke={OUTLINE} strokeWidth={lw} />);
    if (look.under && look.garment === 'robe') push(<circle key="bcuff" cx={f(wrB[0])} cy={f(wrB[1])} r={10} fill={look.under} stroke={OUTLINE} strokeWidth={lw * 0.8} />);
    push(<Hand key="bh" p={handB} ang={foreAB} col={skinS} lw={lw} closed={!!props.back} />);
    if (props.back) push(<g key="bprop" transform={`translate(${f(handB[0])},${f(handB[1])}) rotate(${f(props.back.angle ?? -foreAB)})`}><PropShape kind={props.back.kind} fill={props.back.fill} t={t} lw={lw} /></g>);
    void upperCol;
  };
  armB();

  // ---- legs
  const legCol = look.garment === 'hoodie' || look.garment === 'coat' ? look.pants ?? '#2E3A4F' : skin;
  const legS = look.garment === 'hoodie' || look.garment === 'coat' ? look.pantsShade ?? '#212B3B' : skinS;
  const drawLeg = (key: string, hip: P, knee: P, ank: P, far: boolean) => {
    if (mode === 'cross') return;
    const th = capsule(hip, knee, 22 * thin, 16 * thin);
    const shn = capsule(knee, ank, 15 * thin, 11 * thin);
    push(<path key={key + 't'} d={th} fill={far ? legS : legCol} stroke={OUTLINE} strokeWidth={lw} />);
    push(<path key={key + 's'} d={shn} fill={far ? legS : legCol} stroke={OUTLINE} strokeWidth={lw} />);
    push(<Foot key={key + 'f'} p={ank} skin={far ? skinS : skin} look={look} lw={lw} far={far} />);
  };
  drawLeg('lb', hB, kB, aB, true);
  drawLeg('lf', hF, kF, aF, false);

  // ---- skirt / lower garment
  const waistL = addv(P0, rot([-38 * thin, -4], lean)), waistR = addv(P0, rot([38 * thin, -4], lean));
  if (mode === 'cross') {
    const lap: P[] = [[-70, -10], [-74, -52], [-20, -78], [60, -74], [104, -40], [98, -8], [20, 2]];
    push(<Shade key="lap" id={id('lap')} d={smoothClosed(lap.map((p) => [p[0], p[1]] as P))} base={cloth} shade={clothS} light={light} lw={lw} />);
    push(<path key="lapfold" d={smoothOpen([[-30, -40], [20, -30], [70, -36]])} fill="none" stroke={OUTLINE} strokeWidth={lw * 0.6} opacity={0.5} />);
    push(<Foot key="xfoot" p={[86, -10]} skin={skin} look={look} lw={lw} far={false} />);
  } else if (look.garment === 'robe' || look.garment === 'tunic' || look.garment === 'coat') {
    let hemY: number, hl: number, hr: number;
    if (mode === 'sit') {
      hemY = Math.max(kF[1], kB[1]) + 36;
      hl = Math.min(P0[0] - 50, kB[0] - 26);
      hr = Math.max(kF[0], kB[0]) + 30;
    } else if (look.garment === 'robe') {
      hemY = Math.max(aF[1], aB[1]) - 30;
      const minX = Math.min(aF[0], aB[0]), maxX = Math.max(aF[0], aB[0]);
      hl = Math.min(minX - 18, P0[0] - 48 * thin);
      hr = Math.max(maxX + 16, P0[0] + 46 * thin);
    } else {
      hemY = P0[1] + (look.garment === 'coat' ? 150 : 118);
      hl = Math.min(kB[0], kF[0]) - 34 * thin;
      hr = Math.max(kB[0], kF[0]) + 30 * thin;
      hl = Math.min(hl, P0[0] - 52 * thin);
      hr = Math.max(hr, P0[0] + 48 * thin);
    }
    const hs = follow * 0.6 + windA * 0.4;
    let skirt: P[];
    if (mode === 'sit') {
      skirt = [waistL, [hl, hemY - 10], [hl + 10, hemY], [hr - 8, hemY + 2], [hr, hemY - 30], [kF[0] + 6, kF[1] - 34], waistR];
    } else {
      skirt = [waistL, [hl + hs * 0.3 - 4, (waistL[1] + hemY) / 2], [hl + hs, hemY], [(hl + hr) / 2 + hs * 0.7, hemY + 6], [hr + hs * 0.6, hemY], [hr - 2 + hs * 0.2, (waistR[1] + hemY) / 2], waistR];
    }
    push(<Shade key="skirt" id={id('skirt')} d={smoothClosed(skirt, 0.8)} base={cloth} shade={clothS} light={light} lw={lw} />);
    if (look.stripes) {
      push(
        <g key="skstripes" clipPath={`url(#${id('skirt')})`}>
          {look.stripes.map((c, i) => (
            <rect key={i} x={hl - 40 + i * 44} y={waistL[1] - 10} width={18} height={hemY - waistL[1] + 40} fill={c} opacity={0.85} transform={`rotate(${f(lean * 0.5)} ${f(P0[0])} ${f(P0[1])})`} />
          ))}
        </g>,
      );
    }
    if (look.patch) push(<rect key="patch" x={f(hl + 26)} y={f(hemY - 70)} width={34} height={30} rx={4} fill={look.patch} stroke={OUTLINE} strokeWidth={lw * 0.6} strokeDasharray="6 5" />);
    // fold lines
    push(<path key="fold1" d={smoothOpen([[P0[0] + 8, P0[1] + 30], [P0[0] + 14 + hs * 0.4, (P0[1] + hemY) / 2], [P0[0] + 18 + hs, hemY - 10]])} fill="none" stroke={OUTLINE} strokeWidth={lw * 0.55} opacity={0.45} />);
  }

  // ---- torso
  const T: P[] = [
    [-37 * thin, -2], [-44 * thin, -torsoLen * 0.55], [-38 * thin, -torsoLen + 8], [-14, -torsoLen - 4], [18, -torsoLen - 2],
    [36 * thin, -torsoLen + 12], [40 * thin, -torsoLen * 0.5], [36 * thin, -2],
  ];
  const torsoPts = tf(T, lean, P0);
  const torsoCol = look.garment === 'hoodie' ? cloth : cloth;
  push(<Shade key="torso" id={id('torso')} d={smoothClosed(torsoPts, 0.7)} base={torsoCol} shade={clothS} light={light} lw={lw} />);
  if (look.stripes) {
    push(
      <g key="tstripes" clipPath={`url(#${id('torso')})`}>
        {look.stripes.map((c, i) => (
          <rect key={i} x={-90 + i * 44} y={-torsoLen - 20} width={18} height={torsoLen + 40} fill={c} opacity={0.85} transform={`translate(${f(P0[0])},${f(P0[1])}) rotate(${f(lean)})`} />
        ))}
      </g>,
    );
  }
  // neckline / under-tunic
  const neckL = addv(P0, rot([-12, -torsoLen + 2], lean)), neckR = addv(P0, rot([16, -torsoLen + 4], lean)), neckLow = addv(P0, rot([4, -torsoLen + 26], lean));
  if (look.under) push(<path key="under" d={poly([neckL, neckLow, neckR])} fill={look.under} stroke={OUTLINE} strokeWidth={lw * 0.7} strokeLinejoin="round" />);
  if (look.garment === 'hoodie') {
    // hood collar + front pocket
    const hood = tf([[-34, -torsoLen + 2], [-26, -torsoLen - 16], [10, -torsoLen - 18], [26, -torsoLen - 4], [6, -torsoLen + 10]], lean, P0);
    push(<Shade key="hood" id={id('hood')} d={smoothClosed(hood)} base={clothS} shade={clothS} light={light} lw={lw} />);
    const pocket = tf([[-6, -56], [30, -56], [34, -22], [-10, -22]], lean, P0);
    push(<path key="pocket" d={poly(pocket)} fill="none" stroke={OUTLINE} strokeWidth={lw * 0.6} opacity={0.6} />);
  }
  if (look.mantle) {
    const m = tf([[-44, -torsoLen + 10], [-20, -torsoLen - 6], [8, -torsoLen + 2], [40, -torsoLen * 0.42], [40, -6], [14, 4], [-8, -torsoLen * 0.4]], lean, P0);
    push(<Shade key="mantle" id={id('mantle')} d={smoothClosed(m, 0.8)} base={look.mantle} shade={look.mantleShade ?? look.mantle} light={light} lw={lw} />);
  }
  // belt / sash
  if (look.belt) {
    const bw = look.beltW ?? 12;
    const b = tf([[-40 * thin, -bw - 2], [38 * thin, -bw - 4], [38 * thin, 2], [-40 * thin, 4]], lean, P0);
    push(<path key="belt" d={poly(b)} fill={look.belt} stroke={OUTLINE} strokeWidth={lw * 0.8} strokeLinejoin="round" />);
    if (look.beltEnds) {
      const k0 = addv(P0, rot([24, -2], lean));
      const ends: P[] = [k0, [k0[0] + 6 + follow * 0.3, k0[1] + 40], [k0[0] + 16 + follow * 0.5, k0[1] + 62], [k0[0] + 22, k0[1] + 44], [k0[0] + 12, k0[1]]];
      push(<path key="beltends" d={smoothClosed(ends)} fill={look.beltShade ?? look.belt} stroke={OUTLINE} strokeWidth={lw * 0.8} />);
    }
  }

  // ---- neck + head
  push(<path key="neck" d={capsule(neckBase, addv(headC, rot([-4, 30], headAng)), 13, 13)} fill={skinS} stroke={OUTLINE} strokeWidth={lw} />);
  push(
    <g key="head" transform={`translate(${f(headC[0])},${f(headC[1])}) rotate(${f(headAng)})`}>
      <Head look={look} face={face} lw={lw} light={light} uid={uid} t={t} />
    </g>,
  );

  // ---- near arm (+ prop)
  if (props.cradle) {
    // both arms wrap a baby bundle at the chest
    const chest = addv(P0, rot([22, -torsoLen * 0.55], lean));
    push(<g key="cradle" transform={`translate(${f(chest[0])},${f(chest[1])}) rotate(${f(lean * 0.5 - 8)}) scale(1.3)`}><PropShape kind={props.cradle.kind} lw={lw / 1.3} t={t} /></g>);
    const sF2 = shF;
    const e2 = addv(chest, [-14, 34]);
    push(<path key="cua" d={capsule(sF2, e2, 17 * thin, 14 * thin)} fill={sleeveCol} stroke={OUTLINE} strokeWidth={lw} />);
    push(<path key="cfa" d={capsule(e2, addv(chest, [52, 10]), 14 * thin, 11 * thin)} fill={sleeveCol} stroke={OUTLINE} strokeWidth={lw} />);
    push(<Hand key="ch" p={addv(chest, [60, 4])} ang={-60} col={skin} lw={lw} closed />);
  } else {
    const upperCol = look.garment === 'tunic' ? cloth : sleeveCol;
    const upperS = look.garment === 'tunic' ? clothS : sleeveS;
    push(<Shade key="fua" id={id('fua')} d={capsule(shF, elbF, 18 * thin, 15 * thin)} base={upperCol} shade={upperS} light={light} lw={lw} off={6} />);
    push(<Shade key="ffa" id={id('ffa')} d={capsule(elbF, wrF, 15 * thin, 12 * thin)} base={sleeveCol} shade={sleeveS} light={light} lw={lw} off={5} />);
    if (look.under && look.garment === 'robe') push(<circle key="fcuff" cx={f(wrF[0])} cy={f(wrF[1])} r={10} fill={look.under} stroke={OUTLINE} strokeWidth={lw * 0.8} />);
    if (look.garment === 'hoodie') push(<circle key="fcuffh" cx={f(wrF[0])} cy={f(wrF[1])} r={11} fill={clothS} stroke={OUTLINE} strokeWidth={lw * 0.8} />);
    push(<Hand key="fh" p={handF} ang={foreAF} col={skin} lw={lw} closed={!!props.front && props.front.kind !== 'openPalm'} />);
    if (props.front) push(<g key="fprop" transform={`translate(${f(handF[0])},${f(handF[1])}) rotate(${f(props.front.angle ?? 0)})`}><PropShape kind={props.front.kind} fill={props.front.fill} t={t} lw={lw} /></g>);
  }

  const sx = flip ? -scale : scale;
  return (
    <g transform={`translate(${f(x)},${f(y)}) scale(${sx},${scale})`} opacity={props.opacity ?? 1}>
      {els}
    </g>
  );
};

// ------------------------------------------------------------------ forward kinematics
export function computeRig(pose: Pose, thin = 1, br = 0) {
  const mode = pose.mode ?? 'stand';
  const lean = pose.lean ?? 0;
  const hipF = pose.hipF ?? 0, hipB = pose.hipB ?? 0, kneeF = pose.kneeF ?? 0, kneeB = pose.kneeB ?? 0;
  const pelvis0: P = [0, 0];
  const hipJF = addv(pelvis0, [7, 0]), hipJB = addv(pelvis0, [-7, 0]);
  const kneeFp = addv(hipJF, down(hipF), L1), kneeBp = addv(hipJB, down(hipB), L1);
  const ankF = addv(kneeFp, down(hipF - kneeF), L2), ankB = addv(kneeBp, down(hipB - kneeB), L2);
  let py: number;
  if (mode === 'sit') py = -(pose.seat ?? 150) - 14;
  else if (mode === 'cross') py = -42;
  else py = -Math.max(ankF[1], ankB[1]) - 14;
  const P0: P = [0, py];
  const sh = (p: P): P => [p[0], p[1] + py];
  const torsoLen = TORSO * (1 + br * 0.008);
  const up: P = [Math.sin((lean * Math.PI) / 180), -Math.cos((lean * Math.PI) / 180)];
  const shoulderC = addv(P0, up, torsoLen);
  const neckBase = addv(P0, up, torsoLen + 4 + br * 1.2);
  const headAng = lean * 0.75 + (pose.head ?? 0);
  const headUp: P = [Math.sin((headAng * Math.PI) / 180), -Math.cos((headAng * Math.PI) / 180)];
  const headC = addv(addv(neckBase, headUp, NECK + 44), [6 * Math.cos((headAng * Math.PI) / 180), 0]);
  const shF = addv(shoulderC, rot([12 * thin, 14], lean));
  const shB = addv(shoulderC, rot([-16 * thin, 14], lean));
  const elbF = addv(shF, down(pose.shF ?? 4), UA), elbB = addv(shB, down(pose.shB ?? -4), UA);
  const foreAF = (pose.shF ?? 4) + (pose.elF ?? 10), foreAB = (pose.shB ?? -4) + (pose.elB ?? 10);
  const wrF = addv(elbF, down(foreAF), FA), wrB = addv(elbB, down(foreAB), FA);
  const handF = addv(wrF, down(foreAF), 14), handB = addv(wrB, down(foreAB), 14);
  return {
    P0, py, kF: sh(kneeFp), kB: sh(kneeBp), aF: sh(ankF), aB: sh(ankB), hF: sh(hipJF), hB: sh(hipJB),
    up, shoulderC, neckBase, headAng, headC, torsoLen, shF, shB, elbF, elbB, wrF, wrB, handF, handB, foreAF, foreAB,
  };
}

/** Screen position of a character's hand (for props passed between people). */
export const handPoint = (pose: Pose, at: {x: number; y: number; scale: number; flip?: boolean; thin?: number}, which: 'front' | 'back' = 'front'): P => {
  const r = computeRig(pose, at.thin ?? 1, 0);
  const h = which === 'front' ? r.handF : r.handB;
  return [at.x + (at.flip ? -1 : 1) * at.scale * h[0], at.y + at.scale * h[1]];
};

// ------------------------------------------------------------------ hands & feet
const Hand: React.FC<{p: P; ang: number; col: string; lw: number; closed?: boolean}> = ({p, ang, col, lw, closed}) => {
  // simple cartoon mitten with a thumb, pointing along the forearm
  const pts: P[] = closed
    ? [[-11, -6], [10, -10], [16, 2], [10, 14], [-8, 12]]
    : [[-11, -6], [12, -8], [24, 2], [14, 14], [-6, 13]];
  const thumb: P[] = [[2, -8], [12, -18], [17, -14], [10, -4]];
  return (
    <g transform={`translate(${f(p[0])},${f(p[1])}) rotate(${f(90 - ang)})`}>
      <path d={smoothClosed(thumb)} fill={col} stroke={OUTLINE} strokeWidth={lw * 0.8} />
      <path d={smoothClosed(pts)} fill={col} stroke={OUTLINE} strokeWidth={lw * 0.8} />
    </g>
  );
};

const Foot: React.FC<{p: P; skin: string; look: Look; lw: number; far: boolean}> = ({p, skin, look, lw, far}) => {
  const modern = look.garment === 'hoodie' || look.garment === 'coat';
  if (modern) {
    const col = look.shoe ?? '#F4F1EA';
    return (
      <g transform={`translate(${f(p[0])},${f(p[1])})`}>
        <path d={smoothClosed([[-14, -10], [20, -10], [40, 2], [38, 12], [-16, 12]], 0.7)} fill={far ? look.shoeShade ?? '#D6D0C4' : col} stroke={OUTLINE} strokeWidth={lw} />
        <path d="M-16,8 L39,8" stroke={OUTLINE} strokeWidth={lw * 0.6} />
      </g>
    );
  }
  return (
    <g transform={`translate(${f(p[0])},${f(p[1])})`}>
      <path d={smoothClosed([[-12, -10], [14, -8], [34, 4], [32, 12], [-14, 12]], 0.7)} fill={skin} stroke={OUTLINE} strokeWidth={lw} />
      <path d="M-14,11 L33,11" stroke="#5A3A22" strokeWidth={lw * 1.1} strokeLinecap="round" />
      <path d="M2,-8 L12,8" stroke="#6B4528" strokeWidth={lw * 0.7} strokeLinecap="round" />
    </g>
  );
};

// ------------------------------------------------------------------ head
const Head: React.FC<{look: Look; face: Face; lw: number; light: number; uid: string; t: number}> = ({look, face, lw, light, uid}) => {
  const skin = look.skin, skinS = look.skinShade;
  const headPts: P[] = [[2, -54], [-34, -44], [-50, -8], [-40, 30], [-14, 50], [16, 54], [36, 38], [44, 20], [52, 4], [46, -12], [40, -36]];
  const covered = look.head === 'scarf' || look.head === 'veil';
  const els: React.ReactNode[] = [];
  // back hair / scarf back layer
  if (covered) {
    const back: P[] = [[40, -46], [0, -70], [-52, -50], [-68, -6], [-62, 50], [-44, 92], [0, 96], [10, 62], [-8, 20]];
    els.push(<Shade key="scb" id={`${uid}scb`} d={smoothClosed(back)} base={look.headShade ?? '#ccc'} shade={look.headShade ?? '#ccc'} light={light} lw={lw} />);
  }
  if (look.head === 'long') {
    const back: P[] = [[30, -50], [-8, -64], [-54, -40], [-64, 10], [-58, 74], [-30, 86], [-18, 50], [-10, 10]];
    els.push(<path key="hb" d={smoothClosed(back)} fill={look.hairShade ?? '#2A1C14'} stroke={OUTLINE} strokeWidth={lw} />);
  }
  // face/head
  els.push(<Shade key="hd" id={`${uid}hd`} d={smoothClosed(headPts, 0.95)} base={skin} shade={skinS} light={light} lw={lw} off={8} />);
  // ear
  if (!covered && look.head !== 'long' && look.head !== 'beanie') {
    els.push(<path key="ear" d={smoothClosed([[-18, -6], [-28, -12], [-32, 4], [-26, 16], [-16, 12]])} fill={skinS} stroke={OUTLINE} strokeWidth={lw * 0.8} />);
  }
  // beard (under mouth)
  if (look.beard && look.beard !== 'none') {
    const long = look.beard === 'long';
    const bp: P[] = long
      ? [[-14, -2], [-22, 34], [-10, 80], [12, 112], [30, 96], [46, 52], [50, 26], [40, 22], [26, 36], [12, 30], [0, 10]]
      : [[-14, -4], [-20, 26], [-4, 54], [18, 64], [38, 52], [50, 28], [42, 18], [30, 32], [16, 32], [4, 16]];
    if (look.beard === 'stubble') {
      els.push(<path key="stub" d={smoothClosed(bp)} fill={look.beardCol ?? '#555'} opacity={0.35} />);
    } else {
      els.push(<path key="beard" d={smoothClosed(bp)} fill={look.beardCol ?? '#333'} stroke={OUTLINE} strokeWidth={lw} />);
      if (look.beardStreak) els.push(<path key="streak" d={smoothOpen([[2, 40], [14, 52], [26, 50]])} fill="none" stroke={look.beardStreak} strokeWidth={lw} strokeLinecap="round" />);
    }
  }
  // face features
  els.push(<FaceFeatures key="face" face={face} lw={lw} look={look} />);
  // hair / headwear front layers
  if (covered) {
    const front: P[] = [[48, -42], [22, -64], [-22, -68], [-56, -42], [-62, 4], [-52, 52], [-30, 84], [-12, 60], [-14, 20], [-8, -16], [12, -40], [36, -47]];
    els.push(<Shade key="scf" id={`${uid}scf`} d={smoothClosed(front, 0.85)} base={look.headCol ?? '#eee'} shade={look.headShade ?? '#ccc'} light={light} lw={lw} />);
    els.push(<path key="hairline" d={smoothOpen([[38, -44], [24, -41], [12, -37]])} fill="none" stroke={look.hair ?? '#3A2418'} strokeWidth={lw * 1.4} strokeLinecap="round" />);
    if (look.wreath) {
      els.push(
        <g key="wreath">
          {Array.from({length: 7}).map((_, i) => {
            const a = -150 + i * 22;
            const px = Math.cos((a * Math.PI) / 180) * 54, pyy = Math.sin((a * Math.PI) / 180) * 50 - 10;
            return <circle key={i} cx={f(px)} cy={f(pyy)} r={7} fill={i % 2 ? '#FFFDF4' : '#E8C35A'} stroke={OUTLINE} strokeWidth={lw * 0.6} />;
          })}
        </g>,
      );
    }
  } else if (look.head === 'wrap') {
    const wrap: P[] = [[44, -30], [24, -60], [-22, -62], [-54, -34], [-50, -8], [-20, -24], [16, -30]];
    els.push(<Shade key="wrap" id={`${uid}wrap`} d={smoothClosed(wrap)} base={look.headCol ?? '#ddd'} shade={look.headShade ?? '#bbb'} light={light} lw={lw} />);
    els.push(<path key="wrapband" d={smoothOpen([[42, -28], [0, -32], [-48, -14]])} fill="none" stroke={look.headShade ?? '#bbb'} strokeWidth={lw * 1.2} />);
  } else if (look.head === 'long') {
    const front: P[] = [[44, -38], [22, -62], [-24, -62], [-56, -30], [-54, 18], [-40, 40], [-28, 6], [-10, -26], [16, -36]];
    els.push(<Shade key="hf" id={`${uid}hf`} d={smoothClosed(front)} base={look.hair ?? '#3B2A1E'} shade={look.hairShade ?? '#2A1C14'} light={light} lw={lw} />);
  } else if (look.head === 'short') {
    const hair: P[] = [[42, -40], [12, -62], [-32, -56], [-54, -22], [-48, 8], [-36, 4], [-30, -18], [-6, -34], [26, -38]];
    els.push(<Shade key="hs" id={`${uid}hs`} d={smoothClosed(hair)} base={look.hair ?? '#333'} shade={look.hairShade ?? '#222'} light={light} lw={lw} />);
  } else if (look.head === 'curly') {
    // bumpy cap over the top and back of the head only (face stays clear)
    const n = 12;
    const pts: P[] = [];
    for (let i = 0; i <= n; i++) {
      const a = (155 + (i / n) * 178) * (Math.PI / 180);
      const r = i % 2 ? 56 : 64;
      pts.push([Math.cos(a) * r - 6, Math.sin(a) * r - 8]);
    }
    pts.push([40, -40], [16, -40], [-14, -34], [-34, -14], [-42, 14]);
    els.push(<Shade key="hc" id={`${uid}hc`} d={smoothClosed(pts, 0.9)} base={look.hair ?? '#333'} shade={look.hairShade ?? '#222'} light={light} lw={lw} />);
  } else if (look.head === 'bald') {
    els.push(<path key="fringe" d={smoothClosed([[-48, -10], [-52, 22], [-34, 34], [-30, 6], [-38, -14]])} fill={look.hair ?? '#ddd'} stroke={OUTLINE} strokeWidth={lw * 0.8} />);
  } else if (look.head === 'beanie') {
    const b: P[] = [[48, -26], [34, -62], [-14, -72], [-54, -44], [-56, -14], [0, -22]];
    els.push(<Shade key="bn" id={`${uid}bn`} d={smoothClosed(b)} base={look.headCol ?? '#2F4A3A'} shade={look.headShade ?? '#223628'} light={light} lw={lw} />);
    els.push(<path key="bnband" d={smoothOpen([[50, -24], [0, -26], [-56, -16]])} fill="none" stroke={OUTLINE} strokeWidth={lw * 0.7} />);
  }
  return <g>{els}</g>;
};

const FaceFeatures: React.FC<{face: Face; lw: number; look: Look}> = ({face, lw, look}) => {
  const open = Math.max(0.05, face.eyes ?? 1);
  const style = face.eyeStyle ?? 'normal';
  const lx = (face.lookX ?? 0.4) * 3, ly = (face.lookY ?? 0) * 3;
  const brow = face.brow ?? 'neutral';
  const els: React.ReactNode[] = [];
  const eye = (key: string, cx: number, cy: number, rx: number, ry: number) => {
    if (style === 'happy') {
      els.push(<path key={key} d={`M${cx - rx - 2},${cy + 2} Q${cx},${cy - ry * 1.3} ${cx + rx + 2},${cy + 2}`} fill="none" stroke={EYE} strokeWidth={lw * 0.9} strokeLinecap="round" />);
      return;
    }
    if (style === 'closed' || open < 0.12) {
      els.push(<path key={key} d={`M${cx - rx - 2},${cy} Q${cx},${cy + ry * 0.7} ${cx + rx + 2},${cy}`} fill="none" stroke={EYE} strokeWidth={lw * 0.9} strokeLinecap="round" />);
      return;
    }
    const k = style === 'wide' ? 1.25 : 1;
    const ryy = ry * k * open * (style === 'down' ? 0.8 : 1);
    els.push(<ellipse key={key} cx={f(cx + lx)} cy={f(cy + ly + (style === 'down' ? 3 : 0))} rx={f(rx * k)} ry={f(ryy)} fill={EYE} />);
    els.push(<circle key={key + 'hl'} cx={f(cx + lx + rx * 0.35)} cy={f(cy + ly - ryy * 0.4)} r={f(Math.max(1.6, rx * 0.36))} fill="#FFFFFF" />);
  };
  eye('en', 14, -6, 5.6, 8.5);
  eye('ef', 36, -6, 4.4, 7.5);
  // brows: [near inner raise, near outer raise, far inner raise, far outer raise]
  const B: Record<string, number[]> = {
    neutral: [0, 0, 0, 0], sad: [11, -1, 11, -1], worried: [12, 2, 12, 2], raised: [8, 8, 8, 8], happy: [3, 4, 3, 4],
    kind: [3, 1, 3, 1], sly: [-2, 2, 6, 7], brave: [2, 4, 2, 4],
  };
  const b = B[brow] ?? B.neutral;
  const by = -27;
  els.push(<path key="bn" d={`M${2},${by - b[1]} Q${12},${by - 4 - (b[0] + b[1]) / 2} ${22},${by - b[0]}`} fill="none" stroke={EYE} strokeWidth={lw * 0.8} strokeLinecap="round" />);
  els.push(<path key="bf" d={`M${30},${by - b[2]} Q${37},${by - 3 - (b[2] + b[3]) / 2} ${44},${by - b[3]}`} fill="none" stroke={EYE} strokeWidth={lw * 0.7} strokeLinecap="round" />);
  // nose hint
  els.push(<path key="nose" d="M44,4 Q50,12 42,14" fill="none" stroke={OUTLINE} strokeWidth={lw * 0.7} strokeLinecap="round" opacity={0.7} />);
  // blush
  if (look.blush !== false) els.push(<ellipse key="blush" cx={16} cy={14} rx={9} ry={5} fill="#E07A6A" opacity={0.28} />);
  if (look.wrinkles) {
    els.push(<path key="wr1" d="M2,0 Q-4,4 -2,10" fill="none" stroke={OUTLINE} strokeWidth={lw * 0.5} opacity={0.5} />);
    els.push(<path key="wr2" d="M26,22 Q20,30 24,36" fill="none" stroke={OUTLINE} strokeWidth={lw * 0.5} opacity={0.4} />);
  }
  if (face.tears) els.push(<path key="tear" d="M10,6 Q6,16 10,20 Q14,16 10,6Z" fill="#BFE3F2" stroke={OUTLINE} strokeWidth={lw * 0.4} />);
  // mouth
  const mx = 30, my = 28;
  const m = face.mouth ?? 'soft';
  const mo = face.mouthOpen ?? 0;
  const S = (d: string, key = 'm') => els.push(<path key={key} d={d} fill="none" stroke={MOUTH_DARK} strokeWidth={lw * 0.9} strokeLinecap="round" />);
  const F = (d: string, key = 'mf') => els.push(<path key={key} d={d} fill={MOUTH_DARK} stroke={OUTLINE} strokeWidth={lw * 0.6} strokeLinejoin="round" />);
  if (m === 'neutral') S(`M${mx - 7},${my} L${mx + 6},${my + 1}`);
  else if (m === 'soft') S(`M${mx - 7},${my - 1} Q${mx},${my + 4} ${mx + 7},${my - 2}`);
  else if (m === 'smile') S(`M${mx - 10},${my - 3} Q${mx},${my + 9} ${mx + 9},${my - 4}`);
  else if (m === 'sad') S(`M${mx - 8},${my + 4} Q${mx},${my - 4} ${mx + 8},${my + 3}`);
  else if (m === 'sly') S(`M${mx - 9},${my} Q${mx + 2},${my + 6} ${mx + 10},${my - 6}`);
  else if (m === 'bigSmile') {
    F(`M${mx - 12},${my - 4} Q${mx},${my + 18} ${mx + 11},${my - 5} Q${mx},${my + 1} ${mx - 12},${my - 4}Z`);
    els.push(<path key="tongue" d={`M${mx - 5},${my + 6} Q${mx},${my + 3} ${mx + 5},${my + 6} Q${mx},${my + 10} ${mx - 5},${my + 6}Z`} fill="#C9574A" />);
  } else if (m === 'open') F(`M${mx - 6},${my} a6,8 0 1,0 12,0 a6,8 0 1,0 -12,0Z`);
  else if (m === 'o') F(`M${mx - 4},${my} a4,4.5 0 1,0 8,0 a4,4.5 0 1,0 -8,0Z`);
  else if (m === 'whisper') F(`M${mx - 4},${my + 1} a4,3 0 1,0 8,0 a4,3 0 1,0 -8,0Z`);
  else if (m === 'talk') {
    const h = 1.5 + mo * 7;
    F(`M${mx - 7},${my} Q${mx},${my - h * 0.5} ${mx + 7},${my - 1} Q${mx},${my + h * 1.4} ${mx - 7},${my}Z`);
  }
  return <g>{els}</g>;
};
