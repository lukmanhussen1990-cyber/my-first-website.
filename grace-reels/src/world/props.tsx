import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { clamp, Vec3 } from "../lib/math";
import { hash1, noise1, rngFrom } from "../lib/random";
import { facet, hex, lambert, RGB } from "./models";

// Story props, all low-poly and built in code. Animated props take `t` (seconds) and are pure.

const shade = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];

function box(w: number, h: number, d: number, color: string, at: Vec3, rot: Vec3 = [0, 0, 0], k = 1) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.rotateX(rot[0]);
  g.rotateY(rot[1]);
  g.rotateZ(rot[2]);
  g.translate(...at);
  return facet(g, (p, i) => shade(hex(color), k * (0.92 + (i % 4) * 0.03)));
}
function cyl(rt: number, rb: number, h: number, color: string, at: Vec3, rot: Vec3 = [0, 0, 0], seg = 5) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1);
  g.translate(0, -h / 2, 0); // pivot at top
  g.rotateX(rot[0]);
  g.rotateY(rot[1]);
  g.rotateZ(rot[2]);
  g.translate(...at);
  return facet(g, hex(color));
}

const MAT = lambert();

// ------------------------------------------------------------------ donkey

export type AnimalPose = { pos: Vec3; heading: number; walk: number; walkAmt: number; t: number; seed?: number; scale?: number };

export const Donkey: React.FC<{ pose: AnimalPose }> = ({ pose }) => {
  const rig = useMemo(() => {
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    const coat = "#8f8375";
    const belly = "#d3cabb";
    const parts = [
      box(1.05, 0.46, 0.42, coat, [0, 0.82, 0]),
      box(0.5, 0.3, 0.44, belly, [0, 0.66, 0]),
      box(0.62, 0.06, 0.46, "#a5473a", [-0.05, 1.06, 0]), // blanket
      box(0.28, 0.32, 0.5, "#7a5236", [-0.12, 0.88, 0]), // saddle bags
      cyl(0.03, 0.015, 0.32, "#5a4636", [-0.53, 0.96, 0], [0, 0, -0.9], 4), // tail
    ];
    body.add(new THREE.Mesh(mergeGeometries(parts)!, MAT));
    const neck = new THREE.Group();
    neck.position.set(0.48, 0.98, 0);
    body.add(neck);
    const headParts = [
      box(0.34, 0.2, 0.2, coat, [0.12, 0.12, 0], [0, 0, 0.9]),
      box(0.36, 0.17, 0.17, coat, [0.32, 0.22, 0], [0, 0, -0.35]),
      box(0.14, 0.13, 0.15, belly, [0.48, 0.15, 0], [0, 0, -0.35]),
      cyl(0.035, 0.012, 0.26, coat, [0.2, 0.36, 0.06], [Math.PI + 0.3, 0, 0.35], 4),
      cyl(0.035, 0.012, 0.26, coat, [0.2, 0.36, -0.06], [Math.PI - 0.3, 0, 0.35], 4),
      box(0.05, 0.05, 0.05, "#d9b44a", [0.05, -0.06, 0]), // tiny bell
    ];
    neck.add(new THREE.Mesh(mergeGeometries(headParts)!, MAT));
    const legs: THREE.Group[] = [];
    for (const [x, z] of [[0.38, 0.14], [0.38, -0.14], [-0.36, 0.14], [-0.36, -0.14]]) {
      const g = new THREE.Group();
      g.position.set(x, 0.66, z);
      const geo = mergeGeometries([cyl(0.05, 0.04, 0.6, coat, [0, 0, 0]), cyl(0.045, 0.045, 0.07, "#3b2f26", [0, -0.58, 0])])!;
      g.add(new THREE.Mesh(geo, MAT));
      body.add(g);
      legs.push(g);
    }
    root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return { root, body, neck, legs };
  }, []);
  useLayoutEffect(() => {
    const { root, body, neck, legs } = rig;
    root.position.set(...pose.pos);
    root.rotation.set(0, pose.heading, 0);
    root.scale.setScalar(pose.scale ?? 1);
    const s = Math.sin(pose.walk) * pose.walkAmt;
    legs[0].rotation.z = s * 0.4;
    legs[3].rotation.z = s * 0.4;
    legs[1].rotation.z = -s * 0.4;
    legs[2].rotation.z = -s * 0.4;
    body.position.y = Math.abs(Math.cos(pose.walk)) * 0.025 * pose.walkAmt;
    neck.rotation.z = Math.sin(pose.walk * 2) * 0.05 * pose.walkAmt + noise1(pose.t * 0.4, 5) * 0.06;
  });
  return <primitive object={rig.root} />;
};

