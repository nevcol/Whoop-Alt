import { useParams, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { useSettings } from '../lib/store';
import { DocumentEditor } from '../components/DocumentEditor';
import { PageHeader, Spinner, EmptyState } from '../components/ui';

export function EstimateEditor() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const editing = Boolean(id);
  const { settings } = useSettings();

  const { data: clients, loading: cLoading } = useAsync(() => api.listClients(), []);
  const { data: estimate, loading: eLoading } = useAsync(
    () => (id ? api.getEstimate(Number(id)) : Promise.resolve(null)),
    [id],
  );

  if (cLoading || eLoading || !settings) return <Spinner label="Loading…" />;
  if (!clients || clients.length === 0)
    return (
      <EmptyState
        icon="👥"
        title="Add a client first"
        message="You need at least one client before creating an estimate."
      />
    );

  const defaultClient = params.get('client')
    ? Number(params.get('client'))
    : undefined;

  return (
    <>
      <PageHeader
        title={editing ? `Edit ${estimate?.number ?? 'estimate'}` : 'New estimate'}
      />
      <DocumentEditor
        kind="estimate"
        clients={clients}
        settings={settings}
        existing={estimate ?? undefined}
        defaultClientId={defaultClient}
      />
    </>
  );
}
