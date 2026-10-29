import { BoxGeometry, BufferGeometry, CircleGeometry, Color, CylinderGeometry, Matrix4, SphereGeometry, TorusGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  createBezelTooth,
  createCylinderPatch,
  createCylinderSweep,
  createKnurl,
  createLathe,
  createTorxScrew,
  sCurve,
  vGroove,
  type ClipStation,
  type ProfilePoint,
} from './geometry';
import { SPEC, FRONT_Y } from './spec';

const SEG = 160;

/**
 * Frame for parts mounted on the tube surface at (r, y, φ): local +Y points
 * radially out and local −X points along the torch axis toward the head.
 */
export function radialMatrix(r: number, y: number, phi: number): Matrix4 {
  const radial = new Vector3(Math.sin(phi), 0, Math.cos(phi));
  const xAxis = new Vector3(0, -1, 0);
  const zAxis = new Vector3().crossVectors(xAxis, radial);
  const m = new Matrix4().makeBasis(xAxis, radial, zAxis);
  m.setPosition(radial.x * r, y, radial.z * r);
  return m;
}

function placeRadial(geo: BufferGeometry, r: number, y: number, phi: number) {
  return geo.applyMatrix4(radialMatrix(r, y, phi));
}

export interface TorchGeometry {
  tailCap: BufferGeometry;
  tailRing: BufferGeometry;
  body: BufferGeometry;
  knurl: BufferGeometry;
  head: BufferGeometry;
  bezel: BufferGeometry;
  teeth: BufferGeometry;
  lens: BufferGeometry;
  reflector: BufferGeometry;
  ledPedestal: BufferGeometry;
  ledGasket: BufferGeometry;
  ledPackage: BufferGeometry;
  ledDies: BufferGeometry;
  ledDome: BufferGeometry;
  oRings: BufferGeometry;
  switchBoss: BufferGeometry;
  switchRing: BufferGeometry;
  switchCap: BufferGeometry;
  switchIcon: BufferGeometry;
  clip: BufferGeometry;
  screwHeads: BufferGeometry;
  screwRecess: BufferGeometry;
  engraving: BufferGeometry;
  hitBody: BufferGeometry;
  hitButton: BufferGeometry;
  /** Local transform of the switch assembly (cap travels along its local Y). */
  switchMatrix: Matrix4;
  dispose: () => void;
}