// ------------------------------------------------------------------ ram

export const Ram: React.FC<{ pos: Vec3; heading: number; t: number; struggle?: number }> = ({ pos, heading, t, struggle = 0 }) => {
  const rig = useMemo(() => {
    const root = new THREE.Group();
    const wool = "#ebe3d2";
    const r = rngFrom(41);
    const fleece: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 7; i++) {
      const g = new THREE.IcosahedronGeometry(r.range(0.2, 0.28), 1);
      g.translate(r.range(-0.32, 0.32), 0.7 + r.range(-0.08, 0.1), r.range(-0.12, 0.12));
      fleece.push(facet(g, (p, k) => shade(hex(wool), 0.88 + ((k * 13) % 9) / 60)));
    }
    root.add(new THREE.Mesh(mergeGeometries(fleece)!, MAT));
    const head = new THREE.Group();
    head.position.set(0.42, 0.82, 0);
    root.add(head);
    const horn = (side: number) => {
      const g = new THREE.TorusGeometry(0.1, 0.035, 4, 10, Math.PI * 1.55);
      g.rotateY(Math.PI / 2);
      g.rotateX(side * 0.3);
      g.translate(0.0, 0.08, side * 0.11);
      return facet(g, hex("#c7ae84"));
    };
    head.add(new THREE.Mesh(mergeGeometries([
      box(0.26, 0.17, 0.15, "#5a463a", [0.08, 0.0, 0], [0, 0, -0.5]),
      box(0.1, 0.1, 0.12, "#4a3a2f", [0.2, -0.06, 0], [0, 0, -0.5]),
      horn(1),
      horn(-1),
    ])!, MAT));
    for (const [x, z] of [[0.25, 0.09], [0.25, -0.09], [-0.25, 0.09], [-0.25, -0.09]]) {
      const g = cyl(0.035, 0.03, 0.5, "#4a3a2f", [x, 0.52, z]);
      root.add(new THREE.Mesh(g, MAT));
    }
    root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return { root, head };
  }, []);
  useLayoutEffect(() => {
    rig.root.position.set(...pos);
    rig.root.rotation.set(0, heading, 0);
    rig.head.rotation.z = Math.sin(t * 3.1) * 0.12 * struggle + noise1(t * 0.5, 9) * 0.08;
    rig.head.rotation.y = noise1(t * 0.3, 19) * 0.25;
  });
  return <primitive object={rig.root} />;
};

// ------------------------------------------------------------------ fire pot

