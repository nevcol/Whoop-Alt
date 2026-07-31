const currencySymbols: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  CAD: 'C$',
  AUD: 'A$',
  JPY: '¥',
  INR: '₹',
  MXN: 'MX$',
};

export function currencySymbol(code: string): string {
  return currencySymbols[code] ?? `${code} `;
}

export function money(amount: number | null | undefined, currency = 'USD'): string {
  const n = amount ?? 0;
  const sym = currencySymbol(currency);
  return `${sym}${n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysISO(base: string, days: number): string {
  const d = new Date(`${base}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysUntil(iso: string): number {
  const d = new Date(`${iso}T00:00:00`).getTime();
  const now = new Date(todayISO() + 'T00:00:00').getTime();
  return Math.round((d - now) / 86400000);
}

const statusColors: Record<string, string> = {
  draft: 'gray',
  sent: 'blue',
  partial: 'amber',
  paid: 'green',
  overdue: 'red',
  accepted: 'green',
  declined: 'red',
  converted: 'violet',
  expired: 'gray',
};

export function statusColor(status: string): string {
  return statusColors[status] ?? 'gray';
}
