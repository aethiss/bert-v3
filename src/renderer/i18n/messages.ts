import type { SupportedLocale } from '@shared/types/language';
import enMessages from '../../locales/en.json';
import arMessages from '../../locales/ar.json';

export type LocaleMessages = Record<string, string>;

export const MESSAGES_BY_LOCALE: Record<SupportedLocale, LocaleMessages> = {
  en: enMessages as LocaleMessages,
  ar: arMessages as LocaleMessages
};

export function resolveLocaleFromDocument(): SupportedLocale {
  const current = document.documentElement.lang?.toLowerCase() ?? '';
  return current.startsWith('ar') ? 'ar' : 'en';
}

export function getUiMessage(id: string, fallback: string): string {
  const locale = resolveLocaleFromDocument();
  return MESSAGES_BY_LOCALE[locale][id] ?? fallback;
}
