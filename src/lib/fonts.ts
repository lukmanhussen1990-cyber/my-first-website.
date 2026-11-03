import {loadFont} from '@remotion/google-fonts/Poppins';

// Poppins ExtraBold (800) for captions, Bold/Black for signs drawn on canvases.
export const poppins = loadFont('normal', {weights: ['700', '800', '900'], subsets: ['latin']});
export const POPPINS = poppins.fontFamily;
