// Cast presets (rig v3). Each preset is a plain options object for `new Person(opts)` (or person(group, opts)
// in src/three/cast.js); spread it to override: new Person({ ...ENOCH, height: 1.8 }).
// Hero = 4096² atlas (close-ups), main = 2048², crowd = 1024×2048.

export const METHUSELAH_OLD = {
  name: 'Methuselah (old)', seed: 969, quality: 'hero',
  height: 1.6, build: 0.86, age: 1.0, hunch: 1, gaunt: 1,
  skin: '#a5703f', nose: 1.18, noseDroop: 1, jaw: 0.94, chin: 0.97, browRidge: 1, crown: 1.0,
  hair: 'oldLong', hairColor: '#ebe6de', beard: 'knee', beardColor: '#eee9e1', beardLen: 1.0,
  brows: 'bushy', browColor: '#f1ece4', eyeColor: '#4a3020',
  outfit: 'robe', cloth: '#6f7f8c', worn: true, patches: ['#8a7a62', '#6d7766'], belt: '#7a5a3a', sleeveStyle: 'wide',
  shawl: '#8b6f4e', patchColors: ['#6f7d5a', '#a07a4c', '#7c5b48'],
  feet: 'sandal', prop: 'cane',
};

// same face design (seed / nose / jaw), dark beard, upright — S3 doorway, S5 holding baby Lamech
export const METHUSELAH_YOUNG = {
  name: 'Methuselah (young)', seed: 969, quality: 'main',
  height: 1.78, build: 1.0, age: 0.18,
  skin: '#a2693d', nose: 1.18, noseDroop: 0.4, jaw: 0.98, chin: 0.97, browRidge: 0.5,
  hair: 'long', hairColor: '#2a1d14', beard: 'medium', beardColor: '#2a1d14',
  brows: 'normal', eyeColor: '#4a3020',
  outfit: 'robe', cloth: '#4f6478', belt: '#c9a36a', sleeveStyle: 'wide', bracelet: '#b8893a',
  feet: 'sandal',
};

export const ENOCH = {
  name: 'Enoch', seed: 365, quality: 'main',
  height: 1.77, build: 0.98, age: 0.45,
  skin: '#9a6238', nose: 1.0, jaw: 1.0,
  hair: 'short', hairColor: '#6a5c50', beard: 'medium', beardColor: '#7a6d62',
  brows: 'normal', browColor: '#5f5248',
  outfit: 'robe', cloth: '#e7dcc4', trim: '#b9925a', belt: '#c99a3a', sash: '#c99a3a', sleeveStyle: 'wide',
  feet: 'sandal', prop: 'staff',
};

export const LAMECH = {
  name: 'Lamech', seed: 777, quality: 'main',
  height: 1.86, build: 1.2, age: 0.25,
  skin: '#8a5530', nose: 1.05, jaw: 1.12, chin: 1.04,
  hair: 'curly', hairColor: '#17110d', beard: 'medium', beardColor: '#17110d',
  brows: 'normal',
  outfit: 'tunic', cloth: '#8a5a2b', belt: '#3d2a1c', beltW: 0.04, bareArms: true, bracelet: '#c9a24a', headband: '#3b5b58',
  feet: 'sandal',
};

export const BABY = {
  name: 'Baby', kind: 'baby', seed: 182, quality: 'main', height: 0.3,
  skin: '#a8703f', cloth: '#efe3c8', band: '#b8894a', hairColor: '#2a1d14',
};
export const BABY_LAMECH = { ...BABY, name: 'Baby Lamech', seed: 187, cloth: '#e8dcc0', band: '#8c9a6a' };
export const BABY_NOAH = { ...BABY, name: 'Baby Noah', seed: 1056, cloth: '#efe6d2', band: '#b8894a', skin: '#9a6238' };

export const NOAH_YOUNG = {
  name: 'Noah (young)', seed: 1056, quality: 'main',
  height: 1.8, build: 1.06, age: 0.2,
  skin: '#9a6238', nose: 1.05, jaw: 1.05,
  hair: 'short', hairColor: '#3a2a1e', beard: 'short', beardColor: '#3a2a1e',
  outfit: 'tunic', cloth: '#3c6b66', belt: '#d0b07a', strap: '#6b4a2e', satchel: '#8a6040',
  feet: 'sandal',
};

// 600 years old at the flood: white beard, sturdy, head-cloth, leather apron, adze at the belt, hammer in hand
export const NOAH_OLD = {
  name: 'Noah (600)', seed: 600, quality: 'main',
  height: 1.8, build: 1.14, age: 0.72,
  skin: '#9a6238', nose: 1.05, jaw: 1.06, browRidge: 0.4,
  hair: 'wrap', wrap: '#d9c08e', wrapTail: true, hairColor: '#e9e4dc', beard: 'long', beardColor: '#f1ede6',
  brows: 'bushy', browColor: '#efe9e0',
  outfit: 'tunic', cloth: '#6b7a3a', belt: '#5a3c22', apron: '#7a5634', tool: true, bracelet: '#9a7a4a',
  feet: 'sandal', prop: 'hammer',
};

export const ADAM = {
  name: 'Adam', seed: 930, quality: 'main',
  height: 1.82, build: 1.05, age: 0.85,
  skin: '#8f5a33', nose: 1.0, jaw: 1.04,
  hair: 'long', hairColor: '#cfc8bc', beard: 'long', beardColor: '#d9d3c8',
  brows: 'bushy', browColor: '#ddd6cb',
  outfit: 'robe', cloth: '#a8875a', belt: '#5a3c22', sash: '#7a4a2a', sleeveStyle: 'wide',
  feet: 'bare', prop: 'staff',
};