export const FirePot: React.FC<{ pos: Vec3; t: number; light?: number }> = ({ pos, t, light = 1 }) => {
  const rig = useMemo(() => {
    const root = new THREE.Group();
    const pts = [
      new THREE.Vector2(0.0, 0.0), new THREE.Vector2(0.06, 0.0), new THREE.Vector2(0.09, 0.05),
      new THREE.Vector2(0.085, 0.11), new THREE.Vector2(0.06, 0.14), new THREE.Vector2(0.065, 0.16), new THREE.Vector2(0.05, 0.16),
    ];
    const pot = new THREE.Mesh(facet(new THREE.LatheGeometry(pts, 7), hex("#9a5636")), MAT);
    pot.castShadow = true;
    root.add(pot);
    const handle = new THREE.Mesh(facet(new THREE.TorusGeometry(0.07, 0.008, 3, 8, Math.PI), hex("#5b3b26")), MAT);
    handle.position.y = 0.16;
    root.add(handle);
    const flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4.0, 1.7, 0.45), transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending });
    const coreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(5.0, 3.6, 1.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.2, 6), flameMat);
    const core = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.11, 5), coreMat);
    flame.position.y = 0.25;
    core.position.y = 0.21;
    root.add(flame, core);
    const pl = new THREE.PointLight("#ff9a4a", 2, 4, 1.6);
    pl.position.y = 0.32;
    root.add(pl);
    return { root, flame, core, pl };
  }, []);
  useLayoutEffect(() => {
    rig.root.position.set(...pos);
    const f = 0.75 + 0.25 * noise1(t * 9, 3) + 0.12 * noise1(t * 23, 7);
    rig.flame.scale.set(0.9 + 0.2 * noise1(t * 11, 1), f * 1.15, 0.9 + 0.2 * noise1(t * 13, 2));
    rig.flame.rotation.z = noise1(t * 6, 4) * 0.18;
    rig.core.scale.set(1, 0.8 + 0.3 * noise1(t * 17, 5), 1);
    rig.pl.intensity = (1.5 + 0.9 * f) * light;
  });
  return <primitive object={rig.root} />;
};

// ------------------------------------------------------------------ altar, tent, cross

export function altarGeometry(seed: number) {
  const r = rngFrom(seed);
  const parts: THREE.BufferGeometry[] = [];
  const stone = ["#a79a88", "#958775", "#b3a692", "#8c7f6d"];
  for (let layer = 0; layer < 3; layer++)
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 2; j++) {
        const w = r.range(0.34, 0.42);
        const g = new THREE.DodecahedronGeometry(0.24, 0);
        g.scale(w / 0.24 / 1.6, 0.6, 0.85);
        g.translate(-0.6 + i * 0.4 + r.range(-0.03, 0.03), 0.14 + layer * 0.24, -0.2 + j * 0.4 + r.range(-0.03, 0.03));
        parts.push(facet(g, (_p, k) => shade(hex(r.pick(stone)), 0.9 + (k % 3) * 0.05)));
      }
  // flat top slab
  parts.push(box(1.62, 0.08, 0.86, "#b9ac97", [0, 0.8, 0]));
  return mergeGeometries(parts)!;
}

export function woodStackGeometry(seed: number) {
  const r = rngFrom(seed);
  const parts: THREE.BufferGeometry[] = [];
  for (let layer = 0; layer < 2; layer++)
    for (let i = 0; i < 4; i++) {
      const g = new THREE.CylinderGeometry(0.05, 0.055, 1.3, 6, 1);
      g.rotateZ(Math.PI / 2);
      if (layer === 1) g.rotateY(Math.PI / 2 + r.range(-0.1, 0.1));
      g.translate(layer === 0 ? 0 : -0.45 + i * 0.3, 0.06 + layer * 0.1, layer === 0 ? -0.27 + i * 0.18 : 0);
      if (layer === 1) g.scale(1, 1, 0.55);
      parts.push(facet(g, shade(hex("#8a5d3a"), r.range(0.85, 1.1))));
    }
  return mergeGeometries(parts)!;
}

export function tentGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  // ridge tent: two sloped roof panels with stripes + back wall
  const stripes = ["#5b3a2a", "#d8c5a0"];
  const L = 3.2;
  const n = 8;
  for (let i = 0; i < n; i++) {
    for (const side of [-1, 1]) {
      const g = new THREE.BufferGeometry();
      const x0 = -L / 2 + (i * L) / n;
      const x1 = -L / 2 + ((i + 1) * L) / n;
      const v = side > 0
        ? [x0, 1.7, 0, x0, 0, 1.4, x1, 0, 1.4, x0, 1.7, 0, x1, 0, 1.4, x1, 1.7, 0]
        : [x0, 1.7, 0, x1, 0, -1.4, x0, 0, -1.4, x0, 1.7, 0, x1, 1.7, 0, x1, 0, -1.4];
      g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
      parts.push(facet(g, shade(hex(stripes[i % 2]), side > 0 ? 1 : 0.8)));
    }
  }
  // back wall (triangle) and dark door
  const back = new THREE.BufferGeometry();
  back.setAttribute("position", new THREE.Float32BufferAttribute([-L / 2, 0, -1.4, -L / 2, 0, 1.4, -L / 2, 1.7, 0], 3));
  parts.push(facet(back, hex("#4d3123")));
  const door = new THREE.BufferGeometry();
  door.setAttribute("position", new THREE.Float32BufferAttribute([L / 2 + 0.01, 0, -0.55, L / 2 + 0.01, 1.2, 0, L / 2 + 0.01, 0, 0.55], 3));
  parts.push(facet(door, hex("#24160f")));
  const front = new THREE.BufferGeometry();
  front.setAttribute("position", new THREE.Float32BufferAttribute([L / 2, 0, -1.4, L / 2, 1.7, 0, L / 2, 0, 1.4], 3));
  parts.push(facet(front, hex("#6e4a35")));
  parts.push(cyl(0.03, 0.03, 2.1, "#5a3e28", [L / 2 + 0.05, 2.05, 0]));
  return mergeGeometries(parts)!;
}

