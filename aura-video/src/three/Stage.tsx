import React, {useEffect, useLayoutEffect, useMemo, useRef} from 'react';
import {delayRender, continueRender, useCurrentFrame} from 'remotion';
import * as THREE from 'three';
import {useThree} from '@react-three/fiber';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {EffectComposer, Bloom, DepthOfField, Vignette, Noise, ChromaticAberration, ToneMapping, BrightnessContrast, HueSaturation} from '@react-three/postprocessing';
import {ToneMappingMode, BlendFunction} from 'postprocessing';
import {State} from '../shots';
import {Q} from '../quality';
import {Town, GateSign, Bell} from './Town';
import {Sky} from './Sky';
import {Person, LooseCap, LOOKS} from './Person';
import {Dog, Bike, Bus, Ball} from './Actors';
import {Loki, Fox, Crow, SnapHand} from './Loki';
import {Particles, Leaves} from './Particles';
import {GroundCracks, Debris, NewsStudio, Planet, Glow, silhouetteMaterial} from './Effects3D';

let ENV_TEX: THREE.Texture | null = null;
const EnvMap: React.FC<{intensity: number}> = ({intensity}) => {
  const gl = useThree((st) => st.gl);
  const scene = useThree((st) => st.scene);
  useLayoutEffect(() => {
    if (!ENV_TEX) {
      const pm = new THREE.PMREMGenerator(gl);
      ENV_TEX = pm.fromScene(new RoomEnvironment(), 0.04).texture;
      pm.dispose();
    }
    scene.environment = ENV_TEX;
    (scene as any).environmentIntensity = intensity;
  });
  return null;
};

const CameraRig: React.FC<{s: State}> = ({s}) => {
  const camera = useThree((st) => st.camera) as THREE.PerspectiveCamera;
  useLayoutEffect(() => {
    camera.position.set(...s.cam.pos);
    camera.up.set(0, 1, 0);
    camera.lookAt(...s.cam.target);
    if (s.cam.roll) camera.rotateZ(s.cam.roll);
    camera.fov = s.cam.fov;
    camera.near = 0.05;
    camera.far = 900;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  });
  return null;
};

