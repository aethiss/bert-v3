const stripTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

export function getApiBaseUrl(): string {
  const envValue = import.meta.env.VITE_API_URL ?? import.meta.env.RENDERER_VITE_API_URL;
  if (!envValue) {
    throw new Error(
      'Missing API base URL. Set VITE_API_URL or RENDERER_VITE_API_URL in your environment.'
    );
  }

  return stripTrailingSlash(envValue);
}
