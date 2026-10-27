// Design = normalized options -> proportions, per-view pivot positions and per-view part lists.
// Pure data (no three.js), cached by a key, so identical designs share one atlas.
import { headParts, browParts, mouthParts, hairParts, beardParts, EYE, BEARD_PIV } from './parts_head.js';
import { torsoParts, shawlParts, neckParts, limbParts, handParts, footParts, accessoryParts, babyParts } from './parts_body.js';
import { xpart } from './paint.js';

export const VIEWS = ['side', 'threeQuarter', 'back'];
export const VIEW_ALIAS = { side: 'side', profile: 'side', threeQuarter: 'threeQuarter', '3q': 'threeQuarter', three: 'threeQuarter', back: 'back' };
// relative texel densities per part class (the atlas packer scales them to fill the atlas)
const DENS = { face: 3.0, face3: 1.75, beard: 1.55, body: 1.1, body3: 0.75, limb: 0.95, hand: 1.25, prop: 0.9 };
const QUALITY = { hero: { W: 4096, H: 4096, k: 1 }, main: { W: 2048, H: 2048, k: 1 }, crowd: { W: 1024, H: 2048, k: 1 } };

const DEFAULTS = {
  seed: 1, height: 1.75, skin: '#a2693d', hair: 'short', hairColor: '#231a14', beard: 'none', beardColor: null,
  outfit: 'tunic', cloth: '#a9552c', trim: null, belt: '#d7b484', sleeve: null, legs: null, shoes: '#3a2a1e',
  wrap: null, wrapTail: false, prop: null, build: 1, kid: false, age: 0, hem: null, sash: null, bareArms: false, cuff: false,
  brows: 'normal', browColor: null, eyeColor: null, nose: 1, noseDroop: 0, jaw: 1, chin: 1, crown: 1, browRidge: 0, headSize: 1,
  shawl: null, patches: null, patchColors: null, worn: false, headband: null, bracelet: null, satchel: null, strap: null, apron: null, tool: false,
  feet: null, jeans: false, longSleeve: false, sleeveStyle: 'fitted', hunch: 0, belly: 0, lashes: false, stubble: null, hairUnder: null,
  quality: 'main', kind: 'person', beardLen: null, gaunt: 0, glove: null, shoeAccent: null, soleStripe: null, handK: 1, neckW: null,
};

export function normalize(o0 = {}) {
  const o = { ...DEFAULTS, ...o0 };
  if (o.age === 'old') o.age = 0.8; else if (o.age === 'young') o.age = 0.1; else if (typeof o.age !== 'number') o.age = 0;
  if (!o.beardColor) o.beardColor = o.hairColor;
  if (!o.browColor) o.browColor = o.age > 0.6 ? '#ece6dc' : null;
  if (o.age > 0.75 && o.brows === 'normal' && o0.brows == null) o.brows = 'bushy';
  if (!o.feet) o.feet = o.jeans || ['hoodie', 'coat'].includes(o.outfit) ? 'sneaker' : (o0.shoes ? 'shoe' : 'sandal');
  if (['hoodie', 'coat'].includes(o.outfit) && o0.longSleeve == null) o.longSleeve = true;
  if (o.cuff && o0.longSleeve == null) o.longSleeve = true;
  return o;
}

function dims(o) {
  const b = o.build, kid = o.kid;
  const d = kid
    ? { thighL: 0.30, shinL: 0.27, ankleH: 0.06, torsoLen: 0.40, upperL: 0.22, foreL: 0.20, hs: 1.24 * o.headSize }
    : { thighL: 0.42, shinL: 0.365, ankleH: 0.07, torsoLen: 0.51, upperL: 0.29, foreL: 0.26, hs: 1.1 * o.headSize };
  d.build = b;
  d.hipY = d.ankleH + d.thighL + d.shinL;
  const hemBody = o.hem != null ? o.hem : { robe: 0.11, tunic: 0.47, shirt: 0.8, hoodie: 0.8, coat: 0.44, swaddle: 0.5 }[o.outfit] ?? 0.8;
  d.hemY = hemBody - d.hipY;
  d.neckY = d.torsoLen + 0.04;
  d.natural = d.hipY + d.neckY + 0.02 + 0.362 * d.hs + 0.01;
  return d;
}

