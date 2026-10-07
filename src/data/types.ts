/*
 * Shared domain types. Everything that crosses a module boundary is typed here
 * so screens, games, services and state agree on one contract.
 */

export type SuitId = 'spade' | 'heart' | 'diamond' | 'club';

export type CardRank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export type Difficulty = 1 | 2 | 3 | 4 | 5;

export type GameType =
  | 'reaction' // ♠ tap the instant the signal fires
  | 'stamina' // ♠ rapid-tap to hold a meter above the kill line
  | 'choice' // ♥ branching moral dilemma
  | 'memory' // ♥ match card pairs from memory
  | 'numberOrder' // ♦ arrange numbers in order by swapping tiles
  | 'logic' // ♦ sequence / deduction questions
  | 'pattern' // ♣ repeat a growing signal sequence
  | 'escape'; // ♣ find clues, crack the keypad code

export interface Suit {
  id: SuitId;
  symbol: '♠' | '♥' | '♦' | '♣';
  name: string; // "Spade"
  category: string; // "Physical"
  categoryLong: string; // "Physical Challenges"
  short: string; // dashboard caption: "Physical"
  tagline: string;
  description: string;
  tone: 'silver' | 'red'; // card art palette
  games: GameType[];
}

/* ── Per-game configuration ───────────────────────────────────── */

export interface ReactionConfig {
  rounds: number;
  /** average reaction must be at or below this to survive */
  targetMs: number;
  /** min/max random delay before the signal fires */
  minDelayMs: number;
  maxDelayMs: number;
  /** decoy (fake) signals per run that must NOT be tapped */
  decoys: number;
}

export interface StaminaConfig {
  /** seconds the meter must be kept above the kill line */
  durationSec: number;
  /** meter drain per second (0..1 of full meter) */
  drainPerSec: number;
  /** meter gain per tap (0..1) */
  gainPerTap: number;
  /** meter level (0..1) under which you are eliminated */
  killLine: number;
}

export interface ChoiceOption {
  id: string;
  label: string; // "STAY AND HELP"
  hint: string; // "Risk your own survival."
  /** id of the next node, or null to end */
  next: string | null;
  /** -2..+2 moral weight; positive = empathy, negative = self-preservation */
  empathy: number;
  /** -2..+2 survival weight */
  survival: number;
  /** if present the trial ends immediately with this outcome */
  ends?: 'win' | 'loss';
  /** consequence text shown after picking */
  consequence: string;
}

export interface ChoiceNode {
  id: string;
  /** narrative shown above the options */
  text: string;
  /** optional speaker / location line */
  caption?: string;
  /** seconds to decide; when it runs out the default option is taken */
  decideSec: number;
  defaultOption: string;
  options: ChoiceOption[];
}

export interface ChoiceConfig {
  start: string;
  nodes: ChoiceNode[];
  /** total empathy+survival needed to survive the trial */
  surviveScore: number;
}

export interface MemoryConfig {
  pairs: number; // 4..10
  /** seconds all cards are shown face-up at the start */
  previewSec: number;
  /** wrong flips allowed before elimination */
  maxMistakes: number;
}

export interface NumberOrderConfig {
  /** grid size: 3 => 3x3 with numbers 1..9 */
  size: 3 | 4;
  /**
   * swaps allowed beyond the optimal (minimum) number of swaps for this
   * shuffle; null = unlimited. 0 means a perfect solve is required.
   */
  slackMoves: number | null;
  /** puzzle seed so a given challenge is always the same shuffle */
  seed: number;
}

export interface LogicQuestion {
  id: string;
  prompt: string;
  /** optional visual sequence e.g. ["2","4","8","?"] */
  sequence?: string[];
  options: string[];
  answer: number; // index into options
  explain: string;
}

export interface LogicConfig {
  questions: LogicQuestion[];
  /** correct answers needed to survive */
  passMark: number;
  /** seconds per question */
  perQuestionSec: number;
}

export interface PatternConfig {
  /** number of signal pads (4 or 6) */
  pads: 4 | 6;
  /** sequence length needed to survive */
  targetLength: number;
  /** ms each step is shown during playback (shrinks as length grows) */
  stepMs: number;
  /** wrong inputs allowed */
  lives: number;
}

export interface EscapeClue {
  id: string;
  /** where the clue is hidden in the room */
  spot: string;
  /** what the player reads when they inspect it */
  text: string;
  /** optional: which code digit position this clue informs */
  digit?: number;
}

export interface EscapeConfig {
  room: string; // "Maintenance Room B3"
  intro: string;
  /** the code that opens the door */
  code: string; // digits only, length 3..5
  clues: EscapeClue[];
  /** spots that contain nothing (red herrings) */
  decoySpots: string[];
  maxAttempts: number;
}

