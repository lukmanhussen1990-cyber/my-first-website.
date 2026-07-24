/* ==========================================================================
   icons.js — Original SVG icon library (no third-party / OS assets)
   Two kinds:
   - line icons: monochrome stroke icons for UI (returned as inline SVG)
   - app icons: colorful gradient tiles for app launchers / files
   ========================================================================== */

// A single reusable gradient def per accent-neutral palette.
const S = (paths, opts = {}) => {
  const { stroke = true, fill = false, vb = 24 } = opts;
  const attrs = stroke
    ? 'fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"'
    : `fill="currentColor"`;
  return `<svg viewBox="0 0 ${vb} ${vb}" ${attrs}>${paths}</svg>`;
};

/* ---- UI line icons ---- */
export const line = {
  close: () => S('<path d="M6 6l12 12M18 6L6 18"/>'),
  minimize: () => S('<path d="M5 12h14"/>'),
  maximize: () => S('<rect x="5" y="5" width="14" height="14" rx="2"/>'),
  restore: () =>
    S('<rect x="7" y="7" width="11" height="11" rx="2"/><path d="M5 15V6a1 1 0 0 1 1-1h9"/>'),
  bell: () =>
    S('<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z"/><path d="M10 20a2 2 0 0 0 4 0"/>'),
  theme: () =>
    S('<circle cx="12" cy="12" r="5"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/>'),
  search: () => S('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
  power: () => S('<path d="M12 3v9"/><path d="M6.6 6.6a8 8 0 1 0 10.8 0"/>'),
  settings: () =>
    S('<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v2.2M12 19.3v2.2M4.2 7l1.9 1.1M17.9 15.9l1.9 1.1M4.2 17l1.9-1.1M17.9 8.1l1.9-1.1"/>'),
  trash: () =>
    S('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
  folder: () => S('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>'),
  file: () => S('<path d="M6 3h8l4 4v14H6Z"/><path d="M14 3v4h4"/>'),
  home: () => S('<path d="M4 11l8-6 8 6"/><path d="M6 10v9h12v-9"/>'),
  save: () =>
    S('<path d="M5 4h11l3 3v13H5Z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>'),
  plus: () => S('<path d="M12 5v14M5 12h14"/>'),
  play: () => S('<path d="M7 5l12 7-12 7Z"/>', { stroke: false }),
  pause: () => S('<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>', { stroke: false }),
  next: () => S('<path d="M6 5l9 7-9 7Z"/><rect x="17" y="5" width="2.4" height="14" rx="1"/>', { stroke: false }),
  prev: () => S('<path d="M18 5l-9 7 9 7Z"/><rect x="4.6" y="5" width="2.4" height="14" rx="1"/>', { stroke: false }),
  chevronLeft: () => S('<path d="M15 6l-6 6 6 6"/>'),
  chevronRight: () => S('<path d="M9 6l6 6-6 6"/>'),
  chevronDown: () => S('<path d="M6 9l6 6 6-6"/>'),
  refresh: () => S('<path d="M20 11a8 8 0 1 0-1 5"/><path d="M20 5v6h-6"/>'),
  lock: () => S('<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'),
  grid: () => S('<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>'),
  list: () => S('<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1.2"/><circle cx="4" cy="12" r="1.2"/><circle cx="4" cy="18" r="1.2"/>'),
  copy: () => S('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'),
  cut: () => S('<circle cx="6" cy="7" r="2.5"/><circle cx="6" cy="17" r="2.5"/><path d="M8 8.5L20 17M8 15.5L20 7"/>'),
  paste: () => S('<rect x="6" y="4" width="12" height="17" rx="2"/><rect x="9" y="2.5" width="6" height="4" rx="1.2"/>'),
  edit: () => S('<path d="M4 20h4L20 8l-4-4L4 16Z"/><path d="M14 6l4 4"/>'),
  eye: () => S('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>'),
  download: () => S('<path d="M12 4v11M7 11l5 5 5-5"/><path d="M5 20h14"/>'),
  upload: () => S('<path d="M12 20V9M7 13l5-5 5 5"/><path d="M5 20h14"/>'),
  info: () => S('<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="7.8" r="0.6" fill="currentColor"/>'),
  check: () => S('<path d="M5 12l5 5 9-11"/>'),
  warn: () => S('<path d="M12 3l10 17H2Z"/><path d="M12 10v4"/><circle cx="12" cy="17" r="0.6" fill="currentColor"/>'),
  cpu: () => S('<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M10 3v2M14 3v2M10 19v2M14 19v2M3 10h2M3 14h2M19 10h2M19 14h2"/>'),
  brush: () => S('<path d="M4 20s1-4 4-4 3 3 6 0 2-6 2-6"/><path d="M14 4l6 6-6 4-4-6Z"/>'),
  music: () => S('<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>'),
  image: () => S('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="M4 18l5-5 4 4 3-3 4 4"/>'),
  terminal: () => S('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M12 15h5"/>'),
  globe: () => S('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>'),
  note: () => S('<path d="M5 4h10l4 4v12H5Z"/><path d="M9 10h6M9 14h4"/>'),
  calendar: () => S('<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 9h16M8 3v4M16 3v4"/>'),
  game: () => S('<rect x="3" y="8" width="18" height="9" rx="4"/><path d="M8 12.5h-2M7 11v3"/><circle cx="16" cy="12" r="1"/><circle cx="18.5" cy="14" r="1"/>'),
  code: () => S('<path d="M9 8l-4 4 4 4M15 8l4 4-4 4"/>'),
  calc: () => S('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/>'),
  mine: () => S('<circle cx="12" cy="12" r="6"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>'),
  volume: () => S('<path d="M5 9v6h4l5 4V5L9 9Z"/><path d="M17 9a4 4 0 0 1 0 6"/>'),
  volumeMute: () => S('<path d="M5 9v6h4l5 4V5L9 9Z"/><path d="M17 9l4 6M21 9l-4 6"/>'),
  shuffle: () => S('<path d="M3 6h4l10 12h4M17 4l4 2-4 2M3 18h4l3-3.5"/>'),
  repeat: () => S('<path d="M4 9V7a2 2 0 0 1 2-2h12l-3-3M20 15v2a2 2 0 0 1-2 2H6l3 3"/>'),
  fullscreen: () => S('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  x: () => S('<path d="M6 6l12 12M18 6L6 18"/>'),
  arrowUp: () => S('<path d="M12 19V5M6 11l6-6 6 6"/>'),
  arrowDown: () => S('<path d="M12 5v14M6 13l6 6 6-6"/>'),
  arrowLeft: () => S('<path d="M19 12H5M11 6l-6 6 6 6"/>'),
  arrowRight: () => S('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  eraser: () => S('<path d="M4 15l7-7 6 6-4 4H8Z"/><path d="M9 20h11"/>'),
  fill: () => S('<path d="M5 11l7-7 7 7-7 7-7-7Z"/><path d="M19 15c1 2 2 2 2 3.5A2 2 0 0 1 19 20"/>'),
  pencil: () => S('<path d="M4 20h4L20 8l-4-4L4 16Z"/><path d="M13 7l4 4"/>'),
  line2: () => S('<path d="M5 19L19 5"/>'),
  rect: () => S('<rect x="5" y="7" width="14" height="10" rx="1.5"/>'),
  circle: () => S('<circle cx="12" cy="12" r="7"/>'),
  monitor: () => S('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>'),
  palette: () => S('<path d="M12 3a9 9 0 1 0 0 18c1 0 1.5-1 1-2-.4-1 .3-2 1.5-2H17a4 4 0 0 0 0-8c-2-3-3-6-5-6Z"/><circle cx="8" cy="10" r="1"/><circle cx="12" cy="8" r="1"/><circle cx="16" cy="10" r="1"/>'),
  menu: () => S('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  dots: () => S('<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>'),
  star: () => S('<path d="M12 3l2.6 6 6.4.5-4.9 4.2 1.5 6.3L12 16.9 6.4 20l1.5-6.3L3 9.5 9.4 9Z"/>'),
  drive: () => S('<rect x="3" y="12" width="18" height="7" rx="2"/><path d="M6 12l3-7h6l3 7"/><circle cx="8" cy="15.5" r="1" fill="currentColor"/>'),
};

/* ---- App / file icons: gradient rounded tiles ---- */
function tile(id, stops, inner) {
  return `<svg viewBox="0 0 48 48" width="100%" height="100%">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${stops[0]}"/><stop offset="1" stop-color="${stops[1]}"/>
    </linearGradient></defs>
    <rect x="3" y="3" width="42" height="42" rx="11" fill="url(#${id})"/>
    <g fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" opacity="0.96">${inner}</g>
  </svg>`;
}

let uid = 0;
const g = () => `g${uid++}`;

export const app = {
  files: () => tile(g(), ['#ffb347', '#ff8c42'], '<path d="M13 18a2 2 0 0 1 2-2h5l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H15a2 2 0 0 1-2-2Z"/>'),
  texteditor: () => tile(g(), ['#5b8cff', '#3a6ff0'], '<path d="M17 13h11l4 4v18H17Z"/><path d="M28 13v4h4M21 24h8M21 29h6"/>'),
  calculator: () => tile(g(), ['#38c6a0', '#1f9e86'], '<rect x="15" y="12" width="18" height="24" rx="3"/><path d="M19 18h10M19 24h.01M24 24h.01M29 24h.01M19 30h.01M24 30h.01M29 30h.01"/>'),
  paint: () => tile(g(), ['#ff6b9d', '#c44bd6'], '<path d="M14 34s2-6 6-6 5 4 9 0 3-9 3-9"/><path d="M28 12l8 8-8 6-6-8Z"/>'),
  music: () => tile(g(), ['#a06bff', '#6c4bff'], '<path d="M20 32V17l13-3v15"/><circle cx="17" cy="32" r="3.4"/><circle cx="30" cy="29" r="3.4"/>'),
  photos: () => tile(g(), ['#39c2ff', '#2f8bf0'], '<rect x="12" y="14" width="24" height="20" rx="3"/><circle cx="19" cy="21" r="2.4"/><path d="M13 31l7-7 5 5 4-4 6 6"/>'),
  settings: () => tile(g(), ['#8592ad', '#5a6884'], '<circle cx="24" cy="24" r="4.5"/><path d="M24 13v3.5M24 31.5V35M13 24h3.5M31.5 24H35M16 16l2.5 2.5M29.5 29.5L32 32M16 32l2.5-2.5M29.5 18.5L32 16"/>'),
  taskmgr: () => tile(g(), ['#ff7a7a', '#e24b6a'], '<path d="M14 32l5-8 5 5 5-11 5 14"/><path d="M13 16v18h22"/>'),
  terminal: () => tile(g(), ['#2b3550', '#141a2e'], '<path d="M17 19l6 5-6 5M25 29h8"/>'),
  browser: () => tile(g(), ['#4db8ff', '#4b7bff'], '<circle cx="24" cy="24" r="11"/><path d="M13 24h22M24 13c4 3 4 19 0 22M24 13c-4 3-4 19 0 22"/>'),
  notes: () => tile(g(), ['#ffd24d', '#f5a623'], '<path d="M16 13h12l4 4v18H16Z"/><path d="M21 22h8M21 27h6"/>'),
  calendar: () => tile(g(), ['#ff6b6b', '#e2445b'], '<rect x="13" y="15" width="22" height="20" rx="3"/><path d="M13 21h22M20 12v5M28 12v5"/>'),
  snake: () => tile(g(), ['#4be29a', '#1fae74'], '<path d="M16 16h8v8h8v8h-8v-8h-8Z"/><circle cx="30" cy="20" r="1.4" fill="#fff" stroke="none"/>'),
  minesweeper: () => tile(g(), ['#7a8cff', '#5361e0'], '<circle cx="24" cy="24" r="7"/><path d="M24 13v4M24 31v4M13 24h4M31 24h4M17 17l3 3M28 28l3 3M31 17l-3 3M17 31l3-3"/>'),
  codeeditor: () => tile(g(), ['#22c1c3', '#1a8fb0'], '<path d="M20 18l-6 6 6 6M28 18l6 6-6 6"/>'),
  recyclebin: () => tile(g(), ['#8592ad', '#5a6884'], '<path d="M15 19h18M20 19v-3h8v3M17 19l1.4 16h11.2L31 19"/>'),
  thispc: () => tile(g(), ['#5b8cff', '#8a5bff'], '<rect x="13" y="15" width="22" height="14" rx="2"/><path d="M19 35h10M24 29v6"/>'),
};

/* ---- File-type icons (colored, simpler) ---- */
export function fileTypeIcon(kind) {
  const map = {
    folder: ['#ffcf6b', '#f5a623', '<path d="M13 18a2 2 0 0 1 2-2h5l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H15a2 2 0 0 1-2-2Z"/>'],
    text: ['#7fb0ff', '#4b7bf0', '<path d="M17 13h11l4 4v18H17Z"/><path d="M28 13v4h4M21 23h8M21 28h6"/>'],
    code: ['#22c1c3', '#1a8fb0', '<path d="M17 13h11l4 4v18H17Z"/><path d="M28 13v4h4"/><path d="M23 26l-2 2 2 2M27 26l2 2-2 2"/>'],
    image: ['#7fd8ff', '#37a0f0', '<rect x="14" y="14" width="20" height="20" rx="3"/><circle cx="20" cy="21" r="2"/><path d="M15 31l6-6 4 4 4-4 5 5"/>'],
    audio: ['#c39bff', '#8b5bff', '<path d="M20 30V18l11-2v12"/><circle cx="18" cy="30" r="2.6"/><circle cx="29" cy="28" r="2.6"/>'],
    note: ['#ffe08a', '#f5b423', '<path d="M16 13h12l4 4v18H16Z"/><path d="M21 22h8M21 27h6"/>'],
    doc: ['#9fb3ff', '#5b6ff0', '<path d="M17 13h11l4 4v18H17Z"/><path d="M21 22h8M21 27h8M21 32h5"/>'],
    generic: ['#aab4cc', '#7a879f', '<path d="M17 13h11l4 4v18H17Z"/><path d="M28 13v4h4"/>'],
  };
  const [a, b, inner] = map[kind] || map.generic;
  return tile(g(), [a, b], inner);
}
