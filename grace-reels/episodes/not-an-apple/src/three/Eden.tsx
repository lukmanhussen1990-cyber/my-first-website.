import {useLayoutEffect, useMemo, useRef} from 'react';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {faceted, flatMat, softDiscTexture, taperTube} from './lowpoly';
import {noise2, rand} from '../lib/random';
import {quality} from '../lib/lite';

export const SUN_DIR = new THREE.Vector3(0.05, 0.24, -0.97).normalize();
export const SUN_POS: [number, number, number] = [SUN_DIR.x * 300, SUN_DIR.y * 300, SUN_DIR.z * 300];
export const TREE_BASE = new THREE.Vector3(1.9, 0, 0);

// The low branch the serpent rests on, then hangs off toward Eve.
export const BRANCH_CTRL: [number, number, number][] = [
  [1.86, 2.55, 0.1], [1.35, 2.62, 0.32], [0.75, 2.46, 0.5], [0.25, 2.2, 0.62],
];
// Snake track: up the trunk in a spiral, along the branch, then off its tip toward Eve's face.
export const snakeTrack = (() => {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 26; i++) {
    const u = i / 26;
    const a = u * Math.PI * 4.2 + 0.6;
    const y = 0.55 + u * 1.95;
    const r = 0.46 - u * 0.12;
    pts.push(new THREE.Vector3(1.9 + 0.04 * u + Math.cos(a) * r, y, Math.sin(a) * r));
  }
  for (const p of BRANCH_CTRL.slice(1)) pts.push(new THREE.Vector3(p[0], p[1] + 0.12, p[2]));
  pts.push(new THREE.Vector3(-0.02, 1.98, 0.72));
  pts.push(new THREE.Vector3(-0.22, 1.82, 0.8));
  return new THREE.CatmullRomCurve3(pts, false, 'centripetal');
})();
// fraction of the track where the branch part begins (body waves from here)
export const TRACK_BRANCH = 0.62;

const groundHeight = (x: number, z: number) => {
  let y = noise2(x * 0.12, z * 0.12, 3) * 0.28 + noise2(x * 0.4, z * 0.4, 5) * 0.05;
  if (z < -22) y += Math.pow((-22 - z) / 30, 1.4) * (2.4 + noise2(x * 0.05, z * 0.05, 8) * 2.2);
  const d = riverDistance(x, z);
  y -= Math.max(0, 1 - d / 2.4) * 0.38;
  return y;
};
const RIVER_PTS: [number, number][] = [[9, -1.2], [5, -2.6], [1.5, -4.6], [-1.6, -7.5], [-2.8, -11.5], [-1.2, -17], [2.4, -24], [1.4, -34], [-3.5, -48], [-2, -70]];
const riverCurve = new THREE.CatmullRomCurve3(RIVER_PTS.map(([x, z]) => new THREE.Vector3(x, 0, z)));
const riverSamples = riverCurve.getSpacedPoints(160);
function riverDistance(x: number, z: number) {
  let best = 1e9;
  for (const p of riverSamples) {
    const d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}
const riverWidth = (u: number) => 1.5 + u * 3.2;

const MAT = flatMat();
const MAT_SOFT = flatMat({roughness: 0.7});
// backlit leaves glow a little (fake translucency)
const FRINGE_MAT = flatMat({roughness: 0.6, emissive: new THREE.Color('#8FB838'), emissiveIntensity: 0.32});

// ---------- sky ----------
const Sky: React.FC<{drain: number}> = ({drain}) => {
  const geo = useMemo(() => {
    const g = new THREE.SphereGeometry(420, 48, 24);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const col = new Float32Array(pos.count * 3);
    const hor = new THREE.Color('#FFD98C'), zen = new THREE.Color('#B4D3DA'), glow = new THREE.Color('#FFF6DA');
    const c = new THREE.Color(), v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).normalize();
      const e = Math.max(0, v.y);
      c.copy(hor).lerp(zen, Math.pow(e, 0.55));
      const s = Math.max(0, v.dot(SUN_DIR));
      c.lerp(glow, Math.pow(s, 3) * 0.95);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  }, []);
  return (
    <mesh geometry={geo}>
      <meshBasicMaterial vertexColors side={THREE.BackSide} fog={false} color={new THREE.Color(1, 1, 1).multiplyScalar(1 - drain * 0.25)} />
    </mesh>
  );
};

