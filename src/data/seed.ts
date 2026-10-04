/**
 * Factories for first-run data: the sample study plan, journal memories and the
 * default travel checklist. Everything is generated relative to `now` and the
 * exam date so the sample always looks "live" (streak running, today's
 * missions half done, papers in the days before the final exam).
 */
import type {
  AccentKey,
  ChecklistItem,
  IconName,
  IllustrationKey,
  IsoDateTime,
  Memory,
  StudyTask,
  Subject,
} from '@/types';
import { addDays, addYears, nextOccurrence, startOfDay, toDayKey, withTime } from '@/utils/date';
import { createId } from '@/utils/id';

import { defaultChecklist } from './checklist';

/* ------------------------------------------------------------------ */
/* Default dates                                                       */
/* ------------------------------------------------------------------ */

export const DEFAULT_EXAM = { month: 10, day: 12, hour: 9, minute: 0 } as const;
export const DEFAULT_TRAVEL_TIME = { hour: 18, minute: 0 } as const;

/** Next 12 October 09:00 local (this year, or next year once it has passed). */
export function defaultExamDate(now: Date = new Date()): Date {
  const { month, day, hour, minute } = DEFAULT_EXAM;
  return nextOccurrence(month, day, hour, minute, now);
}

/** Exam day at 18:00 local. */
export function defaultTravelDate(examDate: Date): Date {
  return withTime(examDate, DEFAULT_TRAVEL_TIME.hour, DEFAULT_TRAVEL_TIME.minute);
}

export function createDefaultDates(now: Date = new Date()): {
  examDate: IsoDateTime;
  travelDate: IsoDateTime;
} {
  const exam = defaultExamDate(now);
  return { examDate: exam.toISOString(), travelDate: defaultTravelDate(exam).toISOString() };
}

/* ------------------------------------------------------------------ */
/* Sample study plan                                                   */
/* ------------------------------------------------------------------ */

interface SubjectBlueprint {
  key: 'dbms' | 'cn' | 'os' | 'apt' | 'toc';
  name: string;
  code: string;
  color: AccentKey;
  icon: IconName;
  /** Paper is this many days before the main exam (0 = the main exam itself). */
  daysBeforeMainExam: number;
  venue: string;
  /** [title, done] */
  chapters: readonly (readonly [string, boolean])[];
  /** [title, years before now (undefined = no year), done] */
  papers: readonly (readonly [string, number | undefined, boolean])[];
  notes: string;
}

