import {
  AdditiveBlending,
  Color,
  DoubleSide,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Vector2,
  type Material,
  type Texture,
} from 'three';
import { createAnodizedMaps, createBlastedMaps, createBrushedMaps } from '../../lib/textures';
import { createEngravingTexture, createPowerIconTexture } from './decals';

/** Linear-space colours shared with geometry builders (knurl vertex colours). */
export const TORCH_COLORS = {
  anodized: new Color('#17181b'),
  worn: new Color('#a9adb3'),
};

export interface TorchMaterials {
  anodized: MeshPhysicalMaterial;
  knurl: MeshPhysicalMaterial;
  brushed: MeshPhysicalMaterial;
  bezel: MeshPhysicalMaterial;
  buttonCap: MeshPhysicalMaterial;
  reflector: MeshPhysicalMaterial;
  glass: MeshPhysicalMaterial;
  ledDome: MeshPhysicalMaterial;
  ledCeramic: MeshStandardMaterial;
  ledPhosphor: MeshStandardMaterial;
  ledGasket: MeshStandardMaterial;
  ledPedestal: MeshStandardMaterial;
  rubber: MeshStandardMaterial;
  indicator: MeshPhysicalMaterial;
  clip: MeshPhysicalMaterial;
  screw: MeshPhysicalMaterial;
  screwRecess: MeshStandardMaterial;
  engraving: MeshStandardMaterial;
  icon: MeshStandardMaterial;
  dispose: () => void;
}

function setRepeat(t: Texture, x: number, y: number) {
  t.repeat.set(x, y);
  return t;
}

