import { clamp, ease } from "../lib/math";
import { hash1 } from "../lib/random";
import { BRAND, SANS, SERIF } from "./brand";

// Two-choice question screen with icons, a comment box that types, and floating hearts.

const FaithIcon: React.FC<{ size: number; t: number }> = ({ size, t }) => {
  const f = 0.85 + 0.15 * Math.sin(t * 9) * Math.sin(t * 5.3);
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <path d="M8 84 L40 34 L52 50 L62 38 L92 84 Z" fill="#c9b08a" stroke={BRAND.cream} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M40 34 L49 48 L44 46 L40 52 L35 45 Z" fill="#efe4cf" opacity="0.9" />
      <g transform={`translate(40 26) scale(1 ${f})`}>
        <path d="M0 6 C-6 -2 -2 -8 0 -16 C2 -8 6 -2 0 6 Z" fill={BRAND.gold} />
        <path d="M0 4 C-3 0 -1 -4 0 -9 C1 -4 3 0 0 4 Z" fill="#fff1c9" />
      </g>
    </svg>
  );
};

const LoveIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    <path d="M50 88 C20 66 6 50 6 32 C6 18 17 9 29 9 C38 9 45 14 50 22 C55 14 62 9 71 9 C83 9 94 18 94 32 C94 50 80 66 50 88 Z" fill="#c0392b" stroke={BRAND.cream} strokeWidth="2.5" />
    <rect x="46.5" y="27" width="7" height="38" rx="1.5" fill={BRAND.cream} />
    <rect x="35" y="37" width="30" height="7" rx="1.5" fill={BRAND.cream} />
  </svg>
);

export const ChoiceScreen: React.FC<{ c: { faithAt: number; loveAt: number; boxAt: number; text: string; typeStart: number; typeEnd: number; heartsStart: number }; t: number; start: number; end: number }> = ({ c, t, start, end }) => {
  if (t < start - 0.4 || t > end + 0.2) return null;
  const bg = clamp((t - (start - 0.35)) / 0.5) * clamp((end + 0.2 - t) / 0.4);
  const fk = ease.outBack(clamp((t - c.faithAt) / 0.4));
  const lk = ease.outBack(clamp((t - c.loveAt) / 0.4));
  const glow = clamp((t - c.loveAt - 0.2) / 0.6) * (0.75 + 0.25 * Math.sin(t * 3.2));
  const bk = ease.outCubic(clamp((t - c.boxAt) / 0.35));
  const n = Math.round(clamp((t - c.typeStart) / (c.typeEnd - c.typeStart)) * c.text.length);
  const cursor = Math.floor(t * 2.4) % 2 === 0 || (t > c.typeStart && t < c.typeEnd);
  const label = (txt: string, k: number, color: string) => (
    <div style={{ marginTop: 20, fontFamily: SERIF, fontWeight: 700, fontSize: 58, letterSpacing: "0.06em", color, opacity: clamp(k) }}>{txt}</div>
  );
  const hearts = Array.from({ length: 9 }, (_, i) => {
    const t0 = c.heartsStart + i * 0.28 + hash1(i * 7) * 0.2;
    const k = (t - t0) / 1.7;
    if (k < 0 || k > 1) return null;
    const x = 760 + hash1(i * 13) * 120 + Math.sin(k * 6 + i) * 18;
    const y = 1190 - k * 330;
    const s = 0.7 + hash1(i * 3) * 0.6;
    return (
      <svg key={i} width={46 * s} height={46 * s} viewBox="0 0 100 100" style={{ position: "absolute", left: x, top: y, opacity: Math.sin(Math.PI * k) * 0.95 }}>
        <path d="M50 88 C20 66 6 50 6 32 C6 18 17 9 29 9 C38 9 45 14 50 22 C55 14 62 9 71 9 C83 9 94 18 94 32 C94 50 80 66 50 88 Z" fill={i % 3 ? "#e0544a" : BRAND.gold} />
      </svg>
    );
  });
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div style={{ position: "absolute", inset: 0, opacity: bg, background: "radial-gradient(ellipse at 50% 52%, #3a2818 0%, #22170f 45%, #14100d 100%)" }} />
      <div style={{ position: "absolute", left: 150, top: 760, width: 300, textAlign: "center", transform: `scale(${fk})`, opacity: clamp(fk) }}>
        <div style={{ display: "inline-block" }}><FaithIcon size={230} t={t} /></div>
        {label("FAITH", fk, BRAND.cream)}
      </div>
      <div style={{ position: "absolute", left: 580, top: 760, width: 300, textAlign: "center", transform: `scale(${lk})`, opacity: clamp(lk) }}>
        <div style={{ display: "inline-block", filter: `drop-shadow(0 0 ${36 * glow}px rgba(242,181,68,${0.75 * glow}))` }}><LoveIcon size={230} /></div>
        {label("LOVE", lk, BRAND.gold)}
      </div>
      <div
        style={{
          position: "absolute", left: 110, width: 790, top: 1230, height: 104, borderRadius: 52, background: "rgba(243,236,223,0.97)",
          display: "flex", alignItems: "center", gap: 22, padding: "0 30px", boxSizing: "border-box",
          boxShadow: "0 14px 40px rgba(0,0,0,0.45)", opacity: bk, transform: `translateY(${(1 - bk) * 30}px)`,
        }}
      >
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(135deg, #c0392b, #f2b544)" }} />
        <span style={{ fontFamily: SANS, fontWeight: 500, fontSize: 34, color: "#2a2520", whiteSpace: "nowrap" }}>
          {c.text.slice(0, n)}
          <span style={{ display: "inline-block", width: 3, height: 38, marginLeft: 3, verticalAlign: "-6px", background: "#2a2520", opacity: cursor ? 1 : 0 }} />
        </span>
      </div>
      {hearts}
    </div>
  );
};