// ---------- ground + river ----------
const Ground: React.FC = () => {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(160, 150, 90, 90);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, -55);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setY(i, groundHeight(pos.getX(i), pos.getZ(i)));
    const greens = ['#7FA83A', '#6E9B32', '#8DB443', '#5F8C2C', '#98BC4A'];
    return faceted(g, {
      seed: 9, shade: 0.06,
      colorAt: (c, n, f) => {
        const base = new THREE.Color(greens[Math.floor(rand(21, f) * greens.length)]);
        const near = Math.max(0, 1 - Math.hypot(c.x - 1.5, c.z) / 7);
        base.lerp(new THREE.Color('#B9CB55'), near * 0.35); // sunlit patch round the tree
        if (riverDistance(c.x, c.z) < 1.6 + Math.max(0, -c.z) * 0.04) base.lerp(new THREE.Color('#A08F6A'), 0.55);
        if (c.z < -24) base.lerp(new THREE.Color('#9AA25A'), 0.3);
        return base;
      },
    });
  }, []);
  return <mesh geometry={geo} material={MAT} receiveShadow />;
};

const River: React.FC<{t: number}> = ({t}) => {
  const geo = useMemo(() => {
    const pts = riverCurve.getSpacedPoints(120);
    const positions: number[] = [];
    const idx: number[] = [];
    pts.forEach((p, i) => {
      const u = i / (pts.length - 1);
      const tan = riverCurve.getTangentAt(u);
      const side = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
      const w = riverWidth(u);
      for (const k of [-1, 1]) {
        const q = p.clone().addScaledVector(side, k * w);
        positions.push(q.x, -0.06 + (rand(4, i * 2 + k) - 0.5) * 0.02, q.z);
      }
      if (i > 0) {
        const a = (i - 1) * 2;
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(idx);
    return faceted(g, {palette: ['#86C9DA', '#78BED2', '#94D3E0', '#6FB3C9'], seed: 12, shade: 0.05});
  }, []);
  const sparkle = useRef<THREE.InstancedMesh>(null);
  const N = 140;
  const spots = useMemo(() => Array.from({length: N}, (_, i) => {
    const u = rand(31, i) * 0.55;
    const p = riverCurve.getPointAt(u);
    const tan = riverCurve.getTangentAt(u);
    const side = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
    p.addScaledVector(side, (rand(32, i) - 0.5) * 1.7 * riverWidth(u));
    return {p, ph: rand(33, i) * 10, sp: 2 + rand(34, i) * 4};
  }), []);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    spots.forEach((s, i) => {
      const k = Math.pow(Math.max(0, Math.sin(t * s.sp + s.ph)), 6);
      m.compose(new THREE.Vector3(s.p.x, -0.03, s.p.z), new THREE.Quaternion(), new THREE.Vector3(k, k * 0.4, k));
      sparkle.current!.setMatrixAt(i, m);
    });
    sparkle.current!.instanceMatrix.needsUpdate = true;
  });
  return (
    <group>
      <mesh geometry={geo} receiveShadow>
        <meshStandardMaterial vertexColors flatShading roughness={0.12} metalness={0.15} emissive="#2C7088" emissiveIntensity={0.35} />
      </mesh>
      <instancedMesh ref={sparkle} args={[undefined, undefined, N]} frustumCulled={false}>
        <octahedronGeometry args={[0.09, 0]} />
        <meshBasicMaterial color="#FFFBEA" toneMapped={false} />
      </instancedMesh>
    </group>
  );
};

// ---------- instanced scatter helper ----------
type Inst = {p: [number, number, number]; s: [number, number, number]; r?: number; c?: string};
const Scatter: React.FC<{geo: THREE.BufferGeometry; items: Inst[]; mat?: THREE.Material; shadow?: boolean}> = ({geo, items, mat = MAT, shadow = true}) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    items.forEach((it, i) => {
      q.setFromEuler(new THREE.Euler(0, it.r ?? 0, 0));
      m.compose(new THREE.Vector3(...it.p), q, new THREE.Vector3(...it.s));
      ref.current!.setMatrixAt(i, m);
      if (it.c) ref.current!.setColorAt(i, new THREE.Color(it.c));
    });
    ref.current!.instanceMatrix.needsUpdate = true;
    if (ref.current!.instanceColor) ref.current!.instanceColor.needsUpdate = true;
  }, [items]);
  return <instancedMesh ref={ref} args={[geo, mat, items.length]} castShadow={shadow} receiveShadow frustumCulled={false} />;
};

