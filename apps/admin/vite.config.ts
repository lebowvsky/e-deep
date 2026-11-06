import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// https://vite.dev/config/ — Vitest options live here too, so tests share the alias and plugins.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Keep in sync with `paths` in tsconfig.json / tsconfig.app.json (also read by the shadcn CLI).
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5174, strictPort: true },
  preview: { port: 4174, strictPort: true },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Tests never read the real `.env`: the API client is injected through context.
    unstubGlobals: true,
    restoreMocks: true,
  },
});
