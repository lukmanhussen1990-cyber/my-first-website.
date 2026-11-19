/**
 * Shared PBR materials — glossy stylized plastic & brushed metal.
 * Created once at module load so every frame reuses the same GPU programs.
 */
import * as THREE from 'three';

const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(p);
const phys = (p: THREE.MeshPhysicalMaterialParameters) => new THREE.MeshPhysicalMaterial(p);

export const MAT = {
  // housing — [cut face, outer skin]
  cutFace: std({ color: '#dfe6ea', metalness: 0.45, roughness: 0.36 }),
  housing: std({ color: '#b9c3ca', metalness: 0.72, roughness: 0.34 }),
  bore: std({ color: '#aeb8bf', metalness: 0.6, roughness: 0.3 }),
  roof: std({ color: '#a3adb5', metalness: 0.6, roughness: 0.32, side: THREE.DoubleSide }),

  chrome: std({ color: '#f1f4f7', metalness: 0.92, roughness: 0.14 }),
  steel: std({ color: '#b4bdc5', metalness: 0.85, roughness: 0.26 }),
  darkSteel: std({ color: '#7d8a94', metalness: 0.7, roughness: 0.3 }),
  gunmetal: std({ color: '#4a5159', metalness: 0.75, roughness: 0.35 }),
  bronze: std({ color: '#c9935a', metalness: 0.85, roughness: 0.3 }),

  // colour-coded flow paths
  intakeInner: std({ color: '#7cc3ff', metalness: 0.25, roughness: 0.38 }),
  intakePaint: phys({ color: '#2a7cf0', metalness: 0.35, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.15 }),
  exhaustPortInner: std({ color: '#e0874d', metalness: 0.35, roughness: 0.42 }),
  exhaustInner: std({ color: '#4b4441', metalness: 0.5, roughness: 0.55 }),

  ceramic: phys({ color: '#f6f3ec', metalness: 0, roughness: 0.22, clearcoat: 0.7, clearcoatRoughness: 0.1 }),
  spring: std({ color: '#7fd36b', metalness: 0.55, roughness: 0.3 }),
  rubber: std({ color: '#1e2124', metalness: 0, roughness: 0.7 }),
  wireRed: phys({ color: '#d93a2b', metalness: 0, roughness: 0.35, clearcoat: 0.6 }),
  plasticDark: std({ color: '#2b3138', metalness: 0.1, roughness: 0.45 }),
};

export const HOUSING_MATS = [MAT.cutFace, MAT.housing];
