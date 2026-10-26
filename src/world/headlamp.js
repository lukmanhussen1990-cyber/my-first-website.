// Headlamp: a real spotlight + a soft visible beam cone + ice dust floating in it.
import * as THREE from 'three';
import { GLSL_NOISE, mulberry32 } from '../util.js';

export function createHeadlamp(tex, o = {}) {
  const angle = o.angle ?? 0.36;
  const len = o.len ?? 3.4;
  const color = new THREE.Color(o.color ?? 0xffae62);
  const light = new THREE.SpotLight(color, 0, o.distance ?? 16, angle, o.penumbra ?? 0.55, 1.4);
  const target = new THREE.Object3D();
  target.position.set(0, 0, 1);
  light.target = target;

  const group = new THREE.Group(); // local space: apex at origin, beam along +z
  group.add(light, target);

  const rad = len * Math.tan(angle * 0.92);
  const geo = new THREE.ConeGeometry(rad, len, 40, 16, true);
  geo.translate(0, -len / 2, 0);
  geo.rotateX(-Math.PI / 2);
  const beamU = {
    uColor: { value: new THREE.Vector3(color.r, color.g, color.b) },
    uInt: { value: 0 },
    uLen: { value: len },
    uTime: { value: 0 },
  };
  const beamMat = new THREE.ShaderMaterial({
    uniforms: beamU,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying float vT; varying vec3 vN; varying vec3 vV; varying vec3 vL;
      uniform float uLen;
      void main(){
        vT = clamp(position.z / uLen, 0., 1.);
        vL = position;
        vec4 mv = modelViewMatrix * vec4(position, 1.);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: GLSL_NOISE + /* glsl */ `
      uniform vec3 uColor; uniform float uInt, uTime;
      varying float vT; varying vec3 vN; varying vec3 vV; varying vec3 vL;
      void main(){
        float facing = abs(dot(normalize(vN), normalize(vV)));
        float soft = pow(facing, 1.6);
        float fall = pow(1.0 - vT, 1.4) * smoothstep(0.0, 0.06, vT);
        float haze = 0.65 + 0.7 * fbm(vec2(vL.z*1.7 - uTime*0.15, atan(vL.y, vL.x)*1.5 + uTime*0.05));
        float a = soft * fall * haze * uInt;
        gl_FragColor = vec4(uColor * a * 0.16, 1.0);
      }`,
  });
  const beam = new THREE.Mesh(geo, beamMat);
  beam.renderOrder = 10;
  beam.frustumCulled = false;
  group.add(beam);

  // dust motes inside the cone
  const N = o.dust ?? 420;
  const rnd = mulberry32(o.seed ?? 77);
  const pos = new Float32Array(N * 3), seeds = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    const z = 0.15 + Math.pow(rnd(), 0.8) * len * 0.85;
    const r = Math.sqrt(rnd()) * z * Math.tan(angle) * 1.15;
    const a = rnd() * Math.PI * 2;
    pos.set([Math.cos(a) * r, Math.sin(a) * r, z], i * 3);
    seeds.set([rnd(), rnd(), rnd(), rnd()], i * 4);
  }
  const dg = new THREE.BufferGeometry();
  dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  dg.setAttribute('seed', new THREE.BufferAttribute(seeds, 4));
  const dustU = {
    uTime: { value: 0 }, uInt: { value: 0 }, uColor: beamU.uColor, uTan: { value: Math.tan(angle) },
    tSprite: { value: tex.sprite }, uSize: { value: o.dustSize ?? 26 }, uPx: { value: 1 },
  };
  const dustMat = new THREE.ShaderMaterial({
    uniforms: dustU,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute vec4 seed; uniform float uTime, uTan, uSize, uInt, uPx; varying float vA;
      void main(){
        vec3 p = position;
        float t = uTime * (0.08 + seed.x*0.12);
        p.x += sin(t*2.0 + seed.y*30.) * 0.06 + sin(t*0.7 + seed.z*11.)*0.04;
        p.y += mod(seed.w*2.0 - t*0.25, 0.6) - 0.3;
        p.z += sin(t*1.3 + seed.x*20.) * 0.05;
        float r = length(p.xy) / max(p.z * uTan, 0.001);
        float inBeam = smoothstep(1.05, 0.55, r) * smoothstep(0.05, 0.3, p.z);
        float tw = 0.5 + 0.5*sin(uTime*(2.0+seed.y*3.0) + seed.z*40.);
        vA = inBeam * (0.35 + 0.65*tw) * uInt / (0.6 + p.z*0.6);
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        vA *= smoothstep(0.18, 0.6, -mv.z);
        gl_PointSize = min(uSize * uPx * (0.4 + seed.x) / -mv.z, 18.0 * uPx);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tSprite; uniform vec3 uColor; varying float vA;
      void main(){ float s = texture2D(tSprite, gl_PointCoord).r; gl_FragColor = vec4(mix(uColor, vec3(1.0), 0.5) * s * vA * 0.9, 1.0); }`,
  });
  const dust = new THREE.Points(dg, dustMat);
  dust.frustumCulled = false;
  dust.renderOrder = 11;
  group.add(dust);

  const lamp = {
    group, light, beam, dust, beamU, dustU, baseIntensity: o.intensity ?? 9,
    set(k, t, beamAmt = 1, dustAmt = beamAmt) {
      light.intensity = lamp.baseIntensity * k;
      beamU.uInt.value = k * beamAmt;
      dustU.uInt.value = k * dustAmt;
      beamU.uTime.value = t;
      dustU.uTime.value = t;
      beam.visible = k * beamAmt > 0.001;
      dust.visible = k * dustAmt > 0.001;
    },
  };
  return lamp;
}
