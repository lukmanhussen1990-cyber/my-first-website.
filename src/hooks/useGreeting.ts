import { useNow } from './useNow';

export type Greeting = 'Good morning' | 'Good afternoon' | 'Good evening' | 'Burning the midnight oil';

/** 05–11 morning · 12–16 afternoon · 17–22 evening · 23–04 midnight oil. */
export function greetingForHour(hour: number): Greeting {
  if (hour >= 23 || hour < 5) return 'Burning the midnight oil';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Time-of-day greeting, refreshed each minute. */
export function useGreeting(): Greeting {
  const now = useNow(60_000);
  return greetingForHour(now.getHours());
}
