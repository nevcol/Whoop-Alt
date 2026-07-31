import type {
  Client,
  Estimate,
  EstimateListRow,
  Invoice,
  InvoiceListRow,
  LineItem,
  Settings,
  Summary,
} from './types';

async function req<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  // Settings
  getSettings: () => req<Settings>('/settings'),
  updateSettings: (data: Partial<Settings>) =>
    req<Settings>('/settings', { method: 'PUT', body: JSON.stringify(data) }),

  // Clients
  listClients: () => req<Client[]>('/clients'),
  getClient: (id: number) =>
    req<Client & { invoices: Invoice[]; estimates: EstimateListRow[] }>(
      `/clients/${id}`,
    ),
  createClient: (data: Partial<Client>) =>
    req<Client>('/clients', { method: 'POST', body: JSON.stringify(data) }),
  updateClient: (id: number, data: Partial<Client>) =>
    req<Client>(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteClient: (id: number) =>
    req<{ ok: true }>(`/clients/${id}`, { method: 'DELETE' }),

  // Invoices
  listInvoices: (params?: { status?: string; client_id?: number }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.client_id) q.set('client_id', String(params.client_id));
    const qs = q.toString();
    return req<InvoiceListRow[]>(`/invoices${qs ? `?${qs}` : ''}`);
  },
  getInvoice: (id: number) => req<Invoice>(`/invoices/${id}`),
  createInvoice: (data: InvoicePayload) =>
    req<Invoice>('/invoices', { method: 'POST', body: JSON.stringify(data) }),
  updateInvoice: (id: number, data: InvoicePayload) =>
    req<Invoice>(`/invoices/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  setInvoiceStatus: (id: number, status: 'draft' | 'sent') =>
    req<Invoice>(`/invoices/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),
  deleteInvoice: (id: number) =>
    req<{ ok: true }>(`/invoices/${id}`, { method: 'DELETE' }),
  addPayment: (
    id: number,
    data: { amount: number; date?: string; method?: string; note?: string },
  ) =>
    req<Invoice>(`/invoices/${id}/payments`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deletePayment: (invoiceId: number, paymentId: number) =>
    req<Invoice>(`/invoices/${invoiceId}/payments/${paymentId}`, {
      method: 'DELETE',
    }),

  // Estimates
  listEstimates: (params?: { status?: string }) => {
    const qs = params?.status ? `?status=${params.status}` : '';
    return req<EstimateListRow[]>(`/estimates${qs}`);
  },
  getEstimate: (id: number) => req<Estimate>(`/estimates/${id}`),
  createEstimate: (data: EstimatePayload) =>
    req<Estimate>('/estimates', { method: 'POST', body: JSON.stringify(data) }),
  updateEstimate: (id: number, data: EstimatePayload) =>
    req<Estimate>(`/estimates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  setEstimateStatus: (
    id: number,
    status: 'draft' | 'sent' | 'accepted' | 'declined',
  ) =>
    req<Estimate>(`/estimates/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),
  convertEstimate: (id: number) =>
    req<Invoice>(`/estimates/${id}/convert`, { method: 'POST' }),
  deleteEstimate: (id: number) =>
    req<{ ok: true }>(`/estimates/${id}`, { method: 'DELETE' }),

  // Reports
  getSummary: () => req<Summary>('/reports/summary'),
};

export interface InvoicePayload {
  client_id: number;
  issue_date: string;
  due_date: string;
  tax_rate: number;
  discount: number;
  notes: string;
  status?: 'draft' | 'sent';
  items: LineItem[];
}

export interface EstimatePayload {
  client_id: number;
  issue_date: string;
  expiry_date: string;
  tax_rate: number;
  discount: number;
  notes: string;
  status?: string;
  items: LineItem[];
}
