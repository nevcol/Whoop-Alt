import { Router } from 'express';
import { db } from '../db.ts';

export const servicesRouter = Router();

servicesRouter.get('/', (req, res) => {
  const rows =
    req.query.all === 'true'
      ? db
          .prepare('SELECT * FROM services ORDER BY category, position, id')
          .all()
      : db
          .prepare(
            'SELECT * FROM services WHERE active = 1 ORDER BY category, position, id',
          )
          .all();
  res.json(rows);
});

servicesRouter.post('/', (req, res) => {
  const b = req.body ?? {};
  if (!b.name || !String(b.name).trim())
    return res.status(400).json({ error: 'Name is required' });
  const info = db
    .prepare(
      `INSERT INTO services (name, category, description, rate, unit, active, position)
       VALUES (@name, @category, @description, @rate, @unit, @active, @position)`,
    )
    .run({
      name: String(b.name).trim(),
      category: (b.category ?? 'General') || 'General',
      description: b.description ?? '',
      rate: Number(b.rate) || 0,
      unit: b.unit ?? 'session',
      active: b.active === false ? 0 : 1,
      position: Number(b.position) || 0,
    });
  res
    .status(201)
    .json(db.prepare('SELECT * FROM services WHERE id = ?').get(info.lastInsertRowid));
});

servicesRouter.put('/:id', (req, res) => {
  const existing = db
    .prepare('SELECT * FROM services WHERE id = ?')
    .get(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: 'Service not found' });
  const b = req.body ?? {};
  db.prepare(
    `UPDATE services SET name=@name, category=@category, description=@description,
     rate=@rate, unit=@unit, active=@active, position=@position WHERE id=@id`,
  ).run({
    id: req.params.id,
    name: (b.name ?? existing.name) || existing.name,
    category: b.category ?? existing.category,
    description: b.description ?? existing.description,
    rate: b.rate != null ? Number(b.rate) : existing.rate,
    unit: b.unit ?? existing.unit,
    active: b.active == null ? existing.active : b.active ? 1 : 0,
    position: b.position != null ? Number(b.position) : existing.position,
  });
  res.json(db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id));
});

servicesRouter.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM services WHERE id = ?').run(req.params.id);
  if (info.changes === 0)
    return res.status(404).json({ error: 'Service not found' });
  res.json({ ok: true });
});
