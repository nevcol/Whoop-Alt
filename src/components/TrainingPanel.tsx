import { useState } from 'react';
import type { AppState, TrainingType } from '../lib/types';
import type { AppApi } from '../App';
import { sessionStrain } from '../lib/metrics';
import { daySeries } from '../lib/selectors';
import { emptyDay, uid } from '../lib/storage';
import { Sparkline } from './ui';

const TYPES: TrainingType[] = ['strength', 'cardio', 'hiit', 'endurance', 'sport', 'mobility'];

export function TrainingPanel({
  state,
  api,
  today,
}: {
  state: AppState;
  api: AppApi;
  today: string;
}) {
  const day = state.days[today] ?? emptyDay(today);
  const series = daySeries(state, 30);

  const [type, setType] = useState<TrainingType>('strength');
  const [duration, setDuration] = useState('');
  const [avgHr, setAvgHr] = useState('');
  const [rpe, setRpe] = useState('');

  const add = () => {
    const dur = Number(duration);
    if (!Number.isFinite(dur) || dur <= 0) return;
    api.addTraining(today, {
      id: uid(),
      type,
      durationMin: Math.round(dur),
      avgHr: Number(avgHr) > 0 ? Math.round(Number(avgHr)) : undefined,
      rpe: Number(rpe) > 0 ? Math.round(Number(rpe)) : undefined,
    });
    setDuration('');
    setAvgHr('');
    setRpe('');
  };

  const weeklyStrain = series.slice(-7).reduce((a, s) => a + s.strain, 0);

  return (
    <div className="grid">
      <div className="card">
        <p className="section-title">Training load (30d strain)</p>
        <Sparkline data={series.map((s) => s.strain)} color="var(--accent-2)" />
        <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
          7-day accumulated strain: <strong>{weeklyStrain.toFixed(1)}</strong>.
          The engine balances this against your recovery to guide how hard to go.
        </p>
      </div>

      <div className="card">
        <p className="section-title">Log a session</p>
        <div className="row">
          <div className="field" style={{ maxWidth: 160 }}>
            <label>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as TrainingType)}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t[0].toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Duration (min)</label>
            <input value={duration} onChange={(e) => setDuration(e.target.value)} inputMode="numeric" />
          </div>
          <div className="field">
            <label>Avg HR (opt)</label>
            <input value={avgHr} onChange={(e) => setAvgHr(e.target.value)} inputMode="numeric" />
          </div>
          <div className="field">
            <label>RPE 1-10 (opt)</label>
            <input value={rpe} onChange={(e) => setRpe(e.target.value)} inputMode="numeric" />
          </div>
        </div>
        <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={add}>
          Add session
        </button>
        <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
          Tip: use the Heart tab to record a session live from your Bluetooth
          monitor — it captures avg & max HR automatically.
        </p>
      </div>

      <div className="card">
        <p className="section-title">Today's sessions ({day.training.length})</p>
        {day.training.length === 0 && (
          <p className="muted" style={{ fontSize: 13 }}>No sessions logged today.</p>
        )}
        {day.training.map((s) => (
          <div className="list-item" key={s.id}>
            <div>
              <div style={{ fontSize: 14 }}>
                {s.type[0].toUpperCase() + s.type.slice(1)}{' '}
                <span className="tag">{s.durationMin} min</span>
              </div>
              <div className="muted" style={{ fontSize: 12 }}>
                {s.avgHr ? `avg ${s.avgHr} bpm · ` : ''}
                {s.maxHr ? `max ${s.maxHr} · ` : ''}
                {s.rpe ? `RPE ${s.rpe} · ` : ''}
                strain {sessionStrain(s, state.profile).toFixed(1)}
              </div>
            </div>
            <button className="btn btn-danger" style={{ padding: '5px 10px' }} onClick={() => api.removeTraining(today, s.id)}>
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
