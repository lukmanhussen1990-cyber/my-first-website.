// Character sheet — v2 BASELINE (temporary; replaced by the v3 sheet).
import React, { useMemo } from 'react';
import { AbsoluteFill } from 'remotion';
import { ThreeCanvas } from '@remotion/three';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Person, Poses, expr, SKIN, HAIR, CLOTH } from './three/rig.js';
import { U } from './three/materials.js';

const LOOKS = [
  ['Methuselah old', { seed: 1, height: 1.62, skin: SKIN[4], hair: 'long', hairColor: HAIR.white, beard: 'long', beardColor: HAIR.white, age: 'old', outfit: 'robe', cloth: '#6f7f8c', belt: '#8a6a46', prop: 'staff' }, (t) => { const P = Poses.idle(t, 1); P.lean = 0.25; return P; }],
  ['Methuselah young', { seed: 2, height: 1.78, skin: SKIN[4], hair: 'long', hairColor: HAIR.dark, beard: 'short', beardColor: HAIR.dark, outfit: 'robe', cloth: CLOTH.slate, belt: '#c9a36a' }, (t) => Poses.hold(t, 2)],
  ['Enoch', { seed: 3, height: 1.76, skin: SKIN[3], hair: 'short', hairColor: HAIR.grey, beard: 'short', beardColor: HAIR.grey, outfit: 'robe', cloth: CLOTH.cream, belt: CLOTH.gold }, (t) => Poses.walk(t, 3)],
  ['Lamech', { seed: 4, height: 1.84, build: 1.15, skin: SKIN[2], hair: 'curly', hairColor: HAIR.black, beard: 'short', beardColor: HAIR.black, outfit: 'tunic', cloth: CLOTH.brick, belt: '#d7b484' }, (t) => Poses.hold(t, 4)],
  ['Noah old', { seed: 5, height: 1.8, build: 1.1, skin: SKIN[3], hair: 'wrap', wrap: CLOTH.sand, beard: 'long', beardColor: HAIR.white, age: 'old', outfit: 'tunic', cloth: CLOTH.olive, belt: '#6a4a2a' }, (t) => Poses.idle(t, 5)],
  ['Noah young', { seed: 6, height: 1.78, skin: SKIN[3], hair: 'short', hairColor: HAIR.dark, beard: 'short', outfit: 'tunic', cloth: CLOTH.teal }, (t) => Poses.idle(t, 6)],
  ['Adam', { seed: 7, height: 1.8, skin: SKIN[2], hair: 'curly', hairColor: HAIR.brown, beard: 'long', beardColor: HAIR.grey, outfit: 'robe', cloth: CLOTH.ochre }, (t) => Poses.idle(t, 7)],
  ['Crowd', { seed: 8, height: 1.7, skin: SKIN[5], hair: 'turban', wrap: CLOTH.rust, beard: 'short', outfit: 'tunic', cloth: CLOTH.indigo }, (t) => Poses.shout(t, 8)],
];

const Sheet = () => {
  const { gl } = useThree();
  const S = useMemo(() => {
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#d9c49c');
    const cam = new THREE.PerspectiveCamera(20, 1920 / 1440, 0.1, 200);
    cam.position.set(-2.6, 1.0, 21); cam.lookAt(-2.6, 1.0, 0);
    const cam2 = new THREE.PerspectiveCamera(20, 0.75, 0.1, 200); cam2.position.set(-8.05, 1.62, 1.6); cam2.lookAt(-8.05, 1.62, 0);
    const people = LOOKS.map(([name, o, pose], i) => {
      const p = new Person(o); p.root.position.set(-8.2 + i * 1.15, 0, 0); scene.add(p.root); p.poseFn = pose; return p;
    });
    return { scene, cam, cam2, people };
  }, []);
  useFrame(() => {
    U.uCharLight.value.set('#ffffff');
    for (const p of S.people) { p.setFacing(1); p.pose(p.poseFn(1.0)); p.billboard(S.cam, 0); p.autoOutline(S.cam, 1440); }
    gl.setScissorTest(true); gl.setViewport(0, 0, 1920, 1440); gl.setScissor(0, 0, 1920, 1440); gl.render(S.scene, S.cam);
    gl.setViewport(1380, 400, 540, 720); gl.setScissor(1380, 400, 540, 720); gl.render(S.scene, S.cam2); gl.setScissorTest(false);
  }, 1);
  return null;
};

export const CastSheet = () => (
  <AbsoluteFill style={{ background: '#2a1d14' }}>
    <ThreeCanvas width={1920} height={1440} gl={{ antialias: true, preserveDrawingBuffer: true }}>
      <Sheet />
    </ThreeCanvas>
    <div style={{ position: 'absolute', left: 40, top: 30, color: '#2a1d14', font: '600 40px Inter' }}>CAST v2 baseline</div>
  </AbsoluteFill>
);
