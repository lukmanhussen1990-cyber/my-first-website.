import { buildRevisionPlan, createRevisionSchedule, explainTopic, generateClozeMCQs, offlineReply, summarizeText } from '../offline';
import type { StudyContext, ChatMessage } from '@/types';

const NOTES = `Normalization
Normalization is the process of organizing data in a database to reduce redundancy and improve data integrity.
- First normal form (1NF) requires that every column holds atomic values.
- Second normal form (2NF) removes partial dependencies on a composite primary key.
- Third normal form (3NF) removes transitive dependencies between non-key attributes.

A primary key uniquely identifies each row in a table. A foreign key refers to the primary key of another table, which enforces referential integrity.
Denormalization deliberately adds redundancy to speed up read-heavy queries, e.g. in reporting systems. Indexes also speed up queries but cost extra storage and slower writes.
Transactions follow the ACID properties: atomicity, consistency, isolation and durability.`;

const now = new Date(2026, 9, 5, 10, 0);
const iso = (d: number, h = 9) => new Date(2026, 9, d, h, 0).toISOString();

test('debug', () => {
  console.log(JSON.stringify(summarizeText(NOTES, 4), null, 2));
  console.log(JSON.stringify(generateClozeMCQs(NOTES, 5).map(q => [q.question, q.options.join(' | '), q.answerIndex]), null, 2));
  console.log(explainTopic('Explain how does TCP congestion control work?'));
  // long horizon
  const long: StudyContext = { today: '2026-10-05', examDate: new Date(2026, 11, 20, 9).toISOString(), subjects: [
    { name: 'Maths', progress: 0.2, remainingChapters: Array.from({length: 12}, (_, i) => `Ch ${i+1}`) },
    { name: 'Physics', progress: 0.4, remainingChapters: Array.from({length: 8}, (_, i) => `Unit ${i+1}`) },
  ]};
  console.log(buildRevisionPlan(long, now));
  // overload: paper in 3 days, 20 chapters
  const tight: StudyContext = { today: '2026-10-05', examDate: iso(8), subjects: [
    { name: 'A', progress: 0, remainingChapters: Array.from({length: 10}, (_, i) => `A${i+1}`) },
    { name: 'B', progress: 0, remainingChapters: Array.from({length: 10}, (_, i) => `B${i+1}`) },
  ]};
  console.log(buildRevisionPlan(tight, now));
  // crunch: paper tomorrow + one paper today
  const crunch: StudyContext = { today: '2026-10-05', examDate: iso(6), subjects: [
    { name: 'A', progress: 0, remainingChapters: ['A1', 'A2'] },
    { name: 'T', progress: 0.5, examDate: iso(5, 14), remainingChapters: ['T1'] },
  ]};
  console.log(buildRevisionPlan(crunch, now));
  console.log(buildRevisionPlan({ today: '2026-10-05', examDate: iso(1), subjects: [{ name: 'A', progress: 0.5, remainingChapters: ['x'] }] }, now));
  console.log(buildRevisionPlan({ today: '2026-10-05', examDate: iso(9), subjects: [{ name: 'A', progress: 1, remainingChapters: [] }] }, now));
  const ctx: StudyContext = { today: '2026-10-05', examDate: iso(12), subjects: [] };
  const history: ChatMessage[] = [{ id: '1', role: 'user', text: 'Summarize this:\n' + NOTES, mode: 'summarize', createdAt: now.toISOString() }];
  for (const [mode, p] of [['chat', 'Summarize this: ' + NOTES], ['chat', 'quiz me'], ['summarize', NOTES], ['chat', NOTES], ['mcq', 'Give me MCQs'], ['chat', 'what should I do?']] as const) {
    const r = offlineReply({ mode, prompt: p, history, context: ctx, now });
    console.log('>>> ' + mode + ' ' + p.slice(0, 30) + '\n' + r.text + '\nmcqs: ' + (r.mcqs ? r.mcqs.length : 'none'));
  }
});
