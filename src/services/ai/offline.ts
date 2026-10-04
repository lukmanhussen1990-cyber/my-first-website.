/**
 * On-device study buddy used when no cloud proxy is configured (or it fails).
 *
 * Everything here is deterministic and works from the student's own data —
 * their plan (`StudyContext`) and the notes they paste. It never pretends to
 * "know" a topic: explanations are study scaffolds, summaries are extractive and
 * quizzes are built from the student's own sentences.
 */
import type { AssistantMode, AssistantReply, ChatMessage, DayKey, MCQ, StudyContext } from '@/types';
import { addDays, calendarDaysBetween, formatDayLabel, fromDayKey, parseIso, startOfDay, toDayKey } from '@/utils/date';

/* ------------------------------------------------------------------ */
/* Text analysis                                                       */
/* ------------------------------------------------------------------ */

const STOP_WORDS = new Set(
  (
    "a about above according across actually after again against all almost along already also although always am among an and another any anybody anyone anything anyway anywhere are aren't around as at away be became because become becomes been before being below beside besides between beyond both but by can can't cannot could couldn't did didn't do does doesn't doing don't done down during each either else enough especially even ever every everyone everything few for from further get gets getting give given gives go goes going gone got had hadn't has hasn't have haven't having he he's her here here's hers herself him himself his how however i i'm i've if in inside instead into is isn't it it's its itself just least less let let's like likely made mainly make makes making many may maybe me might mine more moreover most mostly much must my myself near nearly need needs neither never nevertheless next no nobody none nor not nothing now of off often on once one ones only onto or other others otherwise ought our ours ourselves out outside over own per perhaps put quite rather really same see seen seem seems several shall she she's should shouldn't since so some somebody someone something sometimes somewhat still such than that that's the their theirs them themselves then there there's therefore these they they're thing things this those though through throughout thus to together too toward towards under unless until up upon us use used uses using usually various very via was wasn't way ways we we're well were weren't what what's whatever when whenever where whereas wherever whether which while who who's whom whose why will with within without won't would wouldn't yet you you're your yours yourself yourselves " +
    // Words that structure study notes rather than carry their meaning.
    'called known refer refers referred define defined defines definition mean means meaning example examples e.g i.e eg ie vs etc include includes including important main different type types kind kinds part parts number numbers first second third fourth fifth two three four five six seven eight nine ten new old good best better following follow follows each certain particular'
  ).split(/\s+/),
);

/** A word: letters/digits containing at least one letter ("1NF", "TCP", "read-heavy", "don't"). */
const WORD_RE = /[0-9]*[A-Za-z][A-Za-z0-9]*(?:['’-][A-Za-z0-9]+)*/g;
const DEFINITION_RE =
  /\b(?:is|are)\s+(?:a|an|the|defined|called|known|used)\b|\brefers?\s+to\b|\bmeans\b|\bdenotes\b|\bstands\s+for\b/i;
const BULLET_RE = /^(?:[-*•▪◦‣–—>]|\d{1,2}[.)]|[a-z][.)]|\(\w{1,2}\))\s+/i;
const ABBREVIATIONS = new Set(['e.g', 'i.e', 'etc', 'vs', 'mr', 'mrs', 'ms', 'dr', 'prof', 'fig', 'eq', 'no', 'approx', 'cf', 'al', 'inc', 'ltd', 'st', 'jr', 'sr']);

interface Token {
  word: string;
  norm: string;
  stem: string;
  content: boolean;
  /** Only whitespace separates this token from the previous one (no punctuation) — phrases can span it. */
  joined: boolean;
}

interface TermInfo {
  stem: string;
  count: number;
  firstIndex: number;
  forms: Map<string, number>;
}

interface TermStats {
  terms: Map<string, TermInfo>;
  bigrams: Map<string, TermInfo>;
  maxCount: number;
}

function normalise(word: string): string {
  return word.toLowerCase().replace(/’/g, "'").replace(/'s$/, '');
}

/** Tiny suffix stripper so "databases"/"database" and "queries"/"query" count as one term. */
function stem(word: string): string {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && /(?:sses|xes|zes|ches|shes)$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !/(?:ss|us|is)$/.test(word)) return word.slice(0, -1);
  return word;
}

const isAcronym = (word: string) => word.length >= 2 && word === word.toUpperCase() && /[A-Z]/.test(word);

function tokenize(sentence: string): Token[] {
  const tokens: Token[] = [];
  let previousEnd = -1;
  for (const match of sentence.matchAll(WORD_RE)) {
    const word = match[0];
    const start = match.index ?? 0;
    const norm = normalise(word);
    const content = !STOP_WORDS.has(norm) && (norm.length >= 3 || (norm.length === 2 && isAcronym(word)));
    const joined = previousEnd >= 0 && /^\s+$/.test(sentence.slice(previousEnd, start));
    tokens.push({ word, norm, stem: stem(norm), content, joined });
    previousEnd = start + word.length;
  }
  return tokens;
}

function wordCount(text: string): number {
  return (text.match(WORD_RE) ?? []).length;
}

