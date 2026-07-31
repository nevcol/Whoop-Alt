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
    'Northwind Studio',
    'billing@northwind.studio',
    '(555) 123-4567',
    '48 Market Street\nSuite 300\nPortland, OR 97204',
    'northwind.studio',
    8.5,
    'Payment due within terms. Thank you for your business!',
  );

  const insClient = db.prepare(
    `INSERT INTO clients (name, company, email, phone, address, notes) VALUES (?,?,?,?,?,?)`,
  );
  const c1 = insClient.run(
    'Alex Rivera',
    'Rivera Coffee Co.',
    'alex@riveracoffee.com',
    '(555) 234-1000',
    '12 Bean Ave\nSeattle, WA 98101',
    'Prefers email. Net-15.',
  ).lastInsertRowid as number;
  const c2 = insClient.run(
    'Priya Nair',
    'Lotus Wellness',
    'priya@lotuswellness.co',
    '(555) 987-2211',
    '900 Serenity Blvd\nAustin, TX 78701',
    '',
  ).lastInsertRowid as number;
  const c3 = insClient.run(
    'Marcus Bell',
    'Bell & Sons Contracting',
    'marcus@bellandsons.com',
    '(555) 445-8890',
    '77 Builder Rd\nDenver, CO 80202',
    'Large projects, monthly billing.',
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

  // Paid invoice.
  const i1 = insInvoice.run(
    'INV-1001', c1, 'paid', iso(addDays(today, -40)), iso(addDays(today, -25)), 8.5, 0, 'Q2 branding package.',
  ).lastInsertRowid as number;
  insItem.run(i1, 'Brand identity design', 1, 2400, 0);
  insItem.run(i1, 'Logo revisions', 3, 150, 1);
  // Subtotal 2850 + 8.5% tax = 3092.25, paid in full.
  insPay.run(i1, 3092.25, iso(addDays(today, -30)), 'Bank transfer', 'Paid in full');

  // Sent, partially paid.
  const i2 = insInvoice.run(
    'INV-1002', c3, 'sent', iso(addDays(today, -20)), iso(addDays(today, 10)), 8.5, 100, 'Kitchen remodel — phase 1.',
  ).lastInsertRowid as number;
  insItem.run(i2, 'Labor (hours)', 40, 65, 0);
  insItem.run(i2, 'Materials', 1, 1850, 1);
  insPay.run(i2, 2000, iso(addDays(today, -12)), 'Check', 'Deposit');

  // Overdue.
  const i3 = insInvoice.run(
    'INV-1003', c2, 'sent', iso(addDays(today, -35)), iso(addDays(today, -5)), 8.5, 0, 'Website maintenance retainer.',
  ).lastInsertRowid as number;
  insItem.run(i3, 'Monthly retainer', 1, 800, 0);

  // Draft.
  const i4 = insInvoice.run(
    'INV-1004', c1, 'draft', iso(today), iso(addDays(today, 15)), 8.5, 0, '',
  ).lastInsertRowid as number;
  insItem.run(i4, 'Social media templates', 10, 45, 0);

  db.prepare('UPDATE settings SET next_invoice_seq = 1005 WHERE id = 1').run();

  const insEstimate = db.prepare(
    `INSERT INTO estimates (number, client_id, status, issue_date, expiry_date, tax_rate, discount, notes) VALUES (?,?,?,?,?,?,?,?)`,
  );
  const insEItem = db.prepare(
    `INSERT INTO estimate_items (estimate_id, description, quantity, rate, position) VALUES (?,?,?,?,?)`,
  );
  const e1 = insEstimate.run(
    'EST-1001', c2, 'sent', iso(addDays(today, -3)), iso(addDays(today, 27)), 8.5, 0, 'Proposed redesign of storefront.',
  ).lastInsertRowid as number;
  insEItem.run(e1, 'UX audit', 1, 900, 0);
  insEItem.run(e1, 'Homepage redesign', 1, 2200, 1);
  insEItem.run(e1, 'Responsive build', 1, 3400, 2);

  const e2 = insEstimate.run(
    'EST-1002', c3, 'draft', iso(today), iso(addDays(today, 30)), 8.5, 0, '',
  ).lastInsertRowid as number;
  insEItem.run(e2, 'Bathroom remodel — estimate', 1, 7800, 0);

  db.prepare('UPDATE settings SET next_estimate_seq = 1003 WHERE id = 1').run();
}
