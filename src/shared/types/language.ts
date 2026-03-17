export const SUPPORTED_LOCALES = ['en', 'ar'] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export function isSupportedLocale(value: string | null | undefined): value is SupportedLocale {
  return value === 'en' || value === 'ar';
}
