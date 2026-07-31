import { Router } from 'express';
import { db } from '../db.ts';

export const settingsRouter = Router();

settingsRouter.get('/', (_req, res) => {
  res.json(db.prepare('SELECT * FROM settings WHERE id = 1').get());
});

settingsRouter.put('/', (req, res) => {
  const b = req.body ?? {};
  const current = db.prepare('SELECT * FROM settings WHERE id = 1').get() as any;
  const merged = {
    business_name: b.business_name ?? current.business_name,
    email: b.email ?? current.email,
    phone: b.phone ?? current.phone,
    address: b.address ?? current.address,
    website: b.website ?? current.website,
    currency: b.currency ?? current.currency,
    tax_rate: b.tax_rate != null ? Number(b.tax_rate) : current.tax_rate,
    payment_terms:
      b.payment_terms != null ? Number(b.payment_terms) : current.payment_terms,
    invoice_prefix: b.invoice_prefix ?? current.invoice_prefix,
    estimate_prefix: b.estimate_prefix ?? current.estimate_prefix,
    footer: b.footer ?? current.footer,
  };
  db.prepare(
    `UPDATE settings SET business_name=@business_name, email=@email, phone=@phone,
     address=@address, website=@website, currency=@currency, tax_rate=@tax_rate,
     payment_terms=@payment_terms, invoice_prefix=@invoice_prefix,
     estimate_prefix=@estimate_prefix, footer=@footer WHERE id = 1`,
  ).run(merged);
  res.json(db.prepare('SELECT * FROM settings WHERE id = 1').get());
});
