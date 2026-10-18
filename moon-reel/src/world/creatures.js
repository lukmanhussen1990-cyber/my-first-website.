import * as THREE from 'three';
import { GLSL_NOISE } from '../core/util.js';

// Shared night lighting for creatures (dim starlight key, cool rim, sky ambient).
export function nightLight() {
  return {
    keyDir: { value: new THREE.Vector3(-0.5, 0.7, 0.5).normalize() },
    keyCol: { value: new THREE.Vector3(0.16, 0.2, 0.3) },
    rimDir: { value: new THREE.Vector3(0.2, 0.35, -1).normalize() },
    rimCol: { value: new THREE.Vector3(0.12, 0.4, 0.5) },
    ambCol: { value: new THREE.Vector3(0.035, 0.05, 0.085) },
  };
}

const LIGHT_GLSL = /* glsl */ `
uniform vec3 keyDir, keyCol, rimDir, rimCol, ambCol;
vec3 shade(vec3 alb, vec3 N, vec3 V, float spec, float shin){
  float diff = max(dot(N, normalize(keyDir)), 0.0);
  float rim = pow(1.0 - max(dot(N, V), 0.0), 2.5) * (0.35 + 0.65 * max(dot(N, normalize(rimDir)), 0.0));
  vec3 col = alb * (keyCol * diff * 1.4 + ambCol * (0.55 + 0.45 * N.y));
  col += rimCol * rim * (0.6 + spec);
  vec3 H = normalize(normalize(keyDir) + V);
  col += keyCol * spec * pow(max(dot(N, H), 0.0), shin) * 2.5;
  vec3 H2 = normalize(normalize(rimDir) + V);
  col += rimCol * spec * pow(max(dot(N, H2), 0.0), shin * 0.7) * 1.5;
  return col;
}
`;

