import {continueRender, delayRender} from 'remotion';
import jakarta700 from '@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-700-normal.woff2';
import jakarta800 from '@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-800-normal.woff2';
import playfair700 from '@fontsource/playfair-display/files/playfair-display-latin-700-normal.woff2';
import playfair900 from '@fontsource/playfair-display/files/playfair-display-latin-900-normal.woff2';
import inter600 from '@fontsource/inter/files/inter-latin-600-normal.woff2';

export const FONT_CAPTION = '"Plus Jakarta Sans", sans-serif';
export const FONT_SERIF = '"Playfair Display", serif';
export const FONT_UI = '"Inter", sans-serif';

const faces: [string, string, string][] = [
  ['Plus Jakarta Sans', jakarta700, '700'],
  ['Plus Jakarta Sans', jakarta800, '800'],
  ['Playfair Display', playfair700, '700'],
  ['Playfair Display', playfair900, '900'],
  ['Inter', inter600, '600'],
];

let started = false;

// Load every font once, holding the render until they are ready so no frame
// is ever drawn with a fallback font.
export const loadFonts = () => {
  if (started || typeof document === 'undefined') return;
  started = true;
  const handle = delayRender('Loading fonts');
  Promise.all(
    faces.map(([family, url, weight]) => {
      const face = new FontFace(family, `url(${url}) format("woff2")`, {weight});
      document.fonts.add(face);
      return face.load();
    }),
  )
    .then(() => continueRender(handle))
    .catch((err) => {
      console.error(err);
      continueRender(handle);
    });
};
