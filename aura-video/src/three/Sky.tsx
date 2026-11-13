import React, {useMemo} from 'react';
import * as THREE from 'three';
import {mulberry} from '../lib/math';
import {particleMaterial} from './materials';

export type SkyLook = {top: string; horizon: string; bottom: string; sunDir: THREE.Vector3; sunColor: string; sunSize: number; stars: number; clouds: number; cloudTint: string};

export const Sky: React.FC<{look: SkyLook}> = ({look}) => {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          top: {value: new THREE.Color()},
          horizon: {value: new THREE.Color()},
          bottom: {value: new THREE.Color()},
          sunDir: {value: new THREE.Vector3(0, 1, 0)},
          sunColor: {value: new THREE.Color()},
          sunSize: {value: 1},
        },
        vertexShader: /* glsl */ `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position.z = gl_Position.w; }`,
        fragmentShader: /* glsl */ `
          uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 sunColor; uniform float sunSize;
          varying vec3 vDir;
          void main(){
            float h = vDir.y;
            vec3 c = h > 0.0 ? mix(horizon, top, pow(clamp(h,0.0,1.0), 0.55)) : mix(horizon, bottom, clamp(-h*4.0,0.0,1.0));
            float d = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
            c += sunColor * (pow(d, 900.0/sunSize) * 6.0 + pow(d, 24.0) * 0.55 + pow(d, 4.0)*0.18);
            gl_FragColor = vec4(c, 1.0);
          }`,
      }),
    []
  );
  mat.uniforms.top.value.set(look.top);
  mat.uniforms.horizon.value.set(look.horizon);
  mat.uniforms.bottom.value.set(look.bottom);
  mat.uniforms.sunDir.value.copy(look.sunDir);
  mat.uniforms.sunColor.value.set(look.sunColor);
  mat.uniforms.sunSize.value = look.sunSize;

  const stars = useMemo(() => {
    const r = mulberry(12);
    const n = 1400;
    const pos = new Float32Array(n * 3);
    const colA = new Float32Array(n * 3);
    const size = new Float32Array(n);
    const alpha = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const u = r() * 2 - 1;
      const th = r() * Math.PI * 2;
      const y = Math.abs(u) * 0.95 + 0.05;
      const rr = Math.sqrt(1 - y * y);
      pos.set([Math.cos(th) * rr * 380, y * 380, Math.sin(th) * rr * 380], i * 3);
      colA.set([0.9 + r() * 0.1, 0.9 + r() * 0.1, 1], i * 3);
      size[i] = 0.5 + r() * 1.4;
      alpha[i] = 0.4 + r() * 0.6;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(colA, 3));
    g.setAttribute('size', new THREE.BufferAttribute(size, 1));
    g.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
    return g;
  }, []);
  const starMat = useMemo(() => {
    const m = particleMaterial();
    m.fog = false;
    return m;
  }, []);
  starMat.uniforms.uOpacity.value = look.stars;

  const clouds = useMemo(() => {
    const r = mulberry(31);
    const out: {p: [number, number, number]; s: [number, number, number]; rot: number}[] = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + r() * 0.3;
      const d = 170 + r() * 60;
      out.push({p: [Math.cos(a) * d, 45 + r() * 45, Math.sin(a) * d], s: [18 + r() * 22, 4 + r() * 5, 10 + r() * 10], rot: r() * 3});
    }
    return out;
  }, []);
  const cloudMat = useMemo(() => new THREE.MeshStandardMaterial({color: '#ffffff', flatShading: true, roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.35, fog: false, transparent: true}), []);
  cloudMat.color.set(look.cloudTint);
  cloudMat.emissive.set(look.cloudTint);
  cloudMat.opacity = look.clouds;

  return (
    <group>
      <mesh material={mat} frustumCulled={false} renderOrder={-10}>
        <sphereGeometry args={[400, 32, 16]} />
      </mesh>
      {look.stars > 0.01 && <points geometry={stars} material={starMat} frustumCulled={false} />}
      {look.clouds > 0.01 &&
        clouds.map((c, i) => (
          <group key={i} position={c.p} rotation={[0, c.rot, 0]}>
            <mesh material={cloudMat} scale={c.s}>
              <icosahedronGeometry args={[1, 1]} />
            </mesh>
            <mesh material={cloudMat} scale={[c.s[0] * 0.6, c.s[1] * 1.2, c.s[2] * 0.7]} position={[c.s[0] * 0.5, c.s[1] * 0.3, 0]}>
              <icosahedronGeometry args={[1, 1]} />
            </mesh>
            <mesh material={cloudMat} scale={[c.s[0] * 0.5, c.s[1] * 0.9, c.s[2] * 0.6]} position={[-c.s[0] * 0.55, -c.s[1] * 0.1, 2]}>
              <icosahedronGeometry args={[1, 1]} />
            </mesh>
          </group>
        ))}
    </group>
  );
};