const SUBJECTS: readonly SubjectBlueprint[] = [
  {
    key: 'dbms',
    name: 'Database Management System',
    code: 'DBMS',
    color: 'purple',
    icon: 'database',
    daysBeforeMainExam: 0,
    venue: 'Main Block · Hall A',
    chapters: [
      ['Introduction to DBMS', true],
      ['ER Model', true],
      ['Relational Algebra', true],
      ['SQL Queries', true],
      ['Normalization', true],
      ['Transaction Management', false],
      ['Indexing & Hashing', true],
      ['Functional Dependencies', true],
      ['File Organization', true],
      ['Query Processing', true],
      ['Recovery System', true],
      ['Stored Procedures & Triggers', true],
      ['Concurrency Control', false],
    ],
    papers: [
      ['University Paper', 1, true],
      ['University Paper', 2, true],
      ['University Paper', 3, false],
      ['Model Question Paper', undefined, false],
    ],
    notes:
      'A database management system stores data and controls concurrent access to it. ' +
      'The ER model describes entities, attributes and the relationships between them. ' +
      'Relational algebra uses operators such as selection, projection, join and union on relations. ' +
      'Normalization removes redundancy: first normal form needs atomic values, second normal form removes partial dependencies, ' +
      'third normal form removes transitive dependencies, and BCNF requires every determinant to be a candidate key. ' +
      'A transaction must satisfy the ACID properties: atomicity, consistency, isolation and durability. ' +
      'Concurrency control uses locking protocols such as two-phase locking to guarantee serializability. ' +
      'Indexing speeds up lookups with B+ trees, while hashing gives constant-time access for equality searches.',
  },
  {
    key: 'cn',
    name: 'Computer Networks',
    code: 'CN',
    color: 'blue',
    icon: 'lan',
    daysBeforeMainExam: 3,
    venue: 'IT Block · Room 204',
    chapters: [
      ['Network Models (OSI & TCP/IP)', true],
      ['Physical Layer', true],
      ['Data Link Layer', true],
      ['MAC Protocols & Ethernet', true],
      ['Network Layer & IP Addressing', true],
      ['Routing Algorithms', true],
      ['Transport Layer (TCP & UDP)', true],
      ['Congestion Control', false],
      ['Application Layer (DNS, HTTP)', false],
      ['Network Security Basics', false],
    ],
    papers: [
      ['University Paper', 1, true],
      ['University Paper', 2, false],
      ['Mid-Semester Paper', 1, false],
    ],
    notes:
      'The OSI model has seven layers while the TCP/IP model has four. ' +
      'The data link layer handles framing, error detection with CRC and flow control. ' +
      'Ethernet uses CSMA/CD to manage access to a shared medium. ' +
      'IP addressing identifies hosts, and subnetting divides a network using a subnet mask. ' +
      'Distance vector routing shares tables with neighbours, while link state routing floods link information and runs Dijkstra. ' +
      'TCP is connection-oriented and reliable, using a three-way handshake and sliding windows; UDP is connectionless and lightweight. ' +
      'Congestion control in TCP uses slow start, congestion avoidance and fast retransmit.',
  },
  {
    key: 'os',
    name: 'Operating System',
    code: 'OS',
    color: 'cyan',
    icon: 'monitor',
    daysBeforeMainExam: 2,
    venue: 'Main Block · Hall C',
    chapters: [
      ['Introduction & System Calls', true],
      ['Processes & Threads', true],
      ['CPU Scheduling', true],
      ['Process Synchronization', true],
      ['Deadlocks', true],
      ['Memory Management', true],
      ['Virtual Memory', false],
      ['File Systems & Disk Scheduling', false],
    ],
    papers: [
      ['University Paper', 1, true],
      ['University Paper', 2, false],
      ['Model Question Paper', undefined, false],
    ],
    notes:
      'An operating system manages processes, memory, files and devices. ' +
      'A process is a program in execution, and threads share the address space of their process. ' +
      'CPU scheduling algorithms include FCFS, shortest job first, priority and round robin. ' +
      'Semaphores and mutexes solve the critical section problem in process synchronization. ' +
      'A deadlock needs mutual exclusion, hold and wait, no preemption and circular wait; the banker’s algorithm avoids it. ' +
      'Paging divides memory into fixed-size frames, and virtual memory uses demand paging with page replacement such as LRU.',
  },
  {
    key: 'apt',
    name: 'Aptitude',
    code: 'APT',
    color: 'pink',
    icon: 'calculator-variant',
    daysBeforeMainExam: 4,
    venue: 'Seminar Hall',
    chapters: [
      ['Quantitative Aptitude', true],
      ['Logical Reasoning', true],
      ['Verbal Ability', true],
      ['Data Interpretation', false],
      ['Puzzles & Seating Arrangement', false],
    ],
    papers: [
      ['Placement Mock Test', undefined, true],
      ['Previous Year Paper', 1, false],
    ],
    notes:
      'Percentages, ratios and averages form the core of quantitative aptitude. ' +
      'Time and work problems add up rates of work done per day. ' +
      'Speed equals distance divided by time, and relative speed matters for trains and boats. ' +
      'Compound interest grows on the accumulated amount, unlike simple interest. ' +
      'Data interpretation questions reward quick approximation from tables and charts.',
  },
  {
    key: 'toc',
    name: 'Theory of Computation',
    code: 'TOC',
    color: 'green',
    icon: 'book-open-variant',
    daysBeforeMainExam: 1,
    venue: 'IT Block · Room 101',
    chapters: [
      ['Alphabets, Strings & Languages', true],
      ['Deterministic Finite Automata', true],
      ['Non-deterministic Finite Automata', true],
      ['NFA to DFA Conversion', true],
      ['DFA Minimization', true],
      ['Regular Expressions', true],
      ['Regular Grammars', true],
      ['Pumping Lemma for Regular Languages', true],
      ['Closure Properties', true],
      ['Context-Free Grammars', true],
      ['Ambiguity & Simplification', true],
      ['Chomsky & Greibach Normal Forms', true],
      ['Pushdown Automata', true],
      ['Pumping Lemma for CFLs', true],
      ['Turing Machines', true],
      ['Variants of Turing Machines', true],
      ['Church–Turing Thesis', true],
      ['Decidability', true],
      ['Halting Problem & Reductions', false],
      ['P, NP & NP-Completeness', false],
    ],
    papers: [
      ['University Paper', 1, true],
      ['University Paper', 2, true],
      ['University Paper', 3, false],
    ],
    notes:
      'A deterministic finite automaton has exactly one transition per symbol from every state. ' +
      'Every NFA can be converted to an equivalent DFA using the subset construction. ' +
      'Regular expressions and finite automata describe exactly the regular languages. ' +
      'The pumping lemma proves that a language is not regular. ' +
      'Context-free grammars generate context-free languages, which pushdown automata recognise using a stack. ' +
      'A Turing machine has an infinite tape and can simulate any algorithm according to the Church–Turing thesis. ' +
      'The halting problem is undecidable, which is proved by contradiction using diagonalization.',
  },
];

