// World layout (meters). Street runs along +X, camera side is +Z (diorama cut face).
export const LAYOUT = {
  laneA: 1.85,          // near lane (John + bus)
  laneB: -1.75,         // far lane
  roadNear: 3.7,        // near curb line
  roadFar: -3.6,        // far curb line
  curbH: 0.15,
  cutZ: 7.6,            // front cut face of the diorama slab
  frontage: -8.6,       // building line on the far side
  slabBottom: -40,
  xMin: -190,
  xMax: 840,
  zBack: -430,
  cross: [[36, 48], [112, 124], [186, 198], [260, 272], [334, 346], [408, 420], [482, 494], [556, 568], [630, 642]],
  plaza: { x0: 48, x1: 84, z0: -8.6, z1: -36 },
  tower: { x0: 84, x1: 106, z0: -10.6, z1: -30.6, h: 64 },
  helipad: { x0: 498, x1: 526, z0: -10.6, z1: -34.6, h: 16 },
  carwash: { x0: 648, x1: 678, zc: 0.05, halfW: 5.4, h: 6.2 },
  busX: 25.6, busLen: 11.6, busRoof: 3.22,
  jamEnd: 643,
};
