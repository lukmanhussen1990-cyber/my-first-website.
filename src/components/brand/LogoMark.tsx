import { useId } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

/**
 * The Last Mile mark: a road converging toward a sunset sun rising between two
 * hills, under a night-to-violet sky.
 *
 * Geometry is authored on a 1024 canvas and is identical to the icon sources
 * in `assets/brand/` (`icon.svg` for `full`, `splash-icon.svg` for `glyph`) —
 * change both together and re-run `node scripts/generate-brand-assets.mjs`.
 */

export type LogoMarkVariant = 'full' | 'glyph';

export interface LogoMarkProps {
  /** Width and height in dp. */
  size: number;
  /**
   * `full` — the app icon: the whole scene in a rounded square.
   * `glyph` — just the sun, horizon and road on a transparent background.
   */
  variant?: LogoMarkVariant;
  style?: StyleProp<ViewStyle>;
  /** When set the mark is announced as an image; otherwise it's decorative and hidden from screen readers. */
  accessibilityLabel?: string;
}

/** iOS-style corner radius for the `full` tile (fraction of the size). */
export const LOGO_CORNER_RATIO = 0.2237;

const CANVAS = 1024;
/** Square crop around the glyph (halo top → faded road end), centred on the sun's base. */
const GLYPH_VIEWBOX = '172 262 680 680';

const SUN = 'M290 612A222 222 0 0 1 734 612Z';
const HALO = { x: 218, y: 318, width: 588, height: 294 } as const;
const HORIZON = { x: 182, y: 609, width: 660, height: 6, rx: 3 } as const;
const GROUND =
  'M0 544C110 504 232 522 322 576C348 593 366 606 386 612L638 612C658 606 678 594 704 577C798 518 914 494 1024 528V1024H0Z';
const HILL_RIM =
  'M0 544C110 504 232 522 322 576C348 593 366 606 386 612M1024 528C914 494 798 518 704 577C678 594 658 606 638 612';
const ROAD = 'M503 612L521 612L904 1024L120 1024Z';
const ROAD_EDGES = 'M503 612L120 1024L156 1024L505.5 612ZM521 612L904 1024L868 1024L518.5 612Z';
const ROAD_DASHES =
  'M497.25 949.7L526.75 949.7L530 1024L494 1024Z' +
  'M503.71 801.86L520.29 801.86L522.78 858.71L501.22 858.71Z' +
  'M506.23 744.05L517.77 744.05L518.87 769.25L505.13 769.25Z' +
  'M507.58 713.23L516.42 713.23L517.04 727.41L506.96 727.41Z' +
  'M508.41 694.07L515.59 694.07L515.98 703.15L508.02 703.15Z' +
  'M508.98 681.01L515.02 681.01L515.29 687.32L508.71 687.32Z';
const SPARKLES = [
  { d: 'M236 176Q242.08 207.92 274 214Q242.08 220.08 236 252Q229.92 220.08 198 214Q229.92 207.92 236 176Z', opacity: 1 },
  { d: 'M792 146Q795.52 164.48 814 168Q795.52 171.52 792 190Q788.48 171.52 770 168Q788.48 164.48 792 146Z', opacity: 0.9 },
] as const;
const STAR_DOT = { cx: 372, cy: 120, r: 7, opacity: 0.7 } as const;

type StopSpec = readonly [offset: number, color: string, opacity?: number];

type GradientSpec =
  | { kind: 'linear'; x1: number; y1: number; x2: number; y2: number; stops: readonly StopSpec[] }
  | { kind: 'radial'; cx: number; cy: number; r: number; stops: readonly StopSpec[] };

/** Brand artwork colours (the mark is imagery, so it doesn't follow the light/dark tokens). */
const GRADIENTS = {
  sky: { kind: 'linear', x1: 0, y1: 0, x2: 0, y2: 612, stops: [[0, '#0B1230'], [0.42, '#21177A'], [0.78, '#4C2FD1'], [1, '#7C5CFF']] },
  glow: { kind: 'radial', cx: 512, cy: 612, r: 520, stops: [[0, '#FF5E8A', 0.7], [0.38, '#FF5E8A', 0.24], [1, '#FF5E8A', 0]] },
  halo: { kind: 'radial', cx: 512, cy: 612, r: 294, stops: [[0.74, '#FFB35C', 0.5], [1, '#FF8A3D', 0]] },
  sun: { kind: 'linear', x1: 0, y1: 390, x2: 0, y2: 612, stops: [[0, '#FFC56B'], [0.45, '#FF8A3D'], [1, '#FF5E8A']] },
  ground: { kind: 'linear', x1: 0, y1: 490, x2: 0, y2: 1024, stops: [[0, '#261C78'], [0.3, '#1B1663'], [0.62, '#10133C'], [1, '#080C20']] },
  rim: { kind: 'radial', cx: 512, cy: 612, r: 560, stops: [[0.2, '#FF8A7A', 0.95], [0.55, '#A78BFA', 0.55], [1, '#7C5CFF', 0.15]] },
  road: { kind: 'linear', x1: 0, y1: 612, x2: 0, y2: 1024, stops: [[0, '#FF8A7A'], [0.22, '#8A44D6'], [0.65, '#34288A'], [1, '#1D1C5C']] },
  edge: { kind: 'linear', x1: 0, y1: 612, x2: 0, y2: 1024, stops: [[0, '#22D3EE', 0.25], [0.35, '#22D3EE'], [1, '#7DEBFA']] },
  // Glyph: the road dissolves into whatever is behind it instead of running off the edge.
  roadFade: { kind: 'linear', x1: 0, y1: 612, x2: 0, y2: 885, stops: [[0, '#FF8A7A'], [0.3, '#8A44D6'], [0.62, '#4A32B0', 0.85], [1, '#2A2478', 0]] },
  edgeFade: { kind: 'linear', x1: 0, y1: 612, x2: 0, y2: 885, stops: [[0, '#22D3EE', 0.3], [0.4, '#22D3EE'], [0.7, '#22D3EE', 0.75], [1, '#22D3EE', 0]] },
  dashFade: { kind: 'linear', x1: 0, y1: 612, x2: 0, y2: 885, stops: [[0, '#FFFFFF'], [0.6, '#FFFFFF', 0.85], [1, '#FFFFFF', 0]] },
  horizon: { kind: 'linear', x1: 182, y1: 0, x2: 842, y2: 0, stops: [[0, '#FF5E8A', 0], [0.3, '#FF7A7A'], [0.7, '#FF7A7A'], [1, '#FF5E8A', 0]] },
} as const satisfies Record<string, GradientSpec>;

