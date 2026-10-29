import {OUT, Leaf, Pt, path} from '../lib/draw';
import {noise1, rand} from '../lib/random';
import {lerp} from '../lib/anim';

export type Kind = 'eve' | 'adam' | 'jesus' | 'painter' | 'teen';
export type Face = {smile?: number; open?: number; brow?: number; furrow?: number; look?: number; blink?: number; eyesDown?: number};
export type Pose = {arm?: number; bend?: number; backArm?: number; backBend?: number; head?: number; lean?: number; sit?: number; walk?: number; walkAmt?: number; cross?: number};

const SKIN: Record<Kind, string> = {eve: '#C08154', adam: '#AE744C', jesus: '#B07A55', painter: '#E6B593', teen: '#8E5A3A'};
const HAIR: Record<Kind, string> = {eve: '#3A2216', adam: '#2A1A12', jesus: '#3B2618', painter: '#EFEDE8', teen: '#151110'};
const LEAVES_EVE = ['#5E9A33', '#4C8A2B', '#6FAE3E', '#7BB846'];
const LEAVES_ADAM = ['#3F7A27', '#4E8A2C', '#5A9131', '#356A24'];

// Outlined tube limb (dark stroke under a coloured stroke).
const Limb: React.FC<{pts: Pt[]; w: number; color: string}> = ({pts, w, color}) => (
  <>
    <path d={path(pts, false)} fill="none" stroke={OUT} strokeWidth={w + 12} strokeLinecap="round" strokeLinejoin="round" />
    <path d={path(pts, false)} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
  </>
);

export const autoBlink = (t: number, seed = 1) => {
  const period = 3.3 + rand(seed, 0) * 0.9;
  const k = ((t + rand(seed, 1) * period) % period) / period;
  return k < 0.045 ? Math.sin((k / 0.045) * Math.PI) : 0;
};

const rad = (d: number) => (d * Math.PI) / 180;
const step = (p: Pt, len: number, deg: number): Pt => [p[0] + Math.sin(rad(deg)) * len, p[1] + Math.cos(rad(deg)) * len];