/** Days ago on which sample chapters were completed — a 4-day run up to yesterday, then a gap. */
const STUDY_DAYS_AGO = [1, 2, 3, 4, 1, 2, 6, 3, 7, 4, 9, 10] as const;
const STUDY_HOURS = [21, 16, 22, 11, 19, 14, 23, 10, 18, 20] as const;

/** A moment earlier today (never before local midnight, never after `now`). */
function earlierToday(now: Date, minutesAgo: number): Date {
  return new Date(Math.max(startOfDay(now).getTime(), now.getTime() - minutesAgo * 60_000));
}

function paperDate(blueprint: SubjectBlueprint, examDate: Date, now: Date): Date {
  const candidate = addDays(examDate, -blueprint.daysBeforeMainExam);
  return candidate.getTime() > now.getTime() ? candidate : examDate;
}

export interface SamplePlanner {
  subjects: Subject[];
  tasks: StudyTask[];
}

export function createSamplePlanner(now: Date, examDate: Date = defaultExamDate(now)): SamplePlanner {
  // "Planned" the evening before so createdAt precedes every completion in the sample.
  const plannedAt = (day: Date, index: number) =>
    new Date(withTime(addDays(day, -1), 21, 0).getTime() + index * 60_000).toISOString();

  let doneIndex = 0;
  const ids = {} as Record<SubjectBlueprint['key'], string>;

  const subjects: Subject[] = SUBJECTS.map((blueprint, subjectIndex) => {
    const id = createId('sub_');
    ids[blueprint.key] = id;
    return {
      id,
      name: blueprint.name,
      code: blueprint.code,
      color: blueprint.color,
      icon: blueprint.icon,
      examDate: paperDate(blueprint, examDate, now).toISOString(),
      venue: blueprint.venue,
      chapters: blueprint.chapters.map(([title, done]) => {
        if (!done) return { id: createId('ch_'), title, done: false };
        const i = doneIndex++;
        const day = addDays(now, -STUDY_DAYS_AGO[i % STUDY_DAYS_AGO.length]);
        const doneAt = withTime(day, STUDY_HOURS[i % STUDY_HOURS.length], (i * 7) % 60);
        return { id: createId('ch_'), title, done: true, doneAt: doneAt.toISOString() };
      }),
      papers: blueprint.papers.map(([title, yearsAgo, done]) => ({
        id: createId('pp_'),
        title,
        year: yearsAgo === undefined ? undefined : String(now.getFullYear() - yearsAgo),
        done,
      })),
      notes: blueprint.notes,
      createdAt: plannedAt(addDays(now, -14), subjectIndex),
    };
  });

  interface TaskBlueprint {
    daysFromNow: number;
    title: string;
    detail?: string;
    subject?: SubjectBlueprint['key'];
    /** Minutes before `now` it was ticked off (today), or a clock time (past days). */
    done?: number | { hour: number; minute: number };
  }

  const blueprints: TaskBlueprint[] = [
    {
      daysFromNow: -2,
      title: 'Make OS Formula Sheet',
      detail: '(Operating System)',
      subject: 'os',
      done: { hour: 18, minute: 10 },
    },
    {
      daysFromNow: -1,
      title: 'Normalization Practice Set',
      detail: '(Databases)',
      subject: 'dbms',
      done: { hour: 20, minute: 30 },
    },
    // Today's missions, as in the reference: 2 of 3 done.
    { daysFromNow: 0, title: 'Revise Chapter 5', detail: '(Databases)', subject: 'dbms', done: 95 },
    { daysFromNow: 0, title: 'Complete Notes', detail: '(Computer Networks)', subject: 'cn' },
    { daysFromNow: 0, title: 'Solve Previous Papers', done: 40 },
    { daysFromNow: 1, title: 'Practice SQL Joins & Subqueries', detail: '(Databases)', subject: 'dbms' },
    { daysFromNow: 1, title: 'Revise Deadlocks & Scheduling', detail: '(Operating System)', subject: 'os' },
    { daysFromNow: 2, title: 'Aptitude Mock Test', detail: '(Aptitude)', subject: 'apt' },
    { daysFromNow: 2, title: 'Congestion Control Notes', detail: '(Computer Networks)', subject: 'cn' },
    {
      daysFromNow: 3,
      title: 'Halting Problem & Reductions',
      detail: '(Theory of Computation)',
      subject: 'toc',
    },
  ];

  const lastPlannableDay = toDayKey(examDate);
  const tasks: StudyTask[] = blueprints
    .filter((task) => task.daysFromNow <= 0 || toDayKey(addDays(now, task.daysFromNow)) <= lastPlannableDay)
    .map((task, index) => {
      const day = addDays(now, task.daysFromNow);
      let doneAt: Date | undefined;
      if (typeof task.done === 'number') doneAt = earlierToday(now, task.done);
      else if (task.done) doneAt = withTime(day, task.done.hour, task.done.minute);
      return {
        id: createId('task_'),
        title: task.title,
        detail: task.detail,
        subjectId: task.subject ? ids[task.subject] : undefined,
        day: toDayKey(day),
        done: Boolean(doneAt),
        doneAt: doneAt?.toISOString(),
        createdAt: plannedAt(task.daysFromNow > 0 ? now : day, index),
      };
    });

  return { subjects, tasks };
}

