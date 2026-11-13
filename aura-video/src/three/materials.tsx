import React, {useMemo, useEffect} from 'react';
import * as THREE from 'three';

/**
 * MeshStandardMaterial + fresnel rim light + optional procedural glowing cracks (voronoi veins).
 * Used on every character so the hero gets the premium rim-lit look.
 */
export type RimOpts = {
  color: THREE.ColorRepresentation;
  rim?: THREE.ColorRepresentation;
  rimStrength?: number;
  rimPower?: number;
  roughness?: number;
  metalness?: number;
  emissive?: THREE.ColorRepresentation;
  emissiveIntensity?: number;
  crack?: number; // 0..1
  crackColor?: THREE.ColorRepresentation;
  crackScale?: number;
  side?: THREE.Side;
  flat?: boolean;
  transparent?: boolean;
  opacity?: number;
};

const CRACK_GLSL = /* glsl */ `
vec3 hash33(vec3 p){
  p = vec3(dot(p,vec3(127.1,311.7,74.7)), dot(p,vec3(269.5,183.3,246.1)), dot(p,vec3(113.5,271.9,124.6)));
  return fract(sin(p)*43758.5453123);
}
float crackEdge(vec3 p){
  vec3 i = floor(p); vec3 f = fract(p);
  float d1 = 8.0; float d2 = 8.0;
  for(int x=-1;x<=1;x++) for(int y=-1;y<=1;y++) for(int z=-1;z<=1;z++){
    vec3 g = vec3(float(x),float(y),float(z));
    vec3 o = hash33(i+g);
    vec3 r = g + o - f;
    float d = dot(r,r);
    if(d<d1){ d2=d1; d1=d; } else if(d<d2){ d2=d; }
  }
  return sqrt(d2)-sqrt(d1);
}
`;

export const makeRimMaterial = (o: RimOpts) => {
  const m = new THREE.MeshStandardMaterial({
    color: o.color,
    roughness: o.roughness ?? 0.7,
    metalness: o.metalness ?? 0,
    flatShading: o.flat ?? true,
    emissive: o.emissive ?? '#000000',
    emissiveIntensity: o.emissiveIntensity ?? 1,
    side: o.side ?? THREE.FrontSide,
    transparent: o.transparent ?? false,
    opacity: o.opacity ?? 1,
  });
  const uniforms = {
    uRimColor: {value: new THREE.Color(o.rim ?? '#ffd9a0')},
    uRimStrength: {value: o.rimStrength ?? 0},
    uRimPower: {value: o.rimPower ?? 2.6},
    uCrack: {value: o.crack ?? 0},
    uCrackColor: {value: new THREE.Color(o.crackColor ?? '#b06bff')},
    uCrackScale: {value: o.crackScale ?? 9},
  };
  m.userData.uniforms = uniforms;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObjPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjPos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform vec3 uRimColor; uniform float uRimStrength; uniform float uRimPower;
uniform float uCrack; uniform vec3 uCrackColor; uniform float uCrackScale;
varying vec3 vObjPos;
${CRACK_GLSL}`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
{
  vec3 nV = normalize(normal);
  vec3 vV = normalize(vViewPosition);
  float fr = pow(1.0 - clamp(abs(dot(nV, vV)), 0.0, 1.0), uRimPower);
  totalEmissiveRadiance += uRimColor * fr * uRimStrength;
  if (uCrack > 0.001) {
    float e = crackEdge(vObjPos * uCrackScale);
    float w = 0.05 + 0.06 * uCrack;
    float c = 1.0 - smoothstep(0.0, w, e);
    totalEmissiveRadiance += uCrackColor * c * uCrack * 6.0;
  }
}`
      );
  };
  m.customProgramCacheKey = () => 'rim-v1';
  return m;
};

export const setRim = (m: THREE.Material, rim?: THREE.ColorRepresentation, strength?: number, crack?: number) => {
  const u = (m as any).userData?.uniforms;
  if (!u) return;
  if (rim !== undefined) u.uRimColor.value.set(rim);
  if (strength !== undefined) u.uRimStrength.value = strength;
  if (crack !== undefined) u.uCrack.value = crack;
};

/** A palette of rim materials, keyed by colour; rim/crack uniforms updated every render. */
export const useRimMats = <K extends string>(
  defs: Record<K, RimOpts>,
  rim: THREE.ColorRepresentation,
  rimStrength: number,
  crack = 0,
  crackKeys: K[] = []
) => {
  const mats = useMemo(() => {
    const out = {} as Record<K, THREE.MeshStandardMaterial>;
    (Object.keys(defs) as K[]).forEach((k) => (out[k] = makeRimMaterial(defs[k])));
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  (Object.keys(mats) as K[]).forEach((k) => {
    setRim(mats[k], rim, rimStrength * (defs[k].rimStrength ?? 1), crackKeys.includes(k) ? crack : 0);
  });
  useEffect(() => () => (Object.values(mats) as THREE.Material[]).forEach((m) => m.dispose()), [mats]);
  return mats;
};

/** soft round additive sprite shader for particles */
export const particleMaterial = () =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    uniforms: {uScale: {value: 900}, uOpacity: {value: 1}},
    vertexShader: /* glsl */ `
      attribute float size; attribute float alpha;
      varying vec3 vColor; varying float vAlpha;
      uniform float uScale;
      void main(){
        vColor = color; vAlpha = alpha;
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        gl_PointSize = size * uScale / max(0.1, -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vColor; varying float vAlpha; uniform float uOpacity;
      void main(){
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        float a = smoothstep(0.5, 0.0, d);
        a = a*a;
        gl_FragColor = vec4(vColor * a * vAlpha * uOpacity, a * vAlpha * uOpacity);
      }`,
  });

/** vertical gradient additive beam / glow material */
export const beamMaterial = (color: THREE.ColorRepresentation) =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {uColor: {value: new THREE.Color(color)}, uIntensity: {value: 1}, uTime: {value: 0}},
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vUv = uv; vN = normalize(normalMatrix*normal);
        vec4 mv = modelViewMatrix*vec4(position,1.0); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix*mv; }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      uniform vec3 uColor; uniform float uIntensity; uniform float uTime;
      void main(){
        float edge = pow(abs(dot(vN, vV)), 1.6);
        float fade = smoothstep(1.0, 0.25, vUv.y) * smoothstep(0.0, 0.03, vUv.y);
        float flick = 0.85 + 0.15*sin(vUv.y*40.0 - uTime*0.6);
        float a = edge * fade * flick * uIntensity;
        gl_FragColor = vec4(uColor * a, a);
      }`,
  });
