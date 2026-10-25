import { clamp, ease, lerp } from "../lib/math";
import { BRAND, SANS, SERIF } from "./brand";

// The reusable diagram kit: plain search bar, "3 DETAILS" dot counter, DAY tag, title moment.

const Magnifier: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <circle cx="10" cy="10" r="6.5" fill="none" stroke={color} strokeWidth="2.4" />
    <line x1="15" y1="15" x2="21" y2="21" stroke={color} strokeWidth="2.6" strokeLinecap="round" />
  </svg>
);

export const SearchBar: React.FC<{ s: { start: number; text: string; typeStart: number; typeEnd: number; suggestions: string[]; suggestionsAt: number; end: number }; t: number }> = ({ s, t }) => {
  const inK = ease.outBack(clamp((t - s.start) / 0.35));
  const outK = clamp((s.end - t) / 0.3);
  if (t < s.start || outK <= 0) return null;
  const n = Math.round(clamp((t - s.typeStart) / (s.typeEnd - s.typeStart)) * s.text.length);
  const typed = s.text.slice(0, n);
  const cursor = Math.floor(t * 2.2) % 2 === 0 || (t > s.typeStart && t < s.typeEnd);
  const sugK = ease.outCubic(clamp((t - s.suggestionsAt) / 0.3));
  return (
    <div style={{ position: "absolute", left: 92, width: 848, top: 660, opacity: outK, transform: `scale(${0.9 + 0.1 * inK})`, transformOrigin: "50% 50%" }}>
      <div
        style={{
          height: 104, borderRadius: 52, background: "#ffffff", display: "flex", alignItems: "center", padding: "0 38px", gap: 22,
          boxShadow: "0 14px 40px rgba(0,0,0,0.35)", opacity: clamp(inK),
        }}
      >
        <Magnifier size={38} color="#8a8178" />
        <span style={{ fontFamily: SANS, fontWeight: 500, fontSize: 34, color: "#2a2520", whiteSpace: "nowrap", overflow: "hidden" }}>
          {typed}
          <span style={{ display: "inline-block", width: 3, height: 40, marginLeft: 3, verticalAlign: "-6px", background: "#3b6fd8", opacity: cursor ? 1 : 0 }} />
        </span>
      </div>
      <div
        style={{
          marginTop: 14, borderRadius: 28, background: "rgba(255,255,255,0.97)", overflow: "hidden", boxShadow: "0 14px 40px rgba(0,0,0,0.3)",
          opacity: sugK, transform: `translateY(${(1 - sugK) * -12}px)`,
        }}
      >
        {s.suggestions.map((q, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 20, padding: "22px 38px", background: i === 0 ? "#f1ede6" : "transparent", borderTop: i ? "1px solid #ece6dc" : "none" }}>
            <Magnifier size={28} color="#a39a8f" />
            <span style={{ fontFamily: SANS, fontWeight: i === 0 ? 600 : 500, fontSize: 30, color: "#3a332c", whiteSpace: "nowrap" }}>{q}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/** Three gold dots: appear big in S3, then sit under the header and fill one per detail. */
export const DetailCounter: React.FC<{ c: { appear: number; dots: number[]; fills: number[]; hide: number }; t: number; dockAt: number }> = ({ c, t, dockAt }) => {
  if (t < c.appear - 0.05 || t > c.hide + 0.4) return null;
  const dock = ease.inOutCubic(clamp((t - dockAt) / 0.6));
  const out = clamp((c.hide + 0.4 - t) / 0.4);
  const filled = c.fills.filter((f) => t >= f).length;
  const size = lerp(46, 20, dock);
  const gap = lerp(26, 12, dock);
  const left = lerp(540 - (3 * 46 + 2 * 26) / 2 - 10, 676, dock);
  const top = lerp(1240, 196, dock);
  const label = filled === 0 ? "3 DETAILS" : `DETAIL ${filled}/3`;
  return (
    <div style={{ position: "absolute", left, top, display: "flex", alignItems: "center", gap, opacity: out }}>
      {c.dots.map((d, i) => {
        const appear = ease.outBack(clamp((t - d) / 0.25));
        const fillT = c.fills[i];
        const fk = clamp((t - fillT) / 0.22);
        const pop = 1 + 0.35 * Math.sin(Math.PI * clamp((t - fillT) / 0.35));
        return (
          <div
            key={i}
            style={{
              width: size, height: size, borderRadius: "50%", boxSizing: "border-box",
              border: `${lerp(4, 2.5, dock)}px solid ${BRAND.gold}`,
              background: fk > 0 ? `rgba(242,181,68,${fk})` : "rgba(20,16,13,0.25)",
              boxShadow: fk > 0 ? `0 0 ${18 * fk}px rgba(242,181,68,0.85)` : "none",
              transform: `scale(${appear * (t >= fillT ? pop : 1)})`,
            }}
          />
        );
      })}
      <span style={{ marginLeft: lerp(18, 6, dock), fontFamily: SANS, fontWeight: 700, fontSize: lerp(40, 20, dock), letterSpacing: "0.16em", color: BRAND.gold, textShadow: "0 2px 10px rgba(0,0,0,0.5)", whiteSpace: "nowrap", opacity: ease.outCubic(clamp((t - c.dots[2]) / 0.25)) }}>
        {label}
      </span>
    </div>
  );
};

export const DayTag: React.FC<{ d: { start: number; marks: number[]; end: number }; t: number }> = ({ d, t }) => {
  const until = d.marks[2] + 0.95;
  if (t < d.start || t > until) return null;
  const inK = ease.outCubic(clamp((t - d.start) / 0.25));
  const out = clamp((until - t) / 0.3);
  const cur = d.marks.filter((m) => t >= m).length;
  return (
    <div
      style={{
        position: "absolute", left: 0, right: 120, top: 572, display: "flex", justifyContent: "center", opacity: inK * out,
        transform: `translateY(${(1 - inK) * 14}px)`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16, background: BRAND.tag, borderRadius: 30, padding: "14px 30px" }}>
        {[1, 2, 3].map((n) => {
          const on = n === cur;
          const k = clamp((t - d.marks[n - 1]) / 0.15);
          return (
            <span key={n} style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 26, letterSpacing: "0.14em", color: on ? BRAND.gold : "rgba(255,255,255,0.45)", transform: `scale(${on ? 1 + 0.08 * k : 1})` }}>
                {`DAY ${n}`}
              </span>
              {n < 3 ? <span style={{ fontFamily: SANS, fontSize: 24, color: "rgba(255,255,255,0.5)" }}>→</span> : null}
            </span>
          );
        })}
      </div>
    </div>
  );
};

export const TitleMoment: React.FC<{ main: string; sub: string; start: number; end: number; t: number }> = ({ main, sub, start, end, t }) => {
  if (t < start || t > end) return null;
  const k = ease.outCubic(clamp((t - start) / 0.6));
  const out = clamp((end - t) / 0.35);
  const shimmer = clamp((t - start) / 1.4);
  return (
    <div style={{ position: "absolute", left: 40, right: 120, top: 820, textAlign: "center", opacity: k * out }}>
      <div
        style={{
          fontFamily: SERIF, fontWeight: 700, fontSize: 104, letterSpacing: "0.06em", lineHeight: 1,
          backgroundImage: `linear-gradient(100deg, ${BRAND.gold} ${shimmer * 140 - 40}%, #fff6dc ${shimmer * 140 - 20}%, ${BRAND.gold} ${shimmer * 140}%)`,
          WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
          filter: "drop-shadow(0 4px 18px rgba(0,0,0,0.45))",
          transform: `scale(${0.94 + 0.06 * k})`,
        }}
      >
        {main}
      </div>
      <div style={{ marginTop: 22, fontFamily: SANS, fontWeight: 600, fontSize: 25, letterSpacing: "0.22em", color: BRAND.warmWhite, textShadow: "0 2px 12px rgba(0,0,0,0.6)" }}>{sub}</div>
    </div>
  );
};