/* ------------------------------------------------------------------ */
/* Travel checklist                                                    */
/* ------------------------------------------------------------------ */

export function createDefaultChecklist(now: Date = new Date()): ChecklistItem[] {
  return defaultChecklist.map(({ title, category }, index) => ({
    id: createId('item_'),
    title,
    category,
    done: false,
    // Strictly increasing so the list keeps its display order when sorted by creation.
    createdAt: new Date(now.getTime() + index).toISOString(),
  }));
}

/* ------------------------------------------------------------------ */
/* Memory journal                                                      */
/* ------------------------------------------------------------------ */

interface MemoryBlueprint {
  kind: Memory['kind'];
  title: string;
  body: string;
  illustration?: IllustrationKey;
  /** Days ago + local clock time; omitted = right now. */
  when?: { daysAgo: number; hour: number; minute: number };
  favorite: boolean;
  sealedForYears?: number;
}

const MEMORIES: readonly MemoryBlueprint[] = [
  {
    kind: 'note',
    title: 'Dear Future Me',
    body:
      'Right now it’s late, the desk lamp is the only light on and I’m tired in a way that’s hard to explain. ' +
      'I hope you remember how hard you pushed this week, and that it was worth it. ' +
      'I hope you went home, slept for a whole day and hugged everyone a little too long. ' +
      'Whatever happened in the results — be proud of the person who kept going. Love, me.',
    favorite: false,
    sealedForYears: 1,
  },
  {
    kind: 'photo',
    title: 'Almost There',
    body: 'Sat on the hill behind the hostel and watched the sun go down. A few more papers, then the road home.',
    illustration: 'home-hero',
    when: { daysAgo: 1, hour: 18, minute: 10 },
    favorite: true,
  },
  {
    kind: 'note',
    title: 'First things I’ll do at home',
    body:
      '• Eat a proper home-cooked dinner (seconds, obviously)\n' +
      '• Sleep without setting an alarm\n' +
      '• Long walk with Dad in the evening\n' +
      '• Tell Grandma about every single exam\n' +
      '• Finally finish that novel I abandoned in September',
    when: { daysAgo: 2, hour: 22, minute: 15 },
    favorite: false,
  },
  {
    kind: 'photo',
    title: 'Late Night Study',
    body: 'Third coffee, half the DBMS syllabus done. The hostel is silent except for my keyboard.',
    illustration: 'study-planner',
    when: { daysAgo: 3, hour: 23, minute: 40 },
    favorite: true,
  },
  {
    kind: 'photo',
    title: 'Current Journey',
    body: 'Pictured the bus ride home today — mountains, sunset, window seat. That picture keeps me going.',
    illustration: 'home-journey',
    when: { daysAgo: 5, hour: 18, minute: 30 },
    favorite: true,
  },
];

/** Sample memories, newest first: 3 illustrated photos, 1 note and 1 sealed Future-Me letter. */
export function createSampleMemories(now: Date = new Date()): Memory[] {
  return MEMORIES.map((blueprint, index) => {
    const date = blueprint.when
      ? withTime(addDays(now, -blueprint.when.daysAgo), blueprint.when.hour, blueprint.when.minute)
      : new Date(now.getTime() - index);
    const iso = date.toISOString();
    return {
      id: createId('mem_'),
      kind: blueprint.kind,
      title: blueprint.title,
      body: blueprint.body,
      illustration: blueprint.illustration,
      date: iso,
      createdAt: iso,
      favorite: blueprint.favorite,
      sealedUntil: blueprint.sealedForYears ? addYears(now, blueprint.sealedForYears).toISOString() : undefined,
    };
  });
}
