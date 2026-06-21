// Core domain model for Whoop-Alt.
// Everything is keyed by an ISO date string (YYYY-MM-DD) so the analysis
// engine can line up nutrition, training, body composition and recovery
// for the same day and study how they influence each other over time.

export type Goal =
  | 'lose_fat'
  | 'build_muscle'
  | 'recomp'
  | 'maintain'
  | 'endurance';

export type Sex = 'male' | 'female';

export interface UserProfile {
  name: string;
  sex: Sex;
  age: number;
  heightCm: number;
  goal: Goal;
  // Optional manual baselines; the engine learns its own when data exists.
  restingHrBaseline?: number;
  hrvBaseline?: number;
}

/** A single nutrition entry for a day (one meal / item). */
export interface FoodEntry {
  id: string;
  name: string;
  calories: number;
  protein: number; // grams
  carbs: number; // grams
  fat: number; // grams
}

/** Body-composition measurement for a day. */
export interface BodyMeasurement {
  weightKg: number;
  bodyFatPct?: number;
  // Derived & stored for convenience when bodyFatPct is present.
  leanMassKg?: number;
  fatMassKg?: number;
}

export type TrainingType =
  | 'strength'
  | 'cardio'
  | 'hiit'
  | 'endurance'
  | 'mobility'
  | 'sport';

/** A training session. avgHr/maxHr can be filled from the HR monitor. */
export interface TrainingSession {
  id: string;
  type: TrainingType;
  durationMin: number;
  avgHr?: number;
  maxHr?: number;
  rpe?: number; // rate of perceived exertion 1-10
  notes?: string;
  // Estimated strain contribution (computed by the metrics engine).
  strain?: number;
}

/** Recovery inputs captured in the morning / from the HR monitor. */
export interface RecoveryInputs {
  restingHr?: number; // bpm
  hrvMs?: number; // rMSSD in ms
  sleepHours?: number;
  sleepQuality?: number; // 1-10 subjective
}

/** A complete day of logged data. */
export interface DayLog {
  date: string; // YYYY-MM-DD
  food: FoodEntry[];
  body?: BodyMeasurement;
  training: TrainingSession[];
  recovery: RecoveryInputs;
  waterMl?: number;
}

export interface AppState {
  profile: UserProfile;
  days: Record<string, DayLog>;
}

/** Output of the metrics engine for a single day. */
export interface DayMetrics {
  date: string;
  recoveryScore: number | null; // 0-100
  strain: number; // 0-21
  nutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

export type InsightTone = 'positive' | 'warning' | 'critical' | 'neutral';

export interface Insight {
  id: string;
  tone: InsightTone;
  title: string;
  detail: string;
}

/** The adaptive plan the engine produces from accumulated data. */
export interface AdaptivePlan {
  estimatedTdee: number | null; // learned maintenance calories
  calorieTarget: number | null;
  proteinTarget: number | null; // grams
  carbTarget: number | null; // grams
  fatTarget: number | null; // grams
  trainingGuidance: string;
  bodyTrend: {
    weightSlopeKgPerWeek: number | null;
    fatMassSlopeKgPerWeek: number | null;
    leanMassSlopeKgPerWeek: number | null;
  };
  recoveryTrend: number | null; // avg recovery over window
  insights: Insight[];
  lastUpdated: string;
}
