import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { useAchievementWatcher } from '@/hooks/useAchievementWatcher';
import { useAppStore } from '@/store/app';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Renders the hook into a host element so its result can be read from props. */
function Probe() {
  const { current, dismiss } = useAchievementWatcher();
  return createElement('probe', { current: current?.id ?? null, dismiss });
}

let renderer: ReactTestRenderer | null = null;

async function mount() {
  await act(async () => {
    renderer = create(createElement(Probe));
  });
}

async function unmount() {
  await act(async () => renderer?.unmount());
  renderer = null;
}

const probe = () => renderer!.root.findByType('probe' as never).props as { current: string | null; dismiss(): void };

async function run(action: () => void) {
  await act(async () => action());
}

function onboardWithSample() {
  const { examDate, travelDate } = useAppStore.getState();
  useAppStore.getState().completeOnboarding({ name: 'Arjun', examDate, travelDate, useSamplePlan: true });
}

beforeAll(flush);

beforeEach(() => {
  useAppStore.getState().resetApp();
});

afterEach(unmount);

describe('useAchievementWatcher', () => {
  it('unlocks badges earned by the sample plan silently at onboarding', async () => {
    await mount();
    await run(onboardWithSample);

    expect(probe().current).toBeNull();
    expect(Object.keys(useAppStore.getState().unlockedAchievements)).toEqual(
      expect.arrayContaining(['first-step', 'streak-3', 'chapter-10', 'prepared-80', 'memory-keeper', 'time-capsule']),
    );
  });

  it('queues newly earned badges afterwards, one toast at a time', async () => {
    await mount();
    await run(onboardWithSample);

    await run(() => useAppStore.getState().incrementStat('breathingSessions', 3));
    expect(probe().current).toBe('zen-mode');

    await run(() => useAppStore.getState().incrementStat('aiQuestions', 5));
    expect(probe().current).toBe('zen-mode');

    await run(() => probe().dismiss());
    expect(probe().current).toBe('ai-curious');

    await run(() => probe().dismiss());
    expect(probe().current).toBeNull();
    expect(useAppStore.getState().unlockedAchievements).toHaveProperty('ai-curious');
  });

  it('does not toast badges that were already satisfied when the app starts', async () => {
    onboardWithSample();
    useAppStore.getState().markExamCompleted();

    await mount();
    expect(probe().current).toBeNull();
    expect(useAppStore.getState().unlockedAchievements).toHaveProperty('exam-conqueror');

    // A badge earned after start-up is celebrated.
    await run(() => useAppStore.getState().incrementStat('breathingSessions', 3));
    expect(probe().current).toBe('zen-mode');
  });

  it('never re-announces an unlocked badge and clears the queue on reset', async () => {
    await mount();
    await run(onboardWithSample);
    await run(() => useAppStore.getState().incrementStat('breathingSessions', 3));
    await run(() => useAppStore.getState().incrementStat('breathingSessions'));
    await run(() => probe().dismiss());
    expect(probe().current).toBeNull();

    await run(() => useAppStore.getState().incrementStat('aiQuestions', 5));
    expect(probe().current).toBe('ai-curious');
    await run(() => useAppStore.getState().resetApp());
    expect(probe().current).toBeNull();
  });
});
