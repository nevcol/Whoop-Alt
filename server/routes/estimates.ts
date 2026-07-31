import { Router } from 'express';
import { db } from '../db.ts';
import {
  getEstimate,
  getInvoice,
  sanitizeItems,
  nextNumber,
  todayISO,
  type ItemInput,
} from '../lib.ts';

export const estimatesRouter = Router();

const VALID = ['draft', 'sent', 'accepted', 'declined', 'converted'];

function replaceItems(estimateId: number, items: ItemInput[]) {
  db.prepare('DELETE FROM estimate_items WHERE estimate_id = ?').run(estimateId);
  const ins = db.prepare(
    `INSERT INTO estimate_items (estimate_id, description, quantity, rate, position)
     VALUES (?,?,?,?,?)`,
  );
  items.forEach((it, i) =>
    ins.run(estimateId, it.description, it.quantity, it.rate, i),
  );
}

estimatesRouter.get('/', (req, res) => {
  const rows = db
    .prepare('SELECT id FROM estimates ORDER BY date(issue_date) DESC, id DESC')
    .all() as { id: number }[];
  let list = rows.map((r) => {
    const est = getEstimate(r.id)!;
    return {
      id: est.id,
      number: est.number,
      client_id: est.client_id,
      client_name: est.client?.name ?? '—',
      status: est.status,
      issue_date: est.issue_date,
      expiry_date: est.expiry_date,
      total: est.total,
      converted_invoice_id: est.converted_invoice_id,
    };
  });
  if (req.query.status)
    list = list.filter((e) => e.status === req.query.status);
  res.json(list);
});

estimatesRouter.get('/:id', (req, res) => {
  const est = getEstimate(Number(req.params.id));
  if (!est) return res.status(404).json({ error: 'Estimate not found' });
  res.json(est);
});

estimatesRouter.post('/', (req, res) => {
  const b = req.body ?? {};
  if (!b.client_id)
    return res.status(400).json({ error: 'client_id is required' });
  const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get() as any;
  const issue = b.issue_date || todayISO();
  const expiry =
    b.expiry_date ||
    new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  try {
    const id = db.transaction(() => {
      const number = b.number?.trim() || nextNumber('estimate');
      const info = db
        .prepare(
          `INSERT INTO estimates (number, client_id, status, issue_date, expiry_date, tax_rate, discount, notes)
           VALUES (?,?,?,?,?,?,?,?)`,
        )
        .run(
          number,
          b.client_id,
          VALID.includes(b.status) ? b.status : 'draft',
          issue,
          expiry,
          b.tax_rate != null ? Number(b.tax_rate) : settings.tax_rate,
          Number(b.discount) || 0,
          b.notes ?? '',
        );
      replaceItems(info.lastInsertRowid as number, sanitizeItems(b.items));
      return info.lastInsertRowid as number;
    })();
    res.status(201).json(getEstimate(id));
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

estimatesRouter.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = getEstimate(id);
  if (!existing) return res.status(404).json({ error: 'Estimate not found' });
  const b = req.body ?? {};
  db.transaction(() => {
    db.prepare(
      `UPDATE estimates SET client_id=?, issue_date=?, expiry_date=?, tax_rate=?, discount=?, notes=? WHERE id=?`,
    ).run(
      b.client_id ?? existing.client_id,
      b.issue_date ?? existing.issue_date,
      b.expiry_date ?? existing.expiry_date,
      b.tax_rate != null ? Number(b.tax_rate) : existing.tax_rate,
      b.discount != null ? Number(b.discount) : existing.discount,
      b.notes ?? existing.notes,
      id,
    );
    if (b.items !== undefined) replaceItems(id, sanitizeItems(b.items));
  })();
  res.json(getEstimate(id));
});

estimatesRouter.post('/:id/status', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM estimates WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Estimate not found' });
  const status = req.body?.status;
  if (!['draft', 'sent', 'accepted', 'declined'].includes(status))
    return res.status(400).json({ error: 'Invalid status' });
  db.prepare('UPDATE estimates SET status = ? WHERE id = ?').run(status, id);
  res.json(getEstimate(id));
});

// Convert an estimate into a draft invoice, copying its line items.
estimatesRouter.post('/:id/convert', (req, res) => {
  const id = Number(req.params.id);
  const est = getEstimate(id);
  if (!est) return res.status(404).json({ error: 'Estimate not found' });
  if (est.converted_invoice_id)
    return res.status(409).json({
      error: 'Estimate has already been converted.',
      invoice_id: est.converted_invoice_id,
    });
  const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get() as any;
  const invId = db.transaction(() => {
    const number = nextNumber('invoice');
    const due = new Date(Date.now() + settings.payment_terms * 86400000)
      .toISOString()
      .slice(0, 10);
    const info = db
      .prepare(
        `INSERT INTO invoices (number, client_id, status, issue_date, due_date, tax_rate, discount, notes, from_estimate_id)
         VALUES (?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        number,
        est.client_id,
        'draft',
        todayISO(),
        due,
        est.tax_rate,
        est.discount,
        est.notes,
        id,
      );
    const newId = info.lastInsertRowid as number;
    const ins = db.prepare(
      `INSERT INTO invoice_items (invoice_id, description, quantity, rate, position)
       VALUES (?,?,?,?,?)`,
    );
    est.items.forEach((it, i) =>
      ins.run(newId, it.description, it.quantity, it.rate, i),
    );
    db.prepare(
      'UPDATE estimates SET status = ?, converted_invoice_id = ? WHERE id = ?',
    ).run('converted', newId, id);
    return newId;
  })();
  res.status(201).json(getInvoice(invId));
});

estimatesRouter.delete('/:id', (req, res) => {
  const info = db
    .prepare('DELETE FROM estimates WHERE id = ?')
    .run(req.params.id);
  if (info.changes === 0)
    return res.status(404).json({ error: 'Estimate not found' });
  res.json({ ok: true });
});
