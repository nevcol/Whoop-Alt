import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { useCurrency } from '../lib/store';
import { money } from '../lib/format';
import {
  Button,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  Spinner,
  useToast,
} from '../components/ui';
import type { Client } from '../lib/types';

export function Clients() {
  const navigate = useNavigate();
  const currency = useCurrency();
  const toast = useToast();
  const { data: clients, loading, reload } = useAsync(() => api.listClients(), []);
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle={clients ? `${clients.length} client(s)` : undefined}
        actions={
          <Button variant="primary" onClick={() => setModalOpen(true)}>
            + New client
          </Button>
        }
      />

      {loading ? (
        <Spinner label="Loading clients…" />
      ) : !clients || clients.length === 0 ? (
        <EmptyState
          icon="👥"
          title="No clients yet"
          message="Add your first client to start invoicing."
          action={
            <Button variant="primary" onClick={() => setModalOpen(true)}>
              + New client
            </Button>
          }
        />
      ) : (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Name</th>
                <th>Company</th>
                <th>Email</th>
                <th className="right">Invoices</th>
                <th className="right">Billed</th>
                <th className="right">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr
                  key={c.id}
                  className="clickable"
                  onClick={() => navigate(`/clients/${c.id}`)}
                >
                  <td className="cell-strong">{c.name}</td>
                  <td className="muted">{c.company || '—'}</td>
                  <td className="muted">{c.email || '—'}</td>
                  <td className="right mono">{c.invoice_count}</td>
                  <td className="right mono">{money(c.total_billed, currency)}</td>
                  <td className="right mono">
                    {c.outstanding ? money(c.outstanding, currency) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ClientModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          setModalOpen(false);
          reload();
          toast('Client added.');
        }}
      />
    </>
  );
}

const empty: Partial<Client> = {
  name: '',
  company: '',
  email: '',
  phone: '',
  address: '',
  notes: '',
};

export function ClientModal({
  open,
  onClose,
  onSaved,
  existing,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (c: Client) => void;
  existing?: Client;
}) {
  const toast = useToast();
  const [form, setForm] = useState<Partial<Client>>(existing ?? empty);
  const [saving, setSaving] = useState(false);

  // Reset the form whenever the modal is (re)opened.
  const [seenOpen, setSeenOpen] = useState(false);
  if (open && !seenOpen) {
    setForm(existing ?? empty);
    setSeenOpen(true);
  }
  if (!open && seenOpen) setSeenOpen(false);

  const set = (k: keyof Client) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit() {
    if (!form.name?.trim()) {
      toast('Name is required.', 'err');
      return;
    }
    setSaving(true);
    try {
      const saved = existing
        ? await api.updateClient(existing.id, form)
        : await api.createClient(form);
      onSaved(saved);
    } catch (e: any) {
      toast(e.message ?? 'Failed to save.', 'err');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={existing ? 'Edit client' : 'New client'}>
      <div className="form-row">
        <Field label="Name">
          <input className="inp" value={form.name ?? ''} onChange={set('name')} />
        </Field>
        <Field label="Company">
          <input className="inp" value={form.company ?? ''} onChange={set('company')} />
        </Field>
      </div>
      <div className="form-row">
        <Field label="Email">
          <input className="inp" value={form.email ?? ''} onChange={set('email')} />
        </Field>
        <Field label="Phone">
          <input className="inp" value={form.phone ?? ''} onChange={set('phone')} />
        </Field>
      </div>
      <Field label="Address">
        <textarea className="inp" value={form.address ?? ''} onChange={set('address')} />
      </Field>
      <Field label="Notes">
        <textarea className="inp" value={form.notes ?? ''} onChange={set('notes')} />
      </Field>
      <div className="form-actions">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={submit} disabled={saving}>
          {existing ? 'Save changes' : 'Add client'}
        </Button>
      </div>
    </Modal>
  );
}
