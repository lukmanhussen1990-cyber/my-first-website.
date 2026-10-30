// Flat kit additions (The Priest Who Found the Beginning): chalkboard, banner,
// galaxies, glow point, observatory, telescope, lens view, radio mic, horn
// antenna, pigeon, broom, static lines, sky map, letter, window + lamp, old
// Bible, domino, label box, planet and the evidence pill row.
import React, {useId} from 'react';
import {random} from 'remotion';
import {C, OUTLINE} from './palette';
import {FONT_SERIF, FONT_UI} from './fonts';
import {clamp, pop, sid} from './anim';

const NS = {vectorEffect: 'non-scaling-stroke' as const};
const ink = (w = OUTLINE) => ({stroke: C.ink, strokeWidth: w, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const, ...NS});

/** Chalkboard on legs. `strokes` are SVG paths in board space (0..w, 0..h); `draw` 0..1 draws them on in order. Origin = ground centre. */
export const Chalkboard: React.FC<{x: number; y: number; w?: number; h?: number; strokes?: string[]; draw?: number; scale?: number; children?: React.ReactNode}> = ({
  x,
  y,
  w = 520,
  h = 330,
  strokes = [],
  draw = 1,
  scale = 1,
  children,
}) => {
  const n = strokes.length;
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      <line x1={-w / 2 + 40} y1={0} x2={-w / 2 + 70} y2={-h - 80} {...ink()} />
      <line x1={w / 2 - 40} y1={0} x2={w / 2 - 70} y2={-h - 80} {...ink()} />
      <g transform={`translate(${-w / 2},${-h - 120})`}>
        <rect x={-14} y={-14} width={w + 28} height={h + 28} rx={10} fill={C.wood} {...ink()} />
        <rect x={0} y={0} width={w} height={h} rx={4} fill="#3E5146" {...ink(3)} />
        {strokes.map((d, i) => {
          const p = clamp(draw * n - i);
          return p > 0 ? (
            <path key={i} d={d} fill="none" stroke="#F2EFE6" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={`${p} 1`} opacity={0.92} />
          ) : null;
        })}
        {children}
      </g>
    </g>
  );
};

/** Long cloth banner held up on two poles. Origin = centre of the cloth. */
export const Banner: React.FC<{x: number; y: number; w?: number; text: string; color?: string; wave?: number}> = ({x, y, w = 760, text, color = C.red, wave = 0}) => {
  const h = 110;
  const k = wave * 10;
  return (
    <g transform={`translate(${x},${y})`}>
      <path
        d={`M ${-w / 2} ${-h / 2} Q ${-w / 4} ${-h / 2 - k} 0 ${-h / 2} Q ${w / 4} ${-h / 2 + k} ${w / 2} ${-h / 2} L ${w / 2} ${h / 2} Q ${w / 4} ${h / 2 + k} 0 ${h / 2} Q ${-w / 4} ${h / 2 - k} ${-w / 2} ${h / 2} Z`}
        fill={C.cream}
        {...ink()}
      />
      <text x={0} y={18} textAnchor="middle" fontFamily={FONT_SERIF} fontWeight={900} fontSize={56} letterSpacing={3} fill={color}>
        {text}
      </text>
    </g>
  );
};

