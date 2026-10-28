import '@fontsource/cormorant-garamond/500-italic.css';
import '@fontsource/cormorant-garamond/600-italic.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/cormorant-garamond/700.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import {useEffect, useState} from 'react';
import {continueRender, delayRender} from 'remotion';

const FACES = [
  'italic 500 66px "Cormorant Garamond"',
  'italic 600 60px "Cormorant Garamond"',
  '600 40px "Cormorant Garamond"',
  '700 90px "Cormorant Garamond"',
  '500 22px Inter',
  '600 22px Inter',
];

/** Blocks rendering until every font face used by the reel is loaded (no fallback-font frames). */
export const useFonts = () => {
  const [handle] = useState(() => delayRender('Loading fonts'));
  useEffect(() => {
    Promise.all(FACES.map((f) => document.fonts.load(f, 'AaBb'))).then(
      () => continueRender(handle),
      () => continueRender(handle),
    );
  }, [handle]);
};
