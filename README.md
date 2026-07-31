# Ledgerly

An open-source **QuickBooks alternative** built for coaches, trainers and
speakers: manage clients, send invoices and estimates, record payments, export
polished PDFs, and track your revenue — all from a clean, self-hosted app.

It ships with a **service catalog** covering the way a coaching business
actually bills — personal training, strength & conditioning, tennis coaching,
tennis performance, and speaking/teaching engagements — so a session, package or
keynote drops onto an invoice in one click at the right rate.

![Dashboard](https://img.shields.io/badge/stack-React%20%2B%20Express%20%2B%20SQLite-0f766e)

## Features

- **📊 Dashboard** — paid-this-month, outstanding and overdue totals, a 6-month
  revenue chart, top clients and recent invoices at a glance.
- **👥 Clients** — full client records with contact details and per-client
  billing totals, outstanding balances, and their invoice/estimate history.
- **🧾 Invoices** — line-item editor with quantities, rates, per-document tax
  rate and discount, live totals, and auto-numbering. Statuses are derived
  automatically: `draft → sent → partial → paid`, and `overdue` once past due.
- **📄 Estimates / quotes** — build estimates and **convert an accepted estimate
  into a draft invoice** in one click, copying every line item.
- **🏋 Services & rates** — a reusable catalog of what you bill for, grouped by
  category (Personal Training, Strength & Conditioning, Tennis Coaching, Tennis
  Performance, Speaking & Education). Pick one from the **“Add from services”**
  dropdown in any invoice or estimate and the description and rate fill in
  automatically. Services can be edited, hidden from the picker, or deleted
  without touching existing invoices.
- **💵 Payments** — record full or partial payments against an invoice, with
  method and notes; balances and statuses update automatically.
- **⬇ PDF export & print** — generate a clean, vector invoice/estimate PDF
  (via `pdfmake`) or use the print-optimised layout.
- **⚙ Settings** — your business profile, default currency, tax rate, payment
  terms, document prefixes and footer.

## Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | React + TypeScript + Vite + React Router |
| Backend | Node + Express (TypeScript, run with `tsx`) |
| Database | SQLite via `better-sqlite3` (a file at `data/ledgerly.db`) |
| PDF | `pdfmake` (lazy-loaded on demand) |

The database is a single local SQLite file — no external services to set up.
Data persists across restarts, and the schema is created automatically on first
run. A set of realistic demo data — a service catalog, clients (a junior tennis
player, a college athletics department, a masters-level player returning from
rehab, and a conference organizer), plus invoices, estimates and payments — is
seeded the first time the database is empty.

## Getting started

```bash
npm install       # installs deps (compiles the native SQLite module)
npm run dev        # starts the API (:4000) and the Vite dev server (:5173)
```

Then open **http://localhost:5173**. The Vite dev server proxies `/api` to the
Express backend.

### Production

```bash
npm run build      # type-check + build the client into dist/
npm run start      # serves the built app AND the API from http://localhost:4000
```

In production the Express server serves the built SPA and handles client-side
routing, so a single process runs the whole app.

### Password protection

To add password protection (**required** for anything reachable from the
internet), set the `APP_PASSWORD` environment variable before starting the app:

```bash
APP_PASSWORD=your_secure_password npm run start
```

When set, all API routes (except `/api/auth/*` and `/api/health`) require
authentication via an HMAC-signed httpOnly session cookie, and the frontend
shows a login screen before rendering the app. Sessions last 7 days.

Without `APP_PASSWORD` the app is completely open — fine on your own machine,
not fine on a public URL, where it would expose every client name, address and
invoice to anyone who finds it.

## Deploying

The repo ships a `Dockerfile` that builds the client and runs the single
Express process that serves both the SPA and the API.

```bash
docker build -t ledgerly .
docker run -p 4000:4000 \
  -v ledgerly-data:/data \
  -e APP_PASSWORD=your_secure_password \
  -e SESSION_SECRET=$(openssl rand -hex 32) \
  ledgerly
```

The volume matters: `DATA_DIR=/data` puts the SQLite file on the mounted
volume, so your data survives redeploys. Without it, every deploy starts from
an empty (re-seeded) database.

### Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `APP_PASSWORD` | *(unset)* | Enables the login gate. Unset = no auth at all. |
| `SESSION_SECRET` | dev fallback | Signs session cookies. Set to a random value in production; changing it signs everyone out. |
| `DATA_DIR` | `./data` | Where `ledgerly.db` lives. Point at a persistent volume. |
| `PORT` | `4000` | Port the server listens on. |

### Render

`render.yaml` is a ready-to-use blueprint with a 1 GB persistent disk mounted
at `/data`. It generates `SESSION_SECRET` automatically; set `APP_PASSWORD` in
the Render dashboard yourself. A persistent disk requires a paid plan — on the
free tier the disk (and your data) is discarded on each deploy.

## Project layout

```
server/
  index.ts            Express app + static serving of the built client
  db.ts               SQLite schema + demo-data seed
  lib.ts              Totals, status derivation, document assembly, numbering
  routes/             settings · clients · invoices · estimates · reports
src/
  main.tsx            App bootstrap (router + settings + toasts)
  App.tsx             Routes
  components/         Layout, UI primitives, DocumentView, DocumentEditor
  pages/              Dashboard, Clients, Invoices, Estimates, Settings, …
  lib/                api client, types, formatting, PDF generation, hooks
```

## API overview

All endpoints are under `/api`:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET/PUT` | `/settings` | Business profile & defaults |
| `GET/POST` | `/clients`, `/clients/:id` | Client CRUD (+ billing stats) |
| `GET/POST/PUT/DELETE` | `/services`, `/services/:id` | Service catalog CRUD (`?all=true` includes hidden) |
| `GET/POST/PUT/DELETE` | `/invoices`, `/invoices/:id` | Invoice CRUD |
| `POST` | `/invoices/:id/status` | Mark draft / sent |
| `POST/DELETE` | `/invoices/:id/payments` | Record / remove a payment |
| `GET/POST/PUT/DELETE` | `/estimates`, `/estimates/:id` | Estimate CRUD |
| `POST` | `/estimates/:id/convert` | Convert to a draft invoice |
| `GET` | `/reports/summary` | Dashboard figures |

## Notes

- Money is stored in the document's own currency; totals are computed on the
  server so the client and PDF always agree.
- To reset to a clean slate, stop the app and delete `data/ledgerly.db*`; the
  demo data re-seeds on the next start.
