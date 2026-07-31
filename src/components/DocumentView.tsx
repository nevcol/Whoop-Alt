import type { Estimate, Invoice, Settings } from '../lib/types';
import { money, formatDate } from '../lib/format';
import { Badge } from './ui';

export function DocumentView({
  kind,
  doc,
  settings,
}: {
  kind: 'invoice' | 'estimate';
  doc: Invoice | Estimate;
  settings: Settings;
}) {
  const isInvoice = kind === 'invoice';
  const currency = settings.currency;
  const client = doc.client;
  const dateLabel = isInvoice ? 'Due date' : 'Valid until';
  const dateValue = isInvoice
    ? (doc as Invoice).due_date
    : (doc as Estimate).expiry_date;
  const inv = isInvoice ? (doc as Invoice) : null;

  return (
    <div className="doc">
      <div className="doc-top">
        <div>
          <div className="doc-biz-name">{settings.business_name}</div>
          <div className="doc-meta" style={{ whiteSpace: 'pre-line' }}>
            {[settings.address, settings.email, settings.phone, settings.website]
              .filter(Boolean)
              .join('\n')}
          </div>
        </div>
        <div className="doc-title">
          <h2>{isInvoice ? 'Invoice' : 'Estimate'}</h2>
          <div className="doc-meta">
            <div>{doc.number}</div>
            <div style={{ marginTop: 6 }}>
              <Badge status={statusToColor(doc.status)} label={doc.status} />
            </div>
          </div>
        </div>
      </div>

      <div className="doc-parties">
        <div>
          <div className="doc-label">Bill to</div>
          <div className="doc-addr">
            <strong>{client?.name ?? '—'}</strong>
            {client?.company ? `\n${client.company}` : ''}
            {client?.address ? `\n${client.address}` : ''}
            {client?.email ? `\n${client.email}` : ''}
          </div>
        </div>
        <div style={{ minWidth: 200 }}>
          <div className="kv">
            <span className="k">Issue date</span>
            <span>{formatDate(doc.issue_date)}</span>
          </div>
          <div className="kv">
            <span className="k">{dateLabel}</span>
            <span>{formatDate(dateValue)}</span>
          </div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th className="right">Qty</th>
            <th className="right">Rate</th>
            <th className="right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {doc.items.length === 0 && (
            <tr>
              <td colSpan={4} className="muted">
                No line items.
              </td>
            </tr>
          )}
          {doc.items.map((it, i) => (
            <tr key={i}>
              <td>{it.description || '—'}</td>
              <td className="right mono">{it.quantity}</td>
              <td className="right mono">{money(it.rate, currency)}</td>
              <td className="right mono">
                {money(it.quantity * it.rate, currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="doc-totals">
        <div className="row">
          <span className="muted">Subtotal</span>
          <span className="mono">{money(doc.subtotal, currency)}</span>
        </div>
        {doc.discount > 0 && (
          <div className="row">
            <span className="muted">Discount</span>
            <span className="mono">− {money(doc.discount, currency)}</span>
          </div>
        )}
        <div className="row">
          <span className="muted">Tax ({doc.tax_rate}%)</span>
          <span className="mono">{money(doc.tax, currency)}</span>
        </div>
        <div className="row grand">
          <span>Total</span>
          <span className="mono">{money(doc.total, currency)}</span>
        </div>
        {inv && inv.paid > 0 && (
          <>
            <div className="row">
              <span className="muted">Paid</span>
              <span className="mono">− {money(inv.paid, currency)}</span>
            </div>
            <div className="row balance">
              <span>Balance due</span>
              <span className="mono">{money(inv.balance, currency)}</span>
            </div>
          </>
        )}
      </div>

      {doc.notes && <div className="doc-notes">{doc.notes}</div>}
      {settings.footer && (
        <div
          className="doc-notes"
          style={{ textAlign: 'center', borderTop: 'none' }}
        >
          {settings.footer}
        </div>
      )}
    </div>
  );
}

function statusToColor(status: string): string {
  const map: Record<string, string> = {
    draft: 'gray',
    sent: 'blue',
    partial: 'amber',
    paid: 'green',
    overdue: 'red',
    accepted: 'green',
    declined: 'red',
    converted: 'violet',
    expired: 'gray',
  };
  return map[status] ?? 'gray';
}
