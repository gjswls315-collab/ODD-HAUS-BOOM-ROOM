import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { host: true },
  build: { chunkSizeWarningLimit: 1200 },
  test: { environment: 'node', include: ['tests/**/*.test.js'] },
});
