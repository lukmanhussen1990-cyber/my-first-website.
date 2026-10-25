import "@fontsource/cormorant-garamond/500-italic.css";
import "@fontsource/cormorant-garamond/600-italic.css";
import "@fontsource/cormorant-garamond/700.css";
import "@fontsource/cormorant-garamond/700-italic.css";
import "@fontsource/cormorant-garamond/600.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import { useEffect, useState } from "react";
import { continueRender, delayRender } from "remotion";

// Grace in Motion brand: colours, fonts, sizes. Every reel uses these.

export const BRAND = {
  name: "GRACE IN MOTION",
  handle: "@GraceINMotion616",
  tagline: "Hard questions. Bible answers.",
  cream: "#F3ECDF",
  ink: "#1E1A16",
  gold: "#F2B544", // keywords on dark
  deepGold: "#9A5B0C", // keywords on light
  red: "#C0392B",
  tag: "rgba(20,18,16,0.9)",
  night: "#14100D",
  warmWhite: "#FBF4E8",
};

export const SERIF = '"Cormorant Garamond", "Georgia", serif';
export const SANS = '"Inter", "Helvetica Neue", Arial, sans-serif';

export const SAFE = { left: 72, right: 960, bottom: 1450, captionTop: 240, captionBottom: 620 };

let fontsReady = false;
let waiting: Promise<void> | null = null;
function loadFonts() {
  if (!waiting) {
    waiting = Promise.all([
      document.fonts.load(`italic 500 66px "Cormorant Garamond"`),
      document.fonts.load(`italic 600 66px "Cormorant Garamond"`),
      document.fonts.load(`700 66px "Cormorant Garamond"`),
      document.fonts.load(`italic 700 66px "Cormorant Garamond"`),
      document.fonts.load(`600 66px "Cormorant Garamond"`),
      document.fonts.load(`500 22px "Inter"`),
      document.fonts.load(`600 22px "Inter"`),
      document.fonts.load(`700 22px "Inter"`),
    ]).then(() => {
      fontsReady = true;
    });
  }
  return waiting;
}

/** True once all brand fonts are loaded; holds the render until then. */
export function useFonts() {
  const [ready, setReady] = useState(fontsReady);
  const [handle] = useState(() => (fontsReady ? null : delayRender("Loading brand fonts")));
  useEffect(() => {
    if (fontsReady) {
      if (handle !== null) continueRender(handle);
      return;
    }
    loadFonts().then(() => {
      setReady(true);
      if (handle !== null) continueRender(handle);
    });
  }, [handle]);
  return ready;
}

let measureCtx: CanvasRenderingContext2D | null = null;
export function measure(text: string, font: string) {
  if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d")!;
  measureCtx.font = font;
  return measureCtx.measureText(text).width;
}
