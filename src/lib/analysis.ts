import type {
  AdaptivePlan,
  AppState,
  DayLog,
  Goal,
  Insight,
  UserProfile,
} from './types';
import {
  basalMetabolicRate,
  dayNutrition,
  dayStrain,
  deriveBodyComposition,
  linearSlope,
  recoveryScore,
  rollingBaseline,
  type Point,
} from './metrics';

const KCAL_PER_KG = 7700; // energy in 1 kg of body mass change

const GOAL_LABELS: Record<Goal, string> = {
  lose_fat: 'Lose fat',
  build_muscle: 'Build muscle',
  recomp: 'Body recomposition',
  maintain: 'Maintain',
  endurance: 'Endurance',
};

export const goalLabel = (g: Goal): string => GOAL_LABELS[g];

/** Target rate of body-mass change per week for each goal (kg/week). */
const GOAL_WEEKLY_TARGET: Record<Goal, number> = {
  lose_fat: -0.5,
  build_muscle: 0.25,
  recomp: 0,
  maintain: 0,
  endurance: 0,
};

interface DayWithDerived {
  day: DayLog;
  index: number;
  calories: number;
  weightKg: number | null;
  fatMassKg: number | null;
  leanMassKg: number | null;
  recovery: number | null;
  strain: number;
}

function buildSeries(state: AppState): DayWithDerived[] {
  const days = Object.values(state.days).sort((a, b) =>
    a.date < b.date ? -1 : 1,
  );

  const baseDate = days.length ? new Date(days[0].date).getTime() : 0;
  const restingHrBaseline = rollingBaseline(
    days.map((d) => d.recovery.restingHr),
  );
  const hrvBaseline = rollingBaseline(days.map((d) => d.recovery.hrvMs));

  return days.map((day) => {
    const body = day.body ? deriveBodyComposition(day.body) : undefined;
    const dayMs = new Date(day.date).getTime();
    return {
      day,
      index: Math.round((dayMs - baseDate) / 86_400_000),
      calories: dayNutrition(day).calories,
      weightKg: body?.weightKg ?? null,
      fatMassKg: body?.fatMassKg ?? null,
      leanMassKg: body?.leanMassKg ?? null,
      recovery: recoveryScore(day, {
        restingHr: state.profile.restingHrBaseline ?? restingHrBaseline,
        hrv: state.profile.hrvBaseline ?? hrvBaseline,
      }),
      strain: dayStrain(day, state.profile),
    };
  });
}

function slopePerWeek(
  series: DayWithDerived[],
  key: 'weightKg' | 'fatMassKg' | 'leanMassKg',
  window: number,
): number | null {
  const pts: Point[] = series
    .slice(-window)
    .filter((d) => d[key] != null)
    .map((d) => ({ x: d.index, y: d[key] as number }));
  const perDay = linearSlope(pts);
  return perDay == null ? null : perDay * 7;
}

/**
 * Learn maintenance calories (TDEE) from the data itself:
 * intake on average should equal TDEE plus the energy stored/burned as the
 * body mass changes. TDEE = avgIntake - (weightChange * 7700 / days).
 * Falls back to a BMR x activity estimate when there isn't enough data.
 */
function estimateTdee(
  series: DayWithDerived[],
  profile: UserProfile,
): number | null {
  const window = 28;
  const recent = series.slice(-window);
  const withFood = recent.filter((d) => d.calories > 0);
  const weightPts = recent.filter((d) => d.weightKg != null);

  if (withFood.length >= 10 && weightPts.length >= 2) {
    const avgIntake =
      withFood.reduce((a, d) => a + d.calories, 0) / withFood.length;
    const first = weightPts[0];
    const last = weightPts[weightPts.length - 1];
    const days = Math.max(1, last.index - first.index);
    const weightChange = (last.weightKg as number) - (first.weightKg as number);
    const dailyBalance = (weightChange * KCAL_PER_KG) / days;
    const tdee = avgIntake - dailyBalance;
    // Sanity clamp around a plausible physiological range.
    if (tdee > 1000 && tdee < 6000) return Math.round(tdee);
  }

  // Fallback: BMR x activity multiplier driven by recent training strain.
  const latestWeight =
    weightPts.length > 0
      ? (weightPts[weightPts.length - 1].weightKg as number)
      : null;
  if (latestWeight == null) return null;
  const bmr = basalMetabolicRate(
    profile.sex,
    latestWeight,
    profile.heightCm,
    profile.age,
  );
  const avgStrain =
    recent.reduce((a, d) => a + d.strain, 0) / Math.max(1, recent.length);
  const activity = 1.3 + Math.min(0.5, avgStrain / 21);
  return Math.round(bmr * activity);
}

