import { mulberry32 } from './util.js';

// Everyone who appears in the reel. Colours are muted and earthy to match the
// reference; skin tones are deliberately diverse.
export const SKIN = ['#f1c9a5', '#e0ac7e', '#c68c5c', '#b07a4d', '#a8714a', '#8d5a36', '#6b4226', '#4e2f1c'];

export const MODERN = [
  { name: 'Teen (hoodie, phone)', skin: '#c68c5c', hair: { style: 'short', color: '#1e1410' }, top: { type: 'hoodie', color: '#5b6b8c', sleeves: 'long' }, pants: '#363b46', shoes: '#e6e0d4', props: { phone: true } },
  { name: 'Mother', skin: '#e0ac7e', hair: { style: 'long', color: '#3a2416' }, top: { type: 'coat', color: '#a8574a', sleeves: 'long', hem: 28 }, pants: '#3b3633', shoes: '#4a3428' },
  { name: 'Child', h: 0.6, headScale: 1.28, limb: 0.92, skin: '#e0ac7e', hair: { style: 'ponytail', color: '#3a2416' }, top: { type: 'dress', color: '#d9b25f', sleeves: 'short', hem: 24, flare: 3 }, shoes: '#9c4a3a' },
  { name: 'Old man (cane)', skin: '#f1c9a5', hair: { style: 'balding', color: '#d9d3c8' }, beard: { style: 'mustache', color: '#d9d3c8' }, top: { type: 'coat', color: '#7a6a55', sleeves: 'long', hem: 26 }, pants: '#4a4238', shoes: '#3a2c22', props: { cane: true } },
  { name: 'Businessman', skin: '#8d5a36', hair: { style: 'short', color: '#1a120c' }, top: { type: 'suit', color: '#2f3640', color2: '#8e2b2b', sleeves: 'long' }, pants: '#2f3640', shoes: '#1d1714', props: { phone: true } },
  { name: 'Student (backpack)', skin: '#a8714a', hair: { style: 'curly', color: '#2a1a12' }, top: { type: 'tee', color: '#6f8f6a', sleeves: 'short' }, pants: '#40506a', shoes: '#e6e0d4', props: { backpack: '#b5653a', glasses: true } },
  { name: 'Girl in headscarf', skin: '#c68c5c', hair: { style: 'scarf', color: '#6b4e7a' }, top: { type: 'dress', color: '#b9a58a', sleeves: 'long', hem: 40 }, shoes: '#3a2c22' },
  { name: 'Young woman (phone)', skin: '#6b4226', hair: { style: 'afro', color: '#1a110b' }, top: { type: 'sweater', color: '#d08b4c', sleeves: 'long' }, pants: '#2e2a28', shoes: '#efe9de', props: { phone: true } },
  { name: 'Bearded man', skin: '#e0ac7e', hair: { style: 'short', color: '#2b1d14' }, beard: { style: 'full', color: '#2b1d14' }, top: { type: 'shirt', color: '#4f7c86', sleeves: 'long' }, pants: '#3b4250', shoes: '#4a3428' },
  { name: 'Woman (bun)', skin: '#f1c9a5', hair: { style: 'bun', color: '#6a4426' }, top: { type: 'coat', color: '#566b5a', sleeves: 'long', hem: 30 }, pants: '#3b3a36', shoes: '#2c2420' },
  { name: 'Young man', skin: '#4e2f1c', hair: { style: 'short', color: '#140d08' }, top: { type: 'tee', color: '#8a3f3a', sleeves: 'short' }, pants: '#3a3f4a', shoes: '#efe9de', props: { phone: true } },
];

export const DOUBTER = { name: 'The doubter', res: 900, skin: '#a8714a', hair: { style: 'curly', color: '#1e1410' }, top: { type: 'hoodie', color: '#4a5a6e', sleeves: 'long' }, pants: '#3a3f48', shoes: '#d8d2c8' };

export const MOSES = { name: 'Moses', res: 520, skin: '#b07a4d', hair: { style: 'shoulder', color: '#ece6dc' }, beard: { style: 'long', color: '#ece6dc' }, browCol: '#cfc6b8', top: { type: 'robe', color: '#8b5e3c', sleeves: 'long', hem: 42, sash: '#c8a77a' }, shoes: '#5a3e28', props: { staff: true } };

