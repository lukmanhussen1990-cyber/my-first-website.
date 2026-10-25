import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

// Render chain: scene (4x MSAA, HDR) -> bloom -> tilt-shift (2 separable passes) -> ACES + sRGB.
// It renders inside a priority useFrame, which @remotion/three's advance() calls once per frame.

const TiltShiftShader = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new THREE.Vector2(1080, 1920) },
    dir: { value: new THREE.Vector2(1, 0) },
    focusTop: { value: 0.64 },
    focusBottom: { value: 0.3 },
    falloff: { value: 0.26 },
    maxRadius: { value: 7.0 },
    uniformBlur: { value: 0.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform vec2 dir;
    uniform float focusTop;
    uniform float focusBottom;
    uniform float falloff;
    uniform float maxRadius;
    uniform float uniformBlur;
    varying vec2 vUv;
    void main() {
      float y = vUv.y;
      float d = 0.0;
      if (y > focusTop) d = (y - focusTop) / falloff;
      else if (y < focusBottom) d = (focusBottom - y) / falloff;
      d = clamp(d, 0.0, 1.0);
      d = d * d * (3.0 - 2.0 * d);
      float r = max(d, uniformBlur) * maxRadius;
      vec4 c = texture2D(tDiffuse, vUv);
      if (r < 0.35) { gl_FragColor = c; return; }
      vec2 s = dir * (r / 5.1764705882) / resolution;
      c *= 0.1964825501511404;
      c += (texture2D(tDiffuse, vUv + s * 1.4117647058823530) + texture2D(tDiffuse, vUv - s * 1.4117647058823530)) * 0.2969069646728344;
      c += (texture2D(tDiffuse, vUv + s * 3.2941176470588234) + texture2D(tDiffuse, vUv - s * 3.2941176470588234)) * 0.0944703978504473;
      c += (texture2D(tDiffuse, vUv + s * 5.1764705882352940) + texture2D(tDiffuse, vUv - s * 5.1764705882352940)) * 0.0103813624011481;
      gl_FragColor = c;
    }`,
};

export type PostSettings = {
  exposure: number;
  bloom: number;
  bloomThreshold: number;
  bloomRadius?: number;
  tilt: number; // 0..1 strength of the top/bottom blur
  blurAll?: number; // 0..1 blur the whole frame (behind cards / search bar)
  focusCenter?: number; // 0..1 from bottom, centre of the sharp band
  focusWidth?: number;
};

export const Composer: React.FC<{ settings: PostSettings; msaa?: number }> = ({ settings, msaa = 4 }) => {
  const { gl, scene, camera, size } = useThree();

  const { composer, bloom, tiltH, tiltV } = useMemo(() => {
    const rt = new THREE.WebGLRenderTarget(size.width, size.height, { type: THREE.HalfFloatType, samples: msaa });
    const c = new EffectComposer(gl, rt);
    c.setPixelRatio(1);
    c.setSize(size.width, size.height);
    c.addPass(new RenderPass(scene, camera));
    const b = new UnrealBloomPass(new THREE.Vector2(size.width / 2, size.height / 2), 0.6, 0.55, 0.8);
    c.addPass(b);
    const h = new ShaderPass(TiltShiftShader);
    const v = new ShaderPass(TiltShiftShader);
    h.uniforms.dir.value.set(1, 0);
    v.uniforms.dir.value.set(0, 1);
    for (const p of [h, v]) p.uniforms.resolution.value.set(size.width, size.height);
    c.addPass(h);
    c.addPass(v);
    c.addPass(new OutputPass());
    return { composer: c, bloom: b, tiltH: h, tiltV: v };
  }, [gl, scene, camera, size.width, size.height, msaa]);

  useLayoutEffect(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = settings.exposure;
    bloom.strength = settings.bloom;
    bloom.threshold = settings.bloomThreshold;
    bloom.radius = settings.bloomRadius ?? 0.55;
    const center = settings.focusCenter ?? 0.47;
    const width = settings.focusWidth ?? 0.34;
    for (const p of [tiltH, tiltV]) {
      p.uniforms.focusTop.value = center + width / 2;
      p.uniforms.focusBottom.value = center - width / 2;
      p.uniforms.maxRadius.value = 7.5 * settings.tilt + 14 * (settings.blurAll ?? 0);
      p.uniforms.uniformBlur.value = settings.blurAll ?? 0;
    }
  });

  useLayoutEffect(() => () => composer.dispose(), [composer]);

  useFrame(() => {
    composer.render();
  }, 1);

  return null;
};
