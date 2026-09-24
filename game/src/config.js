// Shared constants. Owner: Gameplay agent (others may read).

export const ARENA = { minX: -80, maxX: 80, minZ: -125, maxZ: 70 };
export const GATE = { x: 0, z: -125 };
export const PLAYER_START = { x: 0, z: 40, yaw: Math.PI };

export const QUALITY = {
  low: {
    name: 'low', pixelRatio: 0.85, shadows: false, shadowMapSize: 512,
    maxSoldiers: 90, particleScale: 0.45, drawDistance: 110, antialias: false,
  },
  medium: {
    name: 'medium', pixelRatio: 1.25, shadows: true, shadowMapSize: 1024,
    maxSoldiers: 150, particleScale: 0.75, drawDistance: 150, antialias: false,
  },
  high: {
    name: 'high', pixelRatio: 2, shadows: true, shadowMapSize: 2048,
    maxSoldiers: 240, particleScale: 1, drawDistance: 200, antialias: true,
  },
};

export function pickDefaultQuality() {
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) < 900);
  return mobile ? 'medium' : 'high';
}

// Palette shared by world / characters / fx so everything grades together.
export const PALETTE = {
  sunset: 0xffc58a,
  haze: 0xc9a58a,
  sand: 0xb8977a,
  sandDark: 0x6e5646,
  weiBlack: 0x1c1b20,
  weiRed: 0xb3202a,
  gold: 0xd9a933,
  heroWhite: 0xeef0ea,
  heroTeal: 0x2fc6b4,
  musouCyan: 0x8fe8ff,
};
