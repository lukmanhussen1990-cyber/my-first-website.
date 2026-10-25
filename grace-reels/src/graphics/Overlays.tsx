import { useMemo } from "react";
import { clamp } from "../lib/math";
import { hash1, rngFrom } from "../lib/random";

// Finishing layers drawn over everything: colour grade, vignette, film grain, and transitions.

export const Grade: React.FC<{ color: string; amount: number }> = ({ color, amount }) => (
  <div style={{ position: "absolute", inset: 0, background: color, opacity: amount, mixBlendMode: "soft-light" }} />
);

export const Vignette: React.FC<{ amount: number }> = ({ amount }) => (
  <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 75% 62% at 50% 46%, rgba(0,0,0,0) 55%, rgba(12,8,5,0.85) 130%)", opacity: amount }} />
);

let grainUrl: string | null = null;
function grain() {
  if (grainUrl) return grainUrl;
  const c = document.createElement("canvas");
  c.width = c.height = 360;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(360, 360);
  const r = rngFrom(99);
  for (let i = 0; i < 360 * 360; i++) {
    const v = 128 + (r.next() + r.next() + r.next() - 1.5) * 90;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  grainUrl = c.toDataURL("image/png");
  return grainUrl;
}

/** Light film grain; the pattern jumps to a new seeded offset every frame. */
export const Grain: React.FC<{ frame: number; amount?: number }> = ({ frame, amount = 0.06 }) => {
  const url = useMemo(() => grain(), []);
  const ox = Math.floor(hash1(frame * 2 + 1) * 360);
  const oy = Math.floor(hash1(frame * 2 + 2) * 360);
  return <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${url})`, backgroundSize: "720px 720px", backgroundPosition: `${ox}px ${oy}px`, opacity: amount, mixBlendMode: "overlay" }} />;
};

/** Warm light-flare wipe that peaks at `at` (scene cut hidden under the brightest moment). */
export const Flare: React.FC<{ at: number; t: number; dur?: number }> = ({ at, t, dur = 0.55 }) => {
  const k = (t - at) / dur;
  if (k < -1 || k > 1) return null;
  const a = Math.exp(-k * k * 5);
  const x = 50 + k * 70;
  return (
    <div
      style={{
        position: "absolute", inset: 0, mixBlendMode: "screen", opacity: a,
        background: `radial-gradient(ellipse 60% 45% at ${x}% 42%, rgba(255,236,190,0.95) 0%, rgba(255,200,120,0.55) 35%, rgba(255,170,80,0) 75%), linear-gradient(105deg, rgba(255,230,180,0) ${x - 30}%, rgba(255,240,210,0.7) ${x}%, rgba(255,230,180,0) ${x + 30}%)`,
      }}
    />
  );
};

/** Dust swirl: warm motes rush across while the frame dips through a soft haze. */
export const DustSwirl: React.FC<{ at: number; t: number; dur?: number; tint?: string }> = ({ at, t, dur = 0.7, tint = "#e8c89a" }) => {
  const k = (t - at) / dur;
  if (k < -1 || k > 1) return null;
  const haze = Math.exp(-k * k * 4) * 0.85;
  const motes = Array.from({ length: 70 }, (_, i) => {
    const r = rngFrom(500 + i);
    const y = r.range(0, 1920);
    const speed = r.range(0.6, 1.4);
    const x = ((r.range(0, 1) + (k + 1) * speed * 0.9) % 1.4) * 1080 * 1.1 - 100;
    const s = r.range(3, 11);
    return <div key={i} style={{ position: "absolute", left: x, top: y + Math.sin(k * 5 + i) * 40, width: s, height: s, borderRadius: "50%", background: "#fff2d6", opacity: haze * r.range(0.35, 0.9), filter: "blur(1px)" }} />;
  });
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div style={{ position: "absolute", inset: 0, background: tint, opacity: haze }} />
      {motes}
    </div>
  );
};

/** Gentle white flash (thunder): a single soft pulse, never a strobe. */
export const Flash: React.FC<{ at: number; t: number; strength?: number }> = ({ at, t, strength = 0.55 }) => {
  const k = (t - at) / 0.18;
  if (k < -1.5 || k > 3) return null;
  const a = k < 0 ? Math.exp(-k * k * 3) : Math.exp(-k * 1.4);
  return <div style={{ position: "absolute", inset: 0, background: "#eef2f8", opacity: clamp(a * strength), mixBlendMode: "screen" }} />;
};
