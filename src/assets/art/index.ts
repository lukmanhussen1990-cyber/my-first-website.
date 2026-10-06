/*
 * Artwork registry. Every image here is original, rendered procedurally by the
 * generators in /tools/art (run `npm run art`). Import URLs from this module
 * rather than referencing files directly so Vite fingerprints and caches them.
 */
import type { SuitId } from '../../data/types';

import loadingHero from './loading-hero.webp';
import welcomeCity from './welcome-city.webp';
import bannerFerris from './banner-ferris.webp';
import mapCity from './map-city.webp';
import sceneHeart from './scene-heart.webp';
import sceneSpade from './scene-spade.webp';
import sceneDiamond from './scene-diamond.webp';
import sceneClub from './scene-club.webp';
import cardSpade from './card-spade.webp';
import cardHeart from './card-heart.webp';
import cardDiamond from './card-diamond.webp';
import cardClub from './card-club.webp';
import cardBack from './card-back.webp';
import noise from './noise.png';

export const ART = {
  loadingHero,
  welcomeCity,
  bannerFerris,
  mapCity,
  sceneHeart,
  sceneSpade,
  sceneDiamond,
  sceneClub,
  cardSpade,
  cardHeart,
  cardDiamond,
  cardClub,
  cardBack,
  noise,
};

/** Full-bleed card face artwork per suit (no text — UI is layered in HTML). */
export const SUIT_CARD_ART: Record<SuitId, string> = {
  spade: cardSpade,
  heart: cardHeart,
  diamond: cardDiamond,
  club: cardClub,
};

/** Cinematic scene per suit, used as challenge / trial backdrops. */
export const SUIT_SCENE: Record<SuitId, string> = {
  spade: sceneSpade,
  heart: sceneHeart,
  diamond: sceneDiamond,
  club: sceneClub,
};

const avatarModules = import.meta.glob<string>('./avatar-*.webp', { eager: true, import: 'default' });

/** 12 original character portraits, index = avatarId. */
export const AVATARS: string[] = Object.keys(avatarModules)
  .sort()
  .map((k) => avatarModules[k]);

export const AVATAR_NAMES = [
  'The Drifter',
  'The Medic',
  'The Runner',
  'The Hacker',
  'The Soldier',
  'The Student',
  'The Gambler',
  'The Climber',
  'The Engineer',
  'The Idol',
  'The Detective',
  'The Stray',
];

export function avatarUrl(id: number): string {
  return AVATARS[((id % AVATARS.length) + AVATARS.length) % AVATARS.length];
}

/** Images worth warming up during the loading screen. */
export const PRELOAD = [loadingHero, welcomeCity, bannerFerris, cardSpade, cardHeart, cardDiamond, cardClub, cardBack];
