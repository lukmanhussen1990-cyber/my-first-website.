// TV: a procedural cartoon (drawn every frame from t), static, and a live "security feed" of the room.
import * as THREE from 'three';
import { hash1, noise1 } from '../lib/util.js';

const CW = 512, CH = 288;

export function buildTV(refs, scene) {
  const c = document.createElement('canvas');
  c.width = CW; c.height = CH;
  const ctx = c.getContext('2d');
  const cartoonTex = new THREE.CanvasTexture(c);
  cartoonTex.colorSpace = THREE.SRGBColorSpace;
  cartoonTex.minFilter = THREE.LinearFilter;

  const feedRT = new THREE.WebGLRenderTarget(640, 360, { type: THREE.HalfFloatType, samples: 2 });
  const feedCam = new THREE.PerspectiveCamera(34, 16 / 9, 0.1, 30);
  feedCam.position.set(-2.05, 2.48, -1.05);
  feedCam.lookAt(0.12, 1.0, 1.0);
  feedCam.layers.enable(2);
  // infrared illuminator next to the security camera: only switched on while the feed is rendered
  const ir = new THREE.PointLight(0xdfe9ff, 0, 7, 2);
  ir.position.copy(feedCam.position).add(new THREE.Vector3(0.2, -0.1, 0.2));

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      tCartoon: { value: cartoonTex }, tFeed: { value: feedRT.texture },
      uMode: { value: 0 }, uStatic: { value: 0 }, uFrame: { value: 0 }, uBright: { value: 2.2 }, uOff: { value: 0 },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform sampler2D tCartoon, tFeed; uniform float uMode, uStatic, uFrame, uBright, uOff; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + uFrame*0.618) * 43758.5453); }
      void main(){
        vec3 cart = texture2D(tCartoon, vUv).rgb;
        // CCTV look: slight barrel, desaturate, green-grey tint, scanlines, noise, vignette
        vec2 q = vUv - 0.5; q *= 1.0 + 0.06 * dot(q,q);
        vec3 f = texture2D(tFeed, q + 0.5).rgb * 2.6;
        f = f / (1.0 + f);
        float l = dot(f, vec3(0.3,0.59,0.11));
        f = vec3(l) * vec3(0.84,1.0,0.9);
        f = pow(max(f, 0.0), vec3(0.8)) * 1.15;
        f *= 0.9 + 0.1 * sin(vUv.y * 360.0 * 3.14159);
        f += (h(floor(vUv*vec2(480.0,270.0))) - 0.5) * 0.05;
        f *= smoothstep(0.9, 0.3, length(q));
        vec3 col = mix(cart, f, uMode);
        float s = h(floor(vUv*vec2(160.0,90.0)) + floor(uFrame));
        col = mix(col, vec3(s) * 0.9, uStatic);
        col *= 1.0 - uOff;
        gl_FragColor = vec4(col * uBright, 1.0);
      }`,
    toneMapped: true,
  });
  const [sw, sh] = refs.tvScreenSize;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), mat);
  screen.position.set(0, 0, -0.027);
  screen.rotation.y = Math.PI;
  refs.tvGroup.add(screen);

  return { canvas: c, ctx, cartoonTex, feedRT, feedCam, mat, screen, ir };
}

// ------------------------------------------------------------- cartoon drawing
// Returns the average screen colour (linear-ish 0..1) so the TV light can follow the picture.
export function drawCartoon(tv, t, gags) {
  const g = tv.ctx;
  // most recent gag drives a bonk + flash
  let since = 99;
  for (const gt of gags) if (t >= gt) since = Math.min(since, t - gt);
  const flash = since < 0.12 ? 1 : since < 0.3 ? 0.4 : 0;
  const scene = Math.floor(t / 7.5) % 3; // three colourful "sets"
  const skies = [['#5fd3ff', '#bff0ff'], ['#ffb3d1', '#ffe6a8'], ['#8be38b', '#e5ffc4']];
  const [s0, s1] = skies[scene];
  const sky = g.createLinearGradient(0, 0, 0, CH);
  sky.addColorStop(0, s0); sky.addColorStop(1, s1);
  g.fillStyle = sky; g.fillRect(0, 0, CW, CH);
  // sun
  g.save(); g.translate(430, 60); g.rotate(t * 0.8);
  g.fillStyle = '#ffd93b';
  for (let i = 0; i < 10; i++) { g.rotate(Math.PI / 5); g.fillRect(-4, 30, 8, 18); }
  g.beginPath(); g.arc(0, 0, 26, 0, Math.PI * 2); g.fill(); g.restore();
  // clouds
  g.fillStyle = 'rgba(255,255,255,0.9)';
  for (let i = 0; i < 3; i++) {
    const x = ((t * 18 + i * 190) % (CW + 160)) - 80, y = 40 + i * 22;
    g.beginPath(); g.arc(x, y, 20, 0, 7); g.arc(x + 22, y - 8, 24, 0, 7); g.arc(x + 46, y, 18, 0, 7); g.fill();
  }
  // hills
  g.fillStyle = ['#3bbf5a', '#e0709a', '#4caf50'][scene];
  g.beginPath(); g.moveTo(0, CH);
  for (let x = 0; x <= CW; x += 8) g.lineTo(x, 205 + Math.sin(x * 0.018 + scene) * 18);
  g.lineTo(CW, CH); g.fill();
  // hero blob bouncing across
  const bx = 110 + ((Math.sin(t * 0.9) * 0.5 + 0.5) * 290);
  const bounce = Math.abs(Math.sin(t * 5.2));
  const squash = 1 + (1 - bounce) * 0.25 * (since > 0.5 ? 1 : 0);
  const by = 188 - bounce * 60;
  g.save(); g.translate(bx, by); g.scale(squash, 1 / squash);
  g.fillStyle = '#ffcf33'; g.beginPath(); g.arc(0, 0, 30, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(-10, -6, 9, 0, 7); g.arc(11, -6, 9, 0, 7); g.fill();
  g.fillStyle = '#222'; g.beginPath(); g.arc(-8, -5, 4, 0, 7); g.arc(13, -5, 4, 0, 7); g.fill();
  g.strokeStyle = '#7a3b00'; g.lineWidth = 3; g.beginPath(); g.arc(0, 6, 10, 0.1 * Math.PI, 0.9 * Math.PI); g.stroke();
  g.restore();
  // chaser
  const cx = bx - 120 + Math.sin(t * 2.1) * 10;
  g.fillStyle = '#ff6fb1'; g.beginPath(); g.ellipse(cx, 192, 24, 20, 0, 0, 7); g.fill();
  g.beginPath(); g.ellipse(cx - 8, 165, 6, 16, -0.2, 0, 7); g.ellipse(cx + 8, 165, 6, 16, 0.2, 0, 7); g.fill();
  // gag: anvil drop + stars
  if (since < 1.6) {
    const ay = Math.min(150, -40 + since * 600);
    g.fillStyle = '#444'; g.fillRect(bx - 26, ay, 52, 22); g.fillRect(bx - 12, ay + 22, 24, 10);
    if (since > 0.3) {
      g.fillStyle = '#fff36b';
      for (let i = 0; i < 5; i++) {
        const a = since * 6 + i * 1.256;
        star(g, bx + Math.cos(a) * 40, by - 40 + Math.sin(a) * 10, 7);
      }
    }
  }
  if (flash > 0) { g.fillStyle = `rgba(255,255,255,${flash})`; g.fillRect(0, 0, CW, CH); }
  tv.cartoonTex.needsUpdate = true;
  const base = [[0.55, 0.85, 1.0], [1.0, 0.8, 0.85], [0.65, 0.95, 0.7]][scene];
  const w = 0.45 + flash * 0.55;
  return base.map((v) => v * (1 - flash) + flash).map((v) => v * w + 0.25);
}

function star(g, x, y, r) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath(); g.fill();
}

// Flicker factor for the TV light: picture brightness + fear-driven dips (deterministic noise).
export function tvFlicker(t, fear) {
  const fast = noise1(t * 9.0, 3) * 0.5 + noise1(t * 23.0, 4) * 0.3;
  const dip = hash1(Math.floor(t * 12)) < fear * 0.18 ? 0.45 : 0;
  return Math.max(0.15, 1 + fast * (0.12 + fear * 0.35) - dip);
}
