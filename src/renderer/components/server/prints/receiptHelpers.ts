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

  if (normalized.length <= 6) {
    return normalized;
  }

  const start = normalized.slice(0, 3);
  const end = normalized.slice(-3);
  return `${start}${'*'.repeat(normalized.length - 6)}${end}`;
}

export function formatReceiptSequence(value: number | string | null | undefined): string {
  if (value === null || value === undefined) {
    return 'N/A';
  }

  const numericValue = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(numericValue)) {
    return 'N/A';
  }

  return String(Math.trunc(numericValue)).padStart(4, '0');
}

export function buildReceiptId(params: {
  fdpCode: string | null | undefined;
  householdId: number | string;
  sequence: number | string | null | undefined;
}): string {
  const fdpCode = (params.fdpCode ?? '').trim();
  const householdId = String(params.householdId).trim();
  const sequence = formatReceiptSequence(params.sequence);

  if (!fdpCode || !householdId || sequence === 'N/A') {
    return 'N/A';
  }

  return `${fdpCode}-${householdId}-${sequence}`;
}

export function splitReceiptId(value: string): { prefix: string; sequence: string } | null {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const lastSeparatorIndex = normalized.lastIndexOf('-');
  if (lastSeparatorIndex < 0 || lastSeparatorIndex === normalized.length - 1) {
    return null;
  }

  return {
    prefix: normalized.slice(0, lastSeparatorIndex),
    sequence: normalized.slice(lastSeparatorIndex + 1)
  };
}

export function formatReceiptMetricValue(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 'N/A';
  }

  return Number.isInteger(value) ? value.toFixed(1) : String(value);
}
