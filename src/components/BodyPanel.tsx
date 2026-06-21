import { useState } from 'react';
import type { AppState, AdaptivePlan } from '../lib/types';
import type { AppApi } from '../App';
import { deriveBodyComposition } from '../lib/metrics';
import { daySeries } from '../lib/selectors';
import { Sparkline, Stat } from './ui';

const fmtSlope = (v: number | null): string =>
  v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)} kg/wk`;

export function BodyPanel({
  state,
  plan,
  api,
  today,
}: {
  state: AppState;
  plan: AdaptivePlan;
  api: AppApi;
  today: string;
}) {
  const series = daySeries(state, 60);
  const latest = [...series].reverse().find((s) => s.weightKg != null);

  const existing = state.days[today]?.body;
  const [weight, setWeight] = useState(existing?.weightKg?.toString() ?? '');
  const [bf, setBf] = useState(existing?.bodyFatPct?.toString() ?? '');

  const save = () => {
    const w = Number(weight);
    if (!Number.isFinite(w) || w <= 0) return;
    const bfNum = Number(bf);
    api.setBody(
      today,
      deriveBodyComposition({
        weightKg: Math.round(w * 10) / 10,
        bodyFatPct: Number.isFinite(bfNum) && bfNum > 0 ? Math.round(bfNum * 10) / 10 : undefined,
      }),
    );
  };

  return (
    <div className="grid">
      <div className="card">
        <p className="section-title">Body composition</p>
        <div className="grid grid-3">
          <Stat value={latest?.weightKg != null ? `${latest.weightKg}` : '—'} label="Weight (kg)" />
          <Stat value={latest?.bodyFatPct != null ? `${latest.bodyFatPct}%` : '—'} label="Body fat" />
          <Stat value={latest?.leanMassKg != null ? `${latest.leanMassKg}` : '—'} label="Lean mass (kg)" />
        </div>
      </div>

      <div className="card">
        <p className="section-title">28-day trends (what's actually changing)</p>
        <div className="grid grid-3">
          <Stat value={fmtSlope(plan.bodyTrend.weightSlopeKgPerWeek)} label="Weight" />
          <Stat value={fmtSlope(plan.bodyTrend.fatMassSlopeKgPerWeek)} label="Fat mass" />
          <Stat value={fmtSlope(plan.bodyTrend.leanMassSlopeKgPerWeek)} label="Lean mass" />
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
          These slopes drive the calorie & protein adjustments on your dashboard.
          The goal is fat mass down while lean mass holds or rises.
        </p>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <p className="section-title">Weight (kg)</p>
          <Sparkline data={series.map((s) => s.weightKg)} color="var(--warn)" />
        </div>
        <div className="card">
          <p className="section-title">Body fat (%)</p>
          <Sparkline data={series.map((s) => s.bodyFatPct)} color="var(--crit)" />
        </div>
        <div className="card">
          <p className="section-title">Lean mass (kg)</p>
          <Sparkline data={series.map((s) => s.leanMassKg)} color="var(--accent)" />
        </div>
        <div className="card">
          <p className="section-title">Fat mass (kg)</p>
          <Sparkline data={series.map((s) => s.fatMassKg)} color="#ff8c42" />
        </div>
      </div>

      <div className="card">
        <p className="section-title">Log today's measurement</p>
        <div className="row">
          <div className="field">
            <label>Weight (kg)</label>
            <input value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="decimal" placeholder="81.5" />
          </div>
          <div className="field">
            <label>Body fat (%) — optional</label>
            <input value={bf} onChange={(e) => setBf(e.target.value)} inputMode="decimal" placeholder="18.0" />
          </div>
        </div>
        <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={save}>
          Save measurement
        </button>
        <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
          Body fat % lets the engine separate fat-mass and lean-mass trends — the
          difference between cutting fat and just losing weight. Compatible with
          smart-scale readings (enter the values they give you).
        </p>
      </div>
    </div>
  );
}
