// Effects: the dirt thrown out of the pit onto the spoil pile, soil showering onto
// the shelter's roof when it is buried, dust when the steel door slams, and leaves
// shaken off the tree when the cloud rolls over it.
import * as THREE from 'three';

export function build(ctx) {
  const { scene, T, WD, MAT, G, U, instanced, beginInst, setInst, endInst } = ctx;
  const { clamp, lerp, smooth, prog, easeOutCubic } = U;
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
  const chunks = instanced(chunkGeo, dirtMat, 320);
  const puffGeo = G.lumpyBlob(1, 2, 0.22, 3);
  const puffs = instanced(puffGeo, softMat(new THREE.Color(0.48, 0.38, 0.27), 0.34, 'puffFx'), 200, false);
  const greyPuffs = instanced(puffGeo, softMat(new THREE.Color(0.62, 0.6, 0.56), 0.4, 'greyPuff'), 60, false);

  // -------------------------------------------------------------------------
  // the dig: each spadeful flies over the worker's shoulder onto the pile
  // -------------------------------------------------------------------------
  const DIGS = WD.DIG_T.map((s) => ({ s, parts: Array.from({ length: 7 }, () => ({ a: rnd(), b: rnd(), c: rnd(), d: rnd() })) }));
  const pile = new THREE.Mesh(G.lumpyBlob(1, 3, 0.16, 11), dirtMat);
  pile.castShadow = pile.receiveShadow = true;
  scene.add(pile);
  // the backfill: soil showers down onto the buried roof, front to back
  const FILL = Array.from({ length: 70 }, () => ({ x: lerp(WD.OUT.x0 + 0.1, WD.SHEET.shared - 0.1, rnd()), z: lerp(WD.OUT.zb + 0.1, -0.15, rnd()), t0: lerp(T.backfill0 - 0.1, T.backfill1 - 0.35, rnd()), a: rnd(), b: rnd() }));
  updaters.push((t) => {
    beginInst(chunks);
    beginInst(puffs);
    for (const dg of DIGS) {
      const dt = t - dg.s;
      if (dt < 0 || dt > 1.4) continue;
      const pit = WD.pit(dg.s);
      const x0 = WD.digX(dg.s) - 0.4, y0 = -pit.d + 1.35, z0 = -1.4;
      for (const q of dg.parts) {
        const x1 = WD.PILE.x + (q.b - 0.5) * 0.9, z1 = WD.PILE.z + (q.c - 0.5) * 0.8, y1 = 0.15 + 0.5 * WD.pileK(dg.s + 0.6);
        const T0 = 0.5 + 0.22 * q.d, hgt = 0.8 + 0.6 * q.a;
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
      const pu = (dt + 0.15) / 0.45;
      if (pu > 0 && pu < 1) {
        const ps = (0.06 + 0.14 * easeOutCubic(pu)) * (1 - smooth(clamp((pu - 0.45) / 0.55)));
        setInst(puffs, WD.digX(dg.s) - 0.5, -pit.d + 0.06, -1.15, ps, ps * 0.6, ps);
      }
    }
    // the backfill shower
    for (const f of FILL) {
      const dt = t - f.t0;
      if (dt < 0 || dt > 0.75) continue;
      const fall = clamp(dt / 0.45);
      const y = lerp(1.6 + 0.6 * f.a, 0.02, fall * fall);
      const sc = (0.045 + 0.05 * f.b) * (1 - smooth(clamp((dt - 0.45) / 0.3)));
      setInst(chunks, f.x, y, f.z, sc, sc * 0.8, sc, f.a * 9 + dt * 6, f.b * 9, 0);
      if (dt > 0.42 && f.a < 0.45) {
        const pu = (dt - 0.42) / 0.33;
        const ps = (0.07 + 0.18 * easeOutCubic(pu)) * (1 - smooth(clamp((pu - 0.4) / 0.6)));
        setInst(puffs, f.x, 0.06 + 0.1 * pu, f.z, ps, ps * 0.6, ps, 0, f.a * 6, 0);
      }
    }
    endInst(chunks);
    endInst(puffs);
    const k = WD.pileK(t);
    pile.visible = k > 0.01;
    pile.scale.set(0.3 + 1.1 * k, Math.max(0.01, 0.75 * k), 0.3 + 0.9 * k);
    pile.position.set(WD.PILE.x, -0.06, WD.PILE.z);
  });

  // -------------------------------------------------------------------------
  // dust when the heavy door lands on its seals
  // -------------------------------------------------------------------------
  const DUST = [{ t: T.doorShut, p: V((WD.HATCH.x0 + WD.HATCH.x1) / 2, WD.TOP + 0.05, -0.62), n: 16, r: 1.0, up: 0.16, wide: 1.5 }];
  DUST.forEach((e) => (e.parts = Array.from({ length: e.n }, () => ({ a: rnd() * 6.283, b: rnd(), c: rnd() }))));
  updaters.push((t) => {
    beginInst(greyPuffs);
    for (const e of DUST) {
      const dt = t - e.t;
      if (dt < 0 || dt > 1.6) continue;
      for (const q of e.parts) {
        const u = dt / 1.6;
        const r = e.r * (0.3 + 1.2 * easeOutCubic(u)) * (0.6 + 0.6 * q.b);
        const x = e.p.x + Math.cos(q.a) * r * e.wide, z = e.p.z + Math.sin(q.a) * r * 0.5, y = e.p.y + e.up * easeOutCubic(u) * (0.5 + q.c);
        const s = (0.08 + 0.22 * easeOutCubic(u)) * (1 - smooth(clamp((u - 0.4) / 0.6)));
        setInst(greyPuffs, x, y, z, s, s * 0.75, s, 0, q.a, 0);
      }
    }
    endInst(greyPuffs);
  });

  // -------------------------------------------------------------------------
  // leaves shaken off the tree as the cloud reaches it: they curl and tumble down
  // -------------------------------------------------------------------------
  const leafGeo = new THREE.PlaneGeometry(0.07, 0.11, 1, 2);
  {
    const p = leafGeo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, 0.012 * Math.cos((p.getY(i) / 0.055) * 1.4));
    leafGeo.computeVertexNormals();
  }
  const leafMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#8a8f2e'), roughness: 0.7, side: THREE.DoubleSide });
  const leaves = instanced(leafGeo, leafMat, 60, true);
  const LEAVES = Array.from({ length: 60 }, () => {
    const a = rnd() * 6.283, r = 0.6 + 1.6 * rnd();
    return { x: WD.TREE.x + Math.cos(a) * r, z: WD.TREE.z + Math.sin(a) * r * 0.8, y: 3.2 + 2.4 * rnd(), t0: T.curl + 0.2 + 2.6 * rnd(), a: rnd(), b: rnd(), c: rnd() };
  });
  updaters.push((t) => {
    beginInst(leaves);
    for (const l of LEAVES) {
      const dt = t - l.t0;
      if (dt < 0) continue;
      const fall = Math.min(l.y - 0.02, dt * (0.55 + 0.35 * l.a));
      const y = l.y - fall;
      const landed = y <= 0.03;
      const x = l.x + 0.25 * Math.sin(dt * (2 + l.b) + l.c * 6) + dt * 0.12;
      const z = l.z + 0.18 * Math.cos(dt * (1.7 + l.a) + l.b * 6);
      const tw = landed ? 0 : dt * (3 + 3 * l.c);
      setInst(leaves, x, Math.max(0.012, y), z, 1, 1, 1, landed ? -Math.PI / 2 : tw + l.a * 6, l.b * 6, landed ? 0 : tw * 0.7);
    }
    endInst(leaves);
  });

  return {
    update(t) {
      for (const u of updaters) u(t);
    },
  };
}
