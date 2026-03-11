import type { AppMode } from '../../shared/types/appMode';

export interface RuntimeConfig {
  mode: AppMode;
  apiPort: number;
}
