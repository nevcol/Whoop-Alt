# Whoop-Alt

An adaptive body-intelligence tracker — a Whoop alternative that doesn't just
measure your heart, but **ties together food, body composition, training and
recovery, learns how they affect your body, and continuously adjusts your
plan.**

Connect *any* Bluetooth heart-rate device, log what you eat and how you train,
weigh in, and the engine works out your real maintenance calories, scores your
recovery, tracks whether you're actually losing fat or muscle, and rewrites
your calorie/macro targets and training guidance to match how your body is
responding.

## What it does

- **❤ Heart rate over Bluetooth** — connects to any BLE device exposing the
  standard Heart Rate Service (Polar, Garmin, Wahoo, CooSpo straps, many
  watches/bands/rings). Shows live BPM and HR zones, records sessions with
  auto-captured avg/max HR, and computes **live HRV (rMSSD)** from
  RR-intervals when the device reports them.
- **🍽 Nutrition** — quick-add or custom food logging with calories and macros,
  shown against an adaptive target.
- **⚖ Body composition** — weight, body-fat %, and derived lean/fat mass, with
  28-day trend slopes (smart-scale friendly).
- **🏋 Training** — strength/cardio/HIIT/etc. sessions with a Whoop-style 0–21
  **strain** score from HR reserve or RPE.
- **◎ Recovery** — 0–100 score from HRV, resting HR and sleep, each compared to
  your own rolling baseline.
- **🧠 Adaptive plan** — the part that makes it more than a logbook (below).

## The adaptive engine

Everything is keyed by date so the engine can line up the day's nutrition,
training, body composition and recovery and study how they interact
(`src/lib/analysis.ts`):

1. **Learns your maintenance calories (TDEE)** from data, not a formula:
   `TDEE ≈ average intake − (weight change × 7700 kcal/kg ÷ days)`. It falls
   back to a BMR × activity estimate until there's enough data.
2. **Sets goal-aware targets** (lose fat / build muscle / recomp / maintain /
   endurance) for calories and protein/carb/fat.
3. **Closes the loop** — compares your *actual* weight/fat/lean-mass trend to
   the target for your goal and corrects calories, protecting lean mass if it
   starts dropping during a cut.
4. **Balances load vs recovery** — flags under-recovery for your training load,
   or a green light to push when recovery is high.
5. **Explains itself** — every adjustment comes with a plain-language insight on
   the dashboard.

## Run it

```bash
npm install
npm run dev      # open the printed URL in Chrome/Edge
npm run build    # type-check + production build
```

> **Bluetooth note:** Web Bluetooth requires a Chromium browser (Chrome/Edge,
> desktop or Android) served over **HTTPS or localhost**. `npm run dev` on
> `localhost` works. iOS Safari does not support Web Bluetooth.

The app seeds realistic demo data on first run so the engine has something to
analyze. Use **Profile → Clear all data** to start fresh, or **Reload demo
data** to restore it. All data is stored locally in your browser
(`localStorage`); nothing is sent to a server.

## Tech

React + TypeScript + Vite. No backend, no dependencies beyond React. Key
modules:

| File | Responsibility |
| --- | --- |
| `src/lib/bluetooth.ts` | Web Bluetooth HR monitor + RR-interval HRV |
| `src/lib/metrics.ts` | Strain, recovery, BMR, regression helpers |
| `src/lib/analysis.ts` | TDEE learning + adaptive plan + insights |
| `src/lib/selectors.ts` | Per-day series for charts |
| `src/components/*` | Dashboard and the per-domain panels |
