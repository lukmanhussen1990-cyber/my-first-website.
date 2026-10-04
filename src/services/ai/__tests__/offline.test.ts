import type { ChatMessage, StudyContext } from '@/types';
import { addDays, calendarDaysBetween, fromDayKey, startOfDay, toDayKey } from '@/utils/date';

import {
  buildRevisionPlan,
  createRevisionSchedule,
  explainTopic,
  generateClozeMCQs,
  HEAVY_DAY_ITEMS,
  MAX_ITEMS_PER_DAY,
  offlineReply,
  splitSentences,
  summarizeText,
  type RevisionSchedule,
} from '../offline';

const NOW = new Date(2026, 9, 5, 10, 0); // Mon 5 Oct 2026, 10:00 local
const at = (day: number, hour = 9) => new Date(2026, 9, day, hour, 0).toISOString();

const NOTES = `Normalization
Normalization is the process of organizing data in a database to reduce redundancy and improve data integrity.
- First normal form (1NF) requires that every column holds atomic values.
- Second normal form (2NF) removes partial dependencies on a composite primary key.
- Third normal form (3NF) removes transitive dependencies between non-key attributes.

A primary key uniquely identifies each row in a table. A foreign key refers to the primary key of another table, which enforces referential integrity.
Denormalization deliberately adds redundancy to speed up read-heavy queries, e.g. in reporting systems. Indexes also speed up queries but cost extra storage and slower writes.
Transactions follow the ACID properties: atomicity, consistency, isolation and durability.`;

const CONTEXT: StudyContext = {
  studentName: 'Aisha Khan',
  today: '2026-10-05',
  examDate: at(12),
  subjects: [
    { name: 'Database', progress: 0.85, remainingChapters: ['SQL Queries', 'Normalization', 'Transaction Management'] },
    {
      name: 'Networking',
      progress: 0.7,
      examDate: at(9),
      remainingChapters: ['Routing', 'TCP/IP model', 'Subnetting', 'DNS'],
    },
    { name: 'Operating System', progress: 0.75, remainingChapters: ['Deadlocks', 'Paging'] },
    { name: 'Aptitude', progress: 0.6, remainingChapters: ['Probability', 'Time & Work'] },
    { name: 'Theory', progress: 1, remainingChapters: [] },
  ],
};

const message = (role: ChatMessage['role'], text: string): ChatMessage => ({
  id: `${role}-${text.length}`,
  role,
  text,
  mode: 'chat',
  createdAt: NOW.toISOString(),
});

const studyItems = (schedule: RevisionSchedule) =>
  schedule.days.flatMap((day, idx) =>
    day.items.filter((item) => item.kind === 'study').map((item) => ({ ...item, idx, day: day.day })),
  );

const studyCount = (schedule: RevisionSchedule, idx: number) =>
  schedule.days[idx].items.filter((item) => item.kind === 'study').length;

/* ------------------------------------------------------------------ */

describe('splitSentences', () => {
  it('splits bullets, numbered lines and paragraphs into sentences', () => {
    const sentences = splitSentences(
      'Key ideas\n1. Paging divides memory into fixed-size frames.\n2) Segmentation uses variable-size segments.\n• TLBs cache page table entries. They speed up lookups.',
    );
    expect(sentences).toEqual([
      'Paging divides memory into fixed-size frames.',
      'Segmentation uses variable-size segments.',
      'TLBs cache page table entries.',
      'They speed up lookups.',
    ]);
  });

  it('does not split on abbreviations, initials or decimals', () => {
    const sentences = splitSentences(
      'Indexes help, e.g. B-trees keep keys sorted. E. F. Codd proposed the relational model in 1970. Pi is about 3.14 in value. Done here now.',
    );
    expect(sentences).toEqual([
      'Indexes help, e.g. B-trees keep keys sorted.',
      'E. F. Codd proposed the relational model in 1970.',
      'Pi is about 3.14 in value.',
      'Done here now.',
    ]);
  });

  it('joins hard-wrapped lines of the same sentence', () => {
    expect(splitSentences('A deadlock happens when processes wait\nfor each other forever.')).toEqual([
      'A deadlock happens when processes wait for each other forever.',
    ]);
  });
});

