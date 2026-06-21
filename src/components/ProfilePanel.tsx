import type { AppState, Goal, Sex } from '../lib/types';
import type { AppApi } from '../App';
import { goalLabel } from '../lib/analysis';
import { todayKey } from '../lib/storage';

const GOALS: Goal[] = ['lose_fat', 'build_muscle', 'recomp', 'maintain', 'endurance'];

export function ProfilePanel({
  state,
  api,
}: {
  state: AppState;
  api: AppApi;
}) {
  const p = state.profile;
  const today = todayKey();
  const rec = state.days[today]?.recovery ?? {};

  return (
    <div className="grid">
      <div className="card">
        <p className="section-title">Profile</p>
        <div className="row">
          <div className="field" style={{ flex: '2 1 160px' }}>
            <label>Name</label>
            <input value={p.name} onChange={(e) => api.updateProfile({ name: e.target.value })} />
          </div>
          <div className="field">
            <label>Sex</label>
            <select value={p.sex} onChange={(e) => api.updateProfile({ sex: e.target.value as Sex })}>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <div className="field">
            <label>Age</label>
            <input
              value={p.age}
              onChange={(e) => api.updateProfile({ age: Number(e.target.value) || p.age })}
              inputMode="numeric"
            />
          </div>
          <div className="field">
            <label>Height (cm)</label>
            <input
              value={p.heightCm}
              onChange={(e) => api.updateProfile({ heightCm: Number(e.target.value) || p.heightCm })}
              inputMode="numeric"
            />
          </div>
        </div>
        <div className="field" style={{ marginTop: 10 }}>
          <label>Goal — drives every recommendation</label>
          <select value={p.goal} onChange={(e) => api.updateProfile({ goal: e.target.value as Goal })}>
            {GOALS.map((g) => (
              <option key={g} value={g}>
                {goalLabel(g)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card">
        <p className="section-title">Morning recovery (manual entry)</p>
        <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
          No strap handy? Enter these by hand. The Heart tab fills them
          automatically when you connect a Bluetooth monitor.
        </p>
        <div className="row">
          <div className="field">
            <label>Resting HR (bpm)</label>
            <input
              value={rec.restingHr ?? ''}
              onChange={(e) =>
                api.patchRecovery(today, { restingHr: Number(e.target.value) || undefined })
              }
              inputMode="numeric"
            />
          </div>
          <div className="field">
            <label>HRV (ms)</label>
            <input
              value={rec.hrvMs ?? ''}
              onChange={(e) =>
                api.patchRecovery(today, { hrvMs: Number(e.target.value) || undefined })
              }
              inputMode="numeric"
            />
          </div>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <div className="field">
            <label>Sleep (hours)</label>
            <input
              value={rec.sleepHours ?? ''}
              onChange={(e) =>
                api.patchRecovery(today, { sleepHours: Number(e.target.value) || undefined })
              }
              inputMode="decimal"
            />
          </div>
          <div className="field">
            <label>Sleep quality (1-10)</label>
            <input
              value={rec.sleepQuality ?? ''}
              onChange={(e) =>
                api.patchRecovery(today, { sleepQuality: Number(e.target.value) || undefined })
              }
              inputMode="numeric"
            />
          </div>
        </div>
      </div>

      <div className="card">
        <p className="section-title">Data</p>
        <div className="row">
          <button className="btn" onClick={api.loadDemo}>
            Reload demo data
          </button>
          <button
            className="btn btn-danger"
            onClick={() => {
              if (confirm('Clear all logged days? Your profile is kept.')) api.clearAll();
            }}
          >
            Clear all data
          </button>
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
          All data is stored locally in your browser (localStorage). Nothing is
          sent to any server.
        </p>
      </div>
    </div>
  );
}
