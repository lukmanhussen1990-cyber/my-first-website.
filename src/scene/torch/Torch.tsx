import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, Color, Group, Mesh, Object3D, ShaderMaterial, SpotLight, Vector3 } from 'three';
import { BEAM_PROFILES, MAX_LUMENS, batteryOutputCap, outputFraction, peakCandela, type BeamProfile } from '../../lib/photometry';
import { createGoboTexture } from '../../lib/textures';
import { useTorch } from '../../state/store';
import { DEFAULT_POSE, PITCH_LIMIT, runtime } from '../runtime';
import { createTorchMaterials, TORCH_COLORS } from './materials';
import { buildTorchGeometry } from './parts';
import { LENS_Z, SPEC } from './spec';

/** Maps physical peak candela to scene light units (with gentle range compression). */
const RENDER_K = 10.5;
const RENDER_GAMMA = 0.72;

const INDICATOR_WHITE = new Color('#dce8ff');
const INDICATOR_AMBER = new Color('#ffb040');
const INDICATOR_RED = new Color('#ff4a36');

const DEG = Math.PI / 180;
const tmp = new Vector3();
const scratchProfile: BeamProfile = { ...BEAM_PROFILES.standard };

function approach(current: number, target: number, tau: number, dt: number) {
  return target + (current - target) * Math.exp(-dt / Math.max(tau, 1e-4));
}

