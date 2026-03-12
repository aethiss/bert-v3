export function formatReceiptDateTime(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return 'N/A';
  }

  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

export function hideMiddleNumbers(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    return 'N/A';
  }

  if (normalized.length <= 4) {
    return normalized;
  }

  const start = normalized.slice(0, 2);
  const end = normalized.slice(-2);
  return `${start}${'*'.repeat(normalized.length - 4)}${end}`;
}