describe('summarizeText', () => {
  it('keeps at most maxSentences, in their original order', () => {
    const all = splitSentences(NOTES);
    const { sentences } = summarizeText(NOTES, 3);
    expect(sentences).toHaveLength(3);
    const positions = sentences.map((sentence) => all.indexOf(sentence));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('favours the defining first sentence and returns meaningful key terms', () => {
    const { sentences, keyTerms } = summarizeText(NOTES);
    expect(sentences.length).toBeLessThanOrEqual(5);
    expect(sentences[0]).toMatch(/^Normalization is the process/);
    expect(keyTerms).toEqual(expect.arrayContaining(['normal form', 'primary key', 'redundancy']));
    expect(keyTerms).not.toContain('the');
    expect(keyTerms.length).toBeLessThanOrEqual(6);
  });

  it('returns every sentence when the text is already short', () => {
    const text = 'Paging avoids external fragmentation. Thrashing happens when a system spends more time paging than working.';
    expect(summarizeText(text, 5).sentences).toEqual(splitSentences(text));
  });

  it('handles empty input', () => {
    expect(summarizeText('')).toEqual({ sentences: [], keyTerms: [] });
    expect(summarizeText('   \n  ')).toEqual({ sentences: [], keyTerms: [] });
  });
});

describe('generateClozeMCQs', () => {
  it('returns [] when there is too little text', () => {
    expect(generateClozeMCQs('')).toEqual([]);
    expect(generateClozeMCQs('Deadlocks are bad.')).toEqual([]);
    expect(generateClozeMCQs(NOTES, 0)).toEqual([]);
  });

  it('builds well-formed fill-in-the-blank questions from the notes', () => {
    const mcqs = generateClozeMCQs(NOTES, 5);
    const sentences = splitSentences(NOTES);
    expect(mcqs.length).toBeGreaterThanOrEqual(3);
    expect(mcqs.length).toBeLessThanOrEqual(5);

    for (const mcq of mcqs) {
      expect(mcq.options).toHaveLength(4);
      expect(new Set(mcq.options.map((option) => option.toLowerCase())).size).toBe(4);
      expect(Number.isInteger(mcq.answerIndex)).toBe(true);
      expect(mcq.answerIndex).toBeGreaterThanOrEqual(0);
      expect(mcq.answerIndex).toBeLessThan(4);
      expect(sentences).toContain(mcq.explanation);
      expect(mcq.question).toContain('_____');

      const answer = mcq.options[mcq.answerIndex];
      expect(answer.replace(/[^A-Za-z]/g, '').length).toBeGreaterThanOrEqual(4);
      expect(['that', 'with', 'from', 'this', 'which', 'each']).not.toContain(answer.toLowerCase());
      // Putting the right answer back into the blank restores the original sentence.
      expect(mcq.question.split('_____').join(answer).toLowerCase()).toBe(mcq.explanation.toLowerCase());
      // Distractors are never visible in the question itself.
      mcq.options
        .filter((_, i) => i !== mcq.answerIndex)
        .forEach((distractor) => expect(mcq.question.toLowerCase()).not.toMatch(new RegExp(`\\b${distractor.toLowerCase()}\\b`)));
    }
  });

  it('uses a different answer for every question and keeps the notes order', () => {
    const mcqs = generateClozeMCQs(NOTES, 5);
    const answers = mcqs.map((mcq) => mcq.options[mcq.answerIndex].toLowerCase());
    expect(new Set(answers).size).toBe(answers.length);
    const sentences = splitSentences(NOTES);
    const order = mcqs.map((mcq) => sentences.indexOf(mcq.explanation));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('is deterministic and respects count', () => {
    expect(generateClozeMCQs(NOTES, 5)).toEqual(generateClozeMCQs(NOTES, 5));
    expect(generateClozeMCQs(NOTES, 2)).toHaveLength(2);
  });

  it('does not always put the answer in the same slot', () => {
    const positions = new Set(generateClozeMCQs(NOTES, 5).map((mcq) => mcq.answerIndex));
    expect(positions.size).toBeGreaterThan(1);
  });
});

describe('createRevisionSchedule', () => {
  const schedule = createRevisionSchedule(CONTEXT, NOW);
  const today = startOfDay(NOW);

  it('covers today through the last paper', () => {
    expect(schedule.days[0].day).toBe('2026-10-05');
    expect(schedule.days[schedule.days.length - 1].day).toBe('2026-10-12');
    expect(schedule.days).toHaveLength(8);
  });

  it('schedules every remaining chapter exactly once', () => {
    const items = studyItems(schedule);
    const expected = CONTEXT.subjects.flatMap((s) => s.remainingChapters.map((chapter) => `${s.name}|${chapter}`));
    expect(items.map((item) => `${item.subject}|${item.chapter}`).sort()).toEqual([...expected].sort());
    expect(schedule.totalChapters).toBe(expected.length);
    expect(schedule.scheduledChapters).toBe(expected.length);
    expect(schedule.unscheduled).toEqual([]);
    expect(schedule.overloaded).toBe(false);
  });

  it('finishes each subject before the eve of its own paper', () => {
    for (const item of studyItems(schedule)) {
      const subject = CONTEXT.subjects.find((s) => s.name === item.subject)!;
      const paperIdx = calendarDaysBetween(today, new Date(subject.examDate ?? CONTEXT.examDate));
      expect(item.idx).toBeLessThanOrEqual(paperIdx - 2);
    }
  });

  it('keeps to the daily limit and interleaves subjects', () => {
    schedule.days.forEach((_, idx) => expect(studyCount(schedule, idx)).toBeLessThanOrEqual(MAX_ITEMS_PER_DAY));
    const firstDaySubjects = new Set(studyItems(schedule).filter((item) => item.idx === 0).map((item) => item.subject));
    expect(firstDaySubjects.size).toBeGreaterThanOrEqual(2);
    // Within a day, the same subject never appears twice in a row when another could sit between.
    for (const day of schedule.days) {
      const subjects = day.items.filter((item) => item.kind === 'study').map((item) => item.subject);
      const distinct = new Set(subjects).size;
      if (distinct > 1) expect(subjects[0]).not.toBe(subjects[1]);
    }
  });

  it('keeps each subject’s chapters in syllabus order', () => {
    for (const subject of CONTEXT.subjects) {
      const order = studyItems(schedule)
        .filter((item) => item.subject === subject.name)
        .map((item) => subject.remainingChapters.indexOf(item.chapter!));
      expect([...order].sort((a, b) => a - b)).toEqual(order);
    }
  });

  it('makes the final day a light review + early night, then the paper', () => {
    const eve = schedule.days[schedule.days.length - 2];
    expect(eve.items.map((item) => item.kind)).toEqual(['review', 'sleep']);
    expect(eve.items[0].text).toMatch(/Light review: Database, Operating System, Aptitude & Theory/);
    expect(eve.items[0].text).toMatch(/No new chapters/);
    const examDay = schedule.days[schedule.days.length - 1];
    expect(examDay.items[0].kind).toBe('paper');
  });

  it('marks earlier papers and gives them their own review eve', () => {
    const networkingPaper = schedule.days[4]; // Fri 9 Oct
    expect(networkingPaper.items[0]).toMatchObject({ kind: 'paper' });
    expect(networkingPaper.items[0].text).toContain('Networking');
    expect(schedule.days[3].items.some((item) => item.kind === 'review' && item.text.includes('Networking'))).toBe(true);
    expect(schedule.days[3].items.some((item) => item.kind === 'sleep')).toBe(true);
  });

  it('turns free days into revision rounds', () => {
    const free = schedule.days.filter((day) => day.items.some((item) => item.kind === 'revise'));
    expect(free.length).toBeGreaterThan(0);
    for (const day of free) expect(day.items.every((item) => item.kind === 'revise')).toBe(true);
  });

  it('shares an impossible workload fairly and reports what does not fit', () => {
    const tight = createRevisionSchedule(
      {
        today: '2026-10-05',
        examDate: at(8),
        subjects: [
          { name: 'A', progress: 0, remainingChapters: Array.from({ length: 10 }, (_, i) => `A${i + 1}`) },
          { name: 'B', progress: 0, remainingChapters: Array.from({ length: 10 }, (_, i) => `B${i + 1}`) },
        ],
      },
      NOW,
    );
    expect(tight.overloaded).toBe(true);
    tight.days.forEach((_, idx) => expect(studyCount(tight, idx)).toBeLessThanOrEqual(HEAVY_DAY_ITEMS));
    expect(tight.scheduledChapters + tight.unscheduled.length).toBe(20);
    const lostA = tight.unscheduled.filter((entry) => entry.subject === 'A').length;
    const lostB = tight.unscheduled.filter((entry) => entry.subject === 'B').length;
    expect(Math.abs(lostA - lostB)).toBeLessThanOrEqual(1);
    // The last chapters are the ones that drop off, and the eve stays free.
    expect(tight.unscheduled.map((entry) => entry.chapter)).toContain('A10');
    expect(studyCount(tight, 2)).toBe(0);
    expect(buildRevisionPlan({ today: '2026-10-05', examDate: at(8), subjects: [] }, NOW)).toMatch(/Add your subjects/);
  });

  it('crams a paper that is tomorrow into today and skips a paper that is today', () => {
    const crunch = createRevisionSchedule(
      {
        today: '2026-10-05',
        examDate: at(6),
        subjects: [
          { name: 'Maths', progress: 0.5, remainingChapters: ['Limits', 'Series'] },
          { name: 'Chemistry', progress: 0.5, examDate: at(5, 14), remainingChapters: ['Kinetics'] },
        ],
      },
      NOW,
    );
    expect(crunch.paperToday).toEqual(['Chemistry']);
    expect(studyItems(crunch).map((item) => item.chapter)).toEqual(['Limits', 'Series']);
    expect(crunch.days[0].items.map((item) => item.kind)).toEqual(['paper', 'study', 'study', 'sleep']);
  });

  it('returns no days once every paper is in the past', () => {
    const past = createRevisionSchedule({ ...CONTEXT, examDate: at(1), subjects: [] }, NOW);
    expect(past.days).toEqual([]);
  });
});

describe('buildRevisionPlan', () => {
  it('renders a readable day-by-day plan', () => {
    const plan = buildRevisionPlan(CONTEXT, NOW);
    expect(plan).toMatch(/^🗓️ Your revision plan \(offline\) — final exam in 7 days, Mon, 12 Oct/);
    expect(plan).toContain('11 chapters across 4 subjects');
    expect(plan).toContain('Today · Mon, 5 Oct');
    expect(plan).toContain('Tomorrow · Tue, 6 Oct');
    for (const subject of CONTEXT.subjects) {
      for (const chapter of subject.remainingChapters) expect(plan).toContain(`${subject.name} — ${chapter}`);
    }
    expect(plan).toContain('Light review');
    expect(plan).toContain('Early night');
  });

  it('explains when there is nothing to plan', () => {
    expect(buildRevisionPlan({ ...CONTEXT, subjects: [] }, NOW)).toMatch(/Add your subjects/);
    expect(buildRevisionPlan({ ...CONTEXT, examDate: at(1), subjects: [{ name: 'A', progress: 0, remainingChapters: ['x'] }] }, NOW)).toMatch(
      /already passed/,
    );
  });

  it('switches to pure revision when every chapter is done', () => {
    const plan = buildRevisionPlan(
      { ...CONTEXT, subjects: [{ name: 'Theory', progress: 1, remainingChapters: [] }] },
      NOW,
    );
    expect(plan).toContain('Every chapter is ticked off');
    expect(plan).toContain('Revision round');
  });

  it('condenses long horizons', () => {
    const plan = buildRevisionPlan(
      {
        today: '2026-10-05',
        examDate: new Date(2026, 11, 20, 9).toISOString(),
        subjects: [{ name: 'Maths', progress: 0.1, remainingChapters: Array.from({ length: 12 }, (_, i) => `Ch ${i + 1}`) }],
      },
      NOW,
    );
    expect(plan).toMatch(/more days in the same rhythm/);
    expect(plan).toContain('Sun, 20 Dec');
    expect(plan.split('\n').length).toBeLessThan(60);
  });
});

describe('explainTopic', () => {
  it('returns every scaffold section and is honest about offline mode', () => {
    const text = explainTopic('deadlocks');
    for (const heading of [
      'What it is',
      'Why it matters',
      'How it works — steps to fill in',
      'Example to try',
      'Likely exam questions',
      'Memory hook',
    ]) {
      expect(text).toContain(heading);
    }
    expect(text.startsWith('📘 Deadlocks')).toBe(true);
    expect(text).toMatch(/cloud study buddy/);
  });

  it('strips instruction phrasing from the topic', () => {
    expect(explainTopic('Explain how does TCP congestion control work?').split('\n')[0]).toBe(
      '📘 TCP congestion control — study scaffold (offline)',
    );
    expect(explainTopic('What is the OSI model?').split('\n')[0]).toBe('📘 OSI model — study scaffold (offline)');
  });

  it('asks for a topic when given none', () => {
    expect(explainTopic('  ')).toMatch(/Which topic/);
  });
});

describe('offlineReply', () => {
  const reply = (mode: Parameters<typeof offlineReply>[0]['mode'], prompt: string, history: ChatMessage[] = []) =>
    offlineReply({ mode, prompt, history, context: CONTEXT, now: NOW });

  it('always labels replies as offline', () => {
    for (const mode of ['chat', 'explain', 'mcq', 'summarize', 'plan'] as const) {
      expect(reply(mode, 'hello').source).toBe('offline');
    }
  });

  it('plan mode returns the revision plan', () => {
    expect(reply('plan', 'Make a revision plan').text).toBe(buildRevisionPlan(CONTEXT, NOW));
  });

  it('summarize mode summarises pasted notes or asks for them', () => {
    const summary = reply('summarize', NOTES).text;
    expect(summary).toMatch(/Key points/);
    expect(summary).toMatch(/Key terms: .*primary key/);
    expect(reply('summarize', 'Summarize this').text).toMatch(/Paste the notes/);
  });

  it('mcq mode without notes asks for notes and returns no questions', () => {
    const result = reply('mcq', 'Give me MCQs');
    expect(result.mcqs).toEqual([]);
    expect(result.text).toMatch(/Paste a paragraph or two/);
  });

  it('mcq mode builds questions from pasted notes, or from notes shared earlier', () => {
    const direct = reply('mcq', `Quiz me on these notes:\n${NOTES}`);
    expect(direct.mcqs?.length).toBeGreaterThan(0);
    expect(direct.mcqs).toEqual(generateClozeMCQs(NOTES, 5));

    const fromHistory = reply('mcq', 'Give me MCQs', [message('user', `Summarize this:\n${NOTES}`), message('assistant', 'ok')]);
    expect(fromHistory.mcqs?.length).toBeGreaterThan(0);
    expect(fromHistory.text).toMatch(/earlier notes/);
  });

  it('explain mode returns the scaffold and links it to the plan', () => {
    const text = reply('explain', 'Explain deadlocks').text;
    expect(text).toContain('📘 Deadlocks');
    expect(text).toMatch(/“Deadlocks” is still on your Operating System list/);
  });

  describe('chat intent detection', () => {
    it.each([
      ['plan request', 'Can you make me a revision plan?', /Your revision plan/],
      ['short plan request', 'plan my week', /Your revision plan/],
      ['summary request with notes', `Summarize this: ${NOTES}`, /Key points/],
      ['explain request', 'Explain normalization please', /📘 Normalization/],
      ['what-is question', 'What is the OSI model?', /📘 OSI model/],
      ['stress', 'I am so stressed and can’t focus', /box breathing/],
      ['thanks', 'thanks!', /^Anytime, Aisha!/],
      ['greeting', 'hey there', /^Hey Aisha! 👋/],
    ])('%s', (_label, prompt, expected) => {
      expect(reply('chat', prompt).text).toMatch(expected);
    });

    it('routes quiz requests to MCQs', () => {
      const result = reply('chat', `Test me on this:\n${NOTES}`);
      expect(result.mcqs?.length).toBeGreaterThan(0);
    });

    it('summarises long pasted notes with no instruction', () => {
      expect(reply('chat', NOTES).text).toMatch(/Key points/);
    });

    it('falls back to a personal study-coach reply with actionable steps', () => {
      const text = reply('chat', 'what should I work on today').text;
      expect(text).toMatch(/Aisha! 7 days to your final exam\./);
      expect(text).toMatch(/1\. Start with Aptitude \(60% done\): tackle “Probability”/);
      expect(text).toMatch(/2\. Then switch to Networking — “Routing”/);
      expect(text).toMatch(/3\. /);
    });

    it('is honest that open questions need cloud AI', () => {
      expect(reply('chat', 'Why is the sky blue?').text).toMatch(/^I’m in offline mode/);
    });

    it('is deterministic', () => {
      expect(reply('chat', 'what next')).toEqual(reply('chat', 'what next'));
    });
  });
});

describe('date helpers used by the plan', () => {
  it('uses local day keys', () => {
    // Sanity check that the fixtures line up with the local calendar.
    expect(toDayKey(addDays(startOfDay(NOW), 7))).toBe('2026-10-12');
    expect(fromDayKey('2026-10-12').getDay()).toBe(1);
  });
});
