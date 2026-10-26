// Character sheet: the paper-cut cast of SEVEN THINGS lined up on a warm studio backdrop (one still).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AbsoluteFill, delayRender, continueRender } from 'remotion';
import { ThreeCanvas } from '@remotion/three';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Person, Poses, expr, SKIN, HAIR, CLOTH } from './three/rig.js';
import { fontsReady, SANS, SERIF } from './lib/fonts.js';

const CAST = [
  ['Proud man', { seed: 31, height: 1.84, build: 1.14, skin: SKIN[4], hair: 'turban', wrap: '#efe0bc', beard: 'short', outfit: 'robe', cloth: CLOTH.purple, trim: CLOTH.gold, belt: CLOTH.gold, sleeve: '#4a2058' }, 'proud'],
  ['Beggar', { seed: 32, height: 1.68, skin: SKIN[2], hair: 'wrap', wrap: '#8f7d62', beard: 'long', beardColor: HAIR.grey, age: 'old', outfit: 'robe', cloth: CLOTH.rag, belt: null, prop: 'bowl' }, 'sad'],
  ['Seller', { seed: 41, height: 1.78, skin: SKIN[4], hair: 'short', beard: 'short', outfit: 'tunic', cloth: CLOTH.teal, trim: CLOTH.ochre, legs: '#5a4636', prop: 'fruitGood' }, 'happy'],
  ['Buyer', { seed: 42, height: 1.66, skin: SKIN[5], hair: 'veil', wrap: '#b46a5c', outfit: 'robe', cloth: CLOTH.olive, trim: '#d9b26a' }, 'neutral'],
  ['Brother A', { seed: 51, height: 1.78, skin: SKIN[3], hair: 'curly', hairColor: HAIR.dark, beard: 'short', outfit: 'tunic', cloth: CLOTH.brick, belt: '#c9a36a', legs: SKIN[3] }, 'sad'],
  ['Brother B', { seed: 52, height: 1.72, skin: SKIN[4], hair: 'short', hairColor: HAIR.brown, outfit: 'tunic', cloth: CLOTH.cream, trim: CLOTH.sky, legs: SKIN[4] }, 'neutral'],
  ['Man on the bench', { seed: 61, height: 1.76, skin: SKIN[3], hair: 'short', beard: 'short', outfit: 'tunic', cloth: CLOTH.slate, legs: '#5a5048' }, 'neutral'],
  ['Runner', { seed: 71, height: 1.78, skin: SKIN[3], hair: 'wrap', wrap: '#c9a36a', wrapTail: true, beard: 'short', outfit: 'tunic', cloth: CLOTH.ochre, belt: '#6a4a2a', legs: SKIN[3] }, 'angry'],
  ['Accuser', { seed: 91, height: 1.8, skin: SKIN[3], hair: 'turban', wrap: '#5a3a3a', beard: 'short', outfit: 'robe', cloth: CLOTH.wine, trim: '#b0883a', belt: '#3a2a20' }, 'sly'],
  ['Naboth', { seed: 92, height: 1.76, skin: SKIN[4], hair: 'short', hairColor: HAIR.brown, beard: 'short', beardColor: HAIR.brown, outfit: 'tunic', cloth: CLOTH.cream, trim: CLOTH.olive, legs: SKIN[4] }, 'hurt'],
  ['Elder', { seed: 94, height: 1.7, skin: SKIN[3], hair: 'turban', wrap: '#e0d8c8', beard: 'long', beardColor: HAIR.white, age: 'old', outfit: 'robe', cloth: CLOTH.brown }, 'neutral'],
  ['The whisperer', { seed: 120, height: 1.78, skin: SKIN[4], hair: 'wrap', wrap: '#3a3440', wrapTail: true, beard: 'short', outfit: 'robe', cloth: '#2f3346', trim: '#6a5a7a' }, 'sly'],
];

const Lineup = () => {
  const { gl, advance } = useThree();
  const scene = useMemo(() => {
    const s = new THREE.Scene(); s.background = new THREE.Color('#2a1d14');
    const cols = 6;
    CAST.forEach(([name, o, mood], i) => {
      const p = new Person(o); const P = expr(Poses.idle(1.3, o.seed), mood, 1); P.eye = 1; p.setFacing(1); p.pose(P);
      p.root.position.set((i % cols - (cols - 1) / 2) * 1.2, i < cols ? 0.5 : -2.1, 0); p.lineMat.userData.uOutline.value = 0.014; p.blob.visible = false;
      s.add(p.root);
    });
    return s;
  }, []);
  const cam = useMemo(() => { const c = new THREE.OrthographicCamera(-3.6, 3.6, 2.7, -2.7, 0.1, 50); c.position.set(0, 0, 10); c.lookAt(0, 0, 0); return c; }, []);
  useFrame(() => { gl.setRenderTarget(null); gl.render(scene, cam); }, 1);
  useEffect(() => { advance(performance.now()); }, [advance]);
  return null;
};

export const CastSheet = () => {
  const [h] = useState(() => delayRender('cast fonts', { timeoutInMilliseconds: 240000 }));
  useEffect(() => { fontsReady().then(() => continueRender(h)); }, [h]);
  const cols = 6;
  return (
    <AbsoluteFill style={{ background: '#2a1d14' }}>
      <ThreeCanvas width={1920} height={1440} dpr={1} flat gl={{ antialias: true, preserveDrawingBuffer: true }}>
        <Lineup />
      </ThreeCanvas>
      <div style={{ position: 'absolute', top: 28, left: 0, right: 0, textAlign: 'center', font: `700 46px ${SERIF}`, letterSpacing: '0.12em', color: '#f4e2bf' }}>SEVEN THINGS · CAST</div>
      {CAST.map(([name], i) => (
        <div key={i} style={{ position: 'absolute', left: 960 + (i % cols - (cols - 1) / 2) * 320 - 150, width: 300, top: i < cols ? 600 : 1293, textAlign: 'center', font: `600 22px ${SANS}`, letterSpacing: '0.08em', color: '#f0bf5a' }}>{name.toUpperCase()}</div>
      ))}
    </AbsoluteFill>
  );
};
