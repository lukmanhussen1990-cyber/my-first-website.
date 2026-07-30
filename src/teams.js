/**
 * Team and formation data. Formation slots are given in normalised pitch
 * coordinates for a side attacking towards +x: x = 0 is your own goal line,
 * x = 1 is the opponent goal line, y = 0 is the top touchline.
 */

export const ROLE = {
  GK: 'GK',
  DEF: 'DEF',
  MID: 'MID',
  FWD: 'FWD',
};

export const FORMATIONS = {
  '4-3-3': {
    label: '4-3-3',
    slots: [
      { role: ROLE.GK, x: 0.035, y: 0.5, tag: 'GK' },
      { role: ROLE.DEF, x: 0.2, y: 0.14, tag: 'RB' },
      { role: ROLE.DEF, x: 0.16, y: 0.38, tag: 'CB' },
      { role: ROLE.DEF, x: 0.16, y: 0.62, tag: 'CB' },
      { role: ROLE.DEF, x: 0.2, y: 0.86, tag: 'LB' },
      { role: ROLE.MID, x: 0.36, y: 0.5, tag: 'CDM' },
      { role: ROLE.MID, x: 0.47, y: 0.28, tag: 'CM' },
      { role: ROLE.MID, x: 0.47, y: 0.72, tag: 'CM' },
      { role: ROLE.FWD, x: 0.68, y: 0.13, tag: 'RW' },
      { role: ROLE.FWD, x: 0.72, y: 0.5, tag: 'ST' },
      { role: ROLE.FWD, x: 0.68, y: 0.87, tag: 'LW' },
    ],
  },
  '4-4-2': {
    label: '4-4-2',
    slots: [
      { role: ROLE.GK, x: 0.035, y: 0.5, tag: 'GK' },
      { role: ROLE.DEF, x: 0.2, y: 0.14, tag: 'RB' },
      { role: ROLE.DEF, x: 0.16, y: 0.38, tag: 'CB' },
      { role: ROLE.DEF, x: 0.16, y: 0.62, tag: 'CB' },
      { role: ROLE.DEF, x: 0.2, y: 0.86, tag: 'LB' },
      { role: ROLE.MID, x: 0.44, y: 0.13, tag: 'RM' },
      { role: ROLE.MID, x: 0.4, y: 0.39, tag: 'CM' },
      { role: ROLE.MID, x: 0.4, y: 0.61, tag: 'CM' },
      { role: ROLE.MID, x: 0.44, y: 0.87, tag: 'LM' },
      { role: ROLE.FWD, x: 0.7, y: 0.38, tag: 'ST' },
      { role: ROLE.FWD, x: 0.7, y: 0.62, tag: 'ST' },
    ],
  },
  '4-2-3-1': {
    label: '4-2-3-1',
    slots: [
      { role: ROLE.GK, x: 0.035, y: 0.5, tag: 'GK' },
      { role: ROLE.DEF, x: 0.21, y: 0.14, tag: 'RB' },
      { role: ROLE.DEF, x: 0.16, y: 0.38, tag: 'CB' },
      { role: ROLE.DEF, x: 0.16, y: 0.62, tag: 'CB' },
      { role: ROLE.DEF, x: 0.21, y: 0.86, tag: 'LB' },
      { role: ROLE.MID, x: 0.34, y: 0.4, tag: 'CDM' },
      { role: ROLE.MID, x: 0.34, y: 0.6, tag: 'CDM' },
      { role: ROLE.MID, x: 0.56, y: 0.16, tag: 'RAM' },
      { role: ROLE.MID, x: 0.56, y: 0.5, tag: 'CAM' },
      { role: ROLE.MID, x: 0.56, y: 0.84, tag: 'LAM' },
      { role: ROLE.FWD, x: 0.75, y: 0.5, tag: 'ST' },
    ],
  },
  '3-5-2': {
    label: '3-5-2',
    slots: [
      { role: ROLE.GK, x: 0.035, y: 0.5, tag: 'GK' },
      { role: ROLE.DEF, x: 0.17, y: 0.28, tag: 'CB' },
      { role: ROLE.DEF, x: 0.14, y: 0.5, tag: 'CB' },
      { role: ROLE.DEF, x: 0.17, y: 0.72, tag: 'CB' },
      { role: ROLE.MID, x: 0.44, y: 0.08, tag: 'RWB' },
      { role: ROLE.MID, x: 0.36, y: 0.36, tag: 'CM' },
      { role: ROLE.MID, x: 0.34, y: 0.5, tag: 'CDM' },
      { role: ROLE.MID, x: 0.36, y: 0.64, tag: 'CM' },
      { role: ROLE.MID, x: 0.44, y: 0.92, tag: 'LWB' },
      { role: ROLE.FWD, x: 0.72, y: 0.4, tag: 'ST' },
      { role: ROLE.FWD, x: 0.72, y: 0.6, tag: 'ST' },
    ],
  },
};

