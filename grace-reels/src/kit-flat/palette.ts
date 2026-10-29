// Grace in Motion · flat style palette.
// Every colour used by the flat kit lives here. Values were measured from
// reference/flat_style.mp4 (see reference/style_notes_flat.md) and rounded
// towards the STYLE LOCK values.

export const C = {
  // line work
  ink: '#1E1C22', // character + prop outlines, ground line
  captionInk: '#1C1B1F',

  // robes (muted pastels)
  robeBlue: '#97AFCC',
  robeRust: '#B47C52',
  robeBlush: '#E6C7C2',
  robeCream: '#E6DDCA',
  robeGrey: '#A9AEB8',
  robeStone: '#C3BAA6',
  robeSage: '#A7B49A',
  youBlue: '#C9DAEA', // the "YOU" figure: pale blue, faceless
  face: '#5E4636', // dark-brown face + pointed beard

  // Jesus
  jesusFill: '#FBF5E6',
  jesusLine: '#C29A45',
  jesusGlow: '#FFD89A',

  // skies
  nightTop: '#262A54',
  nightMid: '#3B3D69',
  nightLow: '#5E5E8E',
  nightHorizon: '#8C8AA3',
  stormTop: '#1C2033',
  stormMid: '#2E3348',
  stormLow: '#4A4F63',
  stormHorizon: '#6A6E7E',
  dawnTop: '#F3DDBF',
  dawnLow: '#ECCFAA',
  dawnHorizon: '#F4C98E',
  star: '#FFFFFF',
  moon: '#F5EDD4',
  moonLine: '#E3D3A8',
  moonCrater: '#E7D8B2',
  moonGlow: '#FFF3D0',

  // below the ground line
  fogTop: '#C9C9CF',
  fogMid: '#F5F3EF',
  fogLow: '#EFEDE9',
  fogDash: '#D9D6CF',
  seaTop: '#D6E2EB',
  seaLow: '#CBD8E2',
  seaLine: '#8FA6BA',
  stormSea: '#9DB0C0',
  stormSeaDeep: '#7F94A8',
  stormSeaLine: '#5F7488',
  foam: '#F4F7F9',
  path: '#EADFC6',
  pathLine: '#CDBB98',
  grass: '#6B6F67',

  // props
  wood: '#D6A574',
  woodDark: '#A9784B',
  woodLine: '#8C6440',
  plank: '#E8D3A5',
  plankLine: '#B89B6A',
  stone: '#8E897E',
  stoneLight: '#B4AEA2',
  coal: '#2A2629',
  ember: '#E0563A',
  emberGold: '#F2A33A',
  flameOuter: '#E2562E',
  flameMid: '#F08A32',
  flameInner: '#F7C24E',
  treeFill: '#A9B394',
  treeLine: '#6E7A5E',
  trunk: '#8F7A64',
  house: '#D9C3A0',
  roof: '#A0705A',
  window: '#F8D27A',
  cloud: '#C8C5C9',
  cloudDark: '#8E8A99',
  paper: '#FBF5E6',
  paperLine: '#C9C2B2',
  net: '#8C7A62',

  // text accents
  gold: '#C8952E',
  red: '#B4432F',
  blue: '#3D6494',
  green: '#2F7A68',
  cream: '#FBF5E6',
  labelRing: '#FFF8EA',
  tear: '#7FA6D6',
  heartPink: '#EFCEC9',
};

export type KeywordTone = 'gold' | 'red' | 'blue' | 'green';

export const toneColor = (t: KeywordTone | undefined): string =>
  t ? C[t] : C.captionInk;

// Layout constants (1080 × 1920 canvas)
export const W = 1080;
export const H = 1920;
export const GROUND_Y = 1180;
export const OUTLINE = 6;
export const THIN = 3;
export const CAPTION_Y = 1385; // centre of the caption block
export const SAFE_BOTTOM = 1450;
export const SAFE_RIGHT = 960;
