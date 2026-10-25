import { useMemo } from "react";
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { projectPoint } from "../../lib/camera";
import { clamp, ease } from "../../lib/math";
import { MOODS } from "../../lib/moods";
import { BRAND, useFonts } from "../../graphics/brand";
import { CapBeat, Captions } from "../../graphics/Captions";
import { ChoiceScreen } from "../../graphics/Cta";
import { DayTag, DetailCounter, SearchBar, TitleMoment } from "../../graphics/Diagrams";
import { EndCard } from "../../graphics/EndCard";
import { Header } from "../../graphics/Header";
import { HookTitle } from "../../graphics/HookTitle";
import { Labels } from "../../graphics/Labels";
import { DustSwirl, Flare, Flash, Grade, Grain, Vignette } from "../../graphics/Overlays";
import { CardDef, ScriptureCard } from "../../graphics/ScriptureCard";
import { SceneDef, Stage } from "../../world/Stage";
import { S1 } from "./scenes/S1";
import { S2, S3, S4 } from "./scenes/S2S3S4";
import { S5, S6, S9 } from "./scenes/S5S6S9";
import { S7, S8 } from "./scenes/S7S8";
import { S10, S11 } from "./scenes/S10S11";
import { CUES, SCRIPT, TIMELINE } from "./timing";

// Q.01 THE MOUNTAIN. Everything below is a pure function of the frame number.

const SCENES: Record<string, SceneDef> = { S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11 };

/** Which 3D scene is on screen at time t (and at what scene time). */
function active3D(t: number): { def: SceneDef; t: number } | null {
  const D = TIMELINE.durationSeconds;
  if (t >= CUES.endCard.loopStart - 0.05) return { def: S1, t: t - D }; // flows back into frame 0
  const s12 = CUES.scene("S12");
  if (t >= s12.start + 0.2) return null; // CTA + end card are 2D
  const s = CUES.scenes.find((x) => t >= x.start && t < x.end) ?? CUES.scene("S11");
  const def = SCENES[s.id] ?? S11;
  return { def, t };
}

/** Narration words that are shown by something else (hook title, scripture cards). */
function hiddenFromCaptions(beat: string, text: string, index: number, quoteFrom: Record<string, number>) {
  if (beat === "b01") return true;
  const from = quoteFrom[beat];
  return from !== undefined && index >= from;
}

