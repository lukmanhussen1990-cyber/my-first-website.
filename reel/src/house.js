// John's two-story beige house with blue shutters, cut open like a dollhouse (ground floor living room visible).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { stucco, shingles, planks, wallpaper, noiseTex, knit, wood, tvPicture } from './textures.js';
import { prismGeo } from './world.js';
import { makeDad } from './characters.js';

export const HOUSE = { x0: 1.75, x1: 4.45, z0: -2.75, z1: 0.0, floor: 0.12, ceil: 1.55, slab: 0.12, up1: 2.95 };

function box(w, h, d, mat, x, y, z, r = 0) {
  const g = r > 0 ? new RoundedBoxGeometry(w, h, d, 3, r) : new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m;
}

export function makeHouse(uInterior) {
  const H = HOUSE;
  const g = new THREE.Group();
  const W = H.x1 - H.x0, D = H.z1 - H.z0, cx = (H.x0 + H.x1) / 2, cz = (H.z0 + H.z1) / 2;
  const st = stucco([232, 212, 172], 3);
  st.map.repeat.set(2, 2); st.normalMap.repeat.set(2, 2);
  const wallMat = new THREE.MeshStandardMaterial({ map: st.map, normalMap: st.normalMap, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.92 });
  const cutMat = new THREE.MeshStandardMaterial({ color: '#f3ead8', roughness: 0.95 });
  const trim = new THREE.MeshStandardMaterial({ color: '#fbf8f1', roughness: 0.55 });
  const wp = wallpaper(); wp.map.repeat.set(3, 1.6);
  const paper = new THREE.MeshStandardMaterial({ map: wp.map, roughness: 0.85 });
  const pl = planks(); pl.map.repeat.set(2, 2); pl.normalMap.repeat.set(2, 2);
  const floorMat = new THREE.MeshPhysicalMaterial({ map: pl.map, normalMap: pl.normalMap, normalScale: new THREE.Vector2(0.5, 0.5), roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.25 });
  const conc = noiseTex('concrete', [168, 164, 156], 12, 0.18, 2, 512);
  conc.map.repeat.set(2, 1);
  const concMat = new THREE.MeshStandardMaterial({ map: conc.map, normalMap: conc.normalMap, roughness: 0.95 });
  const shutterMat = new THREE.MeshPhysicalMaterial({ color: '#2f6fb6', roughness: 0.45, clearcoat: 0.4, clearcoatRoughness: 0.3 });

  // foundation (visible in the soil cut)
  g.add(box(W + 0.06, 0.68, D, concMat, cx, -0.22, cz));
  // ground floor slab
  g.add(box(W, 0.06, D, cutMat, cx, H.floor - 0.03, cz));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.2, D - 0.1), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.set(cx, H.floor + 0.002, cz + 0.05); floor.receiveShadow = true; g.add(floor);

  // walls: back, left, right (full height), with inner wallpaper on ground floor
  const fullH = H.up1 - H.floor;
  const back = box(W, fullH, 0.1, wallMat, cx, H.floor + fullH / 2, H.z0 + 0.05); g.add(back);
  // back window hole is faked by placing a window panel on top
  const left = box(0.1, fullH, D, wallMat, H.x0 + 0.05, H.floor + fullH / 2, cz); g.add(left);
  const right = box(0.1, fullH, D, wallMat, H.x1 - 0.05, H.floor + fullH / 2, cz); g.add(right);
  const gfH = H.ceil - H.floor;
  const pBack = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.2, gfH), paper); pBack.position.set(cx, H.floor + gfH / 2, H.z0 + 0.102); pBack.receiveShadow = true; g.add(pBack);
  const pL = new THREE.Mesh(new THREE.PlaneGeometry(D - 0.1, gfH), paper); pL.rotation.y = Math.PI / 2; pL.position.set(H.x0 + 0.102, H.floor + gfH / 2, cz + 0.05); pL.receiveShadow = true; g.add(pL);
  const pR = new THREE.Mesh(new THREE.PlaneGeometry(D - 0.1, gfH), paper); pR.rotation.y = -Math.PI / 2; pR.position.set(H.x1 - 0.102, H.floor + gfH / 2, cz + 0.05); pR.receiveShadow = true; g.add(pR);
  // baseboards
  g.add(box(W - 0.2, 0.06, 0.02, trim, cx, H.floor + 0.03, H.z0 + 0.11));
  g.add(box(0.02, 0.06, D - 0.1, trim, H.x0 + 0.11, H.floor + 0.03, cz + 0.05));
  g.add(box(0.02, 0.06, D - 0.1, trim, H.x1 - 0.11, H.floor + 0.03, cz + 0.05));
  // ceiling / upper slab with cut edge
  g.add(box(W, H.slab, D, cutMat, cx, H.ceil + H.slab / 2, cz));
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.2, D - 0.1), new THREE.MeshStandardMaterial({ color: '#f6f1e6', roughness: 0.9 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(cx, H.ceil - 0.002, cz + 0.05); g.add(ceil);
  // cut edges (lighter caps on the front faces)
  for (const x of [H.x0 + 0.05, H.x1 - 0.05]) { const c = new THREE.Mesh(new THREE.PlaneGeometry(0.1, gfH + H.slab), cutMat); c.position.set(x, H.floor + (gfH + H.slab) / 2, 0.001); g.add(c); }
  // upper floor front wall with windows + shutters
  const upH = H.up1 - (H.ceil + H.slab);
  const upY = H.ceil + H.slab + upH / 2;
  const front = box(W, upH, 0.1, wallMat, cx, upY, -0.05); g.add(front);
  // trim bands
  g.add(box(W + 0.04, 0.08, 0.14, trim, cx, H.ceil + H.slab, -0.05));
  g.add(box(W + 0.06, 0.06, 0.14, trim, cx, H.up1, -0.05));
  for (const x of [H.x0, H.x1]) g.add(box(0.08, fullH, 0.08, trim, x, H.floor + fullH / 2, H.z0 + 0.0));

  const windowGlass = [];
  const glassBase = new THREE.MeshPhysicalMaterial({ color: '#223044', roughness: 0.06, metalness: 0.0, clearcoat: 1, emissive: new THREE.Color('#ffc27a'), emissiveIntensity: 0 });
  function windowOn(parent, x, y, z, ry, w = 0.55, h = 0.62) {
    const grp = new THREE.Group(); grp.position.set(x, y, z); grp.rotation.y = ry; parent.add(grp);
    grp.add(box(w + 0.1, h + 0.1, 0.04, trim, 0, 0, 0.02));
    const gm = glassBase;
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), gm); gl.position.z = 0.045; grp.add(gl);
    grp.add(box(w, 0.035, 0.03, trim, 0, 0, 0.05)); grp.add(box(0.035, h, 0.03, trim, 0, 0, 0.05));
    grp.add(box(w + 0.16, 0.05, 0.08, trim, 0, -h / 2 - 0.06, 0.05));
    // louvered shutters
    for (const s of [-1, 1]) {
      const sh = new THREE.Group(); sh.position.set(s * (w / 2 + 0.17), 0, 0.03); grp.add(sh);
      sh.add(box(0.26, h + 0.08, 0.025, shutterMat, 0, 0, 0, 0.008));
      for (let i = 0; i < 9; i++) { const sl = box(0.2, 0.035, 0.02, shutterMat, 0, -h / 2 + 0.08 + i * (h - 0.08) / 8.5, 0.018); sl.rotation.x = -0.5; sh.add(sl); }
    }
    windowGlass.push(gm);
    return grp;
  }
  windowOn(g, cx - 0.75, upY + 0.05, 0.0, 0);
  windowOn(g, cx + 0.75, upY + 0.05, 0.0, 0);
  windowOn(g, H.x0, upY + 0.05, cz - 0.2, -Math.PI / 2);
  windowOn(g, H.x0, H.floor + 0.8, cz - 0.4, -Math.PI / 2);
  windowOn(g, H.x1, upY + 0.05, cz, Math.PI / 2);
  // back wall window inside living room (looks out to the night)
  const bw = new THREE.Group(); bw.position.set(cx + 0.15, H.floor + 0.85, H.z0 + 0.105); g.add(bw);
  bw.add(box(0.75, 0.6, 0.03, trim, 0, 0, 0));
  const outside = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb070') });
  const bwg = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.5), outside); bwg.position.z = 0.02; bw.add(bwg);
  bw.add(box(0.64, 0.025, 0.02, trim, 0, 0, 0.03));
  const curtainMat = new THREE.MeshStandardMaterial({ color: '#c9473a', roughness: 0.9, map: knit([255, 255, 255], 12).map });
  for (const s of [-1, 1]) {
    const cg = new THREE.CylinderGeometry(0.08, 0.1, 0.78, 16, 1, false); const c = new THREE.Mesh(cg, curtainMat); c.scale.z = 0.35; c.position.set(s * 0.43, -0.03, 0.04); c.castShadow = true; bw.add(c);
  }

  // roof
  const sh = shingles([86, 82, 92]);
  sh.map.repeat.set(3, 2); sh.normalMap.repeat.set(3, 2);
  const roofMat = new THREE.MeshStandardMaterial({ map: sh.map, normalMap: sh.normalMap, roughness: 0.8 });
  const roofH = 1.25;
  // gable end walls
  const gable = new THREE.Mesh(prismGeo(W, roofH, D), wallMat); gable.position.set(cx, H.up1, cz); g.add(gable);
  // two roof planes
  const slope = Math.atan2(roofH, D / 2 + 0.18);
  const len = Math.hypot(roofH, D / 2 + 0.18) + 0.05;
  for (const s of [-1, 1]) {
    const r = box(W + 0.3, 0.07, len, roofMat, cx, H.up1 + roofH / 2 + 0.02, cz + s * (D / 4 + 0.09));
    r.rotation.x = s * slope;
    g.add(r);
  }
  const ridge = box(W + 0.32, 0.08, 0.1, trim, cx, H.up1 + roofH + 0.04, cz); g.add(ridge);
  // chimney
  g.add(box(0.32, 0.9, 0.32, new THREE.MeshStandardMaterial({ color: '#8a5444', roughness: 0.9, map: noiseTex('brick', [160, 90, 70], 20, 0.25, 2).map }), H.x1 - 0.55, H.up1 + 1.0, cz - 0.55));

  // ---------- living room interior ----------
  const room = new THREE.Group(); g.add(room);
  const fl = H.floor;
  // rug
  const rugC = document.createElement('canvas'); rugC.width = rugC.height = 256; const rg = rugC.getContext('2d');
  rg.fillStyle = '#c8a46a'; rg.fillRect(0, 0, 256, 256); rg.strokeStyle = '#7a3b2e'; rg.lineWidth = 14; rg.strokeRect(14, 14, 228, 228);
  rg.strokeStyle = '#2f6fb6'; rg.lineWidth = 6; rg.strokeRect(36, 36, 184, 184); rg.fillStyle = '#7a3b2e'; rg.beginPath(); rg.arc(128, 128, 40, 0, 7); rg.fill();
  const rugT = new THREE.CanvasTexture(rugC); rugT.colorSpace = THREE.SRGBColorSpace;
  const rug = box(1.5, 0.015, 1.1, new THREE.MeshStandardMaterial({ map: rugT, roughness: 1 }), cx + 0.1, fl + 0.008, cz + 0.1, 0.006); rug.castShadow = false; room.add(rug);
  // sofa (angled toward TV and the camera)
  const sofaT = knit([96, 132, 168], 21);
  const sofaMat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: sofaT.map, normalMap: sofaT.normalMap, roughness: 0.92, sheen: 0.6, sheenColor: new THREE.Color('#c8d8ff'), sheenRoughness: 0.7 });
  const sofa = new THREE.Group(); sofa.position.set(cx + 0.55, fl, cz - 0.3); sofa.rotation.y = -0.85; room.add(sofa);
  sofa.add(box(1.25, 0.24, 0.6, sofaMat, 0, 0.18, 0, 0.07));
  sofa.add(box(1.25, 0.5, 0.18, sofaMat, 0, 0.45, -0.24, 0.08));
  for (const s of [-1, 1]) sofa.add(box(0.18, 0.36, 0.62, sofaMat, s * 0.62, 0.3, 0, 0.08));
  for (const s of [-1, 1]) sofa.add(box(0.5, 0.1, 0.48, sofaMat, s * 0.27, 0.35, 0.03, 0.05));
  const legMat = new THREE.MeshStandardMaterial({ color: '#4a3020', roughness: 0.5 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) sofa.add(box(0.05, 0.08, 0.05, legMat, sx * 0.55, 0.04, sz * 0.24));
  const pillow = box(0.26, 0.24, 0.1, new THREE.MeshStandardMaterial({ color: '#e8b04a', roughness: 0.9 }), 0.45, 0.5, -0.12, 0.05); pillow.rotation.z = 0.3; sofa.add(pillow);
  // Dad on the sofa
  const dad = makeDad();
  dad.root.position.set(-0.18, 0.43, 0.05); sofa.add(dad.root); dad.root.userData.noMerge = true;
  // TV on a cabinet, left side, angled out
  const tvGrp = new THREE.Group(); tvGrp.position.set(H.x0 + 0.45, fl, cz - 0.2); tvGrp.rotation.y = 0.95; room.add(tvGrp);
  const cab = wood(31, [120, 80, 52]);
  const cabMat = new THREE.MeshStandardMaterial({ map: cab.map, normalMap: cab.normalMap, roughness: 0.6 });
  tvGrp.add(box(0.8, 0.36, 0.34, cabMat, 0, 0.18, 0, 0.02));
  const tvBody = new THREE.MeshPhysicalMaterial({ color: '#141518', roughness: 0.3, clearcoat: 1 });
  tvGrp.add(box(0.86, 0.52, 0.05, tvBody, 0, 0.72, 0, 0.015));
  tvGrp.add(box(0.08, 0.12, 0.08, tvBody, 0, 0.42, 0));
  const tvScreenMat = new THREE.MeshPhysicalMaterial({ color: '#05070a', roughness: 0.08, clearcoat: 1, emissive: new THREE.Color('#ffffff'), emissiveMap: tvPicture(), emissiveIntensity: 0 });
  const tvScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.46), tvScreenMat); tvScreen.position.set(0, 0.72, 0.027); tvGrp.add(tvScreen);
  const tvLight = new THREE.PointLight(new THREE.Color('#9cc8ff'), 0, 3.5, 2); tvLight.position.set(0, 0.75, 0.45); tvGrp.add(tvLight);
  // plant
  const pot = box(0.2, 0.22, 0.2, new THREE.MeshStandardMaterial({ color: '#c46a3c', roughness: 0.8 }), H.x0 + 0.25, fl + 0.11, H.z0 + 0.35, 0.04); room.add(pot);
  const leafM = new THREE.MeshStandardMaterial({ color: '#3f8a3a', roughness: 0.7, side: THREE.DoubleSide });
  for (let i = 0; i < 9; i++) { const lf = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), leafM); lf.scale.set(0.35, 1.1, 0.12); lf.position.set(H.x0 + 0.25 + Math.cos(i * 0.7) * 0.06, fl + 0.4 + (i % 3) * 0.05, H.z0 + 0.35 + Math.sin(i * 0.7) * 0.06); lf.rotation.set(Math.cos(i) * 0.6, i * 0.7, Math.sin(i) * 0.6); lf.castShadow = true; room.add(lf); }
  // coffee table
  room.add(box(0.62, 0.04, 0.38, cabMat, cx - 0.05, fl + 0.28, cz + 0.35, 0.015));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) room.add(box(0.035, 0.27, 0.035, cabMat, cx - 0.05 + sx * 0.27, fl + 0.135, cz + 0.35 + sz * 0.15));
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.08, 16), new THREE.MeshStandardMaterial({ color: '#e9e4d8', roughness: 0.4 })); mug.position.set(cx + 0.1, fl + 0.34, cz + 0.32); room.add(mug);
  // floor lamp (back right)
  const lampMetal = new THREE.MeshStandardMaterial({ color: '#2b2b2e', roughness: 0.3, metalness: 0.9 });
  const flx = H.x1 - 0.3, flz = H.z0 + 0.32;
  room.add(box(0.22, 0.03, 0.22, lampMetal, flx, fl + 0.015, flz, 0.01));
  const fpole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.05, 8), lampMetal); fpole.position.set(flx, fl + 0.55, flz); room.add(fpole);
  const shadeMat = new THREE.MeshStandardMaterial({ color: '#f2e2c4', roughness: 0.8, emissive: new THREE.Color('#ffc078'), emissiveIntensity: 0, side: THREE.DoubleSide });
  const fshade = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.19, 0.24, 24, 1, true), shadeMat); fshade.position.set(flx, fl + 1.12, flz); room.add(fshade);
  const fLight = new THREE.PointLight(new THREE.Color('#ffb46a'), 0, 4.5, 2); fLight.position.set(flx, fl + 1.05, flz + 0.05); room.add(fLight);
  // side table + table lamp (left of sofa)
  const tlx = cx - 0.05, tlz = H.z0 + 0.35;
  room.add(box(0.3, 0.42, 0.3, cabMat, tlx, fl + 0.21, tlz, 0.02));
  const tbase = new THREE.Mesh(new THREE.SphereGeometry(0.08, 20, 14), new THREE.MeshPhysicalMaterial({ color: '#2f6fb6', roughness: 0.2, clearcoat: 1 })); tbase.position.set(tlx, fl + 0.5, tlz); tbase.scale.y = 1.2; room.add(tbase);
  const tshade = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 0.17, 24, 1, true), shadeMat); tshade.position.set(tlx, fl + 0.68, tlz); room.add(tshade);
  const tLight = { intensity: 0 }; // table lamp glows via its emissive shade only
  // ceiling bulb (hanging)
  const bx = cx + 0.05, bz = cz - 0.1;
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.28, 6), lampMetal); cord.position.set(bx, H.ceil - 0.14, bz); room.add(cord);
  const capM = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.05, 12), new THREE.MeshStandardMaterial({ color: '#b08a4a', metalness: 1, roughness: 0.3 })); capM.position.set(bx, H.ceil - 0.29, bz); room.add(capM);
  const bulbMat = new THREE.MeshStandardMaterial({ color: '#fff6e0', roughness: 0.1, emissive: new THREE.Color('#ffd79a'), emissiveIntensity: 0, transparent: true, opacity: 0.92 });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 20, 16), bulbMat); bulb.position.set(bx, H.ceil - 0.35, bz); bulb.scale.set(1, 1.2, 1); room.add(bulb);
  const filament = new THREE.Mesh(new THREE.TorusGeometry(0.015, 0.003, 6, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.1, 0.06, 0.02) })); filament.position.copy(bulb.position); room.add(filament);
  const bLight = new THREE.PointLight(new THREE.Color('#ffc98a'), 0, 5, 2); bLight.position.set(bx, H.ceil - 0.42, bz); room.add(bLight);
  // picture frames on back wall
  const artCols = [['#e8b04a', '#2f6fb6'], ['#3f8a3a', '#e85a4a']];
  artCols.forEach(([a, b], i) => {
    const x = cx - 0.95 + i * 0.32 + (i ? 0.1 : 0);
    room.add(box(0.26, 0.2, 0.025, legMat, x, fl + 1.05 + i * 0.08, H.z0 + 0.115));
    const c = document.createElement('canvas'); c.width = 64; c.height = 48; const gg = c.getContext('2d'); gg.fillStyle = a; gg.fillRect(0, 0, 64, 48); gg.fillStyle = b; gg.beginPath(); gg.arc(32, 30, 14, 0, 7); gg.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.15), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 })); p.position.set(x, fl + 1.05 + i * 0.08, H.z0 + 0.13); room.add(p);
  });
  // electrical panel near the front of the left wall + conduit
  const panelMat = new THREE.MeshStandardMaterial({ color: '#9aa3ad', roughness: 0.4, metalness: 0.6 });
  room.add(box(0.06, 0.26, 0.2, panelMat, H.x0 + 0.13, fl + 0.62, -0.32, 0.01));
  const ledMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.05, 0.02) });
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), ledMat); led.position.set(H.x0 + 0.165, fl + 0.7, -0.32); room.add(led);

  // interior dimmer: rooms read dark when the power is off
  const dimmed = new Set([paper, floorMat, ceil.material]);
  room.traverse((o) => { if (o.isMesh && o.material && o.material !== shadeMat && o.material !== bulbMat && o.material !== tvScreenMat && !o.material.isMeshBasicMaterial) dimmed.add(o.material); });
  for (const m of dimmed) {
    const prev = m.onBeforeCompile;
    m.onBeforeCompile = (sh, r) => {
      if (prev) prev(sh, r);
      sh.uniforms.uInterior = uInterior;
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uInterior;').replace('#include <opaque_fragment>', 'outgoingLight *= uInterior;\n#include <opaque_fragment>');
    };
    m.customProgramCacheKey = () => 'interior';
  }
  return {
    group: g, dad, tvScreenMat, tvLight, tvGrp, shadeMat, bulbMat, lights: { fLight, tLight, bLight }, windowGlass, ledMat, backWindow: outside, sofa,
    panelPos: new THREE.Vector3(H.x0 + 0.13, fl + 0.5, -0.32),
  };
}
