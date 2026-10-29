import {useLayoutEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';
import {faceted, flatMat, leafGeometry, taperTube} from '../three/lowpoly';
import {noise1, rand} from '../lib/random';
import {lerp} from '../lib/anim';

export type Arm = {sx?: number; sz?: number; elbow?: number; twist?: number};
export type Leg = {hx?: number; knee?: number; hz?: number};
export type Pose = {
  y?: number; lean?: number; twist?: number; side?: number;
  head?: {pitch?: number; yaw?: number; roll?: number};
  armL?: Arm; armR?: Arm; legL?: Leg; legR?: Leg;
  sit?: number; // 0 standing .. 1 seated (robe drape)
};
export type Face = {blink?: number; brow?: number; furrow?: number; smile?: number; open?: number; lookX?: number; lookY?: number};
export type Kind = 'eve' | 'adam' | 'jesus' | 'painter' | 'teen';

type Look = {
  skin: string[]; hair: string[]; shoulder: number; chest: number; hips: number; scale: number;
  outfit: 'leavesEve' | 'leavesAdam' | 'robe' | 'smock' | 'hoodie';
};
const LOOKS: Record<Kind, Look> = {
  eve: {skin: ['#B9784F', '#AD6E47', '#C3845A'], hair: ['#3A2216', '#2E1A10', '#472A1A'], shoulder: 0.165, chest: 0.145, hips: 0.15, scale: 0.97, outfit: 'leavesEve'},
  adam: {skin: ['#B07650', '#A46B47', '#BC815A'], hair: ['#2A1A12', '#22150E', '#33211A'], shoulder: 0.2, chest: 0.168, hips: 0.155, scale: 1.04, outfit: 'leavesAdam'},
  jesus: {skin: ['#B07A55', '#A56F4C', '#BB855F'], hair: ['#3B2618', '#2F1D12', '#4A311F'], shoulder: 0.19, chest: 0.16, hips: 0.155, scale: 1.0, outfit: 'robe'},
  painter: {skin: ['#E2B08E', '#D6A27F', '#EABB9A'], hair: ['#EDEBE6', '#DAD7D0', '#F6F4EF'], shoulder: 0.18, chest: 0.175, hips: 0.17, scale: 0.95, outfit: 'smock'},
  teen: {skin: ['#8E5A3A', '#835235', '#996242'], hair: ['#141010', '#1C1614', '#0E0B0A'], shoulder: 0.18, chest: 0.155, hips: 0.15, scale: 0.93, outfit: 'hoodie'},
};

const LEAF_EVE = ['#5E9A33', '#4C8A2B', '#6FAE3E', '#3F7A27', '#7BB846'];
const LEAF_ADAM = ['#3F7A27', '#4E8A2C', '#5A9131', '#355F22', '#47822A'];
const CREAM = ['#EFE6D2', '#E5D9BF', '#F4EDDD'];
const MANTLE = ['#7A5232', '#6B462B', '#86603C'];
const MUSTARD = ['#D9A227', '#C99220', '#E3AE38'];
const GREY = ['#8A8F96', '#7C8188', '#959AA1'];

const HIP_Y = 0.9;
const TORSO = 0.42;
const UPPER = 0.27, FORE = 0.25, THIGH = 0.42, SHIN = 0.42;

const cyl = (rt: number, rb: number, h: number, seg: number, pal: string[], seed: number, jitter = 0.006, open = false) => {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg, 2, open);
  g.translate(0, -h / 2, 0); // top at origin, hangs down
  return faceted(g, {palette: pal, seed, jitter, shade: 0.07});
};
const ball = (r: number, pal: string[], seed: number, detail = 1, jitter = 0.004) =>
  faceted(new THREE.IcosahedronGeometry(r, detail), {palette: pal, seed, jitter, shade: 0.06});