/** Flat spiral galaxy: curved arms with dots. */
export const FlatGalaxy: React.FC<{x: number; y: number; r?: number; rot?: number; color?: string; opacity?: number; seed?: string}> = ({x, y, r = 70, rot = 0, color = '#F3E6C8', opacity = 1, seed = 'g'}) => (
  <g transform={`translate(${x},${y}) rotate(${rot}) scale(1,0.62)`} opacity={opacity}>
    <circle r={r * 0.9} fill={color} opacity={0.12} />
    <circle r={r * 0.2} fill={color} />
    {[0, 1, 2].map((a) => {
      const pts = new Array(14).fill(0).map((_, i) => {
        const t = i / 13;
        const ang = a * 2.094 + t * 3.4;
        return [Math.cos(ang) * r * (0.18 + t * 0.85), Math.sin(ang) * r * (0.18 + t * 0.85)];
      });
      return (
        <g key={a}>
          <path d={`M ${pts.map((p) => p.join(' ')).join(' L ')}`} fill="none" stroke={color} strokeWidth={4} strokeLinecap="round" opacity={0.85} />
          {pts.filter((_, i) => i % 3 === 1).map(([px, py], i) => (
            <circle key={i} cx={px + (random(`${seed}${a}${i}`) - 0.5) * 8} cy={py} r={3.5} fill={color} />
          ))}
        </g>
      );
    })}
  </g>
);

/** Small glowing point of light. */
export const GlowPoint: React.FC<{x: number; y: number; r?: number; glow?: number}> = ({x, y, r = 10, glow = 1}) => {
  const id = sid(useId());
  return (
    <g>
      <defs>
        <radialGradient id={`gp${id}`}>
          <stop offset="0" stopColor="#FFF6DC" stopOpacity={1} />
          <stop offset="0.3" stopColor="#FFDB8A" stopOpacity={0.6} />
          <stop offset="1" stopColor="#FFC96A" stopOpacity={0} />
        </radialGradient>
      </defs>
      <circle cx={x} cy={y} r={r * 9 * glow} fill={`url(#gp${id})`} />
      <circle cx={x} cy={y} r={r} fill="#FFFBEF" />
    </g>
  );
};

/** Observatory dome on a base; `open` 0..1 opens the slit. Origin = ground centre. */
export const ObservatoryDome: React.FC<{x: number; y: number; open?: number; scale?: number}> = ({x, y, open = 0, scale = 1}) => (
  <g transform={`translate(${x},${y}) scale(${scale})`}>
    <rect x={-150} y={-200} width={300} height={200} fill="#D9D3C6" {...ink()} />
    <path d="M -170 -200 A 170 170 0 0 1 170 -200 Z" fill="#E9E4DA" {...ink()} />
    <path d={`M ${-30 - 40 * open} -364 L ${-30 - 40 * open} -205 L ${30 + 40 * open} -205 L ${30 + 40 * open} -364 Z`} fill="#2D2B45" opacity={0.2 + 0.8 * open} />
    <rect x={-40} y={-90} width={80} height={90} fill={C.woodDark} {...ink(OUTLINE * 0.8)} />
  </g>
);

/** Telescope tube on a tripod. `tilt` degrees. Origin = foot. */
export const Telescope: React.FC<{x: number; y: number; tilt?: number; scale?: number}> = ({x, y, tilt = -40, scale = 1}) => (
  <g transform={`translate(${x},${y}) scale(${scale})`}>
    <line x1={0} y1={-120} x2={-50} y2={0} {...ink()} />
    <line x1={0} y1={-120} x2={50} y2={0} {...ink()} />
    <line x1={0} y1={-120} x2={0} y2={0} {...ink()} />
    <g transform={`translate(0,-130) rotate(${tilt})`}>
      <rect x={-50} y={-22} width={220} height={44} rx={10} fill="#B9C3D3" {...ink()} />
      <rect x={160} y={-30} width={30} height={60} rx={6} fill="#8FA2BD" {...ink()} />
    </g>
  </g>
);

/** Round lens view with a dark sky inside; children drawn inside (clipped). */
export const LensView: React.FC<{x: number; y: number; r?: number; scale?: number; children?: React.ReactNode}> = ({x, y, r = 230, scale = 1, children}) => {
  const id = sid(useId());
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      <defs>
        <clipPath id={`lv${id}`}>
          <circle r={r} />
        </clipPath>
      </defs>
      <circle r={r} fill="#1F2140" />
      <g clipPath={`url(#lv${id})`}>{children}</g>
      <circle r={r} fill="none" stroke={C.ink} strokeWidth={14} {...NS} />
      <circle r={r - 10} fill="none" stroke="#9AA6BA" strokeWidth={4} {...NS} />
    </g>
  );
};

