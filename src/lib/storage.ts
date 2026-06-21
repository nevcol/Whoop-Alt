import type { AppState, DayLog, UserProfile } from './types';

const STORAGE_KEY = 'whoop-alt-state-v1';

export const todayKey = (d: Date = new Date()): string => {
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
};

export const defaultProfile: UserProfile = {
  name: 'Athlete',
  sex: 'male',
  age: 30,
  heightCm: 178,
  goal: 'recomp',
};

export const emptyDay = (date: string): DayLog => ({
  date,
  food: [],
  training: [],
  recovery: {},
});

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed.profile && parsed.days) return parsed;
    }
  } catch (err) {
    console.warn('Failed to load state, starting fresh', err);
  }
  return { profile: defaultProfile, days: {} };
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('Failed to save state', err);
  }
}

export const uid = (): string =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/** Return days sorted ascending by date. */
export function sortedDays(state: AppState): DayLog[] {
  return Object.values(state.days).sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
  );
}
