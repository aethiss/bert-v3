import type { RuntimeConfig } from '../types/config';

export const DEFAULT_CONFIG: RuntimeConfig = {
  mode: 'CLIENT',
  apiPort: 4860
};

export function loadRuntimeConfig(): RuntimeConfig {
  return DEFAULT_CONFIG;
}
