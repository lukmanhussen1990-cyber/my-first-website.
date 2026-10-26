// A full-frame image shown in front of the camera (scene 9 reveal), with a slow push-in,
// a depth-like radial warp (centre moves faster = travelling down the crack), sweeping
// headlamp light pools and a flicker. 3D dust/frost particles still render on top.
import * as THREE from 'three';

export function createFullFrame(texture) {
  const img = texture?.image;
  const u = {
    tImg: { value: texture },
    uZoom: { value: 1 },
    uWarp: { value: 0 },
    uCenter: { value: new THREE.Vector2(0.5, 0.5) },
    uPan: { value: new THREE.Vector2(0, 0) },
    uBright: { value: 1 },
    uImgAspect: { value: img ? img.width / img.height : 2 / 3 },
    uScrAspect: { value: 9 / 16 },
    uPools: { value: [new THREE.Vector4(0.5, 0.2, 0.25, 0), new THREE.Vector4(0.5, 0.5, 0.25, 0), new THREE.Vector4(0.5, 0.8, 0.25, 0)] },
    uPoolCol: { value: new THREE.Vector3(1.0, 0.72, 0.45) },
    uLed: { value: new THREE.Vector4(0, 0, 0.01, 0) },   // xy = uv, z = radius, w = glow intensity
    uLedKill: { value: 0 },                               // 1 = the baked red light is dead (darkened)
    uGrade: { value: new THREE.Vector3(1, 1, 1) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: u,
    depthTest: false,
    depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: /* glsl */ `
      uniform sampler2D tImg; uniform float uZoom, uWarp, uBright, uImgAspect, uScrAspect; uniform vec2 uCenter, uPan;
      uniform vec4 uPools[3]; uniform vec3 uPoolCol; uniform vec4 uLed; uniform float uLedKill; uniform vec3 uGrade; varying vec2 vUv;
      void main(){
        vec2 uv = vec2((vUv.x - 0.5) * (uScrAspect / uImgAspect) + 0.5, vUv.y);
        vec2 d = uv - uCenter;
        float r = length(d * vec2(1.0, 0.75));
        float z = uZoom * (1.0 + uWarp * (1.0 - smoothstep(0.0, 0.55, r)));
        vec2 iuv = uCenter + d / z + uPan;
        vec3 c = texture2D(tImg, iuv).rgb;
        float L = 0.0;
        for (int i = 0; i < 3; i++) { vec2 pd = (iuv - uPools[i].xy) * vec2(1.0, 0.75); L += uPools[i].w * exp(-dot(pd, pd) / (uPools[i].z * uPools[i].z)); }
        c *= uBright + L * uPoolCol;
        // small light (radio LED): kill the baked light and/or add a glow halo
        vec2 ld = (iuv - uLed.xy) * vec2(uImgAspect, 1.0);
        float lr = length(ld);
        float redness = clamp((c.r - max(c.g, c.b)) * 4.0, 0.0, 1.0);
        c = mix(c, vec3(0.03, 0.035, 0.04) * uBright, uLedKill * redness * smoothstep(uLed.z * 1.6, uLed.z * 0.6, lr));
        c += vec3(1.0, 0.08, 0.04) * uLed.w * (exp(-lr * lr / (uLed.z * uLed.z)) * 2.5 + exp(-lr * lr / (uLed.z * uLed.z * 30.0)) * 0.35);
        gl_FragColor = vec4(c * uGrade, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -50;
  mesh.visible = false;
  return {
    mesh, u,
    setImage(tex) {
      if (!tex) return false;
      u.tImg.value = tex;
      u.uImgAspect.value = tex.image.width / tex.image.height;
      return true;
    },
    // size/position the plane to exactly fill the camera view at distance 1
    fit(camera) {
      const h = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
      mesh.position.set(0, 0, -1);
      mesh.scale.set(h * camera.aspect, h, 1);
      u.uScrAspect.value = camera.aspect;
    },
  };
}
