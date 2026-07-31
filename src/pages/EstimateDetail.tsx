import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { useSettings } from '../lib/store';
import { formatDate } from '../lib/format';
import { DocumentView } from '../components/DocumentView';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Spinner,
  useToast,
} from '../components/ui';

export function EstimateDetail() {
  const { id } = useParams();
  const estimateId = Number(id);
  const navigate = useNavigate();
  const toast = useToast();
  const { settings } = useSettings();
  const { data, loading, reload } = useAsync(
    () => api.getEstimate(estimateId),
    [estimateId],
  );

  if (loading || !settings) return <Spinner label="Loading estimate…" />;
  if (!data)
    return (
      <EmptyState
        title="Estimate not found"
        action={<Button onClick={() => navigate('/estimates')}>Back to estimates</Button>}
      />
    );

  const est = data;
  const locked = est.status === 'converted';

  async function setStatus(status: 'draft' | 'sent' | 'accepted' | 'declined') {
    try {
      await api.setEstimateStatus(estimateId, status);
      toast('Status updated.');
      reload();
    } catch (e: any) {
      toast(e.message, 'err');
    }
  }

  async function convert() {
    if (!confirm('Convert this estimate into a draft invoice?')) return;
    try {
      const invoice = await api.convertEstimate(estimateId);
      toast(`Created ${invoice.number}.`);
      navigate(`/invoices/${invoice.id}`);
    } catch (e: any) {
      toast(e.message, 'err');
    }
  }

  async function remove() {
    if (!confirm(`Delete ${est.number}?`)) return;
    try {
      await api.deleteEstimate(estimateId);
      toast('Estimate deleted.');
      navigate('/estimates');
    } catch (e: any) {
      toast(e.message, 'err');
    }
  }

  return (
    <>
      <PageHeader
        title={
          <span style={{ display: 'inline-flex', gap: 12, alignItems: 'center' }}>
            {est.number}
            <Badge status={statusColor(est.status)} label={est.status} />
          </span>
        }
        subtitle={est.client?.name}
        actions={
          <div className="page-actions no-print">
            {!locked && (
              <Button onClick={() => navigate(`/estimates/${estimateId}/edit`)}>
                Edit
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={async () => {
                const { downloadDocumentPdf } = await import('../lib/pdf');
                downloadDocumentPdf('estimate', est, settings);
              }}
            >
              ⬇ PDF
            </Button>
            <Button variant="secondary" onClick={() => window.print()}>
              Print
            </Button>
            {!locked && (
              <Button variant="primary" onClick={convert}>
                Convert to invoice
              </Button>
            )}
          </div>
        }
      />

      <div className="detail-grid">
        <DocumentView kind="estimate" doc={est} settings={settings} />

        <div className="stack no-print">
          <Card title="Status">
            {locked ? (
              <p style={{ margin: 0, fontSize: 14 }}>
                Converted to invoice.{' '}
                {est.converted_invoice_id && (
                  <span
                    className="link"
                    onClick={() => navigate(`/invoices/${est.converted_invoice_id}`)}
                  >
                    View invoice →
                  </span>
                )}
              </p>
            ) : (
              <>
                <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
                  Update the estimate as your client responds.
                </p>
                <div className="chips">
                  <Button size="sm" variant="secondary" onClick={() => setStatus('sent')}>
                    Sent
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setStatus('accepted')}>
                    Accepted
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setStatus('declined')}>
                    Declined
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setStatus('draft')}>
                    Draft
                  </Button>
                </div>
              </>
            )}
          </Card>

          <Card title="Details">
            <div className="kv">
              <span className="k">Issued</span>
              <span>{formatDate(est.issue_date)}</span>
            </div>
            <div className="kv">
              <span className="k">Valid until</span>
              <span>{formatDate(est.expiry_date)}</span>
            </div>
          </Card>

          {!locked && (
            <Button variant="danger" onClick={remove}>
              Delete estimate
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

function statusColor(s: string): string {
  const map: Record<string, string> = {
    draft: 'gray',
    sent: 'blue',
    accepted: 'green',
    declined: 'red',
    converted: 'violet',
    expired: 'gray',
  };
  return map[s] ?? 'gray';
}
