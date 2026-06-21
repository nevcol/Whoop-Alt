import { useState } from 'react';
import type { AppState, AdaptivePlan } from '../lib/types';
import type { AppApi } from '../App';
import { dayNutrition } from '../lib/metrics';
import { emptyDay, uid } from '../lib/storage';
import { Bar } from './ui';

const QUICK_FOODS: { name: string; calories: number; protein: number; carbs: number; fat: number }[] = [
  { name: 'Chicken breast (150g)', calories: 248, protein: 47, carbs: 0, fat: 5 },
  { name: 'White rice (1 cup)', calories: 205, protein: 4, carbs: 45, fat: 0 },
  { name: 'Whole eggs (2)', calories: 156, protein: 13, carbs: 1, fat: 11 },
  { name: 'Greek yogurt (200g)', calories: 130, protein: 20, carbs: 8, fat: 2 },
  { name: 'Banana', calories: 105, protein: 1, carbs: 27, fat: 0 },
  { name: 'Whey shake', calories: 120, protein: 25, carbs: 3, fat: 1 },
];

export function FoodPanel({
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
  const day = state.days[today] ?? emptyDay(today);
  const totals = dayNutrition(day);

  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  const add = () => {
    const c = Number(calories);
    if (!name.trim() || !Number.isFinite(c)) return;
    api.addFood(today, {
      id: uid(),
      name: name.trim(),
      calories: Math.round(c),
      protein: Math.round(Number(protein) || 0),
      carbs: Math.round(Number(carbs) || 0),
      fat: Math.round(Number(fat) || 0),
    });
    setName('');
    setCalories('');
    setProtein('');
    setCarbs('');
    setFat('');
  };

  const macroRow = (
    label: string,
    val: number,
    target: number | null,
    color: string,
    unit = 'g',
  ) => (
    <div style={{ marginBottom: 12 }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 13 }}>{label}</span>
        <span className="muted" style={{ fontSize: 13 }}>
          {Math.round(val)}
          {target != null ? ` / ${target}` : ''} {unit}
        </span>
      </div>
      <Bar value={val} max={target ?? (val || 1)} color={color} />
    </div>
  );

  return (
    <div className="grid">
      <div className="card">
        <p className="section-title">Today's nutrition vs adaptive target</p>
        {macroRow('Calories', totals.calories, plan.calorieTarget, 'var(--warn)', 'kcal')}
        {macroRow('Protein', totals.protein, plan.proteinTarget, 'var(--accent)')}
        {macroRow('Carbs', totals.carbs, plan.carbTarget, 'var(--accent-2)')}
        {macroRow('Fat', totals.fat, plan.fatTarget, '#ff8c42')}
        <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          Targets are recomputed from your learned maintenance ({plan.estimatedTdee ?? '—'} kcal)
          and how your body composition is actually trending.
        </p>
      </div>

      <div className="card">
        <p className="section-title">Quick add</p>
        <div className="row">
          {QUICK_FOODS.map((f) => (
            <button
              key={f.name}
              className="btn"
              style={{ fontSize: 12 }}
              onClick={() => api.addFood(today, { id: uid(), ...f })}
            >
              + {f.name}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <p className="section-title">Add custom item</p>
        <div className="row">
          <div className="field" style={{ flex: '2 1 160px' }}>
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Salmon fillet" />
          </div>
          <div className="field">
            <label>Calories</label>
            <input value={calories} onChange={(e) => setCalories(e.target.value)} inputMode="numeric" />
          </div>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <div className="field">
            <label>Protein (g)</label>
            <input value={protein} onChange={(e) => setProtein(e.target.value)} inputMode="numeric" />
          </div>
          <div className="field">
            <label>Carbs (g)</label>
            <input value={carbs} onChange={(e) => setCarbs(e.target.value)} inputMode="numeric" />
          </div>
          <div className="field">
            <label>Fat (g)</label>
            <input value={fat} onChange={(e) => setFat(e.target.value)} inputMode="numeric" />
          </div>
        </div>
        <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={add}>
          Add to today
        </button>
      </div>

      <div className="card">
        <p className="section-title">Logged today ({day.food.length})</p>
        {day.food.length === 0 && <p className="muted" style={{ fontSize: 13 }}>Nothing logged yet.</p>}
        {day.food.map((f) => (
          <div className="list-item" key={f.id}>
            <div>
              <div style={{ fontSize: 14 }}>{f.name}</div>
              <div className="muted" style={{ fontSize: 12 }}>
                {f.calories} kcal · P{f.protein} C{f.carbs} F{f.fat}
              </div>
            </div>
            <button className="btn btn-danger" style={{ padding: '5px 10px' }} onClick={() => api.removeFood(today, f.id)}>
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
