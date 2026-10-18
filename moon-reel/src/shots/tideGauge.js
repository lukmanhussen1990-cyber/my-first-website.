import * as THREE from 'three';
import { GLSL_NOISE, ease, remap, lerp } from '../core/util.js';
import { C, drawPill, drawDivider, drawRangeArrow, appear, ICONS } from '../core/overlay.js';
import { toScreen } from './common.js';
import { makeNoise2D } from '../world/noise.js';

// Scene 4b: daytime tide gauges, with the Moon (big range) vs. without (Sun-only, smaller range).
export function tideGaugeShot(ctx) {
  const { E } = ctx;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, ctx.W / ctx.H, 0.1, 2000);
  const SUN = new THREE.Vector3(-0.45, 0.62, -0.64).normalize();
  const AMP_MOON = 1.15;
  const AMP_SUN = 0.44; // solar tide is roughly 46% of the lunar one
  const PERIOD = 1.75;
  const level = (t, amp) => amp * Math.sin(((t - E.tide_cut) / PERIOD) * Math.PI * 2 - 0.4);

  // ---------------------------------------------------------------- sky
  const skyU = { sunDir: { value: SUN }, time: { value: 0 } };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1500, 48, 24),
    new THREE.ShaderMaterial({
      uniforms: skyU,
      vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: /* glsl */ `
        ${GLSL_NOISE}
        uniform vec3 sunDir; uniform float time;
        varying vec3 vD;
        void main(){
          vec3 d = normalize(vD);
          float h = max(d.y, 0.0);
          vec3 col = mix(vec3(0.5, 0.74, 1.0), vec3(0.06, 0.26, 0.8), pow(h, 0.5)) * 1.2;
          float sd = max(dot(d, sunDir), 0.0);
          col += vec3(1.0, 0.92, 0.75) * (pow(sd, 1200.0) * 40.0 + pow(sd, 40.0) * 0.6 + pow(sd, 6.0) * 0.12);
          vec2 p = d.xz / max(d.y, 0.06) * 0.9 + vec2(time * 0.04, 0.0);
          float cl = smoothstep(0.05, 0.6, fbm(vec3(p * 1.3, 2.0), 5) + 0.12);
          vec3 cc = mix(vec3(0.78, 0.84, 0.93), vec3(1.05), smoothstep(0.2, 0.9, fbm(vec3(p * 2.6, 5.0), 3) * 0.5 + 0.5));
          col = mix(col, cc * 1.3, cl * smoothstep(0.02, 0.2, d.y) * 0.85);
          gl_FragColor = vec4(col, 1.0);
        }`,
      side: THREE.BackSide,
      depthWrite: false,
    }),
  );
  sky.renderOrder = -10;
  scene.add(sky);

  // ---------------------------------------------------------------- distant coast
  const N = makeNoise2D(4);
  const hills = new THREE.PlaneGeometry(1400, 260, 280, 40).rotateX(-Math.PI / 2).translate(0, 0, -330);
  const hp = hills.attributes.position;
  for (let i = 0; i < hp.count; i++) {
    const x = hp.getX(i);
    const z = hp.getZ(i);
    const back = Math.min(1, Math.max(0, (-z - 230) / 80));
    hp.setY(i, -2 + back * (14 + 34 * (N.fbm(x * 0.006, z * 0.01, 5) * 0.5 + 0.5)));
  }
  hills.computeVertexNormals();
  scene.add(
    new THREE.Mesh(
      hills,
      new THREE.ShaderMaterial({
        uniforms: { sunDir: { value: SUN } },
        vertexShader: 'varying vec3 vW, vN; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vN = normal; gl_Position = projectionMatrix * viewMatrix * w; }',
        fragmentShader: /* glsl */ `
          uniform vec3 sunDir; varying vec3 vW, vN;
          void main(){
            vec3 alb = mix(vec3(0.12, 0.2, 0.1), vec3(0.3, 0.32, 0.22), smoothstep(8.0, 30.0, vW.y));
            vec3 col = alb * (max(dot(normalize(vN), sunDir), 0.0) * 1.6 + 0.35);
            float d = length(vW - cameraPosition);
            col = mix(col, vec3(0.62, 0.78, 0.95) * 1.15, 1.0 - exp(-d * 0.0034));
            gl_FragColor = vec4(col, 1.0);
          }`,
      }),
    ),
  );

  // ---------------------------------------------------------------- posts + gauges
  const postU = { sunDir: { value: SUN }, highMark: { value: 1 }, lowMark: { value: -1 } };
  const postMat = new THREE.ShaderMaterial({
    uniforms: postU,
    vertexShader: 'varying vec3 vW, vN, vO; void main(){ vO = position; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: /* glsl */ `
      ${GLSL_NOISE}
      uniform vec3 sunDir; uniform float highMark, lowMark;
      varying vec3 vW, vN, vO;
      void main(){
        vec3 N = normalize(vN);
        float a = atan(vO.x, vO.z);
        float grain = fbm(vec3(a * 3.0, vW.y * 0.6, 1.0), 5);
        vec3 wood = mix(vec3(0.33, 0.24, 0.15), vec3(0.5, 0.38, 0.25), grain * 0.5 + 0.5);
        wood *= 0.85 + 0.25 * sin(a * 40.0 + grain * 6.0);
        float wet = smoothstep(highMark + 0.12, highMark - 0.05, vW.y + 0.06 * gnoise(vec3(a * 4.0, vW.y * 3.0, 0.0)));
        vec3 alb = mix(wood, wood * vec3(0.38, 0.42, 0.33), wet);
        float algae = smoothstep(lowMark + 0.5, lowMark - 0.1, vW.y);
        alb = mix(alb, vec3(0.08, 0.16, 0.08), algae * 0.85);
        float barn = step(0.78, fbm(vec3(a * 14.0, vW.y * 14.0, 3.0), 2) * 0.5 + 0.5) * algae;
        alb = mix(alb, vec3(0.75, 0.72, 0.65), barn);
        float diff = max(dot(N, sunDir), 0.0);
        vec3 col = alb * (diff * 2.2 + 0.45);
        vec3 V = normalize(cameraPosition - vW);
        col += wet * pow(max(dot(reflect(-sunDir, N), V), 0.0), 40.0) * 0.4;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  // staff gauge texture (white board, black E marks every 10 cm, metre numerals)
  const gc = document.createElement('canvas');
  gc.width = 256;
  gc.height = 2560;
  const g = gc.getContext('2d');
  g.fillStyle = '#f4f4ef';
  g.fillRect(0, 0, 256, 2560);
  const pxPerM = 2560 / 3.2; // board spans -1.5 .. 1.7 m (gauge datum at the bottom)
  const yOf = (m) => 2560 - (m + 1.5) * pxPerM;
  for (let cm = -150; cm < 170; cm += 10) {
    const y0 = yOf((cm + 10) / 100);
    const h = pxPerM * 0.1;
    const left = Math.round(cm / 10) % 2 === 0;
    g.fillStyle = '#111';
    const x0 = left ? 18 : 128;
    g.fillRect(x0, y0, 22, h * 0.5);
    for (let k = 0; k < 3; k++) g.fillRect(x0, y0 + k * h * 0.2, 90, h * 0.1);
  }
  g.font = '900 120px Montserrat';
  g.fillStyle = '#d0201a';
  g.textAlign = 'center';
  for (const m of [-1, 0, 1]) g.fillText(String(m + 2), m % 2 ? 72 : 184, yOf(m + 0.5) + 40);
  const gaugeTex = new THREE.CanvasTexture(gc);
  gaugeTex.colorSpace = THREE.SRGBColorSpace;
  gaugeTex.anisotropy = 8;
  const gaugeMat = new THREE.ShaderMaterial({
    uniforms: { map: { value: gaugeTex }, sunDir: { value: SUN }, highMark: postU.highMark },
    vertexShader: 'varying vec2 vUv; varying vec3 vW, vN; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: /* glsl */ `
      uniform sampler2D map; uniform vec3 sunDir; uniform float highMark;
      varying vec2 vUv; varying vec3 vW, vN;
      void main(){
        vec3 alb = texture2D(map, vUv).rgb;
        float wet = smoothstep(highMark + 0.08, highMark - 0.04, vW.y);
        alb *= mix(1.0, 0.72, wet);
        vec3 col = alb * (max(dot(normalize(vN), sunDir), 0.0) * 1.6 + 0.62);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const POSTS_X = [-1.0, 1.0];
  for (const x of POSTS_X) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.29, 7.5, 40, 1), postMat);
    post.position.set(x, -0.6, 0);
    scene.add(post);
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.34, 3.2, 0.04), [postMat, postMat, postMat, postMat, gaugeMat, postMat]);
    board.position.set(x, 0.1, 0.29);
    scene.add(board);
  }
  // a few background piles to make it read as a pier
  for (const x of [-6.5, -3.9, 3.9, 6.5]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 7.5, 32, 1), postMat);
    p.position.set(x, -0.6, -2.6);
    scene.add(p);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(16, 0.35, 0.4), postMat);
  beam.position.set(0, 2.85, -1.3);
  scene.add(beam);

  // ---------------------------------------------------------------- water
  const waterU = {
    time: { value: 0 },
    level: { value: 0 },
    sunDir: { value: SUN },
    posts: { value: POSTS_X.map((x) => new THREE.Vector2(x, 0)) },
  };
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 400, 280, 160).rotateX(-Math.PI / 2).translate(0, 0, -140),
    new THREE.ShaderMaterial({
      uniforms: waterU,
      vertexShader: /* glsl */ `
        uniform float time, level;
        varying vec3 vW; varying float vH;
        float waves(vec2 p){
          float h = 0.0;
          h += sin(dot(p, vec2(0.15, 0.98)) * 1.05 + time * 2.6) * 0.11;
          h += sin(dot(p, vec2(-0.6, 0.8)) * 1.9 + time * 3.4) * 0.06;
          h += sin(dot(p, vec2(0.7, 0.7)) * 3.3 + time * 4.6) * 0.03;
          return h;
        }
        void main(){
          vec3 p = position;
          float fade = clamp(1.0 - (-p.z - 20.0) / 120.0, 0.0, 1.0);
          float h = waves(p.xz) * fade;
          p.y = level + h;
          vH = h;
          vec4 w = modelMatrix * vec4(p, 1.0);
          vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        ${GLSL_NOISE}
        uniform float time, level;
        uniform vec3 sunDir;
        uniform vec2 posts[2];
        varying vec3 vW; varying float vH;
        float hgt(vec2 p){
          float h = 0.0;
          h += sin(dot(p, vec2(0.15, 0.98)) * 1.05 + time * 2.6) * 0.11;
          h += sin(dot(p, vec2(-0.6, 0.8)) * 1.9 + time * 3.4) * 0.06;
          h += sin(dot(p, vec2(0.7, 0.7)) * 3.3 + time * 4.6) * 0.03;
          h += gnoise(vec3(p * 1.7, time * 0.9)) * 0.025 + gnoise(vec3(p * 4.1, time * 1.3)) * 0.01;
          return h;
        }
        void main(){
          vec2 p = vW.xz;
          float d = length(vW - cameraPosition);
          float e = 0.03;
          float h0 = hgt(p);
          vec2 gr = vec2(hgt(p + vec2(e, 0.0)) - h0, hgt(p + vec2(0.0, e)) - h0) / e;
          gr *= clamp(30.0 / d, 0.12, 1.0);
          vec3 N = normalize(vec3(-gr.x, 1.0, -gr.y));
          vec3 V = normalize(cameraPosition - vW);
          float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
          vec3 R = reflect(-V, N);
          vec3 skyc = mix(vec3(0.5, 0.74, 1.0), vec3(0.06, 0.26, 0.8), pow(max(R.y, 0.0), 0.5)) * 1.2;
          vec3 body = mix(vec3(0.02, 0.2, 0.24), vec3(0.04, 0.32, 0.36), smoothstep(-0.1, 0.12, vH));
          body *= 0.8 + 0.6 * max(dot(N, sunDir), 0.0);
          vec3 col = mix(body, skyc, fres);
          col += vec3(1.0, 0.95, 0.85) * pow(max(dot(R, sunDir), 0.0), 380.0) * 14.0;
          // foam around the posts and on crests
          float foam = 0.0;
          for (int i = 0; i < 2; i++) {
            float r = length(p - posts[i]);
            foam += smoothstep(0.62, 0.3, r + 0.08 * gnoise(vec3(p * 9.0, time * 2.0)));
          }
          foam += smoothstep(0.1, 0.16, vH + 0.03 * gnoise(vec3(p * 3.0, time))) * 0.5 * clamp(1.0 - d / 60.0, 0.0, 1.0);
          foam *= smoothstep(-0.2, 0.6, gnoise(vec3(p * 6.0, time * 1.5)) + 0.4);
          col = mix(col, vec3(0.92, 0.96, 1.0) * 1.1, clamp(foam, 0.0, 0.85));
          col = mix(col, vec3(0.62, 0.78, 0.95) * 1.15, 1.0 - exp(-d * 0.0034));
          gl_FragColor = vec4(col, 1.0);
        }`,
    }),
  );
  scene.add(water);

  const split = 540;
  function pass(amp, scissor, t) {
    const R = ctx.renderer;
    const lv = level(t, amp);
    waterU.level.value = lv;
    postU.highMark.value = amp + 0.05;
    postU.lowMark.value = -amp;
    R.setRenderTarget(ctx.post.sceneRT);
    R.setScissorTest(true);
    R.setScissor(scissor[0], 0, scissor[1], ctx.H);
    const ac = R.autoClear;
    R.autoClear = false;
    R.clear(true, true, false);
    R.render(scene, camera);
    R.autoClear = ac;
    R.setScissorTest(false);
  }

  return {
    name: 'tide-gauge',
    t0: E.tide_cut,
    t1: E.s5_start,
    render(t) {
      const lt = t - E.tide_cut;
      waterU.time.value = t;
      skyU.time.value = t;
      const k = ease.inOutSine(remap(lt, 0, 3.1));
      camera.position.set(lerp(0.3, -0.15, k), 1.75, lerp(9.4, 8.7, k));
      camera.lookAt(0, 0.45, 0);
      camera.updateMatrixWorld(true);
      const sx = Math.round((split / 1080) * ctx.W);
      pass(AMP_MOON, [0, sx], t);
      pass(AMP_SUN, [sx, ctx.W - sx], t);
      const enter = remap(t, E.tide_cut, E.tide_cut + 0.4);
      return {
        exposure: 0.92,
        zoomBlur: 0.32 * (1 - ease.outCubic(enter)) + 0.3 * ease.inCubic(remap(t, E.s5_start - 0.25, E.s5_start)),
        bloomStrength: 0.7,
        bloomThreshold: 1.1,
        vignette: 0.45,
        saturation: 1.15,
      };
    },
    overlay(c, t) {
      const a = remap(t, E.tide_cut, E.tide_cut + 0.2) * (1 - remap(t, E.s5_start - 0.2, E.s5_start));
      const sp = appear(t, E.sun_tides_label, E.s5_start - 0.15);
      drawPill(c, { x: 540, y: 565, text: 'THE SUN STILL MAKES SMALLER TIDES', size: 38, p: 1, a: sp.a, icon: ICONS.sun, accent: C.yellow });
      drawDivider(c, 540, a, { top: 640, bottom: 1920, handleY: 1150 });
      const l = appear(t, E.tide_labels, E.s5_start - 0.12);
      drawPill(c, { x: 270, y: 1415, text: 'WITH MOON', size: 36, p: l.p, a: l.a, accent: C.blue });
      const l2 = appear(t, E.tide_labels + 0.12, E.s5_start - 0.12);
      drawPill(c, { x: 790, y: 1415, text: 'WITHOUT MOON', size: 36, p: l2.p, a: l2.a, accent: C.red });
      // tidal range arrows beside each gauge
      const ar = appear(t, E.tide_labels + 0.35, E.s5_start - 0.12, 0.4);
      [[POSTS_X[0], AMP_MOON], [POSTS_X[1], AMP_SUN]].forEach(([x, amp]) => {
        const top = toScreen(new THREE.Vector3(x + 0.62, amp, 0.3), camera);
        const bot = toScreen(new THREE.Vector3(x + 0.62, -amp, 0.3), camera);
        const mid = (top[1] + bot[1]) / 2;
        const grow = ease.outCubic(ar.p);
        drawRangeArrow(c, top[0], lerp(mid, top[1], grow), lerp(mid, bot[1], grow), { color: '#3FB6FF', a: ar.a, width: 14, head: 34 });
      });
    },
  };
}
