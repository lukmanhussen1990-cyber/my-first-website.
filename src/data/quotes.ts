import type { DayKey } from '@/types';

export interface Quote {
  text: string;
  author?: string;
}

/** Original lines written for Last Mile — warm, hopeful, a little cinematic. */
export const quotes: readonly Quote[] = [
  { text: 'Discipline now gives you the freedom you’re waiting for.' },
  { text: 'Soon this struggle will be a beautiful memory.' },
  { text: 'A calm mind can achieve anything.' },
  { text: 'Good things are coming…' },
  { text: 'One final push before freedom.' },
  { text: 'Every page you turn is a step closer to home.' },
  { text: 'Somewhere, someone is already saving you a seat at the dinner table.' },
  { text: 'Small steps every day still cover the last mile.' },
  { text: 'You don’t have to be perfect. You just have to keep going.' },
  { text: 'Rest is part of the plan, not a break from it.' },
  { text: 'Tonight’s sleep is tomorrow’s sharpest memory.' },
  { text: 'The hardest chapters make the best stories later.' },
  { text: 'Breathe. You have done hard things before.' },
  { text: 'Focus on the next hour, not the whole mountain.' },
  { text: 'Your future self is cheering for you right now.' },
  { text: 'Progress is quiet. Keep showing up.' },
  { text: 'Home is waiting — and so is the person you’re becoming.' },
  { text: 'Tired is temporary. Proud lasts.' },
  { text: 'One more chapter, one less worry.' },
  { text: 'The road home is paved with tonight’s effort.' },
  { text: 'Consistency beats intensity when the finish line is this close.' },
  { text: 'Close the tabs. Open the book.' },
  { text: 'Calm is a skill. Practise it like any other subject.' },
  { text: 'You are closer than it feels.' },
  { text: 'Mistakes in practice are gifts on exam day.' },
  { text: 'Let tonight’s effort become tomorrow’s confidence.' },
  { text: 'The sunset after your last paper will be the best one yet.' },
  { text: 'Trust the hours you have already put in.' },
  { text: 'Your family is proud of the effort, not just the result.' },
  { text: 'Slow breath, clear head, steady hand.' },
  { text: 'Revise, then rest. Done beats perfect.' },
  { text: 'Every finished task is one more light switched on.' },
  { text: 'The journey home starts at this desk. Finish strong.' },
  { text: 'Discipline is just kindness to your future self, practised daily.' },
  { text: 'A full night’s sleep is the most underrated revision trick there is.' },
  { text: 'Courage is opening the topic you’ve been avoiding.' },
  { text: 'Soon the only alarm you set will be for breakfast at home.' },
  { text: 'Be gentle with yourself. You are doing more than you realise.' },
  { text: 'Ten focused minutes beat an hour of worrying.' },
  { text: 'The last mile is the shortest — and the sweetest.' },
  { text: 'Your desk lamp tonight is a lighthouse for tomorrow.' },
  { text: 'Stay with the question a little longer. Understanding is close.' },
  { text: 'When it feels heavy, remember who you’re carrying it for.' },
  { text: 'Water, a stretch, a deep breath — then back to it.' },
  { text: 'The finish line is a doorway, and home is on the other side.' },
  { text: 'Worry says “not enough time”. Focus says “one thing at a time”.' },
  { text: 'Freedom tastes sweeter when you’ve earned it.' },
  { text: 'The stars come out for night owls who finish what they start.' },
];

/** Steps through the list in a scattered order; must stay coprime with `quotes.length`. */
const STRIDE = 11;

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
const mod = (n: number, m: number) => ((n % m) + m) % m;

/** Days since the Unix epoch for a "YYYY-MM-DD" key, or NaN when malformed. */
function dayNumber(day: DayKey): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return Number.NaN;
  return Math.round(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86_400_000);
}

/** FNV-1a — fallback for malformed keys so they still map deterministically. */
function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * The quote for a local day — deterministic, and different on consecutive days
 * (the whole list cycles before any line repeats). `offset` picks neighbouring
 * quotes for secondary placements on the same day.
 */
export function quoteForDay(day: DayKey, offset = 0): Quote {
  const count = quotes.length;
  const stride = gcd(STRIDE, count) === 1 ? STRIDE : 1;
  const base = dayNumber(day);
  const seed = Number.isNaN(base) ? hashString(day) : base * stride;
  return quotes[mod(seed + offset, count)];
}
