import { useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { Mood } from "../lib/moods";
import { Vec3 } from "../lib/math";

// Sky dome, sun + fill light with soft shadows, and fog, all driven by the current mood.

export function sunDirection(m: Mood): Vec3 {
  const az = (m.sunAz * Math.PI) / 180;
  const el = (m.sunEl * Math.PI) / 180;
  return [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)];
}

const skyVert = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * p;
  }`;
const skyFrag = /* glsl */ `
  uniform vec3 top; uniform vec3 horizon; uniform vec3 glow; uniform vec3 sunDir; uniform float glowAmt; uniform float sunDisc;
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    float h = clamp(d.y, -0.2, 1.0);
    float k = pow(clamp(h, 0.0, 1.0), 0.55);
    vec3 col = mix(horizon, top, k);
    float s = max(dot(d, normalize(sunDir)), 0.0);
    col += glow * (pow(s, 6.0) * 0.55 + pow(s, 60.0) * 0.6) * glowAmt;
    col += glow * smoothstep(0.9993, 0.9997, s) * sunDisc;
    if (d.y < 0.0) col = mix(col, horizon, clamp(-d.y * 6.0, 0.0, 1.0));
    gl_FragColor = vec4(col, 1.0);
  }`;

export const Sky: React.FC<{ mood: Mood; sunDisc?: number; glowAmt?: number }> = ({ mood, sunDisc = 0, glowAmt = 1 }) => {
  const { camera } = useThree();
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          top: { value: new THREE.Color() },
          horizon: { value: new THREE.Color() },
          glow: { value: new THREE.Color() },
          sunDir: { value: new THREE.Vector3(0, 1, 0) },
          glowAmt: { value: 1 },
          sunDisc: { value: 0 },
        },
        vertexShader: skyVert,
        fragmentShader: skyFrag,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    [],
  );
  const mesh = useMemo(() => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), mat);
    m.renderOrder = -10;
    m.frustumCulled = false;
    m.scale.setScalar(700);
    return m;
  }, [mat]);
  useLayoutEffect(() => {
    mat.uniforms.top.value.set(mood.skyTop);
    mat.uniforms.horizon.value.set(mood.skyHorizon);
    mat.uniforms.glow.value.set(mood.skyGlow);
    const d = sunDirection(mood);
    mat.uniforms.sunDir.value.set(d[0], d[1], d[2]);
    mat.uniforms.glowAmt.value = glowAmt;
    mat.uniforms.sunDisc.value = sunDisc;
    mesh.position.copy(camera.position);
  });
  return <primitive object={mesh} />;
};

export const Lights: React.FC<{
  mood: Mood;
  center: Vec3; // what the shadows should cover
  radius: number;
  mapSize?: number;
  sunScale?: number;
}> = ({ mood, center, radius, mapSize = 2048, sunScale = 1 }) => {
  const { sun, hemi } = useMemo(() => {
    const s = new THREE.DirectionalLight("#ffffff", 2);
    s.castShadow = true;
    s.shadow.mapSize.set(mapSize, mapSize);
    s.shadow.bias = -0.0005;
    s.shadow.normalBias = 0.035;
    s.shadow.radius = 3;
    const h = new THREE.HemisphereLight("#ffffff", "#444444", 1);
    return { sun: s, hemi: h };
  }, [mapSize]);
  useLayoutEffect(() => {
    const d = sunDirection(mood);
    const dist = radius * 3;
    sun.position.set(center[0] + d[0] * dist, center[1] + d[1] * dist, center[2] + d[2] * dist);
    sun.target.position.set(center[0], center[1], center[2]);
    sun.target.updateMatrixWorld();
    sun.color.set(mood.sun);
    sun.intensity = mood.sunIntensity * sunScale;
    const cam = sun.shadow.camera as THREE.OrthographicCamera;
    cam.left = -radius;
    cam.right = radius;
    cam.top = radius;
    cam.bottom = -radius;
    cam.near = 1;
    cam.far = dist * 2.2;
    cam.updateProjectionMatrix();
    hemi.color.set(mood.hemiSky);
    hemi.groundColor.set(mood.hemiGround);
    hemi.intensity = mood.hemiIntensity;
  });
  return (
    <>
      <primitive object={sun} />
      <primitive object={sun.target} />
      <primitive object={hemi} />
    </>
  );
};

export const Fog: React.FC<{ mood: Mood; scale?: number }> = ({ mood, scale = 1 }) => {
  const { scene } = useThree();
  useLayoutEffect(() => {
    if (!(scene.fog instanceof THREE.Fog)) scene.fog = new THREE.Fog("#ffffff", 10, 100);
    const f = scene.fog as THREE.Fog;
    f.color.set(mood.fog);
    f.near = mood.fogNear * scale;
    f.far = mood.fogFar * scale;
    scene.background = null;
  });
  return null;
};
