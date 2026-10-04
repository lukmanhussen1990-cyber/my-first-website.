import type { IconName } from '@/types';

export interface Tip {
  title: string;
  body: string;
  icon: IconName;
}

export const examStressTips: readonly Tip[] = [
  {
    title: 'Name it as energy',
    body: 'A racing heart before a paper is your body getting ready. Tell yourself “I’m excited” rather than “I’m panicking” — reframing the feeling improves performance.',
    icon: 'lightning-bolt',
  },
  {
    title: 'Write the worry down',
    body: 'Spend ten minutes before studying or the exam writing exactly what you’re anxious about. Getting it on paper frees up working memory for the questions.',
    icon: 'notebook-edit',
  },
  {
    title: 'Breathe out longer',
    body: 'Inhale for 4, exhale for 6 to 8. A long exhale slows your heart rate within a minute. Try the Breathing tab when your thoughts start to spin.',
    icon: 'lungs',
  },
  {
    title: 'Shrink the task',
    body: 'Overwhelm comes from looking at the whole syllabus. Pick one chapter, one question, one 25-minute block — and only that.',
    icon: 'format-list-checks',
  },
  {
    title: 'Move for ten minutes',
    body: 'A brisk walk or a few stretches between sessions lowers stress hormones and lifts focus for the next block.',
    icon: 'walk',
  },
  {
    title: 'Ground yourself: 5-4-3-2-1',
    body: 'Notice 5 things you see, 4 you can touch, 3 you hear, 2 you smell and 1 you taste. It pulls your attention out of the spiral and into the room.',
    icon: 'leaf',
  },
  {
    title: 'Prepare the night before',
    body: 'Pack your hall ticket, ID, pens and water bottle the evening before, and plan your route. Fewer decisions in the morning means a calmer start.',
    icon: 'bag-personal',
  },
  {
    title: 'Start with what you know',
    body: 'In the exam, read the paper once, then answer your strongest question first. Early wins build momentum and settle nerves.',
    icon: 'target',
  },
  {
    title: 'Skip the corridor quiz',
    body: 'Comparing answers or last-minute topics outside the hall mostly adds doubt. Put your earphones in and keep your own calm.',
    icon: 'account-voice',
  },
  {
    title: 'Talk to someone',
    body: 'A five-minute call home or a chat with a friend can reset a heavy day. You don’t have to carry exam stress alone.',
    icon: 'hand-heart',
  },
];

export const sleepTips: readonly Tip[] = [
  {
    title: 'Sleep is revision',
    body: 'Your brain replays and stores what you learned while you sleep. An all-nighter trades tomorrow’s recall for a few extra pages tonight.',
    icon: 'brain',
  },
  {
    title: 'Keep a fixed wake-up time',
    body: 'Wake at the same time every day, even after a late night. A steady rhythm makes falling asleep easier — and aligns you with exam-morning hours.',
    icon: 'alarm',
  },
  {
    title: 'Cut caffeine by early afternoon',
    body: 'Caffeine stays in your system for many hours. Make your last coffee or energy drink around 2 PM so it’s gone by bedtime.',
    icon: 'coffee-off',
  },
  {
    title: 'Screens off before bed',
    body: 'Put your phone away 30–60 minutes before sleep. Bright screens and endless scrolling keep your mind switched on.',
    icon: 'cellphone-off',
  },
  {
    title: 'Cool, dark and quiet',
    body: 'A slightly cool room, low light and little noise help you fall asleep faster and sleep more deeply. An eye mask or earplugs are cheap wins.',
    icon: 'weather-night',
  },
  {
    title: 'Nap short, nap early',
    body: 'A 15–20 minute nap before mid-afternoon restores alertness. Longer or later naps steal from your night’s sleep.',
    icon: 'timer-sand',
  },
  {
    title: 'Can’t sleep? Get up',
    body: 'If you’re still awake after about 20 minutes, get up and do something calm in dim light, then return when sleepy. Keep the bed for sleep.',
    icon: 'bed-clock',
  },
  {
    title: 'Wind down on purpose',
    body: 'A short routine — tidy the desk, write tomorrow’s first task, a warm shower, a few slow breaths — signals to your body that the day is done.',
    icon: 'sleep',
  },
];

export const studyTechniques: readonly Tip[] = [
  {
    title: 'Test yourself',
    body: 'Close the book and recall everything you can, then check. Retrieval practice beats re-reading for long-term memory by a wide margin.',
    icon: 'head-lightbulb',
  },
  {
    title: 'Space it out',
    body: 'Review a topic after a day, then a few days later. Spaced repetition makes memories stick far better than one long cram.',
    icon: 'calendar-clock',
  },
  {
    title: 'Mix it up',
    body: 'Interleave different problem types (e.g. joins, normalisation and indexing) in one session. It feels harder, and that’s why it works.',
    icon: 'shuffle-variant',
  },
  {
    title: 'Focus in sprints',
    body: 'Work for 25–50 minutes with your phone in another room, then take a 5–10 minute break. Protect the sprint, enjoy the break.',
    icon: 'timer-outline',
  },
  {
    title: 'Teach it simply',
    body: 'Explain a concept out loud as if to a friend who has never heard of it. Where you stumble is exactly what to revisit.',
    icon: 'human-greeting-variant',
  },
  {
    title: 'Practise past papers',
    body: 'Solve previous papers under timed conditions. You’ll learn the question patterns, your pacing and where marks are really won.',
    icon: 'file-document-edit',
  },
  {
    title: 'Draw it out',
    body: 'Turn processes into diagrams, flowcharts or tables. Pairing words with visuals gives your memory two ways back to the idea.',
    icon: 'draw',
  },
  {
    title: 'Ask “why?”',
    body: 'For every fact, ask why it is true and how it connects to what you already know. Elaborating builds understanding, not just recall.',
    icon: 'lightbulb-on',
  },
];

export type TipSectionKey = 'stress' | 'sleep' | 'study';

export interface TipSection {
  key: TipSectionKey;
  title: string;
  icon: IconName;
  tips: readonly Tip[];
}

export const tipSections: readonly TipSection[] = [
  { key: 'stress', title: 'Beat exam stress', icon: 'emoticon-happy-outline', tips: examStressTips },
  { key: 'sleep', title: 'Sleep better', icon: 'weather-night', tips: sleepTips },
  { key: 'study', title: 'Study smarter', icon: 'brain', tips: studyTechniques },
];
