import { clamp, ease } from "../lib/math";
import { BRAND, measure, SAFE, SANS } from "./brand";

// Labels: a near-black tag with white caps and a thin 2 px leader line to a 3D point.
// The point is projected every frame with the same camera as the 3D render, so labels stick.
// The line draws first, then the tag wipes in.

export type LabelDef = { text: string; anchor: string; start: number; end: number };
export type Projected = { x: number; y: number; inFront: boolean } | null;

const FONT = `600 24px "Inter"`;
const LS = 0.12; // letter spacing (em)

export const Labels: React.FC<{ labels: LabelDef[]; t: number; project: (anchor: string) => Projected }> = ({ labels, t, project }) => {
  const live = labels.filter((l) => t >= l.start && t < l.end + 0.01);
  if (!live.length) return null;
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
      {live.map((l, i) => {
        const p = project(l.anchor);
        if (!p || !p.inFront) return null;
        const textW = measure(l.text, FONT) + l.text.length * 24 * LS;
        const w = textW + 34;
        const h = 46;
        // place the tag above the point, nudged towards the centre, inside the safe zone
        const side = p.x < 540 ? 1 : -1;
        let cx = p.x + side * Math.min(90, w * 0.25);
        cx = clamp(cx, SAFE.left + w / 2, SAFE.right - w / 2);
        let ty = p.y - 168;
        ty = clamp(ty, 650, SAFE.bottom - h - 60);
        // keep same-time labels from overlapping (second one sits a little lower)
        const stack = live.slice(0, i).filter((o) => Math.abs(o.start - l.start) < 2).length;
        ty += stack * (h + 18);
        const lineK = ease.outCubic(clamp((t - l.start) / 0.25));
        const tagK = ease.outCubic(clamp((t - l.start - 0.18) / 0.28));
        const out = clamp((l.end - t) / 0.22);
        const ax = p.x;
        const ay = p.y;
        const bx = cx;
        const by = ty + h;
        return (
          <g key={`${l.text}-${i}`} opacity={out}>
            <line x1={ax} y1={ay} x2={ax + (bx - ax) * lineK} y2={ay + (by - ay) * lineK} stroke={BRAND.warmWhite} strokeWidth={2} strokeLinecap="round" opacity={0.92} />
            <circle cx={ax} cy={ay} r={4.5 * lineK} fill={BRAND.warmWhite} />
            <g opacity={tagK > 0 ? 1 : 0}>
              <clipPath id={`clip-${i}`}>
                <rect x={cx - w / 2} y={ty} width={w * tagK} height={h} />
              </clipPath>
              <g clipPath={`url(#clip-${i})`}>
                <rect x={cx - w / 2} y={ty} width={w} height={h} rx={5} fill={BRAND.tag} />
                <text
                  x={cx}
                  y={ty + h / 2 + 8.5}
                  textAnchor="middle"
                  fill="#ffffff"
                  style={{ fontFamily: SANS, fontWeight: 600, fontSize: 24, letterSpacing: `${LS}em` }}
                >
                  {l.text}
                </text>
              </g>
            </g>
          </g>
        );
      })}
    </svg>
  );
};
