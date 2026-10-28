// The gas shelter: a box of corrugated galvanised steel on a dark steel frame (the
// walls and the roof are cut by the cutaway, so the section shows the waves of the
// steel with the soil packed into them), a concrete floor slab and steps, the heavy
// steel door over the stairwell with black rubber seals all round, the tall air pipe
// with its inlet 4 m up, the black carbon filter (its front comes off to show the
// carbon grains catching the gas), the fan and its switch, the bench, the lamp and
// the stuffy haze.
import * as THREE from 'three';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const SRC = (s) => new THREE.Color(s);

// A corrugated sheet: the ribs run along local x (length L); the wave runs across
// local y (width Wd, local y = 0 sitting at world coordinate u0 along the wave) and
// displaces the sheet along local z; th thick. Closed on all sides, so wherever the
// cutaway cuts it, the wave shows.
function corrSheet(L, Wd, u0, { pitch, amp, th }, seg = 10) {
  const ny = Math.max(2, Math.ceil((Wd / pitch) * seg));
  const P = [], N = [], I = [];
  const w = (2 * Math.PI) / pitch;
  const S = (y) => amp * Math.sin(w * (y + u0));
  const nrm = (y) => {
    const d = amp * w * Math.cos(w * (y + u0)), l = Math.hypot(d, 1);
    return [-d / l, 1 / l]; // (y, z) of the front normal
  };
  const face = (sg) => {
    const b0 = P.length / 3;
    for (let j = 0; j <= ny; j++) {
      const y = (j / ny) * Wd, [ny_, nz] = nrm(y);
      for (const x of [0, L]) {
        P.push(x, y + (ny_ * th * sg) / 2, S(y) + (nz * th * sg) / 2);
        N.push(0, ny_ * sg, nz * sg);
      }
    }
    for (let j = 0; j < ny; j++) {
      const a = b0 + j * 2, b = a + 1, c = a + 2, d = a + 3;
      if (sg > 0) I.push(a, b, d, a, d, c);
      else I.push(a, d, b, a, c, d);
    }
  };
  face(1);
  face(-1);
  // the cut ends (x = 0 and x = L): the wave profile, th thick
  for (const [x, sg] of [[0, -1], [L, 1]]) {
    const b0 = P.length / 3;
    for (let j = 0; j <= ny; j++) {
      const y = (j / ny) * Wd, [ny_, nz] = nrm(y);
      P.push(x, y + (ny_ * th) / 2, S(y) + (nz * th) / 2, x, y - (ny_ * th) / 2, S(y) - (nz * th) / 2);
      N.push(sg, 0, 0, sg, 0, 0);
    }
    for (let j = 0; j < ny; j++) {
      const f0 = b0 + j * 2, k0 = f0 + 1, f1 = f0 + 2, k1 = f0 + 3;
      if (sg > 0) I.push(f0, k0, k1, f0, k1, f1);
      else I.push(f0, k1, k0, f0, f1, k1);
    }
  }
  // the two long edges (y = 0 and y = Wd)
  for (const [j, sg] of [[0, -1], [ny, 1]]) {
    const y = (j / ny) * Wd, [ny_, nz] = nrm(y);
    const b0 = P.length / 3;
    for (const x of [0, L]) {
      P.push(x, y + (ny_ * th) / 2, S(y) + (nz * th) / 2, x, y - (ny_ * th) / 2, S(y) - (nz * th) / 2);
      N.push(0, sg, 0, 0, sg, 0);
    }
    if (sg > 0) I.push(b0, b0 + 2, b0 + 3, b0, b0 + 3, b0 + 1);
    else I.push(b0, b0 + 3, b0 + 2, b0, b0 + 1, b0 + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setIndex(I);
  return g;
}
// place a sheet: local x along `ex`, local y along `ey` (local z = ex x ey), origin `o`
function placeSheet(g, ex, ey, o) {
  const ez = ex.clone().cross(ey);
  g.applyMatrix4(new THREE.Matrix4().makeBasis(ex, ey, ez).setPosition(o));
  return g;
}

export function build(ctx) {
  const { scene, T, WD, MAT, G, U, mesh, envMap, envMats, instanced, beginInst, setInst, endInst } = ctx;
  const { clamp, lerp, smooth, prog, popIn, easeOutCubic, easeOutBack, bump } = U;
  const { ROOM, STAIR, OUT, FLOOR, FLOOR_B, CEIL, TOP, HATCH, SHEET, CORR, PIPE, FILTER, FAN } = WD;
  const updaters = [];
  const shiny = (m) => (envMats.push(m), (m.envMap = envMap), m);
  const std = (hex, rough = 0.6, metal = 0, extra = {}) => new THREE.MeshStandardMaterial({ color: SRC(hex), roughness: rough, metalness: metal, ...extra });
  const X = V3(1, 0, 0), Y = V3(0, 1, 0), Zf = V3(0, 0, 1), Zb = V3(0, 0, -1);

  // -------------------------------------------------------------------------
  // the parts snap into the pit one after another (scene 2): each drops in from
  // above with a bounce, or (the posts) shoots up out of the floor
  // -------------------------------------------------------------------------
  const parts = [];
  const part = (obj, t0, kind = 'drop', dy = 1.4) => {
    scene.add(obj);
    parts.push({ g: obj, t0, kind, dy });
    return obj;
  };
  updaters.push((t) => {
    for (const p of parts) {
      const k = popIn(t, p.t0, p.kind === 'rise' ? 0.3 : 0.36, 2.2);
      p.g.visible = k > 0.001;
      if (p.kind === 'rise') p.g.scale.set(1, Math.max(0.001, k), 1);
      else p.g.position.y = (1 - k) * p.dy;
    }
  });
  const S0 = T.shell0;
  const conc = (kind, a, b) => MAT.concreteMaterial(new THREE.Vector4(kind, a, b, 0));
  // the floor slab
  part(new THREE.Group().add(mesh(G.boxMM(OUT.x0, FLOOR_B, OUT.zb, OUT.x1, FLOOR, 0), conc(1, FLOOR_B, FLOOR))), S0, 'drop', 0.9);
  // the steel frame: posts at the corners (their cut ends show in the section), beams under the roof
  const frameM = MAT.paintedSteel('frame', '#3a4146');
  {
    const posts = new THREE.Group();
    const pg = [];
    const post = (x, z, y1) => pg.push(G.boxMM(x - 0.035, FLOOR, z - 0.035, x + 0.035, y1, z + 0.035));
    post(SHEET.left + 0.075, -0.045, SHEET.roof - 0.03);
    post(SHEET.left + 0.075, SHEET.back + 0.075, SHEET.roof - 0.03);
    post(SHEET.shared - 0.075, SHEET.back + 0.075, SHEET.roof - 0.03);
    post(SHEET.shared - 0.075, -0.045, SHEET.roof - 0.03);
    post(SHEET.shared + 0.075, SHEET.stairBack + 0.075, TOP - 0.02);
    post(SHEET.right - 0.075, SHEET.stairBack + 0.075, TOP - 0.02);
    post(SHEET.right - 0.075, -0.045, TOP - 0.02);
    posts.add(mesh(G.mergeAll(pg), frameM));
    posts.position.y = FLOOR;
    for (const c of posts.children) c.position.y = -FLOOR;
    part(posts, S0 + 0.14, 'rise');
    const beams = new THREE.Group();
    const bg = [];
    for (const z of [-0.3, -1.18, -2.06]) bg.push(G.boxMM(SHEET.left + 0.04, SHEET.roof - 0.13, z - 0.03, SHEET.shared - 0.04, SHEET.roof - 0.045, z + 0.03));
    beams.add(mesh(G.mergeAll(bg), frameM));
    part(beams, S0 + 0.86, 'drop', 1.0);
  }
  // the corrugated walls and roof
  const corrM = shiny(MAT.galvMaterial('corr', '#bcc2c6'));
  const sheet = (g, t0, dy = 1.6) => part(new THREE.Group().add(mesh(g, corrM)), t0, 'drop', dy);
  sheet(placeSheet(corrSheet(-OUT.zb, SHEET.roof - FLOOR, FLOOR, CORR), Zb, Y, V3(SHEET.left, FLOOR, 0)), S0 + 0.3);
  sheet(placeSheet(corrSheet(SHEET.shared - OUT.x0, SHEET.roof - FLOOR, FLOOR, CORR), X, Y, V3(OUT.x0, FLOOR, SHEET.back)), S0 + 0.42);
  {
    // the wall between the room and the stairs: full height behind the stairs, above the doorway in front
    const g1 = placeSheet(corrSheet(-OUT.zb - 1.22, TOP - FLOOR, FLOOR, CORR), Zb, Y, V3(SHEET.shared, FLOOR, -1.22));
    const g2 = placeSheet(corrSheet(1.22, TOP - WD.DOORWAY.y1, WD.DOORWAY.y1, CORR), Zb, Y, V3(SHEET.shared, WD.DOORWAY.y1, 0));
    sheet(G.mergeAll([g1, g2]), S0 + 0.54);
  }
  sheet(placeSheet(corrSheet(OUT.x1 - SHEET.shared, TOP - FLOOR, FLOOR, CORR), X, Y, V3(SHEET.shared, FLOOR, SHEET.stairBack)), S0 + 0.64);
  sheet(placeSheet(corrSheet(-SHEET.stairBack + 0.05, TOP - FLOOR, FLOOR, CORR), Zb, Y, V3(SHEET.right, FLOOR, 0)), S0 + 0.74);
  sheet(placeSheet(corrSheet(-OUT.zb, SHEET.shared + 0.05 - OUT.x0, OUT.x0, CORR), Zf, X, V3(OUT.x0, SHEET.roof, OUT.zb)), S0 + 0.98, 1.2);
  // the steps: a concrete saw-tooth across the stairwell
  {
    const sh = new THREE.Shape();
    sh.moveTo(STAIR.x0, FLOOR);
    sh.lineTo(WD.stepX(WD.STEPS.n - 1), FLOOR);
    for (let i = WD.STEPS.n - 1; i >= 0; i--) {
      sh.lineTo(WD.stepX(i), WD.stepTop(i));
      sh.lineTo(WD.stepX(i) + WD.STEPS.run, WD.stepTop(i));
    }
    sh.lineTo(STAIR.x1, FLOOR);
    sh.closePath();
    const sg = new THREE.ExtrudeGeometry(sh, { depth: -STAIR.zb, bevelEnabled: false });
    sg.translate(0, 0, STAIR.zb);
    part(new THREE.Group().add(mesh(sg, conc(2, 0, 0))), S0 + 1.08, 'drop', 1.0);
  }

  // -------------------------------------------------------------------------
  // the hatch frame round the stairwell (steel angle on the lawn, a black rubber seal
  // on top) and the heavy steel door: diamond plate on a stiffened frame, black
  // rubber seals all round its underside, big hinges on the back edge, handles
  // -------------------------------------------------------------------------
  const doorSteel = MAT.paintedSteel('doorSteel', '#3c4640');
  const plateMat = MAT.patch(new THREE.MeshStandardMaterial({ color: SRC('#8e9497'), roughness: 0.38, metalness: 0.9, envMap }), {
    key: 'diamond', bumpFn: 'dpB', colorFn: 'dpC',
    extraFrag: `float dpL(vec3 p){ vec2 q = vec2(p.x + p.z, p.x - p.z) * 14.0; vec2 c = fract(q) - 0.5; vec2 id = floor(q);
        float o = mod(id.x + id.y, 2.0) > 0.5 ? 1.0 : -1.0; vec2 r = vec2(c.x * 0.7071 - c.y * 0.7071 * o, c.x * 0.7071 * o + c.y * 0.7071);
        return smoothstep(0.08, 0.0, abs(r.x) * 0.55 + abs(r.y) * 2.2 - 0.22); }
      float dpB(vec3 p, vec3 n){ return 0.002 * dpL(p) * aaF(28.0); }
      vec3 dpC(vec3 p, vec3 n){ return vec3(0.9 + 0.18 * fbm(p.xz * 9.0)) * (1.0 - 0.25 * smoothstep(0.62, 0.8, fbm(p.xz * 3.0 + 5.0))); }`,
  });
  envMats.push(plateMat);
  const sealM = new THREE.MeshStandardMaterial({ color: SRC('#111213'), roughness: 0.78, metalness: 0, emissive: SRC('#ffd21a'), emissiveIntensity: 0 });
  const handleM = shiny(std('#c8cdd0', 0.3, 1.0));
  const hx0 = HATCH.x0 - 0.05, hx1 = HATCH.x1 + 0.05, hz0 = HATCH.z0 - 0.07, hz1 = -0.005;
  const frameG = new THREE.Group();
  {
    const fr = [G.boxMM(hx0, -0.08, hz1 - 0.06, hx1, TOP, hz1), G.boxMM(hx0, -0.08, hz0, hx1, TOP, hz0 + 0.06),
      G.boxMM(hx0, -0.08, hz0, hx0 + 0.06, TOP, hz1), G.boxMM(hx1 - 0.06, -0.08, hz0, hx1, TOP, hz1)];
    frameG.add(mesh(G.mergeAll(fr), doorSteel));
    const sl = [G.boxMM(hx0 + 0.008, TOP, hz1 - 0.05, hx1 - 0.008, TOP + 0.018, hz1 - 0.012), G.boxMM(hx0 + 0.008, TOP, hz0 + 0.012, hx1 - 0.008, TOP + 0.018, hz0 + 0.05),
      G.boxMM(hx0 + 0.012, TOP, hz0 + 0.012, hx0 + 0.05, TOP + 0.018, hz1 - 0.012), G.boxMM(hx1 - 0.05, TOP, hz0 + 0.012, hx1 - 0.012, TOP + 0.018, hz1 - 0.012)];
    frameG.add(mesh(G.mergeAll(sl), sealM));
  }
  part(frameG, S0 + 1.18, 'drop', 0.8);
  const DW = hx1 - hx0, DD = hz1 - hz0; // the leaf covers the whole frame
  const doorPivot = new THREE.Group(); // hinge line along x at the back edge, on the seal
  doorPivot.position.set((hx0 + hx1) / 2, TOP + 0.02, hz0);
  const door = new THREE.Group();
  doorPivot.add(door);
  {
    door.add(mesh(G.box(DW, 0.014, DD, 0, 0.06, DD / 2), plateMat));
    const fr = [G.box(DW, 0.06, 0.06, 0, 0.025, DD - 0.03), G.box(DW, 0.06, 0.06, 0, 0.025, 0.03), G.box(0.06, 0.06, DD, -DW / 2 + 0.03, 0.025, DD / 2), G.box(0.06, 0.06, DD, DW / 2 - 0.03, 0.025, DD / 2)];
    // stiffeners: raised ribs across the top, so it reads as thick and heavy
    for (const f of [-0.25, 0.0, 0.25]) fr.push(G.box(0.05, 0.05, DD - 0.12, DW * f, 0.09, DD / 2));
    fr.push(G.box(DW - 0.12, 0.05, 0.05, 0, 0.09, DD / 2));
    door.add(mesh(G.mergeAll(fr), doorSteel));
    // black rubber seal all round the underside
    const ds = [G.box(DW - 0.02, 0.02, 0.04, 0, -0.012, DD - 0.035), G.box(DW - 0.02, 0.02, 0.04, 0, -0.012, 0.035), G.box(0.04, 0.02, DD - 0.02, -DW / 2 + 0.035, -0.012, DD / 2), G.box(0.04, 0.02, DD - 0.02, DW / 2 - 0.035, -0.012, DD / 2)];
    door.add(mesh(G.mergeAll(ds), sealM));
    // a lifting handle on top, a pull bar underneath
    door.add(mesh(G.mergeAll([G.rod(V3(-0.25, 0.07, DD * 0.84), V3(-0.25, 0.17, DD * 0.84), 0.015, 0.015, 8), G.rod(V3(0.25, 0.07, DD * 0.84), V3(0.25, 0.17, DD * 0.84), 0.015, 0.015, 8), G.rod(V3(-0.25, 0.17, DD * 0.84), V3(0.25, 0.17, DD * 0.84), 0.017, 0.017, 8)]), handleM));
    door.add(mesh(G.mergeAll([G.rod(V3(0.1, -0.02, DD * 0.6), V3(0.1, -0.12, DD * 0.6), 0.015, 0.015, 8), G.rod(V3(0.55, -0.02, DD * 0.6), V3(0.55, -0.12, DD * 0.6), 0.015, 0.015, 8), G.rod(V3(0.1, -0.12, DD * 0.6), V3(0.55, -0.12, DD * 0.6), 0.017, 0.017, 8)]), handleM));
    // the hinges: big knuckles on the back edge
    const hingeM = shiny(std('#5b605d', 0.4, 0.85));
    for (const hx of [-DW / 2 + 0.35, DW / 2 - 0.35]) {
      const kn = new THREE.CylinderGeometry(0.04, 0.04, 0.3, 14);
      kn.rotateZ(Math.PI / 2);
      door.add(mesh(G.mergeAll([kn, G.box(0.28, 0.014, 0.2, 0, 0.06, 0.1)]).translate(hx, 0.0, 0), hingeM));
      frameG.add(mesh(G.box(0.28, 0.06, 0.1, (hx0 + hx1) / 2 + hx, TOP - 0.01, hz0 - 0.03), hingeM));
    }
  }
  scene.add(doorPivot);
  // door angle (0 shut): snaps on standing open, swung shut over his head, lands on its seals
  const OPEN = 1.72;
  function doorAngle(t) {
    if (t < T.doorClose) return OPEN;
    const c = prog(t, T.doorClose, T.doorShut - T.doorClose);
    return OPEN * (1 - c * c) - 0.02 * U.wobble(t, T.doorShut, 7, 9);
  }
  updaters.push((t) => {
    const k = popIn(t, T.door, 0.38, 2.4);
    doorPivot.visible = k > 0.001;
    doorPivot.scale.setScalar(Math.max(0.001, 0.6 + 0.4 * k));
    doorPivot.position.y = TOP + 0.02 + (1 - k) * 0.8;
    doorPivot.rotation.x = -doorAngle(t);
    // the seals light up all round ("rubber seals all around it")
    const g = bump(t, T.seals, T.seals + 1.6, 0.25);
    sealM.emissiveIntensity = g * (0.55 + 0.45 * Math.sin((t - T.seals) * 9)) * 2.2;
  });

  // -------------------------------------------------------------------------
  // the air pipe: up through the roof and the lawn to 4 m, a gooseneck inlet with a
  // mesh screen at the top (it telescopes up out of the lawn); a flange at the ceiling
  // -------------------------------------------------------------------------
  const pipeM = shiny(MAT.galvMaterial('pipe', '#aab1b5'));
  const pipeUp = new THREE.Group(); // above the lawn, scaled up from the ground
  pipeUp.position.set(PIPE.x, 0, PIPE.z);
  {
    const H = PIPE.top;
    pipeUp.add(mesh(new THREE.CylinderGeometry(PIPE.r, PIPE.r, H, 20).translate(0, H / 2, 0), pipeM));
    // telescoping joints
    for (const y of [1.3, 2.6]) pipeUp.add(mesh(new THREE.CylinderGeometry(PIPE.r + 0.012, PIPE.r + 0.012, 0.08, 20).translate(0, y, 0), pipeM));
    // the gooseneck: a 180-degree bend and a short stub pointing down, a mesh screen
    const bend = new THREE.TorusGeometry(0.14, PIPE.r, 12, 20, Math.PI);
    bend.translate(0.14, H, 0);
    pipeUp.add(mesh(bend, pipeM));
    pipeUp.add(mesh(new THREE.CylinderGeometry(PIPE.r, PIPE.r, 0.18, 20).translate(0.28, H - 0.09, 0), pipeM));
    pipeUp.add(mesh(new THREE.CircleGeometry(PIPE.r * 0.95, 20).rotateX(Math.PI / 2).translate(0.28, H - 0.18, 0), std('#3a3d3f', 0.6, 0.6, { side: THREE.DoubleSide })));
    // a collar where it comes out of the lawn
    pipeUp.add(mesh(new THREE.CylinderGeometry(PIPE.r + 0.05, PIPE.r + 0.07, 0.06, 20).translate(0, 0.03, 0), pipeM));
  }
  scene.add(pipeUp);
  const pipeIn = new THREE.Group(); // under the ceiling: a flange, later the stub into the filter
  {
    pipeIn.add(mesh(new THREE.CylinderGeometry(PIPE.r + 0.05, PIPE.r + 0.05, 0.025, 20).translate(PIPE.x, CEIL - 0.012, PIPE.z), pipeM));
    pipeIn.add(mesh(new THREE.CylinderGeometry(PIPE.r, PIPE.r, 0.12, 20).translate(PIPE.x, CEIL - 0.06, PIPE.z), pipeM));
  }
  scene.add(pipeIn);
  const pipeK = (t) => easeOutBack(prog(t, T.pipe0, T.pipe1 - T.pipe0), 1.3);
  updaters.push((t) => {
    const k = pipeK(t);
    pipeUp.visible = t > T.pipe0;
    pipeUp.scale.set(1, Math.max(0.002, k), 1);
    pipeIn.visible = t > T.pipe0;
  });

  // -------------------------------------------------------------------------
  // the carbon filter: a black box on the pipe under the ceiling. Its front comes
  // off to show the bed of black carbon grains between two perforated plates; green
  // gas dots come down the pipe and stick in the grains
  // -------------------------------------------------------------------------
  const F = FILTER;
  const boxM = std('#1b1d1f', 0.5, 0.35);
  const filterG = new THREE.Group();
  const fx0 = F.x - F.w / 2, fx1 = F.x + F.w / 2, fy0 = F.y - F.h / 2, fy1 = F.y + F.h / 2, fz0 = F.z - F.d / 2, fz1 = F.z + F.d / 2;
  {
    const wl = 0.012;
    filterG.add(mesh(G.mergeAll([
      G.boxMM(fx0, fy0, fz0, fx1, fy1, fz0 + wl), // back
      G.boxMM(fx0, fy1 - wl, fz0, fx1, fy1, fz1), // top
      G.boxMM(fx0, fy0, fz0, fx1, fy0 + wl, fz1), // bottom
      G.boxMM(fx0, fy0, fz0, fx0 + wl, fy1, fz1), // left
      G.boxMM(fx1 - wl, fy0, fz0, fx1, fy1, fz1), // right
      // the rim of the open front
      G.boxMM(fx0, fy1 - 0.03, fz1 - 0.012, fx1, fy1, fz1), G.boxMM(fx0, fy0, fz1 - 0.012, fx1, fy0 + 0.03, fz1),
      G.boxMM(fx0, fy0, fz1 - 0.012, fx0 + 0.03, fy1, fz1), G.boxMM(fx1 - 0.03, fy0, fz1 - 0.012, fx1, fy1, fz1),
    ]), boxM));
    // a stub up into the pipe, an outlet down to the fan
    filterG.add(mesh(new THREE.CylinderGeometry(PIPE.r, PIPE.r, CEIL - 0.1 - fy1, 20).translate(PIPE.x, (CEIL - 0.1 + fy1) / 2, PIPE.z), pipeM));
    filterG.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, fy0 - (FAN.y + FAN.r), 16).translate(F.x, (fy0 + FAN.y + FAN.r) / 2, F.z), boxM));
    // the perforated plates above and below the carbon bed
    const perfM = MAT.patch(std('#6e7377', 0.45, 0.8), {
      key: 'perf', colorFn: 'pfC',
      extraFrag: 'vec3 pfC(vec3 p, vec3 n){ vec2 q = fract(p.xz * 60.0) - 0.5; return vec3(mix(0.08, 1.0, smoothstep(0.22, 0.3, length(q)))); }',
    });
    for (const y of [fy1 - 0.07, fy0 + 0.07]) filterG.add(mesh(G.boxMM(fx0 + 0.012, y - 0.004, fz0 + 0.012, fx1 - 0.012, y + 0.004, fz1 - 0.012), perfM));
    // a white label on the side: CARBON
    filterG.add(mesh(G.boxMM(fx1, F.y - 0.05, F.z - 0.08, fx1 + 0.002, F.y + 0.05, F.z + 0.08), std('#e9e7df', 0.6)));
  }
  // the carbon grains: matte black, irregular, packed in the front of the bed
  const grainGeo = G.lumpyBlob(1, 1, 0.3, 41);
  const grains = instanced(grainGeo, std('#1a1b1c', 0.42, 0.25), 1600, false);
  {
    const r = U.mulberry32(77);
    beginInst(grains);
    for (let i = 0; i < 1600; i++) {
      const s = 0.009 + 0.008 * r();
      setInst(grains, fx0 + 0.02 + r() * (F.w - 0.04), fy0 + 0.08 + r() * (F.h - 0.16), fz1 - 0.015 - Math.pow(r(), 1.6) * 0.15, s, s * (0.75 + 0.5 * r()), s * (0.8 + 0.4 * r()), r() * 6, r() * 6, r() * 6);
    }
    endInst(grains);
  }
  // the front panel: comes off (lifts and fades out) to show the inside
  const frontM = std('#1b1d1f', 0.5, 0.35, { transparent: true, opacity: 1 });
  const front = mesh(G.boxMM(fx0 + 0.005, fy0 + 0.005, fz1 - 0.012, fx1 - 0.005, fy1 - 0.005, fz1 + 0.004), frontM);
  front.add(mesh(G.boxMM(F.x - 0.13, F.y - 0.05, fz1 + 0.004, F.x + 0.13, F.y + 0.05, fz1 + 0.006), std('#e9e7df', 0.6)));
  filterG.add(front);
  // the gas dots: glowing green, they come down the pipe and stick in the grains
  const dotM = new THREE.MeshStandardMaterial({ color: SRC('#9be22a'), emissive: SRC('#7fd11a'), emissiveIntensity: 2.2, roughness: 0.4 });
  const dots = instanced(new THREE.SphereGeometry(1, 10, 8), dotM, 48, false);
  const DOTS = (() => {
    const r = U.mulberry32(5);
    return Array.from({ length: 48 }, (_, i) => ({
      t0: T.dots0 + i * 0.045 + r() * 0.1,
      x: fx0 + 0.05 + r() * (F.w - 0.1), y: fy0 + 0.1 + r() * (F.h - 0.22), z: fz1 - 0.02 - r() * 0.05, s: 0.008 + 0.004 * r(), w: r() * 6,
    }));
  })();
  scene.add(filterG);
  updaters.push((t) => {
    const k = popIn(t, T.filter, 0.36, 2.4);
    filterG.visible = k > 0.001;
    filterG.position.y = (1 - k) * -0.5;
    grains.visible = filterG.visible;
    // the front comes off
    const o = smooth(prog(t, T.cutOpen, 0.45));
    front.position.y = o * 0.05;
    front.position.z = o * 0.12;
    frontM.opacity = 1 - o;
    front.visible = o < 0.999;
    for (const c of front.children) c.visible = o < 0.4;
    // gas dots: down the pipe stub into the box, then wandering into the grains and stuck
    beginInst(dots);
    for (const d of DOTS) {
      const u = t - d.t0;
      if (u < 0 || o < 0.5) continue;
      const fall = clamp(u / 0.55);
      const e = easeOutCubic(fall);
      const x = lerp(PIPE.x + 0.02 * Math.sin(d.w), d.x, e), y = lerp(fy1 + 0.02, d.y, e), z = lerp(PIPE.z + 0.06, d.z, e);
      const jig = fall < 1 ? 0.004 * Math.sin(u * 40 + d.w) : 0.0012 * Math.sin(t * 6 + d.w);
      setInst(dots, x + jig, y, z, d.s);
    }
    endInst(dots);
  });

  // -------------------------------------------------------------------------
  // the fan, under the filter, blowing into the room, and its switch by the bench
  // -------------------------------------------------------------------------
  const fanG = new THREE.Group();
  fanG.position.set(FAN.x, FAN.y, FAN.z);
  const blades = new THREE.Group();
  {
    const housingM = std('#2c3034', 0.5, 0.45);
    const ring = new THREE.CylinderGeometry(FAN.r + 0.025, FAN.r + 0.025, 0.12, 32, 1, true);
    ring.rotateX(Math.PI / 2);
    fanG.add(mesh(ring, std('#2c3034', 0.5, 0.45, { side: THREE.DoubleSide })));
    fanG.add(mesh(new THREE.TorusGeometry(FAN.r + 0.025, 0.012, 8, 32).translate(0, 0, 0.06), housingM));
    fanG.add(mesh(G.box(0.1, 0.16, 0.05, 0, FAN.r + 0.06, -0.02), housingM));
    // the guard: rings and spokes
    const gg = [];
    for (const rr of [0.06, 0.12, FAN.r]) gg.push(new THREE.TorusGeometry(rr, 0.003, 4, 32).translate(0, 0, 0.065));
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      gg.push(G.rod(V3(0, 0, 0.065), V3(Math.cos(a) * FAN.r, Math.sin(a) * FAN.r, 0.065), 0.003, 0.003, 4));
    }
    fanG.add(mesh(G.mergeAll(gg), shiny(std('#b9bdc0', 0.35, 0.9))));
    // the blades round a hub
    const bladeM = std('#d6d9db', 0.45, 0.1, { side: THREE.DoubleSide });
    blades.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 16).rotateX(Math.PI / 2), housingM));
    for (let k = 0; k < 5; k++) {
      const b = new THREE.Shape();
      b.moveTo(0.03, -0.025);
      b.quadraticCurveTo(0.12, -0.06, FAN.r - 0.01, -0.03);
      b.quadraticCurveTo(FAN.r + 0.005, 0.02, FAN.r - 0.03, 0.045);
      b.quadraticCurveTo(0.1, 0.04, 0.03, 0.025);
      const bg = new THREE.ShapeGeometry(b, 6);
      bg.rotateX(0.35);
      bg.rotateZ((k / 5) * Math.PI * 2);
      blades.add(mesh(bg, bladeM));
    }
    fanG.add(blades);
  }
  scene.add(fanG);
  const switchG = new THREE.Group();
  const lever = new THREE.Group();
  const ledM = new THREE.MeshStandardMaterial({ color: SRC('#1b3d14'), emissive: SRC('#39ff4a'), emissiveIntensity: 0, roughness: 0.4 });
  {
    const S = WD.SWITCH;
    switchG.position.set(S.x, S.y, S.z);
    switchG.add(mesh(G.box(0.1, 0.14, 0.05, 0, 0, 0.025), std('#d9d6cc', 0.55)));
    lever.position.set(0, 0, 0.055);
    lever.add(mesh(G.box(0.018, 0.05, 0.018, 0, 0.022, 0), std('#202020', 0.5)));
    switchG.add(lever);
    switchG.add(mesh(new THREE.SphereGeometry(0.008, 8, 6).translate(0.03, 0.045, 0.052), ledM));
    // the cable up the wall to the fan
    switchG.add(mesh(G.rod(V3(0, 0.07, 0.01), V3(FAN.x - S.x + 0.18, FAN.y - S.y + 0.05, 0.01), 0.008, 0.008, 6), std('#1a1a1a', 0.7)));
  }
  scene.add(switchG);
  const fanSpin = (t) => {
    // speed ramps up after the click; angle is the integral
    const u = t - T.fanOn - 0.08;
    if (u <= 0) return 0;
    const ramp = 0.9;
    return u < ramp ? (30 * u * u) / (2 * ramp) : 30 * (u - ramp / 2);
  };
  updaters.push((t) => {
    const k = popIn(t, T.filter + 0.35, 0.36, 2.4);
    fanG.visible = switchG.visible = k > 0.001;
    fanG.scale.setScalar(Math.max(0.001, k));
    blades.rotation.z = -fanSpin(t);
    const on = t > T.fanOn;
    lever.rotation.x = on ? -0.6 : 0.6;
    ledM.emissiveIntensity = on ? 3 : 0;
  });

  // -------------------------------------------------------------------------
  // the room: a bench along the back wall, a caged lamp, the stuffy haze
  // -------------------------------------------------------------------------
  const benchWood = MAT.woodMaterial('bench', '#9c7550', 'abs(n.y) > 0.5 ? vec2(p.x, p.z) : (abs(n.x) > 0.5 ? vec2(p.z, p.y) : vec2(p.x, p.y))', 0.14, 0.7);
  const B = WD.BENCH;
  const bench = new THREE.Group();
  {
    const legs = [];
    for (const x of [B.x0 + 0.12, (B.x0 + B.x1) / 2, B.x1 - 0.12]) legs.push(G.boxMM(x - 0.03, FLOOR, B.z1 - 0.1, x + 0.03, B.seat - 0.05, B.z1 - 0.04), G.boxMM(x - 0.03, B.seat - 0.12, B.z0 + 0.06, x + 0.03, B.seat - 0.06, B.z1 - 0.04));
    bench.add(mesh(G.boxMM(B.x0, B.seat - 0.05, B.z0 + 0.06, B.x1, B.seat, B.z1), benchWood));
    bench.add(mesh(G.mergeAll(legs), MAT.paintedSteel('benchLeg', '#30343a')));
  }
  part(bench, S0 + 1.3, 'drop', 0.8);
  const lampG = new THREE.Group();
  const bulbM = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: SRC('#ffd59a'), emissiveIntensity: 0, roughness: 0.3 });
  {
    const L = WD.LAMP;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), bulbM);
    bulb.position.set(0, -0.1, 0);
    const cage = [];
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      cage.push(G.rod(V3(Math.cos(a) * 0.06, -0.02, Math.sin(a) * 0.06), V3(Math.cos(a) * 0.065, -0.16, Math.sin(a) * 0.065), 0.004, 0.004, 4));
    }
    cage.push(G.placed(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 14), 0, -0.01, 0));
    lampG.add(mesh(G.mergeAll(cage), std('#2a2a2a', 0.5, 0.6)), bulb);
    lampG.position.set(L.x, SHEET.roof - 0.13, L.z);
  }
  part(lampG, S0 + 1.3, 'drop', 0.5);
  // a hook on the back wall at the end of the bench: the gas mask hangs on it
  {
    const H = WD.HOOK;
    const hk = G.mergeAll([G.box(0.05, 0.08, 0.012, H.x, H.y, H.z + 0.006), G.rod(V3(H.x, H.y - 0.025, H.z + 0.01), V3(H.x, H.y - 0.025, H.z + 0.07), 0.006, 0.006, 6),
      G.rod(V3(H.x, H.y - 0.025, H.z + 0.07), V3(H.x, H.y + 0.012, H.z + 0.085), 0.006, 0.006, 6)]);
    part(new THREE.Group().add(mesh(hk, shiny(std('#9aa0a3', 0.35, 0.9)))), S0 + 1.3, 'drop', 0.5);
  }
  updaters.push((t) => {
    // the lamp comes on when the door shuts out the daylight
    const k = 0.6 * smooth(prog(t, T.doorShut - 0.1, 0.3));
    bulbM.emissiveIntensity = 6 * k;
    ctx.lamp.intensity = 3.0 * k;
    ctx.lamp.position.set(WD.LAMP.x, SHEET.roof - 0.33, WD.LAMP.z);
  });
  // the stuffy haze: warm dusty air filling the room until the clean air flows in
  const haze = new THREE.Mesh(
    new THREE.BoxGeometry(ROOM.x1 - ROOM.x0 - 0.06, SHEET.roof - 0.1 - FLOOR, -ROOM.zb - 0.06),
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.FrontSide,
      uniforms: { uA: { value: 0 }, uT: { value: 0 } },
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `uniform float uA, uT; varying vec3 vW;
        ${MAT.GLSL_NOISE}
        void main(){ float n = fbm(vW.xy * 1.6 + vec2(uT * 0.05, uT * 0.03)) * 0.6 + fbm(vW.xy * 5.0 - uT * 0.08) * 0.4;
          float a = uA * (0.55 + 0.45 * n) * (0.7 + 0.3 * smoothstep(${FLOOR.toFixed(2)}, ${CEIL.toFixed(2)}, vW.y));
          gl_FragColor = vec4(vec3(0.62, 0.52, 0.38) * (0.75 + 0.35 * n), a); }`,
    })
  );
  haze.position.set((ROOM.x0 + ROOM.x1) / 2, (FLOOR + SHEET.roof - 0.1) / 2, ROOM.zb / 2);
  haze.renderOrder = 8;
  scene.add(haze);
  updaters.push((t) => {
    const a = 0.2 * smooth(prog(t, T.stuffy0, 1.0)) * (1 - smooth(prog(t, T.air0 + 0.4, 1.4)));
    haze.material.uniforms.uA.value = a;
    haze.material.uniforms.uT.value = t;
    haze.visible = a > 0.002;
  });

  ctx.FX.doorAngle = doorAngle;
  ctx.FX.pipeK = pipeK;
  ctx.FX.fanSpin = fanSpin;
  ctx.FX.filterBox = { x0: fx0, x1: fx1, y0: fy0, y1: fy1, z1: fz1 };

  return {
    update(t) {
      for (const u of updaters) u(t);
    },
  };
}
