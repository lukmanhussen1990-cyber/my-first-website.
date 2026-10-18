import * as THREE from 'three';
import { aimCamera, renderTo, toScreen, spinFor, frameTwo } from './common.js';
import { clamp, ease, remap, lerp, shakeEnv } from '../core/util.js';
import { GlowArrow, GlowTube, TideBulge } from '../world/fx.js';
import { Sun, Planet } from '../world/solar.js';
import { C, drawPill, ICONS, appear } from '../core/overlay.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

function circleCurve(r, n = 128) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push(V3(r * Math.cos(a), 0, -r * Math.sin(a)));
  }
  return new THREE.CatmullRomCurve3(pts, true);
}

export function spaceShots(ctx, world) {
  const { E } = ctx;
  const { scene, earth, moon, vanish, starfield, camera } = world;
  const extra = [];
  const add = (o) => {
    scene.add(o);
    extra.push(o);
    o.visible = false;
    return o;
  };
  const show = (...objs) => {
    for (const o of extra) o.visible = objs.includes(o);
  };

  // ------------------------------------------------------------------ tides (space view)
  const bulge = new TideBulge();
  add(bulge.group);
  const mkArrows = (len, gap, w) => {
    const g = new THREE.Group();
    const arrows = [
      new GlowArrow([[gap, 0, 0], [gap + len, 0, 0]], { radius: w, headLen: w * 5, headRadius: w * 2.6 }),
      new GlowArrow([[-gap, 0, 0], [-gap - len, 0, 0]], { radius: w, headLen: w * 5, headRadius: w * 2.6 }),
      new GlowArrow([[0, 0, gap + len * 0.7], [0, 0, gap]], { radius: w * 0.8, headLen: w * 4, headRadius: w * 2.1 }),
      new GlowArrow([[0, 0, -gap - len * 0.7], [0, 0, -gap]], { radius: w * 0.8, headLen: w * 4, headRadius: w * 2.1 }),
    ];
    for (const a of arrows) g.add(a.group);
    return { group: g, arrows };
  };
  const lunarArrows = mkArrows(0.62, 1.32, 0.035);
  const solarArrows = mkArrows(0.3, 1.2, 0.028);
  add(lunarArrows.group);
  add(solarArrows.group);
  const MT = V3(2.1, 0, -2.75);
  const moonAxis = MT.clone().normalize();
  const sunAxis = V3(-0.92, 0, 0.4).normalize();
  const SUN_T = V3(-0.92, 0.38, 0.4).normalize();
  const pullLine = new GlowTube(new THREE.LineCurve3(V3(0, 0, 0).addScaledVector(moonAxis, 2.0), MT.clone().addScaledVector(moonAxis, -0.36)), {
    radius: 0.012,
    color: [0.5, 0.75, 1.0],
    intensity: 1.6,
    segments: 64,
  });
  pullLine.uniforms.dash.value = 14;
  add(pullLine.mesh);
  const qMoon = new THREE.Quaternion().setFromUnitVectors(V3(1, 0, 0), moonAxis);
  const qSun = new THREE.Quaternion().setFromUnitVectors(V3(1, 0, 0), sunAxis);

  const tidesSpace = {
    name: 'tides-space',
    t0: E.s4_start,
    t1: E.tide_cut,
    render(t) {
      const lt = t - E.s4_start;
      show(bulge.group, lunarArrows.group, solarArrows.group, pullLine.mesh);
      earth.group.position.set(0, 0, 0);
      earth.group.rotation.set(0, 0, 0);
      earth.setScale(1);
      earth.update({ sunDir: SUN_T, spin: spinFor(20) + lt * 0.05, cloudShift: lt * 0.002 });
      // Moon and its vanish
      const tv = E.tide_moon_vanish;
      const shrink = remap(t, tv, tv + 0.07);
      moon.group.visible = shrink < 1;
      moon.group.position.copy(MT);
      moon.group.scale.setScalar(0.36 * Math.max(1e-4, 1 - ease.inQuad(shrink)));
      moon.uniforms.sunDir.value.copy(SUN_T);
      moon.uniforms.glow.value = t < tv ? 0.08 * remap(t, tv - 0.12, tv) : 0.08 + 0.9 * shrink;
      moon.faceTowards(V3(0, 0, 0));
      vanish.update(t - tv - 0.05, MT, 0.36, ctx.SCALE);
      // bulge: lunar -> smaller solar bulge
      const k = ease.inOutCubic(remap(t, tv + 0.1, tv + 0.95));
      const axis = moonAxis.clone().lerp(sunAxis, k).normalize();
      const wobbleS = 0.012 * Math.sin(lt * 5.0);
      bulge.set(V3(0, 0, 0), axis, lerp(0.24, 0.085, k) + wobbleS, 1.04, t, ease.outCubic(remap(t, E.s4_start, E.s4_start + 0.4)));
      // arrows
      lunarArrows.group.quaternion.copy(qMoon);
      solarArrows.group.quaternion.copy(qSun);
      const pa = ease.outCubic(remap(t, E.tide_arrows, E.tide_arrows + 0.45));
      const out = 1 - remap(t, tv, tv + 0.35);
      lunarArrows.arrows.forEach((a, i) => a.set(Math.min(pa, out) * (i < 2 ? 1 : remap(t, E.tide_arrows + 0.15, E.tide_arrows + 0.6)), 1));
      const ps = ease.outCubic(remap(t, tv + 0.55, tv + 1.0));
      solarArrows.arrows.forEach((a) => a.set(ps, 1));
      pullLine.uniforms.opacity.value = remap(t, E.tide_arrows + 0.2, E.tide_arrows + 0.6) * (1 - remap(t, tv - 0.05, tv + 0.1));
      pullLine.uniforms.dashOffset.value = -lt * 2.0;
      // camera: near top-down diagram view; Moon up-right, Earth lower-centre, slow drift
      const dz = lerp(10.6, 10.0, ease.inOutSine(remap(lt, 0, 2.9)));
      frameTwo(camera, [0.95 + lt * 0.05, dz, 2.6], V3(0, 0, 0), [450, 1170], MT, [830, 700], 38);
      const sh = shakeEnv(t, tv, 0.5) * 1.2;
      if (sh > 0) {
        camera.rotateX(Math.sin(t * 61) * sh * 0.006);
        camera.rotateY(Math.sin(t * 47) * sh * 0.006);
        camera.updateMatrixWorld(true);
      }
      starfield.update(camera, t, { pxScale: ctx.SCALE });
      renderTo(ctx, scene, camera);
      const ms = toScreen(MT, camera);
      const age = t - tv;
      const whoosh = remap(t, E.s4_start, E.s4_start + 0.45);
      return {
        zoomBlur: 0.3 * (1 - ease.outCubic(whoosh)) + 0.25 * ease.inCubic(remap(t, E.tide_cut - 0.25, E.tide_cut)),
        flash: age >= 0 ? 0.04 * Math.exp(-age * 16) : 0,
        shock: [ms[0] / 1080, 1 - ms[1] / 1920, age >= 0 ? 0.04 + 0.3 * (1 - Math.exp(-age * 4.5)) : 0, age >= 0 ? 0.014 * Math.exp(-age * 4) : 0],
      };
    },
    overlay(c, t) {
      const { p, a } = appear(t, E.sun_tides_label, E.s5_start - 0.15);
      drawPill(c, { x: 540, y: 565, text: 'THE SUN STILL MAKES SMALLER TIDES', size: 38, p, a, icon: ICONS.sun, accent: C.yellow });
    },
  };

  // ------------------------------------------------------------------ rotation
  const TILT = -0.409;
  const axisLine = new GlowTube(new THREE.LineCurve3(V3(0, -1.55, 0), V3(0, 1.55, 0)), { radius: 0.01, color: [0.8, 0.9, 1.0], intensity: 1.4, segments: 64 });
  axisLine.uniforms.dash.value = 22;
  const spinArrowPts = [];
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI * 1.55;
    spinArrowPts.push([1.34 * Math.cos(a), 0, -1.34 * Math.sin(a)]);
  }
  const spinArrow = new GlowArrow(spinArrowPts, { radius: 0.017, headLen: 0.17, headRadius: 0.07, intensity: 1.8 });
  const rotGroup = new THREE.Group();
  const rotSpin = new THREE.Group();
  rotGroup.add(axisLine.mesh, rotSpin);
  rotSpin.add(spinArrow.group);
  add(rotGroup);

  const rotation = {
    name: 'rotation',
    t0: E.s6_start,
    t1: E.s7_start,
    render(t) {
      const lt = t - E.s6_start;
      show(rotGroup);
      moon.group.visible = false;
      vanish.update(-1, V3(), 0.3, ctx.SCALE);
      const L = V3(-1, 0.25, 0.75).normalize();
      earth.group.position.set(0, 0, 0);
      earth.group.rotation.set(0, 0, TILT);
      earth.setScale(1);
      const spin = spinFor(-60) + lt * 0.75;
      earth.update({ sunDir: L, spin, cloudShift: lt * 0.002 });
      rotGroup.rotation.set(0, 0, TILT);
      rotSpin.rotation.y = lt * 0.75 - 0.6;
      spinArrow.set(ease.outCubic(remap(t, E.s6_start + 0.25, E.s6_start + 1.0)), 1);
      axisLine.uniforms.opacity.value = remap(t, E.s6_start + 0.1, E.s6_start + 0.6);
      axisLine.uniforms.dashOffset.value = -lt * 0.6;
      const d = lerp(6.3, 5.8, ease.inOutSine(remap(lt, 0, 4)));
      const ang = -0.28 + lt * 0.06;
      aimCamera(camera, [Math.sin(ang) * d, 1.0 - lt * 0.05, Math.cos(ang) * d], [0.0, 0.42, 0], { fov: 40, t });
      starfield.update(camera, t, { pxScale: ctx.SCALE });
      renderTo(ctx, scene, camera);
      const whoosh = remap(t, E.s6_start, E.s6_start + 0.45);
      return { zoomBlur: 0.3 * (1 - ease.outCubic(whoosh)) + 0.22 * ease.inCubic(remap(t, E.s7_start - 0.25, E.s7_start)) };
    },
    overlay(c, t) {
      const { p, a } = appear(t, E.rot_sub, E.s7_start - 0.12);
      drawPill(c, { x: 540, y: 565, text: 'SLOWLY, OVER MILLIONS OF YEARS', size: 38, p, a, accent: C.blue });
      drawClock(c, t, appear(t, E.s6_start + 0.5, E.s7_start - 0.12, 0.45));
    },
  };

  function drawClock(c, t, { p, a }) {
    if (p <= 0 || a <= 0) return;
    const x = 185;
    const y = 1370;
    const r = 100;
    const s = ease.outBack(clamp(p), 1.8);
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    c.globalAlpha = a;
    c.shadowColor = 'rgba(0,0,0,0.6)';
    c.shadowBlur = 26;
    c.beginPath();
    c.arc(0, 0, r, 0, Math.PI * 2);
    c.fillStyle = 'rgba(6, 12, 32, 0.82)';
    c.fill();
    c.shadowColor = C.blue;
    c.shadowBlur = 22;
    c.lineWidth = 6;
    c.strokeStyle = C.blue;
    c.stroke();
    c.shadowBlur = 0;
    for (let i = 0; i < 24; i++) {
      const an = (i / 24) * Math.PI * 2;
      const r0 = i % 6 === 0 ? r * 0.72 : r * 0.82;
      c.beginPath();
      c.moveTo(Math.sin(an) * r0, -Math.cos(an) * r0);
      c.lineTo(Math.sin(an) * r * 0.9, -Math.cos(an) * r * 0.9);
      c.lineWidth = i % 6 === 0 ? 6 : 3;
      c.strokeStyle = 'rgba(255,255,255,0.9)';
      c.stroke();
    }
    // hand sweeping (time-lapse)
    const an = (t - E.s6_start) * 2.6;
    c.lineWidth = 8;
    c.strokeStyle = C.yellow;
    c.shadowColor = C.yellow;
    c.shadowBlur = 14;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(Math.sin(an) * r * 0.66, -Math.cos(an) * r * 0.66);
    c.stroke();
    c.beginPath();
    c.arc(0, 0, 9, 0, Math.PI * 2);
    c.fillStyle = C.yellow;
    c.fill();
    c.shadowBlur = 0;
    c.font = '900 30px Montserrat';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineWidth = 7;
    c.strokeStyle = 'rgba(6, 12, 32, 0.95)';
    c.strokeText('24 H', 0, r * 0.42);
    c.fillStyle = C.white;
    c.fillText('24 H', 0, r * 0.42);
    c.restore();
  }

  // ------------------------------------------------------------------ orbit reveal
  const sun = new Sun();
  add(sun.group);
  const R_E = 16;
  const orbits = [];
  const planets = [];
  const defs = [
    { r: 6.4, size: 0.24, speed: 0.42, ph: 2.2, c: [0.62, 0.58, 0.55], c2: [0.32, 0.3, 0.29] },
    { r: 10.6, size: 0.5, speed: 0.26, ph: 3.9, c: [0.95, 0.8, 0.55], c2: [0.75, 0.55, 0.35], bands: 9 },
    { r: 23.0, size: 0.36, speed: 0.11, ph: 1.0, c: [0.85, 0.38, 0.18], c2: [0.55, 0.22, 0.1] },
  ];
  for (const d of defs) {
    const ring = new GlowTube(circleCurve(d.r), { radius: 0.035, color: [0.55, 0.65, 0.9], intensity: 0.55, closed: true, segments: 256, radial: 6 });
    add(ring.mesh);
    orbits.push(ring);
    const pl = new Planet({ color: d.c, color2: d.c2, bands: d.bands || 0, seed: d.r });
    pl.mesh.scale.setScalar(d.size);
    add(pl.mesh);
    planets.push({ ...d, pl });
  }
  const earthOrbit = new GlowTube(circleCurve(R_E, 256), { radius: 0.045, color: [0.3, 0.85, 1.0], intensity: 3.0, closed: true, segments: 512, radial: 8 });
  earthOrbit.uniforms.trailLen.value = 0.22;
  earthOrbit.uniforms.baseAlpha.value = 0.12;
  add(earthOrbit.mesh);
  const ghostRing = new GlowTube(circleCurve(1.5), { radius: 0.022, color: [0.8, 0.88, 1.0], intensity: 1.3, closed: true, segments: 128, radial: 6 });
  ghostRing.uniforms.dash.value = 26;
  add(ghostRing.mesh);
  const gravArrow = new GlowArrow([[-1.0, 0, 0], [-4.6, 0, 0]], { radius: 0.06, headLen: 0.42, headRadius: 0.17, color: [1.0, 0.72, 0.2], intensity: 3.0 });
  const gravGroup = new THREE.Group();
  gravGroup.add(gravArrow.group);
  add(gravGroup);
  const EARTH_S = 0.62;
  const earthAngle = (t) => 0.95 + (t - E.s7_start) * 0.16;

  const orbit = {
    name: 'orbit',
    t0: E.s7_start,
    t1: E.s8_start,
    render(t) {
      const lt = t - E.s7_start;
      show(sun.group, earthOrbit.mesh, ghostRing.mesh, gravGroup, ...orbits.map((o) => o.mesh), ...planets.map((p) => p.pl.mesh));
      moon.group.visible = false;
      vanish.update(-1, V3(), 0.3, ctx.SCALE);
      sun.update(t, 2.5);
      const th = earthAngle(t);
      const ep = V3(R_E * Math.cos(th), 0, -R_E * Math.sin(th));
      earth.group.position.copy(ep);
      earth.group.rotation.set(0, 0, -0.41);
      earth.setScale(EARTH_S);
      const toSun = ep.clone().negate().normalize();
      earth.update({ sunDir: toSun, spin: lt * 0.3, cloudShift: lt * 0.002 });
      earth.uniforms.lightsGain.value = 3.4;
      earthOrbit.uniforms.trailHead.value = th / (Math.PI * 2);
      earthOrbit.uniforms.opacity.value = 1;
      ghostRing.mesh.position.copy(ep);
      ghostRing.uniforms.dashOffset.value = -lt * 1.5;
      ghostRing.uniforms.opacity.value = 0.85 * remap(t, E.s7_start + 0.3, E.s7_start + 0.8) * (1 - remap(t, E.pullback + 1.0, E.pullback + 1.6));
      const reveal = ease.inOutCubic(remap(t, E.pullback, E.pullback + 2.7));
      // other planets only appear once the pull-back widens the view (a grey sphere near Earth would read as a moon)
      const pv = ease.outCubic(remap(reveal, 0.3, 0.7));
      planets.forEach((p) => {
        const a = p.ph + lt * p.speed;
        p.pl.mesh.position.set(p.r * Math.cos(a), 0, -p.r * Math.sin(a));
        p.pl.mesh.scale.setScalar(p.size * Math.max(pv, 1e-4));
        p.pl.mesh.visible = pv > 0.001;
        p.pl.uniforms.sunPos.value.set(0, 0, 0);
      });
      orbits.forEach((o) => (o.uniforms.opacity.value = 0.25 + 0.75 * reveal));
      // gravity arrow from Earth towards the Sun
      gravGroup.position.copy(ep);
      gravGroup.quaternion.setFromUnitVectors(V3(-1, 0, 0), toSun);
      gravGroup.scale.setScalar(EARTH_S * 1.25);
      gravArrow.set(ease.outCubic(remap(t, E.flyaway_text + 0.5, E.flyaway_text + 1.1)), 1 - remap(t, E.pullback + 0.4, E.pullback + 1.0));
      // camera: backlit close view (Sun up-left, Earth lower-right), then pull back and up while
      // keeping both bodies pinned to interpolated screen positions.
      const tang = V3(-Math.sin(th), 0, -Math.cos(th));
      const outw = ep.clone().normalize();
      const drift = remap(t, E.pullback + 2.6, E.s8_start);
      const k = reveal + 0.08 * drift;
      const pos = ep
        .clone()
        .addScaledVector(outw, lerp(4.6, 35, k))
        .addScaledVector(tang, -lerp(2.6, 7, k))
        .add(V3(0, lerp(2.3, 47, k), 0));
      const sE = [lerp(640, 690, k), lerp(1290, 1390, k)];
      const sS = [lerp(230, 500, k), lerp(760, 1010, k)];
      frameTwo(camera, pos.toArray(), ep, sE, V3(0, 0, 0), sS, 46);
      starfield.update(camera, t, { pxScale: ctx.SCALE });
      renderTo(ctx, scene, camera);
      const whoosh = remap(t, E.s7_start, E.s7_start + 0.45);
      return {
        zoomBlur: 0.3 * (1 - ease.outCubic(whoosh)),
        bloomStrength: 1.1,
        fade: 0.85 * ease.inCubic(remap(t, E.s8_start - 0.3, E.s8_start)),
      };
    },
  };

  // ------------------------------------------------------------------ finale
  const finale = {
    name: 'finale',
    t0: E.s8_start,
    t1: E.end + 1,
    render(t) {
      const lt = t - E.s8_start;
      show();
      moon.group.visible = false;
      vanish.update(-1, V3(), 0.3, ctx.SCALE);
      earth.group.position.set(0, 0, 0);
      earth.group.rotation.set(0, 0, 0.2);
      earth.setScale(1);
      earth.update({ sunDir: V3(-1, 0.18, 0.38).normalize(), spin: spinFor(-75) + lt * 0.035, cloudShift: lt * 0.0012 });
      earth.uniforms.lightsGain.value = 3.6;
      const k = ease.outCubic(remap(lt, 0, 5.0));
      const d = lerp(3.55, 5.6, k);
      aimCamera(camera, [0.12 + 0.3 * k, 0.55 + 0.2 * k, d], [0.08, 0.62 + 0.1 * k, 0], { fov: 40, t, roll: 0.06 - 0.04 * k });
      starfield.update(camera, t, { pxScale: ctx.SCALE });
      renderTo(ctx, scene, camera);
      return {
        fade: 0.85 * (1 - ease.outCubic(remap(t, E.s8_start, E.s8_start + 0.5))),
        fadeAll: ease.inOutSine(remap(t, E.fade_out, E.end - 0.05)),
      };
    },
  };

  // Every shot that does not use the extras must hide them.
  const hide = (shot) => {
    const r = shot.render;
    shot.render = (t) => {
      show();
      return r(t);
    };
    return shot;
  };

  return { tidesSpace, rotation, orbit, finale, hide };
}
