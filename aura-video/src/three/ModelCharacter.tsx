import React, {useLayoutEffect, useMemo} from 'react';
import * as THREE from 'three';
import {createPortal} from '@react-three/fiber';
import {useGLTF} from '@react-three/drei';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import {staticFile} from 'remotion';
import {makeRimMaterial, setRim} from './materials';

/**
 * CC0 Quaternius models (Ultimate Animated Character Pack / Ultimate Animated Animals),
 * animated deterministically: the mixer is set to an exact time every frame.
 */
export const MODELS = {
  boy: 'models/Casual_Male.gltf',
  boy2: 'models/Casual2_Male.gltf',
  dog: 'models/ShibaInu.glb',
  fox: 'models/Fox.glb',
} as const;
export type ModelKey = keyof typeof MODELS;

export type BoneOffsets = Record<string, [number, number, number]>;

type Props = {
  model: ModelKey;
  clip: string;
  time: number; // seconds into the clip
  clip2?: string; // optional blend target
  blend?: number; // 0..1 weight of clip2
  time2?: number;
  position?: [number, number, number];
  rotationY?: number;
  scale?: number;
  colors?: Record<string, string>;
  emissive?: Record<string, [string, number]>;
  rim?: string;
  rimStrength?: number;
  crack?: number;
  crackMats?: string[];
  override?: THREE.Material;
  bones?: BoneOffsets;
  attach?: Record<string, React.ReactNode>;
  castShadow?: boolean;
  metal?: Record<string, [number, number]>; // material -> [metalness, roughness]
  partial?: {clip: string; time: number; weight: number; bones: string[]};
};

export const ModelCharacter: React.FC<Props> = ({
  model,
  clip,
  time,
  clip2,
  blend = 0,
  time2,
  position = [0, 0, 0],
  rotationY = 0,
  scale = 1,
  colors = {},
  emissive = {},
  rim = '#ffd9a0',
  rimStrength = 1,
  crack = 0,
  crackMats = ['Skin', 'Face'],
  override,
  bones: offsets,
  attach,
  castShadow = true,
  metal = {},
  partial,
}) => {
  const gltf = useGLTF(staticFile(MODELS[model])) as any;
  const inst = useMemo(() => {
    const root = SkeletonUtils.clone(gltf.scene) as THREE.Object3D;
    const mats: THREE.MeshStandardMaterial[] = [];
    const boneMap: Record<string, THREE.Bone> = {};
    root.traverse((o: any) => {
      if (o.isBone) boneMap[o.name] = o;
      if (o.isMesh) {
        o.castShadow = castShadow;
        o.receiveShadow = true;
        o.frustumCulled = false;
        if (override) {
          o.material = override;
          return;
        }
        const conv = (m: THREE.MeshStandardMaterial) => {
          const c = colors[m.name] ? new THREE.Color(colors[m.name]) : m.color.clone();
          const em = emissive[m.name];
          const mt = metal[m.name];
          const nm = makeRimMaterial({
            color: c,
            roughness: mt ? mt[1] : 0.62,
            metalness: mt ? mt[0] : 0,
            flat: true,
            emissive: em ? em[0] : '#000000',
            emissiveIntensity: em ? em[1] : 1,
          });
          nm.name = m.name;
          mats.push(nm);
          return nm;
        };
        o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material);
      }
    });
    const mixer = new THREE.AnimationMixer(root);
    return {root, mats, boneMap, mixer};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gltf, override]);

  // drive animation + per-frame material uniforms
  useLayoutEffect(() => {
    const {mixer, root, boneMap, mats} = inst;
    const find = (n: string) => gltf.animations.find((a: THREE.AnimationClip) => a.name === n) ?? gltf.animations[0];
    let saved: (THREE.Quaternion | null)[] = [];
    if (partial && partial.weight > 0) {
      mixer.stopAllAction();
      const ap = mixer.clipAction(find(partial.clip));
      ap.reset().play();
      ap.time = partial.time;
      mixer.update(0);
      saved = partial.bones.map((n) => (boneMap[n] ? boneMap[n].quaternion.clone() : null));
    }
    mixer.stopAllAction();
    const a1 = mixer.clipAction(find(clip));
    a1.reset().play();
    a1.setEffectiveWeight(clip2 ? 1 - blend : 1);
    if (clip2) {
      const a2 = mixer.clipAction(find(clip2));
      a2.reset().play();
      a2.setEffectiveWeight(blend);
      a2.time = time2 ?? time;
    }
    a1.time = time;
    mixer.update(0);
    if (partial && partial.weight > 0) {
      partial.bones.forEach((n, i) => {
        const q = saved[i];
        if (q && boneMap[n]) boneMap[n].quaternion.slerp(q, Math.min(1, partial.weight));
      });
    }
    if (offsets) {
      for (const [name, [x, y, z]] of Object.entries(offsets)) {
        const b = boneMap[name];
        if (b) {
          b.rotation.x += x;
          b.rotation.y += y;
          b.rotation.z += z;
        }
      }
    }
    root.updateMatrixWorld(true);
    for (const m of mats) setRim(m, rim, rimStrength, crackMats.includes(m.name) ? crack : 0);
  });

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <primitive object={inst.root} />
      {attach &&
        Object.entries(attach).map(([bone, node]) =>
          inst.boneMap[bone] ? <React.Fragment key={bone}>{createPortal(<>{node}</>, inst.boneMap[bone])}</React.Fragment> : null
        )}
    </group>
  );
};

Object.values(MODELS).forEach((u) => useGLTF.preload(staticFile(u)));