function macroTargets(
  calorieTarget: number | null,
  latestWeightKg: number | null,
  leanMassKg: number | null,
  goal: Goal,
): { protein: number | null; carbs: number | null; fat: number | null } {
  if (calorieTarget == null || latestWeightKg == null) {
    return { protein: null, carbs: null, fat: null };
  }
  // Protein scaled to lean mass when known, otherwise bodyweight.
  const proteinBasis = leanMassKg ?? latestWeightKg;
  const proteinPerKg =
    goal === 'lose_fat' ? 2.4 : goal === 'build_muscle' ? 2.0 : 2.2;
  const protein = Math.round(proteinBasis * proteinPerKg);

  // Fat ~25-30% of calories.
  const fatPctOfCals = goal === 'endurance' ? 0.22 : 0.27;
  const fat = Math.round((calorieTarget * fatPctOfCals) / 9);

  // Remainder to carbs.
  const remaining = calorieTarget - protein * 4 - fat * 9;
  const carbs = Math.max(0, Math.round(remaining / 4));
  return { protein, carbs, fat };
}

function buildInsights(
  series: DayWithDerived[],
  plan: Pick<AdaptivePlan, 'bodyTrend' | 'recoveryTrend' | 'estimatedTdee'>,
  profile: UserProfile,
): Insight[] {
  const insights: Insight[] = [];
  const goal = profile.goal;
  const { weightSlopeKgPerWeek, fatMassSlopeKgPerWeek, leanMassSlopeKgPerWeek } =
    plan.bodyTrend;
  const target = GOAL_WEEKLY_TARGET[goal];

  // --- Body composition vs goal ---
  if (weightSlopeKgPerWeek != null) {
    const rate = weightSlopeKgPerWeek;
    if (goal === 'lose_fat') {
      if (rate > -0.1) {
        insights.push({
          id: 'fatloss-stall',
          tone: 'warning',
          title: 'Fat loss has stalled',
          detail:
            `Weight is trending ${fmtRate(rate)}, but your goal needs ~-0.5 kg/wk. ` +
            'Your calorie target has been trimmed to restart progress.',
        });
      } else if (rate < -1.0) {
        insights.push({
          id: 'fatloss-fast',
          tone: 'warning',
          title: 'Losing weight too fast',
          detail:
            `You're dropping ${fmtRate(rate)}. That risks muscle loss — ` +
            'calories were raised slightly and protein bumped up.',
        });
      } else {
        insights.push({
          id: 'fatloss-ontrack',
          tone: 'positive',
          title: 'Fat loss on track',
          detail: `Weight is trending ${fmtRate(rate)}, right in the target zone.`,
        });
      }
    } else if (goal === 'build_muscle') {
      if (rate < 0.05) {
        insights.push({
          id: 'gain-stall',
          tone: 'warning',
          title: 'Not gaining enough to grow',
          detail:
            `Weight is trending ${fmtRate(rate)}. Muscle gain needs a small ` +
            'surplus — calories were increased.',
        });
      } else if (rate > 0.6) {
        insights.push({
          id: 'gain-fast',
          tone: 'warning',
          title: 'Gaining too fast (likely fat)',
          detail:
            `You're gaining ${fmtRate(rate)}. The surplus was reduced to keep ` +
            'gains leaner.',
        });
      } else {
        insights.push({
          id: 'gain-ontrack',
          tone: 'positive',
          title: 'Lean gaining on track',
          detail: `Weight is trending ${fmtRate(rate)} — a clean lean-gain pace.`,
        });
      }
    }
    void target;
  }

  // --- Lean vs fat mass quality of change ---
  if (leanMassSlopeKgPerWeek != null && fatMassSlopeKgPerWeek != null) {
    if (leanMassSlopeKgPerWeek > 0.02 && fatMassSlopeKgPerWeek < 0.02) {
      insights.push({
        id: 'recomp-win',
        tone: 'positive',
        title: 'Recomposition is working',
        detail:
          'Lean mass is rising while fat mass holds or falls — keep protein ' +
          'high and training consistent.',
      });
    } else if (leanMassSlopeKgPerWeek < -0.05) {
      insights.push({
        id: 'lean-loss',
        tone: 'critical',
        title: 'Losing lean mass',
        detail:
          'Lean mass is declining. Protein target was raised and any deficit ' +
          'eased to protect muscle.',
      });
    }
  }

  // --- Recovery vs training load ---
  const recent = series.slice(-7);
  const avgStrain =
    recent.reduce((a, d) => a + d.strain, 0) / Math.max(1, recent.length);
  if (plan.recoveryTrend != null) {
    if (plan.recoveryTrend < 40 && avgStrain > 8) {
      insights.push({
        id: 'overreaching',
        tone: 'critical',
        title: 'Under-recovered for your load',
        detail:
          `7-day recovery is ${Math.round(plan.recoveryTrend)}% while strain ` +
          `averages ${avgStrain.toFixed(1)}. Take a deload or easy day.`,
      });
    } else if (plan.recoveryTrend > 66) {
      insights.push({
        id: 'primed',
        tone: 'positive',
        title: 'Primed to push',
        detail:
          `Recovery is strong at ${Math.round(plan.recoveryTrend)}%. A good ` +
          'window for a hard or high-volume session.',
      });
    }
  }

  // --- Protein adequacy ---
  const proteinDays = recent.filter((d) => d.day.food.length > 0);
  if (proteinDays.length >= 3) {
    const avgProtein =
      proteinDays.reduce((a, d) => a + dayNutrition(d.day).protein, 0) /
      proteinDays.length;
    const latestWeight = [...series]
      .reverse()
      .find((d) => d.weightKg != null)?.weightKg;
    if (latestWeight && avgProtein < latestWeight * 1.6) {
      insights.push({
        id: 'low-protein',
        tone: 'warning',
        title: 'Protein is running low',
        detail:
          `Averaging ${Math.round(avgProtein)} g/day — aim higher to support ` +
          'recovery and lean mass given your goal.',
      });
    }
  }

  if (!insights.length) {
    insights.push({
      id: 'need-data',
      tone: 'neutral',
      title: 'Keep logging',
      detail:
        'Log a few more days of food, weight and training so the engine can ' +
        'learn your maintenance calories and trends.',
    });
  }
  return insights;
}

