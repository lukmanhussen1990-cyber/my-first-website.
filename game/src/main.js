// Boot + main loop. Owner: Gameplay agent.
import * as THREE from 'three';
import { QUALITY, pickDefaultQuality } from './config.js';
import { createEvents } from './core/events.js';
import { createGame } from './game/game.js';

function boot() {
  const params = new URLSearchParams(location.search);
  const qName = params.get('quality') || localStorage.getItem('cbm.quality') || pickDefaultQuality();
  const quality = { ...(QUALITY[qName] || QUALITY.medium) };
  const canvas = document.getElementById('game');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality.antialias, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.pixelRatio));
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.shadowMap.enabled = !!quality.shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, quality.drawDistance + 60);
  const ctx = {
    renderer, scene, camera, quality,
    isTouch: matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window,
    uiRoot: document.getElementById('ui'),
    events: createEvents(),
  };
  const game = createGame(ctx);
  addEventListener('resize', () => {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  });
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    game.update(dt, now / 1000);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

boot();
