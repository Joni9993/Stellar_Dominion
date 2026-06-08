import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@stellar-dominion/shared': resolve(__dirname, '../shared/src/index.ts'),
    },
  },
  server: {
    port: 3000,
  },
});
