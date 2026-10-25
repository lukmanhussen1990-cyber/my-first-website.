import { AbsoluteFill } from "remotion";
import { BRAND, SERIF, useFonts } from "../../graphics/brand";
import { Header } from "../../graphics/Header";
import { Grade, Vignette } from "../../graphics/Overlays";
import { Stage } from "../../world/Stage";
import { S1 } from "./scenes/S1";
import { SCRIPT } from "./timing";

// Profile-grid cover: Abraham and Isaac on the dawn path with the hook question in big text.
// The text sits inside the centre 1080x1440 area so it survives the grid crop.
export const Cover: React.FC = () => {
  const fonts = useFonts();
  const t = 3.2;
  const mood = S1.mood(t);
  return (
    <AbsoluteFill style={{ background: BRAND.night }}>
      <Stage scene={S1} t={t} width={1080} height={1920} />
      <Grade color={mood.grade} amount={mood.gradeAmount} />
      <Vignette amount={mood.vignette + 0.1} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(14,10,7,0.55) 0%, rgba(14,10,7,0.15) 45%, rgba(14,10,7,0) 60%)" }} />
      {fonts ? (
        <>
          <Header episode={SCRIPT.episode} title={SCRIPT.title} onLight={0} />
          <div style={{ position: "absolute", left: 60, right: 60, top: 300, textAlign: "center", fontFamily: SERIF, fontWeight: 700, fontSize: 150, lineHeight: 0.98, color: BRAND.warmWhite, textShadow: "0 8px 40px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4)" }}>
            WHY WOULD
            <br />
            GOD ASK
            <br />
            <span style={{ color: BRAND.gold }}>THIS?</span>
          </div>
        </>
      ) : null}
    </AbsoluteFill>
  );
};
