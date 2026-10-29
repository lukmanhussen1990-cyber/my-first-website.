import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/500-italic.css';
import '@fontsource/cormorant-garamond/600-italic.css';
import '@fontsource/cormorant-garamond/700.css';
import '@fontsource/cormorant-garamond/700-italic.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import {useEffect, useState} from 'react';
import {continueRender, delayRender} from 'remotion';

export const SERIF = '"Cormorant Garamond", Georgia, serif';
export const SANS = 'Inter, "Helvetica Neue", Arial, sans-serif';

const FACES = [
  '500 66px "Cormorant Garamond"', 'italic 500 66px "Cormorant Garamond"', 'italic 600 66px "Cormorant Garamond"',
  '700 66px "Cormorant Garamond"', 'italic 700 66px "Cormorant Garamond"', '500 24px Inter', '600 24px Inter', '700 24px Inter',
];

// Holds the render until every web font is ready, so frame 1 never shows a fallback font.
export const FontGate: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [handle] = useState(() => delayRender('Loading fonts'));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    Promise.all(FACES.map((f) => document.fonts.load(f, 'AaĀā…“”'))).then(() => {
      setReady(true);
      continueRender(handle);
    });
  }, [handle]);
  return ready ? <>{children}</> : null;
};
