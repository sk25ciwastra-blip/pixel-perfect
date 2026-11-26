// Dedicated offline-only dev server for UI-26-02 synthetic browser smoke tests.
// Do NOT use the Lovable / TanStack production config or connect to Cloud here.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
  server: {
    host: '127.0.0.1',
    port: 4187,
    strictPort: true,
  },
});
