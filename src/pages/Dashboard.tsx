import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { useCurrency } from '../lib/store';
import { money, formatDate } from '../lib/format';
import { Badge, Button, Card, PageHeader, Spinner, EmptyState } from '../components/ui';
import type { Summary } from '../lib/types';

export function Dashboard() {
  const navigate = useNavigate();
  const currency = useCurrency();
  const { data: summary, loading } = useAsync<Summary>(() => api.getSummary(), []);
  const { data: recent } = useAsync(() => api.listInvoices(), []);

  if (loading || !summary) return <Spinner label="Loading dashboard…" />;

  const maxRevenue = Math.max(1, ...summary.monthly.map((m) => m.revenue));
  const recentRows = (recent ?? []).slice(0, 6);

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Your business at a glance"
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate('/estimates/new')}>
              New estimate
            </Button>
            <Button variant="primary" onClick={() => navigate('/invoices/new')}>
              + New invoice
            </Button>
          </>
        }
      />

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <div className="kpi kpi-green">
          <div className="kpi-label">Paid (30 days)</div>
          <div className="kpi-value">{money(summary.revenue_30, currency)}</div>
          <div className="kpi-sub">Payments received</div>
        </div>
        <div className="kpi kpi-amber">
          <div className="kpi-label">Outstanding</div>
          <div className="kpi-value">{money(summary.outstanding, currency)}</div>
          <div className="kpi-sub">Awaiting payment</div>
        </div>
        <div className="kpi kpi-red">
          <div className="kpi-label">Overdue</div>
          <div className="kpi-value">{money(summary.overdue, currency)}</div>
          <div className="kpi-sub">{summary.counts.overdue ?? 0} invoice(s)</div>
        </div>
        <div className="kpi kpi-accent">
          <div className="kpi-label">Draft value</div>
          <div className="kpi-value">{money(summary.draft_total, currency)}</div>
          <div className="kpi-sub">Not yet sent</div>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <Card title="Revenue — last 6 months">
          {summary.revenue_total === 0 ? (
            <EmptyState title="No payments recorded yet" message="Record a payment on an invoice to see revenue here." />
          ) : (
            <div className="mini-bars">
              {summary.monthly.map((m) => (
                <div className="bar-col" key={m.label} title={money(m.revenue, currency)}>
                  <div
                    className="bar"
                    style={{ height: `${(m.revenue / maxRevenue) * 100}%` }}
                  />
                  <div className="bar-lbl">{m.label}</div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Top clients">
          {summary.top_clients.length === 0 ? (
            <EmptyState title="No billed clients yet" />
          ) : (
            summary.top_clients.map((c) => (
              <div className="kv" key={c.id}>
                <Link className="link" to={`/clients/${c.id}`}>
                  {c.name}
                </Link>
                <span className="mono">{money(c.billed, currency)}</span>
              </div>
            ))
          )}
        </Card>
      </div>

      <Card
        title="Recent invoices"
        actions={<Link className="link" to="/invoices">View all →</Link>}
      >
        {recentRows.length === 0 ? (
          <EmptyState
            title="No invoices yet"
            action={
              <Button variant="primary" onClick={() => navigate('/invoices/new')}>
                Create your first invoice
              </Button>
            }
          />
        ) : (
          <div className="table-wrap" style={{ boxShadow: 'none', border: 'none' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Client</th>
                  <th>Issued</th>
                  <th>Status</th>
                  <th className="right">Total</th>
                  <th className="right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {recentRows.map((r) => (
                  <tr
                    key={r.id}
                    className="clickable"
                    onClick={() => navigate(`/invoices/${r.id}`)}
                  >
                    <td className="cell-strong">{r.number}</td>
                    <td>{r.client_name}</td>
                    <td className="muted">{formatDate(r.issue_date)}</td>
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
      </Card>
    </>
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
