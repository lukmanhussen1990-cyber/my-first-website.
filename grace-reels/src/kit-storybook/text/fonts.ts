import { useEffect, useState } from 'react';
import { continueRender, delayRender } from 'remotion';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/cormorant-garamond/700.css';
import '@fontsource/cormorant-garamond/400-italic.css';
import '@fontsource/cormorant-garamond/500-italic.css';
import '@fontsource/montserrat/500.css';
import '@fontsource/montserrat/600.css';

export const SERIF = '"Cormorant Garamond", Georgia, serif';
export const SANS = 'Montserrat, Helvetica, Arial, sans-serif';
export const CREAM = '#F3ECDF';
export const GOLD = '#E2B25A';

const FACES = ['500 62px "Cormorant Garamond"', '600 48px "Cormorant Garamond"', '700 90px "Cormorant Garamond"', 'italic 400 40px "Cormorant Garamond"', 'italic 500 40px "Cormorant Garamond"', '500 48px Montserrat', '600 48px Montserrat'];

// hold the render until every face we use is loaded (text must never pop in late)
export function useFonts() {
  const [handle] = useState(() => delayRender('fonts'));
  useEffect(() => {
    Promise.all(FACES.map((f) => document.fonts.load(f))).then(() => continueRender(handle));
  }, [handle]);
}

let measureCtx: CanvasRenderingContext2D | null = null;
export function textWidth(text: string, font: string) {
  measureCtx ??= document.createElement('canvas').getContext('2d');
  measureCtx!.font = font;
  return measureCtx!.measureText(text).width;
}
