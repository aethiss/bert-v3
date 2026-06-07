const AUTH_EXPIRED_ERROR_PREFIX = 'AUTH_EXPIRED:';

function extractMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null) {
    const candidate = error as {
      message?: unknown;
      error?: unknown;
      data?: unknown;
    };

    if (candidate.data instanceof Error) {
      return candidate.data.message;
    }

    if (typeof candidate.data === 'object' && candidate.data !== null) {
      const nested = candidate.data as {
        message?: unknown;
        error?: unknown;
      };

      if (typeof nested.message === 'string') {
        return nested.message;
      }

      if (typeof nested.error === 'string') {
        return nested.error;
      }
    }

    if (typeof candidate.message === 'string') {
      return candidate.message;
    }

    if (typeof candidate.error === 'string') {
      return candidate.error;
    }
  }

  return '';
}

export function isAuthExpiredError(error: unknown): boolean {
  if (typeof error === 'object' && error !== null) {
    const candidate = error as {
      status?: unknown;
      error?: unknown;
      data?: unknown;
    };

    if (candidate.status === 401 || candidate.status === 403) {
      return true;
    }
  }

  const message = extractMessage(error).trim();
  return (
    message.startsWith(AUTH_EXPIRED_ERROR_PREFIX) ||
    /expired|unauthori[sz]ed|forbidden|invalid token|jwt/i.test(message)
  );
}

export function getAuthExpiredMessage(): string {
  return 'Your login session expired. Please log in again before using Push Distribution.';
}