/**
 * Squads are generated from a rating and a colour identity, which keeps the
 * data small while still giving each side a distinct feel on the pitch.
 */
export const TEAMS = [
  {
    id: 'azzurri',
    name: 'Marina Azzurri',
    short: 'AZZ',
    rating: 84,
    formation: '4-3-3',
    kit: { shirt: '#1e5fd8', shorts: '#0b2f74', trim: '#f4f7ff', number: '#ffffff' },
    keeperKit: { shirt: '#f6d743', shorts: '#1a1a1a', trim: '#1a1a1a', number: '#1a1a1a' },
    altKit: { shirt: '#f5f7fb', shorts: '#1e5fd8', trim: '#1e5fd8', number: '#1e3a8a' },
    style: { width: 0.9, tempo: 1.05, line: 0.58, press: 1.0 },
  },
  {
    id: 'rovers',
    name: 'Northgate Rovers',
    short: 'NGR',
    rating: 80,
    formation: '4-4-2',
    kit: { shirt: '#d8232a', shorts: '#ffffff', trim: '#ffffff', number: '#ffffff' },
    keeperKit: { shirt: '#33d17a', shorts: '#123021', trim: '#0d2318', number: '#0d2318' },
    altKit: { shirt: '#101820', shorts: '#101820', trim: '#d8232a', number: '#ffffff' },
    style: { width: 0.82, tempo: 0.95, line: 0.5, press: 1.05 },
  },
  {
    id: 'harbour',
    name: 'Harbour City',
    short: 'HBC',
    rating: 87,
    formation: '4-2-3-1',
    kit: { shirt: '#6fd4ff', shorts: '#0e2a3d', trim: '#0e2a3d', number: '#0b2233' },
    keeperKit: { shirt: '#ff7ad9', shorts: '#2a0d24', trim: '#2a0d24', number: '#2a0d24' },
    altKit: { shirt: '#0e2a3d', shorts: '#0e2a3d', trim: '#6fd4ff', number: '#6fd4ff' },
    style: { width: 0.95, tempo: 1.1, line: 0.62, press: 1.1 },
  },
  {
    id: 'kestrels',
    name: 'Ashvale Kestrels',
    short: 'AVK',
    rating: 77,
    formation: '3-5-2',
    kit: { shirt: '#f2f2f2', shorts: '#1b1b1b', trim: '#1b1b1b', number: '#1b1b1b' },
    keeperKit: { shirt: '#7b3ff2', shorts: '#1b1030', trim: '#1b1030', number: '#ffffff' },
    altKit: { shirt: '#8b1e3f', shorts: '#3d0c1c', trim: '#f2f2f2', number: '#ffffff' },
    style: { width: 0.75, tempo: 0.9, line: 0.44, press: 0.9 },
  },
  {
    id: 'olympia',
    name: 'Olympia Verde',
    short: 'OLV',
    rating: 82,
    formation: '4-3-3',
    kit: { shirt: '#0f9d58', shorts: '#f2f2f2', trim: '#f2f2f2', number: '#ffffff' },
    keeperKit: { shirt: '#ff9f1c', shorts: '#33240a', trim: '#33240a', number: '#33240a' },
    altKit: { shirt: '#f7f3e3', shorts: '#0f9d58', trim: '#0f9d58', number: '#0b5c34' },
    style: { width: 0.88, tempo: 1.0, line: 0.55, press: 0.95 },
  },
  {
    id: 'atlas',
    name: 'Atlas Dynamo',
    short: 'ATD',
    rating: 85,
    formation: '4-2-3-1',
    kit: { shirt: '#ffcc00', shorts: '#14213d', trim: '#14213d', number: '#14213d' },
    keeperKit: { shirt: '#e63946', shorts: '#2a0a0e', trim: '#2a0a0e', number: '#ffffff' },
    altKit: { shirt: '#14213d', shorts: '#14213d', trim: '#ffcc00', number: '#ffcc00' },
    style: { width: 0.85, tempo: 1.02, line: 0.6, press: 1.08 },
  },
  {
    id: 'corsairs',
    name: 'Port Royal Corsairs',
    short: 'PRC',
    rating: 79,
    formation: '4-4-2',
    kit: { shirt: '#111827', shorts: '#111827', trim: '#c084fc', number: '#ffffff' },
    keeperKit: { shirt: '#22d3ee', shorts: '#083344', trim: '#083344', number: '#083344' },
    altKit: { shirt: '#e9e4f0', shorts: '#111827', trim: '#7c3aed', number: '#111827' },
    style: { width: 0.8, tempo: 0.93, line: 0.46, press: 1.0 },
  },
  {
    id: 'sierra',
    name: 'Sierra Nevada',
    short: 'SNV',
    rating: 76,
    formation: '4-4-2',
    kit: { shirt: '#fb923c', shorts: '#7c2d12', trim: '#fff7ed', number: '#ffffff' },
    keeperKit: { shirt: '#a3e635', shorts: '#1a2e05', trim: '#1a2e05', number: '#1a2e05' },
    altKit: { shirt: '#123f5c', shorts: '#0b2537', trim: '#fb923c', number: '#ffffff' },
    style: { width: 0.78, tempo: 0.9, line: 0.42, press: 0.88 },
  },
];

