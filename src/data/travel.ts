import type { IconName, TravelMode } from '@/types';

export interface TravelModeInfo {
  label: string;
  icon: IconName;
}

export const travelModes: Record<TravelMode, TravelModeInfo> = {
  bus: { label: 'Bus', icon: 'bus' },
  train: { label: 'Train', icon: 'train' },
  flight: { label: 'Flight', icon: 'airplane' },
  car: { label: 'Car', icon: 'car' },
};

/** Picker order for travel modes. */
export const travelModeOrder: readonly TravelMode[] = ['bus', 'train', 'flight', 'car'];

export function isTravelMode(value: unknown): value is TravelMode {
  return typeof value === 'string' && value in travelModes;
}
