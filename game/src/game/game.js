// STUB — Gameplay agent replaces this with the real game (player, combat, AI, stage, camera...).
import * as THREE from 'three';
import { PLAYER_START } from '../config.js';
import { createWorld } from '../world/world.js';
import { createCrowdRenderer } from '../chars/crowd.js';
import { createHeroRig } from '../chars/hero.js';
import { createOfficerRig } from '../chars/officer.js';
import { createItemRenderer } from '../chars/items.js';
import { createFX } from '../fx/fx.js';
import { createAudio } from '../audio/audio.js';
import { createInput } from '../ui/input.js';
import { createHUD } from '../ui/hud.js';

export function createGame(ctx) {
  const world = createWorld(ctx);
  const crowd = createCrowdRenderer(ctx, { max: ctx.quality.maxSoldiers });
  const hero = createHeroRig(ctx); ctx.scene.add(hero.group);
  const off = createOfficerRig(ctx, 'zhanghe'); ctx.scene.add(off.group); off.group.position.set(0, 0, 20);
  const items = createItemRenderer(ctx, { max: 32 });
  const fx = createFX(ctx), audio = createAudio(), input = createInput(ctx), hud = createHUD(ctx);
  const player = { x: PLAYER_START.x, z: PLAYER_START.z, yaw: PLAYER_START.yaw, hp: 1000, maxHp: 1000, musou: 0 };
  const soldiers = [];
  for (let i = 0; i < 60; i++) soldiers.push({ kind: ['spear', 'sword', 'shield', 'archer', 'banner'][i % 5], tint: i % 7 === 0 ? 2 : 0, x: (i % 10 - 5) * 1.6, y: 0, z: -Math.floor(i / 10) * 1.6, yaw: 0, pitch: 0, roll: 0, anim: 'idle', animT: 0, phase: 0, flash: 0, fade: 0, visible: true });
  let camYaw = PLAYER_START.yaw, state = 'title';
  const itemList = [{ kind: 'bun', x: 3, z: 35, visible: true }];
  hud.showScreen('title', {}, { onStart() { state = 'playing'; hud.showScreen(null); audio.unlock(); } });
  const g = { get state() { return state; }, player, soldiers: () => soldiers.length, stats: { ko: 0, maxChain: 0, time: 0 }, fps: 0 };
  window.__game = g;
  return {
    update(dt, time) {
      input.update(dt);
      const st = input.state;
      camYaw -= st.look.dx;
      if (state === 'playing') {
        const fx_ = Math.sin(camYaw), fz = Math.cos(camYaw);
        const mx = st.moveY * fx_ - st.moveX * fz, mz = st.moveY * fz + st.moveX * fx_;
        const len = Math.hypot(mx, mz);
        if (len > 0.1) { player.x += mx / len * 7 * dt; player.z += mz / len * 7 * dt; player.yaw = Math.atan2(mx, mz); }
      }
      hero.group.position.set(player.x, 0, player.z); hero.group.rotation.y = player.yaw;
      hero.pose(st.held.attack ? 'N2' : 'idle', (time * 2) % 1, time, {});
      off.pose('idle', 0, time, {});
      for (const s of soldiers) { s.animT += dt; s.yaw = Math.atan2(player.x - s.x, player.z - s.z); }
      crowd.update(soldiers, soldiers.length, time, ctx.camera);
      items.update(itemList, time);
      world.update(dt, time, hero.group.position);
      fx.update(dt, ctx.camera);
      const cam = ctx.camera;
      cam.position.set(player.x - Math.sin(camYaw) * 7.5, 3.4, player.z - Math.cos(camYaw) * 7.5);
      cam.lookAt(player.x, 1.4, player.z);
      hud.update(dt);
      input.endFrame();
    },
  };
}
