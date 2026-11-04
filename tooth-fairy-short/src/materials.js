// Shared material library. Paper-fibre maps on everything, flat shading for
// the folded-cardboard facets.
import * as THREE from 'three';
import * as T from './tex.js';
import { MAN_SKIN, OFF_SKIN, FAIRY_SKIN } from './faces.js';

export function buildMaterials(envMap) {
  const PANEL = T.tex(T.paperCanvas(512, 7, { edge: 0.12 }), { repeat: false });
  const std = (color, o = {}) =>
    new THREE.MeshStandardMaterial({
      color,
      map: o.map === undefined ? PANEL : o.map,
      roughness: o.r ?? 0.9,
      metalness: o.m ?? 0,
      flatShading: o.flat ?? true,
      side: o.side ?? THREE.FrontSide,
      transparent: !!o.transparent,
      opacity: o.opacity ?? 1,
      emissive: o.emissive ?? 0x000000,
      emissiveIntensity: o.ei ?? 1,
      envMap: o.env ? envMap : null,
      envMapIntensity: o.envI ?? 1,
      alphaTest: o.alphaTest ?? 0,
      depthWrite: o.depthWrite ?? true,
    });
  const tiled = (canvas, o = {}) => std(o.color ?? '#ffffff', { ...o, map: T.tex(canvas) });
  const once = (canvas, o = {}) => std(o.color ?? '#ffffff', { ...o, map: T.tex(canvas, { repeat: false }) });
  const basic = (canvas) => new THREE.MeshBasicMaterial({ map: T.tex(canvas, { repeat: false }), toneMapped: false });

  const M = { std, tiled, once, basic, PANEL };
  // characters
  M.manSkin = std(MAN_SKIN);
  M.manNose = std('#efb69b');
  M.gingham = tiled(T.gingham(512, 8));
  M.shirtTrim = std('#e5ad35');
  M.button = std('#fffaf0', { r: 0.5 });
  M.slipper = std('#a9cfe9');
  M.slipperPom = std('#f7f3ff');
  M.hair = std('#3a2a21', { r: 1 });
  M.glasses = std('#2a1e19', { r: 0.35, map: null });
  M.offSkin = std(OFF_SKIN);
  M.navy = std('#2c3c5a');
  M.navyDark = std('#1f2a40');
  M.navyLight = std('#3c5076');
  M.shirtBlue = std('#a9c4e4');
  M.black = std('#1f1d20', { r: 0.55 });
  M.visor = std('#141316', { r: 0.25, env: true, envI: 0.6 });
  M.gold = std('#f0c04a', { m: 1, r: 0.32, env: true, map: null });
  M.brass = std('#d9a83a', { m: 0.8, r: 0.4, env: true, map: null });
  M.moustache = std('#3b2a20', { r: 1 });
  M.offHair = std('#2f241e', { r: 1 });
  M.fairySkin = std(FAIRY_SKIN);
  M.fairyPink = std('#ee8fb7');
  M.tutu = tiled(T.glitter(256), { side: THREE.DoubleSide, r: 0.6 });
  M.tutu2 = tiled(T.glitter(256, [250, 192, 222], 37), { side: THREE.DoubleSide, r: 0.6 });
  M.tights = std('#fbf3f6');
  M.fairyShoe = std('#e15b93');
  M.auburn = std('#8c3b2c', { r: 1 });
  M.wing = new THREE.MeshStandardMaterial({ map: T.tex(T.wingCanvas(512), { repeat: false }), transparent: true, opacity: 0.82, side: THREE.DoubleSide, roughness: 0.4, depthWrite: false, emissive: 0xffd6ec, emissiveIntensity: 0.12 });
  M.wand = std('#f6f1e8', { r: 0.5 });
  M.star = std('#ffd24f', { emissive: 0xffc23a, ei: 0.5, r: 0.5 });
  M.burlap = std('#c49a6a', { r: 1 });
  M.burlapDark = std('#9d7448', { r: 1 });
  M.lanyard = std('#4f8fd9');
  M.idCard = once(T.idCard());
  M.pencil = std('#f4c542');
  M.eraser = std('#f08aa0');
  M.kidSkin = std('#f5d3bb');
  // props
  M.tooth = std('#fbf6ea', { r: 0.35, map: null });
  const coinFace = T.tex(T.coinFace(256), { repeat: false });
  M.coinFace = new THREE.MeshStandardMaterial({ map: coinFace, metalness: 1, roughness: 0.28, envMap, envMapIntensity: 1.2, bumpMap: coinFace, bumpScale: 1.5 });
  M.coinEdge = new THREE.MeshStandardMaterial({ color: '#e0a93a', metalness: 1, roughness: 0.3, envMap, envMapIntensity: 1.2, flatShading: true });
  M.phone = std('#9ed6c3');
  M.phoneDark = std('#6fb3a0');
  M.phoneKey = std('#f4efe2');
  M.screen = std('#b9d98f', { emissive: 0x9fd07a, ei: 0.25, r: 0.4 });
  M.paperWhite = std('#fbf8ef');
  M.cardboard = std('#b58a5c');
  M.spiral = std('#9aa0a8', { m: 0.8, r: 0.35, env: true, map: null });
  M.notepad = once(T.notepadSketch(512, 680));
  M.net = new THREE.MeshStandardMaterial({ map: T.tex(T.netCanvas(512, 10)), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1, color: '#e9cfa4' });
  M.steel = std('#a9b0b8', { m: 0.85, r: 0.35, env: true, map: null });
  M.redGrip = std('#d9483f', { r: 0.6 });
  M.iron = std('#4a4c55', { m: 0.6, r: 0.5, env: true, envI: 0.5 });
  M.velvet = std('#b9334a', { r: 1 });
  M.plate = std('#fdfcf8', { r: 0.35 });
  M.rice = tiled(T.grainy(256, [252, 250, 244], [232, 226, 210], 500));
  M.curry = std('#d98a2e', { r: 0.5 });
  M.curryChunk = std('#b5602a');
  M.chapati = once(T.chapatiCanvas(512), { side: THREE.DoubleSide });
  M.glass = new THREE.MeshStandardMaterial({ color: '#dff0ff', transparent: true, opacity: 0.35, roughness: 0.1, metalness: 0.1, envMap, depthWrite: false });
  M.water = new THREE.MeshStandardMaterial({ color: '#bfe3ff', transparent: true, opacity: 0.4, roughness: 0.1, depthWrite: false });
  M.mug = std('#e86f5a');
  M.mugIn = std('#3d2418');
  M.donut = std('#e2a764');
  M.icing = once(T.sprinkleDonut(256));
  // set dressing
  M.floor = tiled(T.woodPlanks(1024, 1024, 11));
  M.floorDark = tiled(T.woodPlanks(1024, 1024, 13, [166, 118, 80], 5));
  M.wallpaper = tiled(T.wallpaper(512));
  M.wainscot = tiled(T.panels(512, [184, 214, 196]));
  M.trim = std('#f7efe0');
  M.ceiling = std('#f6ece2');
  M.bedWood = std('#dcab78');
  M.mattress = std('#f3eee5');
  M.duvet = tiled(T.dots(512, [166, 196, 226], [250, 250, 255], 8, 7));
  M.sheet = std('#fbf8f2');
  M.pillow = std('#efe9df', { r: 1 });
  M.nightstand = std('#efd2ac');
  M.knob = std('#c48a4a');
  M.shade = std('#f8dcc8', { side: THREE.DoubleSide, emissive: 0xffb36b, ei: 0 });
  M.bulb = std('#fff6dd', { emissive: 0xffe2a8, ei: 0 });
  M.wardrobe = std('#c99467');
  M.wardrobeDark = std('#a8764e');
  M.interior = std('#2a201b', { r: 1 });
  M.door = std('#a8d2c3');
  M.curtain = tiled(T.stripes(512, [247, 226, 160], [236, 207, 133], 6), { side: THREE.DoubleSide });
  M.rod = std('#c49a6a', { m: 0.3, r: 0.5 });
  M.rug = once(T.rugCanvas());
  M.frame = std('#f3e6d3');
  M.picBoat = once(T.picture('boat'));
  M.picHills = once(T.picture('hills'));
  M.picTooth = once(T.picture('tooth'));
  M.clockFace = once(T.clockFace());
  M.clockRim = std('#ef8b7c');
  M.ink = std('#231c18', { r: 0.7, map: null });
  M.plantPot = std('#e7906f');
  M.leaf = std('#7fb48c', { side: THREE.DoubleSide });
  M.skyNight = basic(T.sky('night'));
  M.skyDay = basic(T.sky('day'));
  M.skyDusk = basic(T.sky('dusk'));
  M.kidWall = tiled(T.starWallpaper(512));
  M.kidBedA = std('#f4b9c9');
  M.kidBedB = std('#a9cdea');
  M.blanketA = tiled(T.dots(512, [246, 196, 210], [255, 245, 248], 6, 9, 71));
  M.blanketB = tiled(T.stripes(512, [178, 210, 238], [150, 190, 228], 5, false));
  M.curtainPink = tiled(T.stripes(512, [246, 196, 214], [236, 176, 200], 6), { side: THREE.DoubleSide });
  M.teddy = std('#c9925f', { r: 1 });
  M.nightlight = std('#ffe6a8', { emissive: 0xffc870, ei: 1.2 });
  M.bricks = tiled(T.bricks(512));
  M.stone = std('#9b979c');
  M.desk = tiled(T.woodPlanks(1024, 1024, 17, [176, 124, 84], 4));
  M.stationWall = tiled(T.panels(512, [196, 214, 190], 9));
  M.cork = std('#c99d6c');
  M.throneGold = std('#f2c14e', { m: 1, r: 0.3, env: true, envI: 1.1 });
  M.table = std('#c58d5c');
  M.tableCloth = tiled(T.gingham(512, 8, [214, 96, 96], [255, 248, 240]));
  return M;
}
