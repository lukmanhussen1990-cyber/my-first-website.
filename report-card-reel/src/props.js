// The props: the report card (a white card with a big red C, the only text in
// the reel), the metal box that snaps together, the flowers, the garden roller,
// the metal detector with its beep rings, and the ladder. Held props follow the
// characters' anchors (kid.js / family.js); everything is a pure function of t.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function build(ctx) {
  const { scene, T, WD, U, G, MAT, envMap, envMats, anchors } = ctx;
  const { clamp, lerp, prog, smooth, popIn, easeOutBack, easeOutCubic, easeInQuad, wobble, bump } = U;
  const ramp = (t, a, d) => smooth(prog(t, a, d));
  const { HOLE, LANE, CARD, BOX } = WD;
  const _m = new THREE.Matrix4(), _o = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler();
  const shiny = (m) => (envMats.push(m), m);
  // put obj at anchor * (offset position, offset euler)
  function attach(obj, anchor, ox, oy, oz, rx = 0, ry = 0, rz = 0, sc = 1) {
    anchor.updateWorldMatrix(true, false);
    _o.compose(_p.set(ox, oy, oz), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sc, sc, sc));
    _m.multiplyMatrices(anchor.matrixWorld, _o);
    _m.decompose(obj.position, obj.quaternion, obj.scale);
    // keep the prop's own size: undo the rig's squash and scale
    const k = sc / Math.cbrt(Math.abs(obj.scale.x * obj.scale.y * obj.scale.z)) || 1;
    obj.scale.multiplyScalar(k);
  }
  function place(obj, x, y, z, rx = 0, ry = 0, rz = 0, sc = 1) {
    obj.position.set(x, y, z);
    obj.quaternion.setFromEuler(_e.set(rx, ry, rz));
    obj.scale.setScalar(sc);
  }
  // muddy splotches added to a material (uMud 0..1), in object space
  function muddy(mat, key) {
    const u = { uMud: { value: 0 } };
    const prev = mat.onBeforeCompile; // keep a patch() that is already there
    mat.onBeforeCompile = (sh, r) => {
      if (prev) prev.call(mat, sh, r);
      Object.assign(sh.uniforms, u);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vMP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvMP = position;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        varying vec3 vMP; uniform float uMud;
        float mh(vec3 p){ p = fract(p * vec3(.1031, .1030, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.x + p.y) * p.z); }
        float mn(vec3 p){ vec3 i = floor(p), f = fract(p); vec3 w = f * f * (3. - 2. * f);
          return mix(mix(mix(mh(i), mh(i + vec3(1,0,0)), w.x), mix(mh(i + vec3(0,1,0)), mh(i + vec3(1,1,0)), w.x), w.y),
                     mix(mix(mh(i + vec3(0,0,1)), mh(i + vec3(1,0,1)), w.x), mix(mh(i + vec3(0,1,1)), mh(i + vec3(1,1,1)), w.x), w.y), w.z); }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
        { float n = mn(vMP * 22.0) * 0.65 + mn(vMP * 55.0) * 0.35 - 0.35 * smoothstep(0.0, 0.2, vMP.y);
          float m = smoothstep(0.62 - 0.4 * uMud, 0.66 - 0.4 * uMud, n) * step(0.01, uMud);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.1, 0.06), m * 0.9); }`)
        .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        { float n = mn(vMP * 22.0) * 0.65 + mn(vMP * 55.0) * 0.35 - 0.35 * smoothstep(0.0, 0.2, vMP.y);
          metalnessFactor *= 1.0 - smoothstep(0.62 - 0.4 * uMud, 0.66 - 0.4 * uMud, n) * step(0.01, uMud); }`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        { float n = mn(vMP * 22.0) * 0.65 + mn(vMP * 55.0) * 0.35 - 0.35 * smoothstep(0.0, 0.2, vMP.y);
          roughnessFactor = mix(roughnessFactor, 0.8, smoothstep(0.62 - 0.4 * uMud, 0.66 - 0.4 * uMud, n) * step(0.01, uMud)); }`);
    };
    mat.customProgramCacheKey = () => key;
    return u;
  }

  // -------------------------------------------------------------------------
  // the report card: white card, faint ruled lines, a big red C circled in red
  // -------------------------------------------------------------------------
  const card = new THREE.Group();
  const cardMud = { uMud: { value: 0 } };
  {
    const cv = document.createElement('canvas');
    cv.width = 640;
    cv.height = 470;
    const c = cv.getContext('2d');
    c.fillStyle = '#fbf9f3';
    c.fillRect(0, 0, cv.width, cv.height);
    // a soft blue band at the top and faint ruled rows (no words anywhere)
    c.fillStyle = '#c9daf0';
    c.fillRect(0, 0, cv.width, 58);
    c.strokeStyle = 'rgba(90,110,150,0.32)';
    c.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      const y = 112 + i * 56;
      c.beginPath();
      c.moveTo(34, y);
      c.lineTo(300, y);
      c.stroke();
      c.fillStyle = 'rgba(90,110,150,0.25)';
      c.fillRect(34, y - 26, 120 + 60 * ((i * 37) % 3), 12);
    }
    // the big red C: a thick marker stroke, slightly tilted, and a quick underline
    c.strokeStyle = '#d4241f';
    c.lineCap = 'round';
    c.lineWidth = 46;
    c.beginPath();
    c.ellipse(462, 250, 118, 132, -0.12, Math.PI * 0.3, Math.PI * 1.72, false);
    c.stroke();
    c.lineWidth = 14;
    c.beginPath();
    c.moveTo(352, 418);
    c.quadraticCurveTo(470, 404, 590, 414);
    c.stroke();
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    // a slightly curled card: a bent plane, front with the print, back plain
    const g = new THREE.PlaneGeometry(CARD.w, CARD.h, 16, 4);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) / (CARD.w / 2);
      p.setZ(i, 0.012 * (1 - x * x) + 0.006 * x);
    }
    g.computeVertexNormals();
    const front = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.78 });
    Object.assign(cardMud, muddy(front, 'cardFront'));
    const back = new THREE.MeshStandardMaterial({ color: new THREE.Color('#f3efe6'), roughness: 0.8, side: THREE.BackSide });
    const fm = new THREE.Mesh(g, front), bm = new THREE.Mesh(g, back);
    for (const m of [fm, bm]) { m.castShadow = true; m.receiveShadow = true; }
    card.add(fm, bm);
    scene.add(card);
  }
  // card rest spots in the hole (flush with the cut face, facing +z)
  const SHALLOW = { x: HOLE.x + 0.03, y: -0.3, z: 0.012, rz: 0.18, rx: -0.08 };
  const DEEP = { x: HOLE.x + 0.05, y: -HOLE.DEEP + 0.13, z: 0.012, rz: -0.12, rx: -0.05 };
  // where the kid's left hand lets go of the card at the flick (an approximation)
  const FLICK = V(0.42, 0.52, -0.2);
  function updateCard(t) {
    card.visible = t < T.click + 0.02 || t >= T.cardOut - 0.02;
    ctx.buried[0] = null;
    const mudK = ramp(t, T.float0, 0.6);
    cardMud.uMud.value = mudK * (t > T.fish + 0.4 ? 0.45 : 1) * (t > T.cardOut ? 0.75 : 1);
    const kidL = anchors.kidHandL, kidR = anchors.kidHandR, chest = anchors.kidChest;
    if (t < T.shovelIn) {
      // up in front of the chest, both hands, the C to the camera
      if (chest) attach(card, chest, 0, 0.0, 0.1, -0.4, 0, 0.04);
      else place(card, 0.55, 0.5, -0.1, -0.3, -0.42, 0);
    } else if (t < T.cardDrop) {
      if (kidL) attach(card, kidL, 0.0, -0.09, 0.03, 0.1, -0.5, 0.1);
      else place(card, 0.6, 0.25, -0.15, 0, -0.9, 0);
    } else if (t < T.cardLand) {
      // the flick: a fluttering arc into the hole
      const u = prog(t, T.cardDrop, T.cardLand - T.cardDrop);
      const x = lerp(FLICK.x, SHALLOW.x, u), z = lerp(FLICK.z, SHALLOW.z, smooth(u));
      const y = lerp(FLICK.y, SHALLOW.y, easeInQuad(u)) + 0.25 * Math.sin(Math.PI * u);
      place(card, x, y, z, lerp(0.8, SHALLOW.rx, u) + 0.5 * Math.sin(u * 9), lerp(-0.9, 0, u), lerp(1.2, SHALLOW.rz, u) + 0.4 * Math.sin(u * 7));
    } else if (t < T.dogGrab + 0.05) {
      place(card, SHALLOW.x, SHALLOW.y, SHALLOW.z, SHALLOW.rx, 0, SHALLOW.rz);
      // a little settle bounce on landing
      card.position.y += 0.015 * Math.abs(wobble(t, T.cardLand, 4, 8));
      if (WD.fillTop(t) < 0.2) ctx.buried[0] = { x: SHALLOW.x, y: SHALLOW.y, hw: CARD.w / 2 * 0.95, hh: CARD.h / 2 };
      // the dog's paws uncover it, it lifts up into the mouth
      const up = ramp(t, T.dogGrab - 0.1, 0.15);
      card.position.y += 0.08 * up;
    } else if (t < T.snatch) {
      if (anchors.dogMouth) attach(card, anchors.dogMouth, 0.0, -0.07, 0.05, 0, -Math.PI / 2, 0.15);
      else place(card, -0.4, 0.4, LANE, 0, 0, 0);
    } else if (t < T.cardDown) {
      if (kidL) attach(card, kidL, 0.0, -0.09, 0.03, 0.1, -0.5, 0.1);
      else place(card, 0.3, 0.3, LANE, 0, 0, 0);
    } else if (t < T.float0) {
      place(card, DEEP.x, DEEP.y, DEEP.z, DEEP.rx, 0, DEEP.rz);
      if (WD.fillTop(t) < HOLE.DEEP - CARD.h - 0.05) ctx.buried[0] = { x: DEEP.x, y: DEEP.y, hw: CARD.w / 2 * 0.95, hh: CARD.h / 2 };
    } else if (t < T.fish) {
      // floats up through the mud, wobbling, and bobs at the top half out of it
      const u = prog(t, T.float0, T.float1 - T.float0);
      const y = lerp(DEEP.y, 0.03, smooth(u)) + 0.02 * Math.sin((t - T.float1) * 6) * ramp(t, T.float1, 0.2);
      place(card, DEEP.x - 0.03 * u, y, DEEP.z, DEEP.rx, 0, DEEP.rz * (1 - u) + 0.12 * Math.sin(t * 5));
      if (y < -0.12) ctx.buried[0] = { x: card.position.x, y, hw: CARD.w / 2 * 0.95, hh: CARD.h / 2 };
    } else if (t < T.cardIn) {
      if (kidR) attach(card, kidR, 0.0, -0.09, 0.03, 0.1, 0.5, -0.1);
      else place(card, 0.4, 0.5, LANE, 0, 0, 0);
    } else if (t < T.cardOut) {
      // dropped into the box, lying flat inside it
      const bp = WD.boxPos(t) || WD.boxPos(T.sink0);
      const u = prog(t, T.cardIn, 0.3);
      const from = V(0.28, 0.82, -0.25);
      place(card, lerp(from.x, bp.x, u), lerp(from.y, bp.y - 0.03, easeInQuad(u)), lerp(from.z, bp.z, u), lerp(0.3, -Math.PI / 2, u), 0, lerp(-0.3, 0, u), lerp(1, 0.95, u));
    } else {
      // in Dad's right hand, held up to read, turned so the camera sees the C
      if (anchors.dadHandR) {
        attach(card, anchors.dadHandR, 0.0, -0.12, 0.05, 0, 0, 0);
        const out = ramp(t, T.cardOut, 0.35);
        // face it between Dad and the camera, upright
        const yaw = lerp(-0.2, 0.42, out);
        card.quaternion.setFromEuler(_e.set(-0.12, yaw, 0.06 * Math.sin(t * 1.3)));
        card.position.y += 0.06 * out;
      } else place(card, 0.5, 1.2, LANE + 0.2, 0, 0.4, 0);
    }
  }

  // -------------------------------------------------------------------------
  // the metal box: brushed steel, rolled edges, rivets, a latch, a hinged lid
  // -------------------------------------------------------------------------
  const box = new THREE.Group();
  const boxParts = [];
  let lid = null, latch = null, boxMud = null;
  const steel = shiny(MAT.patch(new THREE.MeshStandardMaterial({ color: new THREE.Color('#c9d0d6'), roughness: 0.3, metalness: 1, envMap, envMapIntensity: 1.1 }), {
    key: 'steel', colorFn: 'stC', roughFn: 'stR',
    extraFrag: `vec3 stC(vec3 p, vec3 n){ return vec3(0.9 + 0.12 * vnoise(vec2(dot(p, vec3(1.0, 0.0, 0.7)) * 180.0, p.y * 4.0))); }
      float stR(vec3 p, vec3 n){ return 0.24 + 0.12 * vnoise(vec2(dot(p, vec3(1.0, 0.0, 0.7)) * 160.0, p.y * 3.0)); }`,
  }));
  {
    const w = BOX.w, h = BOX.h, d = BOX.d, th = 0.012;
    const inner = new THREE.MeshStandardMaterial({ color: new THREE.Color('#6b7178'), roughness: 0.5, metalness: 0.8 });
    const mkPart = (geo, mat, from) => {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      m.receiveShadow = true;
      const g = new THREE.Group();
      g.add(m);
      g.userData.from = from;
      box.add(g);
      boxParts.push(g);
      return g;
    };
    mkPart(new RoundedBoxGeometry(w, th, d, 2, 0.004), steel, V(0, -0.22, 0)).children[0].position.y = -h / 2 + th / 2;
    const wall = (sx, sy, sz, x, y, z, from) => { const g = mkPart(new RoundedBoxGeometry(sx, sy, sz, 2, 0.005), steel, from); g.children[0].position.set(x, y, z); return g; };
    wall(w, h, th, 0, 0, d / 2 - th / 2, V(0, 0, 0.25)); // front
    wall(w, h, th, 0, 0, -d / 2 + th / 2, V(0, 0, -0.25)); // back
    wall(th, h, d - 2 * th, -w / 2 + th / 2, 0, 0, V(-0.25, 0, 0));
    wall(th, h, d - 2 * th, w / 2 - th / 2, 0, 0, V(0.25, 0, 0));
    // rolled rim along the top edge, rivets on the front, the inside darker
    const rim = [];
    for (const [sx, sz, x, z] of [[w + 0.01, 0.018, 0, d / 2], [w + 0.01, 0.018, 0, -d / 2], [0.018, d, -w / 2, 0], [0.018, d, w / 2, 0]]) rim.push(G.box(sx, 0.016, sz, x, h / 2, z));
    const rimG = new THREE.Mesh(G.mergeAll(rim), steel);
    boxParts[1].add(rimG);
    const rv = [];
    for (const x of [-0.15, -0.05, 0.05, 0.15]) for (const y of [-0.075, 0.075]) rv.push(G.placed(new THREE.SphereGeometry(0.007, 8, 6), x, y, d / 2 + 0.001));
    boxParts[1].add(new THREE.Mesh(G.mergeAll(rv), steel));
    const inG = new THREE.Mesh(new THREE.BoxGeometry(w - 2 * th - 0.002, h - th, d - 2 * th - 0.002), new THREE.MeshStandardMaterial({ color: inner.color, roughness: 0.6, metalness: 0.6, side: THREE.BackSide }));
    inG.position.y = th / 2;
    boxParts[0].add(inG);
    // the lid, hinged along the back top edge
    lid = new THREE.Group();
    lid.position.set(0, h / 2 + 0.008, -d / 2);
    const lidM = new THREE.Mesh(new RoundedBoxGeometry(w + 0.016, 0.022, d + 0.012, 3, 0.008), steel);
    lidM.position.set(0, 0.011, d / 2);
    lidM.castShadow = true;
    lidM.receiveShadow = true;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.006, 8, 20, Math.PI), steel);
    handle.position.set(0, 0.024, d / 2);
    lid.add(lidM, handle);
    latch = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.05, 0.012, 2, 0.004), shiny(new THREE.MeshStandardMaterial({ color: new THREE.Color('#d8b04a'), roughness: 0.3, metalness: 1, envMap })));
    latch.position.set(0, -0.012, d + 0.008);
    lid.add(latch);
    box.add(lid);
    scene.add(box);
    boxMud = muddy(steel, 'steelMud');
  }
  // the click glint: a four-point star
  const glintMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uA: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uA; varying vec2 vUv; void main(){ vec2 a = abs(vUv);
      float g = exp(-a.x * 24.0) * exp(-a.y * 3.2) + exp(-a.y * 24.0) * exp(-a.x * 3.2) + 0.7 * exp(-dot(vUv, vUv) * 16.0);
      gl_FragColor = vec4(vec3(1.7, 1.6, 1.3) * g * uA, 1.0); }`,
  });
  const glint = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), glintMat);
  glint.renderOrder = 8;
  scene.add(glint);
  function updateBox(t) {
    const t0 = T.box0 - 0.02;
    box.visible = t >= t0 && !(t > T.boxUp - 0.5 && t < T.boxUp);
    glint.visible = false;
    ctx.buried[1] = null;
    if (!box.visible) return;
    // assembly: bottom, four walls, each from a little away with an overshoot
    boxParts.forEach((g, i) => {
      const ti = T.box0 + i * T.boxGap;
      const k = popIn(t, ti, 0.3, 2.2);
      g.visible = t >= ti;
      const f = g.userData.from;
      g.position.set(f.x * (1 - k), f.y * (1 - k), f.z * (1 - k));
      g.scale.setScalar(Math.max(0.001, 0.4 + 0.6 * k));
    });
    lid.visible = t >= T.boxLid;
    const lk = popIn(t, T.boxLid, 0.3, 2.2);
    let ang = -1.75; // open
    if (t >= T.click - 0.18) ang = lerp(-1.75, 0, easeOutBack(prog(t, T.click - 0.18, 0.18), 1.2));
    if (t >= T.creak0) ang = -1.95 * (0.55 * smooth(prog(t, T.creak0, (T.creak1 - T.creak0) * 0.8)) + 0.45 * easeOutBack(prog(t, T.creak1 - 0.12, 0.22), 2.0));
    lid.rotation.x = ang;
    lid.scale.setScalar(Math.max(0.001, lk));
    boxMud.uMud.value = 0.85 * ramp(t, T.sink0 + 0.25, 0.8);
    // where it is
    const bp = WD.boxPos(t);
    if (bp) {
      place(box, bp.x, bp.y, bp.z, 0, 0, 0.04 * wobble(t, T.click, 6, 7));
      if (bp.y < -0.25) ctx.buried[1] = { x: bp.x, y: bp.y, hw: BOX.w / 2 + 0.01, hh: BOX.h / 2 + 0.02 };
    } else if (anchors.dadHandL && anchors.dadHandR) {
      anchors.dadHandL.updateWorldMatrix(true, false);
      anchors.dadHandR.updateWorldMatrix(true, false);
      const a = new THREE.Vector3().setFromMatrixPosition(anchors.dadHandL.matrixWorld);
      const b = new THREE.Vector3().setFromMatrixPosition(anchors.dadHandR.matrixWorld);
      const one = ramp(t, T.cardOut - 0.05, 0.4); // after the card comes out: hanging from the left hand
      const c = a.clone().lerp(b, 0.5 * (1 - one));
      const yaw = (ctx.shared?.dadFacing ?? -0.6);
      place(box, c.x, c.y + lerp(0.05, -0.04, one), c.z + lerp(0.02, 0.07, one), 0, yaw, 0);
    } else place(box, 0.5, 1.0, LANE, 0, 0, 0);
    // a glint on the corner when the lid clicks shut
    const gk = popIn(t, T.click, 0.18, 2.5) * (1 - smooth(prog(t, T.click + 0.25, 0.35)));
    if (gk > 0.01) {
      glint.visible = true;
      glint.position.copy(box.position).add(V(BOX.w / 2 - 0.02, BOX.h / 2 + 0.03, BOX.d / 2 + 0.02));
      glint.rotation.z = t * 2;
      glint.scale.setScalar(0.4 + gk);
      glintMat.uniforms.uA.value = gk;
    }
  }

  // -------------------------------------------------------------------------
  // the flowers: tulip, daisy, pom-pom, cosmos, in bright colours
  // -------------------------------------------------------------------------
  const leafMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#3f8a32'), roughness: 0.6, side: THREE.DoubleSide });
  const stemMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#4a8f35'), roughness: 0.65 });
  const PETAL = [['#e8384f', '#ffd24a'], ['#ffffff', '#f2b818'], ['#a855d6', '#7a2fb0'], ['#ff8a2a', '#ffd84a'], ['#ff6fa8', '#ffe066']];
  const flowers = WD.FLOWERS.map(([x, z, kind, size], i) => {
    const g = new THREE.Group();
    const inner = new THREE.Group(); // sways and squishes
    g.add(inner);
    const H = (0.26 + 0.06 * ((i * 7) % 3)) * size;
    const stem = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0, 0, 0), V(0.012, H * 0.5, 0.005), V(-0.005, H, 0)]), 10, 0.007, 6), stemMat);
    inner.add(stem);
    for (const s of [-1, 1]) {
      const lf = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), leafMat);
      lf.scale.set(1, 0.18, 0.45);
      lf.position.set(s * 0.035, H * (0.28 + 0.12 * (s > 0 ? 1 : 0)), 0);
      lf.rotation.set(0, 0, s * -0.5);
      inner.add(lf);
    }
    const colors = PETAL[(kind + i) % PETAL.length];
    const pm = new THREE.MeshStandardMaterial({ color: new THREE.Color(colors[0]), roughness: 0.55, side: THREE.DoubleSide });
    const cm = new THREE.MeshStandardMaterial({ color: new THREE.Color(colors[1]), roughness: 0.6 });
    const head = new THREE.Group();
    head.position.y = H;
    if (kind === 0) {
      // tulip: a cup of petals
      for (let k = 0; k < 5; k++) {
        const p = new THREE.Mesh(new THREE.SphereGeometry(0.036, 14, 10), pm);
        p.scale.set(0.62, 1.15, 0.32);
        const a = (k / 5) * Math.PI * 2;
        p.position.set(Math.cos(a) * 0.022, 0.035, Math.sin(a) * 0.022);
        p.rotation.set(Math.sin(a) * 0.25, -a, -Math.cos(a) * 0.25);
        head.add(p);
      }
    } else if (kind === 1 || kind === 3) {
      // daisy / cosmos: a ring of petals round a centre, facing the camera a little
      const n = kind === 1 ? 11 : 7;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        const p = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), pm);
        p.scale.set(kind === 1 ? 0.35 : 0.6, 1.0, 0.12);
        p.position.set(Math.cos(a) * 0.04, Math.sin(a) * 0.04, 0);
        p.rotation.z = a - Math.PI / 2;
        head.add(p);
      }
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.022, 14, 10), cm);
      c.scale.set(1, 1, 0.6);
      head.add(c);
      head.rotation.x = -0.5;
    } else {
      // pom-pom: a ball of little blobs
      const ball = new THREE.Mesh(G.lumpyBlob(0.045, 2, 0.25, 600 + i), pm);
      ball.position.y = 0.02;
      head.add(ball);
    }
    inner.add(head);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(g);
    // when the roller passes over this flower (rolling right to left)
    let pass = T.roll1;
    for (let k = 0; k <= 200; k++) {
      const tt = T.roll0 + ((T.roll1 - T.roll0) * k) / 200;
      if (WD.rollerX(tt) <= x) { pass = tt; break; }
    }
    // where Dad's dig tosses it
    const left = i % 3 !== 0;
    const land = left ? V(-0.62 - 0.12 * (i % 4) - 0.1 * (i % 2), 0, -0.25 - 0.09 * (i % 4)) : V(1.2 + 0.13 * (i % 3), 0, -0.3 - 0.12 * (i % 2));
    return { g, inner, head, x, z, H, pass, land, i };
  });
  function updateFlowers(t) {
    for (const f of flowers) {
      const t0 = WD.flowerT(f.i);
      f.g.visible = t >= t0;
      if (!f.g.visible) continue;
      const k = popIn(t, t0, 0.38, 2.6);
      let sx = 1, sy = Math.max(0.001, k), rz = 0.05 * Math.sin(t * 1.8 + f.i), x = f.x, z = f.z, y = WD.groundY(f.x, f.z, t), tip = 0;
      sx = 0.6 + 0.4 * k;
      // squished flat by the roller, then a springy boing back up
      if (t > f.pass - 0.15 && t < f.pass + 1.2) {
        const sq = smooth(clamp((t - (f.pass - 0.15)) / 0.12));
        const back = easeOutBack(clamp((t - (f.pass + 0.12)) / 0.35), 3.0);
        sy *= lerp(1, 0.18, sq * (1 - back)) + 0.12 * wobble(t, f.pass + 0.3, 3.5, 5);
        sx *= 1 + 0.4 * sq * (1 - back);
      }
      // tossed out by Dad's dig, landing tipped over on the lawn
      const tt = T.dadDig0 + 0.25 + f.i * 0.11;
      if (t > tt) {
        const u = clamp((t - tt) / 0.55);
        x = lerp(f.x, f.land.x, u);
        z = lerp(f.z, f.land.z, u);
        y = lerp(y, 0, u) + 0.7 * Math.sin(Math.PI * u) * (1 - 0.3 * (f.i % 2));
        tip = lerp(0, f.x < 0 ? 1.35 : -1.35, easeOutBack(u, 1.6)) * (u < 1 ? 1 : 1);
        rz = tip + 2.5 * Math.sin(Math.PI * u) * (f.i % 2 ? 1 : -1);
        if (u >= 1) { rz = (f.land.x < 0 ? 1 : -1) * 1.4; y = 0.02; }
      }
      f.g.position.set(x, y, z);
      f.g.rotation.set(0, 0.3 * Math.sin(f.i * 1.7), rz);
      f.inner.scale.set(sx * 1.45, sy * 1.3, sx * 1.45);
    }
  }

  // -------------------------------------------------------------------------
  // the garden roller: a green steel drum, a U-frame, a long handle, a grip bar
  // -------------------------------------------------------------------------
  const roller = new THREE.Group();
  const drum = new THREE.Group();
  {
    const { r, w, grip } = WD.ROLLER;
    const paint = shiny(new THREE.MeshStandardMaterial({ color: new THREE.Color('#2f8a4e'), roughness: 0.38, metalness: 0.55, envMap, envMapIntensity: 0.7 }));
    const capM = shiny(new THREE.MeshStandardMaterial({ color: new THREE.Color('#d9dde0'), roughness: 0.3, metalness: 1, envMap }));
    const dg = new THREE.CylinderGeometry(r, r, w, 36, 1);
    dg.rotateX(Math.PI / 2);
    const dm = new THREE.Mesh(dg, paint);
    // a stripe so the rolling reads
    const sg = new THREE.BoxGeometry(0.03, 0.01, w * 0.98);
    sg.translate(0, r + 0.002, 0);
    const sm = new THREE.Mesh(sg, capM);
    drum.add(dm, sm);
    for (const s of [-1, 1]) {
      const c = new THREE.Mesh(new THREE.TorusGeometry(r * 0.96, 0.012, 8, 30), capM);
      c.position.z = (s * w) / 2;
      drum.add(c);
    }
    roller.add(drum);
    // the frame: arms from the axle ends meeting at the handle, the handle to the grip
    const frame = [];
    const hub = V(0, 0, 0), joint = V(0.25, 0.2, 0), gp = V(grip.dx, grip.y - r, 0);
    for (const s of [-1, 1]) frame.push(G.rod(V(0, 0, (s * w) / 2 + 0.015), V(joint.x, joint.y, (s * 0.06)), 0.012, 0.012, 8));
    frame.push(G.rod(V(0, 0, -w / 2 - 0.02), V(0, 0, w / 2 + 0.02), 0.014, 0.014, 8));
    frame.push(G.rod(joint, gp, 0.015, 0.015, 8));
    frame.push(G.rod(V(gp.x, gp.y, -0.17), V(gp.x, gp.y, 0.17), 0.016, 0.016, 8));
    roller.add(new THREE.Mesh(G.mergeAll(frame), capM));
    const gripM = new THREE.MeshStandardMaterial({ color: new THREE.Color('#222226'), roughness: 0.7 });
    for (const s of [-1, 1]) {
      const gg = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.12, 12), gripM);
      gg.rotation.x = Math.PI / 2;
      gg.position.set(gp.x, gp.y, s * 0.11);
      roller.add(gg);
    }
    roller.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(roller);
  }
  function updateRoller(t) {
    const kIn = popIn(t, T.rollIn - 0.25, 0.35, 2.4), kOut = 1 - smooth(prog(t, T.rollOut, 0.2));
    const k = kIn * kOut;
    roller.visible = k > 0.01;
    if (!roller.visible) return;
    const x = WD.rollerX(t), { r } = WD.ROLLER;
    const y = r + WD.groundY(x, LANE, t);
    place(roller, x, y, LANE, 0, 0, 0, Math.max(0.001, k));
    drum.rotation.z = (WD.rollerX(T.rollIn) - x) / r;
  }

  // -------------------------------------------------------------------------
  // the metal detector, its beep rings on the lawn
  // -------------------------------------------------------------------------
  const det = new THREE.Group();
  const shaftG = new THREE.Group(); // a unit-length shaft along +y, stretched to the coil
  const coil = new THREE.Group();
  const led = new THREE.MeshStandardMaterial({ color: new THREE.Color('#3a0a0a'), emissive: new THREE.Color(3.0, 0.25, 0.2), emissiveIntensity: 0, roughness: 0.3 });
  {
    const alu = shiny(new THREE.MeshStandardMaterial({ color: new THREE.Color('#c7ccd2'), roughness: 0.28, metalness: 1, envMap }));
    const dark = new THREE.MeshStandardMaterial({ color: new THREE.Color('#2b2f36'), roughness: 0.55 });
    const yellow = new THREE.MeshStandardMaterial({ color: new THREE.Color('#f0b52a'), roughness: 0.45 });
    const sg = new THREE.CylinderGeometry(0.012, 0.012, 1, 10);
    sg.translate(0, 0.5, 0);
    shaftG.add(new THREE.Mesh(sg, alu));
    det.add(shaftG);
    const ctrl = new THREE.Mesh(new RoundedBoxGeometry(0.09, 0.06, 0.13, 2, 0.015), yellow);
    ctrl.position.set(0, 0.02, 0.08);
    const ledM = new THREE.Mesh(new THREE.SphereGeometry(0.01, 10, 8), led);
    ledM.position.set(0, 0.055, 0.1);
    det.add(ctrl, ledM);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.022, 30), dark);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.014, 8, 30), yellow);
    ring.rotation.x = Math.PI / 2;
    coil.add(disc, ring);
    det.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    coil.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(det, coil);
  }
  const ringMat = ctx.FX.glowMat(new THREE.Color(1.2, 1.0, 0.45), { ring: 0.62, width: 0.12 });
  const rings = ctx.instanced(new THREE.PlaneGeometry(1, 1), ringMat, 6, false);
  const puffs = ctx.instanced(ctx.FX.puffGeo, ctx.FX.puffMat, 4, false);
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
  function updateDetector(t) {
    const on = t >= T.dadOut - 0.1 && t < T.dadDig0 + 0.2 && anchors.dadHandR && ctx.shared?.coil;
    const k = on ? 1 - smooth(prog(t, T.dadDig0, 0.18)) : 0;
    det.visible = coil.visible = k > 0.01;
    ctx.beginInst(rings);
    ctx.beginInst(puffs);
    if (det.visible) {
      anchors.dadHandR.updateWorldMatrix(true, false);
      _a.setFromMatrixPosition(anchors.dadHandR.matrixWorld);
      const c = ctx.shared.coil;
      _b.set(c.x, c.y + 0.03, c.z);
      // the shaft runs from the hand down to the coil
      const d = _b.clone().sub(_a);
      const L = d.length();
      det.position.copy(_a);
      det.quaternion.setFromUnitVectors(_up, d.clone().normalize());
      det.scale.setScalar(k);
      shaftG.scale.set(1, L, 1);
      coil.position.copy(_b);
      coil.rotation.set(0, ctx.shared.dadFacing || 0, 0);
      coil.scale.setScalar(k);
      // beeps: a ring on the lawn and the LED flashing
      let flash = 0;
      for (const b of WD.BEEPS) {
        const u = (t - b) / 0.5;
        if (u < 0 || u > 1) continue;
        const s = 0.25 + 0.6 * easeOutCubic(u);
        if (ctx.setInst(rings, c.x, 0.015, c.z, s, s, 1, -Math.PI / 2, 0, 0) >= 0) flash = Math.max(flash, 1 - u);
      }
      let a = 0.9;
      if (t >= T.beep1) {
        // the squeal: fast steady pulses
        const ph = ((t - T.beep1) * 12) % 1;
        const s = 0.3 + 0.45 * ph;
        ctx.setInst(rings, c.x, 0.015, c.z, s, s, 1, -Math.PI / 2, 0, 0);
        flash = Math.max(flash, 0.7 + 0.3 * Math.sin(t * 60));
        a = 1.1;
      }
      ringMat.uniforms.uA.value = a;
      led.emissiveIntensity = 1.6 * flash;
    }
    // a puff where it vanishes
    const pu = prog(t, T.dadDig0, 0.45);
    if (pu > 0 && pu < 1 && ctx.shared?.coil) {
      const s = 0.14 * (0.3 + 0.7 * easeOutCubic(pu)) * (1 - smooth(clamp((pu - 0.5) / 0.5)));
      ctx.setInst(puffs, det.position.x, det.position.y - 0.2, det.position.z, s, s, s);
    }
    ctx.endInst(rings);
    ctx.endInst(puffs);
  }

  // -------------------------------------------------------------------------
  // the ladder in the deep hole
  // -------------------------------------------------------------------------
  const ladder = new THREE.Group();
  {
    const L = WD.LADDER;
    const len = L.y1 - L.y0;
    const wood = MAT.patch(new THREE.MeshStandardMaterial({ color: new THREE.Color('#b9844e'), roughness: 0.7 }), {
      key: 'ladderWood', colorFn: 'lwC',
      extraFrag: 'vec3 lwC(vec3 p, vec3 n){ return vec3(0.82 + 0.3 * vnoise(vec2(p.x * 40.0 + p.z * 40.0, p.y * 3.0))); }',
    });
    const parts = [G.box(0.035, len, 0.035, -0.17, len / 2, 0), G.box(0.035, len, 0.035, 0.17, len / 2, 0)];
    for (let y = 0.2; y < len - 0.1; y += 0.3) parts.push(G.box(0.34, 0.03, 0.03, 0, y, 0));
    const m = new THREE.Mesh(G.mergeAll(parts), wood);
    m.castShadow = true;
    m.receiveShadow = true;
    ladder.add(m);
    ladder.position.set(L.x, L.y0, L.z);
    ladder.rotation.x = -Math.atan2(L.lean, len);
    scene.add(ladder);
  }
  function updateLadder(t) {
    const k = popIn(t, T.ladderIn, 0.3, 2.4) * (1 - smooth(prog(t, T.ladderOut, 0.18)));
    ladder.visible = k > 0.01;
    ladder.scale.set(Math.max(0.001, k), Math.max(0.001, k), Math.max(0.001, k));
  }

  return {
    update(t) {
      updateCard(t);
      updateBox(t);
      updateFlowers(t);
      updateRoller(t);
      updateDetector(t);
      updateLadder(t);
    },
  };
}