// A paper-cut person, 3/4 view facing right. Local units: 1000 tall, feet at (0,0).
export const Person: React.FC<{
  kind: Kind; x: number; y: number; h: number; flip?: boolean; pose?: Pose; face?: Face; t: number; seed?: number;
  hold?: React.ReactNode; backHold?: React.ReactNode; opacity?: number; wind?: number;
}> = ({kind, x, y, h, flip, pose = {}, face = {}, t, seed = 1, hold, backHold, opacity = 1, wind = 1}) => {
  const s = h / 1000;
  const skin = SKIN[kind], hair = HAIR[kind];
  const sit = pose.sit ?? 0;
  const wph = (pose.walk ?? 0) * Math.PI * 2, wa = pose.walkAmt ?? 0;
  const sway = (k: number) => noise1(t * 0.8 + k * 3.7, seed + k) * wind;
  const breath = Math.sin(t * 1.7 + seed) * 4;
  const bob = -Math.abs(Math.cos(wph)) * 14 * wa;
  // joints
  const hip: Pt = [0, lerp(-480, kind === 'teen' ? -110 : -300, sit) + bob];
  const legPts = (side: number): Pt[] => {
    const swing = Math.sin(wph) * 24 * wa * side;
    if (kind === 'teen' && sit > 0.5) {
      return side > 0 ? [hip, [150, -70], [-30, -40]] : [[hip[0] - 10, hip[1]], [120, -40], [-60, -20]];
    }
    const kneeStand = step(hip, 230, swing);
    const knee: Pt = [lerp(kneeStand[0], 200, sit), lerp(kneeStand[1], hip[1] - 10, sit)];
    const ankStand = step(knee, 225, swing - Math.max(0, Math.cos(wph) * side) * 30 * wa);
    const ank: Pt = [lerp(ankStand[0], 205, sit), lerp(ankStand[1], -25, sit)];
    return [hip, knee, ank];
  };
  const front = legPts(1), back = legPts(-1);
  const legColor = kind === 'teen' ? '#868B92' : kind === 'painter' ? '#5B4030' : skin;
  const foot = (p: Pt, c: string) => <ellipse cx={p[0] + 22} cy={p[1] + 8} rx={46} ry={20} fill={c} stroke={OUT} strokeWidth={10} />;
  const footColor = kind === 'teen' ? '#F2F2EE' : kind === 'painter' ? '#2B1F18' : skin;

  const leaves = kind === 'adam' ? LEAVES_ADAM : LEAVES_EVE;
  const lean = pose.lean ?? 0;
  const sh: Pt = [10, hip[1] - 310 + breath * 0.3];
  const armPts = (base: Pt, a: number, b: number): Pt[] => {
    const e = step(base, 165, a);
    return [base, e, step(e, 150, a + b)];
  };
  const fArm = armPts([sh[0] + 22, sh[1] + 18], pose.arm ?? 8, pose.bend ?? 10);
  const bArm = armPts([sh[0] - 30, sh[1] + 14], pose.backArm ?? -6, pose.backBend ?? 8);
  const sleeve = kind === 'jesus' ? '#EDE3CD' : kind === 'teen' ? '#D9A227' : kind === 'painter' ? '#EFE6D2' : skin;

  // head
  const head: Pt = [sh[0] + 14, sh[1] - 98];
  const blink = Math.max(face.blink ?? 0, autoBlink(t, seed));
  const eyeH = 14 * (1 - blink * 0.9) * (1 - (face.eyesDown ?? 0) * 0.35);
  const smile = face.smile ?? 0.35, open = face.open ?? 0, brow = face.brow ?? 0, furrow = face.furrow ?? 0, look = face.look ?? 0;
  const hx = head[0], hy = head[1];

  const torsoPath = `M${sh[0] - 74},${sh[1] + 6} Q${sh[0] + 4},${sh[1] - 26} ${sh[0] + 76},${sh[1] + 8} L${hip[0] + 70},${hip[1] - 30} Q${hip[0]},${hip[1] - 8} ${hip[0] - 70},${hip[1] - 30}Z`;
  const torsoFill = kind === 'jesus' ? '#EFE6D2' : kind === 'teen' ? '#D9A227' : kind === 'painter' ? '#EFE6D2' : leaves[1];

  // lower garment (leaf skirt to the knees, robe to the ankles, smock below the knee)
  const hemY = kind === 'jesus' ? -30 : kind === 'painter' ? -200 : -240;
  const skirt = (() => {
    if (kind === 'teen') return null;
    const k = front[1];
    if (kind === 'jesus' && sit > 0.3) {
      const a = front[2];
      return <path d={`M${hip[0] - 72},${hip[1] - 40} L${hip[0] - 80},${hip[1] + 40} L${k[0] + 40},${k[1] + 50} L${a[0] + 50},${a[1] - 10} L${a[0] - 40},${a[1] - 10} L${k[0] - 40},${k[1] + 60} L${hip[0] + 10},${hip[1] + 60}Z
        M${hip[0] - 72},${hip[1] - 40} L${k[0] + 40},${k[1] - 40} L${k[0] + 40},${k[1] + 50} L${hip[0] - 80},${hip[1] + 40}Z`} fill="#EFE6D2" stroke={OUT} strokeWidth={10} strokeLinejoin="round" />;
    }
    const flare = kind === 'jesus' ? 115 : 128;
    const top = hip[1] - 40;
    const n = 9;
    const hem: Pt[] = Array.from({length: n + 1}, (_, i) => {
      const u = i / n;
      const xx = -flare + u * flare * 2 + (k[0] - hip[0]) * 0.4;
      const tip = kind === 'eve' || kind === 'adam' ? (i % 2 ? 26 : -4) : 0;
      return [xx, hemY + tip + sway(i) * 4];
    });
    const fill = kind === 'jesus' ? '#EFE6D2' : kind === 'painter' ? '#E8DEC8' : leaves[0];
    return (
      <g>
        <path d={`M${-70},${top} L${70},${top} L${hem[n][0]},${hem[n][1]} ` + hem.slice().reverse().map((p) => `L${p[0]},${p[1]}`).join(' ') + 'Z'} fill={fill} stroke={OUT} strokeWidth={10} strokeLinejoin="round" />
        {(kind === 'eve' || kind === 'adam') && Array.from({length: 7}, (_, i) => (
          <Leaf key={i} x={-95 + i * 32} y={hemY + 18} L={150 + (i % 3) * 30} w={0.38} a={180 + (i - 3) * 6 + sway(i + 9) * 5} fill={leaves[(i + 1) % 4]} vein="rgba(255,255,230,0.25)" />
        ))}
        {(kind === 'eve' || kind === 'adam') && <path d={`M-72,${top + 8} Q0,${top + 26} 72,${top + 8}`} fill="none" stroke="#4A5E22" strokeWidth={14} strokeLinecap="round" />}
        {kind === 'jesus' && <path d={`M-68,${top + 10} Q0,${top + 28} 68,${top + 10}`} fill="none" stroke="#B89662" strokeWidth={12} />}
      </g>
    );
  })();

  const backHair = (kind === 'eve' || kind === 'jesus') && (
    <path d={kind === 'eve'
      ? `M${hx - 40},${hy - 80} Q${hx - 150 + sway(1) * 10},${hy + 40} ${hx - 120 + sway(2) * 14},${hy + 330} Q${hx - 90},${hy + 380} ${hx - 40 + sway(3) * 10},${hy + 350} Q${hx - 60},${hy + 200} ${hx - 10},${hy + 70}Z`
      : `M${hx - 40},${hy - 80} Q${hx - 130},${hy} ${hx - 105 + sway(2) * 8},${hy + 150} Q${hx - 60},${hy + 175} ${hx - 20},${hy + 120} L${hx},${hy + 40}Z`}
      fill={hair} stroke={OUT} strokeWidth={10} strokeLinejoin="round" />
  );
  const eye = (ex: number, ey: number, rx: number) => (
    <g>
      <ellipse cx={ex + look * 3} cy={ey} rx={rx} ry={Math.max(1.5, eyeH)} fill="#24150E" />
      {eyeH > 6 && <circle cx={ex + look * 3 + rx * 0.35} cy={ey - eyeH * 0.35} r={rx * 0.32} fill="#fff" />}
    </g>
  );
  const browPath = (bx: number, len: number, inner: number) => {
    const by = hy - 32 - brow * 9;
    return `M${bx - len / 2},${by + (inner < 0 ? -furrow * 12 : 0)} L${bx + len / 2},${by + (inner > 0 ? -furrow * 12 : 0)}`;
  };
  const mouthY = hy + 48;
  const mouth = open > 0.06
    ? <ellipse cx={hx + 60} cy={mouthY + 2} rx={13 + smile * 3} ry={4 + open * 13} fill="#4A1F1A" />
    : <path d={`M${hx + 42},${mouthY} Q${hx + 60},${mouthY + smile * 16} ${hx + 78},${mouthY - 2}`} fill="none" stroke="#5A2A20" strokeWidth={6} strokeLinecap="round" />;

  const hairTop = (() => {
    if (kind === 'eve') return <path d={`M${hx - 92},${hy + 10} Q${hx - 96},${hy - 96} ${hx},${hy - 100} Q${hx + 96},${hy - 96} ${hx + 98},${hy - 34} Q${hx + 40},${hy - 70} ${hx - 6},${hy - 40} Q${hx - 40},${hy - 10} ${hx - 50},${hy + 40}Z`} fill={hair} stroke={OUT} strokeWidth={10} strokeLinejoin="round" />;
    if (kind === 'jesus') return <path d={`M${hx - 92},${hy + 30} Q${hx - 98},${hy - 98} ${hx + 2},${hy - 100} Q${hx + 92},${hy - 96} ${hx + 92},${hy - 40} Q${hx + 30},${hy - 66} ${hx - 30},${hy - 36} Q${hx - 50},${hy + 10} ${hx - 52},${hy + 60}Z`} fill={hair} stroke={OUT} strokeWidth={10} strokeLinejoin="round" />;
    if (kind === 'adam' || kind === 'teen') {
      const bumps = Array.from({length: 9}, (_, i) => {
        const a = Math.PI * (0.95 + i * 0.13);
        return `${(hx + Math.cos(a) * 92).toFixed(1)},${(hy + Math.sin(a) * 92 - 10).toFixed(1)}`;
      });
      return <path d={`M${hx - 90},${hy + 10} ` + bumps.map((b, i) => `Q${b} ${(hx + Math.cos(Math.PI * (1.01 + i * 0.13)) * 96).toFixed(1)},${(hy + Math.sin(Math.PI * (1.01 + i * 0.13)) * 96 - 14).toFixed(1)}`).join(' ') + ` Q${hx + 40},${hy - 60} ${hx - 30},${hy - 40} Q${hx - 50},${hy} ${hx - 52},${hy + 30}Z`} fill={hair} stroke={OUT} strokeWidth={10} strokeLinejoin="round" />;
    }
    return <path d={`M${hx - 90},${hy + 20} Q${hx - 96},${hy - 30} ${hx - 70},${hy - 50} L${hx - 50},${hy + 30}Z`} fill={hair} stroke={OUT} strokeWidth={8} />;
  })();
  const beard = (kind === 'adam' || kind === 'jesus') && (
    <path d={`M${hx - 30},${hy + 20} Q${hx - 20},${hy + 96} ${hx + 40},${hy + 104} Q${hx + 92},${hy + 98} ${hx + 96},${hy + 36} Q${hx + 80},${hy + 60} ${hx + 60},${hy + 40} Q${hx + 30},${hy + 62} ${hx + 14},${hy + 30}Z`}
      fill={hair} stroke={OUT} strokeWidth={8} strokeLinejoin="round" />
  );
  const holdAt = (pts: Pt[], node?: React.ReactNode) => node && <g transform={`translate(${pts[2][0]},${pts[2][1]})`}>{node}</g>;

  return (
    <g transform={`translate(${x},${y}) scale(${flip ? -s : s},${s})`} opacity={opacity}>
      <ellipse cx={30} cy={6} rx={170} ry={26} fill="rgba(30,30,10,0.28)" />
      {/* back leg + back arm */}
      <Limb pts={back} w={kind === 'teen' ? 66 : 50} color={kind === 'jesus' ? '#E4D8C0' : legColor} />
      {sit < 0.5 && foot(back[2], footColor)}
      <g transform={`rotate(${lean} ${hip[0]} ${hip[1]})`}>
        <Limb pts={bArm} w={kind === 'jesus' || kind === 'teen' ? 48 : 40} color={kind === 'jesus' ? '#E4D8C0' : kind === 'teen' ? '#C9921F' : sleeve} />
        <circle cx={bArm[2][0]} cy={bArm[2][1]} r={24} fill={skin} stroke={OUT} strokeWidth={9} />
        {holdAt(bArm, backHold)}
        {backHair}
      </g>
      <Limb pts={front} w={kind === 'teen' ? 66 : 52} color={kind === 'jesus' ? '#EFE6D2' : legColor} />
      {foot(front[2], footColor)}
      {kind === 'teen' && sit > 0.5 && foot(back[2], footColor)}
      {skirt}
      <g transform={`rotate(${lean} ${hip[0]} ${hip[1]})`}>
        <path d={torsoPath} fill={torsoFill} stroke={OUT} strokeWidth={10} strokeLinejoin="round" />
        {(kind === 'eve' || kind === 'adam') && [[-40, sh[1] + 70, -20], [20, sh[1] + 60, 15], [-10, sh[1] + 160, -5], [40, sh[1] + 170, 25], [-50, sh[1] + 220, -30]].map(([lx, ly, la], i) => (
          <Leaf key={i} x={lx} y={ly + 90} L={130} w={0.5} a={la + sway(i + 20) * 4} fill={leaves[(i + 2) % 4]} vein="rgba(255,255,230,0.22)" />
        ))}
        {(kind === 'eve' || kind === 'adam') && [-1, 1].map((d) => <Leaf key={d} x={sh[0] + d * 52} y={sh[1] + 60} L={110} w={0.55} a={d * 70} fill={leaves[3]} />)}
        {kind === 'jesus' && <path d={`M${sh[0] + 60},${sh[1]} Q${sh[0] + 10},${sh[1] + 140} ${hip[0] - 66},${hip[1] - 40} L${hip[0] - 70},${hip[1] - 120} Q${sh[0] - 50},${sh[1] + 60} ${sh[0] - 20},${sh[1] - 8}Z`} fill="#7A5232" stroke={OUT} strokeWidth={9} strokeLinejoin="round" />}
        {kind === 'painter' && ['#C0392B', '#2E7D4F', '#E0A93B', '#3B5BA5'].map((c, i) => <circle key={c} cx={-30 + i * 22} cy={sh[1] + 120 + (i % 2) * 40} r={9} fill={c} />)}
        {kind === 'teen' && <path d={`M${sh[0] - 70},${sh[1] - 4} Q${sh[0] - 40},${sh[1] - 70} ${sh[0] + 30},${sh[1] - 30}`} fill="none" stroke="#C9921F" strokeWidth={34} strokeLinecap="round" />}
        {/* neck + head */}
        <path d={`M${sh[0] - 6},${sh[1] - 30} L${sh[0] - 2},${sh[1] + 10} L${sh[0] + 42},${sh[1] + 10} L${sh[0] + 40},${sh[1] - 30}Z`} fill={skin} stroke={OUT} strokeWidth={9} />
        <g transform={`rotate(${pose.head ?? 0} ${hx} ${hy + 70})`}>
          <path d={`M${hx - 88},${hy} Q${hx - 90},${hy - 96} ${hx},${hy - 96} Q${hx + 88},${hy - 96} ${hx + 92},${hy - 10} L${hx + 100},${hy + 4} Q${hx + 112},${hy + 22} ${hx + 98},${hy + 26} Q${hx + 94},${hy + 72} ${hx + 50},${hy + 88} Q${hx},${hy + 100} ${hx - 50},${hy + 70} Q${hx - 92},${hy + 46} ${hx - 88},${hy}Z`}
            fill={skin} stroke={OUT} strokeWidth={10} strokeLinejoin="round" />
          <ellipse cx={hx - 30} cy={hy + 10} rx={16} ry={24} fill={skin} stroke={OUT} strokeWidth={8} />
          <circle cx={hx + 52} cy={hy + 30} r={18} fill="#E07A6A" opacity={0.25} />
          {eye(hx + 42, hy - 4, 10)}
          {eye(hx + 84, hy - 6, 7)}
          <path d={browPath(hx + 42, 34, -1)} stroke={kind === 'painter' ? '#DDD9D2' : '#24150E'} strokeWidth={7} strokeLinecap="round" />
          <path d={browPath(hx + 84, 22, 1)} stroke={kind === 'painter' ? '#DDD9D2' : '#24150E'} strokeWidth={6} strokeLinecap="round" />
          {mouth}
          {beard}
          {kind === 'painter' && <path d={`M${hx + 40},${hy + 34} Q${hx + 66},${hy + 26} ${hx + 92},${hy + 40} Q${hx + 70},${hy + 46} ${hx + 64},${hy + 40} Q${hx + 52},${hy + 52} ${hx + 36},${hy + 46}Z`} fill="#F4F2EE" stroke={OUT} strokeWidth={6} />}
          {hairTop}
          {kind === 'painter' && <path d={`M${hx - 90},${hy - 70} Q${hx - 10},${hy - 150} ${hx + 90},${hy - 86} Q${hx + 30},${hy - 60} ${hx - 90},${hy - 52}Z`} fill="#B0302A" stroke={OUT} strokeWidth={9} />}
          {kind === 'eve' && [0, 1, 2, 3, 4].map((i) => <ellipse key={i} cx={hx - 46 + Math.cos(i * 1.256) * 14} cy={hy - 78 + Math.sin(i * 1.256) * 14} rx={11} ry={7} transform={`rotate(${i * 72} ${hx - 46 + Math.cos(i * 1.256) * 14} ${hy - 78 + Math.sin(i * 1.256) * 14})`} fill="#FFFDF6" stroke={OUT} strokeWidth={3} />)}
          {kind === 'eve' && <circle cx={hx - 46} cy={hy - 78} r={6} fill="#F2C14E" />}
        </g>
        <Limb pts={fArm} w={kind === 'jesus' || kind === 'teen' ? 50 : 42} color={sleeve} />
        <circle cx={fArm[2][0]} cy={fArm[2][1]} r={25} fill={skin} stroke={OUT} strokeWidth={9} />
        {holdAt(fArm, hold)}
      </g>
    </g>
  );
};

