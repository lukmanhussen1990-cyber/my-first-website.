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
import './three/poses3.js';

const W = 2560, H = 1920;
const VIEWS = ['side', 'threeQuarter', 'back'];
const T = 1.3; // sheet time (s)

// [label, preset, side pose, 3/4 pose, extra]
const ROWS = [
  [
    ['JESUS', CAST.JESUS, (t, s) => Poses.bound(t, s, 0.3), (t, s) => Poses.bound(t, s, 0.8)],
    ['BARABBAS', CAST.BARABBAS, (t, s) => Poses.shackled(t, s, 1), (t, s) => Poses.shackled(t, s, 0.8)],
    ['PILATE', CAST.PILATE, (t, s) => Poses.present(t, s, 1), (t, s) => expr(Poses.idle(t, s), 'worry', 0.8)],
  ],
  [
    ['CHIEF PRIEST', CAST.PRIESTS[0], (t, s) => Poses.whisper(t, s, 1), (t, s) => expr(Poses.idle(t, s), 'sly', 0.6)],
    ['CHIEF PRIEST', CAST.PRIESTS[2], (t, s) => Poses.whisper(t, s, 1), (t, s) => expr(Poses.idle(t, s), 'proud', 0.6)],
    ['ROMAN SOLDIER', CAST.soldier(0), (t, s) => Poses.idle(t, s), (t, s) => expr(Poses.idle(t, s), 'focus', 0.6)],
  ],
  [
    ['BLIND MAN', CAST.BLIND_MAN, (t, s) => expr(Poses.idle(t, s), 'wonder', 1), (t, s) => Poses.lookUp(t, s, 0.8)],
    ['LAZARUS', CAST.LAZARUS, (t, s) => Poses.walk(t, s, 0.6), (t, s) => expr(Poses.idle(t, s), 'peace', 1)],
    ['MODERN PERSON', CAST.CITY_PERSON, (t, s) => expr(Poses.idle(t, s), 'sadness', 1), (t, s) => Poses.lookUp(t, s, 1)],
  ],
];
const CROWD_POSES = [(t, s) => Poses.chant(t, s, 0.5), (t, s) => Poses.chant(t, s, 1), (t, s) => Poses.chant(t + 0.3, s, 0.7), (t, s) => Poses.chant(t, s, 0)];

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
        items.push({ p, fn, label: vi === 0 ? label : null, view: v, lx: gi * (3 * colW + groupGap) + colW, ly: -ri * rowH });
      });
    });
  });
  const cy = -3 * rowH;
  [...CAST.JERUSALEM_CROWD, CAST.CHILD].forEach((o, i) => {
    const p = new Person({ ...o, view: i % 5 === 3 ? 'threeQuarter' : 'side' });
    p.root.position.set(i * 0.5, cy, 0); scene.add(p.root);
    items.push({ p, fn: CROWD_POSES[i % CROWD_POSES.length], facing: i % 2 ? -1 : 1 });
  });
  const hero = new Person({ ...CAST.JESUS, view: 'threeQuarter' });
  hero.root.position.set(60, 0, 0); scene.add(hero.root);
  items.push({ p: hero, fn: (t, s) => Poses.bound(t, s, 0.7), hero: true });
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
  // HTML label positions (ortho projection of world points into the 20 px-inset main viewport)
  const toPx = (x, y) => [20 + (x - camMain.position.x - camMain.left) / sc, H - 20 - (y - camMain.position.y - camMain.bottom) / sc];
  S.labels = items.filter((it) => it.label).map((it) => { const [x, y] = toPx(it.lx, it.ly - 0.12); return { txt: it.label, x, y }; });
  S.crowdLabel = toPx(-0.3, cy - 0.12);
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
  S.camHero.position.set(hp.x + 0.02, hp.y + 0.05, hp.z + 2.3); S.camHero.lookAt(hp.x + 0.02, hp.y - 0.08, hp.z); S.camHero.updateMatrixWorld();
  for (const it of S.items) { const c = it.hero ? S.camHero : S.camMain; it.p.billboard(c, 0); it.p.autoOutline(c, it.hero ? 900 : S.vh); }
}

