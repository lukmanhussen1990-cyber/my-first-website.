import { useMemo } from "react";
import { clamp } from "../lib/math";
import { BRAND, measure, SAFE, SERIF } from "./brand";

// Word-by-word subtitles that follow the narrator exactly.
// - each word fades in and rises 8 px over 120 ms at its start time
// - the next word shows as a 25% ghost 150 ms early
// - keywords: UPPERCASE, Cormorant Garamond Bold, gold, tiny pop (1 -> 1.08 -> 1)
// - max 3 lines; long sentences split into pages (prefers punctuation); cleared after each sentence

export type CapWord = { text: string; keyword: boolean; start: number; end: number; beat: string };
export type CapBeat = { id: string; start: number; end: number; nextStart: number; cutAt?: number; words: CapWord[] };

const SIZE = 66;
const KW_SIZE = 63;
const LINE_H = SIZE * 1.15;
const MAX_W = SAFE.right - SAFE.left;
const MAX_LINES = 3;
const NORMAL_FONT = `italic 500 ${SIZE}px "Cormorant Garamond"`;
const KW_FONT = `700 ${KW_SIZE}px "Cormorant Garamond"`;

type Page = { words: CapWord[]; lines: CapWord[][]; start: number; end: number };

const shown = (w: CapWord) => (w.keyword ? w.text.toUpperCase() : w.text);
const widthOf = (w: CapWord) => measure(shown(w), w.keyword ? KW_FONT : NORMAL_FONT);

function layout(words: CapWord[]): CapWord[][] {
  const space = measure(" ", NORMAL_FONT);
  const lines: CapWord[][] = [];
  let cur: CapWord[] = [];
  let w = 0;
  for (const word of words) {
    const ww = widthOf(word);
    if (cur.length && w + space + ww > MAX_W) {
      lines.push(cur);
      cur = [word];
      w = ww;
    } else {
      w += (cur.length ? space : 0) + ww;
      cur.push(word);
    }
  }
  if (cur.length) lines.push(cur);
  return lines;
}

function split(words: CapWord[]): CapWord[][] {
  if (layout(words).length <= MAX_LINES) return [words];
  // break near the middle, preferring a word that ends with punctuation
  const mid = words.length / 2;
  let best = Math.round(mid);
  let bestCost = 1e9;
  for (let i = 2; i < words.length - 1; i++) {
    const punct = /[,.;:?!…"”]$/.test(words[i - 1].text) ? 0 : 3;
    const cost = Math.abs(i - mid) + punct;
    if (cost < bestCost) {
      bestCost = cost;
      best = i;
    }
  }
  return [...split(words.slice(0, best)), ...split(words.slice(best))];
}

export function buildPages(beats: CapBeat[]): Page[] {
  const pages: Page[] = [];
  for (const b of beats) {
    if (!b.words.length) continue;
    const parts = split(b.words);
    parts.forEach((ws, i) => {
      const start = ws[0].start - 0.15;
      const last = i === parts.length - 1;
      const lastWord = ws[ws.length - 1];
      const end = last ? Math.min(lastWord.end + 0.45, b.nextStart - 0.06, b.cutAt ?? 1e9) : parts[i + 1][0].start - 0.17;
      pages.push({ words: ws, lines: layout(ws), start, end });
    });
  }
  return pages;
}

export const Captions: React.FC<{ beats: CapBeat[]; t: number; dark: boolean; visible?: number }> = ({ beats, t, dark, visible = 1 }) => {
  const pages = useMemo(() => buildPages(beats), [beats]);
  const page = pages.find((p) => t >= p.start && t < p.end);
  const text = dark ? BRAND.warmWhite : BRAND.ink;
  const kw = dark ? BRAND.gold : BRAND.deepGold;
  // scrim presence: on while any page is near, eased so it never flickers between sentences
  const near = pages.some((p) => t > p.start - 0.35 && t < p.end + 0.45);
  const scrim = (near ? 1 : 0) * visible;
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 150,
          height: 600,
          opacity: scrim,
          background: dark
            ? "linear-gradient(180deg, rgba(14,11,8,0) 0%, rgba(14,11,8,0.42) 22%, rgba(14,11,8,0.42) 70%, rgba(14,11,8,0) 100%)"
            : "linear-gradient(180deg, rgba(243,236,223,0) 0%, rgba(243,236,223,0.72) 22%, rgba(243,236,223,0.72) 70%, rgba(243,236,223,0) 100%)",
        }}
      />
      {page ? (
        <div style={{ position: "absolute", left: SAFE.left, top: SAFE.captionTop + 14, width: MAX_W, opacity: visible * clamp((page.end - t) / 0.15) }}>
          {page.lines.map((line, li) => (
            <div key={li} style={{ height: LINE_H, whiteSpace: "nowrap", display: "flex", alignItems: "baseline" }}>
              {line.map((w, wi) => {
                const ghost = t >= w.start - 0.15 && t < w.start;
                const k = clamp((t - w.start) / 0.12);
                const op = t < w.start - 0.15 ? 0 : ghost ? 0.25 : 0.25 + 0.75 * k;
                const pop = w.keyword ? 1 + 0.08 * Math.sin(Math.PI * clamp((t - w.start) / 0.26)) : 1;
                return (
                  <span
                    key={wi}
                    style={{
                      display: "inline-block",
                      marginRight: wi < line.length - 1 ? "0.25em" : 0,
                      fontFamily: SERIF,
                      fontStyle: w.keyword ? "normal" : "italic",
                      fontWeight: w.keyword ? 700 : 500,
                      fontSize: w.keyword ? KW_SIZE : SIZE,
                      letterSpacing: w.keyword ? "0.02em" : 0,
                      color: w.keyword ? kw : text,
                      opacity: op,
                      transform: `translateY(${ghost ? 0 : 8 * (1 - k)}px) scale(${pop})`,
                      transformOrigin: "50% 70%",
                      textShadow: dark ? "0 2px 14px rgba(0,0,0,0.45)" : "0 1px 8px rgba(255,248,235,0.6)",
                    }}
                  >
                    {shown(w)}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
};
