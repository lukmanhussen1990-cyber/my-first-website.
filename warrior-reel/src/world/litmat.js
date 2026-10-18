// Cheap "world lit" material for SwiftShader: Lambert lighting evaluated PER VERTEX (exact for the flat,
// faceted world geometry, whose vertices carry face normals), with only the sun's shadow lookup, texture,
// vertex/instance colour and the (height) fog done per fragment. Uses three's real light uniforms
// (sun = first/shadow-casting DirectionalLight, hemisphere, other directional lights, ambient) and three's
// shadow chunks, so it matches MeshLambertMaterial's look at a fraction of the fragment cost.
//
// litMaterial({ map, color, vertexColors, side, sway (GLSL writing `vec3 sway`), upNormal, glow,
//               extraAttribs, colorMix })
import * as THREE from 'three';
import { WIND } from './wutil.js';

const VS = /* glsl */`
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <shadowmap_pars_vertex>
#include <lights_pars_begin>
uniform float uTime;
uniform float uWind;
varying vec2 vUv;
varying vec3 vAmb;
varying vec3 vSun;
EXTRA_ATTRIBS
void main() {
  #include <color_vertex>
  COLOR_MIX
  vUv = uv;
  vec3 objectNormal = normal;
  vec3 transformed = position;
  vec4 mvPosition = vec4( transformed, 1.0 );
  vec3 inst = vec3( 0.0 );
  #ifdef USE_INSTANCING
    mvPosition = instanceMatrix * mvPosition;
    inst = instanceMatrix[3].xyz;
  #endif
  #ifdef INST_ATTR
    inst = aInst;
  #endif
  {
    vec3 pos = mvPosition.xyz; vec3 objPos = transformed; vec3 sway = vec3( 0.0 );
    SWAY
    mvPosition.xyz += sway;
  }
  vec4 worldPosition = modelMatrix * mvPosition;
  mvPosition = viewMatrix * worldPosition;
  gl_Position = projectionMatrix * mvPosition;

  vec3 transformedNormal = objectNormal;
  #ifdef USE_INSTANCING
    mat3 im = mat3( instanceMatrix );
    transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
    transformedNormal = im * transformedNormal;
  #endif
  transformedNormal = normalize( normalMatrix * transformedNormal );

  // ---- per-vertex Lambert irradiance (view space, like three's light uniforms)
  vec3 n = transformedNormal;
  vec3 amb = ambientLightColor;
  #if NUM_HEMI_LIGHTS > 0
    for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) amb += getHemisphereLightIrradiance( hemisphereLights[ i ], n );
  #endif
  vec3 sun = vec3( 0.0 );
  #if NUM_DIR_LIGHTS > 0
    for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
      float d = max( dot( n, directionalLights[ i ].direction ), 0.0 );
      #ifdef WRAP_LIGHT
        d = max( dot( n, directionalLights[ i ].direction ) * 0.6 + 0.4, 0.0 );
      #endif
      if ( i == 0 ) sun += d * directionalLights[ i ].color;
      else amb += d * directionalLights[ i ].color;
    }
  #endif
  vAmb = amb;
  vSun = sun;
  #include <shadowmap_vertex>
  #include <fog_vertex>
}`;

const FS = /* glsl */`
#include <common>
#include <packing>
#include <color_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <shadowmap_pars_fragment>
uniform vec3 diffuse;
uniform float uGlow;
#ifdef HAS_MAP
  uniform sampler2D uMap;
#endif
varying vec2 vUv;
varying vec3 vAmb;
varying vec3 vSun;
void main() {
  vec4 diffuseColor = vec4( diffuse, 1.0 );
  #ifdef HAS_MAP
    diffuseColor *= texture2D( uMap, vUv );
  #endif
  #include <color_fragment>
  float sh = 1.0;
  #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
    if ( receiveShadow ) {
      DirectionalLightShadow dls = directionalLightShadows[ 0 ];
      sh = getShadow( directionalShadowMap[ 0 ], dls.shadowMapSize, dls.shadowIntensity, dls.shadowBias, dls.shadowRadius, vDirectionalShadowCoord[ 0 ] );
    }
  #endif
  vec3 outgoing = diffuseColor.rgb * ( RECIPROCAL_PI * ( vAmb + vSun * sh ) + uGlow );
  gl_FragColor = vec4( outgoing, diffuseColor.a );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

export function litMaterial({ map = null, color = 0xffffff, vertexColors = false, side = THREE.FrontSide, sway = '', upNormal = false,
  glow = 0, extraAttribs = '', colorMix = '', wrap = false, transparent = false, instAttr = false } = {}) {
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.lights, THREE.UniformsLib.fog, {
    diffuse: { value: new THREE.Color(color) }, uGlow: { value: glow }, uMap: { value: null },
  }]);
  uniforms.uMap.value = map;
  uniforms.uTime = WIND.uTime;
  uniforms.uWind = WIND.uWind;
  if (instAttr) extraAttribs += '\nattribute vec3 aInst;';
  let vs = VS.replace('EXTRA_ATTRIBS', extraAttribs).replace('SWAY', sway || '').replace('COLOR_MIX', '');
  if (colorMix) vs = vs.replace('#include <color_vertex>', colorMix);
  if (upNormal) vs = vs.replace('vec3 objectNormal = normal;', 'vec3 objectNormal = vec3( 0.0, 1.0, 0.0 );');
  const defines = {};
  if (map) defines.HAS_MAP = '';
  if (wrap) defines.WRAP_LIGHT = '';
  if (instAttr) defines.INST_ATTR = '';
  const m = new THREE.ShaderMaterial({
    uniforms, vertexShader: vs, fragmentShader: FS, lights: true, fog: true, vertexColors, side, defines, transparent,
  });
  m.isWorldLit = true;
  // keep the colour uniform reachable like a normal material
  Object.defineProperty(m, 'color', { get: () => uniforms.diffuse.value });
  return m;
}
