import type {
  BodyMeasurement,
  DayLog,
  DayMetrics,
  Sex,
  TrainingSession,
  UserProfile,
} from './types';

const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));

/** Maximum heart rate estimate (Tanaka formula). */
export const estimateMaxHr = (age: number): number => 208 - 0.7 * age;

/** Mifflin-St Jeor basal metabolic rate. */
export function basalMetabolicRate(
  sex: Sex,
  weightKg: number,
  heightCm: number,
  age: number,
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(sex === 'male' ? base + 5 : base - 161);
}

/**
 * Strain for one session on a 0-21 scale (Whoop-like).
 * Uses time spent relative to HR reserve when HR is available, otherwise a
 * duration x intensity proxy from RPE. Multiple sessions combine sub-additively.
 */
export function sessionStrain(
  session: TrainingSession,
  profile: UserProfile,
): number {
  const maxHr = estimateMaxHr(profile.age);
  let intensity: number;

  if (session.avgHr && session.avgHr > 0) {
    // Fraction of max HR, weighted so higher zones cost disproportionately more.
    const frac = clamp(session.avgHr / maxHr, 0.4, 1);
    intensity = Math.pow((frac - 0.4) / 0.6, 1.6); // 0..1
  } else if (session.rpe) {
    intensity = clamp(session.rpe / 10, 0, 1);
  } else {
    intensity = session.type === 'mobility' ? 0.15 : 0.5;
  }

  const minutes = clamp(session.durationMin, 0, 300);
  const load = intensity * minutes; // arbitrary load units
  // Logarithmic compression into 0-21.
  return clamp(Math.log1p(load) * 3.4, 0, 21);
}

export function dayStrain(day: DayLog, profile: UserProfile): number {
  if (!day.training.length) return 0;
  const loads = day.training
    .map((s) => sessionStrain(s, profile))
    .sort((a, b) => b - a);
  // Sub-additive: each additional session contributes with diminishing weight.
  let total = 0;
  loads.forEach((l, i) => {
    total += l / (i + 1);
  });
  return clamp(total, 0, 21);
}

/**
 * Recovery score (0-100) from HRV, resting HR and sleep, each compared to a
 * rolling personal baseline. This is the heart of "how is my body coping".
 */
export function recoveryScore(
  day: DayLog,
  baseline: { restingHr: number | null; hrv: number | null },
): number | null {
  const r = day.recovery;
  const parts: number[] = [];
  const weights: number[] = [];

  if (r.hrvMs != null && baseline.hrv) {
    // Higher HRV than baseline is good. Map ratio 0.6..1.4 -> 0..100.
    const ratio = r.hrvMs / baseline.hrv;
    parts.push(clamp((ratio - 0.6) / 0.8, 0, 1) * 100);
    weights.push(0.5);
  }
  if (r.restingHr != null && baseline.restingHr) {
    // Lower resting HR than baseline is good.
    const ratio = baseline.restingHr / r.restingHr;
    parts.push(clamp((ratio - 0.85) / 0.3, 0, 1) * 100);
    weights.push(0.3);
  }
  if (r.sleepHours != null) {
    const sleepScore = clamp(r.sleepHours / 8, 0, 1) * 100;
    const quality = r.sleepQuality != null ? r.sleepQuality / 10 : 1;
    parts.push(sleepScore * quality);
    weights.push(0.2);
  }

  if (!parts.length) return null;
  const wSum = weights.reduce((a, b) => a + b, 0);
  const score = parts.reduce((acc, p, i) => acc + p * weights[i], 0) / wSum;
  return Math.round(clamp(score, 0, 100));
}

export function dayNutrition(day: DayLog): DayMetrics['nutrition'] {
  return day.food.reduce(
    (acc, f) => ({
      calories: acc.calories + f.calories,
      protein: acc.protein + f.protein,
      carbs: acc.carbs + f.carbs,
      fat: acc.fat + f.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

export function deriveBodyComposition(b: BodyMeasurement): BodyMeasurement {
  if (b.bodyFatPct != null) {
    const fatMassKg = (b.weightKg * b.bodyFatPct) / 100;
    return {
      ...b,
      fatMassKg: Math.round(fatMassKg * 100) / 100,
      leanMassKg: Math.round((b.weightKg - fatMassKg) * 100) / 100,
    };
  }
  return b;
}

/** Rolling baseline: mean of the last `window` available values. */
export function rollingBaseline(
  values: (number | null | undefined)[],
  window = 14,
): number | null {
  const present = values.filter((v): v is number => v != null);
  if (!present.length) return null;
  const slice = present.slice(-window);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

export interface Point {
  x: number; // day index
  y: number;
}

/** Ordinary least squares slope; returns units of y per x-step. */
export function linearSlope(points: Point[]): number | null {
  if (points.length < 2) return null;
  const n = points.length;
  const sumX = points.reduce((a, p) => a + p.x, 0);
  const sumY = points.reduce((a, p) => a + p.y, 0);
  const sumXY = points.reduce((a, p) => a + p.x * p.y, 0);
  const sumXX = points.reduce((a, p) => a + p.x * p.x, 0);
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null;
  return (n * sumXY - sumX * sumY) / denom;
}

export function computeDayMetrics(
  day: DayLog,
  profile: UserProfile,
  baseline: { restingHr: number | null; hrv: number | null },
): DayMetrics {
  return {
    date: day.date,
    recoveryScore: recoveryScore(day, baseline),
    strain: Math.round(dayStrain(day, profile) * 10) / 10,
    nutrition: dayNutrition(day),
  };
}