const placeAvoiding = (seed: number, n: number, x0: number, x1: number, z0: number, z1: number, ok: (x: number, z: number) => boolean) => {
  const out: [number, number][] = [];
  for (let i = 0; out.length < n && i < n * 30; i++) {
    const x = x0 + rand(seed, i * 2) * (x1 - x0);
    const z = z0 + rand(seed, i * 2 + 1) * (z1 - z0);
    if (ok(x, z)) out.push([x, z]);
  }
  return out;
};

const Vegetation: React.FC = () => {
  const data = useMemo(() => {
    const clear = (x: number, z: number) => riverDistance(x, z) > 3 && !(x > -13 && x < 11 && z > -30) && !(x < -6 && x > -30 && z < -30 && z > -52);
    const canopy = faceted(new THREE.IcosahedronGeometry(1, 1), {seed: 41, jitter: 0.09, colorAt: (c, n) => new THREE.Color(n.y > 0.3 ? '#8DB33C' : n.y > -0.3 ? '#6B972F' : '#4B7424')});
    const trunk = faceted(new THREE.CylinderGeometry(0.12, 0.18, 1, 6).translate(0, 0.5, 0), {palette: ['#6B4A2E', '#5C3F27'], seed: 42});
    const cypress = faceted(new THREE.ConeGeometry(1, 1, 7, 3).translate(0, 0.5, 0), {seed: 43, jitter: 0.03, colorAt: (c, n) => new THREE.Color(n.x < 0 ? '#3E6B2A' : '#2E5622')});
    const bush = faceted(new THREE.IcosahedronGeometry(1, 0), {seed: 44, jitter: 0.08, palette: ['#5E8E2F', '#6E9E36', '#4F7E28']});
    const flower = faceted(new THREE.IcosahedronGeometry(1, 0), {seed: 45, palette: ['#ffffff']});
    const rock = faceted(new THREE.DodecahedronGeometry(1, 0), {seed: 46, jitter: 0.1, palette: ['#A3948A', '#8E8178', '#B5A79A', '#9C8B7D']});
    const tuft = faceted(new THREE.ConeGeometry(0.022, 0.2, 3).translate(0, 0.1, 0), {seed: 47, palette: ['#8DB843', '#7AA637', '#A3C851']});

    const treeXZ = placeAvoiding(50, 70, -40, 40, -70, -5, clear);
    const trees: Inst[] = [], trunks: Inst[] = [];
    treeXZ.forEach(([x, z], i) => {
      const s = 1.1 + rand(51, i) * 1.4 + Math.max(0, -z - 20) * 0.02;
      const y = groundHeight(x, z);
      trunks.push({p: [x, y, z], s: [s, s * 1.4, s]});
      trees.push({p: [x, y + s * 1.9, z], s: [s * 1.25, s * 1.1, s * 1.25], r: rand(52, i) * 6, c: ['#ffffff', '#E8F2C8', '#D7E8B0'][i % 3]});
    });
    const cyp: Inst[] = placeAvoiding(53, 60, -45, 30, -80, -12, (x, z) => clear(x, z) && (z < -34 || Math.abs(x) > 14)).map(([x, z], i) => {
      const h = 3.2 + rand(54, i) * 3.5;
      return {p: [x, groundHeight(x, z) - 0.2, z], s: [0.75 + rand(55, i) * 0.4, h, 0.75 + rand(55, i) * 0.4], r: rand(56, i) * 6};
    });
    const bushes: Inst[] = placeAvoiding(57, 70, -14, 14, -26, 3, (x, z) => riverDistance(x, z) > 1.8 && !(Math.abs(x - 0.6) < 3 && z > -2.5)).map(([x, z], i) => {
      const s = 0.35 + rand(58, i) * 0.45;
      return {p: [x, groundHeight(x, z) + s * 0.5, z], s: [s * 1.3, s, s * 1.2], r: rand(59, i) * 6};
    });
    const flowerCols = ['#FFFFFF', '#FFF3F0', '#E2453A', '#F4C542', '#F2A1B8'];
    const flowers: Inst[] = [];
    bushes.forEach((b, i) => {
      for (let k = 0; k < 6; k++) {
        const a = rand(60, i * 9 + k) * 6.28;
        flowers.push({p: [b.p[0] + Math.cos(a) * b.s[0] * 0.8, b.p[1] + b.s[1] * (0.2 + rand(61, i * 9 + k) * 0.5), b.p[2] + Math.sin(a) * b.s[2] * 0.8], s: [0.055, 0.04, 0.055], c: flowerCols[(i + k) % flowerCols.length]});
      }
    });
    placeAvoiding(62, 420, -9, 9, -12, 4.5, (x, z) => riverDistance(x, z) > 1.7 && !(Math.abs(x - 1.9) < 0.5 && Math.abs(z) < 0.5)).forEach(([x, z], i) => {
      flowers.push({p: [x, groundHeight(x, z) + 0.06, z], s: [0.045, 0.03, 0.045], c: flowerCols[i % 2 === 0 ? 0 : i % flowerCols.length]});
    });
    const rocks: Inst[] = [];
    for (let i = 0; i < 70; i++) {
      const u = rand(63, i) * 0.6;
      const p = riverCurve.getPointAt(u);
      const tan = riverCurve.getTangentAt(u);
      const side = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
      const k = rand(64, i) > 0.5 ? 1 : -1;
      p.addScaledVector(side, k * (riverWidth(u) + 0.1 + rand(65, i) * 0.6));
      const s = 0.25 + rand(66, i) * 0.7 * (1 + u * 2);
      rocks.push({p: [p.x, groundHeight(p.x, p.z) - s * 0.2, p.z], s: [s * 1.3, s * 0.7, s], r: rand(67, i) * 6});
    }
    const tufts: Inst[] = placeAvoiding(68, 700, -7, 7, -6, 5, (x, z) => riverDistance(x, z) > 1.6).map(([x, z], i) => {
      const s = 0.5 + rand(69, i) * 0.8;
      return {p: [x, groundHeight(x, z) - 0.02, z], s: [s, s, s], r: rand(70, i) * 6};
    });
    return {canopy, trunk, cypress, bush, flower, rock, tuft, trees, trunks, cyp, bushes, flowers, rocks, tufts};
  }, []);
  return (
    <group>
      <Scatter geo={data.trunk} items={data.trunks} />
      <Scatter geo={data.canopy} items={data.trees} />
      <Scatter geo={data.cypress} items={data.cyp} />
      <Scatter geo={data.bush} items={data.bushes} />
      <Scatter geo={data.flower} items={data.flowers} shadow={false} mat={MAT_SOFT} />
      <Scatter geo={data.rock} items={data.rocks} />
      <Scatter geo={data.tuft} items={data.tufts} shadow={false} />
    </group>
  );
};

