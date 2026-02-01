import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getProviderDisplayName(provider: string): string {
  const names: Record<string, string> = {
    GMAIL: 'Gmail',
    OUTLOOK: 'Outlook / Microsoft 365',
    IMAP: 'IMAP (Strato/andere)',
  };
  return names[provider] || provider;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    ACTIVE: 'bg-green-500',
    INACTIVE: 'bg-gray-500',
    ERROR: 'bg-red-500',
    NEEDS_REAUTH: 'bg-yellow-500',
  };
  return colors[status] || 'bg-gray-500';
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}