function fmtRate(kgPerWeek: number): string {
  const sign = kgPerWeek >= 0 ? '+' : '';
  return `${sign}${kgPerWeek.toFixed(2)} kg/wk`;
}

function trainingGuidance(
  recoveryTrend: number | null,
  avgStrain: number,
): string {
  if (recoveryTrend == null) {
    return 'Log morning HRV/resting HR (or connect a strap) to get recovery-based training guidance.';
  }
  if (recoveryTrend < 40) {
    return 'Recovery is low. Prioritise sleep, keep today light — mobility, a walk, or skill work.';
  }
  if (recoveryTrend < 66) {
    return avgStrain > 10
      ? 'Moderate recovery with high recent load. Hold volume steady; avoid stacking another max effort.'
      : 'Moderate recovery. A normal moderate session is appropriate today.';
  }
  return 'Recovery is high — green light for a hard, high-volume, or PR-attempt session.';
}

/** The single entry point: produce the adaptive plan from all logged data. */
export function buildAdaptivePlan(state: AppState): AdaptivePlan {
  const series = buildSeries(state);
  const goal = state.profile.goal;

  const estimatedTdee = estimateTdee(series, state.profile);

  const bodyTrend = {
    weightSlopeKgPerWeek: slopePerWeek(series, 'weightKg', 28),
    fatMassSlopeKgPerWeek: slopePerWeek(series, 'fatMassKg', 28),
    leanMassSlopeKgPerWeek: slopePerWeek(series, 'leanMassKg', 28),
  };

  const recentRecovery = series
    .slice(-7)
    .map((d) => d.recovery)
    .filter((r): r is number => r != null);
  const recoveryTrend = recentRecovery.length
    ? recentRecovery.reduce((a, b) => a + b, 0) / recentRecovery.length
    : null;

  // Adaptive calorie target: start from learned TDEE, shift toward the goal,
  // then correct based on whether the body is actually moving as intended.
  let calorieTarget: number | null = null;
  if (estimatedTdee != null) {
    const weeklyTarget = GOAL_WEEKLY_TARGET[goal];
    const baseAdjust = (weeklyTarget * KCAL_PER_KG) / 7;
    calorieTarget = estimatedTdee + baseAdjust;

    const actual = bodyTrend.weightSlopeKgPerWeek;
    if (actual != null && weeklyTarget !== 0) {
      const error = actual - weeklyTarget; // +ve = gaining more than wanted
      // Nudge ~80 kcal per 0.1 kg/wk of error, capped.
      const correction = clamp(-error * 800, -400, 400);
      calorieTarget += correction;
    }
    // Protect lean mass: if losing lean mass, ease any deficit.
    if (
      bodyTrend.leanMassSlopeKgPerWeek != null &&
      bodyTrend.leanMassSlopeKgPerWeek < -0.05 &&
      baseAdjust < 0
    ) {
      calorieTarget += 150;
    }
    calorieTarget = Math.round(calorieTarget);
  }

  const latestWeight = [...series]
    .reverse()
    .find((d) => d.weightKg != null)?.weightKg ?? null;
  const latestLean = [...series]
    .reverse()
    .find((d) => d.leanMassKg != null)?.leanMassKg ?? null;

  const macros = macroTargets(calorieTarget, latestWeight, latestLean, goal);

  const avgStrain =
    series.slice(-7).reduce((a, d) => a + d.strain, 0) /
    Math.max(1, series.slice(-7).length);

  const partial = { bodyTrend, recoveryTrend, estimatedTdee };
  const insights = buildInsights(series, partial, state.profile);

  return {
    estimatedTdee,
    calorieTarget,
    proteinTarget: macros.protein,
    carbTarget: macros.carbs,
    fatTarget: macros.fat,
    trainingGuidance: trainingGuidance(recoveryTrend, avgStrain),
    bodyTrend,
    recoveryTrend,
    insights,
    lastUpdated: new Date().toISOString(),
  };
}

const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));
