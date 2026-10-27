// Effects: the dirt thrown out of the pit and the spoil pile, the plank test (a
// 2x4 flying in slow motion, shattering on the roof slab), soil spurting at the
// drilling anchors, dust when the door slams, debris bouncing off the vent caps,
// leaves and debris on the rising wind, the tornado's dust curtains and flying
// boards, sheets and branches, sideways rain, the dog shaking off the dust, and
// the mess left on the lawn afterwards.
import * as THREE from 'three';

export function build(ctx) {
  const { scene, T, WD, MAT, G, U, instanced, beginInst, setInst, endInst, camAt } = ctx;
  const { clamp, lerp, smooth, prog, easeOutCubic, bump } = U;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const rnd = U.mulberry32(9001);
  const updaters = [];

  // shared materials ------------------------------------------------------------
  const dirtMat = MAT.patch(MAT.std('#5a3d27', 0.95), {
    key: 'dirtFx', colorFn: 'dfC', bumpFn: 'dfB',
    extraFrag: `vec3 dfC(vec3 p, vec3 n){ return mix(vec3(0.62), vec3(1.15), vnoise3(p * 9.0)) * (0.85 + 0.3 * vnoise3(p * 31.0)); }
      float dfB(vec3 p, vec3 n){ return 0.01 * vnoise3(p * 14.0) + 0.004 * vnoise3(p * 40.0); }`,
  });
  function softMat(color, opacity, key) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 1, transparent: true, opacity, depthWrite: false });
    m.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>',
        '{ float f = abs(dot(normalize(normal), normalize(vViewPosition))); diffuseColor.a *= pow(smoothstep(0.0, 0.95, f), 2.2); }\n#include <opaque_fragment>');
    };
    m.customProgramCacheKey = () => key;
    return m;
  }
  const chunkGeo = G.lumpyBlob(1, 1, 0.32, 7);
  const chunks = instanced(chunkGeo, dirtMat, 260);
  const puffMat = softMat(new THREE.Color(0.48, 0.38, 0.27), 0.34, 'puffFx');
  const puffGeo = G.lumpyBlob(1, 2, 0.22, 3);
  const puffs = instanced(puffGeo, puffMat, 180, false);
  const greyPuffMat = softMat(new THREE.Color(0.62, 0.6, 0.56), 0.4, 'greyPuff');
  const greyPuffs = instanced(puffGeo, greyPuffMat, 60, false);

  // -------------------------------------------------------------------------
  // the dig: each spadeful flies over the worker's shoulder onto the pile
  // -------------------------------------------------------------------------
  const DIG_X = (t) => lerp(3.05, -0.75, smooth(prog(t, 7.7, 4.6)));
  const DIGS = WD.DIG_T.map((s) => ({ s, parts: Array.from({ length: 7 }, () => ({ a: rnd(), b: rnd(), c: rnd(), d: rnd() })) }));
  const pile = new THREE.Mesh(G.lumpyBlob(1, 3, 0.16, 11), dirtMat);
  pile.castShadow = pile.receiveShadow = true;
  scene.add(pile);
  updaters.push((t) => {
    beginInst(chunks);
    beginInst(puffs);
    for (const dg of DIGS) {
      const dt = t - dg.s;
      if (dt < 0 || dt > 1.4) continue;
      const pit = WD.pit(dg.s);
      const x0 = DIG_X(dg.s) - 0.4, y0 = -pit.d + 1.35, z0 = -1.4;
      for (const q of dg.parts) {
        const x1 = WD.PILE.x + (q.b - 0.5) * 0.9, z1 = WD.PILE.z + (q.c - 0.5) * 0.8, y1 = 0.15 + 0.5 * WD.pileK(dg.s + 0.6);
        const T0 = 0.55 + 0.25 * q.d, hgt = 0.8 + 0.6 * q.a;
        const u = clamp(dt / T0);
        const x = lerp(x0 + (q.b - 0.5) * 0.3, x1, u), z = lerp(z0 + (q.c - 0.5) * 0.3, z1, u);
        const top = Math.max(y0, y1) + hgt;
        const y = (1 - u) * (1 - u) * y0 + 2 * u * (1 - u) * (2 * top - (y0 + y1) / 2) + u * u * y1;
        const sc = (0.05 + 0.05 * q.a) * (dt < T0 ? smooth(clamp(dt / 0.06)) : 1 - smooth(clamp((dt - T0) / 0.25)));
        setInst(chunks, x, y, z, sc, sc * 0.8, sc, q.a * 9 + dt * 7, q.b * 9, q.c * 9);
        if (dt > T0 && dt < T0 + 0.6 && q.a < 0.5) {
          const pu = (dt - T0) / 0.6;
          const ps = (0.06 + 0.16 * easeOutCubic(pu)) * (1 - smooth(clamp((pu - 0.5) / 0.5)));
          setInst(puffs, x1, y1 + 0.05 + 0.1 * pu, z1, ps, ps * 0.7, ps, 0, q.a * 6, 0);
        }
      }
      // a puff where the blade bites
      const pu = (dt + 0.2) / 0.5;
      if (pu > 0 && pu < 1) {
        const ps = (0.06 + 0.14 * easeOutCubic(pu)) * (1 - smooth(clamp((pu - 0.45) / 0.55)));
        setInst(puffs, DIG_X(dg.s) - 0.5, -pit.d + 0.06, -1.15, ps, ps * 0.6, ps);
      }
    }
    const k = WD.pileK(t);
    pile.visible = k > 0.01;
    pile.scale.set(0.3 + 1.1 * k, Math.max(0.01, 0.75 * k), 0.3 + 0.9 * k);
    pile.position.set(WD.PILE.x, -0.06, WD.PILE.z);
  });

  // -------------------------------------------------------------------------
  // the plank test: a 2x4 flies in (slow motion), hits the roof slab end-on and
  // bursts into splinters; the concrete is untouched
  // -------------------------------------------------------------------------
  const plankWood = MAT.woodMaterial('plank', '#c49a6a', 'vec2(p.x * 1.0 + p.y * 0.2, p.y + p.z * 3.0)', 0.09, 0.75);
  const plank = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.09, 0.04), plankWood);
  plank.castShadow = true;
  scene.add(plank);
  const P0 = V(-3.25, 1.0, -0.42), P1 = V(-1.64, 0.17, -0.34);
  const pdir = P1.clone().sub(P0).normalize();
  const qPlank = new THREE.Quaternion().setFromUnitVectors(V(1, 0, 0), pdir);
  const plankLead = (t) => P0.clone().lerp(P1, clamp((t - T.plank0) / (T.hit - T.plank0)));
  ctx.FX.plankLead = plankLead;
  ctx.FX.plankCenter = (t) => plankLead(t).addScaledVector(pdir, -0.9);
  const splGeo = new THREE.BoxGeometry(1, 1, 1);
  const splinters = instanced(splGeo, plankWood, 90);
  const SPL = Array.from({ length: 90 }, (_, i) => {
    const big = i < 6;
    const a = rnd() * Math.PI * 2;
    const up = 0.35 + 0.65 * rnd();
    const sp = (big ? 1.8 : 2.6 + 4.5 * rnd()) * (0.6 + 0.4 * up);
    return {
      v: V(Math.cos(a) * (1 - up) * sp + (big ? 0.8 : 1.2), up * sp * 1.1, Math.sin(a) * (1 - up) * sp * 0.8 - 0.2),
      L: big ? 0.35 + 0.35 * rnd() : 0.05 + 0.22 * rnd(), w: big ? 0.08 : 0.008 + 0.018 * rnd(), h: big ? 0.035 : 0.006 + 0.01 * rnd(),
      r: V(rnd() * 20 - 10, rnd() * 20 - 10, rnd() * 20 - 10).multiplyScalar(big ? 0.4 : 1), big,
    };
  });
  updaters.push((t) => {
    const fly = t >= T.plank0 && t < T.hit;
    plank.visible = fly;
    if (fly) {
      const c = plankLead(t).addScaledVector(pdir, -0.9);
      plank.position.copy(c);
      plank.quaternion.copy(qPlank).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler((t - T.plank0) * 1.4, 0, 0)));
    }
    beginInst(splinters);
    const dt = t - T.hit;
    if (dt >= 0 && dt < 2.4) {
      const o = P1.clone().addScaledVector(pdir, -0.2);
      for (const s of SPL) {
        // slow motion at first, then real speed
        const tt = dt < 0.6 ? dt * 0.45 : 0.27 + (dt - 0.6) * 1.0;
        let x = o.x + s.v.x * tt, y = o.y + s.v.y * tt - 4.9 * tt * tt, z = o.z + s.v.z * tt;
        const floor = x > WD.OUT.x0 && x < WD.HATCH.x0 && z > WD.OUT.zb ? WD.TOP : 0;
        let rx = s.r.x * tt, ry = s.r.y * tt, rz = s.r.z * tt;
        if (y < floor + s.h) {
          y = floor + s.h * 0.5;
          rx = Math.PI / 2;
          rz = 0;
        }
        const fade = 1 - smooth(clamp((dt - 1.8) / 0.6));
        setInst(splinters, x, y, z, s.L * fade, s.h, s.w, rx, ry, rz);
      }
    }
    endInst(splinters);
  });

  // -------------------------------------------------------------------------
  // dust: the plank's burst, the door slamming, soil at the drilling anchors, the
  // dog's shake
  // -------------------------------------------------------------------------
  const DUST_EVENTS = [
    { t: T.hit, p: P1, n: 14, r: 0.45, grey: true, up: 0.6 },
    { t: T.doorShut, p: V((WD.HATCH.x0 + WD.HATCH.x1) / 2, WD.TOP + 0.05, -0.6), n: 12, r: 0.9, grey: true, up: 0.15, wide: 1.6 },
    { t: T.doorClose + 0.32, p: V((WD.HATCH.x0 + WD.HATCH.x1) / 2, WD.TOP + 0.05, -0.6), n: 10, r: 0.8, grey: true, up: 0.15, wide: 1.6 },
    { t: T.shake, p: null, n: 16, r: 0.32, grey: false, up: 0.25, dog: true },
  ];
  DUST_EVENTS.forEach((e) => (e.parts = Array.from({ length: e.n }, () => ({ a: rnd() * 6.283, b: rnd(), c: rnd() }))));
  const ANCHOR_SPURTS = WD.ANCHORS.map((x, i) => ({ x, t0: T.drill0 + i * T.drillGap, parts: Array.from({ length: 8 }, () => ({ a: rnd(), b: rnd(), c: rnd() })) }));
  updaters.push((t) => {
    beginInst(greyPuffs);
    for (const e of DUST_EVENTS) {
      const dt = t - e.t;
      if (dt < 0 || dt > 1.6) continue;
      const base = e.dog ? ctx.anchors.dogShake : e.p;
      for (const q of e.parts) {
        const u = dt / 1.6;
        const r = e.r * (0.3 + 1.2 * easeOutCubic(u)) * (0.6 + 0.6 * q.b);
        const x = base.x + Math.cos(q.a) * r * (e.wide || 1), z = base.z + Math.sin(q.a) * r * 0.5, y = base.y + e.up * easeOutCubic(u) * (0.5 + q.c);
        const s = (0.08 + 0.22 * easeOutCubic(u)) * (1 - smooth(clamp((u - 0.4) / 0.6))) * (e.dog ? 0.7 : 1);
        if (e.grey) setInst(greyPuffs, x, y, z, s, s * 0.75, s, 0, q.a, 0);
        else setInst(puffs, x, y, z, s, s * 0.75, s, 0, q.a, 0);
      }
    }
    endInst(greyPuffs);
    // soil pushed out round each anchor's tip while it drills (chunks + puffs, on the cut)
    for (const a of ANCHOR_SPURTS) {
      const i = WD.ANCHORS.indexOf(a.x);
      if (t < a.t0 || t > a.t0 + 1.6) continue;
      const L = ctx.FX.anchorDepth ? ctx.FX.anchorDepth(i, t) : 0;
      const tipY = WD.FLOOR_B - L;
      const drilling = t < a.t0 + 1.15;
      for (const q of a.parts) {
        const ph = (t * (1.5 + q.c) + q.a) % 1;
        if (!drilling && ph > 0.5) continue;
        const ang = q.b * 6.283;
        const r = 0.04 + 0.16 * ph;
        const s = 0.025 * (1 - ph) * (drilling ? 1 : 1 - smooth(prog(t, a.t0 + 1.15, 0.4)));
        setInst(chunks, a.x + Math.cos(ang) * r, tipY + 0.1 + Math.sin(ang) * r * 0.6, 0.06, s, s * 0.8, s * 0.4, ang * 3, 0, ang);
      }
    }
    endInst(chunks);
    endInst(puffs);
  });

  // -------------------------------------------------------------------------
  // debris dropping on the vent caps and bouncing off (they keep it out)
  // -------------------------------------------------------------------------
  const bitsMat = MAT.std('#6a5a40', 0.9);
  const bits = instanced(new THREE.BoxGeometry(1, 1, 1), bitsMat, 24);
  const BITS = Array.from({ length: 24 }, (_, i) => ({ v: i % 2, t0: T.bounce - 0.55 + rnd() * 0.5, dx: (rnd() - 0.5) * 0.5, dz: 0.1 + rnd() * 0.4, s: 0.02 + 0.03 * rnd(), r: rnd() * 10 }));
  updaters.push((t) => {
    beginInst(bits);
    for (const b of BITS) {
      const dt = t - b.t0;
      if (dt < 0 || dt > 1.5) continue;
      const top = ctx.FX.ventTop ? ctx.FX.ventTop(b.v) : V(0, 1, -1);
      const fall = 0.42; // falls onto the cap
      let x, y, z;
      if (dt < fall) {
        const u = dt / fall;
        x = top.x + b.dx * 0.15;
        z = top.z + 0.12;
        y = top.y + 0.18 + 1.4 * (1 - u * u);
      } else {
        const u = dt - fall;
        x = top.x + b.dx * 0.15 + b.dx * u * 2.2;
        z = top.z + 0.12 + b.dz * u * 2;
        y = top.y + 0.18 + 1.6 * u - 4.9 * u * u;
        if (y < WD.TOP + b.s) y = WD.TOP + b.s;
      }
      setInst(bits, x, y, z, b.s, b.s * 0.5, b.s * 1.6, b.r * dt * 3, b.r, dt * 9);
    }
    endInst(bits);
  });

  // -------------------------------------------------------------------------
  // wind-borne leaves and small debris (rising from scene 4), streaming left to right
  // -------------------------------------------------------------------------
  const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, side: THREE.DoubleSide });
  const LEAF_N = 260;
  const leaves = instanced(new THREE.PlaneGeometry(0.07, 0.045), leafMat, LEAF_N, false);
  {
    const cols = ['#5d7d2c', '#7a8f35', '#a08a3c', '#6b5a32', '#4c6b28'].map((c) => new THREE.Color(c));
    for (let i = 0; i < LEAF_N; i++) leaves.setColorAt(i, cols[i % cols.length].clone().multiplyScalar(0.7 + 0.5 * rnd()));
  }
  const LEAVES = Array.from({ length: LEAF_N }, () => ({ o: rnd(), y: rnd(), z: rnd(), v: 0.7 + 0.6 * rnd(), w: rnd() * 6.28, f: 2 + 4 * rnd(), on: rnd() }));
  updaters.push((t) => {
    beginInst(leaves);
    const w = WD.wind(t);
    const amount = smooth(prog(t, T.debris0 - 1, 2.5)) * (w > 0.25 ? 1 : w / 0.25) * (1 - smooth(prog(t, T.passEnd - 0.5, 1.5)));
    if (amount > 0.01) {
      const c = camAt(t);
      const span = 1080 / c.s + 14;
      const speed = 3 + 26 * w * w;
      for (const L of LEAVES) {
        if (L.on > amount) continue;
        const z = -0.3 - L.z * 14;
        const per = (span + 10) / speed;
        const ph = ((t / per + L.o) % 1 + 1) % 1;
        const x = c.cx - span / 2 - 5 + ph * (span + 10);
        const y = 0.2 + L.y * (2.5 + 5 * w) + 0.6 * Math.sin(t * L.f * 0.4 + L.w) + (z < -9 ? 1.5 : 0);
        const s = 0.8 + 0.6 * L.v;
        setInst(leaves, x, y, z, s, s, s, t * L.f + L.w, t * L.f * 0.7, t * L.f * 1.3);
      }
    }
    endInst(leaves);
  });

  // -------------------------------------------------------------------------
  // the tornado over the yard: dust curtains streaming past at several depths,
  // boards, sheets and branches flying, sideways rain
  // -------------------------------------------------------------------------
  const curtainU = { uT: { value: 0 }, uA: { value: 0 }, uC: { value: new THREE.Color(0.2, 0.18, 0.15) } };
  const curtainMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: curtainU,
    vertexShader: 'varying vec3 vW; varying vec2 vUv; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float uT, uA; uniform vec3 uC; varying vec3 vW; varying vec2 vUv;
      ${MAT.GLSL_NOISE}
      void main(){
        float sp = 9.0 + vW.z * -0.35;
        vec2 q = vec2(vW.x * 0.16 - uT * sp * 0.16, vW.y * 0.22 + 0.25 * sin(vW.x * 0.3 + uT * 2.0));
        float n = fbm(q + vW.z * 0.37) * 0.65 + fbm(q * 3.1 + vec2(-uT * 1.5, 0.0)) * 0.35;
        float a = smoothstep(0.3, 0.75, n) * uA;
        a *= smoothstep(0.0, 0.08, vUv.y) * (1.0 - smoothstep(0.75, 1.0, vUv.y)) * smoothstep(0.0, 0.05, vUv.x) * (1.0 - smoothstep(0.95, 1.0, vUv.x));
        gl_FragColor = vec4(uC * (0.6 + 0.6 * n), a * 0.9);
      }`,
  });
  const curtains = [-2.8, -6.5, -11.5, -19, -30].map((z, i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(60, 9 + i * 3), curtainMat);
    m.position.set(2, (9 + i * 3) / 2 - 0.3, z);
    m.renderOrder = 20 - i;
    m.frustumCulled = false;
    scene.add(m);
    return m;
  });
  // flying debris: boards, metal sheets, branches, shingles
  const DEB_N = 150;
  const boardDeb = instanced(new THREE.BoxGeometry(1, 1, 1), MAT.woodMaterial('debWood', '#8a6a4a', 'vec2(p.x + p.y, p.z)', 0.12, 0.85), DEB_N, true);
  const sheetMat = MAT.galvMaterial('debSheet', '#9aa0a3');
  const sheetDeb = instanced(new THREE.BoxGeometry(1, 1, 1), sheetMat, 30, true);
  const DEB = Array.from({ length: DEB_N }, (_, i) => ({
    t0: T.hitT - 0.8 + Math.pow(rnd(), 0.8) * (T.passEnd - T.hitT + 0.3), dur: 0.9 + 1.4 * rnd(), y0: 0.4 + rnd() * 6.5, z: -1.5 - rnd() * 18,
    L: 0.3 + 1.4 * rnd(), w: 0.04 + 0.12 * rnd(), h: 0.02 + 0.03 * rnd(), r: V(rnd() * 14 - 7, rnd() * 14 - 7, rnd() * 14 - 7), lift: (rnd() - 0.3) * 3, kind: rnd(),
  }));
  const SHEETS = Array.from({ length: 30 }, () => ({ t0: T.hitT + rnd() * (T.passEnd - T.hitT - 1), dur: 1.2 + rnd(), y0: 1 + rnd() * 6, z: -4 - rnd() * 16, r: V(rnd() * 8 - 4, rnd() * 8 - 4, rnd() * 8 - 4) }));
  // sideways rain streaks
  const rainMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uA: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uA; varying vec2 vUv;
      void main(){ float a = smoothstep(0.0, 0.6, vUv.y) * (1.0 - smoothstep(0.9, 1.0, vUv.y)) * (1.0 - pow(abs(vUv.x * 2.0 - 1.0), 2.0));
        gl_FragColor = vec4(vec3(0.55, 0.6, 0.62) * a * uA, 1.0); }`,
  });
  const RAIN_N = 1400;
  const rain = instanced(new THREE.PlaneGeometry(0.01, 0.6), rainMat, RAIN_N, false);
  const RAIN = Array.from({ length: RAIN_N }, () => ({ x: rnd(), y: rnd(), z: rnd(), v: 0.8 + 0.4 * rnd() }));
  updaters.push((t) => {
    const eg = WD.engulf(t);
    curtainU.uT.value = t;
    curtainU.uA.value = eg * 0.95;
    const s = WD.storm(t);
    curtainU.uC.value.setRGB(0.21, 0.19, 0.155).multiplyScalar(1 - 0.3 * s);
    for (const c of curtains) c.visible = eg > 0.005;
    const c = camAt(t);
    beginInst(boardDeb);
    beginInst(sheetDeb);
    for (const d of DEB) {
      const u = (t - d.t0) / d.dur;
      if (u < 0 || u > 1) continue;
      const span = 1080 / c.s * (1 + -d.z / 14) + 12;
      const x = c.cx - span / 2 + u * span;
      const y = d.y0 + d.lift * u + 0.8 * Math.sin(u * 9 + d.L * 7);
      const tt = t - d.t0;
      if (d.kind < 0.7) setInst(boardDeb, x, y, d.z, d.L, d.h, d.w, d.r.x * tt, d.r.y * tt, d.r.z * tt);
      else setInst(boardDeb, x, y, d.z, d.L * 0.6, d.w * 0.6, d.w * 0.6, d.r.x * tt, d.r.y * tt, d.r.z * tt);
    }
    for (const d of SHEETS) {
      const u = (t - d.t0) / d.dur;
      if (u < 0 || u > 1) continue;
      const span = 1080 / c.s * (1 + -d.z / 14) + 14;
      const tt = t - d.t0;
      setInst(sheetDeb, c.cx - span / 2 + u * span, d.y0 + Math.sin(u * 6) * 1.2, d.z, 1.6, 0.01, 0.8, d.r.x * tt, d.r.y * tt, d.r.z * tt);
    }
    endInst(boardDeb);
    endInst(sheetDeb);
    // rain from just before the hit until the funnel has passed
    const rk = smooth(prog(t, T.storm, 1.5)) * (1 - smooth(prog(t, T.passEnd + 0.2, 1.2)));
    rainMat.uniforms.uA.value = 0.55 * rk * (0.6 + 0.4 * eg);
    beginInst(rain);
    if (rk > 0.01) {
      const span = 1080 / c.s + 10;
      const x0 = c.cx - span / 2;
      const yTop = 9;
      const slant = 0.9 + 1.4 * WD.wind(t);
      for (const r of RAIN) {
        const z = -0.4 - r.z * 16;
        const y = yTop - ((((t * 9.5 * r.v + r.y * yTop) % yTop) + yTop) % yTop);
        const x = x0 + ((r.x * span + (yTop - y) * slant + t * 6 * slant) % span);
        if (y < 0.05) continue;
        setInst(rain, x, y, z, 1, 1 + 0.4 * r.v, 1, 0, 0, Math.atan(slant) * 0.85);
      }
    }
    endInst(rain);
  });

  // -------------------------------------------------------------------------
  // afterwards: broken boards, a branch and twigs strewn over the lawn
  // -------------------------------------------------------------------------
  const after = new THREE.Group();
  {
    const wood = MAT.woodMaterial('mess', '#7d5f45', 'vec2(p.x + p.z, p.y)', 0.12, 0.85);
    const gs = [];
    for (const [x, z, ry, L] of [[-1.9, -4.2, 0.4, 1.4], [3.9, -5.6, 2.1, 1.1], [-3.2, -2.9, 1.2, 0.9], [6.2, -3.4, 0.9, 1.6], [0.6, -6.8, 2.6, 1.2]]) gs.push(G.box(L, 0.025, 0.13, x, 0.015, z, 0, ry, 0.05));
    after.add(new THREE.Mesh(G.mergeAll(gs), wood));
    const bark = MAT.std('#4e4036', 0.9);
    const br = [G.rod(V(-0.6, 0.06, -4.6), V(1.6, 0.25, -5.4), 0.06, 0.03, 8), G.rod(V(0.4, 0.12, -4.9), V(0.9, 0.5, -4.3), 0.025, 0.012, 6), G.rod(V(1.0, 0.18, -5.2), V(1.7, 0.6, -5.0), 0.02, 0.01, 6)];
    after.add(new THREE.Mesh(G.mergeAll(br), bark));
    after.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(after);
  }
  updaters.push((t) => { after.visible = t > T.passEnd - 0.3; });

  return {
    update(t) {
      for (const u of updaters) u(t);
    },
  };
}
