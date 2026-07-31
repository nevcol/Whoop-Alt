import { useState } from 'react';
import { api } from '../lib/api';
import { useSettings } from '../lib/store';
import { Button, Card, Field, PageHeader, Spinner, useToast } from '../components/ui';
import type { Settings } from '../lib/types';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'INR', 'MXN'];

export function SettingsPage() {
  const { settings, loading, setSettings } = useSettings();
  const toast = useToast();
  const [form, setForm] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  // Initialise the local form once settings have loaded.
  if (settings && !form) setForm(settings);
  if (loading || !form) return <Spinner label="Loading settings…" />;

  const set =
    (k: keyof Settings) => (e: { target: { value: string } }) =>
      setForm((f) => (f ? { ...f, [k]: e.target.value } : f));

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      const updated = await api.updateSettings({
        ...form,
        tax_rate: Number(form.tax_rate) || 0,
        payment_terms: Number(form.payment_terms) || 0,
      });
      setSettings(updated);
      setForm(updated);
      toast('Settings saved.');
    } catch (e: any) {
      toast(e.message ?? 'Failed to save.', 'err');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Business profile and invoicing defaults"
        actions={
          <Button variant="primary" onClick={save} disabled={saving}>
            Save changes
          </Button>
        }
      />

      <div className="grid grid-2">
        <Card title="Business profile">
          <Field label="Business name">
            <input className="inp" value={form.business_name} onChange={set('business_name')} />
          </Field>
          <div className="form-row">
            <Field label="Email">
              <input className="inp" value={form.email} onChange={set('email')} />
            </Field>
            <Field label="Phone">
              <input className="inp" value={form.phone} onChange={set('phone')} />
            </Field>
          </div>
          <Field label="Website">
            <input className="inp" value={form.website} onChange={set('website')} />
          </Field>
          <Field label="Address">
            <textarea className="inp" value={form.address} onChange={set('address')} />
          </Field>
        </Card>

        <div className="stack">
          <Card title="Invoicing defaults">
            <div className="form-row">
              <Field label="Currency">
                <select className="inp" value={form.currency} onChange={set('currency')}>
                  {CURRENCIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Default tax rate %">
                <input
                  className="inp mono"
                  type="number"
                  step="any"
                  value={form.tax_rate}
                  onChange={set('tax_rate')}
                />
              </Field>
            </div>
            <div className="form-row">
              <Field label="Payment terms (days)" hint="Sets the default due date.">
                <input
                  className="inp mono"
                  type="number"
                  value={form.payment_terms}
                  onChange={set('payment_terms')}
                />
              </Field>
              <div />
            </div>
            <div className="form-row">
              <Field label="Invoice prefix">
                <input className="inp" value={form.invoice_prefix} onChange={set('invoice_prefix')} />
              </Field>
              <Field label="Estimate prefix">
                <input
                  className="inp"
                  value={form.estimate_prefix}
                  onChange={set('estimate_prefix')}
                />
              </Field>
            </div>
            <p className="muted" style={{ fontSize: 12 }}>
              Next invoice: {form.invoice_prefix}
              {form.next_invoice_seq} · Next estimate: {form.estimate_prefix}
              {form.next_estimate_seq}
            </p>
          </Card>

          <Card title="Document footer">
            <Field label="Footer / thank-you note" hint="Appears at the bottom of every invoice and estimate.">
              <textarea className="inp" value={form.footer} onChange={set('footer')} />
            </Field>
          </Card>
        </div>
      </div>
    </>
  );
}
