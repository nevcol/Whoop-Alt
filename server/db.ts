import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');
mkdirSync(dataDir, { recursive: true });

export const db = new Database(join(dataDir, 'ledgerly.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    id             INTEGER PRIMARY KEY CHECK (id = 1),
    business_name  TEXT    NOT NULL DEFAULT 'My Business',
    email          TEXT    NOT NULL DEFAULT '',
    phone          TEXT    NOT NULL DEFAULT '',
    address        TEXT    NOT NULL DEFAULT '',
    website        TEXT    NOT NULL DEFAULT '',
    currency       TEXT    NOT NULL DEFAULT 'USD',
    tax_rate       REAL    NOT NULL DEFAULT 0,
    payment_terms  INTEGER NOT NULL DEFAULT 30,
    invoice_prefix TEXT    NOT NULL DEFAULT 'INV-',
    estimate_prefix TEXT   NOT NULL DEFAULT 'EST-',
    next_invoice_seq  INTEGER NOT NULL DEFAULT 1001,
    next_estimate_seq INTEGER NOT NULL DEFAULT 1001,
    footer         TEXT    NOT NULL DEFAULT 'Thank you for your business!'
  );

  CREATE TABLE IF NOT EXISTS services (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    category    TEXT    NOT NULL DEFAULT 'General',
    description TEXT    NOT NULL DEFAULT '',
    rate        REAL    NOT NULL DEFAULT 0,
    unit        TEXT    NOT NULL DEFAULT 'session',
    active      INTEGER NOT NULL DEFAULT 1,
    position    INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS clients (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    company    TEXT    NOT NULL DEFAULT '',
    email      TEXT    NOT NULL DEFAULT '',
    phone      TEXT    NOT NULL DEFAULT '',
    address    TEXT    NOT NULL DEFAULT '',
    notes      TEXT    NOT NULL DEFAULT '',
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    number     TEXT    NOT NULL UNIQUE,
    client_id  INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    status     TEXT    NOT NULL DEFAULT 'draft',
    issue_date TEXT    NOT NULL,
    due_date   TEXT    NOT NULL,
    tax_rate   REAL    NOT NULL DEFAULT 0,
    discount   REAL    NOT NULL DEFAULT 0,
    notes      TEXT    NOT NULL DEFAULT '',
    from_estimate_id INTEGER REFERENCES estimates(id) ON DELETE SET NULL,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS invoice_items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id  INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description TEXT    NOT NULL DEFAULT '',
    quantity    REAL    NOT NULL DEFAULT 1,
    rate        REAL    NOT NULL DEFAULT 0,
    position    INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS estimates (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    number     TEXT    NOT NULL UNIQUE,
    client_id  INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    status     TEXT    NOT NULL DEFAULT 'draft',
    issue_date TEXT    NOT NULL,
    expiry_date TEXT   NOT NULL,
    tax_rate   REAL    NOT NULL DEFAULT 0,
    discount   REAL    NOT NULL DEFAULT 0,
    notes      TEXT    NOT NULL DEFAULT '',
    converted_invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS estimate_items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    estimate_id INTEGER NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
    description TEXT    NOT NULL DEFAULT '',
    quantity    REAL    NOT NULL DEFAULT 1,
    rate        REAL    NOT NULL DEFAULT 0,
    position    INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS payments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    amount     REAL    NOT NULL DEFAULT 0,
    date       TEXT    NOT NULL,
    method     TEXT    NOT NULL DEFAULT 'Bank transfer',
    note       TEXT    NOT NULL DEFAULT '',
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`);

// Ensure the singleton settings row exists.
db.prepare(
  `INSERT OR IGNORE INTO settings (id) VALUES (1)`,
).run();

export function seedIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM clients').get() as {
    c: number;
  };
  if (count.c > 0) return;

  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const addDays = (d: Date, n: number) => {
    const c = new Date(d);
    c.setDate(c.getDate() + n);
    return c;
  };

  db.prepare(
    `UPDATE settings SET business_name = ?, email = ?, phone = ?, address = ?, website = ?, tax_rate = ?, footer = ? WHERE id = 1`,
  ).run(
    'Peak Performance Coaching',
    'coach@peakperformance.co',
    '(555) 123-4567',
    '120 Baseline Drive\nSuite 4\nSan Juan, PR 00901',
    'peakperformance.co',
    0,
    'Payment due within terms. Thank you — see you at the next session!',
  );

  // Service catalog spanning personal training, strength & conditioning,
  // tennis coaching, tennis performance, and speaking/teaching work.
  const insService = db.prepare(
    `INSERT INTO services (name, category, description, rate, unit, position)
     VALUES (?,?,?,?,?,?)`,
  );
  const services: [string, string, string, number, string][] = [
    // Personal training
    ['1-on-1 Personal Training', 'Personal Training', '60-minute private session', 85, 'session'],
    ['Personal Training — 10 Pack', 'Personal Training', 'Ten 60-minute sessions, prepaid', 765, 'package'],
    ['Semi-Private Training (2–3)', 'Personal Training', '60-minute small-group session', 55, 'session/athlete'],
    ['Initial Assessment & Movement Screen', 'Personal Training', 'Intake, goal setting, FMS-style screen', 120, 'assessment'],
    // Strength & conditioning
    ['Strength & Conditioning — Team Session', 'Strength & Conditioning', 'On-site team training session', 250, 'session'],
    ['Individualized Program Design', 'Strength & Conditioning', 'Custom 4-week periodized block', 200, 'program'],
    ['Monthly Programming & Check-ins', 'Strength & Conditioning', 'Remote programming with weekly check-ins', 300, 'month'],
    ['Return-to-Play Conditioning', 'Strength & Conditioning', 'Post-rehab reconditioning session', 95, 'session'],
    // Tennis coaching
    ['Private Tennis Lesson', 'Tennis Coaching', '60-minute private on-court lesson', 90, 'lesson'],
    ['Semi-Private Tennis Lesson', 'Tennis Coaching', '60-minute lesson, 2–4 players', 45, 'lesson/player'],
    ['Junior Development Clinic', 'Tennis Coaching', '90-minute group clinic', 40, 'player'],
    ['Match Play & Strategy Session', 'Tennis Coaching', 'Live-ball point play and tactics', 100, 'session'],
    // Tennis performance
    ['Tennis Performance Assessment', 'Tennis Performance', 'Movement, power and on-court testing battery', 175, 'assessment'],
    ['On-Court Speed & Agility', 'Tennis Performance', 'Footwork, first-step and recovery training', 95, 'session'],
    ['Tournament Prep Block', 'Tennis Performance', '4-week peaking block with taper', 450, 'block'],
    ['Video Analysis & Report', 'Tennis Performance', 'Stroke/movement breakdown with written report', 150, 'report'],
    // Speaking & teaching
    ['Keynote Speaking', 'Speaking & Education', 'Conference keynote presentation', 2500, 'engagement'],
    ['Workshop / Clinic (Half Day)', 'Speaking & Education', 'Hands-on coach or athlete education', 1200, 'half day'],
    ['Guest Lecture', 'Speaking & Education', 'University guest lecture', 500, 'lecture'],
    ['Course Instruction', 'Speaking & Education', 'Semester course, per credit hour', 1800, 'credit hour'],
    ['Coaching Education Consulting', 'Speaking & Education', 'Curriculum or staff development consulting', 150, 'hour'],
  ];
  services.forEach((s, i) => insService.run(s[0], s[1], s[2], s[3], s[4], i));

  const insClient = db.prepare(
    `INSERT INTO clients (name, company, email, phone, address, notes) VALUES (?,?,?,?,?,?)`,
  );
  const c1 = insClient.run(
    'Daniela Ortiz',
    '',
    'daniela.ortiz@email.com',
    '(555) 234-1000',
    '18 Court Lane\nSan Juan, PR 00907',
    'Junior player, USTA sectionals. Trains Tue/Thu + Sat clinic.',
  ).lastInsertRowid as number;
  const c2 = insClient.run(
    'Coach Alan Reyes',
    'Riverside Academy Athletics',
    'areyes@riversideacademy.edu',
    '(555) 987-2211',
    '900 Campus Way\nAthletics Dept.\nCarolina, PR 00979',
    'Team S&C contract, billed monthly. PO required on invoices.',
  ).lastInsertRowid as number;
  const c3 = insClient.run(
    'Marcus Bell',
    '',
    'marcus.bell@email.com',
    '(555) 445-8890',
    '77 Highland Rd\nBayamón, PR 00956',
    'Masters-level player. Return-to-play after shoulder rehab.',
  ).lastInsertRowid as number;
  const c4 = insClient.run(
    'Dr. Priya Nair',
    'National Coaching Symposium',
    'priya@coachingsymposium.org',
    '(555) 771-3300',
    'Convention Center\n100 Harbor Blvd\nMiami, FL 33132',
    'Books keynotes and coach-education workshops.',
  ).lastInsertRowid as number;

  const insInvoice = db.prepare(
    `INSERT INTO invoices (number, client_id, status, issue_date, due_date, tax_rate, discount, notes) VALUES (?,?,?,?,?,?,?,?)`,
  );
  const insItem = db.prepare(
    `INSERT INTO invoice_items (invoice_id, description, quantity, rate, position) VALUES (?,?,?,?,?)`,
  );
  const insPay = db.prepare(
    `INSERT INTO payments (invoice_id, amount, date, method, note) VALUES (?,?,?,?,?)`,
  );

  // Keynote — paid in full.
  const i1 = insInvoice.run(
    'INV-1001', c4, 'paid', iso(addDays(today, -40)), iso(addDays(today, -25)), 0, 0,
    'Keynote + coach workshop, annual symposium.',
  ).lastInsertRowid as number;
  insItem.run(i1, 'Keynote Speaking — "Building Resilient Athletes"', 1, 2500, 0);
  insItem.run(i1, 'Workshop / Clinic (Half Day)', 1, 1200, 1);
  // Subtotal 3700, no tax, paid in full.
  insPay.run(i1, 3700, iso(addDays(today, -28)), 'Bank transfer', 'Paid in full');

  // Team S&C contract — partially paid.
  const i2 = insInvoice.run(
    'INV-1002', c2, 'sent', iso(addDays(today, -20)), iso(addDays(today, 10)), 0, 0,
    'Preseason strength & conditioning — men\'s tennis.',
  ).lastInsertRowid as number;
  insItem.run(i2, 'Strength & Conditioning — Team Session', 12, 250, 0);
  insItem.run(i2, 'Individualized Program Design', 4, 200, 1);
  insPay.run(i2, 2000, iso(addDays(today, -10)), 'Check', 'Partial — PO 4471');

  // Junior player monthly — overdue.
  const i3 = insInvoice.run(
    'INV-1003', c1, 'sent', iso(addDays(today, -35)), iso(addDays(today, -5)), 0, 0,
    'March lessons and performance training.',
  ).lastInsertRowid as number;
  insItem.run(i3, 'Private Tennis Lesson', 8, 90, 0);
  insItem.run(i3, 'On-Court Speed & Agility', 4, 95, 1);

  // Return-to-play block — draft.
  const i4 = insInvoice.run(
    'INV-1004', c3, 'draft', iso(today), iso(addDays(today, 15)), 0, 0, '',
  ).lastInsertRowid as number;
  insItem.run(i4, 'Return-to-Play Conditioning', 6, 95, 0);
  insItem.run(i4, 'Initial Assessment & Movement Screen', 1, 120, 1);

  db.prepare('UPDATE settings SET next_invoice_seq = 1005 WHERE id = 1').run();

  const insEstimate = db.prepare(
    `INSERT INTO estimates (number, client_id, status, issue_date, expiry_date, tax_rate, discount, notes) VALUES (?,?,?,?,?,?,?,?)`,
  );
  const insEItem = db.prepare(
    `INSERT INTO estimate_items (estimate_id, description, quantity, rate, position) VALUES (?,?,?,?,?)`,
  );
  const e1 = insEstimate.run(
    'EST-1001', c1, 'sent', iso(addDays(today, -3)), iso(addDays(today, 27)), 0, 0,
    'Summer tournament preparation package.',
  ).lastInsertRowid as number;
  insEItem.run(e1, 'Tennis Performance Assessment', 1, 175, 0);
  insEItem.run(e1, 'Tournament Prep Block', 1, 450, 1);
  insEItem.run(e1, 'Private Tennis Lesson', 12, 90, 2);
  insEItem.run(e1, 'Video Analysis & Report', 2, 150, 3);

  const e2 = insEstimate.run(
    'EST-1002', c2, 'draft', iso(today), iso(addDays(today, 30)), 0, 0,
    'Proposed fall semester team contract.',
  ).lastInsertRowid as number;
  insEItem.run(e2, 'Strength & Conditioning — Team Session', 24, 250, 0);
  insEItem.run(e2, 'Monthly Programming & Check-ins', 4, 300, 1);

  db.prepare('UPDATE settings SET next_estimate_seq = 1003 WHERE id = 1').run();
}
