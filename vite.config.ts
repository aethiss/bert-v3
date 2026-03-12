import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  envPrefix: ['VITE_', 'RENDERER_VITE_'],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@renderer': path.resolve(__dirname, 'src/renderer'),
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@ui': path.resolve(__dirname, 'src/renderer/ui'),
      '@hooks': path.resolve(__dirname, 'src/renderer/hooks'),
      '@services': path.resolve(__dirname, 'src/renderer/services'),
      '@types': path.resolve(__dirname, 'src/renderer/types')
    }
  },
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: false
  }
});
