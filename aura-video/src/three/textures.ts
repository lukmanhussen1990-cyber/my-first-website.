import * as THREE from 'three';

/** Canvas-drawn text textures. Fonts are loaded (delayRender) before the canvas mounts. */
export const makeSignTexture = (
  text: string,
  fg: string,
  bg: string,
  family: string,
  weight: number,
  glow?: string
) => {
  const c = document.createElement('canvas');
  c.width = 2048;
  c.height = 352;
  const g = c.getContext('2d')!;
  g.fillStyle = bg;
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = glow ?? fg;
  g.globalAlpha = 0.5;
  g.lineWidth = 10;
  g.strokeRect(26, 26, c.width - 52, c.height - 52);
  g.globalAlpha = 1;
  let size = 210;
  g.font = `${weight} ${size}px ${family}`;
  while (g.measureText(text).width > c.width - 220 && size > 40) {
    size -= 6;
    g.font = `${weight} ${size}px ${family}`;
  }
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (glow) {
    g.shadowColor = glow;
    g.shadowBlur = 50;
  }
  g.fillStyle = fg;
  (g as any).letterSpacing = '12px';
  g.fillText(text, c.width / 2, c.height / 2 + 10);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
};

export const makeBusTexture = () => {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 160;
  const g = c.getContext('2d')!;
  g.fillStyle = '#1b1b1b';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#f2b81d';
  g.font = `800 110px Poppins`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('SCHOOL BUS', c.width / 2, c.height / 2 + 6);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

/** Studio video-wall picture: night town with a golden beam. */
export const makeNewsWallTexture = () => {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 640;
  const g = c.getContext('2d')!;
  const sky = g.createLinearGradient(0, 0, 0, 640);
  sky.addColorStop(0, '#0b1230');
  sky.addColorStop(0.7, '#2b2a5a');
  sky.addColorStop(1, '#5a3b52');
  g.fillStyle = sky;
  g.fillRect(0, 0, 1024, 640);
  // beam
  const bx = 600;
  const beam = g.createLinearGradient(bx - 60, 0, bx + 60, 0);
  beam.addColorStop(0, 'rgba(255,200,90,0)');
  beam.addColorStop(0.5, 'rgba(255,240,190,1)');
  beam.addColorStop(1, 'rgba(255,200,90,0)');
  g.fillStyle = beam;
  g.fillRect(bx - 60, 0, 120, 520);
  const glow = g.createRadialGradient(bx, 500, 10, bx, 500, 260);
  glow.addColorStop(0, 'rgba(255,220,140,0.95)');
  glow.addColorStop(1, 'rgba(255,160,60,0)');
  g.fillStyle = glow;
  g.fillRect(0, 200, 1024, 440);
  // skyline
  g.fillStyle = '#090c1c';
  let x = 0;
  let s = 3;
  while (x < 1024) {
    s = (s * 9301 + 49297) % 233280;
    const w = 40 + (s % 70);
    const h = 90 + (s % 170);
    g.fillRect(x, 640 - h, w, h);
    g.fillStyle = 'rgba(255,210,140,0.75)';
    for (let wy = 640 - h + 14; wy < 620; wy += 22) for (let wx = x + 8; wx < x + w - 8; wx += 16) if ((wx * 7 + wy * 3 + s) % 5 < 2) g.fillRect(wx, wy, 6, 9);
    g.fillStyle = '#090c1c';
    x += w + 4;
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

/** soft radial glow sprite */
export const makeGlowTexture = () => {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  return t;
};
