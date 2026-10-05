// Scene lighting: moonlight (with shadows that follow the car), sky fill, a
// small pool of real spot lights assigned to the nearest streetlights, and
// lights borrowed by scripted events. Also gathers glowing sources for the
// volumetric fog pass.

import * as THREE from 'three';
import { hash1 } from '../core/math.js';

export const MAX_FOG_LAMPS = 8;

export class Lights {
  constructor(scene, quality, sky) {
    this.scene = scene;
    this.q = quality;
    this.sky = sky;

    this.moon = new THREE.DirectionalLight(0x9fb6ff, 0.22);
    this.moon.castShadow = quality.moonShadow > 0;
    if (this.moon.castShadow) {
      const s = this.moon.shadow;
      s.mapSize.set(quality.moonShadow, quality.moonShadow);
      s.camera.left = -60;
      s.camera.right = 60;
      s.camera.top = 60;
      s.camera.bottom = -60;
      s.camera.near = 1;
      s.camera.far = 400;
      s.bias = -0.0006;
      s.normalBias = 0.05;
    }
    scene.add(this.moon, this.moon.target);
    // Light direction is a little higher than the visible moon, so moonlight
    // reaches the road between the trees.
    this.moonLightDir = new THREE.Vector3();

    this.hemi = new THREE.HemisphereLight(0x1a2438, 0x0a0806, 0.5);
    scene.add(this.hemi);

    this.street = [];
    for (let i = 0; i < 3; i++) {
      const L = new THREE.SpotLight(0xff9a3c, 0, 34, 1.05, 0.65, 2);
      L.castShadow = i === 0 && quality.streetShadow > 0;
      if (L.castShadow) {
        L.shadow.mapSize.set(quality.streetShadow, quality.streetShadow);
        L.shadow.camera.near = 0.5;
        L.shadow.camera.far = 36;
        L.shadow.bias = -0.0005;
        L.shadow.normalBias = 0.04;
        L.shadow.autoUpdate = false;
      }
      scene.add(L, L.target);
      this.street.push({ light: L, lamp: null });
    }

    this.eventSpot = new THREE.SpotLight(0xffffff, 0, 120, 0.5, 0.4, 2);
    scene.add(this.eventSpot, this.eventSpot.target);
    this.eventPoints = [0, 1].map(() => {
      const p = new THREE.PointLight(0xffa020, 0, 30, 2);
      scene.add(p);
      return p;
    });
    this.eventGlows = []; // extra fog-only glows registered by events

    this.fogLamps = {
      pos: Array.from({ length: MAX_FOG_LAMPS }, () => new THREE.Vector4()),
      col: Array.from({ length: MAX_FOG_LAMPS }, () => new THREE.Vector4()),
      dir: Array.from({ length: MAX_FOG_LAMPS }, () => new THREE.Vector4()),
      count: 0,
    };
    this.time = 0;
    this.moonIntensity = 0.22;
    this.moonVisibility = 1;
    this._v = new THREE.Vector3();
  }

  /** Level 0..1 for a lamp's flicker mode at time t. */
  lampLevel(lamp, t) {
    if (!lamp.enabled) return 0;
    switch (lamp.flicker) {
      case 'erratic': {
        // A failing sodium lamp: mostly on, sputtering, sometimes dropping out.
        const k = Math.floor(t * 14 + lamp.seed);
        const r = hash1(k);
        const slow = Math.sin(t * 0.7 + lamp.seed) * 0.5 + 0.5;
        if (r < 0.1 + slow * 0.12) return 0.05;
        if (r < 0.22) return 0.4 + hash1(k + 7) * 0.4;
        return 0.92 + 0.08 * Math.sin(t * 120);
      }
      case 'dying': {
        const k = Math.floor(t * 6 + lamp.seed);
        return hash1(k) < 0.7 ? 0.0 : 0.15 + hash1(k + 3) * 0.3;
      }
      case 'blink': {
        const ph = (t * 0.9 + lamp.seed * 0.17) % 1;
        return ph < 0.45 ? Math.min(1, ph * 20) * (1 - Math.max(0, ph - 0.4) * 20) : 0;
      }
      case 'off':
        return 0;
      default:
        return 1;
    }
  }

