import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  Client,
  Estimate,
  Invoice,
  LineItem,
  Settings,
} from '../lib/types';
import { api } from '../lib/api';
import { money, todayISO, addDaysISO } from '../lib/format';
import { Button, Field, useToast } from './ui';

interface Props {
  kind: 'invoice' | 'estimate';
  clients: Client[];
  settings: Settings;
  existing?: Invoice | Estimate;
  defaultClientId?: number;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function DocumentEditor({
  kind,
  clients,
  settings,
  existing,
  defaultClientId,
}: Props) {
  const navigate = useNavigate();
  const toast = useToast();
  const isInvoice = kind === 'invoice';

  const [clientId, setClientId] = useState<number | ''>(
    existing?.client_id ?? defaultClientId ?? clients[0]?.id ?? '',
  );
  const [issueDate, setIssueDate] = useState(
    existing?.issue_date ?? todayISO(),
  );
  const [secondDate, setSecondDate] = useState(
    existing
      ? isInvoice
        ? (existing as Invoice).due_date
        : (existing as Estimate).expiry_date
      : isInvoice
        ? addDaysISO(todayISO(), settings.payment_terms)
        : addDaysISO(todayISO(), 30),
  );
  const [taxRate, setTaxRate] = useState<number>(
    existing?.tax_rate ?? settings.tax_rate,
  );
  const [discount, setDiscount] = useState<number>(existing?.discount ?? 0);
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [items, setItems] = useState<LineItem[]>(
    existing?.items.length
      ? existing.items.map((i) => ({ ...i }))
      : [{ description: '', quantity: 1, rate: 0 }],
  );
  const [saving, setSaving] = useState(false);

  const totals = useMemo(() => {
    const subtotal = round2(
      items.reduce((s, it) => s + (it.quantity || 0) * (it.rate || 0), 0),
    );
    const afterDiscount = Math.max(0, subtotal - (discount || 0));
    const tax = round2(afterDiscount * ((taxRate || 0) / 100));
    return { subtotal, tax, total: round2(afterDiscount + tax) };
  }, [items, taxRate, discount]);

  function updateItem(idx: number, patch: Partial<LineItem>) {
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    );
  }
  function addItem() {
    setItems((prev) => [...prev, { description: '', quantity: 1, rate: 0 }]);
  }
  function removeItem(idx: number) {
    setItems((prev) =>
      prev.length === 1 ? prev : prev.filter((_, i) => i !== idx),
    );
  }

