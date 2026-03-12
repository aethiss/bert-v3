export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null) {
    const candidate = error as {
      message?: unknown;
      error?: unknown;
      status?: unknown;
      data?: unknown;
    };

    if (typeof candidate.message === 'string' && candidate.message.length > 0) {
      return candidate.message;
    }

    if (typeof candidate.error === 'string' && candidate.error.length > 0) {
      if (candidate.status !== undefined) {
        return `${String(candidate.status)}: ${candidate.error}`;
      }
      return candidate.error;
    }

    if (candidate.data !== undefined) {
      try {
        return JSON.stringify(candidate.data);
      } catch {
        return 'Unexpected error';
      }
    }
  }

  if (typeof error === 'string' && error.length > 0) {
    return error;
  }

  return 'Unexpected error';
}

export function isRtkLikeError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const candidate = error as {
    status?: unknown;
    error?: unknown;
    data?: unknown;
  };

  return candidate.status !== undefined || candidate.error !== undefined || candidate.data !== undefined;
}