// ---------- geometry kit per character (built once) ----------
function buildKit(kind: Kind) {
  const L = LOOKS[kind];
  const s = kind.length * 13;
  const isLeaves = L.outfit === 'leavesEve' || L.outfit === 'leavesAdam';
  const leafPal = L.outfit === 'leavesAdam' ? LEAF_ADAM : LEAF_EVE;
  const topPal = isLeaves ? leafPal : L.outfit === 'robe' ? CREAM : L.outfit === 'smock' ? CREAM : MUSTARD;
  const sleevePal = isLeaves ? L.skin : topPal;

  const torso = (() => {
    const g = new THREE.CylinderGeometry(L.shoulder * 0.92, L.hips * 0.95, TORSO, 9, 3);
    g.translate(0, TORSO / 2, 0);
    g.scale(1, 1, 0.72);
    return faceted(g, {palette: topPal, seed: s + 1, jitter: 0.008, shade: 0.09});
  })();
  const shoulderCap = ball(L.shoulder * 0.36, topPal, s + 2, 0);
  const neck = cyl(0.045, 0.05, 0.09, 6, L.skin, s + 3);
  const upper = cyl(0.046, 0.039, UPPER, 6, sleevePal, s + 4);
  const fore = cyl(L.outfit === 'robe' ? 0.05 : 0.037, L.outfit === 'robe' ? 0.045 : 0.031, FORE, 6, kind === 'painter' ? L.skin : sleevePal, s + 5);
  const hand = (() => {
    const g = new THREE.IcosahedronGeometry(0.042, 0);
    g.scale(0.85, 1.25, 0.6);
    g.translate(0, -0.045, 0);
    return faceted(g, {palette: L.skin, seed: s + 6, shade: 0.05});
  })();
  const legPal = L.outfit === 'hoodie' ? GREY : L.outfit === 'smock' ? ['#5B4030', '#4E3628'] : L.skin;
  const thigh = cyl(0.072, 0.056, THIGH, 7, L.outfit === 'robe' ? CREAM : legPal, s + 7);
  const shin = cyl(L.outfit === 'robe' ? 0.085 : 0.054, L.outfit === 'robe' ? 0.095 : 0.042, SHIN, 7, L.outfit === 'robe' ? CREAM : legPal, s + 8);
  const foot = (() => {
    const g = new THREE.BoxGeometry(0.085, 0.055, 0.2, 1, 1, 2);
    g.translate(0, -0.03, 0.05);
    const pal = L.outfit === 'hoodie' ? ['#F2F2EE', '#E4E4DE'] : L.outfit === 'smock' ? ['#2B1F18', '#352820'] : L.skin;
    return faceted(g, {palette: pal, seed: s + 9, jitter: 0.006});
  })();

  // skirt / robe drape: cone from hips down
  const skirtLen = L.outfit === 'robe' ? 0.84 : L.outfit === 'smock' ? 0.5 : L.outfit === 'hoodie' ? 0.0 : 0.47;
  const skirt = skirtLen > 0 ? (() => {
    const bottomR = L.outfit === 'robe' ? 0.33 : L.outfit === 'smock' ? 0.27 : 0.29;
    const g = new THREE.CylinderGeometry(L.hips * 1.02, bottomR, skirtLen, 12, 3, true);
    g.translate(0, -skirtLen / 2 + 0.04, 0);
    g.scale(1, 1, 0.8);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (isLeaves && y < -skirtLen + 0.06) {
        // scalloped leaf-tip hem
        const a = Math.atan2(pos.getZ(i), pos.getX(i));
        pos.setY(i, y - 0.05 * Math.abs(Math.sin(a * 6)));
      }
    }
    return faceted(g, {palette: L.outfit === 'robe' ? CREAM : L.outfit === 'smock' ? CREAM : leafPal, seed: s + 10, jitter: 0.01, shade: 0.1});
  })() : null;

  // overlay leaves (garment texture) for Adam and Eve
  const leaves: {g: THREE.BufferGeometry; p: [number, number, number]; r: [number, number, number]; part: 'hips' | 'torso'}[] = [];
  if (isLeaves) {
    const big = L.outfit === 'leavesAdam' ? 1.15 : 1;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + rand(s, i) * 0.3;
      const col = leafPal[i % leafPal.length];
      const len = (0.2 + rand(s, i + 40) * 0.08) * big;
      leaves.push({g: leafGeometry(len, len * 0.62, 0.22, -0.12, s + 20 + i, col),
        p: [Math.sin(a) * 0.2, -0.02 - rand(s, i + 9) * 0.12, Math.cos(a) * 0.17], r: [Math.PI + 0.25, a, 0], part: 'hips'});
    }
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const col = leafPal[(i + 2) % leafPal.length];
      const len = (0.17 + rand(s, i + 60) * 0.05) * big;
      leaves.push({g: leafGeometry(len, len * 0.6, 0.2, 0.1, s + 50 + i, col),
        p: [Math.sin(a) * L.shoulder * 0.8, 0.12 + (i % 3) * 0.09, Math.cos(a) * L.shoulder * 0.62], r: [-0.25, a, (i % 2 ? 0.3 : -0.3)], part: 'torso'});
    }
    // cap leaves over each shoulder
    for (const side of [1, -1]) {
      for (let k = 0; k < 2; k++) {
        leaves.push({g: leafGeometry(0.2 * big, 0.13 * big, 0.25, 0.12, s + 80 + k + (side > 0 ? 0 : 5), leafPal[k + 1]),
          p: [side * L.shoulder * 0.95, TORSO - 0.02, k * 0.04 - 0.02], r: [0.2 * (k ? 1 : -1), 0, side * -2.2], part: 'torso'});
      }
    }
  }
  const vine = isLeaves ? faceted(new THREE.TorusGeometry(L.hips * 1.05, 0.014, 4, 18), {palette: ['#4A5E22', '#55692A'], seed: s + 99}) : null;
  const belt = L.outfit === 'robe' ? faceted(new THREE.TorusGeometry(L.hips * 1.02, 0.017, 4, 18), {palette: ['#B89662', '#A8844F'], seed: s + 98}) : null;

  // head
  const head = (() => {
    const g = new THREE.IcosahedronGeometry(0.14, 2);
    g.scale(0.94, 1.07, 1.0);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i), z = pos.getZ(i);
      if (y < -0.04) pos.setX(i, pos.getX(i) * (1 - (-0.04 - y) * (kind === 'painter' ? 0.6 : 1.6))); // jaw taper
      if (z < 0) pos.setZ(i, z * 1.05);
    }
    return faceted(g, {palette: L.skin, seed: s + 30, jitter: 0.003, shade: 0.04});
  })();
  const nose = (() => {
    const g = new THREE.ConeGeometry(0.017, 0.042, 4);
    g.rotateX(Math.PI / 2 + 0.45);
    return faceted(g, {palette: [L.skin[1]], seed: s + 31});
  })();
  const ear = ball(0.03, L.skin, s + 32, 0);

  const hairParts: {g: THREE.BufferGeometry; p?: [number, number, number]; r?: [number, number, number]; sway?: number}[] = [];
  const hpal = L.hair;
  const shell = (r: number, phiStart: number, phiLen: number, thStart: number, thLen: number, seed: number, wSeg = 10, hSeg = 6) =>
    faceted(new THREE.SphereGeometry(r, wSeg, hSeg, phiStart, phiLen, thStart, thLen), {palette: hpal, seed, jitter: 0.006, shade: 0.12});
  const FRONT = Math.PI / 2; // +Z in three's sphere parameterisation
  if (kind === 'eve' || kind === 'jesus') {
    hairParts.push({g: shell(0.152, 0, Math.PI * 2, 0, Math.PI * 0.3, s + 40)});
    hairParts.push({g: shell(0.155, FRONT + 0.95, Math.PI * 2 - 1.9, Math.PI * 0.2, Math.PI * 0.55, s + 41)});
    // fringe sweeping across the forehead
    const fr = new THREE.SphereGeometry(0.153, 8, 3, FRONT - 1.0, 2.0, Math.PI * 0.16, Math.PI * 0.14);
    hairParts.push({g: faceted(fr, {palette: hpal, seed: s + 42, jitter: 0.004})});
    // long back curtain
    const len = kind === 'eve' ? 0.66 : 0.34;
    // cylinder angles start at +Z (the face), so centre the curtain on the back (PI)
    const cg = new THREE.CylinderGeometry(0.15, kind === 'eve' ? 0.13 : 0.15, len, 10, 6, true, Math.PI - 1.7, 3.4);
    cg.translate(0, -len / 2 + 0.02, 0);
    const cp = cg.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < cp.count; i++) {
      const y = cp.getY(i);
      const k = Math.min(1, -y / len);
      cp.setX(i, cp.getX(i) * (0.95 + 0.22 * k) + Math.sin(y * 18) * 0.012);
      cp.setZ(i, cp.getZ(i) * (1 + 0.12 * k) - 0.03 * k);
    }
    hairParts.push({g: faceted(cg, {palette: hpal, seed: s + 43, jitter: 0.012, shade: 0.14}), p: [0, -0.02, -0.005], sway: 1});
    // two front locks over the shoulders
    for (const side of [1, -1]) {
      const pts = Array.from({length: 9}, (_, i) => {
        const u = i / 8;
        return new THREE.Vector3(side * (0.125 + u * 0.06), -0.03 - u * (kind === 'eve' ? 0.5 : 0.28), -0.07 + u * 0.06 + Math.sin(u * 7) * 0.015);
      });
      hairParts.push({g: taperTube(pts, (u) => 0.03 * (1 - u * 0.55), 5, (u, a) => new THREE.Color(hpal[(Math.floor(a * 5) + Math.floor(u * 6)) % 3])), sway: 0.6});
    }
  }
  if (kind === 'adam' || kind === 'teen') {
    hairParts.push({g: shell(0.148, 0, Math.PI * 2, 0, Math.PI * 0.32, s + 40)});
    hairParts.push({g: shell(0.15, FRONT + 0.95, Math.PI * 2 - 1.9, Math.PI * 0.2, Math.PI * 0.42, s + 41)});
    const n = kind === 'teen' ? 22 : 16;
    for (let i = 0; i < n; i++) {
      const th = rand(s, i) * 1.0 + 0.1, ph = rand(s, i + 7) * Math.PI * 2;
      if (Math.cos(ph - FRONT) > 0.55 && th > 0.75) continue; // keep the forehead clear
      const r = 0.15;
      hairParts.push({g: ball(0.036 + rand(s, i + 3) * 0.014, hpal, s + 60 + i, 0),
        p: [-r * Math.cos(ph) * Math.sin(th), r * Math.cos(th), r * Math.sin(ph) * Math.sin(th)]});
    }
  }
  if (kind === 'painter') {
    hairParts.push({g: shell(0.147, FRONT + 1.0, Math.PI * 2 - 2.0, Math.PI * 0.38, Math.PI * 0.3, s + 40)});
  }
  // beards
  const beard = kind === 'adam' || kind === 'jesus'
    ? faceted(new THREE.SphereGeometry(0.146, 10, 5, FRONT - 1.35, 2.7, Math.PI * 0.56, Math.PI * 0.3), {palette: hpal, seed: s + 70, jitter: 0.006, shade: 0.12})
    : null;
  const mustache = kind === 'painter'
    ? [1, -1].map((side) => taperTube([0, 1, 2, 3, 4].map((i) => new THREE.Vector3(side * (0.005 + i * 0.012), -0.04 - i * i * 0.0035, 0.135 - i * 0.006)), (u) => 0.014 * (1 - u * 0.5), 5, () => new THREE.Color('#F1EFEA')))
    : kind === 'adam' || kind === 'jesus'
      ? [1, -1].map((side) => taperTube([0, 1, 2, 3].map((i) => new THREE.Vector3(side * (0.004 + i * 0.012), -0.038 - i * i * 0.003, 0.136 - i * 0.005)), (u) => 0.011 * (1 - u * 0.4), 4, () => new THREE.Color(hpal[0])))
      : [];
  const beret = kind === 'painter' ? (() => {
    const g = new THREE.SphereGeometry(0.165, 10, 5);
    g.scale(1.05, 0.38, 1.05);
    return faceted(g, {palette: ['#B0302A', '#9E2924', '#BD3A30'], seed: s + 80, jitter: 0.005});
  })() : null;
  const hood = kind === 'teen' ? faceted(new THREE.TorusGeometry(0.13, 0.055, 5, 10, Math.PI * 1.25), {palette: MUSTARD, seed: s + 81}) : null;
  const flower = kind === 'eve' ? (() => {
    const group: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 5; i++) {
      const g = new THREE.SphereGeometry(0.022, 5, 3);
      g.scale(1, 0.45, 0.6);
      g.translate(0.022, 0, 0);
      g.rotateY((i / 5) * Math.PI * 2);
      group.push(faceted(g, {palette: ['#FFFDF6', '#F4F0E6'], seed: s + 90 + i}));
    }
    group.push(ball(0.012, ['#F2C14E'], s + 96, 0));
    return group;
  })() : [];
  const mantle = L.outfit === 'robe' ? (() => {
    const g = new THREE.CylinderGeometry(L.shoulder * 1.04, L.hips * 1.08, TORSO * 1.02, 10, 2, true, 0.4, Math.PI * 1.25);
    g.translate(0, TORSO / 2, 0);
    g.scale(1, 1, 0.8);
    g.rotateZ(-0.32);
    return faceted(g, {palette: MANTLE, seed: s + 85, jitter: 0.01});
  })() : null;
  const dabs = L.outfit === 'smock' ? ['#C0392B', '#2E7D4F', '#E0A93B', '#3B5BA5'].map((c, i) => ({
    g: ball(0.018, [c], s + 100 + i, 0), p: [(-0.08 + i * 0.05), 0.05 + rand(s, i) * 0.25, L.chest * 0.75] as [number, number, number]})) : [];

  return {L, torso, shoulderCap, neck, upper, fore, hand, thigh, shin, foot, skirt, skirtLen, leaves, vine, belt, head, nose, ear, hairParts, beard, mustache, beret, hood, flower, mantle, dabs};
}

