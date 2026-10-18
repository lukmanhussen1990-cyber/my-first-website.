import * as THREE from 'three';
import { Starfield, Moon } from '../world/space.js';
import { Mirror } from '../world/mirror.js';
import { makeNoise2D } from '../world/noise.js';
import { GLSL_NOISE, ease, remap, lerp, rng, smoothstep } from '../core/util.js';
import { C, drawPill, drawDivider, appear } from '../core/overlay.js';

// Scene 3: coastal city at night, with moonlight vs. without (before/after split).
export function cityShot(ctx, sky) {
  const { E } = ctx;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, ctx.W / ctx.H, 0.5, 3000);
  const N = makeNoise2D(11);

  // ------------------------------------------------------------------ shared lighting uniforms
  const U = {
    moonLightDir: { value: new THREE.Vector3(-0.45, 0.62, 0.64).normalize() }, // cheated key from front-left
    moonCol: { value: new THREE.Vector3() },
    ambient: { value: new THREE.Vector3() },
    fogCol: { value: new THREE.Vector3() },
    fogDensity: { value: 0.0022 },
    cityGlow: { value: new THREE.Vector3(0.9, 0.5, 0.22) },
    time: { value: 0 },
  };
  const FOG = /* glsl */ `
    vec3 applyFog(vec3 col, vec3 wp){
      float d = length(wp - cameraPosition);
      float f = 1.0 - exp(-d * fogDensity);
      return mix(col, fogCol, f);
    }`;

  // ------------------------------------------------------------------ terrain
  const shoreZ = (x) => -140 + 8 * Math.sin(x * 0.02 + 0.4) + Math.max(0, Math.abs(x) - 115) * 1.05;
  const GAP_X = -92; // valley where the Moon rises (matches MOON_SCREEN below)
  const heightAt = (x, z) => {
    const land = shoreZ(x) - z; // > 0 on land
    const base = lerp(-4, 0.6 + Math.max(0, land) * 0.02, smoothstep(-2, 4, land));
    const r = N.ridged(x * 0.0062 + 3.1, z * 0.0062 - 1.7, 5);
    const b = N.fbm(x * 0.0035 + 9, z * 0.0035, 3) * 0.5 + 0.5;
    const gap = 1 - 0.78 * Math.exp(-(((x - GAP_X) / 55) ** 2));
    const far = smoothstep(95, 190, land) * (26 + 78 * Math.pow(r, 1.6) * (0.55 + 0.8 * b)) * gap;
    const mid = smoothstep(40, 85, land) * (5 + 16 * (N.fbm(x * 0.012, z * 0.012, 4) * 0.5 + 0.5)) * (0.6 + 0.4 * gap);
    // dark foreground hill framing the left edge of the bay
    const side = smoothstep(-62, -128, x) * smoothstep(-170, -30, z) * (14 + 26 * (N.fbm(x * 0.015, z * 0.015, 4) * 0.5 + 0.5));
    return base + Math.max(far + mid, side);
  };
  const tGeo = new THREE.PlaneGeometry(1100, 700, 440, 280);
  tGeo.rotateX(-Math.PI / 2);
  tGeo.translate(0, 0, -260);
  const tp = tGeo.attributes.position;
  for (let i = 0; i < tp.count; i++) tp.setY(i, heightAt(tp.getX(i), tp.getZ(i)));
  tGeo.computeVertexNormals();
  const terrain = new THREE.Mesh(
    tGeo,
    new THREE.ShaderMaterial({
      uniforms: { ...U, snowLine: { value: 58 } },
      vertexShader: /* glsl */ `
        varying vec3 vW, vN;
        void main(){
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        ${GLSL_NOISE}
        uniform vec3 moonLightDir, moonCol, ambient, fogCol, cityGlow;
        uniform float fogDensity, snowLine;
        varying vec3 vW, vN;
        ${FOG}
        void main(){
          vec3 N = normalize(vN);
          float n = fbm(vW * 0.08, 4);
          float slope = 1.0 - N.y;
          vec3 forest = vec3(0.018, 0.03, 0.024) * (0.8 + 0.4 * n);
          vec3 rock = vec3(0.07, 0.072, 0.08) * (0.8 + 0.5 * n);
          vec3 alb = mix(forest, rock, smoothstep(0.25, 0.55, slope + 0.15 * n));
          float snow = smoothstep(snowLine - 6.0, snowLine + 6.0, vW.y + n * 14.0) * (1.0 - smoothstep(0.45, 0.8, slope));
          alb = mix(alb, vec3(0.75, 0.8, 0.88), snow);
          float diff = max(dot(N, normalize(moonLightDir)), 0.0);
          vec3 col = alb * (moonCol * diff + ambient * (0.6 + 0.4 * N.y));
          // warm spill from the city on low ground
          float near = exp(-max(vW.y - 1.0, 0.0) * 0.08) * smoothstep(-230.0, -170.0, vW.z) * smoothstep(-90.0, -140.0, vW.z) * (1.0 - smoothstep(110.0, 170.0, abs(vW.x)));
          col += alb * cityGlow * near * 0.6;
          gl_FragColor = vec4(applyFog(col, vW), 1.0);
        }`,
    }),
  );
  scene.add(terrain);

  // ------------------------------------------------------------------ city buildings
  const r = rng(5);
  const bGeo = new THREE.BoxGeometry(1, 1, 1);
  bGeo.translate(0, 0.5, 0);
  const placements = [];
  for (let tries = 0; tries < 30000 && placements.length < 2600; tries++) {
    const x = (r() * 2 - 1) * 150;
    const sz = shoreZ(x);
    const z = sz - 2.5 - Math.pow(r(), 1.2) * 38;
    const land = sz - z;
    if (heightAt(x, z) > 3.0 || land < 2) continue;
    const core = Math.exp(-((x - 12) ** 2) / (2 * 30 ** 2)) * Math.exp(-((land - 12) ** 2) / (2 * 12 ** 2));
    const h = 1.4 + Math.pow(r(), 2.6) * 5.5 + core * Math.pow(r(), 1.6) * 21;
    const w = 1.6 + r() * 2.6;
    const d = 1.6 + r() * 2.6;
    placements.push({ x, z, y: heightAt(x, z) - 0.3, h, w, d });
  }
  const buildings = new THREE.InstancedMesh(
    bGeo,
    new THREE.ShaderMaterial({
      uniforms: U,
      vertexShader: /* glsl */ `
        attribute float seed;
        varying vec3 vW, vN, vL;
        varying float vSeed;
        void main(){
          vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
          vW = w.xyz;
          vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
          vL = position;
          vSeed = seed;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        ${GLSL_NOISE}
        uniform vec3 moonLightDir, moonCol, ambient, fogCol;
        uniform float fogDensity;
        varying vec3 vW, vN, vL;
        varying float vSeed;
        ${FOG}
        void main(){
          vec3 N = normalize(vN);
          float roof = step(0.5, N.y);
          float u = abs(N.x) > 0.5 ? vW.z : vW.x;
          vec2 g = vec2(u / 0.62, vW.y / 0.78);
          vec2 cell = floor(g);
          vec2 f = fract(g);
          vec2 fw = fwidth(g) * 1.2;
          float win = smoothstep(0.16 - fw.x, 0.16 + fw.x, f.x) * smoothstep(0.84 + fw.x, 0.84 - fw.x, f.x)
                    * smoothstep(0.24 - fw.y, 0.24 + fw.y, f.y) * smoothstep(0.80 + fw.y, 0.80 - fw.y, f.y);
          float face = floor(N.x * 2.0 + N.z * 3.0 + 5.0);
          float h1 = hash13(vec3(cell, vSeed * 37.0 + face * 7.0));
          float h2 = hash13(vec3(cell.yx, vSeed * 11.0 + face));
          float litFrac = 0.25 + 0.3 * hash13(vec3(vSeed, 3.0, face));
          float lit = step(h1, litFrac) * win * (1.0 - roof) * step(0.5, vW.y);
          vec3 wc = mix(vec3(1.0, 0.58, 0.26), vec3(1.0, 0.82, 0.56), h2);
          wc = mix(wc, vec3(0.75, 0.88, 1.0), step(0.86, h2));
          vec3 em = wc * lit * (1.6 + 2.2 * h2);
          vec3 alb = vec3(0.045, 0.05, 0.06) * (0.7 + 0.6 * hash13(vec3(vSeed)));
          float diff = max(dot(N, normalize(moonLightDir)), 0.0);
          vec3 col = alb * (moonCol * diff * 1.4 + ambient * 1.5) + em;
          col += win * (1.0 - lit) * (1.0 - roof) * (ambient * 1.2 + moonCol * 0.015);
          // aviation lights on tall towers
          gl_FragColor = vec4(applyFog(col, vW), 1.0);
        }`,
    }),
    placements.length,
  );
  const seeds = new Float32Array(placements.length);
  const m4 = new THREE.Matrix4();
  placements.forEach((p, i) => {
    m4.compose(new THREE.Vector3(p.x, p.y, p.z), new THREE.Quaternion(), new THREE.Vector3(p.w, p.h, p.d));
    buildings.setMatrixAt(i, m4);
    seeds[i] = r();
  });
  bGeo.setAttribute('seed', new THREE.InstancedBufferAttribute(seeds, 1));
  buildings.frustumCulled = false;
  scene.add(buildings);

  // ------------------------------------------------------------------ street lights
  const lightPts = [];
  const lightCols = [];
  const lightSizes = [];
  for (let x = -150; x < 150; x += 1.3) {
    // shore promenade + inland roads
    const sz = shoreZ(x);
    for (const off of [1.4, 7, 13, 20, 27, 34]) {
      const z = sz - off + (r() - 0.5) * 0.4;
      if (heightAt(x, z) > 3.0 || r() < 0.18) continue;
      lightPts.push(x + (r() - 0.5) * 0.5, heightAt(x, z) + 0.9, z);
      const sodium = r() < 0.72;
      const b = 1.5 + r() * 2.0;
      lightCols.push(...(sodium ? [1.0 * b, 0.55 * b, 0.2 * b] : [0.85 * b, 0.9 * b, 1.0 * b]));
      lightSizes.push(1.6 + r() * 1.6);
    }
  }
  for (let z = -100; z > -190; z -= 1.2) {
    // cross streets
    for (let x = -140; x < 140; x += 9 + r() * 5) {
      if (shoreZ(x) - z < 2 || heightAt(x, z) > 3.0 || r() < 0.3) continue;
      lightPts.push(x, heightAt(x, z) + 0.9, z);
      const b = 1.4 + r() * 1.8;
      lightCols.push(1.0 * b, 0.6 * b, 0.25 * b);
      lightSizes.push(1.5 + r() * 1.4);
    }
  }
  const lGeo = new THREE.BufferGeometry();
  lGeo.setAttribute('position', new THREE.Float32BufferAttribute(lightPts, 3));
  lGeo.setAttribute('color', new THREE.Float32BufferAttribute(lightCols, 3));
  lGeo.setAttribute('size', new THREE.Float32BufferAttribute(lightSizes, 1));
  const lights = new THREE.Points(
    lGeo,
    new THREE.ShaderMaterial({
      uniforms: { pxScale: { value: 1 }, fogCol: U.fogCol, fogDensity: U.fogDensity },
      vertexShader: /* glsl */ `
        attribute float size; attribute vec3 color;
        uniform float pxScale;
        varying vec3 vC;
        void main(){
          vC = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = size * pxScale * clamp(260.0 / -mv.z, 0.7, 1.5);
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vC;
        void main(){
          vec2 p = gl_PointCoord * 2.0 - 1.0;
          float d = dot(p, p);
          float a = exp(-d * 4.5);
          if (a < 0.01) discard;
          gl_FragColor = vec4(vC * a, 1.0);
        }`,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    }),
  );
  lights.frustumCulled = false;
  scene.add(lights);

  // ------------------------------------------------------------------ sky: stars + gradient + moon
  const starfield = new Starfield(sky, { count: 7000, seed: 21 });
  scene.add(starfield.group);
  const skyU = {
    moonDir: { value: new THREE.Vector3() },
    moonOn: { value: 1 },
    zenith: { value: new THREE.Vector3() },
    horizon: { value: new THREE.Vector3() },
    pollution: { value: 1 },
  };
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(950, 48, 24),
    new THREE.ShaderMaterial({
      uniforms: skyU,
      vertexShader: /* glsl */ `
        varying vec3 vD;
        void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 moonDir, zenith, horizon;
        uniform float moonOn, pollution;
        varying vec3 vD;
        void main(){
          vec3 d = normalize(vD);
          float h = max(d.y, 0.0);
          vec3 col = mix(horizon, zenith, pow(h, 0.45));
          float md = max(dot(d, normalize(moonDir)), 0.0);
          col += moonOn * (vec3(0.75, 0.82, 1.0) * pow(md, 900.0) * 0.6 + vec3(0.45, 0.55, 0.8) * pow(md, 60.0) * 0.12 + vec3(0.2, 0.28, 0.45) * pow(md, 6.0) * 0.05);
          col += pollution * vec3(0.9, 0.48, 0.2) * 0.035 * exp(-h * 14.0) * smoothstep(0.2, 0.9, -d.z);
          gl_FragColor = vec4(col, 1.0);
        }`,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      transparent: true,
    }),
  );
  dome.renderOrder = -8;
  scene.add(dome);
  const moon = new Moon(ctx.tex);
  moon.uniforms.albedoGain.value = 1.6;
  scene.add(moon.group);
  const MOON_SCREEN = [290, 640];
  const MOON_DIST = 800;
  let MOON_DIR = null;

  // ------------------------------------------------------------------ water
  const mirror = new Mirror(Math.round(ctx.W / 2), Math.round(ctx.H / 2));
  const waterU = {
    tRefl: { value: mirror.rt.texture },
    textureMatrix: { value: mirror.textureMatrix },
    moonDir: skyU.moonDir,
    moonOn: skyU.moonOn,
    time: U.time,
    fogCol: U.fogCol,
    fogDensity: U.fogDensity,
    ambient: U.ambient,
  };
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(1200, 420, 1, 1).rotateX(-Math.PI / 2).translate(0, 0, -20),
    new THREE.ShaderMaterial({
      uniforms: waterU,
      vertexShader: /* glsl */ `
        uniform mat4 textureMatrix;
        varying vec4 vR; varying vec3 vW;
        void main(){
          vR = textureMatrix * vec4(position, 1.0);
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        ${GLSL_NOISE}
        uniform sampler2D tRefl;
        uniform vec3 moonDir, fogCol, ambient;
        uniform float moonOn, time, fogDensity;
        varying vec4 vR; varying vec3 vW;
        ${FOG}
        float hgt(vec2 p){
          float h = 0.0;
          h += sin(dot(p, vec2(0.06, 0.9)) * 1.1 + time * 1.6) * 0.5;
          h += sin(dot(p, vec2(-0.5, 0.7)) * 1.7 + time * 2.1) * 0.3;
          h += gnoise(vec3(p * vec2(0.9, 2.2), time * 0.6)) * 0.45;
          h += gnoise(vec3(p * vec2(2.3, 5.0), time * 0.9)) * 0.18;
          return h;
        }
        void main(){
          vec2 p = vW.xz;
          float d = length(vW - cameraPosition);
          float e = 0.05;
          float h0 = hgt(p);
          vec2 gr = vec2(hgt(p + vec2(e, 0.0)) - h0, hgt(p + vec2(0.0, e)) - h0) / e;
          float amp = 0.07 * clamp(110.0 / d, 0.2, 1.0);
          vec3 N = normalize(vec3(-gr.x * amp, 1.0, -gr.y * amp));
          vec3 V = normalize(cameraPosition - vW);
          float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
          vec2 uv = vR.xy / vR.w;
          uv += vec2(N.x * 0.25, N.z * 1.3) * 0.16;
          vec3 refl = texture2D(tRefl, uv).rgb;
          vec3 col = vec3(0.004, 0.008, 0.016) + ambient * 0.5;
          col = mix(col, refl, clamp(0.35 + fres * 0.9, 0.0, 1.0));
          vec3 H = normalize(normalize(moonDir) + V);
          float glint = pow(max(dot(N, H), 0.0), 900.0);
          col += moonOn * vec3(0.85, 0.9, 1.0) * glint * 9.0;
          gl_FragColor = vec4(applyFog(col, vW), 1.0);
        }`,
    }),
  );
  scene.add(water);

  // ------------------------------------------------------------------ conditions
  function setCondition(withMoon) {
    if (withMoon) {
      U.moonCol.value.set(0.36, 0.44, 0.66);
      U.ambient.value.set(0.016, 0.024, 0.045);
      U.fogCol.value.set(0.016, 0.026, 0.05);
      skyU.zenith.value.set(0.004, 0.009, 0.026);
      skyU.horizon.value.set(0.03, 0.05, 0.095);
      skyU.moonOn.value = 1;
      skyU.pollution.value = 0.6;
      moon.group.visible = true;
    } else {
      U.moonCol.value.set(0, 0, 0);
      U.ambient.value.set(0.0022, 0.003, 0.0055);
      U.fogCol.value.set(0.0035, 0.004, 0.008);
      skyU.zenith.value.set(0.0006, 0.001, 0.0028);
      skyU.horizon.value.set(0.004, 0.0055, 0.011);
      skyU.moonOn.value = 0;
      skyU.pollution.value = 1.0;
      moon.group.visible = false;
    }
    return withMoon;
  }

  const split = (t) => lerp(1080, 540, ease.inOutCubic(remap(t, E.split_sweep, E.split_sweep + 0.75)));

  function renderCondition(withMoon, scissor) {
    const R = ctx.renderer;
    const cond = setCondition(withMoon);
    starfield.update(camera, U.time.value, { pxScale: ctx.SCALE, starIntensity: cond ? 0.45 : 1.25, skyIntensity: cond ? 0.35 : 1.6 });
    mirror.render(R, scene, camera, water, 0);
    R.setRenderTarget(ctx.post.sceneRT);
    if (scissor) {
      R.setScissorTest(true);
      R.setScissor(scissor[0], 0, scissor[1], ctx.H);
    }
    const ac = R.autoClear;
    R.autoClear = false;
    R.clear(true, true, false);
    R.render(scene, camera);
    R.autoClear = ac;
    R.setScissorTest(false);
  }

  return {
    name: 'city',
    t0: E.s3_start,
    t1: E.s4_start,
    render(t) {
      const lt = t - E.s3_start;
      U.time.value = t;
      const k = ease.inOutSine(remap(lt, 0, 4));
      camera.position.set(lerp(13, 6, k), lerp(25, 23, k), lerp(122, 106, k));
      camera.lookAt(lerp(-6, -3, k), lerp(14, 13, k), -150);
      camera.updateMatrixWorld(true);
      if (!MOON_DIR) {
        const v = new THREE.Vector3((MOON_SCREEN[0] / 1080) * 2 - 1, 1 - (MOON_SCREEN[1] / 1920) * 2, 0.5).unproject(camera);
        MOON_DIR = v.sub(camera.position).normalize();
      }
      lights.material.uniforms.pxScale.value = ctx.SCALE;
      const md = MOON_DIR.clone();
      skyU.moonDir.value.copy(md);
      moon.group.position.copy(camera.position).addScaledVector(md, MOON_DIST);
      moon.group.scale.setScalar(MOON_DIST * Math.tan((3.0 * Math.PI) / 180 / 2));
      moon.uniforms.sunDir.value.copy(md).negate().add(new THREE.Vector3(0.25, 0.1, 0)).normalize();
      moon.faceTowards(camera.position);

      const R = ctx.renderer;
      R.setRenderTarget(ctx.post.sceneRT);
      R.setClearColor(0x000000, 1);
      R.clear(true, true, false);
      const sx = Math.round((split(t) / 1080) * ctx.W);
      renderCondition(true, sx < ctx.W ? [0, sx] : null);
      if (sx < ctx.W) renderCondition(false, [sx, ctx.W - sx]);

      const enter = remap(t, E.s3_start, E.s3_start + 0.45);
      return {
        exposure: 1.35 + 0.8 * (1 - ease.outCubic(enter)),
        zoomBlur: 0.4 * (1 - ease.outCubic(enter)) + 0.3 * ease.inCubic(remap(t, E.s3_exit, E.s4_start)),
        bloomStrength: 1.1,
        bloomThreshold: 0.7,
        vignette: 0.5,
      };
    },
    overlay(c, t) {
      const x = split(t);
      const a = remap(t, E.split_sweep - 0.05, E.split_sweep + 0.1) * (1 - remap(t, E.s3_exit, E.s3_exit + 0.2));
      drawDivider(c, x, a, { top: 640, bottom: 1920, handleY: 1180 });
      const l = appear(t, E.split_labels, E.s3_exit + 0.15);
      drawPill(c, { x: 272, y: 765, text: 'WITH MOONLIGHT', size: 34, p: l.p, a: l.a, accent: C.blue });
      const l2 = appear(t, E.split_labels + 0.12, E.s3_exit + 0.15);
      drawPill(c, { x: 800, y: 765, text: 'WITHOUT MOONLIGHT', size: 34, p: l2.p, a: l2.a, accent: C.red });
    },
  };
}
