import { Router } from 'express';
import { db } from '../db.ts';
import {
  getInvoice,
  sanitizeItems,
  nextNumber,
  todayISO,
  type ItemInput,
} from '../lib.ts';

export const invoicesRouter = Router();

function replaceItems(invoiceId: number, items: ItemInput[]) {
  db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(invoiceId);
  const ins = db.prepare(
    `INSERT INTO invoice_items (invoice_id, description, quantity, rate, position)
     VALUES (?,?,?,?,?)`,
  );
  items.forEach((it, i) =>
    ins.run(invoiceId, it.description, it.quantity, it.rate, i),
  );
}

invoicesRouter.get('/', (req, res) => {
  const rows = db
    .prepare('SELECT id FROM invoices ORDER BY date(issue_date) DESC, id DESC')
    .all() as { id: number }[];
  let list = rows.map((r) => {
    const inv = getInvoice(r.id)!;
    return {
      id: inv.id,
      number: inv.number,
      client_id: inv.client_id,
      client_name: inv.client?.name ?? '—',
      status: inv.status,
      issue_date: inv.issue_date,
      due_date: inv.due_date,
      total: inv.total,
      paid: inv.paid,
      balance: inv.balance,
    };
  });
  if (req.query.status)
    list = list.filter((i) => i.status === req.query.status);
  if (req.query.client_id)
    list = list.filter((i) => String(i.client_id) === String(req.query.client_id));
  res.json(list);
});

invoicesRouter.get('/:id', (req, res) => {
  const inv = getInvoice(Number(req.params.id));
  if (!inv) return res.status(404).json({ error: 'Invoice not found' });
  res.json(inv);
});

invoicesRouter.post('/', (req, res) => {
  const b = req.body ?? {};
  if (!b.client_id)
    return res.status(400).json({ error: 'client_id is required' });
  const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get() as any;
  const issue = b.issue_date || todayISO();
  const due =
    b.due_date ||
    new Date(Date.now() + settings.payment_terms * 86400000)
      .toISOString()
      .slice(0, 10);

  const tx = db.transaction(() => {
    const number = b.number?.trim() || nextNumber('invoice');
    const info = db
      .prepare(
        `INSERT INTO invoices (number, client_id, status, issue_date, due_date, tax_rate, discount, notes)
         VALUES (?,?,?,?,?,?,?,?)`,
      )
      .run(
        number,
        b.client_id,
        b.status === 'sent' ? 'sent' : 'draft',
        issue,
        due,
        b.tax_rate != null ? Number(b.tax_rate) : settings.tax_rate,
        Number(b.discount) || 0,
        b.notes ?? '',
      );
    replaceItems(info.lastInsertRowid as number, sanitizeItems(b.items));
    return info.lastInsertRowid as number;
  });
  try {
    const id = tx();
    res.status(201).json(getInvoice(id));
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

invoicesRouter.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = getInvoice(id);
  if (!existing) return res.status(404).json({ error: 'Invoice not found' });
  const b = req.body ?? {};
  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE invoices SET client_id=?, issue_date=?, due_date=?, tax_rate=?, discount=?, notes=? WHERE id=?`,
    ).run(
      b.client_id ?? existing.client_id,
      b.issue_date ?? existing.issue_date,
      b.due_date ?? existing.due_date,
      b.tax_rate != null ? Number(b.tax_rate) : existing.tax_rate,
      b.discount != null ? Number(b.discount) : existing.discount,
      b.notes ?? existing.notes,
      id,
    );
    if (b.items !== undefined) replaceItems(id, sanitizeItems(b.items));
  });
  tx();
  res.json(getInvoice(id));
});

// Set the stored lifecycle status (draft <-> sent).
invoicesRouter.post('/:id/status', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Invoice not found' });
  const status = req.body?.status;
  if (!['draft', 'sent'].includes(status))
    return res.status(400).json({ error: 'status must be draft or sent' });
  db.prepare('UPDATE invoices SET status = ? WHERE id = ?').run(status, id);
  res.json(getInvoice(id));
});

invoicesRouter.delete('/:id', (req, res) => {
  const info = db
    .prepare('DELETE FROM invoices WHERE id = ?')
    .run(req.params.id);
  if (info.changes === 0)
    return res.status(404).json({ error: 'Invoice not found' });
  res.json({ ok: true });
});

// --- Payments (nested under an invoice) ---

invoicesRouter.post('/:id/payments', (req, res) => {
  const id = Number(req.params.id);
  const inv = getInvoice(id);
  if (!inv) return res.status(404).json({ error: 'Invoice not found' });
  const amount = Number(req.body?.amount);
  if (!amount || amount <= 0)
    return res.status(400).json({ error: 'amount must be greater than 0' });
  db.prepare(
    `INSERT INTO payments (invoice_id, amount, date, method, note) VALUES (?,?,?,?,?)`,
  ).run(
    id,
    amount,
    req.body?.date || todayISO(),
    req.body?.method || 'Bank transfer',
    req.body?.note || '',
  );
  // Recording a payment on a draft implicitly issues it.
  if (inv.status === 'draft')
    db.prepare('UPDATE invoices SET status = ? WHERE id = ?').run('sent', id);
  res.status(201).json(getInvoice(id));
});

invoicesRouter.delete('/:id/payments/:pid', (req, res) => {
  db.prepare('DELETE FROM payments WHERE id = ? AND invoice_id = ?').run(
    req.params.pid,
    req.params.id,
  );
  res.json(getInvoice(Number(req.params.id)));
});
