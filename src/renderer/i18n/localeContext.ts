import { createContext, useContext } from 'react';
import type { SupportedLocale } from '@shared/types/language';

export interface LocaleContextValue {
  locale: SupportedLocale;
  setLocale: (nextLocale: SupportedLocale) => Promise<void>;
}

export const LocaleContext = createContext<LocaleContextValue | null>(null);

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within a LocaleContext provider.');
  }
  return context;
}
