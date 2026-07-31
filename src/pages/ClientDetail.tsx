import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { useCurrency } from '../lib/store';
import { money, formatDate, statusColor } from '../lib/format';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Spinner,
  useToast,
} from '../components/ui';
import { ClientModal } from './Clients';

export function ClientDetail() {
  const { id } = useParams();
  const clientId = Number(id);
  const navigate = useNavigate();
  const currency = useCurrency();
  const toast = useToast();
  const { data, loading, reload } = useAsync(
    () => api.getClient(clientId),
    [clientId],
  );
  const [editing, setEditing] = useState(false);

  if (loading) return <Spinner label="Loading client…" />;
  if (!data)
    return (
      <EmptyState
        title="Client not found"
        action={<Button onClick={() => navigate('/clients')}>Back to clients</Button>}
      />
    );

  async function remove() {
    if (!confirm(`Delete ${data!.name}? This cannot be undone.`)) return;
    try {
      await api.deleteClient(clientId);
      toast('Client deleted.');
      navigate('/clients');
    } catch (e: any) {
      toast(e.message ?? 'Could not delete.', 'err');
    }
  }

  return (
    <>
      <PageHeader
        title={data.name}
        subtitle={data.company || undefined}
        actions={
          <>
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button variant="danger" onClick={remove}>
              Delete
            </Button>
            <Button
              variant="primary"
              onClick={() => navigate(`/invoices/new?client=${clientId}`)}
            >
              + New invoice
            </Button>
          </>
        }
      />

      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        <div className="kpi">
          <div className="kpi-label">Total billed</div>
          <div className="kpi-value">{money(data.total_billed, currency)}</div>
        </div>
        <div className="kpi kpi-amber">
          <div className="kpi-label">Outstanding</div>
          <div className="kpi-value">{money(data.outstanding, currency)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Invoices</div>
          <div className="kpi-value">{data.invoice_count}</div>
        </div>
      </div>

      <div className="detail-grid">
        <div className="stack">
          <Card title="Invoices">
            {data.invoices.length === 0 ? (
              <EmptyState title="No invoices yet" />
            ) : (
              <div className="table-wrap" style={{ boxShadow: 'none', border: 'none' }}>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Issued</th>
                      <th>Status</th>
                      <th className="right">Total</th>
                      <th className="right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.invoices.map((inv) => (
                      <tr
                        key={inv.id}
                        className="clickable"
                        onClick={() => navigate(`/invoices/${inv.id}`)}
                      >
                        <td className="cell-strong">{inv.number}</td>
                        <td className="muted">{formatDate(inv.issue_date)}</td>
                        <td>
                          <Badge status={statusColor(inv.status)} label={inv.status} />
                        </td>
                        <td className="right mono">{money(inv.total, currency)}</td>
                        <td className="right mono">{money(inv.balance, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Estimates">
            {data.estimates.length === 0 ? (
              <EmptyState title="No estimates yet" />
            ) : (
              <div className="table-wrap" style={{ boxShadow: 'none', border: 'none' }}>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Estimate</th>
                      <th>Issued</th>
                      <th>Status</th>
                      <th className="right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.estimates.map((est) => (
                      <tr
                        key={est.id}
                        className="clickable"
                        onClick={() => navigate(`/estimates/${est.id}`)}
                      >
                        <td className="cell-strong">{est.number}</td>
                        <td className="muted">{formatDate(est.issue_date)}</td>
                        <td>
                          <Badge status={statusColor(est.status)} label={est.status} />
                        </td>
                        <td className="right mono">{money(est.total, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <Card title="Contact">
          <div className="kv">
            <span className="k">Email</span>
            <span>{data.email || '—'}</span>
          </div>
          <div className="kv">
            <span className="k">Phone</span>
            <span>{data.phone || '—'}</span>
          </div>
          <div className="kv" style={{ display: 'block' }}>
            <div className="k" style={{ marginBottom: 4 }}>
              Address
            </div>
            <div style={{ whiteSpace: 'pre-line' }}>{data.address || '—'}</div>
          </div>
          {data.notes && (
            <div className="kv" style={{ display: 'block' }}>
              <div className="k" style={{ marginBottom: 4 }}>
                Notes
              </div>
              <div style={{ whiteSpace: 'pre-line' }}>{data.notes}</div>
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <Link className="link" to="/clients">
              ← All clients
            </Link>
          </div>
        </Card>
      </div>

      <ClientModal
        open={editing}
        existing={data}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          reload();
          toast('Client updated.');
        }}
      />
    </>
  );
}
