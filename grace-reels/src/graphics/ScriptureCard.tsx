import { useMemo } from "react";
import { clamp, ease, lerp } from "../lib/math";
import { rngFrom } from "../lib/random";
import { BRAND, SANS, SERIF } from "./brand";

// Scripture cards on warm cream paper. The quote is shown in full at low ink and every word
// darkens exactly when the narrator reads it; keywords (UPPERCASE in the quote) are deep-gold caps.
// style "full": covers the frame, scene ghosted behind at 15%. "floating": card over a darkened scene.

export type CardDef = { beat: string; style: "full" | "floating"; quote: string; ref: string; start: number; end: number };

let paperUrl: string | null = null;
function paper() {
  if (paperUrl) return paperUrl;
  const c = document.createElement("canvas");
  c.width = 540;
  c.height = 960;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(c.width, c.height);
  const r = rngFrom(2024);
  for (let i = 0; i < c.width * c.height; i++) {
    const n = 236 + (r.next() - 0.5) * 22;
    img.data[i * 4] = n + 7;
    img.data[i * 4 + 1] = n;
    img.data[i * 4 + 2] = n - 12;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  // a few soft fibres
  for (let i = 0; i < 260; i++) {
    ctx.strokeStyle = `rgba(150,120,80,${0.03 + r.next() * 0.05})`;
    ctx.lineWidth = r.range(0.5, 1.5);
    ctx.beginPath();
    const x = r.range(0, 540);
    const y = r.range(0, 960);
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + r.range(-20, 20), y + r.range(-20, 20), x + r.range(-40, 40), y + r.range(-40, 40));
    ctx.stroke();
  }
  paperUrl = c.toDataURL("image/jpeg", 0.9);
  return paperUrl;
}

export const ScriptureCard: React.FC<{ card: CardDef; times: number[]; t: number }> = ({ card, times, t }) => {
  const tokens = useMemo(() => card.quote.split(" "), [card.quote]);
  const inK = ease.outCubic(clamp((t - card.start) / 0.38));
  const outK = clamp((card.end - t) / 0.3);
  const vis = inK * outK;
  if (vis <= 0) return null;
  const zoom = lerp(1, 1.03, clamp((t - card.start) / Math.max(0.1, card.end - card.start)));
  const full = card.style === "full";
  const fontSize = full ? 60 : 52;
  const words = tokens.map((tok, i) => {
    const kw = /[A-Z]{2,}/.test(tok.replace(/[^A-Za-z]/g, "")) && tok.replace(/[^A-Za-z]/g, "") === tok.replace(/[^A-Za-z]/g, "").toUpperCase();
    const st = times[i] ?? card.start;
    const k = clamp((t - st) / 0.14);
    const pop = kw ? 1 + 0.07 * Math.sin(Math.PI * clamp((t - st) / 0.28)) : 1;
    return (
      <span
        key={i}
        style={{
          display: "inline-block",
          marginRight: i < tokens.length - 1 ? "0.24em" : 0,
          fontFamily: SERIF,
          fontStyle: kw ? "normal" : "italic",
          fontWeight: kw ? 700 : 500,
          fontSize: kw ? fontSize * 0.94 : fontSize,
          letterSpacing: kw ? "0.03em" : 0,
          color: kw ? BRAND.deepGold : BRAND.ink,
          opacity: 0.32 + 0.68 * k,
          transform: `translateY(${4 * (1 - k)}px) scale(${pop})`,
        }}
      >
        {tok}
      </span>
    );
  });
  const body = (
    <>
      <div style={{ lineHeight: 1.22, textAlign: "center" }}>
        <span style={{ fontFamily: SERIF, fontSize, color: BRAND.ink, opacity: 0.7 }}>{"“"}</span>
        {words}
        <span style={{ fontFamily: SERIF, fontSize, color: BRAND.ink, opacity: 0.7 }}>{"”"}</span>
      </div>
      <div style={{ marginTop: full ? 46 : 26, textAlign: "center", fontFamily: SANS, fontWeight: 600, fontSize: full ? 24 : 21, letterSpacing: "0.22em", color: "#6d5a45" }}>
        {card.ref}
      </div>
    </>
  );
  if (full) {
    return (
      <div style={{ position: "absolute", inset: 0, opacity: vis }}>
        <div style={{ position: "absolute", inset: 0, backgroundColor: BRAND.cream, backgroundImage: `url(${paper()})`, backgroundSize: "1080px 1920px", opacity: 0.86 }} />
        <div style={{ position: "absolute", left: 96, right: 156, top: 760, transform: `translateY(${(1 - inK) * 40}px) scale(${zoom})`, transformOrigin: "50% 30%" }}>
          <div style={{ width: 72, height: 3, background: BRAND.deepGold, margin: "0 auto 54px", opacity: 0.7 }} />
          {body}
        </div>
      </div>
    );
  }
  return (
    <>
      <div style={{ position: "absolute", inset: 0, background: "rgba(14,10,6,0.28)", opacity: vis }} />
      <div
        style={{
          position: "absolute",
          left: 72,
          width: 888,
          top: 236,
          padding: "40px 46px 34px",
          borderRadius: 8,
          backgroundColor: BRAND.cream,
          backgroundImage: `url(${paper()})`,
          backgroundSize: "1080px 1920px",
          boxShadow: "0 18px 50px rgba(0,0,0,0.35), 0 3px 10px rgba(0,0,0,0.2)",
          opacity: vis,
          transform: `translateY(${(1 - inK) * 36}px) scale(${zoom})`,
          transformOrigin: "50% 0%",
          boxSizing: "border-box",
        }}
      >
        <div style={{ position: "absolute", left: 0, top: 18, bottom: 18, width: 6, background: BRAND.deepGold, borderRadius: 3, opacity: 0.8 }} />
        {body}
      </div>
    </>
  );
};