// modern city person (S13): same paper style — hoodie, jeans, sneakers
export const CITY_PERSON = {
  name: 'City person', seed: 2026, quality: 'main',
  height: 1.74, build: 0.98, age: 0.22,
  skin: '#b47a49', nose: 0.9,
  hair: 'modern', hairColor: '#2b211a', beard: 'stubble', stubble: '#3a2a1e',
  outfit: 'hoodie', cloth: '#3b4a63', jeans: true, legs: '#41587a', feet: 'sneaker', shoeAccent: '#c96a3a',
};
export const CITY_PERSON_COAT = {
  ...CITY_PERSON, name: 'City person (coat)', seed: 2027, outfit: 'coat', cloth: '#6b5640', hair: 'short', hairColor: '#1d1612', beard: 'none', stubble: null, skin: '#c28b58', legs: '#2f3b52',
};

// >= 10 varied mockers (S11): ages, heights, builds, hair, clothes — crowd-quality atlases
const C = (i, o) => ({ name: `Mocker ${i + 1}`, seed: 4100 + i * 17, quality: 'crowd', feet: 'sandal', ...o });
export const CROWD = [
  C(0, { height: 1.72, build: 1.0, skin: '#8f5a33', hair: 'turban', wrap: '#a9552c', beard: 'short', hairColor: '#231a14', outfit: 'tunic', cloth: '#3b456f', belt: '#c9a36a' }),
  C(1, { height: 1.86, build: 1.22, skin: '#7d4c2c', hair: 'bald', hairColor: '#231a14', beard: 'medium', outfit: 'tunic', cloth: '#7c6a3c', belt: '#3d2a1c', bareArms: true, bracelet: '#c9a24a' }),
  C(2, { height: 1.62, build: 0.86, skin: '#b47a49', hair: 'veil', wrap: '#b06a5e', hairColor: '#33251b', outfit: 'robe', cloth: '#72303a', belt: '#d0b07a', lashes: true }),
  C(3, { height: 1.78, build: 0.92, skin: '#a2693d', hair: 'curly', hairColor: '#231a14', beard: 'short', outfit: 'tunic', cloth: '#53653a', belt: '#c99a3a', headband: '#c9a36a' }),
  C(4, { height: 1.68, build: 1.12, skin: '#c28b58', hair: 'short', hairColor: '#4a3524', beard: 'none', stubble: '#4a3524', outfit: 'tunic', cloth: '#bf8c31', belt: '#5a3c22', satchel: '#7a5634' }),
  C(5, { height: 1.82, build: 1.0, skin: '#6b4126', hair: 'wrap', wrap: '#e3d6bb', wrapTail: true, beard: 'long', hairColor: '#8f8a83', beardColor: '#8f8a83', age: 0.6, outfit: 'robe', cloth: '#6e4a2e', belt: '#c9a36a' }),
  C(6, { height: 1.58, build: 0.9, skin: '#a2693d', hair: 'long', hairColor: '#231a14', outfit: 'robe', cloth: '#5f87a3', belt: '#e3d6bb', lashes: true, bracelet: '#c9a24a' }),
  C(7, { height: 1.75, build: 1.08, skin: '#8f5a33', hair: 'short', hairColor: '#231a14', beard: 'short', outfit: 'tunic', cloth: '#93402a', belt: '#383533', strap: '#5a3c22' }),
  C(8, { height: 1.9, build: 0.95, skin: '#b47a49', hair: 'turban', wrap: '#3c6b66', beard: 'medium', hairColor: '#33251b', outfit: 'robe', cloth: '#8a8172', belt: '#72303a', sleeveStyle: 'wide' }),
  C(9, { height: 1.36, build: 0.9, kid: true, skin: '#a2693d', hair: 'curly', hairColor: '#231a14', outfit: 'tunic', cloth: '#c9a36a', belt: '#6e4a2e' }),
  C(10, { height: 1.7, build: 1.18, skin: '#7d4c2c', hair: 'bald', hairColor: '#e8e3da', beard: 'short', beardColor: '#e8e3da', age: 0.7, outfit: 'tunic', cloth: '#5b2a6e', belt: '#c9a36a', belly: 0.05 }),
  C(11, { height: 1.66, build: 0.94, skin: '#c28b58', hair: 'veil', wrap: '#e3d6bb', hairColor: '#231a14', outfit: 'robe', cloth: '#53653a', belt: '#bf8c31', lashes: true }),
];

export const PRESETS = {
  METHUSELAH_OLD, METHUSELAH_YOUNG, ENOCH, LAMECH, BABY, BABY_LAMECH, BABY_NOAH, NOAH_YOUNG, NOAH_OLD, ADAM, CITY_PERSON, CITY_PERSON_COAT,
};
export const preset = (name, extra = {}) => ({ ...(PRESETS[name] || {}), ...extra });
export const crowdMember = (i, extra = {}) => ({ ...CROWD[((i % CROWD.length) + CROWD.length) % CROWD.length], ...extra, seed: (extra.seed ?? CROWD[((i % CROWD.length) + CROWD.length) % CROWD.length].seed + Math.floor(i / CROWD.length) * 3) });
