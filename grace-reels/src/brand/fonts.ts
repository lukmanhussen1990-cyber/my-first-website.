import {loadFont} from '@remotion/fonts';
// Fonts come from npm (@fontsource) — bundled, nothing fetched at render time.
import cormorant700 from '@fontsource/cormorant-garamond/files/cormorant-garamond-latin-700-normal.woff2';
import cormorant500i from '@fontsource/cormorant-garamond/files/cormorant-garamond-latin-500-italic.woff2';
import inter400 from '@fontsource/inter/files/inter-latin-400-normal.woff2';
import inter500 from '@fontsource/inter/files/inter-latin-500-normal.woff2';
import inter600 from '@fontsource/inter/files/inter-latin-600-normal.woff2';

const faces = [
	{family: 'Cormorant Garamond', url: cormorant700, weight: '700', style: 'normal'},
	{family: 'Cormorant Garamond', url: cormorant500i, weight: '500', style: 'italic'},
	{family: 'Inter', url: inter400, weight: '400', style: 'normal'},
	{family: 'Inter', url: inter500, weight: '500', style: 'normal'},
	{family: 'Inter', url: inter600, weight: '600', style: 'normal'},
] as const;

let started = false;
/** Registers the brand fonts once; Remotion holds the render until they are loaded. */
export const loadBrandFonts = () => {
	if (started) return;
	started = true;
	for (const f of faces) {
		loadFont({family: f.family, url: f.url, weight: f.weight, style: f.style});
	}
};