  async function save(sendAfter: boolean) {
    if (!clientId) {
      toast('Please choose a client.', 'err');
      return;
    }
    const cleanItems = items.filter(
      (it) => it.description.trim() || it.quantity || it.rate,
    );
    if (cleanItems.length === 0) {
      toast('Add at least one line item.', 'err');
      return;
    }
    setSaving(true);
    try {
      if (isInvoice) {
        const payload = {
          client_id: Number(clientId),
          issue_date: issueDate,
          due_date: secondDate,
          tax_rate: Number(taxRate) || 0,
          discount: Number(discount) || 0,
          notes,
          items: cleanItems,
          status: sendAfter ? ('sent' as const) : undefined,
        };
        const saved = existing
          ? await api.updateInvoice(existing.id, payload)
          : await api.createInvoice(payload);
        if (sendAfter && existing) await api.setInvoiceStatus(saved.id, 'sent');
        toast(existing ? 'Invoice updated.' : 'Invoice created.');
        navigate(`/invoices/${saved.id}`);
      } else {
        const payload = {
          client_id: Number(clientId),
          issue_date: issueDate,
          expiry_date: secondDate,
          tax_rate: Number(taxRate) || 0,
          discount: Number(discount) || 0,
          notes,
          items: cleanItems,
          status: sendAfter ? 'sent' : undefined,
        };
        const saved = existing
          ? await api.updateEstimate(existing.id, payload)
          : await api.createEstimate(payload);
        if (sendAfter && existing)
          await api.setEstimateStatus(saved.id, 'sent');
        toast(existing ? 'Estimate updated.' : 'Estimate created.');
        navigate(`/estimates/${saved.id}`);
      }
    } catch (e: any) {
      toast(e.message ?? 'Failed to save.', 'err');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="form-row">
          <Field label="Client">
            <select
              className="inp"
              value={clientId}
              onChange={(e) =>
                setClientId(e.target.value ? Number(e.target.value) : '')
              }
            >
              <option value="">Select a client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.company ? ` — ${c.company}` : ''}
                </option>
              ))}
            </select>
          </Field>
          <div />
        </div>
        <div className="form-row">
          <Field label="Issue date">
            <input
              type="date"
              className="inp"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
            />
          </Field>
          <Field label={isInvoice ? 'Due date' : 'Valid until'}>
            <input
              type="date"
              className="inp"
              value={secondDate}
              onChange={(e) => setSecondDate(e.target.value)}
            />
          </Field>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title" style={{ marginBottom: 12 }}>
          Line items
        </h3>
        <div className="table-wrap" style={{ boxShadow: 'none' }}>
          <table className="items-editor">
            <thead>
              <tr>
                <th>Description</th>
                <th className="col-qty">Qty</th>
                <th className="col-rate">Rate</th>
                <th className="col-amt right">Amount</th>
                <th className="col-del" />
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={idx}>
                  <td>
                    <input
                      value={it.description}
                      placeholder="Service or product"
                      onChange={(e) =>
                        updateItem(idx, { description: e.target.value })
                      }
                    />
                  </td>
                  <td className="col-qty">
                    <input
                      type="number"
                      step="any"
                      value={it.quantity}
                      onChange={(e) =>
                        updateItem(idx, { quantity: Number(e.target.value) })
                      }
                    />
                  </td>
                  <td className="col-rate">
                    <input
                      type="number"
                      step="any"
                      value={it.rate}
                      onChange={(e) =>
                        updateItem(idx, { rate: Number(e.target.value) })
                      }
                    />
                  </td>
                  <td className="col-amt amt-cell mono">
                    {money((it.quantity || 0) * (it.rate || 0), settings.currency)}
                  </td>
                  <td className="col-del">
                    <button
                      className="row-del"
                      onClick={() => removeItem(idx)}
                      aria-label="Remove line"
                      type="button"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 12 }}>
          <Button variant="ghost" size="sm" onClick={addItem} type="button">
            + Add line item
          </Button>
        </div>

        <div className="summary-box" style={{ marginTop: 18 }}>
          <div className="row">
            <span className="muted">Subtotal</span>
            <span className="mono">{money(totals.subtotal, settings.currency)}</span>
          </div>
          <div className="row">
            <span className="muted">Discount</span>
            <input
              className="inline-input mono"
              type="number"
              step="any"
              value={discount}
              onChange={(e) => setDiscount(Number(e.target.value))}
            />
          </div>
          <div className="row">
            <span className="muted">Tax rate %</span>
            <input
              className="inline-input mono"
              type="number"
              step="any"
              value={taxRate}
              onChange={(e) => setTaxRate(Number(e.target.value))}
            />
          </div>
          <div className="row">
            <span className="muted">Tax</span>
            <span className="mono">{money(totals.tax, settings.currency)}</span>
          </div>
          <div className="row total">
            <span>Total</span>
            <span className="mono">{money(totals.total, settings.currency)}</span>
          </div>
        </div>
      </div>

      <div className="card">
        <Field label="Notes / terms" hint="Shown on the document and PDF.">
          <textarea
            className="inp"
            value={notes}
            placeholder="Payment terms, thank-you note, project details…"
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
      </div>

      <div className="form-actions">
        <Button variant="ghost" onClick={() => navigate(-1)} type="button">
          Cancel
        </Button>
        <Button
          variant="secondary"
          onClick={() => save(false)}
          disabled={saving}
          type="button"
        >
          {existing ? 'Save changes' : 'Save as draft'}
        </Button>
        <Button
          variant="primary"
          onClick={() => save(true)}
          disabled={saving}
          type="button"
        >
          {isInvoice ? 'Save & mark as sent' : 'Save & mark as sent'}
        </Button>
      </div>
    </div>
  );
}
