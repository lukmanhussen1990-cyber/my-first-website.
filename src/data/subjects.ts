import { accentKeys } from '@/theme/colors';
import type { AccentKey, IconName } from '@/types';

/** Icons offered in the add/edit subject picker. */
export const subjectIconOptions: readonly IconName[] = [
  'database',
  'lan',
  'monitor',
  'calculator-variant',
  'book-open-variant',
  'flask',
  'code-braces',
  'chart-line',
  'atom',
  'translate',
  'brain',
  'pencil-ruler',
];

/** Colour swatches for subjects — every theme accent. */
export const subjectColorOptions: readonly AccentKey[] = accentKeys;

export const DEFAULT_SUBJECT_ICON: IconName = 'book-open-variant';
export const DEFAULT_SUBJECT_COLOR: AccentKey = 'purple';

/**
 * Short code suggestion from a subject name: "Computer Networks" → "CN",
 * "Aptitude" → "APT". Used to prefill the code field.
 */
export function suggestSubjectCode(name: string): string {
  const words = name
    .split(/[^A-Za-z0-9]+/)
    .filter((word) => word && !/^(of|and|the|for|in|to|&)$/i.test(word));
  if (words.length === 0) return '';
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words
    .map((word) => word[0])
    .join('')
    .slice(0, 5)
    .toUpperCase();
}
