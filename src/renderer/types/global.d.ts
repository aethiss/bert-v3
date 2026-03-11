import type { BertAppApi } from '@shared/types/preload';

declare global {
  interface Window {
    bertApp: BertAppApi;
  }
}

export {};