/** Additive "filled reflector" glow: the mirror looks lit when you look into the beam. */
function createReflectorGlow() {
  return new ShaderMaterial({
    name: 'reflector-glow',
    uniforms: {
      uAxis: { value: new Vector3(0, 0, 1) },
      uColor: { value: new Color('#eef4ff') },
      uIntensity: { value: 0 },
      uCosOuter: { value: 0.9 },
      uCosInner: { value: 0.99 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldPos;
      varying float vRadial;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vRadial = length(position.xz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uAxis;
      uniform vec3 uColor;
      uniform float uIntensity;
      uniform float uCosOuter;
      uniform float uCosInner;
      varying vec3 vWorldPos;
      varying float vRadial;
      void main() {
        vec3 toCam = normalize(cameraPosition - vWorldPos);
        float inBeam = smoothstep(uCosOuter, uCosInner, dot(toCam, uAxis));
        float centre = 1.0 - smoothstep(0.02, 0.17, vRadial);
        float rings = 0.84 + 0.16 * sin(vRadial * 310.0);
        float k = uIntensity * (0.05 + 0.04 * centre + inBeam * (0.4 + 0.6 * centre) * rings * 26.0);
        gl_FragColor = vec4(uColor * k, 1.0);
      }`,
    blending: AdditiveBlending,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
}

function TorchLight({ shadowMapSize }: { shadowMapSize: number }) {
  const lightRef = useRef<SpotLight>(null!);
  const targetRef = useRef<Object3D>(null!);
  const gobo = useMemo(() => {
    const g = createGoboTexture(256);
    g.update({ halfAngle: runtime.halfAngle, hotspot: runtime.hotspot, spill: runtime.spill, softness: runtime.softness, rings: runtime.rings });
    return g;
  }, []);
  const last = useRef({ halfAngle: runtime.halfAngle, hotspot: runtime.hotspot, spill: runtime.spill, softness: runtime.softness, rings: runtime.rings, frame: 0 });

  useLayoutEffect(() => {
    const light = lightRef.current;
    light.target = targetRef.current;
    runtime.light = light;
    return () => {
      runtime.light = null;
    };
  }, []);

  useEffect(() => () => gobo.texture.dispose(), [gobo]);

  useEffect(() => {
    const light = lightRef.current;
    if (light.shadow.mapSize.x === shadowMapSize) return;
    light.shadow.mapSize.set(shadowMapSize, shadowMapSize);
    if (light.shadow.map) {
      light.shadow.map.dispose();
      light.shadow.map = null;
    }
  }, [shadowMapSize]);

  useFrame(() => {
    const light = lightRef.current;
    light.angle = runtime.halfAngle;
    light.intensity = runtime.intensity;
    light.penumbra = 0.1 + 0.16 * runtime.softness;
    light.color.copy(runtime.color);
    // No light → no need to re-render its shadow map every frame. The map must
    // still exist though: three's fallback for an unallocated spot shadow map in
    // sampler arrays lacks a compare mode and trips GL sampler-type errors.
    light.shadow.autoUpdate = runtime.intensity > 1e-3 || light.shadow.map === null;

    const L = last.current;
    L.frame++;
    const changed =
      Math.abs(L.hotspot - runtime.hotspot) > 0.002 ||
      Math.abs(L.spill - runtime.spill) > 0.002 ||
      Math.abs(L.softness - runtime.softness) > 0.004 ||
      Math.abs(L.rings - runtime.rings) > 0.01 ||
      Math.abs(L.halfAngle - runtime.halfAngle) > 0.01;
    if (changed && L.frame % 2 === 0) {
      L.halfAngle = runtime.halfAngle;
      L.hotspot = runtime.hotspot;
      L.spill = runtime.spill;
      L.softness = runtime.softness;
      L.rings = runtime.rings;
      gobo.update(L);
    }
  }, -1);

  return (
    <>
      <spotLight
        ref={lightRef}
        position={[0, 0, LENS_Z + 0.045]}
        castShadow
        map={gobo.texture}
        decay={2}
        distance={0}
        intensity={0}
        shadow-mapSize={[shadowMapSize, shadowMapSize]}
        shadow-bias={-0.00012}
        shadow-normalBias={0.025}
        shadow-radius={2.2}
        shadow-camera-near={0.06}
        shadow-camera-far={42}
      />
      <object3D ref={targetRef} position={[0, 0, LENS_Z + 10]} />
    </>
  );
}

export function Torch({ shadowMapSize }: { shadowMapSize: number }) {
  const geo = useMemo(() => buildTorchGeometry(TORCH_COLORS), []);
  const mats = useMemo(() => createTorchMaterials(), []);
  const glow = useMemo(() => createReflectorGlow(), []);
  useEffect(
    () => () => {
      geo.dispose();
      mats.dispose();
      glow.dispose();
    },
    [geo, mats, glow],
  );

  const poseRef = useRef<Group>(null!);
  const capRef = useRef<Group>(null!);
  const hitBodyRef = useRef<Mesh>(null!);
  const hitButtonRef = useRef<Mesh>(null!);
  const smooth = useRef({ output: 0, envelope: 0, press: 0, pressUntil: 0, indicator: 0, clock: 0 });

  useLayoutEffect(() => {
    runtime.torch = poseRef.current;
    runtime.hitBody = hitBodyRef.current;
    runtime.hitButton = hitButtonRef.current;
    const pose = runtime.pose;
    pose.yaw = pose.targetYaw = DEFAULT_POSE.yaw;
    pose.pitch = pose.targetPitch = DEFAULT_POSE.pitch;
    return () => {
      runtime.torch = null;
      runtime.hitBody = null;
      runtime.hitButton = null;
    };
  }, []);

  // Reset view → aim back to the default pose along the shortest path.
  useEffect(
    () =>
      useTorch.subscribe((s, prev) => {
        if (s.resetNonce === prev.resetNonce) return;
        const pose = runtime.pose;
        const turns = Math.round((pose.yaw - DEFAULT_POSE.yaw) / (Math.PI * 2));
        pose.targetYaw = DEFAULT_POSE.yaw + turns * Math.PI * 2;
        pose.targetPitch = DEFAULT_POSE.pitch;
        pose.velocityYaw = pose.velocityPitch = 0;
      }),
    [],
  );

  // Every toggle (UI, keyboard or the 3D button) plays the switch press.
  useEffect(
    () =>
      useTorch.subscribe((s, prev) => {
        if (s.on !== prev.on) smooth.current.pressUntil = smooth.current.clock + 0.11;
      }),
    [],
  );

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const s = useTorch.getState();
    const sm = smooth.current;
    sm.clock += dt;

    /* --- power envelope: fast soft-start, slower graceful fade-out --- */
    sm.envelope = approach(sm.envelope, s.on ? 1 : 0, s.on ? 0.055 : 0.17, dt);
    const targetOutput = Math.min(outputFraction(s.brightness), batteryOutputCap(s.battery));
    sm.output = approach(sm.output, targetOutput, 0.11, dt);
    runtime.envelope = sm.envelope;
    runtime.output = sm.envelope * sm.output;

    /* --- beam shape: modes and width animate smoothly --- */
    const profile = BEAM_PROFILES[s.mode];
    const tau = 0.16;
    runtime.halfAngle = approach(runtime.halfAngle, (s.beamAngle / 2) * DEG, tau, dt);
    runtime.hotspot = approach(runtime.hotspot, profile.hotspot, tau, dt);
    runtime.spill = approach(runtime.spill, profile.spill, tau, dt);
    runtime.softness = approach(runtime.softness, profile.softness, tau, dt);
    runtime.rings = approach(runtime.rings, profile.rings, tau, dt);
    scratchProfile.hotspot = runtime.hotspot;
    scratchProfile.spill = runtime.spill;
    scratchProfile.softness = runtime.softness;
    const lumens = MAX_LUMENS * runtime.output;
    const candela = lumens > 0 ? peakCandela(lumens, (runtime.halfAngle * 2) / DEG, scratchProfile) : 0;
    runtime.intensity = RENDER_K * Math.pow(candela, RENDER_GAMMA);

    /* --- pose: spring toward the aim target, with inertia after a flick --- */
    const pose = runtime.pose;
    if (!pose.dragging) {
      pose.targetYaw += pose.velocityYaw * dt;
      pose.targetPitch += pose.velocityPitch * dt;
      const friction = Math.exp(-dt * 3.2);
      pose.velocityYaw *= friction;
      pose.velocityPitch *= friction;
    }
    if (pose.targetPitch > PITCH_LIMIT || pose.targetPitch < -PITCH_LIMIT) {
      pose.targetPitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pose.targetPitch));
      pose.velocityPitch = 0;
    }
    pose.yaw = approach(pose.yaw, pose.targetYaw, 0.075, dt);
    pose.pitch = approach(pose.pitch, pose.targetPitch, 0.075, dt);
    const group = poseRef.current;
    group.rotation.set(-pose.pitch, pose.yaw, 0, 'YXZ');
    group.updateMatrixWorld(true);

    /* --- world-space beam frame shared with the light, haze and dust --- */
    runtime.lens.set(0, 0, LENS_Z).applyMatrix4(group.matrixWorld);
    runtime.axis.set(0, 0, 1).transformDirection(group.matrixWorld);
    runtime.lensRadius = SPEC.reflector.mouthR;
    const lensDist = runtime.lensRadius / Math.tan(runtime.halfAngle);
    runtime.apex.copy(runtime.lens).addScaledVector(runtime.axis, -lensDist);

    /* --- switch press + indicator ring --- */
    sm.press = approach(sm.press, sm.clock < sm.pressUntil ? 1 : 0, 0.028, dt);
    runtime.press = sm.press;
    capRef.current.position.y = -SPEC.switch.travel * sm.press;

    const indicator = mats.indicator;
    let target = 0.32; // amber locator glow while off
    if (s.charging) {
      indicator.emissive.copy(INDICATOR_AMBER);
      target = 0.7 + 0.6 * Math.sin(sm.clock * 3.2);
    } else if (s.on) {
      if (s.battery < 0.1) {
        indicator.emissive.copy(INDICATOR_RED);
        target = 1.4 + 0.9 * Math.sin(sm.clock * 7);
      } else if (s.battery < 0.3) {
        indicator.emissive.copy(INDICATOR_AMBER);
        target = 2.0;
      } else {
        indicator.emissive.copy(INDICATOR_WHITE);
        target = 2.4;
      }
    } else {
      indicator.emissive.copy(INDICATOR_AMBER);
    }
    if (runtime.hoverButton) target *= 1.6;
    sm.indicator = approach(sm.indicator, target, 0.08, dt);
    indicator.emissiveIntensity = sm.indicator;

    /* --- emitter --- */
    mats.ledPhosphor.emissiveIntensity = 150 * Math.pow(runtime.output, 0.7);
    const u = glow.uniforms;
    tmp.copy(runtime.axis);
    (u.uAxis.value as Vector3).copy(tmp);
    (u.uColor.value as Color).copy(runtime.color);
    u.uIntensity.value = runtime.output;
    u.uCosOuter.value = Math.cos(Math.min(1.45, runtime.halfAngle * 1.25 + 0.06));
    u.uCosInner.value = Math.cos(runtime.halfAngle * 0.45);
  }, -2);

  const m = mats;
  return (
    <group ref={poseRef}>
      {/* Lathe space (+Y axis) laid down so the beam points along local +Z. */}
      <group rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -SPEC.pivot]}>
        <mesh geometry={geo.tailCap} material={m.anodized} castShadow />
        <mesh geometry={geo.tailRing} material={m.brushed} castShadow />
        <mesh geometry={geo.body} material={m.anodized} castShadow />
        <mesh geometry={geo.knurl} material={m.knurl} castShadow />
        <mesh geometry={geo.head} material={m.anodized} castShadow />
        <mesh geometry={geo.bezel} material={m.bezel} castShadow />
        <mesh geometry={geo.teeth} material={m.bezel} castShadow />
        <mesh geometry={geo.oRings} material={m.rubber} />
        <mesh geometry={geo.engraving} material={m.engraving} renderOrder={1} />

        <mesh geometry={geo.reflector} material={m.reflector} />
        <mesh geometry={geo.reflector} material={glow} renderOrder={2} />
        <mesh geometry={geo.ledPedestal} material={m.ledPedestal} />
        <mesh geometry={geo.ledGasket} material={m.ledGasket} />
        <mesh geometry={geo.ledPackage} material={m.ledCeramic} />
        <mesh geometry={geo.ledDies} material={m.ledPhosphor} />
        <mesh geometry={geo.ledDome} material={m.ledDome} renderOrder={3} />
        <mesh geometry={geo.lens} material={m.glass} renderOrder={4} />

        <group matrix={geo.switchMatrix} matrixAutoUpdate={false}>
          <mesh geometry={geo.switchBoss} material={m.anodized} castShadow />
          <mesh geometry={geo.switchRing} material={m.indicator} />
          <group ref={capRef}>
            <mesh geometry={geo.switchCap} material={m.buttonCap} />
            <mesh geometry={geo.switchIcon} material={m.icon} renderOrder={1} />
          </group>
        </group>

        <mesh geometry={geo.clip} material={m.clip} castShadow />
        <mesh geometry={geo.screwHeads} material={m.screw} />
        <mesh geometry={geo.screwRecess} material={m.screwRecess} />

        <mesh ref={hitBodyRef} geometry={geo.hitBody} visible={false} />
        <mesh ref={hitButtonRef} geometry={geo.hitButton} visible={false} />
      </group>
      <TorchLight shadowMapSize={shadowMapSize} />
    </group>
  );
}
