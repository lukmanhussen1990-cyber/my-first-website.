// Fonts come from npm (@fontsource), bundled with the reel. The canvas texts in 3D (scroll, cards)
// and the HTML overlay both wait for them.
import '@fontsource/cormorant-garamond/latin-500.css';
import '@fontsource/cormorant-garamond/latin-600.css';
import '@fontsource/cormorant-garamond/latin-700.css';
import '@fontsource/cormorant-garamond/latin-500-italic.css';
import '@fontsource/cormorant-garamond/latin-600-italic.css';
import '@fontsource/cormorant-garamond/latin-700-italic.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/inter/latin-800.css';

export const SERIF = '"Cormorant Garamond", Georgia, serif';
export const SANS = 'Inter, "Helvetica Neue", Arial, sans-serif';
export const EMOJI = '"Noto Color Emoji"';   // system font (installed), used for the 🙏 in the CTA comment
const SPECS = [
  '500 64px "Cormorant Garamond"', '600 64px "Cormorant Garamond"', '700 64px "Cormorant Garamond"',
  'italic 500 64px "Cormorant Garamond"', 'italic 600 64px "Cormorant Garamond"', 'italic 700 64px "Cormorant Garamond"',
  '500 40px Inter', '600 40px Inter', '700 40px Inter', '800 40px Inter',
];
let ready = null;
export function fontsReady() {
  if (!ready) {
    ready = Promise.all(SPECS.map((f) => document.fonts.load(f)))
      .then(() => document.fonts.load('40px "Noto Color Emoji"', '\u{1F64F}').catch(() => null))
      .then(() => document.fonts.ready);
  }
  return ready;
}