export function buildTorchGeometry(colors: { anodized: Color; worn: Color }): TorchGeometry {
  const R = SPEC.bodyR;

  /* ---------------------------------------------------------------- tail cap */
  const tailCap = createLathe(
    [
      [0, 0.0065],
      [0.0815, 0.0065],
      [0.0855, 0.0028],
      [0.0905, 0],
      [0.1255, 0],
      [R, 0.0128],
      [R, 0.044],
      ...vGroove(R, 0.05, 0.0042, 0.0085),
      [R, 0.083],
      ...vGroove(R, 0.089, 0.0042, 0.0085),
      [R, 0.1625],
      [0.1362, 0.1652],
      [0.1318, 0.1652],
    ],
    { segments: SEG },
  );

  /* -------------------------------------------- brushed accent ring at tail */
  const tailRing = createLathe(
    [
      [0.1318, 0.1658],
      [0.1396, 0.1658],
      [0.1416, 0.1678],
      [0.1416, 0.1956],
      [0.1396, 0.1976],
      [0.1318, 0.1976],
    ],
    { segments: SEG },
  );

  /* ------------------------------------------------------------ body tube */
  const flare = sCurve([R, 1.038], [SPEC.headR, 1.152], 18);
  const body = createLathe(
    [
      [0.1318, 0.2018],
      [0.1365, 0.2018],
      [R, 0.2038],
      [R, SPEC.knurl.y0 - 0.002],
      [0.1365, SPEC.knurl.y0],
      [0.1262, SPEC.knurl.y0],
      [0.1262, SPEC.knurl.y1],
      [0.1365, SPEC.knurl.y1],
      [R, SPEC.knurl.y1 + 0.002],
      ...flare,
    ],
    { segments: SEG },
  );

  const knurl = createKnurl({
    radius: SPEC.knurl.radius,
    depth: SPEC.knurl.depth,
    y0: SPEC.knurl.y0,
    y1: SPEC.knurl.y1,
    count: SPEC.knurl.count,
    flat: SPEC.knurl.flat,
    base: colors.anodized,
    worn: colors.worn,
    seed: 17,
  });

  /* ----------------------------------------------------- head with fins */
  const headProfile: ProfilePoint[] = [
    [SPEC.headR, 1.152],
    [SPEC.headR, 1.166],
    ...vGroove(SPEC.headR, 1.171, 0.0032, 0.006),
    [SPEC.headR, 1.395],
  ];
  const finW = 0.016;
  const grooveW = 0.0125;
  const grooveR = 0.1815;
  let y = 1.395;
  for (let f = 0; f < 6; f++) {
    headProfile.push([SPEC.finR - 0.0016, y], [SPEC.finR, y + 0.0016], [SPEC.finR, y + finW - 0.0016], [SPEC.finR - 0.0016, y + finW]);
    y += finW;
    if (f < 5) {
      headProfile.push([grooveR, y], [grooveR, y + grooveW]);
      y += grooveW;
    }
  }
  headProfile.push([SPEC.finR, y + 0.0016], [SPEC.finR, 1.6175], [SPEC.finR - 0.002, 1.6195], [0.2, 1.6195]);
  const head = createLathe(headProfile, { segments: SEG });

  /* ------------------------------------------------- strike bezel + teeth */
  const B = SPEC.bezel;
  const bezel = createLathe(
    [
      [0.2, 1.6195],
      [0.2105, 1.6195],
      [B.outer, 1.6215],
      [B.outer, B.face - 0.002],
      [B.outer - 0.002, B.face],
      [B.toothInner, B.face],
      [B.inner, B.face - 0.002],
      [B.inner, SPEC.lens.y],
      [0.1722, SPEC.lens.y],
    ],
    { segments: SEG },
  );
  const toothGeos: BufferGeometry[] = [];
  const pitch = (Math.PI * 2) / B.teeth;
  const toothSpan = pitch * 0.56;
  for (let i = 0; i < B.teeth; i++) {
    const a0 = i * pitch + 0.21;
    toothGeos.push(createBezelTooth(B.toothInner, B.outer, a0, a0 + toothSpan, B.toothHeight));
  }
  const teeth = mergeGeometries(toothGeos)!;
  toothGeos.forEach((g) => g.dispose());
  // Shape plane XY → lathe XZ, extrusion +Z → +Y.
  teeth.rotateX(-Math.PI / 2);
  teeth.translate(0, B.face, 0);

  /* ------------------------------------------------------------- optics */
  const lens = new CircleGeometry(SPEC.lens.radius, 96);
  lens.rotateX(-Math.PI / 2);
  lens.translate(0, SPEC.lens.y - 0.0004, 0);

  const RF = SPEC.reflector;
  const vertexY = RF.mouthY - (RF.mouthR * RF.mouthR) / (4 * RF.focal);
  // Flat flange first so no gap shows between the mirror and the bezel bore.
  const reflectorProfile: ProfilePoint[] = [[SPEC.bezel.inner, RF.mouthY]];
  const steps = 56;
  for (let i = 0; i <= steps; i++) {
    // Sample from the mouth to the base so the mirror faces the axis and the lens.
    const t = i / steps;
    const r = RF.mouthR + (RF.baseR - RF.mouthR) * (1 - Math.pow(1 - t, 1.35));
    reflectorProfile.push([r, vertexY + (r * r) / (4 * RF.focal)]);
  }
  const reflector = createLathe(reflectorProfile, { segments: 144, creaseAngle: 50, tile: 0.4 });

  /* ---------------------------------------------------------------- LED */
  const L = SPEC.led;
  const ledPedestal = new CircleGeometry(0.0246, 40);
  ledPedestal.rotateX(-Math.PI / 2);
  ledPedestal.translate(0, L.pedestalY - 0.0002, 0);
  const reflectorBaseY = vertexY + (RF.baseR * RF.baseR) / (4 * RF.focal);
  const ledGasket = createLathe(
    [
      [RF.baseR + 0.0008, reflectorBaseY - 0.002],
      [RF.baseR + 0.0008, L.pedestalY - 0.0006],
      [RF.baseR - 0.0004, L.pedestalY],
      [0.0247, L.pedestalY],
      [0.0247, reflectorBaseY - 0.002],
    ],
    { segments: 64, tile: 0.05 },
  );
  const ledPackage = new BoxGeometry(L.packageSize, L.packageHeight, L.packageSize);
  ledPackage.translate(0, L.pedestalY + L.packageHeight / 2, 0);
  const dieGeos: BufferGeometry[] = [];
  const dieOffset = (L.dieSize + L.dieGap) / 2;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const d = new BoxGeometry(L.dieSize, 0.0012, L.dieSize);
      d.translate(sx * dieOffset, L.pedestalY + L.packageHeight + 0.0006, sz * dieOffset);
      dieGeos.push(d);
    }
  }
  const ledDies = mergeGeometries(dieGeos)!;
  dieGeos.forEach((g) => g.dispose());
  const ledDome = new SphereGeometry(L.domeR, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2);
  ledDome.translate(0, L.pedestalY + L.packageHeight, 0);

  /* ------------------------------------------------------------- O-rings */
  const ringA = new TorusGeometry(0.1338, 0.0029, 10, 128);
  ringA.rotateX(Math.PI / 2);
  ringA.translate(0, 0.1998, 0);
  const ringB = new TorusGeometry(0.2002, 0.0028, 10, 160);
  ringB.rotateX(Math.PI / 2);
  ringB.translate(0, 1.6196, 0);
  const oRings = mergeGeometries([ringA, ringB])!;
  ringA.dispose();
  ringB.dispose();

  /* ------------------------------------------- side switch (local frame) */
  const S = SPEC.switch;
  const switchMatrix = radialMatrix(SPEC.headR, S.y, S.phi);
  const switchBoss = createLathe(
    [
      [S.bossR, -0.016],
      [S.bossR, 0.0132],
      [S.bossR - 0.0018, 0.015],
      [0.0426, 0.015],
      [0.0414, 0.0138],
      [0.0414, 0.0045],
      [0.0348, 0.0045],
    ],
    { segments: 96, tile: 0.08 },
  );
  const switchRing = createLathe(
    [
      [0.0411, 0.0046],
      [0.0411, 0.0118],
      [0.0402, 0.0127],
      [0.0352, 0.0127],
      [0.0343, 0.0118],
      [0.0343, 0.0046],
    ],
    { segments: 96, tile: 0.05 },
  );
  const switchCap = createLathe(
    [
      [0.0336, 0.0035],
      [0.0336, 0.0166],
      [0.0322, 0.0181],
      [0.0302, 0.0186],
      [0, 0.0186],
    ],
    { segments: 96, tile: 0.05 },
  );
  const switchIcon = new CircleGeometry(0.0205, 48);
  switchIcon.rotateX(-Math.PI / 2);
  switchIcon.rotateY(Math.PI / 2); // align the icon's "up" with the torch axis (toward the head)
  switchIcon.translate(0, 0.01865, 0);

  /* ------------------------------------------------------------ pocket clip */
  const C = SPEC.clip;
  const padR = R + C.thickness / 2;
  const armR = 0.1508;
  const stations: ClipStation[] = [];
  /** Elliptical rounded end: from the tip (narrow) to full width, or the reverse. */
  const addRounded = (yStart: number, r: number, width: number, radius: number, reverse: boolean) => {
    const n = 8;
    for (let i = reverse ? 1 : 0; i <= n; i++) {
      const t = reverse ? 1 - i / n : i / n; // 1 = full width, 0 = tip
      const a = (Math.PI / 2) * t;
      const yy = reverse ? yStart + radius * Math.cos(a) : yStart - radius * Math.cos(a);
      stations.push({ y: yy, r, width: Math.max(0.006, width * Math.sin(a)) });
    }
  };
  // Rounded tail end of the mounting pad.
  addRounded(0.232, padR, 0.062, 0.02, false);
  stations.push({ y: 0.26, r: padR, width: 0.062 }, { y: 0.3, r: padR, width: 0.062 }, { y: 0.318, r: padR, width: 0.061 });
  // Bend up and over the knurl.
  for (let i = 1; i <= 8; i++) {
    const t = i / 8;
    const e = t * t * (3 - 2 * t);
    stations.push({ y: 0.318 + t * 0.056, r: padR + (armR - padR) * e, width: 0.061 - 0.004 * t });
  }
  // Arm, gently pre-loaded toward the tube.
  for (let i = 1; i <= 10; i++) {
    const t = i / 10;
    stations.push({ y: 0.374 + t * 0.36, r: armR - 0.0018 * Math.sin(t * Math.PI * 0.5), width: 0.057 - 0.007 * t });
  }
  // Flared lead-in tip.
  const tipBaseR = armR - 0.0018;
  for (let i = 1; i <= 6; i++) {
    const t = i / 6;
    stations.push({ y: 0.734 + t * 0.042, r: tipBaseR + 0.0095 * t * t, width: 0.05 - 0.004 * t });
  }
  addRounded(0.776, tipBaseR + 0.0095, 0.046, 0.019, true);
  const clip = createCylinderSweep(stations, C.phi, C.thickness, 0.0034);

  const screwGeos: BufferGeometry[] = [];
  const recessGeos: BufferGeometry[] = [];
  for (const sy of [0.25, 0.293]) {
    const { head: h, floor } = createTorxScrew(0.0098, 0.0044);
    // Local +Z → +Y so placeRadial can stand it on the clip pad.
    h.rotateX(-Math.PI / 2);
    floor.rotateX(-Math.PI / 2);
    screwGeos.push(placeRadial(h, R + C.thickness - 0.0006, sy, C.phi));
    recessGeos.push(placeRadial(floor, R + C.thickness - 0.0006, sy, C.phi));
  }
  const screwHeads = mergeGeometries(screwGeos)!;
  const screwRecess = mergeGeometries(recessGeos)!;
  screwGeos.forEach((g) => g.dispose());
  recessGeos.forEach((g) => g.dispose());

  /* --------------------------------------------------------- engraving */
  const E = SPEC.engraving;
  const engraving = createCylinderPatch(R + 0.0004, E.y0, E.y1, S.phi, E.halfWidth / R, 32, 12);

  /* ------------------------------------------------ invisible hit proxies */
  const hitBody = createLathe(
    [
      [0, -0.004],
      [0.144, -0.004],
      [0.144, 1.04],
      [0.194, 1.152],
      [0.194, 1.394],
      [0.209, 1.396],
      [0.217, 1.62],
      [0.217, FRONT_Y + 0.004],
      [0, FRONT_Y + 0.004],
    ],
    { segments: 28, creaseAngle: 10 },
  );
  const hitButton = new CylinderGeometry(0.056, 0.056, 0.05, 20);
  hitButton.translate(0, 0.012, 0);
  hitButton.applyMatrix4(switchMatrix);

  const all: BufferGeometry[] = [
    tailCap, tailRing, body, knurl, head, bezel, teeth, lens, reflector, ledPedestal, ledGasket, ledPackage, ledDies, ledDome,
    oRings, switchBoss, switchRing, switchCap, switchIcon, clip, screwHeads, screwRecess, engraving, hitBody, hitButton,
  ];
  return {
    tailCap, tailRing, body, knurl, head, bezel, teeth, lens, reflector, ledPedestal, ledGasket, ledPackage, ledDies, ledDome,
    oRings, switchBoss, switchRing, switchCap, switchIcon, clip, screwHeads, screwRecess, engraving, hitBody, hitButton,
    switchMatrix,
    dispose: () => all.forEach((g) => g.dispose()),
  };
}
