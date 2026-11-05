// Global look & output settings. Timing lives in timeline.js.
export const CONFIG = {
  width: 1080,
  height: 1920,
  fps: 30,
  watermark: 'YOUR_CHANNEL',
  font: 'Lilita One',

  caption: {
    size: 100, // px at 1080 wide
    hugeSize: 170, // used by beats with captionStyle: 'huge'
    color: '#FFD21F',
    outline: '#1c0f06', // dark brown / near black
    outlineWidth: 8, // px drawn OUTSIDE the glyphs (stroke is 2x, fill covers inner half)
    shadow: 'rgba(0,0,0,0.55)',
    shadowOffset: 9,
    shadowBlur: 6,
    y: 0.62, // vertical anchor (fraction of height): lower-middle
    maxWidth: 900,
    lineHeight: 1.0,
    popFrames: 6, // 0.8 -> 1.05 -> 1.0
  },

  sfxText: {
    size: 128,
    yellow: '#FFD21F',
    lime: '#7CFC4A',
    dur: 0.9, // seconds on screen (unless the event overrides)
    shakePx: 7,
  },

  palette: {
    sky: '#0a1440',
    skyHorizon: '#1d2f74',
    wall: '#f1d9a6',
    wallTrim: '#d6b27c',
    roof: '#7c3727',
    floor: '#c9653d', // terracotta
    floorAlt: '#b8573a',
    grass: '#55b83a',
    grassDark: '#3f9a2c',
    grassLight: '#73cc4a',
    windowFrame: '#fbf7ee',
    glass: '#0f2366',
    fence: '#c99a63',
    fenceDark: '#a97b48',
    tree: '#2f7a37',
    treeDark: '#23602b',
    trunk: '#6b4326',
    cardboard: '#c8935a',
    cardboardDark: '#a7733f',
    tape: '#e2c08a',
    wood: '#c1904f',
    woodDark: '#9b6d36',
    metal: '#9aa3ad',
    rubber: '#1d1d22',
    tile: '#9fd6cf',
    porcelain: '#f4f6f8',
    pee: '#f2d22a',
  },

  you: { skin: '#e8a57a', shirt: '#2a7fd8', pants: '#232838', hair: '#5a3418', shoes: '#2a1d16' },
  friend: { skin: '#c88758', shirt: '#f27a1d', pants: '#4f7d2a', hat: '#1e2c5e', shoes: '#262626' },
  dog: { body: '#c4793a', ears: '#6a3618', snout: '#e8bd86', collar: '#d23b2f' },
};
