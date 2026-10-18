import * as THREE from 'three';
import { aimCamera, renderTo, toScreen, screenRadius, spinFor } from './common.js';
import { clamp, ease, remap, track, shakeEnv, wobble, lerp } from '../core/util.js';

// Scene 1 (hook) and scene 2 (the Moon is gone): one continuous camera move.
export function hookShots(ctx, world) {
  const { E } = ctx;
  const { scene, earth, moon, vanish, starfield, camera } = world;

  const SUN = new THREE.Vector3(-1, 0.3, 0.52).normalize();
  const M = new THREE.Vector3(0.6, 1.36, -1.7);
  const MOON_R = 0.27;
  const COLLAPSE = 0.07; // seconds for the Moon to pinch to a point
  const tilt = 0.32;

  // Opening frame: Earth fills the lower half, Moon up-right, room for the title on top.
  const C0 = [-0.04, 0.74, 4.95];
  const T0 = [0.02, 0.8, 0];
  const toCam = new THREE.Vector3(...C0).sub(M).normalize();
  const C1 = M.clone().addScaledVector(toCam, 1.9).toArray();

  // S1 push: moving from the first frame, accelerating, then easing into the vanish.
  const pushK = (t) => {
    const u = clamp(t / 3.3);
    return 0.22 * u + 0.78 * ease.inOutCubic(u);
  };
  const pushPos = (t) => {
    const k = pushK(t);
    const p = C0.map((c, i) => lerp(c, C1[i], k));
    p[0] += Math.sin(Math.PI * k) * 0.25; // slight arc for parallax
    if (t > 3.3) p[2] += (t - 3.3) * 0.06;
    return p;
  };
  const pushTgt = (t) => {
    const k = ease.inOutSine(clamp(t / 3.0));
    return T0.map((c, i) => lerp(c, M.getComponent(i), Math.min(1, k * 1.04)));
  };

  // S2: pull straight back from the empty spot into the opening composition (minus the Moon),
  // drift, then dive into the night side.
  const C2 = [-0.3, 1.25, 6.3];
  const T2 = [0.04, 0.78, 0];
  const C3 = [-0.22, 1.3, 5.85];
  const T3 = [0.05, 0.76, 0];
  const s2 = E.s2_start;
  const pullPos = (t) =>
    track([
      [s2, pushPos(s2)],
      [s2 + 1.5, C2, 'outQuart'],
      [E.s2_dive, C3, 'inOutSine'],
    ])(t);
  const pullTgt = track([
    [s2, M.toArray()],
    [s2 + 1.25, T2, 'inOutCubic'],
    [E.s2_dive, T3, 'inOutSine'],
  ]);
  // dive target: a point on the night side (city lights)
  const DIVE = new THREE.Vector3(0.8, 0.15, 0.58).normalize();

  const spinAt = (t) => spinFor(-12) + t * 0.018;

  function setEarth(t) {
    earth.group.position.set(0, 0, 0);
    earth.group.rotation.set(0, 0, tilt);
    earth.update({ sunDir: SUN, spin: spinAt(t), cloudShift: t * 0.0012 });
    earth.uniforms.lightsGain.value = 3.4;
  }

  function moonState(t) {
    const swell = remap(t, E.moon_swell, E.moon_vanish);
    const shrink = remap(t, E.moon_vanish, E.moon_vanish + COLLAPSE);
    const s = t < E.moon_vanish ? 1 + 0.035 * ease.inQuad(swell) : 1.035 * (1 - ease.inQuad(shrink));
    const glow = t < E.moon_vanish ? 0.08 * ease.inQuad(swell) : 0.08 + 0.9 * ease.inQuad(shrink);
    return { scale: Math.max(0, s), glow, visible: shrink < 1 };
  }

  const S1 = {
    name: 'hook',
    t0: 0,
    t1: E.s2_start,
    render(t) {
      setEarth(t);
      const ms = moonState(t);
      moon.group.visible = ms.visible;
      moon.group.position.copy(M);
      moon.group.scale.setScalar(MOON_R * Math.max(ms.scale, 1e-4));
      moon.uniforms.sunDir.value.copy(SUN);
      moon.uniforms.glow.value = ms.glow;
      moon.faceTowards(new THREE.Vector3(0, 0, 0));
      const sh = shakeEnv(t, E.moon_vanish, 0.7);
      aimCamera(camera, pushPos(t), pushTgt(t), { fov: 40, shake: sh * 2.4, t, roll: -0.04 + 0.05 * pushK(t) });
      const age = t - E.moon_vanish - COLLAPSE * 0.8;
      vanish.update(age, M, MOON_R, ctx.SCALE);
      starfield.update(camera, t, { pxScale: ctx.SCALE, starIntensity: 1.0, skyIntensity: 1.0 });
      renderTo(ctx, scene, camera);

      const ms0 = toScreen(M, camera);
      const fl = age >= 0 ? Math.exp(-age * 16) : 0;
      return {
        fadeAll: 1 - ease.outQuad(remap(t, 0, 0.14)),
        flash: 0.05 * fl,
        bloomStrength: 1.0 + 0.3 * fl,
        shock: [ms0[0] / 1080, 1 - ms0[1] / 1920, age >= 0 ? 0.05 + 0.45 * (1 - Math.exp(-age * 4.2)) : 0, age >= 0 ? 0.022 * Math.exp(-age * 3.5) : 0],
        textShake: [wobble(t * 2.2, 5) * 16 * sh, wobble(t * 2.2, 9) * 11 * sh],
        ca: 0.0025 + 0.012 * sh,
      };
    },
  };

  const S2 = {
    name: 'gone',
    t0: E.s2_start,
    t1: E.s3_start,
    render(t) {
      setEarth(t);
      moon.group.visible = false;
      vanish.update(-1, M, MOON_R, ctx.SCALE);
      let pos = pullPos(t);
      let tgt = pullTgt(t);
      const d = remap(t, E.s2_dive, E.s3_start);
      if (d > 0) {
        // accelerate towards the night side
        const k = ease.inExpo(d);
        const surf = DIVE.clone();
        const goal = surf.clone().multiplyScalar(1.08);
        pos = pos.map((c, i) => lerp(c, goal.getComponent(i), k * 0.93));
        tgt = tgt.map((c, i) => lerp(c, surf.getComponent(i), ease.inOutCubic(d)));
      }
      const whoosh = remap(t, E.s2_start, E.s2_start + 0.5);
      aimCamera(camera, pos, tgt, { fov: 40, t, roll: -0.02 + 0.04 * Math.sin(t * 0.4) });
      starfield.update(camera, t, { pxScale: ctx.SCALE });
      renderTo(ctx, scene, camera);
      const zc = toScreen(DIVE, camera);
      const zb = 0.42 * ease.inCubic(remap(t, E.s2_dive + 0.2, E.s3_start));
      return {
        zoomBlur: zb + 0.16 * (1 - ease.outCubic(whoosh)) * (whoosh > 0 ? 1 : 0),
        zoomCenter: d > 0 ? [zc[0] / 1080, 1 - zc[1] / 1920] : [0.5, 0.55],
        exposure: 1 + 0.6 * ease.inQuad(d),
      };
    },
    overlay(c, t) {
      // dashed ghost outline where the Moon used to be
      const a = remap(t, E.ghost_ring, E.ghost_ring + 0.35) * (1 - remap(t, E.s2_dive - 0.3, E.s2_dive));
      if (a <= 0) return;
      const [x, y] = toScreen(M, camera);
      const r = screenRadius(M, MOON_R, camera);
      c.save();
      c.globalAlpha = a * 0.9;
      c.setLineDash([14, 12]);
      c.lineDashOffset = -t * 30;
      c.lineWidth = 4;
      c.strokeStyle = 'rgba(200, 225, 255, 0.95)';
      c.shadowColor = 'rgba(120, 180, 255, 0.9)';
      c.shadowBlur = 14;
      c.beginPath();
      c.arc(x, y, r * (1 + 0.15 * (1 - ease.outBack(clamp(a), 2))), 0, Math.PI * 2);
      c.stroke();
      c.restore();
    },
  };

  return [S1, S2];
}
