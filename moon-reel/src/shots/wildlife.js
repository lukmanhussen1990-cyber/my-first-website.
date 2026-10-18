import * as THREE from 'three';
import { Starfield } from '../world/space.js';
import { Turtle, Owl, Bat, nightLight } from '../world/creatures.js';
import { GLSL_NOISE, ease, remap, lerp, clamp } from '../core/util.js';
import { C, drawPill, ICONS, appear } from '../core/overlay.js';

const SKY_LOOKUP = /* glsl */ `
uniform sampler2D tSky;
uniform float skyGain;
vec3 skyColor(vec3 d){
  d = normalize(d);
  float phi = atan(d.z, -d.x);
  float u = fract(phi / 6.2831853);
  float v = 1.0 - acos(clamp(d.y, -1.0, 1.0)) / 3.14159265;
  return texture2D(tSky, vec2(u, v)).rgb * skyGain;
}`;

// Scene 5: moonless beach with a nesting sea turtle, then an owl and bats under the Milky Way.
export function wildlifeShot(ctx, sky) {
  const { E } = ctx;
  const SHORE = -2.75;
  const groundY = (x, z) => (z > SHORE ? (z - SHORE) * 0.045 : (z - SHORE) * 0.09) + 0.015 * Math.sin(x * 2.1 + z * 1.3);

  // ================================================================ beach
  const beach = new THREE.Scene();
  const camA = new THREE.PerspectiveCamera(40, ctx.W / ctx.H, 0.05, 3000);
  const starsA = new Starfield(sky, { count: 9000, seed: 33 });
  beach.add(starsA.group);
  const L1 = nightLight();
  L1.keyCol.value.set(0.2, 0.2, 0.23);
  L1.keyDir.value.set(-0.35, 0.85, 0.4).normalize();
  L1.rimCol.value.set(0.07, 0.16, 0.2);
  L1.ambCol.value.set(0.05, 0.055, 0.07);
  const common = {
    time: { value: 0 },
    tSky: { value: sky.texture },
    skyGain: { value: 2.2 },
    trackA: { value: new THREE.Vector2() },
    trackB: { value: new THREE.Vector2() },
  };
  const groundGeo = new THREE.PlaneGeometry(70, 46, 280, 184).rotateX(-Math.PI / 2).translate(0, 0, -12);
  const gp = groundGeo.attributes.position;
  for (let i = 0; i < gp.count; i++) gp.setY(i, groundY(gp.getX(i), gp.getZ(i)));
  groundGeo.computeVertexNormals();
  const ground = new THREE.Mesh(
    groundGeo,
    new THREE.ShaderMaterial({
      uniforms: { ...L1, ...common },
      vertexShader: 'varying vec3 vW, vN; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vN = normal; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: /* glsl */ `
        ${GLSL_NOISE}
        ${SKY_LOOKUP}
        uniform vec3 keyDir, keyCol, ambCol, rimCol;
        uniform float time;
        uniform vec2 trackA, trackB;
        varying vec3 vW, vN;
        float segDist(vec2 p, vec2 a, vec2 b){
          vec2 ab = b - a; float h = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
          return length(p - a - ab * h);
        }
        void main(){
          vec2 p = vW.xz;
          float shore = ${SHORE.toFixed(2)} + 0.25 * sin(p.x * 0.35) ;
          float edge = shore + 0.42 + 0.5 * sin(time * 1.2) + 0.1 * sin(time * 2.9 + p.x * 1.7) + 0.08 * gnoise(vec3(p * 1.5, time * 0.5));
          float wet = smoothstep(shore + 1.25, shore + 0.6, p.y);
          float cover = smoothstep(edge + 0.04, edge - 0.25, p.y);
          float n = fbm(vec3(p * 9.0, 0.0), 4);
          vec3 sand = mix(vec3(0.46, 0.39, 0.29), vec3(0.64, 0.55, 0.41), n * 0.5 + 0.5);
          float rip = sin(p.y * 26.0 + p.x * 3.0 + fbm(vec3(p * 2.0, 3.0), 3) * 5.0);
          sand *= 0.86 + 0.14 * rip;
          float grain = step(0.996, hash12(floor(p * 220.0)));
          // turtle track: two grooves either side of the path
          float td = segDist(p, trackA, trackB);
          float groove = exp(-pow((td - 0.27) / 0.06, 2.0)) * (0.7 + 0.3 * sin(length(p - trackA) * 28.0));
          vec3 alb = mix(sand, sand * 0.42, wet);
          alb *= 1.0 - 0.35 * groove;
          vec3 N = normalize(vN + vec3(0.0, 0.0, cos(p.y * 26.0 + p.x * 3.0) * 0.12 * (1.0 - wet)) + vec3(gnoise(vec3(p * 20.0, 1.0)), 0.0, gnoise(vec3(p * 20.0, 7.0))) * 0.05);
          vec3 V = normalize(cameraPosition - vW);
          vec3 col = alb * (keyCol * max(dot(N, normalize(keyDir)), 0.0) * 1.2 + ambCol * 0.9);
          col += grain * (1.0 - wet) * vec3(0.4, 0.45, 0.6) * 0.06;
          float fres = 0.02 + 0.98 * pow(1.0 - max(dot(vec3(0.0, 1.0, 0.0), V), 0.0), 5.0);
          col += skyColor(reflect(-V, vec3(0.0, 1.0, 0.0))) * fres * (wet * 0.6 + cover * 0.9);
          // swash film + bioluminescent foam line
          vec3 waterCol = vec3(0.004, 0.012, 0.02);
          col = mix(col, waterCol + skyColor(reflect(-V, N)) * fres, cover * 0.75);
          float foamN = smoothstep(-0.2, 0.5, fbm(vec3(p * vec2(3.0, 6.0), time * 0.8), 4));
          float foam = exp(-pow((p.y - edge) / 0.07, 2.0)) * foamN + cover * 0.25 * smoothstep(0.35, 0.8, foamN);
          col += foam * (vec3(0.25, 0.7, 0.85) * 0.22 + vec3(0.07));
          gl_FragColor = vec4(col, 1.0);
        }`,
    }),
  );
  beach.add(ground);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(800, 600, 1, 1).rotateX(-Math.PI / 2).translate(0, -0.005, -300 + SHORE - 0.2),
    new THREE.ShaderMaterial({
      uniforms: { ...common },
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: /* glsl */ `
        ${GLSL_NOISE}
        ${SKY_LOOKUP}
        uniform float time;
        varying vec3 vW;
        void main(){
          vec2 p = vW.xz;
          float d = length(vW - cameraPosition);
          vec3 N = normalize(vec3(gnoise(vec3(p * vec2(0.6, 1.4), time * 0.5)) * 0.08, 1.0, gnoise(vec3(p * vec2(0.6, 1.4) + 5.0, time * 0.5)) * 0.14) );
          N = normalize(mix(vec3(0.0, 1.0, 0.0), N, clamp(18.0 / d, 0.15, 1.0)));
          vec3 V = normalize(cameraPosition - vW);
          float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
          vec3 col = vec3(0.002, 0.006, 0.012) + skyColor(reflect(-V, N)) * fres;
          // incoming breakers: foam bands travelling to the shore
          float dist = ${SHORE.toFixed(2)} - p.y;
          float foam = 0.0;
          for (int k = 0; k < 3; k++) {
            float zc = fract(time * 0.22 + float(k) / 3.0) * 9.0;
            float band = exp(-pow((dist - (9.0 - zc)) / (0.12 + 0.05 * zc), 2.0));
            foam += band * smoothstep(0.0, 2.5, zc) * smoothstep(-0.2, 0.6, fbm(vec3(p * vec2(1.5, 4.0), time * 0.6 + float(k)), 4) + 0.2);
          }
          foam *= exp(-dist * 0.12);
          col += foam * (vec3(0.25, 0.7, 0.85) * 0.25 + vec3(0.06));
          gl_FragColor = vec4(col, 1.0);
        }`,
    }),
  );
  beach.add(sea);
  const turtle = new Turtle(L1);
  turtle.group.scale.setScalar(0.5);
  beach.add(turtle.group);
  const START = new THREE.Vector2(0.3, -2.5);
  const END = new THREE.Vector2(-0.08, -0.85);

  // ================================================================ owl
  const owlScene = new THREE.Scene();
  const camB = new THREE.PerspectiveCamera(40, ctx.W / ctx.H, 0.05, 3000);
  const starsB = new Starfield(sky, { count: 9000, seed: 44 });
  owlScene.add(starsB.group);
  const L2 = nightLight();
  L2.keyCol.value.set(0.06, 0.065, 0.09);
  L2.keyDir.value.set(-0.6, 0.5, 0.65).normalize();
  L2.rimCol.value.set(0.36, 0.44, 0.7);
  L2.rimDir.value.set(0.35, 0.6, -1).normalize();
  L2.ambCol.value.set(0.014, 0.017, 0.028);
  const owl = new Owl(L2);
  owl.group.scale.setScalar(0.62);
  owl.group.position.set(0, 0.05, 0);
  owlScene.add(owl.group);
  const barkMat = new THREE.ShaderMaterial({
    uniforms: { ...L2 },
    vertexShader: 'varying vec3 vW, vN; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: /* glsl */ `
      ${GLSL_NOISE}
      uniform vec3 keyDir, keyCol, rimDir, rimCol, ambCol;
      varying vec3 vW, vN;
      void main(){
        vec3 N = normalize(vN);
        vec3 V = normalize(cameraPosition - vW);
        float n = fbm(vW * vec3(14.0, 4.0, 14.0), 4);
        vec3 alb = mix(vec3(0.06, 0.045, 0.035), vec3(0.16, 0.12, 0.09), n * 0.5 + 0.5);
        float rim = pow(1.0 - max(dot(N, V), 0.0), 2.5) * max(dot(N, rimDir), 0.0);
        vec3 col = alb * (keyCol * max(dot(N, keyDir), 0.0) * 1.6 + ambCol) + rimCol * rim * 0.5;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const branchPath = (pts, r) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((q) => new THREE.Vector3(...q))), 64, r, 12), barkMat);
  owlScene.add(branchPath([[-3.2, -0.25, 0.3], [-1.2, -0.02, 0.12], [0.2, 0.02, 0.04], [1.6, 0.18, -0.08], [3.0, 0.45, -0.2]], 0.085));
  owlScene.add(branchPath([[-1.0, -0.02, 0.1], [-1.5, 0.5, 0.0], [-2.3, 1.1, -0.2]], 0.045));
  owlScene.add(branchPath([[1.1, 0.12, -0.05], [1.6, 0.75, -0.3], [1.9, 1.5, -0.5]], 0.04));
  owlScene.add(branchPath([[-3.5, -3.0, -0.8], [-3.1, -1.0, -0.2], [-3.2, -0.25, 0.3]], 0.2));
  const bats = [];
  for (let i = 0; i < 4; i++) {
    const b = new Bat();
    b.group.scale.setScalar(0.55 + 0.25 * (i % 2));
    owlScene.add(b.group);
    bats.push(b);
  }

  // ================================================================ render
  const owlStart = E.owl_pan;
  return {
    name: 'wildlife',
    t0: E.s5_start,
    t1: E.s6_start,
    render(t) {
      const R = ctx.renderer;
      common.time.value = t;
      R.setRenderTarget(ctx.post.sceneRT);
      R.setClearColor(0x000000, 1);
      R.clear(true, true, false);
      const ac = R.autoClear;
      R.autoClear = false;
      let post;
      if (t < owlStart) {
        const lt = t - E.s5_start;
        // turtle crawl
        const prog = turtle.animate(lt);
        const k = clamp(prog / 2.4);
        const tx = lerp(START.x, END.x, k);
        const tz = lerp(START.y, END.y, k);
        turtle.group.position.set(tx, groundY(tx, tz) + 0.06, tz);
        turtle.group.rotation.y = 0.18 + 0.05 * Math.sin(lt * 0.8);
        turtle.group.rotation.x = -Math.atan(0.045);
        common.trackA.value.set(START.x + 0.05, START.y - 0.6);
        common.trackB.value.set(tx, tz - 0.32);
        const c = ease.inOutSine(remap(lt, 0, 1.85));
        camA.position.set(lerp(0.45, 0.2, c), lerp(1.2, 1.05, c), lerp(1.55, 1.3, c));
        camA.lookAt(lerp(0.12, 0.0, c), lerp(-0.05, -0.05, c), lerp(-2.2, -1.7, c));
        // whip-tilt up at the end of the beach shot
        const w = ease.inCubic(remap(t, owlStart - 0.22, owlStart));
        camA.rotateX(w * 0.5);
        camA.updateMatrixWorld(true);
        starsA.update(camA, t, { pxScale: ctx.SCALE, starIntensity: 1.35, skyIntensity: 2.2 });
        R.render(beach, camA);
        const enter = remap(t, E.s5_start, E.s5_start + 0.4);
        post = {
          zoomBlur: 0.32 * (1 - ease.outCubic(enter)),
          whip: [0, -0.16 * w],
          exposure: 1.55,
          bloomStrength: 1.0,
        };
      } else {
        const lt = t - owlStart;
        const c = ease.outCubic(remap(lt, 0, 2.15));
        camB.position.set(lerp(0.5, 0.25, c), lerp(0.1, 0.3, c), lerp(3.5, 2.9, c));
        camB.lookAt(0, lerp(0.95, 0.72, c), 0);
        const w = 1 - ease.outCubic(remap(lt, 0, 0.25));
        camB.rotateX(w * 0.45);
        camB.updateMatrixWorld(true);
        const yaw = lerp(0.75, 0.06, ease.inOutCubic(remap(t, E.chip_feed - 0.25, E.chip_feed + 0.3)));
        const bl = remap(t, 21.2, 21.27) * (1 - remap(t, 21.32, 21.42));
        owl.animate(t, yaw, ease.inOutSine(clamp(bl)));
        bats.forEach((b, i) => {
          const s = remap(t, owlStart + i * 0.38 - 0.2, owlStart + i * 0.38 + 2.2);
          const zz = -5 - i * 2.2;
          b.group.position.set(lerp(-5.5 - i, 5.0 + i, s), 2.3 + i * 0.55 + 0.5 * Math.sin(s * 6 + i), zz);
          b.group.rotation.set(0.25, -1.2 + 0.3 * Math.sin(s * 5 + i), 0.2 * Math.sin(s * 9 + i));
          b.animate(t, i * 1.7);
          b.group.visible = s > 0 && s < 1;
        });
        starsB.update(camB, t, { pxScale: ctx.SCALE, starIntensity: 1.5, skyIntensity: 2.6 });
        R.render(owlScene, camB);
        post = {
          whip: [0, 0.16 * w],
          exposure: 1.5,
          bloomStrength: 1.1,
          zoomBlur: 0.3 * ease.inCubic(remap(t, E.s6_start - 0.25, E.s6_start)),
        };
      }
      R.autoClear = ac;
      return post;
    },
    overlay(c, t) {
      const items = [
        { text: 'NAVIGATION', icon: ICONS.compass, at: E.chip_nav, accent: C.blue },
        { text: 'FEEDING', icon: ICONS.eye, at: E.chip_feed, accent: C.yellow },
        { text: 'BREEDING', icon: ICONS.cycle, at: E.chip_repro, accent: C.green },
      ];
      const size = 30;
      c.font = `800 ${size}px Montserrat`;
      const widths = items.map((it) => c.measureText(it.text).width + size * 1.15 + size * 1.24);
      const gap = 22;
      const total = widths.reduce((a, b) => a + b, 0) + gap * (items.length - 1);
      let x = 540 - total / 2;
      const end = E.s6_start - 0.15;
      const hdr = appear(t, E.chip_nav - 0.1, end, 0.3);
      if (hdr.a > 0) {
        c.save();
        c.globalAlpha = hdr.a * clamp(hdr.p * 2);
        c.font = '800 30px Montserrat';
        c.textAlign = 'center';
        c.lineWidth = 7;
        c.strokeStyle = 'rgba(4,8,22,0.9)';
        c.strokeText('SOME SPECIES USE THE MOON FOR:', 540, 545);
        c.fillStyle = '#FFFFFF';
        c.fillText('SOME SPECIES USE THE MOON FOR:', 540, 545);
        c.restore();
      }
      items.forEach((it, i) => {
        const cx = x + widths[i] / 2;
        const ap = appear(t, it.at, end, 0.35);
        drawPill(c, { x: cx, y: 612, text: it.text, size, p: ap.p, a: ap.a, icon: it.icon, accent: it.accent });
        x += widths[i] + gap;
      });
    },
  };
}
