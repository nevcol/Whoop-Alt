import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { useSettings } from '../lib/store';
import { money, formatDate, todayISO } from '../lib/format';
import { DocumentView } from '../components/DocumentView';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  Spinner,
  useToast,
} from '../components/ui';
import type { Invoice } from '../lib/types';

export function InvoiceDetail() {
  const { id } = useParams();
  const invoiceId = Number(id);
  const navigate = useNavigate();
  const toast = useToast();
  const { settings } = useSettings();
  const { data, loading, reload } = useAsync(
    () => api.getInvoice(invoiceId),
    [invoiceId],
  );
  const [payOpen, setPayOpen] = useState(false);

  if (loading || !settings) return <Spinner label="Loading invoice…" />;
  if (!data)
    return (
      <EmptyState
        title="Invoice not found"
        action={<Button onClick={() => navigate('/invoices')}>Back to invoices</Button>}
      />
    );

  const inv = data;

  async function setStatus(status: 'draft' | 'sent') {
    try {
      await api.setInvoiceStatus(invoiceId, status);
      toast(status === 'sent' ? 'Marked as sent.' : 'Moved to draft.');
      reload();
    } catch (e: any) {
      toast(e.message, 'err');
    }
  }

  async function remove() {
    if (!confirm(`Delete ${inv.number}? This cannot be undone.`)) return;
    try {
      await api.deleteInvoice(invoiceId);
      toast('Invoice deleted.');
      navigate('/invoices');
    } catch (e: any) {
      toast(e.message, 'err');
    }
  }

  async function deletePayment(pid: number) {
    if (!confirm('Remove this payment?')) return;
    try {
      await api.deletePayment(invoiceId, pid);
      toast('Payment removed.');
      reload();
    } catch (e: any) {
      toast(e.message, 'err');
    }
  }

  return (
    <>
      <PageHeader
        title={
          <span style={{ display: 'inline-flex', gap: 12, alignItems: 'center' }}>
            {inv.number}
            <Badge status={statusColor(inv.status)} label={inv.status} />
          </span>
        }
        subtitle={inv.client?.name}
        actions={
          <div className="page-actions no-print">
            <Button onClick={() => navigate(`/invoices/${invoiceId}/edit`)}>
              Edit
            </Button>
            {inv.status === 'draft' ? (
              <Button variant="primary" onClick={() => setStatus('sent')}>
                Mark as sent
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => setStatus('draft')}>
                Revert to draft
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={async () => {
                const { downloadDocumentPdf } = await import('../lib/pdf');
                downloadDocumentPdf('invoice', inv, settings);
              }}
            >
              ⬇ PDF
            </Button>
            <Button variant="secondary" onClick={() => window.print()}>
              Print
            </Button>
            <Button variant="danger" onClick={remove}>
              Delete
            </Button>
          </div>
        }
      />

      <div className="detail-grid">
        <DocumentView kind="invoice" doc={inv} settings={settings} />

        <div className="stack no-print">
          <Card
            title="Payments"
            actions={
              inv.status !== 'draft' && inv.balance > 0 ? (
                <Button size="sm" variant="primary" onClick={() => setPayOpen(true)}>
                  + Record
                </Button>
              ) : undefined
            }
          >
            <div className="kv">
              <span className="k">Total</span>
              <span className="mono">{money(inv.total, settings.currency)}</span>
            </div>
            <div className="kv">
              <span className="k">Paid</span>
              <span className="mono">{money(inv.paid, settings.currency)}</span>
            </div>
            <div className="kv">
              <span className="k">Balance</span>
              <strong className="mono">{money(inv.balance, settings.currency)}</strong>
            </div>

            {inv.status === 'draft' && (
              <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>
                Mark this invoice as sent to record payments.
              </p>
            )}
            {inv.balance <= 0 && inv.status !== 'draft' && (
              <p style={{ fontSize: 13, marginTop: 10, color: '#047857' }}>
                ✓ Paid in full
              </p>
            )}

            <div style={{ marginTop: 14 }}>
              {inv.payments.length === 0 ? (
                <p className="muted" style={{ fontSize: 13 }}>
                  No payments recorded.
                </p>
              ) : (
                inv.payments.map((p) => (
                  <div
                    key={p.id}
                    className="kv"
                    style={{ alignItems: 'flex-start' }}
                  >
                    <span>
                      <div className="mono">{money(p.amount, settings.currency)}</div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {formatDate(p.date)} · {p.method}
                        {p.note ? ` · ${p.note}` : ''}
                      </div>
                    </span>
                    <button
                      className="row-del"
                      onClick={() => deletePayment(p.id)}
                      aria-label="Remove payment"
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card title="Details">
            <div className="kv">
              <span className="k">Issued</span>
              <span>{formatDate(inv.issue_date)}</span>
            </div>
            <div className="kv">
              <span className="k">Due</span>
              <span>{formatDate(inv.due_date)}</span>
            </div>
            {inv.from_estimate_id && (
              <div className="kv">
                <span className="k">From estimate</span>
                <span
                  className="link"
                  onClick={() => navigate(`/estimates/${inv.from_estimate_id}`)}
                >
                  View
                </span>
              </div>
            )}
          </Card>
        </div>
      </div>

      <PaymentModal
        open={payOpen}
        invoice={inv}
        currency={settings.currency}
        onClose={() => setPayOpen(false)}
        onSaved={() => {
          setPayOpen(false);
          reload();
          toast('Payment recorded.');
        }}
      />
    </>
  );
}

function PaymentModal({
  open,
  invoice,
  currency,
  onClose,
  onSaved,
}: {
  open: boolean;
  invoice: Invoice;
  currency: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [amount, setAmount] = useState(invoice.balance);
  const [date, setDate] = useState(todayISO());
  const [method, setMethod] = useState('Bank transfer');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  // Sync default amount to the remaining balance when opened.
  const [seen, setSeen] = useState(false);
  if (open && !seen) {
    setAmount(invoice.balance);
    setDate(todayISO());
    setNote('');
    setSeen(true);
  }
  if (!open && seen) setSeen(false);

  async function submit() {
    if (!amount || amount <= 0) {
      toast('Enter a payment amount.', 'err');
      return;
    }
    setSaving(true);
    try {
      await api.addPayment(invoice.id, { amount, date, method, note });
      onSaved();
    } catch (e: any) {
      toast(e.message, 'err');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Record payment">
      <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>
        Balance due: <strong>{money(invoice.balance, currency)}</strong>
      </p>
      <div className="form-row">
        <Field label="Amount">
          <input
            className="inp mono"
            type="number"
            step="any"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
        </Field>
        <Field label="Date">
          <input
            className="inp"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
      </div>
      <Field label="Method">
        <select className="inp" value={method} onChange={(e) => setMethod(e.target.value)}>
          {['Bank transfer', 'Credit card', 'Cash', 'Check', 'PayPal', 'Other'].map(
            (m) => (
              <option key={m}>{m}</option>
            ),
          )}
        </select>
      </Field>
      <Field label="Note">
        <input className="inp" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <div className="form-actions">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={submit} disabled={saving}>
          Record payment
        </Button>
      </div>
    </Modal>
  );
}

function statusColor(s: string): string {
  const map: Record<string, string> = {
    draft: 'gray',
    sent: 'blue',
    partial: 'amber',
    paid: 'green',
    overdue: 'red',
  };
  return map[s] ?? 'gray';
}
