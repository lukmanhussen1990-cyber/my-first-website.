import { accents, gradients, type Gradient } from '@/theme/colors';
import type { AchievementId, IconName } from '@/types';

export interface AchievementDef {
  id: AchievementId;
  title: string;
  description: string;
  icon: IconName;
  gradient: Gradient;
  /** How to earn it, shown on locked badges ("Complete 3 breathing sessions"). */
  hint: string;
}

/** Thresholds behind each badge — shared by `evaluateAchievements` and progress UI. */
export const ACHIEVEMENT_RULES = {
  shortStreakDays: 3,
  longStreakDays: 7,
  chaptersDone: 10,
  preparedRatio: 0.8,
  breathingSessions: 3,
  aiQuestions: 5,
  memories: 3,
  packedMinItems: 5,
} as const;

const R = ACHIEVEMENT_RULES;

/** Display order on the achievements screen: the student's journey, start to finish. */
export const achievementDefs: readonly AchievementDef[] = [
  {
    id: 'first-step',
    title: 'First Step',
    description: 'You ticked off your first study task. The last mile has begun.',
    icon: 'shoe-print',
    gradient: gradients.success,
    hint: 'Complete your first study task',
  },
  {
    id: 'streak-3',
    title: 'On a Roll',
    description: 'Three days of study in a row. Momentum is on your side.',
    icon: 'fire',
    gradient: gradients.sunset,
    hint: `Study ${R.shortStreakDays} days in a row`,
  },
  {
    id: 'streak-7',
    title: 'Unstoppable',
    description: 'A full week without missing a day. That is real discipline.',
    icon: 'fire-circle',
    gradient: gradients.gold,
    hint: `Study ${R.longStreakDays} days in a row`,
  },
  {
    id: 'chapter-10',
    title: 'Chapter Chaser',
    description: 'Ten chapters done and dusted.',
    icon: 'book-check',
    gradient: gradients.primary,
    hint: `Finish ${R.chaptersDone} chapters`,
  },
  {
    id: 'subject-master',
    title: 'Subject Master',
    description: 'Every chapter of a subject complete. Walk in with confidence.',
    icon: 'school',
    gradient: accents.indigo.gradient,
    hint: 'Complete every chapter of one subject',
  },
  {
    id: 'prepared-80',
    title: 'Almost Ready',
    description: 'Eighty percent of your syllabus covered. The finish line is in sight.',
    icon: 'progress-check',
    gradient: gradients.aurora,
    hint: `Reach ${Math.round(R.preparedRatio * 100)}% overall preparation`,
  },
  {
    id: 'zen-mode',
    title: 'Zen Mode',
    description: 'Three calm breathing sessions. A steady mind is a sharp mind.',
    icon: 'meditation',
    gradient: accents.cyan.gradient,
    hint: `Complete ${R.breathingSessions} breathing sessions`,
  },
  {
    id: 'ai-curious',
    title: 'Curious Mind',
    description: 'Five questions for your study buddy. Curiosity pays off.',
    icon: 'robot-happy',
    gradient: gradients.violet,
    hint: `Ask the study buddy ${R.aiQuestions} questions`,
  },
  {
    id: 'memory-keeper',
    title: 'Memory Keeper',
    description: 'Three memories saved. One day you will smile reading these.',
    icon: 'book-heart',
    gradient: accents.pink.gradient,
    hint: `Save ${R.memories} memories in your journal`,
  },
  {
    id: 'time-capsule',
    title: 'Time Traveller',
    description: 'A letter sealed for your future self. See you on the other side.',
    icon: 'email-lock',
    gradient: accents.purple.gradient,
    hint: 'Seal a letter to Future Me',
  },
  {
    id: 'packed',
    title: 'Packed & Ready',
    description: 'Every item on your travel checklist is ticked. Bag by the door.',
    icon: 'bag-suitcase',
    gradient: accents.orange.gradient,
    hint: `Check off every travel item (at least ${R.packedMinItems})`,
  },
  {
    id: 'exam-conqueror',
    title: 'Exam Conqueror',
    description: 'The final exam is done. You did it!',
    icon: 'trophy',
    gradient: gradients.gold,
    hint: 'Mark your final exam as finished',
  },
  {
    id: 'homebound',
    title: 'Homebound',
    description: 'The last mile is behind you. Welcome home.',
    icon: 'home-heart',
    gradient: gradients.sunset,
    hint: 'Make the journey home after your exams',
  },
];

export const achievementById = Object.fromEntries(
  achievementDefs.map((def) => [def.id, def]),
) as Record<AchievementId, AchievementDef>;