/** Splits one paragraph into sentences without breaking on "e.g.", initials or decimals. */
function splitParagraph(paragraph: string): string[] {
  const text = paragraph.replace(/\s+/g, ' ').trim();
  const parts: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch !== '.' && ch !== '!' && ch !== '?') continue;
    let end = i + 1;
    while (end < text.length && /[.!?"'”’)\]]/.test(text[end])) end++;
    if (end >= text.length || text[end] !== ' ') continue;
    const next = text[end + 1] ?? '';
    if (!/[A-Z0-9"“'‘(\[]/.test(next)) continue;
    if (ch === '.') {
      const word = text
        .slice(text.lastIndexOf(' ', i - 1) + 1, i)
        .replace(/^[("'“‘[]+/, '')
        .toLowerCase();
      if (ABBREVIATIONS.has(word) || /^[a-z]$/.test(word)) continue;
    }
    parts.push(text.slice(start, end).trim());
    start = end + 1;
    i = end;
  }
  const tail = text.slice(start).trim();
  if (tail) parts.push(tail);
  return parts;
}

/**
 * Robust sentence splitter for pasted study notes: handles bullet / numbered
 * lines, short headings, hard-wrapped lines and common abbreviations.
 */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) out.push(...splitParagraph(paragraph.join(' ')));
    paragraph = [];
  };

  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (!line) {
      flush();
      return;
    }
    const bullet = BULLET_RE.exec(line);
    if (bullet) {
      flush();
      out.push(...splitParagraph(line.slice(bullet[0].length)));
      return;
    }
    // A short unpunctuated line followed by a new sentence (not a lower-case continuation) is a heading.
    const previous = paragraph[paragraph.length - 1];
    const next = lines[index + 1]?.trim() ?? '';
    const startsBlock = previous === undefined || /[.!?:;]["'”’)]?$/.test(previous);
    const looksLikeHeading =
      wordCount(line) <= 6 && !/[.!?;,]$/.test(line) && /^[A-Z0-9]/.test(line) && !/^[a-z]/.test(next);
    if (startsBlock && looksLikeHeading) {
      flush();
      out.push(line.replace(/:$/, ''));
      return;
    }
    paragraph.push(line);
  });
  flush();
  return out.map((sentence) => sentence.trim()).filter((sentence) => wordCount(sentence) >= 3);
}

function bump(map: Map<string, TermInfo>, key: string, form: string, index: number) {
  const info = map.get(key) ?? { stem: key, count: 0, firstIndex: index, forms: new Map<string, number>() };
  info.count += 1;
  info.forms.set(form, (info.forms.get(form) ?? 0) + 1);
  map.set(key, info);
}

/** Surface form for display: sentence-initial capitals are lowered, acronyms/proper nouns kept. */
function surfaceForm(token: Token, position: number): string {
  if (isAcronym(token.word)) return token.word;
  if (position === 0 && /^[A-Z][a-z]/.test(token.word)) return token.word.toLowerCase();
  return token.word;
}

function displayForm(info: TermInfo): string {
  let best = '';
  let bestCount = 0;
  for (const [form, count] of info.forms) {
    if (count > bestCount) {
      best = form;
      bestCount = count;
    }
  }
  return best;
}

function analyse(tokenized: Token[][]): TermStats {
  const terms = new Map<string, TermInfo>();
  const bigrams = new Map<string, TermInfo>();
  let position = 0;
  tokenized.forEach((tokens) => {
    tokens.forEach((token, i) => {
      position += 1;
      if (!token.content) return;
      bump(terms, token.stem, surfaceForm(token, i), position);
      const next = tokens[i + 1];
      if (next?.content && next.joined) {
        bump(bigrams, `${token.stem} ${next.stem}`, `${surfaceForm(token, i)} ${surfaceForm(next, i + 1)}`, position);
      }
    });
  });
  let maxCount = 1;
  for (const info of terms.values()) maxCount = Math.max(maxCount, info.count);
  return { terms, bigrams, maxCount };
}

function termScore(info: TermInfo): number {
  // Frequency first; longer (more specific) words win ties.
  return info.count + Math.min(info.stem.length, 12) / 24;
}

function topKeyTerms(stats: TermStats, limit: number): string[] {
  const candidates = [
    ...[...stats.bigrams.values()]
      .filter((info) => info.count >= 2)
      .map((info) => ({ info, label: displayForm(info), parts: info.stem.split(' '), score: info.count * 1.6 })),
    ...[...stats.terms.values()].map((info) => ({ info, label: displayForm(info), parts: [info.stem], score: termScore(info) })),
  ].sort((a, b) => b.score - a.score || a.info.firstIndex - b.info.firstIndex);

  const picked: string[] = [];
  const seen = new Set<string>();
  const coveredBy = new Map<string, number>();
  for (const candidate of candidates) {
    if (picked.length >= limit) break;
    const key = candidate.label.toLowerCase();
    if (seen.has(key)) continue;
    // Skip a word that mostly appears inside an already-picked phrase ("key" after "primary key").
    if (candidate.parts.length === 1 && (coveredBy.get(candidate.info.stem) ?? 0) >= candidate.info.count * 0.6) continue;
    seen.add(key);
    picked.push(candidate.label);
    if (candidate.parts.length > 1) {
      for (const part of candidate.parts) coveredBy.set(part, Math.max(coveredBy.get(part) ?? 0, candidate.info.count));
    }
  }
  return picked;
}

function sentenceScore(sentence: string, tokens: Token[], index: number, stats: TermStats): number {
  const content = tokens.filter((token) => token.content);
  if (!content.length) return 0;
  const total = content.reduce((sum, token) => sum + (stats.terms.get(token.stem)?.count ?? 0) / stats.maxCount, 0);
  let score = total / Math.sqrt(content.length);
  if (index === 0) score *= 1.15;
  if (/\d/.test(sentence)) score *= 1.1;
  if (DEFINITION_RE.test(sentence)) score *= 1.2;
  if (tokens.length < 6) score *= 0.75;
  else if (tokens.length > 45) score *= 0.8;
  return score;
}

export interface TextSummary {
  /** The most informative sentences, in their original order. */
  sentences: string[];
  /** Most frequent meaningful terms / two-word phrases. */
  keyTerms: string[];
}

/** Extractive summary: scores sentences by normalised term frequency (stop words removed). */
export function summarizeText(text: string, maxSentences = 5): TextSummary {
  const sentences = splitSentences(text ?? '').filter((sentence) => wordCount(sentence) >= 4);
  if (!sentences.length) return { sentences: [], keyTerms: [] };

  const tokenized = sentences.map(tokenize);
  const stats = analyse(tokenized);
  const keyTerms = topKeyTerms(stats, 6);
  const limit = Math.max(1, Math.floor(maxSentences) || 1);
  if (sentences.length <= limit) return { sentences, keyTerms };

  const picked = sentences
    .map((sentence, index) => ({ sentence, index, score: sentenceScore(sentence, tokenized[index], index, stats) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .sort((a, b) => a.index - b.index)
    .map((entry) => entry.sentence);
  return { sentences: picked, keyTerms };
}

/* ------------------------------------------------------------------ */
/* Cloze MCQs                                                          */
/* ------------------------------------------------------------------ */

const BLANK = '_____';
const MIN_QUIZ_WORDS = 20;

function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(items: T[], seed: number): T[] {
  const random = mulberry32(seed);
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

interface Candidate {
  info: TermInfo;
  label: string;
  score: number;
}

/** Blank-worthiness: repeated, longer (more specific) words make better cloze answers than short generic ones. */
function clozeScore(info: TermInfo, label: string): number {
  return info.count * (0.5 + Math.min(label.length, 10) / 10);
}

function tooSimilar(a: string, b: string): boolean {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return x === y || (Math.min(x.length, y.length) >= 4 && (x.startsWith(y) || y.startsWith(x)));
}

function pickDistractors(pool: Candidate[], answer: Candidate, sentenceStems: Set<string>): string[] {
  const length = answer.label.length;
  const ranked = pool
    .filter((c) => c.info.stem !== answer.info.stem && !sentenceStems.has(c.info.stem) && !tooSimilar(c.label, answer.label))
    .sort(
      (a, b) =>
        Math.abs(a.label.length - length) - Math.abs(b.label.length - length) ||
        b.score - a.score ||
        a.info.firstIndex - b.info.firstIndex,
    );
  const picked: string[] = [];
  for (const candidate of ranked) {
    if (picked.length === 3) break;
    if (picked.some((label) => tooSimilar(label, candidate.label))) continue;
    picked.push(candidate.label);
  }
  return picked;
}

function buildCloze(sentence: string, answer: Candidate, distractors: string[]): MCQ {
  let surface: string | undefined;
  const question = sentence.replace(WORD_RE, (word) => {
    if (stem(normalise(word)) !== answer.info.stem) return word;
    surface ??= word;
    return BLANK;
  });
  // Use the exact form from the sentence (e.g. a plural) so the right option fits the blank.
  const correct =
    surface && surface.toLowerCase() !== answer.label.toLowerCase()
      ? answer.label === answer.label.toLowerCase()
        ? surface.toLowerCase()
        : surface
      : answer.label;
  const options = seededShuffle([correct, ...distractors], hashString(`${sentence}|${correct}`));
  return { question, options, answerIndex: options.indexOf(correct), explanation: sentence };
}

/**
 * Fill-in-the-blank MCQs from the student's own notes: informative sentences
 * with a key term blanked and three distractors drawn from other key terms of
 * similar length. Deterministic. Returns `[]` when there's too little text.
 */
export function generateClozeMCQs(text: string, count = 5): MCQ[] {
  const limit = Math.floor(count);
  if (!text || !(limit > 0)) return [];
  const sentences = splitSentences(text);
  const tokenized = sentences.map(tokenize);
  const totalWords = tokenized.reduce((sum, tokens) => sum + tokens.length, 0);
  if (totalWords < MIN_QUIZ_WORDS) return [];

  const stats = analyse(tokenized);
  const pool: Candidate[] = [...stats.terms.values()]
    .map((info) => {
      const label = displayForm(info);
      return { info, label, score: clozeScore(info, label) };
    })
    .filter((c) => /^[A-Za-z][A-Za-z'’-]*$/.test(c.label) && c.label.replace(/[^A-Za-z]/g, '').length >= 4)
    .sort((a, b) => b.score - a.score || a.info.firstIndex - b.info.firstIndex)
    .slice(0, 40);
  if (pool.length < 4) return [];

  const order = sentences
    .map((sentence, index) => ({ index, score: sentenceScore(sentence, tokenized[index], index, stats) }))
    .filter(({ index }) => tokenized[index].length >= 6 && tokenized[index].length <= 45)
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const usedAnswers = new Set<string>();
  const chosen: { index: number; mcq: MCQ }[] = [];
  for (const { index } of order) {
    if (chosen.length >= limit) break;
    const sentenceStems = new Set(tokenized[index].map((token) => token.stem));
    const answer = pool.find((c) => sentenceStems.has(c.info.stem) && !usedAnswers.has(c.info.stem));
    if (!answer) continue;
    const distractors = pickDistractors(pool, answer, sentenceStems);
    if (distractors.length < 3) continue;
    usedAnswers.add(answer.info.stem);
    chosen.push({ index, mcq: buildCloze(sentences[index], answer, distractors) });
  }
  return chosen.sort((a, b) => a.index - b.index).map((entry) => entry.mcq);
}

/* ------------------------------------------------------------------ */
/* Revision plan                                                       */
/* ------------------------------------------------------------------ */

export const MAX_ITEMS_PER_DAY = 4;
/** Absolute ceiling when the deadline forces extra blocks; anything beyond is reported as unscheduled. */
export const HEAVY_DAY_ITEMS = MAX_ITEMS_PER_DAY + 2;
const PAPER_LOAD = 2;
const MAX_LISTED_DAYS = 16;

export type RevisionItemKind = 'paper' | 'study' | 'review' | 'revise' | 'sleep';

export interface RevisionItem {
  kind: RevisionItemKind;
  text: string;
  subject?: string;
  chapter?: string;
}

export interface RevisionDay {
  day: DayKey;
  items: RevisionItem[];
}

export interface RevisionSchedule {
  /** Today → the day of the last paper, inclusive. Empty when every paper is in the past. */
  days: RevisionDay[];
  totalChapters: number;
  scheduledChapters: number;
  /** Some day needed more than `MAX_ITEMS_PER_DAY` blocks to fit everything in. */
  overloaded: boolean;
  /** Chapters that didn't fit even on heavy days before their paper. */
  unscheduled: { subject: string; chapter: string }[];
  /** Subjects whose paper is today — their chapters aren't scheduled. */
  paperToday: string[];
}

interface PlanSubject {
  name: string;
  progress: number;
  paperIdx: number;
  chapters: string[];
  order: number;
}

const ITEM_ORDER: Record<RevisionItemKind, number> = { paper: 0, study: 1, review: 2, revise: 3, sleep: 4 };

function listNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

function dayLoad(items: RevisionItem[]): number {
  return items.reduce((load, item) => {
    if (item.kind === 'paper') return load + PAPER_LOAD;
    return item.kind === 'sleep' ? load : load + 1;
  }, 0);
}

/** Interleaves study blocks so a day reads A, B, C, A … rather than A, A, B. */
function orderDay(items: RevisionItem[]): RevisionItem[] {
  const study = items.filter((item) => item.kind === 'study');
  const bySubject = new Map<string, RevisionItem[]>();
  for (const item of study) {
    const key = item.subject ?? '';
    bySubject.set(key, [...(bySubject.get(key) ?? []), item]);
  }
  const queues = [...bySubject.values()];
  const interleaved: RevisionItem[] = [];
  while (queues.some((queue) => queue.length)) {
    for (const queue of queues) {
      const next = queue.shift();
      if (next) interleaved.push(next);
    }
  }
  const rest = items.filter((item) => item.kind !== 'study').sort((a, b) => ITEM_ORDER[a.kind] - ITEM_ORDER[b.kind]);
  return [...rest.filter((item) => item.kind === 'paper'), ...interleaved, ...rest.filter((item) => item.kind !== 'paper')];
}

/**
 * Builds a day-by-day schedule: each subject's remaining chapters are spread
 * across the days before its paper (fallback: the main exam), urgent subjects
 * first, max ~4 blocks a day, the day before each paper kept for light review
 * and an early night, and empty days turned into revision rounds.
 */
export function createRevisionSchedule(context: StudyContext, now: Date = new Date()): RevisionSchedule {
  const today = startOfDay(now);
  const mainExam = parseIso(context.examDate, addDays(today, 7));
  const mainIdx = calendarDaysBetween(today, mainExam);

  const subjects: PlanSubject[] = (context.subjects ?? []).map((subject, order) => ({
    name: subject.name.trim() || `Subject ${order + 1}`,
    progress: Math.min(1, Math.max(0, subject.progress || 0)),
    paperIdx: calendarDaysBetween(today, parseIso(subject.examDate, mainExam)),
    chapters: subject.remainingChapters.map((chapter) => chapter.trim()).filter(Boolean),
    order,
  }));
  const totalChapters = subjects.reduce((sum, subject) => sum + subject.chapters.length, 0);

  const paperDays = new Set<number>(subjects.map((subject) => subject.paperIdx));
  paperDays.add(mainIdx);
  const lastIdx = Math.max(...paperDays);
  if (lastIdx < 0) {
    return { days: [], totalChapters, scheduledChapters: 0, overloaded: false, unscheduled: [], paperToday: [] };
  }

  const days: RevisionDay[] = Array.from({ length: lastIdx + 1 }, (_, idx) => ({
    day: toDayKey(addDays(today, idx)),
    items: [],
  }));
  const paperToday = subjects.filter((subject) => subject.paperIdx === 0 && subject.chapters.length).map((s) => s.name);

  // 1. Paper days, light-review eves and early nights.
  const eves = new Map<number, string[]>();
  for (const paperIdx of [...paperDays].filter((idx) => idx >= 0).sort((a, b) => a - b)) {
    const sitting = subjects.filter((subject) => subject.paperIdx === paperIdx).map((subject) => subject.name);
    const label = sitting.length ? listNames(sitting) : 'Final exam';
    days[paperIdx].items.push({
      kind: 'paper',
      text:
        paperIdx === 0
          ? `📝 Paper today: ${label} — skim your summary notes only, no new topics.`
          : `📝 Paper day: ${label} — light breakfast, arrive 30 minutes early. You've got this!`,
    });
    if (paperIdx === 0) continue;

    const eve = days[paperIdx - 1];
    const crunching = paperIdx === 1 && subjects.some((s) => s.paperIdx === paperIdx && s.chapters.length > 0);
    if (!crunching) eves.set(paperIdx - 1, [...(eves.get(paperIdx - 1) ?? []), ...sitting]);
    if (!eve.items.some((item) => item.kind === 'sleep')) {
      eve.items.push({ kind: 'sleep', text: '🌙 Early night — pack hall ticket, ID & pens; lights out by 10:30 PM.' });
    }
  }

  // Eves are kept free of new chapters unless the deadline leaves no other option.
  for (const [idx, sitting] of eves) days[idx].items.push({ kind: 'review', text: '', subject: listNames(sitting) });

  // 2. Chapters, spread evenly before each subject's paper, leaving a revision buffer at the end.
  let overloaded = false;
  let scheduledChapters = 0;
  const unscheduled: RevisionSchedule['unscheduled'] = [];
  const queue = subjects
    .filter((subject) => subject.paperIdx >= 1 && subject.chapters.length > 0)
    .sort(
      (a, b) =>
        a.paperIdx - b.paperIdx || a.progress - b.progress || b.chapters.length - a.chapters.length || a.order - b.order,
    );

  // Interleave by how far through its list each chapter sits (urgent subjects first on ties),
  // so subjects share the days fairly — and, when time runs out, each loses its last chapters.
  const placements = queue
    .flatMap((subject, rank) => {
      const windowEnd = subject.paperIdx >= 2 ? subject.paperIdx - 2 : 0;
      const windowDays = windowEnd + 1;
      const count = subject.chapters.length;
      // Finish new material ~25% early (and no slower than one chapter every other day).
      const spread =
        windowDays <= 3 ? windowDays : Math.max(1, Math.min(windowDays, Math.ceil(windowDays * 0.75), count * 2));
      return subject.chapters.map((chapter, i) => ({
        subject,
        chapter,
        index: i,
        rank,
        windowEnd,
        target: Math.min(windowEnd, Math.floor((i * spread) / count)),
        progress: (i + 0.5) / count,
      }));
    })
    .sort((a, b) => a.progress - b.progress || a.rank - b.rank);

  const placed = new Map<PlanSubject, { item: RevisionItem; day: number; index: number }[]>();
  for (const { subject, chapter, index, windowEnd, target } of placements) {
    let chosen = -1;
    for (let step = 0; step <= windowEnd + 1 && chosen < 0; step++) {
      for (const idx of step === 0 ? [target] : [target + step, target - step]) {
        if (idx >= 0 && idx <= windowEnd && !eves.has(idx) && dayLoad(days[idx].items) < MAX_ITEMS_PER_DAY) {
          chosen = idx;
          break;
        }
      }
    }
    if (chosen < 0) {
      // Every day is at the normal limit: use the lightest day, up to the heavy-day ceiling.
      let lightest = 0;
      for (let idx = 1; idx <= windowEnd; idx++) {
        if (dayLoad(days[idx].items) < dayLoad(days[lightest].items)) lightest = idx;
      }
      if (dayLoad(days[lightest].items) >= HEAVY_DAY_ITEMS) {
        unscheduled.push({ subject: subject.name, chapter });
        continue;
      }
      overloaded = true;
      chosen = lightest;
    }
    const item: RevisionItem = { kind: 'study', text: '', subject: subject.name, chapter };
    days[chosen].items.push(item);
    placed.set(subject, [...(placed.get(subject) ?? []), { item, day: chosen, index }]);
    scheduledChapters += 1;
  }

  // Overflow can land out of order — keep each subject's chapters in syllabus order across its days.
  for (const [subject, entries] of placed) {
    const indices = entries.map((entry) => entry.index).sort((a, b) => a - b);
    [...entries]
      .sort((a, b) => a.day - b.day)
      .forEach((entry, i) => {
        const chapter = subject.chapters[indices[i]];
        entry.item.chapter = chapter;
        entry.item.text = `${subject.name} — ${chapter}`;
      });
  }

  for (const day of days) {
    const review = day.items.find((item) => item.kind === 'review');
    if (!review) continue;
    const busy = day.items.some((item) => item.kind === 'study');
    review.text = `🔁 Light review${review.subject ? `: ${review.subject}` : ''} — skim notes, formulas & flashcards.${busy ? '' : ' No new chapters.'}`;
    review.subject = undefined;
  }

  // 3. Free days become revision rounds for whatever is still ahead.
  days.forEach((day, idx) => {
    if (day.items.some((item) => item.kind !== 'sleep')) return;
    const upcoming = subjects.filter((subject) => subject.paperIdx > idx).map((subject) => subject.name);
    day.items.push({
      kind: 'revise',
      text: upcoming.length
        ? `🧠 Revision round: a timed past paper + active recall — ${listNames(upcoming.slice(0, 3))}.`
        : '🧠 Revision round: a timed past paper + active recall from memory.',
    });
  });

  for (const day of days) day.items = orderDay(day.items);
  return { days, totalChapters, scheduledChapters, overloaded, unscheduled, paperToday };
}

function dayHeading(day: DayKey, idx: number): string {
  const prefix = idx === 0 ? 'Today · ' : idx === 1 ? 'Tomorrow · ' : '';
  return `${prefix}${formatDayLabel(fromDayKey(day))}`;
}

function relativeDays(days: number): string {
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

/** Readable day-by-day revision plan (plain text) built from the student's remaining chapters. */
export function buildRevisionPlan(context: StudyContext, now: Date = new Date()): string {
  if (!context.subjects?.length) {
    return '🗓️ Add your subjects and their chapters in the Planner, then ask me again — I’ll spread them across the days you have left.';
  }
  const schedule = createRevisionSchedule(context, now);
  const today = startOfDay(now);
  const mainExam = parseIso(context.examDate, addDays(today, 7));
  if (!schedule.days.length) {
    return `🎉 Your exam date (${formatDayLabel(mainExam)}) has already passed. If that’s not right, update it in Settings and I’ll build a fresh plan.`;
  }

  const mainIdx = calendarDaysBetween(today, mainExam);
  const lastIdx = schedule.days.length - 1;
  const subjectsWithWork = new Set(
    schedule.days.flatMap((day) => day.items.filter((item) => item.kind === 'study').map((item) => item.subject)),
  ).size;

  const lines: string[] = [
    mainIdx >= 0
      ? `🗓️ Your revision plan (offline) — final exam ${relativeDays(mainIdx)}, ${formatDayLabel(mainExam)}`
      : `🗓️ Your revision plan (offline) — last paper ${relativeDays(lastIdx)}, ${formatDayLabel(fromDayKey(schedule.days[lastIdx].day))}`,
    schedule.scheduledChapters > 0
      ? `${schedule.scheduledChapters} chapter${schedule.scheduledChapters === 1 ? '' : 's'} across ${subjectsWithWork} subject${subjectsWithWork === 1 ? '' : 's'}, ${subjectsWithWork === 1 ? 'spread out' : 'interleaved so each day mixes subjects'} — at most ${MAX_ITEMS_PER_DAY} focus blocks a day.`
      : 'Every chapter is ticked off 🎉 — so this plan is pure revision: past papers, active recall and rest.',
    '',
  ];

  const renderDay = (day: RevisionDay, idx: number) => {
    lines.push(dayHeading(day.day, idx));
    for (const item of day.items) lines.push(`  • ${item.text}`);
  };
  if (schedule.days.length > MAX_LISTED_DAYS) {
    const head = MAX_LISTED_DAYS - 5;
    const tailStart = schedule.days.length - 4;
    schedule.days.slice(0, head).forEach((day, idx) => renderDay(day, idx));
    lines.push(`  … ${tailStart - head} more days in the same rhythm …`);
    schedule.days.slice(tailStart).forEach((day, idx) => renderDay(day, tailStart + idx));
  } else {
    schedule.days.forEach(renderDay);
  }

  lines.push('');
  if (schedule.overloaded) {
    lines.push(
      `⚠️ It’s a tight squeeze — some days go over ${MAX_ITEMS_PER_DAY} blocks. Prioritise high-yield chapters and past-paper favourites.`,
    );
  }
  if (schedule.unscheduled.length) {
    const names = schedule.unscheduled.map((entry) => `${entry.subject}: ${entry.chapter}`);
    const shown = names.slice(0, 6).join(', ');
    const more = names.length > 6 ? ` and ${names.length - 6} more` : '';
    lines.push(
      `⚠️ Not enough days for everything — ${names.length} chapter${names.length === 1 ? '' : 's'} didn’t fit (${shown}${more}). Skim their summaries or cover them through past-paper questions.`,
    );
  }
  if (schedule.paperToday.length) {
    lines.push(`📌 ${listNames(schedule.paperToday)}: paper today, so those chapters are left out — skim your summaries instead.`);
  }
  lines.push(
    'How to use it',
    '  • 50-minute focus blocks with 10-minute breaks — hardest chapter first.',
    '  • Tick chapters off in the Planner as you go, and ask me to re-plan any time.',
  );
  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/* Topic scaffold                                                      */
/* ------------------------------------------------------------------ */

const TOPIC_PREFIX_RE =
  /^(?:(?:please|pls|hey|ok|okay)[,\s]+)?(?:(?:can|could|would) you\s+)?(?:please\s+)?(?:explain|describe|define|teach me|tell me about|help me understand|break down|what (?:is|are|was|were)|what's|whats|how (?:does|do|is|are)|why (?:is|are|does|do))\s+(?:to me\s+)?(?:about\s+)?(?:the\s+(?:concept|topic|idea)\s+of\s+)?/i;

function cleanTopic(input: string): string {
  let topic = input.trim();
  // "Explain how does X work?" carries two instruction prefixes.
  for (let i = 0; i < 3; i++) {
    const next = topic.replace(TOPIC_PREFIX_RE, '');
    if (next === topic) break;
    topic = next;
  }
  return topic
    .replace(/\b(?:in simple terms|simply|in detail|briefly|for my exam|for exams?)\b/gi, '')
    .replace(/\b(?:work|works)\s*\??$/i, '')
    .replace(/^(?:the|a|an)\s+/i, '')
    .replace(/["“”'‘’]/g, '')
    .replace(/[?.!\s]+$/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

function capitalise(text: string): string {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

function memoryHook(topic: string): string {
  const words = topic.split(/\s+/).filter((word) => /^[A-Za-z]/.test(word) && !STOP_WORDS.has(word.toLowerCase()));
  if (words.length >= 2) {
    const initials = words.map((word) => word[0].toUpperCase()).join('');
    return `Take the initials ${initials} and turn your key steps into a silly sentence that starts with them — then say it out loud twice.`;
  }
  return `Link “${capitalise(topic)}” to one vivid picture, then explain it in 30 seconds as if teaching a friend (the Feynman test). Gaps you stumble on = what to revise.`;
}

/** Structured study scaffold for a topic — honest about needing cloud AI for full explanations. */
export function explainTopic(topic: string): string {
  const clean = cleanTopic(topic ?? '');
  if (!clean) {
    return 'Which topic should I break down? Try something like “Explain normalization” or “What is the OSI model?”.';
  }
  const name = capitalise(clean);
  return [
    `📘 ${name} — study scaffold (offline)`,
    '',
    '1. What it is',
    `   Define it in one line, in your own words: “${name} — …”. Then check it against your notes or textbook.`,
    '',
    '2. Why it matters',
    `   • What problem does ${clean} solve — what would go wrong without it?`,
    '   • Where does it show up in your syllabus and past papers?',
    '',
    '3. How it works — steps to fill in',
    '   Step 1: Starting point / inputs → …',
    '   Step 2: The core process or rule → …',
    '   Step 3: The result / output → …',
    '   Step 4: Limits, edge cases or exceptions → …',
    '',
    '4. Example to try',
    `   Work through one small, concrete example of ${clean} by hand, then redraw it as a diagram or table.`,
    '',
    '5. Likely exam questions',
    `   • Define ${clean} and explain its significance. (short answer)`,
    `   • Explain the working of ${clean} with a neat diagram or example. (long answer)`,
    `   • Compare ${clean} with a closely related concept — advantages and limitations.`,
    `   • Apply ${clean} to a given scenario or problem.`,
    '',
    '6. Memory hook',
    `   ${memoryHook(clean)}`,
    '',
    '💡 I’m in offline mode, so this is a scaffold for you to fill in — detailed, worked explanations need the cloud study buddy.',
  ].join('\n');
}

/* ------------------------------------------------------------------ */
/* Reply routing                                                       */
/* ------------------------------------------------------------------ */

export interface OfflineReplyInput {
  mode: AssistantMode;
  prompt: string;
  history: ChatMessage[];
  context: StudyContext;
  /** Injected clock for deterministic tests. */
  now?: Date;
}

type Intent = 'plan' | 'mcq' | 'summarize' | 'explain' | 'stress' | 'thanks' | 'greeting' | 'coach';

const INTENT_PATTERNS: [Exclude<Intent, 'coach'>, RegExp][] = [
  [
    'plan',
    /\b(?:revision|study|exam)\s+(?:plan|schedule|timetable)\b|\b(?:make|create|build|give|draw up|need)\b.{0,30}\b(?:plan|schedule|timetable)\b|\btimetable\b|^\s*plan\b|\bplan (?:my|me|out)\b/i,
  ],
  ['mcq', /\bmcqs?\b|\bquiz\b|\btest me\b|\bpractice questions?\b|\bmultiple[-\s]choice\b|\bquestions? (?:on|about|from)\b/i],
  ['summarize', /\bsummar(?:y|ies|ise|ize|ised|ized|ising|izing)\b|\btl;?dr\b|\bshorten\b|\bkey points\b/i],
  [
    'explain',
    /\bexplain\b|\bwhat (?:is|are|does|do)\b|\bwhat's\b|\bhow (?:does|do)\b|\bdefine\b|\bdescribe\b|\bteach me\b|\btell me about\b|\bhelp me understand\b/i,
  ],
  [
    'stress',
    /\b(?:stress(?:ed)?|anxious|anxiety|panic(?:king)?|nervous|scared|overwhelm(?:ed|ing)?|burn(?:ed|t)? ?out|exhausted|worried|freaking out|give up|can'?t focus|cannot focus|can'?t concentrate)\b/i,
  ],
  ['thanks', /\b(?:thanks|thank you|thx|cheers)\b/i],
  ['greeting', /^\s*(?:hi|hey|hello|hiya|yo|good (?:morning|afternoon|evening))\b/i],
];

const NOTES_MIN_WORDS = 25;
const LONG_PROMPT_WORDS = 40;

function detectIntent(prompt: string): Intent {
  const long = wordCount(prompt) >= LONG_PROMPT_WORDS;
  // In long pasted notes, only an instruction near the start counts.
  const haystack = long ? prompt.slice(0, 160) : prompt;
  for (const [intent, pattern] of INTENT_PATTERNS) {
    if (long && (intent === 'stress' || intent === 'thanks' || intent === 'greeting')) continue;
    if (pattern.test(haystack)) return intent === 'explain' && long ? 'summarize' : intent;
  }
  return long ? 'summarize' : 'coach';
}

/** "Summarise this: <notes>" / "Quiz me on these notes\n<notes>" → just the notes. */
function extractNotes(prompt: string): string {
  const match =
    /^[^\n:]{0,80}?\b(?:summar\w*|tl;?dr|mcqs?|quiz|questions?|test me|notes?)\b[^\n:]{0,60}?(?::|\n)\s*/i.exec(
      prompt,
    );
  if (match && prompt.length > match[0].length) return prompt.slice(match[0].length).trim();
  return prompt.trim();
}

function hasEnoughNotes(text: string): boolean {
  return wordCount(text) >= NOTES_MIN_WORDS && splitSentences(text).length >= 2;
}

/** Most recent substantial notes the student pasted earlier in the conversation. */
function findRecentNotes(history: ChatMessage[]): string | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const message = history[i];
    if (message.role !== 'user' || message.error) continue;
    const notes = extractNotes(message.text);
    if (hasEnoughNotes(notes)) return notes;
  }
  return null;
}

const offline = (text: string, mcqs?: MCQ[]): AssistantReply =>
  mcqs ? { text, mcqs, source: 'offline' } : { text, source: 'offline' };

function firstName(name?: string): string {
  return name?.trim().split(/\s+/)[0] ?? '';
}

function summarizeReply(prompt: string, history: ChatMessage[]): AssistantReply {
  const own = extractNotes(prompt);
  const notes = hasEnoughNotes(own) ? own : findRecentNotes(history);
  if (!notes) {
    return offline(
      '📝 Paste the notes you’d like summarised — a paragraph or more works best — and I’ll pull out the key points and terms.',
    );
  }
  const { sentences, keyTerms } = summarizeText(notes, 5);
  const lines = [`📝 Key points${notes === own ? '' : ' from your earlier notes'} (offline summary)`];
  for (const sentence of sentences) lines.push(`• ${sentence}`);
  if (keyTerms.length) lines.push('', `🔑 Key terms: ${keyTerms.join(' · ')}`);
  lines.push('', 'Want to test yourself? Ask me for MCQs on these notes.');
  return offline(lines.join('\n'));
}

function mcqReply(prompt: string, history: ChatMessage[]): AssistantReply {
  const own = extractNotes(prompt);
  let mcqs = hasEnoughNotes(own) ? generateClozeMCQs(own, 5) : [];
  let fromHistory = false;
  if (!mcqs.length) {
    const earlier = findRecentNotes(history);
    if (earlier && earlier !== own) {
      mcqs = generateClozeMCQs(earlier, 5);
      fromHistory = mcqs.length > 0;
    }
  }
  if (!mcqs.length) {
    return offline(
      '🧠 I build practice questions straight from your notes. Paste a paragraph or two — definitions and key facts work best — and I’ll turn them into fill-in-the-blank MCQs.',
      [],
    );
  }
  return offline(
    `🧠 ${mcqs.length} fill-in-the-blank question${mcqs.length === 1 ? '' : 's'} from your ${fromHistory ? 'earlier ' : ''}notes. Pick an answer, then check the explanation. (Offline mode — questions come from your own sentences.)`,
    mcqs,
  );
}

function explainReply(prompt: string, context: StudyContext): AssistantReply {
  const topic = cleanTopic(prompt);
  let text = explainTopic(topic);
  const needle = topic.toLowerCase();
  if (needle.length >= 3) {
    for (const subject of context.subjects ?? []) {
      const chapter = subject.remainingChapters.find((title) => {
        const hay = title.toLowerCase();
        return hay.includes(needle) || (hay.length >= 3 && needle.includes(hay));
      });
      if (chapter) {
        text += `\n\n📌 “${chapter}” is still on your ${subject.name} list — fill this scaffold in, then tick it off in the Planner.`;
        break;
      }
    }
  }
  return offline(text);
}

interface CoachFacts {
  name: string;
  daysLeft: number;
  pending: StudyContext['subjects'];
}

function coachFacts(context: StudyContext, now: Date): CoachFacts {
  const daysLeft = calendarDaysBetween(startOfDay(now), parseIso(context.examDate, now));
  const pending = (context.subjects ?? [])
    .filter((subject) => subject.remainingChapters.length > 0)
    .sort((a, b) => a.progress - b.progress || b.remainingChapters.length - a.remainingChapters.length);
  return { name: firstName(context.studentName), daysLeft, pending };
}

function countdownLine(daysLeft: number): string {
  if (daysLeft > 1) return `${daysLeft} days to your final exam.`;
  if (daysLeft === 1) return 'Your exam is tomorrow.';
  if (daysLeft === 0) return 'It’s exam day!';
  return 'Your exams are behind you 🎉';
}

const OPENERS = ['Let’s make today count', 'You’re closer than you think', 'Small steps, big finish', 'One block at a time'];

function coachReply(prompt: string, context: StudyContext, now: Date): string {
  const { name, daysLeft, pending } = coachFacts(context, now);
  const isQuestion = /\?\s*$/.test(prompt);
  const opener = OPENERS[hashString(prompt) % OPENERS.length];
  const lines: string[] = [
    isQuestion
      ? 'I’m in offline mode, so I can’t research open-ended questions — but here’s how I’d use your next hour:'
      : `${opener}${name ? `, ${name}` : ''}! ${countdownLine(daysLeft)}`,
    '',
  ];

  const tips: string[] = [];
  if (daysLeft < 0) {
    tips.push(
      'Rest — you’ve earned it. If another paper is coming, update the exam date in Settings and I’ll re-plan.',
      'Check your travel checklist so the trip home is stress-free.',
    );
  } else if (pending.length) {
    const [weakest, second] = pending;
    tips.push(
      `Start with ${weakest.name} (${Math.round(weakest.progress * 100)}% done): tackle “${weakest.remainingChapters[0]}” in two 25-minute focus blocks.`,
    );
    tips.push(
      second
        ? `Then switch to ${second.name} — “${second.remainingChapters[0]}”. Mixing subjects keeps your brain fresh.`
        : 'Then do one past-paper question on it under timed conditions.',
    );
  } else if (context.subjects?.length) {
    tips.push(
      'Every chapter is ticked off 🎉 — switch to timed past papers now.',
      'Make a one-page summary per subject to skim on exam morning.',
    );
  } else {
    tips.push(
      'Add your subjects and chapters in the Planner so I can personalise your plan.',
      'Then ask me to “make a revision plan”.',
    );
  }
  tips.push(
    now.getHours() >= 22 || now.getHours() < 4
      ? 'It’s late — sleep beats cramming. 7–8 hours locks in what you studied today.'
      : 'Finish with 10 minutes of active recall: close your notes and write down everything you remember.',
  );
  tips.forEach((tip, i) => lines.push(`${i + 1}. ${tip}`));
  lines.push('', 'Try: “make a revision plan”, “summarize” + your notes, “quiz me” on your notes, or “explain <topic>”.');
  return lines.join('\n');
}

function stressReply(context: StudyContext, now: Date): string {
  const { name, daysLeft, pending } = coachFacts(context, now);
  const next = pending[0];
  return [
    `💙 It’s completely normal to feel this way${daysLeft >= 0 && daysLeft <= 7 ? ' this close to exams' : ''}${name ? `, ${name}` : ''}. Let’s bring it down a notch:`,
    '',
    '1. Breathe: box breathing — in 4, hold 4, out 4, hold 4 — for two minutes (Stress Control → Breathing).',
    next
      ? `2. Shrink the task: just “${next.remainingChapters[0]}” (${next.name}) for 25 minutes. Starting is the hardest part.`
      : '2. Shrink the task: pick one small thing and give it 25 minutes. Starting is the hardest part.',
    '3. Protect your sleep — a rested brain recalls far more than a crammed one.',
    '',
    '“A calm mind can achieve anything.” You’ve got this.',
  ].join('\n');
}

function chatReply(input: OfflineReplyInput, prompt: string, now: Date): AssistantReply {
  const { context, history } = input;
  const { name, daysLeft } = coachFacts(context, now);
  switch (detectIntent(prompt)) {
    case 'plan':
      return offline(buildRevisionPlan(context, now));
    case 'mcq':
      return mcqReply(prompt, history);
    case 'summarize':
      return summarizeReply(prompt, history);
    case 'explain':
      return explainReply(prompt, context);
    case 'stress':
      return offline(stressReply(context, now));
    case 'thanks':
      return offline(`Anytime${name ? `, ${name}` : ''}! 💪 ${countdownLine(daysLeft)} One final push before freedom.`);
    case 'greeting':
      return offline(
        `Hey${name ? ` ${name}` : ''}! 👋 I’m your offline study buddy. ${countdownLine(daysLeft)} I can make a revision plan, summarise your notes, quiz you on them or break down a topic — what shall we tackle?`,
      );
    default:
      return offline(coachReply(prompt, context, now));
  }
}

/** Deterministic on-device reply for any assistant mode. Never throws for valid input. */
export function offlineReply(input: OfflineReplyInput): AssistantReply {
  const now = input.now ?? new Date();
  const prompt = (input.prompt ?? '').trim();
  const history = input.history ?? [];
  switch (input.mode) {
    case 'plan':
      return offline(buildRevisionPlan(input.context, now));
    case 'summarize':
      return summarizeReply(prompt, history);
    case 'mcq':
      return mcqReply(prompt, history);
    case 'explain':
      return explainReply(prompt, input.context);
    case 'chat':
    default:
      return chatReply({ ...input, history }, prompt, now);
  }
}
