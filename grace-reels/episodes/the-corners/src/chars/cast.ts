import type {Look, Pose} from './Person';

// ------------------------------------------------------------------ character bible (colours)
export const RUTH: Look = {
  skin: '#B47A52', skinShade: '#93603F', garment: 'robe', cloth: '#B4766A', clothShade: '#8E5850',
  belt: '#C9A46A', beltW: 10, head: 'scarf', headCol: '#EFE3C8', headShade: '#CDBF9F', hair: '#3A2418',
};
export const RUTH_BRIDE: Look = {...RUTH, head: 'veil', wreath: true};
export const NAOMI: Look = {
  skin: '#A87452', skinShade: '#8A5C40', garment: 'robe', cloth: '#2F4A6B', clothShade: '#223652',
  belt: '#5B7EA3', beltW: 12, head: 'scarf', headCol: '#9A9690', headShade: '#7A766F', hair: '#8E8A84', wrinkles: true,
};
export const BOAZ: Look = {
  skin: '#A06B48', skinShade: '#82553A', garment: 'robe', cloth: '#2F5D3A', clothShade: '#22452A',
  belt: '#D9A13B', beltShade: '#B5822A', beltW: 16, beltEnds: true, under: '#EADFC6', head: 'short', hair: '#3A3634', hairShade: '#252220',
  beard: 'short', beardCol: '#3D3B3A', beardStreak: '#8A8580', wrinkles: true,
};
export const REAPER_A: Look = {
  skin: '#A9714C', skinShade: '#8A5A3C', garment: 'tunic', cloth: '#E2D3B0', clothShade: '#C2B08A', belt: '#8B6B4A', beltW: 8,
  head: 'wrap', headCol: '#D8C7A0', headShade: '#B6A47C', beard: 'stubble', beardCol: '#3A2A20',
};
export const REAPER_B: Look = {
  skin: '#9C6644', skinShade: '#7E5036', garment: 'tunic', cloth: '#B89A6E', clothShade: '#967A50', belt: '#6B4A2B', beltW: 8,
  head: 'wrap', headCol: '#8B6B4A', headShade: '#6E5236', beard: 'short', beardCol: '#5A5450', wrinkles: true,
};
export const REAPER_C: Look = {
  skin: '#B47E58', skinShade: '#946244', garment: 'tunic', cloth: '#D9C39A', clothShade: '#B9A276', belt: '#A0603A', beltW: 8,
  head: 'scarf', headCol: '#C9915A', headShade: '#A8743E', hair: '#2E1C12',
};
export const MOTHER: Look = {
  skin: '#A6704E', skinShade: '#875A3D', garment: 'robe', cloth: '#8A7560', clothShade: '#6E5C4A', belt: '#6E5C4A', beltW: 8,
  head: 'scarf', headCol: '#9C8E7E', headShade: '#7E7264', hair: '#2E1C12', patch: '#A28C70', thin: 0.86,
};
export const CHILD: Look = {
  skin: '#B07A54', skinShade: '#916040', garment: 'tunic', cloth: '#8F8A80', clothShade: '#726E66', belt: '#6B5A44', beltW: 6,
  head: 'curly', hair: '#2A1A12', hairShade: '#1C110B', child: true, thin: 0.9,
};
export const OLD_MAN: Look = {
  skin: '#9E6A4A', skinShade: '#80543A', garment: 'robe', cloth: '#7E7A72', clothShade: '#625E58', belt: '#5A564F', beltW: 8,
  head: 'bald', hair: '#E8E2D6', beard: 'long', beardCol: '#E6E0D4', wrinkles: true, patch: '#948E84', thin: 0.85,
};
export const TRAVELER: Look = {
  skin: '#8E5E40', skinShade: '#724A32', garment: 'robe', cloth: '#C9923B', clothShade: '#A87628', stripes: ['#3E7C7A', '#3E7C7A', '#3E7C7A', '#3E7C7A', '#3E7C7A'],
  belt: '#5A3E26', beltW: 8, head: 'wrap', headCol: '#3E7C7A', headShade: '#2E5E5C', beard: 'short', beardCol: '#2A1E16', thin: 0.9,
};
export const JESUS: Look = {
  skin: '#A8754F', skinShade: '#895D3D', garment: 'robe', cloth: '#EDE6D6', clothShade: '#CFC6B2', mantle: '#7A5236', mantleShade: '#5E3E28',
  belt: '#8A6A48', beltW: 8, head: 'long', hair: '#3B2A1E', hairShade: '#2A1C14', beard: 'short', beardCol: '#3B2A1E',
};
export const POOR_MAN: Look = {
  skin: '#9A6748', skinShade: '#7C5238', garment: 'robe', cloth: '#8C8780', clothShade: '#6E6A64', belt: '#5E5A54', beltW: 8,
  head: 'short', hair: '#4A4642', hairShade: '#34312E', beard: 'short', beardCol: '#5A5652', patch: '#A09A90', wrinkles: true, thin: 0.84,
};
export const DAVID: Look = {
  skin: '#B47E56', skinShade: '#94643F', garment: 'tunic', cloth: '#D9C29A', clothShade: '#B9A276', belt: '#7A4E2C', beltW: 8,
  head: 'curly', hair: '#8A4B2A', hairShade: '#6A361C', child: true, thin: 0.92,
};
export const JESSE: Look = {
  skin: '#9E6A4A', skinShade: '#80543A', garment: 'robe', cloth: '#7A5A3C', clothShade: '#5E4430', belt: '#C9A46A', beltW: 10,
  head: 'wrap', headCol: '#D8C7A0', headShade: '#B6A47C', beard: 'long', beardCol: '#CFCBC2', wrinkles: true,
};
export const OBED_MAN: Look = {
  skin: '#AC7550', skinShade: '#8C5C3E', garment: 'robe', cloth: '#E3B84E', clothShade: '#BF9636', belt: '#7A4E2C', beltW: 10,
  head: 'short', hair: '#2E1E14', hairShade: '#1E130C', beard: 'short', beardCol: '#2E1E14',
};
export const HELPER: Look = {
  skin: '#8A5A3C', skinShade: '#6E462E', garment: 'hoodie', cloth: '#D9A23A', clothShade: '#B5822A', pants: '#2E3A4F', pantsShade: '#212B3B',
  shoe: '#F4F1EA', shoeShade: '#D6D0C4', head: 'curly', hair: '#1E140E', hairShade: '#120C08',
};
export const IN_NEED: Look = {
  skin: '#B68262', skinShade: '#956648', garment: 'coat', cloth: '#6E6E6A', clothShade: '#55554F', pants: '#3E3A36', pantsShade: '#2C2926',
  shoe: '#4A3A2E', shoeShade: '#382C22', head: 'beanie', headCol: '#2F4A3A', headShade: '#223628', beard: 'short', beardCol: '#9A9690', wrinkles: true,
};