// options that do not change the drawing (so every view / instance of a design shares one atlas)
const NON_VISUAL = ['height', 'silhouette', 'noShadow', 'prop', 'props', 'view', 'name', 'layerBase', 'outlinePx', 'blobOpacity', 'noBlob'];
const deepKey = (o) => JSON.stringify(Object.keys(o).sort().filter((k) => !NON_VISUAL.includes(k)).map((k) => [k, o[k]]));

// part classes -> concrete layer/pivot defaults, per view
function limbSet(D, view, L) {
  const b = D.build;
  const out = [];
  const lay = view === 'back' ? { armB: 40.6, armF: 40, legB: 14, legF: 16 } : { armB: 10, armF: 40, legB: 14, legF: 16 };
  const tintB = view === 'back' ? 0.95 : 0.84;
  for (const side of ['B', 'F']) {
    const t = side === 'B' ? tintB : 1;
    const la = lay['leg' + side], aa = lay['arm' + side];
    out.push({ ...L.thigh, id: `thigh${side}`, pivot: `leg${side}.hip`, layer: la, olayer: la - 0.5, tint: t, regionKey: 'thigh' });
    out.push({ ...L.shin, id: `shin${side}`, pivot: `leg${side}.knee`, layer: la + 0.1, olayer: la - 0.5, tint: t, regionKey: 'shin' });
    out.push({ ...L.upper, id: `upper${side}`, pivot: `arm${side}.sh`, layer: aa, olayer: aa - 0.5, tint: t, regionKey: 'upper' });
    out.push({ ...L.fore, id: `fore${side}`, pivot: `arm${side}.el`, layer: aa - 0.1, olayer: aa - 0.5, tint: t, regionKey: 'fore' });
  }
  const H = handParts(D);
  for (const side of ['B', 'F']) {
    const aa = lay['arm' + side], t = side === 'B' ? tintB : 1;
    for (const k of ['open', 'grip', 'point']) out.push({ ...H[k], id: `hand${side}_${k}`, pivot: `arm${side}.hand`, layer: aa + 0.1, olayer: aa - 0.5, tint: t, density: 'hand', bulge: 0.9, toggle: `hand${side}:${k}`, regionKey: `hand_${k}`, shadow: true });
  }
  const Fv = footParts(D, view);
  for (const side of ['B', 'F']) {
    const la = lay['leg' + side], t = side === 'B' ? tintB : 1;
    out.push({ ...Fv.foot, id: `foot${side}`, pivot: `leg${side}.foot`, layer: la + 0.2, olayer: la - 0.5, tint: t, regionKey: `foot_${view === 'threeQuarter' ? '3q' : view}` });
  }
  void b;
  return out;
}

