// S13 / S14a — the good news. A slow warm turn from cold grey to gold: clouds part, a soft beam of
// light falls on a plain wooden cross on a hill (God is shown only as light; Jesus only as the cross
// in light). Golden motes drift, grass and small flowers move in the breeze.
import * as THREE from 'three';
import { makeTerrain, makeMountains, makeGrass, makeOlive, makeRock, texMat, woodTex, srgb, mixc } from '../kit.js';
import { makeRays, makeMotes, makeSprites, cloudTex, makeBirds } from '../fx.js';
import { radialTex } from '../materials.js';
import { blend, resolve } from '../moods.js';
import { clamp, smooth, invLerp, lerp, fbm, hash01, noise2 } from '../../lib/util.js';

export function buildHill(ctx) {
  const { plan } = ctx; const E = plan.ev;
  const S13 = plan.shots.find((s) => s.id === 'S13');
  const g = new THREE.Group();
  const height = (x, z) => 4.4 * Math.exp(-(x * x + z * z) / (2 * 8.5 * 8.5)) + 0.35 * fbm(x * 0.05, z * 0.05, 3, 2) + smooth(invLerp(70, 160, Math.hypot(x, z))) * 6;
  const gA = srgb('#7f8a44'), gB = srgb('#5f6a34'), gC = srgb('#a49a58');
  g.add(makeTerrain({ size: 460, seg: 180, height, color: (x, z, y) => { const n = fbm(x * 0.1, z * 0.1, 3, 8); return mixc(mixc(gB, gA, smooth(0.5 + n)), gC, smooth(invLerp(0.15, 0.55, n))); } }));
  g.add(makeMountains({ seed: 12, n: 22, r0: 150, r1: 270, h0: 10, h1: 30, color: '#8a8a8e' }));
  g.add(makeGrass(4200, [-20, -16, 20, 22], 13, '#9aa050', 0.55, height, (x, z) => Math.hypot(x, z) < 0.9));
  // small white + gold flowers in the grass (hope)
  const fl = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.05, 0), new THREE.MeshLambertMaterial({ color: '#ffffff' }), 260);
  { const m4 = new THREE.Matrix4(); for (let i = 0; i < 260; i++) { const x = (hash01(i, 1) - 0.5) * 34, z = (hash01(i, 2) - 0.5) * 34 + 4; m4.makeTranslation(x, height(x, z) + 0.32, z); fl.setMatrixAt(i, m4); fl.setColorAt(i, new THREE.Color(hash01(i, 3) > 0.5 ? '#f4f0e0' : '#f0c850')); } }
  g.add(fl);
  for (const [x, z, s, seed] of [[-11, -6, 1.3, 21], [12, -9, 1.5, 22], [-16, 6, 1.2, 23]]) { const o = makeOlive(s, seed); o.position.set(x, height(x, z), z); g.add(o); }
  for (let i = 0; i < 8; i++) { const r = makeRock(0.25 + 0.4 * hash01(i, 5), 70 + i, '#8a8478'); const a = hash01(i, 6) * 6.28, rr = 3 + 9 * hash01(i, 7); const x = Math.cos(a) * rr, z = Math.sin(a) * rr; r.position.set(x, height(x, z), z); g.add(r); }

  // the cross: plain wood, weathered
  const cross = new THREE.Group(); const top = height(0, 0); cross.position.set(0, top - 0.15, 0); g.add(cross);
  const wm = texMat('#5a3e28', woodTex());
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.24, 3.5, 0.24), wm); post.position.y = 1.75; post.castShadow = true; cross.add(post);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.22, 0.22), wm); bar.position.y = 2.55; bar.castShadow = true; cross.add(bar);
  // light: a soft vertical beam from the sky, a glow behind the cross, god rays, motes
  const beamMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { color: { value: new THREE.Color(1.0, 0.85, 0.55) }, k: { value: 1 } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; varying float vY; void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); vY = uv.y; gl_Position = projectionMatrix * viewMatrix * wp; }',
    fragmentShader: 'uniform vec3 color; uniform float k; varying vec3 vN; varying vec3 vV; varying float vY; void main(){ float f = pow(abs(dot(normalize(vN), normalize(vV))), 2.4); float v = smoothstep(0.0, 0.12, vY) * (1.0 - smoothstep(0.6, 1.0, vY) * 0.7); gl_FragColor = vec4(color * f * v * k * 0.5, 1.0); }',
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 3.6, 70, 40, 1, true), beamMat); beam.position.set(0, top + 33, 0); g.add(beam);
  const beam2 = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.5, 70, 32, 1, true), beamMat.clone()); beam2.position.copy(beam.position); g.add(beam2);
  const glow = makeSprites(4, { additive: true, fog: false, order: 2 }); g.add(glow.group);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: radialTex(), color: new THREE.Color(1.0, 0.82, 0.5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  pool.position.set(0, top + 0.06, 0); pool.scale.set(9, 9, 1); g.add(pool);
  const rays = makeRays(5, 9); g.add(rays.group);
  const motes = makeMotes(240, 51); g.add(motes.group);
  const birds = makeBirds(5, 15, '#4a3a2a'); g.add(birds.group);
  // clouds that part over the cross
  const clouds = Array.from({ length: 8 }, (_, i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.5), new THREE.MeshBasicMaterial({ map: cloudTex(1 + (i % 3)), color: new THREE.Color(1, 1, 1), transparent: true, opacity: 0.85, depthWrite: false, fog: false })); m.renderOrder = -5; g.add(m); return m; });
  const warmAt = (t) => smooth(invLerp(S13.t0 + 0.2, S13.t0 + 3.2, t));

  return {
    group: g, persons: [],
    update(t, cam) {
      const w = warmAt(t);
      beamMat.uniforms.k.value = 0.25 + 0.75 * w; beam2.material.uniforms.k.value = 0.3 + 0.9 * w;
      const p = cross.position;
      glow.begin(); glow.add(p.x, p.y + 2.4, p.z - 0.3, 5.5 + 0.3 * Math.sin(t * 0.8), 1.4 * w, 1.05 * w, 0.6 * w, 0.75); glow.add(p.x, p.y + 2.55, p.z - 0.2, 1.6, 2.0 * w, 1.7 * w, 1.1 * w, 0.8); glow.end();
      pool.material.opacity = 0.5 * w;
      rays.set(t, cam, [0.12, -1, 0.35], [
        { p: [0, top, 0], w: 3.2, len: 60, a: 0.16 }, { p: [-3.5, top - 1.5, 2], w: 2.2, len: 60, a: 0.1 }, { p: [3.8, top - 1.2, 1.5], w: 2.4, len: 60, a: 0.11 },
        { p: [-7, top - 3, 4], w: 3, len: 60, a: 0.07 }, { p: [7.5, top - 3, 3], w: 3, len: 60, a: 0.07 },
      ], 0.2 + 0.8 * w, [1.0, 0.86, 0.6]);
      motes.set(t, [0, top - 1, 0], [12, 9, 9], 0.4 + 0.9 * w, [1.0, 0.85, 0.55], 0.05);
      clouds.forEach((m, i) => {
        const side = i % 2 ? 1 : -1, part = smooth(invLerp(S13.t0, S13.t0 + 9, t));
        const x = side * (20 + 18 * hash01(i, 1) + 55 * part * (0.6 + 0.4 * hash01(i, 2))), y = 40 + 28 * hash01(i, 3), z = -150 - 60 * hash01(i, 4);
        m.position.set(x, y, z); m.lookAt(cam.position); m.scale.setScalar(90 + 60 * hash01(i, 5));
        m.material.color.setRGB(lerp(0.62, 1.15, w), lerp(0.66, 0.98, w), lerp(0.72, 0.8, w));
      });
      birds.set(t, (i, tt) => { const a = (tt - 60) * 0.12 + i * 1.2; return [Math.cos(a) * (14 + i), 14 + i * 0.8 + Math.sin(tt + i) * 0.4, Math.sin(a) * (10 + i) - 6, -a]; }, 1.3, 7);
    },
    mood(t) {
      const grey = resolve({
        sky: { top: '#5f6874', horizon: '#a9aeb4', bottom: '#7a7c7a', sunGlow: '#8a8e96' },
        sunDir: [0.12, 1, 0.35], sun: { color: '#c8d0dc', intensity: 1.4 }, hemi: { sky: '#b8c2ce', ground: '#5a5a50', intensity: 1.0 },
        fog: { color: '#9aa0a6', near: 40, far: 220 }, char: '#d8dce2',
        post: { exposure: 0.95, bloom: 0.4, bloomThreshold: 0.9, haze: 0.15, hazeColor: '#b8bcc2', tint: '#eef2f6', sat: 0.55, contrast: 1.02, vignette: 0.6, tilt: 0.3, grain: 0.034 },
      });
      const gold = resolve({
        sky: { top: '#6a7ea8', horizon: '#ffd79a', bottom: '#c8a070', band: '#ffb86a', sunGlow: '#ffd08a', sunDisk: '#000000' },
        sunDir: [0.12, 1, 0.35], sun: { color: '#ffe0a8', intensity: 3.0 }, hemi: { sky: '#ffe6c0', ground: '#7a6a3a', intensity: 1.2 },
        fog: { color: '#f2d4a0', near: 40, far: 240 }, char: '#fff0dc', wind: 0.7,
        post: { exposure: 1.02, bloom: 0.85, bloomThreshold: 0.78, haze: 0.22, hazeColor: '#ffe0b0', tint: '#fff2de', lift: '#080402', sat: 1.08, contrast: 1.04, vignette: 0.5, tilt: 0.3, grain: 0.03 },
      });
      return blend(grey, gold, warmAt(t));
    },
  };
}
