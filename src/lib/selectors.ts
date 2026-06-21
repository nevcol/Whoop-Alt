import type { AppState } from './types';
import {
  dayNutrition,
  dayStrain,
  deriveBodyComposition,
  recoveryScore,
  rollingBaseline,
} from './metrics';

export interface DaySeriesPoint {
  date: string;
  recovery: number | null;
  strain: number;
  calories: number | null;
  protein: number | null;
  weightKg: number | null;
  bodyFatPct: number | null;
  leanMassKg: number | null;
  fatMassKg: number | null;
  restingHr: number | null;
  hrvMs: number | null;
}

export function daySeries(state: AppState, lastN?: number): DaySeriesPoint[] {
  const days = Object.values(state.days).sort((a, b) =>
    a.date < b.date ? -1 : 1,
  );
  const restingHrBaseline =
    state.profile.restingHrBaseline ??
    rollingBaseline(days.map((d) => d.recovery.restingHr));
  const hrvBaseline =
    state.profile.hrvBaseline ?? rollingBaseline(days.map((d) => d.recovery.hrvMs));

  const out = days.map((day) => {
    const body = day.body ? deriveBodyComposition(day.body) : undefined;
    const nut = dayNutrition(day);
    return {
      date: day.date,
      recovery: recoveryScore(day, {
        restingHr: restingHrBaseline,
        hrv: hrvBaseline,
      }),
      strain: Math.round(dayStrain(day, state.profile) * 10) / 10,
      calories: day.food.length ? nut.calories : null,
      protein: day.food.length ? nut.protein : null,
      weightKg: body?.weightKg ?? null,
      bodyFatPct: body?.bodyFatPct ?? null,
      leanMassKg: body?.leanMassKg ?? null,
      fatMassKg: body?.fatMassKg ?? null,
      restingHr: day.recovery.restingHr ?? null,
      hrvMs: day.recovery.hrvMs ?? null,
    };
  });
  return lastN ? out.slice(-lastN) : out;
}
