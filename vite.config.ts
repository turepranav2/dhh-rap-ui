import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';
import { authorDevPlugin } from './scripts/author-dev-plugin';

export default defineConfig({
  // authorDevPlugin is apply:'serve' only: nothing of it exists in a build.
  plugins: [react(), tailwindcss(), authorDevPlugin()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
  },
});
