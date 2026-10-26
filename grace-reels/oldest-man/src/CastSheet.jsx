// Character sheet (rig v3): every character in side / three-quarter / back view, the crowd, and a large
// close-up of old Methuselah's head. Also <CastCloseup> (1080×1920): the S2-style lamp-lit face close-up
// used by the character quality loop (quality/compare_1*.png).
import React, { useMemo } from 'react';
import { AbsoluteFill } from 'remotion';
import { ThreeCanvas } from '@remotion/three';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Person, Poses, expr } from './three/rig.js';
import { U } from './three/materials.js';
import { STATS as ATLAS_STATS } from './three/characters/atlas.js';
import * as CAST from './three/characters/cast.js';

const W = 2560, H = 1920;
const VIEWS = ['side', 'threeQuarter', 'back'];
const T = 1.3; // sheet time (s)

// [label, preset, side pose, 3/4 pose, extra]
const ROWS = [
  [
    ['METHUSELAH · old', CAST.METHUSELAH_OLD, (t, s) => Poses.oldWalk(t, s), (t, s) => expr(Poses.sitOld(t, s, 0.0, 0.2), 'kind', 0.6)],
    ['METHUSELAH · young', CAST.METHUSELAH_YOUNG, (t, s) => Poses.holdBaby(t, s), (t, s) => expr(Poses.idle(t, s), 'wonder', 0.7), { baby: CAST.BABY_LAMECH }],
    ['ENOCH', CAST.ENOCH, (t, s) => Poses.walk(t, s, 0.8), (t, s) => expr(Poses.idle(t, s), 'peace', 1)],
  ],
  [
    ['LAMECH', CAST.LAMECH, (t, s) => Poses.holdBaby(t, s), (t, s) => expr(Poses.idle(t, s), 'happy', 1), { baby: CAST.BABY_NOAH }],
    ['NOAH · young', CAST.NOAH_YOUNG, (t, s) => Poses.walk(t, s, 1), (t, s) => expr(Poses.lookUp(t, s, 0.8), 'wonder', 0.8)],
    ['NOAH · 600', CAST.NOAH_OLD, (t, s) => Poses.hammer(t, s, 1.0), (t, s) => expr(Poses.idle(t, s), 'worry', 1)],
  ],
  [
    ['ADAM', CAST.ADAM, (t, s) => Poses.idle(t, s), (t, s) => expr(Poses.idle(t, s), 'sadness', 1)],
    ['CITY PERSON', CAST.CITY_PERSON, (t, s) => Poses.walk(t, s, 0.9), (t, s) => expr(Poses.lookUp(t, s, 1), 'wonder', 1)],
    ['CITY · coat', CAST.CITY_PERSON_COAT, (t, s) => Poses.idle(t, s), (t, s) => expr(Poses.idle(t, s), 'worry', 0.8)],
  ],
];
const CROWD_POSES = [(t, s) => Poses.pointLaugh(t, s), (t, s) => Poses.shout(t, s), (t, s) => Poses.pointLaugh(t + 0.3, s), (t, s) => expr(Poses.idle(t, s), 'sly', 1)];

