// Grace in Motion mark: a ring, an open book, and light rising from its pages.
export const GOLD = '#F2B544';
export const Logo: React.FC<{size: number; draw?: number; color?: string; stroke?: number}> = ({size, draw = 1, color = GOLD, stroke = 2.4}) => {
  const L = 140; // path length budget for dash drawing
  const dash = (k: number) => ({strokeDasharray: L, strokeDashoffset: L * (1 - Math.min(1, Math.max(0, draw * 1.6 - k * 0.3)))});
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" style={{overflow: 'visible'}}>
      <g fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="24" cy="24" r="21" style={dash(0)} />
        <path d="M9 32 C15 29 20 29.5 24 33 C28 29.5 33 29 39 32" style={dash(1)} />
        <path d="M9 32 L9 25 C15 22 20 22.5 24 26 C28 22.5 33 22 39 25 L39 32" style={dash(1.4)} />
        <path d="M24 26 L24 33" style={dash(1.8)} />
        <path d="M24 19 L24 12 M18.5 20.5 L15.5 15.5 M29.5 20.5 L32.5 15.5" style={dash(2.2)} />
      </g>
    </svg>
  );
};