export function createTorchMaterials(): TorchMaterials {
  const anod = createAnodizedMaps(512, 23);
  const brushed = createBrushedMaps(512, 11);
  const blasted = createBlastedMaps(256, 41);
  const engravingTex = createEngravingTexture();
  const iconTex = createPowerIconTexture();

  // Hard-anodised aluminium is a dyed oxide (dielectric) over metal: dark,
  // satin, with a faint metallic tint in its reflections.
  const anodized = new MeshPhysicalMaterial({
    name: 'anodized-black',
    color: TORCH_COLORS.anodized,
    metalness: 0.28,
    roughness: 0.5,
    roughnessMap: anod.roughness,
    normalMap: anod.normal,
    normalScale: new Vector2(0.22, 0.22),
    ior: 1.62,
    specularIntensity: 0.9,
    clearcoat: 0.18,
    clearcoatRoughness: 0.42,
    envMapIntensity: 1.0,
  });

  // Same finish on the knurl, plus bare-metal wear on some peaks.
  const knurl = anodized.clone();
  knurl.name = 'knurl';
  knurl.color = new Color('#ffffff');
  knurl.vertexColors = true;
  knurl.normalScale = new Vector2(0.12, 0.12);
  knurl.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float wear;\nvarying float vWear;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWear = wear;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vWear;')
      .replace(
        '#include <metalnessmap_fragment>',
        '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 1.0, vWear);\nroughnessFactor = mix(roughnessFactor, 0.3, vWear);',
      );
  };
  knurl.customProgramCacheKey = () => 'knurl-wear';

  // Turned (lathe-brushed) aluminium: anisotropic highlights stretched across the grooves.
  const brushedMat = new MeshPhysicalMaterial({
    name: 'brushed-aluminium',
    color: new Color('#d9dce1'),
    metalness: 1,
    roughness: 0.3,
    roughnessMap: brushed.roughness,
    normalMap: brushed.normal,
    normalScale: new Vector2(0.16, 0.16),
    anisotropy: 0.7,
    anisotropyRotation: Math.PI / 2,
    envMapIntensity: 1.1,
  });
  const bezel = brushedMat.clone();
  bezel.name = 'bezel';
  bezel.roughness = 0.26;
  const buttonCap = brushedMat.clone();
  buttonCap.name = 'button-cap';
  buttonCap.roughness = 0.24;
  buttonCap.anisotropy = 0.85;

  // Mirror-polished (SMO) reflector.
  const reflector = new MeshPhysicalMaterial({
    name: 'reflector',
    color: new Color('#f4f5f7'),
    metalness: 1,
    roughness: 0.045,
    envMapIntensity: 1.35,
    side: DoubleSide,
  });

  // AR-coated window: rendered additively so only its Fresnel reflections are
  // drawn on top of the optics behind it (≈ 92 % transmission, like real glass).
  const glass = new MeshPhysicalMaterial({
    name: 'lens-glass',
    color: new Color('#000000'),
    metalness: 0,
    roughness: 0.015,
    ior: 1.52,
    specularIntensity: 1,
    iridescence: 0.6,
    iridescenceIOR: 1.38,
    iridescenceThicknessRange: [180, 420],
    envMapIntensity: 1.7,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const ledDome = glass.clone();
  ledDome.name = 'led-dome';
  ledDome.iridescence = 0;
  ledDome.ior = 1.41;
  ledDome.envMapIntensity = 1.2;

  const ledCeramic = new MeshStandardMaterial({ name: 'led-ceramic', color: '#efeee9', roughness: 0.55, metalness: 0 });
  const ledPhosphor = new MeshStandardMaterial({
    name: 'led-phosphor',
    color: '#e3c44f',
    roughness: 0.42,
    metalness: 0,
    emissive: new Color('#e9f0ff'),
    emissiveIntensity: 0,
  });
  const ledGasket = new MeshStandardMaterial({ name: 'centering-gasket', color: '#e6e4de', roughness: 0.75 });
  const ledPedestal = new MeshStandardMaterial({ name: 'mcpcb', color: '#2b2622', roughness: 0.5, metalness: 0.4 });

  const rubber = new MeshStandardMaterial({ name: 'o-ring', color: '#09090a', roughness: 0.5, metalness: 0 });

  // Smoked polycarbonate ring around the switch, lit from inside.
  const indicator = new MeshPhysicalMaterial({
    name: 'indicator-ring',
    color: new Color('#141414'),
    roughness: 0.18,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    emissive: new Color('#ffb547'),
    emissiveIntensity: 0,
  });

  // Stonewashed / bead-blasted titanium clip.
  const clip = new MeshPhysicalMaterial({
    name: 'titanium-clip',
    color: new Color('#a29e97'),
    metalness: 1,
    roughness: 0.44,
    roughnessMap: setRepeat(blasted.roughness, 3, 3),
    normalMap: blasted.normal,
    normalScale: new Vector2(0.28, 0.28),
    envMapIntensity: 1.0,
  });

  const screw = new MeshPhysicalMaterial({ name: 'screw', color: new Color('#5a5c61'), metalness: 1, roughness: 0.26, envMapIntensity: 1.1 });
  const screwRecess = new MeshStandardMaterial({ name: 'screw-recess', color: '#0c0c0d', roughness: 0.6, metalness: 0.6 });

  // Laser etching removes the dye and leaves a matte, light-grey oxide.
  const engraving = new MeshStandardMaterial({
    name: 'engraving',
    color: new Color('#bfc3c9'),
    map: engravingTex,
    roughness: 0.64,
    metalness: 0.1,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });
  const icon = new MeshStandardMaterial({
    name: 'power-icon',
    color: new Color('#2a2b2f'),
    map: iconTex,
    roughness: 0.62,
    metalness: 0.3,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });

  const materials: Material[] = [
    anodized, knurl, brushedMat, bezel, buttonCap, reflector, glass, ledDome, ledCeramic, ledPhosphor, ledGasket, ledPedestal, rubber,
    indicator, clip, screw, screwRecess, engraving, icon,
  ];

  return {
    anodized,
    knurl,
    brushed: brushedMat,
    bezel,
    buttonCap,
    reflector,
    glass,
    ledDome,
    ledCeramic,
    ledPhosphor,
    ledGasket,
    ledPedestal,
    rubber,
    indicator,
    clip,
    screw,
    screwRecess,
    engraving,
    icon,
    dispose: () => {
      materials.forEach((m) => m.dispose());
      anod.dispose();
      brushed.dispose();
      blasted.dispose();
      engravingTex.dispose();
      iconTex.dispose();
    },
  };
}
