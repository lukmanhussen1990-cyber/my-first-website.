// Stateless particles: every particle's position is a closed-form function of time, so any frame can
// be rendered independently (parallel workers) and motion is perfectly smooth.
import * as THREE from 'three';
import { std, glowMaterial, tex, G } from '../lib/materials.js';
import { hash1, fbm2, clamp } from '../lib/util.js';

const GRAV = -14;

// ballistic flight with one damped bounce on a floor, then resting
function ballistic(out, p0, v, age, floorY) {
  let x = p0.x + v.x * age, y = p0.y + v.y * age + 0.5 * GRAV * age * age, z = p0.z + v.z * age;
  if (y < floorY) {
    // first impact time
    const a = 0.5 * GRAV, b = v.y, c = p0.y - floorY;
    const disc = b * b - 4 * a * c;
    const th = disc > 0 ? (-b - Math.sqrt(disc)) / (2 * a) : age;
    const vyHit = v.y + GRAV * th;
    const vb = -vyHit * 0.28; // restitution
    const t2 = age - th;
    const tb = (2 * vb) / -GRAV; // flight time of the bounce
    const fr = 0.35;
    const hx = p0.x + v.x * th, hz = p0.z + v.z * th;
    if (t2 < tb) { x = hx + v.x * fr * t2; z = hz + v.z * fr * t2; y = floorY + vb * t2 + 0.5 * GRAV * t2 * t2; }
    else { x = hx + v.x * fr * tb; z = hz + v.z * fr * tb; y = floorY; }
  }
  return out.set(x, y, z);
}