const VS = /* glsl */ `
varying vec3 vN, vW, vO;
void main(){
  vO = position;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

function mat(light, frag, extra = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { ...light, ...extra },
    vertexShader: VS,
    fragmentShader: `${GLSL_NOISE}\n${LIGHT_GLSL}\nvarying vec3 vN, vW, vO;\n${frag}`,
  });
}

// 3D Voronoi for scale patterns: returns (F1, F2)
const VORONOI = /* glsl */ `
vec2 voro(vec3 p){
  vec3 i = floor(p), f = fract(p);
  float d1 = 9.0, d2 = 9.0;
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec3 g = vec3(x, y, z);
    vec3 o = hash33(i + g) * 0.5 + 0.5;
    float d = length(g + o * 0.85 - f);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return vec2(d1, d2);
}`;

// ---------------------------------------------------------------------------------------------
// Sea turtle
// ---------------------------------------------------------------------------------------------
export class Turtle {
  constructor(light) {
    this.group = new THREE.Group();
    this.body = new THREE.Group();
    this.group.add(this.body);

    // carapace: deformed sphere
    const shellGeo = new THREE.SphereGeometry(1, 96, 64);
    const p = shellGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i);
      let y = p.getY(i);
      let z = p.getZ(i);
      const taper = z < 0 ? 1 - 0.2 * -z : 1 - 0.08 * z;
      x *= 0.8 * taper;
      y = y > 0 ? y * 0.4 * (1 - 0.18 * z * z) : y * 0.13;
      y += 0.05 * (1 - Math.min(1, Math.abs(x) / 0.25)) * Math.max(0, p.getY(i)); // faint keel
      p.setXYZ(i, x, y, z);
    }
    shellGeo.computeVertexNormals();
    const shellMat = mat(
      light,
      /* glsl */ `
      void main(){
        vec3 N = normalize(vN);
        vec3 V = normalize(cameraPosition - vW);
        vec2 q = vO.xz;
        vec2 seeds[13] = vec2[13](vec2(0.0,-0.74), vec2(0.0,-0.38), vec2(0.0,0.0), vec2(0.0,0.36), vec2(0.0,0.7),
          vec2(-0.43,-0.5), vec2(-0.46,-0.13), vec2(-0.44,0.23), vec2(-0.37,0.57),
          vec2(0.43,-0.5), vec2(0.46,-0.13), vec2(0.44,0.23), vec2(0.37,0.57));
        float d1 = 9.0, d2 = 9.0; int id = 0;
        for (int i = 0; i < 13; i++){
          float d = length((q - seeds[i]) * vec2(1.0, 1.12));
          if (d < d1){ d2 = d1; d1 = d; id = i; } else if (d < d2) d2 = d;
        }
        float seam = 1.0 - smoothstep(0.0, 0.03, d2 - d1);
        float er = length(vec2(q.x / 0.76, q.y));
        float marg = smoothstep(0.83, 0.86, er);
        float ang = atan(q.x, q.y);
        float mseam = marg * (1.0 - smoothstep(0.0, 0.06, abs(fract(ang / 6.2831853 * 24.0) - 0.5) * 2.0 - 0.9));
        seam = max(seam * (1.0 - marg), max(mseam, smoothstep(0.82, 0.85, er) * (1.0 - smoothstep(0.85, 0.88, er))));
        vec2 c = seeds[id];
        float a = atan(q.x - c.x, q.y - c.y);
        float streak = sin(a * 7.0 + fbm(vec3(q * 6.0, float(id)), 3) * 4.0) * 0.5 + 0.5;
        vec3 base = mix(vec3(0.24, 0.15, 0.07), vec3(0.42, 0.29, 0.13), hash13(vec3(float(id), 2.0, 5.0)));
        vec3 alb = mix(base * 0.6, base * 1.45 + vec3(0.05, 0.04, 0.0), streak * (0.5 + 0.5 * smoothstep(0.0, 0.25, d1)));
        alb *= 0.85 + 0.3 * fbm(vec3(q * 14.0, 1.0), 3);
        alb = mix(alb, vec3(0.06, 0.045, 0.03), seam * 0.85);
        float under = smoothstep(0.0, -0.05, vO.y);
        alb = mix(alb, vec3(0.55, 0.5, 0.34), under);
        vec3 col = shade(alb * 1.8, N, V, 0.32 * (1.0 - under), 36.0);
        gl_FragColor = vec4(col, 1.0);
      }`,
    );
    this.shell = new THREE.Mesh(shellGeo, shellMat);
    this.body.add(this.shell);

    const skin = mat(
      light,
      /* glsl */ `
      ${VORONOI}
      uniform float scaleSize;
      void main(){
        vec3 N = normalize(vN);
        vec3 V = normalize(cameraPosition - vW);
        vec2 vr = voro(vO * scaleSize);
        float seam = 1.0 - smoothstep(0.0, 0.08, vr.y - vr.x);
        vec3 alb = mix(vec3(0.16, 0.13, 0.08), vec3(0.3, 0.22, 0.11), hash13(floor(vO * scaleSize)));
        alb = mix(alb, vec3(0.62, 0.56, 0.36), seam * 0.75);
        vec3 col = shade(alb * 1.8, N, V, 0.25, 30.0);
        gl_FragColor = vec4(col, 1.0);
      }`,
      { scaleSize: { value: 9.0 } },
    );

    const ell = (sx, sy, sz, m = skin, seg = 32) => {
      const g = new THREE.SphereGeometry(1, seg, seg / 2);
      g.scale(sx, sy, sz);
      return new THREE.Mesh(g, m);
    };
    // head + neck
    this.head = new THREE.Group();
    this.head.position.set(0, 0.03, 1.02);
    this.body.add(this.head);
    const neck = ell(0.19, 0.14, 0.24);
    neck.position.set(0, -0.01, -0.04);
    this.head.add(neck);
    const skullGeo = new THREE.SphereGeometry(1, 40, 24);
    const sp = skullGeo.attributes.position;
    for (let i = 0; i < sp.count; i++) {
      const z = sp.getZ(i);
      const k = z > 0 ? 1 - 0.38 * z : 1; // taper to the snout
      sp.setXYZ(i, sp.getX(i) * 0.16 * k, sp.getY(i) * 0.13 * (z > 0 ? 1 - 0.25 * z : 1) + (z > 0.6 ? -0.015 : 0), z * 0.3);
    }
    skullGeo.computeVertexNormals();
    const skull = new THREE.Mesh(skullGeo, skin);
    skull.position.set(0, 0.03, 0.2);
    this.head.add(skull);
    const eyeMat = new THREE.ShaderMaterial({
      uniforms: { ...light },
      vertexShader: VS,
      fragmentShader: `${LIGHT_GLSL}\nvarying vec3 vN, vW, vO;\nvoid main(){ vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vW); vec3 col = shade(vec3(0.01), N, V, 2.0, 160.0); gl_FragColor = vec4(col, 1.0); }`,
    });
    for (const sx of [-1, 1]) {
      const eye = ell(0.045, 0.04, 0.04, eyeMat, 16);
      eye.position.set(sx * 0.118, 0.07, 0.28);
      this.head.add(eye);
    }
    // flippers (pivot groups at the shoulders / hips)
    this.flippers = [];
    const flipGeo = (len, wid, th) => {
      const g = new THREE.SphereGeometry(1, 40, 20);
      const fp = g.attributes.position;
      for (let i = 0; i < fp.count; i++) {
        const x = fp.getX(i); // -1..1 along the flipper
        const u = (x + 1) / 2;
        const taper = 1 - 0.75 * Math.pow(u, 1.6);
        fp.setXYZ(i, x * len, fp.getY(i) * th * (1 - 0.6 * u), fp.getZ(i) * wid * taper - 0.25 * wid * u * u);
      }
      g.computeVertexNormals();
      return g;
    };
    const mkFlip = (side, front) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * (front ? 0.5 : 0.38), -0.06, front ? 0.5 : -0.7);
      const len = front ? 0.6 : 0.28;
      const g = flipGeo(len, front ? 0.2 : 0.14, front ? 0.07 : 0.05);
      if (side < 0) g.scale(-1, 1, 1);
      const f = new THREE.Mesh(g, skin);
      f.position.set(side * len * 0.85, -0.04, front ? -0.06 : -0.04);
      f.rotation.set(0, side * (front ? -0.4 : -0.65), side * (front ? -0.32 : -0.2));
      pivot.add(f);
      this.body.add(pivot);
      this.flippers.push({ pivot, side, front });
    };
    mkFlip(-1, true);
    mkFlip(1, true);
    mkFlip(-1, false);
    mkFlip(1, false);
  }

  // phase-driven crawl: both front flippers stroke together.
  animate(t) {
    const ph = t * ((Math.PI * 2) / 1.5);
    const s = Math.sin(ph);
    for (const f of this.flippers) {
      if (f.front) {
        f.pivot.rotation.y = f.side * (0.15 + 0.55 * s);
        f.pivot.rotation.z = f.side * (0.1 + 0.22 * Math.max(0, Math.cos(ph)));
      } else {
        f.pivot.rotation.y = f.side * (0.3 + 0.25 * Math.sin(ph + 1.2));
      }
    }
    this.body.position.y = 0.035 * Math.max(0, -s);
    this.body.rotation.x = -0.04 * s;
    this.head.rotation.x = -0.12 + 0.08 * Math.sin(ph * 0.5);
    this.head.rotation.y = 0.2 * Math.sin(t * 0.7);
    // forward progress: surges during the power stroke
    return ph / (Math.PI * 2) - (Math.cos(ph) / (Math.PI * 2)) * 0.6;
  }
}

// ---------------------------------------------------------------------------------------------
// Great horned owl
// ---------------------------------------------------------------------------------------------
const PLUMAGE = /* glsl */ `
${VORONOI}
vec3 plumage(vec3 o, float front){
  // feather tips: elongated voronoi cells, mottling, and fine broken barring on the chest
  vec2 vr = voro(o * vec3(16.0, 9.0, 16.0));
  float tip = smoothstep(0.0, 0.12, vr.y - vr.x);
  float mott = fbm(o * vec3(7.0, 5.0, 7.0), 5);
  vec3 back = mix(vec3(0.09, 0.065, 0.045), vec3(0.32, 0.25, 0.17), smoothstep(-0.35, 0.45, mott));
  back = mix(back, vec3(0.45, 0.4, 0.33), smoothstep(0.45, 0.7, mott) * 0.6);
  float bars = smoothstep(0.62, 0.9, sin(o.y * 120.0 + mott * 7.0) * 0.5 + 0.5) * smoothstep(-0.2, 0.4, fbm(o * 20.0, 3));
  vec3 chest = mix(vec3(0.6, 0.5, 0.36), vec3(0.1, 0.07, 0.05), bars * 0.85);
  chest = mix(chest, chest * 0.7, smoothstep(0.2, 0.7, mott) * 0.4);
  vec3 alb = mix(back, chest, front);
  return alb * (0.9 + 0.1 * tip);
}`;

export class Owl {
  constructor(light) {
    this.group = new THREE.Group();
    this.uniforms = { ...light, eyeGlow: { value: 1.6 } };
    const featherMat = (frontExpr) =>
      mat(
        this.uniforms,
        /* glsl */ `
        ${PLUMAGE}
        void main(){
          vec3 N = normalize(vN);
          vec3 V = normalize(cameraPosition - vW);
          float front = ${frontExpr};
          vec3 col = shade(plumage(vO, front) * 2.0, N, V, 0.12, 18.0);
          gl_FragColor = vec4(col, 1.0);
        }`,
      );
    // pear-shaped body from a lathe profile
    const prof = [
      [0.0, 0.0], [0.16, 0.02], [0.3, 0.1], [0.4, 0.26], [0.43, 0.44], [0.41, 0.62], [0.35, 0.8], [0.27, 0.95], [0.18, 1.05], [0.0, 1.1],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const bodyGeo = new THREE.LatheGeometry(prof, 64);
    bodyGeo.scale(1, 1, 0.84);
    const body = new THREE.Mesh(bodyGeo, featherMat('smoothstep(0.05, 0.6, normalize(vO - vec3(0.0, 0.55, 0.0)).z) * smoothstep(1.0, 0.75, vO.y)'));
    body.position.set(0, 0.05, 0);
    this.group.add(body);
    // folded wings hugging the sides
    for (const sx of [-1, 1]) {
      const g = new THREE.SphereGeometry(1, 40, 24);
      const wp = g.attributes.position;
      for (let i = 0; i < wp.count; i++) {
        const y = wp.getY(i);
        const t = (y + 1) / 2;
        wp.setXYZ(i, wp.getX(i) * 0.12, y * 0.5, wp.getZ(i) * 0.3 * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, t * 1.15))));
      }
      g.computeVertexNormals();
      const wing = new THREE.Mesh(g, featherMat('0.0'));
      wing.position.set(sx * 0.37, 0.55, -0.08);
      wing.rotation.set(0.12, -sx * 0.15, sx * 0.1);
      this.group.add(wing);
    }
    const tailG = new THREE.SphereGeometry(1, 24, 12);
    tailG.scale(0.17, 0.26, 0.06);
    const tail = new THREE.Mesh(tailG, featherMat('0.0'));
    tail.position.set(0, 0.06, -0.24);
    tail.rotation.x = 0.45;
    this.group.add(tail);

    // head: broad and flat-topped
    this.head = new THREE.Group();
    this.head.position.set(0, 1.18, 0.02);
    this.group.add(this.head);
    const hg = new THREE.SphereGeometry(1, 64, 40);
    const hp = hg.attributes.position;
    for (let i = 0; i < hp.count; i++) {
      const y = hp.getY(i);
      hp.setXYZ(i, hp.getX(i) * 0.37, y * (y > 0 ? 0.27 : 0.31), hp.getZ(i) * 0.31);
    }
    hg.computeVertexNormals();
    const headMat = mat(
      this.uniforms,
      /* glsl */ `
      ${PLUMAGE}
      void main(){
        vec3 N = normalize(vN);
        vec3 V = normalize(cameraPosition - vW);
        vec3 alb = plumage(vO * 1.2 + vec3(0.0, 2.0, 0.0), 0.0);
        // facial disc around each eye
        vec3 eL = normalize(vec3(-0.135, 0.04, 0.27));
        vec3 eR = normalize(vec3(0.135, 0.04, 0.27));
        vec3 d = normalize(vO / vec3(0.37, 0.29, 0.31));
        float aL = acos(clamp(dot(d, eL), -1.0, 1.0));
        float aR = acos(clamp(dot(d, eR), -1.0, 1.0));
        float a = min(aL, aR);
        float disc = smoothstep(0.78, 0.68, a) * smoothstep(-0.1, 0.25, d.z);
        float rim = smoothstep(0.66, 0.74, a) * smoothstep(0.86, 0.78, a) * smoothstep(-0.1, 0.25, d.z);
        float streak = sin(atan(d.y - 0.04, d.x - sign(d.x) * 0.4) * 26.0) * 0.5 + 0.5;
        vec3 face = mix(vec3(0.55, 0.3, 0.13), vec3(0.72, 0.46, 0.22), streak * 0.6);
        alb = mix(alb, face, disc);
        alb = mix(alb, vec3(0.05, 0.035, 0.025), rim * 0.9);
        // pale brows between the eyes and white throat
        float brow = smoothstep(0.16, 0.05, abs(abs(d.x) - (0.22 - d.y * 0.5))) * smoothstep(0.0, 0.2, d.y) * smoothstep(0.55, 0.8, d.z) * step(abs(d.x), 0.3);
        alb = mix(alb, vec3(0.8, 0.75, 0.65), brow * 0.7);
        float throat = smoothstep(-0.45, -0.7, d.y) * smoothstep(0.3, 0.7, d.z);
        alb = mix(alb, vec3(0.86, 0.83, 0.76), throat);
        vec3 col = shade(alb * 2.0, N, V, 0.12, 18.0);
        gl_FragColor = vec4(col, 1.0);
      }`,
    );
    this.head.add(new THREE.Mesh(hg, headMat));
    // ear tufts: flattened, swept-back cones
    const tuftMat = featherMat('0.0');
    for (const sx of [-1, 1]) {
      const g = new THREE.ConeGeometry(0.07, 0.26, 16);
      g.scale(1, 1, 0.45);
      const tuft = new THREE.Mesh(g, tuftMat);
      tuft.position.set(sx * 0.21, 0.27, 0.0);
      tuft.rotation.set(-0.35, 0, -sx * 0.38);
      this.head.add(tuft);
    }
    const beakG = new THREE.ConeGeometry(0.035, 0.12, 16);
    const beak = new THREE.Mesh(
      beakG,
      mat(this.uniforms, 'void main(){ vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vW); gl_FragColor = vec4(shade(vec3(0.05,0.045,0.04), N, V, 0.8, 60.0), 1.0); }'),
    );
    beak.position.set(0, -0.05, 0.29);
    beak.rotation.x = Math.PI * 0.6;
    this.head.add(beak);
    // eyes with eyeshine and a feathered upper lid
    this.eyes = [];
    const eyeMat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: VS,
      fragmentShader: /* glsl */ `
        uniform float eyeGlow;
        varying vec3 vN, vW, vO;
        void main(){
          vec3 d = normalize(vO);
          float a = acos(clamp(d.z, -1.0, 1.0));
          vec3 iris = mix(vec3(1.0, 0.55, 0.05), vec3(1.0, 0.82, 0.25), smoothstep(0.85, 0.3, a));
          vec3 col = iris * eyeGlow * smoothstep(1.05, 0.9, a);
          col *= smoothstep(0.36, 0.42, a);
          vec3 V = normalize(cameraPosition - vW);
          vec3 N = normalize(vN);
          col += vec3(1.0) * pow(max(dot(reflect(-V, N), normalize(vec3(-0.3, 0.6, 0.7))), 0.0), 140.0) * 2.0;
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const lidMat = featherMat('0.0');
    for (const sx of [-1, 1]) {
      const eg = new THREE.Group();
      eg.position.set(sx * 0.135, 0.035, 0.255);
      eg.rotation.y = sx * 0.2;
      const eg2 = new THREE.Group();
      eg.add(eg2);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16).scale(0.078, 0.078, 0.05), eyeMat);
      eg2.add(eye);
      const lid = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5).scale(0.09, 0.09, 0.07), lidMat);
      lid.rotation.x = -0.55;
      lid.position.set(0, 0.012, 0.004);
      eg.add(lid);
      this.head.add(eg);
      this.eyes.push(eg2);
    }
  }
  animate(t, yaw, blink) {
    this.head.rotation.y = yaw;
    this.head.rotation.z = 0.04 * Math.sin(t * 1.3);
    for (const e of this.eyes) e.scale.y = Math.max(0.06, 1 - blink);
    this.group.position.y = 0.01 * Math.sin(t * 2.0);
  }
}