/** Old round radio microphone on a stand + ON AIR light. Origin = foot. */
export const RadioMic: React.FC<{x: number; y: number; onAir?: number; scale?: number}> = ({x, y, onAir = 1, scale = 1}) => (
  <g transform={`translate(${x},${y}) scale(${scale})`}>
    <line x1={0} y1={0} x2={0} y2={-300} {...ink()} />
    <ellipse cx={0} cy={0} rx={60} ry={14} fill="#7A7480" {...ink()} />
    <circle cx={0} cy={-340} r={46} fill="#C9CED6" {...ink()} />
    {[-20, 0, 20].map((d) => (
      <line key={d} x1={-34} y1={-340 + d} x2={34} y2={-340 + d} stroke={C.ink} strokeWidth={3} opacity={0.5} {...NS} />
    ))}
    <g transform="translate(0,-470)">
      <rect x={-90} y={-30} width={180} height={60} rx={10} fill={onAir > 0.5 ? '#D9483A' : '#6B3A36'} {...ink()} />
      <text x={0} y={12} textAnchor="middle" fontFamily={FONT_UI} fontWeight={600} fontSize={30} letterSpacing={3} fill="#FFF3E6">
        ON AIR
      </text>
    </g>
  </g>
);

/** Big horn antenna (Holmdel-style, flat). Origin = ground centre. */
export const HornAntenna: React.FC<{x: number; y: number; scale?: number}> = ({x, y, scale = 1}) => (
  <g transform={`translate(${x},${y}) scale(${scale})`}>
    <path d="M -240 0 L -200 -60 L 200 -60 L 240 0 Z" fill="#A99F91" {...ink()} />
    <path d="M -160 -60 L 120 -330 L 230 -260 L 120 -60 Z" fill="#E4DED2" {...ink()} />
    <path d="M 120 -330 L 230 -260 L 250 -300 L 150 -370 Z" fill="#CFC7B8" {...ink()} />
    <line x1={-60} y1={-60} x2={160} y2={-280} stroke={C.ink} strokeOpacity={0.3} strokeWidth={3} {...NS} />
  </g>
);

/** Flat pigeon with a 2-frame wing flap. */
export const Pigeon: React.FC<{x: number; y: number; frame: number; flap?: boolean; scale?: number; flip?: boolean}> = ({x, y, frame, flap = false, scale = 1, flip = false}) => {
  const up = flap && Math.floor(frame / 3) % 2 === 0;
  return (
    <g transform={`translate(${x},${y}) scale(${(flip ? -1 : 1) * scale},${scale})`}>
      <ellipse cx={0} cy={0} rx={34} ry={22} fill="#A7ABB8" {...ink(4)} />
      <circle cx={30} cy={-20} r={14} fill="#8E93A3" {...ink(4)} />
      <path d="M 43 -20 L 54 -16 L 43 -13" fill="#E3A24A" {...ink(2.5)} />
      <path d={up ? 'M -6 -6 L -30 -46 L 10 -10 Z' : 'M -6 -4 L -40 6 L 10 4 Z'} fill="#C3C7D1" {...ink(3.5)} />
      <line x1={-4} y1={20} x2={-6} y2={32} {...ink(3)} />
      <line x1={8} y1={20} x2={8} y2={32} {...ink(3)} />
    </g>
  );
};

/** Broom held at an angle. Origin = bristle centre. */
export const Broom: React.FC<{x: number; y: number; rotate?: number; scale?: number}> = ({x, y, rotate = 30, scale = 1}) => (
  <g transform={`translate(${x},${y}) rotate(${rotate}) scale(${scale})`}>
    <line x1={0} y1={-20} x2={0} y2={-220} stroke={C.woodDark} strokeWidth={10} strokeLinecap="round" />
    <path d="M -30 0 L -22 -26 L 22 -26 L 30 0 Z" fill="#E1C27A" {...ink(4)} />
  </g>
);

