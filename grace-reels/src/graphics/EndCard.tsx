import { clamp, ease } from "../lib/math";
import { BRAND, SANS, SERIF } from "./brand";
import { Logo } from "./Logo";

// End card: our logo draws itself, name, handle and tagline. In the last frames it fades away
// to reveal the opening shot again, so the reel loops seamlessly.

export const EndCard: React.FC<{ e: { start: number; logoDone: number; loopStart: number; end: number }; t: number }> = ({ e, t }) => {
  if (t < e.start - 0.35) return null;
  const bg = clamp((t - (e.start - 0.35)) / 0.35) * (1 - ease.inOutSine(clamp((t - e.loopStart) / (e.end - e.loopStart))));
  const draw = clamp((t - e.start) / (e.logoDone - e.start));
  const txt = (d: number) => ease.outCubic(clamp((t - e.start - d) / 0.45));
  const glow = 0.4 + 0.3 * Math.sin(t * 2.4);
  return (
    <div style={{ position: "absolute", inset: 0, opacity: bg }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% 44%, #2a1d14 0%, ${BRAND.night} 62%)` }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 640, display: "flex", justifyContent: "center" }}>
        <Logo size={230} draw={draw} glow={draw >= 1 ? glow : 0} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 930, textAlign: "center" }}>
        <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 84, letterSpacing: "0.12em", color: BRAND.warmWhite, opacity: txt(0.55), transform: `translateY(${(1 - txt(0.55)) * 16}px)` }}>{BRAND.name}</div>
        <div style={{ marginTop: 18, fontFamily: SANS, fontWeight: 600, fontSize: 32, letterSpacing: "0.06em", color: BRAND.gold, opacity: txt(0.85) }}>{BRAND.handle}</div>
        <div style={{ marginTop: 26, fontFamily: SERIF, fontStyle: "italic", fontWeight: 500, fontSize: 44, color: BRAND.cream, opacity: txt(1.15) * 0.9 }}>{BRAND.tagline}</div>
      </div>
    </div>
  );
};