// ------------------------------------------------------------------ poses
export const STAND: Pose = {lean: 2, head: 0, hipF: 3, hipB: -3, kneeF: 2, kneeB: 2, shF: 6, shB: -6, elF: 12, elB: 12};

/** Walk cycle at phase p (radians). `amt` scales the stride (tired walkers ~0.7). */
export const walkPose = (p: number, amt = 1, lean = 4): Pose => {
  const s = Math.sin(p);
  const c = Math.cos(p);
  return {
    lean: lean + Math.abs(c) * 1.5,
    head: Math.sin(p * 2) * 1.5,
    hipF: 20 * s * amt,
    hipB: -20 * s * amt,
    kneeF: Math.max(0, -c) * 38 * amt + 4,
    kneeB: Math.max(0, c) * 38 * amt + 4,
    shF: -16 * s * amt + 4,
    shB: 16 * s * amt - 4,
    elF: 18 + Math.max(0, -s) * 16,
    elB: 18 + Math.max(0, s) * 16,
  };
};

export const BEND: Pose = {lean: 62, head: -26, hipF: -8, hipB: -22, kneeF: 18, kneeB: 10, shF: 8, shB: -10, elF: 6, elB: 30};
export const SIT: Pose = {mode: 'sit', seat: 150, lean: 6, head: 4, hipF: 82, hipB: 78, kneeF: 84, kneeB: 80, shF: 22, shB: 14, elF: 62, elB: 60};
export const CROSS: Pose = {mode: 'cross', lean: 4, head: 2, shF: 26, shB: 18, elF: 70, elB: 70};
// down on one knee, reaching forward (eye level with someone sitting)
export const CROUCH: Pose = {lean: 8, head: 6, hipF: 84, hipB: -12, kneeF: 86, kneeB: 98, shF: 62, shB: 40, elF: 14, elB: 30};

export const mixPose = (a: Pose, b: Pose, k: number): Pose => {
  const o: any = {...a};
  for (const key of Object.keys(b) as (keyof Pose)[]) {
    const av = (a as any)[key], bv = (b as any)[key];
    if (typeof bv === 'number') o[key] = (typeof av === 'number' ? av : 0) * (1 - k) + bv * k;
    else o[key] = k < 0.5 ? av ?? bv : bv;
  }
  return o;
};
