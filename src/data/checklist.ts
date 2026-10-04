import type { AccentKey, ChecklistCategory, ChecklistItem, IconName } from '@/types';

export interface ChecklistCategoryInfo {
  /** Short label for chips and filters ("Documents"). */
  label: string;
  /** Row title on the Journey screen's pre-travel summary ("Documents (ID, Hall Ticket)"). */
  title: string;
  icon: IconName;
  accent: AccentKey;
}

export const checklistCategories: Record<ChecklistCategory, ChecklistCategoryInfo> = {
  tickets: { label: 'Tickets', title: 'Book Tickets', icon: 'ticket', accent: 'orange' },
  packing: { label: 'Packing', title: 'Pack Clothes', icon: 'tshirt-crew', accent: 'purple' },
  documents: {
    label: 'Documents',
    title: 'Documents (ID, Hall Ticket)',
    icon: 'card-account-details',
    accent: 'blue',
  },
  gifts: { label: 'Gifts', title: 'Gifts for Family', icon: 'gift', accent: 'pink' },
  essentials: {
    label: 'Essentials',
    title: 'Chargers & Essentials',
    icon: 'power-plug',
    accent: 'cyan',
  },
};

/** Category display order (Journey summary rows, add-item picker). */
export const checklistCategoryOrder: readonly ChecklistCategory[] = [
  'tickets',
  'packing',
  'documents',
  'gifts',
  'essentials',
];

export type ChecklistFilter = 'all' | 'packing' | 'documents' | 'gifts' | 'others';

export interface ChecklistFilterOption {
  value: ChecklistFilter;
  label: string;
  categories: readonly ChecklistCategory[];
}

/** Filter tabs on the checklist screen. "Others" groups tickets + essentials. */
export const checklistFilters: readonly ChecklistFilterOption[] = [
  { value: 'all', label: 'All', categories: checklistCategoryOrder },
  { value: 'packing', label: 'Packing', categories: ['packing'] },
  { value: 'documents', label: 'Documents', categories: ['documents'] },
  { value: 'gifts', label: 'Gifts', categories: ['gifts'] },
  { value: 'others', label: 'Others', categories: ['tickets', 'essentials'] },
];

export function categoriesForFilter(filter: ChecklistFilter): readonly ChecklistCategory[] {
  return checklistFilters.find((option) => option.value === filter)?.categories ?? checklistCategoryOrder;
}

/** The filter tab that shows a category — used for `/checklist?category=` deep links. */
export function filterForCategory(category: ChecklistCategory): ChecklistFilter {
  const match = checklistFilters.find(
    (option) => option.value !== 'all' && option.categories.includes(category),
  );
  return match?.value ?? 'all';
}

export function isChecklistCategory(value: unknown): value is ChecklistCategory {
  return typeof value === 'string' && value in checklistCategories;
}

/** Keyword → icon hints so rows read at a glance (laptop, charger, medicines …). */
const ITEM_ICON_HINTS: readonly [RegExp, IconName][] = [
  [/laptop/i, 'laptop'],
  [/phone|charger|power ?bank/i, 'cellphone-charging'],
  [/medic|tablet|first aid/i, 'medical-bag'],
  [/snack|food|water/i, 'food-apple'],
  [/toilet|tooth|soap/i, 'toothbrush'],
  [/\bid\b|hall ticket|card|passport|licen[cs]e/i, 'card-account-details'],
  [/ticket|train|bus|flight/i, 'ticket'],
  [/gift|present|sweets/i, 'gift'],
  [/cloth|shirt|jacket|pack/i, 'tshirt-crew'],
];

/** Icon for a checklist row: a keyword match on the title, else the category icon. */
export function checklistItemIcon(item: Pick<ChecklistItem, 'title' | 'category'>): IconName {
  const hint = ITEM_ICON_HINTS.find(([pattern]) => pattern.test(item.title));
  return hint?.[1] ?? checklistCategories[item.category].icon;
}

/** Default pre-travel checklist, in display order. */
export const defaultChecklist: readonly { title: string; category: ChecklistCategory }[] = [
  { title: 'Book Train/Bus/Flight Tickets', category: 'tickets' },
  { title: 'Pack Clothes', category: 'packing' },
  { title: 'ID Card & Hall Ticket', category: 'documents' },
  { title: 'Laptop & Charger', category: 'essentials' },
  { title: 'Phone Charger', category: 'essentials' },
  { title: 'Gifts for Family', category: 'gifts' },
  { title: 'Medicines', category: 'packing' },
  { title: 'Other Essentials', category: 'essentials' },
  { title: 'Snacks for the Journey', category: 'packing' },
  { title: 'Toiletries', category: 'packing' },
];