export type GameConfig =
  | { type: 'reaction'; reaction: ReactionConfig }
  | { type: 'stamina'; stamina: StaminaConfig }
  | { type: 'choice'; choice: ChoiceConfig }
  | { type: 'memory'; memory: MemoryConfig }
  | { type: 'numberOrder'; numberOrder: NumberOrderConfig }
  | { type: 'logic'; logic: LogicConfig }
  | { type: 'pattern'; pattern: PatternConfig }
  | { type: 'escape'; escape: EscapeConfig };

export interface Challenge {
  id: string; // "spade-3"
  suit: SuitId;
  rank: CardRank;
  title: string; // "Red Light Reflex"
  /** one-line hook under the title */
  hook: string;
  /** mission description / briefing (2–4 sentences) */
  briefing: string;
  rules: string[];
  difficulty: Difficulty;
  timeLimitSec: number;
  rewardPoints: number;
  rewardXp: number;
  rewardGems: number;
  players: string; // "1 - 4 Players"
  /** player level needed to attempt */
  unlockLevel: number;
  /** map zone where this trial takes place */
  zoneId: string;
  game: GameConfig;
  /** practice runs grant no points and never count as wins */
  practice?: boolean;
}

/* ── Results ──────────────────────────────────────────────────── */

export interface GameResult {
  outcome: 'win' | 'loss';
  /** 0..100 performance score; drives stars and bonus */
  score: number;
  /** one-line reason shown on the result screen, e.g. "Avg reaction 241 ms" */
  summary: string;
  /** game-specific numeric stats (bestReactionMs, mistakes, moves, empathy…) */
  stats?: Record<string, number>;
  /** the player quit mid-run — recorded as a loss with no participation XP */
  abandoned?: boolean;
}

export interface RewardSummary {
  outcome: 'win' | 'loss';
  stars: 0 | 1 | 2 | 3;
  points: number;
  xp: number;
  gems: number;
  leveledUp: boolean;
  newLevel: number;
  newAchievements: string[];
  firstClear: boolean;
}

/* ── Map ──────────────────────────────────────────────────────── */

export type ZoneStatus = 'locked' | 'available' | 'completed' | 'hidden';

export interface Zone {
  id: string;
  name: string;
  /** position on the map image in % of width/height */
  x: number;
  y: number;
  description: string;
  unlockLevel: number;
  /** hidden zones only appear after a map scan once the level is met */
  hidden?: boolean;
  /** challenge ids staged here */
  challengeIds: string[];
  /** bonus granted the first time a hidden zone is revealed */
  revealBonus?: number;
}

/* ── Achievements ─────────────────────────────────────────────── */

export type BadgeTier = 'gold' | 'silver' | 'bronze' | 'emerald' | 'crimson';

export type BadgeIcon =
  | 'trophy'
  | 'cards'
  | 'bolt'
  | 'shield'
  | 'crown'
  | 'eye'
  | 'brain'
  | 'key'
  | 'heart'
  | 'spade'
  | 'diamond'
  | 'club'
  | 'flame'
  | 'compass'
  | 'star';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  tier: BadgeTier;
  icon: BadgeIcon;
}

/* ── Player progress (persisted per account) ──────────────────── */

export interface ChallengeRecord {
  bestScore: number;
  stars: 0 | 1 | 2 | 3;
  attempts: number;
  wins: number;
  firstClearedAt?: number;
  lastPlayedAt: number;
}

export interface HistoryEntry {
  challengeId: string;
  outcome: 'win' | 'loss';
  score: number;
  points: number;
  at: number;
}

export interface PlayerProgress {
  version: 1;
  playerName: string;
  avatarId: number;
  xp: number; // lifetime XP
  points: number; // survival points (crown currency)
  gems: number;
  gamesPlayed: number;
  wins: number;
  streak: number;
  bestStreak: number;
  challenges: Record<string, ChallengeRecord>;
  achievements: Record<string, number>; // id -> unlockedAt
  revealedZones: string[];
  bests: {
    reactionMs?: number;
    memoryMistakesMin?: number;
    patternLength?: number;
    tapsPerSec?: number;
  };
  /** cumulative moral compass from heart trials */
  empathy: number;
  history: HistoryEntry[]; // newest first, capped
  createdAt: number;
  updatedAt: number;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  avatarId: number;
  points: number;
  level: number;
  wins: number;
  badges: string[]; // achievement ids to show
  isYou?: boolean;
  isFriend?: boolean;
  online?: boolean;
}
