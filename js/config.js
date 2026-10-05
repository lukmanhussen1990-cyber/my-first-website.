// Shared constants: car layout (used by both the interior meshes and the
// post-process glass/fog shaders), road dimensions and quality presets.

// Car-local frame: origin on the ground at the car's centre, -Z forward, +X right, +Y up.
export const CAR = {
  wheelbase: 2.8,
  halfWidth: 0.92,
  // Player eye (rear seat, slightly right of centre) and how far they can lean.
  eye: { x: 0.2, y: 1.2, z: 0.93 },
  lean: { xMin: -0.42, xMax: 0.3, zMin: -0.22, zMax: 0.06 },
  headlights: [
    { x: -0.62, y: 0.7, z: -2.36 },
    { x: 0.62, y: 0.7, z: -2.36 },
  ],
  // Air inside the cabin is never foggy: the volumetric march starts where a
  // view ray leaves this box.
  // Wipers pivot just below the windshield and sweep counter-clockwise (seen from
  // inside) from parked (pointing right, angle 0) up toward the left A-pillar.
  // Angles are measured in the glass plane from +X toward "up the glass".
  wipers: [
    { pivot: [-0.52, 0.95, -1.09], length: 0.6, max: 1.83 },
    { pivot: [0.12, 0.95, -1.09], length: 0.55, max: 1.83 },
  ],
  cabinMin: [-0.88, 0.15, -1.1],
  cabinMax: [0.88, 1.42, 1.66],
  // Glass panes as convex quads, corners listed in order around the edge, starting
  // with the bottom edge. The pane's local axes are a = c0->c1 and b = up the glass;
  // flow is the direction raindrops creep along (a, b) when the car is moving.
  panes: {
    windshield: {
      corners: [[0.71, 0.96, -1.07], [-0.71, 0.96, -1.07], [-0.6, 1.37, -0.37], [0.6, 1.37, -0.37]],
      flow: [0, 1],
      wipers: true,
    },
    frontLeft: {
      corners: [[-0.87, 0.98, -0.07], [-0.87, 0.98, -0.93], [-0.77, 1.33, -0.43], [-0.77, 1.33, -0.07]],
      flow: [-1, -0.1],
    },
    frontRight: {
      corners: [[0.87, 0.98, -0.93], [0.87, 0.98, -0.07], [0.77, 1.33, -0.07], [0.77, 1.33, -0.43]],
      flow: [1, -0.1],
    },
    rearLeft: {
      corners: [[-0.87, 0.98, 0.95], [-0.87, 0.98, 0.05], [-0.77, 1.33, 0.05], [-0.77, 1.33, 0.7]],
      flow: [-1, -0.1],
    },
    rearRight: {
      corners: [[0.87, 0.98, 0.05], [0.87, 0.98, 0.95], [0.77, 1.33, 0.7], [0.77, 1.33, 0.05]],
      flow: [1, -0.1],
    },
    rear: {
      corners: [[-0.62, 1.0, 1.63], [0.62, 1.0, 1.63], [0.55, 1.36, 1.1], [-0.55, 1.36, 1.1]],
      flow: [0, -1],
    },
  },
};

export const ROAD = {
  ds: 2, // metres between centreline samples
  laneWidth: 3.5,
  asphaltHalf: 4.6,
  ribbonHalf: 6.0,
  stripMax: 70, // terrain extends this far from the centreline
  chunkLength: 120,
  aheadChunks: 5,
  behindChunks: 2,
};

export const QUALITY = {
  low: {
    label: 'Low',
    pixelRatio: 0.75,
    msaa: 0,
    moonShadow: 0,
    headShadow: 512,
    streetShadow: 0,
    fogScale: 0.25,
    fogSteps: 12,
    fogShadows: false,
    reflection: 0,
    mirror: false,
    dof: false,
    bloomLevels: 4,
    trees: 0.55,
    rain: 2500,
    grass: 0.35,
  },
  medium: {
    label: 'Medium',
    pixelRatio: 1,
    msaa: 4,
    moonShadow: 1024,
    headShadow: 1024,
    streetShadow: 512,
    fogScale: 0.34,
    fogSteps: 18,
    fogShadows: true,
    reflection: 0.25,
    mirror: true,
    dof: true,
    bloomLevels: 5,
    trees: 0.8,
    rain: 5000,
    grass: 0.7,
  },
  high: {
    label: 'High',
    pixelRatio: 1.25,
    msaa: 4,
    moonShadow: 2048,
    headShadow: 1024,
    streetShadow: 1024,
    fogScale: 0.5,
    fogSteps: 24,
    fogShadows: true,
    reflection: 0.5,
    mirror: true,
    dof: true,
    bloomLevels: 6,
    trees: 1,
    rain: 8000,
    grass: 1,
  },
};

// Render layers.
export const LAYER = {
  DEFAULT: 0,
  INTERIOR: 1, // the car cabin (hidden from the road reflection)
  NO_REFLECT: 2, // exterior things skipped by the road reflection (the road itself, rain)
  MIRROR_ONLY: 3, // only visible in the rear-view mirror (the player's own body silhouette)
};
