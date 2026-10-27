// The shelter: reinforced concrete walls and slabs (cut by the cutaway, so the
// section shows the aggregate and the steel bars), steep concrete stairs, the
// steel rebar cages that snap in first, the helical ground anchors, the steel
// hatch door with its hinges and three bolts, the two vent pipes with their caps,
// the benches, the shelving and the supplies, the ceiling lamp and the stuffy haze.
import * as THREE from 'three';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const SRC = (s) => new THREE.Color(s);

export function build(ctx) {
  const { scene, T, WD, MAT, G, U, add, mesh, envMap, envMats } = ctx;
  const { clamp, lerp, smooth, prog, popIn, easeOutCubic, easeOutBack, bump } = U;
  const { WALL, ROOM, STAIR, OUT, FLOOR, FLOOR_B, CEIL, TOP, HATCH } = WD;
  const updaters = [];
  const shiny = (m) => (envMats.push(m), (m.envMap = envMap), m);
  const std = (hex, rough = 0.6, metal = 0, extra = {}) => new THREE.MeshStandardMaterial({ color: SRC(hex), roughness: rough, metalness: metal, ...extra });

  // -------------------------------------------------------------------------
  // the concrete: one material per element (its own bar layout in the section)
  // uElem: x = 0 wall (thickness along x), 1 slab (along y), 2 no bars (stairs)
  // -------------------------------------------------------------------------
  const conc = (kind, a, b) => MAT.concreteMaterial(new THREE.Vector4(kind, a, b, 0));
  const ZB = OUT.zb; // -2.6
  const els = []; // { obj, mat, t0 (pour start), t1, kind: 'wall' | 'slab' | 'snap' }
  const addEl = (geos, mat, t0, t1, kind) => {
    const g = new THREE.Group();
    const m = mesh(G.mergeAll(geos), mat);
    g.add(m);
    scene.add(g);
    els.push({ g, m, mat, t0, t1, kind });
    return g;
  };
  // the floor slab (whole footprint)
  addEl([G.boxMM(OUT.x0, FLOOR_B, ZB, OUT.x1, FLOOR, 0)], conc(1, FLOOR_B, FLOOR), T.pour0 - 0.15, T.pour0 + 0.25, 'slab');
  // the room's left wall, back wall; the wall between the room and the stairs (with
  // its doorway), the stairwell's back and right walls
  const wT0 = T.pour0 + 0.1, wT1 = T.pour1;
  addEl([G.boxMM(OUT.x0, FLOOR, ZB, ROOM.x0, CEIL, 0)], conc(0, OUT.x0, ROOM.x0), wT0, wT1, 'wall');
  addEl([G.boxMM(OUT.x0, FLOOR, ZB, ROOM.x1 + WALL, CEIL, ROOM.zb)], conc(0, 0, 0), wT0, wT1, 'wall');
  addEl([G.boxMM(ROOM.x1, FLOOR, ZB, STAIR.x0, CEIL, STAIR.zb + 0.05), G.boxMM(ROOM.x1, WD.DOORWAY.y1, STAIR.zb + 0.05, STAIR.x0, CEIL, 0)], conc(0, ROOM.x1, STAIR.x0), wT0 + 0.08, wT1 + 0.08, 'wall');
  addEl([G.boxMM(STAIR.x0, FLOOR, STAIR.zb - WALL, OUT.x1, TOP, STAIR.zb)], conc(0, 0, 0), wT0 + 0.15, wT1 + 0.15, 'wall');
  addEl([G.boxMM(STAIR.x1, FLOOR, STAIR.zb - WALL, OUT.x1, TOP, 0)], conc(0, STAIR.x1, OUT.x1), wT0 + 0.15, wT1 + 0.15, 'wall');
  // the steps: a saw-tooth solid across the stairwell
  {
    const sh = new THREE.Shape();
    sh.moveTo(STAIR.x0, FLOOR);
    sh.lineTo(WD.stepX(WD.STEPS.n - 1), FLOOR);
    for (let i = WD.STEPS.n - 1; i >= 0; i--) {
      sh.lineTo(WD.stepX(i), WD.stepTop(i));
      sh.lineTo(WD.stepX(i) + WD.STEPS.run, WD.stepTop(i));
    }
    sh.lineTo(STAIR.x1, TOP - 0.02);
    sh.lineTo(STAIR.x1, FLOOR);
    sh.closePath();
    const sg = new THREE.ExtrudeGeometry(sh, { depth: -STAIR.zb, bevelEnabled: false });
    sg.translate(0, 0, STAIR.zb);
    addEl([sg], conc(2, 0, 0), T.pour0 + 0.5, T.pour1 + 0.15, 'wall');
  }
  // the roof slab over the room (and over the bottom of the stairs, up to the hatch)
  addEl([G.boxMM(OUT.x0, CEIL, ZB, STAIR.x0, TOP, 0), G.boxMM(STAIR.x0, CEIL, STAIR.zb - WALL, HATCH.x0, TOP, 0)], conc(1, CEIL, TOP), T.slab, T.slab + 0.4, 'snap');
  // cutaway logic: the slab does not shade the room (the light comes in through the cut)
  els[els.length - 1].m.castShadow = false;
  // a raised kerb round the hatch opening on the right wall's top
  // (the right wall already rises to the slab top)

  // rebar cages: snap in one after another before the concrete comes up round them
  const rebarMat = MAT.rebarMaterial();
  const cages = [];
  const R = 0.008;
  const bar = (a, b) => G.rod(a, b, R, R, 5);
  function wallCage(x0, x1, y0, y1, z0, z1, alongZ = true) {
    // two mats near the faces of a wall that runs along z (alongZ) or along x
    const gs = [];
    const c = 0.055;
    if (alongZ) {
      for (const x of [x0 + c, x1 - c]) {
        for (let z = z0 + 0.1; z < z1 - 0.02; z += 0.2) gs.push(bar(V3(x, y0 + 0.03, z), V3(x, y1 + 0.12, z)));
        for (let y = y0 + 0.1; y < y1; y += 0.2) gs.push(bar(V3(x + (x === x0 + c ? 0.021 : -0.021), y, z0 + 0.03), V3(x + (x === x0 + c ? 0.021 : -0.021), y, z1)));
      }
    } else {
      for (const z of [z0 + c, z1 - c]) {
        for (let x = x0 + 0.1; x < x1 - 0.02; x += 0.2) gs.push(bar(V3(x, y0 + 0.03, z), V3(x, y1 + 0.12, z)));
        for (let y = y0 + 0.1; y < y1; y += 0.2) gs.push(bar(V3(x0 + 0.03, y, z + (z === z0 + c ? 0.021 : -0.021)), V3(x1 - 0.03, y, z + (z === z0 + c ? 0.021 : -0.021))));
      }
    }
    return gs;
  }
  function slabCage(x0, x1, y0, y1, z0, z1) {
    const gs = [];
    const c = 0.055;
    for (const y of [y0 + c, y1 - c]) {
      for (let z = z0 + 0.1; z < z1; z += 0.2) gs.push(bar(V3(x0 + 0.03, y, z), V3(x1 - 0.03, y, z)));
      for (let x = x0 + 0.07; x < x1; x += 0.2) gs.push(bar(V3(x, y + (y === y0 + c ? 0.021 : -0.021), z0 + 0.03), V3(x, y + (y === y0 + c ? 0.021 : -0.021), z1)));
    }
    return gs;
  }
  const mkCage = (gs, t0) => {
    const g = new THREE.Group();
    g.add(mesh(G.mergeAll(gs), rebarMat));
    scene.add(g);
    cages.push({ g, t0 });
  };
  const rg = T.rebar0, gap = T.rebarGap;
  mkCage(slabCage(OUT.x0, OUT.x1, FLOOR_B, FLOOR, ZB, 0), rg);
  mkCage(wallCage(OUT.x0, ROOM.x0, FLOOR, CEIL, ZB, 0), rg + gap);
  mkCage(wallCage(OUT.x0, ROOM.x1 + WALL, FLOOR, CEIL, ZB, ROOM.zb, false), rg + gap * 2);
  mkCage(wallCage(ROOM.x1, STAIR.x0, FLOOR, CEIL, ZB, 0), rg + gap * 3);
  mkCage(wallCage(STAIR.x0, OUT.x1, FLOOR, TOP, STAIR.zb - WALL, STAIR.zb, false), rg + gap * 4);
  mkCage(wallCage(STAIR.x1, OUT.x1, FLOOR, TOP, STAIR.zb - WALL, 0), rg + gap * 5);
  mkCage(slabCage(OUT.x0, HATCH.x0, CEIL, TOP, ZB, 0), T.slab - 0.45);
  const CAGE_T = cages.map((c) => c.t0);

  updaters.push((t) => {
    for (const c of cages) {
      // drops in from above with a bounce; gone once the concrete covers it
      const k = popIn(t, c.t0, 0.36, 2.2);
      c.g.visible = k > 0.001 && t < T.slab + 0.6;
      c.g.position.y = (1 - k) * 0.9;
      c.g.scale.setScalar(Math.max(0.001, 0.6 + 0.4 * k));
    }
    for (const e of els) {
      let k;
      if (e.kind === 'snap') k = popIn(t, e.t0, 0.38, 1.8);
      else k = easeOutCubic(prog(t, e.t0, e.t1 - e.t0));
      e.g.visible = k > 0.002;
      if (!e.g.visible) continue;
      if (e.kind === 'snap') {
        e.g.position.y = (1 - Math.min(1, k)) * 1.2;
        e.g.scale.set(1, 1, 1);
      } else {
        // the concrete rises from the bottom of its forms
        const box = e.m.geometry.boundingBox || (e.m.geometry.computeBoundingBox(), e.m.geometry.boundingBox);
        const y0 = box.min.y;
        e.g.scale.set(1, Math.max(0.002, k), 1);
        e.g.position.y = y0 * (1 - k);
      }
      // the bars in the cut glow for a moment ("steel bars inside")
      e.mat.userData.uniforms.uElem.value.w = 0.9 * bump(t, T.barsGlow, T.barsGlow + 1.1, 0.25) * (e.mat.userData.uniforms.uElem.value.x < 1.5 ? 1 : 0);
      // the slab tops darken with the storm's rain
      e.mat.userData.uniforms.uWet.value = 0.0;
    }
  });

  // -------------------------------------------------------------------------
  // helical ground anchors under the floor slab: they spin down 2 m into the soil
  // -------------------------------------------------------------------------
  const anchorMat = shiny(MAT.galvMaterial('anch', '#9aa0a4'));
  const helixGeo = (() => {
    // one turn of a flat helix plate, 0.15 m radius, 7.5 cm pitch
    const pos = [], idx = [];
    const n = 40;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2, y = (i / n) * 0.075;
      pos.push(Math.cos(a) * 0.03, y, Math.sin(a) * 0.03, Math.cos(a) * 0.15, y, Math.sin(a) * 0.15);
    }
    for (let i = 0; i < n; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  })();
  const anchors = WD.ANCHORS.map((x, i) => {
    const g = new THREE.Group();
    g.position.set(x, FLOOR_B, 0.045);
    const shaft = mesh(new THREE.CylinderGeometry(0.022, 0.022, 1, 10), anchorMat);
    const tip = mesh(new THREE.ConeGeometry(0.022, 0.12, 10), anchorMat);
    tip.rotation.x = Math.PI;
    const h1 = new THREE.Mesh(helixGeo, new THREE.MeshStandardMaterial({ color: SRC('#8d9397'), roughness: 0.45, metalness: 0.85, side: THREE.DoubleSide, envMap }));
    const h2 = h1.clone();
    const spin = new THREE.Group();
    spin.add(tip, h1, h2);
    g.add(shaft, spin);
    // the bracket that ties it into the slab
    const br = mesh(G.box(0.16, 0.05, 0.12, 0, 0.02, 0), anchorMat);
    g.add(br);
    scene.add(g);
    return { g, shaft, spin, tip, h1, h2, br, t0: T.drill0 + i * T.drillGap };
  });
  const DRILL_D = 1.15; // seconds of drilling each
  const anchorDepth = (a, t) => WD.ANCHOR_D * easeOutCubic(prog(t, a.t0, DRILL_D));
  updaters.push((t) => {
    for (const a of anchors) {
      const L = anchorDepth(a, t);
      a.g.visible = t > a.t0 - 0.05;
      a.shaft.visible = L > 0.01;
      a.shaft.scale.y = Math.max(0.001, L);
      a.shaft.position.y = -L / 2;
      a.spin.position.y = -L;
      a.tip.position.y = -0.05;
      a.h1.position.y = 0.18;
      a.h2.position.y = 0.62;
      a.h2.visible = L > 0.65;
      const drilling = t > a.t0 && t < a.t0 + DRILL_D;
      a.spin.rotation.y = -(L / 0.075) * Math.PI * 2;
      // the uplift test: a tiny shudder, nothing moves
      a.g.position.y = FLOOR_B;
      a.br.visible = L > 0.02;
      void drilling;
    }
  });
  const shudder = (t) => 0.004 * bump(t, T.uplift0, T.uplift1, 0.1) * Math.sin(t * 60);

  // -------------------------------------------------------------------------
  // the steel hatch door: diamond-plate top, a rim, two big hinges on the back
  // edge, three barrel bolts under the front edge that slide into keepers on the
  // frame's front rail
  // -------------------------------------------------------------------------
  const doorSteel = MAT.paintedSteel('doorSteel', '#3f4842');
  const plateMat = MAT.patch(new THREE.MeshStandardMaterial({ color: SRC('#8e9497'), roughness: 0.38, metalness: 0.9, envMap }), {
    key: 'diamond', bumpFn: 'dpB', colorFn: 'dpC',
    extraFrag: `float dpL(vec3 p){ vec2 q = vec2(p.x + p.z, p.x - p.z) * 14.0; vec2 c = fract(q) - 0.5; vec2 id = floor(q);
        float o = mod(id.x + id.y, 2.0) > 0.5 ? 1.0 : -1.0; vec2 r = vec2(c.x * 0.7071 - c.y * 0.7071 * o, c.x * 0.7071 * o + c.y * 0.7071);
        return smoothstep(0.08, 0.0, abs(r.x) * 0.55 + abs(r.y) * 2.2 - 0.22); }
      float dpB(vec3 p, vec3 n){ return 0.002 * dpL(p) * aaF(28.0); }
      vec3 dpC(vec3 p, vec3 n){ return vec3(0.9 + 0.18 * fbm(p.xz * 9.0)) * (1.0 - 0.25 * smoothstep(0.62, 0.8, fbm(p.xz * 3.0 + 5.0))); }`,
  });
  envMats.push(plateMat);
  const boltMat = shiny(std('#c8cdd0', 0.3, 1.0));
  const DW = HATCH.x1 - HATCH.x0 - 0.04, DD = -HATCH.z0 - 0.03; // 1.66 x 1.17
  const doorPivot = new THREE.Group(); // hinge line: along x at the back edge, on top of the kerb
  doorPivot.position.set((HATCH.x0 + HATCH.x1) / 2, TOP + 0.005, HATCH.z0 + 0.0);
  const door = new THREE.Group();
  doorPivot.add(door);
  {
    // the leaf extends from the hinge (z = 0 local) towards the camera (+z)
    door.add(mesh(G.box(DW, 0.012, DD, 0, 0.036, DD / 2 + 0.02), plateMat));
    const frame = [G.box(DW, 0.06, 0.05, 0, 0.0, DD - 0.0 + 0.0), G.box(DW, 0.06, 0.05, 0, 0.0, 0.045), G.box(0.05, 0.06, DD, -DW / 2 + 0.025, 0.0, DD / 2 + 0.02), G.box(0.05, 0.06, DD, DW / 2 - 0.025, 0.0, DD / 2 + 0.02)];
    frame.push(G.box(DW - 0.1, 0.04, 0.05, 0, -0.008, DD / 2 + 0.02), G.box(0.05, 0.04, DD - 0.1, -DW / 6, -0.008, DD / 2 + 0.02), G.box(0.05, 0.04, DD - 0.1, DW / 6, -0.008, DD / 2 + 0.02));
    door.add(mesh(G.mergeAll(frame), doorSteel));
    // a lifting handle on top and a pull bar underneath
    door.add(mesh(G.mergeAll([G.rod(V3(-0.2, 0.045, DD * 0.8), V3(-0.2, 0.13, DD * 0.8), 0.014, 0.014, 8), G.rod(V3(0.2, 0.045, DD * 0.8), V3(0.2, 0.13, DD * 0.8), 0.014, 0.014, 8), G.rod(V3(-0.2, 0.13, DD * 0.8), V3(0.2, 0.13, DD * 0.8), 0.016, 0.016, 8)]), boltMat));
    door.add(mesh(G.mergeAll([G.rod(V3(-0.25, -0.03, DD * 0.62), V3(-0.25, -0.12, DD * 0.62), 0.014, 0.014, 8), G.rod(V3(0.25, -0.03, DD * 0.62), V3(0.25, -0.12, DD * 0.62), 0.014, 0.014, 8), G.rod(V3(-0.25, -0.12, DD * 0.62), V3(0.25, -0.12, DD * 0.62), 0.016, 0.016, 8)]), boltMat));
  }
  // hinges: big knuckles on the back edge (half on the leaf, half on the frame)
  const hingeMat = shiny(std('#5b605d', 0.4, 0.85));
  for (const hx of [-DW / 2 + 0.28, DW / 2 - 0.28]) {
    const kn = new THREE.CylinderGeometry(0.035, 0.035, 0.26, 14);
    kn.rotateZ(Math.PI / 2);
    door.add(mesh(G.mergeAll([kn, G.box(0.24, 0.012, 0.16, hx, 0.045, 0.1)]).translate(hx, 0, 0), hingeMat));
  }
  // the fixed frame round the opening: angle iron on the kerb, with the front rail
  const frameG = new THREE.Group();
  {
    const zf = -0.02;
    const fr = [G.boxMM(HATCH.x0 - 0.02, TOP - 0.06, -0.06, HATCH.x1 + 0.02, TOP, zf + 0.02), G.boxMM(HATCH.x0 - 0.02, TOP - 0.06, HATCH.z0 - 0.06, HATCH.x1 + 0.02, TOP, HATCH.z0),
      G.boxMM(HATCH.x0 - 0.06, TOP - 0.06, HATCH.z0 - 0.06, HATCH.x0, TOP, zf + 0.02), G.boxMM(HATCH.x1, TOP - 0.06, HATCH.z0 - 0.06, HATCH.x1 + 0.06, TOP, zf + 0.02)];
    frameG.add(mesh(G.mergeAll(fr), doorSteel));
    for (const hx of [-DW / 2 + 0.28, DW / 2 - 0.28]) frameG.add(mesh(G.box(0.24, 0.05, 0.08, (HATCH.x0 + HATCH.x1) / 2 + hx, TOP - 0.02, HATCH.z0 - 0.03), hingeMat));
  }
  scene.add(doorPivot, frameG);
  // the bolts: under the leaf's front edge, sliding along x into keepers on the front rail
  const BOLTX = [-0.55, 0.0, 0.55];
  const bolts = BOLTX.map((bx) => {
    const g = new THREE.Group();
    const rod = new THREE.CylinderGeometry(0.02, 0.02, 0.2, 12);
    rod.rotateZ(Math.PI / 2);
    const rodM = mesh(rod, boltMat);
    const knob = mesh(G.rod(V3(0, 0, 0), V3(0, -0.07, 0), 0.012, 0.012, 8), boltMat);
    knob.position.x = -0.03;
    const ball = mesh(new THREE.SphereGeometry(0.02, 10, 8), boltMat);
    ball.position.set(-0.03, -0.075, 0);
    const slide = new THREE.Group();
    slide.add(rodM, knob, ball);
    g.add(slide);
    // the guides it slides in (fixed to the leaf)
    g.add(mesh(G.mergeAll([G.box(0.05, 0.05, 0.05, -0.06, 0, 0), G.box(0.05, 0.05, 0.05, 0.05, 0, 0), G.box(0.18, 0.012, 0.07, 0, 0.03, 0)]), doorSteel));
    g.position.set(bx, -0.035, DD - 0.035);
    door.add(g);
    // the keeper on the rail
    const kp = mesh(G.mergeAll([G.box(0.05, 0.06, 0.06, 0, 0, 0)]), doorSteel);
    kp.position.set((HATCH.x0 + HATCH.x1) / 2 + bx + 0.155, TOP - 0.05, -0.035);
    frameG.add(kp);
    return { g, slide, kp };
  });
  const doorIn = (t) => t > T.door - 0.05;
  // door angle: 0 = shut; it opens back past vertical (about the hinge line, x axis)
  function doorAngle(t) {
    let a = 0;
    if (t >= T.hatchOpen - 0.2 && t < T.doorClose + 0.6) {
      const o = smooth(prog(t, T.hatchOpen, 0.55)), c = smooth(prog(t, T.doorClose, 0.32));
      a = 1.85 * o * (1 - c);
      if (t > T.doorClose + 0.32) a = 0;
    }
    if (t >= T.doorOpen) a = 1.85 * U.easeOutBack(prog(t, T.doorOpen, 0.7), 1.2);
    return a;
  }
  function boltsShut(t, i) {
    // 1 = shot home
    const shut1 = smooth(prog(t, T.bolts[i], 0.12));
    const open1 = smooth(prog(t, T.hatchOpen - 0.35 + i * 0.05, 0.12));
    const shut2 = smooth(prog(t, T.lockAll + i * 0.09, 0.1));
    const open2 = smooth(prog(t, T.unbolt + i * 0.12, 0.12));
    if (t < T.hatchOpen - 0.4) return shut1;
    if (t < T.lockAll - 0.05) return 1 - open1;
    if (t < T.unbolt - 0.05) return shut2;
    return 1 - open2;
  }
  updaters.push((t) => {
    const vis = doorIn(t);
    doorPivot.visible = frameG.visible = vis;
    if (!vis) return;
    // drops into place from above, lands with a heavy thud
    const drop = 1 - easeOutCubic(prog(t, T.door, T.doorShut - T.door));
    const land = U.wobble(t, T.doorShut, 6, 9);
    doorPivot.position.y = TOP + 0.005 + drop * 0.9 + 0.012 * land;
    frameG.position.y = drop * 0.9;
    doorPivot.rotation.x = -doorAngle(t);
    bolts.forEach((b, i) => {
      b.slide.position.x = 0.09 * boltsShut(t, i) - 0.0;
      b.kp.visible = true;
    });
  });

  // -------------------------------------------------------------------------
  // a handrail on the stairwell's back wall
  // -------------------------------------------------------------------------
  const railG = new THREE.Group();
  {
    // parallel to the steps, 0.85 m above their nosings, ending under the hatch
    const z = STAIR.zb + 0.07;
    const nose = (i) => V3(WD.stepX(i), WD.stepTop(i), z);
    const n0 = nose(1), n1 = nose(WD.STEPS.n - 1);
    const dir = n1.clone().sub(n0).normalize();
    const top = n0.clone().add(V3(0, 0.85, 0)).addScaledVector(dir, -0.35), bot = n1.clone().add(V3(0, 0.85, 0)).addScaledVector(dir, 0.25);
    top.y = Math.min(top.y, -0.08);
    const rg2 = [G.rod(top, bot, 0.022, 0.022, 10)];
    for (const f of [0.15, 0.55, 0.92]) {
      const p = top.clone().lerp(bot, f);
      rg2.push(G.rod(p, V3(p.x, p.y, STAIR.zb + 0.005), 0.012, 0.012, 6));
    }
    railG.add(mesh(G.mergeAll(rg2), shiny(MAT.galvMaterial('rail'))));
    scene.add(railG);
  }
  updaters.push((t) => { railG.visible = t > T.pour1 + 0.2; });

  // -------------------------------------------------------------------------
  // vents: galvanised pipes up through the roof slab with goose-neck caps (the
  // opening faces down, a screen across it); a grille where they come into the room
  // -------------------------------------------------------------------------
  const ventMat = shiny(MAT.galvMaterial('vent', '#b2b7ba'));
  const VH = 1.0; // above the slab top
  const vents = WD.VENTS.map((v, i) => {
    const g = new THREE.Group();
    g.position.set(v.x, TOP, v.z);
    const pipe = new THREE.Group();
    const pg = new THREE.CylinderGeometry(0.06, 0.06, VH + 0.3 + 0.1, 16, 1, true);
    pg.translate(0, (VH - 0.4) / 2, 0);
    pipe.add(mesh(pg, ventMat));
    // flashing collar on the slab
    pipe.add(mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.04, 18).translate(0, 0.02, 0), ventMat));
    g.add(pipe);
    const cap = new THREE.Group();
    const tor = new THREE.TorusGeometry(0.13, 0.06, 12, 20, Math.PI);
    tor.rotateY(Math.PI / 2); // bend over towards the camera side... then down
    tor.rotateX(0);
    const down = new THREE.CylinderGeometry(0.06, 0.06, 0.18, 16, 1, true);
    down.translate(0, -0.09, 0.13);
    const screen = new THREE.CircleGeometry(0.058, 16);
    screen.rotateX(Math.PI / 2);
    screen.translate(0, -0.18, 0.13);
    cap.add(mesh(G.mergeAll([tor, down]), ventMat));
    const scr = new THREE.Mesh(screen, std('#2a2d2e', 0.6, 0.6));
    cap.add(scr);
    cap.position.set(0, VH, 0.13);
    cap.rotation.y = 0;
    g.add(cap);
    // inside: the pipe end and a grille under the ceiling
    const inside = mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.04, 16).translate(0, CEIL - TOP - 0.13, 0), std('#3a3d3f', 0.6, 0.6));
    g.add(inside);
    scene.add(g);
    return { g, pipe, cap, inside, tUp: T.vent[i], tCap: T.cap[i] };
  });
  updaters.push((t) => {
    for (const v of vents) {
      const k = popIn(t, v.tUp, 0.42, 2.4);
      v.g.visible = k > 0.001;
      v.pipe.scale.set(1, Math.max(0.001, k), 1);
      const kc = popIn(t, v.tCap, 0.36, 2.6);
      v.cap.visible = kc > 0.001;
      v.cap.scale.setScalar(Math.max(0.001, kc));
      v.cap.position.y = VH * Math.max(0.001, k) + (1 - kc) * 0.3;
      v.inside.visible = k > 0.5;
    }
  });

  // -------------------------------------------------------------------------
  // the room: benches, steel shelving, supplies, a caged lamp, the stuffy haze
  // -------------------------------------------------------------------------
  const benchWood = MAT.woodMaterial('bench', '#9c7550', 'abs(n.y) > 0.5 ? vec2(p.x, p.z) : (abs(n.x) > 0.5 ? vec2(p.z, p.y) : vec2(p.x, p.y))', 0.14, 0.7);
  const B = WD.BENCH;
  const bench = new THREE.Group();
  {
    const bg = [G.boxMM(B.x0, B.seat - 0.05, B.z0 + 0.02, B.x1, B.seat, B.z1)];
    const legs = [];
    for (const x of [B.x0 + 0.12, (B.x0 + B.x1) / 2, B.x1 - 0.12]) legs.push(G.boxMM(x - 0.03, FLOOR, B.z1 - 0.1, x + 0.03, B.seat - 0.05, B.z1 - 0.04), G.boxMM(x - 0.03, B.seat - 0.12, B.z0 + 0.02, x + 0.03, B.seat - 0.06, B.z1 - 0.04));
    bench.add(mesh(G.mergeAll(bg), benchWood));
    bench.add(mesh(G.mergeAll(legs), MAT.paintedSteel('benchLeg', '#30343a')));
    // a cushion strip of folded blankets at one end
    bench.add(mesh(G.boxMM(B.x0 + 0.05, B.seat, B.z0 + 0.06, B.x0 + 0.42, B.seat + 0.12, B.z0 + 0.34), MAT.patch(std('#7a2f2a', 0.95), {
      key: 'blanket', colorFn: 'blC', bumpFn: 'blB',
      extraFrag: 'vec3 blC(vec3 p, vec3 n){ return vec3(0.85 + 0.2 * step(0.5, fract(p.y * 25.0))) * (0.9 + 0.15 * vnoise(p.xz * 90.0)); } float blB(vec3 p, vec3 n){ return 0.002 * vnoise(p.xz * 60.0 + p.y * 40.0); }',
    })));
    scene.add(bench);
  }
  const SH = WD.SHELF;
  const shelf = new THREE.Group();
  const shelfY = [FLOOR + 0.12, FLOOR + 0.62, FLOOR + 1.1, FLOOR + 1.55];
  {
    const sm = MAT.galvMaterial('shelfS', '#9ea4a8');
    shiny(sm);
    const sg = [];
    for (const x of [SH.x0 + 0.02, SH.x1 - 0.02]) for (const z of [SH.z0 + 0.03, SH.z1 - 0.02]) sg.push(G.boxMM(x - 0.018, FLOOR, z - 0.018, x + 0.018, FLOOR + SH.h, z + 0.018));
    for (const y of shelfY) sg.push(G.boxMM(SH.x0, y - 0.02, SH.z0 + 0.01, SH.x1, y, SH.z1));
    shelf.add(mesh(G.mergeAll(sg), sm));
    scene.add(shelf);
  }
  // supplies
  const items = [];
  const bottleMat = new THREE.MeshPhysicalMaterial({ color: SRC('#d9eef7'), roughness: 0.08, metalness: 0, transmission: 0, transparent: true, opacity: 0.55, envMap, envMapIntensity: 1.2 });
  envMats.push(bottleMat);
  const capMat = std('#1f5fb8', 0.4);
  const labelMat = std('#2f86d6', 0.5);
  const water = new THREE.Group();
  {
    const prof = [[0, 0], [0.042, 0], [0.045, 0.01], [0.045, 0.22], [0.03, 0.27], [0.016, 0.29], [0.016, 0.31], [0, 0.31]].map(([r, y]) => new THREE.Vector2(r, y));
    const bg = new THREE.LatheGeometry(prof, 16);
    for (let k = 0; k < 6; k++) {
      const x = (k % 3) * 0.095, z = Math.floor(k / 3) * 0.095;
      const b = new THREE.Mesh(bg, bottleMat);
      b.position.set(x, 0, z);
      const c = mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.022, 10).translate(x, 0.32, z), capMat);
      const l = mesh(new THREE.CylinderGeometry(0.0465, 0.0465, 0.08, 16, 1, true).translate(x, 0.13, z), labelMat);
      water.add(b, c, l);
    }
    // the water inside: a slightly blue core
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.24, 12), new THREE.MeshStandardMaterial({ color: SRC('#9fd2ea'), roughness: 0.1, transparent: true, opacity: 0.35 }));
    for (let k = 0; k < 6; k++) { const cc = core.clone(); cc.position.set((k % 3) * 0.095, 0.12, Math.floor(k / 3) * 0.095); water.add(cc); }
  }
  water.position.set(SH.x0 + 0.12, shelfY[1], SH.z0 + 0.12);
  items.push({ g: water, t: T.water, label: 'WATER' });
  const flash = new THREE.Group();
  {
    // a big lantern-type flashlight: yellow body, black grip, a lens
    flash.add(mesh(new THREE.BoxGeometry(0.16, 0.12, 0.11).translate(0, 0.06, 0), std('#f2b705', 0.45)));
    flash.add(mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.06, 16).rotateZ(Math.PI / 2).translate(0.1, 0.07, 0), std('#202020', 0.5)));
    flash.add(mesh(new THREE.CircleGeometry(0.05, 18).rotateY(Math.PI / 2).translate(0.131, 0.07, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: SRC('#fff4d8'), emissiveIntensity: 0.0, roughness: 0.1 })));
    flash.add(mesh(G.rod(V3(-0.06, 0.12, 0), V3(-0.06, 0.2, 0), 0.012, 0.012, 8), std('#202020', 0.5)));
    flash.add(mesh(G.rod(V3(0.06, 0.12, 0), V3(0.06, 0.2, 0), 0.012, 0.012, 8), std('#202020', 0.5)));
    flash.add(mesh(G.rod(V3(-0.06, 0.2, 0), V3(0.06, 0.2, 0), 0.014, 0.014, 8), std('#202020', 0.5)));
  }
  flash.position.set(SH.x0 + 0.2, shelfY[2], SH.z1 - 0.12);
  items.push({ g: flash, t: T.light, label: 'LIGHT' });
  const aid = new THREE.Group();
  {
    aid.add(mesh(new RoundedBox(0.26, 0.17, 0.12), std('#1f8a4c', 0.5)));
    // white cross on the front
    aid.add(mesh(G.mergeAll([G.box(0.09, 0.03, 0.004, 0, 0.085, 0.062), G.box(0.03, 0.09, 0.004, 0, 0.085, 0.062)]), std('#f4f4f0', 0.5)));
    aid.add(mesh(G.box(0.08, 0.02, 0.03, 0, 0.18, 0), std('#163f2a', 0.6)));
  }
  aid.position.set(SH.x1 - 0.2, shelfY[2], SH.z1 - 0.11);
  items.push({ g: aid, t: T.aid, label: null });
  const radio = new THREE.Group();
  {
    radio.add(mesh(new RoundedBox(0.24, 0.15, 0.09), std('#262829', 0.45)));
    // speaker grille, a dial, an orange crank, the antenna
    radio.add(mesh(new THREE.CircleGeometry(0.045, 20).translate(-0.05, 0.075, 0.046), MAT.patch(std('#3a3c3d', 0.6), { key: 'grille', colorFn: 'grC', extraFrag: 'vec3 grC(vec3 p, vec3 n){ return vec3(0.5 + 0.6 * step(0.5, fract(p.x * 220.0 + p.y * 220.0))); }' })));
    radio.add(mesh(G.box(0.08, 0.035, 0.005, 0.06, 0.1, 0.046), std('#c9b45a', 0.35, 0, { emissive: SRC('#3a2e05') })));
    radio.add(mesh(G.box(0.02, 0.08, 0.03, 0.13, 0.07, 0), std('#e2711d', 0.45)));
    radio.add(mesh(G.rod(V3(-0.1, 0.15, -0.02), V3(-0.16, 0.42, -0.02), 0.004, 0.003, 6), boltMat));
  }
  radio.position.set(SH.x0 + 0.48, shelfY[1], SH.z1 - 0.1);
  items.push({ g: radio, t: T.radio, label: 'RADIO' });
  // extras that come with the shelves: canned food and a folded blanket stack
  const extras = new THREE.Group();
  {
    const can = new THREE.CylinderGeometry(0.038, 0.038, 0.11, 14);
    const cm = std('#b9bec2', 0.35, 0.8);
    const lm = [std('#c0392b', 0.5), std('#d4a017', 0.5), std('#2e7d32', 0.5)];
    for (let k = 0; k < 7; k++) {
      const x = 0.06 + (k % 4) * 0.085, y = Math.floor(k / 4) * 0.11;
      extras.add(mesh(can.clone().translate(x, 0.055 + y, 0), cm));
      extras.add(mesh(new THREE.CylinderGeometry(0.0385, 0.0385, 0.07, 14, 1, true).translate(x, 0.055 + y, 0), lm[k % 3]));
    }
    extras.add(mesh(G.boxMM(0.5, 0, -0.12, 0.84, 0.16, 0.12), std('#6b7f99', 0.95)));
    extras.position.set(SH.x0 + 0.02, shelfY[3], SH.z1 - 0.15);
    extras.scale.setScalar(1);
  }
  scene.add(water, flash, aid, radio, extras);
  ctx.FX.items = items;
  ctx.FX.flashLens = flash.children[2];
  updaters.push((t) => {
    const kb = popIn(t, T.bench, 0.4, 2.0);
    bench.visible = kb > 0.001;
    bench.position.y = (1 - kb) * 0.35;
    bench.scale.setScalar(Math.max(0.001, 0.5 + 0.5 * kb));
    const ks = popIn(t, T.shelf, 0.4, 2.0);
    shelf.visible = ks > 0.001;
    shelf.position.y = (1 - ks) * 0.4;
    for (const it of items) {
      const k = popIn(t, it.t, 0.38, 2.6);
      it.g.visible = k > 0.001;
      it.g.scale.setScalar(Math.max(0.001, k));
    }
    const ke = popIn(t, T.shelf + 0.25, 0.4, 2.0);
    extras.visible = ke > 0.001;
    extras.scale.setScalar(Math.max(0.001, ke));
    // the flashlight leaves the shelf in scene 9 (the worker holds it)
    flash.visible = flash.visible && t < T.torch - 0.6;
  });

  // the lamp: a caged bulb under the ceiling; dim and warm inside, dies in the storm
  const lampG = new THREE.Group();
  {
    const L = WD.LAMP;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), new THREE.MeshStandardMaterial({ color: 0x222222, emissive: SRC('#ffd59a'), emissiveIntensity: 0, roughness: 0.3 }));
    bulb.position.set(0, -0.1, 0);
    const cage = [];
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      cage.push(G.rod(V3(Math.cos(a) * 0.06, -0.02, Math.sin(a) * 0.06), V3(Math.cos(a) * 0.065, -0.16, Math.sin(a) * 0.065), 0.004, 0.004, 4));
    }
    cage.push(G.placed(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 14), 0, -0.01, 0));
    lampG.add(mesh(G.mergeAll(cage), std('#2a2a2a', 0.5, 0.6)), bulb);
    lampG.position.set(L.x, CEIL, L.z);
    lampG.userData.bulb = bulb;
    scene.add(lampG);
  }
  const lampLevel = (t) => {
    if (t < T.stuffy0) return 0;
    let k = 0.55 * smooth(prog(t, T.stuffy0, 0.5));
    // flickers and dies when the tornado hits; daylight afterwards
    if (t > T.hitT) {
      const u = t - T.hitT;
      k *= u < 0.8 ? (Math.sin(u * 47) > 0.2 ? 1 : 0.25) : 0;
    }
    return k;
  };
  updaters.push((t) => {
    lampG.visible = t > T.slab + 0.4;
    const k = lampLevel(t);
    lampG.userData.bulb.material.emissiveIntensity = 6 * k;
    ctx.lamp.intensity = 3.2 * k;
  });

  // the stuffy haze: warm dusty air filling the room until fresh air flows in
  const haze = new THREE.Mesh(
    new THREE.BoxGeometry(ROOM.x1 - ROOM.x0 - 0.02, CEIL - FLOOR - 0.02, -ROOM.zb - 0.02),
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
  haze.position.set((ROOM.x0 + ROOM.x1) / 2, (FLOOR + CEIL) / 2, ROOM.zb / 2);
  haze.renderOrder = 8;
  scene.add(haze);
  updaters.push((t) => {
    const a = 0.17 * smooth(prog(t, T.stuffy0, 1.2)) * (1 - smooth(prog(t, T.air0 + 0.3, 1.4)));
    haze.material.uniforms.uA.value = a;
    haze.material.uniforms.uT.value = t;
    haze.visible = a > 0.002;
  });

  // the whole structure shudders a little in the uplift test (it stays put)
  updaters.push((t) => {
    const s = shudder(t);
    for (const e of els) e.g.position.y += s;
  });

  ctx.FX.anchorDepth = (i, t) => anchorDepth(anchors[i], t);
  ctx.FX.doorAngle = doorAngle;
  ctx.FX.CAGE_T = CAGE_T;
  ctx.FX.ventTop = (i) => V3(WD.VENTS[i].x, TOP + VH, WD.VENTS[i].z);

  return {
    update(t) {
      for (const u of updaters) u(t);
    },
  };
}

// a box with softened edges for the kit, the radio
function RoundedBox(w, h, d) {
  const s = new THREE.Shape();
  const r = Math.min(w, h) * 0.12;
  s.moveTo(-w / 2 + r, 0);
  s.lineTo(w / 2 - r, 0);
  s.quadraticCurveTo(w / 2, 0, w / 2, r);
  s.lineTo(w / 2, h - r);
  s.quadraticCurveTo(w / 2, h, w / 2 - r, h);
  s.lineTo(-w / 2 + r, h);
  s.quadraticCurveTo(-w / 2, h, -w / 2, h - r);
  s.lineTo(-w / 2, r);
  s.quadraticCurveTo(-w / 2, 0, -w / 2 + r, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2 });
  g.translate(0, 0, -d / 2);
  return g;
}