// Emerald-and-gold serpent along a polyline track; head at the end of the visible part.
export const Serpent: React.FC<{track: Pt[]; head: number; length: number; t: number; w?: number; open?: number; tongue?: number; wave?: number; opacity?: number}> = ({
  track, head, length, t, w = 34, open = 0, tongue = 0, wave = 10, opacity = 1,
}) => {
  const seglen = track.slice(1).map((p, i) => Math.hypot(p[0] - track[i][0], p[1] - track[i][1]));
  const total = seglen.reduce((a, b) => a + b, 0);
  const at = (d: number): Pt => {
    let r = Math.max(0, Math.min(total, d));
    for (let i = 0; i < seglen.length; i++) {
      if (r <= seglen[i]) {
        const k = r / seglen[i];
        return [track[i][0] + (track[i + 1][0] - track[i][0]) * k, track[i][1] + (track[i + 1][1] - track[i][1]) * k];
      }
      r -= seglen[i];
    }
    return track[track.length - 1];
  };
  const hd = head * total, tl = hd - length * total;
  const N = 60;
  const pts: Pt[] = Array.from({length: N}, (_, i) => {
    const d = tl + ((hd - tl) * i) / (N - 1);
    const p = at(d), q = at(d + 4);
    const nx = -(q[1] - p[1]), ny = q[0] - p[0];
    const nl = Math.hypot(nx, ny) || 1;
    const amp = Math.sin((i / N) * Math.PI) * wave * Math.sin(i * 0.35 - t * 5);
    return [p[0] + (nx / nl) * amp, p[1] + (ny / nl) * amp];
  });
  const chunks = 6;
  const body = Array.from({length: chunks}, (_, c) => {
    const a = Math.floor((c * (N - 1)) / chunks), b = Math.floor(((c + 1) * (N - 1)) / chunks) + 1;
    const ww = w * (0.35 + 0.65 * Math.min(1, (c + 1) / 3.2));
    return {pts: pts.slice(a, b + 1), w: ww};
  });
  const hp = pts[N - 1], hq = pts[N - 4];
  const ang = (Math.atan2(hp[1] - hq[1], hp[0] - hq[0]) * 180) / Math.PI;
  const flick = Math.max(0, Math.sin(t * 20)) * tongue;
  return (
    <g opacity={opacity}>
      {body.map((b, i) => <path key={'o' + i} d={path(b.pts, false)} fill="none" stroke="#173F21" strokeWidth={b.w + 10} strokeLinecap="round" strokeLinejoin="round" />)}
      {body.map((b, i) => <path key={'g' + i} d={path(b.pts, false)} fill="none" stroke="#2F7A3A" strokeWidth={b.w} strokeLinecap="round" strokeLinejoin="round" />)}
      {body.map((b, i) => <path key={'y' + i} d={path(b.pts, false)} fill="none" stroke="#E2B43C" strokeWidth={b.w * 0.82} strokeDasharray={`${w * 0.55} ${w * 0.75}`} strokeDashoffset={-i * 7} />)}
      {body.map((b, i) => <path key={'h' + i} d={path(b.pts, false)} fill="none" stroke="rgba(255,250,200,0.35)" strokeWidth={b.w * 0.16} transform="translate(0,-6)" />)}
      <g transform={`translate(${hp[0]},${hp[1]}) rotate(${ang})`}>
        {tongue > 0 && <path d={`M40,${4} L${66 + flick * 26},4 M${60 + flick * 26},4 l10,-7 M${60 + flick * 26},4 l10,7`} stroke="#C2334A" strokeWidth={4} fill="none" strokeLinecap="round" />}
        <path d={`M-14,10 Q18,${22 + open * 16} 50,${8 + open * 8} L44,4Z`} fill="#E9C978" stroke="#173F21" strokeWidth={6} />
        <path d={`M-18,-20 Q20,-28 54,-2 Q30,8 -16,14Z`} fill="#2F7A3A" stroke="#173F21" strokeWidth={7} strokeLinejoin="round" />
        <path d={`M-6,-14 Q16,-18 34,-8`} stroke="#E2B43C" strokeWidth={5} fill="none" opacity={0.8} />
        <ellipse cx={22} cy={-9} rx={8} ry={5} fill="#F2C531" stroke="#173F21" strokeWidth={3} />
        <rect x={21} y={-13} width={3} height={8} fill="#0B0B08" />
        <path d={`M10,-19 L32,-14`} stroke="#173F21" strokeWidth={5} strokeLinecap="round" />
        <path d={`M26,6 Q40,8 50,0`} stroke="#173F21" strokeWidth={3} fill="none" />
      </g>
    </g>
  );
};

