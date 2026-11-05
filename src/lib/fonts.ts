import {loadFont} from '@remotion/fonts';
import {staticFile} from 'remotion';

/*
 * Poppins (600 + ExtraBold 800). The headless renderer here cannot reach fonts.gstatic.com,
 * so the same Google Font files are bundled locally (from the @fontsource/poppins package).
 */
export const POPPINS = 'Poppins';

let p: Promise<unknown> | null = null;
export const fontsReady = (): Promise<unknown> => {
	if (!p) {
		p = Promise.all([
			loadFont({family: POPPINS, url: staticFile('fonts/poppins-latin-800-normal.woff2'), weight: '800'}),
			loadFont({family: POPPINS, url: staticFile('fonts/poppins-latin-600-normal.woff2'), weight: '600'}),
		]).then(() => Promise.all([document.fonts.load(`800 64px ${POPPINS}`), document.fonts.load(`600 64px ${POPPINS}`)]));
	}
	return p;
};