const kitCache = new Map<Kind, ReturnType<typeof buildKit>>();
const getKit = (k: Kind) => {
  if (!kitCache.has(k)) kitCache.set(k, buildKit(k));
  return kitCache.get(k)!;
};

// ---------- shared materials ----------
const MAT = flatMat({roughness: 0.82});
const HAIR_MAT = flatMat({roughness: 0.55});
const DARK = new THREE.MeshStandardMaterial({color: '#1E120C', roughness: 0.4});
const WHITE = new THREE.MeshBasicMaterial({color: '#ffffff'});
const MOUTH = new THREE.MeshStandardMaterial({color: '#4A1F1A', roughness: 0.6});
const LIP = new THREE.MeshStandardMaterial({color: '#5A2A20', roughness: 0.6});
const BLUSH = new THREE.MeshBasicMaterial({color: '#E07A6A', transparent: true, opacity: 0.16, depthWrite: false});
const EYE_G = new THREE.SphereGeometry(1, 8, 6);
const BROW_G = new THREE.BoxGeometry(1, 1, 1);
const SMILE_G = new THREE.TorusGeometry(0.022, 0.0045, 4, 12, Math.PI * 0.85);
const BLUSH_G = new THREE.CircleGeometry(0.016, 10);

// ---------- component ----------
export type FigureProps = {
  kind: Kind;
  pose?: Pose;
  face?: Face;
  t?: number; // seconds, drives breathing, blinking, hair and leaf sway
  wind?: number; // 0..1 secondary-motion strength
  position?: [number, number, number];
  rotationY?: number;
  scale?: number;
  seed?: number;
  children?: React.ReactNode; // attached to the right hand (props)
  leftHand?: React.ReactNode;
};

