import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { GameType } from '../data/types';
import type { GameProps } from './types';

/** Mini-game engines, code-split per game. */
export const GAMES: Record<GameType, LazyExoticComponent<ComponentType<GameProps>>> = {
  reaction: lazy(() => import('./ReactionGame')),
  stamina: lazy(() => import('./StaminaGame')),
  choice: lazy(() => import('./ChoiceGame')),
  memory: lazy(() => import('./MemoryGame')),
  numberOrder: lazy(() => import('./NumberOrderGame')),
  logic: lazy(() => import('./LogicGame')),
  pattern: lazy(() => import('./PatternGame')),
  escape: lazy(() => import('./EscapeGame')),
};

/** Warm every game chunk (called from the loading screen). */
export function preloadGames(): Promise<unknown> {
  return Promise.all([
    import('./ReactionGame'),
    import('./StaminaGame'),
    import('./ChoiceGame'),
    import('./MemoryGame'),
    import('./NumberOrderGame'),
    import('./LogicGame'),
    import('./PatternGame'),
    import('./EscapeGame'),
  ]);
}
