import {rand} from './random';

export const OUT = '#3B2416';
export type Pt = [number, number];
export const path = (pts: Pt[], close = true) => 'M' + pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L') + (close ? 'Z' : '');

// Faceted low-poly blob: a jittered ring fanned to a centre, each triangle shaded by how much it faces the light.
export const FacetBlob: React.FC<{cx: number; cy: number; rx: number; ry: number; seed: number; colors: string[]; n?: number; light?: number; opacity?: number; stroke?: string}> = ({
  cx, cy, rx, ry, seed, colors, n = 11, light = -2.3, opacity = 1, stroke,
}) => {
  const ring: Pt[] = Array.from({length: n}, (_, i) => {
    const a = (i / n) * Math.PI * 2 + rand(seed, i) * 0.3;
    const r = 0.82 + rand(seed, i + 50) * 0.3;
    return [cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r];
  });
  const c: Pt = [cx + (rand(seed, 99) - 0.5) * rx * 0.3, cy + (rand(seed, 98) - 0.5) * ry * 0.3];
  return (
    <g opacity={opacity}>
      {ring.map((p, i) => {
        const q = ring[(i + 1) % n];
        const a = Math.atan2((p[1] + q[1]) / 2 - cy, (p[0] + q[0]) / 2 - cx);
        const k = (Math.cos(a - light) + 1) / 2;
        const col = colors[Math.min(colors.length - 1, Math.floor(k * colors.length * 0.999 + rand(seed, i + 7) * 0.6))];
        return <path key={i} d={path([c, p, q])} fill={col} stroke={stroke ?? col} strokeWidth={stroke ? 3 : 1} strokeLinejoin="round" />;
      })}
    </g>
  );
};

// Pointed leaf at (x,y), length L, rotated a degrees (0 = pointing up).
export const Leaf: React.FC<{x: number; y: number; L: number; w?: number; a?: number; fill: string; vein?: string; outline?: boolean}> = ({x, y, L, w = 0.42, a = 0, fill, vein, outline}) => (
  <g transform={`translate(${x},${y}) rotate(${a})`}>
    <path d={`M0,0 Q${L * w},${-L * 0.45} 0,${-L} Q${-L * w},${-L * 0.45} 0,0Z`} fill={fill} stroke={outline ? OUT : 'none'} strokeWidth={outline ? 6 : 0} strokeLinejoin="round" />
    <path d={`M0,0 Q${L * w * 0.5},${-L * 0.45} 0,${-L}Z`} fill="rgba(0,0,0,0.12)" />
    {vein && <path d={`M0,-2 L0,${-L * 0.85}`} stroke={vein} strokeWidth={L * 0.03} />}
  </g>
);

export const Glow: React.FC<{x: number; y: number; r: number; color?: string; o?: number}> = ({x, y, r, color = '255,214,130', o = 1}) => (
  <circle cx={x} cy={y} r={r} fill={`url(#glow-${color.replace(/,/g, '-')})`} opacity={o}>
    <title>glow</title>
  </circle>
);
export const GlowDefs: React.FC<{colors: string[]}> = ({colors}) => (
  <defs>
    {colors.map((c) => (
      <radialGradient key={c} id={`glow-${c.replace(/,/g, '-')}`}>
        <stop offset="0" stopColor={`rgb(${c})`} stopOpacity={1} />
        <stop offset="0.35" stopColor={`rgb(${c})`} stopOpacity={0.45} />
        <stop offset="1" stopColor={`rgb(${c})`} stopOpacity={0} />
      </radialGradient>
    ))}
  </defs>
);

// Camera for a flat world: layer depth d (0 = sky, 1 = subject plane, >1 = foreground) gives parallax.
export type Cam2 = {x: number; y: number; zoom: number};
export const layerTransform = (cam: Cam2, d: number) => {
  const z = 1 + (cam.zoom - 1) * d;
  return `translate(540px, 960px) scale(${z}) translate(${-540 - cam.x * d}px, ${-960 - cam.y * d}px)`;
};
export const Layer: React.FC<{cam: Cam2; d: number; children: React.ReactNode; style?: React.CSSProperties}> = ({cam, d, children, style}) => (
  <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transformOrigin: '0 0', transform: layerTransform(cam, d), ...style}}>
    <svg width={1080} height={1920} style={{overflow: 'visible', position: 'absolute', left: 0, top: 0}}>{children}</svg>
  </div>
);
// screen position of a world point on layer depth d
export const toScreen = (cam: Cam2, d: number, x: number, y: number): Pt => {
  const z = 1 + (cam.zoom - 1) * d;
  return [540 + (x - 540 - cam.x * d) * z, 960 + (y - 960 - cam.y * d) * z];
};
