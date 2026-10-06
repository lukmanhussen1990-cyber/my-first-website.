import type { Zone } from './types';

/**
 * Map locations. x / y are percentages over the map artwork
 * (src/assets/art/map-city.webp, 3:4 portrait). Hidden zones are only
 * plotted after a successful map scan.
 */
export const ZONES: Zone[] = [
  {
    id: 'crossing',
    name: 'Crimson Crossing',
    x: 50,
    y: 60,
    description: 'The great scramble crossing where every player wakes up. The beacons still work.',
    unlockLevel: 1,
    challengeIds: ['spade-3', 'diamond-3'],
  },
  {
    id: 'mall',
    name: 'Shopping District',
    x: 27,
    y: 50,
    description: 'Glass arcades and frozen escalators. The dealer keeps a table on the third floor.',
    unlockLevel: 1,
    challengeIds: ['heart-3', 'club-3'],
  },
  {
    id: 'underpass',
    name: 'Underpass',
    x: 70,
    y: 72,
    description: 'A flooded road tunnel lit by one stubborn terminal.',
    unlockLevel: 2,
    challengeIds: ['spade-6', 'diamond-6'],
  },
  {
    id: 'ferris',
    name: 'Ferris Wheel',
    x: 74,
    y: 41,
    description: 'An amusement park nobody has laughed in for a long time. The wheel still turns at night.',
    unlockLevel: 2,
    challengeIds: ['heart-6', 'club-6'],
  },
  {
    id: 'rooftop',
    name: 'Rooftop',
    x: 38,
    y: 30,
    description: 'Antenna farms and exposed cable forty floors above the street.',
    unlockLevel: 3,
    challengeIds: ['spade-9', 'diamond-9'],
  },
  {
    id: 'metro',
    name: 'Underground',
    x: 22,
    y: 78,
    description: 'Dead metro platforms. The relay room still hums.',
    unlockLevel: 3,
    challengeIds: ['heart-9', 'club-9'],
  },
  {
    id: 'hospital',
    name: 'Silent Ward',
    x: 82,
    y: 58,
    description: 'A hospital with every light on and no one inside.',
    unlockLevel: 5,
    challengeIds: ['heart-Q'],
  },
  {
    id: 'arena',
    name: 'Dead Arena',
    x: 60,
    y: 19,
    description: 'A stadium with half a roof. The crowd noise plays on a loop.',
    unlockLevel: 5,
    challengeIds: ['spade-Q', 'club-Q'],
  },
  {
    id: 'spire',
    name: 'The Spire',
    x: 47,
    y: 8,
    description: 'The tallest tower in the city. Whoever built the games is closest here.',
    unlockLevel: 7,
    challengeIds: ['spade-K', 'heart-K', 'diamond-K'],
  },
  {
    id: 'vault',
    name: 'The Vault',
    x: 14,
    y: 33,
    description: 'A bank vault beneath a collapsed tower. Someone left the radio running.',
    unlockLevel: 3,
    hidden: true,
    revealBonus: 300,
    challengeIds: ['diamond-Q'],
  },
  {
    id: 'signal',
    name: 'Signal Station',
    x: 87,
    y: 22,
    description: 'An unmarked transmitter on the harbour cliffs. It is still broadcasting.',
    unlockLevel: 6,
    hidden: true,
    revealBonus: 500,
    challengeIds: ['club-K'],
  },
];

export function getZone(id: string | undefined): Zone | undefined {
  return ZONES.find((z) => z.id === id);
}
