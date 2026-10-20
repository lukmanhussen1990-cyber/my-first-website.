// Tunnel props: old-gold-mine timber frames, the three lanterns (the tunnel's warm
// lights), the rock the shovel clangs on, a calendar that flips through three
// weeks, the measuring tape, ladders and a little dressing. Everything pops in and
// snaps into place with a small bounce.
//
// The camera looks down into the tunnel through the cut face, so the top of the
// back wall is hidden behind the soil above the opening: things meant to be seen
// sit low on the back wall or near the front (the lanterns hang at z -0.32).
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// FRAMES_B (and the last scene-2 frame, which would stand right in front of the
// kid at the dig face) pop in once the dig face is this far past them, so the kid
// (about 0.42 m behind the face) is already clear of the post and its braces
const FRAME_CLEAR = 0.85;
const TAPE_X0 = -0.78, TAPE_X1 = 3.45, TAPE_Y = -2.205;
// low on the back wall, left of where the kid digs with the spoon (the top of the
// back wall is hidden behind the soil above the opening)
const CAL = { x: -2.48, y: -2.05, z: -1.384, w: 0.2, h: 0.24, t: 19.35, pages: 21 };

export function build(ctx) {
  const { THREE, scene, T, WD, MAT, G, U, mesh, envMap } = ctx;
  const { popIn, prog, smooth, clamp, easeOutCubic, easeInQuad } = U;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const { ROOF, FLOOR } = WD;

  // first time f(t) becomes true (f monotonic), for the pop-ins that follow the dig
  const firstT = (f, t0, t1) => {
    if (!f(t1)) return 1e9;
    for (let i = 0; i < 30; i++) {
      const m = (t0 + t1) / 2;
      if (f(m)) t1 = m;
      else t0 = m;
    }
    return t1;
  };

  // -------------------------------------------------------------------------
  // materials
  // -------------------------------------------------------------------------
  // timber with procedural grain along one axis and end-grain rings on the cut ends
  function woodMat(axis, base = 1.0) {
    const along = { x: 'p.x', y: 'p.y', z: 'p.z' }[axis];
    const across = {
      x: 'abs(n.y) > 0.6 ? p.z : p.y',
      y: 'abs(n.x) > 0.6 ? p.z : p.x',
      z: 'abs(n.y) > 0.6 ? p.x : p.y',
    }[axis];
    const isEnd = { x: 'abs(n.x) > 0.6', y: 'abs(n.y) > 0.6', z: 'abs(n.z) > 0.6' }[axis];
    const endUV = { x: 'p.zy', y: 'p.xz', z: 'p.xy' }[axis];
    const frag = `
      float woodG(vec3 p, vec3 n, out float knot){
        knot = 0.0;
        if (${isEnd}) {
          vec4 ce = cellv(${endUV} * 7.0 + 3.1);
          return 0.5 + 0.5 * sin(ce.z * 70.0 + vnoise(${endUV} * 30.0) * 2.0);
        }
        float a = ${along}, w = ${across};
        float warp = fbm(vec2(a * 0.8, w * 2.3)) * 0.9 + 0.22 * vnoise(vec2(a * 2.7, w * 8.0));
        float g = 0.5 + 0.5 * sin((w * 31.0 + warp * 3.4) * 6.2832);
        g = mix(g, vnoise(vec2(a * 1.3, w * 47.0)), 0.32);
        g = g * g * (3.0 - 2.0 * g);
        vec4 ce = cellv(vec2(a * 2.4, w * 7.5) + 9.7);
        knot = ce.w > 0.84 ? 1.0 - smoothstep(0.05, 0.2, ce.z) : 0.0;
        return g;
      }
      vec3 woodCol(vec3 p, vec3 n){
        float k; float g = woodG(p, n, k);
        vec3 c = mix(s2l(vec3(0.43, 0.27, 0.15)), s2l(vec3(0.68, 0.48, 0.29)), g);
        c *= (0.84 + 0.26 * h31(floor(p * 1.7 + 0.5))) * ${base.toFixed(3)};
        return mix(c, s2l(vec3(0.27, 0.16, 0.09)), k * 0.85);
      }
      float woodBump(vec3 p, vec3 n){ float k; float g = woodG(p, n, k); return 0.0016 * g - 0.003 * k; }
      float woodRough(vec3 p, vec3 n){ float k; float g = woodG(p, n, k); return 0.68 + 0.16 * (1.0 - g) + 0.08 * k; }`;
    return MAT.patch(MAT.std('#ffffff', 0.75), { colorFn: 'woodCol', bumpFn: 'woodBump', roughFn: 'woodRough', extraFrag: frag, key: 'propWood' + axis + base });
  }
  const woodY = woodMat('y'), woodX = woodMat('x'), woodZ = woodMat('z');
  const woodLadder = woodMat('y', 1.12), woodLadderX = woodMat('x', 1.12);
  const iron = MAT.patch(MAT.std('#34343a', 0.45, 0.85, { envMap, envMapIntensity: 1.2 }), {
    colorFn: 'ironCol', roughFn: 'ironRough', key: 'propIron',
    extraFrag: `vec3 ironCol(vec3 p, vec3 n){ float r = fbm(p.xy * 9.0 + p.z * 7.0); return mix(vec3(1.0), vec3(1.25, 0.72, 0.45), smoothstep(0.62, 0.9, r)); }
      float ironRough(vec3 p, vec3 n){ return 0.38 + 0.35 * smoothstep(0.55, 0.9, fbm(p.xy * 9.0 + p.z * 7.0)); }`,
  });
  const brass = MAT.std('#b9893d', 0.32, 1.0, { envMap, envMapIntensity: 1.4 });

  const add = (o, cast = true) => {
    o.traverse((c) => {
      if (c.isMesh) {
        c.castShadow = c.userData.noCast ? false : cast;
        c.receiveShadow = true;
      }
    });
    scene.add(o);
    return o;
  };
  const noCast = (m) => {
    m.userData.noCast = true;
    return m;
  };
  const rbox = (w, h, d, r = 0.012) => new RoundedBoxGeometry(w, h, d, 2, r);

  // -------------------------------------------------------------------------
  // 1. mine frames: a front post with two braces facing the camera, a cap beam
  // back to the back post, and a stringer under the roof between neighbours
  // -------------------------------------------------------------------------
  const POST_TOP = -1.42, BEAM_TOP = -1.335;
  const postH = POST_TOP - FLOOR;
  const braces = [-1, 1].map((s) => {
    const g = rbox(0.055, 0.21, 0.055, 0.01);
    g.rotateZ((-s * Math.PI) / 4);
    return g.translate(s * 0.075, POST_TOP - 0.075 - FLOOR, -0.12);
  });
  const frameGeo = {
    woodY: G.mergeAll([
      G.placed(rbox(0.085, postH, 0.085), 0, postH / 2, -0.12),
      G.placed(rbox(0.105, postH, 0.105), 0, postH / 2, -1.27),
      ...braces,
    ]),
    woodZ: G.placed(rbox(0.12, BEAM_TOP - POST_TOP, 1.3, 0.014), 0, (POST_TOP + BEAM_TOP) / 2 - FLOOR, -0.69),
    iron: G.mergeAll([
      G.box(0.11, 0.055, 0.012, 0, POST_TOP - 0.01 - FLOOR, -0.073),
      G.box(0.13, 0.055, 0.012, 0, POST_TOP - 0.01 - FLOOR, -1.212),
      ...[-0.03, 0.03].map((x) => G.placed(new THREE.CylinderGeometry(0.009, 0.009, 0.012, 8), x, POST_TOP - 0.01 - FLOOR, -0.064, Math.PI / 2, 0, 0)),
    ]),
  };
  const frames = [];
  const tunEnd = T.tunB1 + 0.4;
  const xsA = WD.FRAMES_A, xsB = WD.FRAMES_B;
  xsA.forEach((x, i) => {
    const late = i === xsA.length - 1;
    frames.push({ x, t: late ? firstT((t) => WD.tunX(t) >= x + FRAME_CLEAR, T.tunA0, tunEnd) : T.frames0 + i * T.frameGap });
  });
  xsB.forEach((x) => frames.push({ x, t: firstT((t) => WD.tunX(t) >= x + FRAME_CLEAR, T.tunA0, tunEnd) }));
  for (const f of frames) {
    const g = new THREE.Group();
    g.position.set(f.x, FLOOR, 0);
    g.add(mesh(frameGeo.woodY, woodY), mesh(frameGeo.woodZ, woodZ), mesh(frameGeo.iron, iron));
    add(g);
    f.g = g;
  }
  // stringers between consecutive frames of the same run, in with the later one
  const stringers = [];
  for (const run of [frames.slice(0, xsA.length), frames.slice(xsA.length)]) {
    for (let i = 1; i < run.length; i++) {
      const a = run[i - 1], b = run[i];
      const g = new THREE.Group();
      g.position.set((a.x + b.x) / 2, (POST_TOP + BEAM_TOP) / 2, -0.12);
      g.add(mesh(rbox(b.x - a.x + 0.03, BEAM_TOP - POST_TOP, 0.07, 0.012), woodX));
      add(g);
      stringers.push({ g, t: Math.max(a.t, b.t) + 0.08 });
    }
  }

  // -------------------------------------------------------------------------
  // 2. lanterns: hurricane lanterns on a short chain, warm flame, one light each
  // -------------------------------------------------------------------------
  const glassBase = new THREE.MeshStandardMaterial({ color: new THREE.Color(1.0, 0.93, 0.8), roughness: 0.06, metalness: 0, transparent: true, opacity: 0.3, depthWrite: false, envMap, envMapIntensity: 1.5, emissive: new THREE.Color(0.9, 0.5, 0.16), emissiveIntensity: 0 });
  const HOOK_Y = ROOF - 0.005, LZ = -0.32;
  const v2 = (x, y) => new THREE.Vector2(x, y);
  const lanternGeo = (() => {
    const cap = new THREE.LatheGeometry([v2(0.0, 0.0), v2(0.028, -0.004), v2(0.072, -0.045), v2(0.078, -0.052), v2(0.07, -0.056)], 20);
    const base = new THREE.LatheGeometry([v2(0.066, 0.0), v2(0.079, -0.006), v2(0.08, -0.04), v2(0.07, -0.05), v2(0.0, -0.052)], 20);
    const rings = [0.0, -0.138].map((y) => G.placed(new THREE.TorusGeometry(0.069, 0.0055, 6, 24), 0, y, 0, Math.PI / 2, 0, 0));
    const rods = [0, 1, 2, 3].map((k) => {
      const a = (k / 4) * Math.PI * 2 + 0.4;
      return G.placed(new THREE.CylinderGeometry(0.0055, 0.0055, 0.14, 6), Math.cos(a) * 0.07, -0.069, Math.sin(a) * 0.07);
    });
    const bail = G.placed(new THREE.TorusGeometry(0.06, 0.006, 6, 18, Math.PI), 0, 0.012, 0);
    const links = [0, 1, 2].map((k) => G.placed(new THREE.TorusGeometry(0.014, 0.0045, 6, 12), 0, 0.085 + k * 0.024, 0, 0, k % 2 ? Math.PI / 2 : 0, Math.PI / 2));
    const hook = G.placed(new THREE.TorusGeometry(0.016, 0.005, 6, 12, Math.PI * 1.5), 0, 0.15, 0, 0, 0, 0.6);
    return {
      iron: G.mergeAll([cap, ...rods, ...rings, bail, ...links, hook]),
      brass: base.translate(0, -0.138, 0),
      glass: new THREE.LatheGeometry([0, 0.2, 0.5, 0.8, 1].map((u) => v2(0.052 + 0.014 * Math.sin(u * Math.PI), -0.003 - u * 0.132)), 20),
      flame: G.placed(new THREE.SphereGeometry(0.016, 12, 10), 0, -0.078, 0, 0, 0, 0, 1, 1.9, 1),
      core: G.placed(new THREE.SphereGeometry(0.008, 10, 8), 0, -0.086, 0, 0, 0, 0, 1, 1.6, 1),
    };
  })();
  const LAMP_DROP = 0.165; // from the hook down to the top of the lantern cap
  const lanterns = WD.LANTERNS.map((L, i) => {
    const pivot = new THREE.Group(); // at the hook in the ceiling
    pivot.position.set(L.x, HOOK_Y, LZ);
    const body = new THREE.Group();
    body.position.y = -LAMP_DROP;
    pivot.add(body);
    const glass = glassBase.clone();
    const glassM = noCast(mesh(lanternGeo.glass, glass, false, false));
    glassM.renderOrder = 5;
    const flameM = noCast(mesh(lanternGeo.flame, new THREE.MeshBasicMaterial({ color: new THREE.Color(5.0, 2.7, 0.8) }), false, false));
    const coreM = noCast(mesh(lanternGeo.core, new THREE.MeshBasicMaterial({ color: new THREE.Color(7.0, 5.2, 2.6) }), false, false));
    body.add(mesh(lanternGeo.iron, iron), mesh(lanternGeo.brass, brass), glassM, flameM, coreM);
    add(pivot);
    const light = new THREE.PointLight(new THREE.Color(1.0, 0.72, 0.38), 0, 4.4, 2);
    light.castShadow = false;
    scene.add(light);
    return { ...L, pivot, flameM, coreM, glass, light, phase: i * 1.7 };
  });
  const _wp = new THREE.Vector3();

  // -------------------------------------------------------------------------
  // 3. the rock, with a spark and a few chips on the clang
  // -------------------------------------------------------------------------
  const rockMat = MAT.patch(MAT.std('#7a7874', 0.8), {
    colorFn: 'rockCol', bumpFn: 'rockBump', roughFn: 'rockRough', key: 'propRock',
    extraFrag: `vec3 rockCol(vec3 p, vec3 n){ float a = fbm3(p * 6.0), b = vnoise3(p * 23.0);
        vec3 c = mix(vec3(0.62, 0.6, 0.58), vec3(1.12, 1.08, 1.02), a) * (0.88 + 0.22 * b);
        return mix(c, vec3(0.42, 0.36, 0.3), smoothstep(0.62, 0.8, vnoise3(p * 11.0 + 4.0)) * 0.6); }
      float rockBump(vec3 p, vec3 n){ return 0.012 * fbm3(p * 8.0) + 0.003 * vnoise3(p * 29.0); }
      float rockRough(vec3 p, vec3 n){ return 0.62 + 0.3 * vnoise3(p * 13.0); }`,
  });
  const R = WD.ROCK;
  const rock = mesh(G.lumpyBlob(R.r, 3, 0.22, 21), rockMat);
  rock.scale.set(1.15, 0.85, 0.75);
  rock.position.set(R.x, R.y, R.z);
  rock.rotation.set(0.3, 0.8, 0.2);
  add(rock);
  function starTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    rg.addColorStop(0, 'rgba(255,255,255,1)');
    rg.addColorStop(0.12, 'rgba(255,240,200,0.9)');
    rg.addColorStop(0.4, 'rgba(255,200,120,0.2)');
    rg.addColorStop(1, 'rgba(255,180,80,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, 128, 128);
    g.globalCompositeOperation = 'lighter';
    for (const [w, h] of [[128, 7], [7, 128]]) {
      g.fillStyle = 'rgba(255,248,230,0.9)';
      g.beginPath();
      g.ellipse(64, 64, w / 2, h / 2, 0, 0, Math.PI * 2);
      g.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  const sparkMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(9.0, 7.5, 4.5), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, map: starTexture() });
  const spark = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), sparkMat);
  // where the shovel strikes: the rock's front-left, low enough to be seen under the soil edge
  const SPARK_P = V(R.x - 0.25, R.y - 0.08, R.z + 0.27);
  spark.position.copy(SPARK_P);
  spark.renderOrder = 20;
  scene.add(spark);
  const chipMat = MAT.std('#6e6a64', 0.85);
  const CHIPS = Array.from({ length: 6 }, (_, k) => {
    const m = mesh(G.lumpyBlob(0.016 + 0.008 * (k % 3), 1, 0.3, 40 + k), chipMat, false);
    scene.add(m);
    const a = -0.9 - k * 0.42;
    return { m, vx: Math.cos(a) * (1.2 + 0.3 * (k % 2)), vy: 1.6 + 0.35 * k, vz: 0.4 + 0.15 * k, s: k * 1.3 };
  });

  // -------------------------------------------------------------------------
  // 4. the calendar on the back wall: three weeks of pages flipping over the top
  // -------------------------------------------------------------------------
  const GRID = { x0: 14, dx: 25.4, cw: 22, y0: 40, dy: 38, ch: 33, W: 200, H: 240 };
  const pageTex = (() => {
    const c = document.createElement('canvas');
    c.width = GRID.W;
    c.height = GRID.H;
    const g = c.getContext('2d');
    g.fillStyle = '#f4efe2';
    g.fillRect(0, 0, GRID.W, GRID.H);
    g.strokeStyle = '#b6ae9e';
    g.lineWidth = 4;
    for (let r = 0; r < 5; r++) for (let k = 0; k < 7; k++) g.strokeRect(GRID.x0 + k * GRID.dx, GRID.y0 + r * GRID.dy, GRID.cw, GRID.ch);
    g.fillStyle = '#9a9386';
    g.fillRect(40, 12, 120, 12); // a blank "month" bar (no text)
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  })();
  const paper = new THREE.MeshStandardMaterial({ map: pageTex, roughness: 0.92, side: THREE.DoubleSide });
  const calRed = MAT.std('#c8372d', 0.6);
  const cal = new THREE.Group();
  cal.position.set(CAL.x, CAL.y, CAL.z);
  const calTop = CAL.h / 2, HEAD = 0.05, PW = CAL.w * 0.96, PH = CAL.h * 0.96;
  cal.add(mesh(G.box(CAL.w + 0.01, CAL.h + HEAD + 0.01, 0.006, 0, HEAD / 2, -0.004), MAT.std('#7d6a52', 0.85), false)); // backing card
  cal.add(mesh(G.box(CAL.w, HEAD, 0.012, 0, calTop + HEAD / 2, 0.003), calRed, false));
  cal.add(mesh(G.mergeAll([-0.05, 0.05].map((x) => G.placed(new THREE.TorusGeometry(0.012, 0.0035, 6, 12), x, calTop + 0.003, 0.01, 0, Math.PI / 2, 0))), iron, false));
  cal.add(mesh(G.placed(new THREE.SphereGeometry(0.009, 8, 6), 0, calTop + HEAD - 0.012, 0.012), iron, false)); // nail
  const pageGeo = new THREE.PlaneGeometry(PW, PH).translate(0, -PH / 2, 0); // hinged on its top edge
  cal.add(mesh(pageGeo.clone().translate(0, calTop - 0.002, 0.008), paper, false));
  const today = mesh(new THREE.PlaneGeometry((GRID.cw / GRID.W) * PW, (GRID.ch / GRID.H) * PH), MAT.std('#d4322a', 0.5), false);
  cal.add(today);
  const flips = Array.from({ length: 4 }, () => {
    const h = new THREE.Group();
    h.position.set(0, calTop - 0.002, 0.012);
    h.add(mesh(pageGeo, paper, false));
    cal.add(h);
    return h;
  });
  add(cal, false);
  const dayPos = (k) => {
    const d = k + 9; // starts on a Wednesday of the second week
    const col = d % 7, row = Math.floor(d / 7) % 5;
    const u = (GRID.x0 + col * GRID.dx + GRID.cw / 2) / GRID.W, v = (GRID.y0 + row * GRID.dy + GRID.ch / 2) / GRID.H;
    return [(u - 0.5) * PW, calTop - 0.002 - v * PH, 0.0095];
  };

  // -------------------------------------------------------------------------
  // 5. measuring tape: the case sits by the dog shaft, the tape shoots out along
  // the future tunnel (in front of the soil face) with twelve big step marks
  // -------------------------------------------------------------------------
  const TAPE_L = TAPE_X1 - TAPE_X0;
  const tapeTex = (() => {
    const c = document.createElement('canvas');
    c.width = 4096;
    c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#f2c517';
    g.fillRect(0, 0, 4096, 64);
    const px = 4096 / TAPE_L;
    g.fillStyle = '#2a2116';
    for (let i = 0; i * 0.05 <= TAPE_L + 1e-6; i++) {
      const big = i % 2 === 0, x = i * 0.05 * px;
      g.fillRect(x - (big ? 3 : 2), 0, big ? 6 : 4, big ? 30 : 18);
    }
    g.fillStyle = '#d2352b'; // twelve steps: bold red bands
    for (let k = 1; k <= 12; k++) g.fillRect(((k * TAPE_L) / 12) * px - 9, 0, 18, 64);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(0, 60, 4096, 4);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  })();
  const tapeMat = new THREE.MeshStandardMaterial({ map: tapeTex, roughness: 0.42, metalness: 0.15, envMap, envMapIntensity: 0.6 });
  const tape = mesh(new THREE.PlaneGeometry(1, 0.062), tapeMat, false);
  tape.position.set(0, TAPE_Y, 0.016);
  scene.add(tape);
  const tapeTip = mesh(G.box(0.012, 0.075, 0.02), MAT.std('#9b9da3', 0.35, 1.0, { envMap }), false);
  scene.add(tapeTip);
  const tapeCase = new THREE.Group();
  {
    const dark = MAT.std('#2a2a2c', 0.5);
    tapeCase.add(mesh(new RoundedBoxGeometry(0.2, 0.18, 0.08, 4, 0.045), MAT.std('#f1b80f', 0.42)));
    tapeCase.add(mesh(G.placed(new THREE.CylinderGeometry(0.055, 0.055, 0.01, 28), 0, 0.005, 0.042, Math.PI / 2, 0, 0), dark, false));
    tapeCase.add(mesh(G.placed(new THREE.CylinderGeometry(0.022, 0.022, 0.014, 20), 0, 0.005, 0.047, Math.PI / 2, 0, 0), MAT.std('#c9ccd2', 0.25, 1.0, { envMap }), false));
    tapeCase.add(mesh(G.box(0.05, 0.03, 0.084, 0.06, 0.07, 0), dark, false));
    tapeCase.position.set(TAPE_X0 - 0.105, FLOOR + 0.09, -0.04);
  }
  add(tapeCase);

  // -------------------------------------------------------------------------
  // 6. ladders
  // -------------------------------------------------------------------------
  function ladder(h, w = 0.34) {
    const g = new THREE.Group();
    const rails = G.mergeAll([-1, 1].map((s) => G.placed(rbox(0.042, h, 0.05, 0.01), (s * w) / 2, h / 2, 0)));
    const rungs = [];
    for (let y = 0.22; y < h - 0.05; y += 0.26) rungs.push(G.placed(new THREE.CylinderGeometry(0.017, 0.017, w, 10), 0, y, 0, 0, 0, Math.PI / 2));
    g.add(mesh(rails, woodLadder), mesh(G.mergeAll(rungs), woodLadderX));
    return g;
  }
  const ladders = [
    { g: ladder(-FLOOR + 0.62), x: (WD.SHAFT.x0 + WD.SHAFT.x1) / 2, z: -0.86, lean: -0.07, t: T.tunA0 },
    { g: ladder(WD.HOUSE.slab0 - FLOOR - 0.06, 0.32), x: (WD.KIT_UP.x0 + WD.KIT_UP.x1) / 2, z: -1.22, lean: 0, t: T.kitUp1 + 0.1 },
  ];
  for (const L of ladders) {
    L.g.position.set(L.x, FLOOR, L.z);
    L.g.rotation.x = L.lean;
    add(L.g);
  }

  // -------------------------------------------------------------------------
  // 7. dressing: a pail of dirt, a pickaxe, roots poking out of the dug soil
  // -------------------------------------------------------------------------
  const dress = [];
  {
    const pail = new THREE.Group();
    const lathe = new THREE.LatheGeometry([v2(0.0, 0.0), v2(0.085, 0.0), v2(0.1, 0.17), v2(0.106, 0.18), v2(0.098, 0.18)], 24);
    pail.add(mesh(lathe, new THREE.MeshStandardMaterial({ color: new THREE.Color(0.27, 0.29, 0.31), roughness: 0.38, metalness: 0.9, envMap, side: THREE.DoubleSide })));
    pail.add(mesh(G.placed(new THREE.TorusGeometry(0.1, 0.006, 6, 20, Math.PI), 0, 0.18, 0, 0, 0, 0.35), iron, false));
    const dirt = G.lumpyBlob(0.1, 2, 0.25, 77);
    dirt.scale(1, 0.45, 1);
    pail.add(mesh(dirt.translate(0, 0.175, 0), MAT.patch(MAT.std('#5b3d26', 0.95), { colorFn: 'pailDirt', key: 'pailDirt', extraFrag: 'vec3 pailDirt(vec3 p, vec3 n){ return vec3(0.75 + 0.5 * vnoise3(p * 40.0)); }' })));
    pail.position.set(-3.78, FLOOR, -0.42);
    add(pail);
    dress.push({ g: pail, t: T.tunA0 + 1.15 });
    const pick = new THREE.Group();
    pick.add(mesh(G.placed(new THREE.CylinderGeometry(0.016, 0.019, 0.5, 10), 0, 0.25, 0), woodY));
    const head = new THREE.Shape();
    head.moveTo(-0.17, 0.0);
    head.quadraticCurveTo(0, 0.07, 0.17, 0.0);
    head.lineTo(0.17, -0.012);
    head.quadraticCurveTo(0, 0.04, -0.17, -0.012);
    head.closePath();
    const hg = new THREE.ExtrudeGeometry(head, { depth: 0.03, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 2, curveSegments: 10 });
    pick.add(mesh(hg.translate(0, 0.49, -0.015), iron));
    pick.position.set(-3.42, FLOOR, -1.12);
    pick.rotation.set(-0.3, 0.0, -0.32);
    add(pick);
    dress.push({ g: pick, t: T.tunA0 + 1.55 });
  }
  // roots: threads hanging from the roof near the front and poking out of the
  // back wall low down; each appears once the soil around it has been dug
  const rootMat = MAT.patch(MAT.std('#6a4a30', 0.85), { colorFn: 'rootCol', key: 'propRoot', extraFrag: 'vec3 rootCol(vec3 p, vec3 n){ return vec3(0.8 + 0.4 * vnoise3(p * 30.0)); }' });
  const roots = [];
  {
    const rnd = U.mulberry32(99);
    const spots = [];
    for (const x of [-3.5, -3.05, -2.55, -1.95, -0.45, 0.2, 0.85, 1.35, 2.05, 2.6, 3.0]) spots.push({ x: x + (rnd() - 0.5) * 0.12, kind: 'hang' });
    for (const x of [-3.3, -2.0, 0.6, 1.9]) spots.push({ x: x + (rnd() - 0.5) * 0.1, kind: 'wall' });
    for (const s of spots) {
      const hang = s.kind === 'hang';
      const len = hang ? 0.1 + rnd() * 0.12 : 0.12 + rnd() * 0.08;
      const z0 = hang ? -0.05 - rnd() * 0.1 : -1.4;
      const y0 = hang ? ROOF + 0.01 : -1.9 - rnd() * 0.15;
      const ph = rnd() * 6;
      const pts = [];
      for (let i = 0; i <= 7; i++) {
        const u = i / 7;
        if (hang) pts.push(V(s.x + 0.03 * Math.sin(ph + u * 4.0), y0 - len * u, z0 + 0.02 * Math.sin(ph * 2 + u * 3)));
        else pts.push(V(s.x + 0.04 * u * Math.sin(ph), y0 - len * 0.6 * u * u, z0 + len * u));
      }
      const m = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.011, 5, false), rootMat, false);
      scene.add(m);
      roots.push({ m, t: WD.digTime(s.x, hang ? ROOF - 0.04 : y0) + 0.15 });
    }
  }

  // -------------------------------------------------------------------------
  // update
  // -------------------------------------------------------------------------
  const popAt = (g, t, t0, dur = 0.42, s = 2.2) => {
    const k = popIn(t, t0, dur, s);
    g.visible = k > 0.002;
    g.scale.setScalar(Math.max(k, 0.002));
    return k;
  };
  function update(t) {
    // frames: drop in from a little above, squash on landing, settle
    for (const f of frames) {
      const k = popIn(t, f.t, 0.42, 2.0);
      f.g.visible = k > 0.002;
      if (!f.g.visible) continue;
      const land = U.wobble(t, f.t + 0.16, 3.2, 7);
      const s = Math.max(k, 0.002);
      f.g.scale.set(s * (1 + 0.05 * land), s * (1 - 0.06 * land), s);
      f.g.position.y = FLOOR + 0.1 * (1 - smooth(prog(t, f.t, 0.22)));
    }
    for (const s of stringers) popAt(s.g, t, s.t, 0.36, 2.0);
    // lanterns: pop in on the hook, swing, flame and light fade up
    for (const L of lanterns) {
      const k = popIn(t, L.t, 0.45, 2.0);
      L.pivot.visible = k > 0.002;
      L.pivot.scale.setScalar(Math.max(k, 0.002));
      const dt = t - L.t;
      const swing = dt > 0 ? 0.32 * Math.exp(-1.5 * dt) * Math.sin(dt * 2 * Math.PI * 1.05) : 0;
      L.pivot.rotation.z = swing + 0.025 * Math.sin(t * 1.25 + L.phase) * smooth(clamp(dt / 2));
      L.pivot.rotation.x = 0.015 * Math.sin(t * 0.9 + L.phase * 2);
      const lv = smooth(prog(t, L.t + 0.12, 0.6));
      const breathe = 1 + 0.03 * Math.sin(t * 2.1 + L.phase) + 0.015 * Math.sin(t * 3.7 + L.phase * 3);
      L.flameM.visible = L.coreM.visible = lv > 0.01;
      L.flameM.scale.set(1, 0.65 + 0.35 * lv * breathe, 1);
      L.flameM.material.color.setRGB(5.0, 2.7, 0.8).multiplyScalar(lv);
      L.coreM.material.color.setRGB(7.0, 5.2, 2.6).multiplyScalar(lv);
      L.glass.emissiveIntensity = 0.4 * lv;
      L.pivot.updateMatrixWorld(true);
      L.flameM.getWorldPosition(_wp);
      L.light.position.copy(_wp);
      L.light.intensity = 4.2 * lv * breathe * k;
    }
    // rock: a spark star and chips on the clang
    {
      const u = prog(t, T.clang, 0.26);
      spark.visible = u > 0 && u < 1;
      if (spark.visible) {
        const s = 0.5 * Math.sin(Math.PI * Math.pow(u, 0.55));
        spark.scale.set(s, s, 1);
        spark.rotation.z = 0.4 + u * 0.8;
        sparkMat.opacity = 1 - u * 0.5;
      }
      const dt = t - T.clang;
      for (const c of CHIPS) {
        c.m.visible = dt > 0 && dt < 0.75;
        if (!c.m.visible) continue;
        c.m.position.set(SPARK_P.x + c.vx * dt * 0.6, Math.max(FLOOR + 0.015, SPARK_P.y + c.vy * dt - 4.9 * dt * dt), SPARK_P.z + c.vz * dt * 0.5);
        c.m.rotation.set(c.s + dt * 9, c.s * 2 + dt * 7, 0);
        c.m.scale.setScalar(Math.max(0.002, 1 - smooth(clamp((dt - 0.5) / 0.25))));
      }
    }
    // calendar: pops onto the wall, then three weeks of pages flip over the top
    {
      popAt(cal, t, CAL.t, 0.4, 2.4);
      const gap = (T.cal1 - T.cal0) / CAL.pages, fdur = 0.22;
      const flipped = clamp(Math.floor((t - T.cal0) / gap) + 1, 0, CAL.pages);
      const [dx, dy, dz] = dayPos(t < T.cal0 ? 0 : flipped);
      today.position.set(dx, dy, dz);
      let used = 0;
      for (let k = 0; k < CAL.pages && used < flips.length; k++) {
        const u = (t - (T.cal0 + k * gap)) / fdur;
        if (u <= 0 || u >= 1) continue;
        const h = flips[used++];
        h.visible = true;
        h.rotation.x = -Math.PI * 1.04 * smooth(u);
        h.position.z = 0.012 + 0.002 * used;
      }
      for (let i = used; i < flips.length; i++) flips[i].visible = false;
    }
    // measuring tape: shoots out, holds, zips back in once the tunnel is dug
    {
      const kc = popAt(tapeCase, t, T.tape0 - 0.35, 0.4, 2.4);
      tapeCase.rotation.z = 0.08 * U.wobble(t, T.tape0 + 0.05, 5, 6);
      const out = easeOutCubic(prog(t, T.tape0 + 0.05, T.tape1 - T.tape0 - 0.05));
      const back = easeInQuad(prog(t, T.tunB1 + 0.25, 0.38));
      const L = Math.max(0, TAPE_L * out * (1 - back));
      tape.visible = tapeTip.visible = L > 0.01 && kc > 0.5;
      if (tape.visible) {
        tape.scale.x = L;
        tape.position.x = TAPE_X0 + L / 2;
        // the tape unrolls from the case: its tip is the start of the tape
        tapeTex.repeat.set(-L / TAPE_L, 1);
        tapeTex.offset.set(L / TAPE_L, 0);
        tapeTip.position.set(TAPE_X0 + L + 0.004, TAPE_Y, 0.02);
      }
    }
    for (const L of ladders) {
      const k = popIn(t, L.t, 0.5, 2.0);
      L.g.visible = k > 0.002;
      L.g.scale.set(1, Math.max(k, 0.002), 1);
    }
    for (const d of dress) popAt(d.g, t, d.t, 0.4, 2.2);
    for (const r of roots) r.m.visible = t >= r.t;
  }

  return { update, lights: lanterns.map((L) => L.light) };
}
