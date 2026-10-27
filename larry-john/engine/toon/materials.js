// Soft matte "clay / vinyl toy" materials, shared and cached by colour.
import * as THREE from 'three';

const cache = new Map();

// Clay: matte with a soft broad highlight.
export function clay(color, opts = {}) {
  const key = `clay${color}${JSON.stringify(opts)}`;
  if (opts.unique || !cache.has(key)) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0, ...stripOpts(opts) });
    if (opts.unique) return m;
    cache.set(key, m);
  }
  return cache.get(key);
}

// Cloth: like clay but rougher, with a velvet-like sheen at grazing angles.
export function cloth(color, opts = {}) {
  const key = `cloth${color}${JSON.stringify(opts)}`;
  if (opts.unique || !cache.has(key)) {
    const m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.85, metalness: 0, sheen: 0.6, sheenRoughness: 0.6,
      sheenColor: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.5), ...stripOpts(opts) });
    if (opts.unique) return m;
    cache.set(key, m);
  }
  return cache.get(key);
}

// Glowing material (lamps, windows, moon, jack-o'-lantern faces). Bright enough to bloom.
export function glow(color, intensity = 2.5, opts = {}) {
  const key = `glow${color}${intensity}${JSON.stringify(opts)}`;
  if (opts.unique || !cache.has(key)) {
    const m = new THREE.MeshStandardMaterial({ color: '#000000', emissive: color, emissiveIntensity: intensity, roughness: 1, ...stripOpts(opts) });
    if (opts.unique) return m;
    cache.set(key, m);
  }
  return cache.get(key);
}

export function shiny(color, opts = {}) {
  return clay(color, { roughness: 0.35, metalness: 0.0, ...opts });
}
export function metal(color, opts = {}) {
  return clay(color, { roughness: 0.4, metalness: 0.85, ...opts });
}

function stripOpts(o) { const { unique, ...rest } = o; return rest; }

// Palette shared by every Larry & John reel.
export const PAL = {
  skin: '#f4c39f', skinShade: '#e4a882', skinTan: '#d99a72',
  larryHair: '#f07a1c', larryShirt: '#ffd23a', larryShorts: '#8a5a33', sock: '#fbfbf6', sandal: '#7a4a28',
  johnHair: '#6b3f22', hoodie: '#e2383a', jeans: '#3f68a8', shoe: '#f2f2f2', shoeAccent: '#3b7dd8', toolBelt: '#f2b531',
  sheet: '#f6f4f1', ghost: '#cfe9ff',
  lawnLight: '#86c95a', lawnDark: '#5fae43', stone: '#cfd1cf', fence: '#f7f5ee', roofRed: '#d9573b',
  houseBeige: '#e9d8b4', shutterBlue: '#4a74b8', wood: '#a8774c', woodDark: '#7a5233',
};