// ---------- cliffs, waterfalls, mountains ----------
const Distance: React.FC<{t: number}> = ({t}) => {
  const data = useMemo(() => {
    const cliff = faceted(new THREE.BoxGeometry(1, 1, 1, 2, 3, 2).translate(0, 0.5, 0), {seed: 71, jitter: 0.08, colorAt: (c, n) => new THREE.Color(n.y > 0.6 ? '#7E9A45' : n.x > 0.3 ? '#D2A88A' : '#B98E74')});
    const cliffs: Inst[] = [];
    for (let i = 0; i < 16; i++) {
      const x = -34 + i * 2.6 + rand(72, i) * 1.5;
      const z = -36 - rand(73, i) * 10 - (i % 3) * 3;
      const h = 9 + rand(74, i) * 9;
      cliffs.push({p: [x, groundHeight(x, z) - 1, z], s: [3 + rand(75, i) * 2, h, 3 + rand(76, i) * 3], r: rand(77, i) * 0.6});
    }
    const mountain = faceted(new THREE.IcosahedronGeometry(1, 1), {seed: 78, jitter: 0.12, colorAt: (c, n) => new THREE.Color(n.y > 0.5 ? '#B7B67A' : n.x < 0 ? '#C9A58E' : '#B79483')});
    const mountains: Inst[] = Array.from({length: 11}, (_, i) => ({p: [-130 + i * 26 + rand(79, i) * 10, -8, -140 - rand(80, i) * 40], s: [28 + rand(81, i) * 22, 18 + rand(82, i) * 20, 22], r: rand(83, i) * 6}));
    return {cliff, cliffs, mountain, mountains};
  }, []);
  const falls: [number, number, number, number][] = [[-15.5, -34.5, 13, 1.4], [-24, -38, 10, 1.1]];
  return (
    <group>
      <Scatter geo={data.cliff} items={data.cliffs} shadow={false} />
      <Scatter geo={data.mountain} items={data.mountains} shadow={false} />
      {falls.map(([x, z, h, w], i) => (
        <group key={i} position={[x, groundHeight(x, z), z + 1.6]}>
          <mesh position={[0, h / 2, 0]}>
            <planeGeometry args={[w, h, 1, 1]} />
            <meshBasicMaterial color="#EAF6F8" transparent opacity={0.85} />
          </mesh>
          {[0, 1, 2, 3, 4].map((k) => {
            const y = h - (((t * 5 + k * h / 5) % h));
            return (
              <mesh key={k} position={[(k - 2) * w * 0.18, y, 0.05]}>
                <boxGeometry args={[0.08, 1.2, 0.02]} />
                <meshBasicMaterial color="#FFFFFF" />
              </mesh>
            );
          })}
          <mesh position={[0, 0.6, 0.6]} scale={[w * 1.8, 1.1, 1.2]}>
            <icosahedronGeometry args={[1, 1]} />
            <meshBasicMaterial color="#F6FBFB" transparent opacity={0.55} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

// ---------- the special tree ----------
export const SpecialTree: React.FC<{t: number; glow: number; wind: number}> = ({t, glow, wind}) => {
  const data = useMemo(() => {
    const bark = (u: number, a: number) => new THREE.Color(['#7A4B2B', '#6A3F23', '#8A5A35', '#5E381F'][Math.floor(u * 9 + a * 7) % 4]);
    const trunkPts = [[1.9, -0.1, 0], [1.95, 0.9, 0.05], [1.85, 1.9, 0], [1.95, 2.8, -0.08], [2.0, 3.5, -0.1]].map((p) => new THREE.Vector3(...(p as [number, number, number])));
    const trunk = taperTube(new THREE.CatmullRomCurve3(trunkPts).getPoints(14), (u) => 0.46 - u * 0.26 + (u < 0.08 ? (0.08 - u) * 3 : 0), 8, bark);
    const limb = (ctrl: [number, number, number][], r0: number, r1: number) =>
      taperTube(new THREE.CatmullRomCurve3(ctrl.map((p) => new THREE.Vector3(...p))).getPoints(10), (u) => r0 + (r1 - r0) * u, 6, bark);
    const branches = [
      limb([[1.95, 2.7, -0.05], [2.5, 3.4, 0.0], [2.9, 4.1, 0.1]], 0.16, 0.06),
      limb([[1.95, 3.0, -0.05], [1.6, 3.8, -0.2], [1.2, 4.4, -0.1]], 0.15, 0.05),
      limb(BRANCH_CTRL, 0.12, 0.038),
      limb([[1.9, 0.15, 0], [2.45, 0.02, 0.3], [2.75, -0.05, 0.5]], 0.15, 0.04),
      limb([[1.9, 0.15, 0], [1.45, 0.02, 0.35], [1.15, -0.05, 0.55]], 0.14, 0.04),
      limb([[1.9, 0.15, 0], [2.2, 0.02, -0.45], [2.4, -0.05, -0.8]], 0.14, 0.04),
    ];
    const chunk = faceted(new THREE.IcosahedronGeometry(1, 1), {
      seed: 90, jitter: 0.12,
      colorAt: (c, n) => {
        const lit = n.dot(SUN_DIR.clone().multiplyScalar(-1).negate());
        return new THREE.Color(n.y > 0.45 || lit > 0.4 ? '#A8C944' : n.y > -0.2 ? '#78A332' : '#557F27');
      },
    });
    const chunks: [number, number, number, number][] = [
      [2.0, 4.7, -0.2, 1.35], [2.9, 4.4, 0.25, 1.1], [1.1, 4.6, 0.1, 1.15], [2.4, 5.6, -0.5, 1.2], [1.4, 5.5, -0.4, 1.0],
      [3.4, 3.8, -0.2, 0.85], [0.6, 3.9, 0.45, 0.85], [2.0, 3.9, 0.7, 0.9], [0.1, 3.4, 0.55, 0.62], [3.0, 5.2, 0.6, 0.8],
    ];
    const fringe = faceted(new THREE.TetrahedronGeometry(0.12, 0), {seed: 91, palette: ['#B6D24F', '#9CC13E', '#C7DC63', '#86B036']});
    const fringeItems: Inst[] = [];
    chunks.forEach(([x, y, z, s], ci) => {
      for (let k = 0; k < 34; k++) {
        const th = rand(92, ci * 50 + k) * Math.PI * 2, ph = Math.acos(1 - 2 * rand(93, ci * 50 + k) * 0.85);
        fringeItems.push({p: [x + Math.cos(th) * Math.sin(ph) * s * 1.02, y - Math.cos(ph) * s * 0.95, z + Math.sin(th) * Math.sin(ph) * s * 1.02], s: [1, 1.4, 1], r: rand(94, k) * 6});
      }
    });
    const orbs: [number, number, number][] = [[1.5, 3.7, 0.85], [2.6, 3.65, 0.75], [0.75, 3.35, 0.9], [2.1, 3.3, 1.05], [3.2, 3.5, 0.4], [1.2, 4.1, 0.95]];
    return {trunk, branches, chunk, chunks, fringe, fringeItems, orbs};
  }, []);
  const sway = Math.sin(t * 0.9) * 0.012 * wind;
  return (
    <group>
      <mesh geometry={data.trunk} material={MAT} castShadow receiveShadow />
      {data.branches.map((g, i) => <mesh key={i} geometry={g} material={MAT} castShadow receiveShadow />)}
      <group rotation={[0, 0, sway]} position={[0, 0, 0]}>
        {data.chunks.map(([x, y, z, s], i) => (
          <mesh key={i} geometry={data.chunk} material={MAT} position={[x, y, z]} scale={[s * 1.1, s * 0.9, s]} rotation={[i, i * 2.1, 0]} castShadow receiveShadow />
        ))}
        <Scatter geo={data.fringe} items={data.fringeItems} mat={FRINGE_MAT} />
        {/* the fruit: never a shape, only warm light hidden in the leaves */}
        {data.orbs.map((p, i) => (
          <mesh key={i} position={p} scale={0.09 + 0.015 * Math.sin(t * 2 + i)}>
            <icosahedronGeometry args={[1, 1]} />
            <meshBasicMaterial color={new THREE.Color('#FFD98A').multiplyScalar(1 + glow * 5)} toneMapped={false} transparent opacity={0.35 + glow * 0.65} />
          </mesh>
        ))}
      </group>
    </group>
  );
};

// ---------- birds and butterflies ----------
const Birds: React.FC<{t: number; count: number}> = ({t, count}) => (
  <group>
    {Array.from({length: count}, (_, i) => {
      const sp = 1.6 + rand(101, i);
      const x = -30 + ((t * sp * 2.2 + rand(102, i) * 60) % 60);
      const y = 9 + rand(103, i) * 5 + Math.sin(t + i) * 0.4;
      const z = -18 - rand(104, i) * 14;
      const flap = Math.sin(t * 9 + i * 2) * 0.6;
      return (
        <group key={i} position={[x, y, z]} scale={0.35}>
          <mesh rotation={[0, 0, flap]} position={[0.35, 0, 0]}><boxGeometry args={[0.7, 0.03, 0.18]} /><meshBasicMaterial color="#5A4A3A" /></mesh>
          <mesh rotation={[0, 0, -flap]} position={[-0.35, 0, 0]}><boxGeometry args={[0.7, 0.03, 0.18]} /><meshBasicMaterial color="#5A4A3A" /></mesh>
        </group>
      );
    })}
  </group>
);

export const Butterflies: React.FC<{t: number; center: [number, number, number]; count?: number; spread?: number}> = ({t, center, count = 4, spread = 2}) => (
  <group>
    {Array.from({length: count}, (_, i) => {
      const a = t * (0.5 + rand(111, i) * 0.4) + i * 1.7;
      const p: [number, number, number] = [center[0] + Math.cos(a) * spread * (0.5 + rand(112, i)), center[1] + Math.sin(a * 1.7) * 0.35 + rand(113, i) * 0.6, center[2] + Math.sin(a) * spread * 0.6];
      const flap = Math.abs(Math.sin(t * 14 + i)) * 1.1;
      const col = ['#F6D35B', '#FFFFFF', '#F29B54', '#9FD3F0'][i % 4];
      return (
        <group key={i} position={p} rotation={[0, a, 0]} scale={0.6}>
          <mesh rotation={[0, 0, flap]} position={[0.05, 0, 0]}><planeGeometry args={[0.1, 0.08]} /><meshBasicMaterial color={col} side={THREE.DoubleSide} /></mesh>
          <mesh rotation={[0, 0, -flap]} position={[-0.05, 0, 0]}><planeGeometry args={[0.1, 0.08]} /><meshBasicMaterial color={col} side={THREE.DoubleSide} /></mesh>
        </group>
      );
    })}
  </group>
);

// ---------- leafy foreground plants (sit close to camera, blurred by depth of field) ----------
const FG_LEAF = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.lineTo(0.09, 0.12); s.lineTo(0.1, 0.3); s.lineTo(0, 0.48); s.lineTo(-0.1, 0.3); s.lineTo(-0.09, 0.12); s.lineTo(0, 0);
  const g = new THREE.ShapeGeometry(s);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.abs(p.getX(i)) * 0.4 + p.getY(i) * p.getY(i) * 0.5);
  return faceted(g, {seed: 120, colorAt: (c) => new THREE.Color(c.x > 0 ? '#7DB23E' : '#5C9230')});
})();
const FG_FLOWER = faceted(new THREE.IcosahedronGeometry(0.06, 0), {seed: 121, palette: ['#ffffff']});
const FG_MAT = flatMat({roughness: 0.7, side: THREE.DoubleSide, emissive: new THREE.Color('#5E8F2A'), emissiveIntensity: 0.18});
export const FgPlants: React.FC<{items: {p: [number, number, number]; s?: number; flowers?: string[]}[]; t: number; wind?: number}> = ({items, t, wind = 1}) => (
  <group>
    {items.map((it, i) => (
      <group key={i} position={it.p} scale={it.s ?? 1}>
        {Array.from({length: 8}, (_, k) => {
          const a = (k / 8) * Math.PI * 2 + rand(122, i * 10 + k);
          const tilt = 0.5 + rand(123, i * 10 + k) * 0.5 + Math.sin(t * 1.3 + k + i) * 0.05 * wind;
          return <mesh key={k} geometry={FG_LEAF} material={FG_MAT} rotation={[tilt, a, 0]} scale={0.7 + rand(124, i * 10 + k) * 0.6} />;
        })}
        {(it.flowers ?? []).map((c, k) => (
          <mesh key={k} geometry={FG_FLOWER} position={[Math.cos(k * 2.3) * 0.14, 0.3 + (k % 3) * 0.08, Math.sin(k * 2.3) * 0.14]}>
            <meshStandardMaterial color={c} flatShading roughness={0.6} emissive={c} emissiveIntensity={0.15} />
          </mesh>
        ))}
      </group>
    ))}
  </group>
);

// ---------- contact shadow ----------
export const ContactShadow: React.FC<{p: [number, number, number]; r?: number; o?: number}> = ({p, r = 0.45, o = 0.45}) => (
  <mesh position={[p[0], groundHeight(p[0], p[2]) + 0.015, p[2]]} rotation={[-Math.PI / 2, 0, 0]}>
    <planeGeometry args={[r * 2, r * 1.4]} />
    <meshBasicMaterial map={softDiscTexture()} color="#1E2A0E" transparent opacity={o} depthWrite={false} />
  </mesh>
);
export {groundHeight};

// ---------- whole world ----------
export const SceneFog: React.FC<{color: THREE.ColorRepresentation; near: number; far: number}> = ({color, near, far}) => {
  const {scene} = useThree();
  useLayoutEffect(() => {
    scene.fog = new THREE.Fog(color, near, far);
  });
  return null;
};

export const EdenWorld: React.FC<{t: number; drain?: number; wind?: number; glow?: number; birds?: number}> = ({t, drain = 0, wind = 1, glow = 1, birds = 6}) => {
  const sun = useMemo(() => {
    const l = new THREE.DirectionalLight('#FFC978', 3.6);
    l.position.copy(SUN_DIR.clone().multiplyScalar(26)).add(new THREE.Vector3(1, 0, 0));
    l.target.position.set(1, 0, 0.5);
    l.castShadow = true;
    l.shadow.mapSize.set(quality().shadow, quality().shadow);
    const c = l.shadow.camera as THREE.OrthographicCamera;
    c.left = -9; c.right = 9; c.top = 9; c.bottom = -9; c.near = 1; c.far = 70;
    l.shadow.bias = -0.0004;
    l.shadow.normalBias = 0.03;
    return l;
  }, []);
  return (
    <group>
      <SceneFog color={new THREE.Color('#F5D493').lerp(new THREE.Color('#B9B3A6'), drain)} near={16 - drain * 5} far={150 - drain * 40} />
      <Sky drain={drain} />
      <mesh position={SUN_POS}>
        <sphereGeometry args={[13, 20, 14]} />
        <meshBasicMaterial color={new THREE.Color('#FFF4D6').multiplyScalar(2.2 - drain * 1.2)} fog={false} toneMapped={false} />
      </mesh>
      <primitive object={sun} />
      <primitive object={sun.target} />
      <hemisphereLight args={['#FFE1A8', '#5B7426', 1.25 - drain * 0.35]} />
      <directionalLight position={[2, 3, 10]} intensity={0.75 - drain * 0.3} color="#FFD9A8" />
      <ambientLight intensity={0.22} color="#FFF2DA" />
      <Ground />
      <River t={t} />
      <Vegetation />
      <Distance t={t} />
      <SpecialTree t={t} glow={glow} wind={wind} />
      <Birds t={t} count={birds} />
    </group>
  );
};
