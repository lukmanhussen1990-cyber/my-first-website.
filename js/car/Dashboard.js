// Instrument cluster (amber dials with live needles), the centre navigation
// screen (draws the real road ahead) and the small rear climate display.

import * as THREE from 'three';

const FONT = '"Overpass", "Overpass Mono", "Arial Narrow", Arial, sans-serif';
const MONO = '"Overpass Mono", "Courier New", monospace';

function canvasTexture(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { c, g: c.getContext('2d'), tex };
}

function glowMaterial(tex, intensity) {
  return new THREE.MeshStandardMaterial({
    color: 0x000000,
    roughness: 0.25,
    emissive: 0xffffff,
    emissiveMap: tex,
    emissiveIntensity: intensity,
  });
}

export class Dashboard {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'dashboard-instruments';
    this.brightness = 1;
    this._buildCluster();
    this._buildScreen();
    this._buildRearDisplay();
    this._acc = 0;
    this.state = {
      speed: 0, rpm: 800, clock: '00:13', temp: 8, dest: 41.0, route: [], radio: '96.4 FM · NIGHT DRIVE',
      glitch: 0, gpsLost: false, fuel: 0.62,
    };
  }

  _buildCluster() {
    const W = 1024;
    const H = 384;
    const { c, g, tex } = canvasTexture(W, H);
    this.cluster = { c, g, tex };
    const amber = '#ffb066';
    g.fillStyle = '#020202';
    g.fillRect(0, 0, W, H);
    const dial = (cx, cy, r, max, step, labelEvery, red) => {
      const a0 = Math.PI * 0.75;
      const a1 = Math.PI * 2.25;
      g.lineCap = 'round';
      for (let v = 0; v <= max + 1e-6; v += step) {
        const a = a0 + (a1 - a0) * (v / max);
        const major = Math.abs((v / labelEvery) - Math.round(v / labelEvery)) < 1e-6;
        g.strokeStyle = red && v >= red ? '#ff4d3a' : amber;
        g.lineWidth = major ? 5 : 2.2;
        const r0 = r - (major ? 26 : 14);
        g.beginPath();
        g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        g.stroke();
        if (major) {
          g.fillStyle = red && v >= red ? '#ff4d3a' : '#ffd9b0';
          g.font = `600 30px ${FONT}`;
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText(String(Math.round(v / (max > 100 ? 1 : 1))), cx + Math.cos(a) * (r - 50), cy + Math.sin(a) * (r - 50));
        }
      }
      g.strokeStyle = 'rgba(255,170,90,0.25)';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(cx, cy, r + 8, a0, a1);
      g.stroke();
    };
    dial(190, 192, 168, 140, 5, 20, null);
    dial(834, 192, 168, 7, 0.25, 1, 6);
    g.fillStyle = '#ffd9b0';
    g.font = `500 20px ${FONT}`;
    g.textAlign = 'center';
    g.fillText('MPH', 190, 262);
    g.fillText('×1000 RPM', 834, 262);
    this.clusterStatic = g.getImageData(0, 0, W, H);

    const mat = glowMaterial(tex, 2.2);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.33, 0.124), mat);
    face.name = 'cluster';
    this.clusterMat = mat;
    this.clusterFace = face;
    // Needles pivot at each dial centre (canvas → plane coords).
    const toPlane = (px, py) => new THREE.Vector3((px / W - 0.5) * 0.33, (0.5 - py / H) * 0.124, 0.002);
    const needleGeo = new THREE.PlaneGeometry(0.0035, 0.05);
    needleGeo.translate(0, 0.021, 0);
    const needleMat = new THREE.MeshStandardMaterial({ color: 0, emissive: 0xff4a28, emissiveIntensity: 5 });
    this.needles = [toPlane(190, 192), toPlane(834, 192)].map((p) => {
      const n = new THREE.Mesh(needleGeo, needleMat);
      n.position.copy(p);
      face.add(n);
      const hub = new THREE.Mesh(new THREE.CircleGeometry(0.006, 12), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 }));
      hub.position.copy(p).setZ(0.003);
      face.add(hub);
      return n;
    });
    this.needleMat = needleMat;
  }

  _buildScreen() {
    const W = 640;
    const H = 360;
    const { c, g, tex } = canvasTexture(W, H);
    this.screen = { c, g, tex, W, H };
    const mat = glowMaterial(tex, 1.15);
    this.screenMat = mat;
    this.screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.14), mat);
    this.screenMesh.name = 'nav-screen';
  }

  _buildRearDisplay() {
    const { c, g, tex } = canvasTexture(256, 96);
    this.rear = { c, g, tex };
    g.fillStyle = '#000';
    g.fillRect(0, 0, 256, 96);
    g.fillStyle = '#7fc3ff';
    g.font = `600 54px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('21°', 128, 50);
    g.font = `500 16px ${FONT}`;
    g.fillText('AUTO', 210, 26);
    g.fillText('REAR', 46, 26);
    tex.needsUpdate = true;
    const mat = glowMaterial(tex, 1.4);
    this.rearMat = mat;
    this.rearMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.028), mat);
    this.rearMesh.name = 'rear-display';
  }

  _drawCluster() {
    const { g, tex } = this.cluster;
    const s = this.state;
    g.putImageData(this.clusterStatic, 0, 0);
    // Centre information display.
    g.fillStyle = '#ffd9b0';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `600 64px ${MONO}`;
    g.fillText(String(Math.round(s.speed * 2.23694)), 512, 150);
    g.font = `500 22px ${FONT}`;
    g.fillText('MPH', 512, 196);
    g.font = `500 24px ${MONO}`;
    g.fillText(s.clock, 512, 252);
    g.font = `400 20px ${MONO}`;
    g.fillStyle = '#c99c70';
    g.fillText(`${(s.temp * 9 / 5 + 32).toFixed(0)}°F   ODO 48${String(Math.floor(this._odo || 0)).padStart(4, '0')}`, 512, 290);
    // Fuel bar.
    g.fillStyle = 'rgba(255,176,102,0.25)';
    g.fillRect(452, 318, 120, 8);
    g.fillStyle = '#ffb066';
    g.fillRect(452, 318, 120 * s.fuel, 8);
    tex.needsUpdate = true;
  }

  _drawScreen() {
    const { g, tex, W, H } = this.screen;
    const s = this.state;
    g.fillStyle = '#05080d';
    g.fillRect(0, 0, W, H);
    // Map area.
    const mapH = H - 64;
    g.save();
    g.beginPath();
    g.rect(0, 40, W, mapH - 20);
    g.clip();
    g.fillStyle = '#081019';
    g.fillRect(0, 40, W, mapH);
    if (!s.gpsLost) {
      // Faint forest texture.
      g.fillStyle = 'rgba(40,80,60,0.18)';
      for (let i = 0; i < 70; i++) {
        const x = ((i * 97.3 + (this._mapScroll || 0) * 0.0) % W);
        const y = 40 + ((i * 53.7 + (this._mapScroll || 0)) % mapH);
        g.fillRect(x, y, 3, 3);
      }
      // Route: road ahead in car-relative coordinates (x right, y forward).
      if (s.route.length > 1) {
        const cx = W / 2;
        const cy = 40 + mapH - 50;
        const scale = 0.55;
        g.lineCap = 'round';
        g.lineJoin = 'round';
        g.strokeStyle = 'rgba(70,150,255,0.25)';
        g.lineWidth = 18;
        g.beginPath();
        s.route.forEach((p, i) => {
          const x = cx + p[0] * scale;
          const y = cy - p[1] * scale;
          if (i) g.lineTo(x, y); else g.moveTo(x, y);
        });
        g.stroke();
        g.strokeStyle = '#4da3ff';
        g.lineWidth = 7;
        g.stroke();
        // Car arrow.
        g.fillStyle = '#ffffff';
        g.beginPath();
        g.moveTo(cx, cy - 16);
        g.lineTo(cx + 11, cy + 12);
        g.lineTo(cx, cy + 6);
        g.lineTo(cx - 11, cy + 12);
        g.closePath();
        g.fill();
      }
    } else {
      g.fillStyle = '#6b7a8c';
      g.font = `600 26px ${FONT}`;
      g.textAlign = 'center';
      g.fillText('GPS SIGNAL LOST', W / 2, 40 + mapH / 2 - 10);
      g.font = `400 18px ${FONT}`;
      g.fillText('Searching for satellites…', W / 2, 40 + mapH / 2 + 22);
    }
    g.restore();
    // Top bar.
    g.fillStyle = '#0b121b';
    g.fillRect(0, 0, W, 40);
    g.fillStyle = '#cfe3ff';
    g.font = `600 22px ${MONO}`;
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText(s.clock, 16, 21);
    g.textAlign = 'right';
    g.font = `500 20px ${FONT}`;
    g.fillText(`${(s.temp * 9 / 5 + 32).toFixed(0)}°F`, W - 16, 21);
    // Bottom bar: destination & radio.
    g.fillStyle = '#0b121b';
    g.fillRect(0, H - 44, W, 44);
    g.textAlign = 'left';
    g.fillStyle = '#e8f1ff';
    g.font = `600 20px ${FONT}`;
    const dest = s.gpsLost ? 'HOLLOW PINES  —  ? mi' : `HOLLOW PINES  ${s.dest.toFixed(1)} mi`;
    g.fillText(dest, 16, H - 22);
    g.textAlign = 'right';
    g.fillStyle = '#8fb3d9';
    g.font = `500 17px ${FONT}`;
    g.fillText(s.radio, W - 16, H - 22);
    // Interference: horizontal tearing.
    if (s.glitch > 0.01) {
      for (let i = 0; i < 6; i++) {
        const y = Math.random() * H;
        const h = 4 + Math.random() * 18 * s.glitch;
        g.drawImage(this.screen.c, 0, y, W, h, (Math.random() - 0.5) * 60 * s.glitch, y, W, h);
      }
      g.fillStyle = `rgba(255,255,255,${0.08 * s.glitch})`;
      g.fillRect(0, 0, W, H);
    }
    tex.needsUpdate = true;
  }

  /** Called every frame; redraws canvases at a low rate. */
  update(dt, partial) {
    Object.assign(this.state, partial);
    this._odo = (this._odo || 0) + (this.state.speed * dt) / 1609;
    const s = this.state;
    const speedAngle = THREE.MathUtils.clamp((s.speed * 2.23694) / 140, 0, 1);
    const rpmAngle = THREE.MathUtils.clamp(s.rpm / 7000, 0, 1);
    const sweep = (t) => Math.PI * 0.75 + Math.PI * 1.5 * t;
    // Canvas angles run clockwise from +x; plane rotation is counter-clockwise from +y.
    this.needles[0].rotation.z = -(sweep(speedAngle) + Math.PI / 2);
    this.needles[1].rotation.z = -(sweep(rpmAngle) + Math.PI / 2);
    const b = this.brightness;
    this.clusterMat.emissiveIntensity = 2.2 * b;
    this.needleMat.emissiveIntensity = 5 * b;
    this.screenMat.emissiveIntensity = 1.15 * b;
    this.rearMat.emissiveIntensity = 1.4 * b;
    this._acc += dt;
    this._mapScroll = (this._mapScroll || 0) + s.speed * dt * 0.5;
    if (this._acc > (s.glitch > 0.01 ? 0.05 : 0.25)) {
      this._acc = 0;
      this._drawCluster();
      this._drawScreen();
    }
  }
}
