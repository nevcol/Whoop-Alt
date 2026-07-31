import { useState } from 'react';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { useCurrency } from '../lib/store';
import { money } from '../lib/format';
import {
  Button,
  Card,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  Spinner,
  useToast,
} from '../components/ui';
import type { Service } from '../lib/types';

/** Categories that match the coaching / tennis / speaking lines of work. */
export const SERVICE_CATEGORIES = [
  'Personal Training',
  'Strength & Conditioning',
  'Tennis Coaching',
  'Tennis Performance',
  'Speaking & Education',
  'General',
];

export function Services() {
  const currency = useCurrency();
  const toast = useToast();
  const { data, loading, reload } = useAsync(() => api.listServices(true), []);
  const [editing, setEditing] = useState<Service | null>(null);
  const [creating, setCreating] = useState(false);

  if (loading) return <Spinner label="Loading services…" />;

  const services = data ?? [];
  const grouped = new Map<string, Service[]>();
  for (const s of services) {
    const list = grouped.get(s.category) ?? [];
    list.push(s);
    grouped.set(s.category, list);
  }
  // Show known categories in a sensible order, then anything custom.
  const ordered = [
    ...SERVICE_CATEGORIES.filter((c) => grouped.has(c)),
    ...[...grouped.keys()].filter((c) => !SERVICE_CATEGORIES.includes(c)),
  ];

  async function remove(s: Service) {
    if (!confirm(`Delete "${s.name}"? Existing invoices are not affected.`)) return;
    try {
      await api.deleteService(s.id);
      toast('Service deleted.');
      reload();
    } catch (e: any) {
      toast(e.message, 'err');
    }
  }

  async function toggleActive(s: Service) {
    try {
      await api.updateService(s.id, { active: s.active ? false : (true as any) });
      reload();
    } catch (e: any) {
      toast(e.message, 'err');
    }
  }

  return (
    <>
      <PageHeader
        title="Services & rates"
        subtitle="Your repeatable offerings — add them to any invoice or estimate in one click."
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            + New service
          </Button>
        }
      />

      {services.length === 0 ? (
        <EmptyState
          icon="🏋"
          title="No services yet"
          message="Save the sessions, packages and engagements you bill for so you never retype a rate."
          action={
            <Button variant="primary" onClick={() => setCreating(true)}>
              + New service
            </Button>
          }
        />
      ) : (
        <div className="stack">
          {ordered.map((cat) => (
            <Card key={cat} title={cat}>
              <div className="table-wrap" style={{ boxShadow: 'none', border: 'none' }}>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Service</th>
                      <th>Description</th>
                      <th className="right">Rate</th>
                      <th>Unit</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {grouped.get(cat)!.map((s) => (
                      <tr key={s.id} style={{ opacity: s.active ? 1 : 0.5 }}>
                        <td className="cell-strong">
                          {s.name}
                          {!s.active && (
                            <span className="muted" style={{ fontSize: 12 }}>
                              {' '}
                              (inactive)
                            </span>
                          )}
                        </td>
                        <td className="muted">{s.description || '—'}</td>
                        <td className="right mono">{money(s.rate, currency)}</td>
                        <td className="muted">{s.unit}</td>
                        <td className="right" style={{ whiteSpace: 'nowrap' }}>
                          <Button size="sm" variant="ghost" onClick={() => toggleActive(s)}>
                            {s.active ? 'Hide' : 'Show'}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditing(s)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => remove(s)}>
                            Delete
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ServiceModal
        open={creating || editing !== null}
        existing={editing ?? undefined}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={() => {
          setCreating(false);
          setEditing(null);
          reload();
          toast('Service saved.');
        }}
      />
    </>
  );
}

const emptyService: Partial<Service> = {
  name: '',
  category: 'Personal Training',
  description: '',
  rate: 0,
  unit: 'session',
};

function ServiceModal({
  open,
  onClose,
  onSaved,
  existing,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  existing?: Service;
}) {
  const toast = useToast();
  const [form, setForm] = useState<Partial<Service>>(existing ?? emptyService);
  const [saving, setSaving] = useState(false);

  // Reload the form each time the modal opens (or switches record).
  const [key, setKey] = useState<string>('');
  const openKey = `${open}-${existing?.id ?? 'new'}`;
  if (open && key !== openKey) {
    setForm(existing ?? emptyService);
    setKey(openKey);
  }
  if (!open && key !== '') setKey('');

  const set =
    (k: keyof Service) => (e: { target: { value: string } }) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit() {
    if (!form.name?.trim()) {
      toast('Name is required.', 'err');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, rate: Number(form.rate) || 0 };
      if (existing) await api.updateService(existing.id, payload);
      else await api.createService(payload);
      onSaved();
    } catch (e: any) {
      toast(e.message, 'err');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={existing ? 'Edit service' : 'New service'}
    >
      <Field label="Name">
        <input
          className="inp"
          value={form.name ?? ''}
          onChange={set('name')}
          placeholder="e.g. Private Tennis Lesson"
        />
      </Field>
      <Field label="Category">
        <select className="inp" value={form.category ?? ''} onChange={set('category')}>
          {SERVICE_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </Field>
      <Field label="Description">
        <input
          className="inp"
          value={form.description ?? ''}
          onChange={set('description')}
          placeholder="Shown as the line-item description"
        />
      </Field>
      <div className="form-row">
        <Field label="Rate">
          <input
            className="inp mono"
            type="number"
            step="any"
            value={form.rate ?? 0}
            onChange={set('rate')}
          />
        </Field>
        <Field label="Unit" hint="session, package, hour, engagement…">
          <input className="inp" value={form.unit ?? ''} onChange={set('unit')} />
        </Field>
      </div>
      <div className="form-actions">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={submit} disabled={saving}>
          {existing ? 'Save changes' : 'Add service'}
        </Button>
      </div>
    </Modal>
  );
}