export function crossGeometry() {
  return mergeGeometries([
    box(0.2, 3.3, 0.18, "#6e4a30", [0, 1.65, 0]),
    box(1.75, 0.18, 0.17, "#7a5236", [0, 2.45, 0.0]),
    box(0.3, 0.12, 0.3, "#5e4029", [0, 0.06, 0]),
  ])!;
}

// ------------------------------------------------------------------ light beam + gold dust

const beamVert = /* glsl */ `
  varying vec3 vN; varying vec3 vV; varying float vY;
  void main() {
    vY = uv.y;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vN = normalize(mat3(modelMatrix) * normal);
    vV = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;
const beamFrag = /* glsl */ `
  uniform vec3 color; uniform float strength;
  varying vec3 vN; varying vec3 vV; varying float vY;
  void main() {
    float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);
    float fade = smoothstep(0.0, 0.25, vY) * (1.0 - smoothstep(0.75, 1.0, vY) * 0.6);
    gl_FragColor = vec4(color * edge * fade * strength, 1.0);
  }`;

export const LightBeam: React.FC<{ pos: Vec3; strength: number; height?: number; radius?: number; color?: string }> = ({ pos, strength, height = 34, radius = 1.6, color = "#fff1cf" }) => {
  const rig = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      uniforms: { color: { value: new THREE.Color(color) }, strength: { value: 1 } },
      vertexShader: beamVert,
      fragmentShader: beamFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const g = new THREE.CylinderGeometry(radius * 0.45, radius, height, 28, 1, true);
    g.translate(0, height / 2, 0);
    const beam = new THREE.Mesh(g, mat);
    beam.frustumCulled = false;
    const glowTex = radialTexture();
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(radius * 1.9, 40),
      new THREE.MeshBasicMaterial({ map: glowTex, color: new THREE.Color(color), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.03;
    const root = new THREE.Group();
    root.add(beam, disc);
    return { root, mat, disc };
  }, [height, radius, color]);
  useLayoutEffect(() => {
    rig.root.position.set(...pos);
    rig.root.visible = strength > 0.001;
    rig.mat.uniforms.strength.value = strength * 0.62;
    (rig.disc.material as THREE.MeshBasicMaterial).opacity = clamp(strength) * 0.38;
  });
  return <primitive object={rig.root} />;
};

let radialCache: THREE.CanvasTexture | null = null;
export function radialTexture() {
  if (radialCache) return radialCache;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.45)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  radialCache = new THREE.CanvasTexture(c);
  return radialCache;
}

/** Floating golden dust: seeded particles drifting upward in a column (pure function of t). */
export const GoldDust: React.FC<{ center: Vec3; radius: number; height: number; count?: number; t: number; amount: number; seed?: number; size?: number }> = ({
  center, radius, height, count = 140, t, amount, seed = 3, size = 0.09,
}) => {
  const rig = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3));
    const m = new THREE.PointsMaterial({
      map: radialTexture(), color: new THREE.Color(3.2, 2.4, 1.1), size, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, sizeAttenuation: true,
    });
    const p = new THREE.Points(g, m);
    p.frustumCulled = false;
    return { p, g, m };
  }, [count, size]);
  useLayoutEffect(() => {
    const pos = rig.g.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < count; i++) {
      const a = hash1(seed * 1000 + i) * Math.PI * 2;
      const rr = Math.sqrt(hash1(seed * 2000 + i)) * radius;
      const speed = 0.12 + hash1(seed * 3000 + i) * 0.25;
      const y = ((hash1(seed * 4000 + i) * height + t * speed) % height);
      const wob = noise1(t * 0.3 + i, seed) * 0.25;
      pos.setXYZ(i, center[0] + Math.cos(a + wob) * rr, center[1] + y, center[2] + Math.sin(a + wob) * rr);
    }
    pos.needsUpdate = true;
    rig.m.opacity = clamp(amount);
    rig.p.visible = amount > 0.001;
  });
  return <primitive object={rig.p} />;
};

export const GoldRing: React.FC<{ pos: Vec3; k: number; radius?: number }> = ({ pos, k, radius = 1.05 }) => {
  const rig = useMemo(() => {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.0, 64),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(3.0, 2.1, 0.7), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
    );
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(1.35, 48),
      new THREE.MeshBasicMaterial({ map: radialTexture(), color: new THREE.Color(1.6, 1.1, 0.4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    ring.rotation.x = glow.rotation.x = -Math.PI / 2;
    glow.position.y = -0.01;
    const root = new THREE.Group();
    root.add(glow, ring);
    return { root, ring, glow };
  }, []);
  useLayoutEffect(() => {
    rig.root.position.set(...pos);
    const e = 1 - Math.pow(1 - clamp(k), 3);
    rig.root.scale.setScalar(radius * (0.4 + 0.6 * e));
    (rig.ring.material as THREE.MeshBasicMaterial).opacity = e;
    (rig.glow.material as THREE.MeshBasicMaterial).opacity = e * 0.7;
    rig.root.visible = k > 0.001;
  });
  return <primitive object={rig.root} />;
};

// ------------------------------------------------------------------ sky bodies

export const SkyBody: React.FC<{ pos: Vec3; kind: "sun" | "moon"; size: number; glow?: number; visible?: boolean }> = ({ pos, kind, size, glow = 1, visible = true }) => {
  const rig = useMemo(() => {
    const color = kind === "sun" ? new THREE.Color(6, 4.6, 2.6) : new THREE.Color(1.7, 1.8, 2.0);
    const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshBasicMaterial({ color, fog: false }));
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: radialTexture(), color: kind === "sun" ? new THREE.Color(2.2, 1.5, 0.8) : new THREE.Color(0.6, 0.7, 0.9),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    }));
    halo.scale.setScalar(7);
    const root = new THREE.Group();
    root.add(halo, ball);
    return { root, halo };
  }, [kind]);
  useLayoutEffect(() => {
    rig.root.position.set(...pos);
    rig.root.scale.setScalar(size);
    rig.root.visible = visible;
    (rig.halo.material as THREE.SpriteMaterial).opacity = glow;
  });
  return <primitive object={rig.root} />;
};

export const Stars: React.FC<{ amount: number; seed?: number; count?: number }> = ({ amount, seed = 11, count = 420 }) => {
  const rig = useMemo(() => {
    const r = rngFrom(seed);
    const pts = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const az = r.range(0, Math.PI * 2);
      const el = Math.asin(r.range(0.12, 1));
      pts.set([Math.cos(el) * Math.sin(az) * 520, Math.sin(el) * 520, Math.cos(el) * Math.cos(az) * 520], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    const m = new THREE.PointsMaterial({ color: new THREE.Color(1.6, 1.6, 1.8), size: 2.2, sizeAttenuation: false, transparent: true, depthWrite: false, fog: false });
    const p = new THREE.Points(g, m);
    p.frustumCulled = false;
    p.renderOrder = -9;
    return { p, m };
  }, [seed, count]);
  useLayoutEffect(() => {
    rig.m.opacity = clamp(amount);
    rig.p.visible = amount > 0.001;
  });
  return <primitive object={rig.p} />;
};