export const THOMAS = { name: 'Thomas', res: 900, skin: '#a8714a', hair: { style: 'short', color: '#1e1410' }, beard: { style: 'full', color: '#1e1410' }, top: { type: 'robe', color: '#7a5233', sleeves: 'long', hem: 42, sash: '#b89a6a' }, shoes: '#4a3020' };

export const JESUS = { name: 'Jesus', res: 900, skin: '#b07a4d', hair: { style: 'shoulder', color: '#3a2416' }, beard: { style: 'short', color: '#3a2416' }, top: { type: 'robe', color: '#ece4d4', sleeves: 'long', hem: 43, sashDiag: '#9a3b34' }, shoes: '#6a4a30', scars: true, glow: 'rgba(255,214,140,0.95)' };

export const DISCIPLES = [
  { name: 'Disciple 1', res: 520, skin: '#8d5a36', hair: { style: 'short', color: '#1a120c' }, beard: { style: 'full', color: '#1a120c' }, top: { type: 'robe', color: '#9c7a54', sleeves: 'long', hem: 42, sash: '#6f5a3e' }, shoes: '#4a3020' },
  { name: 'Disciple 2', res: 520, skin: '#c68c5c', hair: { style: 'cover', color: '#6f7f95', color2: '#4e5a6c' }, beard: { style: 'short', color: '#2b1d14' }, top: { type: 'robe', color: '#a89b80', sleeves: 'long', hem: 42 }, shoes: '#4a3020' },
  { name: 'Disciple 3', res: 520, skin: '#b07a4d', hair: { style: 'balding', color: '#5a4a3a' }, beard: { style: 'full', color: '#8a8070' }, top: { type: 'robe', color: '#a46a4b', sleeves: 'long', hem: 42, sash: '#d1b48c' }, shoes: '#4a3020' },
];

const TUNICS = ['#c8a77a', '#b08d62', '#9c7a54', '#d1b48c', '#a46a4b', '#7d8a6a', '#8a6f8e', '#6f7f95', '#c2945c', '#a89b80', '#8b5e3c', '#b9a58a'];
const COVERS = ['#e6dcc6', '#c9b28a', '#8a6f5a', '#6f7f95', '#a46a4b', '#d8cbb0', '#7d8a6a'];
const DSKIN = ['#c68c5c', '#b07a4d', '#a8714a', '#8d5a36', '#6b4226', '#e0ac7e'];

export function israelites(n, seed = 7) {
  const r = mulberry32(seed);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const out = [];
  for (let i = 0; i < n; i++) {
    const kind = r();
    const woman = kind < 0.42, child = kind > 0.88, old = !child && r() < 0.15;
    const hairCol = old ? '#d9d3c8' : pick(['#1a120c', '#2b1d14', '#3a2416', '#1e1410']);
    const spec = {
      name: `Israelite ${i + 1}`,
      skin: pick(DSKIN),
      h: child ? 0.62 : 0.94 + r() * 0.12,
      headScale: child ? 1.25 : 1,
      build: 0.92 + r() * 0.2,
      top: { type: 'tunic', color: pick(TUNICS), sleeves: r() < 0.5 ? 'short' : 'long', hem: child ? 24 : woman ? 40 : 30 + r() * 10, sash: r() < 0.6 ? pick(TUNICS) : null },
      shoes: '#5a3e28',
      res: 300,
    };
    if (woman) spec.hair = { style: r() < 0.7 ? 'scarf' : 'long', color: r() < 0.7 ? pick(COVERS) : hairCol };
    else if (child) spec.hair = { style: r() < 0.5 ? 'short' : 'curly', color: hairCol };
    else {
      spec.hair = r() < 0.55 ? { style: 'cover', color: pick(COVERS), color2: r() < 0.5 ? '#3a2a1e' : null } : { style: r() < 0.5 ? 'short' : 'curly', color: hairCol };
      if (r() < 0.75) spec.beard = { style: old ? 'long' : 'full', color: hairCol };
    }
    out.push(spec);
  }
  return out;
}
