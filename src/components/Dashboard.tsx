import type { AppState, AdaptivePlan } from '../lib/types';
import type { AppApi, Tab } from '../App';
import { daySeries } from '../lib/selectors';
import { goalLabel } from '../lib/analysis';
import { Ring, Sparkline, Stat } from './ui';

function recoveryColor(v: number | null): string {
  if (v == null) return 'var(--text-dim)';
  if (v >= 66) return 'var(--pos)';
  if (v >= 40) return 'var(--warn)';
  return 'var(--crit)';
}

export function Dashboard({
  state,
  plan,
  today,
  setTab,
}: {
  state: AppState;
  plan: AdaptivePlan;
  api: AppApi;
  today: string;
  setTab: (t: Tab) => void;
}) {
  const series = daySeries(state, 30);
  const last = series[series.length - 1];
  const todayPoint = series.find((s) => s.date === today) ?? last;

  const recovery = todayPoint?.recovery ?? plan.recoveryTrend ?? null;
  const strain = todayPoint?.strain ?? 0;

  return (
    <div className="grid">
      {/* Top rings: the daily "how is my body" snapshot */}
      <div className="card">
        <p className="section-title">Today</p>
        <div className="rings">
          <Ring
            value={recovery}
            color={recoveryColor(recovery)}
            label="Recovery %"
          />
          <Ring
            value={strain}
            max={21}
            color="var(--accent-2)"
            label="Strain"
            display={strain ? strain.toFixed(1) : '0'}
          />
          <Ring
            value={todayPoint?.calories ?? null}
            max={plan.calorieTarget ?? 2500}
            color="var(--warn)"
            label="Calories"
            display={
              todayPoint?.calories != null ? `${todayPoint.calories}` : '—'
            }
          />
        </div>
        <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
          {plan.trainingGuidance}
        </p>
      </div>

      {/* The adaptive plan: everything lumped together into targets */}
      <div className="card">
        <p className="section-title">
          Adaptive plan · goal: {goalLabel(state.profile.goal)}
        </p>
        <div className="grid grid-3">
          <Stat
            value={plan.estimatedTdee ? `${plan.estimatedTdee}` : '—'}
            label="Learned maintenance (kcal)"
            sub="from your intake + weight trend"
          />
          <Stat
            value={plan.calorieTarget ? `${plan.calorieTarget}` : '—'}
            label="Calorie target (kcal)"
            sub="adjusted to your progress"
          />
          <Stat
            value={
              plan.proteinTarget
                ? `${plan.proteinTarget}/${plan.carbTarget}/${plan.fatTarget}`
                : '—'
            }
            label="Protein / Carb / Fat (g)"
          />
        </div>
      </div>

      {/* Insights — the engine explaining what it changed and why */}
      <div className="card">
        <p className="section-title">What your body is telling us</p>
        {plan.insights.map((ins) => (
          <div key={ins.id} className={`insight ${ins.tone}`}>
            <div className="bar" />
            <div>
              <h4>{ins.title}</h4>
              <p>{ins.detail}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Trends */}
      <div className="grid grid-2">
        <div className="card">
          <p className="section-title">Recovery (30d)</p>
          <Sparkline data={series.map((s) => s.recovery)} color="var(--pos)" />
        </div>
        <div className="card">
          <p className="section-title">Strain (30d)</p>
          <Sparkline data={series.map((s) => s.strain)} color="var(--accent-2)" />
        </div>
        <div className="card">
          <p className="section-title">Body weight (kg)</p>
          <Sparkline data={series.map((s) => s.weightKg)} color="var(--warn)" />
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            Trend:{' '}
            {plan.bodyTrend.weightSlopeKgPerWeek != null
              ? `${plan.bodyTrend.weightSlopeKgPerWeek >= 0 ? '+' : ''}${plan.bodyTrend.weightSlopeKgPerWeek.toFixed(2)} kg/wk`
              : '—'}
          </p>
        </div>
        <div className="card">
          <p className="section-title">Calories in (30d)</p>
          <Sparkline data={series.map((s) => s.calories)} color="var(--accent)" />
        </div>
      </div>

      <div className="row" style={{ justifyContent: 'center' }}>
        <button className="btn" onClick={() => setTab('heart')}>
          Connect heart rate monitor →
        </button>
      </div>
    </div>
  );
}
