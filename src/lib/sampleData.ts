import type { AppState, DayLog, TrainingType } from './types';
import { deriveBodyComposition } from './metrics';
import { uid } from './storage';

const dateNDaysAgo = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
};

// A simple deterministic pseudo-random so the demo is stable across reloads.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 35 days of plausible data for a lean-recomp athlete: gradual fat loss,
 * lean mass holding, with recovery responding to training load.
 */
export function buildSampleState(): AppState {
  const rand = mulberry32(42);
  const days: Record<string, DayLog> = {};
  const total = 35;

  // Starting body comp, drifting over time.
  let weight = 82.0;
  let bodyFat = 19.5;

  for (let i = total - 1; i >= 0; i--) {
    const date = dateNDaysAgo(i);
    const dow = new Date(date).getDay();

    // Body trend: slow fat loss, lean mass roughly held.
    weight -= 0.045 + (rand() - 0.5) * 0.25;
    bodyFat -= 0.04 + (rand() - 0.5) * 0.1;

    // Training schedule.
    const training: DayLog['training'] = [];
    const plan: Record<number, { type: TrainingType; dur: number; hr: number }> =
      {
        1: { type: 'strength', dur: 60, hr: 128 },
        2: { type: 'cardio', dur: 40, hr: 145 },
        3: { type: 'strength', dur: 65, hr: 126 },
        4: { type: 'mobility', dur: 30, hr: 95 },
        5: { type: 'hiit', dur: 35, hr: 158 },
        6: { type: 'endurance', dur: 75, hr: 138 },
      };
    const t = plan[dow];
    if (t) {
      training.push({
        id: uid(),
        type: t.type,
        durationMin: t.dur + Math.round((rand() - 0.5) * 10),
        avgHr: t.hr + Math.round((rand() - 0.5) * 8),
        maxHr: t.hr + 25 + Math.round(rand() * 10),
        rpe: Math.min(10, Math.max(3, Math.round(5 + rand() * 4))),
      });
    }

    // Recovery responds inversely to yesterday's load + noise.
    const hardYesterday =
      plan[(dow + 6) % 7]?.type === 'hiit' ||
      plan[(dow + 6) % 7]?.type === 'strength';
    const restingHr = 52 + (hardYesterday ? 4 : 0) + Math.round((rand() - 0.5) * 5);
    const hrvMs = 78 - (hardYesterday ? 12 : 0) + Math.round((rand() - 0.5) * 16);
    const sleepHours = 7 + (rand() - 0.4) * 1.8;

    // Nutrition: roughly a small deficit with solid protein.
    const calories = 2350 + Math.round((rand() - 0.5) * 350) + (t ? 150 : 0);
    const protein = 175 + Math.round((rand() - 0.5) * 30);
    const fat = 70 + Math.round((rand() - 0.5) * 20);
    const carbs = Math.max(
      120,
      Math.round((calories - protein * 4 - fat * 9) / 4),
    );

    days[date] = {
      date,
      food: [
        {
          id: uid(),
          name: 'Daily intake (summary)',
          calories,
          protein,
          carbs,
          fat,
        },
      ],
      body: deriveBodyComposition({
        weightKg: Math.round(weight * 10) / 10,
        bodyFatPct: Math.round(bodyFat * 10) / 10,
      }),
      training,
      recovery: {
        restingHr,
        hrvMs,
        sleepHours: Math.round(sleepHours * 10) / 10,
        sleepQuality: Math.min(10, Math.max(4, Math.round(6 + rand() * 3))),
      },
      waterMl: 2200 + Math.round(rand() * 1200),
    };
  }

  return {
    profile: {
      name: 'Alex',
      sex: 'male',
      age: 31,
      heightCm: 180,
      goal: 'lose_fat',
    },
    days,
  };
}
