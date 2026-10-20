// Planar reflections rendered into a mipmapped HDR target and injected into
// MeshStandard/Physical materials (wet floor + street share the y=0 plane;
// the steel fridge door gets its own mirror). Based on three's Reflector maths,
// but the reflection is added on top of normal PBR shading so the surfaces stay
// lit, shadowed and textured.
import * as THREE from 'three';

const _reflectorWorldPosition = new THREE.Vector3();
const _cameraWorldPosition = new THREE.Vector3();
const _rotationMatrix = new THREE.Matrix4();
const _lookAtPosition = new THREE.Vector3(0, 0, -1);
const _clipPlane = new THREE.Vector4();
const _view = new THREE.Vector3();
const _target = new THREE.Vector3();
const _q = new THREE.Vector4();
const _plane = new THREE.Plane();

export class PlanarReflection {
  constructor({ width, height, normal, point, clipBias = 0.002, layersMask = null }) {
    this.rt = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: true,
    });
    this.normal = normal.clone().normalize();
    this.point = point.clone();
    this.clipBias = clipBias;
    this.camera = new THREE.PerspectiveCamera();
    this.camera.layers.enableAll();
    if (layersMask !== null) this.camera.layers.mask = layersMask;
    this.textureMatrix = new THREE.Matrix4();
    this.uniforms = {
      uReflTex: { value: this.rt.texture },
      uReflMatrix: { value: this.textureMatrix },
    };
    this.hide = []; // meshes hidden while rendering this mirror (the mirror surfaces themselves)
  }

  update(renderer, scene, camera) {
    const normal = this.normal;
    _reflectorWorldPosition.copy(this.point);
    _cameraWorldPosition.setFromMatrixPosition(camera.matrixWorld);
    _view.subVectors(_reflectorWorldPosition, _cameraWorldPosition);
    if (_view.dot(normal) > 0) return false; // camera behind the mirror

    _view.reflect(normal).negate();
    _view.add(_reflectorWorldPosition);
    _rotationMatrix.extractRotation(camera.matrixWorld);
    _lookAtPosition.set(0, 0, -1).applyMatrix4(_rotationMatrix).add(_cameraWorldPosition);
    _target.subVectors(_reflectorWorldPosition, _lookAtPosition);
    _target.reflect(normal).negate();
    _target.add(_reflectorWorldPosition);

    const vc = this.camera;
    vc.position.copy(_view);
    vc.up.set(0, 1, 0).applyMatrix4(_rotationMatrix).reflect(normal);
    vc.lookAt(_target);
    vc.far = camera.far;
    vc.near = camera.near;
    vc.updateMatrixWorld();
    vc.projectionMatrix.copy(camera.projectionMatrix);

    this.textureMatrix.set(0.5, 0.0, 0.0, 0.5, 0.0, 0.5, 0.0, 0.5, 0.0, 0.0, 0.5, 0.5, 0.0, 0.0, 0.0, 1.0);
    this.textureMatrix.multiply(vc.projectionMatrix);
    this.textureMatrix.multiply(vc.matrixWorldInverse);

    // Oblique near plane = mirror plane (clips everything behind the mirror).
    _plane.setFromNormalAndCoplanarPoint(normal, _reflectorWorldPosition);
    _plane.applyMatrix4(vc.matrixWorldInverse);
    _clipPlane.set(_plane.normal.x, _plane.normal.y, _plane.normal.z, _plane.constant);
    const pm = vc.projectionMatrix;
    _q.x = (Math.sign(_clipPlane.x) + pm.elements[8]) / pm.elements[0];
    _q.y = (Math.sign(_clipPlane.y) + pm.elements[9]) / pm.elements[5];
    _q.z = -1.0;
    _q.w = (1.0 + pm.elements[10]) / pm.elements[14];
    _clipPlane.multiplyScalar(2.0 / _clipPlane.dot(_q));
    pm.elements[2] = _clipPlane.x;
    pm.elements[6] = _clipPlane.y;
    pm.elements[10] = _clipPlane.z + 1.0 - this.clipBias;
    pm.elements[14] = _clipPlane.w;

    const vis = this.hide.map((m) => m.visible);
    this.hide.forEach((m) => (m.visible = false));
    const prevTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(this.rt);
    renderer.clear();
    renderer.render(scene, vc);
    renderer.setRenderTarget(prevTarget);
    this.hide.forEach((m, i) => (m.visible = vis[i]));
    return true;
  }
}