  update(dt, { carPos, carForward, worldLamps, cloudVeil = 0, lightning = 0 }) {
    this.time += dt;
    const t = this.time;

    // Moon follows the car; snap to shadow texels to avoid shimmering edges.
    const md = this.sky.moonDir;
    this.moonLightDir.set(md.x, Math.max(md.y, 0.62), md.z).normalize();
    const visibility = 1 - cloudVeil * 0.82;
    this.moonVisibility = visibility;
    this.moon.intensity = this.moonIntensity * visibility + lightning * 2.5;
    this.moon.color.setRGB(0.62 + lightning * 0.3, 0.71 + lightning * 0.25, 1.0);
    const target = this._v.copy(carPos).addScaledVector(carForward, 25);
    if (this.moon.castShadow) {
      const texel = 120 / this.q.moonShadow;
      target.x = Math.round(target.x / texel) * texel;
      target.z = Math.round(target.z / texel) * texel;
    }
    this.moon.target.position.copy(target);
    this.moon.position.copy(target).addScaledVector(this.moonLightDir, 200);
    this.hemi.intensity = 0.42 + lightning * 3;

    // Lamp levels and real lights for the nearest streetlights ahead.
    const scored = [];
    for (const lamp of worldLamps) {
      lamp.level = this.lampLevel(lamp, t);
      for (const m of lamp.lensMats) m.emissiveIntensity = lamp.lensIntensity * lamp.level;
      if (lamp.fogOnly) continue;
      const dx = lamp.pos.x - carPos.x;
      const dz = lamp.pos.z - carPos.z;
      const dist = Math.hypot(dx, dz);
      const ahead = dx * carForward.x + dz * carForward.z;
      if (dist < 110) scored.push({ lamp, score: dist - Math.max(0, ahead) * 0.35 + (ahead < -25 ? 40 : 0) });
    }
    scored.sort((a, b) => a.score - b.score);
    this.street.forEach((slot, i) => {
      const pick = scored[i]?.lamp || null;
      const L = slot.light;
      if (pick) {
        if (slot.lamp !== pick) {
          L.position.copy(pick.pos);
          L.target.position.copy(pick.pos).addScaledVector(pick.dir, 8);
          L.color.copy(pick.color);
          L.angle = pick.angle;
          L.penumbra = pick.penumbra;
          L.distance = pick.range;
          slot.lamp = pick;
        }
        L.intensity = pick.intensity * pick.level;
        if (L.castShadow) L.shadow.autoUpdate = pick.level > 0.01;
      } else {
        L.intensity = 0;
        slot.lamp = null;
        if (L.castShadow) L.shadow.autoUpdate = false;
      }
    });

    // Glowing sources for the fog, nearest first.
    const glows = [];
    for (const lamp of worldLamps) {
      if (lamp.level < 0.01) continue;
      const d = lamp.pos.distanceTo(carPos);
      if (d < 220) glows.push({ d, pos: lamp.pos, dir: lamp.dir, color: lamp.color, i: lamp.intensity * lamp.level * (lamp.fogScale ?? 1), cone: Math.cos(lamp.angle), pen: Math.cos(lamp.angle * (1 - lamp.penumbra)), range: lamp.range * 2.2 });
    }
    for (const g of this.eventGlows) {
      if (g.intensity <= 0.001) continue;
      glows.push({ d: g.pos.distanceTo(carPos), pos: g.pos, dir: g.dir || this._v.set(0, -1, 0), color: g.color, i: g.intensity, cone: g.cone ?? -1, pen: g.pen ?? -1, range: g.range ?? 60 });
    }
    glows.sort((a, b) => a.d - b.d);
    const F = this.fogLamps;
    F.count = Math.min(MAX_FOG_LAMPS, glows.length);
    for (let i = 0; i < MAX_FOG_LAMPS; i++) {
      const g = glows[i];
      if (!g) {
        F.col[i].set(0, 0, 0, -2); // unused slot
        continue;
      }
      F.pos[i].set(g.pos.x, g.pos.y, g.pos.z, g.range);
      F.col[i].set(g.color.r * g.i, g.color.g * g.i, g.color.b * g.i, g.cone);
      F.dir[i].set(g.dir.x, g.dir.y, g.dir.z, g.pen);
    }
  }
}