export function makeDesign(opts) {
  const o = normalize(opts);
  const key = deepKey(o);
  const D = { ...o, ...dims(o) };
  const hs = D.hs;
  const design = { key, o, D, views: {}, pivots: {}, quality: QUALITY[o.quality] || QUALITY.main };
  if (o.kind === 'baby') {
    const parts = babyParts(D).map((p) => ({ ...p }));
    for (const v of VIEWS) { design.views[v] = parts; design.pivots[v] = { babyHead: [0, 0] }; }
    design.D.natural = 0.3; design.baby = true;
    finalize(design);
    return design;
  }
  const b = D.build, sy = D.torsoLen;
  const L = limbParts(D);
  const hunchFwd = (D.hunch || 0) * 0.03;
  for (const view of VIEWS) {
    const parts = [];
    const H = (list) => list.map((p) => xpart(p, hs));
    // head group (scaled by the head size)
    parts.push(...H(headParts(D, view)));
    parts.push(...H(browParts(D, view)));
    parts.push(...H(mouthParts(D, view === 'back' ? 'side' : 'side')).map((p) => ({ ...p, regionKey: 'm_' + p.id })));
    const hair = H(hairParts(D, view));
    // long back hair: bend pivot at its attachment point (head space)
    const hairPiv = view === 'side' ? [-0.09, 0.24] : view === 'threeQuarter' ? [-0.13, 0.24] : [0, 0.24];
    for (const p of hair) parts.push(p.pivot === 'hairBack' ? xpart(p, 1, -hairPiv[0] * hs, -hairPiv[1] * hs) : p);
    const beardLen = o.beardLen != null ? o.beardLen / hs : 0.95 / hs;
    parts.push(...H(beardParts(D, view, beardLen)));
    // body
    parts.push(...neckParts(D, view).map((p) => ({ ...p, layer: 19, olayer: 18.5, outline: true })));
    parts.push(...torsoParts(D, view));
    parts.push(...shawlParts(D, view));
    parts.push(...accessoryParts(D, view));
    parts.push(...limbSet(D, view, L));
    design.views[view] = parts.filter((p) => !(view === 'back' && /^(mouth_|moustache|eye|pupil|lid|brow)/.test(p.id)));
    // pivots (parent-local positions)
    const P = {};
    const eye = view === 'side' ? EYE.side : EYE.near;
    if (view === 'side') {
      Object.assign(P, { 'legB.hip': [-0.045 * b, D.hipY], 'legF.hip': [0.035 * b, D.hipY], 'armB.sh': [-0.03 * b, sy - 0.03], 'armF.sh': [0.02 * b, sy - 0.03], neck: [0.008 + hunchFwd, D.neckY], cradle: [0.2 * b, 0.335], satchel: [0, 0] });
      P.mouth = [0.152 * hs, 0.069 * hs]; P.browN = [eye.E[0] * hs, (eye.E[1] + 0.046) * hs];
    } else if (view === 'threeQuarter') {
      Object.assign(P, { 'legB.hip': [0.06 * b, D.hipY], 'legF.hip': [-0.055 * b, D.hipY], 'armB.sh': [0.155 * b, sy - 0.035], 'armF.sh': [-0.175 * b, sy - 0.035], neck: [0.0 + hunchFwd * 0.6, D.neckY], cradle: [0.1 * b, 0.335] });
      P.mouth = [0.1 * hs, 0.068 * hs]; P.browN = [EYE.near.E[0] * hs, (EYE.near.E[1] + 0.044) * hs]; P.browF = [EYE.far.E[0] * hs, (EYE.far.E[1] + 0.042) * hs];
      P.eyeF = [EYE.far.E[0] * hs, EYE.far.E[1] * hs];
    } else {
      Object.assign(P, { 'legB.hip': [0.07 * b, D.hipY], 'legF.hip': [-0.07 * b, D.hipY], 'armB.sh': [0.2 * b, sy - 0.035], 'armF.sh': [-0.2 * b, sy - 0.035], neck: [0.0, D.neckY], cradle: [0.0, 0.27] });
      P.mouth = [0.0, 0.069 * hs]; P.browN = [0, 0.24 * hs];
    }
    P.eyeN = [eye.E[0] * hs, eye.E[1] * hs];
    P.beard = [BEARD_PIV[view][0] * hs, BEARD_PIV[view][1] * hs];
    P.hairBack = [hairPiv[0] * hs, hairPiv[1] * hs];
    P.head = [0, 0.02];
    P.torso = [0, D.hipY];
    design.pivots[view] = P;
  }
  finalize(design);
  return design;
}

function finalize(design) {
  for (const v of VIEWS) {
    design.views[v] = design.views[v].map((p) => {
      const dens = typeof p.density === 'number' ? p.density : 400 * (DENS[p.density] ?? 1);
      return { ...p, id: `${v}/${p.id}`, baseId: p.id, view: v, density: dens, outline: p.outline ?? true, layer: p.layer ?? 0, olayer: p.olayer ?? (p.layer ?? 0) - 0.5, tint: p.tint ?? 1,
        shapeFrom: p.shapeFrom ? { ...p.shapeFrom, id: `${v}/${p.shapeFrom.id}` } : undefined };
    });
  }
}

// every unique part spec across views (for the atlas)
export function allParts(design) {
  const out = [];
  for (const v of VIEWS) out.push(...design.views[v]);
  return out;
}
