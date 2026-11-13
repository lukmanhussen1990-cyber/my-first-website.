import React, {useEffect, useLayoutEffect, useState} from 'react';
import * as THREE from 'three';
import {AbsoluteFill, delayRender, continueRender, useVideoConfig} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import {EffectComposer, Bloom, ToneMapping, Vignette, BrightnessContrast} from '@react-three/postprocessing';
import {ToneMappingMode} from 'postprocessing';
import '@fontsource/lora/400.css';
import '@fontsource/lora/400-italic.css';
import '@fontsource/inter/700.css';
import '@fontsource/poppins/800.css';
import {Person, LOOKS} from './three/Person';
import {Dog} from './three/Actors';
import {Loki} from './three/Loki';
import {Sky} from './three/Sky';
import {Kick} from './three/Stage';

const Cam: React.FC<{pos: [number, number, number]; target: [number, number, number]; fov: number}> = ({pos, target, fov}) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useLayoutEffect(() => {
    camera.position.set(...pos);
    camera.lookAt(...target);
    camera.fov = fov;
    camera.updateProjectionMatrix();
  });
  return null;
};

const Studio: React.FC<{portrait?: boolean}> = ({portrait}) => (
  <>
    <Sky look={{top: '#1b2140', horizon: '#e9b98a', bottom: '#2a2230', sunDir: new THREE.Vector3(0, 0.3, -1).normalize(), sunColor: '#ffb070', sunSize: 3, stars: 0, clouds: 0, cloudTint: '#fff'}} />
    <hemisphereLight args={['#dfe8ff', '#6b5545', 1.1]} />
    <directionalLight position={[3, 6, 6]} intensity={3.2} color="#fff1dc" castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-5} shadow-camera-right={5} shadow-camera-top={5} shadow-camera-bottom={-5} shadow-bias={-0.0004} />
    <directionalLight position={[-4, 3, -5]} intensity={2.4} color="#ffc27a" />
    <directionalLight position={[4, 2.5, -4]} intensity={1.6} color="#a98bff" />
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <circleGeometry args={[6, 48]} />
      <meshStandardMaterial color="#cdb79a" roughness={0.9} />
    </mesh>
    {!portrait && (
      <>
        <Loki position={[0, 0, -1.6]} t={40} fire={1} armsUp={0.8} headPitch={-0.05} eyeGlow={1.2} />
        <Person look={LOOKS.bully} position={[1.05, 0, -0.5]} rotationY={-0.35} pose={{time: 10, brow: -0.6, smile: 0.4, armL: [0.1, -0.25, -0.5], armR: [0.1, 0.25, -0.5]}} rim="#ffd59a" rimStrength={1} />
        <Person look={LOOKS.hero} position={[-0.15, 0, 0.35]} rotationY={0.18} pose={{time: 10, lid: 0.45, smile: 0.1, headPitch: 0.05}} rim="#ffd59a" rimStrength={1.1} />
        <Dog position={[-0.78, 0, 0.95]} rotationY={0.45} phase={0} trot={0} sunglasses headYaw={0.2} t={20} />
      </>
    )}
    {portrait && (
      <>
        <Person look={LOOKS.hero} position={[0, 0, 0]} rotationY={0.25} pose={{time: 10, lid: 0.5, yawn: 0.25, headPitch: 0.06, brow: -0.2}} rim="#ffd59a" rimStrength={1.2} />
        <Dog position={[0.5, 0, 0.45]} rotationY={-0.35} phase={0} trot={0} sunglasses headYaw={-0.2} t={20} />
      </>
    )}
    <EffectComposer multisampling={0} enableNormalPass={false} frameBufferType={THREE.UnsignedByteType}>
      <Bloom intensity={0.8} luminanceThreshold={0.85} mipmapBlur />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <BrightnessContrast contrast={0.1} />
      <Vignette darkness={0.55} offset={0.3} />
    </EffectComposer>
    <Kick />
  </>
);

const useFonts = () => {
  const [h] = useState(() => delayRender('fonts'));
  const [ok, setOk] = useState(false);
  useEffect(() => {
    Promise.all(['400 40px Lora', 'italic 400 40px Lora', '700 30px Inter', '800 40px Poppins'].map((f) => document.fonts.load(f))).then(() => {
      setOk(true);
      continueRender(h);
    });
  }, [h]);
  return ok;
};

const Label: React.FC<{x: number; y: number; name: string; sub: string; color?: string}> = ({x, y, name, sub, color = '#ffffff'}) => (
  <div style={{position: 'absolute', left: x, top: y, transform: 'translateX(-50%)', textAlign: 'center', color: 'white', textShadow: '0 2px 12px rgba(0,0,0,0.7)'}}>
    <div style={{fontFamily: 'Poppins', fontWeight: 800, fontSize: 40, color}}>{name}</div>
    <div style={{fontFamily: 'Lora', fontStyle: 'italic', fontSize: 28, opacity: 0.9}}>{sub}</div>
  </div>
);

export const CharacterSheet: React.FC = () => {
  const {width, height} = useVideoConfig();
  const ok = useFonts();
  return (
    <AbsoluteFill style={{background: '#000'}}>
      {ok && (
        <ThreeCanvas width={width} height={height} shadows dpr={1} gl={{antialias: false, toneMapping: THREE.NoToneMapping, preserveDrawingBuffer: true}}>
          <Cam pos={[0, 1.35, 5.4]} target={[0, 1.05, -0.2]} fov={36} />
          <Studio />
        </ThreeCanvas>
      )}
      {ok && (
        <>
          <div style={{position: 'absolute', top: 120, width, textAlign: 'center', fontFamily: 'Lora', fontSize: 72, color: 'white', textShadow: '0 3px 20px rgba(0,0,0,0.6)'}}>
            The <span style={{color: '#ffd23f'}}>cast</span>
          </div>
          <Label x={250} y={1500} name="THE STRAY" sub="sunglasses from minute 3" />
          <Label x={520} y={1560} name="THE KID" sub="toothpaste on his shirt" color="#ffd23f" />
          <Label x={790} y={1430} name="THE BULLY" sub="about to lose his cap" />
          <Label x={540} y={260} name="LOKI" sub="original trickster design" color="#c9a2ff" />
        </>
      )}
    </AbsoluteFill>
  );
};

export const HeroPortrait: React.FC = () => {
  const {width, height} = useVideoConfig();
  const ok = useFonts();
  return (
    <AbsoluteFill style={{background: '#000'}}>
      {ok && (
        <ThreeCanvas width={width} height={height} shadows dpr={1} gl={{antialias: false, toneMapping: THREE.NoToneMapping, preserveDrawingBuffer: true}}>
          <Cam pos={[0.35, 1.25, 1.75]} target={[0.15, 1.12, 0]} fov={38} />
          <Studio portrait />
        </ThreeCanvas>
      )}
    </AbsoluteFill>
  );
};