// The tempter: only a tall, faceless hooded shadow (no face, no horns).
export const Shadow: React.FC<{x: number; y: number; h: number; lean?: number; point?: number; t: number; opacity?: number}> = ({x, y, h, lean = 0, point = 0, t, opacity = 1}) => {
  const s = h / 1000;
  const arm: Pt[] = [[-40, -760], [-40 - 170 * point - 60, -600 + 40 * point], [-80 - 290 * point, -430 + 140 * point]];
  return (
    <g transform={`translate(${x},${y}) scale(${s}) rotate(${lean} 0 0)`} opacity={opacity}>
      <defs>
        <linearGradient id="cloak" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3A2E4A" />
          <stop offset="0.7" stopColor="#201828" />
          <stop offset="1" stopColor="#201828" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={`M-30,-1000 Q90,-1010 110,-860 Q130,-760 160,-520 Q200,-200 230,0 L-210,0 Q-170,-260 -140,-520 Q-120,-780 -110,-860 Q-110,-990 -30,-1000Z`} fill="url(#cloak)" />
      <path d={`M-30,-1000 Q90,-1010 110,-860 Q130,-760 160,-520`} fill="none" stroke="#8A6BB8" strokeWidth={8} opacity={0.55} />
      <ellipse cx={-14} cy={-860} rx={60} ry={78} fill="#050308" />
      <path d={path(arm, false)} fill="none" stroke="#2A2134" strokeWidth={46} strokeLinecap="round" strokeLinejoin="round" />
      <path d={`M${arm[2][0]},${arm[2][1]} l-40,30 M${arm[2][0]},${arm[2][1]} l-46,8 M${arm[2][0]},${arm[2][1]} l-28,40`} stroke="#2A2134" strokeWidth={12} strokeLinecap="round" />
      {[0, 1, 2, 3, 4].map((i) => (
        <ellipse key={i} cx={-180 + i * 95 + noise1(t * 0.7 + i, 3) * 30} cy={-30 - ((t * 60 + i * 50) % 160)} rx={60} ry={34} fill="#2A2134" opacity={0.35 * (1 - ((t * 60 + i * 50) % 160) / 160)} />
      ))}
    </g>
  );
};