/** Wavy static lines radiating (the hiss). */
export const StaticLines: React.FC<{x: number; y: number; frame: number; opacity?: number; spread?: number}> = ({x, y, frame, opacity = 1, spread = 1}) => (
  <g opacity={opacity}>
    {new Array(6).fill(0).map((_, i) => {
      const t = ((frame + i * 9) % 54) / 54;
      const rr = 40 + t * 260 * spread;
      const amp = 6;
      let d = '';
      for (let k = 0; k <= 20; k++) {
        const a = -2.4 + (k / 20) * 1.6;
        const r2 = rr + Math.sin(k * 2.2 + frame * 0.6) * amp;
        d += `${k ? 'L' : 'M'} ${x + Math.cos(a) * r2} ${y + Math.sin(a) * r2} `;
      }
      return <path key={i} d={d} fill="none" stroke="#5F6B86" strokeWidth={4} strokeLinecap="round" opacity={1 - t} />;
    })}
  </g>
);

/** Oval sky map of soft orange/blue speckles (seeded). Origin = centre. */
export const SkyMapOval: React.FC<{x: number; y: number; w?: number; h?: number; reveal?: number; frame?: number}> = ({x, y, w = 760, h = 380, reveal = 1, frame = 0}) => {
  const id = sid(useId());
  const dots = [];
  for (let i = 0; i < 420; i++) {
    const a = random(`sm${i}`) * Math.PI * 2;
    const rr = Math.sqrt(random(`sr${i}`));
    const px = Math.cos(a) * rr * w * 0.5;
    const py = Math.sin(a) * rr * h * 0.5;
    const warm = random(`sw${i}`) > 0.5;
    const s = 6 + random(`ss${i}`) * 14;
    if (rr > reveal) continue;
    dots.push(<circle key={i} cx={px} cy={py} r={s * (0.9 + 0.1 * Math.sin(frame / 10 + i))} fill={warm ? '#F2A65A' : '#7FA3D6'} opacity={0.55} />);
  }
  return (
    <g transform={`translate(${x},${y})`}>
      <defs>
        <clipPath id={`sk${id}`}>
          <ellipse rx={w / 2} ry={h / 2} />
        </clipPath>
      </defs>
      <ellipse rx={w / 2} ry={h / 2} fill="#F6E7CF" />
      <g clipPath={`url(#sk${id})`}>{dots}</g>
      <ellipse rx={w / 2} ry={h / 2} fill="none" {...ink()} />
    </g>
  );
};

/** Folded letter with a gold seal. */
export const Letter: React.FC<{x: number; y: number; scale?: number; rotate?: number}> = ({x, y, scale = 1, rotate = 0}) => (
  <g transform={`translate(${x},${y}) rotate(${rotate}) scale(${scale})`}>
    <rect x={-80} y={-52} width={160} height={104} rx={8} fill={C.paper} {...ink(4)} />
    <path d="M -80 -52 L 0 10 L 80 -52" fill="none" {...ink(4)} />
    <circle cx={0} cy={10} r={13} fill={C.gold} {...ink(3)} />
  </g>
);