const FIRST_NAMES = [
  'Luka', 'Mateo', 'Idris', 'Kenji', 'Samir', 'Nico', 'Tobias', 'Andre', 'Emeka', 'Rafa',
  'Yuki', 'Diego', 'Omar', 'Jonas', 'Karim', 'Milan', 'Theo', 'Ravi', 'Sacha', 'Bruno',
  'Aksel', 'Dylan', 'Enzo', 'Faisal', 'Gio', 'Hugo', 'Ilias', 'Jude', 'Kai', 'Leo',
];
const LAST_NAMES = [
  'Moreau', 'Vidal', 'Okafor', 'Tanaka', 'Haddad', 'Berg', 'Lindqvist', 'Costa', 'Nwosu', 'Rivas',
  'Sato', 'Alvarez', 'Farouk', 'Keller', 'Benali', 'Petrovic', 'Dubois', 'Sharma', 'Leroy', 'Almeida',
  'Nyquist', 'Hughes', 'Ferrari', 'Mansour', 'Rossi', 'Novak', 'Abara', 'Whitlock', 'Ivanov', 'Quinn',
];

function pseudoRandom(seed) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Attribute profile per role, expressed as multipliers around the team rating. */
const ROLE_PROFILE = {
  GK: { pace: 0.82, shooting: 0.5, passing: 0.86, defending: 0.7, physical: 1.02, keeper: 1.08 },
  DEF: { pace: 0.95, shooting: 0.7, passing: 0.9, defending: 1.1, physical: 1.06, keeper: 0.4 },
  MID: { pace: 0.98, shooting: 0.94, passing: 1.08, defending: 0.97, physical: 0.98, keeper: 0.4 },
  FWD: { pace: 1.07, shooting: 1.12, passing: 0.95, defending: 0.72, physical: 0.96, keeper: 0.4 },
};