// ---------------------------------------------------------------------------------------------
// Bat silhouette with flapping wings
// ---------------------------------------------------------------------------------------------
export class Bat {
  constructor() {
    this.group = new THREE.Group();
    const m = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8).scale(0.08, 0.06, 0.2), m);
    this.group.add(body);
    const wingShape = () => {
      const s = new THREE.Shape();
      s.moveTo(0, 0.08);
      s.quadraticCurveTo(0.35, 0.22, 0.62, 0.05);
      s.quadraticCurveTo(0.5, -0.02, 0.46, -0.12);
      s.quadraticCurveTo(0.36, -0.06, 0.3, -0.16);
      s.quadraticCurveTo(0.2, -0.06, 0.12, -0.15);
      s.quadraticCurveTo(0.07, -0.06, 0, -0.1);
      s.closePath();
      const g = new THREE.ShapeGeometry(s, 8);
      g.rotateX(-Math.PI / 2);
      return g;
    };
    this.wings = [];
    for (const sx of [-1, 1]) {
      const g = wingShape();
      if (sx < 0) g.scale(-1, 1, 1);
      const w = new THREE.Mesh(g, m);
      this.group.add(w);
      this.wings.push({ w, sx });
    }
  }
  animate(t, phase = 0) {
    const f = Math.sin(t * 16 + phase);
    for (const { w, sx } of this.wings) w.rotation.z = sx * (0.15 + 0.85 * f);
  }
}