export const autoBlink = (t: number, seed = 1) => {
  // a blink every ~3.5 s, 5 frames long, seeded spacing
  const period = 3.4 + rand(seed, 0) * 0.8;
  const k = ((t + rand(seed, 1) * period) % period) / period;
  const d = 0.05;
  return k < d ? Math.sin((k / d) * Math.PI) : 0;
};

export const Figure3D: React.FC<FigureProps> = ({
  kind, pose = {}, face = {}, t = 0, wind = 0.5, position = [0, 0, 0], rotationY = 0, scale = 1, seed = 1, children, leftHand,
}) => {
  const K = getKit(kind);
  const ref = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    ref.current?.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = false;
      }
    });
  }, []);

  const breath = Math.sin(t * 2 * Math.PI * 0.27 + seed) * 0.012;
  const sway = (k: number) => noise1(t * 0.9 + k * 3.1, seed + k) * wind;
  const sit = pose.sit ?? 0;
  const aL = pose.armL ?? {}, aR = pose.armR ?? {};
  const lL = pose.legL ?? {}, lR = pose.legR ?? {};
  const hd = pose.head ?? {};
  const blink = Math.max(face.blink ?? 0, autoBlink(t, seed));
  const eyeOpen = 1 - blink * 0.92;
  const brow = face.brow ?? 0, furrow = face.furrow ?? 0, smile = face.smile ?? 0.3, open = face.open ?? 0;
  const lookX = (face.lookX ?? 0) * 0.01, lookY = (face.lookY ?? 0) * 0.008;
  const sh = K.L.shoulder;

  const arm = (side: 1 | -1, a: Arm, hand?: React.ReactNode) => (
    <group position={[side * sh, TORSO - 0.03, 0]} rotation={[-(a.sx ?? 0.05), a.twist ?? 0, side * (a.sz ?? 0.08)]}>
      <mesh geometry={K.shoulderCap} material={MAT} />
      <mesh geometry={K.upper} material={MAT} />
      <group position={[0, -UPPER, 0]} rotation={[-(a.elbow ?? 0.12), 0, 0]}>
        <mesh geometry={K.fore} material={MAT} />
        <group position={[0, -FORE, 0]}>
          <mesh geometry={K.hand} material={MAT} />
          {hand}
        </group>
      </group>
    </group>
  );
  const leg = (side: 1 | -1, l: Leg) => (
    <group position={[side * 0.085, 0, 0]} rotation={[-(l.hx ?? 0), 0, side * (l.hz ?? 0.02)]}>
      <mesh geometry={K.thigh} material={MAT} />
      <group position={[0, -THIGH, 0]} rotation={[l.knee ?? 0, 0, 0]}>
        <mesh geometry={K.shin} material={MAT} />
        <group position={[0, -SHIN - 0.01, 0]} rotation={[-(l.knee ?? 0) * 0.3 + (l.hx ?? 0) * 0.2, 0, 0]}>
          <mesh geometry={K.foot} material={MAT} />
        </group>
      </group>
    </group>
  );
  const skirtScaleY = lerp(1, kindSitScale(kind), sit);

  return (
    <group ref={ref} position={position} rotation={[0, rotationY, 0]} scale={scale * K.L.scale}>
      <group position={[0, HIP_Y + (pose.y ?? 0), 0]} rotation={[0, (pose.twist ?? 0) * 0.3, 0]}>
        {leg(1, lL)}
        {leg(-1, lR)}
        {K.skirt && (
          <group rotation={[(pose.lean ?? 0) * 0.25 + sit * -0.35, 0, sway(9) * 0.03]} scale={[1 + sit * 0.15, skirtScaleY, 1 + sit * 0.45]} position={[0, 0, sit * 0.12]}>
            <mesh geometry={K.skirt} material={MAT} />
            {K.leaves.filter((l) => l.part === 'hips').map((l, i) => (
              <mesh key={i} geometry={l.g} material={MAT} position={l.p} rotation={[l.r[0] + sway(i) * 0.12, l.r[1], l.r[2]]} />
            ))}
          </group>
        )}
        {K.vine && <mesh geometry={K.vine} material={MAT} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} scale={[1, 0.8, 1]} />}
        {K.belt && <mesh geometry={K.belt} material={MAT} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} scale={[1, 0.8, 1]} />}
        <group rotation={[pose.lean ?? 0, pose.twist ?? 0, pose.side ?? 0]}>
          <group scale={[1 + breath, 1 + breath * 0.5, 1 + breath]}>
            <mesh geometry={K.torso} material={MAT} />
            {K.mantle && <mesh geometry={K.mantle} material={MAT} />}
            {K.leaves.filter((l) => l.part === 'torso').map((l, i) => (
              <mesh key={i} geometry={l.g} material={MAT} position={l.p} rotation={[l.r[0] + sway(i + 20) * 0.08, l.r[1], l.r[2]]} />
            ))}
            {K.dabs.map((d, i) => <mesh key={i} geometry={d.g} material={MAT} position={d.p} scale={[1, 1, 0.35]} />)}
          </group>
          {arm(1, aL, leftHand)}
          {arm(-1, aR, children)}
          {K.hood && <mesh geometry={K.hood} material={MAT} position={[0, TORSO + 0.02, -0.06]} rotation={[-1.2, 0, Math.PI * -0.12]} />}
          <group position={[0, TORSO, 0]}>
            <mesh geometry={K.neck} material={MAT} position={[0, 0.07, 0]} />
            <group position={[0, 0.17, 0.005]} rotation={[hd.pitch ?? 0, hd.yaw ?? 0, hd.roll ?? 0]}>
              <mesh geometry={K.head} material={MAT} />
              <mesh geometry={K.nose} material={MAT} position={[0, -0.02, 0.14]} />
              <mesh geometry={K.ear} material={MAT} position={[0.128, -0.005, -0.01]} scale={[0.5, 1, 0.8]} />
              <mesh geometry={K.ear} material={MAT} position={[-0.128, -0.005, -0.01]} scale={[0.5, 1, 0.8]} />
              {/* eyes: small almond shapes with a catch-light */}
              {[1, -1].map((side) => (
                <group key={side} position={[side * 0.045 + lookX, 0.004 + lookY, 0.127]} rotation={[0, side * 0.32, 0]}>
                  <mesh geometry={EYE_G} material={DARK} scale={[0.0125, 0.0165 * eyeOpen + 0.0012, 0.006]} />
                  {eyeOpen > 0.4 && <mesh geometry={EYE_G} material={WHITE} position={[0.0035, 0.0045 * eyeOpen, 0.0045]} scale={0.0029} />}
                </group>
              ))}
              {/* brows: brow raises both, furrow lifts the inner ends (worry) */}
              {[1, -1].map((side) => (
                <mesh key={side} geometry={BROW_G} material={kind === 'painter' ? WHITE : DARK}
                  position={[side * 0.047, 0.04 + brow * 0.011 + furrow * 0.004, 0.13]}
                  rotation={[-0.2, side * -0.32, side * (-0.08 - furrow * 0.45 + Math.max(0, -brow) * 0.3)]}
                  scale={[0.034, 0.0062, 0.006]} />
              ))}
              {/* mouth */}
              {open > 0.05 ? (
                <mesh geometry={EYE_G} material={MOUTH} position={[0, -0.06, 0.128]} scale={[0.019 + smile * 0.003, 0.004 + open * 0.013, 0.007]} />
              ) : (
                <mesh geometry={SMILE_G} material={LIP} position={[0, smile >= 0 ? -0.046 - smile * 0.006 : -0.072, 0.131]}
                  rotation={[-0.25, 0, smile >= 0 ? -Math.PI * 0.925 : Math.PI * 0.075]} scale={[1, Math.max(0.12, Math.abs(smile)), 1]} />
              )}
              {[1, -1].map((side) => <mesh key={side} geometry={BLUSH_G} material={BLUSH} position={[side * 0.07, -0.028, 0.121]} rotation={[0, side * 0.5, 0]} />)}
              {K.beard && <mesh geometry={K.beard} material={HAIR_MAT} />}
              {K.mustache.map((g, i) => <mesh key={i} geometry={g} material={HAIR_MAT} />)}
              {K.hairParts.map((h, i) => (
                <mesh key={i} geometry={h.g} material={HAIR_MAT} position={h.p ?? [0, 0, 0]}
                  rotation={h.sway ? [sway(40 + i) * 0.06 * h.sway + Math.max(0, hd.pitch ?? 0) * -0.6, 0, sway(50 + i) * 0.05 * h.sway] : h.r ?? [0, 0, 0]} />
              ))}
              {K.beret && <mesh geometry={K.beret} material={MAT} position={[-0.02, 0.115, -0.01]} rotation={[0.1, 0, 0.22]} />}
              {K.flower.length > 0 && (
                <group position={[0.118, 0.065, -0.02]} rotation={[0.3, 1.3, 0.2]}>
                  {K.flower.map((g, i) => <mesh key={i} geometry={g} material={MAT} />)}
                </group>
              )}
            </group>
          </group>
        </group>
      </group>
    </group>
  );
};