const Lights: React.FC<{s: State}> = ({s}) => {
  const sun = useRef<THREE.DirectionalLight>(null);
  const fill = useRef<THREE.DirectionalLight>(null);
  const tgt = useMemo(() => new THREE.Object3D(), []);
  const e = s.env;
  const focus = s.hero?.pos ?? s.loki?.pos ?? s.dog?.pos ?? (s.cam.target as [number, number, number]);
  const center = new THREE.Vector3(focus[0], 0, focus[2]);
  useLayoutEffect(() => {
    tgt.position.copy(center);
    tgt.updateMatrixWorld();
    if (sun.current) {
      sun.current.position.copy(center).addScaledVector(e.sunDir, 40);
      sun.current.target = tgt;
      sun.current.shadow.camera.updateProjectionMatrix();
    }
    if (fill.current) {
      const cp = new THREE.Vector3(...s.cam.pos);
      fill.current.position.copy(cp).add(new THREE.Vector3(0, 3, 0));
      fill.current.target = tgt;
    }
  });
  return (
    <>
      <primitive object={tgt} />
      <hemisphereLight args={[e.hemiSky, e.hemiGround, e.hemiInt]} />
      <directionalLight
        ref={sun}
        color={e.sunColor}
        intensity={e.sunInt}
        castShadow
        shadow-mapSize={Q.preview ? [512, 512] : [2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
        shadow-camera-near={1}
        shadow-camera-far={90}
      />
      <directionalLight ref={fill} color={e.fillColor} intensity={e.fillInt} />
    </>
  );
};

const PostFX: React.FC<{s: State; fx?: string}> = ({s, fx = 'dof,bloom,ca,tm,bc,vig,noise'}) => {
  const on = (k: string) => fx.split(',').includes(k);
  const dofRef = useRef<any>(null);
  const target = useMemo(() => new THREE.Vector3(), []);
  target.set(...s.dof.target);
  useLayoutEffect(() => {
    const d = dofRef.current;
    if (d) {
      if (d.target) d.target.copy(target);
      d.cocMaterial.focusRange = s.dof.range;
      d.bokehScale = s.dof.bokeh;
    }
  });
  const ca = useMemo(() => new THREE.Vector2(), []);
  ca.set(s.chroma, s.chroma * 0.6);
  return (
    <EffectComposer multisampling={0} enableNormalPass={false} frameBufferType={THREE.UnsignedByteType}>
      {on('dof') ? <DepthOfField ref={dofRef} target={target} worldFocusRange={4} bokehScale={2} /> : <></>}
      {on('bloom') ? <Bloom intensity={s.env.bloom} luminanceThreshold={s.env.bloomThreshold} luminanceSmoothing={0.2} mipmapBlur radius={0.75} /> : <></>}
      {on('ca') ? <ChromaticAberration offset={ca} radialModulation={false} modulationOffset={0} /> : <></>}
      {on('tm') ? <ToneMapping mode={ToneMappingMode.NEUTRAL} /> : <></>}
      {on('bc') ? <HueSaturation saturation={0.12} /> : <></>}
      {on('bc') ? <BrightnessContrast brightness={0.0} contrast={0.1} /> : <></>}
      {on('vig') ? <Vignette darkness={s.env.vignette} offset={0.32} /> : <></>}
      {on('noise') ? <Noise opacity={0.045} blendFunction={BlendFunction.OVERLAY} /> : <></>}
    </EffectComposer>
  );
};

/** Re-render once more after effects/composer are set up (first frame of each tab would otherwise be black). */
const Kick: React.FC = () => {
  const advance = useThree((st) => st.advance);
  const frame = useCurrentFrame();
  const mounted = useRef(0);
  useEffect(() => {
    if (mounted.current > 1) return;
    mounted.current++;
    const h = delayRender('post-mount kick');
    requestAnimationFrame(() => {
      advance(performance.now());
      requestAnimationFrame(() => continueRender(h));
    });
  }, [frame, advance]);
  return null;
};

const silMat = silhouetteMaterial();

const TownScene: React.FC<{s: State}> = ({s}) => {
  const e = s.env;
  const tGame = s.f;
  return (
    <>
      <Sky look={e.sky} />
      <Town night={e.night} />
      <GateSign flip={s.sign.flip} glow={s.sign.glow} />
      <Bell swing={s.bell.swing} ring={s.bell.ring} />
      {s.hero && (
        <Person
          look={LOOKS.hero}
          pose={s.hero.pose}
          position={s.hero.pos}
          rotationY={s.hero.rotY}
          rim={s.hero.rim ?? e.rim}
          rimStrength={s.hero.rimStrength ?? e.rimStrength}
          rightHandChildren={s.ballInHand ? <group position={[0, -0.1, 0.03]}><Ball position={[0, 0, 0]} spin={0.3} /></group> : null}
        />
      )}
      {s.heroGlow ? (
        <Glow position={[s.hero?.pos[0] ?? 0, 1.1, s.hero?.pos[2] ?? 0]} size={3.2} color={e.night > 0.5 ? '#9b5cff' : '#ffcf7a'} opacity={0.35 * s.heroGlow} />
      ) : null}
      {s.heroShadow && (
        <group position={s.heroShadow.pos} scale={[s.heroShadow.scale, s.heroShadow.scale, 0.02]}>
          <Person look={LOOKS.hero} pose={s.heroShadow.pose} rotationY={s.heroShadow.rotY} override={silMat} castShadow={false} />
          {s.heroShadow.eyes > 0 &&
            [-1, 1].map((sd) => (
              <Glow key={sd} position={[0.075 * sd, 1.47, 2]} size={0.16} color="#b26bff" opacity={s.heroShadow.eyes} />
            ))}
        </group>
      )}
      {s.heroShadow && s.heroShadow.eyes > 0 &&
        [-1, 1].map((sd) => (
          <Glow
            key={'e' + sd}
            position={[s.heroShadow.pos[0] + 0.075 * sd * s.heroShadow.scale, 1.47 * s.heroShadow.scale, s.heroShadow.pos[2] + 0.2]}
            size={1.6}
            color="#c084fc"
            opacity={s.heroShadow.eyes}
          />
        ))}
      {s.dog && (
        <Dog position={s.dog.pos} rotationY={s.dog.rotY} phase={s.dog.phase} trot={s.dog.trot} sunglasses={s.dog.sunglasses} headYaw={s.dog.headYaw} rim={e.rim} rimStrength={e.rimStrength * 0.8} t={tGame} />
      )}
      {s.bully && (
        <group position={s.bully.pos} rotation={[0, s.bully.rotY, 0]}>
          <Bike roll={s.bully.roll} pedal={s.bully.pedal} />
          <Person look={LOOKS.bully} pose={s.bully.pose} position={[0, 0.06, -0.12]} rim={e.rim} rimStrength={e.rimStrength} />
        </group>
      )}
      {s.cap && <LooseCap position={s.cap.pos} rotation={s.cap.rot} color="#d22b2b" />}
      {s.npcs.map((n, i) => (
        <Person key={i} look={LOOKS[n.look]} pose={n.pose} position={n.pos} rotationY={n.rotY} rim={e.rim} rimStrength={e.rimStrength * 0.7} />
      ))}
      {s.bus && <Bus position={s.bus.pos} rotationY={s.bus.rotY} door={s.bus.door} wheelRoll={s.bus.roll} />}
      {s.ball && <Ball position={s.ball.pos} spin={s.ball.spin} />}
      {s.loki && (
        <Loki
          position={s.loki.pos}
          rotationY={s.loki.rotY}
          t={tGame}
          fire={s.loki.fire}
          armsUp={s.loki.armsUp}
          headPitch={s.loki.headPitch}
          eyeGlow={s.loki.eyeGlow}
          scale={s.loki.scale}
        />
      )}
      {s.fox && <Fox position={s.fox.pos} rotationY={s.fox.rotY} t={tGame} scale={s.fox.scale} />}
      {s.crow && <Crow position={s.crow.pos} rotationY={s.crow.rotY} t={tGame} scale={s.crow.scale} />}
      {s.snapHand && <SnapHand position={s.snapHand.pos} rotation={s.snapHand.rot} snap={s.snapHand.snap} />}
      {s.bursts.map((b, i) => (
        <group key={i}>
          <Particles kind="burst" t={s.f} start={b.start} count={140} radius={b.radius} height={0.8} size={0.22} color={b.color} color2={b.color2} center={b.center} seed={i + 3} />
          <pointLight position={b.center} color="#b26bff" intensity={Math.max(0, 40 * (1 - (s.f - b.start) / 16))} distance={8} />
        </group>
      ))}
      {e.night > 0.5 && (s.loki || s.fox || s.crow || s.snapHand || s.hero) && (
        <>
          <spotLight position={[s.cam.pos[0] + 1.5, s.cam.pos[1] + 2.5, s.cam.pos[2] + 1]} target-position={[0.3, 1.2, -84.3]} angle={0.5} penumbra={0.8} intensity={60} distance={30} color="#cfc4ff" />
          <pointLight position={[0.3, 2.6, -86.6]} intensity={30} distance={8} color="#8f6bff" />
        </>
      )}
      {s.heroShadow && <spotLight position={[0.3, 0.6, -82.6]} target-position={[0.3, 6, -100]} angle={0.95} penumbra={0.5} intensity={900} distance={60} decay={1.6} color="#ffc98a" />}
      {s.cracks && <GroundCracks center={s.cracks.center} grow={s.cracks.grow} />}
      {s.cracks && s.cracks.grow > 0.05 && <pointLight position={[s.cracks.center[0], 0.4, s.cracks.center[2]]} color="#9b4dff" intensity={12 * s.cracks.grow} distance={10} />}
      {s.debris && <Debris center={s.debris.center} lift={s.debris.lift} t={s.f} />}
      {s.leaves && <Leaves t={s.f} center={s.leaves.center} />}
      {s.dust && <Particles kind="dust" t={s.f} count={160} center={[s.dust.center[0] - 4, 0, s.dust.center[2] - 4]} radius={7} height={5} size={0.035} color={s.dust.color} opacity={s.dust.opacity} speed={s.dust.speed} seed={2} />}
      {s.embers && (
        <Particles kind="embers" t={s.f} count={180} center={s.embers.center} radius={s.embers.radius} height={s.embers.height} size={0.06} color={s.embers.color} color2={s.embers.color2} seed={5} />
      )}
    </>
  );
};

export const Stage: React.FC<{s: State; noPost?: boolean; fx?: string}> = ({s, noPost, fx}) => {
  const e = s.env;
  return (
    <>
      <CameraRig s={s} />
      <EnvMap intensity={s.set === 'studio' ? 0.6 : e.night > 0.5 ? 0.22 : 0.45} />
      <fog attach="fog" args={[e.fogColor, e.fogNear, e.fogFar]} />
      <color attach="background" args={[s.set === 'space' ? '#020208' : e.fogColor]} />
      {s.set !== 'studio' && <Lights s={s} />}
      {s.set === 'town' && <TownScene s={s} />}
      {s.set === 'studio' && (
        <>
          <hemisphereLight args={[e.hemiSky, e.hemiGround, e.hemiInt]} />
          <directionalLight position={[2, 6, 5]} intensity={1.6} color="#ffffff" />
          <NewsStudio t={s.f} />
        </>
      )}
      {s.set === 'space' && (
        <>
          <Sky look={{...e.sky, top: '#010106', horizon: '#03030c', bottom: '#010104', stars: 1, clouds: 0, sunSize: 0.4, sunColor: '#000000'}} />
          <Planet t={s.f} beamGrow={s.planetBeam ?? 1} />
        </>
      )}
      {!noPost && <PostFX s={s} fx={fx} />}
      <Kick />
    </>
  );
};
