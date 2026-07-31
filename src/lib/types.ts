export interface Settings {
  id: number;
  business_name: string;
  email: string;
  phone: string;
  address: string;
  website: string;
  currency: string;
  tax_rate: number;
  payment_terms: number;
  invoice_prefix: string;
  estimate_prefix: string;
  next_invoice_seq: number;
  next_estimate_seq: number;
  footer: string;
}

export interface Client {
  id: number;
  name: string;
  company: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  created_at: string;
  invoice_count?: number;
  total_billed?: number;
  outstanding?: number;
  open_invoices?: number;
}

export interface Service {
  id: number;
  name: string;
  category: string;
  description: string;
  rate: number;
  unit: string;
  active: number;
  position: number;
  created_at: string;
}

export interface LineItem {
  id?: number;
  description: string;
  quantity: number;
  rate: number;
  position?: number;
}

export interface Payment {
  id: number;
  invoice_id: number;
  amount: number;
  date: string;
  method: string;
  note: string;
  created_at: string;
}

export type InvoiceStatus =
  | 'draft'
  | 'sent'
  | 'partial'
  | 'paid'
  | 'overdue';

export interface Invoice {
  id: number;
  number: string;
  client_id: number;
  client?: Client;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  tax_rate: number;
  discount: number;
  notes: string;
  from_estimate_id: number | null;
  items: LineItem[];
  payments: Payment[];
  subtotal: number;
  tax: number;
  total: number;
  paid: number;
  balance: number;
}

export interface InvoiceListRow {
  id: number;
  number: string;
  client_id: number;
  client_name: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  total: number;
  paid: number;
  balance: number;
}

export type EstimateStatus =
  | 'draft'
  | 'sent'
  | 'accepted'
  | 'declined'
  | 'converted'
  | 'expired';

export interface Estimate {
  id: number;
  number: string;
  client_id: number;
  client?: Client;
  status: EstimateStatus;
  issue_date: string;
  expiry_date: string;
  tax_rate: number;
  discount: number;
  notes: string;
  converted_invoice_id: number | null;
  items: LineItem[];
  subtotal: number;
  tax: number;
  total: number;
}

export interface EstimateListRow {
  id: number;
  number: string;
  client_id: number;
  client_name: string;
  status: EstimateStatus;
  issue_date: string;
  expiry_date: string;
  total: number;
  converted_invoice_id: number | null;
}

export interface Summary {
  outstanding: number;
  overdue: number;
  draft_total: number;
  revenue_30: number;
  revenue_total: number;
  client_count: number;
  invoice_count: number;
  counts: Record<string, number>;
  monthly: { label: string; revenue: number }[];
  top_clients: { id: number; name: string; billed: number }[];
}
