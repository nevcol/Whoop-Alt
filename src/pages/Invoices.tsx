import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { useCurrency } from '../lib/store';
import { money, formatDate, statusColor } from '../lib/format';
import { Badge, Button, EmptyState, PageHeader, Spinner } from '../components/ui';

const FILTERS = ['all', 'draft', 'sent', 'partial', 'overdue', 'paid'] as const;

export function Invoices() {
  const navigate = useNavigate();
  const currency = useCurrency();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');
  const { data, loading } = useAsync(() => api.listInvoices(), []);

  const rows = (data ?? []).filter((r) =>
    filter === 'all' ? true : r.status === filter,
  );

  return (
    <>
      <PageHeader
        title="Invoices"
        subtitle={data ? `${data.length} invoice(s)` : undefined}
        actions={
          <Button variant="primary" onClick={() => navigate('/invoices/new')}>
            + New invoice
          </Button>
        }
      />

      <div className="filters">
        {FILTERS.map((f) => (
          <button
            key={f}
            className={`pill ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All' : f[0].toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner label="Loading invoices…" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon="🧾"
          title={filter === 'all' ? 'No invoices yet' : `No ${filter} invoices`}
          message={filter === 'all' ? 'Create your first invoice to get paid.' : undefined}
          action={
            filter === 'all' ? (
              <Button variant="primary" onClick={() => navigate('/invoices/new')}>
                + New invoice
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Client</th>
                <th>Issued</th>
                <th>Due</th>
                <th>Status</th>
                <th className="right">Total</th>
                <th className="right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="clickable"
                  onClick={() => navigate(`/invoices/${r.id}`)}
                >
                  <td className="cell-strong">{r.number}</td>
                  <td>{r.client_name}</td>
                  <td className="muted">{formatDate(r.issue_date)}</td>
                  <td className="muted">{formatDate(r.due_date)}</td>
                  <td>
                    <Badge status={statusColor(r.status)} label={r.status} />
                  </td>
                  <td className="right mono">{money(r.total, currency)}</td>
                  <td className="right mono">{money(r.balance, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