// ---------------------------------------------------------------- scene build (no GL needed; atlases are canvases)
function buildSheet() {
  const t0 = performance.now();
  const a0 = { ...ATLAS_STATS };
  const scene = new THREE.Scene();
  const items = [];
  const colW = 0.98, groupGap = 0.55, rowH = 2.75;
  ROWS.forEach((row, ri) => {
    row.forEach(([label, preset, pSide, p3q, extra = {}], gi) => {
      VIEWS.forEach((v, vi) => {
        const p = new Person({ ...preset, view: v });
        p.root.position.set(gi * (3 * colW + groupGap) + vi * colW, -ri * rowH, 0); scene.add(p.root);
        const fn = vi === 0 ? pSide : vi === 1 ? p3q : (t, s) => Poses.idle(t, s);
        if (extra.baby && vi === 0) p.hold(new Person(extra.baby));
        items.push({ p, fn, label: vi === 0 ? label : null, view: v });
      });
    });
  });
  const cy = -3 * rowH;
  CAST.CROWD.forEach((o, i) => {
    const p = new Person({ ...o, view: i % 5 === 3 ? 'threeQuarter' : 'side' });
    p.root.position.set(i * 0.66, cy, 0); scene.add(p.root);
    items.push({ p, fn: CROWD_POSES[i % CROWD_POSES.length], facing: i % 2 ? -1 : 1 });
  });
  [CAST.BABY_LAMECH, CAST.BABY_NOAH].forEach((o, i) => {
    const p = new Person(o); p.root.position.set(12 * 0.66 + 0.4 + i * 0.75, cy, 0); scene.add(p.root);
    items.push({ p, fn: (t, s) => Poses.baby(t, s, i === 1), baby: true });
  });
  const hero = new Person({ ...CAST.METHUSELAH_OLD, view: 'side' });
  hero.root.position.set(60, 0, 0); scene.add(hero.root);
  items.push({ p: hero, fn: (t, s) => expr(Poses.sitOld(t, s, 0.0, 0.25), 'kind', 0.7), hero: true });
  const buildMs = performance.now() - t0;
  // ---- cameras
  const vw = 1840, vh = H - 140;
  const left = -0.7, right = 3 * (3 * colW + groupGap) - groupGap + 0.2, top = 2.3, bottom = cy - 0.25;
  const sc = Math.max((right - left) / vw, (top - bottom) / vh);
  const cx = (left + right) / 2, cyy = (top + bottom) / 2;
  const camMain = new THREE.OrthographicCamera(-vw * sc / 2, vw * sc / 2, vh * sc / 2, -vh * sc / 2, 0.1, 200);
  camMain.position.set(cx, cyy, 50); camMain.lookAt(cx, cyy, 0); camMain.updateProjectionMatrix(); camMain.updateMatrixWorld();
  const camHero = new THREE.PerspectiveCamera(22, 680 / 900, 0.1, 100);
  const pose = (t) => {
    for (const it of items) {
      const { p } = it;
      if (it.facing) p.setFacing(it.facing);
      if (it.baby) { p.pose(it.fn(t, p.seed)); continue; }
      p.act((tt) => it.fn(tt, p.seed), t, { wind: 0.5 });
    }
  };
  const S = { scene, items, camMain, camHero, hero, pose, vw, vh };
  // ---- per-frame cost (pose + springs + billboard + outline for every figure), averaged over 30 frames
  const t1 = performance.now();
  for (let f = 0; f < 30; f++) { pose(f / 30); place(S); }
  const frameMs = (performance.now() - t1) / 30;
  S.stats = { buildMs, frameMs, persons: items.length + 2, atlases: ATLAS_STATS.atlases - a0.atlases, atlasMs: ATLAS_STATS.ms - a0.ms, mpx: (ATLAS_STATS.texels - a0.texels) / 1e6, heroAtlas: hero.atlas.W };
  console.log('[cast] stats', JSON.stringify(S.stats));
  return S;
}
function place(S) {
  const hp = S.hero.jointWorld('head', new THREE.Vector3());
  S.camHero.position.set(hp.x + 0.07, hp.y + 0.12, hp.z + 1.3); S.camHero.lookAt(hp.x + 0.07, hp.y + 0.05, hp.z); S.camHero.updateMatrixWorld();
  for (const it of S.items) { const c = it.hero ? S.camHero : S.camMain; it.p.billboard(c, 0); it.p.autoOutline(c, it.hero ? 900 : S.vh); }
}

let SHEET = null;
const Sheet = ({ S }) => {
  const { gl } = useThree();
  useFrame(() => {
    gl.autoClear = false;
    U.uCharLight.value.set('#ffffff'); U.uSunDir.value.set(-0.62, 0.62, 0.48).normalize(); U.uSunColor.value.setRGB(1, 0.92, 0.78);
    U.uPointColor.value.setRGB(0, 0, 0); U.uPointPos.value.set(0, -999, 0); U.uAO.value = 0.12; U.uGroundY.value = -999;
    S.pose(T); place(S);
    gl.setClearColor('#dcc9a3', 1); gl.clear();
    gl.setScissorTest(true);
    gl.setViewport(20, 20, S.vw, S.vh); gl.setScissor(20, 20, S.vw, S.vh); gl.render(S.scene, S.camMain);
    gl.setViewport(1860, 520, 680, 900); gl.setScissor(1860, 520, 680, 900);
    gl.setClearColor('#2b2f3d', 1); gl.clear();
    gl.render(S.scene, S.camHero);
    gl.setScissorTest(false);
  }, 1);
  return null;
};

const label = (txt, x, y, size = 22, col = '#3a2a1c') => <div style={{ position: 'absolute', left: x, top: y, color: col, font: `600 ${size}px Inter, sans-serif`, letterSpacing: '0.06em' }}>{txt}</div>;

export const CastSheet = () => {
  const S = useMemo(() => (SHEET ||= buildSheet()), []);
  const st = S.stats;
  return (
    <AbsoluteFill style={{ background: '#dcc9a3' }}>
      <ThreeCanvas width={W} height={H} gl={{ antialias: true, preserveDrawingBuffer: true }}>
        <Sheet S={S} />
      </ThreeCanvas>
      {label('CAST · rig v3 — SVG parts → atlas, cel-shaded, 5 px outline', 40, 26, 30, '#2a1d14')}
      {label(`${st.persons} figures · build ${(st.buildMs / 1000).toFixed(2)} s (${st.atlases} atlases, ${st.mpx.toFixed(0)} Mpx, ${(st.atlasMs / 1000).toFixed(2)} s) · per frame ${st.frameMs.toFixed(2)} ms for all figures`, 40, 68, 18)}
      {label('METHUSELAH · close-up (hero atlas ' + st.heroAtlas + '²)', 1866, 486, 18)}
    </AbsoluteFill>
  );
};
