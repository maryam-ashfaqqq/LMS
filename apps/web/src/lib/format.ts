export function money(amount: number, currency = 'USD') {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

export function fullName(person: { firstName: string; lastName: string }) {
  return `${person.firstName} ${person.lastName}`;
}

export function initials(person: { firstName: string; lastName: string }) {
  return `${person.firstName.slice(0, 1)}${person.lastName.slice(0, 1)}`.toUpperCase();
}

export function priceLabel(item: { isFree: boolean; price: number }, currency = 'USD') {
  return item.isFree || item.price === 0 ? 'Free' : money(item.price, currency);
}

export function levelLabel(level: string) {
  return level.slice(0, 1).toUpperCase() + level.slice(1);
}

export function statusLabel(status: string) {
  return status.replaceAll('_', ' ');
}

export function pageCount(total: number, pageSize: number) {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function minutesLabel(minutes: number) {
  if (minutes <= 0) return 'Self-paced';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}
