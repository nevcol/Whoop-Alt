import { Router } from 'express';
import { db } from '../db.ts';
import { getInvoice } from '../lib.ts';

export const reportsRouter = Router();

reportsRouter.get('/summary', (_req, res) => {
  const ids = db.prepare('SELECT id FROM invoices').all() as { id: number }[];
  const invoices = ids.map((r) => getInvoice(r.id)!);

  let outstanding = 0;
  let overdue = 0;
  let draftTotal = 0;
  const counts = { draft: 0, sent: 0, partial: 0, paid: 0, overdue: 0 };

  // Revenue (payments) over the last 6 months.
  const now = new Date();
  const months: { key: string; label: string; revenue: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleString('en-US', { month: 'short' }),
      revenue: 0,
    });
  }
  const monthMap = new Map(months.map((m) => [m.key, m]));

  let revenue30 = 0;
  const cutoff30 = new Date(now.getTime() - 30 * 86400000)
    .toISOString()
    .slice(0, 10);

  for (const inv of invoices) {
    counts[inv.status as keyof typeof counts]++;
    if (inv.status === 'draft') draftTotal += inv.total;
    if (inv.status !== 'draft' && inv.status !== 'paid') outstanding += inv.balance;
    if (inv.status === 'overdue') overdue += inv.balance;
    for (const p of inv.payments) {
      const key = String(p.date).slice(0, 7);
      const m = monthMap.get(key);
      if (m) m.revenue += p.amount;
      if (String(p.date).slice(0, 10) >= cutoff30) revenue30 += p.amount;
    }
  }

  const r2 = (n: number) => Math.round(n * 100) / 100;

  // Top clients by amount billed (issued invoices).
  const clientTotals = new Map<number, { name: string; billed: number }>();
  for (const inv of invoices) {
    if (inv.status === 'draft') continue;
    const entry = clientTotals.get(inv.client_id) ?? {
      name: inv.client?.name ?? '—',
      billed: 0,
    };
    entry.billed += inv.total;
    clientTotals.set(inv.client_id, entry);
  }
  const topClients = [...clientTotals.entries()]
    .map(([id, v]) => ({ id, name: v.name, billed: r2(v.billed) }))
    .sort((a, b) => b.billed - a.billed)
    .slice(0, 5);

  const clientCount = (
    db.prepare('SELECT COUNT(*) AS c FROM clients').get() as { c: number }
  ).c;

  res.json({
    outstanding: r2(outstanding),
    overdue: r2(overdue),
    draft_total: r2(draftTotal),
    revenue_30: r2(revenue30),
    revenue_total: r2(months.reduce((s, m) => s + m.revenue, 0)),
    client_count: clientCount,
    invoice_count: invoices.length,
    counts,
    monthly: months.map((m) => ({ label: m.label, revenue: r2(m.revenue) })),
    top_clients: topClients,
  });
});

reportsRouter.get('/recent', (_req, res) => {
  const ids = db
    .prepare('SELECT id FROM invoices ORDER BY date(issue_date) DESC, id DESC LIMIT 6')
    .all() as { id: number }[];
  res.json(
    ids.map((r) => {
      const inv = getInvoice(r.id)!;
      return {
        id: inv.id,
        number: inv.number,
        client_name: inv.client?.name ?? '—',
        status: inv.status,
        total: inv.total,
        balance: inv.balance,
        issue_date: inv.issue_date,
      };
    }),
  );
});