const kindSitScale = (k: Kind) => (k === 'jesus' ? 0.55 : 1);

// ---------- pose helpers ----------
export const walkPose = (phase: number, amt = 1): Pose => {
  const s = Math.sin(phase * Math.PI * 2);
  const c = Math.cos(phase * Math.PI * 2);
  return {
    y: -Math.abs(c) * 0.025 * amt,
    lean: 0.04 * amt,
    legL: {hx: s * 0.38 * amt, knee: Math.max(0, -c) * 0.6 * amt + 0.05},
    legR: {hx: -s * 0.38 * amt, knee: Math.max(0, c) * 0.6 * amt + 0.05},
    armL: {sx: -s * 0.32 * amt, sz: 0.1, elbow: 0.2 + Math.max(0, -s) * 0.25 * amt},
    armR: {sx: s * 0.32 * amt, sz: 0.1, elbow: 0.2 + Math.max(0, s) * 0.25 * amt},
  };
};

export const blendPose = (a: Pose, b: Pose, k: number): Pose => {
  const n = (x?: number, y?: number) => lerp(x ?? 0, y ?? 0, k);
  const arm = (x: Arm = {}, y: Arm = {}): Arm => ({sx: lerp(x.sx ?? 0.05, y.sx ?? 0.05, k), sz: lerp(x.sz ?? 0.08, y.sz ?? 0.08, k), elbow: lerp(x.elbow ?? 0.12, y.elbow ?? 0.12, k), twist: n(x.twist, y.twist)});
  const leg = (x: Leg = {}, y: Leg = {}): Leg => ({hx: n(x.hx, y.hx), knee: n(x.knee, y.knee), hz: lerp(x.hz ?? 0.02, y.hz ?? 0.02, k)});
  return {
    y: n(a.y, b.y), lean: n(a.lean, b.lean), twist: n(a.twist, b.twist), side: n(a.side, b.side), sit: n(a.sit, b.sit),
    head: {pitch: n(a.head?.pitch, b.head?.pitch), yaw: n(a.head?.yaw, b.head?.yaw), roll: n(a.head?.roll, b.head?.roll)},
    armL: arm(a.armL, b.armL), armR: arm(a.armR, b.armR), legL: leg(a.legL, b.legL), legR: leg(a.legR, b.legR),
  };
};
export const blendFace = (a: Face, b: Face, k: number): Face => ({
  blink: lerp(a.blink ?? 0, b.blink ?? 0, k), brow: lerp(a.brow ?? 0, b.brow ?? 0, k), furrow: lerp(a.furrow ?? 0, b.furrow ?? 0, k),
  smile: lerp(a.smile ?? 0.3, b.smile ?? 0.3, k), open: lerp(a.open ?? 0, b.open ?? 0, k),
  lookX: lerp(a.lookX ?? 0, b.lookX ?? 0, k), lookY: lerp(a.lookY ?? 0, b.lookY ?? 0, k),
});
