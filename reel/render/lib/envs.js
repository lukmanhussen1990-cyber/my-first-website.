// Environment scenes turned into reflection maps (PMREM). Each one is a
// little "room" of glowing shapes; the paint and glass reflect it.
import * as THREE from 'three';

function emissive(color, intensity) {
  return new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide });
}
function box(scene, color, size) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(size, size, size),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(color), side: THREE.BackSide }));
  scene.add(m);
  return m;
}
function panel(scene, mat, w, h, pos, lookAt) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(...pos); m.lookAt(...lookAt); scene.add(m);
  return m;
}

// Dark photo studio with a big overhead softbox and two strip lights.
export function studioEnvScene() {
  const s = new THREE.Scene();
  box(s, 0x101114, 40);
  panel(s, emissive(0xffffff, 3.2), 9, 4, [0, 12, 2], [0, 0, 0]);
  panel(s, emissive(0xf4f6ff, 2.0), 1.6, 9, [-12, 4, 6], [0, 2, 0]);
  panel(s, emissive(0xfff4e8, 1.8), 1.6, 9, [12, 4, -6], [0, 2, 0]);
  panel(s, emissive(0x2a2c30, 1), 40, 40, [0, -0.5, 0], [0, 10, 0]);
  return s;
}

// Golden-hour garden: warm low sun, orange-pink sky, green ground.
export function sunsetEnvScene() {
  const s = new THREE.Scene();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(50, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vD; void main(){ float h = vD.y;
      vec3 top = vec3(0.20, 0.35, 0.80), mid = vec3(1.4, 0.75, 0.45), hor = vec3(2.6, 1.25, 0.55), gnd = vec3(0.30, 0.26, 0.20);
      vec3 c = h > 0.0 ? mix(mix(hor, mid, smoothstep(0.0, 0.18, h)), top, smoothstep(0.18, 0.8, h)) : mix(vec3(0.55,0.45,0.32), gnd, smoothstep(0.0, -0.3, h));
      vec3 sd = normalize(vec3(-0.75, 0.12, -0.55)); float sun = pow(max(dot(vD, sd), 0.0), 600.0) * 60.0 + pow(max(dot(vD, sd), 0.0), 12.0) * 1.4;
      gl_FragColor = vec4(c + vec3(1.0, 0.7, 0.4) * sun, 1.0); }`,
  }));
  s.add(sky);
  return s;
}

// Tunnel interior: earthy walls, warm lamp glow ahead, soft studio panel on the open side.
export function tunnelEnvScene(wall = 0x5a4632, glow = 0xffd8a8, glowI = 2.0) {
  const s = new THREE.Scene();
  box(s, wall, 30);
  panel(s, emissive(glow, glowI), 6, 6, [0, -10, 0], [0, 0, 0]);
  panel(s, emissive(0xdfe6ff, 1.6), 12, 18, [0, 0, 13], [0, 0, 0]); // the cut-away side, toward camera
  panel(s, emissive(0xffffff, 1.2), 8, 4, [0, 12, 4], [0, 0, 0]);
  return s;
}

// Lava / mantle: everything glows orange-red.
export function lavaEnvScene() {
  const s = new THREE.Scene();
  box(s, 0x3a0c02, 30);
  panel(s, emissive(0xff5a10, 3.0), 30, 30, [0, -12, 0], [0, 0, 0]);
  panel(s, emissive(0xff8a30, 2.2), 30, 30, [-13, 0, 0], [0, 0, 0]);
  panel(s, emissive(0xff6a20, 2.2), 30, 30, [13, 0, 0], [0, 0, 0]);
  panel(s, emissive(0xffd0a0, 1.2), 12, 18, [0, 0, 13], [0, 0, 0]);
  return s;
}

// Sunrise beach: bright blue sky, warm sun low on the horizon, turquoise sea, white sand.
export function beachEnvScene() {
  const s = new THREE.Scene();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(50, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vD; void main(){ float h = vD.y;
      vec3 top = vec3(0.25, 0.55, 1.25), hor = vec3(2.2, 1.6, 1.2), sea = vec3(0.05, 0.45, 0.55), sand = vec3(1.4, 1.25, 1.0);
      vec3 c = h > 0.0 ? mix(hor, top, smoothstep(0.0, 0.5, h)) : (vD.z < 0.2 ? mix(sea, sea*0.6, smoothstep(0.0,-0.5,h)) : sand);
      vec3 sd = normalize(vec3(0.5, 0.1, -0.85)); float sun = pow(max(dot(vD, sd), 0.0), 500.0) * 50.0 + pow(max(dot(vD, sd), 0.0), 10.0) * 1.2;
      gl_FragColor = vec4(c + vec3(1.0, 0.8, 0.55) * sun, 1.0); }`,
  }));
  s.add(sky);
  return s;
}

// Bright chrome studio: white sky, soft horizon bands, darker floor, big softboxes.
export function chromeEnvScene() {
  const s = new THREE.Scene();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(40, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vD; void main(){ float h = vD.y;
      vec3 c = mix(vec3(0.18, 0.17, 0.16), vec3(1.6, 1.6, 1.65), smoothstep(-0.25, 0.35, h));
      c += vec3(2.5) * smoothstep(0.92, 0.97, abs(vD.x)) * smoothstep(-0.2, 0.3, h);
      c *= 0.85 + 0.15 * sin(h * 18.0);
      gl_FragColor = vec4(c, 1.0); }`,
  }));
  s.add(sky);
  return s;
}

export function makeEnvMaps(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const out = {
    studio: pmrem.fromScene(studioEnvScene(), 0.02).texture,
    chrome: pmrem.fromScene(chromeEnvScene(), 0.02).texture,
    sunset: pmrem.fromScene(sunsetEnvScene(), 0.02).texture,
    soil: pmrem.fromScene(tunnelEnvScene(0x4a3624, 0xffd2a0, 1.6), 0.02).texture,
    rock: pmrem.fromScene(tunnelEnvScene(0x3c3d40, 0xdfe8ff, 1.6), 0.02).texture,
    lava: pmrem.fromScene(lavaEnvScene(), 0.02).texture,
    beach: pmrem.fromScene(beachEnvScene(), 0.02).texture,
  };
  pmrem.dispose();
  return out;
}