let SHEET = null;
const Sheet = ({ S }) => {
  const { gl } = useThree();
  useFrame(() => {
    gl.autoClear = false;
    U.uCharLight.value.set('#ffffff'); U.uSunDir.value.set(-0.72, 0.6, -0.3).normalize(); U.uSunColor.value.setRGB(1, 0.92, 0.78);
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
      {label('JESUS · close-up (hero atlas ' + st.heroAtlas + '²)', 1866, 486, 18)}
      {S.labels.map((l, i) => <div key={i} style={{ position: 'absolute', left: l.x - 240, width: 480, top: l.y, textAlign: 'center', color: '#3a2a1c', font: '700 20px Inter, sans-serif', letterSpacing: '0.1em' }}>{l.txt}<div style={{ font: '500 14px Inter, sans-serif', letterSpacing: '0.2em', opacity: 0.7 }}>SIDE · ¾ · BACK</div></div>)}
      {label('JERUSALEM CROWD · 16 variants (crowd atlases) + CHILD — the 200+ crowd is instanced from these', S.crowdLabel[0], S.crowdLabel[1], 18)}
    </AbsoluteFill>
  );
};

// ================================================================ S2-style close-up (quality loop)
// Methuselah's head and shoulders, night, lit warmly by an oil lamp from one side (lamp light = U.uPointPos).
// props: view ('threeQuarter' | 'side'), t (seconds), lamp (0..1 strength)
const CW = 1080, CH = 1920;
function buildCloseup(view) {
  const scene = new THREE.Scene();
  // night backdrop: vertical gradient + faint distant ridge + a few stars
  const bg = document.createElement('canvas'); bg.width = 64; bg.height = 512;
  const g = bg.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, '#0b1124'); gr.addColorStop(0.55, '#1b2846'); gr.addColorStop(0.8, '#2a2f45'); gr.addColorStop(1, '#1a1a24');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 512);
  const bgTex = new THREE.CanvasTexture(bg); bgTex.colorSpace = THREE.SRGBColorSpace;
  const back = new THREE.Mesh(new THREE.PlaneGeometry(16, 20), new THREE.MeshBasicMaterial({ map: bgTex, depthWrite: false }));
  back.position.set(0, 1.0, -6); scene.add(back);
  const ridge = new THREE.Mesh(new THREE.PlaneGeometry(16, 3), new THREE.MeshBasicMaterial({ color: '#141a2a' }));
  ridge.position.set(0, -1.6, -5.5); ridge.rotation.z = 0.04; scene.add(ridge);
  const p = new Person({ ...CAST.METHUSELAH_OLD, view });
  scene.add(p.root);
  // lamp: warm glow sprite low in front of him (out of frame bottom-right, its light on the face)
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const r = x.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,220,160,1)'); r.addColorStop(0.25, 'rgba(255,160,80,0.45)'); r.addColorStop(1, 'rgba(255,120,40,0)'); x.fillStyle = r; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); return t; })();
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(glow);
  const cam = new THREE.PerspectiveCamera(24, CW / CH, 0.1, 50);
  return { scene, p, cam, glow, view };
}
const Closeup = ({ C, t, lamp }) => {
  const { gl } = useThree();
  useFrame(() => {
    const { p, cam, glow } = C;
    const poseFn = (tt) => Poses.sitOld(tt, p.seed, 0.42, 0.45);
    p.act(poseFn, t, { wind: 0.7 });
    p.root.updateMatrixWorld(true);
    const hp = p.jointWorld('head', new THREE.Vector3());
    const face = hp.clone().add(new THREE.Vector3(C.view === 'side' ? 0.05 : 0.02, 0.17, 0));
    // head (≈0.4 m incl. hair) ≈ 55 % of the frame width: visible width ≈ 0.68 m; camera ~8° above eye level
    const dist = 0.3 / Math.tan(THREE.MathUtils.degToRad(24) / 2 * (CW / CH) * 1.02);
    cam.position.set(face.x, face.y + 0.06 + dist * 0.14, face.z + dist); cam.lookAt(face.x, face.y - 0.2, face.z); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    p.billboard(cam, 0.15); p.autoOutline(cam, CH);
    // lamp in front-right, a little below the face; flicker ±8 % at ~7 Hz (seeded noise, pure)
    const lampPos = new THREE.Vector3(face.x + 0.62, face.y - 0.42, 0.12);
    const fl = 1 + 0.08 * Math.sin(t * 2 * Math.PI * 7.1) * Math.sin(t * 2 * Math.PI * 1.3 + 1);
    U.uCharLight.value.setRGB(0.3, 0.34, 0.5); U.uAO.value = 0.0; U.uGroundY.value = -999;
    U.uSunDir.value.set(-0.55, 0.45, -0.7).normalize(); U.uSunColor.value.setRGB(0.45, 0.55, 0.85);
    U.uPointPos.value.copy(lampPos); U.uPointColor.value.setRGB(1.2 * fl * lamp, 0.78 * fl * lamp, 0.42 * fl * lamp); U.uPointRange.value = 2.6;
    glow.position.copy(lampPos).add(new THREE.Vector3(0.05, -0.05, 0.3)); glow.lookAt(cam.position); glow.material.opacity = 0.9 * lamp;
    gl.setClearColor('#0b1124', 1); gl.render(C.scene, cam);
  }, 1);
  return null;
};
const CLOSE = {};
export const CastCloseup = ({ view = 'threeQuarter', t = 1.0, lamp = 1 }) => {
  const C = useMemo(() => (CLOSE[view] ||= buildCloseup(view)), [view]);
  return (
    <AbsoluteFill style={{ background: '#0b1124' }}>
      <ThreeCanvas width={CW} height={CH} gl={{ antialias: true, preserveDrawingBuffer: true }}>
        <Closeup C={C} t={t} lamp={lamp} />
      </ThreeCanvas>
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 75% 60% at 55% 45%, rgba(0,0,0,0) 55%, rgba(5,8,18,0.55) 100%)' }} />
    </AbsoluteFill>
  );
};
