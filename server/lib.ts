import { db } from './db.ts';

export interface ItemRow {
  id: number;
  description: string;
  quantity: number;
  rate: number;
  position: number;
}

export interface ItemInput {
  description: string;
  quantity: number;
  rate: number;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const todayISO = () => new Date().toISOString().slice(0, 10);

export function computeTotals(
  items: { quantity: number; rate: number }[],
  taxRate: number,
  discount: number,
) {
  const subtotal = round2(
    items.reduce((s, it) => s + it.quantity * it.rate, 0),
  );
  const afterDiscount = Math.max(0, subtotal - (discount || 0));
  const tax = round2(afterDiscount * ((taxRate || 0) / 100));
  const total = round2(afterDiscount + tax);
  return { subtotal, discount: round2(discount || 0), tax, total };
}

/** Effective, payment/date-aware status of an invoice. */
export function invoiceStatus(
  stored: string,
  total: number,
  paid: number,
  dueDate: string,
): 'draft' | 'sent' | 'partial' | 'paid' | 'overdue' {
  if (stored === 'draft') return 'draft';
  const balance = round2(total - paid);
  if (balance <= 0.005) return 'paid';
  if (dueDate < todayISO()) return 'overdue';
  if (paid > 0) return 'partial';
  return 'sent';
}

/** Effective status of an estimate (adds "expired"). */
export function estimateStatus(stored: string, expiryDate: string): string {
  if (stored === 'sent' && expiryDate < todayISO()) return 'expired';
  return stored;
}

export function sanitizeItems(raw: unknown): ItemInput[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      const o = (r ?? {}) as Record<string, unknown>;
      return {
        description: String(o.description ?? '').trim(),
        quantity: Number(o.quantity) || 0,
        rate: Number(o.rate) || 0,
      };
    })
    .filter((it) => it.description !== '' || it.quantity !== 0 || it.rate !== 0);
}

/** Assemble a full invoice object (with items, payments, totals, status). */
export function getInvoice(id: number) {
  const inv = db
    .prepare('SELECT * FROM invoices WHERE id = ?')
    .get(id) as Record<string, any> | undefined;
  if (!inv) return null;
  const items = db
    .prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY position, id')
    .all(id) as ItemRow[];
  const payments = db
    .prepare('SELECT * FROM payments WHERE invoice_id = ? ORDER BY date, id')
    .all(id) as any[];
  const client = db
    .prepare('SELECT * FROM clients WHERE id = ?')
    .get(inv.client_id);
  const totals = computeTotals(items, inv.tax_rate, inv.discount);
  const paid = round2(payments.reduce((s, p) => s + p.amount, 0));
  const balance = round2(totals.total - paid);
  const status = invoiceStatus(inv.status, totals.total, paid, inv.due_date);
  return { ...inv, items, payments, client, ...totals, paid, balance, status };
}

/** Assemble a full estimate object. */
export function getEstimate(id: number) {
  const est = db
    .prepare('SELECT * FROM estimates WHERE id = ?')
    .get(id) as Record<string, any> | undefined;
  if (!est) return null;
  const items = db
    .prepare('SELECT * FROM estimate_items WHERE estimate_id = ? ORDER BY position, id')
    .all(id) as ItemRow[];
  const client = db
    .prepare('SELECT * FROM clients WHERE id = ?')
    .get(est.client_id);
  const totals = computeTotals(items, est.tax_rate, est.discount);
  const status = estimateStatus(est.status, est.expiry_date);
  return { ...est, items, client, ...totals, status };
}

export function nextNumber(kind: 'invoice' | 'estimate'): string {
  const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get() as any;
  if (kind === 'invoice') {
    const n = settings.next_invoice_seq;
    db.prepare('UPDATE settings SET next_invoice_seq = ? WHERE id = 1').run(n + 1);
    return `${settings.invoice_prefix}${n}`;
  }
  const n = settings.next_estimate_seq;
  db.prepare('UPDATE settings SET next_estimate_seq = ? WHERE id = 1').run(n + 1);
  return `${settings.estimate_prefix}${n}`;
}
