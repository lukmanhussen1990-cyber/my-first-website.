// The farmer / lion / goat / grass riddle (Hindi voice, our own characters), flat cartoon cards in a 3D toon
// world. Same post chain as the bridge short (ink -> lens blur -> bloom -> NEUTRAL tone map -> grade, MSAA 4), plus
// Hindi one-word captions and an optional watermark drawn over the picture.
import React, { useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill, Audio, getInputProps, staticFile, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import { BlendFunction, BloomEffect, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import "@fontsource/montserrat/700.css";
import "@fontsource/montserrat/800.css";
import { World } from "./world";
import { InkPass, noInkFallback } from "../slippery/ink";
import { LensBlur } from "../slippery/lensblur";
import { GradeEffect, GRADES, GRADE_STRENGTH } from "../slippery/grade";
import { TOTAL, FLASH_AT, SHOTS, FPS, shotAt, captionAt } from "./timeline";
import { LOOKS } from "./world";
const layersAt = (f: number) => [{ id: shotAt(f).id, alpha: 1 }];

export const SHER_FRAMES = TOTAL;
/** watermark text comes from inputProps { wm: "@handle" } (empty = none) */
const WATERMARK = () => (getInputProps() as { wm?: string }).wm ?? "";

const makeBloom = () => {
  const b = new BloomEffect({ blendFunction: BlendFunction.ADD, intensity: 0.5, luminanceThreshold: 1.0, luminanceSmoothing: 0.2, mipmapBlur: true, levels: 6, radius: 0.6 });
  const mip = b.mipmapBlurPass, setSize = mip.setSize.bind(mip);
  mip.setSize = (w: number, h: number) => setSize(Math.round((1920 * w) / Math.max(h, 1)), 1920);
  return b;
};
const fwd = new THREE.Vector3();

const Inner: React.FC<{ id: number }> = ({ id }) => {
  const f = useCurrentFrame();
  const { camera, scene } = useThree();
  const world = useMemo(() => new World(), []);
  const q = useMemo(quality, []);
  const fx = useMemo(() => ({
    ink: new InkPass(scene, camera as THREE.PerspectiveCamera),
    lens: new LensBlur({ maxCoC: 24, nearScale: 1.2 }),
    bloom: makeBloom(),
    tone: new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }),
    grade: new GradeEffect(GRADES.day, GRADE_STRENGTH.day),
  }), [camera, scene]);
  const post = useMemo(() => (
    <EffectComposer multisampling={q.msaa}>
      {[q.ink && fx.ink, q.lens && fx.lens.pre, q.lens && fx.lens.main, q.bloom && fx.bloom, fx.tone, fx.grade].filter(Boolean).map((o, i) => <primitive key={i} object={o as object} dispose={null} />)}
    </EffectComposer>
  ), [fx, q]);
  const cam = camera as THREE.PerspectiveCamera;
  const { focus, cInf } = world.update(id, f, cam, scene);
  noInkFallback(world.root);
  cam.getWorldDirection(fwd);
  fx.lens.focus = Math.max(0.3, focus.clone().sub(cam.position).dot(fwd));
  fx.lens.cInf = cInf;
  return (<><primitive object={world.root} dispose={null} />{post}</>);
};

const dprOverride = () => (getInputProps() as { post?: { dpr?: number } }).post?.dpr;
/** render-speed knobs (inputProps { post: { msaa, shadow } }); defaults = full quality */
const quality = () => ({ msaa: 4, ink: true, lens: true, bloom: true, ...((getInputProps() as { post?: { msaa?: number; ink?: boolean; lens?: boolean; bloom?: boolean } }).post ?? {}) });
const ShotView: React.FC<{ id: number; alpha: number }> = ({ id, alpha }) => (
  <AbsoluteFill style={{ opacity: alpha }}>
    <ThreeCanvas width={1080} height={1920} {...(dprOverride() ? { dpr: dprOverride() } : {})} shadows
      gl={{ antialias: false, stencil: false, powerPreference: "high-performance", toneMappingExposure: 1.0 }} camera={{ fov: 40, near: 0.05, far: 400 }}>
      <Inner id={id} />
    </ThreeCanvas>
  </AbsoluteFill>
);

const Caption: React.FC = () => {
  const f = useCurrentFrame(), t = f / FPS, c = captionAt(t);
  if (!c) return null;
  const k = Math.min(1, (t - c.s) * FPS / 3), s = 1.1 - 0.1 * k; // 3-frame settle on each swap
  return (
    <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center" }}>
      <div style={{
        position: "absolute", top: "63%", width: "92%", textAlign: "center", transform: `scale(${s})`,
        fontFamily: "Montserrat", fontWeight: 800, fontSize: 86, lineHeight: 1.05, color: "#ffffff", letterSpacing: -1,
        WebkitTextStroke: "16px #0b0a0c", paintOrder: "stroke fill", textShadow: "0 6px 0 rgba(0,0,0,0.35)",
      }}>{c.text}</div>
    </AbsoluteFill>
  );
};

const Watermark: React.FC = () => (
  <div style={{
    position: "absolute", top: "8.5%", width: "100%", textAlign: "center", fontFamily: "Montserrat", fontWeight: 700, fontSize: 40,
    color: "rgba(255,255,255,0.78)", WebkitTextStroke: "6px rgba(10,10,14,0.55)", paintOrder: "stroke fill", letterSpacing: 1,
  }}>{WATERMARK()}</div>
);

export const SherShort: React.FC = () => {
  const f = useCurrentFrame();
  const flash = f >= FLASH_AT && f < FLASH_AT + 4 ? [1, 0.75, 0.45, 0.2][f - FLASH_AT] : 0;
  const audio = (getInputProps() as { audio?: boolean }).audio;
  return (
    <AbsoluteFill style={{ background: LOOKS[SHOTS[0].look].bg }}>
      {layersAt(f).map((l, i) => <ShotView key={i ? "over" : "base"} id={l.id} alpha={l.alpha} />)}
      {flash > 0 && <AbsoluteFill style={{ background: "#ffffff", opacity: flash }} />}
      <Caption />
      {WATERMARK() ? <Watermark /> : null}
      {audio ? <Audio src={staticFile("sher/mix.wav")} /> : null}
    </AbsoluteFill>
  );
};
