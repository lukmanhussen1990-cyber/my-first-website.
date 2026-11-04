import {loadFont} from '@remotion/google-fonts/Caveat';

// Caveat: a hand-written font for the note on the back of the photo, the recipe book and the home-made banner.
export const caveat = loadFont('normal', {weights: ['600', '700'], subsets: ['latin']});
export const CAVEAT = caveat.fontFamily;
