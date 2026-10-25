import { clamp } from "../lib/math";
import { BRAND } from "./brand";

// Our mark: a slim gold cross with three short motion lines on its left, each shorter than the last.
// `draw` 0..1 animates it drawing itself (end card).

export const Logo: React.FC<{ size: number; color?: string; draw?: number; glow?: number }> = ({ size, color = BRAND.gold, draw = 1, glow = 0 }) => {
  const k = (a: number, b: number) => clamp((draw - a) / (b - a));
  const stroke = 6.5;
  const line = (len: number, x1: number, y1: number, x2: number, y2: number, p: number) => (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeDasharray={len}
      strokeDashoffset={len * (1 - p)}
    />
  );
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ overflow: "visible", filter: glow ? `drop-shadow(0 0 ${8 * glow}px ${color})` : undefined }}>
      {/* cross */}
      {line(78, 62, 11, 62, 89, k(0, 0.45))}
      {line(40, 44, 32, 80, 32, k(0.3, 0.6))}
      {/* motion lines, each shorter than the last */}
      {line(24, 38, 48, 14, 48, k(0.55, 0.75))}
      {line(18, 38, 60, 20, 60, k(0.65, 0.85))}
      {line(12, 38, 72, 26, 72, k(0.75, 1))}
    </svg>
  );
};
