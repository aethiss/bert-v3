const HASH_BOUNDED_REGEX = /#\s*([0-9]{6,20})\s*#/g;
const HASH_PREFIX_REGEX = /#\s*([0-9]{6,20})/g;
const HASH_SUFFIX_REGEX = /([0-9]{6,20})\s*#/g;

function pickDocumentIdCandidate(candidates: string[]): string | null {
  if (candidates.length === 0) {
    return null;
  }

  const exactTenDigits = candidates.find((candidate) => candidate.length === 10);
  if (exactTenDigits) {
    return exactTenDigits;
  }

  // Prefer the shortest viable id when no exact 10-digit match is available.
  return [...candidates].sort((left, right) => left.length - right.length)[0] ?? null;
}

function collectMatches(input: string, regex: RegExp): string[] {
  const matches: string[] = [];
  for (const match of input.matchAll(regex)) {
    const value = (match[1] ?? '').trim();
    if (value.length > 0) {
      matches.push(value);
    }
  }
  return matches;
}

export function parseDocumentIdFromPdf417Payload(rawPayload: string): string | null {
  const payload = rawPayload.trim();
  if (!payload) {
    return null;
  }

  const orderedCandidates = [
    ...collectMatches(payload, HASH_BOUNDED_REGEX),
    ...collectMatches(payload, HASH_PREFIX_REGEX),
    ...collectMatches(payload, HASH_SUFFIX_REGEX)
  ];
  const uniqueCandidates = Array.from(new Set(orderedCandidates));
  return pickDocumentIdCandidate(uniqueCandidates);
}

