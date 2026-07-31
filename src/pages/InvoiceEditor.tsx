import { useParams, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { useSettings } from '../lib/store';
import { DocumentEditor } from '../components/DocumentEditor';
import { PageHeader, Spinner, EmptyState } from '../components/ui';

export function InvoiceEditor() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const editing = Boolean(id);
  const { settings } = useSettings();

  const { data: clients, loading: cLoading } = useAsync(() => api.listClients(), []);
  const { data: invoice, loading: iLoading } = useAsync(
    () => (id ? api.getInvoice(Number(id)) : Promise.resolve(null)),
    [id],
  );

  if (cLoading || iLoading || !settings) return <Spinner label="Loading…" />;
  if (!clients || clients.length === 0)
    return (
      <EmptyState
        icon="👥"
        title="Add a client first"
        message="You need at least one client before creating an invoice."
      />
    );

  const defaultClient = params.get('client')
    ? Number(params.get('client'))
    : undefined;

  return (
    <>
      <PageHeader
        title={editing ? `Edit ${invoice?.number ?? 'invoice'}` : 'New invoice'}
      />
      <DocumentEditor
        kind="invoice"
        clients={clients}
        settings={settings}
        existing={invoice ?? undefined}
        defaultClientId={defaultClient}
      />
    </>
  );
}
