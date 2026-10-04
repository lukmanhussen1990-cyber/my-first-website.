import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAppStore } from '@/store/app';
import { useChatStore, MAX_CHAT_MESSAGES } from '@/store/chat';
import { useJournalStore } from '@/store/journal';
import { usePlannerStore } from '@/store/planner';
import { computeStreak, overallProgress, tasksForDay } from '@/store/selectors';
import { areStoresHydrated } from '@/store/storage';
import { useTravelStore } from '@/store/travel';
import { toDayKey } from '@/utils/date';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

/** Lets pending AsyncStorage promises (hydration, writes) settle. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

async function storedState(key: string) {
  await flush();
  const raw = await AsyncStorage.getItem(key);
  return raw ? (JSON.parse(raw) as { state: Record<string, unknown>; version: number }) : null;
}

beforeAll(flush);

beforeEach(() => {
  useAppStore.getState().resetApp();
});

describe('hydration', () => {
  it('marks every store hydrated even when storage is empty', () => {
    expect(useAppStore.getState().hydrated).toBe(true);
    expect(areStoresHydrated()).toBe(true);
  });

  it('persists under lastmile.<store> with version 1, without transient fields', async () => {
    useAppStore.getState().setHaptics(false);
    useChatStore.getState().setPending(true);
    useChatStore.getState().addMessage({ role: 'user', text: 'Hi', mode: 'chat' });

    const app = await storedState('lastmile.app');
    expect(app?.version).toBe(1);
    expect(app?.state).not.toHaveProperty('hydrated');
    expect(app?.state).toMatchObject({ settings: { haptics: false } });

    const chat = await storedState('lastmile.chat');
    expect(chat?.state).not.toHaveProperty('pending');
    expect(chat?.state.messages).toHaveLength(1);
  });

  it('deep-merges stored settings over defaults on rehydrate', async () => {
    await AsyncStorage.setItem(
      'lastmile.app',
      JSON.stringify({
        version: 1,
        state: { hasOnboarded: true, settings: { theme: 'light', notifications: { enabled: true } } },
      }),
    );
    await useAppStore.persist.rehydrate();
    const { settings, hasOnboarded, hydrated } = useAppStore.getState();
    expect(hasOnboarded).toBe(true);
    expect(hydrated).toBe(true);
    expect(settings.theme).toBe('light');
    expect(settings.haptics).toBe(true);
    expect(settings.notifications).toMatchObject({
      enabled: true,
      studyReminder: true,
      studyReminderTime: { hour: 19, minute: 0 },
    });
  });

  it('survives corrupt stored JSON', async () => {
    usePlannerStore.getState().addTask({ title: 'Keep me', day: '2026-10-08' });
    await flush();
    await AsyncStorage.setItem('lastmile.planner', '{not json');
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(usePlannerStore.persist.rehydrate()).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('lastmile.planner'), expect.any(SyntaxError));
    warn.mockRestore();
    expect(usePlannerStore.getState().tasks.map((t) => t.title)).toEqual(['Keep me']);
  });
});

describe('planner store', () => {
  const addDbms = () =>
    usePlannerStore.getState().addSubject({
      name: ' Database Management System ',
      code: 'DBMS',
      color: 'purple',
      icon: 'database',
      chapters: ['ER Model', '  ', 'SQL Queries'],
    });

  it('adds a subject with trimmed name and non-blank chapters', () => {
    const id = addDbms();
    const subject = usePlannerStore.getState().subjects.find((s) => s.id === id);
    expect(subject?.name).toBe('Database Management System');
    expect(subject?.chapters.map((c) => c.title)).toEqual(['ER Model', 'SQL Queries']);
    expect(subject?.chapters.every((c) => !c.done)).toBe(true);
  });

  it('toggleChapter sets and clears doneAt', () => {
    const id = addDbms();
    const chapterId = usePlannerStore.getState().subjects[0].chapters[0].id;

    usePlannerStore.getState().toggleChapter(id, chapterId);
    let chapter = usePlannerStore.getState().subjects[0].chapters[0];
    expect(chapter.done).toBe(true);
    expect(chapter.doneAt).toEqual(expect.any(String));
    expect(Date.now() - new Date(chapter.doneAt as string).getTime()).toBeLessThan(5_000);

    usePlannerStore.getState().toggleChapter(id, chapterId);
    chapter = usePlannerStore.getState().subjects[0].chapters[0];
    expect(chapter.done).toBe(false);
    expect(chapter.doneAt).toBeUndefined();
  });

  it('removeSubject clears subjectId on its tasks only', () => {
    const dbms = addDbms();
    const other = usePlannerStore.getState().addSubject({ name: 'OS', color: 'cyan', icon: 'monitor' });
    const { addTask } = usePlannerStore.getState();
    const linked = addTask({ title: 'Revise SQL', subjectId: dbms, day: '2026-10-08' });
    const unrelated = addTask({ title: 'Deadlocks', subjectId: other, day: '2026-10-08' });

    usePlannerStore.getState().removeSubject(dbms);
    const { subjects, tasks } = usePlannerStore.getState();
    expect(subjects.map((s) => s.id)).toEqual([other]);
    expect(tasks.find((t) => t.id === linked)?.subjectId).toBeUndefined();
    expect(tasks.find((t) => t.id === linked)?.title).toBe('Revise SQL');
    expect(tasks.find((t) => t.id === unrelated)?.subjectId).toBe(other);
  });

  it('manages chapters, papers and notes', () => {
    const id = addDbms();
    const store = () => usePlannerStore.getState();
    store().addChapter(id, '  ');
    store().addChapter(id, 'Normalization');
    const normalization = store().subjects[0].chapters[2];
    expect(normalization.title).toBe('Normalization');

    store().renameChapter(id, normalization.id, 'Normal Forms');
    store().removeChapter(id, store().subjects[0].chapters[0].id);
    expect(store().subjects[0].chapters.map((c) => c.title)).toEqual(['SQL Queries', 'Normal Forms']);

    store().addPaper(id, 'University Paper', '2025');
    const paper = store().subjects[0].papers[0];
    store().togglePaper(id, paper.id);
    expect(store().subjects[0].papers[0]).toMatchObject({ title: 'University Paper', year: '2025', done: true });
    store().removePaper(id, paper.id);
    expect(store().subjects[0].papers).toEqual([]);

    store().setNotes(id, 'ACID: atomicity, consistency, isolation, durability.');
    expect(store().subjects[0].notes).toContain('ACID');
  });

  it('toggleTask sets and clears doneAt; update and remove work', () => {
    const id = usePlannerStore.getState().addTask({ title: ' Complete Notes ', detail: '', day: '2026-10-08' });
    const find = () => usePlannerStore.getState().tasks.find((t) => t.id === id);
    expect(find()).toMatchObject({ title: 'Complete Notes', done: false });
    expect(find()?.detail).toBeUndefined();

    usePlannerStore.getState().toggleTask(id);
    expect(find()?.doneAt).toEqual(expect.any(String));
    usePlannerStore.getState().toggleTask(id);
    expect(find()?.doneAt).toBeUndefined();

    usePlannerStore.getState().updateTask(id, { day: '2026-10-09' });
    expect(find()?.day).toBe('2026-10-09');
    usePlannerStore.getState().removeTask(id);
    expect(find()).toBeUndefined();
  });
});

describe('journal store', () => {
  it('adds memories newest first with favorite defaulting to false', () => {
    const { addMemory } = useJournalStore.getState();
    const first = addMemory({ kind: 'note', title: 'First', date: new Date().toISOString() });
    const second = addMemory({ kind: 'photo', title: 'Second', date: new Date().toISOString(), favorite: true });

    const { memories } = useJournalStore.getState();
    expect(memories.map((m) => m.id)).toEqual([second, first]);
    expect(memories[1].favorite).toBe(false);
    expect(memories[0].favorite).toBe(true);
  });

  it('toggles favourites, updates and removes', () => {
    const id = useJournalStore.getState().addMemory({ kind: 'note', title: 'Note', date: new Date().toISOString() });
    useJournalStore.getState().toggleFavorite(id);
    useJournalStore.getState().updateMemory(id, { title: 'Renamed' });
    expect(useJournalStore.getState().memories[0]).toMatchObject({ title: 'Renamed', favorite: true });
    useJournalStore.getState().removeMemory(id);
    expect(useJournalStore.getState().memories).toEqual([]);
  });
});

describe('travel store', () => {
  it('seeds defaults idempotently without touching custom items', () => {
    const { seedDefaults, addItem } = useTravelStore.getState();
    addItem({ title: 'Guitar', category: 'essentials' });
    seedDefaults();
    seedDefaults();
    const titles = useTravelStore.getState().items.map((i) => i.title);
    expect(titles).toHaveLength(11);
    expect(titles[0]).toBe('Guitar');
    expect(titles).toContain('Book Train/Bus/Flight Tickets');
  });

  it('toggles, renames, removes and unchecks all', () => {
    const store = () => useTravelStore.getState();
    const a = store().addItem({ title: 'Hall ticket', category: 'documents' });
    const b = store().addItem({ title: 'Sweets', category: 'gifts' });
    store().toggleItem(a);
    store().toggleItem(b);
    store().renameItem(b, 'Sweets for Mum');
    expect(store().items.every((i) => i.done)).toBe(true);
    store().uncheckAll();
    expect(store().items.some((i) => i.done)).toBe(false);
    store().removeItem(a);
    expect(store().items.map((i) => i.title)).toEqual(['Sweets for Mum']);
  });
});

describe('chat store', () => {
  it(`keeps the last ${MAX_CHAT_MESSAGES} messages and updates by id`, () => {
    const { addMessage } = useChatStore.getState();
    let lastId = '';
    for (let i = 0; i < MAX_CHAT_MESSAGES + 5; i += 1) {
      lastId = addMessage({ role: i % 2 ? 'assistant' : 'user', text: `#${i}`, mode: 'chat' });
    }
    const { messages } = useChatStore.getState();
    expect(messages).toHaveLength(MAX_CHAT_MESSAGES);
    expect(messages[0].text).toBe('#5');

    useChatStore.getState().updateMessage(lastId, { text: 'edited', source: 'offline' });
    expect(useChatStore.getState().messages.at(-1)).toMatchObject({ id: lastId, text: 'edited', source: 'offline' });

    useChatStore.getState().clear();
    expect(useChatStore.getState()).toMatchObject({ messages: [], pending: false });
  });
});

describe('app store', () => {
  it('unlockAchievement returns true only the first time', () => {
    const { unlockAchievement } = useAppStore.getState();
    expect(unlockAchievement('zen-mode')).toBe(true);
    expect(unlockAchievement('zen-mode')).toBe(false);
    expect(useAppStore.getState().unlockedAchievements['zen-mode']).toEqual(expect.any(String));
  });

  it('increments stats and updates nested settings', () => {
    const store = () => useAppStore.getState();
    store().incrementStat('breathingSessions');
    store().incrementStat('calmSeconds', 60);
    expect(store().stats).toEqual({ breathingSessions: 1, aiQuestions: 0, calmSeconds: 60 });

    store().updateNotificationSettings({ enabled: true });
    store().setCalendarSync({ calendarId: 'cal-1' });
    store().setTheme('system');
    store().updateTicket({ booked: true, reference: 'PNR123' });
    expect(store().settings.notifications).toMatchObject({ enabled: true, dailyMotivation: true });
    expect(store().settings).toMatchObject({ theme: 'system', calendar: { calendarId: 'cal-1' } });
    expect(store().ticket).toEqual({ mode: 'bus', booked: true, reference: 'PNR123' });
  });

  it('defaults to the next 12 October 09:00 with travel at 18:00 the same day', () => {
    const exam = new Date(useAppStore.getState().examDate);
    const travel = new Date(useAppStore.getState().travelDate);
    expect([exam.getMonth(), exam.getDate(), exam.getHours(), exam.getMinutes()]).toEqual([9, 12, 9, 0]);
    expect(exam.getTime()).toBeGreaterThan(Date.now());
    expect(toDayKey(travel)).toBe(toDayKey(exam));
    expect(travel.getHours()).toBe(18);
  });

  it('marks and undoes exam completion', () => {
    useAppStore.getState().markExamCompleted();
    expect(useAppStore.getState().examCompletedAt).toEqual(expect.any(String));
    useAppStore.getState().undoExamCompleted();
    expect(useAppStore.getState().examCompletedAt).toBeUndefined();
  });

  it('completeOnboarding with the sample plan seeds planner, journal and travel', () => {
    const examDate = new Date(Date.now() + 5 * 86_400_000).toISOString();
    const travelDate = new Date(Date.now() + 5.5 * 86_400_000).toISOString();
    useAppStore.getState().completeOnboarding({
      name: ' Arjun ',
      examDate,
      travelDate,
      homeCity: 'Kochi',
      travelMode: 'train',
      useSamplePlan: true,
    });

    const app = useAppStore.getState();
    expect(app).toMatchObject({ hasOnboarded: true, examDate, travelDate, profile: { name: 'Arjun', homeCity: 'Kochi' } });
    expect(app.ticket.mode).toBe('train');

    const { subjects, tasks } = usePlannerStore.getState();
    expect(subjects.map((s) => s.code)).toEqual(['DBMS', 'CN', 'OS', 'APT', 'TOC']);
    expect(Math.round(overallProgress(subjects).progress * 100)).toBe(80);
    const today = tasksForDay(tasks, toDayKey(new Date()));
    expect(today.filter((t) => t.done)).toHaveLength(2);
    expect(today).toHaveLength(3);
    expect(computeStreak(subjects, tasks, new Date()).current).toBe(5);
    // The last paper is the main exam itself.
    expect(subjects.find((s) => s.code === 'DBMS')?.examDate).toBe(examDate);

    expect(useJournalStore.getState().memories).toHaveLength(5);
    expect(useTravelStore.getState().items).toHaveLength(10);
  });

  it('completeOnboarding without the sample plan only seeds the checklist', () => {
    const { examDate, travelDate } = useAppStore.getState();
    useAppStore.getState().completeOnboarding({ name: 'Arjun', examDate, travelDate, useSamplePlan: false });
    expect(usePlannerStore.getState().subjects).toEqual([]);
    expect(useJournalStore.getState().memories).toEqual([]);
    expect(useTravelStore.getState().items).toHaveLength(10);
    expect(useAppStore.getState().ticket.mode).toBe('bus');
  });

  it('resetApp resets every store and returns to onboarding', () => {
    const { examDate, travelDate } = useAppStore.getState();
    useAppStore.getState().completeOnboarding({ name: 'Arjun', examDate, travelDate, useSamplePlan: true });
    useAppStore.getState().unlockAchievement('first-step');
    useAppStore.getState().incrementStat('aiQuestions');
    useChatStore.getState().addMessage({ role: 'user', text: 'Hi', mode: 'chat' });

    useAppStore.getState().resetApp();

    const app = useAppStore.getState();
    expect(app).toMatchObject({ hasOnboarded: false, hydrated: true, unlockedAchievements: {}, profile: { name: '' } });
    expect(app.stats.aiQuestions).toBe(0);
    expect(usePlannerStore.getState()).toMatchObject({ subjects: [], tasks: [] });
    expect(useJournalStore.getState().memories).toEqual([]);
    expect(useTravelStore.getState().items).toEqual([]);
    expect(useChatStore.getState().messages).toEqual([]);
  });
});