type GradientName = keyof typeof GRADIENTS;

const FULL_GRADIENTS: readonly GradientName[] = ['sky', 'glow', 'halo', 'sun', 'ground', 'rim', 'road', 'edge'];
const GLYPH_GRADIENTS: readonly GradientName[] = ['halo', 'horizon', 'sun', 'roadFade', 'edgeFade', 'dashFade'];

function GradientDef({ id, spec }: { id: string; spec: GradientSpec }) {
  const stops = spec.stops.map(([offset, color, opacity = 1]) => (
    <Stop key={offset} offset={offset} stopColor={color} stopOpacity={opacity} />
  ));
  if (spec.kind === 'radial') {
    return (
      <RadialGradient id={id} cx={spec.cx} cy={spec.cy} r={spec.r} gradientUnits="userSpaceOnUse">
        {stops}
      </RadialGradient>
    );
  }
  return (
    <LinearGradient id={id} x1={spec.x1} y1={spec.y1} x2={spec.x2} y2={spec.y2} gradientUnits="userSpaceOnUse">
      {stops}
    </LinearGradient>
  );
}

/** Brand mark rendered with react-native-svg; matches the app icon exactly. */
export function LogoMark({ size, variant = 'full', style, accessibilityLabel }: LogoMarkProps) {
  // Gradient ids must be unique per instance: on web every <svg> shares one DOM id namespace.
  const prefix = `logo-${useId().replace(/[^\w-]/g, '')}`;
  const id = (name: string) => `${prefix}-${name}`;
  const fill = (name: GradientName) => `url(#${id(name)})`;
  const isFull = variant === 'full';

  const a11y = accessibilityLabel
    ? { accessible: true, accessibilityRole: 'image' as const, accessibilityLabel }
    : { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const };

  return (
    <Svg
      width={size}
      height={size}
      viewBox={isFull ? `0 0 ${CANVAS} ${CANVAS}` : GLYPH_VIEWBOX}
      style={style}
      {...a11y}
    >
      <Defs>
        {(isFull ? FULL_GRADIENTS : GLYPH_GRADIENTS).map((name) => (
          <GradientDef key={name} id={id(name)} spec={GRADIENTS[name]} />
        ))}
        {isFull ? (
          <ClipPath id={id('tile')}>
            <Rect width={CANVAS} height={CANVAS} rx={CANVAS * LOGO_CORNER_RATIO} />
          </ClipPath>
        ) : null}
      </Defs>

      {isFull ? (
        <G clipPath={`url(#${id('tile')})`}>
          <Rect width={CANVAS} height={CANVAS} fill={fill('sky')} />
          <Rect width={CANVAS} height={612} fill={fill('glow')} />
          {SPARKLES.map((star) => (
            <Path key={star.d} d={star.d} fill="#FFFFFF" fillOpacity={star.opacity} />
          ))}
          <Circle cx={STAR_DOT.cx} cy={STAR_DOT.cy} r={STAR_DOT.r} fill="#FFFFFF" fillOpacity={STAR_DOT.opacity} />
          <Rect {...HALO} fill={fill('halo')} />
          <Path d={SUN} fill={fill('sun')} />
          <Path d={GROUND} fill={fill('ground')} />
          <Path d={HILL_RIM} fill="none" stroke={fill('rim')} strokeWidth={5} strokeLinecap="round" />
          <Path d={ROAD} fill={fill('road')} />
          <Path d={ROAD_EDGES} fill={fill('edge')} />
          <Path d={ROAD_DASHES} fill="#FFFFFF" />
        </G>
      ) : (
        <G>
          <Rect {...HALO} fill={fill('halo')} />
          <Rect {...HORIZON} fill={fill('horizon')} />
          <Path d={SUN} fill={fill('sun')} />
          <Path d={ROAD} fill={fill('roadFade')} />
          <Path d={ROAD_EDGES} fill={fill('edgeFade')} />
          <Path d={ROAD_DASHES} fill={fill('dashFade')} />
        </G>
      )}
    </Svg>
  );
}