/** Night window with a warm lamp beside it. Origin = window centre. */
export const WindowLamp: React.FC<{x: number; y: number; frame: number; lamp?: number}> = ({x, y, frame, lamp = 1}) => (
  <g transform={`translate(${x},${y})`}>
    <rect x={-150} y={-190} width={300} height={380} rx={10} fill="#2C2B4F" {...ink()} />
    {[0, 1, 2, 3, 4].map((i) => (
      <circle key={i} cx={-110 + random(`wl${i}`) * 220} cy={-160 + random(`wly${i}`) * 300} r={3} fill="#FFFFFF" opacity={0.6 + 0.4 * Math.sin(frame / 20 + i)} />
    ))}
    <circle cx={70} cy={-90} r={38} fill={C.moon} stroke={C.moonLine} strokeWidth={3} {...NS} />
    <line x1={0} y1={-190} x2={0} y2={190} {...ink(4)} />
    <line x1={-150} y1={0} x2={150} y2={0} {...ink(4)} />
    <g transform="translate(260,150)" opacity={lamp}>
      <circle cx={0} cy={-120} r={140} fill="#FFD27A" opacity={0.25} />
      <line x1={0} y1={-90} x2={0} y2={60} {...ink()} />
      <path d="M -50 -90 L -30 -160 L 30 -160 L 50 -90 Z" fill="#F6D9A0" {...ink()} />
    </g>
  </g>
);

/** Open old Bible; `lines` glow word by word up to `lit` words. Origin = spine centre. */
export const OldBible: React.FC<{x: number; y: number; lines: string[]; lit: number; scale?: number; heading?: string}> = ({x, y, lines, lit, scale = 1, heading = 'GENESIS'}) => {
  let count = 0;
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      <path d="M -420 -250 Q -210 -280 0 -240 Q 210 -280 420 -250 L 420 250 Q 210 220 0 260 Q -210 220 -420 250 Z" fill="#7A4E36" {...ink()} />
      <path d="M -400 -235 Q -200 -262 0 -225 L 0 240 Q -200 205 -400 232 Z" fill="#F7EEDA" {...ink(4)} />
      <path d="M 400 -235 Q 200 -262 0 -225 L 0 240 Q 200 205 400 232 Z" fill="#F7EEDA" {...ink(4)} />
      <text x={-200} y={-170} textAnchor="middle" fontFamily={FONT_SERIF} fontWeight={900} fontSize={36} letterSpacing={6} fill={C.red}>
        {heading}
      </text>
      {lines.map((ln, li) => {
        const words = ln.split(' ');
        let cx = -380;
        return (
          <text key={li} x={-370} y={-100 + li * 62} fontFamily={FONT_SERIF} fontWeight={700} fontSize={36} fill={C.captionInk}>
            {words.map((wd, wi) => {
              const on = count++ < lit;
              cx += 1;
              return (
                <tspan key={wi} fill={on ? C.gold : '#8D8577'} fontWeight={on ? 900 : 700}>
                  {wd}
                  {wi < words.length - 1 ? ' ' : ''}
                </tspan>
              );
            })}
          </text>
        );
      })}
      {[0, 1, 2, 3].map((i) => (
        <line key={i} x1={40} y1={-150 + i * 70} x2={370} y2={-150 + i * 70} stroke="#D9CCB0" strokeWidth={8} strokeLinecap="round" />
      ))}
    </g>
  );
};

/** Domino block that tips over to the left by `fall` (0..1). Origin = bottom-left pivot. */
export const Domino: React.FC<{x: number; y: number; fall?: number; label?: string; h?: number}> = ({x, y, fall = 0, label, h = 200}) => (
  <g transform={`translate(${x},${y}) rotate(${-78 * clamp(fall) ** 1.6})`}>
    <rect x={0} y={-h} width={56} height={h} rx={8} fill={C.cream} {...ink()} />
    <circle cx={28} cy={-h * 0.72} r={7} fill={C.ink} />
    <circle cx={28} cy={-h * 0.3} r={7} fill={C.ink} />
    {label ? (
      <text x={28} y={-h - 16} textAnchor="middle" fontFamily={FONT_UI} fontWeight={600} fontSize={20} fill="#FFFFFF">
        {label}
      </text>
    ) : null}
  </g>
);