/**
 * Build a squad of 11 players for a team, deterministic per team id so the
 * same names and attributes come back every match.
 */
export function buildSquad(team) {
  const formation = FORMATIONS[team.formation];
  const seedBase = [...team.id].reduce((a, c) => a + c.charCodeAt(0), 0);
  return formation.slots.map((slot, index) => {
    const seed = seedBase * 31 + index * 7;
    const profile = ROLE_PROFILE[slot.role];
    const variance = (pseudoRandom(seed) - 0.5) * 8;
    const base = team.rating + variance;
    const attr = (mult, jitter) =>
      Math.round(Math.max(35, Math.min(99, base * mult + (pseudoRandom(seed + jitter) - 0.5) * 7)));
    return {
      number: slot.role === 'GK' ? 1 : index + 1,
      name: `${FIRST_NAMES[Math.floor(pseudoRandom(seed + 1) * FIRST_NAMES.length)]} ${
        LAST_NAMES[Math.floor(pseudoRandom(seed + 2) * LAST_NAMES.length)]
      }`,
      role: slot.role,
      tag: slot.tag,
      slot,
      attributes: {
        pace: attr(profile.pace, 3),
        shooting: attr(profile.shooting, 4),
        passing: attr(profile.passing, 5),
        defending: attr(profile.defending, 6),
        physical: attr(profile.physical, 7),
        keeper: attr(profile.keeper, 8),
      },
    };
  });
}

export const getTeam = (id) => TEAMS.find((t) => t.id === id) || TEAMS[0];

function toRgb(hex) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/**
 * Rough perceptual distance between two shirt colours. Weighted towards how
 * different they look at a glance rather than strict colour science.
 */
export function colourDistance(a, b) {
  const [r1, g1, b1] = toRgb(a);
  const [r2, g2, b2] = toRgb(b);
  const rMean = (r1 + r2) / 2;
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(((512 + rMean) * dr * dr) / 256 + 4 * dg * dg + ((767 - rMean) * db * db) / 256);
}

function hueSat(hex) {
  const [r, g, b] = toRgb(hex).map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 0.0001) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max === 0 ? 0 : d / max];
}

/**
 * Two kits clash if they are close in raw colour, or if they simply read as
 * "the same colour" at a glance — royal blue against sky blue, for instance.
 */
function kitsClash(a, b) {
  if (colourDistance(a, b) < 165) return true;
  const [ha, sa] = hueSat(a);
  const [hb, sb] = hueSat(b);
  if (sa < 0.22 || sb < 0.22) return false; // near-greys are told apart by tone
  const hueDiff = Math.min(Math.abs(ha - hb), 360 - Math.abs(ha - hb));
  return hueDiff < 30;
}

/** Picks the away side's kit so the two teams are never hard to tell apart. */
export function resolveKits(homeTeam, awayTeam) {
  const home = homeTeam.kit;
  if (!kitsClash(home.shirt, awayTeam.kit.shirt)) return awayTeam.kit;
  if (awayTeam.altKit && !kitsClash(home.shirt, awayTeam.altKit.shirt)) {
    return awayTeam.altKit;
  }
  // Last resort: a neutral kit that cannot clash with anything dark or light.
  const homeIsDark = toRgb(home.shirt).reduce((a, c) => a + c, 0) < 380;
  return homeIsDark
    ? { shirt: '#f4f6fb', shorts: '#d8dde6', trim: '#1b1f27', number: '#1b1f27' }
    : { shirt: '#1a1f2b', shorts: '#12161f', trim: '#f4f6fb', number: '#f4f6fb' };
}
