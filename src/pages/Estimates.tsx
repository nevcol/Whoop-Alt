import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { useCurrency } from '../lib/store';
import { money, formatDate, statusColor } from '../lib/format';
import { Badge, Button, EmptyState, PageHeader, Spinner } from '../components/ui';

const FILTERS = ['all', 'draft', 'sent', 'accepted', 'declined', 'converted'] as const;

export function Estimates() {
  const navigate = useNavigate();
  const currency = useCurrency();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');
  const { data, loading } = useAsync(() => api.listEstimates(), []);

  const rows = (data ?? []).filter((r) =>
    filter === 'all' ? true : r.status === filter,
  );

  return (
    <>
      <PageHeader
        title="Estimates"
        subtitle={data ? `${data.length} estimate(s)` : undefined}
        actions={
          <Button variant="primary" onClick={() => navigate('/estimates/new')}>
            + New estimate
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
        <Spinner label="Loading estimates…" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon="📄"
          title={filter === 'all' ? 'No estimates yet' : `No ${filter} estimates`}
          message={
            filter === 'all'
              ? 'Create an estimate and convert it to an invoice when accepted.'
              : undefined
          }
          action={
            filter === 'all' ? (
              <Button variant="primary" onClick={() => navigate('/estimates/new')}>
                + New estimate
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Estimate</th>
                <th>Client</th>
                <th>Issued</th>
                <th>Valid until</th>
                <th>Status</th>
                <th className="right">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="clickable"
                  onClick={() => navigate(`/estimates/${r.id}`)}
                >
                  <td className="cell-strong">{r.number}</td>
                  <td>{r.client_name}</td>
                  <td className="muted">{formatDate(r.issue_date)}</td>
                  <td className="muted">{formatDate(r.expiry_date)}</td>
                  <td>
                    <Badge status={statusColor(r.status)} label={r.status} />
                  </td>
                  <td className="right mono">{money(r.total, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