/** Dark labelled box (TIME / SPACE / MATTER). Origin = centre. */
export const LabelBox: React.FC<{x: number; y: number; w?: number; h?: number; text: string; scale?: number}> = ({x, y, w = 260, h = 260, text, scale = 1}) => (
  <g transform={`translate(${x},${y}) scale(${scale})`}>
    <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={16} fill="#2A2944" {...ink()} />
    <text x={0} y={14} textAnchor="middle" fontFamily={FONT_SERIF} fontWeight={900} fontSize={44} letterSpacing={3} fill="#C9C6DA">
      {text}
    </text>
  </g>
);

/** Flat planet with a band. */
export const Planet: React.FC<{x: number; y: number; r?: number; color?: string}> = ({x, y, r = 60, color = '#7FA3D6'}) => (
  <g transform={`translate(${x},${y})`}>
    <circle r={r} fill={color} {...ink(4)} />
    <path d={`M ${-r * 0.9} ${-r * 0.2} Q 0 ${r * 0.2} ${r * 0.9} ${-r * 0.25}`} fill="none" stroke="#FFFFFF" strokeOpacity={0.5} strokeWidth={6} />
  </g>
);

/** EVIDENCE row: 4 cream pills; filled ones turn gold with a check; the last unlocks as GOD. */
export const EvidenceRow: React.FC<{frame: number; fills: (number | null)[]; labels?: string[]; unlock?: number | null; y?: number; opacity?: number}> = ({
  frame,
  fills,
  labels = ['1927 · MATH', '1929 · TELESCOPE', '1965 · ECHO', '?'],
  unlock = null,
  y = 260,
  opacity = 1,
}) => {
  const ws = [190, 236, 196, 116];
  const xs = [194, 420, 648, 820];
  return (
    <g opacity={opacity}>
      <text x={510} y={y - 50} textAnchor="middle" fontFamily={FONT_UI} fontWeight={600} fontSize={20} letterSpacing={3} fill="#FFFFFF" opacity={0.75}>
        THE EVIDENCE
      </text>
      {labels.map((lab, i) => {
        const last = i === labels.length - 1;
        const at = last ? unlock : fills[i];
        const on = at !== null && at !== undefined && frame >= at;
        const p = on ? pop(frame, at as number, 10) : 0;
        const burst = on ? clamp((frame - (at as number)) / 20) : 1;
        const breathe = !on && last ? 1 + 0.06 * Math.sin(frame / 7) : 1;
        const w = last && on ? 150 : ws[i];
        const x = xs[i] + (last && on ? 18 : 0);
        return (
          <g key={i} transform={`translate(${x},${y}) scale(${breathe})`}>
            {on && burst < 1 ? <rect x={-w / 2 - 30 * burst} y={-26 - 30 * burst} width={w + 60 * burst} height={52 + 60 * burst} rx={26 + 30 * burst} fill="none" stroke={C.gold} strokeWidth={4} opacity={1 - burst} /> : null}
            {last && on && burst < 1 ? <circle r={60 + 160 * burst} fill="#FFE7AE" opacity={0.6 * (1 - burst)} /> : null}
            <rect x={-w / 2} y={-26} width={w} height={52} rx={26} fill={on ? C.gold : C.cream} {...ink(4)} transform={on ? `scale(${0.85 + 0.15 * p})` : undefined} />
            {!on && last ? <rect x={-w / 2} y={-26} width={w} height={52} rx={26} fill={C.gold} opacity={0.15 + 0.15 * Math.sin(frame / 7)} /> : null}
            <text x={on && !last ? 12 : 0} y={7} textAnchor="middle" fontFamily={last && on ? FONT_SERIF : FONT_UI} fontWeight={last && on ? 900 : 600} fontSize={last && on ? 30 : 18} letterSpacing={1} fill={on ? '#FFFFFF' : C.captionInk}>
              {last && on ? 'GOD' : last ? '🔒 ?' : lab}
            </text>
            {on && !last ? <path d={`M ${-w / 2 + 18} 0 l 7 7 l 12 -14`} fill="none" stroke="#FFFFFF" strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" /> : null}
          </g>
        );
      })}
    </g>
  );
};