// Adds the planar reflection to a lit material. Reflection strength follows
// fresnel and (1 - roughness), and blur follows roughness via the mip chain.
//   opts.strength  overall multiplier (uniform, animatable via material.userData.refl)
//   opts.blur      base mip bias
//   opts.fresnel   reflectance at normal incidence
//   opts.stretch   vertical smear (wet-street streaks), 0 = none
export function addReflection(material, refl, { strength = 1, blur = 1.5, fresnel = 0.08, distort = 0.02, stretch = 0, roughBlur = 5, steel = 0 } = {}) {
  const u = {
    uReflStrength: { value: strength },
    uReflBlur: { value: blur },
    uReflF0: { value: fresnel },
    uReflDistort: { value: distort },
    uReflStretch: { value: stretch },
    uReflRoughBlur: { value: roughBlur },
    uReflSteel: { value: steel },
  };
  material.userData.refl = u;
  material.userData.reflBase = strength;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, refl.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform mat4 uReflMatrix;\nvarying vec4 vReflCoord;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvReflCoord = uReflMatrix * modelMatrix * vec4( transformed, 1.0 );');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform sampler2D uReflTex; uniform float uReflStrength; uniform float uReflBlur; uniform float uReflF0;
uniform float uReflDistort; uniform float uReflStretch; uniform float uReflRoughBlur; uniform float uReflSteel;
varying vec4 vReflCoord;`
      )
      .replace(
        '#include <opaque_fragment>',
        `{
  vec3 vdir = normalize( vViewPosition );
  float ndv = clamp( dot( normalize( normal ), vdir ), 0.0, 1.0 );
  float fres = uReflF0 + ( 1.0 - uReflF0 ) * pow( 1.0 - ndv, 5.0 );
  vec2 ruv = vReflCoord.xy / vReflCoord.w + normal.xy * uReflDistort;
  float lod = uReflBlur + roughnessFactor * uReflRoughBlur;
  vec3 rc = textureLod( uReflTex, ruv, lod ).rgb;
  if ( lod > 0.6 ) {
    // smooth the blocky high mips with a small ring of taps
    vec2 px = exp2( lod ) * 0.7 / vec2( textureSize( uReflTex, 0 ) );
    vec3 acc = rc * 2.0;
    for ( int i = 0; i < 8; i ++ ) {
      float a = float( i ) * 0.785398 + 0.3;
      acc += textureLod( uReflTex, ruv + vec2( cos( a ), sin( a ) ) * px, lod ).rgb;
    }
    rc = acc / 10.0;
  }
  if ( uReflStretch > 0.0 ) {
    rc = rc * 0.4 + 0.2 * ( textureLod( uReflTex, ruv + vec2( 0.0, uReflStretch ), lod + 1.0 ).rgb
                          + textureLod( uReflTex, ruv - vec2( 0.0, uReflStretch ), lod + 1.0 ).rgb
                          + textureLod( uReflTex, ruv + vec2( 0.0, uReflStretch * 2.2 ), lod + 1.5 ).rgb );
  }
  if ( uReflSteel > 0.0 ) {
    // brushed steel: cool tint, a little desaturation, horizontal brush streaks
    float lum = dot( rc, vec3( 0.2126, 0.7152, 0.0722 ) );
    rc = mix( rc, vec3( lum ), 0.25 * uReflSteel ) * mix( vec3( 1.0 ), vec3( 0.82, 0.88, 0.95 ), uReflSteel );
    #ifdef USE_ROUGHNESSMAP
    rc *= mix( 1.0, 0.82 + 0.36 * texelRoughness.g, uReflSteel );
    #endif
  }
  outgoingLight += rc * uReflStrength * fres * ( 1.0 - roughnessFactor * 0.85 );
}
#include <opaque_fragment>`
      );
  };
  material.customProgramCacheKey = () => `refl-${material.uuid}`;
  material.needsUpdate = true;
  return material;
}
