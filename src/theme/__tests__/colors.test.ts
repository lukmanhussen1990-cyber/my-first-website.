import { resolveScheme } from '../ThemeProvider';
import { withAlpha } from '../colors';

describe('theme', () => {
  it('adds alpha to hex colours', () => {
    expect(withAlpha('#7C5CFF', 0.5)).toBe('#7C5CFF80');
    expect(withAlpha('#7C5CFF', 2)).toBe('#7C5CFFff');
  });

  it('resolves the colour scheme from the preference', () => {
    expect(resolveScheme('system', 'light')).toBe('light');
    expect(resolveScheme('system', null)).toBe('dark');
    expect(resolveScheme('light', 'dark')).toBe('light');
  });
});
