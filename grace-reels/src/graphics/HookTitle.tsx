import { clamp, ease, lerp } from "../lib/math";
import { BRAND, SAFE, SERIF } from "./brand";

// The question in huge text for the first 1.8 s (stops the scroll even on mute); it then shrinks
// and flies into the caption spot, where it becomes the first caption.
// It also fades in during the final frames so the last frame flows back into frame 0.

export const HookTitle: React.FC<{ text: string; keyword: string; t: number; fly: { flyStart: number; flyEnd: number }; clearAt: number; loopIn: number }> = ({ text, keyword, t, fly, clearAt, loopIn }) => {
  const flying = ease.inOutCubic(clamp((t - fly.flyStart) / (fly.flyEnd - fly.flyStart)));
  const big = t < fly.flyEnd ? 1 - clamp((t - (fly.flyEnd - 0.12)) / 0.12) : 0;
  const settle = 1 + 0.035 * (1 - ease.outCubic(clamp(t / 0.8)));
  const words = text.split(" ");
  const kw = (w: string) => w.replace(/[^A-Z]/g, "") === keyword;
  const opacity = Math.max(big, loopIn);
  const caption = t > fly.flyEnd - 0.2 && t < clearAt ? clamp((t - (fly.flyEnd - 0.2)) / 0.15) * clamp((clearAt - t) / 0.12) : 0;
  // flight path: centre of the screen -> caption spot (top-left), shrinking to caption size
  const x = lerp(540, SAFE.left + 300, flying);
  const y = lerp(640, SAFE.captionTop + 40, flying);
  const scale = lerp(1, 0.5, flying) * settle;
  return (
    <>
      {opacity > 0 ? (
        <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) scale(${scale})`, width: 1000, textAlign: "center", opacity: opacity * (1 - flying * 0.35) }}>
          <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 124, lineHeight: 1.02, letterSpacing: "0.01em", color: BRAND.warmWhite, textShadow: "0 6px 30px rgba(0,0,0,0.55), 0 2px 6px rgba(0,0,0,0.4)" }}>
            {words.map((w, i) => (
              <span key={i} style={{ color: kw(w) ? BRAND.gold : BRAND.warmWhite }}>
                {w}
                {i === 2 ? <br /> : i < words.length - 1 ? " " : ""}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {caption > 0 ? (
        <div style={{ position: "absolute", left: SAFE.left, top: SAFE.captionTop + 14, opacity: caption, whiteSpace: "nowrap" }}>
          {"Why would God ask ".split(" ").filter(Boolean).map((w, i) => (
            <span key={i} style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 500, fontSize: 66, color: BRAND.warmWhite, marginRight: "0.25em", textShadow: "0 2px 14px rgba(0,0,0,0.45)" }}>
              {w}
            </span>
          ))}
          <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 63, color: BRAND.gold, letterSpacing: "0.02em", textShadow: "0 2px 14px rgba(0,0,0,0.45)" }}>THIS?</span>
        </div>
      ) : null}
    </>
  );
};