export const TheMountain: React.FC<{ at?: number }> = ({ at }) => {
  const realFrame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const frame = at !== undefined ? Math.round(at * fps) : realFrame; // `at`: review stills
  const t = frame / fps;
  const fonts = useFonts();

  // which words each card covers: the whole beat, or from the start of the quote (b06)
  const quoteFrom = useMemo<Record<string, number>>(() => {
    const iOf = (beat: string, word: string) => {
      const ws = TIMELINE.words.filter((w) => w.beat === beat);
      return ws.findIndex((w) => w.text.replace(/[^A-Za-z]/g, "").toLowerCase() === word);
    };
    return { b03: 0, b06: iOf("b06", "i"), b09: 0, b14: 0 };
  }, []);

  const capBeats = useMemo<CapBeat[]>(
    () =>
      TIMELINE.beats.map((b, bi) => {
        const ws = TIMELINE.words.filter((w) => w.beat === b.id);
        return {
          id: b.id,
          start: b.start,
          end: b.end,
          nextStart: TIMELINE.beats[bi + 1]?.start ?? TIMELINE.endCardStart,
          cutAt: (CUES.cards as CardDef[]).find((c) => c.beat === b.id)?.start,
          words: ws
            .map((w, i) => ({ w, i }))
            .filter(({ w, i }) => !hiddenFromCaptions(b.id, w.text, i, quoteFrom))
            .map(({ w }) => ({ text: w.text.replace(/^"/, "\u201c").replace(/"$/, "\u201d"), keyword: w.keyword, start: w.start, end: w.end, beat: b.id })),
        };
      }),
    [quoteFrom],
  );

  const cards = useMemo(
    () =>
      (CUES.cards as CardDef[]).map((c) => {
        const ws = TIMELINE.words.filter((w) => w.beat === c.beat).slice(quoteFrom[c.beat] ?? 0);
        return { card: c, times: ws.map((w) => w.start) };
      }),
    [quoteFrom],
  );

  const a3 = active3D(t);
  const mood = a3 ? a3.def.mood(a3.t) : { ...MOODS.golgotha, vignette: 0.4, grade: "#3a2a1a", gradeAmount: 0 };
  const cam = a3 ? a3.def.camera(a3.t) : null;
  const anchors = a3 && a3.def.anchors ? a3.def.anchors(a3.t) : {};
  const project = (name: string) => {
    const p = anchors[name];
    if (!p || !cam) return null;
    return projectPoint(cam, p, width, height);
  };

  const fullCard = cards
    .filter((c) => c.card.style === "full")
    .reduce((m, c) => Math.max(m, ease.outCubic(clamp((t - c.card.start) / 0.38)) * clamp((c.card.end - t) / 0.3)), 0);
  const s3 = CUES.scene("S3");
  const s12 = CUES.scene("S12");
  const inEnd = t >= CUES.endCard.start - 0.2;
  const captionsOn = t < CUES.endCard.start - 0.05 ? 1 : 0;

  return (
    <AbsoluteFill style={{ background: BRAND.night, overflow: "hidden" }}>
      {a3 ? <Stage scene={a3.def} t={a3.t} width={width} height={height} /> : null}
      {a3 ? <Grade color={mood.grade} amount={mood.gradeAmount} /> : null}
      {a3 ? <Vignette amount={mood.vignette} /> : null}
      {t >= s3.start && t < s3.end + 0.2 ? <div style={{ position: "absolute", inset: 0, background: "rgba(12,9,6,0.32)" }} /> : null}

      {cards.map(({ card, times }) => (
        <ScriptureCard key={card.beat} card={card} times={times} t={t} />
      ))}

      {fonts ? <Labels labels={CUES.labels} t={t} project={project} /> : null}
      {fonts ? <SearchBar s={CUES.search} t={t} /> : null}
      {fonts ? <DetailCounter c={CUES.counter} t={t} dockAt={s3.end - 0.25} /> : null}
      {fonts ? <DayTag d={CUES.days} t={t} /> : null}
      {fonts ? <TitleMoment main={CUES.title.main} sub={CUES.title.sub} start={CUES.title.start} end={CUES.title.end} t={t} /> : null}
      {fonts ? <ChoiceScreen c={CUES.cta} t={t} start={s12.start} end={CUES.endCard.start} /> : null}

      {fonts ? <Captions beats={capBeats} t={t} dark visible={captionsOn} /> : null}
      {fonts ? (
        <HookTitle
          text={SCRIPT.hookTitle}
          keyword="THIS"
          t={t}
          fly={CUES.hook}
          clearAt={TIMELINE.beats[1].start - 0.06}
          loopIn={ease.inOutSine(clamp((t - (TIMELINE.durationSeconds - 0.45)) / 0.45))}
        />
      ) : null}
      {fonts && !inEnd ? <Header episode={SCRIPT.episode} title={SCRIPT.title} onLight={fullCard} /> : null}
      {fonts && t >= TIMELINE.durationSeconds - 0.45 ? <Header episode={SCRIPT.episode} title={SCRIPT.title} onLight={0} opacity={clamp((t - (TIMELINE.durationSeconds - 0.45)) / 0.45)} /> : null}

      {/* motivated transitions, each hiding a scene change */}
      <Flare at={CUES.scene("S4").start} t={t} />
      <DustSwirl at={CUES.scene("S5").start} t={t} />
      <Flare at={CUES.scene("S6").start} t={t} dur={0.35} />
      <Flare at={CUES.scene("S7").start} t={t} dur={0.5} />
      <Flash at={CUES.scene("S10").start} t={t} strength={0.5} />
      <DustSwirl at={s12.start} t={t} tint="#3a2818" />

      <EndCard e={CUES.endCard} t={t} />
      <Grain frame={frame} amount={0.055} />
      {at === undefined ? <Audio src={staticFile("audio/the-mountain/final_mix.wav")} /> : null}
    </AbsoluteFill>
  );
};
