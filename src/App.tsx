import { useEffect, useMemo, useState } from 'react';
import type {
  AppState,
  BodyMeasurement,
  FoodEntry,
  RecoveryInputs,
  TrainingSession,
  UserProfile,
} from './lib/types';
import {
  emptyDay,
  loadState,
  saveState,
  todayKey,
} from './lib/storage';
import { buildSampleState } from './lib/sampleData';
import { buildAdaptivePlan } from './lib/analysis';
import { Dashboard } from './components/Dashboard';
import { HeartRatePanel } from './components/HeartRatePanel';
import { FoodPanel } from './components/FoodPanel';
import { BodyPanel } from './components/BodyPanel';
import { TrainingPanel } from './components/TrainingPanel';
import { ProfilePanel } from './components/ProfilePanel';

export type Tab = 'dashboard' | 'heart' | 'food' | 'body' | 'training' | 'profile';

export interface AppApi {
  updateProfile: (p: Partial<UserProfile>) => void;
  addFood: (date: string, entry: FoodEntry) => void;
  removeFood: (date: string, id: string) => void;
  setBody: (date: string, body: BodyMeasurement) => void;
  addTraining: (date: string, s: TrainingSession) => void;
  removeTraining: (date: string, id: string) => void;
  patchRecovery: (date: string, r: Partial<RecoveryInputs>) => void;
  setWater: (date: string, ml: number) => void;
  loadDemo: () => void;
  clearAll: () => void;
}

function hasAnyData(s: AppState): boolean {
  return Object.values(s.days).some(
    (d) =>
      d.food.length > 0 ||
      d.training.length > 0 ||
      d.body != null ||
      Object.keys(d.recovery).length > 0,
  );
}

export default function App() {
  const [state, setState] = useState<AppState>(() => {
    const loaded = loadState();
    // First run: seed with a realistic demo so the engine has something to show.
    return hasAnyData(loaded) ? loaded : buildSampleState();
  });
  const [tab, setTab] = useState<Tab>('dashboard');
  const today = todayKey();

  useEffect(() => {
    saveState(state);
  }, [state]);

  const plan = useMemo(() => buildAdaptivePlan(state), [state]);

  const mutateDay = (
    date: string,
    fn: (d: AppState['days'][string]) => AppState['days'][string],
  ) =>
    setState((s) => {
      const day = s.days[date] ?? emptyDay(date);
      return { ...s, days: { ...s.days, [date]: fn(day) } };
    });

  const api: AppApi = {
    updateProfile: (p) =>
      setState((s) => ({ ...s, profile: { ...s.profile, ...p } })),
    addFood: (date, entry) =>
      mutateDay(date, (d) => ({ ...d, food: [...d.food, entry] })),
    removeFood: (date, id) =>
      mutateDay(date, (d) => ({
        ...d,
        food: d.food.filter((f) => f.id !== id),
      })),
    setBody: (date, body) => mutateDay(date, (d) => ({ ...d, body })),
    addTraining: (date, sess) =>
      mutateDay(date, (d) => ({ ...d, training: [...d.training, sess] })),
    removeTraining: (date, id) =>
      mutateDay(date, (d) => ({
        ...d,
        training: d.training.filter((t) => t.id !== id),
      })),
    patchRecovery: (date, r) =>
      mutateDay(date, (d) => ({ ...d, recovery: { ...d.recovery, ...r } })),
    setWater: (date, ml) => mutateDay(date, (d) => ({ ...d, waterMl: ml })),
    loadDemo: () => setState(buildSampleState()),
    clearAll: () =>
      setState((s) => ({ profile: s.profile, days: {} })),
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="dot" />
          Whoop-Alt
        </div>
        <span className="muted" style={{ fontSize: 13 }}>
          {state.profile.name} · {today}
        </span>
      </header>

      {tab === 'dashboard' && (
        <Dashboard state={state} plan={plan} api={api} today={today} setTab={setTab} />
      )}
      {tab === 'heart' && (
        <HeartRatePanel state={state} api={api} today={today} />
      )}
      {tab === 'food' && (
        <FoodPanel state={state} plan={plan} api={api} today={today} />
      )}
      {tab === 'body' && (
        <BodyPanel state={state} plan={plan} api={api} today={today} />
      )}
      {tab === 'training' && (
        <TrainingPanel state={state} api={api} today={today} />
      )}
      {tab === 'profile' && <ProfilePanel state={state} api={api} />}

      <nav className="nav">
        {(
          [
            ['dashboard', '◎', 'Overview'],
            ['heart', '♥', 'Heart'],
            ['food', '🍽', 'Food'],
            ['body', '⚖', 'Body'],
            ['training', '🏋', 'Train'],
            ['profile', '⚙', 'Profile'],
          ] as [Tab, string, string][]
        ).map(([key, icon, label]) => (
          <button
            key={key}
            className={tab === key ? 'active' : ''}
            onClick={() => setTab(key)}
          >
            <span className="ico">{icon}</span>
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
