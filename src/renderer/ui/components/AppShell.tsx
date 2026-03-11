import type { PropsWithChildren } from 'react';

export function AppShell({ children }: PropsWithChildren) {
  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      {children}
    </main>
  );
}
