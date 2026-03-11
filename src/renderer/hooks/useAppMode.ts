import { useMemo } from 'react';
import type { AppMode } from '../../shared/types/appMode';

export function useAppMode(): AppMode {
  return useMemo(() => 'CLIENT', []);
}