export function buildParticles(scene) {
  const S = { emitters: [] };
  const clodG = new THREE.IcosahedronGeometry(1, 1);
  const pg = clodG.attributes.position;
  for (let i = 0; i < pg.count; i++) { const x = pg.getX(i), y = pg.getY(i), z = pg.getZ(i); const k = 0.75 + 0.5 * fbm2(x * 2 + 1, y * 2 + z, 2); pg.setXYZ(i, x * k, y * k * 0.8, z * k); }
  clodG.computeVertexNormals();
  const rockG = new THREE.DodecahedronGeometry(1, 0);
  const sparkG = new THREE.CapsuleGeometry(0.018, 1, 2, 4);
  const N = 900;
  S.clods = new THREE.InstancedMesh(clodG, std({ map: tex('soil_albedo', { srgb: true }), color: 0xb08a68, roughness: 0.95 }, 'clod'), N);
  S.rocks = new THREE.InstancedMesh(rockG, std({ map: tex('rock_albedo', { srgb: true }), normalMap: tex('rock_normal'), color: 0x8f8f94, roughness: 0.85 }, 'chunk'), N);
  S.sparks = new THREE.InstancedMesh(sparkG, glowMaterial('#ffb347', 9, 'spark'), 600);
  for (const m of [S.clods, S.rocks]) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; scene.add(m); }
  S.sparks.frustumCulled = false; scene.add(S.sparks);

  // dust: camera-facing soft puffs (custom instanced billboard shader, lit by sun colour)
  const DN = 700;
  const dg = new THREE.InstancedBufferGeometry();
  dg.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
  dg.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  dg.setIndex([0, 1, 2, 0, 2, 3]);
  S.dPos = new Float32Array(DN * 4); S.dCol = new Float32Array(DN * 4);
  dg.setAttribute('iPos', new THREE.InstancedBufferAttribute(S.dPos, 4));
  dg.setAttribute('iCol', new THREE.InstancedBufferAttribute(S.dCol, 4));
  dg.instanceCount = 0;
  const dm = new THREE.ShaderMaterial({
    uniforms: { tDust: { value: tex('dust_sprite') }, uLight: { value: new THREE.Color(1.0, 0.85, 0.7) } },
    transparent: true, depthWrite: false,
    vertexShader: `
      attribute vec4 iPos; attribute vec4 iCol; varying vec2 vUv; varying vec4 vCol;
      void main(){
        vUv = uv; vCol = iCol;
        vec4 mv = viewMatrix * vec4(iPos.xyz, 1.0);
        float a = iCol.a * 0.0 + iPos.w * 3.1;
        mv.xy += mat2(cos(a), -sin(a), sin(a), cos(a)) * position.xy * iPos.w;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D tDust; uniform vec3 uLight; varying vec2 vUv; varying vec4 vCol;
      void main(){
        float a = texture2D(tDust, vUv).a * vCol.a;
        if (a < 0.004) discard;
        gl_FragColor = vec4(vCol.rgb * uLight, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  S.dust = new THREE.Mesh(dg, dm); S.dust.frustumCulled = false; S.dust.renderOrder = 10; scene.add(S.dust);
  S.dustMat = dm;
  S.max = { clod: N, rock: N, spark: 600, dust: DN };
  return S;
}

// emitter spec: { id, kind:'clod'|'rock'|'spark'|'dust', t0, t1, rate, origin:(t)=>Vector3, vel:[vx,vy,vz], spread:[sx,sy,sz],
//                 size:[min,max], life, floorY:(x)=>y | number, color:[r,g,b], grow }
export function updateParticles(S, emitters, t) {
  const o = new THREE.Object3D();
  const p0 = new THREE.Vector3(), v = new THREE.Vector3(), p = new THREE.Vector3();
  const counts = { clod: 0, rock: 0, spark: 0, dust: 0 };
  const target = { clod: S.clods, rock: S.rocks, spark: S.sparks };
  const cap = S.max;
  for (const e of emitters) {
    const total = Math.ceil((e.t1 - e.t0) * e.rate);
    for (let i = 0; i < total; i++) {
      const ts = e.t0 + i / e.rate + (hash1(e.id * 977 + i) - 0.5) / e.rate * 0.8;
      const age = t - ts;
      if (age < 0 || age > e.life) continue;
      if (counts[e.kind] >= cap[e.kind]) continue;
      const h = (k) => hash1(e.id * 131 + i * 17 + k * 7.3);
      p0.copy(e.origin(ts, i));
      const sp = e.spread || [1, 1, 1];
      v.set(e.vel[0] + (h(1) - 0.5) * 2 * sp[0], e.vel[1] + (h(2) - 0.5) * 2 * sp[1], e.vel[2] + (h(3) - 0.5) * 2 * sp[2]);
      const size = e.size[0] + (e.size[1] - e.size[0]) * h(4) ** 2;
      const floorY = typeof e.floorY === 'function' ? e.floorY(p0.x) : (e.floorY ?? -1e9);
      if (e.kind === 'dust') {
        const k = counts.dust++;
        const drag = 1 - Math.exp(-age * 1.6);
        p.set(p0.x + v.x * drag / 1.6, p0.y + v.y * drag / 1.6 + age * 0.25, p0.z + v.z * drag / 1.6);
        const life = age / e.life;
        const alpha = clamp(life * 6) * (1 - life) ** 1.5 * (e.alpha ?? 0.5);
        const c = e.color || [0.75, 0.62, 0.48];
        S.dPos.set([p.x, p.y, p.z, size * (1 + age * (e.grow ?? 1.2))], k * 4);
        S.dCol.set([c[0], c[1], c[2], alpha], k * 4);
        continue;
      }
      if (e.kind === 'spark') {
        // sparks fly straight-ish and fade; oriented along velocity, stretched
        const k = counts.spark++;
        const a2 = age;
        p.set(p0.x + v.x * a2, p0.y + v.y * a2 + 0.5 * GRAV * 0.35 * a2 * a2, p0.z + v.z * a2);
        const vy = v.y + GRAV * 0.35 * a2;
        const dir = new THREE.Vector3(v.x, vy, v.z).normalize();
        o.position.copy(p);
        o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        const fade = 1 - age / e.life;
        o.scale.set(fade, 0.12 + 0.25 * fade, fade);
        o.updateMatrix(); S.sparks.setMatrixAt(k, o.matrix);
        continue;
      }
      const k = counts[e.kind]++;
      ballistic(p, p0, v, age, floorY + size * 0.6);
      o.position.copy(p);
      const settled = p.y <= floorY + size * 0.6 + 1e-3;
      const spinT = settled ? Math.min(age, 0.6) : age;
      o.rotation.set(h(5) * 6 + spinT * (h(6) - 0.5) * 12, h(7) * 6 + spinT * (h(8) - 0.5) * 12, 0);
      // shrink away at the end of life (cleaned up / carried off)
      const tail = clamp((e.life - age) / 0.5);
      o.scale.setScalar(size * tail);
      o.updateMatrix(); target[e.kind].setMatrixAt(k, o.matrix);
    }
  }
  S.clods.count = counts.clod; S.rocks.count = counts.rock; S.sparks.count = counts.spark;
  S.clods.instanceMatrix.needsUpdate = S.rocks.instanceMatrix.needsUpdate = S.sparks.instanceMatrix.needsUpdate = true;
  S.dust.geometry.instanceCount = counts.dust;
  S.dust.geometry.attributes.iPos.needsUpdate = true; S.dust.geometry.attributes.iCol.needsUpdate = true;
}
