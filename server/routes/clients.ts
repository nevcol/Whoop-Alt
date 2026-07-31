import { Router } from 'express';
import { db } from '../db.ts';
import { getInvoice } from '../lib.ts';

export const clientsRouter = Router();

function clientWithStats(client: any) {
  const invoiceIds = db
    .prepare('SELECT id FROM invoices WHERE client_id = ?')
    .all(client.id) as { id: number }[];
  let billed = 0;
  let outstanding = 0;
  let open = 0;
  for (const { id } of invoiceIds) {
    const inv = getInvoice(id)!;
    if (inv.status !== 'draft') billed += inv.total;
    outstanding += inv.balance > 0 && inv.status !== 'draft' ? inv.balance : 0;
    if (inv.status !== 'draft' && inv.status !== 'paid') open += 1;
  }
  return {
    ...client,
    invoice_count: invoiceIds.length,
    total_billed: Math.round(billed * 100) / 100,
    outstanding: Math.round(outstanding * 100) / 100,
    open_invoices: open,
  };
}

clientsRouter.get('/', (_req, res) => {
  const rows = db.prepare('SELECT * FROM clients ORDER BY name').all() as any[];
  res.json(rows.map(clientWithStats));
});

clientsRouter.get('/:id', (req, res) => {
  const client = db
    .prepare('SELECT * FROM clients WHERE id = ?')
    .get(req.params.id);
  if (!client) return res.status(404).json({ error: 'Client not found' });
  const invoices = (
    db
      .prepare('SELECT id FROM invoices WHERE client_id = ? ORDER BY created_at DESC')
      .all(req.params.id) as { id: number }[]
  ).map((r) => getInvoice(r.id));
  const estimates = db
    .prepare('SELECT * FROM estimates WHERE client_id = ? ORDER BY created_at DESC')
    .all(req.params.id);
  res.json({ ...clientWithStats(client), invoices, estimates });
});

clientsRouter.post('/', (req, res) => {
  const b = req.body ?? {};
  if (!b.name || !String(b.name).trim())
    return res.status(400).json({ error: 'Name is required' });
  const info = db
    .prepare(
      `INSERT INTO clients (name, company, email, phone, address, notes)
       VALUES (@name, @company, @email, @phone, @address, @notes)`,
    )
    .run({
      name: String(b.name).trim(),
      company: b.company ?? '',
      email: b.email ?? '',
      phone: b.phone ?? '',
      address: b.address ?? '',
      notes: b.notes ?? '',
    });
  res.status(201).json(
    db.prepare('SELECT * FROM clients WHERE id = ?').get(info.lastInsertRowid),
  );
});

clientsRouter.put('/:id', (req, res) => {
  const existing = db
    .prepare('SELECT * FROM clients WHERE id = ?')
    .get(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: 'Client not found' });
  const b = req.body ?? {};
  db.prepare(
    `UPDATE clients SET name=@name, company=@company, email=@email,
     phone=@phone, address=@address, notes=@notes WHERE id=@id`,
  ).run({
    id: req.params.id,
    name: (b.name ?? existing.name) || existing.name,
    company: b.company ?? existing.company,
    email: b.email ?? existing.email,
    phone: b.phone ?? existing.phone,
    address: b.address ?? existing.address,
    notes: b.notes ?? existing.notes,
  });
  res.json(db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id));
});

clientsRouter.delete('/:id', (req, res) => {
  const count = db
    .prepare('SELECT COUNT(*) AS c FROM invoices WHERE client_id = ?')
    .get(req.params.id) as { c: number };
  const eCount = db
    .prepare('SELECT COUNT(*) AS c FROM estimates WHERE client_id = ?')
    .get(req.params.id) as { c: number };
  if (count.c > 0 || eCount.c > 0)
    return res.status(409).json({
      error: 'Cannot delete a client with invoices or estimates.',
    });
  db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});
