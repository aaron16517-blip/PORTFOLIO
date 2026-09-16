import { defineConfig } from 'vite';

export default defineConfig({
  /* PORT lets the harness assign a free port when 5173 is taken */
  server: { port: Number(process.env.PORT) || 5173, host: true },
  build: { outDir: 'dist', assetsInlineLimit: 0 }
});
