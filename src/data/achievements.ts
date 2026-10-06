import type { Achievement } from './types';

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-win', name: 'First Win', description: 'Survive your first trial.', tier: 'gold', icon: 'trophy' },
  { id: 'games-10', name: '10 Games', description: 'Enter ten trials.', tier: 'gold', icon: 'cards' },
  { id: 'speed-master', name: 'Speed Master', description: 'Average under 250 ms in a reaction trial.', tier: 'gold', icon: 'bolt' },
  { id: 'survivor', name: 'Survivor', description: 'Survive three trials in a row.', tier: 'emerald', icon: 'shield' },
  { id: 'full-house', name: 'Full House', description: 'Clear a trial in every suit.', tier: 'silver', icon: 'star' },
  { id: 'total-recall', name: 'Total Recall', description: 'Finish a memory trial without a single mistake.', tier: 'silver', icon: 'eye' },
  { id: 'mastermind', name: 'Mastermind', description: 'Answer every question in a logic trial correctly.', tier: 'silver', icon: 'brain' },
  { id: 'escape-artist', name: 'Escape Artist', description: 'Break out of an escape room on the first attempt.', tier: 'bronze', icon: 'key' },
  { id: 'the-kind-one', name: 'The Kind One', description: 'Reach an empathy rating of 10 across heart trials.', tier: 'crimson', icon: 'heart' },
  { id: 'explorer', name: 'Explorer', description: 'Reveal a hidden location on the map.', tier: 'emerald', icon: 'compass' },
  { id: 'spade-master', name: 'Spade Master', description: 'Clear every Spade trial.', tier: 'crimson', icon: 'spade' },
  { id: 'heart-master', name: 'Heart Master', description: 'Clear every Heart trial.', tier: 'crimson', icon: 'heart' },
  { id: 'diamond-master', name: 'Diamond Master', description: 'Clear every Diamond trial.', tier: 'crimson', icon: 'diamond' },
  { id: 'club-master', name: 'Club Master', description: 'Clear every Club trial.', tier: 'crimson', icon: 'club' },
  { id: 'iron-will', name: 'Iron Will', description: 'Survive a five-star trial.', tier: 'crimson', icon: 'flame' },
  { id: 'rising-star', name: 'Rising Star', description: 'Reach level 5.', tier: 'bronze', icon: 'star' },
  { id: 'borderline-legend', name: 'Legend', description: 'Reach level 10.', tier: 'gold', icon: 'crown' },
];

export function getAchievement(id: string) {
  return ACHIEVEMENTS.find((a) => a.id === id);
}
